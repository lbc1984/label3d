import bcrypt from 'bcryptjs';
import pool from './db.js';

// Khoa luy tien: cang sai nhieu lan lien tiep, thoi gian khoa cang dai, nhung co
// tran cung (30 phut) de tranh ke tan cong tu lam DoS chinh chu tiem vinh vien.
const LOCKOUT_TIERS = [
  { attempts: 15, ms: 30 * 60 * 1000 },
  { attempts: 10, ms: 5 * 60 * 1000 },
  { attempts: 5, ms: 30 * 1000 },
];

function lockoutDurationMs(failedAttempts) {
  const tier = LOCKOUT_TIERS.find((t) => failedAttempts >= t.attempts);
  return tier ? tier.ms : 0;
}

export async function getAdmin() {
  const [rows] = await pool.execute('SELECT * FROM admin_user WHERE id = 1');
  return rows[0];
}

export async function attemptLogin(username, password) {
  const admin = await getAdmin();
  if (!admin) return { ok: false, status: 500, error: 'Chưa khởi tạo tài khoản admin.' };

  if (admin.locked_until && admin.locked_until.getTime() > Date.now()) {
    const secs = Math.ceil((admin.locked_until.getTime() - Date.now()) / 1000);
    return {
      ok: false, status: 429,
      error: `Tài khoản đang tạm khoá do đăng nhập sai nhiều lần. Thử lại sau ${secs} giây.`,
    };
  }

  const validUsername = typeof username === 'string' && username === admin.username;
  const validPassword = typeof password === 'string' && await bcrypt.compare(password, admin.password_hash);

  if (!validUsername || !validPassword) {
    const failedAttempts = admin.failed_attempts + 1;
    const duration = lockoutDurationMs(failedAttempts);
    const lockedUntil = duration > 0 ? new Date(Date.now() + duration) : null;
    await pool.execute(
      'UPDATE admin_user SET failed_attempts = ?, locked_until = ?, updated_at = NOW() WHERE id = 1',
      [failedAttempts, lockedUntil]
    );
    return { ok: false, status: 401, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
  }

  await pool.execute(
    "UPDATE admin_user SET failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = 1"
  );
  return { ok: true };
}

export async function changePassword(currentPassword, newPassword) {
  const admin = await getAdmin();
  if (!admin) return { ok: false, status: 500, error: 'Chưa khởi tạo tài khoản admin.' };
  if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, admin.password_hash))) {
    return { ok: false, status: 401, error: 'Mật khẩu hiện tại không đúng.' };
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return { ok: false, status: 400, error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' };
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute('UPDATE admin_user SET password_hash = ?, updated_at = NOW() WHERE id = 1', [hash]);
  return { ok: true };
}

// Dung cho scripts/reset-admin-password.js (dat lai mat khau qua CLI, khong qua HTTP)
export async function setPasswordDirect(newPassword) {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.execute(
    'UPDATE admin_user SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = 1',
    [hash]
  );
}
