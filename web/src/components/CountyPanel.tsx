import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { BATTLE_LABEL, candidateColor, type CountySummary, type Indexed } from '../lib/derive';
import { KIND_QUESTION, pct } from '../lib/format';
import { usePickMutation, useSupporters } from '../lib/queries';
import type { Candidate, Kind, Settings, SupportersResp } from '../lib/types';
import { useSession } from './Session';
import { Avatar, Bar, DemoBadge, EmptyState, PartyChip, Skeleton, StatusChip } from './ui';

function SupporterList({ list, hidden, kind }: { list: SupportersResp['by_candidate'][string]['predict']; hidden: number; kind: Kind }) {
  if (!list.length && !hidden) return <p className="text-xs text-text-4">還沒有朋友選擇。</p>;
  return (
    <div>
      <ul className="flex flex-wrap gap-1.5">
        {list.map((s, i) => (
          <li key={i} className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-bold ${s.is_me ? 'bg-electric/20 text-electric-glow' : 'bg-white/5 text-text-2'}`}>
            {s.nickname}{s.is_me && '（你）'}{s.is_demo && <DemoBadge />}
          </li>
        ))}
      </ul>
      {hidden > 0 && <p className="mt-1.5 text-xs text-text-4">另有 {hidden} 位朋友選擇不公開{kind === 'support' ? '支持對象' : '暱稱'}。</p>}
    </div>
  );
}

function CandidateCard({ c, s, ix, myPicks, supporters, supportersLoading, settings, rank }: {
  c: Candidate; s: CountySummary; ix: Indexed; myPicks: Record<Kind, string | undefined>; supporters?: SupportersResp; supportersLoading: boolean; settings: Settings; rank: number;
}) {
  const { me, openJoin } = useSession();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const m = usePickMutation();
  const color = candidateColor(c, ix.parties);
  const pc = s.predict.find((r) => r.candidate.id === c.id)!;
  const sc = s.support.find((r) => r.candidate.id === c.id)!;
  const withdrawn = c.status === 'withdrawn';
  const locked = settings.voting_state !== 'open';

  const choose = (kind: Kind) => {
    setErr(null);
    if (!me?.user) return openJoin();
    const isMine = myPicks[kind] === c.id;
    m.mutate({ county_id: c.county_id, kind, candidate_id: isMine ? null : c.id }, { onError: (e) => setErr(e instanceof ApiError ? e.message : '送出失敗，請重試') });
  };
  const sup = supporters?.by_candidate[c.id];

  return (
    <motion.li layout className="overflow-hidden rounded-lg border border-rule bg-panel-2/70 transition-colors hover:border-rule-strong" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex gap-3 p-3">
        <Avatar c={c} parties={ix.parties} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {c.ballot_number != null && <span className="num grid h-6 min-w-6 place-items-center rounded bg-white/10 px-1 text-sm font-bold" title="號次">{c.ballot_number}</span>}
            <h3 className="text-lg font-black leading-tight">{c.name}</h3>
            {rank === 0 && pc.count > 0 && s.leaders.predict.length === 1 && <span className="chip bg-electric/15 text-electric-glow">最被看好</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <PartyChip c={c} parties={ix.parties} />
            <StatusChip status={c.status} />
            {c.is_incumbent && <span className="chip bg-white/5 text-text-2">現任</span>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-baseline justify-between"><span className="text-2xs font-bold text-text-3">看好度</span><span className="num text-xl font-bold">{pct(pc.count, s.totals.predict)}</span></div>
              <Bar value={pc.share} color={color} />
              <p className="mt-0.5 text-2xs text-text-3">{pc.count} 人看好</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between"><span className="text-2xs font-bold text-text-3">支持度</span><span className="num text-xl font-bold text-text-2">{pct(sc.count, s.totals.support)}</span></div>
              <Bar value={sc.share} color={color} className="h-2 opacity-60" />
              <p className="mt-0.5 text-2xs text-text-3">{sc.count} 人支持</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {(['predict', 'support'] as const).map((k) => {
          const mine = myPicks[k] === c.id;
          return (
            <motion.button key={k} whileTap={{ scale: 0.96 }} disabled={withdrawn || m.isPending || (locked && !!me?.user)} onClick={() => choose(k)}
              aria-pressed={mine}
              className={`btn min-h-[42px] border text-xs sm:text-sm ${mine ? 'border-transparent text-ink' : 'border-rule-strong text-text-2 hover:border-electric hover:text-text'}`}
              style={mine ? { background: k === 'predict' ? '#3AA0FF' : '#E6B84C' } : undefined}>
              {mine ? (k === 'predict' ? '✓ 我看好（點擊取消）' : '✓ 我支持（點擊取消）') : k === 'predict' ? '我看好此人當選' : '我希望此人當選'}
            </motion.button>
          );
        })}
      </div>
      {err && <p className="px-3 pb-2 text-xs font-bold text-signal" role="alert">{err}</p>}
      <button className="flex w-full items-center justify-between border-t border-rule px-3 py-2 text-xs font-bold text-text-3 hover:bg-white/5 hover:text-text" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>簡介・支持者名單・資料來源</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>▾</motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="space-y-4 border-t border-rule px-3 py-3 text-sm">
              <p className="leading-relaxed text-text-2">{c.bio || '尚無簡介。'}</p>
              {!settings.allow_view_others && <p className="text-xs text-gold">管理員目前關閉「查看其他人的選擇」，名單暫不顯示。</p>}
              {supportersLoading ? <Skeleton className="h-10 w-full" /> : sup || settings.allow_view_others ? (
                <>
                  <div><p className="mb-1.5 text-xs font-bold text-electric-glow">看好此人當選的朋友（{pc.count}）</p><SupporterList list={sup?.predict ?? []} hidden={sup?.predict_hidden ?? 0} kind="predict" /></div>
                  <div><p className="mb-1.5 text-xs font-bold text-gold">希望此人當選的朋友（{sc.count}）</p><SupporterList list={sup?.support ?? []} hidden={sup?.support_hidden ?? 0} kind="support" /></div>
                </>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-text-3">
                <dt>資料來源</dt>
                <dd>{c.source_url ? <a className="text-electric-glow underline-offset-2 hover:underline" href={c.source_url} target="_blank" rel="noreferrer noopener">{c.source_name ?? c.source_url}</a> : c.source_name ?? '—'}</dd>
                <dt>照片來源</dt><dd>{c.photo_url ? c.photo_source ?? '管理員上傳' : '尚無照片（預設頭像）'}</dd>
                <dt>資料更新</dt><dd>{c.data_updated_at ?? '—'}</dd>
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function CountyPanel({ countyId, ix, settings, onClose }: { countyId: string | null; ix: Indexed; settings: Settings; onClose: () => void }) {
  const s = countyId ? ix.summaries.get(countyId) : undefined;
  const { me, openJoin } = useSession();
  const sup = useSupporters(countyId);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!countyId) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [countyId, onClose]);

  const myPicks = { predict: undefined, support: undefined } as Record<Kind, string | undefined>;
  me?.picks.filter((p) => p.county_id === countyId).forEach((p) => (myPicks[p.kind] = p.candidate_id));
  const ranked = s ? [...s.predict].map((r) => r.candidate) : [];

  // Portal: <main> has a transform (page transition), which would trap the drawer under the sticky header
  return createPortal(
    <AnimatePresence>
      {s && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/50 lg:bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${s.county.election_title}資訊`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-rule-strong bg-ink shadow-lift outline-none"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}>
            <header className="border-b border-rule px-4 pb-3 pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold tracking-wider text-text-3">{s.county.name_en.toUpperCase()} · 2026</p>
                  <h2 className="text-3xl font-black tracking-tight">{s.county.name}</h2>
                  <p className="text-sm font-bold text-text-2">{s.county.election_title}・{s.candidates.length} 位候選人</p>
                </div>
                <button className="grid h-10 w-10 place-items-center rounded-md border border-rule-strong text-text-2 hover:text-text" onClick={onClose} aria-label="關閉縣市面板">✕</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-panel px-2 py-2"><p className="num text-2xl font-bold">{s.participants}</p><p className="text-2xs text-text-3">參與人數</p></div>
                <div className="rounded-md bg-panel px-2 py-2"><p className="num text-2xl font-bold">{s.totals.predict}</p><p className="text-2xs text-text-3">看好選擇</p></div>
                <div className="rounded-md bg-panel px-2 py-2"><p className="truncate pt-1 text-sm font-bold text-gold">{BATTLE_LABEL[s.battle]}</p><p className="pt-1 text-2xs text-text-3">戰況</p></div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              <div className="mb-3 rounded-md border border-rule bg-panel px-3 py-2 text-xs text-text-3">
                每個縣市可分別回答：<b className="text-electric-glow">{KIND_QUESTION.predict}</b>與<b className="text-gold">{KIND_QUESTION.support}</b>
                兩者可以不同。支持度預設不公開，只計入匿名統計。
              </div>
              {!me?.user && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-electric/40 bg-electric/5 px-3 py-2">
                  <p className="text-sm text-text-2">加入後即可送出你的預測。</p>
                  <button className="btn-primary min-h-[36px]" onClick={openJoin}>以暱稱加入</button>
                </div>
              )}
              {settings.voting_state !== 'open' && (
                <p className="mb-3 rounded-md border border-gold/40 bg-gold/5 px-3 py-2 text-sm font-bold text-gold">
                  {settings.voting_state === 'closed' ? '選擇已截止，結果僅供瀏覽。' : '選擇尚未開放。'}
                </p>
              )}
              {s.candidates.length === 0 ? (
                <EmptyState title="尚無候選人資料" body="管理員新增候選人後即可開始預測。" />
              ) : (
                <motion.ul className="space-y-3" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.05 } } }}>
                  {ranked.map((c, i) => (
                    <motion.div key={c.id} variants={{ h: { opacity: 0, y: 10 }, s: { opacity: 1, y: 0 } }}>
                      <CandidateCard c={c} s={s} ix={ix} myPicks={myPicks} supporters={sup.data} supportersLoading={sup.isLoading} settings={settings} rank={i} />
                    </motion.div>
                  ))}
                </motion.ul>
              )}
              <p className="mt-4 text-xs text-text-4">
                候選人名單依中選會資格審定結果與媒體整理之號次建立；號次空白者表示來源不一致，待以中選會公告核對。<Link to="/about" className="text-electric-glow">資料說明</Link>
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
