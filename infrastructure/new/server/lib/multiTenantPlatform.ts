import type { Express, Request, Response } from "express";

// Multi-tenant platform services: feature flags, tenant isolation, white labeling,
// provisioning, branded comms, product factory, event streaming, graduated rollout,
// custom domains, metering, webhooks, approval workflows, and plugin marketplace.

interface ServiceConfig {
  name: string;
  port: number;
  language: string;
  prefix: string;
}

const SERVICES: ServiceConfig[] = [
  { name: "tenant-isolation-go", port: 8228, language: "go", prefix: "/api/platform/tenant-isolation" },
  { name: "feature-flag-engine-rs", port: 8229, language: "rust", prefix: "/api/platform/feature-flags" },
  { name: "white-label-engine-go", port: 8230, language: "go", prefix: "/api/platform/white-label" },
  { name: "tenant-provisioning-go", port: 8231, language: "go", prefix: "/api/platform/tenant-provisioning" },
  { name: "branded-comms-py", port: 8232, language: "python", prefix: "/api/platform/branded-comms" },
  { name: "product-factory-rs", port: 8233, language: "rust", prefix: "/api/platform/product-factory" },
  { name: "event-streaming-go", port: 8234, language: "go", prefix: "/api/platform/event-streaming" },
  { name: "graduated-rollout-rs", port: 8235, language: "rust", prefix: "/api/platform/graduated-rollout" },
  { name: "custom-domain-go", port: 8236, language: "go", prefix: "/api/platform/custom-domains" },
  { name: "tenant-metering-go", port: 8237, language: "go", prefix: "/api/platform/tenant-metering" },
  { name: "webhook-engine-go", port: 8238, language: "go", prefix: "/api/platform/webhooks" },
  { name: "approval-workflow-go", port: 8239, language: "go", prefix: "/api/platform/approval-workflows" },
  { name: "plugin-marketplace-py", port: 8240, language: "python", prefix: "/api/platform/plugin-marketplace" },
];

export function registerMultiTenantPlatformRoutes(app: Express): void {
  // Proxy routes for each service
  for (const svc of SERVICES) {
    const target = `http://localhost:${svc.port}`;

    // Health check proxy
    app.get(`${svc.prefix}/healthz`, async (_req: Request, res: Response) => {
      try {
        const resp = await fetch(`${target}/healthz`);
        const data = await resp.json();
        res.json(data);
      } catch {
        res.json({ status: "offline", service: svc.name, port: svc.port });
      }
    });

    // Generic proxy for all sub-routes
    const subPaths = getSubPaths(svc.name);
    for (const sub of subPaths) {
      app.get(`${svc.prefix}${sub}`, async (req: Request, res: Response) => {
        try {
          const qs = new URLSearchParams(req.query as Record<string, string>).toString();
          const url = `${target}${sub}${qs ? `?${qs}` : ""}`;
          const resp = await fetch(url);
          const data = await resp.json();
          res.json(data);
        } catch {
          res.json({ items: [], total: 0 });
        }
      });

      // POST endpoints
      app.post(`${svc.prefix}${sub}`, async (req: Request, res: Response) => {
        try {
          const resp = await fetch(`${target}${sub}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(req.body),
          });
          const data = await resp.json();
          res.status(resp.status).json(data);
        } catch {
          const record = { id: `REC-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
          res.status(201).json(record);
        }
      });
    }
  }

  // Platform overview aggregation
  app.get("/api/platform/multi-tenant/overview", async (_req: Request, res: Response) => {
    const serviceStatuses = await Promise.allSettled(
      SERVICES.map(async (svc) => {
        try {
          const resp = await fetch(`http://localhost:${svc.port}/healthz`, { signal: AbortSignal.timeout(2000) });
          const data = await resp.json() as Record<string, unknown>;
          return { ...svc, status: data.status || "unknown" };
        } catch {
          return { ...svc, status: "offline" };
        }
      })
    );

    const results = serviceStatuses.map((r) =>
      r.status === "fulfilled" ? r.value : { status: "error" }
    );

    const online = results.filter((r) => r.status === "healthy").length;
    res.json({
      services: results,
      total: SERVICES.length,
      online,
      offline: SERVICES.length - online,
    });
  });
}

function getSubPaths(serviceName: string): string[] {
  const paths: Record<string, string[]> = {
    "tenant-isolation-go": ["/v1/rls-policies", "/v1/tenant-schemas", "/v1/violations", "/v1/config", "/v1/stats", "/v1/validate"],
    "feature-flag-engine-rs": ["/v1/flags", "/v1/audit", "/v1/ab-tests", "/v1/stats"],
    "white-label-engine-go": ["/v1/themes", "/v1/themes/resolve", "/v1/custom-domains", "/v1/email-templates", "/v1/pdf-templates", "/v1/stats"],
    "tenant-provisioning-go": ["/v1/provisioning-jobs", "/v1/environments", "/v1/provisioning-steps", "/v1/stats"],
    "branded-comms-py": ["/v1/emails", "/v1/sms", "/v1/push-notifications", "/v1/pdf-jobs", "/v1/stats", "/v1/emails/send"],
    "product-factory-rs": ["/v1/products", "/v1/stats"],
    "event-streaming-go": ["/v1/topics", "/v1/consumer-groups", "/v1/dlq", "/v1/schemas", "/v1/stats"],
    "graduated-rollout-rs": ["/v1/rollouts", "/v1/metrics", "/v1/stats"],
    "custom-domain-go": ["/v1/domains", "/v1/dns-records", "/v1/cert-events", "/v1/stats"],
    "tenant-metering-go": ["/v1/meters", "/v1/invoices", "/v1/stats"],
    "webhook-engine-go": ["/v1/endpoints", "/v1/deliveries", "/v1/stats"],
    "approval-workflow-go": ["/v1/chains", "/v1/requests", "/v1/stats"],
    "plugin-marketplace-py": ["/v1/plugins", "/v1/tenant-installs", "/v1/stats"],
  };
  return paths[serviceName] || ["/v1/stats"];
}
