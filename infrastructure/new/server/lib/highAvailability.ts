/**
 * High Availability Configuration & Dashboard
 *
 * Replica sets, health checks, automatic failover, multi-zone deployment,
 * disaster recovery, and platform-wide HA monitoring.
 *
 * Doctrine: service/middleware status is PROBED, never hardcoded. Each
 * service is checked via HTTP GET /healthz with a 2s timeout
 * (Promise.allSettled); unreachable or unprobed services report
 * "unavailable"/"unknown" — never "healthy". Middleware status comes from the
 * real client helpers (Postgres SELECT 1, getRedisStatus, getKafkaStatus).
 * Uptime percentages are not computable from a point-in-time probe and are
 * reported as null rather than fabricated.
 *
 * Zone doctrine: zone names/regions are static desired-state topology.
 * Zone TELEMETRY (services count, replica count, traffic share, latency,
 * active/standby status) is null/"unknown" because this process runs no
 * zone probes — the previous revision's hardcoded 45/35/25/10 replica counts
 * and "active" statuses served as zone stats have been removed.
 */

import { checkDatabaseHealth } from "./postgresRepository";
import { getRedisStatus } from "./redisClient";
import { getKafkaStatus } from "./kafkaClient";

type ProbeStatus = "healthy" | "degraded" | "unhealthy" | "unavailable" | "unknown";

interface HAService {
  service: string;
  replicas: number;
  desiredReplicas: number;
  readyReplicas: number | null;
  zones: string[];
  healthCheckPath: string;
  healthCheckInterval: number;
  failoverStrategy: string;
  lastHealthCheck: string;
  uptime: string | null;
  status: ProbeStatus;
  responseTimeMs: number | null;
  loadBalancer: string;
  sessionAffinity: boolean;
  rollingUpdateMaxSurge: string;
  rollingUpdateMaxUnavailable: string;
}

interface HAMiddleware {
  name: string;
  type: string;
  replicas: number;
  mode: string;
  failoverTimeMs: number;
  dataReplication: string;
  backupFrequency: string;
  rpo: string;
  rto: string;
  status: ProbeStatus;
  lastFailover: string | null;
}

interface HAZone {
  zone: string;
  region: string;
  // Live telemetry — null until computed from real zone probes.
  services: number | null;
  replicas: number | null;
  traffic: string | null;
  latencyMs: number | null;
  status: "active" | "standby" | "draining" | "unknown";
}

// Desired-state configuration (replica counts, zones, failover strategy are
// deployment config, not live telemetry). Status/uptime are filled by probes.
const haServiceConfig = [
  { service: "core-banking-go", replicas: 5, desiredReplicas: 5, zones: ["lagos-1a", "lagos-1b", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 10, failoverStrategy: "active-active", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "25%", rollingUpdateMaxUnavailable: "0", port: 8100 },
  { service: "payments-hub-go", replicas: 8, desiredReplicas: 8, zones: ["lagos-1a", "lagos-1b", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 5, failoverStrategy: "active-active", loadBalancer: "least-connections", sessionAffinity: false, rollingUpdateMaxSurge: "25%", rollingUpdateMaxUnavailable: "0", port: 8101 },
  { service: "gl-engine-rs", replicas: 3, desiredReplicas: 3, zones: ["lagos-1a", "lagos-1b"], healthCheckPath: "/healthz", healthCheckInterval: 10, failoverStrategy: "active-passive", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "1", rollingUpdateMaxUnavailable: "0", port: 8201 },
  { service: "kyc-engine-py", replicas: 4, desiredReplicas: 4, zones: ["lagos-1a", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 15, failoverStrategy: "active-active", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "25%", rollingUpdateMaxUnavailable: "1", port: 8110 },
  { service: "tigerbeetle-adapter-rs", replicas: 3, desiredReplicas: 3, zones: ["lagos-1a", "lagos-1b", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 5, failoverStrategy: "active-passive", loadBalancer: "primary-backup", sessionAffinity: true, rollingUpdateMaxSurge: "0", rollingUpdateMaxUnavailable: "0", port: 8200 },
  { service: "circuit-breaker-rs", replicas: 2, desiredReplicas: 2, zones: ["lagos-1a", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 10, failoverStrategy: "active-active", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "1", rollingUpdateMaxUnavailable: "0", port: null },
  { service: "idempotency-go", replicas: 2, desiredReplicas: 2, zones: ["lagos-1a", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 10, failoverStrategy: "active-active", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "1", rollingUpdateMaxUnavailable: "0", port: null },
  { service: "fraud-detection-py", replicas: 6, desiredReplicas: 6, zones: ["lagos-1a", "lagos-1b", "abuja-1a"], healthCheckPath: "/healthz", healthCheckInterval: 5, failoverStrategy: "active-active", loadBalancer: "round-robin", sessionAffinity: false, rollingUpdateMaxSurge: "50%", rollingUpdateMaxUnavailable: "0", port: 8115 },
];

const haMiddlewareConfig: Array<Omit<HAMiddleware, "status">> = [
  { name: "PostgreSQL", type: "database", replicas: 3, mode: "streaming-replication", failoverTimeMs: 5000, dataReplication: "synchronous", backupFrequency: "continuous", rpo: "0s", rto: "5s", lastFailover: null },
  { name: "Redis", type: "cache", replicas: 6, mode: "redis-sentinel", failoverTimeMs: 2000, dataReplication: "asynchronous", backupFrequency: "5min", rpo: "5s", rto: "2s", lastFailover: null },
  { name: "Kafka", type: "message-broker", replicas: 3, mode: "multi-broker", failoverTimeMs: 10000, dataReplication: "ISR", backupFrequency: "continuous", rpo: "0ms", rto: "10s", lastFailover: null },
  { name: "TigerBeetle", type: "ledger", replicas: 6, mode: "viewstamped-replication", failoverTimeMs: 100, dataReplication: "synchronous", backupFrequency: "continuous", rpo: "0ms", rto: "100ms", lastFailover: null },
  { name: "OpenSearch", type: "search", replicas: 3, mode: "multi-node", failoverTimeMs: 15000, dataReplication: "asynchronous", backupFrequency: "hourly", rpo: "1h", rto: "15s", lastFailover: null },
  { name: "Keycloak", type: "identity", replicas: 2, mode: "active-active", failoverTimeMs: 5000, dataReplication: "synchronous", backupFrequency: "30min", rpo: "0s", rto: "5s", lastFailover: null },
  { name: "Temporal", type: "workflow", replicas: 3, mode: "multi-cluster", failoverTimeMs: 30000, dataReplication: "asynchronous", backupFrequency: "continuous", rpo: "1s", rto: "30s", lastFailover: null },
  { name: "APISIX", type: "api-gateway", replicas: 3, mode: "active-active", failoverTimeMs: 1000, dataReplication: "etcd-based", backupFrequency: "continuous", rpo: "0ms", rto: "1s", lastFailover: null },
];

// Zone TOPOLOGY (names/regions) is desired-state deployment configuration
// and is clearly labeled as such. Zone TELEMETRY (services/replicas/traffic/
// latency/status) is not probed by this process, so every telemetry field is
// null and status is "unknown" — never hardcoded counts or "active".
const haZones: HAZone[] = [
  { zone: "lagos-1a", region: "West Africa (Lagos)", services: null, replicas: null, traffic: null, latencyMs: null, status: "unknown" },
  { zone: "lagos-1b", region: "West Africa (Lagos)", services: null, replicas: null, traffic: null, latencyMs: null, status: "unknown" },
  { zone: "abuja-1a", region: "Central Nigeria (Abuja)", services: null, replicas: null, traffic: null, latencyMs: null, status: "unknown" },
  { zone: "london-1a", region: "Europe (London)", services: null, replicas: null, traffic: null, latencyMs: null, status: "unknown" },
];

const ZONE_SOURCE_NOTE =
  "Zone names/regions are static desired-state topology; services/replicas/traffic/latency/status are null/unknown because no zone telemetry probes are wired in this process";

// ─── REAL HEALTH PROBING ────────────────────────────────────────────────────

const PROBE_TIMEOUT_MS = 2000;

function serviceUrl(service: string, port: number | null, healthCheckPath: string): string | null {
  const envKey = `HA_SERVICE_URL_${service.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv.replace(/\/$/, "") + healthCheckPath;
  if (port !== null) return `http://127.0.0.1:${port}${healthCheckPath}`;
  return null;
}

async function probeHealth(url: string): Promise<{ ok: boolean; latencyMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

async function getHaServices(): Promise<HAService[]> {
  const probed = await Promise.allSettled(
    haServiceConfig.map(async (cfg): Promise<HAService> => {
      const url = serviceUrl(cfg.service, cfg.port, cfg.healthCheckPath);
      if (!url) {
        // No known address for this service — cannot claim health.
        return {
          ...cfg,
          readyReplicas: null,
          lastHealthCheck: new Date().toISOString(),
          uptime: null,
          status: "unknown",
          responseTimeMs: null,
        };
      }
      const probe = await probeHealth(url);
      return {
        ...cfg,
        readyReplicas: probe.ok ? cfg.desiredReplicas : null,
        lastHealthCheck: new Date().toISOString(),
        uptime: null, // uptime % requires time-series data; not derivable from a probe
        status: probe.ok ? "healthy" : "unavailable",
        responseTimeMs: probe.latencyMs,
      };
    })
  );
  return probed.map(p => p.status === "fulfilled" ? p.value : null).filter((s): s is HAService => s !== null);
}

async function getHaMiddleware(): Promise<HAMiddleware[]> {
  const [pgHealth, redis, kafka] = await Promise.all([
    checkDatabaseHealth(),
    Promise.resolve(getRedisStatus()),
    Promise.resolve(getKafkaStatus()),
  ]);

  return haMiddlewareConfig.map(cfg => {
    let status: ProbeStatus;
    switch (cfg.name) {
      case "PostgreSQL":
        status = pgHealth.healthy ? "healthy" : "unavailable";
        break;
      case "Redis":
        status = redis.connected ? "healthy" : "unavailable";
        break;
      case "Kafka":
        status = kafka.connected ? "healthy" : "unavailable";
        break;
      default:
        // No real client/probe for this middleware in this process.
        status = "unknown";
    }
    return { ...cfg, status };
  });
}

export function registerHighAvailability(app: any) {
  app.get("/api/platform/ha/services", async (_req: any, res: any) => {
    const items = await getHaServices();
    res.json({ items, total: items.length });
  });

  app.get("/api/platform/ha/services/stats", async (_req: any, res: any) => {
    const items = await getHaServices();
    const totalReplicas = items.reduce((s, h) => s + h.replicas, 0);
    res.json({
      totalServices: items.length,
      totalReplicas,
      healthy: items.filter(h => h.status === "healthy").length,
      degraded: items.filter(h => h.status === "degraded").length,
      unhealthy: items.filter(h => h.status === "unhealthy" || h.status === "unavailable").length,
      unknown: items.filter(h => h.status === "unknown").length,
      avgUptime: null, // not fabricated — uptime requires time-series measurement
    });
  });

  app.get("/api/platform/ha/middleware", async (_req: any, res: any) => {
    const items = await getHaMiddleware();
    res.json({ items, total: items.length });
  });

  app.get("/api/platform/ha/middleware/stats", async (_req: any, res: any) => {
    const items = await getHaMiddleware();
    const totalReplicas = items.reduce((s, m) => s + m.replicas, 0);
    res.json({
      totalMiddleware: items.length,
      healthy: items.filter(m => m.status === "healthy").length,
      unavailable: items.filter(m => m.status === "unavailable").length,
      unknown: items.filter(m => m.status === "unknown").length,
      totalReplicas,
      avgFailoverMs: null, // no failover events are tracked in this process
    });
  });

  // Zones — desired-state topology only; telemetry fields are null/unknown.
  app.get("/api/platform/ha/zones", (_req: any, res: any) => {
    res.json({ items: haZones, total: haZones.length, source: "desired-state-config", note: ZONE_SOURCE_NOTE });
  });

  // Zone stats — only the configured zone count is real; everything derived
  // from zone telemetry is null until real probes exist.
  app.get("/api/platform/ha/zones/stats", (_req: any, res: any) => {
    res.json({
      totalZones: haZones.length,
      active: null, // zone status is unprobed — never fabricated
      standby: null,
      totalReplicas: null,
      source: "desired-state-config",
      note: ZONE_SOURCE_NOTE,
    });
  });

  // Platform-wide HA dashboard — aggregates only real probe results
  app.get("/api/platform/ha/dashboard", async (_req: any, res: any) => {
    const [services, middleware] = await Promise.all([getHaServices(), getHaMiddleware()]);
    const serviceHealthy = services.filter(s => s.status === "healthy").length;
    const middlewareHealthy = middleware.filter(m => m.status === "healthy").length;
    const anyUnavailable = services.some(s => s.status === "unavailable") || middleware.some(m => m.status === "unavailable");

    res.json({
      overallStatus: anyUnavailable ? "degraded" : serviceHealthy + middlewareHealthy > 0 ? "healthy" : "unknown",
      platformUptime: null, // not fabricated — requires time-series measurement
      trackedServices: services.length,
      healthyServices: serviceHealthy,
      trackedMiddleware: middleware.length,
      healthyMiddleware: middlewareHealthy,
      totalReplicas: services.reduce((s, h) => s + h.replicas, 0) + middleware.reduce((s, m) => s + m.replicas, 0),
      zones: haZones.length, // configured zone count (topology), not telemetry
      failoversLast24h: null, // no failover events are tracked in this process
      rpoTargets: { tigerbeetle: "0ms", redis: "5s", kafka: "0ms" },
      rtoTargets: { tigerbeetle: "100ms", redis: "2s", kafka: "10s" },
      note: "Statuses are live probes (/healthz, SELECT 1, client helpers). Uptime and failover counts are null because this process does not track them — they are not fabricated. " + ZONE_SOURCE_NOTE,
    });
  });
}
