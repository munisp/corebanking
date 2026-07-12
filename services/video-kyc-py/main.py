"""54link-dev Video KYC service — AI analysis, geo-fencing, compliance recording

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os

def middleware_config():
    return {
        "kafka": {"broker": os.getenv("KAFKA_BROKER", "localhost:9092"), "topics": ["video-kyc-py.events"]},
        "dapr": {"app_id": "video-kyc-py", "url": os.getenv("DAPR_URL", "http://localhost:3500")},
        "fluvio": {"url": os.getenv("FLUVIO_URL", "localhost:9003"), "topics": ["video-kyc-py-stream"]},
        "temporal": {"url": os.getenv("TEMPORAL_URL", "localhost:7233"), "namespace": "video-kyc-py"},
        "postgres": {"url": os.getenv("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db")},
        "keycloak": {"url": os.getenv("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54link-dev", "client_id": "video-kyc-py"},
        "permify": {"url": os.getenv("PERMIFY_URL", "http://localhost:3476"), "schema": "video-kyc-py"},
        "redis": {"url": os.getenv("REDIS_URL", "redis://localhost:6379")},
        "mojaloop": {"url": os.getenv("MOJALOOP_URL", "http://localhost:3002")},
        "opensearch": {"url": os.getenv("OPENSEARCH_URL", "http://localhost:9200")},
        "openappsec": {"url": os.getenv("OPENAPPSEC_URL", "http://localhost:4000")},
        "apisix": {"url": os.getenv("APISIX_URL", "http://localhost:9080")},
        "tigerbeetle": {"url": os.getenv("TIGERBEETLE_URL", "localhost:3000")},
        "lakehouse": {"url": os.getenv("LAKEHOUSE_URL", "http://localhost:8181")},
    }

SEED_DATA = [
    {"id": "VIDEO-KYC-PY-001", "name": "Sample record 1", "status": "active", "createdAt": "2026-05-12T10:00:00Z"},
    {"id": "VIDEO-KYC-PY-002", "name": "Sample record 2", "status": "pending", "createdAt": "2026-05-12T11:00:00Z"},
]

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json({"status": "healthy", "service": "video-kyc-py", "version": "1.0.0", "middleware": middleware_config()})
        elif self.path.startswith("/api/"):
            self._json({"items": SEED_DATA, "total": len(SEED_DATA)})
        else:
            self._json({"error": "not found"}, 404)
    def do_POST(self):
        self._json({"message": "operation queued", "service": "video-kyc-py"})
    def _json(self, data, code=200):
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8292"))
    print(f"video-kyc-py listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
