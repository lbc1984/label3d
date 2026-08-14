import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pool, { initDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const FONTS_DIR = path.join(__dirname, '..', 'data', 'fonts');

const PARAMETER_LIMITS = [
  ['gap', 'Khoảng cách chữ ↔ emoji', -100, 20, 0.5, 2, 'mm'],
  ['depth', 'Độ đùn (extrude depth)', 1, 20, 1, 2, 'mm'],
  ['textFontSize', 'Cỡ CHỮ (font size)', 10, 100, 1, 40, ''],
  ['emojiFontSize', 'Cỡ EMOJI (font size)', 10, 100, 1, 80, ''],
  ['emojiNudge', 'Chỉnh tinh chiều cao emoji', -100, 100, 0.5, 14.5, 'mm'],
  ['bgOffset', 'Offset nền', 0, 30, 0.5, 3, 'mm'],
  ['bgDepth', 'Độ dày nền', 0.5, 10, 0.5, 4, 'mm'],
  ['ringHole', 'Đường kính lỗ', 2, 20, 0.5, 6, 'mm'],
  ['ringWall', 'Độ dày thành lỗ', 1, 10, 0.5, 2, 'mm'],
  ['ringPos', 'Vị trí trượt trên cạnh', 0, 100, 1, 50, '%'],
  ['ringInset', 'Ăn sâu vào nền thêm', 0, 20, 0.5, 0, 'mm'],
];

// Cùng dữ liệu với BAMBU_COLORS trong font-to-3d-demo.html:278-322
const BAMBU_COLORS = [
  { series: 'PLA Basic', colors: [
    ['Jade White', '#FFFFFF'], ['Beige', '#F7E6DE'], ['Gold', '#E4BD68'],
    ['Silver', '#A6A9AA'], ['Gray', '#8E9089'], ['Light Gray', '#D1D3D5'],
    ['Dark Gray', '#545454'], ['Black', '#000000'], ['Bronze', '#847D48'],
    ['Brown', '#9D432C'], ['Cocoa Brown', '#6F5034'], ['Red', '#C12E1F'],
    ['Maroon Red', '#9D2235'], ['Scarlet Red', '#DE4343'], ['Magenta', '#EC008C'],
    ['Pink', '#F55A74'], ['Hot Pink', '#F5547C'], ['Orange', '#FF6A13'],
    ['Pumpkin Orange', '#FF9016'], ['Yellow', '#F4EE2A'], ['Sunflower Yellow', '#FEC600'],
    ['Lemon Yellow', '#F7D959'], ['Bambu Green', '#00AE42'], ['Mistletoe Green', '#3F8E43'],
    ['Grass Green', '#61C680'], ['Cyan', '#0086D6'], ['Blue', '#0A2989'],
    ['Cobalt Blue', '#0056B8'], ['Ice Blue', '#A3D8E1'], ['Blue Gray', '#5B6579'],
    ['Purple', '#5E43B7'], ['Indigo Purple', '#482960'],
  ] },
  { series: 'PLA Matte', colors: [
    ['Ivory White', '#FFFFFF'], ['Bone White', '#CBC6B8'], ['Latte Brown', '#D3B7A7'],
    ['Desert Tan', '#E8DBB7'], ['Lemon Yellow', '#F7D959'], ['Mandarin Orange', '#F99963'],
    ['Sakura Pink', '#E8AFCF'], ['Lilac Purple', '#AE96D4'], ['Scarlet Red', '#DE4343'],
    ['Dark Red', '#BB3D43'], ['Apple Green', '#C2E189'], ['Grass Green', '#61C680'],
    ['Dark Green', '#68724D'], ['Ice Blue', '#A3D8E1'], ['Sky Blue', '#56B7E6'],
    ['Marine Blue', '#0078BF'], ['Dark Blue', '#042F56'], ['Ash Gray', '#9B9EA0'],
    ['Nardo Gray', '#757575'], ['Charcoal', '#000000'], ['Terracotta', '#B15533'],
    ['Caramel', '#AE835B'], ['Dark Brown', '#7D6556'], ['Plum', '#950051'],
    ['Mint', '#A6E6CB'], ['Grey', '#8E9089'],
  ] },
  { series: 'PLA Silk', colors: [
    ['Silk White', '#F8F8F8'], ['Silk Champagne', '#F7D5A6'], ['Silk Gold', '#F9B72C'],
    ['Silk Candy Red', '#D02727'], ['Silk Pink', '#F3AFC5'], ['Silk Purple', '#8B49BA'],
    ['Silk Blue', '#1F6FDD'], ['Silk Baby Blue', '#7FB8E0'], ['Silk Mint', '#5CC9A7'],
    ['Silk Green', '#22B14C'], ['Silk Titan Gray', '#8B8C8D'], ['Silk Black', '#121212'],
  ] },
  { series: 'PLA Metal', colors: [
    ['Iron Gray', '#4A4A51'], ['Iridium Gold', '#B48E3D'], ['Copper Brown', '#9A4E2E'],
    ['Nickel Silver', '#9DA3A6'], ['Oxide Green', '#3D6B5A'],
  ] },
  { series: 'PETG / trong suốt', colors: [
    ['Clear', '#EEF2F4'], ['Translucent Olive', '#748C45'], ['Translucent Teal', '#3B9C9C'],
    ['Translucent Purple', '#8B6BB7'], ['Translucent Orange', '#F08C3A'],
    ['Translucent Gray', '#B6BBBE'], ['Translucent Pink', '#F0A9C0'],
  ] },
  { series: 'TPU / dẻo', colors: [
    ['TPU White', '#F5F5F5'], ['TPU Black', '#1A1A1A'], ['TPU Red', '#C8202E'],
    ['TPU Blue', '#1B57A6'], ['TPU Yellow', '#F2C31F'], ['TPU Neon Green', '#8ED12A'],
  ] },
];

const DEFAULT_FONTS = [
  { role: 'text', displayName: 'CherryBombOne', sourceFile: 'CherryBombOne-Regular.ttf' },
  { role: 'emoji', displayName: 'NotoEmoji', sourceFile: 'NotoEmoji-VariableFont_wght.ttf' },
];

async function countRows(query) {
  const [rows] = await pool.query(query);
  return rows[0].n;
}

async function seedAdmin() {
  const count = await countRows('SELECT COUNT(*) AS n FROM admin_user');
  if (count > 0) return;

  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  await pool.execute('INSERT INTO admin_user (id, username, password_hash) VALUES (1, ?, ?)', ['admin', hash]);

  console.log('============================================================');
  console.log('[seed] Da tao tai khoan admin mac dinh:');
  console.log('[seed]   username: admin');
  if (process.env.ADMIN_PASSWORD) {
    console.log('[seed]   password: (lay tu bien moi truong ADMIN_PASSWORD)');
  } else {
    console.log(`[seed]   password: ${password}`);
    console.log('[seed]   LUU LAI MAT KHAU NAY NGAY — hay doi mat khau sau khi dang nhap lan dau.');
  }
  console.log('============================================================');
}

async function seedLimits() {
  const count = await countRows('SELECT COUNT(*) AS n FROM parameter_limits');
  if (count > 0) return;

  await pool.query(
    `INSERT INTO parameter_limits
      (param_key, label, min_value, max_value, step_value, default_value, unit)
      VALUES ?`,
    [PARAMETER_LIMITS]
  );
  console.log(`[seed] Da them ${PARAMETER_LIMITS.length} gioi han thong so mac dinh.`);
}

async function seedColors() {
  const count = await countRows('SELECT COUNT(*) AS n FROM colors');
  if (count > 0) return;

  const rows = [];
  let order = 0;
  for (const group of BAMBU_COLORS) {
    for (const [name, hex] of group.colors) {
      rows.push([group.series, name, hex, order++]);
    }
  }
  await pool.query('INSERT INTO colors (series, name, hex, sort_order) VALUES ?', [rows]);
  console.log(`[seed] Da them ${rows.length} mau nhua mac dinh (${BAMBU_COLORS.length} series).`);
}

async function seedFonts() {
  const count = await countRows('SELECT COUNT(*) AS n FROM fonts');
  if (count > 0) return;

  fs.mkdirSync(FONTS_DIR, { recursive: true });

  for (const font of DEFAULT_FONTS) {
    const sourcePath = path.join(PROJECT_ROOT, font.sourceFile);
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[seed] CANH BAO: khong tim thay ${sourcePath}, bo qua seed font "${font.displayName}".`);
      continue;
    }
    const fileName = `${crypto.randomUUID()}.ttf`;
    fs.copyFileSync(sourcePath, path.join(FONTS_DIR, fileName));
    await pool.execute(
      `INSERT INTO fonts (role, display_name, file_name, format, is_default, active, sort_order)
       VALUES (?, ?, ?, 'ttf', 1, 1, 0)`,
      [font.role, font.displayName, fileName]
    );
    console.log(`[seed] Da nap font mac dinh "${font.displayName}" (${font.role}) -> ${fileName}`);
  }
}

export async function seed() {
  await initDb();
  await seedAdmin();
  await seedLimits();
  await seedColors();
  await seedFonts();
}

// Cho phep chay truc tiep: node src/seed.js
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => { console.log('[seed] Hoan tat.'); process.exit(0); })
    .catch((err) => { console.error('[seed] Loi:', err); process.exit(1); });
}
