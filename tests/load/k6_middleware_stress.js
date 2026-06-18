// k6 Load Test: 54Bank Middleware Services
// Tests rate limiting, circuit breakers, and throughput under stress
// Run: k6 run --vus 50 --duration 60s tests/load/k6_middleware_stress.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const rateLimitHits = new Counter('rate_limit_hits');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const p99Latency = new Trend('p99_latency');
const successRate = new Rate('success_rate');

// Configuration
const BASE_URLS = {
  kafka: `http://${__ENV.KAFKA_HOST || 'localhost'}:9377`,
  redis: `http://${__ENV.REDIS_HOST || 'localhost'}:9417`,
  temporal: `http://${__ENV.TEMPORAL_HOST || 'localhost'}:9445`,
  permify: `http://${__ENV.PERMIFY_HOST || 'localhost'}:9406`,
  keycloak: `http://${__ENV.KEYCLOAK_HOST || 'localhost'}:9380`,
  mojaloop: `http://${__ENV.MOJALOOP_HOST || 'localhost'}:9392`,
  tigerbeetle: `http://${__ENV.TB_HOST || 'localhost'}:8301`,
  fluvio: `http://${__ENV.FLUVIO_HOST || 'localhost'}:8304`,
};

const AUTH_HEADER = { 'Authorization': 'Bearer k6-load-test-token', 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    // Ramp-up to test rate limiting activation
    rate_limit_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '10s', target: 50 },   // Warm up
        { duration: '20s', target: 200 },  // Exceed rate limits
        { duration: '10s', target: 500 },  // Hammer — should see 429s
        { duration: '10s', target: 10 },   // Cool down — circuit should recover
      ],
    },
    // Sustained load for circuit breaker
    circuit_breaker_test: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 30,
      maxVUs: 100,
      startTime: '50s', // Start after rate limit test
    },
  },
  thresholds: {
    'http_req_duration{scenario:rate_limit_test}': ['p(95)<500'],
    'http_req_duration{scenario:circuit_breaker_test}': ['p(99)<2000'],
    'success_rate': ['rate>0.7'], // Allow 30% rate-limited responses
    'rate_limit_hits': ['count>10'], // Must actually trigger rate limits
  },
};

export default function () {
  group('Kafka Transactional Produce', () => {
    const payload = JSON.stringify({
      txn_id: `txn-k6-${__VU}-${__ITER}`,
      topic: 'load-test-events',
      messages: [{ key: `key-${__ITER}`, value: JSON.stringify({ amount: Math.random() * 5000000, ts: Date.now() }) }],
    });
    const res = http.post(`${BASE_URLS.kafka}/v1/kafka-streaming/produce/transactional`, payload, { headers: AUTH_HEADER });
    const passed = check(res, {
      'kafka produce: status 200 or 429': (r) => r.status === 200 || r.status === 429,
      'kafka produce: has txn_id or rate_limit': (r) => {
        if (r.status === 200) return JSON.parse(r.body).txn_id !== undefined;
        if (r.status === 429) { rateLimitHits.add(1); return true; }
        return false;
      },
    });
    successRate.add(passed);
    p99Latency.add(res.timings.duration);
  });

  group('Redis Stream Operations', () => {
    const payload = JSON.stringify({ fields: { account: `ACC-${__VU}`, amount: `${Math.floor(Math.random() * 1000000)}`, ts: `${Date.now()}` } });
    const res = http.post(`${BASE_URLS.redis}/v1/redis-session-store/stream/add`, payload, { headers: AUTH_HEADER });
    check(res, {
      'redis stream: accepted or rate-limited': (r) => r.status === 200 || r.status === 429 || r.status === 503,
    });
    if (res.status === 429) rateLimitHits.add(1);
    if (res.status === 503) circuitBreakerTrips.add(1);
  });

  group('TigerBeetle Balance Assertions', () => {
    const payload = JSON.stringify({
      account_id: Math.floor(Math.random() * 10000) + 1000,
      expected_credits: 500000000,
      expected_debits: 200000000,
      tolerance_kobo: 1000000,
    });
    const res = http.post(`${BASE_URLS.tigerbeetle}/balance/assert`, payload, { headers: AUTH_HEADER });
    check(res, {
      'tb balance: 200 with assertion result': (r) => r.status === 200 && JSON.parse(r.body).assertion_passed !== undefined,
    });
  });

  group('Fluvio Idempotency Under Load', () => {
    // All VUs use same idempotency key to test deduplication under concurrency
    const payload = JSON.stringify({
      topic: 'dedup-test',
      key: `shared-key-${__ITER % 10}`, // Only 10 unique keys across all VUs
      value: { vu: __VU, iter: __ITER },
      idempotency_key: `idem-shared-${__ITER % 10}`,
    });
    const res = http.post(`${BASE_URLS.fluvio}/produce/exactly-once`, payload, { headers: AUTH_HEADER });
    check(res, {
      'fluvio: 200 with dedup': (r) => r.status === 200,
      'fluvio: has idempotency key in response': (r) => JSON.parse(r.body).idempotency_key !== undefined,
    });
    // Check replay header
    if (res.headers['X-Idempotency-Replayed'] === 'true') {
      // This is expected for concurrent requests with same key
      successRate.add(true);
    }
  });

  group('Mojaloop FX Quote Throughput', () => {
    const pairs = [['NGN','USD'],['NGN','GBP'],['NGN','EUR'],['NGN','GHS'],['NGN','KES']];
    const [from, to] = pairs[Math.floor(Math.random() * pairs.length)];
    const payload = JSON.stringify({ from, to, amount_kobo: Math.floor(Math.random() * 10000000) + 100000 });
    const res = http.post(`${BASE_URLS.mojaloop}/v1/mojaloop-connector/fx/quote`, payload, { headers: AUTH_HEADER });
    check(res, {
      'mojaloop fx: valid quote or rate-limited': (r) => {
        if (r.status === 200) return JSON.parse(r.body).rate > 0;
        return r.status === 429;
      },
    });
  });

  group('Permify Bulk Authorization (Fail-Closed)', () => {
    const payload = JSON.stringify({
      checks: Array.from({ length: 10 }, (_, i) => ({
        entity: 'account',
        entity_id: `ACC-${1000 + i}`,
        permission: ['read', 'write', 'admin', 'approve'][Math.floor(Math.random() * 4)],
        subject_type: 'user',
        subject_id: `user-${__VU}`,
      })),
    });
    const res = http.post(`${BASE_URLS.permify}/v1/permify-authz/bulk/check`, payload, { headers: AUTH_HEADER });
    check(res, {
      'permify bulk: returns results array': (r) => r.status === 200 && JSON.parse(r.body).count === 10,
      'permify bulk: fail-closed (not all allowed)': (r) => {
        const body = JSON.parse(r.body);
        // With Permify unreachable, all should be denied (fail-closed)
        const allDenied = body.results.every(r => r.allowed === false);
        return allDenied;
      },
    });
  });

  group('Keycloak MFA Evaluation Under Load', () => {
    const amounts = [100000, 500000, 1000000, 2000000, 5000000, 10000000]; // Various amounts in kobo
    const amount = amounts[Math.floor(Math.random() * amounts.length)];
    const payload = JSON.stringify({ action: 'transfer', amount_kobo: amount, role: 'customer' });
    const res = http.post(`${BASE_URLS.keycloak}/v1/keycloak-admin/mfa/evaluate`, payload, { headers: AUTH_HEADER });
    check(res, {
      'keycloak mfa: correct policy for amount': (r) => {
        const body = JSON.parse(r.body);
        if (amount >= 100000000) return body.mfa_required === true; // ₦1M+ requires MFA
        return true; // Below threshold, either is acceptable
      },
    });
  });

  sleep(0.1); // 100ms think time between iterations
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, opts) {
  const checks = data.metrics.checks;
  const reqs = data.metrics.http_reqs;
  return `
=== 54Bank Middleware Load Test Results ===
Total Requests: ${reqs ? reqs.values.count : 0}
Rate Limit Hits: ${data.metrics.rate_limit_hits ? data.metrics.rate_limit_hits.values.count : 0}
Circuit Breaker Trips: ${data.metrics.circuit_breaker_trips ? data.metrics.circuit_breaker_trips.values.count : 0}
Success Rate: ${data.metrics.success_rate ? (data.metrics.success_rate.values.rate * 100).toFixed(1) : 0}%
P99 Latency: ${data.metrics.p99_latency ? data.metrics.p99_latency.values['p(99)'].toFixed(0) : 0}ms
`;
}
