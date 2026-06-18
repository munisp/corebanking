/**
 * k6 Load Testing Script (#29)
 * Target: 1000 concurrent users for core banking operations
 *
 * Usage: k6 run tests/load/k6-load-test.js
 * Env: K6_BASE_URL=http://localhost:3000 k6 run tests/load/k6-load-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

// Custom metrics
const errorRate = new Rate("custom_error_rate");
const transactionDuration = new Trend("custom_transaction_duration");
const requestCounter = new Counter("custom_request_count");

export const options = {
  stages: [
    { duration: "30s", target: 50 },   // Ramp up
    { duration: "1m", target: 200 },    // Moderate load
    { duration: "2m", target: 500 },    // High load
    { duration: "3m", target: 1000 },   // Peak load
    { duration: "1m", target: 500 },    // Scale down
    { duration: "30s", target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
    http_req_failed: ["rate<0.05"],
    custom_error_rate: ["rate<0.1"],
  },
};

const headers = {
  "Content-Type": "application/json",
  "X-Api-Key": "dev-api-key-54bank",
};

export default function () {
  group("Health Check", () => {
    const res = http.get(`${BASE_URL}/healthz`);
    check(res, { "healthz status 200": (r) => r.status === 200 });
    requestCounter.add(1);
  });

  group("Dashboard Read", () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/platform/overview`, { headers });
    const duration = Date.now() - start;
    transactionDuration.add(duration);
    const ok = check(res, { "dashboard status 200": (r) => r.status === 200 });
    errorRate.add(!ok);
    requestCounter.add(1);
  });

  group("Customer List", () => {
    const res = http.get(`${BASE_URL}/api/customers`, { headers });
    check(res, { "customer list 200": (r) => r.status === 200 });
    requestCounter.add(1);
  });

  group("Security Policies", () => {
    const res = http.get(`${BASE_URL}/api/platform/security/policies`, { headers });
    check(res, { "policies accessible": (r) => r.status === 200 || r.status === 503 });
    requestCounter.add(1);
  });

  group("PBAC Evaluation", () => {
    const payload = JSON.stringify({
      subject: "user:teller-001",
      resource: "transactions",
      action: "read",
    });
    const res = http.post(`${BASE_URL}/api/platform/security/evaluate`, payload, { headers });
    check(res, { "PBAC evaluation responds": (r) => r.status === 200 || r.status === 503 });
    requestCounter.add(1);
  });

  group("Resilience Queue", () => {
    const res = http.get(`${BASE_URL}/api/platform/resilience/queue/stats`, { headers });
    check(res, { "queue stats responds": (r) => r.status === 200 || r.status === 503 });
    requestCounter.add(1);
  });

  group("Audit Trail", () => {
    const res = http.get(`${BASE_URL}/api/platform/audit?limit=10`, { headers });
    check(res, { "audit trail 200": (r) => r.status === 200 });
    requestCounter.add(1);
  });

  group("Full-text Search", () => {
    const res = http.get(`${BASE_URL}/api/platform/search?q=test&limit=5`, { headers });
    check(res, { "search responds": (r) => r.status === 200 });
    requestCounter.add(1);
  });

  group("Metrics Endpoint", () => {
    const res = http.get(`${BASE_URL}/metrics`);
    check(res, { "metrics 200": (r) => r.status === 200 });
    requestCounter.add(1);
  });

  sleep(Math.random() * 2 + 0.5);
}

export function handleSummary(data) {
  return {
    "stdout": textSummary(data, { indent: " ", enableColors: true }),
    "tests/load/results.json": JSON.stringify(data),
  };
}

function textSummary(data, opts) {
  const lines = [];
  lines.push("=== 54Bank Load Test Results ===");
  lines.push(`Total requests: ${data.metrics.http_reqs?.values?.count ?? 0}`);
  lines.push(`Error rate: ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  lines.push(`p95 latency: ${(data.metrics.http_req_duration?.values?.["p(95)"] ?? 0).toFixed(0)}ms`);
  lines.push(`p99 latency: ${(data.metrics.http_req_duration?.values?.["p(99)"] ?? 0).toFixed(0)}ms`);
  return lines.join("\n");
}
