import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { candidateColor, partyLabel } from '../lib/derive';
import { pct } from '../lib/format';
import { useAppState, useResults } from '../lib/queries';
import { DemoBadge, EmptyState, ErrorState, LoadingPanel } from '../components/ui';

/** 11/28 開票特別模式：朋友預測（左）與官方結果（右）分欄呈現，並計算預測命中率。 */
export default function Results() {
  const st = useAppState();
  const rs = useResults();
  if (st.error || rs.error) return <ErrorState error={st.error ?? rs.error} onRetry={() => { st.refetch(); rs.refetch(); }} />;
  if (!st.ix || !rs.data || !st.data) return <LoadingPanel rows={10} />;
  const ix = st.ix;
  const r = rs.data;
  const winners = new Map(r.results.map((x) => [x.county_id, x]));
  const votes = new Map(r.votes.map((v) => [v.candidate_id, v.votes]));
  let groupHits = 0, groupScored = 0;
  ix.summaries.forEach((s) => {
    const w = winners.get(s.county.id)?.winner_candidate_id;
    if (!w || !s.leaders.predict.length) return;
    groupScored++;
    if (s.leaders.predict.length === 1 && s.leaders.predict[0].id === w) groupHits++;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gold/40 pb-5">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-gold"><span className="h-2 w-2 animate-pulseDot rounded-full bg-gold" />ELECTION NIGHT・11/28 開票特別模式</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">朋友預測 vs 官方開票</h1>
          <p className="mt-2 max-w-3xl text-sm text-text-3">
            左欄是朋友的看好度（預測），右欄是管理員依中央選舉委員會公告輸入的官方結果，兩者分開呈現。官方結果尚未輸入的縣市不計分。
            {!r.election_mode_active && ' 目前尚未到投票日，此頁可預覽。'}
          </p>
        </div>
        <dl className="flex gap-6">
          <div><dt className="text-xs font-bold text-text-3">已公布縣市</dt><dd className="num text-4xl font-bold">{r.decided}<span className="text-xl text-text-3"> / 22</span></dd></div>
          <div><dt className="text-xs font-bold text-text-3">朋友圈集體命中</dt><dd className="num text-4xl font-bold text-gold">{groupHits}<span className="text-xl text-text-3"> / {groupScored}</span></dd></div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="panel">
          <div className="grid grid-cols-[5rem_1fr_1fr_3rem] gap-3 border-b border-rule px-4 py-2 text-xs font-bold text-text-3">
            <span>縣市</span><span className="text-electric-glow">朋友預測（看好度第一）</span><span className="text-gold">官方結果</span><span className="text-right">命中</span>
          </div>
          <ul className="divide-y divide-rule">
            {[...ix.summaries.values()].map((s, i) => {
              const res = winners.get(s.county.id);
              const w = res?.winner_candidate_id ? ix.candidates.get(res.winner_candidate_id) : undefined;
              const lead = s.leaders.predict;
              const hit = w && lead.length === 1 && lead[0].id === w.id;
              const totalVotes = s.candidates.reduce((a, c) => a + (votes.get(c.id) ?? 0), 0);
              return (
                <motion.li key={s.county.id} className="grid grid-cols-[5rem_1fr_1fr_3rem] items-center gap-3 px-4 py-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                  <span className="font-black">{s.county.name}</span>
                  <span className="min-w-0 text-sm">
                    {lead.length ? <><b style={{ color: candidateColor(lead[0], ix.parties) }}>{lead.map((c) => c.name).join('・')}</b> <span className="text-xs text-text-3">{pct(s.predict[0].count, s.totals.predict)}{lead.length > 1 && '（平手）'}</span></> : <span className="text-text-4">無預測</span>}
                  </span>
                  <span className="min-w-0 text-sm">
                    {w ? (
                      <>
                        <b style={{ color: candidateColor(w, ix.parties) }}>{w.name}</b> <span className="text-xs text-text-3">{partyLabel(w, ix.parties)}{totalVotes > 0 && `・得票 ${pct(votes.get(w.id) ?? 0, totalVotes, 2)}`}</span>
                        {!res?.is_final && <span className="chip ml-1 bg-gold/15 text-gold">開票中</span>}
                      </>
                    ) : <span className="text-text-4">尚未公布</span>}
                  </span>
                  <span className="text-right text-lg">{w && lead.length ? (hit ? <span className="text-emerald-400" aria-label="命中">✓</span> : <span className="text-signal" aria-label="未命中">✕</span>) : ''}</span>
                </motion.li>
              );
            })}
          </ul>
        </section>

        <section className="panel self-start">
          <div className="panel-head"><h2 className="panel-title">朋友預測排行榜</h2></div>
          <div className="p-4">
            {r.decided === 0 ? <EmptyState title="官方結果尚未輸入" body="管理員輸入各縣市當選人後，系統會自動計算每位朋友命中幾個縣市。" /> : !r.leaderboard.length ? <EmptyState title="尚無公開的預測者" /> : (
              <ol className="space-y-2">
                {r.leaderboard.map((u, i) => (
                  <li key={i} className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded px-2 py-1.5 ${u.is_me ? 'bg-electric/10' : ''}`}>
                    <span className={`num text-lg font-bold ${i < 3 ? 'text-gold' : 'text-text-3'}`}>{i + 1}</span>
                    <span className="truncate font-bold">{u.nickname}{u.is_me && '（你）'} {u.is_demo && <DemoBadge />}</span>
                    <span className="text-right"><span className="num text-xl font-bold">{u.hits}</span><span className="text-sm text-text-3"> / {u.scored}</span><span className="block text-2xs text-text-4">命中縣市</span></span>
                  </li>
                ))}
              </ol>
            )}
            {r.hidden_count > 0 && <p className="mt-3 text-xs text-text-4">另有 {r.hidden_count} 位朋友未公開預測，不列入公開排行。</p>}
            <p className="mt-3 text-xs text-text-4">計分：只計已公布官方結果、且該朋友有預測的縣市。<Link to="/me" className="text-electric-glow">查看我的預測</Link></p>
          </div>
        </section>
      </div>
    </div>
  );
}
