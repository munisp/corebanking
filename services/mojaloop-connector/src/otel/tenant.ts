/**
 * tenantMiddleware — express middleware implementing the SPEC §2.3 tenant convention.
 *
 * Sets span attribute `tenant.id` (string) on the ACTIVE span. Source priority:
 *   1. `x-tenant-id` request header
 *   2. JWT `tenant_id` claim, if an upstream auth middleware already decoded it
 *      onto the request (`req.user.tenant_id` / `req.auth.tenant_id` /
 *      `req.context.tenant_id`). The kit never verifies JWTs itself — that is the
 *      auth middleware's job; this only reads claims already attached by it.
 *   3. none — attribute absent.
 *
 * The Collector does NOT mint tenant ids; attribution happens here at ingress.
 * Mount AFTER auth/context middleware so JWT-derived claims are available:
 *   app.use(tenantMiddleware);
 *
 * No-op (pass-through) when there is no active span or OTEL_SDK_DISABLED=true.
 */

import { trace } from "@opentelemetry/api";
import type { NextFunction, Request, Response } from "express";

export const TENANT_ID_ATTRIBUTE = "tenant.id";
export const TENANT_ID_HEADER = "x-tenant-id";

type RequestWithClaims = Request & {
  user?: { tenant_id?: unknown };
  auth?: { tenant_id?: unknown };
  context?: { tenant_id?: unknown };
};

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function claimValue(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Resolve the tenant id for a request using SPEC §2.3 source priority.
 * Exported for reuse by code that needs `tenant_id` metric labels (e.g. incCounter).
 */
export function resolveTenantId(req: Request): string | undefined {
  const header = firstHeaderValue(req.headers[TENANT_ID_HEADER]);
  if (typeof header === "string" && header.trim().length > 0) {
    return header.trim();
  }
  const r = req as RequestWithClaims;
  return (
    claimValue(r.user?.tenant_id) ??
    claimValue(r.auth?.tenant_id) ??
    claimValue(r.context?.tenant_id)
  );
}

export function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const span = trace.getActiveSpan();
    if (span) {
      const tenantId = resolveTenantId(req);
      if (tenantId !== undefined) {
        span.setAttribute(TENANT_ID_ATTRIBUTE, tenantId);
      }
    }
  } catch {
    // Telemetry must never break the request path.
  }
  next();
}
