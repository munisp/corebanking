"""
A9: Diaspora Banking — remittance corridors, dual-currency wallets, property investment schemes
Port: 8135
"""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

REMITTANCE_CORRIDORS = [
    {"id": "RC-001", "corridor": "UK→NG", "sourceCurrency": "GBP", "targetCurrency": "NGN", "rate": 1950.00, "fee": 4.99, "feeCurrency": "GBP", "minAmount": 10, "maxAmount": 50000, "estimatedTime": "15 minutes", "provider": "54Bank Direct", "status": "active"},
    {"id": "RC-002", "corridor": "US→NG", "sourceCurrency": "USD", "targetCurrency": "NGN", "rate": 1500.00, "fee": 3.99, "feeCurrency": "USD", "minAmount": 10, "maxAmount": 50000, "estimatedTime": "15 minutes", "provider": "54Bank Direct", "status": "active"},
    {"id": "RC-003", "corridor": "EU→NG", "sourceCurrency": "EUR", "targetCurrency": "NGN", "rate": 1680.00, "fee": 4.49, "feeCurrency": "EUR", "minAmount": 10, "maxAmount": 50000, "estimatedTime": "30 minutes", "provider": "54Bank Direct", "status": "active"},
    {"id": "RC-004", "corridor": "CA→NG", "sourceCurrency": "CAD", "targetCurrency": "NGN", "rate": 1100.00, "fee": 5.99, "feeCurrency": "CAD", "minAmount": 10, "maxAmount": 25000, "estimatedTime": "1 hour", "provider": "54Bank Direct", "status": "active"},
    {"id": "RC-005", "corridor": "AE→NG", "sourceCurrency": "AED", "targetCurrency": "NGN", "rate": 408.00, "fee": 15.00, "feeCurrency": "AED", "minAmount": 50, "maxAmount": 100000, "estimatedTime": "30 minutes", "provider": "54Bank Direct", "status": "active"},
]

DIASPORA_ACCOUNTS = [
    {"id": "DA-001", "customerId": "CUST-D001", "name": "Oluwaseun Bakare", "country": "United Kingdom", "accountType": "dual_currency", "ngnBalance": 15000000, "fxBalance": 5000, "fxCurrency": "GBP", "remittancesThisYear": 12, "totalRemittedNGN": 45000000, "status": "active", "kycLevel": 3, "products": ["remittance", "fixed_deposit_ngn", "property_investment"]},
    {"id": "DA-002", "customerId": "CUST-D002", "name": "Chibueze Okonkwo", "country": "United States", "accountType": "dual_currency", "ngnBalance": 28000000, "fxBalance": 12000, "fxCurrency": "USD", "remittancesThisYear": 8, "totalRemittedNGN": 72000000, "status": "active", "kycLevel": 3, "products": ["remittance", "property_investment", "target_savings"]},
    {"id": "DA-003", "customerId": "CUST-D003", "name": "Amaka Eze", "country": "Canada", "accountType": "remittance_only", "ngnBalance": 5000000, "fxBalance": 0, "fxCurrency": "CAD", "remittancesThisYear": 4, "totalRemittedNGN": 8800000, "status": "active", "kycLevel": 2, "products": ["remittance"]},
]

PROPERTY_SCHEMES = [
    {"id": "PS-001", "name": "Lagos Smart City Apartments", "location": "Lekki Phase 2, Lagos", "type": "residential", "minInvestment": 15000000, "maxInvestment": 150000000, "expectedROI": 18.5, "tenorMonths": 24, "unitsAvailable": 45, "totalUnits": 120, "status": "open", "developer": "Landmark Africa"},
    {"id": "PS-002", "name": "Abuja Centenary Villas", "location": "Maitama Extension, Abuja", "type": "residential", "minInvestment": 25000000, "maxInvestment": 200000000, "expectedROI": 15.0, "tenorMonths": 36, "unitsAvailable": 12, "totalUnits": 50, "status": "open", "developer": "Brains & Hammers"},
    {"id": "PS-003", "name": "Port Harcourt Tech Hub", "location": "GRA Phase 2, PH", "type": "commercial", "minInvestment": 10000000, "maxInvestment": 80000000, "expectedROI": 22.0, "tenorMonths": 18, "unitsAvailable": 30, "totalUnits": 60, "status": "open", "developer": "PH Innovation Park"},
]

REMITTANCES = [
    {"id": "REM-001", "senderId": "CUST-D001", "senderName": "Oluwaseun Bakare", "recipientName": "Fatima Abdullahi", "recipientAccount": "0012345678", "corridor": "UK→NG", "sourceAmount": 500, "sourceCurrency": "GBP", "targetAmount": 975000, "targetCurrency": "NGN", "rate": 1950.00, "fee": 4.99, "status": "completed", "completedAt": "2026-01-15T10:30:00Z"},
    {"id": "REM-002", "senderId": "CUST-D002", "senderName": "Chibueze Okonkwo", "recipientName": "Ibrahim Musa", "recipientAccount": "3034567890", "corridor": "US→NG", "sourceAmount": 2000, "sourceCurrency": "USD", "targetAmount": 3000000, "targetCurrency": "NGN", "rate": 1500.00, "fee": 3.99, "status": "completed", "completedAt": "2026-01-14T16:20:00Z"},
]



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
            return self._json({"status": "ok", "service": "diaspora-banking", "middleware": MIDDLEWARE_CONFIG, "port": "8135"})
        if self.path == "/v1/diaspora/corridors":
            return self._json({"items": REMITTANCE_CORRIDORS, "total": len(REMITTANCE_CORRIDORS)})
        if self.path == "/v1/diaspora/accounts":
            return self._json({"items": DIASPORA_ACCOUNTS, "total": len(DIASPORA_ACCOUNTS)})
        if self.path == "/v1/diaspora/remittances":
            return self._json({"items": REMITTANCES, "total": len(REMITTANCES)})
        if self.path == "/v1/diaspora/property-schemes":
            return self._json({"items": PROPERTY_SCHEMES, "total": len(PROPERTY_SCHEMES)})
        if self.path == "/v1/diaspora/stats":
            total_remitted = sum(r["targetAmount"] for r in REMITTANCES)
            return self._json({
                "totalAccounts": len(DIASPORA_ACCOUNTS),
                "activeCorridors": len(REMITTANCE_CORRIDORS),
                "totalRemittancesNGN": total_remitted,
                "avgRemittanceNGN": total_remitted / max(len(REMITTANCES), 1),
                "propertySchemes": len(PROPERTY_SCHEMES),
            })
        self._json({"error": "not found"}, 404)

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_len)) if content_len > 0 else {}

        if self.path == "/v1/diaspora/remittances":
            corridor = body.get("corridor", "")
            rate_info = next((c for c in REMITTANCE_CORRIDORS if c["corridor"] == corridor), None)
            if not rate_info:
                return self._json({"error": f"corridor '{corridor}' not found"}, 400)
            source_amt = body.get("sourceAmount", 0)
            if source_amt < rate_info["minAmount"]:
                return self._json({"error": f"minimum amount is {rate_info['minAmount']} {rate_info['sourceCurrency']}"}, 400)
            if source_amt > rate_info["maxAmount"]:
                return self._json({"error": f"maximum amount is {rate_info['maxAmount']} {rate_info['sourceCurrency']}"}, 400)

            target_amt = source_amt * rate_info["rate"]
            rem = {
                "id": f"REM-{len(REMITTANCES)+1:03d}",
                "senderId": body.get("senderId"),
                "senderName": body.get("senderName"),
                "recipientName": body.get("recipientName"),
                "recipientAccount": body.get("recipientAccount"),
                "corridor": corridor,
                "sourceAmount": source_amt,
                "sourceCurrency": rate_info["sourceCurrency"],
                "targetAmount": target_amt,
                "targetCurrency": "NGN",
                "rate": rate_info["rate"],
                "fee": rate_info["fee"],
                "status": "processing",
            }
            REMITTANCES.append(rem)
            return self._json(rem, 201)

        if self.path == "/v1/diaspora/accounts":
            acct = {
                "id": f"DA-{len(DIASPORA_ACCOUNTS)+1:03d}",
                "customerId": body.get("customerId"),
                "name": body.get("name"),
                "country": body.get("country"),
                "accountType": body.get("accountType", "dual_currency"),
                "ngnBalance": 0,
                "fxBalance": 0,
                "fxCurrency": body.get("fxCurrency", "USD"),
                "remittancesThisYear": 0,
                "totalRemittedNGN": 0,
                "status": "active",
                "kycLevel": 1,
                "products": ["remittance"],
            }
            DIASPORA_ACCOUNTS.append(acct)
            return self._json(acct, 201)

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8135"))
    print(f"Diaspora Banking Service listening on :{port}")
    HTTPServer(("", port), Handler).serve_forever()
