import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  return v;
}

export const config = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 8787),
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  uploadDir: path.resolve(ROOT, process.env.UPLOAD_DIR ?? './uploads'),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  /** Max join/restore attempts per IP per 15 min (friends often share one home/office IP). */
  identityRateLimit: Number(process.env.IDENTITY_RATE_LIMIT ?? 30),
  migrationsDir: path.resolve(here, '../migrations'),
  webDist: path.resolve(ROOT, 'web/dist'),
};
