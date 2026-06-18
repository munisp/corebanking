import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8182"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": ["microfinance.loans", "microfinance.savings", "microfinance.groups"]},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["mfi:groups", "mfi:rates", "mfi:collections"]},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["mfi_groups", "mfi_loans", "mfi_savings", "mfi_collections", "mfi_officers"]},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["microfinance-loans", "microfinance-audit"]},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "microfinance"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "resources": ["mfi_group", "mfi_loan", "mfi_officer"]},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "microfinance", "pubsub": "mfi-pubsub"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topics": ["mfi-collection-stream"]},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflows": ["LoanDisbursementWorkflow", "CollectionWorkflow", "GroupFormationWorkflow"]},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002"), "usage": "mobile money disbursement and collection"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["mfi_loans", "mfi_savings"]},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["mfi_loan_performance", "mfi_group_analytics"]},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/microfinance/*"]},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "microfinance-waf"},
}

GROUPS = [
    {"id": "MFG-001", "group_name": "Iya Oloja Market Women", "location": "Balogun Market, Lagos Island", "members": 25, "total_savings": 15000000, "total_loans_outstanding": 8500000, "avg_loan_size": 340000, "repayment_rate": 97.5, "meeting_day": "Monday", "officer": "MFO-001", "status": "active"},
    {"id": "MFG-002", "group_name": "Onitsha Traders Cooperative", "location": "Main Market, Onitsha, Anambra", "members": 30, "total_savings": 25000000, "total_loans_outstanding": 18000000, "avg_loan_size": 600000, "repayment_rate": 95.8, "meeting_day": "Wednesday", "officer": "MFO-002", "status": "active"},
    {"id": "MFG-003", "group_name": "Kano Artisans Guild", "location": "Sabon Gari, Kano", "members": 20, "total_savings": 8000000, "total_loans_outstanding": 5200000, "avg_loan_size": 260000, "repayment_rate": 98.2, "meeting_day": "Thursday", "officer": "MFO-003", "status": "active"},
    {"id": "MFG-004", "group_name": "Ibadan Farmers Alliance", "location": "Bodija Market, Ibadan", "members": 35, "total_savings": 12000000, "total_loans_outstanding": 9800000, "avg_loan_size": 280000, "repayment_rate": 94.1, "meeting_day": "Tuesday", "officer": "MFO-001", "status": "active"},
    {"id": "MFG-005", "group_name": "Aba Women Entrepreneurs", "location": "Ariaria Market, Aba, Abia", "members": 40, "total_savings": 30000000, "total_loans_outstanding": 22000000, "avg_loan_size": 550000, "repayment_rate": 96.7, "meeting_day": "Friday", "officer": "MFO-004", "status": "active"},
    {"id": "MFG-006", "group_name": "Port Harcourt Youth Startup", "location": "Rumuokoro, Port Harcourt", "members": 15, "total_savings": 5000000, "total_loans_outstanding": 3500000, "avg_loan_size": 233333, "repayment_rate": 92.0, "meeting_day": "Saturday", "officer": "MFO-002", "status": "active"},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "microfinance-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/microfinance/groups"):
            self._json(200, {"items": GROUPS, "total": len(GROUPS)})
        elif self.path.startswith("/v1/microfinance/stats"):
            total_members = sum(g["members"] for g in GROUPS)
            total_savings = sum(g["total_savings"] for g in GROUPS)
            total_loans = sum(g["total_loans_outstanding"] for g in GROUPS)
            avg_repayment = sum(g["repayment_rate"] for g in GROUPS) / len(GROUPS)
            self._json(200, {"total_groups": len(GROUPS), "total_members": total_members, "total_savings": total_savings, "total_loans_outstanding": total_loans, "avg_repayment_rate": round(avg_repayment, 1)})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Microfinance Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
