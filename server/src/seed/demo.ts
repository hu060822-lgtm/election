/**
 * DEMO 測試資料產生器。所有使用者暱稱以「DEMO-」開頭且 is_demo = true，快訊以 [DEMO] 標示，
 * 可在管理後台「清除 DEMO 資料」一鍵移除。這些資料不代表任何真實朋友的看法。
 */
import { pathToFileURL } from 'node:url';
import { pool, tx } from '../db.js';
import { migrate } from '../migrate.js';
import { seedBase } from './base.js';
import { newToken, sha256 } from '../lib/crypto.js';
import { describeLeadChange, leaders } from '../lib/stats.js';

const NAMES = ['Ozzie', 'Alex', 'Kevin', 'Amy', 'Jason', 'Mia', 'Leo', 'Ivy', 'Ray', 'Nina', 'Ben', 'Chloe', 'Eric', 'Grace', 'Hank', 'Joy', 'Ken', 'Lily'];

// Deterministic PRNG so demo output is reproducible
let seed = 20261128;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(arr: T[], w: number[]) => {
  const total = w.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < arr.length; i++) if ((r -= w[i]) <= 0) return arr[i];
  return arr[arr.length - 1];
};

export async function seedDemo() {
  await migrate();
  await seedBase();
  const { rows: cands } = await pool.query<{ id: string; county_id: string; name: string; party_id: string | null }>(`SELECT id, county_id, name, party_id FROM candidates WHERE status <> 'withdrawn'`);
  const { rows: counties } = await pool.query<{ id: string; name: string }>(`SELECT id, name FROM counties ORDER BY sort_order`);
  const byCounty = new Map<string, typeof cands>();
  cands.forEach((c) => byCounty.set(c.county_id, [...(byCounty.get(c.county_id) ?? []), c]));
  const weight = (c: { party_id: string | null }) => (c.party_id === 'kmt' || c.party_id === 'dpp' ? 10 : c.party_id === 'tpp' ? 6 : 1.2);

  await tx(async (c) => {
    await c.query(`DELETE FROM users WHERE is_demo`);
    await c.query(`DELETE FROM news_events WHERE message LIKE '[DEMO]%'`);
    const now = Date.now();
    type Ev = { user: string; county: string; kind: 'predict' | 'support'; cand: string; old: string | null; at: Date };
    const events: Ev[] = [];
    for (const [i, n] of NAMES.entries()) {
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO users (nickname, nickname_key, token_hash, recovery_hash, show_predictions, show_support, is_demo, created_at)
         VALUES ($1, lower($1), $2, $3, $4, $5, true, $6) RETURNING id`,
        [`DEMO-${n}`, sha256(newToken()), sha256(newToken()), i % 6 !== 5, i % 3 === 0, new Date(now - (16 - (i % 14)) * 86400_000)],
      );
      const uid = rows[0].id;
      const lean = rand(); // personal bias, makes predictions vs support diverge
      const coverage = 0.35 + rand() * 0.6;
      for (const co of counties) {
        const list = byCounty.get(co.id) ?? [];
        if (!list.length || rand() > coverage) continue;
        const at = new Date(now - rand() * 15 * 86400_000);
        const p = pick(list, list.map(weight));
        events.push({ user: uid, county: co.id, kind: 'predict', cand: p.id, old: null, at });
        if (rand() < 0.15) {
          const p2 = pick(list, list.map(weight));
          if (p2.id !== p.id) events.push({ user: uid, county: co.id, kind: 'predict', cand: p2.id, old: p.id, at: new Date(at.getTime() + rand() * 4 * 86400_000) });
        }
        if (rand() < 0.6) {
          const sw = list.map((x) => weight(x) * (x.party_id === 'kmt' ? lean * 2 : x.party_id === 'dpp' ? (1 - lean) * 2 : 0.6));
          events.push({ user: uid, county: co.id, kind: 'support', cand: pick(list, sw).id, old: null, at: new Date(at.getTime() + 60_000) });
        }
      }
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime());
    const names = new Map(cands.map((x) => [x.id, x.name]));
    const countyName = new Map(counties.map((x) => [x.id, x.name]));
    const tallies = new Map<string, Map<string, number>>();
    for (const e of events.filter((x) => x.at.getTime() <= now)) {
      await c.query(
        `INSERT INTO picks (user_id, county_id, kind, candidate_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$5)
         ON CONFLICT (user_id, county_id, kind) DO UPDATE SET candidate_id = EXCLUDED.candidate_id, updated_at = EXCLUDED.updated_at`,
        [e.user, e.county, e.kind, e.cand, e.at],
      );
      await c.query(
        `INSERT INTO pick_events (user_id, county_id, kind, action, old_candidate_id, new_candidate_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [e.user, e.county, e.kind, e.old ? 'change' : 'create', e.old, e.cand, e.at],
      );
      if (e.kind !== 'predict') continue;
      const t = tallies.get(e.county) ?? new Map<string, number>();
      tallies.set(e.county, t);
      const before = leaders(t);
      if (e.old) t.set(e.old, (t.get(e.old) ?? 1) - 1);
      t.set(e.cand, (t.get(e.cand) ?? 0) + 1);
      const d = describeLeadChange(countyName.get(e.county)!, before, leaders(t), names);
      if (d && d.type !== 'first') {
        await c.query(`INSERT INTO news_events (type, county_id, message, payload, created_at) VALUES ($1,$2,$3,$4,$5)`,
          [d.type, e.county, `[DEMO] ${d.message}`, JSON.stringify({ ...d.payload, demo: true }), e.at]);
      }
    }
    console.log(`DEMO: ${NAMES.length} users, ${events.length} pick events.`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
