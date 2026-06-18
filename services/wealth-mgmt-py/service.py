import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8168"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": ["wealth.portfolios", "wealth.transactions", "wealth.rebalancing"]},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["wealth:nav", "wealth:clients", "wealth:models"]},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["wealth_clients", "wealth_portfolios", "wealth_transactions", "investment_models"]},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["wealth-transactions", "wealth-audit"]},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "wealth-mgmt"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "resources": ["wealth_client", "wealth_portfolio"]},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "wealth-mgmt", "pubsub": "wealth-pubsub"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topics": ["wealth-market-stream"]},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflows": ["RebalancingWorkflow", "TaxOptimizationWorkflow"]},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002"), "usage": "wealth transfers"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["wealth_cash", "wealth_investments"]},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["wealth_performance_history"]},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/wealth/*"]},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "wealth-waf"},
}

CLIENTS = [
    {"id": "WC-001", "client_name": "Aliko Dangote", "client_type": "uhnw", "relationship_manager": "RM-001", "total_wealth": 12500000000.0, "currency": "USD", "risk_profile": "moderate", "investment_mandate": "balanced_growth", "portfolios": ["equities", "fixed_income", "real_estate", "alternatives"], "annual_review_date": "2026-06-15", "status": "active"},
    {"id": "WC-002", "client_name": "Mike Adenuga Jr", "client_type": "uhnw", "relationship_manager": "RM-002", "total_wealth": 6800000000.0, "currency": "USD", "risk_profile": "aggressive", "investment_mandate": "growth", "portfolios": ["equities", "private_equity", "telecom_ventures"], "annual_review_date": "2026-07-01", "status": "active"},
    {"id": "WC-003", "client_name": "Abdul Samad Rabiu", "client_type": "uhnw", "relationship_manager": "RM-001", "total_wealth": 5200000000.0, "currency": "USD", "risk_profile": "moderate", "investment_mandate": "income_plus_growth", "portfolios": ["fixed_income", "real_estate", "cement_industry"], "annual_review_date": "2026-08-15", "status": "active"},
    {"id": "WC-004", "client_name": "Folorunso Alakija", "client_type": "hnw", "relationship_manager": "RM-003", "total_wealth": 1100000000.0, "currency": "USD", "risk_profile": "conservative", "investment_mandate": "capital_preservation", "portfolios": ["fixed_income", "real_estate"], "annual_review_date": "2026-05-30", "status": "active"},
    {"id": "WC-005", "client_name": "Tony Elumelu", "client_type": "uhnw", "relationship_manager": "RM-002", "total_wealth": 3500000000.0, "currency": "USD", "risk_profile": "aggressive", "investment_mandate": "pan_african_growth", "portfolios": ["equities", "banking_ventures", "energy", "agriculture"], "annual_review_date": "2026-09-01", "status": "active"},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "wealth-mgmt-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/wealth/clients"):
            self._json(200, {"items": CLIENTS, "total": len(CLIENTS)})
        elif self.path.startswith("/v1/wealth/stats"):
            total = sum(c["total_wealth"] for c in CLIENTS)
            self._json(200, {"total_clients": len(CLIENTS), "total_auw": total, "currency": "USD"})
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
    print(f"Wealth Management Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
