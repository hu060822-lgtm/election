import { Router } from 'express';
import { pool } from '../db.js';
import { asyncH, HttpError } from '../lib/http.js';
import { electionModeActive, getSettings, votingState } from '../lib/settings.js';
import { consistency, publicState, resultsAndAccuracy, trendAndDaily } from '../lib/stats.js';

export const publicRouter = Router();

publicRouter.get('/state', asyncH(async (_req, res) => {
  const [state, settings] = await Promise.all([publicState(), getSettings()]);
  res.json({
    ...state,
    settings: { ...settings, voting_state: votingState(settings), election_mode_active: electionModeActive(settings) },
    server_time: new Date().toISOString(),
  });
}));

/** 支持者名單：只列出選擇公開的朋友；不公開者只計入人數。 */
publicRouter.get('/counties/:id/supporters', asyncH(async (req, res) => {
  const settings = await getSettings();
  const county = await pool.query(`SELECT id FROM counties WHERE id = $1`, [req.params.id]);
  if (!county.rowCount) throw new HttpError(404, 'not_found', '找不到此縣市');
  const { rows } = await pool.query<{ user_id: string; nickname: string; is_demo: boolean; kind: string; candidate_id: string; show_predictions: boolean; show_support: boolean }>(
    `SELECT p.user_id, u.nickname, u.is_demo, p.kind, p.candidate_id, u.show_predictions, u.show_support
     FROM picks p JOIN users u ON u.id = p.user_id
     WHERE p.county_id = $1 AND u.is_banned = false ORDER BY p.updated_at DESC`,
    [req.params.id],
  );
  const me = req.user?.id;
  const out: Record<string, { predict: { nickname: string; is_demo: boolean; is_me: boolean }[]; predict_hidden: number; support: { nickname: string; is_demo: boolean; is_me: boolean }[]; support_hidden: number }> = {};
  for (const r of rows) {
    const o = (out[r.candidate_id] ??= { predict: [], predict_hidden: 0, support: [], support_hidden: 0 });
    const isMe = r.user_id === me;
    const visible = settings.allow_view_others && (r.kind === 'predict' ? r.show_predictions : r.show_support);
    if (visible || isMe) o[r.kind as 'predict' | 'support'].push({ nickname: r.nickname, is_demo: r.is_demo, is_me: isMe });
    else o[`${r.kind as 'predict' | 'support'}_hidden`]++;
  }
  res.json({ allow_view_others: settings.allow_view_others, by_candidate: out });
}));

/** 最新動態：只顯示看好度（predict）異動；支持度異動永不出現在動態中。 */
publicRouter.get('/activity', asyncH(async (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const settings = await getSettings();
  const [events, news] = await Promise.all([
    pool.query(
      `SELECT e.id, e.county_id, e.action, e.created_at, u.is_demo,
              CASE WHEN u.show_predictions AND $2::boolean THEN u.nickname END AS nickname,
              CASE WHEN u.show_predictions AND $2::boolean THEN e.new_candidate_id END AS candidate_id
       FROM pick_events e JOIN users u ON u.id = e.user_id
       WHERE e.kind = 'predict' AND u.is_banned = false ORDER BY e.id DESC LIMIT $1`,
      [limit, settings.allow_view_others],
    ),
    pool.query(`SELECT id, type, county_id, message, payload, created_at FROM news_events ORDER BY id DESC LIMIT $1`, [limit]),
  ]);
  res.json({ events: events.rows, news: news.rows });
}));

publicRouter.get('/analytics', asyncH(async (_req, res) => {
  const settings = await getSettings();
  const [trend, cons] = await Promise.all([trendAndDaily(), consistency()]);
  if (!settings.allow_view_others) {
    cons.users = [];
    cons.matrix = [];
  }
  res.json({ trend, consistency: { ...cons, allow_view_others: settings.allow_view_others } });
}));

publicRouter.get('/results', asyncH(async (req, res) => {
  const settings = await getSettings();
  const r = await resultsAndAccuracy(req.user?.id ?? null);
  if (!settings.allow_view_others) {
    r.hidden_count += r.leaderboard.filter((x) => !x.is_me).length;
    r.leaderboard = r.leaderboard.filter((x) => x.is_me);
  }
  res.json({ ...r, election_mode_active: electionModeActive(settings) });
}));
