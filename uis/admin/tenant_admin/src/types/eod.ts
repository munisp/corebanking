export type EodRunStatus =
  | 'running'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'
  | 'cancelled';

export type EodStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface EodStep {
  stepId: string;
  stepName: string;
  status: EodStepStatus;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  recordsProcessed: number;
  errorMessage?: string;
  result?: Record<string, unknown>;
}

export interface EodRun {
  id: number;
  businessDate: string;
  status: EodRunStatus;
  initiatedBy: string;
  approvedBy?: string;
  startedAt: string;
  completedAt?: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  errorSummary?: string;
  steps?: EodStep[];
}

export interface EodRunsResponse {
  items: EodRun[];
  total: number;
}

export interface PipelineStep {
  id: string;
  name: string;
  order: number;
  dependsOn: string[];
}

export interface EodPipeline {
  steps: PipelineStep[];
  total: number;
}

export interface TriggerEodRequest {
  businessDate?: string;
}

export interface TriggerEodResponse {
  runId: number;
  businessDate: string;
  status: string;
  initiatedBy: string;
  error?: string;
}
