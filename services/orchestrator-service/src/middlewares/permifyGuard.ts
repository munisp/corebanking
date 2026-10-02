// ─────────────────────────────────────────────────────────────────────────────
// Wave-12 B5-P1-D-F: Permify authorization guard for mutating onboarding
// routes. Mirrors the landed wave-12 guard semantics (permify-authz-go:470):
// real POST {PERMIFY_URL}/v1/tenants/{tenant}/permissions/check with a 30s
// in-process decision cache; errors are never cached. Runs AFTER
// authenticateRequest (OB-01), which stores the verified AuthContext on
// res.locals. FAIL-CLOSED: Permify unreachable/non-200 -> 502; denied -> 403.
// Node core http only — no new dependencies.
// ─────────────────────────────────────────────────────────────────────────────
import { NextFunction, Request, Response } from "express";
import { request as httpRequest, RequestOptions } from "http";
import httpStatus from "http-status";
import { getAuthContext } from "./auth";

const PERMIFY_URL = (process.env.PERMIFY_URL || "http://permify:3476").replace(/\/+$/, "");
const DEFAULT_TENANT = process.env.PERMIFY_DEFAULT_TENANT || "bpmgd";
const DECISION_CACHE_TTL_MS = 30 * 1000;
const DECISION_CACHE_MAX = 10000;

const decisionCache = new Map<string, { allowed: boolean; expiresAt: number }>();

function permifyCheck(
  tenantId: string,
  userId: string,
  entityType: string,
  entityId: string,
  permission: string,
): Promise<boolean> {
  const key = [tenantId, userId, entityType, entityId, permission].join("|");
  const hit = decisionCache.get(key);
  if (hit && Date.now() < hit.expiresAt) {
    return Promise.resolve(hit.allowed);
  }
  const payload = JSON.stringify({
    metadata: { schema_version: "", snap_token: "", depth: 20 },
    entity: { type: entityType, id: entityId },
    permission,
    subject: { type: "user", id: userId },
  });
  const url = new URL(`${PERMIFY_URL}/v1/tenants/${encodeURIComponent(tenantId)}/permissions/check`);
  const opts: RequestOptions = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    timeout: 5000,
  };
  return new Promise<boolean>((resolve, reject) => {
    const req = httpRequest(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`permify returned ${res.statusCode}`));
          return;
        }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const allowed = body.can === "CHECK_RESULT_ALLOWED";
          // 30s decision cache; errors are never cached (fail-closed).
          if (decisionCache.size >= DECISION_CACHE_MAX) {
            const now = Date.now();
            for (const [k, v] of decisionCache) {
              if (now >= v.expiresAt) decisionCache.delete(k);
            }
            if (decisionCache.size >= DECISION_CACHE_MAX) {
              const first = decisionCache.keys().next();
              if (!first.done) decisionCache.delete(first.value);
            }
          }
          decisionCache.set(key, { allowed, expiresAt: Date.now() + DECISION_CACHE_TTL_MS });
          resolve(allowed);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("permify check timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const ID_FIELDS = ["id", "tenant_id", "tenantId", "customer_id", "customerId", "request_id", "requestId"];

function entityId(req: Request): string {
  const params = (req.params || {}) as Record<string, string>;
  for (const f of ID_FIELDS) {
    if (params[f]) return params[f];
  }
  const body = (req.body || {}) as Record<string, unknown>;
  for (const f of ID_FIELDS) {
    const v = body[f];
    if (typeof v === "string" && v) return v;
  }
  return `scope:${(req.baseUrl + req.path).replace(/^\/+/, "")}`;
}

/** permifyGuard(entity, permission): enforce entity:permission on the
 *  authenticated (JWT) subject before the mutating handler executes. */
export function permifyGuard(entityType: string, permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (["POST", "PUT", "PATCH", "DELETE"].indexOf(req.method) < 0) {
      return next();
    }
    const ctx = getAuthContext(res);
    if (!ctx || ctx.callerType !== "jwt" || !ctx.subject) {
      // Service-token/callback callers carry no user subject for an RBAC
      // decision; fail closed on the guarded route.
      res.status(httpStatus.FORBIDDEN).json({ success: false, message: "missing authenticated subject" });
      return;
    }
    const tenantId = ctx.tenantId || DEFAULT_TENANT;
    permifyCheck(tenantId, ctx.subject, entityType, entityId(req), permission)
      .then((allowed) => {
        if (allowed) return next();
        res.status(httpStatus.FORBIDDEN).json({
          success: false,
          message: `forbidden: missing permission ${entityType}:${permission}`,
        });
      })
      .catch(() => {
        res.status(httpStatus.BAD_GATEWAY).json({ success: false, message: "authorization service unavailable" });
      });
  };
}
