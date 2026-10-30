import { pool, type Tx } from '../db.js';

export type Kind = 'predict' | 'support';
const ACTIVE = `u.is_banned = false`;

/** Counts per candidate for one county/kind, used for lead-change detection inside a transaction. */
export async function countyTally(c: Tx, countyId: string, kind: Kind) {
  const { rows } = await c.query<{ candidate_id: string; n: number }>(
    `SELECT p.candidate_id, count(*)::int AS n FROM picks p JOIN users u ON u.id = p.user_id
     WHERE p.county_id = $1 AND p.kind = $2 AND ${ACTIVE} GROUP BY p.candidate_id`,
    [countyId, kind],
  );
  return new Map(rows.map((r) => [r.candidate_id, r.n]));
}

export function leaders(t: Map<string, number>) {
  let max = 0;
  t.forEach((n) => (max = Math.max(max, n)));
  if (max === 0) return [] as string[];
  return [...t.entries()].filter(([, n]) => n === max).map(([id]) => id).sort();
}

type NewsDraft = { type: 'first' | 'lead_change' | 'tie' | 'tie_break'; message: string; payload: Record<string, unknown> };

/** Turns a before/after leader set into a 選情快訊 headline, or null if the order at the top did not change. */
export function describeLeadChange(county: string, before: string[], after: string[], names: Map<string, string>): NewsDraft | null {
  const same = before.length === after.length && before.every((x, i) => x === after[i]);
  if (same || after.length === 0) return null;
  const nm = (id: string) => names.get(id) ?? '某候選人';
  if (before.length === 0) {
    if (after.length !== 1) return null;
    return { type: 'first', message: `${county}出現第一筆朋友預測：${nm(after[0])} 暫居看好度第一`, payload: { leaders: after } };
  }
  if (after.length > 1) {
    return { type: 'tie', message: `${county}看好度出現平手！${after.map(nm).join('、')} 並列第一`, payload: { before, leaders: after } };
  }
  if (before.length > 1) {
    return { type: 'tie_break', message: `${county}打破平手，${nm(after[0])} 暫居看好度領先`, payload: { before, leaders: after } };
  }
  return { type: 'lead_change', message: `${county}看好度排名出現變動！${nm(after[0])} 超越 ${nm(before[0])}`, payload: { before, leaders: after } };
}

export async function publicState() {
  const [counties, parties, candidates, tallies, participants, totals] = await Promise.all([
    pool.query(`SELECT id, name, name_en, kind, region, election_title, sort_order FROM counties ORDER BY sort_order`),
    pool.query(`SELECT id, name, short_name, color, sort_order FROM parties ORDER BY sort_order, name`),
    pool.query(`SELECT c.id, c.county_id, c.name, c.party_id, c.ballot_number, c.color, c.photo_url, c.photo_source, c.bio, c.status,
                       c.is_incumbent, c.source_name, c.source_url, to_char(c.data_updated_at, 'YYYY-MM-DD') AS data_updated_at, c.updated_at
                FROM candidates c JOIN counties co ON co.id = c.county_id ORDER BY co.sort_order, c.ballot_number NULLS LAST, c.name`),
    pool.query(`SELECT p.county_id, p.kind, p.candidate_id, count(*)::int AS count
                FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE}
                GROUP BY p.county_id, p.kind, p.candidate_id`),
    pool.query(`SELECT p.county_id, count(DISTINCT p.user_id)::int AS participants,
                       count(DISTINCT p.user_id) FILTER (WHERE p.kind = 'predict')::int AS predictors,
                       count(DISTINCT p.user_id) FILTER (WHERE p.kind = 'support')::int AS supporters
                FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE} GROUP BY p.county_id`),
    pool.query(`SELECT
                  (SELECT count(*)::int FROM users u WHERE ${ACTIVE}) AS members,
                  (SELECT count(DISTINCT p.user_id)::int FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE}) AS participants,
                  (SELECT count(*)::int FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE} AND p.kind = 'predict') AS predictions,
                  (SELECT count(*)::int FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE} AND p.kind = 'support') AS supports,
                  (SELECT count(*)::int FROM users u WHERE ${ACTIVE} AND u.is_demo) AS demo_members`),
  ]);
  return {
    counties: counties.rows,
    parties: parties.rows,
    candidates: candidates.rows,
    tallies: tallies.rows,
    participation: participants.rows,
    totals: totals.rows[0],
  };
}

/** Day key in Asia/Taipei. */
const dayKey = (d: Date) => new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10);

export async function trendAndDaily(days = 45) {
  const { rows } = await pool.query<{ kind: Kind; action: string; old_candidate_id: string | null; new_candidate_id: string | null; created_at: Date }>(
    `SELECT e.kind, e.action, e.old_candidate_id, e.new_candidate_id, e.created_at
     FROM pick_events e JOIN users u ON u.id = e.user_id WHERE ${ACTIVE} ORDER BY e.id`,
  );
  const today = dayKey(new Date());
  const first = rows.length ? dayKey(rows[0].created_at) : today;
  const allDays: string[] = [];
  for (let d = new Date(`${first}T00:00:00Z`); dayKey(new Date(d.getTime() - 8 * 3600_000)) <= today; d = new Date(d.getTime() + 86400_000)) {
    allDays.push(d.toISOString().slice(0, 10));
  }
  const counts = new Map<string, number>();
  const series: Record<string, number[]> = {};
  const daily = new Map<string, { predict: number; support: number; changes: number; cancels: number }>();
  let i = 0;
  for (const day of allDays) {
    const bucket = { predict: 0, support: 0, changes: 0, cancels: 0 };
    while (i < rows.length && dayKey(rows[i].created_at) === day) {
      const e = rows[i++];
      if (e.action === 'create') bucket[e.kind]++;
      else if (e.action === 'change') bucket.changes++;
      else bucket.cancels++;
      if (e.kind !== 'predict') continue;
      if (e.old_candidate_id) counts.set(e.old_candidate_id, (counts.get(e.old_candidate_id) ?? 0) - 1);
      if (e.new_candidate_id) counts.set(e.new_candidate_id, (counts.get(e.new_candidate_id) ?? 0) + 1);
    }
    daily.set(day, bucket);
    counts.forEach((n, id) => {
      (series[id] ??= new Array(allDays.indexOf(day)).fill(0)).push(Math.max(0, n));
    });
  }
  const start = Math.max(0, allDays.length - days);
  return {
    days: allDays.slice(start),
    series: Object.fromEntries(Object.entries(series).map(([id, arr]) => [id, arr.slice(start)])),
    daily: allDays.slice(start).map((d) => ({ day: d, ...daily.get(d)! })),
  };
}

/** Pairwise agreement among friends who chose to make predictions public. */
export async function consistency(limit = 24) {
  const { rows } = await pool.query<{ user_id: string; nickname: string; is_demo: boolean; county_id: string; candidate_id: string; show: boolean }>(
    `SELECT p.user_id, u.nickname, u.is_demo, p.county_id, p.candidate_id, u.show_predictions AS show
     FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE} AND p.kind = 'predict'`,
  );
  const byUser = new Map<string, { nickname: string; is_demo: boolean; show: boolean; picks: Map<string, string> }>();
  for (const r of rows) {
    const u = byUser.get(r.user_id) ?? { nickname: r.nickname, is_demo: r.is_demo, show: r.show, picks: new Map() };
    u.picks.set(r.county_id, r.candidate_id);
    byUser.set(r.user_id, u);
  }
  const compare = (a: Map<string, string>, b: Map<string, string>) => {
    let common = 0, same = 0;
    a.forEach((cand, county) => {
      const o = b.get(county);
      if (o) { common++; if (o === cand) same++; }
    });
    return { common, same };
  };
  // Overall agreement (anonymous, includes private users only as aggregate)
  const all = [...byUser.values()];
  let tc = 0, ts = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const r = compare(all[i].picks, all[j].picks);
    tc += r.common; ts += r.same;
  }
  const pub = [...byUser.entries()].filter(([, u]) => u.show).sort((a, b) => b[1].picks.size - a[1].picks.size).slice(0, limit);
  const matrix = pub.map(([, a]) => pub.map(([, b]) => compare(a.picks, b.picks)));
  return {
    overall: { pairs_common: tc, pairs_same: ts, rate: tc ? ts / tc : null, users: all.length },
    users: pub.map(([id, u]) => ({ id, nickname: u.nickname, is_demo: u.is_demo, picks: u.picks.size })),
    matrix,
    hidden_users: all.length - pub.length,
  };
}

export async function resultsAndAccuracy(viewerId: string | null) {
  const [res, votes, picks] = await Promise.all([
    pool.query(`SELECT county_id, winner_candidate_id, is_final, source, updated_at FROM official_results`),
    pool.query(`SELECT candidate_id, votes FROM official_votes`),
    pool.query<{ user_id: string; nickname: string; is_demo: boolean; show: boolean; county_id: string; candidate_id: string }>(
      `SELECT p.user_id, u.nickname, u.is_demo, u.show_predictions AS show, p.county_id, p.candidate_id
       FROM picks p JOIN users u ON u.id = p.user_id WHERE ${ACTIVE} AND p.kind = 'predict'`,
    ),
  ]);
  const winners = new Map<string, string>();
  for (const r of res.rows) if (r.winner_candidate_id) winners.set(r.county_id, r.winner_candidate_id);
  const users = new Map<string, { nickname: string; is_demo: boolean; show: boolean; hits: number; scored: number; picked: number }>();
  for (const p of picks.rows) {
    const u = users.get(p.user_id) ?? { nickname: p.nickname, is_demo: p.is_demo, show: p.show, hits: 0, scored: 0, picked: 0 };
    u.picked++;
    const w = winners.get(p.county_id);
    if (w) { u.scored++; if (w === p.candidate_id) u.hits++; }
    users.set(p.user_id, u);
  }
  const board = [...users.entries()]
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.hits - a.hits || a.scored - b.scored || a.nickname.localeCompare(b.nickname));
  return {
    results: res.rows,
    votes: votes.rows,
    decided: winners.size,
    leaderboard: board
      .filter((u) => u.show || u.id === viewerId)
      .map((u) => ({ nickname: u.nickname, is_demo: u.is_demo, hits: u.hits, scored: u.scored, picked: u.picked, is_me: u.id === viewerId, is_private: !u.show })),
    hidden_count: board.filter((u) => !u.show && u.id !== viewerId).length,
  };
}
