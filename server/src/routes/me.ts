import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, tx, type Tx } from '../db.js';
import { clearUserCookie, requireUser, setUserCookie } from '../lib/auth.js';
import { newRecoveryCode, newToken, normaliseRecovery, sha256 } from '../lib/crypto.js';
import { asyncH, HttpError, parse } from '../lib/http.js';
import { broadcast } from '../lib/realtime.js';
import { countyTally, describeLeadChange, leaders } from '../lib/stats.js';
import { getSettings, votingState } from '../lib/settings.js';
import { config } from '../config.js';

export const meRouter = Router();

// IPs are only used in-memory by the limiter and never persisted.
const identityLimiter = rateLimit({ windowMs: 15 * 60_000, limit: config.identityRateLimit, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: '嘗試次數過多，請稍後再試' } });
const pickLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'rate_limited', message: '操作太頻繁，請稍後再試' } });

const nicknameSchema = z.string().trim().min(1, '請輸入暱稱').max(24, '暱稱最多 24 個字')
  .refine((s) => !/[<>]/.test(s), '暱稱不可包含 < 或 >')
  .refine((s) => !/^demo[-_ ]/i.test(s), '「DEMO-」開頭保留給測試資料');
const nicknameKey = (s: string) => s.trim().toLowerCase().normalize('NFKC');

async function mePayload(userId: string) {
  const [u, picks] = await Promise.all([
    pool.query(`SELECT id, nickname, show_predictions, show_support, is_demo, created_at FROM users WHERE id = $1`, [userId]),
    pool.query(`SELECT county_id, kind, candidate_id, updated_at FROM picks WHERE user_id = $1 ORDER BY county_id`, [userId]),
  ]);
  return { user: u.rows[0] ?? null, picks: picks.rows };
}

meRouter.get('/', asyncH(async (req, res) => {
  if (!req.user) return res.json({ user: null, picks: [] });
  res.json({ ...(await mePayload(req.user.id)), banned: req.user.is_banned });
}));

meRouter.post('/join', identityLimiter, asyncH(async (req, res) => {
  const body = parse(z.object({ nickname: nicknameSchema, show_predictions: z.boolean(), show_support: z.boolean() }), req.body);
  if (req.user) throw new HttpError(409, 'already_joined', '你已經加入了');
  const token = newToken();
  const recovery = newRecoveryCode();
  const { rows } = await pool.query(
    `INSERT INTO users (nickname, nickname_key, token_hash, recovery_hash, show_predictions, show_support)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (nickname_key) DO NOTHING RETURNING id`,
    [body.nickname, nicknameKey(body.nickname), sha256(token), sha256(normaliseRecovery(recovery)), body.show_predictions, body.show_support],
  );
  if (!rows[0]) throw new HttpError(409, 'nickname_taken', '這個暱稱已經有人使用；如果是你本人，請用找回碼登入');
  setUserCookie(res, token);
  broadcast({ type: 'activity' });
  res.status(201).json({ ...(await mePayload(rows[0].id)), recovery_code: recovery });
}));

/** 以暱稱 + 找回碼在新裝置恢復身份。成功後舊裝置的 session 失效。 */
meRouter.post('/restore', identityLimiter, asyncH(async (req, res) => {
  const body = parse(z.object({ nickname: nicknameSchema, recovery_code: z.string().min(8).max(32) }), req.body);
  const token = newToken();
  const { rows } = await pool.query(
    `UPDATE users SET token_hash = $3, last_seen_at = now()
     WHERE nickname_key = $1 AND recovery_hash = $2 AND is_banned = false RETURNING id`,
    [nicknameKey(body.nickname), sha256(normaliseRecovery(body.recovery_code)), sha256(token)],
  );
  if (!rows[0]) throw new HttpError(401, 'restore_failed', '暱稱或找回碼不正確');
  setUserCookie(res, token);
  res.json(await mePayload(rows[0].id));
}));

meRouter.patch('/', asyncH(async (req, res) => {
  const u = requireUser(req);
  const body = parse(z.object({ nickname: nicknameSchema.optional(), show_predictions: z.boolean().optional(), show_support: z.boolean().optional() }), req.body);
  await pool.query(
    `UPDATE users SET nickname = COALESCE($2, nickname), nickname_key = COALESCE($3, nickname_key),
       show_predictions = COALESCE($4, show_predictions), show_support = COALESCE($5, show_support) WHERE id = $1`,
    [u.id, body.nickname ?? null, body.nickname ? nicknameKey(body.nickname) : null, body.show_predictions ?? null, body.show_support ?? null],
  );
  broadcast({ type: 'activity' });
  res.json(await mePayload(u.id));
}));

meRouter.post('/recovery', identityLimiter, asyncH(async (req, res) => {
  const u = requireUser(req);
  const recovery = newRecoveryCode();
  await pool.query(`UPDATE users SET recovery_hash = $2 WHERE id = $1`, [u.id, sha256(normaliseRecovery(recovery))]);
  res.json({ recovery_code: recovery });
}));

meRouter.post('/logout', asyncH(async (_req, res) => {
  clearUserCookie(res);
  res.json({ ok: true });
}));

/** 退出並刪除：使用者、所有選擇與異動紀錄（ON DELETE CASCADE）一併刪除。 */
meRouter.delete('/', asyncH(async (req, res) => {
  const u = requireUser(req);
  const counties = await pool.query<{ county_id: string }>(`SELECT DISTINCT county_id FROM picks WHERE user_id = $1`, [u.id]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [u.id]);
  clearUserCookie(res);
  counties.rows.forEach((r) => broadcast({ type: 'picks_changed', county_id: r.county_id, kind: 'predict' }));
  broadcast({ type: 'activity' });
  res.json({ ok: true });
}));

const kindSchema = z.enum(['predict', 'support']);

async function assertCanVote(c: Tx, hasExisting: boolean) {
  const s = await getSettings(c);
  const st = votingState(s);
  if (st === 'not_open') throw new HttpError(403, 'voting_not_open', '選擇尚未開放');
  if (st === 'closed') throw new HttpError(403, 'voting_closed', '選擇已截止');
  if (hasExisting && !s.allow_changes) throw new HttpError(403, 'changes_locked', '管理員已關閉修改功能，已送出的選擇無法變更');
}

async function applyPick(userId: string, countyId: string, kind: 'predict' | 'support', candidateId: string | null) {
  return tx(async (c) => {
    // Serialise writers per county so tallies & lead-change detection are consistent under concurrency
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [countyId]);
    const county = await c.query<{ name: string }>(`SELECT name FROM counties WHERE id = $1`, [countyId]);
    if (!county.rowCount) throw new HttpError(404, 'not_found', '找不到此縣市');
    if (candidateId) {
      const cand = await c.query<{ status: string }>(`SELECT status FROM candidates WHERE id = $1 AND county_id = $2`, [candidateId, countyId]);
      if (!cand.rowCount) throw new HttpError(400, 'bad_candidate', '此候選人不屬於這個縣市');
      if (cand.rows[0].status === 'withdrawn') throw new HttpError(400, 'withdrawn', '此人已退選，無法選擇');
    }
    const existing = await c.query<{ candidate_id: string }>(
      `SELECT candidate_id FROM picks WHERE user_id = $1 AND county_id = $2 AND kind = $3 FOR UPDATE`, [userId, countyId, kind]);
    const old = existing.rows[0]?.candidate_id ?? null;
    await assertCanVote(c, old !== null);
    if (old === candidateId) return { changed: false, news: null };

    const before = kind === 'predict' ? leaders(await countyTally(c, countyId, kind)) : [];
    if (candidateId === null) {
      await c.query(`DELETE FROM picks WHERE user_id = $1 AND county_id = $2 AND kind = $3`, [userId, countyId, kind]);
    } else {
      await c.query(
        `INSERT INTO picks (user_id, county_id, kind, candidate_id) VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, county_id, kind) DO UPDATE SET candidate_id = EXCLUDED.candidate_id, updated_at = now()`,
        [userId, countyId, kind, candidateId],
      );
    }
    await c.query(
      `INSERT INTO pick_events (user_id, county_id, kind, action, old_candidate_id, new_candidate_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, countyId, kind, old === null ? 'create' : candidateId === null ? 'cancel' : 'change', old, candidateId],
    );
    let news = null;
    if (kind === 'predict') {
      const after = leaders(await countyTally(c, countyId, kind));
      const ids = [...new Set([...before, ...after])];
      const names = new Map((await c.query<{ id: string; name: string }>(`SELECT id, name FROM candidates WHERE id = ANY($1)`, [ids])).rows.map((r) => [r.id, r.name]));
      const draft = describeLeadChange(county.rows[0].name, before, after, names);
      if (draft) {
        const ins = await c.query(
          `INSERT INTO news_events (type, county_id, message, payload) VALUES ($1,$2,$3,$4) RETURNING id, type, county_id, message, payload, created_at`,
          [draft.type, countyId, draft.message, JSON.stringify(draft.payload)],
        );
        news = ins.rows[0];
      }
    }
    return { changed: true, news };
  });
}

meRouter.put('/picks', pickLimiter, asyncH(async (req, res) => {
  const u = requireUser(req);
  const body = parse(z.object({ county_id: z.string().max(10), kind: kindSchema, candidate_id: z.string().uuid() }), req.body);
  const r = await applyPick(u.id, body.county_id, body.kind, body.candidate_id);
  if (r.changed) {
    broadcast({ type: 'picks_changed', county_id: body.county_id, kind: body.kind });
    if (body.kind === 'predict') broadcast({ type: 'activity' });
    if (r.news) broadcast({ type: 'news', item: r.news });
  }
  res.json(await mePayload(u.id));
}));

meRouter.delete('/picks/:county/:kind', pickLimiter, asyncH(async (req, res) => {
  const u = requireUser(req);
  const kind = parse(kindSchema, req.params.kind);
  const r = await applyPick(u.id, req.params.county, kind, null);
  if (r.changed) {
    broadcast({ type: 'picks_changed', county_id: req.params.county, kind });
    if (kind === 'predict') broadcast({ type: 'activity' });
    if (r.news) broadcast({ type: 'news', item: r.news });
  }
  res.json(await mePayload(u.id));
}));
