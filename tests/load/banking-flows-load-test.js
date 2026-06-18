/**
 * k6 Load Testing — Critical Banking Flows
 * Tests actual microservice endpoints under load:
 *   - Account opening + KYC
 *   - Loan origination + credit scoring
 *   - Payments (NIP/NEFT/RTGS)
 *   - AML screening
 *
 * Usage:
 *   k6 run tests/load/banking-flows-load-test.js
 *   K6_SCENARIO=smoke k6 run tests/load/banking-flows-load-test.js
 *   K6_SCENARIO=soak  k6 run tests/load/banking-flows-load-test.js
 *
 * Environment:
 *   ACCOUNT_OPENING_URL  (default: http://localhost:8101)
 *   CORE_BANKING_URL     (default: http://localhost:8100)
 *   KYC_URL              (default: http://localhost:8201)
 *   CREDIT_SCORING_URL   (default: http://localhost:8202)
 *   PAYMENTS_HUB_URL     (default: http://localhost:8103)
 *   AML_ENGINE_URL       (default: http://localhost:8127)
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";

// Service URLs
const ACCOUNT_OPENING = __ENV.ACCOUNT_OPENING_URL || "http://localhost:8101";
const CORE_BANKING    = __ENV.CORE_BANKING_URL     || "http://localhost:8100";
const KYC             = __ENV.KYC_URL              || "http://localhost:8201";
const CREDIT_SCORING  = __ENV.CREDIT_SCORING_URL   || "http://localhost:8202";
const PAYMENTS_HUB    = __ENV.PAYMENTS_HUB_URL     || "http://localhost:8103";
const AML_ENGINE      = __ENV.AML_ENGINE_URL       || "http://localhost:8127";

// Metrics
const accountOpenRate = new Rate("account_open_success");
const loanApprovalRate = new Rate("loan_approval_success");
const paymentSuccessRate = new Rate("payment_success");
const amlScreeningDuration = new Trend("aml_screening_duration_ms");
const kycVerifyDuration = new Trend("kyc_verify_duration_ms");
const txnCount = new Counter("total_banking_transactions");

const scenario = __ENV.K6_SCENARIO || "load";

const SCENARIOS = {
  smoke: {
    stages: [
      { duration: "10s", target: 5 },
      { duration: "30s", target: 5 },
      { duration: "10s", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<3000"],
      http_req_failed: ["rate<0.1"],
    },
  },
  load: {
    stages: [
      { duration: "30s", target: 50 },
      { duration: "2m",  target: 200 },
      { duration: "3m",  target: 500 },
      { duration: "1m",  target: 200 },
      { duration: "30s", target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<2000", "p(99)<5000"],
      http_req_failed: ["rate<0.05"],
      account_open_success: ["rate>0.95"],
      payment_success: ["rate>0.95"],
    },
  },
  stress: {
    stages: [
      { duration: "30s", target: 100 },
      { duration: "1m",  target: 500 },
      { duration: "2m",  target: 1000 },
      { duration: "2m",  target: 1500 },
      { duration: "1m",  target: 2000 },
      { duration: "1m",  target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<5000"],
      http_req_failed: ["rate<0.15"],
    },
  },
  soak: {
    stages: [
      { duration: "2m",  target: 200 },
      { duration: "30m", target: 200 },
      { duration: "2m",  target: 0 },
    ],
    thresholds: {
      http_req_duration: ["p(95)<3000"],
      http_req_failed: ["rate<0.05"],
    },
  },
};

const selected = SCENARIOS[scenario] || SCENARIOS.load;
export const options = {
  stages: selected.stages,
  thresholds: selected.thresholds,
};

const headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsb2FkLXRlc3QiLCJyb2xlIjoiYWRtaW4ifQ.test",
};

function randomBVN() {
  return String(Math.floor(10000000000 + Math.random() * 89999999999));
}

function randomAmount(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function randomAccountNumber() {
  return String(Math.floor(1000000000 + Math.random() * 8999999999));
}

export default function () {
  // Rotate through banking flows
  const flow = Math.random();

  if (flow < 0.25) {
    accountOpeningFlow();
  } else if (flow < 0.50) {
    loanOriginationFlow();
  } else if (flow < 0.75) {
    paymentFlow();
  } else {
    amlScreeningFlow();
  }

  sleep(Math.random() * 1.5 + 0.3);
}

function accountOpeningFlow() {
  group("Account Opening + KYC", () => {
    // 1. Health check
    const health = http.get(`${ACCOUNT_OPENING}/healthz`);
    check(health, { "account-opening healthy": (r) => r.status === 200 });

    // 2. Apply for account
    const bvn = randomBVN();
    const appPayload = JSON.stringify({
      customerName: `Load Test User ${Date.now()}`,
      accountType: "savings",
      tier: "tier1",
      bvn: bvn,
      phone: `+2348${String(Math.floor(Math.random() * 900000000 + 100000000))}`,
      email: `load-test-${Date.now()}@test.54bank.ng`,
    });
    const applyRes = http.post(`${ACCOUNT_OPENING}/v1/accounts/apply`, appPayload, { headers });
    const opened = check(applyRes, {
      "account apply 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    accountOpenRate.add(opened);
    txnCount.add(1);

    // 3. KYC BVN verification
    const kycStart = Date.now();
    const kycPayload = JSON.stringify({ bvn: bvn, firstName: "Load", lastName: "Test" });
    const kycRes = http.post(`${KYC}/v1/verify/bvn`, kycPayload, { headers });
    kycVerifyDuration.add(Date.now() - kycStart);
    check(kycRes, { "BVN verify 2xx": (r) => r.status >= 200 && r.status < 300 });
    txnCount.add(1);

    // 4. List accounts
    const listRes = http.get(`${ACCOUNT_OPENING}/v1/records`, { headers });
    check(listRes, { "account list 200": (r) => r.status === 200 });
  });
}

function loanOriginationFlow() {
  group("Loan Origination + Credit Score", () => {
    // 1. Credit score check
    const scorePayload = JSON.stringify({
      income: randomAmount(200000, 5000000),
      debt: randomAmount(0, 1000000),
      employment_years: Math.floor(Math.random() * 20),
      loan_history_count: Math.floor(Math.random() * 10),
      defaults: Math.floor(Math.random() * 3),
      age: Math.floor(25 + Math.random() * 40),
    });
    const scoreRes = http.post(`${CREDIT_SCORING}/v1/score`, scorePayload, { headers });
    check(scoreRes, { "credit score 2xx": (r) => r.status >= 200 && r.status < 300 });
    txnCount.add(1);

    // 2. Loan application
    const loanPayload = JSON.stringify({
      applicantName: `Loan Test ${Date.now()}`,
      amount: randomAmount(100000, 10000000),
      tenure: [12, 24, 36, 48, 60][Math.floor(Math.random() * 5)],
      purpose: ["personal", "business", "mortgage", "auto"][Math.floor(Math.random() * 4)],
      bvn: randomBVN(),
    });
    const loanRes = http.post(`${CORE_BANKING}/v1/loans/apply`, loanPayload, { headers });
    const approved = check(loanRes, {
      "loan apply 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    loanApprovalRate.add(approved);
    txnCount.add(1);
  });
}

function paymentFlow() {
  group("Payment Processing (NIP/NEFT)", () => {
    // 1. Health
    const health = http.get(`${PAYMENTS_HUB}/healthz`);
    check(health, { "payments-hub healthy": (r) => r.status === 200 });

    // 2. NIP transfer
    const nipPayload = JSON.stringify({
      sourceAccount: randomAccountNumber(),
      destinationAccount: randomAccountNumber(),
      destinationBank: ["000014", "000016", "000010", "000013"][Math.floor(Math.random() * 4)],
      amount: randomAmount(1000, 5000000),
      narration: `k6 load test transfer ${Date.now()}`,
      channel: "NIP",
    });
    const nipRes = http.post(`${PAYMENTS_HUB}/v1/transfer`, nipPayload, { headers });
    const paid = check(nipRes, {
      "NIP transfer 2xx": (r) => r.status >= 200 && r.status < 300,
    });
    paymentSuccessRate.add(paid);
    txnCount.add(1);

    // 3. Payment stats
    const statsRes = http.get(`${PAYMENTS_HUB}/v1/stats`, { headers });
    check(statsRes, { "payment stats 200": (r) => r.status === 200 });
    txnCount.add(1);
  });
}

function amlScreeningFlow() {
  group("AML + Sanctions Screening", () => {
    // 1. Transaction screening
    const amlStart = Date.now();
    const screenPayload = JSON.stringify({
      transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 99999)}`,
      amount: randomAmount(10000, 50000000),
      sourceAccount: randomAccountNumber(),
      destinationAccount: randomAccountNumber(),
      customerName: "Load Test Customer",
      transactionType: ["transfer", "deposit", "withdrawal"][Math.floor(Math.random() * 3)],
    });
    const screenRes = http.post(`${AML_ENGINE}/v1/screen`, screenPayload, { headers });
    amlScreeningDuration.add(Date.now() - amlStart);
    check(screenRes, { "AML screen 2xx": (r) => r.status >= 200 && r.status < 300 });
    txnCount.add(1);

    // 2. Metrics
    const metricsRes = http.get(`${AML_ENGINE}/metrics`);
    check(metricsRes, { "AML metrics 200": (r) => r.status === 200 });
  });
}

export function handleSummary(data) {
  const summary = [];
  summary.push("=== 54Bank Banking Flows Load Test ===");
  summary.push(`Scenario: ${scenario}`);
  summary.push(`Total banking transactions: ${data.metrics.total_banking_transactions?.values?.count ?? 0}`);
  summary.push(`Request error rate: ${((data.metrics.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)}%`);
  summary.push(`p95 latency: ${(data.metrics.http_req_duration?.values?.["p(95)"] ?? 0).toFixed(0)}ms`);
  summary.push(`p99 latency: ${(data.metrics.http_req_duration?.values?.["p(99)"] ?? 0).toFixed(0)}ms`);
  summary.push(`Account open success: ${((data.metrics.account_open_success?.values?.rate ?? 0) * 100).toFixed(1)}%`);
  summary.push(`Loan approval success: ${((data.metrics.loan_approval_success?.values?.rate ?? 0) * 100).toFixed(1)}%`);
  summary.push(`Payment success: ${((data.metrics.payment_success?.values?.rate ?? 0) * 100).toFixed(1)}%`);
  summary.push(`AML screening p95: ${(data.metrics.aml_screening_duration_ms?.values?.["p(95)"] ?? 0).toFixed(0)}ms`);
  summary.push(`KYC verify p95: ${(data.metrics.kyc_verify_duration_ms?.values?.["p(95)"] ?? 0).toFixed(0)}ms`);

  return {
    stdout: summary.join("\n") + "\n",
    "tests/load/banking-flows-results.json": JSON.stringify(data, null, 2),
  };
}
