import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8195"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "pension-py"},
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
        "id": "PEN-001",
        "customer_name": "Dangote Pension Fund",
        "account_type": "employer",
        "pfa": "ARM Pension",
        "rsa_number": "PEN-12345678",
        "total_contributions": 500000000000,
        "employer_contribution": 300000000000,
        "employee_contribution": 200000000000,
        "currency": "NGN",
        "status": "active"
    },
    {
        "id": "PEN-002",
        "customer_name": "Emeka Obi",
        "account_type": "individual",
        "pfa": "Stanbic IBTC Pension",
        "rsa_number": "PEN-23456789",
        "total_contributions": 15000000,
        "employer_contribution": 9000000,
        "employee_contribution": 6000000,
        "currency": "NGN",
        "status": "active"
    },
    {
        "id": "PEN-003",
        "customer_name": "Fatima Musa",
        "account_type": "individual",
        "pfa": "ARM Pension",
        "rsa_number": "PEN-34567890",
        "total_contributions": 8500000,
        "employer_contribution": 5100000,
        "employee_contribution": 3400000,
        "currency": "NGN",
        "status": "active"
    },
    {
        "id": "PEN-004",
        "customer_name": "NNPC Staff Pension",
        "account_type": "employer",
        "pfa": "NLPC PFA",
        "rsa_number": "PEN-45678901",
        "total_contributions": 2000000000000,
        "employer_contribution": 1200000000000,
        "employee_contribution": 800000000000,
        "currency": "NGN",
        "status": "active"
    }
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "pension-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/pension-py/pension_accounts"):
            self._json(200, {"items": ITEMS, "total": len(ITEMS)})
        elif self.path.startswith("/v1/pension-py/stats"):
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
    print(f"Pension Management Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
