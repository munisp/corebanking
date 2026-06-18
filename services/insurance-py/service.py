import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8194"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "insurance-py"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003")},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233")},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002")},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000")},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181")},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080")},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000")},
}

ITEMS = [
    {
        "id": "INS-001",
        "policy_type": "life",
        "product_name": "54Protect Life Plan",
        "customer_name": "Emeka Obi",
        "premium_amount": 500000,
        "sum_assured": 50000000,
        "currency": "NGN",
        "start_date": "2026-01-01",
        "end_date": "2036-01-01",
        "status": "active"
    },
    {
        "id": "INS-002",
        "policy_type": "property",
        "product_name": "54Home Insurance",
        "customer_name": "Adaeze Nwankwo",
        "premium_amount": 250000,
        "sum_assured": 100000000,
        "currency": "NGN",
        "start_date": "2026-03-15",
        "end_date": "2027-03-15",
        "status": "active"
    },
    {
        "id": "INS-003",
        "policy_type": "health",
        "product_name": "54Health Plus",
        "customer_name": "Ibrahim Musa",
        "premium_amount": 350000,
        "sum_assured": 25000000,
        "currency": "NGN",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "status": "active"
    },
    {
        "id": "INS-004",
        "policy_type": "motor",
        "product_name": "54AutoCover",
        "customer_name": "Tunde Bakare",
        "premium_amount": 150000,
        "sum_assured": 15000000,
        "currency": "NGN",
        "start_date": "2026-02-01",
        "end_date": "2027-02-01",
        "status": "active"
    },
    {
        "id": "INS-005",
        "policy_type": "travel",
        "product_name": "54Travel Shield",
        "customer_name": "Ngozi Okafor",
        "premium_amount": 75000,
        "sum_assured": 5000000,
        "currency": "NGN",
        "start_date": "2026-05-01",
        "end_date": "2026-05-15",
        "status": "expired"
    }
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "insurance-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/insurance-py/insurance_policies"):
            self._json(200, {"items": ITEMS, "total": len(ITEMS)})
        elif self.path.startswith("/v1/insurance-py/stats"):
            self._json(200, {"total": len(ITEMS)})
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
    print(f"Bancassurance Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
