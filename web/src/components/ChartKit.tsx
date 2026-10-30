import type { ReactNode } from 'react';

export const AXIS = { stroke: '#2A3B60', tick: { fill: '#7E8BA6', fontSize: 11 }, tickLine: false } as const;
export const GRID = { stroke: '#1C2A47', strokeDasharray: '0', vertical: false } as const;

type TipPayload = { name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown>; dataKey?: string | number };

/** Shared dark tooltip: values in text ink, colour only on the swatch. */
export function ChartTooltip({ active, payload, label, unit = '', title }: { active?: boolean; payload?: TipPayload[]; label?: ReactNode; unit?: string; title?: (p: TipPayload[]) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[10rem] rounded-md border border-rule-strong bg-ink/95 px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-bold text-text">{title ? title(payload) : label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-text-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <b className="num text-sm text-text">{p.value}{unit}</b>
        </p>
      ))}
    </div>
  );
}

export function ChartPanel({ title, note, children, className = '' }: { title: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head"><h2 className="panel-title">{title}</h2></div>
      <div className="p-4">
        {children}
        {note && <p className="mt-3 text-xs text-text-4">{note}</p>}
      </div>
    </section>
  );
}
