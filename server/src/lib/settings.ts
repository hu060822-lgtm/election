import { pool, type Tx } from '../db.js';

export type Settings = {
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  allow_changes: boolean;
  allow_view_others: boolean;
  election_mode: 'auto' | 'on' | 'off';
  election_date: string;
  site_notice: string;
};

/** Pass the transaction's client when called inside a transaction, so it never needs a second pool connection. */
export async function getSettings(c?: Tx): Promise<Settings> {
  const { rows } = await (c ?? pool).query<{ key: string; value: unknown }>(`SELECT key, value FROM settings`);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
  return {
    voting_opens_at: (s.voting_opens_at as string) ?? null,
    voting_closes_at: (s.voting_closes_at as string) ?? null,
    allow_changes: s.allow_changes !== false,
    allow_view_others: s.allow_view_others !== false,
    election_mode: (s.election_mode as Settings['election_mode']) ?? 'auto',
    election_date: (s.election_date as string) ?? '2026-11-28',
    site_notice: (s.site_notice as string) ?? '',
  };
}

export function votingState(s: Settings, now = new Date()): 'not_open' | 'open' | 'closed' {
  if (s.voting_opens_at && now < new Date(s.voting_opens_at)) return 'not_open';
  if (s.voting_closes_at && now >= new Date(s.voting_closes_at)) return 'closed';
  return 'open';
}

/** Election-night mode: forced on/off by admin, or automatic from election day (Asia/Taipei). */
export function electionModeActive(s: Settings, now = new Date()) {
  if (s.election_mode === 'on') return true;
  if (s.election_mode === 'off') return false;
  return now >= new Date(`${s.election_date}T00:00:00+08:00`);
}
