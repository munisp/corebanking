import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";

const sanctionsUrl = readEnv("SANCTIONS_SCREENING_URL") as string;

export interface SanctionsMatch {
  entry_id: string;
  list_name: string;
  matched_name: string;
  match_type: string;
  similarity_score: number;
  risk_level: string;
}

export interface SanctionsScreeningResult {
  id: string;
  screened_name: string;
  risk_level: string;
  action: "proceed" | "block" | "hold_and_review";
  highest_score: number;
  match_count: number;
  matches: SanctionsMatch[];
}

export interface ScreenRequest {
  name: string;
  tenant_id: string;
  triggered_by: string;
  transaction_id?: string;
  customer_id?: string;
  screen_type?: string;
}

class SanctionsScreeningApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: sanctionsUrl, timeout: 10_000 });
  }

  async screen(req: ScreenRequest): Promise<SanctionsScreeningResult> {
    try {
      const res = await this.http.post<SanctionsScreeningResult>("/api/screen", req);
      return res.data;
    } catch {
      return {
        id: "unavailable",
        screened_name: req.name,
        risk_level: "unknown",
        action: "proceed",
        highest_score: 0,
        match_count: 0,
        matches: [],
      };
    }
  }
}

export const sanctionsScreeningApiClient = new SanctionsScreeningApiClient();
