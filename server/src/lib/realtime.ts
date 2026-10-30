import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config.js';

let wss: WebSocketServer | null = null;

export type RealtimeEvent =
  | { type: 'picks_changed'; county_id: string; kind: 'predict' | 'support' }
  | { type: 'news'; item: { id: number; type: string; county_id: string | null; message: string; created_at: string; payload: unknown } }
  | { type: 'activity' }
  | { type: 'candidates_changed' }
  | { type: 'settings_changed' }
  | { type: 'results_changed' }
  | { type: 'data_reset' };

export function attachRealtime(server: Server) {
  wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 1024,
    verifyClient: ({ origin, req }, cb) => {
      // Same-origin always OK; additional origins (e.g. Vite dev server) via ALLOWED_ORIGINS
      const host = req.headers.host;
      const ok = !origin || config.allowedOrigins.includes(origin) || (host != null && new URL(origin).host === host);
      cb(ok, 403);
    },
  });
  wss.on('connection', (ws) => {
    (ws as WebSocket & { alive?: boolean }).alive = true;
    ws.on('pong', () => ((ws as WebSocket & { alive?: boolean }).alive = true));
    ws.on('message', () => {}); // clients only listen
    ws.send(JSON.stringify({ type: 'hello', online: wss?.clients.size ?? 0 }));
    broadcastPresence();
  });
  wss.on('close', () => clearInterval(heartbeat));
  const heartbeat = setInterval(() => {
    wss?.clients.forEach((ws) => {
      const w = ws as WebSocket & { alive?: boolean };
      if (!w.alive) return w.terminate();
      w.alive = false;
      w.ping();
    });
    broadcastPresence();
  }, 30_000);
}

function send(payload: unknown) {
  if (!wss) return;
  const msg = JSON.stringify(payload);
  wss.clients.forEach((c) => c.readyState === WebSocket.OPEN && c.send(msg));
}

function broadcastPresence() {
  send({ type: 'presence', online: wss?.clients.size ?? 0 });
}

export function broadcast(ev: RealtimeEvent) {
  send(ev);
}
