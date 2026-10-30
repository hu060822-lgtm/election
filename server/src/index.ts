import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { seedBase } from './seed/base.js';
import { loadAdmin, loadUser, requireCsrfHeader } from './lib/auth.js';
import { errorHandler, HttpError } from './lib/http.js';
import { attachRealtime } from './lib/realtime.js';
import { publicRouter } from './routes/public.js';
import { meRouter } from './routes/me.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

const api = express.Router();
api.use(requireCsrfHeader, loadUser, loadAdmin);
api.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, time: new Date().toISOString() });
});
api.use('/', publicRouter);
api.use('/me', meRouter);
api.use('/admin', adminRouter);
api.use((_req, _res, next) => next(new HttpError(404, 'not_found', '找不到此 API')));
api.use(errorHandler);
app.use('/api', api);

app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false, setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));

// Production: serve the built SPA
if (fs.existsSync(config.webDist)) {
  app.use(express.static(config.webDist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')));
}

async function main() {
  await migrate();
  await seedBase();
  const server = http.createServer(app);
  attachRealtime(server);
  server.listen(config.port, () => console.log(`TAIWAN ELECTION WATCH API on http://localhost:${config.port}`));
  if (!config.adminPassword || config.adminPassword.length < 12) console.warn('⚠ ADMIN_PASSWORD 未設定或少於 12 字元，管理後台登入將被停用。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
