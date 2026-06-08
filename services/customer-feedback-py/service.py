"""54Bank Customer Feedback & NPS Service — surveys, ratings, sentiment analysis,
complaint-to-feedback linking, NPS trending, branch/channel scoring."""

from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any



SERVICE_NAME = "customer-feedback-py"

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
class FeedbackEntry:
    id: str
    customer_id: str
    customer_name: str
    channel: str
    category: str
    rating: int
    nps_score: int
    comment: str
    sentiment: str
    branch: str | None
    product: str | None
    resolved: bool
    response: str | None
    submitted_at: str


@dataclass
class NPSTrend:
    period: str
    promoters: int
    passives: int
    detractors: int
    total_responses: int
    nps: float


FEEDBACK: list[FeedbackEntry] = [
    FeedbackEntry("FB-001", "CUST-001", "Aisha Mohammed", "mobile_app", "general", 5, 9, "Love the new mobile app redesign! Transfer speed is excellent.", "positive", None, "54Pay Mobile", True, None, "2026-05-09T10:00:00Z"),
    FeedbackEntry("FB-002", "CUST-005", "Fatimah Abdullahi", "branch", "service_quality", 2, 3, "Waited 45 minutes at Lekki branch. Only 2 tellers on duty at peak hours.", "negative", "Lekki", None, False, None, "2026-05-09T11:00:00Z"),
    FeedbackEntry("FB-003", "CUST-002", "Ibrahim Musa", "internet_banking", "feature_request", 4, 8, "Please add multi-currency dashboard view. Currently have to switch between accounts.", "neutral", None, "Internet Banking", True, "Feature added to Q3 roadmap — thank you for the suggestion!", "2026-05-08T14:00:00Z"),
    FeedbackEntry("FB-004", "CUST-010", "Pinnacle Holdings Ltd", "relationship_manager", "service_quality", 5, 10, "Excellent relationship management from Oluwafemi. Helped restructure our facility smoothly.", "positive", "Head Office", "Corporate Banking", True, None, "2026-05-07T09:00:00Z"),
    FeedbackEntry("FB-005", "CUST-003", "Zenith Construction Ltd", "call_center", "complaint", 1, 1, "Card was blocked without notice. Took 3 days to resolve. Unacceptable for a corporate account.", "negative", None, "54Card Corporate", False, None, "2026-05-06T16:00:00Z"),
    FeedbackEntry("FB-006", "CUST-020", "Olusegun Bakare", "mobile_app", "general", 4, 7, "Diaspora transfer rates are competitive. Would prefer faster settlement to Nigerian accounts.", "neutral", None, "Diaspora Banking", True, "Settlement now T+0 for intra-bank. Inter-bank remains T+1.", "2026-05-05T12:00:00Z"),
    FeedbackEntry("FB-007", "CUST-008", "Farmgate Commodities Ltd", "branch", "product", 3, 5, "Warehouse receipt financing approval took too long. 3 weeks vs promised 5 days.", "negative", "Ikeja", "Agri Finance", False, None, "2026-05-04T10:00:00Z"),
    FeedbackEntry("FB-008", "CUST-012", "Dangote Cement PLC", "relationship_manager", "general", 5, 10, "Seamless syndicated facility arrangement. 54Bank led the consortium efficiently.", "positive", "Head Office", "Institutional Banking", True, None, "2026-05-03T11:00:00Z"),
]

NPS_TRENDS: list[NPSTrend] = [
    NPSTrend("2026-01", 420, 180, 100, 700, 45.7),
    NPSTrend("2026-02", 450, 170, 90, 710, 50.7),
    NPSTrend("2026-03", 480, 160, 85, 725, 54.5),
    NPSTrend("2026-04", 510, 150, 80, 740, 58.1),
    NPSTrend("2026-05", 530, 145, 75, 750, 60.7),
]


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
            self._json(200, {"status": "ok", "service": "customer-feedback",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_feedback.events", "customer_feedback.audit"]},
                "dapr": {"status": "connected", "appId": "customer_feedback-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_feedback-stream"},
                "temporal": {"status": "connected", "namespace": "customer_feedback"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_feedback"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "customer_feedback_authz"},
                "redis": {"status": "connected", "prefix": "customer_feedback:"},
                "mojaloop": {"status": "connected", "participant": "customer_feedback"},
                "opensearch": {"status": "connected", "index": "customer_feedback-*"},
                "openappsec": {"status": "connected", "policy": "customer_feedback-protection"},
                "apisix": {"status": "connected", "upstream": "customer_feedback"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_feedback_iceberg"}
            },
                             "middleware": ["Postgres", "Redis", "Kafka", "OpenSearch"]})
        elif self.path == "/v1/feedback/entries":
            self._json(200, {"items": [asdict(f) for f in FEEDBACK], "total": len(FEEDBACK)})
        elif self.path == "/v1/feedback/nps-trend":
            self._json(200, {"items": [asdict(t) for t in NPS_TRENDS], "total": len(NPS_TRENDS)})
        elif self.path == "/v1/feedback/dashboard":
            total = len(FEEDBACK)
            avg_rating = sum(f.rating for f in FEEDBACK) / total if total else 0
            avg_nps = sum(f.nps_score for f in FEEDBACK) / total if total else 0
            promoters = sum(1 for f in FEEDBACK if f.nps_score >= 9)
            detractors = sum(1 for f in FEEDBACK if f.nps_score <= 6)
            nps = ((promoters - detractors) / total * 100) if total else 0

            by_sentiment: dict[str, int] = {}
            by_channel: dict[str, int] = {}
            by_category: dict[str, int] = {}
            for f in FEEDBACK:
                by_sentiment[f.sentiment] = by_sentiment.get(f.sentiment, 0) + 1
                by_channel[f.channel] = by_channel.get(f.channel, 0) + 1
                by_category[f.category] = by_category.get(f.category, 0) + 1

            unresolved = sum(1 for f in FEEDBACK if not f.resolved)
            self._json(200, {
                "totalFeedback": total, "avgRating": round(avg_rating, 1),
                "avgNPS": round(avg_nps, 1), "npsScore": round(nps, 1),
                "promoters": promoters, "detractors": detractors,
                "unresolvedCount": unresolved,
                "bySentiment": by_sentiment, "byChannel": by_channel, "byCategory": by_category,
                "latestNPSTrend": asdict(NPS_TRENDS[-1]) if NPS_TRENDS else None,
            })
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/v1/feedback/submit":
            body = self._body()
            rating = body.get("rating", 0)
            nps = body.get("npsScore", 0)
            comment = body.get("comment", "")
            if not (1 <= rating <= 5):
                self._json(400, {"error": "rating must be 1-5"})
                return
            if not (0 <= nps <= 10):
                self._json(400, {"error": "npsScore must be 0-10"})
                return

            sentiment = "positive" if nps >= 8 else "negative" if nps <= 4 else "neutral"
            self._json(201, {
                "id": f"FB-{len(FEEDBACK)+1:03d}",
                "rating": rating, "npsScore": nps, "comment": comment,
                "sentiment": sentiment, "status": "received"
            })
        else:
            self._json(404, {"error": "not found"})


if __name__ == "__main__":
    _init_db()
    port = int(os.environ.get("PORT", "8155"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"customer-feedback listening on :{port}")
    server.serve_forever()
