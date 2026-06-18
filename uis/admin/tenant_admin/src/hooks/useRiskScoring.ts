import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { riskScoringService } from '../services/riskScoringService';
import type { ScoreEntityPayload } from '../types/riskScoring';

const RS_KEYS = {
  assessments: ['risk-scoring', 'assessments'] as const,
  portfolio: ['risk-scoring', 'portfolio'] as const,
};

export function useRiskAssessmentList() {
  return useQuery({ queryKey: RS_KEYS.assessments, queryFn: riskScoringService.listAssessments, staleTime: 60_000 });
}

export function useRiskPortfolio() {
  return useQuery({ queryKey: RS_KEYS.portfolio, queryFn: riskScoringService.portfolio, staleTime: 60_000 });
}

export function useScoreEntity() {
  return useMutation({
    mutationFn: (payload: ScoreEntityPayload) => riskScoringService.scoreEntity(payload),
    onError: (err: Error) => toast.error(err?.message ?? 'Scoring failed'),
  });
}
