import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { animate, motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import type { Candidate, Party } from '../lib/types';
import { candidateColor, partyLabel } from '../lib/derive';
import { STATUS_LABEL } from '../lib/format';

/** Number that rolls from its previous value to the new one. */
export function CountUp({ value, className, format = (n: number) => Math.round(n).toLocaleString('zh-TW') }: { value: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) { el.textContent = format(value); prev.current = value; return; }
    const ctl = animate(prev.current, value, { duration: 1.1, ease: [0.2, 0.7, 0.2, 1], onUpdate: (v) => (el.textContent = format(v)) });
    prev.current = value;
    return () => ctl.stop();
  }, [value, reduce, format]);
  return <span ref={ref} className={className}>{format(0)}</span>;
}

export function Avatar({ c, parties, size = 56 }: { c: Candidate; parties: Map<string, Party>; size?: number }) {
  const [broken, setBroken] = useState(false);
  const color = candidateColor(c, parties);
  const initials = c.name.slice(0, c.name.length > 3 ? 2 : 1);
  return (
    <div className="relative shrink-0 overflow-hidden rounded-md bg-panel-3" style={{ width: size, height: size, boxShadow: `inset 0 -3px 0 ${color}` }}>
      {c.photo_url && !broken ? (
        <img src={c.photo_url} alt={`${c.name} 照片`} loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        // 統一風格預設頭像：不使用任何生成或未授權影像
        <svg viewBox="0 0 56 56" className="h-full w-full" role="img" aria-label={`${c.name}（尚無照片）`}>
          <rect width="56" height="56" fill="#15223F" />
          <circle cx="28" cy="22" r="10" fill={color} opacity="0.35" />
          <path d="M8 56c2-12 10-18 20-18s18 6 20 18z" fill={color} opacity="0.35" />
          <text x="28" y="31" textAnchor="middle" fontSize={initials.length > 1 ? 13 : 17} fontWeight="900" fill="#E9EEF8">{initials}</text>
        </svg>
      )}
    </div>
  );
}

export function PartyChip({ c, parties }: { c: Candidate; parties: Map<string, Party> }) {
  const color = candidateColor(c, parties);
  return (
    <span className="chip bg-white/5 text-text-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {partyLabel(c, parties)}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.unconfirmed;
  return <span className={`chip ring-1 ${s.tone}`} title={s.hint}>{s.label}</span>;
}

export function DemoBadge() {
  return <span className="demo-badge" title="測試資料，不代表真實朋友">DEMO</span>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function LoadingPanel({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`panel p-4 ${className}`} role="status" aria-label="載入中">
      <Skeleton className="mb-4 h-4 w-32" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="mb-3 h-8 w-full" />)}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : '資料載入失敗';
  return (
    <div className="panel flex flex-col items-start gap-3 border-signal/40 p-5" role="alert">
      <p className="text-sm font-bold text-signal">資料載入失敗</p>
      <p className="text-sm text-text-2">{msg}</p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>重新載入</button>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-rule-strong px-4 py-6">
      <p className="text-sm font-bold text-text">{title}</p>
      {body && <p className="text-sm text-text-3">{body}</p>}
      {action}
    </div>
  );
}

/** Animated horizontal share bar. */
export function Bar({ value, color, className = 'h-2' }: { value: number; color: string; className?: string }) {
  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/5 ${className}`}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }} />
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-[22px] w-10 shrink-0 rounded-full border transition-colors ${checked ? 'border-electric bg-electric/80' : 'border-rule-strong bg-ink-2'}`}>
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      <span>
        <span className="block text-sm font-bold text-text">{label}</span>
        {hint && <span className="block text-xs text-text-3">{hint}</span>}
      </span>
    </label>
  );
}

/** Accessible modal with focus trap + restore and Esc to close. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('input,button,select,textarea,[tabindex]')?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title}
            className={`panel max-h-[92vh] w-full overflow-y-auto bg-panel shadow-lift scrollbar-thin ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="panel-head sticky top-0 z-10 bg-panel">
              <h2 className="panel-title">{title}</h2>
              <button className="grid h-9 w-9 place-items-center rounded-md text-text-3 hover:bg-white/5 hover:text-text" onClick={onClose} aria-label="關閉">✕</button>
            </div>
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
