import os
import json
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8195"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev"},
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
        "status": "active",
        "created_at": "2023-01-15T08:00:00Z",
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
        "status": "active",
        "created_at": "2023-03-10T10:30:00Z",
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
        "status": "active",
        "created_at": "2023-06-20T14:00:00Z",
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
        "status": "active",
        "created_at": "2022-11-01T09:00:00Z",
    },
]

# Seed contribution history keyed by account id
CONTRIBUTIONS = {
    "PEN-001": [
        {"id": "CON-001-1", "account_id": "PEN-001", "date": "2025-04-30", "employer": 3000000, "employee": 2000000, "total": 5000000, "status": "posted"},
        {"id": "CON-001-2", "account_id": "PEN-001", "date": "2025-03-31", "employer": 3000000, "employee": 2000000, "total": 5000000, "status": "posted"},
        {"id": "CON-001-3", "account_id": "PEN-001", "date": "2025-02-28", "employer": 3000000, "employee": 2000000, "total": 5000000, "status": "posted"},
    ],
    "PEN-002": [
        {"id": "CON-002-1", "account_id": "PEN-002", "date": "2025-04-30", "employer": 45000, "employee": 15000, "total": 60000, "status": "posted"},
        {"id": "CON-002-2", "account_id": "PEN-002", "date": "2025-03-31", "employer": 45000, "employee": 15000, "total": 60000, "status": "posted"},
        {"id": "CON-002-3", "account_id": "PEN-002", "date": "2025-02-28", "employer": 45000, "employee": 15000, "total": 60000, "status": "posted"},
        {"id": "CON-002-4", "account_id": "PEN-002", "date": "2025-01-31", "employer": 45000, "employee": 15000, "total": 60000, "status": "posted"},
    ],
    "PEN-003": [
        {"id": "CON-003-1", "account_id": "PEN-003", "date": "2025-04-30", "employer": 30000, "employee": 10000, "total": 40000, "status": "posted"},
        {"id": "CON-003-2", "account_id": "PEN-003", "date": "2025-03-31", "employer": 30000, "employee": 10000, "total": 40000, "status": "posted"},
    ],
    "PEN-004": [
        {"id": "CON-004-1", "account_id": "PEN-004", "date": "2025-04-30", "employer": 12000000, "employee": 8000000, "total": 20000000, "status": "posted"},
        {"id": "CON-004-2", "account_id": "PEN-004", "date": "2025-03-31", "employer": 12000000, "employee": 8000000, "total": 20000000, "status": "posted"},
    ],
}


def _find(account_id):
    return next((a for a in ITEMS if a["id"] == account_id), None)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "pension-py", "status": "healthy", "version": "1.0.0", "middleware": MW})

        elif self.path.startswith("/v1/pension-py/pension_accounts/"):
            parts = self.path.split("/")
            # /v1/pension-py/pension_accounts/{id}/contributions  → len 7
            # /v1/pension-py/pension_accounts/{id}               → len 6
            if len(parts) >= 7 and parts[6] == "contributions":
                account_id = parts[5]
                contribs = CONTRIBUTIONS.get(account_id, [])
                self._json(200, {"items": contribs, "total": len(contribs)})
            elif len(parts) >= 6:
                account_id = parts[5]
                account = _find(account_id)
                if account:
                    self._json(200, {"item": account})
                else:
                    self._json(404, {"error": "pension account not found"})
            else:
                self._json(404, {"error": "not found"})

        elif self.path.startswith("/v1/pension-py/pension_accounts"):
            self._json(200, {"items": ITEMS, "total": len(ITEMS)})

        elif self.path.startswith("/v1/pension-py/stats"):
            active = sum(1 for a in ITEMS if a["status"] == "active")
            inactive = sum(1 for a in ITEMS if a["status"] == "inactive")
            withdrawn = sum(1 for a in ITEMS if a["status"] == "withdrawn")
            employers = sum(1 for a in ITEMS if a["account_type"] == "employer")
            individuals = sum(1 for a in ITEMS if a["account_type"] == "individual")
            total_contributions = sum(a["total_contributions"] for a in ITEMS)
            self._json(200, {
                "total": len(ITEMS),
                "active": active,
                "inactive": inactive,
                "withdrawn": withdrawn,
                "employers": employers,
                "individuals": individuals,
                "total_contributions": total_contributions,
            })

        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        parts = self.path.split("/")

        # POST /v1/pension-py/pension_accounts
        if self.path == "/v1/pension-py/pension_accounts":
            body = self._read_body()
            new_id = f"PEN-{str(uuid.uuid4())[:8].upper()}"
            account = {
                "id": new_id,
                "customer_name": body.get("customer_name", ""),
                "account_type": body.get("account_type", "individual"),
                "pfa": body.get("pfa", ""),
                "rsa_number": body.get("rsa_number", ""),
                "total_contributions": body.get("total_contributions", 0),
                "employer_contribution": body.get("employer_contribution", 0),
                "employee_contribution": body.get("employee_contribution", 0),
                "currency": body.get("currency", "NGN"),
                "status": body.get("status", "active"),
                "created_at": body.get("created_at", "2025-01-01T00:00:00Z"),
            }
            ITEMS.append(account)
            CONTRIBUTIONS[new_id] = []
            self._json(201, {"item": account, "message": "Pension account created successfully"})

        # POST /v1/pension-py/pension_accounts/{id}/pause|resume|withdraw
        elif len(parts) >= 7 and parts[3] == "pension_accounts":
            account_id = parts[5]
            action = parts[6]
            account = _find(account_id)
            if not account:
                self._json(404, {"error": "pension account not found"})
                return
            if action == "pause":
                account["status"] = "inactive"
                self._json(200, {"item": account, "message": "Pension account paused"})
            elif action == "resume":
                account["status"] = "active"
                self._json(200, {"item": account, "message": "Pension account resumed"})
            elif action == "withdraw":
                account["status"] = "withdrawn"
                self._json(200, {"item": account, "message": "Pension account withdrawn"})
            else:
                self._json(404, {"error": f"unknown action: {action}"})
        else:
            self._json(404, {"error": "not found"})

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except Exception:
            return {}

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
