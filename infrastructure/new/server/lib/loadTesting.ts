/**
 * Performance Load Testing — k6/Locust benchmark surfaces.
 *
 * LOADTEST-FAKE remediation: this module previously served hardcoded,
 * fabricated "completed" load-test results (latency percentiles, throughput,
 * pass/fail) for runs that never happened. Fake performance evidence is
 * release-blocking, so all fabricated data has been removed.
 *
 * Current behavior (honest by construction):
 * - Scenario DEFINITIONS are served as configuration with status "defined".
 * - Results, bottlenecks and stats are served ONLY when a real results file
 *   produced by an actual k6/locust run is provided via the
 *   LOAD_TEST_RESULTS_FILE env var (JSON: { results: [], bottlenecks: [] }).
 * - When no real results file is configured/readable, those endpoints respond
 *   503 with status "not_run" — this API never invents performance data.
 */
import { readFileSync } from "fs";
import type { Express, Request, Response } from "express";

interface LoadTestScenario { id: string; name: string; virtualUsers: number; durationSec: number; rampUpSec: number; targetEndpoint: string; method: string; thresholds: Record<string, string>; status: string; }
interface LoadTestResult { id: string; scenarioId: string; startedAt: string; completedAt: string; totalRequests: number; successRate: number; avgLatencyMs: number; p50LatencyMs: number; p95LatencyMs: number; p99LatencyMs: number; maxLatencyMs: number; throughputRps: number; errorsTotal: number; errorsByType: Record<string, number>; peakMemoryMb: number; peakCpuPercent: number; passed: boolean; }
interface BottleneckReport { service: string; metric: string; current: number; threshold: number; severity: string; recommendation: string; }

/**
 * Scenario catalog. These are test DEFINITIONS only — status "defined" means
 * "configured, never executed by this service". A scenario may only be
 * reported as "completed" when a matching real result exists (see below).
 */
const SCENARIOS: LoadTestScenario[] = [
  { id: "LT-001", name: "Account Query Stress", virtualUsers: 5000, durationSec: 300, rampUpSec: 60, targetEndpoint: "/api/accounts", method: "GET", thresholds: { p99_latency: "<50ms", error_rate: "<0.1%", throughput: ">2000rps" }, status: "defined" },
  { id: "LT-002", name: "Transfer Throughput", virtualUsers: 2000, durationSec: 300, rampUpSec: 30, targetEndpoint: "/api/transfers", method: "POST", thresholds: { p99_latency: "<200ms", error_rate: "<0.5%", throughput: ">500rps" }, status: "defined" },
  { id: "LT-003", name: "Mixed Workload (Realistic)", virtualUsers: 10000, durationSec: 600, rampUpSec: 120, targetEndpoint: "mixed", method: "mixed", thresholds: { p99_latency: "<500ms", error_rate: "<1%", throughput: ">5000rps" }, status: "defined" },
  { id: "LT-004", name: "Spike Test (10x Traffic)", virtualUsers: 50000, durationSec: 120, rampUpSec: 10, targetEndpoint: "mixed", method: "mixed", thresholds: { p99_latency: "<2000ms", error_rate: "<5%", throughput: ">3000rps" }, status: "defined" },
  { id: "LT-005", name: "Soak Test (24h)", virtualUsers: 1000, durationSec: 86400, rampUpSec: 300, targetEndpoint: "mixed", method: "mixed", thresholds: { p99_latency: "<100ms", error_rate: "<0.01%", memory_leak: "none" }, status: "defined" },
];

interface RealResultsFile {
  results?: LoadTestResult[];
  bottlenecks?: BottleneckReport[];
}

/**
 * Load results produced by a REAL k6/locust execution (typically generated in
 * CI and mounted into the container). Returns null when not configured or
 * unreadable — callers must then report "not_run", never fabricate.
 */
function loadRealResults(): RealResultsFile | null {
  const file = process.env.LOAD_TEST_RESULTS_FILE;
  if (!file) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as RealResultsFile;
    if (!parsed || (!Array.isArray(parsed.results) && !Array.isArray(parsed.bottlenecks))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function notRun(res: Response) {
  return res.status(503).json({
    status: "not_run",
    error: "load_test_results_unavailable",
    message:
      "No real load-test results are available. Execute the k6/locust scenarios " +
      "(e.g. in CI) and expose their output via the LOAD_TEST_RESULTS_FILE env var.",
  });
}

export function registerLoadTesting(app: Express) {
  app.get("/api/load-tests/v1/scenarios", (_req: Request, res: Response) => {
    const real = loadRealResults();
    const completedIds = new Set((real?.results ?? []).map((r) => r.scenarioId));
    // Scenario status reflects reality: "completed" only when a real result
    // record exists for it, otherwise "defined".
    const items = SCENARIOS.map((s) => ({ ...s, status: completedIds.has(s.id) ? "completed" : "defined" }));
    res.json({ items, total: items.length });
  });

  app.get("/api/load-tests/v1/results", (_req: Request, res: Response) => {
    const real = loadRealResults();
    if (!real || !Array.isArray(real.results)) return notRun(res);
    res.json({ items: real.results, total: real.results.length });
  });

  app.get("/api/load-tests/v1/results/:id", (req: Request, res: Response) => {
    const real = loadRealResults();
    if (!real || !Array.isArray(real.results)) return notRun(res);
    const r = real.results.find((x) => x.id === req.params.id);
    return r ? res.json(r) : res.status(404).json({ error: "Not found" });
  });

  app.get("/api/load-tests/v1/bottlenecks", (_req: Request, res: Response) => {
    const real = loadRealResults();
    if (!real || !Array.isArray(real.bottlenecks)) return notRun(res);
    res.json({ items: real.bottlenecks, total: real.bottlenecks.length });
  });

  app.get("/api/load-tests/v1/stats", (_req: Request, res: Response) => {
    const real = loadRealResults();
    const results = real?.results ?? [];
    if (!real || results.length === 0) return notRun(res);
    res.json({
      scenariosRun: results.length,
      allPassed: results.every((r) => r.passed),
      avgP99Ms: Math.round(results.reduce((s, r) => s + r.p99LatencyMs, 0) / results.length),
      maxThroughputRps: Math.max(...results.map((r) => r.throughputRps)),
      avgSuccessRate: (results.reduce((s, r) => s + r.successRate, 0) / results.length).toFixed(2),
      bottlenecks: real.bottlenecks?.length ?? 0,
      lastRunAt: results.map((r) => r.completedAt).sort().reverse()[0],
    });
  });
}
