#!/usr/bin/env python3
"""Non-interest banking — Murabaha, Ijara, Mudaraba, Musharaka, Zakat"""
import os, json, logging, uuid, re
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("islamic-banking-engine-py")

PORT = int(os.environ.get("PORT", "8103"))

# --- PII Masking (NDPR) ---
def mask_pii(value: str, field_type: str = "generic") -> str:
    if not value: return "***"
    if field_type in ("bvn", "nin"):
        return f"***{value[-4:]}" if len(value) >= 4 else "***"
    elif field_type == "phone":
        return f"+234***{value[-4:]}" if len(value) >= 4 else "+234***"
    elif field_type == "email" and "@" in value:
        local, domain = value.split("@", 1)
        return f"{local[0]}***@{domain}"
    elif field_type == "account":
        return f"****{value[-4:]}" if len(value) >= 4 else "****"
    return "***"

def sanitize_log(msg: str) -> str:
    msg = re.sub(r"\b\d{11}\b", lambda m: f"***{m.group()[-4:]}", msg)
    msg = re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "***@***", msg)
    return msg

records = []

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args): pass
    
    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())
    
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "healthy", "service": "islamic-banking-engine-py", "version": "1.0.0", "records": len(records)})
        elif self.path.startswith("/api/v1/"):
            self._json(200, {"records": records, "count": len(records)})
        else:
            self._json(404, {"error": "Not found"})
    
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or "{}")
        rec = {
            "id": f"ISL-{uuid.uuid4().hex[:12].upper()}",
            "data": body,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        records.append(rec)
        self._json(201, {"status": "created", "record": rec})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info(f"Non-interest banking — Murabaha, Ijara, Mudaraba, Musharaka, Zakat listening on :{PORT}")
    server.serve_forever()
