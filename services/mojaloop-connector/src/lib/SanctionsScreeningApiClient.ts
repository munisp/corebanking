import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";
import createLogger from "../config/logger.config";
import { extract_name_form_path } from "../utils/helpers";

const logger = createLogger(extract_name_form_path(__filename));

// MN-13: beneficiary screening for inbound transfers. Default points at the
// sanctions-screening-service chart name; MUST be set in deployed envs.
const sanctionsUrl = readEnv(
  "SANCTIONS_SCREENING_URL",
  "http://sanctions-screening-service:8080",
) as string;

export interface SanctionsScreeningResult {
  id: string;
  screened_name: string;
  risk_level: string;
  action: "proceed" | "block" | "hold_and_review" | string;
  highest_score: number;
  match_count: number;
}

/**
 * Fail-CLOSED sanctions screening client (MN-13/F12-01): if the screening
 * service is unreachable the caller must treat the transfer as NOT cleared —
 * inbound funds may never be credited to an unscreened beneficiary.
 */
class SanctionsScreeningApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: sanctionsUrl, timeout: 10_000 });
  }

  async screen(req: {
    name: string;
    tenant_id: string;
    triggered_by: string;
    transaction_id?: string;
    customer_id?: string;
    screen_type?: string;
  }): Promise<SanctionsScreeningResult> {
    try {
      const res = await this.http.post<SanctionsScreeningResult>("/api/screen", req);
      return res.data;
    } catch (error: any) {
      logger.error(
        `Sanctions screening UNAVAILABLE (fail-closed) name=${req.name} txn=${req.transaction_id}: ${error?.message}`,
      );
      throw new Error(
        "Sanctions screening service unavailable; transfer cannot proceed (fail-closed)",
      );
    }
  }
}

export const sanctionsScreeningApiClient = new SanctionsScreeningApiClient();
