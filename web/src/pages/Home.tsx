import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CountyPanel } from '../components/CountyPanel';
import { Countdown } from '../components/Countdown';
import { ActivityFeed, Kpi, NewsList, PartyDistribution, RaceBoard, TopCandidates } from '../components/HomeWidgets';
import { MapLegend, TaiwanMap } from '../components/TaiwanMap';
import { useSession } from '../components/Session';
import { ErrorState, Skeleton } from '../components/ui';
import { candidateColor, MAP_MODES, partyLabel, type MapMode } from '../lib/derive';
import { useAppState } from '../lib/queries';

export default function Home() {
  const { data, ix, isLoading, error, refetch } = useAppState();
  const { me, openJoin } = useSession();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<MapMode>('leader');
  const selected = params.get('county');
  const select = useCallback((id: string) => setParams({ county: id }, { replace: false }), [setParams]);
  const close = useCallback(() => setParams({}, { replace: false }), [setParams]);
  const serverOffset = useMemo(() => (data ? new Date(data.server_time).getTime() - Date.now() : 0), [data]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data || !ix) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]" role="status" aria-label="載入選情資料中">
        <Skeleton className="h-40 lg:col-span-2" />
        <Skeleton className="h-[640px]" />
        <Skeleton className="h-[640px]" />
      </div>
    );
  }

  const top = [...ix.summaries.values()].flatMap((s) => s.predict.map((r) => ({ ...r, county: s.county }))).filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  const topTie = top.length > 1 && top[0].count === top[1].count;
  const myCount = new Set(me?.picks.filter((p) => p.kind === 'predict').map((p) => p.county_id)).size;
  const modeInfo = MAP_MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-6">
      {data.settings.election_mode_active && (
        <Link to="/results" className="flex items-center justify-between gap-3 rounded-lg border border-gold/50 bg-gold/10 px-4 py-3 hover:bg-gold/15">
          <span className="font-bold text-gold">11/28 開票特別模式已啟動：比較朋友預測與官方開票結果</span>
          <span className="font-bold text-gold">前往 ›</span>
        </Link>
      )}

      <section className="grid items-end gap-6 border-b border-rule pb-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-text-3">
            <span className="h-2 w-2 animate-pulseDot rounded-full bg-signal" />2026 九合一地方選舉・縣市長
          </p>
          <h1 className="text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl">看看我們這群人，<br className="hidden sm:block" />究竟看好誰？</h1>
          <p className="mt-3 max-w-xl text-sm text-text-3">朋友之間的縣市長看好度觀測。這裡的數字是朋友的預測與期望，不是民調，也不是選舉結果。</p>
        </div>
        <div className="lg:justify-self-end">
          <p className="mb-2 text-sm font-bold text-text-3">距離 11 月 28 日投票（08:00 開始）</p>
          <Countdown serverOffset={serverOffset} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-y-4 lg:grid-cols-4" aria-label="全台概況">
        <Kpi label="參與朋友" value={data.totals.participants} sub={`共 ${data.totals.members} 位成員${data.totals.demo_members ? `（含 ${data.totals.demo_members} 位 DEMO）` : ''}`} />
        <Kpi label="全台有效預測數" value={data.totals.predictions} sub={`另有 ${data.totals.supports} 筆支持度選擇`} />
        <Kpi label="最受看好候選人" value={top[0] ? (topTie ? '並列第一' : top[0].candidate.name) : '—'}
          accent={top[0] && !topTie ? candidateColor(top[0].candidate, ix.parties) : undefined}
          sub={top[0] ? (topTie ? top.filter((r) => r.count === top[0].count).map((r) => r.candidate.name).join('、') : `${top[0].county.name}・${partyLabel(top[0].candidate, ix.parties)}・${top[0].count} 人看好`) : '尚無預測'} />
        <div className="border-l border-rule px-4 py-1">
          <p className="text-xs font-bold text-text-3">我的進度</p>
          {me?.user ? (
            <>
              <p className="num text-4xl font-bold leading-tight">{myCount}<span className="text-xl text-text-3"> / 22</span></p>
              <p className="text-xs text-text-3">已預測縣市・<Link className="text-electric-glow" to="/me">查看紀錄</Link></p>
            </>
          ) : (
            <button className="btn-primary mt-2" onClick={openJoin}>以暱稱加入預測</button>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="panel">
          <div className="panel-head flex-wrap">
            <h2 className="panel-title">全台縣市地圖</h2>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="地圖模式">
              {MAP_MODES.map((m) => (
                <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} title={m.hint}
                  className={`relative rounded px-2.5 py-1.5 text-xs font-bold transition-colors ${mode === m.id ? 'text-ink' : 'text-text-3 hover:text-text'}`}>
                  {mode === m.id && <motion.span layoutId="mapmode" className="absolute inset-0 rounded bg-electric" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[minmax(0,1fr)_200px]">
            <TaiwanMap ix={ix} mode={mode} selected={selected} onSelect={select} />
            <div className="space-y-4 border-t border-rule pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
              <div>
                <p className="text-sm font-bold text-text">{modeInfo.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-3">{modeInfo.hint}。</p>
              </div>
              <MapLegend ix={ix} mode={mode} />
              <p className="text-xs leading-relaxed text-text-4">滑鼠移到縣市看摘要，點擊或按 Enter 進入選舉面板。滾輪或右上按鈕可縮放，放大後可拖曳。</p>
            </div>
          </div>
        </div>
        <div className="panel flex flex-col">
          <div className="panel-head">
            <h2 className="panel-title">22 縣市戰況板</h2>
            <span className="text-xs text-text-3">領先者・看好度</span>
          </div>
          <div className="max-h-[820px] flex-1 overflow-y-auto scrollbar-thin">
            <RaceBoard ix={ix} onSelect={select} selected={selected} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="panel-head"><h2 className="panel-title">各政黨看好度分布</h2><Link to="/analytics" className="text-xs font-bold text-electric-glow">完整分析 ›</Link></div>
          <div className="p-4"><PartyDistribution ix={ix} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">選情快訊</h2></div>
          <div className="p-4"><NewsList ix={ix} /></div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">全台熱門候選人</h2><span className="text-xs text-text-3">依看好人數</span></div>
          <div className="p-3"><TopCandidates ix={ix} onSelect={select} /></div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2 className="panel-title">最新投票動態</h2><span className="text-xs text-text-3">只顯示看好預測；支持度永不公開動態</span></div>
          <div className="max-h-[520px] overflow-y-auto p-3 scrollbar-thin"><ActivityFeed ix={ix} /></div>
        </div>
      </section>

      <CountyPanel countyId={selected} ix={ix} settings={data.settings} onClose={close} />
    </div>
  );
}
