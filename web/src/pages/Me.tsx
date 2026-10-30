import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { candidateColor, partyLabel } from '../lib/derive';
import { dateTW } from '../lib/format';
import { useAppState, useMeMutation, usePickMutation } from '../lib/queries';
import { RecoveryCodeBox, useSession } from '../components/Session';
import { EmptyState, ErrorState, LoadingPanel, Modal, Toggle } from '../components/ui';
import type { Kind } from '../lib/types';

export default function MePage() {
  const { me, loading, openJoin } = useSession();
  const st = useAppState();
  const upd = useMeMutation();
  const pick = usePickMutation();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [nick, setNick] = useState<string | null>(null);

  if (loading || st.isLoading) return <LoadingPanel rows={6} />;
  if (st.error) return <ErrorState error={st.error} onRetry={() => st.refetch()} />;
  if (!me?.user) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <EmptyState title="你還沒有加入觀測站" body={me?.banned ? '此帳號已被管理員停用。' : '用暱稱加入後，就能對 22 個縣市送出你的看好與支持；已加入過的朋友可用找回碼登入。'}
          action={<button className="btn-primary mt-2" onClick={openJoin}>加入或找回身份</button>} />
      </div>
    );
  }
  const ix = st.ix!;
  const user = me.user;
  const pickOf = (county: string, kind: Kind) => me.picks.find((p) => p.county_id === county && p.kind === kind);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); } catch (e) { setErr(e instanceof ApiError ? e.message : '操作失敗'); } };
  const predicted = me.picks.filter((p) => p.kind === 'predict').length;
  const supported = me.picks.filter((p) => p.kind === 'support').length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <p className="text-sm font-bold text-text-3">我的選擇紀錄</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{user.nickname}</h1>
          <p className="mt-1 text-sm text-text-3">加入於 {dateTW(user.created_at)}・已看好 {predicted} / 22 縣市・已表態支持 {supported} / 22 縣市</p>
        </div>
        <Link to="/" className="btn-primary">回地圖繼續預測</Link>
      </header>
      {err && <p className="rounded-md border border-signal/40 bg-signal/10 px-3 py-2 text-sm font-bold text-signal" role="alert">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel">
          <div className="panel-head"><h2 className="panel-title">22 縣市選擇</h2><span className="text-xs text-text-3">未選擇的縣市保持空白即可</span></div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-rule text-left text-xs text-text-3"><th className="px-4 py-2 font-bold">縣市</th><th className="font-bold text-electric-glow">我看好誰當選</th><th className="font-bold text-gold">我希望誰當選</th></tr></thead>
              <tbody>
                {[...ix.summaries.values()].map((s) => (
                  <tr key={s.county.id} className="border-b border-rule/60">
                    <td className="px-4 py-2"><Link to={`/?county=${s.county.id}`} className="font-bold hover:text-electric-glow">{s.county.name}</Link></td>
                    {(['predict', 'support'] as const).map((k) => {
                      const p = pickOf(s.county.id, k);
                      const c = p ? ix.candidates.get(p.candidate_id) : undefined;
                      return (
                        <td key={k} className="py-2 pr-3">
                          {c ? (
                            <span className="flex items-center gap-2">
                              <span className="h-3 w-1 rounded-full" style={{ background: candidateColor(c, ix.parties) }} />
                              <span className="font-bold">{c.name}</span>
                              <span className="text-xs text-text-3">{partyLabel(c, ix.parties)}</span>
                              <button className="ml-auto rounded px-2 py-1 text-xs text-text-3 hover:bg-white/5 hover:text-signal" disabled={pick.isPending}
                                onClick={() => run(() => pick.mutateAsync({ county_id: s.county.id, kind: k, candidate_id: null }))} aria-label={`取消 ${s.county.name} 的${k === 'predict' ? '看好' : '支持'}選擇`}>取消</button>
                            </span>
                          ) : <Link to={`/?county=${s.county.id}`} className="text-xs text-text-4 hover:text-electric-glow">未選擇・前往選擇</Link>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">隱私設定</h2></div>
            <div className="space-y-4 p-4">
              <Toggle checked={user.show_predictions} disabled={upd.isPending} onChange={(v) => run(() => upd.mutateAsync({ show_predictions: v }))}
                label="公開我的「看好誰當選」" hint="開啟：暱稱出現在支持者名單、動態與一致性分析。關閉：只計入人數。" />
              <Toggle checked={user.show_support} disabled={upd.isPending} onChange={(v) => run(() => upd.mutateAsync({ show_support: v }))}
                label="公開我的「希望誰當選」" hint="涉及個人政治偏好，預設關閉。關閉時只以匿名人數計入統計，永遠不會出現在動態中。" />
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h2 className="panel-title">暱稱與身份</h2></div>
            <div className="space-y-4 p-4">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nick?.trim()) run(async () => { await upd.mutateAsync({ nickname: nick }); setNick(null); }); }}>
                <label className="sr-only" htmlFor="rename">新暱稱</label>
                <input id="rename" className="field" value={nick ?? user.nickname} maxLength={24} onChange={(e) => setNick(e.target.value)} />
                <button className="btn-ghost shrink-0" disabled={!nick || nick === user.nickname}>更改暱稱</button>
              </form>
              {code ? <RecoveryCodeBox code={code} /> : (
                <div>
                  <button className="btn-ghost w-full" onClick={() => run(async () => setCode((await api.post<{ recovery_code: string }>('/api/me/recovery')).recovery_code))}>產生新的找回碼</button>
                  <p className="mt-1 text-xs text-text-4">產生後舊的找回碼立即失效。</p>
                </div>
              )}
              <button className="btn-ghost w-full" onClick={() => run(async () => { await api.post('/api/me/logout'); qc.clear(); nav('/'); })}>在這台裝置登出</button>
              <p className="text-xs text-text-4">登出不會刪除資料；之後需要「暱稱 + 找回碼」才能再登入。</p>
            </div>
          </section>
          <section className="panel border-signal/30">
            <div className="panel-head"><h2 className="panel-title">退出並刪除資料</h2></div>
            <div className="p-4">
              <p className="mb-3 text-sm text-text-3">永久刪除你的暱稱、所有看好與支持選擇，以及相關異動紀錄。統計會即時重算。</p>
              <button className="btn-danger w-full" onClick={() => setConfirmDelete(true)}>刪除我的所有資料</button>
            </div>
          </section>
        </aside>
      </div>

      <Modal open={confirmDelete} onClose={() => { setConfirmDelete(false); setConfirmText(''); }} title={`刪除「${user.nickname}」的所有資料`}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(async () => { await api.del('/api/me'); qc.clear(); nav('/'); }); }}>
          <p className="text-sm text-text-2">此動作無法復原。請輸入你的暱稱 <b className="text-text">{user.nickname}</b> 以確認。</p>
          <label className="label" htmlFor="confirm-del">暱稱</label>
          <input id="confirm-del" className="field" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          <button className="btn-danger w-full" disabled={confirmText !== user.nickname}>永久刪除 {user.nickname} 的資料</button>
        </form>
      </Modal>
    </div>
  );
}
