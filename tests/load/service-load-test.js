/**
 * Service-Level Load Testing — 54Bank Platform
 * Tests individual microservice endpoints under load.
 * 
 * Usage: 
 *   SERVICE_URL=http://localhost:8101 k6 run tests/load/service-load-test.js
 *   SERVICE_URL=http://core-banking-go:8100 k6 run tests/load/service-load-test.js
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

const SERVICE_URL = __ENV.SERVICE_URL || "http://localhost:8100";
const JWT_TOKEN = __ENV.JWT_TOKEN || "Bearer test-token-54bank";

const errorRate = new Rate("service_error_rate");
const latency = new Trend("service_latency");
const throughput = new Counter("service_requests");

export const options = {
  scenarios: {
    smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
      startTime: "0s",
    },
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "3m", target: 100 },
        { duration: "1m", target: 200 },
        { duration: "1m", target: 0 },
      ],
      startTime: "30s",
    },
    stress: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { duration: "1m", target: 50 },
        { duration: "2m", target: 200 },
        { duration: "2m", target: 500 },
        { duration: "1m", target: 0 },
      ],
      startTime: "6m30s",
    },
  },
  thresholds: {
    service_latency: ["p(95)<500", "p(99)<2000"],
    service_error_rate: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

const headers = {
  "Content-Type": "application/json",
  Authorization: JWT_TOKEN,
  "X-Trace-Id": `k6-${Date.now()}`,
};

export default function () {
  group("Health Probes", () => {
    const health = http.get(`${SERVICE_URL}/healthz`);
    check(health, { "healthz 200": (r) => r.status === 200 });

    const ready = http.get(`${SERVICE_URL}/readyz`);
    check(ready, { "readyz 200": (r) => r.status === 200 });

    const live = http.get(`${SERVICE_URL}/livez`);
    check(live, { "livez 200": (r) => r.status === 200 });
    throughput.add(3);
  });

  group("Metrics", () => {
    const res = http.get(`${SERVICE_URL}/metrics`);
    check(res, {
      "metrics 200": (r) => r.status === 200,
      "has request count": (r) => r.body.includes("requests_total"),
    });
    throughput.add(1);
  });

  group("Domain Endpoint", () => {
    const start = Date.now();
    const payload = JSON.stringify({
      account: "0123456789",
      amount: 50000,
      currency: "NGN",
      type: "transfer",
    });
    const res = http.post(`${SERVICE_URL}/v1/process`, payload, { headers });
    const dur = Date.now() - start;
    latency.add(dur);
    const ok = check(res, {
      "domain 200": (r) => r.status === 200,
      "has result": (r) => {
        try { return JSON.parse(r.body).result !== undefined; } catch { return false; }
      },
    });
    errorRate.add(!ok);
    throughput.add(1);
  });

  group("List Records (with auth)", () => {
    const start = Date.now();
    const res = http.get(`${SERVICE_URL}/v1/records?page=1&limit=20`, { headers });
    latency.add(Date.now() - start);
    check(res, {
      "records 200": (r) => r.status === 200,
      "returns array": (r) => {
        try { return Array.isArray(JSON.parse(r.body).items); } catch { return false; }
      },
    });
    throughput.add(1);
  });

  group("Auth Required", () => {
    const res = http.get(`${SERVICE_URL}/v1/records`);
    check(res, {
      "no-auth returns 401": (r) => r.status === 401,
    });
    throughput.add(1);
  });

  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "tests/load/service-results.json": JSON.stringify(data),
  };
}

function textSummary(data) {
  const lines = [];
  lines.push("=== 54Bank Service Load Test ===");
  lines.push(`Service: ${SERVICE_URL}`);
  lines.push(`Total requests: ${data.metrics.http_reqs?.values?.count ?? 0}`);
  lines.push(`Error rate: ${((data.metrics.service_error_rate?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  lines.push(`p95 latency: ${(data.metrics.service_latency?.values?.["p(95)"] ?? 0).toFixed(0)}ms`);
  lines.push(`p99 latency: ${(data.metrics.service_latency?.values?.["p(99)"] ?? 0).toFixed(0)}ms`);
  lines.push(`Throughput: ${data.metrics.service_requests?.values?.count ?? 0} requests`);
  return lines.join("\n");
}
