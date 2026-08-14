import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'printer3d',
  waitForConnections: true,
  connectionLimit: 10,
  // Ep driver quy doi DATETIME <-> JS Date theo UTC ca 2 chieu, khong phu thuoc mui gio
  // cua may/container dang chay — quan trong vi locked_until (auth.js) duoc so sanh truc
  // tiep voi Date.now(), lech mui gio se lam sai logic khoa tai khoan.
  timezone: 'Z',
};

const pool = mysql.createPool(DB_CONFIG);

// Cho MySQL san sang truoc khi chay migration — quan trong trong Docker Compose vi
// container app co the khoi dong truoc khi MySQL nhan ket noi duoc du co healthcheck.
async function waitForDatabase(maxAttempts = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let conn;
    try {
      conn = await mysql.createConnection(DB_CONFIG);
      await conn.end();
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(`Không kết nối được MySQL sau ${maxAttempts} lần thử: ${err.message}`);
      }
      console.log(`[db] Chờ MySQL sẵn sàng... (lần ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function runMigrations() {
  await pool.query(`CREATE TABLE IF NOT EXISTS _migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const [already] = await pool.query('SELECT filename FROM _migrations');
  const appliedSet = new Set(already.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // multipleStatements chi bat tren 1 ket noi rieng dung de chay file migration tinh
    // (khong phai input nguoi dung) — pool chinh phuc vu request KHONG bat co nay, tranh
    // mo rong be mat SQL injection cho phan con lai cua app.
    const conn = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });
    try {
      await conn.query(sql);
      await conn.query('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    } finally {
      await conn.end();
    }
    console.log(`[db] Đã áp dụng migration: ${file}`);
  }
}

export async function initDb() {
  await waitForDatabase();
  await runMigrations();
}

export default pool;
