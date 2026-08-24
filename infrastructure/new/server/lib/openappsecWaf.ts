/**
 * OpenAppSec WAF Integration — Node.js BFF layer
 *
 * Integrates with OpenAppSec ML-based WAF for:
 * - WAF event ingestion and logging
 * - Learning mode data collection
 * - Attack pattern analysis
 * - WAF rule management via OpenAppSec API
 *
 * OpenAppSec Agent: http://openappsec:8080
 */

import { db } from "../db";
import { and, eq } from "drizzle-orm";
import { openappsecWafEvents, openappsecLearningData, wafRules } from "../../drizzle/schema";
import { logger } from "./logger";
import type { Request, Response, NextFunction } from "express";

const OPENAPPSEC_URL = process.env.OPENAPPSEC_URL || "http://openappsec:8080";
const OPENAPPSEC_TOKEN = process.env.OPENAPPSEC_TOKEN || "local-dev-token";

// ── OpenAppSec availability probe ────────────────────────────────────────────

let wafAvailable = false;

async function probeOpenAppSec(): Promise<boolean> {
  try {
    const res = await fetch(`${OPENAPPSEC_URL}/health`, {
      headers: { Authorization: `Bearer ${OPENAPPSEC_TOKEN}` },
      signal: AbortSignal.timeout(2000),
    });
    wafAvailable = res.ok;
  } catch {
    wafAvailable = false;
  }
  return wafAvailable;
}

probeOpenAppSec();
setInterval(probeOpenAppSec, 60_000);

// ── WAF Event Types ──────────────────────────────────────────────────────────

export interface WafEvent {
  eventType: "attack_detected" | "anomaly" | "policy_violation" | "rate_limit";
  severity: "low" | "medium" | "high" | "critical";
  sourceIp?: string;
  requestUri?: string;
  method?: string;
  userAgent?: string;
  attackType?: string;
  confidence?: "low" | "medium" | "high";
  action: "detect" | "prevent" | "bypass";
  tenantId?: string;
}

// ── WAF Event Logging ────────────────────────────────────────────────────────

/**
 * Log a WAF event to the database.
 */
export async function logWafEvent(event: WafEvent): Promise<void> {
  try {
    await db.insert(openappsecWafEvents).values({
      eventType: event.eventType,
      severity: event.severity,
      sourceIp: event.sourceIp,
      requestUri: event.requestUri,
      method: event.method,
      userAgent: event.userAgent,
      attackType: event.attackType,
      confidence: event.confidence,
      action: event.action,
      tenantId: event.tenantId,
    });
  } catch (err) {
    logger.error({ err }, "Failed to log WAF event");
  }
}

// ── Learning Mode Data Collection ────────────────────────────────────────────

/**
 * Record a legitimate request for OpenAppSec learning mode.
 */
export async function recordLearningData(
  endpoint: string,
  method: string,
  params: Array<{ name: string; type: string }>
): Promise<void> {
  for (const param of params) {
    try {
      const existing = await db
        .select()
        .from(openappsecLearningData)
        .where(
          // W7-C-15: fully parameterized drizzle conditions — no string
          // interpolation of endpoint/method/param.name into SQL.
          and(
            eq(openappsecLearningData.endpoint, endpoint),
            eq(openappsecLearningData.method, method),
            eq(openappsecLearningData.paramName, param.name)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(openappsecLearningData)
          .set({
            sampleCount: (existing[0].sampleCount ?? 0) + 1,
            lastSeen: new Date(),
          });
      } else {
        await db.insert(openappsecLearningData).values({
          endpoint,
          method,
          paramName: param.name,
          paramType: param.type,
          sampleCount: 1,
        });
      }
    } catch (err) {
      logger.debug({ err }, "Failed to record learning data");
    }
  }
}

// ── Express Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that forwards requests to OpenAppSec for inspection.
 * In learning mode, it logs requests but does not block.
 * In prevent mode, it blocks detected attacks.
 */
export function openappsecMiddleware(options?: {
  mode?: "learning" | "prevent";
  excludePaths?: string[];
}) {
  const mode = options?.mode ?? (process.env.OPENAPPSEC_PREVENT_MODE === "true" ? "prevent" : "learning");
  const excludePaths = options?.excludePaths ?? ["/health", "/metrics", "/dapr/subscribe"];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip excluded paths
    if (excludePaths.some((p) => req.path.startsWith(p))) {
      next();
      return;
    }

    // Extract tenant from JWT or header
    const tenantId = (req as Request & { tenantId?: string }).tenantId ??
      req.headers["x-tenant-id"] as string | undefined;

    if (wafAvailable) {
      try {
        const inspectRes = await fetch(`${OPENAPPSEC_URL}/inspect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAPPSEC_TOKEN}`,
          },
          body: JSON.stringify({
            method: req.method,
            uri: req.originalUrl,
            headers: req.headers,
            sourceIp: req.ip,
            body: req.body ? JSON.stringify(req.body).slice(0, 4096) : undefined,
          }),
          signal: AbortSignal.timeout(100), // Very short timeout to avoid latency impact
        });

        if (inspectRes.ok) {
          const result = await inspectRes.json() as {
            action?: string;
            attackType?: string;
            confidence?: string;
            severity?: string;
          };

          if (result.action === "block" || result.action === "prevent") {
            // Log the WAF event
            await logWafEvent({
              eventType: "attack_detected",
              severity: (result.severity as WafEvent["severity"]) ?? "high",
              sourceIp: req.ip,
              requestUri: req.originalUrl,
              method: req.method,
              userAgent: req.headers["user-agent"],
              attackType: result.attackType,
              confidence: result.confidence as WafEvent["confidence"],
              action: mode === "prevent" ? "prevent" : "detect",
              tenantId,
            });

            if (mode === "prevent") {
              res.status(403).json({
                error: "Request blocked by WAF",
                code: "WAF_BLOCKED",
                requestId: req.headers["x-request-id"],
              });
              return;
            }
          }
        }
      } catch {
        // WAF inspection timeout or error — allow request through (fail open)
      }
    }

    next();
  };
}

// ── WAF Status ───────────────────────────────────────────────────────────────

export function getWafStatus(): {
  available: boolean;
  url: string;
  mode: string;
} {
  return {
    available: wafAvailable,
    url: OPENAPPSEC_URL,
    mode: process.env.OPENAPPSEC_PREVENT_MODE === "true" ? "prevent" : "learning",
  };
}

// ── WAF Rule Sync ────────────────────────────────────────────────────────────

/**
 * Sync WAF rules from OpenAppSec to the database.
 */
export async function syncWafRules(): Promise<number> {
  if (!wafAvailable) return 0;

  try {
    const res = await fetch(`${OPENAPPSEC_URL}/api/rules`, {
      headers: { Authorization: `Bearer ${OPENAPPSEC_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return 0;

    const rules = await res.json() as Array<{
      id: string;
      name: string;
      category: string;
      severity: string;
      enabled: boolean;
    }>;

    let synced = 0;
    for (const rule of rules) {
      await db.insert(wafRules).values({
        ruleId: rule.id,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        status: rule.enabled ? "enforced" : "disabled",
      }).onConflictDoNothing();
      synced++;
    }

    return synced;
  } catch (err) {
    logger.warn({ err }, "Failed to sync WAF rules from OpenAppSec");
    return 0;
  }
}
