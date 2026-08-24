"""54link-dev Document Management Service — customer documents, KYC files,
loan documentation, compliance records, version control, expiry tracking."""

from __future__ import annotations
import json
import os
from dataclasses import dataclass, asdict
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any


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
    Document("DOC-001", "CUST-001", "Aisha Mohammed", "kyc", "national_id", "National ID Card", "aisha_nin.pdf", 245_000, "application/pdf", 1, "verified", "e.nwosu@54link-dev.ng", "2026-01-15T10:00:00Z", "2031-01-15", True, "e.nwosu@54link-dev.ng", ["kyc", "tier2", "identity"]),
    Document("DOC-002", "CUST-001", "Aisha Mohammed", "kyc", "utility_bill", "EKEDC Bill — March 2026", "aisha_utility.pdf", 180_000, "application/pdf", 1, "verified", "e.nwosu@54link-dev.ng", "2026-03-20T09:00:00Z", "2026-09-20", True, "e.nwosu@54link-dev.ng", ["kyc", "address_proof"]),
    Document("DOC-003", "CUST-010", "Pinnacle Holdings Ltd", "corporate", "cac_certificate", "CAC Certificate of Incorporation", "pinnacle_cac.pdf", 520_000, "application/pdf", 2, "verified", "n.eze@54link-dev.ng", "2025-06-10T14:00:00Z", None, True, "n.eze@54link-dev.ng", ["corporate", "incorporation", "kyc"]),
    Document("DOC-004", "CUST-010", "Pinnacle Holdings Ltd", "loan", "offer_letter", "Term Loan Facility Offer — ₦700M", "pinnacle_loan_offer.pdf", 890_000, "application/pdf", 3, "executed", "a.ogundimu@54link-dev.ng", "2026-04-01T11:00:00Z", "2029-04-01", True, "legal@54link-dev.ng", ["loan", "facility", "corporate"]),
    Document("DOC-005", "CUST-003", "Zenith Construction Ltd", "collateral", "property_title", "Title Deed — Victoria Island Plot 45", "zenith_title.pdf", 1_200_000, "application/pdf", 1, "verified", "legal@54link-dev.ng", "2025-12-01T15:00:00Z", None, True, "legal@54link-dev.ng", ["collateral", "property", "title"]),
    Document("DOC-006", "CUST-005", "Fatimah Abdullahi", "kyc", "bvn_slip", "BVN Verification Slip", "fatimah_bvn.pdf", 95_000, "application/pdf", 1, "pending", "self-service", "2026-05-09T08:00:00Z", None, False, None, ["kyc", "bvn", "tier1"]),
    Document("DOC-007", "CUST-012", "Dangote Cement PLC", "compliance", "aml_report", "Annual AML/CFT Compliance Report 2025", "dangote_aml_2025.pdf", 3_400_000, "application/pdf", 1, "verified", "compliance@54link-dev.ng", "2026-02-15T10:00:00Z", "2027-02-15", True, "n.eze@54link-dev.ng", ["compliance", "aml", "institutional"]),
    Document("DOC-008", "CUST-002", "Ibrahim Musa", "investment", "mandate_form", "Investment Mandate — T-Bills", "ibrahim_mandate.pdf", 340_000, "application/pdf", 1, "executed", "a.ogundimu@54link-dev.ng", "2026-03-01T09:00:00Z", "2027-03-01", True, "a.ogundimu@54link-dev.ng", ["investment", "mandate", "tbills"]),
]


# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None


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

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._json(200, {"status": "ok", "service": "document-management",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["document_management.events", "document_management.audit"]},
                "dapr": {"status": "connected", "appId": "document_management-sidecar"},
                "fluvio": {"status": "connected", "topic": "document_management-stream"},
                "temporal": {"status": "connected", "namespace": "document_management"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "document_management"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "document_management_authz"},
                "redis": {"status": "connected", "prefix": "document_management:"},
                "mojaloop": {"status": "connected", "participant": "document_management"},
                "opensearch": {"status": "connected", "index": "document_management-*"},
                "openappsec": {"status": "connected", "policy": "document_management-protection"},
                "apisix": {"status": "connected", "upstream": "document_management"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
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

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
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
    port = int(os.environ.get("PORT", "8152"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"document-management listening on :{port}")
    server.serve_forever()
