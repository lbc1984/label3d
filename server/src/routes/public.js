import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, '..', '..', 'data', 'fonts');

const router = express.Router();

// GET /api/config — bootstrap trang khach: gioi han slider + mau nhua + danh sach font
router.get('/api/config', async (req, res, next) => {
  try {
    const [limitRows] = await pool.query('SELECT * FROM parameter_limits');
    const limits = {};
    for (const r of limitRows) {
      limits[r.param_key] = {
        label: r.label,
        min: r.min_value,
        max: r.max_value,
        step: r.step_value,
        default: r.default_value,
        unit: r.unit,
      };
    }

    const [colorRows] = await pool.query(
      'SELECT series, name, hex FROM colors WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    );
    const colorsBySeries = new Map();
    for (const r of colorRows) {
      if (!colorsBySeries.has(r.series)) colorsBySeries.set(r.series, []);
      colorsBySeries.get(r.series).push([r.name, r.hex]);
    }
    const colors = [...colorsBySeries.entries()].map(([series, list]) => ({ series, colors: list }));

    const [fontRows] = await pool.query(
      'SELECT id, role, display_name, is_default FROM fonts WHERE active = 1 ORDER BY sort_order ASC, id ASC'
    );
    const fonts = fontRows.map((r) => ({
      id: r.id,
      role: r.role,
      name: r.display_name,
      url: `/fonts/${r.id}`,
      isDefault: !!r.is_default,
    }));

    res.json({ limits, colors, fonts });
  } catch (err) {
    next(err);
  }
});

// GET /fonts/:id — serve binary font co kiem soat (khong dung express.static tren thu muc upload)
router.get('/fonts/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).end();

    const [rows] = await pool.execute('SELECT file_name, format, active FROM fonts WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || !row.active) return res.status(404).end();

    const filePath = path.resolve(FONTS_DIR, row.file_name);
    // defense-in-depth: dam bao path da resolve van nam trong FONTS_DIR du ten file da an toan tu dau
    if (!filePath.startsWith(FONTS_DIR + path.sep)) return res.status(400).end();
    if (!fs.existsSync(filePath)) return res.status(404).end();

    res.setHeader('Content-Type', row.format === 'otf' ? 'font/otf' : 'font/ttf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
