import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentBankingService } from '../services/agentBankingService';
import type { CreateAgentTransactionPayload } from '../types/agentBanking';

export const AGENT_KEYS = {
  all: ['agent-banking'] as const,
  list: (page: number, limit: number, search: string) =>
    ['agent-banking', 'list', page, limit, search] as const,
  stats: ['agent-banking', 'stats'] as const,
};

export function useAgentTransactionList(page = 1, limit = 20, search = '') {
  return useQuery({
    queryKey: AGENT_KEYS.list(page, limit, search),
    queryFn: () => agentBankingService.list({ page, limit, search: search || undefined }),
    staleTime: 30_000,
  });
}

export function useAgentBankingStats() {
  return useQuery({
    queryKey: AGENT_KEYS.stats,
    queryFn: agentBankingService.stats,
    staleTime: 60_000,
  });
}

export function useCreateAgentTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAgentTransactionPayload) => agentBankingService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AGENT_KEYS.all });
      toast.success('Transaction recorded');
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? 'Failed to record transaction');
    },
  });
}
