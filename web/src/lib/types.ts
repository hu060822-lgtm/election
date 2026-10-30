export type Kind = 'predict' | 'support';
export type CandidateStatus = 'official' | 'registered' | 'potential' | 'unconfirmed' | 'withdrawn';

export interface County { id: string; name: string; name_en: string; kind: 'municipality' | 'county' | 'city'; region: string; election_title: string; sort_order: number }
export interface Party { id: string; name: string; short_name: string; color: string; sort_order: number }
export interface Candidate {
  id: string; county_id: string; name: string; party_id: string | null; ballot_number: number | null; color: string | null;
  photo_url: string | null; photo_source: string | null; bio: string; status: CandidateStatus; is_incumbent: boolean;
  source_name: string | null; source_url: string | null; data_updated_at: string | null; updated_at: string;
}
export interface Settings {
  voting_opens_at: string | null; voting_closes_at: string | null; allow_changes: boolean; allow_view_others: boolean;
  election_mode: 'auto' | 'on' | 'off'; election_date: string; site_notice: string;
  voting_state: 'not_open' | 'open' | 'closed'; election_mode_active: boolean;
}
export interface AppState {
  counties: County[]; parties: Party[]; candidates: Candidate[];
  tallies: { county_id: string; kind: Kind; candidate_id: string; count: number }[];
  participation: { county_id: string; participants: number; predictors: number; supporters: number }[];
  totals: { members: number; participants: number; predictions: number; supports: number; demo_members: number };
  settings: Settings; server_time: string;
}
export interface Me {
  user: { id: string; nickname: string; show_predictions: boolean; show_support: boolean; is_demo: boolean; created_at: string } | null;
  picks: { county_id: string; kind: Kind; candidate_id: string; updated_at: string }[];
  banned?: boolean; recovery_code?: string;
}
export interface Supporter { nickname: string; is_demo: boolean; is_me: boolean }
export interface SupportersResp {
  allow_view_others: boolean;
  by_candidate: Record<string, { predict: Supporter[]; predict_hidden: number; support: Supporter[]; support_hidden: number }>;
}
export interface NewsItem { id: number; type: string; county_id: string | null; message: string; created_at: string; payload: unknown }
export interface ActivityResp {
  events: { id: number; county_id: string; action: 'create' | 'change' | 'cancel'; created_at: string; is_demo: boolean; nickname: string | null; candidate_id: string | null }[];
  news: NewsItem[];
}
export interface AnalyticsResp {
  trend: { days: string[]; series: Record<string, number[]>; daily: { day: string; predict: number; support: number; changes: number; cancels: number }[] };
  consistency: {
    overall: { pairs_common: number; pairs_same: number; rate: number | null; users: number };
    users: { id: string; nickname: string; is_demo: boolean; picks: number }[];
    matrix: { common: number; same: number }[][];
    hidden_users: number; allow_view_others: boolean;
  };
}
export interface ResultsResp {
  results: { county_id: string; winner_candidate_id: string | null; is_final: boolean; source: string | null; updated_at: string }[];
  votes: { candidate_id: string; votes: number }[];
  decided: number;
  leaderboard: { nickname: string; is_demo: boolean; hits: number; scored: number; picked: number; is_me: boolean; is_private: boolean }[];
  hidden_count: number; election_mode_active: boolean;
}
