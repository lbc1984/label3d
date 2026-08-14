import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import opentype from 'opentype.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FONTS_DIR = path.resolve(__dirname, '..', '..', 'data', 'fonts');
fs.mkdirSync(FONTS_DIR, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB / file
const MAX_TOTAL_BYTES = (Number(process.env.FONTS_MAX_TOTAL_MB) || 200) * 1024 * 1024;

const multerUpload = multer({
  storage: multer.memoryStorage(), // chua ghi dia cho den khi validate xong
  limits: { fileSize: MAX_FILE_SIZE },
});

function currentFontsDirSizeBytes() {
  return fs.readdirSync(FONTS_DIR).reduce((sum, f) => {
    try {
      return sum + fs.statSync(path.join(FONTS_DIR, f)).size;
    } catch {
      return sum;
    }
  }, 0);
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

// Nhan field multipart 'file', validate 2 lop (magic-byte + parse opentype that su) truoc
// khi ghi ra dia voi ten UUID (khong dung ten/duoi file goc tu client).
export const uploadFontFile = [
  (req, res, next) => {
    multerUpload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Upload lỗi: ' + err.message });
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Thiếu file font (field "file").' });

      if (currentFontsDirSizeBytes() + req.file.size > MAX_TOTAL_BYTES) {
        return res.status(413).json({
          error: `Đã vượt tổng dung lượng font cho phép (${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)}MB). Hãy xoá bớt font cũ.`,
        });
      }

      const type = await fileTypeFromBuffer(req.file.buffer);
      const format = type?.ext === 'otf' ? 'otf' : type?.ext === 'ttf' ? 'ttf' : null;
      if (!format) {
        return res.status(400).json({ error: 'File không đúng định dạng .ttf/.otf (kiểm tra theo magic byte).' });
      }

      let parsed;
      try {
        parsed = opentype.parse(toArrayBuffer(req.file.buffer));
      } catch (err) {
        return res.status(400).json({ error: 'File không parse được như 1 font hợp lệ: ' + err.message });
      }
      if (!parsed?.glyphs?.length) {
        return res.status(400).json({ error: 'Font không có glyph nào.' });
      }

      const fileName = `${crypto.randomUUID()}.${format}`;
      fs.writeFileSync(path.join(FONTS_DIR, fileName), req.file.buffer);
      req.uploadedFont = { fileName, format, glyphCount: parsed.glyphs.length };
      next();
    } catch (err) {
      next(err);
    }
  },
];
