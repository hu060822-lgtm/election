import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router, type Request } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, tx } from '../db.js';
import { config } from '../config.js';
import { ADMIN_COOKIE, requireAdmin } from '../lib/auth.js';
import { audit } from '../lib/audit.js';
import { newToken, safeEqual, sha256 } from '../lib/crypto.js';
import { asyncH, HttpError, parse } from '../lib/http.js';
import { broadcast } from '../lib/realtime.js';

export const adminRouter = Router();
const ACTOR = 'admin';

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: '登入嘗試過多，請 15 分鐘後再試' } });

adminRouter.post('/login', loginLimiter, asyncH(async (req, res) => {
  const { password } = parse(z.object({ password: z.string().min(1).max(200) }), req.body);
  if (!config.adminPassword || config.adminPassword.length < 12) throw new HttpError(503, 'admin_disabled', '伺服器未設定足夠長度的 ADMIN_PASSWORD（至少 12 字元）');
  if (!safeEqual(password, config.adminPassword)) {
    await audit('anonymous', 'admin.login_failed', null);
    throw new HttpError(401, 'bad_password', '管理員密碼不正確');
  }
  const token = newToken();
  await pool.query(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  await pool.query(`INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, now() + interval '12 hours')`, [sha256(token)]);
  res.cookie(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, maxAge: 12 * 3600_000, path: '/' });
  await audit(ACTOR, 'admin.login', null);
  res.json({ ok: true });
}));

adminRouter.get('/session', (req, res) => res.json({ admin: !!req.isAdmin }));

adminRouter.post('/logout', asyncH(async (req, res) => {
  const t = req.cookies?.[ADMIN_COOKIE];
  if (typeof t === 'string') await pool.query(`DELETE FROM admin_sessions WHERE token_hash = $1`, [sha256(t)]);
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
  res.json({ ok: true });
}));

// Everything below requires a valid server-side admin session.
adminRouter.use(requireAdmin);

// ---------- Candidates ----------
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, '顏色需為 #RRGGBB');
const optionalUrl = z.string().trim().max(500).refine((s) => s === '' || /^https?:\/\//.test(s) || s.startsWith('/uploads/'), '需為 http(s) 網址').nullable();
const candidateSchema = z.object({
  county_id: z.string().max(10),
  name: z.string().trim().min(1).max(40),
  party_id: z.string().max(20).nullable(),
  ballot_number: z.number().int().min(1).max(30).nullable(),
  color: hex.nullable(),
  photo_url: optionalUrl,
  photo_source: z.string().trim().max(300).nullable(),
  bio: z.string().max(2000),
  status: z.enum(['official', 'registered', 'potential', 'unconfirmed', 'withdrawn']),
  is_incumbent: z.boolean(),
  source_name: z.string().trim().max(300).nullable(),
  source_url: optionalUrl,
  data_updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
const COLS = Object.keys(candidateSchema.shape) as (keyof z.infer<typeof candidateSchema>)[];
const empty = (k: string, v: unknown) => (v === '' && k !== 'bio' && k !== 'name' ? null : v);

adminRouter.post('/candidates', asyncH(async (req, res) => {
  const b = parse(candidateSchema, req.body);
  const { rows } = await pool.query(
    `INSERT INTO candidates (${COLS.join(',')}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
    COLS.map((k) => empty(k, b[k])),
  );
  await audit(ACTOR, 'candidate.create', rows[0].id, { name: b.name, county_id: b.county_id });
  broadcast({ type: 'candidates_changed' });
  res.status(201).json(rows[0]);
}));

adminRouter.patch('/candidates/:id', asyncH(async (req, res) => {
  const b = parse(candidateSchema.partial().omit({ county_id: true }), req.body);
  const keys = Object.keys(b) as (keyof typeof b)[];
  if (!keys.length) throw new HttpError(400, 'empty', '沒有要更新的欄位');
  const { rows } = await pool.query(
    `UPDATE candidates SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, ...keys.map((k) => empty(k, b[k]))],
  );
  if (!rows[0]) throw new HttpError(404, 'not_found', '找不到候選人');
  await audit(ACTOR, 'candidate.update', req.params.id, { name: rows[0].name, fields: keys });
  broadcast({ type: 'candidates_changed' });
  res.json(rows[0]);
}));

adminRouter.delete('/candidates/:id', asyncH(async (req, res) => {
  const { rows } = await pool.query(`DELETE FROM candidates WHERE id = $1 RETURNING name, county_id, photo_url`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'not_found', '找不到候選人');
  removeUpload(rows[0].photo_url);
  await audit(ACTOR, 'candidate.delete', req.params.id, rows[0]);
  broadcast({ type: 'candidates_changed' });
  broadcast({ type: 'picks_changed', county_id: rows[0].county_id, kind: 'predict' });
  res.json({ ok: true });
}));

fs.mkdirSync(config.uploadDir, { recursive: true });
const MIME_EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `cand-${crypto.randomBytes(10).toString('hex')}${MIME_EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype in MIME_EXT),
});

function removeUpload(url: string | null | undefined) {
  if (!url?.startsWith('/uploads/')) return;
  const p = path.join(config.uploadDir, path.basename(url));
  fs.promises.unlink(p).catch(() => {});
}

/** Verify magic bytes — never trust the client-declared MIME type alone. */
function looksLikeImage(file: string) {
  const b = Buffer.alloc(12);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const isJpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const isPng = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  return isJpg || isPng || isWebp;
}

adminRouter.post('/candidates/:id/photo', upload.single('photo'), asyncH(async (req: Request, res) => {
  const f = req.file;
  if (!f) throw new HttpError(400, 'no_file', '請選擇 JPG、PNG 或 WebP 圖片（3MB 以內）');
  if (!looksLikeImage(f.path)) {
    fs.promises.unlink(f.path).catch(() => {});
    throw new HttpError(400, 'bad_file', '檔案內容不是有效的圖片');
  }
  const source = z.string().trim().max(300).parse(req.body?.photo_source ?? '');
  const url = `/uploads/${f.filename}`;
  const prev = await pool.query(`SELECT photo_url FROM candidates WHERE id = $1`, [req.params.id]);
  if (!prev.rowCount) {
    fs.promises.unlink(f.path).catch(() => {});
    throw new HttpError(404, 'not_found', '找不到候選人');
  }
  const { rows } = await pool.query(
    `UPDATE candidates SET photo_url = $2, photo_source = COALESCE(NULLIF($3, ''), photo_source), updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id, url, source],
  );
  removeUpload(prev.rows[0].photo_url);
  await audit(ACTOR, 'candidate.photo_upload', req.params.id, { name: rows[0].name, photo_source: source });
  broadcast({ type: 'candidates_changed' });
  res.json(rows[0]);
}));

adminRouter.delete('/candidates/:id/photo', asyncH(async (req, res) => {
  const prev = await pool.query(`SELECT photo_url FROM candidates WHERE id = $1`, [req.params.id]);
  if (!prev.rowCount) throw new HttpError(404, 'not_found', '找不到候選人');
  await pool.query(`UPDATE candidates SET photo_url = NULL, photo_source = NULL, updated_at = now() WHERE id = $1`, [req.params.id]);
  removeUpload(prev.rows[0].photo_url);
  await audit(ACTOR, 'candidate.photo_remove', req.params.id);
  broadcast({ type: 'candidates_changed' });
  res.json({ ok: true });
}));

// ---------- Parties ----------
adminRouter.post('/parties', asyncH(async (req, res) => {
  const b = parse(z.object({ id: z.string().regex(/^[a-z0-9_-]{2,20}$/), name: z.string().trim().min(1).max(40), short_name: z.string().trim().min(1).max(20), color: hex, sort_order: z.number().int().default(50) }), req.body);
  const { rows } = await pool.query(`INSERT INTO parties (id, name, short_name, color, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [b.id, b.name, b.short_name, b.color, b.sort_order]);
  await audit(ACTOR, 'party.create', b.id, b);
  broadcast({ type: 'candidates_changed' });
  res.status(201).json(rows[0]);
}));

adminRouter.patch('/parties/:id', asyncH(async (req, res) => {
  const b = parse(z.object({ name: z.string().trim().min(1).max(40).optional(), short_name: z.string().trim().min(1).max(20).optional(), color: hex.optional() }), req.body);
  const { rows } = await pool.query(
    `UPDATE parties SET name = COALESCE($2, name), short_name = COALESCE($3, short_name), color = COALESCE($4, color) WHERE id = $1 RETURNING *`,
    [req.params.id, b.name ?? null, b.short_name ?? null, b.color ?? null]);
  if (!rows[0]) throw new HttpError(404, 'not_found', '找不到政黨');
  await audit(ACTOR, 'party.update', req.params.id, b);
  broadcast({ type: 'candidates_changed' });
  res.json(rows[0]);
}));

// ---------- Users & votes ----------
adminRouter.get('/users', asyncH(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname, u.show_predictions, u.show_support, u.is_demo, u.is_banned, u.created_at, u.last_seen_at,
            count(p.*) FILTER (WHERE p.kind = 'predict')::int AS predict_count,
            count(p.*) FILTER (WHERE p.kind = 'support')::int AS support_count
     FROM users u LEFT JOIN picks p ON p.user_id = u.id GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json(rows);
}));

adminRouter.patch('/users/:id', asyncH(async (req, res) => {
  const b = parse(z.object({ is_banned: z.boolean().optional(), nickname: z.string().trim().min(1).max(24).optional() }), req.body);
  const { rows } = await pool.query(
    `UPDATE users SET is_banned = COALESCE($2, is_banned), nickname = COALESCE($3, nickname),
       nickname_key = COALESCE(lower($3), nickname_key) WHERE id = $1 RETURNING id, nickname, is_banned`,
    [req.params.id, b.is_banned ?? null, b.nickname ?? null]);
  if (!rows[0]) throw new HttpError(404, 'not_found', '找不到使用者');
  await audit(ACTOR, 'user.update', req.params.id, b);
  broadcast({ type: 'data_reset' });
  res.json(rows[0]);
}));

adminRouter.delete('/users/:id', asyncH(async (req, res) => {
  const { rows } = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING nickname`, [req.params.id]);
  if (!rows[0]) throw new HttpError(404, 'not_found', '找不到使用者');
  await audit(ACTOR, 'user.delete', req.params.id, rows[0]);
  broadcast({ type: 'data_reset' });
  res.json({ ok: true });
}));

const PICKS_SQL = `SELECT p.id, u.nickname, u.is_demo, c.name AS county, p.kind, cand.name AS candidate,
       COALESCE(pt.short_name, '') AS party, p.created_at, p.updated_at
  FROM picks p JOIN users u ON u.id = p.user_id JOIN counties c ON c.id = p.county_id
  JOIN candidates cand ON cand.id = p.candidate_id LEFT JOIN parties pt ON pt.id = cand.party_id
  ORDER BY p.updated_at DESC`;

adminRouter.get('/picks', asyncH(async (_req, res) => {
  const { rows } = await pool.query(PICKS_SQL);
  res.json(rows);
}));

// ---------- Settings ----------
const settingsSchema = z.object({
  voting_opens_at: z.string().datetime({ offset: true }).nullable().optional(),
  voting_closes_at: z.string().datetime({ offset: true }).nullable().optional(),
  allow_changes: z.boolean().optional(),
  allow_view_others: z.boolean().optional(),
  election_mode: z.enum(['auto', 'on', 'off']).optional(),
  election_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  site_notice: z.string().max(200).optional(),
});

adminRouter.put('/settings', asyncH(async (req, res) => {
  const b = parse(settingsSchema, req.body);
  await tx(async (c) => {
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      await c.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [k, JSON.stringify(v)]);
    }
    await audit(ACTOR, 'settings.update', null, b, c);
  });
  broadcast({ type: 'settings_changed' });
  res.json({ ok: true });
}));

// ---------- Official results ----------
adminRouter.put('/results/:county', asyncH(async (req, res) => {
  const b = parse(z.object({
    winner_candidate_id: z.string().uuid().nullable(),
    is_final: z.boolean(),
    source: z.string().trim().max(300).nullable(),
    votes: z.record(z.string().uuid(), z.number().int().min(0)).default({}),
  }), req.body);
  await tx(async (c) => {
    const ids = [...Object.keys(b.votes), ...(b.winner_candidate_id ? [b.winner_candidate_id] : [])];
    if (ids.length) {
      const ok = await c.query(`SELECT count(*)::int AS n FROM candidates WHERE county_id = $1 AND id = ANY($2)`, [req.params.county, [...new Set(ids)]]);
      if (ok.rows[0].n !== new Set(ids).size) throw new HttpError(400, 'bad_candidate', '候選人不屬於此縣市');
    }
    await c.query(
      `INSERT INTO official_results (county_id, winner_candidate_id, is_final, source, updated_at) VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (county_id) DO UPDATE SET winner_candidate_id = EXCLUDED.winner_candidate_id, is_final = EXCLUDED.is_final, source = EXCLUDED.source, updated_at = now()`,
      [req.params.county, b.winner_candidate_id, b.is_final, b.source]);
    for (const [cid, v] of Object.entries(b.votes)) {
      await c.query(`INSERT INTO official_votes (candidate_id, votes, updated_at) VALUES ($1,$2,now()) ON CONFLICT (candidate_id) DO UPDATE SET votes = EXCLUDED.votes, updated_at = now()`, [cid, v]);
    }
    await audit(ACTOR, 'results.update', req.params.county, b, c);
  });
  broadcast({ type: 'results_changed' });
  res.json({ ok: true });
}));

adminRouter.delete('/results/:county', asyncH(async (req, res) => {
  await tx(async (c) => {
    await c.query(`DELETE FROM official_results WHERE county_id = $1`, [req.params.county]);
    await c.query(`DELETE FROM official_votes WHERE candidate_id IN (SELECT id FROM candidates WHERE county_id = $1)`, [req.params.county]);
    await audit(ACTOR, 'results.clear', req.params.county, {}, c);
  });
  broadcast({ type: 'results_changed' });
  res.json({ ok: true });
}));

// ---------- Export ----------
function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '﻿';
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV formula-injection guard
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}

const EXPORTS: Record<string, string> = {
  picks: PICKS_SQL,
  users: `SELECT u.nickname, u.is_demo, u.is_banned, u.show_predictions, u.show_support, u.created_at, u.last_seen_at FROM users u ORDER BY u.created_at`,
  candidates: `SELECT c.name AS county, cand.ballot_number, cand.name, COALESCE(p.name,'') AS party, cand.status, cand.is_incumbent,
                 cand.source_name, cand.source_url, cand.photo_source, cand.data_updated_at
               FROM candidates cand JOIN counties c ON c.id = cand.county_id LEFT JOIN parties p ON p.id = cand.party_id ORDER BY c.sort_order, cand.ballot_number`,
  tallies: `SELECT c.name AS county, p.kind, cand.name AS candidate, count(*)::int AS count
            FROM picks p JOIN users u ON u.id = p.user_id AND u.is_banned = false JOIN counties c ON c.id = p.county_id JOIN candidates cand ON cand.id = p.candidate_id
            GROUP BY c.sort_order, c.name, p.kind, cand.name ORDER BY c.sort_order, p.kind, count DESC`,
  events: `SELECT e.id, u.nickname, c.name AS county, e.kind, e.action, o.name AS old_candidate, n.name AS new_candidate, e.created_at
           FROM pick_events e LEFT JOIN users u ON u.id = e.user_id JOIN counties c ON c.id = e.county_id
           LEFT JOIN candidates o ON o.id = e.old_candidate_id LEFT JOIN candidates n ON n.id = e.new_candidate_id ORDER BY e.id`,
};

adminRouter.get('/export/:name.csv', asyncH(async (req, res) => {
  const sql = EXPORTS[req.params.name];
  if (!sql) throw new HttpError(404, 'not_found', '沒有這種匯出');
  const { rows } = await pool.query(sql);
  await audit(ACTOR, 'export', req.params.name, { rows: rows.length });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="tew-${req.params.name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv(rows));
}));

// ---------- Clear data ----------
adminRouter.post('/clear', asyncH(async (req, res) => {
  const b = parse(z.object({ scope: z.enum(['demo', 'votes', 'news', 'results']), confirm: z.literal('DELETE') }), req.body);
  const out = await tx(async (c) => {
    let n = 0;
    if (b.scope === 'demo') n = (await c.query(`DELETE FROM users WHERE is_demo`)).rowCount ?? 0;
    if (b.scope === 'votes') {
      n = (await c.query(`DELETE FROM picks`)).rowCount ?? 0;
      await c.query(`DELETE FROM pick_events`);
      await c.query(`DELETE FROM news_events`);
    }
    if (b.scope === 'news') n = (await c.query(`DELETE FROM news_events`)).rowCount ?? 0;
    if (b.scope === 'results') {
      n = (await c.query(`DELETE FROM official_results`)).rowCount ?? 0;
      await c.query(`DELETE FROM official_votes`);
    }
    await audit(ACTOR, `clear.${b.scope}`, null, { deleted: n }, c);
    return n;
  });
  broadcast({ type: 'data_reset' });
  res.json({ ok: true, deleted: out });
}));

adminRouter.get('/audit', asyncH(async (req, res) => {
  const limit = Math.min(500, Number(req.query.limit) || 200);
  const { rows } = await pool.query(`SELECT id, actor, action, target, detail, created_at FROM audit_logs ORDER BY id DESC LIMIT $1`, [limit]);
  res.json(rows);
}));
