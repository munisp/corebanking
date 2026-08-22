/**
 * End-to-End Testing Suite — dashboard over REAL test-run artifacts.
 *
 * MOCK-NEW-1 remediation: this module previously served hardcoded "passed"
 * results as if they were real test outcomes. That fabrication is removed.
 * Results are now loaded exclusively from a real Playwright JSON report
 * (reporter "json") produced by running the suite in infrastructure/new/e2e.
 *
 * Resolution order:
 *   1. process.env.E2E_RESULTS_PATH (absolute or repo-relative path)
 *   2. infrastructure/new/e2e/test-results/results.json (Playwright default)
 *
 * When no valid artifact exists, every endpoint fails closed with
 * 503 not_configured / results_unavailable. No synthetic data is served.
 */
import type { Express, Request, Response } from "express";
import { readFileSync } from "fs";

interface PlaywrightStats {
  expected?: number;
  unexpected?: number;
  flaky?: number;
  skipped?: number;
  duration?: number;
}

interface PlaywrightReport {
  stats?: PlaywrightStats;
  suites?: unknown[];
}

function resolveArtifactPath(): string {
  return (
    process.env.E2E_RESULTS_PATH ??
    "infrastructure/new/e2e/test-results/results.json"
  );
}

function loadTestReport():
  | { ok: true; path: string; report: PlaywrightReport }
  | { ok: false; path: string; reason: string } {
  const p = resolveArtifactPath();
  let raw: string;
  try {
    raw = readFileSync(p, "utf-8");
  } catch {
    return { ok: false, path: p, reason: "artifact_not_found" };
  }
  let report: PlaywrightReport;
  try {
    report = JSON.parse(raw) as PlaywrightReport;
  } catch {
    return { ok: false, path: p, reason: "artifact_invalid_json" };
  }
  if (!report || typeof report !== "object" || !report.stats) {
    return { ok: false, path: p, reason: "artifact_missing_stats" };
  }
  return { ok: true, path: p, report };
}

function resultsUnavailable(res: Response, path: string, reason: string) {
  return res.status(503).json({
    error: "results_unavailable",
    reason,
    artifact: path,
    message:
      "No real e2e test-run artifact found. Run the Playwright suite in " +
      "infrastructure/new/e2e with the JSON reporter, or set E2E_RESULTS_PATH.",
  });
}

export function registerE2ETestSuite(app: Express) {
  app.get("/api/tests/v1/suites", (_req: Request, res: Response) => {
    const r = loadTestReport();
    if (!r.ok) return resultsUnavailable(res, r.path, r.reason);
    res.json({
      items: r.report.suites ?? [],
      source: r.path,
      stats: r.report.stats,
    });
  });

  app.get("/api/tests/v1/cases", (req: Request, res: Response) => {
    const r = loadTestReport();
    if (!r.ok) return resultsUnavailable(res, r.path, r.reason);
    res.json({
      items: r.report.suites ?? [],
      filter: (req.query.suite as string) ?? null,
      source: r.path,
    });
  });

  app.get("/api/tests/v1/cases/:id", (req: Request, res: Response) => {
    const r = loadTestReport();
    if (!r.ok) return resultsUnavailable(res, r.path, r.reason);
    // Per-case drill-down requires a full Playwright JSON tree walk; not
    // fabricated. Return the raw suites tree and let callers filter.
    res.json({ id: req.params.id, source: r.path, suites: r.report.suites ?? [] });
  });

  app.post("/api/tests/v1/run", (_req: Request, res: Response) => {
    // Triggering a run requires a wired CI runner. Not fabricated.
    return res.status(501).json({
      error: "not_implemented",
      message:
        "No e2e test runner is wired to this endpoint. Run infrastructure/new/e2e " +
        "via CI/Playwright and publish the JSON report instead.",
    });
  });

  app.get("/api/tests/v1/stats", (_req: Request, res: Response) => {
    const r = loadTestReport();
    if (!r.ok) return resultsUnavailable(res, r.path, r.reason);
    const s = r.report.stats ?? {};
    const passed = s.expected ?? 0;
    const failed = s.unexpected ?? 0;
    const skipped = s.skipped ?? 0;
    const flaky = s.flaky ?? 0;
    const total = passed + failed + skipped + flaky;
    res.json({
      source: r.path,
      totalTests: total,
      totalPassed: passed,
      totalFailed: failed,
      totalSkipped: skipped,
      totalFlaky: flaky,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : null,
      durationMs: s.duration ?? null,
    });
  });
}
