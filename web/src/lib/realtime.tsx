import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NewsItem } from './types';

interface RT { connected: boolean; online: number; flash: NewsItem | null; dismissFlash: () => void }
const Ctx = createContext<RT>({ connected: false, online: 0, flash: null, dismissFlash: () => {} });
export const useRealtime = () => useContext(Ctx);

/** WebSocket client: server pushes "something changed" events; we invalidate the matching queries. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(0);
  const [flash, setFlash] = useState<NewsItem | null>(null);
  const retry = useRef(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onopen = () => {
        setConnected(true);
        if (retry.current > 0) qc.invalidateQueries(); // catch up after reconnect
        retry.current = 0;
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        const delay = Math.min(30_000, 1000 * 2 ** retry.current++);
        timer = window.setTimeout(connect, delay);
      };
      ws.onmessage = (m) => {
        let ev: { type: string; [k: string]: unknown };
        try { ev = JSON.parse(m.data); } catch { return; }
        switch (ev.type) {
          case 'hello':
          case 'presence': setOnline(Number(ev.online) || 0); break;
          case 'picks_changed':
            qc.invalidateQueries({ queryKey: ['state'] });
            qc.invalidateQueries({ queryKey: ['supporters', ev.county_id] });
            qc.invalidateQueries({ queryKey: ['analytics'] });
            qc.invalidateQueries({ queryKey: ['results'] });
            break;
          case 'activity': qc.invalidateQueries({ queryKey: ['activity'] }); break;
          case 'news':
            setFlash(ev.item as NewsItem);
            qc.invalidateQueries({ queryKey: ['activity'] });
            break;
          case 'candidates_changed': qc.invalidateQueries({ queryKey: ['state'] }); qc.invalidateQueries({ queryKey: ['admin'] }); break;
          case 'settings_changed': qc.invalidateQueries({ queryKey: ['state'] }); qc.invalidateQueries({ queryKey: ['results'] }); break;
          case 'results_changed': qc.invalidateQueries({ queryKey: ['results'] }); break;
          case 'data_reset': qc.invalidateQueries(); break;
        }
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, [qc]);

  return <Ctx.Provider value={{ connected, online, flash, dismissFlash: () => setFlash(null) }}>{children}</Ctx.Provider>;
}
