import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { candidateColor } from '../lib/derive';
import { dateTW, STATUS_LABEL } from '../lib/format';
import { useAppState } from '../lib/queries';
import type { Candidate, CandidateStatus } from '../lib/types';
import { Avatar, DemoBadge, EmptyState, ErrorState, LoadingPanel, Modal, PartyChip, StatusChip, Toggle } from '../components/ui';

const TABS = [
  { id: 'candidates', label: '候選人' },
  { id: 'users', label: '使用者' },
  { id: 'picks', label: '投票資料' },
  { id: 'settings', label: '投票設定' },
  { id: 'results', label: '開票結果' },
  { id: 'data', label: '匯出與清除' },
  { id: 'audit', label: '操作紀錄' },
] as const;
type Tab = (typeof TABS)[number]['id'];

function useFlash() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);
  const run = async (fn: () => Promise<unknown>, okText: string) => {
    try { await fn(); setMsg({ ok: true, text: okText }); return true; } catch (e) { setMsg({ ok: false, text: e instanceof ApiError ? e.message : '操作失敗' }); return false; }
  };
  const node = msg && <p role="status" className={`fixed bottom-4 right-4 z-[70] rounded-md px-4 py-3 text-sm font-bold shadow-lift ${msg.ok ? 'bg-emerald-500 text-ink' : 'bg-signal text-white'}`}>{msg.text}</p>;
  return { run, node };
}

function Login() {
  const qc = useQueryClient();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="panel mx-auto mt-10 max-w-sm space-y-4 p-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await api.post('/api/admin/login', { password: pw }); qc.invalidateQueries({ queryKey: ['admin'] }); } catch (x) { setErr(x instanceof ApiError ? x.message : '登入失敗'); } finally { setBusy(false); }
    }}>
      <h1 className="text-xl font-black">管理員登入</h1>
      <div><label className="label" htmlFor="pw">管理員密碼</label><input id="pw" type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" /></div>
      {err && <p className="text-sm font-bold text-signal" role="alert">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !pw}>{busy ? '驗證中…' : '登入後台'}</button>
      <p className="text-xs text-text-4">權限由伺服器端 session 驗證，登入 12 小時後自動失效。</p>
    </form>
  );
}

const EMPTY: Omit<Candidate, 'id' | 'updated_at'> = {
  county_id: '63000', name: '', party_id: 'ind', ballot_number: null, color: null, photo_url: null, photo_source: null, bio: '',
  status: 'unconfirmed', is_incumbent: false, source_name: '', source_url: '', data_updated_at: new Date().toISOString().slice(0, 10),
};

function CandidateForm({ initial, onDone }: { initial: Candidate | null; onDone: () => void }) {
  const st = useAppState();
  const ix = st.ix!;
  const [f, setF] = useState<Omit<Candidate, 'id' | 'updated_at'>>(initial ?? EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoSource, setPhotoSource] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!f.name.trim()) return setErr('請輸入姓名');
    if (!f.source_name?.trim()) return setErr('請填寫資料來源（候選人資料必須記錄來源）');
    if (photo && !photoSource.trim()) return setErr('上傳照片時請填寫照片來源');
    setBusy(true);
    try {
      const { county_id, ...rest } = f;
      const body = { ...rest, color: f.color || null, source_url: f.source_url || null, photo_url: f.photo_url || null };
      const saved = initial ? await api.patch<Candidate>(`/api/admin/candidates/${initial.id}`, body) : await api.post<Candidate>('/api/admin/candidates', { county_id, ...body });
      if (photo) {
        const fd = new FormData(); fd.append('photo_source', photoSource); fd.append('photo', photo);
        await api.upload(`/api/admin/candidates/${saved.id}/photo`, fd);
      }
      onDone();
    } catch (x) { setErr(x instanceof ApiError ? x.message : '儲存失敗'); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="cf-county">縣市</label>
        <select id="cf-county" className="field" value={f.county_id} disabled={!!initial} onChange={(e) => set('county_id', e.target.value)}>
          {[...ix.counties.values()].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></div>
      <div><label className="label" htmlFor="cf-name">姓名</label><input id="cf-name" className="field" value={f.name} maxLength={40} onChange={(e) => set('name', e.target.value)} /></div>
      <div><label className="label" htmlFor="cf-party">政黨</label>
        <select id="cf-party" className="field" value={f.party_id ?? ''} onChange={(e) => set('party_id', e.target.value || null)}>
          {[...ix.parties.values()].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
      <div><label className="label" htmlFor="cf-ballot">號次（未確定請留空）</label><input id="cf-ballot" className="field" inputMode="numeric" value={f.ballot_number ?? ''} onChange={(e) => set('ballot_number', e.target.value ? Number(e.target.value) : null)} /></div>
      <div><label className="label" htmlFor="cf-status">參選狀態</label>
        <select id="cf-status" className="field" value={f.status} onChange={(e) => set('status', e.target.value as CandidateStatus)}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></div>
      <div><label className="label" htmlFor="cf-color">地圖識別色（留空＝使用政黨色）</label>
        <div className="flex gap-2"><input id="cf-color" className="field" placeholder="#RRGGBB" value={f.color ?? ''} onChange={(e) => set('color', e.target.value || null)} />
          <input type="color" aria-label="選擇顏色" className="h-10 w-12 rounded border border-rule-strong bg-ink-2" value={f.color ?? '#8E9AAF'} onChange={(e) => set('color', e.target.value.toUpperCase())} /></div></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="cf-bio">個人簡介</label><textarea id="cf-bio" className="field min-h-[90px]" maxLength={2000} value={f.bio} onChange={(e) => set('bio', e.target.value)} /></div>
      <div><label className="label" htmlFor="cf-src">資料來源名稱</label><input id="cf-src" className="field" value={f.source_name ?? ''} onChange={(e) => set('source_name', e.target.value)} placeholder="例：中選會候選人名單公告" /></div>
      <div><label className="label" htmlFor="cf-srcurl">資料來源網址</label><input id="cf-srcurl" className="field" value={f.source_url ?? ''} onChange={(e) => set('source_url', e.target.value)} placeholder="https://" /></div>
      <div><label className="label" htmlFor="cf-date">資料更新日期</label><input id="cf-date" type="date" className="field" value={f.data_updated_at ?? ''} onChange={(e) => set('data_updated_at', e.target.value || null)} /></div>
      <div className="flex items-end pb-2"><Toggle checked={f.is_incumbent} onChange={(v) => set('is_incumbent', v)} label="現任首長" /></div>
      <fieldset className="space-y-2 rounded-md border border-rule p-3 sm:col-span-2">
        <legend className="px-1 text-xs font-bold text-text-2">照片（JPG／PNG／WebP，3MB 內；請使用官方或授權來源）</legend>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm text-text-2 file:mr-3 file:rounded file:border-0 file:bg-panel-3 file:px-3 file:py-2 file:text-sm file:font-bold file:text-text" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} aria-label="上傳候選人照片" />
        <label className="label" htmlFor="cf-psrc">照片來源</label>
        <input id="cf-psrc" className="field" value={photoSource} onChange={(e) => setPhotoSource(e.target.value)} placeholder="例：候選人官方競選網站" />
        {initial?.photo_url && <p className="text-xs text-text-3">目前照片來源：{initial.photo_source ?? '未記錄'}</p>}
      </fieldset>
      {err && <p className="text-sm font-bold text-signal sm:col-span-2" role="alert">{err}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-ghost" onClick={onDone}>取消</button>
        <button className="btn-primary" disabled={busy}>{busy ? '儲存中…' : initial ? '儲存變更' : '新增候選人'}</button>
      </div>
    </form>
  );
}

function CandidatesTab() {
  const st = useAppState();
  const ix = st.ix!;
  const qc = useQueryClient();
  const { run, node } = useFlash();
  const [county, setCounty] = useState('all');
  const [editing, setEditing] = useState<Candidate | null | 'new'>(null);
  const [del, setDel] = useState<Candidate | null>(null);
  const list = st.data!.candidates.filter((c) => county === 'all' || c.county_id === county);
  const refresh = () => qc.invalidateQueries({ queryKey: ['state'] });
  return (
    <div>
      {node}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="cf-filter">篩選縣市</label>
        <select id="cf-filter" className="field w-auto" value={county} onChange={(e) => setCounty(e.target.value)}>
          <option value="all">全部縣市（{st.data!.candidates.length}）</option>
          {[...ix.summaries.values()].map((s) => <option key={s.county.id} value={s.county.id}>{s.county.name}（{s.candidates.length}）</option>)}
        </select>
        <button className="btn-primary ml-auto" onClick={() => setEditing('new')}>新增候選人</button>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-rule text-left text-xs text-text-3"><th className="py-2 font-bold">候選人</th><th className="font-bold">縣市</th><th className="font-bold">號次</th><th className="font-bold">狀態</th><th className="font-bold">來源</th><th /></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-rule/60">
                <td className="py-2"><span className="flex items-center gap-2"><Avatar c={c} parties={ix.parties} size={36} /><span><b>{c.name}</b><br /><PartyChip c={c} parties={ix.parties} /></span></span></td>
                <td>{ix.counties.get(c.county_id)?.name}</td>
                <td className="num text-base">{c.ballot_number ?? <span className="text-xs text-gold">待核對</span>}</td>
                <td><StatusChip status={c.status} /></td>
                <td className="max-w-[220px] truncate text-xs text-text-3" title={c.source_name ?? ''}>{c.source_name}<br />{c.data_updated_at}</td>
                <td className="whitespace-nowrap text-right">
                  <button className="rounded px-2 py-1 text-xs font-bold text-electric-glow hover:bg-white/5" onClick={() => setEditing(c)}>編輯</button>
                  {c.photo_url && <button className="rounded px-2 py-1 text-xs font-bold text-text-3 hover:bg-white/5" onClick={() => run(() => api.del(`/api/admin/candidates/${c.id}/photo`).then(refresh), '已移除照片')}>移除照片</button>}
                  <button className="rounded px-2 py-1 text-xs font-bold text-signal hover:bg-white/5" onClick={() => setDel(c)}>刪除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? '新增候選人' : `編輯 ${editing?.name ?? ''}`} wide>
        {editing !== null && <CandidateForm initial={editing === 'new' ? null : editing} onDone={() => { setEditing(null); refresh(); }} />}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title={`刪除 ${del?.name ?? ''}`}>
        <p className="mb-4 text-sm text-text-2">將永久刪除「{del?.name}」（{del && ix.counties.get(del.county_id)?.name}）以及所有朋友對此人的看好與支持選擇。僅用於刪除錯誤資料；若候選人退選，請改為將狀態設為「已退選」。</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDel(null)}>取消</button>
          <button className="btn-danger" onClick={async () => { if (await run(() => api.del(`/api/admin/candidates/${del!.id}`), `已刪除 ${del!.name}`)) { setDel(null); refresh(); } }}>刪除 {del?.name}</button>
        </div>
      </Modal>
    </div>
  );
}

type AdminUser = { id: string; nickname: string; show_predictions: boolean; show_support: boolean; is_demo: boolean; is_banned: boolean; created_at: string; last_seen_at: string; predict_count: number; support_count: number };

function UsersTab() {
  const q = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.get<AdminUser[]>('/api/admin/users') });
  const { run, node } = useFlash();
  const [del, setDel] = useState<AdminUser | null>(null);
  if (q.isLoading) return <LoadingPanel />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data!;
  if (!rows.length) return <EmptyState title="還沒有使用者" body="朋友以暱稱加入後會列在這裡。" />;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      {node}
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="border-b border-rule text-left text-xs text-text-3"><th className="py-2 font-bold">暱稱</th><th className="font-bold">看好／支持</th><th className="font-bold">公開設定</th><th className="font-bold">加入／最近</th><th className="font-bold">狀態</th><th /></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-rule/60">
              <td className="py-2 font-bold">{u.nickname} {u.is_demo && <DemoBadge />}</td>
              <td className="num">{u.predict_count} / {u.support_count}</td>
              <td className="text-xs text-text-3">看好{u.show_predictions ? '公開' : '不公開'}・支持{u.show_support ? '公開' : '不公開'}</td>
              <td className="text-xs text-text-3">{dateTW(u.created_at)}<br />{dateTW(u.last_seen_at)}</td>
              <td>{u.is_banned ? <span className="chip bg-signal/15 text-signal">已停用</span> : <span className="chip bg-white/5 text-text-2">正常</span>}</td>
              <td className="whitespace-nowrap text-right">
                <button className="rounded px-2 py-1 text-xs font-bold text-gold hover:bg-white/5" onClick={() => run(() => api.patch(`/api/admin/users/${u.id}`, { is_banned: !u.is_banned }).then(() => q.refetch()), u.is_banned ? `已恢復 ${u.nickname}` : `已停用 ${u.nickname}`)}>{u.is_banned ? '恢復' : '停用'}</button>
                <button className="rounded px-2 py-1 text-xs font-bold text-signal hover:bg-white/5" onClick={() => setDel(u)}>刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-text-4">停用的使用者不計入任何統計，也無法送出選擇。</p>
      <Modal open={!!del} onClose={() => setDel(null)} title={`刪除使用者 ${del?.nickname ?? ''}`}>
        <p className="mb-4 text-sm text-text-2">將永久刪除「{del?.nickname}」與其所有選擇、異動紀錄。</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDel(null)}>取消</button>
          <button className="btn-danger" onClick={async () => { if (await run(() => api.del(`/api/admin/users/${del!.id}`), `已刪除 ${del!.nickname}`)) { setDel(null); q.refetch(); } }}>刪除 {del?.nickname}</button>
        </div>
      </Modal>
    </div>
  );
}

type AdminPick = { id: number; nickname: string; is_demo: boolean; county: string; kind: string; candidate: string; party: string; updated_at: string };
function PicksTab() {
  const q = useQuery({ queryKey: ['admin', 'picks'], queryFn: () => api.get<AdminPick[]>('/api/admin/picks') });
  const [filter, setFilter] = useState('');
  const rows = useMemo(() => (q.data ?? []).filter((r) => !filter || `${r.nickname}${r.county}${r.candidate}`.includes(filter)), [q.data, filter]);
  if (q.isLoading) return <LoadingPanel />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div>
      <p className="mb-3 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-gold">此頁包含朋友未公開的支持度資料，僅供維護使用，請勿外流或截圖分享。</p>
      <label className="sr-only" htmlFor="pk-filter">搜尋</label>
      <input id="pk-filter" className="field mb-3 max-w-xs" placeholder="搜尋暱稱、縣市或候選人" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {!rows.length ? <EmptyState title="沒有符合的投票資料" /> : (
        <div className="max-h-[600px] overflow-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-panel"><tr className="border-b border-rule text-left text-xs text-text-3"><th className="py-2 font-bold">暱稱</th><th className="font-bold">縣市</th><th className="font-bold">類型</th><th className="font-bold">候選人</th><th className="font-bold">時間</th></tr></thead>
            <tbody>
              {rows.slice(0, 1000).map((r) => (
                <tr key={r.id} className="border-b border-rule/60">
                  <td className="py-1.5">{r.nickname} {r.is_demo && <DemoBadge />}</td><td>{r.county}</td>
                  <td>{r.kind === 'predict' ? <span className="text-electric-glow">看好</span> : <span className="text-gold">支持</span>}</td>
                  <td>{r.candidate} <span className="text-xs text-text-3">{r.party}</span></td><td className="text-xs text-text-3">{dateTW(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 1000 && <p className="mt-2 text-xs text-text-4">僅顯示前 1000 筆，完整資料請匯出 CSV。</p>}
        </div>
      )}
    </div>
  );
}

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? `${v}:00+08:00` : null);

function SettingsTab() {
  const st = useAppState();
  const s = st.data!.settings;
  const { run, node } = useFlash();
  const [f, setF] = useState({ opens: toLocal(s.voting_opens_at), closes: toLocal(s.voting_closes_at), allow_changes: s.allow_changes, allow_view_others: s.allow_view_others, election_mode: s.election_mode, site_notice: s.site_notice });
  return (
    <form className="max-w-xl space-y-5" onSubmit={(e) => { e.preventDefault(); run(() => api.put('/api/admin/settings', { voting_opens_at: fromLocal(f.opens), voting_closes_at: fromLocal(f.closes), allow_changes: f.allow_changes, allow_view_others: f.allow_view_others, election_mode: f.election_mode, site_notice: f.site_notice }).then(() => st.refetch()), '設定已儲存'); }}>
      {node}
      <p className="text-sm text-text-3">目前狀態：<b className="text-text">{{ open: '開放中', closed: '已截止', not_open: '尚未開放' }[s.voting_state]}</b>（時間皆為台灣時間）</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="s-open">開放投票時間（留空＝立即）</label><input id="s-open" type="datetime-local" className="field" value={f.opens} onChange={(e) => setF({ ...f, opens: e.target.value })} /></div>
        <div><label className="label" htmlFor="s-close">投票截止時間（留空＝不截止）</label><input id="s-close" type="datetime-local" className="field" value={f.closes} onChange={(e) => setF({ ...f, closes: e.target.value })} /></div>
      </div>
      <Toggle checked={f.allow_changes} onChange={(v) => setF({ ...f, allow_changes: v })} label="允許修改與取消選擇" hint="關閉後，已送出的選擇無法變更（仍可新增未選擇的縣市）。" />
      <Toggle checked={f.allow_view_others} onChange={(v) => setF({ ...f, allow_view_others: v })} label="允許查看其他人的選擇" hint="關閉後，支持者名單、動態暱稱與一致性矩陣全部隱藏，只顯示人數統計。" />
      <div><label className="label" htmlFor="s-mode">11/28 開票特別模式</label>
        <select id="s-mode" className="field" value={f.election_mode} onChange={(e) => setF({ ...f, election_mode: e.target.value as typeof f.election_mode })}>
          <option value="auto">自動（11/28 00:00 起啟動）</option><option value="on">強制開啟</option><option value="off">強制關閉</option>
        </select></div>
      <div><label className="label" htmlFor="s-notice">跑馬燈公告（200 字內）</label><input id="s-notice" className="field" maxLength={200} value={f.site_notice} onChange={(e) => setF({ ...f, site_notice: e.target.value })} /></div>
      <button className="btn-primary">儲存設定</button>
    </form>
  );
}

function ResultsTab() {
  const st = useAppState();
  const ix = st.ix!;
  const q = useQuery({ queryKey: ['results'], queryFn: () => api.get<{ results: { county_id: string; winner_candidate_id: string | null; is_final: boolean; source: string | null }[]; votes: { candidate_id: string; votes: number }[] }>('/api/results') });
  const { run, node } = useFlash();
  const [county, setCounty] = useState('63000');
  const s = ix.summaries.get(county)!;
  const existing = q.data?.results.find((r) => r.county_id === county);
  const [form, setForm] = useState<{ winner: string; final: boolean; source: string; votes: Record<string, string> }>({ winner: '', final: false, source: '', votes: {} });
  useEffect(() => {
    const vm = new Map(q.data?.votes.map((v) => [v.candidate_id, v.votes]));
    setForm({ winner: existing?.winner_candidate_id ?? '', final: existing?.is_final ?? false, source: existing?.source ?? '中央選舉委員會選舉資料庫', votes: Object.fromEntries(s.candidates.map((c) => [c.id, vm.get(c.id)?.toString() ?? ''])) });
  }, [county, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (q.isLoading) return <LoadingPanel />;
  return (
    <div className="max-w-2xl space-y-4">
      {node}
      <p className="text-sm text-text-3">請依中央選舉委員會公告輸入。官方結果與朋友預測分開儲存，只用於開票特別模式與預測準確度計算。</p>
      <div><label className="label" htmlFor="r-county">縣市</label>
        <select id="r-county" className="field w-auto" value={county} onChange={(e) => setCounty(e.target.value)}>
          {[...ix.summaries.values()].map((x) => <option key={x.county.id} value={x.county.id}>{x.county.name}{q.data?.results.some((r) => r.county_id === x.county.id && r.winner_candidate_id) ? '（已輸入）' : ''}</option>)}
        </select></div>
      <fieldset className="space-y-2">
        <legend className="label">候選人得票數（選填）與當選人</legend>
        {s.candidates.map((c) => (
          <div key={c.id} className="grid grid-cols-[auto_1fr_8rem] items-center gap-3 rounded-md border border-rule px-3 py-2">
            <input type="radio" name="winner" aria-label={`${c.name} 當選`} checked={form.winner === c.id} onChange={() => setForm({ ...form, winner: c.id })} className="h-4 w-4 accent-[#E6B84C]" />
            <span className="flex items-center gap-2"><span className="h-3 w-1 rounded-full" style={{ background: candidateColor(c, ix.parties) }} />{c.ballot_number != null && <span className="num text-text-3">{c.ballot_number}</span>}<b>{c.name}</b></span>
            <input className="field num py-1" inputMode="numeric" aria-label={`${c.name} 得票數`} placeholder="得票數" value={form.votes[c.id] ?? ''} onChange={(e) => setForm({ ...form, votes: { ...form.votes, [c.id]: e.target.value.replace(/\D/g, '') } })} />
          </div>
        ))}
      </fieldset>
      <Toggle checked={form.final} onChange={(v) => setForm({ ...form, final: v })} label="已確定（官方完成開票）" hint="未勾選時顯示為「開票中」。" />
      <div><label className="label" htmlFor="r-src">結果來源</label><input id="r-src" className="field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => run(() => api.put(`/api/admin/results/${county}`, {
          winner_candidate_id: form.winner || null, is_final: form.final, source: form.source || null,
          votes: Object.fromEntries(Object.entries(form.votes).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])),
        }).then(() => q.refetch()), `已儲存 ${s.county.name} 結果`)}>儲存 {s.county.name} 結果</button>
        {existing && <button className="btn-ghost" onClick={() => run(() => api.del(`/api/admin/results/${county}`).then(() => q.refetch()), `已清除 ${s.county.name} 結果`)}>清除此縣市結果</button>}
      </div>
    </div>
  );
}

const CLEAR = [
  { scope: 'demo', label: '清除 DEMO 測試資料', hint: '刪除所有 DEMO 使用者與其選擇、異動紀錄。' },
  { scope: 'votes', label: '清除所有選擇', hint: '刪除全部朋友的看好／支持選擇、異動紀錄與快訊；使用者帳號保留。' },
  { scope: 'news', label: '清除選情快訊', hint: '只刪除快訊紀錄。' },
  { scope: 'results', label: '清除官方開票結果', hint: '刪除所有縣市的官方結果與得票數。' },
] as const;

function DataTab() {
  const qc = useQueryClient();
  const { run, node } = useFlash();
  const [target, setTarget] = useState<(typeof CLEAR)[number] | null>(null);
  const [text, setText] = useState('');
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {node}
      <section>
        <h3 className="mb-2 font-bold">匯出 CSV（UTF-8，可直接以 Excel 開啟）</h3>
        <ul className="space-y-2">
          {[['picks', '所有選擇（含未公開支持度）'], ['tallies', '各縣市候選人統計'], ['users', '使用者清單'], ['candidates', '候選人資料'], ['events', '選擇異動紀錄']].map(([k, l]) => (
            <li key={k}><a className="btn-ghost w-full justify-between" href={`/api/admin/export/${k}.csv`} download>{l}<span className="text-xs text-text-3">{k}.csv</span></a></li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 font-bold">清除資料</h3>
        <ul className="space-y-2">
          {CLEAR.map((c) => (
            <li key={c.scope} className="flex items-center justify-between gap-3 rounded-md border border-rule px-3 py-2">
              <span><b className="text-sm">{c.label}</b><br /><span className="text-xs text-text-3">{c.hint}</span></span>
              <button className="btn-danger shrink-0" onClick={() => { setTarget(c); setText(''); }}>清除</button>
            </li>
          ))}
        </ul>
      </section>
      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.label ?? ''}>
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api.post('/api/admin/clear', { scope: target!.scope, confirm: text }), `${target!.label}：完成`)) { setTarget(null); qc.invalidateQueries(); } }}>
          <p className="text-sm text-text-2">{target?.hint} 此動作無法復原，請輸入 <b className="text-text">DELETE</b> 確認。</p>
          <label className="label" htmlFor="clr">確認文字</label>
          <input id="clr" className="field" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <button className="btn-danger w-full" disabled={text !== 'DELETE'}>{target?.label}</button>
        </form>
      </Modal>
    </div>
  );
}

function AuditTab() {
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api.get<{ id: number; actor: string; action: string; target: string | null; detail: unknown; created_at: string }[]>('/api/admin/audit') });
  if (q.isLoading) return <LoadingPanel />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data!.length) return <EmptyState title="尚無操作紀錄" />;
  return (
    <div className="max-h-[600px] overflow-auto scrollbar-thin">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="sticky top-0 bg-panel"><tr className="border-b border-rule text-left text-xs text-text-3"><th className="py-2 font-bold">時間</th><th className="font-bold">操作者</th><th className="font-bold">動作</th><th className="font-bold">內容</th></tr></thead>
        <tbody>
          {q.data!.map((a) => (
            <tr key={a.id} className="border-b border-rule/60 align-top">
              <td className="whitespace-nowrap py-1.5 text-xs text-text-3">{dateTW(a.created_at)}</td><td className="text-xs">{a.actor}</td>
              <td className="font-bold">{a.action}</td><td className="max-w-[360px] break-all text-xs text-text-3">{a.target} {JSON.stringify(a.detail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Admin() {
  const session = useQuery({ queryKey: ['admin', 'session'], queryFn: () => api.get<{ admin: boolean }>('/api/admin/session') });
  const st = useAppState();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('candidates');
  const logout = useMutation({ mutationFn: () => api.post('/api/admin/logout'), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }) });
  if (session.isLoading || st.isLoading) return <LoadingPanel rows={6} />;
  if (!session.data?.admin) return <Login />;
  if (st.error || !st.ix) return <ErrorState error={st.error} onRetry={() => st.refetch()} />;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-4">
        <h1 className="text-2xl font-black sm:text-3xl">管理後台</h1>
        <button className="btn-ghost" onClick={() => logout.mutate()}>登出管理員</button>
      </header>
      <nav className="flex gap-1 overflow-x-auto scrollbar-thin" role="tablist" aria-label="後台分頁">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-md px-3 py-2 text-sm font-bold ${tab === t.id ? 'bg-electric text-ink' : 'text-text-3 hover:bg-white/5 hover:text-text'}`}>{t.label}</button>
        ))}
      </nav>
      <div className="panel p-4">
        {tab === 'candidates' && <CandidatesTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'picks' && <PicksTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'results' && <ResultsTab />}
        {tab === 'data' && <DataTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}
