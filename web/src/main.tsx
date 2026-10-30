import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { Background } from './components/Background';
import { Intro } from './components/Intro';
import { SessionProvider } from './components/Session';
import { RealtimeProvider } from './lib/realtime';
import './index.css';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, e) => n < 2 && (e as { status?: number }).status !== 401, refetchOnWindowFocus: true } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <RealtimeProvider>
            <SessionProvider>
              <Background />
              <Intro />
              <App />
            </SessionProvider>
          </RealtimeProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
