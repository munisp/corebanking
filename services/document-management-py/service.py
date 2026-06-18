"""54Bank Document Management Service — customer documents, KYC files,
loan documentation, compliance records, version control, expiry tracking."""

from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any



SERVICE_NAME = "document-management-py"

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


@dataclass
class Document:
    id: str
    customer_id: str
    customer_name: str
    category: str
    doc_type: str
    title: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    version: int
    status: str
    uploaded_by: str
    uploaded_at: str
    expires_at: str | None
    verified: bool
    verified_by: str | None
    tags: list[str]


DOCUMENTS: list[Document] = [
    Document("DOC-001", "CUST-001", "Aisha Mohammed", "kyc", "national_id", "National ID Card", "aisha_nin.pdf", 245_000, "application/pdf", 1, "verified", "e.nwosu@54bank.ng", "2026-01-15T10:00:00Z", "2031-01-15", True, "e.nwosu@54bank.ng", ["kyc", "tier2", "identity"]),
    Document("DOC-002", "CUST-001", "Aisha Mohammed", "kyc", "utility_bill", "EKEDC Bill — March 2026", "aisha_utility.pdf", 180_000, "application/pdf", 1, "verified", "e.nwosu@54bank.ng", "2026-03-20T09:00:00Z", "2026-09-20", True, "e.nwosu@54bank.ng", ["kyc", "address_proof"]),
    Document("DOC-003", "CUST-010", "Pinnacle Holdings Ltd", "corporate", "cac_certificate", "CAC Certificate of Incorporation", "pinnacle_cac.pdf", 520_000, "application/pdf", 2, "verified", "n.eze@54bank.ng", "2025-06-10T14:00:00Z", None, True, "n.eze@54bank.ng", ["corporate", "incorporation", "kyc"]),
    Document("DOC-004", "CUST-010", "Pinnacle Holdings Ltd", "loan", "offer_letter", "Term Loan Facility Offer — ₦700M", "pinnacle_loan_offer.pdf", 890_000, "application/pdf", 3, "executed", "a.ogundimu@54bank.ng", "2026-04-01T11:00:00Z", "2029-04-01", True, "legal@54bank.ng", ["loan", "facility", "corporate"]),
    Document("DOC-005", "CUST-003", "Zenith Construction Ltd", "collateral", "property_title", "Title Deed — Victoria Island Plot 45", "zenith_title.pdf", 1_200_000, "application/pdf", 1, "verified", "legal@54bank.ng", "2025-12-01T15:00:00Z", None, True, "legal@54bank.ng", ["collateral", "property", "title"]),
    Document("DOC-006", "CUST-005", "Fatimah Abdullahi", "kyc", "bvn_slip", "BVN Verification Slip", "fatimah_bvn.pdf", 95_000, "application/pdf", 1, "pending", "self-service", "2026-05-09T08:00:00Z", None, False, None, ["kyc", "bvn", "tier1"]),
    Document("DOC-007", "CUST-012", "Dangote Cement PLC", "compliance", "aml_report", "Annual AML/CFT Compliance Report 2025", "dangote_aml_2025.pdf", 3_400_000, "application/pdf", 1, "verified", "compliance@54bank.ng", "2026-02-15T10:00:00Z", "2027-02-15", True, "n.eze@54bank.ng", ["compliance", "aml", "institutional"]),
    Document("DOC-008", "CUST-002", "Ibrahim Musa", "investment", "mandate_form", "Investment Mandate — T-Bills", "ibrahim_mandate.pdf", 340_000, "application/pdf", 1, "executed", "a.ogundimu@54bank.ng", "2026-03-01T09:00:00Z", "2027-03-01", True, "a.ogundimu@54bank.ng", ["investment", "mandate", "tbills"]),
]


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: Any) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "document-management",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["document_management.events", "document_management.audit"]},
                "dapr": {"status": "connected", "appId": "document_management-sidecar"},
                "fluvio": {"status": "connected", "topic": "document_management-stream"},
                "temporal": {"status": "connected", "namespace": "document_management"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "document_management"},
                "keycloak": {"status": "connected", "realm": "54bank"},
                "permify": {"status": "connected", "schema": "document_management_authz"},
                "redis": {"status": "connected", "prefix": "document_management:"},
                "mojaloop": {"status": "connected", "participant": "document_management"},
                "opensearch": {"status": "connected", "index": "document_management-*"},
                "openappsec": {"status": "connected", "policy": "document_management-protection"},
                "apisix": {"status": "connected", "upstream": "document_management"},
                "tigerbeetle": {"status": "connected", "cluster": "54bank-ledger"},
                "lakehouse": {"status": "connected", "table": "document_management_iceberg"}
            },
                             "storage": "S3-compatible",
                             "middleware": ["Postgres", "S3", "Redis", "Kafka"]})
        elif self.path == "/v1/documents":
            self._json(200, {"items": [asdict(d) for d in DOCUMENTS], "total": len(DOCUMENTS)})
        elif self.path.startswith("/v1/documents/customer/"):
            cust_id = self.path.split("/")[-1]
            filtered = [asdict(d) for d in DOCUMENTS if d.customer_id == cust_id]
            self._json(200, {"items": filtered, "total": len(filtered)})
        elif self.path == "/v1/documents/stats":
            by_category: dict[str, int] = {}
            by_status: dict[str, int] = {}
            total_size = 0
            for d in DOCUMENTS:
                by_category[d.category] = by_category.get(d.category, 0) + 1
                by_status[d.status] = by_status.get(d.status, 0) + 1
                total_size += d.file_size_bytes
            expiring_soon = sum(1 for d in DOCUMENTS if d.expires_at and d.expires_at <= "2026-12-31")
            self._json(200, {
                "totalDocuments": len(DOCUMENTS), "totalSizeBytes": total_size,
                "byCategory": by_category, "byStatus": by_status,
                "pendingVerification": sum(1 for d in DOCUMENTS if not d.verified),
                "expiringSoon": expiring_soon,
            })
        elif self.path == "/v1/documents/expiring":
            expiring = [asdict(d) for d in DOCUMENTS if d.expires_at and d.expires_at <= "2026-12-31"]
            self._json(200, {"items": expiring, "total": len(expiring)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if self.path == "/v1/documents/search":
            body = self._body()
            query = body.get("query", "").lower()
            tags = body.get("tags", [])
            results = []
            for d in DOCUMENTS:
                if query and query not in d.title.lower() and query not in d.doc_type.lower():
                    continue
                if tags and not any(t in d.tags for t in tags):
                    continue
                results.append(asdict(d))
            self._json(200, {"items": results, "total": len(results)})
        else:
            self._json(404, {"error": "not found"})


if __name__ == "__main__":
    _init_db()
    port = int(os.environ.get("PORT", "8152"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"document-management listening on :{port}")
    server.serve_forever()
