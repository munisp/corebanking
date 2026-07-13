import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";

const nfiuUrl = readEnv("NFIU_SERVICE_URL") as string;

export interface StrRequest {
  customer_id: string;
  customer_name: string;
  customer_type: string;
  customer_bvn?: string;
  reason: string;
  category: string;
  total_amount_kobo: number;
  transaction_count: number;
  period_start: string;
  period_end: string;
  detection_method: string;
  rule_id?: string;
  risk_score: number;
  risk_level: string;
  transaction_ids: string[];
}

class NfiuApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: nfiuUrl, timeout: 15_000 });
  }

  async fileStr(tenantId: string, req: StrRequest): Promise<void> {
    try {
      await this.http.post("/api/strs", req, {
        headers: { "x-tenant-id": tenantId },
      });
    } catch (err) {
      // STR filing must not block the sanctions enforcement response — log and continue
      console.error("[NfiuApiClient] STR filing failed:", err);
    }
  }
}

export const nfiuApiClient = new NfiuApiClient();
