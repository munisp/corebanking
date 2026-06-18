// Seed Data Reset — Admin endpoint to reset all services to initial seeded state
import type { Express, Request, Response } from "express";

interface ServiceRegistry {
  name: string;
  port: number;
  language: string;
  resetEndpoint: string;
  seededRecords: number;
}

const serviceRegistry: ServiceRegistry[] = [
  { name: "escrow-go", port: 8186, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 4 },
  { name: "qr-payments-go", port: 8187, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "chatbot-py", port: 8179, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 4 },
  { name: "insurance-py", port: 8194, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "teller-operations-go", port: 8091, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 10 },
  { name: "trade-finance-go", port: 8093, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "islamic-banking-py", port: 8092, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 8 },
  { name: "interest-rate-engine-go", port: 8131, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 6 },
  { name: "cheque-clearing-go", port: 8132, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "nibss-direct-debit-go", port: 8134, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 4 },
  { name: "customer-360-py", port: 8133, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 6 },
  { name: "diaspora-banking-py", port: 8135, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "kyc-aml-screening-py", port: 8136, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 10 },
  { name: "loan-origination-go", port: 8137, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "account-statement-go", port: 8138, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 5 },
  { name: "salary-processing-go", port: 8150, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 3 },
  { name: "pos-terminal-go", port: 8153, language: "go", resetEndpoint: "/v1/admin/reset", seededRecords: 7 },
  { name: "document-management-py", port: 8152, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 8 },
  { name: "customer-feedback-py", port: 8155, language: "python", resetEndpoint: "/v1/admin/reset", seededRecords: 8 },
];

export function registerSeedDataResetRoutes(app: Express): void {
  app.get("/api/admin/seed-registry", (_req: Request, res: Response) => {
    const totalSeeded = serviceRegistry.reduce((s, r) => s + r.seededRecords, 0);
    const byLanguage: Record<string, number> = {};
    for (const svc of serviceRegistry) {
      byLanguage[svc.language] = (byLanguage[svc.language] || 0) + 1;
    }
    res.json({
      items: serviceRegistry, total: serviceRegistry.length,
      totalSeededRecords: totalSeeded, byLanguage,
    });
  });

  app.post("/api/admin/seed-reset", async (req: Request, res: Response) => {
    const { services } = req.body;
    const targets = services
      ? serviceRegistry.filter(s => services.includes(s.name))
      : serviceRegistry;

    const results: { service: string; status: string; error?: string }[] = [];
    for (const svc of targets) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch(`http://localhost:${svc.port}${svc.resetEndpoint}`, {
          method: "POST", signal: controller.signal,
        });
        clearTimeout(timeout);
        results.push({ service: svc.name, status: resp.ok ? "reset" : "error" });
      } catch {
        results.push({ service: svc.name, status: "offline", error: "Service unreachable" });
      }
    }
    const resetCount = results.filter(r => r.status === "reset").length;
    const offlineCount = results.filter(r => r.status === "offline").length;
    res.json({
      results, summary: { total: results.length, reset: resetCount, offline: offlineCount },
    });
  });

  app.get("/api/admin/seed-health", async (_req: Request, res: Response) => {
    const checks: { service: string; port: number; healthy: boolean; responseMs: number }[] = [];
    for (const svc of serviceRegistry) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(`http://localhost:${svc.port}/healthz`, { signal: controller.signal });
        clearTimeout(timeout);
        checks.push({ service: svc.name, port: svc.port, healthy: resp.ok, responseMs: Date.now() - start });
      } catch {
        checks.push({ service: svc.name, port: svc.port, healthy: false, responseMs: Date.now() - start });
      }
    }
    const healthy = checks.filter(c => c.healthy).length;
    res.json({ checks, summary: { total: checks.length, healthy, unhealthy: checks.length - healthy } });
  });
}
