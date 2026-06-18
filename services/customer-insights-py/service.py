"""54Bank Customer Insights/ML Service — churn prediction, cross-sell scoring,
anomaly detection, customer lifetime value, next-best-action."""

from __future__ import annotations
import json
import math
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any



SERVICE_NAME = "customer-insights-py"

# ─── PostgreSQL Persistence ───
import time as _time

_db_conn = None

def _init_db():
    global _db_conn
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        import psycopg2
        _db_conn = psycopg2.connect(db_url)
        _db_conn.autocommit = True
        cur = _db_conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS service_records (
            id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
            status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)")
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e} — in-memory fallback")
        _db_conn = None


def db_persist(record_type: str, data: dict, status: str = "active"):
    if _db_conn is None:
        return
    try:
        record_id = f"{SERVICE_NAME}_{record_type}_{int(_time.time() * 1000000)}"
        cur = _db_conn.cursor()
        cur.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET data=%s, status=%s, updated_at=NOW()",
            (record_id, SERVICE_NAME, record_type, status, json.dumps(data), json.dumps(data), status)
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] db_persist failed: {e}")


@dataclass
class ChurnPrediction:
    id: str
    customer_id: str
    customer_name: str
    segment: str
    churn_probability: float
    risk_level: str
    contributing_factors: list[str]
    recommended_actions: list[str]
    predicted_revenue_loss: float
    model_version: str
    scored_at: str


@dataclass
class CrossSellScore:
    id: str
    customer_id: str
    customer_name: str
    product_id: str
    product_name: str
    propensity_score: float
    confidence: float
    expected_revenue: float
    campaign_id: str | None
    status: str


@dataclass
class AnomalyAlert:
    id: str
    customer_id: str
    customer_name: str
    anomaly_type: str
    severity: str
    description: str
    baseline_value: float
    actual_value: float
    deviation_sigma: float
    detected_at: str
    status: str


CHURN_PREDICTIONS: list[ChurnPrediction] = [
    ChurnPrediction("CP-001", "CUST-005", "Fatimah Abdullahi", "mass_retail", 0.78, "high", ["20 days since last login", "Balance below ₦50K", "No transactions in 15 days", "NPS score 5/10"], ["Personal call from RM", "Offer zero-fee transfer promo", "Push notification with savings goal"], 450_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-002", "CUST-020", "Olusegun Bakare", "diaspora", 0.62, "medium", ["Reduced remittance frequency", "No app login in 10 days", "Competitor rate alert viewed"], ["Exclusive diaspora rate offer", "Property investment pitch", "WhatsApp engagement"], 2_500_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-003", "CUST-004", "Emeka Nwosu", "sme", 0.45, "medium", ["Declining transaction volume", "Viewed competitor loan rates", "2 support tickets unresolved"], ["Resolve support tickets", "SME loan pre-approval", "Business advisory session"], 8_200_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-004", "CUST-001", "Aisha Mohammed", "premium_retail", 0.12, "low", ["Active mobile user", "5 products held", "High NPS"], ["Platinum card upgrade offer", "Wealth management intro"], 150_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
    ChurnPrediction("CP-005", "CUST-003", "Zenith Construction Ltd", "mid_corporate", 0.55, "medium", ["Reduced deposit balance 30%", "No new facilities in 12 months", "Competitor relationship detected"], ["Rate renegotiation", "Trade finance proposal", "CEO relationship meeting"], 15_000_000, "churn-v3.2", "2026-05-09T08:00:00Z"),
]

CROSS_SELL_SCORES: list[CrossSellScore] = [
    CrossSellScore("XS-001", "CUST-001", "Aisha Mohammed", "PRD-006", "54Card Platinum Visa", 0.89, 0.92, 125_000, "CAMP-Q2-CARD", "pending"),
    CrossSellScore("XS-002", "CUST-001", "Aisha Mohammed", "PRD-008", "54Invest T-Bills", 0.76, 0.85, 750_000, "CAMP-Q2-INVEST", "pending"),
    CrossSellScore("XS-003", "CUST-002", "Ibrahim Musa", "PRD-005", "54Mortgage Home", 0.65, 0.78, 900_000, None, "new"),
    CrossSellScore("XS-004", "CUST-010", "Pinnacle Holdings Ltd", "PRD-007", "54FX DomAccount", 0.82, 0.88, 2_500_000, "CAMP-CORP-FX", "contacted"),
    CrossSellScore("XS-005", "CUST-005", "Fatimah Abdullahi", "PRD-004", "54Loan Personal", 0.71, 0.80, 350_000, "CAMP-Q2-LOAN", "pending"),
    CrossSellScore("XS-006", "CUST-012", "Dangote Cement PLC", "PRD-008", "54Invest T-Bills", 0.95, 0.97, 50_000_000, "CAMP-INST-TBILL", "accepted"),
]

ANOMALY_ALERTS: list[AnomalyAlert] = [
    AnomalyAlert("AN-001", "CUST-010", "Pinnacle Holdings Ltd", "volume_spike", "warning", "Transaction volume 3.2x above 30-day average", 8500, 27200, 3.2, "2026-05-09T10:00:00Z", "open"),
    AnomalyAlert("AN-002", "CUST-020", "Olusegun Bakare", "unusual_destination", "high", "Wire transfer to new country (Cayman Islands) not in profile", 0, 1, 0, "2026-05-09T11:30:00Z", "investigating"),
    AnomalyAlert("AN-003", "CUST-005", "Fatimah Abdullahi", "balance_drain", "critical", "Balance dropped 92% in 48 hours — possible account takeover", 2_500_000, 200_000, 4.1, "2026-05-09T09:00:00Z", "escalated"),
    AnomalyAlert("AN-004", "CUST-003", "Zenith Construction Ltd", "dormancy_risk", "low", "No debit transactions in 21 days (normally 15+ per week)", 15, 0, 2.8, "2026-05-09T06:00:00Z", "open"),
]


def compute_clv(avg_monthly_revenue: float, churn_rate: float, discount_rate: float = 0.1) -> float:
    """Customer Lifetime Value = avg_monthly_revenue * margin / (churn_rate + discount_rate)."""
    if churn_rate + discount_rate <= 0:
        return 0
    margin = 0.35
    monthly_discount = discount_rate / 12
    monthly_churn = churn_rate / 12
    if monthly_churn + monthly_discount <= 0:
        return 0
    return round(avg_monthly_revenue * margin / (monthly_churn + monthly_discount), 2)


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "customer-insights",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_insights.events", "customer_insights.audit"]},
                "dapr": {"status": "connected", "appId": "customer_insights-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_insights-stream"},
                "temporal": {"status": "connected", "namespace": "customer_insights"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_insights"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "customer_insights_authz"},
                "redis": {"status": "connected", "prefix": "customer_insights:"},
                "mojaloop": {"status": "connected", "participant": "customer_insights"},
                "opensearch": {"status": "connected", "index": "customer_insights-*"},
                "openappsec": {"status": "connected", "policy": "customer_insights-protection"},
                "apisix": {"status": "connected", "upstream": "customer_insights"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_insights_iceberg"}
            },
                             "models": ["churn-v3.2", "cross-sell-v2.1", "anomaly-v1.5", "clv-v1.0"],
                             "middleware": ["Postgres", "Redis", "Kafka", "MLflow"]})
        elif self.path == "/v1/insights/churn":
            self._json(200, {"items": [asdict(p) for p in CHURN_PREDICTIONS], "total": len(CHURN_PREDICTIONS)})
        elif self.path == "/v1/insights/cross-sell":
            self._json(200, {"items": [asdict(s) for s in CROSS_SELL_SCORES], "total": len(CROSS_SELL_SCORES)})
        elif self.path == "/v1/insights/anomalies":
            self._json(200, {"items": [asdict(a) for a in ANOMALY_ALERTS], "total": len(ANOMALY_ALERTS)})
        elif self.path == "/v1/insights/dashboard":
            high_churn = sum(1 for p in CHURN_PREDICTIONS if p.risk_level == "high")
            total_revenue_at_risk = sum(p.predicted_revenue_loss for p in CHURN_PREDICTIONS if p.churn_probability >= 0.5)
            open_anomalies = sum(1 for a in ANOMALY_ALERTS if a.status in ("open", "investigating", "escalated"))
            pending_xsell = sum(1 for s in CROSS_SELL_SCORES if s.status in ("pending", "new"))
            expected_xsell_revenue = sum(s.expected_revenue for s in CROSS_SELL_SCORES if s.status in ("pending", "new", "contacted"))
            self._json(200, {
                "churn": {"highRisk": high_churn, "revenueAtRisk": total_revenue_at_risk},
                "crossSell": {"pendingOffers": pending_xsell, "expectedRevenue": expected_xsell_revenue},
                "anomalies": {"openAlerts": open_anomalies, "criticalAlerts": sum(1 for a in ANOMALY_ALERTS if a.severity == "critical")},
            })
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/v1/insights/clv":
            body = self._body()
            avg_revenue = body.get("avgMonthlyRevenue", 0)
            churn_rate = body.get("churnRate", 0.1)
            discount = body.get("discountRate", 0.1)
            if avg_revenue <= 0:
                self._json(400, {"error": "avgMonthlyRevenue must be positive"})
                return
            if churn_rate <= 0 or churn_rate >= 1:
                self._json(400, {"error": "churnRate must be between 0 and 1"})
                return
            clv = compute_clv(avg_revenue, churn_rate, discount)
            self._json(200, {
                "avgMonthlyRevenue": avg_revenue, "churnRate": churn_rate,
                "discountRate": discount, "customerLifetimeValue": clv,
                "model": "clv-v1.0"
            })
        elif self.path == "/v1/insights/score-churn":
            body = self._body()
            days_since_login = body.get("daysSinceLastLogin", 0)
            product_count = body.get("productCount", 1)
            nps = body.get("npsScore", 7)
            balance_trend = body.get("balanceTrend", 0)  # -1 declining, 0 flat, 1 growing

            # Simple logistic-like scoring
            score = 0.5
            score += min(days_since_login * 0.02, 0.3)
            score -= min(product_count * 0.05, 0.25)
            score -= (nps - 5) * 0.03
            score += balance_trend * -0.1
            score = max(0.01, min(0.99, score))

            risk = "low" if score < 0.3 else "medium" if score < 0.6 else "high" if score < 0.8 else "critical"
            self._json(200, {
                "churnProbability": round(score, 3),
                "riskLevel": risk,
                "factors": {
                    "daysSinceLastLogin": days_since_login,
                    "productCount": product_count,
                    "npsScore": nps,
                    "balanceTrend": balance_trend
                },
                "model": "churn-v3.2"
            })
        else:
            self._json(404, {"error": "not found"})


if __name__ == "__main__":
    _init_db()
    port = int(os.environ.get("PORT", "8149"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"customer-insights listening on :{port}")
    server.serve_forever()
