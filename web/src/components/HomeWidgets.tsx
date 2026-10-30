import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { candidateColor, partyLabel, TIE, type CountySummary, type Indexed } from '../lib/derive';
import { pct, relTime } from '../lib/format';
import { useActivity } from '../lib/queries';
import { CountUp, DemoBadge, EmptyState, ErrorState, Skeleton } from './ui';

/** All 22 races as compact broadcast "race call" rows. */
export function RaceBoard({ ix, onSelect, selected }: { ix: Indexed; onSelect: (id: string) => void; selected: string | null }) {
  const list = [...ix.summaries.values()];
  return (
    <ol className="divide-y divide-rule">
      {list.map((s) => <RaceRow key={s.county.id} s={s} ix={ix} onSelect={onSelect} active={selected === s.county.id} />)}
    </ol>
  );
}

function RaceRow({ s, ix, onSelect, active }: { s: CountySummary; ix: Indexed; onSelect: (id: string) => void; active: boolean }) {
  const lead = s.leaders.predict;
  const tie = lead.length > 1;
  const color = tie ? TIE : lead[0] ? candidateColor(lead[0], ix.parties) : '#26324D';
  return (
    <li>
      <button onClick={() => onSelect(s.county.id)} className={`group grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.04] ${active ? 'bg-electric/10' : ''}`}>
        <span className="flex items-center gap-2">
          <span className="h-7 w-1 rounded-full" style={{ background: color }} />
          <span className="text-sm font-black">{s.county.name}</span>
        </span>
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-sm font-bold text-text">{tie ? `${lead.map((c) => c.name).join('・')}` : lead[0]?.name ?? <span className="text-text-4">尚無預測</span>}</span>
            {tie && <span className="chip bg-gold/15 text-gold">平手</span>}
            {s.battle === 'tossup' && <span className="chip bg-signal/15 text-signal">膠著</span>}
          </span>
          <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-white/5" aria-hidden>
            {s.predict.filter((r) => r.count).map((r) => (
              <motion.span key={r.candidate.id} className="h-full border-r-2 border-panel last:border-r-0" style={{ background: candidateColor(r.candidate, ix.parties) }} initial={{ width: 0 }} animate={{ width: `${r.share * 100}%` }} transition={{ duration: 0.7 }} />
            ))}
          </span>
        </span>
        <span className="text-right">
          <span className="num block text-lg font-bold leading-none">{s.predict[0]?.count ? pct(s.predict[0].count, s.totals.predict) : '—'}</span>
          <span className="text-2xs text-text-3">{s.participants} 人</span>
        </span>
      </button>
    </li>
  );
}

/** Party distribution of prediction picks — a sum of picks, not a party approval rating. */
export function PartyDistribution({ ix, kind = 'predict' }: { ix: Indexed; kind?: 'predict' | 'support' }) {
  const sums = new Map<string, number>();
  ix.summaries.forEach((s) => s[kind].forEach((r) => {
    const k = r.candidate.party_id ?? 'ind';
    sums.set(k, (sums.get(k) ?? 0) + r.count);
  }));
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const rows = [...sums.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ p: ix.parties.get(id), id, n }));
  if (!total) return <EmptyState title="還沒有任何選擇" body="朋友送出預測後，這裡會顯示各政黨候選人被選擇的次數分布。" />;
  return (
    <div>
      <div className="flex h-5 overflow-hidden rounded" role="img" aria-label={rows.map((r) => `${r.p?.short_name}：${pct(r.n, total, 1)}`).join('，')}>
        {rows.map((r) => (
          <motion.div key={r.id} className="h-full border-r-2 border-panel last:border-r-0" style={{ background: r.p?.color ?? '#8E9AAF' }} title={`${r.p?.name}：${r.n} 次（${pct(r.n, total, 1)}）`}
            initial={{ width: 0 }} animate={{ width: `${(r.n / total) * 100}%` }} transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.p?.color }} />
            <span className="flex-1 truncate text-text-2">{r.p?.short_name ?? r.id}</span>
            <span className="num font-bold">{pct(r.n, total, 1)}</span>
            <span className="w-10 text-right text-xs text-text-3">{r.n} 次</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-4">統計方式：各政黨候選人被{kind === 'predict' ? '看好' : '支持'}的「選擇次數」加總（一人最多 22 次）。不是政黨支持率，也不是以人數計算的獨立支持者比例。</p>
    </div>
  );
}

export function TopCandidates({ ix, limit = 10, onSelect }: { ix: Indexed; limit?: number; onSelect?: (countyId: string) => void }) {
  const all = [...ix.summaries.values()].flatMap((s) => s.predict.map((r) => ({ ...r, county: s.county, total: s.totals.predict })));
  const rows = all.filter((r) => r.count > 0).sort((a, b) => b.count - a.count || b.share - a.share).slice(0, limit);
  if (!rows.length) return <EmptyState title="排行榜還是空的" body="第一位送出預測的朋友，就會出現在這裡。" />;
  const max = rows[0].count;
  return (
    <ol className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.candidate.id}>
          <button className="grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-3 rounded px-1 py-1.5 text-left hover:bg-white/[0.04]" onClick={() => onSelect?.(r.county.id)}>
            <span className={`num text-lg font-bold ${i < 3 ? 'text-gold' : 'text-text-3'}`}>{i + 1}</span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="truncate font-bold">{r.candidate.name}</span>
                <span className="truncate text-xs text-text-3">{r.county.name}・{partyLabel(r.candidate, ix.parties)}</span>
              </span>
              <span className="mt-1 block h-1.5 rounded-full bg-white/5">
                <motion.span className="block h-full rounded-full" style={{ background: candidateColor(r.candidate, ix.parties) }} initial={{ width: 0 }} animate={{ width: `${(r.count / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.03 }} />
              </span>
            </span>
            <span className="text-right">
              <span className="num block text-lg font-bold leading-none">{r.count}<span className="ml-0.5 text-xs text-text-3">人</span></span>
              <span className="text-2xs text-text-3">{pct(r.count, r.total)} 看好</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

const ACTION = { create: '送出了', change: '改變了', cancel: '取消了' };

export function ActivityFeed({ ix }: { ix: Indexed }) {
  const q = useActivity();
  if (q.isLoading) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const ev = q.data!.events;
  if (!ev.length) return <EmptyState title="還沒有動態" body="朋友送出看好預測時，會即時出現在這裡。" />;
  return (
    <ul className="space-y-1">
      {ev.slice(0, 12).map((e) => {
        const county = ix.counties.get(e.county_id)?.name;
        const cand = e.candidate_id ? ix.candidates.get(e.candidate_id) : undefined;
        return (
          <motion.li key={e.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2 rounded px-1 py-1.5 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cand ? candidateColor(cand, ix.parties) : '#56627D' }} />
            <span className="flex-1 text-text-2">
              <b className="text-text">{e.nickname ?? '一位朋友'}</b>{e.is_demo && <> <DemoBadge /></>} {ACTION[e.action]} <b className="text-text">{county}</b> 的看好預測
              {cand && e.action !== 'cancel' && <>：<b style={{ color: candidateColor(cand, ix.parties) }}>{cand.name}</b></>}
            </span>
            <time className="shrink-0 text-xs text-text-4" dateTime={e.created_at}>{relTime(e.created_at)}</time>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function NewsList({ ix }: { ix: Indexed }) {
  const q = useActivity();
  const news = q.data?.news ?? [];
  if (q.isLoading) return <Skeleton className="h-24" />;
  if (!news.length) return <EmptyState title="目前沒有選情快訊" body="當某縣市看好度排名出現變動，會在這裡與頁面頂端即時通知。" />;
  return (
    <ul className="space-y-2">
      {news.slice(0, 6).map((n) => (
        <li key={n.id} className="border-l-2 border-signal pl-3">
          <Link to={`/?county=${n.county_id}`} className="block text-sm font-bold text-text hover:text-electric-glow">{n.message}</Link>
          <span className="text-xs text-text-4">{relTime(n.created_at)}{n.county_id && ` · ${ix.counties.get(n.county_id)?.name}`}</span>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="border-l border-rule px-4 py-1 first:border-l-0 first:pl-0">
      <p className="text-xs font-bold text-text-3">{label}</p>
      {typeof value === 'number' ? <CountUp value={value} className="num block text-4xl font-bold leading-tight" /> : <p className="truncate text-2xl font-black leading-tight sm:text-3xl" style={{ color: accent }}>{value}</p>}
      {sub && <p className="truncate text-xs text-text-3">{sub}</p>}
    </div>
  );
}
