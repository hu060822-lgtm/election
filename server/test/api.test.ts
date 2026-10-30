/**
 * Integration tests — run against a live server (npm start) with a migrated database.
 *   TEST_BASE_URL (default http://localhost:8787), ADMIN_PASSWORD from .env
 * Every user created here is deleted at the end; settings are restored.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:8787';
const RUN = Date.now().toString(36);

class Client {
  cookies = new Map<string, string>();
  async req(method: string, path: string, body?: unknown, opts: { csrf?: boolean } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(opts.csrf === false ? {} : { 'X-TEW-Client': '1' }),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      if (v) this.cookies.set(k, v); else this.cookies.delete(k);
    }
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* csv */ }
    return { status: res.status, data };
  }
}

type State = { counties: { id: string; name: string }[]; candidates: { id: string; county_id: string; name: string }[]; tallies: { county_id: string; kind: string; candidate_id: string; count: number }[] };
let state: State;
const admin = new Client();
const created: Client[] = [];
let savedSettings: any;

async function join(nick: string, opts = { show_predictions: true, show_support: false }) {
  const c = new Client();
  const r = await c.req('POST', '/api/me/join', { nickname: nick, ...opts });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  created.push(c);
  return Object.assign(c, { recovery: r.data.recovery_code as string, id: r.data.user.id as string });
}
const cands = (county: string) => state.candidates.filter((c) => c.county_id === county);
const tally = async (county: string, kind = 'predict') => {
  const s = (await new Client().req('GET', '/api/state')).data as State;
  return new Map(s.tallies.filter((t) => t.county_id === county && t.kind === kind).map((t) => [t.candidate_id, t.count]));
};

before(async () => {
  state = (await new Client().req('GET', '/api/state')).data;
  const login = await admin.req('POST', '/api/admin/login', { password: process.env.ADMIN_PASSWORD });
  assert.equal(login.status, 200, 'admin login (check ADMIN_PASSWORD)');
  savedSettings = (await new Client().req('GET', '/api/state')).data.settings;
  await admin.req('PUT', '/api/admin/settings', { voting_opens_at: null, voting_closes_at: null, allow_changes: true, allow_view_others: true });
});

after(async () => {
  for (const c of created) await c.req('DELETE', '/api/me');
  const { voting_state, election_mode_active, ...rest } = savedSettings;
  await admin.req('PUT', '/api/admin/settings', rest);
  await admin.req('POST', '/api/admin/logout');
});

describe('base data', () => {
  test('22 counties, every county has candidates', () => {
    assert.equal(state.counties.length, 22);
    for (const c of state.counties) assert.ok(cands(c.id).length >= 2, `${c.name} has candidates`);
  });
});

describe('identity', () => {
  test('join, duplicate nickname rejected (case-insensitive), restore by recovery code', async () => {
    const a = await join(`Tester-${RUN}`);
    const dup = await new Client().req('POST', '/api/me/join', { nickname: `TESTER-${RUN}`, show_predictions: true, show_support: false });
    assert.equal(dup.status, 409);
    const other = new Client();
    assert.equal((await other.req('POST', '/api/me/restore', { nickname: `tester-${RUN}`, recovery_code: 'WRONG-CODE-0000' })).status, 401);
    const ok = await other.req('POST', '/api/me/restore', { nickname: `tester-${RUN}`, recovery_code: a.recovery.toLowerCase() });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.id, a.id);
    // old device session is rotated out
    assert.equal((await a.req('GET', '/api/me')).data.user, null);
    created.push(other);
  });
  test('DEMO- prefix is reserved; HTML-ish nicknames rejected', async () => {
    assert.equal((await new Client().req('POST', '/api/me/join', { nickname: 'DEMO-x', show_predictions: true, show_support: false })).status, 400);
    assert.equal((await new Client().req('POST', '/api/me/join', { nickname: '<b>x', show_predictions: true, show_support: false })).status, 400);
  });
  test('mutations without CSRF header are refused', async () => {
    assert.equal((await new Client().req('POST', '/api/me/join', { nickname: `x${RUN}`, show_predictions: true, show_support: false }, { csrf: false })).status, 403);
  });
  test('picks require a session', async () => {
    const c = state.candidates[0];
    assert.equal((await new Client().req('PUT', '/api/me/picks', { county_id: c.county_id, kind: 'predict', candidate_id: c.id })).status, 401);
  });
});

describe('voting', () => {
  test('all 22 counties accept a predict + support pick; one per county per kind', async () => {
    const u = await join(`All22-${RUN}`);
    for (const co of state.counties) {
      const [a, b] = cands(co.id);
      assert.equal((await u.req('PUT', '/api/me/picks', { county_id: co.id, kind: 'predict', candidate_id: a.id })).status, 200, co.name);
      assert.equal((await u.req('PUT', '/api/me/picks', { county_id: co.id, kind: 'support', candidate_id: b.id })).status, 200, co.name);
    }
    const me = (await u.req('GET', '/api/me')).data;
    assert.equal(me.picks.length, 44);
    // change one, re-submit the same, cancel one
    const [a, b] = cands('67000');
    await u.req('PUT', '/api/me/picks', { county_id: '67000', kind: 'predict', candidate_id: b.id });
    await u.req('PUT', '/api/me/picks', { county_id: '67000', kind: 'predict', candidate_id: b.id });
    let picks = (await u.req('GET', '/api/me')).data.picks.filter((p: any) => p.county_id === '67000' && p.kind === 'predict');
    assert.equal(picks.length, 1);
    assert.equal(picks[0].candidate_id, b.id);
    await u.req('DELETE', '/api/me/picks/67000/predict');
    picks = (await u.req('GET', '/api/me')).data.picks.filter((p: any) => p.county_id === '67000' && p.kind === 'predict');
    assert.equal(picks.length, 0);
    void a;
  });
  test('candidate from another county is rejected', async () => {
    const u = await join(`Cross-${RUN}`);
    const r = await u.req('PUT', '/api/me/picks', { county_id: '63000', kind: 'predict', candidate_id: cands('65000')[0].id });
    assert.equal(r.status, 400);
  });
  test('10 concurrent submissions from one user still yield exactly one pick', async () => {
    const u = await join(`Spam-${RUN}`);
    const list = cands('64000');
    await Promise.all(Array.from({ length: 10 }, (_, i) => u.req('PUT', '/api/me/picks', { county_id: '64000', kind: 'predict', candidate_id: list[i % list.length].id })));
    const picks = (await u.req('GET', '/api/me')).data.picks.filter((p: any) => p.county_id === '64000' && p.kind === 'predict');
    assert.equal(picks.length, 1);
  });
  test('many users voting concurrently: tallies stay exact', async () => {
    const county = '10013';
    const [a, b] = cands(county);
    const before = await tally(county);
    const users = await Promise.all(Array.from({ length: 16 }, (_, i) => join(`Crowd${i}-${RUN}`)));
    await Promise.all(users.map((u, i) => u.req('PUT', '/api/me/picks', { county_id: county, kind: 'predict', candidate_id: i % 4 === 0 ? b.id : a.id })));
    const after = await tally(county);
    assert.equal((after.get(a.id) ?? 0) - (before.get(a.id) ?? 0), 12);
    assert.equal((after.get(b.id) ?? 0) - (before.get(b.id) ?? 0), 4);
  });
  test('lead change produces a 選情快訊 news event', async () => {
    const county = '09007';
    const [a, b] = cands(county);
    const t = await tally(county);
    const ca = t.get(a.id) ?? 0, cb = t.get(b.id) ?? 0;
    // push b to strictly lead a
    const need = Math.max(0, ca - cb + 1);
    const voters = await Promise.all(Array.from({ length: need }, (_, i) => join(`Flip${i}-${RUN}`)));
    for (const v of voters) await v.req('PUT', '/api/me/picks', { county_id: county, kind: 'predict', candidate_id: b.id });
    const news = (await new Client().req('GET', '/api/activity?limit=50')).data.news as { county_id: string; message: string }[];
    assert.ok(news.some((n) => n.county_id === county && /連江縣/.test(n.message)), 'news for 連江縣');
  });
});

describe('privacy', () => {
  test('private support never exposes nickname; aggregated count still includes it', async () => {
    const u = await join(`Private-${RUN}`, { show_predictions: false, show_support: false });
    const c = cands('10002')[0];
    await u.req('PUT', '/api/me/picks', { county_id: '10002', kind: 'support', candidate_id: c.id });
    await u.req('PUT', '/api/me/picks', { county_id: '10002', kind: 'predict', candidate_id: c.id });
    const viewer = new Client();
    const sup = (await viewer.req('GET', '/api/counties/10002/supporters')).data;
    const names = JSON.stringify(sup);
    assert.ok(!names.includes(`Private-${RUN}`));
    assert.ok(sup.by_candidate[c.id].support_hidden >= 1);
    const act = JSON.stringify((await viewer.req('GET', '/api/activity?limit=50')).data);
    assert.ok(!act.includes(`Private-${RUN}`));
    // the owner sees themself
    const own = JSON.stringify((await u.req('GET', '/api/counties/10002/supporters')).data);
    assert.ok(own.includes(`Private-${RUN}`));
  });
  test('account deletion removes picks from tallies', async () => {
    const county = '10014';
    const c = cands(county)[0];
    const before = (await tally(county)).get(c.id) ?? 0;
    const u = new Client();
    await u.req('POST', '/api/me/join', { nickname: `Leaver-${RUN}`, show_predictions: true, show_support: false });
    await u.req('PUT', '/api/me/picks', { county_id: county, kind: 'predict', candidate_id: c.id });
    assert.equal((await tally(county)).get(c.id), before + 1);
    assert.equal((await u.req('DELETE', '/api/me')).status, 200);
    assert.equal((await tally(county)).get(c.id) ?? 0, before);
  });
});

describe('admin', () => {
  test('admin endpoints are refused without a server-side admin session', async () => {
    const anon = new Client();
    for (const [m, p] of [['GET', '/api/admin/users'], ['GET', '/api/admin/picks'], ['PUT', '/api/admin/settings'], ['GET', '/api/admin/export/picks.csv'], ['POST', '/api/admin/clear']] as const) {
      assert.equal((await anon.req(m, p, m === 'GET' ? undefined : {})).status, 401, `${m} ${p}`);
    }
    assert.equal((await anon.req('POST', '/api/admin/login', { password: 'wrong-password-xyz' })).status, 401);
  });
  test('allow_changes=false locks existing picks but allows new ones', async () => {
    const u = await join(`Locked-${RUN}`);
    const [a, b] = cands('10005');
    await u.req('PUT', '/api/me/picks', { county_id: '10005', kind: 'predict', candidate_id: a.id });
    await admin.req('PUT', '/api/admin/settings', { allow_changes: false });
    try {
      assert.equal((await u.req('PUT', '/api/me/picks', { county_id: '10005', kind: 'predict', candidate_id: b.id })).status, 403);
      assert.equal((await u.req('DELETE', '/api/me/picks/10005/predict')).status, 403);
      assert.equal((await u.req('PUT', '/api/me/picks', { county_id: '10008', kind: 'predict', candidate_id: cands('10008')[0].id })).status, 200);
    } finally {
      await admin.req('PUT', '/api/admin/settings', { allow_changes: true });
    }
  });
  test('closed voting window refuses picks', async () => {
    const u = await join(`Closed-${RUN}`);
    await admin.req('PUT', '/api/admin/settings', { voting_closes_at: '2020-01-01T00:00:00+08:00' });
    try {
      const r = await u.req('PUT', '/api/me/picks', { county_id: '10009', kind: 'predict', candidate_id: cands('10009')[0].id });
      assert.equal(r.status, 403);
      assert.equal(r.data.error, 'voting_closed');
    } finally {
      await admin.req('PUT', '/api/admin/settings', { voting_closes_at: null });
    }
  });
  test('candidate CRUD with audit log, CSV export', async () => {
    const r = await admin.req('POST', '/api/admin/candidates', {
      county_id: '10016', name: `測試-${RUN}`, party_id: 'ind', ballot_number: null, color: null, photo_url: null, photo_source: null,
      bio: '', status: 'unconfirmed', is_incumbent: false, source_name: 'test', source_url: null, data_updated_at: '2026-10-30',
    });
    assert.equal(r.status, 201);
    assert.equal((await admin.req('PATCH', `/api/admin/candidates/${r.data.id}`, { status: 'withdrawn' })).status, 200);
    const u = await join(`Wd-${RUN}`);
    assert.equal((await u.req('PUT', '/api/me/picks', { county_id: '10016', kind: 'predict', candidate_id: r.data.id })).status, 400, 'withdrawn not selectable');
    assert.equal((await admin.req('DELETE', `/api/admin/candidates/${r.data.id}`)).status, 200);
    const audit = (await admin.req('GET', '/api/admin/audit')).data as { action: string }[];
    assert.ok(audit.some((a) => a.action === 'candidate.delete'));
    const csv = await admin.req('GET', '/api/admin/export/candidates.csv');
    assert.equal(csv.status, 200);
    assert.ok(String(csv.data).includes('臺北市'));
  });
  test('official results drive the accuracy leaderboard', async () => {
    const county = '10010';
    const [a, b] = cands(county);
    const u = await join(`Oracle-${RUN}`);
    await u.req('PUT', '/api/me/picks', { county_id: county, kind: 'predict', candidate_id: a.id });
    const prev = (await admin.req('GET', '/api/results')).data.results.find((r: any) => r.county_id === county);
    await admin.req('PUT', `/api/admin/results/${county}`, { winner_candidate_id: a.id, is_final: false, source: 'test', votes: { [a.id]: 100, [b.id]: 50 } });
    try {
      const board = (await u.req('GET', '/api/results')).data.leaderboard as any[];
      const me = board.find((x) => x.is_me);
      assert.ok(me && me.hits >= 1);
    } finally {
      if (!prev) await admin.req('DELETE', `/api/admin/results/${county}`);
    }
  });
});
