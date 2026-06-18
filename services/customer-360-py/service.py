"""
A6: Customer 360 — unified customer relationship view
Aggregates all accounts, cards, loans, transactions, disputes, engagement, KYC, risk
Port: 8133
"""

import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

SEED_CUSTOMERS = {
    "CUST-001": {
        "customerId": "CUST-001",
        "name": "Fatima Abdullahi",
        "email": "fatima@example.ng",
        "phone": "+2348012345678",
        "bvn": "22001234567",
        "segment": "Retail",
        "tier": "Tier 1",
        "kycLevel": 2,
        "riskScore": 0.25,
        "riskBand": "Low",
        "relationshipManager": "Adamu Yusuf",
        "location": "Kaduna",
        "status": "Active",
        "since": "2024-03-15",
        "accounts": [
            {"number": "0012345678", "type": "savings", "currency": "NGN", "balance": 5250000, "status": "active"},
            {"number": "0012345679", "type": "current", "currency": "NGN", "balance": 1200000, "status": "active"},
        ],
        "cards": [
            {"type": "debit", "scheme": "verve", "last4": "4567", "status": "active", "dailyLimit": 200000},
        ],
        "loans": [
            {"type": "personal_loan", "amount": 3500000, "outstanding": 2100000, "status": "repaying", "monthlyPayment": 145000},
        ],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "credit", "amount": 250000, "narration": "Salary credit", "channel": "nip"},
            {"date": "2026-01-14", "type": "debit", "amount": 50000, "narration": "POS purchase", "channel": "card"},
            {"date": "2026-01-12", "type": "debit", "amount": 15000, "narration": "DSTV subscription", "channel": "bill_pay"},
        ],
        "disputes": [],
        "engagementScore": 78,
        "lastLogin": "2026-01-15T09:30:00Z",
        "preferredChannel": "mobile",
        "totalRelationshipValue": 8550000,
        "crossSellOpportunities": ["credit_card", "fixed_deposit", "insurance"],
    },
    "CUST-002": {
        "customerId": "CUST-002",
        "name": "Ibrahim Musa",
        "email": "ibrahim.musa@corporate.ng",
        "phone": "+2348098765432",
        "bvn": "22009876543",
        "segment": "Corporate",
        "tier": "Tier 3",
        "kycLevel": 3,
        "riskScore": 0.12,
        "riskBand": "Low",
        "relationshipManager": "Bisi Afolabi",
        "location": "Lagos",
        "status": "Active",
        "since": "2023-06-01",
        "accounts": [
            {"number": "3034567890", "type": "current", "currency": "NGN", "balance": 45000000, "status": "active"},
            {"number": "3034567891", "type": "domiciliary", "currency": "USD", "balance": 125000, "status": "active"},
        ],
        "cards": [
            {"type": "credit", "scheme": "mastercard", "last4": "8901", "status": "active", "creditLimit": 5000000},
            {"type": "debit", "scheme": "visa", "last4": "2345", "status": "active", "dailyLimit": 2000000},
        ],
        "loans": [
            {"type": "mortgage", "amount": 120000000, "outstanding": 115000000, "status": "repaying", "monthlyPayment": 1850000},
            {"type": "trade_finance_lc", "amount": 25000000, "outstanding": 25000000, "status": "active"},
        ],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "debit", "amount": 15000000, "narration": "Supplier payment", "channel": "rtgs"},
            {"date": "2026-01-14", "type": "credit", "amount": 28000000, "narration": "Customer collection", "channel": "nip"},
            {"date": "2026-01-13", "type": "debit", "amount": 1850000, "narration": "Mortgage installment", "channel": "standing_order"},
        ],
        "disputes": [
            {"id": "DSP-001", "amount": 2500000, "category": "service_not_rendered", "status": "investigating"},
        ],
        "engagementScore": 92,
        "lastLogin": "2026-01-15T14:22:00Z",
        "preferredChannel": "internet_banking",
        "totalRelationshipValue": 190125000,
        "crossSellOpportunities": ["treasury_products", "fx_forward", "trade_insurance"],
    },
    "CUST-003": {
        "customerId": "CUST-003",
        "name": "Jumoke Adeyemi",
        "email": "jumoke.a@trade.ng",
        "phone": "+2348055512345",
        "bvn": "22005551234",
        "segment": "Trade",
        "tier": "Tier 2",
        "kycLevel": 2,
        "riskScore": 0.35,
        "riskBand": "Medium",
        "relationshipManager": "Charles Obi",
        "location": "Lagos",
        "status": "Active",
        "since": "2024-09-20",
        "accounts": [
            {"number": "2098765432", "type": "current", "currency": "NGN", "balance": 8500000, "status": "active"},
        ],
        "cards": [
            {"type": "debit", "scheme": "visa", "last4": "6789", "status": "active", "dailyLimit": 1000000},
        ],
        "loans": [],
        "recentTransactions": [
            {"date": "2026-01-15", "type": "credit", "amount": 5000000, "narration": "Export proceeds", "channel": "swift"},
        ],
        "disputes": [],
        "engagementScore": 65,
        "lastLogin": "2026-01-14T16:45:00Z",
        "preferredChannel": "mobile",
        "totalRelationshipValue": 8500000,
        "crossSellOpportunities": ["trade_finance_lc", "fx_forward", "domiciliary_account"],
    },
}



MIDDLEWARE_CONFIG = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500")},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003")},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233")},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002")},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000")},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181")},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080")},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000")},
}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def do_GET(self):
        if self.path == "/healthz":
            return self._json({"status": "ok", "service": "customer-360", "middleware": MIDDLEWARE_CONFIG, "port": "8133"})

        if self.path == "/v1/customer-360/profiles":
            items = list(SEED_CUSTOMERS.values())
            return self._json({"items": items, "total": len(items)})

        if self.path.startswith("/v1/customer-360/profiles/"):
            cid = self.path.split("/")[-1]
            if cid in SEED_CUSTOMERS:
                return self._json(SEED_CUSTOMERS[cid])
            return self._json({"error": "customer not found"}, 404)

        if self.path == "/v1/customer-360/segments":
            segments = {}
            for c in SEED_CUSTOMERS.values():
                seg = c["segment"]
                if seg not in segments:
                    segments[seg] = {"segment": seg, "count": 0, "totalValue": 0}
                segments[seg]["count"] += 1
                segments[seg]["totalValue"] += c["totalRelationshipValue"]
            return self._json(list(segments.values()))

        if self.path == "/v1/customer-360/cross-sell":
            opportunities = []
            for c in SEED_CUSTOMERS.values():
                for opp in c.get("crossSellOpportunities", []):
                    opportunities.append({
                        "customerId": c["customerId"],
                        "customerName": c["name"],
                        "product": opp,
                        "segment": c["segment"],
                        "relationshipValue": c["totalRelationshipValue"],
                    })
            return self._json(opportunities)

        self._json({"error": "not found"}, 404)

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}

        if self.path == "/v1/customer-360/profiles":
            cid = body.get("customerId", f"CUST-{len(SEED_CUSTOMERS)+1:03d}")
            profile = {
                "customerId": cid,
                "name": body.get("name", ""),
                "email": body.get("email", ""),
                "phone": body.get("phone", ""),
                "segment": body.get("segment", "Retail"),
                "tier": body.get("tier", "Tier 1"),
                "kycLevel": body.get("kycLevel", 1),
                "riskScore": body.get("riskScore", 0.5),
                "riskBand": body.get("riskBand", "Medium"),
                "status": "Active",
                "accounts": [],
                "cards": [],
                "loans": [],
                "recentTransactions": [],
                "disputes": [],
                "engagementScore": 50,
                "totalRelationshipValue": 0,
                "crossSellOpportunities": ["savings", "debit_card"],
            }
            SEED_CUSTOMERS[cid] = profile
            return self._json(profile, 201)

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8133"))
    print(f"Customer 360 Service listening on :{port}")
    HTTPServer(("", port), Handler).serve_forever()
