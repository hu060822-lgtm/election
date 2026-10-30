import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection } from 'topojson-specification';
import topo from 'taiwan-atlas/counties-10t.json';
import { BATTLE_LABEL, candidateColor, countyFill, NODATA, TIE, type Indexed, type MapMode } from '../lib/derive';
import { pct } from '../lib/format';

type Props = { COUNTYCODE: string; COUNTYNAME: string };
const fc = feature(topo, topo.objects.counties as GeometryCollection<Props>) as FeatureCollection<Geometry, Props>;
const INSET_IDS = ['09007', '09020'] as const; // 連江縣, 金門縣
const W = 500, H = 700;

const mainFc: FeatureCollection<Geometry, Props> = { type: 'FeatureCollection', features: fc.features.filter((f) => !INSET_IDS.includes(f.properties.COUNTYCODE as never)) };
const mainProj = geoMercator().fitExtent([[96, 10], [W - 6, H - 8]], mainFc);
const INSETS = [
  { id: '09007', box: [4, 12, 112, 132] as const, label: '連江縣（馬祖）' },
  { id: '09020', box: [4, 156, 112, 96] as const, label: '金門縣' },
].map((i) => {
  const f = fc.features.find((x) => x.properties.COUNTYCODE === i.id)!;
  const [x, y, w, h] = i.box;
  // 烏坵 (lon ~119.45) belongs to Kinmen but sits far away; fit to the main islands so they stay legible
  const fitTo: Feature<Geometry, Props> = i.id === '09020' && f.geometry.type === 'MultiPolygon'
    ? { ...f, geometry: { type: 'MultiPolygon', coordinates: f.geometry.coordinates.filter((poly) => poly[0][0][0] < 118.6) } }
    : f;
  const proj = geoMercator().fitExtent([[x + 10, y + 22], [x + w - 10, y + h - 8]], fitTo)
    .clipExtent([[x + 1, y + 1], [x + w - 1, y + h - 1]]);
  return { ...i, feature: f, proj };
});

/** Labels sit on the main island at the polygon centroid; tiny cities only appear once zoomed in. */
const SMALL = new Set(['10018', '10020', '10017']);
const shortName = (n: string) => n.replace(/[縣市]$/, '');

interface Shape { id: string; name: string; d: string; cx: number; cy: number; inset: boolean }
function buildShapes() {
  const shapes: Shape[] = [];
  const add = (f: Feature<Geometry, Props>, proj: GeoProjection, inset: boolean) => {
    const p = geoPath(proj);
    const [cx, cy] = p.centroid(f);
    shapes.push({ id: f.properties.COUNTYCODE, name: f.properties.COUNTYNAME, d: p(f) ?? '', cx, cy, inset });
  };
  mainFc.features.forEach((f) => add(f, mainProj, false));
  INSETS.forEach((i) => add(i.feature, i.proj, true));
  return shapes;
}
const SHAPES = buildShapes();
// 澎湖 centroid sits in the sea between islands; nudge label so it doesn't cover them
const LABEL_NUDGE: Record<string, [number, number]> = { '10016': [-26, 4], '63000': [8, -2], '65000': [16, 22], '10002': [6, 8], '67000': [-4, 0], '10013': [2, 18], '64000': [16, -30] };

export const TaiwanMap = memo(function TaiwanMap({ ix, mode, selected, onSelect }: { ix: Indexed; mode: MapMode; selected: string | null; onSelect: (id: string) => void }) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);

  const fills = useMemo(() => new Map(SHAPES.map((s) => [s.id, countyFill(ix.summaries.get(s.id), mode, ix)])), [ix, mode]);

  const clamp = useCallback((v: { k: number; x: number; y: number }) => {
    const k = Math.min(6, Math.max(1, v.k));
    const maxX = 0, minX = W - W * k, maxY = 0, minY = H - H * k;
    return { k, x: Math.min(maxX, Math.max(minX, v.x)), y: Math.min(maxY, Math.max(minY, v.y)) };
  }, []);

  const toSvg = (clientX: number, clientY: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2, oy = (r.height - H * scale) / 2;
    return { x: (clientX - r.left - ox) / scale, y: (clientY - r.top - oy) / scale, scale };
  };

  const zoomAt = (factor: number, cx = W / 2 + 60, cy = H / 2) => {
    setView((v) => {
      const k = Math.min(6, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clamp({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f });
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey && view.k === 1 && e.deltaY > 0) return; // let page scroll when not zoomed
    const p = toSvg(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && view.k > 1 && e.buttons) {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      if (d.moved) {
        const { scale } = toSvg(e.clientX, e.clientY);
        setView(clamp({ k: view.k, x: d.vx + dx / scale, y: d.vy + dy / scale }));
      }
    }
    const target = (e.target as Element).closest('[data-county]');
    if (target && e.pointerType === 'mouse') {
      const r = wrap.current!.getBoundingClientRect();
      setHover({ id: target.getAttribute('data-county')!, x: e.clientX - r.left, y: e.clientY - r.top });
    } else if (!target) setHover(null);
  };
  const clickCounty = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const hs = hover ? ix.summaries.get(hover.id) : undefined;
  const renderCounty = (s: Shape, transformK: number) => {
    const f = fills.get(s.id)!;
    const sum = ix.summaries.get(s.id);
    const lead = sum?.leaders.predict;
    const aria = `${s.name}：${sum?.participants ?? 0} 人參與，${lead?.length ? `最被看好 ${lead.map((c) => c.name).join('、')}` : '尚無預測'}`;
    const isSel = selected === s.id, isHover = hover?.id === s.id;
    return (
      <g key={s.id}>
        <path d={s.d} data-county={s.id} className={`map-county ${isHover ? 'is-hover' : ''}`} fill={f.color} fillOpacity={f.opacity}
          stroke={isSel ? '#FFFFFF' : isHover ? '#7CC2FF' : '#060B16'} strokeWidth={(isSel || isHover ? 1.8 : 0.7) / transformK}
          tabIndex={0} role="button" aria-label={aria} aria-pressed={isSel}
          onClick={() => clickCounty(s.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(s.id))}
          onFocus={() => setHover(null)} />
        {f.pattern && <path d={s.d} fill={`url(#hatch-${f.pattern})`} pointerEvents="none" />}
      </g>
    );
  };

  const main = SHAPES.filter((s) => !s.inset);
  // Hovered/selected county drawn last so its outline isn't hidden by neighbours
  const order = [...main].sort((a, b) => (a.id === selected ? 1 : 0) - (b.id === selected ? 1 : 0) || (a.id === hover?.id ? 1 : 0) - (b.id === hover?.id ? 1 : 0));

  return (
    <div className="relative">
      <div ref={wrap} className="relative mx-auto aspect-[500/700] max-h-[82vh] w-full touch-pan-y select-none"
        onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerLeave={() => { setHover(null); drag.current = null; }} onPointerUp={() => setTimeout(() => (drag.current = null))}
        style={{ cursor: view.k > 1 ? 'grab' : 'default' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="group" aria-label="台灣 22 縣市互動地圖">
          <defs>
            <filter id="county-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#3AA0FF" floodOpacity="0.9" />
            </filter>
            <pattern id="hatch-tie" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={TIE} /><line x1="0" y1="0" x2="0" y2="6" stroke="#060B16" strokeWidth="2.2" />
            </pattern>
            <pattern id="hatch-tossup" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="#FF3B4E" strokeWidth="1.6" />
            </pattern>
          </defs>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {order.map((s) => renderCounty(s, view.k))}
            {main.map((s) => {
              if (SMALL.has(s.id) && view.k < 2) return null;
              const [nx, ny] = LABEL_NUDGE[s.id] ?? [0, 0];
              return (
                <text key={`l-${s.id}`} x={s.cx + nx} y={s.cy + ny} textAnchor="middle" pointerEvents="none"
                  fontSize={11 / Math.sqrt(view.k)} fontWeight={700} fill="#E9EEF8" stroke="#060B16" strokeWidth={2.6 / Math.sqrt(view.k)} paintOrder="stroke">
                  {shortName(s.name)}
                </text>
              );
            })}
          </g>
          {INSETS.map((i) => {
            const s = SHAPES.find((x) => x.id === i.id)!;
            const [x, y, w, h] = i.box;
            return (
              <g key={i.id}>
                <rect x={x} y={y} width={w} height={h} rx={4} fill="#0A1222" stroke={selected === i.id ? '#FFFFFF' : '#2A3B60'} strokeDasharray="3 3" />
                <text x={x + 8} y={y + 15} fontSize={11} fontWeight={700} fill="#B5C0D6">{i.label}</text>
                {renderCounty(s, 1)}
              </g>
            );
          })}
        </svg>

        {hs && hover && (
          <div className="pointer-events-none absolute z-10 w-60 rounded-md border border-rule-strong bg-ink/95 p-3 shadow-lift"
            style={{ left: Math.min(hover.x + 16, (wrap.current?.clientWidth ?? 400) - 250), top: Math.max(8, hover.y - 20) }}>
            <div className="flex items-baseline justify-between">
              <p className="text-base font-black">{hs.county.name}</p>
              <p className="text-xs text-text-3">{hs.participants} 人參與</p>
            </div>
            {hs.leaders.predict.length ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-2xs font-bold text-text-3">最受朋友看好</p>
                {hs.predict.slice(0, 3).filter((r) => r.count > 0).map((r) => (
                  <div key={r.candidate.id} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: candidateColor(r.candidate, ix.parties) }} />
                    <span className="flex-1 truncate font-bold">{r.candidate.name}</span>
                    <span className="num text-base font-bold">{pct(r.count, hs.totals.predict)}</span>
                    <span className="w-8 text-right text-xs text-text-3">{r.count} 人</span>
                  </div>
                ))}
                {mode === 'battle' && <p className="pt-1 text-xs font-bold text-gold">{BATTLE_LABEL[hs.battle]}</p>}
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-3">尚無朋友預測，點擊成為第一位。</p>
            )}
          </div>
        )}
      </div>

      <div className="absolute right-0 top-0 flex flex-col overflow-hidden rounded-md border border-rule-strong bg-ink/90">
        <button className="grid h-9 w-9 place-items-center text-lg hover:bg-white/5" onClick={() => zoomAt(1.5)} aria-label="放大地圖">＋</button>
        <button className="grid h-9 w-9 place-items-center border-t border-rule text-lg hover:bg-white/5" onClick={() => zoomAt(1 / 1.5)} aria-label="縮小地圖">－</button>
        <button className="grid h-9 w-9 place-items-center border-t border-rule text-xs font-bold hover:bg-white/5" onClick={() => setView({ k: 1, x: 0, y: 0 })} aria-label="重設地圖">1:1</button>
      </div>
    </div>
  );
});

export function MapLegend({ ix, mode }: { ix: Indexed; mode: MapMode }) {
  const sw = (bg: string, pattern?: string) => (
    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: pattern ?? bg }} />
  );
  const tieSw = `repeating-linear-gradient(45deg, ${TIE} 0 3px, #060B16 3px 5px)`;
  let items: { key: string; node: React.ReactNode; label: string }[] = [];
  if (mode === 'battle') {
    items = [
      { key: 'safe', node: sw('#3AA0FF'), label: '穩定領先（實色）' },
      { key: 'lean', node: <span className="inline-block h-3 w-3 rounded-sm bg-electric/60" />, label: '小幅領先（淡色）' },
      { key: 'toss', node: sw('', 'repeating-linear-gradient(-45deg, #FF3B4E 0 1.5px, rgba(58,160,255,.5) 1.5px 5px)'), label: '膠著：差 1 人（紅斜線）' },
      { key: 'tie', node: sw('', tieSw), label: '平手' },
      { key: 'none', node: sw(NODATA), label: '尚無預測' },
    ];
  } else if (mode === 'cross') {
    items = [
      { key: 'same', node: sw('#3AA0FF'), label: '最看好 = 最支持' },
      { key: 'diff', node: sw('#FF3B4E'), label: '最看好 ≠ 最支持' },
      { key: 'none', node: sw(NODATA), label: '資料不足' },
    ];
  } else {
    const kind = mode === 'support' ? 'support' : 'predict';
    const used = new Map<string, { color: string; label: string }>();
    ix.summaries.forEach((s) => {
      if (mode === 'party') {
        if (s.partyLeader.party && !s.partyLeader.tie) used.set(s.partyLeader.party.id, { color: s.partyLeader.party.color, label: s.partyLeader.party.short_name });
        return;
      }
      const l = s.leaders[kind];
      if (l.length === 1) {
        const p = l[0].party_id ? ix.parties.get(l[0].party_id) : undefined;
        const key = l[0].color ? `c-${l[0].id}` : `p-${l[0].party_id}`;
        used.set(key, { color: candidateColor(l[0], ix.parties), label: l[0].color ? `${l[0].name}` : p?.short_name ?? '無黨籍' });
      }
    });
    items = [...used.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'zh-Hant')).map(([k, v]) => ({ key: k, node: sw(v.color), label: v.label }));
    items.push({ key: 'tie', node: sw('', tieSw), label: '平手' }, { key: 'none', node: sw(NODATA), label: '尚無資料' });
  }
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-2 xl:flex-col" aria-label="地圖圖例">
      {items.map((i) => <li key={i.key} className="flex items-center gap-1.5">{i.node}{i.label}</li>)}
    </ul>
  );
}
