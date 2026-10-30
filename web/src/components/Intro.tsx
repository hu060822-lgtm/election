import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const KEY = 'tew_intro_seen';

/** One orchestrated opening: scan line → title → date, then hands off to the dashboard. Once per session. */
export function Intro() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem(KEY); } catch { return false; }
  });
  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
    const t = setTimeout(() => setShow(false), reduce ? 400 : 2300);
    const skip = (e: KeyboardEvent) => e.key === 'Escape' && setShow(false);
    window.addEventListener('keydown', skip);
    return () => { clearTimeout(t); window.removeEventListener('keydown', skip); };
  }, [show, reduce]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[100] grid cursor-pointer place-items-center bg-ink" onClick={() => setShow(false)}
          exit={{ opacity: 0, transition: { duration: 0.45 } }} aria-label="開場動畫，點擊略過" role="presentation">
          {!reduce && (
            <motion.div className="absolute left-0 right-0 h-px bg-electric" style={{ boxShadow: '0 0 18px 2px rgba(58,160,255,.7)' }}
              initial={{ top: '0%', opacity: 0 }} animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
          )}
          <div className="px-6 text-center">
            <motion.div className="mb-3 flex items-center justify-center gap-2 font-display text-sm font-semibold tracking-[0.3em] text-signal"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.3 }}>
              <span className="h-2 w-2 animate-pulseDot rounded-full bg-signal" /> FRIENDS POLL
            </motion.div>
            <motion.h1 className="font-display text-5xl font-extrabold leading-none tracking-tight text-text sm:text-7xl"
              initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ delay: reduce ? 0 : 0.45, duration: reduce ? 0 : 0.8, ease: [0.7, 0, 0.2, 1] }}>
              TAIWAN ELECTION WATCH
            </motion.h1>
            <motion.p className="mt-4 text-lg font-bold text-text-2 sm:text-xl" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 1.2 }}>
              2026 台灣選舉觀測站 <span className="mx-2 text-gold">|</span> 11 月 28 日投票
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
