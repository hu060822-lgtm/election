import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../lib/realtime';

/** 選情快訊：看好度排名變動時從頂部滑入的即時通知。 */
export function NewsFlash() {
  const { flash, dismissFlash } = useRealtime();
  const nav = useNavigate();
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(dismissFlash, 7000);
    return () => clearTimeout(t);
  }, [flash, dismissFlash]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[92px] z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {flash && (
          <motion.div key={flash.id} role="status"
            className="pointer-events-auto flex w-full max-w-xl items-stretch overflow-hidden rounded-md border border-signal/50 bg-panel shadow-lift"
            initial={{ y: -30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
            <div className="flex items-center gap-2 bg-signal px-3 font-display text-sm font-bold tracking-wider text-white">
              <span className="h-2 w-2 animate-pulseDot rounded-full bg-white" /> 選情快訊
            </div>
            <button className="flex-1 px-3 py-3 text-left text-sm font-bold text-text hover:bg-white/5"
              onClick={() => { if (flash.county_id) nav(`/?county=${flash.county_id}`); dismissFlash(); }}>
              {flash.message}
            </button>
            <button className="px-3 text-text-3 hover:text-text" onClick={dismissFlash} aria-label="關閉快訊">✕</button>
            <motion.div className="absolute bottom-0 left-0 h-0.5 bg-signal" initial={{ width: '100%' }} animate={{ width: 0 }} transition={{ duration: 7, ease: 'linear' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
