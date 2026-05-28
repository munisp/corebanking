/**
 * 54Bank Load Test Suite (k6)
 * Tests key endpoints under load to identify performance bottlenecks.
 *
 * Usage:
 *   k6 run tools/performance/load-test.js
 *   k6 run tools/performance/load-test.js --vus=50 --duration=5m
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const requestDuration = new Trend('request_duration', true);
const healthCheckErrors = new Counter('health_check_errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up
    { duration: '2m', target: 50 },    // Sustained load
    { duration: '1m', target: 100 },   // Peak load
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],  // P95 <500ms, P99 <2s
    error_rate: ['rate<0.05'],                        // <5% errors
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

const ENDPOINTS = [
  // Core banking
  { name: 'accounts_health', url: `${BASE_URL}:9100/healthz`, method: 'GET' },
  { name: 'lending_health', url: `${BASE_URL}:9114/healthz`, method: 'GET' },
  { name: 'payments_health', url: `${BASE_URL}:9128/healthz`, method: 'GET' },

  // Compliance
  { name: 'kyc_health', url: `${BASE_URL}:9154/healthz`, method: 'GET' },
  { name: 'fraud_health', url: `${BASE_URL}:9208/healthz`, method: 'GET' },

  // Infrastructure
  { name: 'ml_inference_health', url: `${BASE_URL}:8010/healthz`, method: 'GET' },
  { name: 'lakehouse_health', url: `${BASE_URL}:8020/healthz`, method: 'GET' },

  // Cache metrics
  { name: 'cache_metrics', url: `${BASE_URL}:9100/v1/account-opening/cache-metrics`, method: 'GET' },

  // Alerts
  { name: 'alerts', url: `${BASE_URL}:9100/v1/account-opening/alerts`, method: 'GET' },

  // Degradation
  { name: 'degradation', url: `${BASE_URL}:9100/v1/degradation`, method: 'GET' },
];

export default function () {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];

  const startTime = Date.now();
  const res = http.get(endpoint.url, { timeout: '10s', tags: { name: endpoint.name } });
  const duration = Date.now() - startTime;

  requestDuration.add(duration);

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response body is not empty': (r) => r.body && r.body.length > 0,
  });

  errorRate.add(!success);
  if (!success) healthCheckErrors.add(1);

  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    total_requests: data.metrics.http_reqs.values.count,
    error_rate: data.metrics.error_rate ? data.metrics.error_rate.values.rate : 0,
    p95_latency_ms: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : 0,
    p99_latency_ms: data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'] : 0,
    avg_latency_ms: data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg : 0,
    thresholds_passed: Object.values(data.root_group.checks || {}).every(c => c.passes > 0),
  };

  return {
    'stdout': JSON.stringify(summary, null, 2) + '\n',
    'results/load-test-results.json': JSON.stringify(data, null, 2),
  };
}
