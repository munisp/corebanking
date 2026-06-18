export interface AgentTransaction {
  transaction_id: string | number | null;
  agent_id: string | number | null;
  customer_id: string | number | null;
  amount: string | number | null;
  transaction_type: string | null;
  status: string | null;
}

export interface AgentTransactionListResponse {
  items: AgentTransaction[];
  total: number;
  page: number;
  limit: number;
  source: string;
}

export interface AgentBankingStats {
  total: number;
  table?: string;
  source?: string;
}

export interface CreateAgentTransactionPayload {
  agent_id: string;
  customer_id: string;
  amount: number;
  transaction_type: string;
  status?: string;
}
