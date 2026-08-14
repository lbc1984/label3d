import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import { seed } from './seed.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 7788;
// Tach rieng khoi NODE_ENV: cookie "secure" chi nen bat khi ket noi THAT SU la HTTPS
// (vd sau nginx + certbot). Neu bat secure ma van chay HTTP thuong (nhu localhost mac
// dinh trong docker-compose o day), trinh duyet/curl se KHONG BAO GIO gui lai cookie
// session — dang nhap tra ve 200 nhung moi request sau do van bao chua dang nhap.
const cookieSecure = process.env.COOKIE_SECURE === 'true';

if (!process.env.SESSION_SECRET) {
  throw new Error('Thiếu SESSION_SECRET trong .env — xem .env.example.');
}

async function main() {
  await seed(); // cho MySQL san sang, chay migration, seed du lieu mac dinh neu chua co

  const app = express();
  app.set('trust proxy', 1); // dung sau nginx/reverse proxy khi trien khai that

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'connect-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false, // khong can cross-origin isolation cho canvas/WebGL o day
  }));

  app.use(express.json({ limit: '1mb' }));

  const FileStore = FileStoreFactory(session);
  app.use(session({
    store: new FileStore({
      path: path.join(__dirname, '..', 'data', 'sessions'),
      ttl: 2 * 60 * 60,
      secret: process.env.SESSION_SECRET, // ma hoa file session luu tren dia
      logFn: () => {},
    }),
    name: 'sid_admin',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'strict',
      maxAge: 2 * 60 * 60 * 1000,
    },
  }));

  app.use(publicRoutes);
  app.use(adminRoutes);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Bat loi tu cac route async (goi next(err)) — khong de lo chi tiet loi noi bo ra ngoai.
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Lỗi máy chủ nội bộ.' });
  });

  app.listen(PORT, () => {
    console.log(`Server dang chay tai http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Khong khoi dong duoc server:', err);
  process.exit(1);
});
