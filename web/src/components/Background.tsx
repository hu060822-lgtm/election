import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * A faint survey grid with a few slow "signal" particles drifting along it.
 * Low particle count, paused when the tab is hidden, static under reduced motion.
 */
export function Background() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const G = 48;
    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const N = w < 700 ? 10 : 22;
    const ps = Array.from({ length: N }, () => ({
      x: Math.round(Math.random() * (w / G)) * G, y: Math.random() * h,
      v: 0.15 + Math.random() * 0.35, horiz: Math.random() < 0.4, red: Math.random() < 0.15,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(58,160,255,0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0.5; x < w; x += G) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let y = 0.5; y < h; y += G) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
      for (const p of ps) {
        const len = 70;
        const grad = p.horiz ? ctx.createLinearGradient(p.x - len, p.y, p.x, p.y) : ctx.createLinearGradient(p.x, p.y - len, p.x, p.y);
        const c = p.red ? '255,59,78' : '58,160,255';
        grad.addColorStop(0, `rgba(${c},0)`);
        grad.addColorStop(1, `rgba(${c},0.45)`);
        ctx.strokeStyle = grad;
        ctx.beginPath();
        if (p.horiz) { ctx.moveTo(p.x - len, p.y); ctx.lineTo(p.x, p.y); } else { ctx.moveTo(p.x, p.y - len); ctx.lineTo(p.x, p.y); }
        ctx.stroke();
      }
    };
    const tick = () => {
      for (const p of ps) {
        if (p.horiz) { p.x += p.v; if (p.x > w + 80) { p.x = -10; p.y = Math.round(Math.random() * (h / G)) * G + 0.5; } }
        else { p.y += p.v; if (p.y > h + 80) { p.y = -10; p.x = Math.round(Math.random() * (w / G)) * G + 0.5; } }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    ps.forEach((p) => { if (p.horiz) p.y = Math.round(p.y / G) * G + 0.5; else p.x += 0.5; });
    if (reduce) draw(); else raf = requestAnimationFrame(tick);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(tick); };
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); };
  }, [reduce]);
  return (
    <>
      <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(31,111,194,0.18), transparent 70%)' }} aria-hidden />
    </>
  );
}
