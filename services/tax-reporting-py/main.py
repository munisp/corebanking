from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os, uuid, time

PORT = int(os.environ.get("PORT", 8338))

_reports = {}

def _json(handler, status, body):
    data = json.dumps(body).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(data)

def _read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    return json.loads(handler.rfile.read(length)) if length else {}

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_GET(self):
        p = self.path.split("?")[0].rstrip("/")
        if p == "/healthz":
            return _json(self, 200, {"status": "healthy", "service": "tax-reporting-py", "port": PORT})
        if p == "/api/tax-reporting/config":
            return _json(self, 200, {"service": "Tax Reporting", "port": PORT, "status": "active"})
        if p == "/api/tax-reporting/middleware":
            return _json(self, 200, {"kafka": {"topics": ["tax-reporting.events"]}, "dapr": {"stateStore": "tax-reporting-state"}})
        if p == "/api/reports":
            return _json(self, 200, list(_reports.values()))
        # GET /api/reports/:id
        if p.startswith("/api/reports/"):
            rid = p[len("/api/reports/"):]
            rec = _reports.get(rid)
            if rec:
                return _json(self, 200, rec)
            return _json(self, 404, {"error": "Not found"})
        _json(self, 404, {"error": "Not found"})

    def do_POST(self):
        p = self.path.rstrip("/")
        if p == "/api/reports":
            body = _read_body(self)
            rid = body.get("id") or f"TAX-{int(time.time())}"
            rec = {**body, "id": rid, "status": body.get("status", "pending")}
            _reports[rid] = rec
            return _json(self, 201, rec)
        _json(self, 404, {"error": "Not found"})

    def do_PUT(self):
        p = self.path.rstrip("/")
        if p.startswith("/api/reports/"):
            rid = p[len("/api/reports/"):]
            if rid not in _reports:
                return _json(self, 404, {"error": "Not found"})
            body = _read_body(self)
            _reports[rid] = {**_reports[rid], **body, "id": rid}
            return _json(self, 200, _reports[rid])
        _json(self, 404, {"error": "Not found"})

    def log_message(self, *a): pass

print(f"Tax Reporting on :{PORT}")
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
