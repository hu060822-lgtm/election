import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { indexState } from './derive';
import type { ActivityResp, AnalyticsResp, AppState, Kind, Me, ResultsResp, SupportersResp } from './types';

export const useAppState = () => {
  const q = useQuery({ queryKey: ['state'], queryFn: () => api.get<AppState>('/api/state'), refetchInterval: 60_000 });
  const ix = useMemo(() => (q.data ? indexState(q.data) : null), [q.data]);
  return { ...q, ix };
};
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api.get<Me>('/api/me') });
export const useActivity = () => useQuery({ queryKey: ['activity'], queryFn: () => api.get<ActivityResp>('/api/activity?limit=25'), refetchInterval: 90_000 });
export const useSupporters = (countyId: string | null) =>
  useQuery({ queryKey: ['supporters', countyId], queryFn: () => api.get<SupportersResp>(`/api/counties/${countyId}/supporters`), enabled: !!countyId });
export const useAnalytics = () => useQuery({ queryKey: ['analytics'], queryFn: () => api.get<AnalyticsResp>('/api/analytics') });
export const useResults = () => useQuery({ queryKey: ['results'], queryFn: () => api.get<ResultsResp>('/api/results') });

export function usePickMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { county_id: string; kind: Kind; candidate_id: string | null }) =>
      v.candidate_id
        ? api.put<Me>('/api/me/picks', v)
        : api.del<Me>(`/api/me/picks/${v.county_id}/${v.kind}`),
    onSuccess: (me, v) => {
      qc.setQueryData(['me'], (old: Me | undefined) => ({ ...old, ...me }));
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['supporters', v.county_id] });
    },
  });
}

export function useMeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { show_predictions?: boolean; show_support?: boolean; nickname?: string }) => api.patch<Me>('/api/me', v),
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      qc.invalidateQueries({ queryKey: ['supporters'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
