/**
 * AI Fraud Detection gateway — FAIL-SAFE VERSION.
 *
 * SECURITY NOTE: the previous revision of this module served hardcoded fake
 * fraud models/alerts/rules/cases and computed `riskScore` using
 * `Math.random()`, returning block/step_up_auth/allow decisions without any
 * real scoring. That "silent mockware" has been removed.
 *
 * Current behavior:
 *  - Every route proxies to the real fraud-detection service
 *    (FRAUD_DETECTION_URL, default: fraud-detection-rs on port 8115 per
 *    lib/serviceMesh.ts).
 *  - On ANY upstream error, timeout, or non-2xx response the gateway fails
 *    fast with HTTP 503. The scoring endpoint FAILS CLOSED: it never
 *    auto-allows — transactions are routed to manual review instead.
 *  - No random numbers, no fabricated risk scores, no canned verdicts.
 */
import type { Express, Request, Response } from "express";
import { logger } from "./logger";

const FRAUD_SERVICE_URL = process.env.FRAUD_DETECTION_URL || "http://localhost:8115";
const UPSTREAM_TIMEOUT_MS = Number(process.env.FRAUD_DETECTION_TIMEOUT_MS || "5000");

const UNAVAILABLE_BODY = {
  error: "fraud_service_unavailable",
  message: "Fraud detection service is unavailable",
};

const SCORE_UNAVAILABLE_BODY = {
  error: "fraud_service_unavailable",
  message: "Fraud scoring unavailable — transaction must be routed to manual review",
  action: "manual_review",
};

async function fetchUpstream(path: string, init?: RequestInit): Promise<{ status: number; body: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${FRAUD_SERVICE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!upstream.ok) {
      logger.error("Fraud service returned non-2xx", { path, status: upstream.status });
      return null;
    }
    const body = await upstream.json().catch(() => null);
    if (body === null) {
      logger.error("Fraud service returned a non-JSON body", { path });
      return null;
    }
    return { status: upstream.status, body };
  } catch (err) {
    logger.error("Fraud service unreachable", { path, error: err instanceof Error ? err.message : String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function proxyList(path: string) {
  return async (_req: Request, res: Response): Promise<void> => {
    const result = await fetchUpstream(path);
    if (!result) {
      res.status(503).json(UNAVAILABLE_BODY);
      return;
    }
    res.status(result.status).json(result.body);
  };
}

export function registerAIFraudDetection(app: Express): void {
  app.get("/api/fraud/v1/models", proxyList("/v1/fraud/models"));
  app.get("/api/fraud/v1/alerts", proxyList("/v1/alerts"));
  app.get("/api/fraud/v1/rules", proxyList("/v1/rules"));
  app.get("/api/fraud/v1/cases", proxyList("/v1/fraud/cases"));
  app.get("/api/fraud/v1/stats", proxyList("/v1/fraud/stats"));

  // Transaction scoring — FAIL CLOSED. A score is only ever returned when the
  // real upstream model produces one; otherwise the transaction must go to
  // manual review. Never auto-allow on failure.
  app.post("/api/fraud/v1/score", async (req: Request, res: Response): Promise<void> => {
    if (!req.body || typeof req.body !== "object") {
      res.status(400).json({ error: "invalid_request", message: "Request body with transaction details is required" });
      return;
    }
    const result = await fetchUpstream("/v1/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    if (!result) {
      res.status(503).json(SCORE_UNAVAILABLE_BODY);
      return;
    }
    res.status(result.status).json(result.body);
  });
}
