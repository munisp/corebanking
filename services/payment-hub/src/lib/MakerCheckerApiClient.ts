import axios, { AxiosInstance } from "axios";

export interface ApprovalRequest {
  reference: string;
  operation: string;
  entityType: string;
  entityId: string;
  amountKobo: number;
  currency?: string;
  payload: Record<string, unknown>;
  callbackUrl?: string;
  makerId: string;
  makerName: string;
  riskScore?: number;
}

export interface ApprovalResponse {
  id: number;
  reference: string;
  status: "pending" | "already_exists";
  levelsRequired: number;
  slaDeadline: string;
}

class MakerCheckerApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.MAKER_CHECKER_URL || "http://maker-checker-go:8210",
      timeout: 10_000,
    });
  }

  async createApproval(tenantId: string, req: ApprovalRequest): Promise<ApprovalResponse> {
    const res = await this.http.post<ApprovalResponse>("/v1/approvals", req, {
      headers: { "x-tenant-id": tenantId },
    });
    return res.data;
  }
}

export const makerCheckerApiClient = new MakerCheckerApiClient();
