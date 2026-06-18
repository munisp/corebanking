export interface Escrow {
  id: string;
  title: string;
  type: string;
  amount: number;
  status: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerAccountNumber: string;
  sellerBank: string;
  agentName?: string;
  agentEmail?: string;
  releaseConditions: string;
  createdAt: Date;
  releaseDate?: Date;
  description?: string;
}

export interface CreateEscrowRequest {
  title: string;
  type: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerAccountNumber: string;
  sellerBank: string;
  agentName?: string;
  agentEmail?: string;
  releaseConditions: string;
  description?: string;
}
