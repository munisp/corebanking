/**
 * k6 Load Test Suite for 54Bank Platform
 * 
 * Simulates Nigerian banking transaction volumes:
 * - Peak: 10,000 TPS (NIP network capacity)
 * - Sustained: 2,000 TPS (normal business hours)
 * - Burst: 15,000 TPS (salary day, end of month)
 * 
 * Usage:
 *   k6 run tests/load/k6_banking_load.js --env BASE_URL=http://api.54bank.local
 *   k6 run tests/load/k6_banking_load.js --env SCENARIO=salary_day
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const transferSuccess = new Rate('transfer_success_rate');
const transferLatency = new Trend('transfer_latency_ms');
const failedTransactions = new Counter('failed_transactions');
const successfulTransactions = new Counter('successful_transactions');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'test-token';

// Scenario configurations
export const options = {
  scenarios: {
    // Normal load: 500 VUs sustained
    normal_operations: {
      executor: 'constant-vus',
      vus: 500,
      duration: '5m',
      tags: { scenario: 'normal' },
    },
    // Ramp up to peak: 2000 VUs
    peak_hours: {
      executor: 'ramping-vus',
      startTime: '5m',
      startVUs: 500,
      stages: [
        { duration: '2m', target: 1000 },
        { duration: '5m', target: 2000 },
        { duration: '2m', target: 500 },
      ],
      tags: { scenario: 'peak' },
    },
    // Spike test: salary day simulation
    salary_day_spike: {
      executor: 'ramping-arrival-rate',
      startTime: '14m',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 5000,
      stages: [
        { duration: '30s', target: 5000 },  // Spike
        { duration: '2m', target: 5000 },   // Sustained peak
        { duration: '30s', target: 100 },   // Recovery
      ],
      tags: { scenario: 'salary_day' },
    },
  },
  thresholds: {
    // SLA: 99.9% success rate
    'transfer_success_rate': ['rate>0.999'],
    // SLA: p95 latency < 2s, p99 < 5s
    'transfer_latency_ms': ['p(95)<2000', 'p(99)<5000'],
    // SLA: < 0.1% error rate
    'http_req_failed': ['rate<0.001'],
    // SLA: p95 response time < 3s
    'http_req_duration': ['p(95)<3000'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${JWT_TOKEN}`,
};

const BANK_CODES = ['000001', '000002', '000004', '000007', '000009', '000010', '000011', '000013', '000014', '000015', '000016'];
const NETWORKS = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'];

function randomAccount() {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
}

function randomAmount() {
  // ₦100 to ₦500,000 in kobo
  return Math.floor(10000 + Math.random() * 50000000);
}

export default function () {
  const scenario = __ENV.SCENARIO || 'mixed';

  group('Health Checks', () => {
    const res = http.get(`${BASE_URL}/healthz`, { headers, timeout: '5s' });
    check(res, {
      'healthz returns 200': (r) => r.status === 200,
      'healthz latency < 100ms': (r) => r.timings.duration < 100,
    });
  });

  group('NIP Transfer', () => {
    const payload = JSON.stringify({
      source_account: randomAccount(),
      destination_account: randomAccount(),
      destination_bank_code: BANK_CODES[Math.floor(Math.random() * BANK_CODES.length)],
      amount_kobo: randomAmount(),
      narration: `Load test transfer ${Date.now()}`,
      channel: 'web',
      idempotency_key: `k6-${__VU}-${__ITER}-${Date.now()}`,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/v1/nip-gateway/transfer`, payload, { headers, timeout: '10s' });
    const latency = Date.now() - start;

    transferLatency.add(latency);

    const success = check(res, {
      'transfer status 200/201': (r) => r.status === 200 || r.status === 201,
      'transfer has reference': (r) => {
        try { return JSON.parse(r.body).reference !== undefined; }
        catch { return false; }
      },
      'transfer latency < 2s': (r) => r.timings.duration < 2000,
    });

    if (success) {
      transferSuccess.add(1);
      successfulTransactions.add(1);
    } else {
      transferSuccess.add(0);
      failedTransactions.add(1);
    }
  });

  group('Balance Enquiry', () => {
    const account = randomAccount();
    const res = http.get(`${BASE_URL}/v1/core-banking/balance/${account}`, { headers, timeout: '5s' });
    check(res, {
      'balance returns 200': (r) => r.status === 200,
      'balance latency < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('Bill Payment', () => {
    const payload = JSON.stringify({
      biller_code: 'IKEDC',
      customer_id: '041412345' + String(Math.floor(10 + Math.random() * 90)),
      amount_kobo: randomAmount(),
      source_account: randomAccount(),
      payment_item: 'prepaid',
      idempotency_key: `k6-bill-${__VU}-${__ITER}-${Date.now()}`,
    });

    const res = http.post(`${BASE_URL}/v1/bill-payment/pay`, payload, { headers, timeout: '10s' });
    check(res, {
      'bill payment status ok': (r) => r.status === 200 || r.status === 201,
    });
  });

  group('Airtime Purchase', () => {
    const payload = JSON.stringify({
      phone_number: `+234801${String(Math.floor(1000000 + Math.random() * 9000000))}`,
      network: NETWORKS[Math.floor(Math.random() * NETWORKS.length)],
      amount_kobo: [10000, 20000, 50000, 100000, 200000][Math.floor(Math.random() * 5)],
      source_account: randomAccount(),
      idempotency_key: `k6-airtime-${__VU}-${__ITER}-${Date.now()}`,
    });

    const res = http.post(`${BASE_URL}/v1/airtime-purchase/buy`, payload, { headers, timeout: '10s' });
    check(res, {
      'airtime purchase ok': (r) => r.status === 200 || r.status === 201,
    });
  });

  sleep(Math.random() * 0.5); // Think time: 0-500ms
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: '  ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const metrics = data.metrics;
  return `
=== 54Bank Load Test Results ===
Duration: ${data.state.testRunDurationMs}ms
VUs Max: ${data.metrics.vus_max?.values?.max || 'N/A'}

Transfer Success Rate: ${(metrics.transfer_success_rate?.values?.rate * 100 || 0).toFixed(2)}%
Transfer Latency p95: ${metrics.transfer_latency_ms?.values?.['p(95)'] || 'N/A'}ms
Transfer Latency p99: ${metrics.transfer_latency_ms?.values?.['p(99)'] || 'N/A'}ms

HTTP Request Duration p95: ${metrics.http_req_duration?.values?.['p(95)'] || 'N/A'}ms
HTTP Request Failed: ${(metrics.http_req_failed?.values?.rate * 100 || 0).toFixed(4)}%

Total Requests: ${metrics.http_reqs?.values?.count || 0}
Successful Transfers: ${metrics.successful_transactions?.values?.count || 0}
Failed Transactions: ${metrics.failed_transactions?.values?.count || 0}
================================
`;
}
