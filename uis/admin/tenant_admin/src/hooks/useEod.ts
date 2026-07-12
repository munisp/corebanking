import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eodService } from '../services/eodService';
import type { TriggerEodRequest } from '../types/eod';

export const EOD_KEYS = {
  runs: ['eod', 'runs'] as const,
  run: (id: number) => ['eod', 'runs', id] as const,
  pipeline: ['eod', 'pipeline'] as const,
};

export function useEodRuns() {
  return useQuery({
    queryKey: EOD_KEYS.runs,
    queryFn: eodService.listRuns,
    staleTime: 15_000,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasRunning = items.some((r) => r.status === 'running');
      return hasRunning ? 8_000 : false;
    },
  });
}

export function useEodRun(id: number | null) {
  return useQuery({
    queryKey: EOD_KEYS.run(id ?? 0),
    queryFn: () => eodService.getRun(id!),
    enabled: id !== null,
    staleTime: 5_000,
    refetchInterval: (query) => {
      return query.state.data?.status === 'running' ? 5_000 : false;
    },
  });
}

export function useEodPipeline() {
  return useQuery({
    queryKey: EOD_KEYS.pipeline,
    queryFn: eodService.getPipeline,
    staleTime: Infinity,
  });
}

export function useTriggerEod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TriggerEodRequest) => eodService.trigger(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: EOD_KEYS.runs }),
  });
}
