import axios, { AxiosInstance } from "axios";
import { readEnv } from "../config/readEnv.config";
import { incCounter } from "../otel/otel";

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

/**
 * CP-03/F12-01: Thrown when the sanctions screening service cannot be reached
 * after bounded retries. Screening MUST fail closed on the money path: an
 * unavailable screener is treated exactly like a "block" verdict. The carried
 * `fallbackResult` lets catchers persist/alert a proper block record; an
 * uncaught throw aborts the transfer, which is also fail-closed.
 */
export class SanctionsScreeningUnavailableError extends Error {
  public readonly fallbackResult: SanctionsScreeningResult;

  constructor(req: ScreenRequest, cause: unknown) {
    super(
      `Sanctions screening unavailable for name="${req.name}" tenant=${req.tenant_id}: refusing to proceed (fail-closed)`,
    );
    this.name = "SanctionsScreeningUnavailableError";
    this.fallbackResult = {
      id: "unavailable",
      screened_name: req.name,
      risk_level: "unknown",
      action: "block",
      highest_score: 0,
      match_count: 0,
      matches: [],
    };
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

const MAX_RETRIES = 2; // bounded retry: 3 attempts total, then fail closed
const RETRY_BACKOFF_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SanctionsScreeningApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: sanctionsUrl, timeout: 10_000 });
  }

  async screen(req: ScreenRequest): Promise<SanctionsScreeningResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.http.post<SanctionsScreeningResult>(
          "/api/screen",
          req,
        );
        return res.data;
      } catch (err) {
        lastError = err;
        // CP-03: every screening failure is a reportable compliance incident.
        // SPEC alerting addendum: exact metric name, labels service + tenant_id.
        incCounter("sanctions_screen_errors_total", {
          service: "payment-hub",
          tenant_id: req.tenant_id ?? "unknown",
        });
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_BACKOFF_MS * (attempt + 1));
        }
      }
    }
    // CP-03: fail CLOSED. Previously this catch returned action:"proceed",
    // converting any screening outage into unrestricted transfers to
    // sanctioned parties. Now: block verdict + throw so the transfer aborts.
    console.error(
      `[SanctionsScreeningApiClient] CRITICAL: screening unavailable after ${MAX_RETRIES + 1} attempts for name="${req.name}" tenant=${req.tenant_id}; failing closed (block)`,
    );
    throw new SanctionsScreeningUnavailableError(req, lastError);
  }
}

export const sanctionsScreeningApiClient = new SanctionsScreeningApiClient();
