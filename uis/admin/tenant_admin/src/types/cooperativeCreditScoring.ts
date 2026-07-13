export interface MLModelRecord {
  id: string;
  model: string;
  accuracy: number;
  f1Score?: number;
  giniCoefficient?: number;
  precision?: number;
  lastTrained: string;
  predictions24h?: number;
  scored24h?: number;
  status?: string;
  createdAt?: string;
}

export interface CoopCreditStats {
  modelsDeployed: number;
  totalPredictions24h: number;
  avgLatencyMs: number;
  gpuUtilization: number;
}

export interface CreateMLRecordPayload {
  model: string;
  accuracy?: number;
  [key: string]: unknown;
}

export interface CoopCreditListResponse { records: MLModelRecord[]; total: number; }
