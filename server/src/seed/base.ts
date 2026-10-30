import { pathToFileURL } from 'node:url';
import { pool, tx } from '../db.js';
import { migrate } from '../migrate.js';
import { CANDIDATES, COUNTIES, DEFAULT_SETTINGS, INDEPENDENT_PALETTE, PARTIES, candidateSource } from './data.js';

const MAJOR = new Set(['kmt', 'dpp', 'tpp', 'tsu']);
const SEED_KEY = 'seed_candidates_v1';

/**
 * Idempotent base seed. Counties / parties / default settings are upserted without touching
 * admin edits; candidates are inserted exactly once (tracked in settings) so that candidates an
 * admin deleted as erroneous do not reappear on the next boot.
 */
export async function seedBase(log = console.log) {
  await tx(async (c) => {
    for (const [i, co] of COUNTIES.entries()) {
      const title = `${co.name}長選舉`;
      await c.query(
        `INSERT INTO counties (id, name, name_en, kind, region, election_title, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [co.id, co.name, co.name_en, co.kind, co.region, title, i + 1],
      );
    }
    for (const p of PARTIES) {
      await c.query(
        `INSERT INTO parties (id, name, short_name, color, sort_order) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.short_name, p.color, p.sort_order],
      );
    }
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await c.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [k, JSON.stringify(v)]);
    }

    const seeded = await c.query(`SELECT 1 FROM settings WHERE key = $1`, [SEED_KEY]);
    if (seeded.rowCount) return;
    const partyName = Object.fromEntries(PARTIES.map((p) => [p.id, p.name]));
    let n = 0;
    for (const [countyId, list] of Object.entries(CANDIDATES)) {
      let indIdx = 0;
      for (const s of list) {
        const color = MAJOR.has(s.party) ? null : INDEPENDENT_PALETTE[indIdx++ % INDEPENDENT_PALETTE.length];
        const src = candidateSource(s);
        const bio = [
          `${partyName[s.party]}${s.incumbent ? '・現任首長尋求連任' : ''}。`,
          s.note ?? '',
          s.ballot == null ? '號次因各媒體整理不一致，待以中選會公告核對。' : '',
          '個人簡介待管理員補充。',
        ].join('');
        await c.query(
          `INSERT INTO candidates (county_id, name, party_id, ballot_number, color, bio, status, is_incumbent,
             source_name, source_url, data_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'registered',$7,$8,$9,'2026-10-30') ON CONFLICT (county_id, name) DO NOTHING`,
          [countyId, s.name, s.party, s.ballot, color, bio, !!s.incumbent, src.source_name, src.source_url],
        );
        n++;
      }
    }
    await c.query(`INSERT INTO settings (key, value) VALUES ($1, 'true')`, [SEED_KEY]);
    log(`Seeded ${COUNTIES.length} counties, ${PARTIES.length} parties, ${n} candidates.`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().then(() => seedBase()).then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
