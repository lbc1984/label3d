import 'dotenv/config';
import readline from 'node:readline';
import { setPasswordDirect } from '../src/auth.js';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const argPassword = process.argv[2];
const newPassword = argPassword || await prompt('Nhập mật khẩu admin mới (tối thiểu 8 ký tự): ');

try {
  await setPasswordDirect(newPassword);
  console.log('✓ Đã đặt lại mật khẩu admin thành công.');
  process.exit(0);
} catch (err) {
  console.error('Lỗi:', err.message);
  process.exit(1);
}
