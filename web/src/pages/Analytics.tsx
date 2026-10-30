import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import { ChartPanel, ChartTooltip, AXIS, GRID } from '../components/ChartKit';
import { PartyDistribution } from '../components/HomeWidgets';
import { DemoBadge, EmptyState, ErrorState, LoadingPanel } from '../components/ui';
import { candidateColor, partyLabel, type Indexed } from '../lib/derive';
import { pct } from '../lib/format';
import { useAnalytics, useAppState } from '../lib/queries';
import type { AnalyticsResp, AppState } from '../lib/types';

function Ranking({ ix, anim }: { ix: Indexed; anim: boolean }) {
  const rows = [...ix.summaries.values()].flatMap((s) => s.predict.filter((r) => r.count > 0).map((r) => ({
    name: `${r.candidate.name}`, county: s.county.name, party: partyLabel(r.candidate, ix.parties), count: r.count, share: pct(r.count, s.totals.predict), color: candidateColor(r.candidate, ix.parties),
  }))).sort((a, b) => b.count - a.count).slice(0, 15);
  if (!rows.length) return <EmptyState title="尚無預測資料" body="朋友送出看好預測後，排行榜會依看好人數排列。" />;
  return (
    <div style={{ height: rows.length * 30 + 30 }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }} barCategoryGap={6}>
          <CartesianGrid {...GRID} horizontal={false} vertical />
          <XAxis type="number" allowDecimals={false} {...AXIS} />
          <YAxis type="category" dataKey="name" width={96} {...AXIS} tick={{ fill: '#E9EEF8', fontSize: 12, fontWeight: 700 }} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit=" 人" title={(p) => { const d = p[0].payload as { name: string; county: string; party: string; share: string }; return `${d.name}・${d.county}・${d.party}（縣市內看好度 ${d.share}）`; }} />} />
          <Bar dataKey="count" name="看好人數" radius={[0, 4, 4, 0]} isAnimationActive={anim} label={{ position: 'right', fill: '#B5C0D6', fontSize: 12 }}>
            {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CountyDistribution({ ix }: { ix: Indexed }) {
  return (
    <ul className="space-y-2">
      {[...ix.summaries.values()].map((s) => (
        <li key={s.county.id} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
          <span className="text-sm font-bold">{s.county.name}</span>
          {s.totals.predict ? (
            <span className="flex h-6 overflow-hidden rounded">
              {s.predict.filter((r) => r.count).map((r) => (
                <span key={r.candidate.id} className="group relative flex h-full items-center justify-center border-r-2 border-panel text-2xs font-bold text-ink last:border-r-0"
                  style={{ width: `${r.share * 100}%`, background: candidateColor(r.candidate, ix.parties) }} tabIndex={0}
                  aria-label={`${r.candidate.name} ${r.count} 人 ${pct(r.count, s.totals.predict)}`}>
                  {r.share > 0.18 && <span className="truncate px-1">{r.candidate.name}</span>}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-rule-strong bg-ink px-2 py-1 text-xs text-text group-hover:block group-focus:block">
                    {r.candidate.name}：{r.count} 人・{pct(r.count, s.totals.predict, 1)}
                  </span>
                </span>
              ))}
            </span>
          ) : <span className="h-6 rounded border border-dashed border-rule-strong px-2 text-xs leading-6 text-text-4">尚無預測</span>}
          <span className="num text-right text-sm text-text-3">{s.totals.predict}</span>
        </li>
      ))}
    </ul>
  );
}

function PartyCompare({ ix, anim }: { ix: Indexed; anim: boolean }) {
  const sums = new Map<string, { predict: number; support: number }>();
  ix.summaries.forEach((s) => (['predict', 'support'] as const).forEach((k) => s[k].forEach((r) => {
    const id = r.candidate.party_id ?? 'ind';
    const o = sums.get(id) ?? { predict: 0, support: 0 };
    o[k] += r.count;
    sums.set(id, o);
  })));
  const rows = [...sums.entries()].filter(([, v]) => v.predict + v.support > 0).sort((a, b) => b[1].predict - a[1].predict)
    .map(([id, v]) => ({ name: ix.parties.get(id)?.short_name ?? id, color: ix.parties.get(id)?.color ?? '#8E9AAF', ...v }));
  if (!rows.length) return <EmptyState title="尚無資料" />;
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ left: -16, right: 8, top: 16 }} barGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fill: '#B5C0D6', fontSize: 11 }} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit=" 次" />} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#B5C0D6' }} />
          <Bar dataKey="predict" name="看好（次）" fill="#3AA0FF" radius={[4, 4, 0, 0]} isAnimationActive={anim} label={{ position: 'top', fill: '#B5C0D6', fontSize: 11 }} />
          <Bar dataKey="support" name="支持（次）" fill="#E6B84C" radius={[4, 4, 0, 0]} isAnimationActive={anim} label={{ position: 'top', fill: '#B5C0D6', fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Participation({ state, ix, an, anim }: { state: AppState; ix: Indexed; an: AnalyticsResp; anim: boolean }) {
  const rows = [...ix.summaries.values()].map((s) => ({ name: s.county.name.replace(/[縣市]$/, ''), full: s.county.name, value: s.participants }));
  const avg = state.totals.participants ? (state.totals.predictions / state.totals.participants).toFixed(1) : '—';
  const empty = [...ix.summaries.values()].filter((s) => s.totals.predict === 0);
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['總參與人數', state.totals.participants],
          ['平均每人預測縣市', avg],
          ['尚無預測縣市', `${empty.length} / 22`],
          ['近 7 日新增選擇', an.trend.daily.slice(-7).reduce((a, d) => a + d.predict + d.support, 0)],
        ].map(([k, v]) => (
          <div key={k as string}><dt className="text-xs font-bold text-text-3">{k}</dt><dd className="num text-3xl font-bold">{v}</dd></div>
        ))}
      </dl>
      {empty.length > 0 && <p className="text-sm text-text-3">尚未有人預測：<span className="text-text-2">{empty.map((s) => s.county.name).join('、')}</span></p>}
      <div>
        <p className="mb-2 text-xs font-bold text-text-3">各縣市參與人數（看好或支持任一）</p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ left: -20, right: 4, top: 14 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={0} tick={{ fill: '#7E8BA6', fontSize: 10 }} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit=" 人" title={(p) => String((p[0].payload as { full: string }).full)} />} />
              <Bar dataKey="value" name="參與人數" fill="#3AA0FF" radius={[4, 4, 0, 0]} isAnimationActive={anim} label={{ position: 'top', fill: '#7E8BA6', fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-text-3">每日新增選擇數（台灣時間）</p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={an.trend.daily.map((d) => ({ ...d, day: d.day.slice(5) }))} margin={{ left: -20, right: 4, top: 8 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip unit=" 筆" />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="predict" stackId="a" name="新增看好" fill="#3AA0FF" isAnimationActive={anim} />
              <Bar dataKey="support" stackId="a" name="新增支持" fill="#E6B84C" isAnimationActive={anim} />
              <Bar dataKey="changes" stackId="a" name="修改" fill="#7E8BA6" radius={[4, 4, 0, 0]} isAnimationActive={anim} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Trend({ ix, an, anim }: { ix: Indexed; an: AnalyticsResp; anim: boolean }) {
  const [county, setCounty] = useState<string>('all');
  const ids = useMemo(() => {
    const latest = (id: string) => an.trend.series[id]?.at(-1) ?? 0;
    const pool = county === 'all' ? Object.keys(an.trend.series) : ix.summaries.get(county)?.candidates.map((c) => c.id) ?? [];
    return pool.filter((id) => ix.candidates.has(id) && latest(id) > 0).sort((a, b) => latest(b) - latest(a)).slice(0, 6);
  }, [an, ix, county]);
  const data = an.trend.days.map((d, i) => ({ day: d.slice(5), ...Object.fromEntries(ids.map((id) => [id, an.trend.series[id]?.[i] ?? 0])) }));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <label htmlFor="trend-county" className="text-xs font-bold text-text-3">範圍</label>
        <select id="trend-county" className="field w-auto py-1.5" value={county} onChange={(e) => setCounty(e.target.value)}>
          <option value="all">全台前 6 名</option>
          {[...ix.summaries.values()].map((s) => <option key={s.county.id} value={s.county.id}>{s.county.name}</option>)}
        </select>
      </div>
      {!ids.length ? <EmptyState title="尚無趨勢資料" body="有朋友送出預測後，這裡會顯示每日累積看好人數的變化。" /> : (
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: -20, right: 12, top: 8 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="day" {...AXIS} />
              <YAxis allowDecimals={false} {...AXIS} />
              <Tooltip content={<ChartTooltip unit=" 人" />} cursor={{ stroke: '#2A3B60' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {ids.map((id, i) => {
                const c = ix.candidates.get(id)!;
                const color = candidateColor(c, ix.parties);
                // Same-party candidates share a colour, so repeat colours get a distinct dash pattern
                const repeat = ids.slice(0, i).filter((o) => candidateColor(ix.candidates.get(o), ix.parties) === color).length;
                return <Line key={id} dataKey={id} name={`${c.name}（${ix.counties.get(c.county_id)?.name.slice(0, 2)}）`} stroke={color} strokeWidth={2} strokeDasharray={['', '6 4', '2 3', '10 3 2 3'][repeat % 4]} dot={false} activeDot={{ r: 4 }} isAnimationActive={anim} type="monotone" />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Consistency({ an }: { an: AnalyticsResp }) {
  const c = an.consistency;
  const heat = (r: number) => `rgba(58,160,255,${0.08 + r * 0.82})`;
  return (
    <div>
      <p className="mb-3 text-sm text-text-2">
        全體朋友兩兩比較，在共同預測的縣市中選了相同候選人的比例：
        <b className="num ml-1 text-2xl text-text">{c.overall.rate == null ? '—' : pct(c.overall.pairs_same, c.overall.pairs_common, 1)}</b>
        <span className="ml-1 text-xs text-text-3">（{c.overall.users} 位朋友，匿名彙總）</span>
      </p>
      {!c.allow_view_others ? <p className="text-sm text-gold">管理員已關閉「查看其他人的選擇」，個別比較矩陣不顯示。</p>
        : c.users.length < 2 ? <EmptyState title="需要至少兩位公開預測的朋友" body="開啟「公開我的看好預測」的朋友才會出現在一致性矩陣中。" /> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="border-separate border-spacing-[2px] text-2xs">
              <thead>
                <tr><th />{c.users.map((u) => <th key={u.id} className="h-20 align-bottom font-bold text-text-3"><span className="inline-block max-w-[1.25rem] [writing-mode:vertical-rl]">{u.nickname.replace(/^DEMO-/, '')}</span></th>)}</tr>
              </thead>
              <tbody>
                {c.users.map((u, i) => (
                  <tr key={u.id}>
                    <th className="whitespace-nowrap pr-2 text-right font-bold text-text-2">{u.nickname.replace(/^DEMO-/, '')}{u.is_demo && <span className="ml-1 text-gold">D</span>}</th>
                    {c.matrix[i].map((cell, j) => {
                      const r = cell.common ? cell.same / cell.common : 0;
                      return (
                        <td key={j} className="h-6 w-6 min-w-6 rounded-sm text-center num text-xs text-white" style={{ background: i === j ? '#17264A' : cell.common ? heat(r) : 'transparent' }}
                          title={i === j ? `${u.nickname}：預測 ${u.picks} 縣市` : `${u.nickname} × ${c.users[j].nickname}：共同預測 ${cell.common} 縣市，相同 ${cell.same} 個（${pct(cell.same, cell.common)}）`}>
                          {i === j ? '' : cell.common ? cell.same : '·'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-text-4">格內數字＝選了相同候選人的縣市數；顏色越亮＝一致率越高。滑過格子看詳細。{c.users.some((u) => u.is_demo) && <> 標 <span className="text-gold">D</span> 者為 DEMO 測試資料。</>}{c.hidden_users > 0 && ` 另有 ${c.hidden_users} 位朋友未公開預測，只計入整體比例。`}</p>
          </div>
        )}
    </div>
  );
}

function Cross({ ix }: { ix: Indexed }) {
  const rows = [...ix.summaries.values()].filter((s) => s.totals.predict || s.totals.support);
  const same = rows.filter((s) => s.cross === 'same').length;
  const diff = rows.filter((s) => s.cross === 'diff').length;
  if (!rows.length) return <EmptyState title="尚無資料" />;
  return (
    <div>
      <p className="mb-3 text-sm text-text-2">
        朋友圈最看好的人，就是朋友圈最支持的人嗎？在可比較的縣市中，<b className="text-electric-glow">{same}</b> 個一致、<b className="text-signal">{diff}</b> 個不一致。
      </p>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-rule text-left text-xs text-text-3"><th className="py-2 font-bold">縣市</th><th className="font-bold">最被看好（會當選）</th><th className="font-bold">最被支持（希望當選）</th><th className="text-right font-bold">結果</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.county.id} className="border-b border-rule/60">
                <td className="py-2 font-bold">{s.county.name}</td>
                <td>{s.leaders.predict.length ? s.leaders.predict.map((c) => c.name).join('・') : '—'} <span className="text-xs text-text-3">{s.predict[0]?.count ? pct(s.predict[0].count, s.totals.predict) : ''}</span></td>
                <td>{s.leaders.support.length ? s.leaders.support.map((c) => c.name).join('・') : '—'} <span className="text-xs text-text-3">{s.support[0]?.count ? pct(s.support[0].count, s.totals.support) : ''}</span></td>
                <td className="text-right">{s.cross === 'same' ? <span className="chip bg-electric/15 text-electric-glow">一致</span> : s.cross === 'diff' ? <span className="chip bg-signal/15 text-signal">不一致</span> : <span className="text-xs text-text-4">資料不足</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Analytics() {
  const st = useAppState();
  const an = useAnalytics();
  const anim = !useReducedMotion();
  if (st.error || an.error) return <ErrorState error={st.error ?? an.error} onRetry={() => { st.refetch(); an.refetch(); }} />;
  if (!st.ix || !st.data || !an.data) return <div className="grid gap-6 lg:grid-cols-2"><LoadingPanel rows={8} /><LoadingPanel rows={8} /><LoadingPanel rows={5} /><LoadingPanel rows={5} /></div>;
  const ix = st.ix;
  return (
    <div className="space-y-6">
      <header className="border-b border-rule pb-5">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">數據分析中心</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-3">
          所有圖表皆來自本站資料庫中朋友的實際選擇；沒有資料的圖表會顯示為空，不以假資料填充。{st.data.totals.demo_members > 0 && <> 目前資料包含 <DemoBadge /> 測試資料，管理員可一鍵清除。</>}
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="全台候選人排行榜" note="依「看好當選」人數排序，前 15 名。"><Ranking ix={ix} anim={anim} /></ChartPanel>
        <ChartPanel title="縣市看好度分布" note="每列為一個縣市，色塊寬度＝該候選人的看好度比例；右側為該縣市看好選擇總數。"><CountyDistribution ix={ix} /></ChartPanel>
        <ChartPanel title="政黨看好度分布"><PartyDistribution ix={ix} /></ChartPanel>
        <ChartPanel title="政黨：看好 vs 支持" note="兩者皆為「選擇次數」加總，不是政黨支持率。"><PartyCompare ix={ix} anim={anim} /></ChartPanel>
        <ChartPanel title="參與度分析" className="lg:col-span-2"><Participation state={st.data} ix={ix} an={an.data} anim={anim} /></ChartPanel>
        <ChartPanel title="看好度趨勢變化" note="每日結束時的累積看好人數（依選擇異動紀錄重建）。"><Trend ix={ix} an={an.data} anim={anim} /></ChartPanel>
        <ChartPanel title="朋友預測一致性"><Consistency an={an.data} /></ChartPanel>
        <ChartPanel title="交叉分析：看好度 × 支持度" className="lg:col-span-2" note="支持度只以匿名彙總呈現，不會揭露任何個人的支持對象。"><Cross ix={ix} /></ChartPanel>
      </div>
    </div>
  );
}
