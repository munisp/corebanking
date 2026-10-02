import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";

interface SanctionsMatch {
  entry_id: string;
  list_name: string;
  matched_name: string;
  similarity_score: number;
}

interface SanctionsResult {
  id: string;
  screened_name: string;
  action: "proceed" | "block" | "hold_and_review";
  risk_level: string;
  matches: SanctionsMatch[];
}

class SanctionsService {
  private _http: AxiosInstance;

  constructor() {
    this._http = axios.create({
      baseURL: readEnv("SANCTIONS_SCREENING_URL"),
      timeout: 10_000,
    });
  }

  async screen(args: {
    name: string;
    tenantId: string;
    triggeredBy: string;
    customerId?: string;
    screenType?: string;
  }): Promise<SanctionsResult> {
    try {
      const resp = await this._http.post<SanctionsResult>("/api/screen", {
        name: args.name,
        tenant_id: args.tenantId,
        triggered_by: args.triggeredBy,
        customer_id: args.customerId,
        screen_type: args.screenType || "onboarding",
      });
      return resp.data;
    } catch (error: any) {
      // OB-07: FAIL-CLOSED. A screening outage must stop onboarding, not wave
      // it through. Throw so the Temporal activity retries (and the workflow
      // ultimately fails) instead of silently proceeding. Callers treat a
      // thrown error exactly like action="block": onboarding halts.
      console.error(
        `[SANCTIONS] Screening service unreachable for "${args.name}" tenant=${args.tenantId}: ${error.message} — failing closed (block)`
      );
      throw new Error(
        `Sanctions screening failed for "${args.name}" (tenant=${args.tenantId}): screening outage is treated as BLOCK — ${error.message}`
      );
    }
  }
}

export const sanctionsService = new SanctionsService();
