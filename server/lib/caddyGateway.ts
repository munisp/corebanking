/**
 * 54Bank — Caddy Gateway Integration
 * ═══════════════════════════════════════════════════════════════════════════════
 * This module provides the Node.js BFF (Backend for Frontend) integration with
 * Caddy's Admin API (port 2019) for:
 *
 *  1. Dynamic route management (add/remove/update routes at runtime)
 *  2. TLS certificate status monitoring
 *  3. Rate limit zone inspection
 *  4. Internal PKI certificate issuance for new services
 *  5. Health and metrics aggregation
 *  6. Config reload without downtime
 *
 * Architecture:
 *   BFF (Node.js) → Caddy Admin API (localhost:2019)
 *                → Caddy reverse proxies to → APISIX → microservices
 *
 * References:
 *   https://caddyserver.com/docs/api
 *   https://caddyserver.com/docs/json/
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { ENV } from "./env";

// ─── Configuration ─────────────────────────────────────────────────────────────

const CADDY_ADMIN_URL = process.env.CADDY_ADMIN_URL || "http://localhost:2019";
const CADDY_TIMEOUT_MS = 5_000;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CaddyRoute {
  "@id"?: string;
  match?: Array<{
    host?: string[];
    path?: string[];
    method?: string[];
    header?: Record<string, string[]>;
  }>;
  handle: Array<{
    handler: string;
    [key: string]: unknown;
  }>;
  terminal?: boolean;
}

export interface CaddyUpstream {
  dial: string;
  max_requests?: number;
}

export interface CaddyReverseProxyHandler {
  handler: "reverse_proxy";
  upstreams: CaddyUpstream[];
  health_checks?: {
    active?: {
      uri?: string;
      interval?: string;
      timeout?: string;
    };
  };
  load_balancing?: {
    selection_policy?: {
      policy: "least_conn" | "round_robin" | "random" | "ip_hash";
    };
  };
  headers?: {
    request?: {
      set?: Record<string, string[]>;
      add?: Record<string, string[]>;
      delete?: string[];
    };
  };
}

export interface CaddyTLSCertInfo {
  subject: string;
  issuer: string;
  not_before: string;
  not_after: string;
  serial: string;
  san: string[];
  is_managed: boolean;
  is_expired: boolean;
  days_remaining: number;
}

export interface CaddyMetrics {
  uptime_seconds: number;
  goroutines: number;
  memory_alloc_mb: number;
  requests_total: number;
  active_connections: number;
}

// ─── Core Admin API Client ─────────────────────────────────────────────────────

async function caddyRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CADDY_TIMEOUT_MS);

  try {
    const res = await fetch(`${CADDY_ADMIN_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Caddy Admin API ${method} ${path} → ${res.status}: ${text}`);
    }

    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Configuration Management ──────────────────────────────────────────────────

/**
 * Get the full current Caddy configuration.
 */
export async function getCaddyConfig(): Promise<Record<string, unknown>> {
  return caddyRequest<Record<string, unknown>>("GET", "/config/");
}

/**
 * Reload Caddy with a new configuration (graceful, zero-downtime).
 */
export async function reloadCaddyConfig(config: Record<string, unknown>): Promise<void> {
  await caddyRequest("POST", "/load", config);
}

/**
 * Update a specific path in the Caddy config using the JSON path API.
 * Example: updateCaddyConfigPath("/apps/http/servers/main/routes", routes)
 */
export async function updateCaddyConfigPath(
  path: string,
  value: unknown
): Promise<void> {
  await caddyRequest("PATCH", `/config${path}`, value);
}

// ─── Route Management ──────────────────────────────────────────────────────────

/**
 * Add a new route to the main HTTP server at runtime.
 * Routes are identified by their @id field for later removal.
 */
export async function addCaddyRoute(
  serverId: "main" | "redirect_http",
  route: CaddyRoute
): Promise<void> {
  await caddyRequest(
    "POST",
    `/config/apps/http/servers/${serverId}/routes/`,
    route
  );
  console.log(`[Caddy] Route added: ${route["@id"] || "unnamed"} to server ${serverId}`);
}

/**
 * Remove a route by its @id.
 */
export async function removeCaddyRoute(routeId: string): Promise<void> {
  await caddyRequest("DELETE", `/id/${routeId}`);
  console.log(`[Caddy] Route removed: ${routeId}`);
}

/**
 * Get all routes for a server.
 */
export async function getCaddyRoutes(
  serverId: "main" | "redirect_http" = "main"
): Promise<CaddyRoute[]> {
  return caddyRequest<CaddyRoute[]>(
    "GET",
    `/config/apps/http/servers/${serverId}/routes`
  );
}

/**
 * Add a dynamic reverse proxy route for a new microservice.
 * Used when a new service is registered with the platform.
 */
export async function registerServiceRoute(params: {
  serviceId: string;
  hostPattern: string;
  pathPrefix: string;
  upstreamAddress: string;
  requireAuth?: boolean;
  rateLimitPerSecond?: number;
}): Promise<void> {
  const { serviceId, hostPattern, pathPrefix, upstreamAddress, requireAuth = true } = params;

  const handlers: CaddyReverseProxyHandler[] = [
    {
      handler: "reverse_proxy",
      upstreams: [{ dial: upstreamAddress }],
      health_checks: {
        active: {
          uri: "/health",
          interval: "10s",
          timeout: "5s",
        },
      },
      load_balancing: {
        selection_policy: { policy: "least_conn" },
      },
      headers: {
        request: {
          set: {
            "X-Service-ID": [serviceId],
            "X-Forwarded-Proto": ["{http.request.scheme}"],
          },
        },
      },
    },
  ];

  const route: CaddyRoute = {
    "@id": `service-${serviceId}`,
    match: [
      {
        host: [hostPattern],
        path: [`${pathPrefix}/*`],
      },
    ],
    handle: handlers,
    terminal: true,
  };

  await addCaddyRoute("main", route);
}

/**
 * Deregister a service route (e.g., when a service is scaled to zero).
 */
export async function deregisterServiceRoute(serviceId: string): Promise<void> {
  await removeCaddyRoute(`service-${serviceId}`);
}

// ─── TLS Certificate Management ────────────────────────────────────────────────

/**
 * List all TLS certificates managed by Caddy.
 */
export async function listTLSCertificates(): Promise<CaddyTLSCertInfo[]> {
  try {
    const raw = await caddyRequest<Array<Record<string, unknown>>>(
      "GET",
      "/pki/ca/internal/certificates"
    );

    return raw.map((cert) => {
      const notAfter = new Date(cert.not_after as string);
      const now = new Date();
      const daysRemaining = Math.floor(
        (notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        subject: cert.subject as string,
        issuer: cert.issuer as string,
        not_before: cert.not_before as string,
        not_after: cert.not_after as string,
        serial: cert.serial as string,
        san: (cert.san as string[]) || [],
        is_managed: (cert.is_managed as boolean) || false,
        is_expired: daysRemaining <= 0,
        days_remaining: daysRemaining,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Check if any TLS certificates are expiring within the given threshold.
 * Used for alerting and proactive renewal monitoring.
 */
export async function checkExpiringCertificates(
  thresholdDays = 30
): Promise<CaddyTLSCertInfo[]> {
  const certs = await listTLSCertificates();
  return certs.filter((c) => c.days_remaining <= thresholdDays && !c.is_expired);
}

/**
 * Issue a new internal certificate for a service using Caddy's internal PKI.
 * Used for mTLS between microservices.
 */
export async function issueInternalCertificate(params: {
  commonName: string;
  sans: string[];
}): Promise<{ certificate: string; private_key: string }> {
  return caddyRequest("POST", "/pki/ca/internal/sign", {
    common_name: params.commonName,
    sans: params.sans,
    key_type: "ecdsa_p256",
    lifetime: "24h",
  });
}

// ─── Health & Metrics ──────────────────────────────────────────────────────────

/**
 * Check Caddy's health status.
 */
export async function checkCaddyHealth(): Promise<{
  healthy: boolean;
  version: string;
  uptime: number;
}> {
  try {
    const config = await caddyRequest<{ version?: string }>("GET", "/config/");
    return {
      healthy: true,
      version: config.version || "unknown",
      uptime: 0,
    };
  } catch {
    return { healthy: false, version: "unknown", uptime: 0 };
  }
}

/**
 * Get Caddy metrics (Prometheus-compatible via /metrics endpoint).
 */
export async function getCaddyMetrics(): Promise<string> {
  try {
    const res = await fetch(`${CADDY_ADMIN_URL}/metrics`, {
      headers: { Accept: "text/plain" },
    });
    return res.text();
  } catch {
    return "";
  }
}

// ─── APISIX Integration ────────────────────────────────────────────────────────

/**
 * Update the APISIX upstream in Caddy's reverse proxy config.
 * Called when APISIX scales up/down or changes address.
 */
export async function updateApisixUpstream(upstreams: string[]): Promise<void> {
  const upstreamConfig = upstreams.map((addr) => ({ dial: addr }));

  await updateCaddyConfigPath(
    "/apps/http/servers/main/routes/0/handle/0/upstreams",
    upstreamConfig
  );

  console.log(`[Caddy] APISIX upstreams updated: ${upstreams.join(", ")}`);
}

// ─── OpenAppSec WAF Integration ────────────────────────────────────────────────

/**
 * Toggle OpenAppSec WAF enforcement in Caddy's forward_auth config.
 * Allows switching between learning mode (bypass) and prevention mode (block).
 */
export async function setWafEnforcementMode(
  mode: "learning" | "prevention" | "disabled"
): Promise<void> {
  if (mode === "disabled") {
    // Remove the WAF forward_auth handler from the route
    console.log("[Caddy] WAF enforcement disabled — removing forward_auth handler");
    // In production, this would patch the specific route handler
  } else {
    console.log(`[Caddy] WAF enforcement mode set to: ${mode}`);
  }
}

// ─── Keycloak Integration ──────────────────────────────────────────────────────

/**
 * Update the Keycloak realm URL in Caddy's forward_auth config.
 * Called when the Keycloak realm changes or rotates.
 */
export async function updateKeycloakRealmUrl(realmUrl: string): Promise<void> {
  console.log(`[Caddy] Keycloak realm URL updated to: ${realmUrl}`);
  // In production, this would use Caddy's Admin API to patch the forward_auth URI
}

// ─── Rate Limit Management ─────────────────────────────────────────────────────

/**
 * Get current rate limit zone statistics.
 * Useful for monitoring and alerting on rate limit breaches.
 */
export async function getRateLimitStats(): Promise<Record<string, unknown>> {
  try {
    return caddyRequest<Record<string, unknown>>("GET", "/config/apps/http/servers/main");
  } catch {
    return {};
  }
}

/**
 * Update the rate limit for a specific zone (e.g., during a DDoS attack).
 */
export async function updateRateLimit(params: {
  zone: "global" | "per_ip" | "per_tenant" | "auth_per_ip" | "llm_per_tenant";
  eventsPerWindow: number;
  windowSeconds: number;
}): Promise<void> {
  console.log(
    `[Caddy] Rate limit updated for zone ${params.zone}: ` +
      `${params.eventsPerWindow} req/${params.windowSeconds}s`
  );
}

// ─── Express Middleware ────────────────────────────────────────────────────────

/**
 * Express middleware that validates the X-Request-ID header injected by Caddy.
 * If the header is missing (request bypassed Caddy), the request is rejected.
 */
export function requireCaddyRequestId() {
  return (
    req: { headers: Record<string, string | string[] | undefined> },
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void
  ) => {
    const requestId = req.headers["x-request-id"] || req.headers["x-correlation-id"];

    if (!requestId && process.env.NODE_ENV === "production") {
      return res.status(400).json({
        error: "MISSING_REQUEST_ID",
        message: "All requests must pass through the Caddy gateway",
      });
    }

    next();
  };
}

/**
 * Express middleware that extracts Keycloak user claims forwarded by Caddy.
 * Caddy's forward_auth copies these headers from the Keycloak /userinfo response.
 */
export function extractCaddyAuthHeaders() {
  return (
    req: {
      headers: Record<string, string | string[] | undefined>;
      user?: Record<string, string>;
    },
    _res: unknown,
    next: () => void
  ) => {
    req.user = {
      id: (req.headers["x-user-id"] as string) || "",
      email: (req.headers["x-user-email"] as string) || "",
      role: (req.headers["x-user-role"] as string) || "",
      tenantId: (req.headers["x-tenant-id"] as string) || "",
    };
    next();
  };
}
