import { useEffect, useState } from 'react';

const POLLS_OPEN = new Date('2026-11-28T08:00:00+08:00').getTime();
const POLLS_CLOSE = new Date('2026-11-28T16:00:00+08:00').getTime();

/** Broadcast-clock countdown to polls opening on 2026-11-28 08:00 (Taiwan time). */
export function Countdown({ serverOffset = 0 }: { serverOffset?: number }) {
  const [now, setNow] = useState(() => Date.now() + serverOffset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => clearInterval(t);
  }, [serverOffset]);
  if (now >= POLLS_CLOSE) return <p className="font-display text-4xl font-extrabold text-gold">投票已結束・開票中</p>;
  if (now >= POLLS_OPEN) return <p className="font-display text-4xl font-extrabold text-signal">投票進行中（16:00 截止）</p>;
  const s = Math.floor((POLLS_OPEN - now) / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: '天' },
    { v: Math.floor((s % 86400) / 3600), l: '時' },
    { v: Math.floor((s % 3600) / 60), l: '分' },
    { v: s % 60, l: '秒' },
  ];
  return (
    <div className="flex items-end gap-1.5 sm:gap-3" role="timer" aria-label={`距離投票還有 ${parts[0].v} 天 ${parts[1].v} 小時`}>
      {parts.map((p, i) => (
        <div key={p.l} className="flex items-end gap-1">
          <span className={`num block min-w-[2ch] text-right text-5xl font-extrabold leading-none sm:text-6xl ${i === 0 ? 'text-text' : 'text-text-2'}`}>
            {i === 0 ? p.v : String(p.v).padStart(2, '0')}
          </span>
          <span className="pb-1 text-sm font-bold text-text-3">{p.l}</span>
        </div>
      ))}
    </div>
  );
}
