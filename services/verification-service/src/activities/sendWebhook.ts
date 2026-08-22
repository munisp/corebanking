import axios from 'axios';
import httpStatus from 'http-status';
import * as https from 'node:https';
import { KycWorkflowResult } from '../workflows/kyc.workflow';
import logger from '../config/logger.config';

// Webhook callbacks carry KYC PII (NIN, face-match results), so delivery is
// fail-closed: only HTTPS URLs whose host is explicitly allowlisted via the
// WEBHOOK_ALLOWED_HOSTS env var (comma-separated hostnames; a leading "."
// entry also matches its subdomains) may receive callbacks. TLS certificates
// are always verified.
function isAllowedCallbackUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  const allowed = (process.env.WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return allowed.some((entry) =>
    entry.startsWith(".") ? host.endsWith(entry) : host === entry
  );
}

export async function sendWebhook(url: string, result: KycWorkflowResult) {
  if (!isAllowedCallbackUrl(url)) {
    logger.error(`[sendWebhook] rejected non-allowlisted callback URL (host not in WEBHOOK_ALLOWED_HOSTS or not https)`);
    throw new Error("Webhook callback URL is not allowed");
  }

  logger.info(`[sendWebhook] → POST ${url}`);
  logger.info(`[sendWebhook] payload: %j", result);

  const payload = {
    id: result.id,
    status: result.status,
    workflowRuntimeData: result.workflowRuntimeData,
    score: result.score,
    decision: result.decision,
    metadata: result.metadata,
    timestamp: new Date().toISOString(),
  };

  const resp = await axios.post(url, payload, {
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
    httpsAgent: new https.Agent({ rejectUnauthorized: true }),
  });

  if (resp.status !== httpStatus.OK && resp.status !== httpStatus.ACCEPTED) {
    throw new Error(`Webhook failed: ${resp.status} ${resp.statusText}`);
  }

  logger.info(`[sendWebhook] ✅ callback succeeded (${resp.status})`);
}