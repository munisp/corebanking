// Integration Test Harness — Automated test runner for all microservices
import type { Express, Request, Response } from "express";

interface TestCase {
  name: string;
  service: string;
  method: string;
  endpoint: string;
  body?: Record<string, unknown>;
  expectedStatus: number;
  assertions: { field: string; operator: string; value: unknown }[];
}

interface TestResult {
  name: string;
  passed: boolean;
  responseMs: number;
  actualStatus: number;
  expectedStatus: number;
  failureReason?: string;
}

const testSuite: TestCase[] = [
  {
    name: "Islamic Banking — List Sukuk", service: "gateway", method: "GET",
    endpoint: "/api/platform/islamic/sukuk", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 4 }],
  },
  {
    name: "Islamic Banking — Murabaha Calculate", service: "gateway", method: "POST",
    endpoint: "/api/platform/islamic/murabaha/calculate",
    body: { costPrice: 10000000, profitMarginPct: 15, tenorMonths: 36 },
    expectedStatus: 200,
    assertions: [
      { field: "totalProfit", operator: "gt", value: 0 },
      { field: "monthlyInstallment", operator: "gt", value: 0 },
    ],
  },
  {
    name: "KYC — Watchlist Screening", service: "gateway", method: "GET",
    endpoint: "/api/platform/kyc/watchlist", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 5 }],
  },
  {
    name: "Card Tokens — List", service: "gateway", method: "GET",
    endpoint: "/api/platform/cards/tokens", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 4 }],
  },
  {
    name: "Workflow Definitions — List", service: "gateway", method: "GET",
    endpoint: "/api/platform/workflow/definitions", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 4 }],
  },
  {
    name: "Cheque Imaging — Stats", service: "gateway", method: "GET",
    endpoint: "/api/platform/cheque-imaging/stats", expectedStatus: 200,
    assertions: [
      { field: "total", operator: "gte", value: 5 },
      { field: "avgOCRConfidence", operator: "gt", value: 0.5 },
    ],
  },
  {
    name: "LC Amendments — List", service: "gateway", method: "GET",
    endpoint: "/api/platform/trade-finance/lc-amendments", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 5 }],
  },
  {
    name: "Service Health — List", service: "gateway", method: "GET",
    endpoint: "/api/platform/health/services", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 30 }],
  },
  {
    name: "Seed Registry — List", service: "gateway", method: "GET",
    endpoint: "/api/admin/seed-registry", expectedStatus: 200,
    assertions: [{ field: "total", operator: "gte", value: 10 }],
  },
  {
    name: "MICR Validation — Valid", service: "gateway", method: "POST",
    endpoint: "/api/platform/cheque-imaging/validate-micr",
    body: { micrLine: "C000145C A058001A 0012345678C" },
    expectedStatus: 200,
    assertions: [
      { field: "valid", operator: "eq", value: true },
      { field: "chequeNumber", operator: "eq", value: "000145" },
    ],
  },
  {
    name: "MICR Validation — Invalid", service: "gateway", method: "POST",
    endpoint: "/api/platform/cheque-imaging/validate-micr",
    body: { micrLine: "INVALID-MICR" },
    expectedStatus: 200,
    assertions: [{ field: "valid", operator: "eq", value: false }],
  },
  {
    name: "Murabaha — Sharia Limit", service: "gateway", method: "POST",
    endpoint: "/api/platform/islamic/murabaha/calculate",
    body: { costPrice: 1000000, profitMarginPct: 55, tenorMonths: 12 },
    expectedStatus: 400,
    assertions: [],
  },
];

function checkAssertion(data: Record<string, unknown>, assertion: { field: string; operator: string; value: unknown }): boolean {
  const actual = data[assertion.field];
  switch (assertion.operator) {
    case "eq": return actual === assertion.value;
    case "gt": return (actual as number) > (assertion.value as number);
    case "gte": return (actual as number) >= (assertion.value as number);
    case "lt": return (actual as number) < (assertion.value as number);
    case "contains": return String(actual).includes(String(assertion.value));
    default: return false;
  }
}

export function registerIntegrationTestRoutes(app: Express): void {
  app.get("/api/admin/integration-tests", (_req: Request, res: Response) => {
    res.json({ items: testSuite, total: testSuite.length });
  });

  app.post("/api/admin/integration-tests/run", async (_req: Request, res: Response) => {
    const results: TestResult[] = [];
    for (const test of testSuite) {
      const start = Date.now();
      try {
        const options: RequestInit = { method: test.method, headers: { "Content-Type": "application/json" } };
        if (test.body) options.body = JSON.stringify(test.body);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`http://localhost:3000${test.endpoint}`, { ...options, signal: controller.signal });
        clearTimeout(timeout);
        const elapsed = Date.now() - start;
        const data = await resp.json() as Record<string, unknown>;
        let passed = resp.status === test.expectedStatus;
        let failureReason: string | undefined;
        if (passed) {
          for (const assertion of test.assertions) {
            if (!checkAssertion(data, assertion)) {
              passed = false;
              failureReason = `Assertion failed: ${assertion.field} ${assertion.operator} ${assertion.value} (actual: ${data[assertion.field]})`;
              break;
            }
          }
        } else {
          failureReason = `Expected status ${test.expectedStatus}, got ${resp.status}`;
        }
        results.push({ name: test.name, passed, responseMs: elapsed, actualStatus: resp.status, expectedStatus: test.expectedStatus, failureReason });
      } catch (err) {
        results.push({
          name: test.name, passed: false, responseMs: Date.now() - start,
          actualStatus: 0, expectedStatus: test.expectedStatus,
          failureReason: `Error: ${err instanceof Error ? err.message : "Unknown"}`,
        });
      }
    }
    const passCount = results.filter(r => r.passed).length;
    const avgMs = results.reduce((s, r) => s + r.responseMs, 0) / results.length;
    res.json({
      results, summary: {
        total: results.length, passed: passCount, failed: results.length - passCount,
        passRate: Math.round((passCount / results.length) * 100),
        avgResponseMs: Math.round(avgMs),
      },
    });
  });
}
