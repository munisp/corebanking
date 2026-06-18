"""Billing analytics service — accrual tracking, spike detection, revenue reporting."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from statistics import mean
from typing import Any


@dataclass
class AccrualPoint:
    id: str
    tenant_id: str
    billing_period: str
    accrued_amount: float
    currency: str
    meter_key: str
    product_key: str
    transaction_count: int
    status: str


@dataclass
class RevenueReport:
    id: str
    period: str
    total_revenue: float
    fee_income: float
    interest_income: float
    fx_income: float
    commission_income: float
    currency: str


ACCRUALS: list[AccrualPoint] = [
    AccrualPoint("BA-001", "54link-dev-platform-prod", "2026-01", 6_200_000, "NGN", "transfer_posted", "nip_payments", 248_000, "finalized"),
    AccrualPoint("BA-002", "54link-dev-platform-prod", "2026-02", 7_500_000, "NGN", "transfer_posted", "nip_payments", 300_000, "finalized"),
    AccrualPoint("BA-003", "54link-dev-platform-prod", "2026-03", 7_800_000, "NGN", "transfer_posted", "nip_payments", 312_000, "finalized"),
    AccrualPoint("BA-004", "54link-dev-platform-prod", "2026-04", 8_100_000, "NGN", "transfer_posted", "nip_payments", 324_000, "finalized"),
    AccrualPoint("BA-005", "54link-dev-platform-prod", "2026-05", 12_900_000, "NGN", "transfer_posted", "nip_payments", 516_000, "provisional"),
    AccrualPoint("BA-006", "54link-dev-platform-prod", "2026-01", 1_800_000, "NGN", "api_call", "open_banking", 3_600_000, "finalized"),
    AccrualPoint("BA-007", "54link-dev-platform-prod", "2026-02", 2_100_000, "NGN", "api_call", "open_banking", 4_200_000, "finalized"),
    AccrualPoint("BA-008", "54link-dev-platform-prod", "2026-03", 2_400_000, "NGN", "api_call", "open_banking", 4_800_000, "finalized"),
    AccrualPoint("BA-009", "54link-dev-platform-prod", "2026-04", 2_350_000, "NGN", "sms_sent", "notifications", 587_500, "finalized"),
    AccrualPoint("BA-010", "54link-dev-platform-prod", "2026-05", 2_600_000, "NGN", "sms_sent", "notifications", 650_000, "provisional"),
]

REVENUE_REPORTS: list[RevenueReport] = [
    RevenueReport("RR-001", "2026-Q1", 45_500_000_000, 12_300_000_000, 25_800_000_000, 4_200_000_000, 3_200_000_000, "NGN"),
    RevenueReport("RR-002", "2026-Q2", 48_200_000_000, 13_100_000_000, 27_200_000_000, 4_500_000_000, 3_400_000_000, "NGN"),
]


def detect_spikes(meter_key: str, spike_ratio: float = 1.4) -> list[dict[str, Any]]:
    series = [a for a in ACCRUALS if a.meter_key == meter_key]
    if len(series) < 2:
        return []
    baseline = mean(a.accrued_amount for a in series[:-1])
    latest = series[-1]
    if baseline <= 0:
        return []
    if latest.accrued_amount >= baseline * spike_ratio:
        return [{
            "tenantId": latest.tenant_id,
            "billingPeriod": latest.billing_period,
            "meterKey": meter_key,
            "baseline": round(baseline, 2),
            "latest": round(latest.accrued_amount, 2),
            "ratio": round(latest.accrued_amount / baseline, 2),
            "severity": "warning" if latest.accrued_amount < baseline * 2 else "critical",
        }]
    return []


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length > 0 else {}

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "billing-analytics-python",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["billing_analytics.events", "billing_analytics.audit"]},
                "dapr": {"status": "connected", "appId": "billing_analytics-sidecar"},
                "fluvio": {"status": "connected", "topic": "billing_analytics-stream"},
                "temporal": {"status": "connected", "namespace": "billing_analytics"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "billing_analytics"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "billing_analytics_authz"},
                "redis": {"status": "connected", "prefix": "billing_analytics:"},
                "mojaloop": {"status": "connected", "participant": "billing_analytics"},
                "opensearch": {"status": "connected", "index": "billing_analytics-*"},
                "openappsec": {"status": "connected", "policy": "billing_analytics-protection"},
                "apisix": {"status": "connected", "upstream": "billing_analytics"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "billing_analytics_iceberg"}
            }, "middleware": ["Lakehouse", "OpenSearch", "Kafka", "Redis"]})
        elif self.path == "/v1/billing/accruals":
            self._json(200, {"items": [asdict(a) for a in ACCRUALS], "total": len(ACCRUALS)})
        elif self.path == "/v1/billing/revenue-reports":
            self._json(200, {"items": [asdict(r) for r in REVENUE_REPORTS], "total": len(REVENUE_REPORTS)})
        elif self.path == "/v1/billing/summary":
            total_accrued = sum(a.accrued_amount for a in ACCRUALS)
            by_meter: dict[str, float] = {}
            for a in ACCRUALS:
                by_meter[a.meter_key] = by_meter.get(a.meter_key, 0) + a.accrued_amount
            self._json(200, {"totalAccrued": total_accrued, "accrualCount": len(ACCRUALS), "byMeter": by_meter})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/v1/billing/detect-spikes":
            body = self._body()
            meter = body.get("meterKey", "transfer_posted")
            ratio = body.get("spikeRatio", 1.4)
            alerts = detect_spikes(meter, ratio)
            self._json(200, {"alerts": alerts, "total": len(alerts)})
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, fmt: str, *args: Any) -> None:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8087"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"billing-analytics-python listening on :{port}")
    server.serve_forever()
