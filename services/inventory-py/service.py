import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8193"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092")},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379")},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200")},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476")},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "inventory-py"},
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
        "id": "INV-001",
        "item_name": "Cheque Books (500 leaves)",
        "category": "stationery",
        "warehouse": "Lagos Central",
        "quantity": 15000,
        "unit_cost": 2500,
        "total_value": 37500000,
        "reorder_level": 5000,
        "status": "in_stock"
    },
    {
        "id": "INV-002",
        "item_name": "Debit Cards (Verve)",
        "category": "cards",
        "warehouse": "Lagos Central",
        "quantity": 50000,
        "unit_cost": 1500,
        "total_value": 75000000,
        "reorder_level": 20000,
        "status": "in_stock"
    },
    {
        "id": "INV-003",
        "item_name": "Receipt Paper Rolls",
        "category": "consumables",
        "warehouse": "Abuja Depot",
        "quantity": 25000,
        "unit_cost": 800,
        "total_value": 20000000,
        "reorder_level": 10000,
        "status": "in_stock"
    },
    {
        "id": "INV-004",
        "item_name": "Security Tags",
        "category": "security",
        "warehouse": "Lagos Central",
        "quantity": 2000,
        "unit_cost": 5000,
        "total_value": 10000000,
        "reorder_level": 5000,
        "status": "low_stock"
    },
    {
        "id": "INV-005",
        "item_name": "ATM Cash Cassettes",
        "category": "equipment",
        "warehouse": "Various",
        "quantity": 500,
        "unit_cost": 150000,
        "total_value": 75000000,
        "reorder_level": 200,
        "status": "in_stock"
    }
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "inventory-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/inventory-py/inventory_items"):
            self._json(200, {"items": ITEMS, "total": len(ITEMS)})
        elif self.path.startswith("/v1/inventory-py/stats"):
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
    print(f"Inventory Management Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
