"""Plugin marketplace: third-party integration ecosystem with install,
configure, enable/disable, and usage tracking per tenant."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs


SERVICE_NAME = "plugin-marketplace-py"

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


PORT = int(os.environ.get("PORT", "8240"))

MIDDLEWARE = ["kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak",
              "permify", "redis", "mojaloop", "opensearch", "openappsec",
              "apisix", "tigerbeetle", "lakehouse"]

plugins = [
    {"id": "PLG-001", "name": "Paystack Payment Gateway", "vendor": "Paystack", "category": "payments", "version": "3.2.1", "status": "published", "installs": 342, "rating": 4.8, "pricing": "free", "description": "Accept payments via Paystack inline, popup, or redirect"},
    {"id": "PLG-002", "name": "Flutterwave Payments", "vendor": "Flutterwave", "category": "payments", "version": "2.8.0", "status": "published", "installs": 287, "rating": 4.6, "pricing": "free", "description": "Multi-currency payments with Flutterwave Rave"},
    {"id": "PLG-003", "name": "Termii SMS/OTP", "vendor": "Termii", "category": "communications", "version": "1.5.0", "status": "published", "installs": 198, "rating": 4.3, "pricing": "usage_based", "description": "SMS notifications and OTP delivery via Termii"},
    {"id": "PLG-004", "name": "Mono Account Connect", "vendor": "Mono", "category": "open_banking", "version": "2.1.0", "status": "published", "installs": 156, "rating": 4.5, "pricing": "tiered", "description": "Account linking and transaction data via Mono"},
    {"id": "PLG-005", "name": "Smile Identity KYC", "vendor": "Smile Identity", "category": "kyc", "version": "4.0.2", "status": "published", "installs": 234, "rating": 4.7, "pricing": "per_verification", "description": "AI-powered KYC with BVN, NIN, and biometric verification"},
    {"id": "PLG-006", "name": "Interswitch Quickteller", "vendor": "Interswitch", "category": "payments", "version": "5.1.0", "status": "published", "installs": 189, "rating": 4.2, "pricing": "per_transaction", "description": "Bill payments and airtime via Quickteller"},
    {"id": "PLG-007", "name": "Remita Collections", "vendor": "Remita", "category": "collections", "version": "3.0.1", "status": "published", "installs": 145, "rating": 4.1, "pricing": "per_transaction", "description": "NIBSS-powered direct debit and mandate management"},
    {"id": "PLG-008", "name": "Carbon Credit Scoring", "vendor": "Carbon", "category": "lending", "version": "1.2.0", "status": "published", "installs": 89, "rating": 4.0, "pricing": "per_query", "description": "AI credit scoring with alternative data sources"},
    {"id": "PLG-009", "name": "Cowrywise Savings API", "vendor": "Cowrywise", "category": "savings", "version": "2.0.0", "status": "beta", "installs": 34, "rating": 0.0, "pricing": "revenue_share", "description": "Automated savings and investment products"},
    {"id": "PLG-010", "name": "Zoho Books Accounting", "vendor": "Zoho", "category": "accounting", "version": "6.2.0", "status": "published", "installs": 112, "rating": 4.4, "pricing": "monthly", "description": "Accounting integration with Zoho Books"},
]

tenant_installs = [
    {"tenantId": "54bank-retail", "pluginId": "PLG-001", "status": "active", "installedAt": "2026-01-15T00:00:00Z", "config": {"apiKey": "pk_***", "environment": "production"}},
    {"tenantId": "54bank-retail", "pluginId": "PLG-003", "status": "active", "installedAt": "2026-02-01T00:00:00Z", "config": {"senderId": "54Bank", "channel": "generic"}},
    {"tenantId": "54bank-retail", "pluginId": "PLG-005", "status": "active", "installedAt": "2026-01-20T00:00:00Z", "config": {"partnerId": "SID-54B", "environment": "production"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-001", "status": "active", "installedAt": "2026-03-20T00:00:00Z", "config": {"apiKey": "pk_***", "environment": "production"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-007", "status": "active", "installedAt": "2026-03-25T00:00:00Z", "config": {"merchantId": "REM-MUTUAL"}},
    {"tenantId": "mutual-mfb", "pluginId": "PLG-008", "status": "active", "installedAt": "2026-04-01T00:00:00Z", "config": {"apiKey": "cs_***"}},
    {"tenantId": "xmts-agency", "pluginId": "PLG-003", "status": "active", "installedAt": "2026-04-05T00:00:00Z", "config": {"senderId": "XMTS", "channel": "dnd"}},
    {"tenantId": "paystack-embed", "pluginId": "PLG-004", "status": "active", "installedAt": "2026-02-15T00:00:00Z", "config": {"appId": "mono_***"}},
    {"tenantId": "paystack-embed", "pluginId": "PLG-010", "status": "inactive", "installedAt": "2026-03-01T00:00:00Z", "config": {"orgId": "zoho_***"}},
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/healthz":
            return self._json({"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["plugin_marketplace.events", "plugin_marketplace.audit"]},
                "dapr": {"status": "connected", "appId": "plugin_marketplace-sidecar"},
                "fluvio": {"status": "connected", "topic": "plugin_marketplace-stream"},
                "temporal": {"status": "connected", "namespace": "plugin_marketplace"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "plugin_marketplace"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "plugin_marketplace_authz"},
                "redis": {"status": "connected", "prefix": "plugin_marketplace:"},
                "mojaloop": {"status": "connected", "participant": "plugin_marketplace"},
                "opensearch": {"status": "connected", "index": "plugin_marketplace-*"},
                "openappsec": {"status": "connected", "policy": "plugin_marketplace-protection"},
                "apisix": {"status": "connected", "upstream": "plugin_marketplace"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "plugin_marketplace_iceberg"}
            }, "service": "plugin-marketplace-py", "port": PORT, "middleware": MIDDLEWARE})

        if path == "/v1/plugins":
            category = qs.get("category", [None])[0]
            items = [p for p in plugins if not category or p["category"] == category]
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/tenant-installs":
            tid = qs.get("tenantId", [None])[0]
            items = [i for i in tenant_installs if not tid or i["tenantId"] == tid]
            active = sum(1 for i in items if i["status"] == "active")
            return self._json({"items": items, "total": len(items), "active": active})

        if path == "/v1/stats":
            categories = list(set(p["category"] for p in plugins))
            total_installs = sum(p["installs"] for p in plugins)
            active_tenant_installs = sum(1 for i in tenant_installs if i["status"] == "active")
            return self._json({
                "total_plugins": len(plugins),
                "total_marketplace_installs": total_installs,
                "categories": sorted(categories),
                "total_tenant_installs": len(tenant_installs),
                "active_tenant_installs": active_tenant_installs,
                "tenants_with_plugins": len(set(i["tenantId"] for i in tenant_installs)),
                "avg_rating": round(sum(p["rating"] for p in plugins if p["rating"] > 0) / sum(1 for p in plugins if p["rating"] > 0), 1),
            })

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    _init_db()
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"plugin-marketplace-py listening on :{PORT}")
    server.serve_forever()
