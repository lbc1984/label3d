import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import pool from '../db.js';
import { attemptLogin, changePassword } from '../auth.js';
import requireAdmin from '../middleware/requireAdmin.js';
import csrfCheck from '../middleware/csrfCheck.js';
import { uploadFontFile, FONTS_DIR } from '../middleware/upload.js';
import { validateLimitUpdate, validateColorInput } from '../validate.js';

const router = express.Router();

router.use(csrfCheck);

// ===== Auth =====

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần thử đăng nhập từ địa chỉ này, thử lại sau.' },
});

router.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await attemptLogin(username, password);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    req.session.isAdmin = true;
    req.session.username = username;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid_admin');
    res.json({ ok: true });
  });
});

router.get('/api/admin/session', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.status(401).json({ loggedIn: false });
});

router.post('/api/admin/change-password', requireAdmin, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await changePassword(currentPassword, newPassword);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== Gioi han thong so =====

router.get('/api/admin/limits', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM parameter_limits ORDER BY param_key');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/api/admin/limits/:param_key', requireAdmin, async (req, res, next) => {
  try {
    const result = validateLimitUpdate(req.params.param_key, req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });

    // Kiem tra ton tai truoc bang SELECT rieng, KHONG dua vao affectedRows cua UPDATE:
    // MySQL mac dinh chi dem "so dong THAY DOI gia tri" cho UPDATE (khac SQLite dem
    // "so dong khop WHERE"), nen luu lai dung y het gia tri cu se cho affectedRows=0
    // va bi bao nham 404 neu dua vao no de xac dinh ton tai.
    const [existingRows] = await pool.execute(
      'SELECT param_key FROM parameter_limits WHERE param_key = ?', [req.params.param_key]
    );
    if (existingRows.length === 0) return res.status(404).json({ error: 'Không tìm thấy thông số.' });

    const v = result.value;
    await pool.execute(
      `UPDATE parameter_limits SET
          label = ?, min_value = ?, max_value = ?, step_value = ?, default_value = ?, unit = ?, updated_at = NOW()
        WHERE param_key = ?`,
      [v.label, v.min, v.max, v.step, v.default, v.unit, req.params.param_key]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== Mau nhua =====

router.get('/api/admin/colors', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM colors ORDER BY series, sort_order, id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/api/admin/colors', requireAdmin, async (req, res, next) => {
  const result = validateColorInput(req.body);
  if (!result.ok) return res.status(400).json({ error: result.error });
  try {
    const [insertResult] = await pool.execute(
      'INSERT INTO colors (series, name, hex, sort_order) VALUES (?, ?, ?, ?)',
      [result.value.series, result.value.name, result.value.hex, result.value.sort_order]
    );
    res.status(201).json({ id: insertResult.insertId, active: 1, ...result.value });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Màu này (cùng series + tên) đã tồn tại.' });
    }
    next(err);
  }
});

router.put('/api/admin/colors/:id', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM colors WHERE id = ?', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy màu.' });

    const result = validateColorInput({
      series: req.body?.series ?? existing.series,
      name: req.body?.name ?? existing.name,
      hex: req.body?.hex ?? existing.hex,
      sort_order: req.body?.sort_order ?? existing.sort_order,
    });
    if (!result.ok) return res.status(400).json({ error: result.error });
    const active = typeof req.body?.active === 'boolean' ? (req.body.active ? 1 : 0) : existing.active;

    try {
      await pool.execute(
        'UPDATE colors SET series = ?, name = ?, hex = ?, sort_order = ?, active = ? WHERE id = ?',
        [result.value.series, result.value.name, result.value.hex, result.value.sort_order, active, req.params.id]
      );
      res.json({ ok: true });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Màu này (cùng series + tên) đã tồn tại.' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/api/admin/colors/:id', requireAdmin, async (req, res, next) => {
  try {
    const [result] = await pool.execute('DELETE FROM colors WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy màu.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ===== Font =====

router.get('/api/admin/fonts', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM fonts ORDER BY role, sort_order, id');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const fontUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều lần upload font, thử lại sau 1 giờ.' },
});

router.post('/api/admin/fonts', requireAdmin, fontUploadLimiter, uploadFontFile, async (req, res, next) => {
  try {
    const { role, display_name } = req.body || {};
    if (role !== 'text' && role !== 'emoji') {
      fs.unlink(path.join(FONTS_DIR, req.uploadedFont.fileName), () => {});
      return res.status(400).json({ error: '"role" phải là "text" hoặc "emoji".' });
    }

    const name = typeof display_name === 'string' && display_name.trim()
      ? display_name.trim()
      : req.file.originalname.replace(/\.[^.]+$/, '');

    const [maxRows] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS m FROM fonts WHERE role = ?', [role]
    );
    const maxOrder = maxRows[0].m;

    const [insertResult] = await pool.execute(
      `INSERT INTO fonts (role, display_name, file_name, format, is_default, active, sort_order)
       VALUES (?, ?, ?, ?, 0, 1, ?)`,
      [role, name, req.uploadedFont.fileName, req.uploadedFont.format, maxOrder + 1]
    );

    res.status(201).json({
      id: insertResult.insertId, role, display_name: name,
      format: req.uploadedFont.format, glyphCount: req.uploadedFont.glyphCount,
    });
  } catch (err) {
    next(err);
  }
});

async function setDefaultFont(id, role) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE fonts SET is_default = 0 WHERE role = ? AND id != ?', [role, id]);
    await conn.execute('UPDATE fonts SET is_default = 1 WHERE id = ?', [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

router.put('/api/admin/fonts/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM fonts WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Không tìm thấy font.' });

    const { display_name, active, is_default, sort_order } = req.body || {};

    if (active === false && row.active === 1) {
      const [othersRows] = await pool.execute(
        'SELECT COUNT(*) AS n FROM fonts WHERE role = ? AND id != ? AND active = 1', [row.role, id]
      );
      if (othersRows[0].n === 0) {
        return res.status(400).json({ error: 'Không thể tắt font active cuối cùng của vai trò này.' });
      }
    }

    await pool.execute(
      `UPDATE fonts SET
          display_name = COALESCE(?, display_name),
          active = COALESCE(?, active),
          sort_order = COALESCE(?, sort_order)
        WHERE id = ?`,
      [
        typeof display_name === 'string' && display_name.trim() ? display_name.trim() : null,
        typeof active === 'boolean' ? (active ? 1 : 0) : null,
        Number.isFinite(sort_order) ? sort_order : null,
        id,
      ]
    );

    if (is_default === true) await setDefaultFont(id, row.role);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/api/admin/fonts/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute('SELECT * FROM fonts WHERE id = ?', [id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Không tìm thấy font.' });

    if (row.active) {
      const [othersRows] = await pool.execute(
        'SELECT COUNT(*) AS n FROM fonts WHERE role = ? AND id != ? AND active = 1', [row.role, id]
      );
      if (othersRows[0].n === 0) {
        return res.status(400).json({ error: 'Không thể xoá font active cuối cùng của vai trò này.' });
      }
    }

    await pool.execute('DELETE FROM fonts WHERE id = ?', [id]);
    fs.unlink(path.join(FONTS_DIR, row.file_name), () => {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
