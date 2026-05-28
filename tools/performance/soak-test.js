/**
 * 54Bank Soak Test (k6)
 * Sustained low-to-medium load for 1 hour to detect memory leaks and resource exhaustion.
 *
 * Usage:
 *   k6 run tools/performance/soak-test.js --duration=1h
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('soak_error_rate');
const memoryTrend = new Trend('memory_growth_indicator');
const gcPauses = new Counter('gc_pause_events');

export const options = {
  stages: [
    { duration: '2m', target: 20 },    // Warm up
    { duration: '56m', target: 20 },   // Sustain
    { duration: '2m', target: 0 },     // Cool down
  ],
  thresholds: {
    soak_error_rate: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

const CRITICAL_PATHS = [
  `${BASE_URL}:9100/healthz`,
  `${BASE_URL}:9128/healthz`,
  `${BASE_URL}:9154/healthz`,
  `${BASE_URL}:8010/healthz`,
  `${BASE_URL}:8020/healthz`,
];

export default function () {
  const url = CRITICAL_PATHS[Math.floor(Math.random() * CRITICAL_PATHS.length)];
  const res = http.get(url, { timeout: '15s' });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'latency < 1s': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!ok);

  // Simulate periodic heavier operations
  if (__ITER % 100 === 0) {
    const cacheRes = http.get(`${BASE_URL}:9100/v1/account-opening/cache-metrics`, { timeout: '10s' });
    check(cacheRes, { 'cache metrics available': (r) => r.status === 200 });
  }

  sleep(1 + Math.random());
}

export function handleSummary(data) {
  return {
    'stdout': `Soak test complete. Requests: ${data.metrics.http_reqs.values.count}, Error rate: ${(data.metrics.soak_error_rate?.values?.rate || 0) * 100}%\n`,
    'results/soak-test-results.json': JSON.stringify(data, null, 2),
  };
}
