import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useActivity, useAppState } from '../lib/queries';
import { useRealtime } from '../lib/realtime';
import { useSession } from './Session';
import { NewsFlash } from './NewsFlash';

function Ticker() {
  const { connected, online } = useRealtime();
  const { data } = useActivity();
  const { data: state } = useAppState();
  const items = [
    'LIVE FRIENDS POLL', '2026 TAIWAN LOCAL ELECTION', 'COMMUNITY OBSERVATION',
    '本站數據為朋友看好度，非正式民調、非開票結果',
    ...(state?.settings.site_notice ? [state.settings.site_notice] : []),
    ...(data?.news.slice(0, 8).map((n) => n.message) ?? []),
  ];
  return (
    <div className="flex h-9 items-stretch border-b border-rule bg-ink-2 text-xs">
      <div className="flex shrink-0 items-center gap-2 bg-signal px-3 font-display text-sm font-bold tracking-widest text-white" title="LIVE 僅表示本站資料即時同步，不代表官方開票">
        <span className={`h-2 w-2 rounded-full bg-white ${connected ? 'animate-pulseDot' : 'opacity-40'}`} />
        LIVE
      </div>
      <div className="relative flex-1 overflow-hidden" aria-label="新聞跑馬燈">
        <div className="flex w-max animate-ticker items-center whitespace-nowrap hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center" aria-hidden={k === 1}>
              {items.map((t, i) => (
                <span key={i} className="flex h-9 items-center px-4 font-bold text-text-2">
                  <span className="mr-4 h-1 w-1 rounded-full bg-gold" />{t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-2 border-l border-rule px-3 text-text-3 sm:flex">
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-text-4'}`} />
        {connected ? `${online} 人在線` : '重新連線中'}
      </div>
    </div>
  );
}

const NAV = [
  { to: '/', label: '選情總覽' },
  { to: '/analytics', label: '數據中心' },
  { to: '/results', label: '開票模式' },
  { to: '/me', label: '我的選擇' },
  { to: '/about', label: '說明與隱私' },
];

function NavBar() {
  const { me, openJoin } = useSession();
  const { data } = useAppState();
  const [menu, setMenu] = useState(false);
  const night = data?.settings.election_mode_active;
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink/90 backdrop-blur">
      <Ticker />
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-4 px-4">
        <NavLink to="/" className="flex items-baseline gap-2" aria-label="回到選情總覽">
          <span className="font-display text-xl font-extrabold tracking-tight">TAIWAN ELECTION WATCH</span>
          <span className="hidden font-display text-xl font-extrabold text-signal sm:inline">2026</span>
        </NavLink>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="主選單">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => `relative rounded px-3 py-2 text-sm font-bold transition-colors ${isActive ? 'text-text' : 'text-text-3 hover:text-text'}`}>
              {({ isActive }) => (
                <>
                  {n.label}
                  {n.to === '/results' && night && <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulseDot rounded-full bg-gold align-middle" />}
                  {isActive && <motion.span layoutId="nav-underline" className="absolute inset-x-2 -bottom-[9px] h-0.5 bg-electric" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          {me?.user ? (
            <NavLink to="/me" className="hidden max-w-[10rem] truncate rounded-md border border-rule-strong px-3 py-1.5 text-sm font-bold text-text-2 hover:border-electric sm:block">{me.user.nickname}</NavLink>
          ) : (
            <button className="btn-primary min-h-[36px] px-3" onClick={openJoin}>加入預測</button>
          )}
          <button className="grid h-10 w-10 place-items-center rounded-md border border-rule-strong lg:hidden" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label="開啟選單">
            <span className="text-lg">{menu ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.nav initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-rule lg:hidden" aria-label="行動版選單">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end onClick={() => setMenu(false)} className={({ isActive }) => `block border-b border-rule px-4 py-3 text-sm font-bold ${isActive ? 'text-electric-glow' : 'text-text-2'}`}>{n.label}</NavLink>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-electric focus:px-3 focus:py-2 focus:text-ink">跳到主要內容</a>
      <NavBar />
      <NewsFlash />
      <AnimatePresence mode="wait">
        <motion.main id="main" key={loc.pathname} className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-16 pt-6"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {children}
        </motion.main>
      </AnimatePresence>
      <footer className="border-t border-rule bg-ink-2 px-4 py-6 text-xs text-text-3">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 sm:flex-row sm:justify-between">
          <p>本站所有數字皆為「朋友看好度／支持度」，是朋友之間的非正式選擇，<b className="text-text-2">不是民意調查，也不是選舉結果</b>。正式資訊請以中央選舉委員會公告為準。</p>
          <p>地圖：內政部國土測繪中心縣市界（taiwan-atlas, MIT）</p>
        </div>
      </footer>
    </div>
  );
}
