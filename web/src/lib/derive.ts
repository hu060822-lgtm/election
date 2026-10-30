import type { AppState, Candidate, County, Kind, Party } from './types';

export const NODATA = '#26324D';
export const TIE = '#E6B84C';
export const FALLBACK = '#8E9AAF';

export type Battle = 'none' | 'tie' | 'tossup' | 'lean' | 'safe';
export const BATTLE_LABEL: Record<Battle, string> = { none: '尚無預測', tie: '平手', tossup: '膠著（差 1 人）', lean: '小幅領先', safe: '穩定領先' };

export interface Ranked { candidate: Candidate; count: number; share: number }
export interface CountySummary {
  county: County;
  candidates: Candidate[];
  predict: Ranked[];
  support: Ranked[];
  totals: Record<Kind, number>;
  participants: number;
  leaders: Record<Kind, Candidate[]>;
  margin: number;
  battle: Battle;
  partyLeader: { party: Party | null; tie: boolean; total: number };
  cross: 'same' | 'diff' | 'none';
}

export function candidateColor(c: Candidate | undefined, parties: Map<string, Party>) {
  if (!c) return FALLBACK;
  return c.color ?? (c.party_id ? parties.get(c.party_id)?.color : undefined) ?? FALLBACK;
}

export function indexState(s: AppState) {
  const parties = new Map(s.parties.map((p) => [p.id, p]));
  const candidates = new Map(s.candidates.map((c) => [c.id, c]));
  const counties = new Map(s.counties.map((c) => [c.id, c]));
  const tally = new Map<string, number>(); // `${kind}:${candidateId}`
  s.tallies.forEach((t) => tally.set(`${t.kind}:${t.candidate_id}`, t.count));
  const participation = new Map(s.participation.map((p) => [p.county_id, p]));

  const summaries = new Map<string, CountySummary>();
  for (const county of s.counties) {
    const cands = s.candidates.filter((c) => c.county_id === county.id);
    const rank = (kind: Kind): Ranked[] => {
      const total = cands.reduce((a, c) => a + (tally.get(`${kind}:${c.id}`) ?? 0), 0);
      return cands
        .map((c) => ({ candidate: c, count: tally.get(`${kind}:${c.id}`) ?? 0, share: 0 }))
        .map((r) => ({ ...r, share: total ? r.count / total : 0 }))
        .sort((a, b) => b.count - a.count || (a.candidate.ballot_number ?? 99) - (b.candidate.ballot_number ?? 99));
    };
    const predict = rank('predict');
    const support = rank('support');
    const top = (r: Ranked[]) => (r[0]?.count ? r.filter((x) => x.count === r[0].count).map((x) => x.candidate) : []);
    const totals = { predict: predict.reduce((a, r) => a + r.count, 0), support: support.reduce((a, r) => a + r.count, 0) };
    const margin = predict.length > 1 ? predict[0].count - predict[1].count : predict[0]?.count ?? 0;
    const leaders = { predict: top(predict), support: top(support) };
    let battle: Battle = 'none';
    if (totals.predict > 0) {
      const gap = predict.length > 1 ? predict[0].share - predict[1].share : 1;
      battle = leaders.predict.length > 1 ? 'tie' : margin === 1 ? 'tossup' : gap < 0.25 ? 'lean' : 'safe';
    }
    // Party map: sum predict picks by party (independents each count as their own "party" bucket)
    const byParty = new Map<string, number>();
    predict.forEach((r) => {
      const key = r.candidate.party_id ?? 'ind';
      byParty.set(key, (byParty.get(key) ?? 0) + r.count);
    });
    const partyRank = [...byParty.entries()].sort((a, b) => b[1] - a[1]);
    const partyTie = partyRank.length > 1 && partyRank[0][1] > 0 && partyRank[0][1] === partyRank[1][1];
    const sameSet = (a: Candidate[], b: Candidate[]) => a.length > 0 && a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));
    summaries.set(county.id, {
      county, candidates: cands, predict, support, totals,
      participants: participation.get(county.id)?.participants ?? 0,
      leaders, margin, battle,
      partyLeader: { party: partyRank[0]?.[1] ? parties.get(partyRank[0][0]) ?? null : null, tie: partyTie, total: totals.predict },
      cross: !leaders.predict.length || !leaders.support.length ? 'none' : sameSet(leaders.predict, leaders.support) ? 'same' : 'diff',
    });
  }
  return { parties, candidates, counties, tally, summaries };
}
export type Indexed = ReturnType<typeof indexState>;

export type MapMode = 'leader' | 'battle' | 'party' | 'support' | 'cross';
export const MAP_MODES: { id: MapMode; label: string; hint: string }[] = [
  { id: 'leader', label: '看好度領先', hint: '依朋友「看好誰當選」最多的候選人著色' },
  { id: 'battle', label: '戰況圖', hint: '依領先差距呈現競爭程度：差 1 人即為膠著' },
  { id: 'party', label: '政黨版圖', hint: '依各縣市被看好候選人的政黨加總著色' },
  { id: 'support', label: '支持度領先', hint: '依朋友「希望誰當選」最多的候選人著色（僅統計人數，不揭露個人）' },
  { id: 'cross', label: '看好 vs 支持', hint: '最被看好的人，是否也是最被支持的人？' },
];

export interface Fill { color: string; opacity: number; pattern?: 'tie' | 'tossup' }

export function countyFill(s: CountySummary | undefined, mode: MapMode, ix: Indexed): Fill {
  if (!s) return { color: NODATA, opacity: 1 };
  if (mode === 'leader' || mode === 'support') {
    const kind: Kind = mode === 'leader' ? 'predict' : 'support';
    const l = s.leaders[kind];
    if (!l.length) return { color: NODATA, opacity: 1 };
    if (l.length > 1) return { color: TIE, opacity: 1, pattern: 'tie' };
    return { color: candidateColor(l[0], ix.parties), opacity: 1 };
  }
  if (mode === 'battle') {
    const c = s.leaders.predict[0];
    switch (s.battle) {
      case 'none': return { color: NODATA, opacity: 1 };
      case 'tie': return { color: TIE, opacity: 1, pattern: 'tie' };
      case 'tossup': return { color: candidateColor(c, ix.parties), opacity: 0.55, pattern: 'tossup' };
      case 'lean': return { color: candidateColor(c, ix.parties), opacity: 0.6 };
      case 'safe': return { color: candidateColor(c, ix.parties), opacity: 1 };
    }
  }
  if (mode === 'party') {
    if (!s.partyLeader.total) return { color: NODATA, opacity: 1 };
    if (s.partyLeader.tie) return { color: TIE, opacity: 1, pattern: 'tie' };
    return { color: s.partyLeader.party?.color ?? FALLBACK, opacity: 1 };
  }
  // cross
  if (s.cross === 'none') return { color: NODATA, opacity: 1 };
  return s.cross === 'same' ? { color: '#3AA0FF', opacity: 0.9 } : { color: '#FF3B4E', opacity: 0.9 };
}

export function partyLabel(c: Candidate, parties: Map<string, Party>) {
  return c.party_id ? parties.get(c.party_id)?.short_name ?? '—' : '無黨籍';
}
