"""Branded communications service: tenant-specific email, SMS, push notification,
and PDF generation with white-label branding per tenant."""

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get("PORT", "8232"))

MIDDLEWARE = ["kafka", "dapr", "fluvio", "temporal", "postgres", "keycloak",
              "permify", "redis", "mojaloop", "opensearch", "openappsec",
              "apisix", "tigerbeetle", "lakehouse"]

email_queue = [
    {"id": "EQ-001", "tenantId": "54link-dev-retail", "templateName": "transaction_receipt", "recipient": "amina.yusuf@email.com", "subject": "Transaction Confirmation — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "brandedFrom": "54link-dev <noreply@54link-dev.app>"},
    {"id": "EQ-002", "tenantId": "54link-dev-retail", "templateName": "kyc_approved", "recipient": "chidi.okafor@email.com", "subject": "KYC Verification Approved — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:05:00Z", "brandedFrom": "54link-dev <noreply@54link-dev.app>"},
    {"id": "EQ-003", "tenantId": "mutual-mfb", "templateName": "loan_approval", "recipient": "fatima.bello@email.com", "subject": "Loan Approved — Mutual MFB", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "brandedFrom": "Mutual MFB <noreply@mutualmfb.com>"},
    {"id": "EQ-004", "tenantId": "xmts-agency", "templateName": "agent_commission", "recipient": "agent.kano@xmts.ng", "subject": "Commission Statement — XMTS", "status": "delivered", "sentAt": "2026-05-09T10:15:00Z", "brandedFrom": "XMTS Agency <noreply@xmts.ng>"},
    {"id": "EQ-005", "tenantId": "paystack-embed", "templateName": "transaction_receipt", "recipient": "dev@startup.io", "subject": "Payment Confirmation — Paystack Banking", "status": "failed", "sentAt": "2026-05-09T10:20:00Z", "error": "SMTP connection timeout", "brandedFrom": "Paystack Banking <noreply@banking.paystack.com>"},
]

sms_queue = [
    {"id": "SQ-001", "tenantId": "54link-dev-retail", "recipient": "+234801234567", "message": "Your 54link-dev transfer of ₦50,000 to Chidi was successful. Ref: TXN-2026050901.", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "senderName": "54link-dev"},
    {"id": "SQ-002", "tenantId": "mutual-mfb", "recipient": "+234802345678", "message": "Your Mutual MFB loan of ₦500,000 has been approved. Visit your nearest branch.", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "senderName": "MutualMFB"},
    {"id": "SQ-003", "tenantId": "xmts-agency", "recipient": "+234803456789", "message": "XMTS Agent: Your commission of ₦12,500 has been credited. Balance: ₦45,200.", "status": "delivered", "sentAt": "2026-05-09T10:15:00Z", "senderName": "XMTS"},
    {"id": "SQ-004", "tenantId": "54link-dev-retail", "recipient": "+234804567890", "message": "OTP: 482915. Valid for 5 minutes. Do not share. — 54link-dev", "status": "delivered", "sentAt": "2026-05-09T10:25:00Z", "senderName": "54link-dev"},
]

push_notifications = [
    {"id": "PN-001", "tenantId": "54link-dev-retail", "title": "Transfer Received", "body": "₦25,000 received from Amina Yusuf", "deviceToken": "fcm_token_abc", "status": "delivered", "sentAt": "2026-05-09T10:00:00Z", "icon": "/assets/54link-dev-icon.png"},
    {"id": "PN-002", "tenantId": "mutual-mfb", "title": "Savings Goal Reached!", "body": "Your 'Rent Fund' savings goal of ₦200,000 is complete", "deviceToken": "fcm_token_def", "status": "delivered", "sentAt": "2026-05-09T10:10:00Z", "icon": "/assets/mutual-icon.png"},
    {"id": "PN-003", "tenantId": "paystack-embed", "title": "Card Transaction", "body": "₦5,000 charged on your virtual card ending 4829", "deviceToken": "fcm_token_ghi", "status": "pending", "sentAt": "2026-05-09T10:20:00Z", "icon": "/assets/paystack-icon.png"},
]

pdf_jobs = [
    {"id": "PJ-001", "tenantId": "54link-dev-retail", "documentType": "account_statement", "customerName": "Amina Yusuf", "period": "April 2026", "status": "generated", "pages": 3, "fileSize": "245KB", "brandedHeader": "54link-dev Financial Services Ltd", "createdAt": "2026-05-01T00:00:00Z"},
    {"id": "PJ-002", "tenantId": "mutual-mfb", "documentType": "loan_schedule", "customerName": "Fatima Bello", "period": "May 2026 - May 2028", "status": "generated", "pages": 2, "fileSize": "128KB", "brandedHeader": "Mutual Microfinance Bank Ltd", "createdAt": "2026-05-05T00:00:00Z"},
    {"id": "PJ-003", "tenantId": "54link-dev-retail", "documentType": "tax_certificate", "customerName": "Chidi Okafor", "period": "FY 2025", "status": "generated", "pages": 1, "fileSize": "89KB", "brandedHeader": "54link-dev Financial Services Ltd", "createdAt": "2026-04-15T00:00:00Z"},
    {"id": "PJ-004", "tenantId": "xmts-agency", "documentType": "commission_report", "customerName": "Agent Kano Hub", "period": "April 2026", "status": "pending", "pages": 0, "fileSize": "0KB", "brandedHeader": "XMTS Mobile Money Operations Ltd", "createdAt": "2026-05-09T00:00:00Z"},
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
    def log_message(self, fmt, *args):
        pass

    def _json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        tid = qs.get("tenantId", [None])[0]

        if path == "/healthz":
            return self._json({"status": "healthy",
            "middleware": {
                "kafka": {"status": "connected", "topics": ["branded_comms.events", "branded_comms.audit"]},
                "dapr": {"status": "connected", "appId": "branded_comms-sidecar"},
                "fluvio": {"status": "connected", "topic": "branded_comms-stream"},
                "temporal": {"status": "connected", "namespace": "branded_comms"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "branded_comms"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "branded_comms_authz"},
                "redis": {"status": "connected", "prefix": "branded_comms:"},
                "mojaloop": {"status": "connected", "participant": "branded_comms"},
                "opensearch": {"status": "connected", "index": "branded_comms-*"},
                "openappsec": {"status": "connected", "policy": "branded_comms-protection"},
                "apisix": {"status": "connected", "upstream": "branded_comms"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "branded_comms_iceberg"}
            }, "service": "branded-comms-py", "port": PORT, "middleware": MIDDLEWARE})

        if path == "/v1/emails":
            items = [e for e in email_queue if not tid or e["tenantId"] == tid]
            delivered = sum(1 for e in items if e["status"] == "delivered")
            return self._json({"items": items, "total": len(items), "delivered": delivered, "failed": len(items) - delivered})

        if path == "/v1/sms":
            items = [s for s in sms_queue if not tid or s["tenantId"] == tid]
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/push-notifications":
            items = [p for p in push_notifications if not tid or p["tenantId"] == tid]
            return self._json({"items": items, "total": len(items)})

        if path == "/v1/pdf-jobs":
            items = [p for p in pdf_jobs if not tid or p["tenantId"] == tid]
            generated = sum(1 for p in items if p["status"] == "generated")
            return self._json({"items": items, "total": len(items), "generated": generated})

        if path == "/v1/stats":
            email_delivered = sum(1 for e in email_queue if e["status"] == "delivered")
            sms_delivered = sum(1 for s in sms_queue if s["status"] == "delivered")
            push_delivered = sum(1 for p in push_notifications if p["status"] == "delivered")
            pdf_generated = sum(1 for p in pdf_jobs if p["status"] == "generated")
            tenants = list(set(e["tenantId"] for e in email_queue))
            return self._json({
                "total_emails": len(email_queue), "emails_delivered": email_delivered,
                "total_sms": len(sms_queue), "sms_delivered": sms_delivered,
                "total_push": len(push_notifications), "push_delivered": push_delivered,
                "total_pdf_jobs": len(pdf_jobs), "pdfs_generated": pdf_generated,
                "tenants_with_comms": len(tenants),
                "channels": ["email", "sms", "push", "pdf"],
            })

        self._json({"error": "not found"}, 404)

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json({"error": "unauthorized", "detail": _n1_err}, status=401)
                return
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/v1/emails/send":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            if not body.get("tenantId") or not body.get("recipient") or not body.get("templateName"):
                return self._json({"error": "tenantId, recipient, and templateName required"}, 400)
            entry = {
                "id": f"EQ-{len(email_queue)+1:03d}", "tenantId": body["tenantId"],
                "templateName": body["templateName"], "recipient": body["recipient"],
                "subject": body.get("subject", f"Notification — {body['tenantId']}"),
                "status": "queued", "sentAt": "2026-05-09T15:00:00Z",
                "brandedFrom": f"{body['tenantId']} <noreply@{body['tenantId']}.app>",
            }
            email_queue.append(entry)
            return self._json(entry, 201)

        self._json({"error": "not found"}, 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"branded-comms-py listening on :{PORT}")
    server.serve_forever()
