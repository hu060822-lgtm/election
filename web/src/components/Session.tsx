import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useMe } from '../lib/queries';
import type { Me } from '../lib/types';
import { Modal, Toggle } from './ui';

interface SessionCtx { me: Me | undefined; loading: boolean; openJoin: () => void }
const Ctx = createContext<SessionCtx>({ me: undefined, loading: true, openJoin: () => {} });
export const useSession = () => useContext(Ctx);

export function SessionProvider({ children }: { children: ReactNode }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const openJoin = useCallback(() => setOpen(true), []);
  return (
    <Ctx.Provider value={{ me: me.data, loading: me.isLoading, openJoin }}>
      {children}
      <JoinDialog open={open} onClose={() => setOpen(false)} />
    </Ctx.Provider>
  );
}

export function RecoveryCodeBox({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-md border border-gold/40 bg-gold/5 p-3">
      <p className="mb-2 text-xs font-bold text-gold">你的找回碼（只會顯示這一次）</p>
      <div className="flex items-center gap-2">
        <code className="num flex-1 select-all text-2xl font-bold tracking-widest text-text">{code}</code>
        <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}>{copied ? '已複製' : '複製'}</button>
      </div>
      <p className="mt-2 text-xs text-text-3">換手機、清除瀏覽器資料或在其他裝置使用時，需要「暱稱 + 找回碼」才能找回你的選擇。請截圖或存在密碼管理器。</p>
    </div>
  );
}

function JoinDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'join' | 'restore'>('join');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [showPredictions, setShowPredictions] = useState(true);
  const [showSupport, setShowSupport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null);

  const close = () => { setRecovery(null); setError(null); setCode(''); onClose(); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nickname.trim()) return setError('請輸入暱稱');
    setBusy(true);
    try {
      if (mode === 'join') {
        const r = await api.post<Me>('/api/me/join', { nickname, show_predictions: showPredictions, show_support: showSupport });
        qc.setQueryData(['me'], r);
        setRecovery(r.recovery_code ?? null);
      } else {
        const r = await api.post<Me>('/api/me/restore', { nickname, recovery_code: code });
        qc.setQueryData(['me'], r);
        close();
      }
      qc.invalidateQueries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '發生錯誤，請重試');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title={recovery ? '加入完成' : mode === 'join' ? '以暱稱加入觀測站' : '找回我的身份'}>
      {recovery ? (
        <div className="space-y-4">
          <p className="text-sm text-text-2">歡迎，<b className="text-text">{nickname}</b>。現在可以在地圖上點選縣市，送出你的看好與支持。</p>
          <RecoveryCodeBox code={recovery} />
          <button className="btn-primary w-full" onClick={close}>開始預測</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="flex gap-1 rounded-md bg-ink-2 p-1" role="tablist">
            {(['join', 'restore'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 rounded px-3 py-2 text-sm font-bold ${mode === m ? 'bg-panel-3 text-text' : 'text-text-3 hover:text-text'}`}>
                {m === 'join' ? '第一次加入' : '用找回碼登入'}
              </button>
            ))}
          </div>
          <div>
            <label className="label" htmlFor="nick">暱稱</label>
            <input id="nick" className="field" value={nickname} maxLength={24} autoComplete="nickname" onChange={(e) => { setNickname(e.target.value); setError(null); }} placeholder="例如：Ozzie" />
            <p className="mt-1 text-xs text-text-4">朋友會看到這個名字。不需要電子郵件，也不會記錄你的 IP。</p>
          </div>
          {mode === 'restore' ? (
            <div>
              <label className="label" htmlFor="rcode">找回碼</label>
              <input id="rcode" className="field num text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="one-time-code" />
            </div>
          ) : (
            <fieldset className="space-y-3 rounded-md border border-rule p-3">
              <legend className="px-1 text-xs font-bold text-text-2">隱私設定（之後可隨時修改）</legend>
              <Toggle checked={showPredictions} onChange={setShowPredictions} label="公開我的「看好誰當選」" hint="朋友可在支持者名單看到你的暱稱。關閉時只計入人數。" />
              <Toggle checked={showSupport} onChange={setShowSupport} label="公開我的「希望誰當選」" hint="這是你的政治偏好，預設不公開；關閉時只以匿名方式計入統計。" />
            </fieldset>
          )}
          {error && <p className="text-sm font-bold text-signal" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={busy} type="submit">{busy ? '處理中…' : mode === 'join' ? '加入觀測站' : '找回身份'}</button>
          <p className="text-xs text-text-4">本站是朋友之間的非正式看好度觀測，不是民調，也不是選舉結果。</p>
        </form>
      )}
    </Modal>
  );
}
