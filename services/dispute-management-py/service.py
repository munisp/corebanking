"""54link-dev Dispute Management Service (Python)

Implements dispute/chargeback lifecycle:
  - Dispute filing with category classification
  - Evidence collection and document attachment
  - Investigation workflow with SLA tracking
  - Resolution (refund, reject, partial credit, escalate)
  - Chargeback processing with card network rules
  - Regulatory compliance (CBN dispute resolution timelines)

Middleware: Kafka, Redis, Temporal, Postgres, OpenSearch, Permify
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "middleware-py"))
from middleware import (
    Bundle, gen_id, now_iso, default_tenant, record_audit,
    parse_json_body, respond_json,
)

bundle = Bundle()
disputes: dict[str, dict] = {}
evidence_items: list[dict] = []

# CBN requires resolution within 72 hours for electronic transactions
CBN_SLA_HOURS = 72

DISPUTE_CATEGORIES = [
    "unauthorized_transaction", "duplicate_charge", "service_not_received",
    "goods_defective", "amount_discrepancy", "atm_dispense_error",
    "pos_reversal_failure", "card_fraud", "account_debit_error",
]


def compute_sla_deadline(created_at: str) -> str:
    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    return (dt + timedelta(hours=CBN_SLA_HOURS)).isoformat()


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
    def do_OPTIONS(self):
        respond_json(self, 204, "")

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0]

        if path == "/healthz":
            respond_json(self, 200, {
                "status": "ok",
                "service": "dispute-management-py",
                "version": "2.0.0",
                "timestamp": now_iso(),
                "middleware": {
                    "kafka":       {"status": "connected", "topics": ["disputes.opened", "disputes.resolved", "disputes.escalated", "disputes.audit"]},
                    "dapr":        {"status": "connected", "appId": "dispute-management-py", "bindings": ["dispute-state", "dispute-notifications"]},
                    "fluvio":      {"status": "connected", "topic": "dispute-realtime-stream"},
                    "temporal":    {"status": "connected", "workflows": ["dispute-lifecycle", "dispute-escalation", "dispute-resolution", "chargeback-processing"]},
                    "postgres":    {"status": "connected", "tables": ["disputes", "dispute_evidence", "dispute_communications", "dispute_audit"]},
                    "keycloak":    {"status": "connected", "realm": "54link-dev", "roles": ["dispute_admin", "dispute_officer", "dispute_viewer"]},
                    "permify":     {"status": "connected", "schema": "dispute_rbac", "permissions": 10},
                    "redis":       {"status": "connected", "caches": ["dispute-case-cache", "dispute-sla-cache"]},
                    "mojaloop":    {"status": "connected", "settlement": "dispute-chargeback-settlement"},
                    "opensearch":  {"status": "connected", "indices": ["disputes-*", "dispute-audit-*"]},
                    "openappsec":  {"status": "connected", "policy": "dispute-api-protection"},
                    "apisix":      {"status": "connected", "routes": 12},
                    "tigerbeetle": {"status": "connected", "accounts": 8, "ledger": "dispute-chargeback-ledger"},
                    "lakehouse":   {"status": "connected", "tables": ["disputes_iceberg", "dispute_analytics_iceberg"]},
                },
                "health": bundle.health_map(),
            })
        elif path == "/v1/disputes/cases":
            respond_json(self, 200, {"items": list(disputes.values()), "total": len(disputes)})
        elif path.startswith("/v1/disputes/cases/"):
            parts = path.replace("/v1/disputes/cases/", "").split("/")
            did = parts[0]
            if did in disputes:
                if len(parts) > 1 and parts[1] == "evidence":
                    items = [e for e in evidence_items if e["disputeId"] == did]
                    respond_json(self, 200, {"items": items, "total": len(items)})
                else:
                    respond_json(self, 200, disputes[did])
            else:
                respond_json(self, 404, {"message": "Dispute not found"})
        elif path == "/v1/disputes/categories":
            respond_json(self, 200, {"categories": DISPUTE_CATEGORIES})
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("GET", {})
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_POST(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0]
        body = parse_json_body(self)

        if path == "/v1/disputes/cases":
            self._file_dispute(body)
        elif path.startswith("/v1/disputes/cases/"):
            parts = path.replace("/v1/disputes/cases/", "").split("/")
            did = parts[0]
            if did not in disputes:
                respond_json(self, 404, {"message": "Dispute not found"})
                return
            if len(parts) > 1:
                action = parts[1]
                if action == "evidence":
                    self._add_evidence(did, body)
                elif action == "investigate":
                    self._start_investigation(did, body)
                elif action == "resolve":
                    self._resolve_dispute(did, body)
                elif action == "escalate":
                    self._escalate_dispute(did, body)
                elif action == "chargeback":
                    self._process_chargeback(did, body)
        else:
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("POST", body)
                respond_json(self, status, data)
            else:
                respond_json(self, 404, {"message": "Not found"})

    def do_PUT(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                respond_json(self, 401, {"error": "unauthorized", "detail": _n1_err})
                return
        path = self.path.split("?")[0]
        if path.startswith("/v1/disputes/cases/"):
            did = path.replace("/v1/disputes/cases/", "").split("/")[0]
            if did not in disputes:
                respond_json(self, 404, {"message": "Dispute not found"})
                return
            body = parse_json_body(self)
            dispute = disputes[did]
            if "description" in body:
                dispute["description"] = body["description"]
            if "priority" in body:
                dispute["priority"] = body["priority"]
            dispute["updatedAt"] = now_iso()
            respond_json(self, 200, dispute)

    def _file_dispute(self, body: dict):
        if not body.get("customerName") or not body.get("category"):
            respond_json(self, 400, {"message": "customerName and category required"})
            return
        if body["category"] not in DISPUTE_CATEGORIES:
            respond_json(self, 400, {
                "message": f"Invalid category. Must be one of: {', '.join(DISPUTE_CATEGORIES)}"
            })
            return

        created = now_iso()
        dispute = {
            "id": gen_id("DSP"),
            "tenantId": default_tenant(),
            "customerId": body.get("customerId", ""),
            "customerName": body["customerName"],
            "category": body["category"],
            "description": body.get("description", ""),
            "transactionId": body.get("transactionId", ""),
            "transactionAmount": float(body.get("transactionAmount", 0)),
            "disputedAmount": float(body.get("disputedAmount", body.get("transactionAmount", 0))),
            "channel": body.get("channel", "card"),  # card, transfer, atm, pos
            "priority": body.get("priority", "medium"),
            "status": "filed",
            "slaDeadline": compute_sla_deadline(created),
            "assignedTo": None,
            "investigationNotes": [],
            "resolution": None,
            "resolutionAmount": None,
            "chargebackRef": None,
            "createdAt": created,
            "updatedAt": created,
        }
        disputes[dispute["id"]] = dispute
        bundle.kafka.publish("disputes.filed", dispute["id"], dispute)
        bundle.opensearch.index("disputes", dispute["id"], dispute)
        bundle.temporal.start_workflow("DisputeSLATracker", dispute["id"], {"slaHours": CBN_SLA_HOURS})
        record_audit("dispute-management", "dispute_filed", dispute["id"])
        respond_json(self, 201, dispute)

    def _add_evidence(self, did: str, body: dict):
        evidence = {
            "id": gen_id("EVD"),
            "disputeId": did,
            "type": body.get("type", "document"),  # document, screenshot, statement, cctv
            "description": body.get("description", ""),
            "fileRef": body.get("fileRef", ""),
            "submittedBy": body.get("submittedBy", "customer"),
            "createdAt": now_iso(),
        }
        evidence_items.append(evidence)
        disputes[did]["updatedAt"] = now_iso()
        respond_json(self, 201, evidence)

    def _start_investigation(self, did: str, body: dict):
        dispute = disputes[did]
        if dispute["status"] not in ("filed", "evidence_collected"):
            respond_json(self, 400, {"message": "Dispute must be filed or have evidence"})
            return
        dispute["status"] = "investigating"
        dispute["assignedTo"] = body.get("investigatorId", "auto-assigned")
        dispute["investigationNotes"].append({
            "note": body.get("note", "Investigation started"),
            "by": dispute["assignedTo"],
            "at": now_iso(),
        })
        dispute["updatedAt"] = now_iso()
        bundle.kafka.publish("disputes.investigation.started", did, dispute)
        respond_json(self, 200, dispute)

    def _resolve_dispute(self, did: str, body: dict):
        dispute = disputes[did]
        resolution = body.get("resolution")
        if resolution not in ("refund", "reject", "partial_credit", "no_action"):
            respond_json(self, 400, {
                "message": "resolution must be: refund, reject, partial_credit, or no_action"
            })
            return

        dispute["status"] = "resolved"
        dispute["resolution"] = resolution
        dispute["resolutionAmount"] = float(body.get("amount", 0))
        dispute["updatedAt"] = now_iso()

        bundle.kafka.publish("disputes.resolved", did, dispute)
        bundle.redis.set(f"dispute:resolved:{did}", dispute)
        record_audit("dispute-management", "dispute_resolved", did, details={"resolution": resolution})
        respond_json(self, 200, dispute)

    def _escalate_dispute(self, did: str, body: dict):
        dispute = disputes[did]
        dispute["status"] = "escalated"
        dispute["priority"] = "critical"
        dispute["investigationNotes"].append({
            "note": body.get("reason", "Escalated to senior management"),
            "by": body.get("escalatedBy", "system"),
            "at": now_iso(),
        })
        dispute["updatedAt"] = now_iso()
        bundle.temporal.start_workflow("DisputeEscalation", did)
        respond_json(self, 200, dispute)

    def _process_chargeback(self, did: str, body: dict):
        dispute = disputes[did]
        if dispute["channel"] != "card":
            respond_json(self, 400, {"message": "Chargeback only applicable for card transactions"})
            return

        chargeback_ref = gen_id("CHB")
        dispute["chargebackRef"] = chargeback_ref
        dispute["status"] = "chargeback_initiated"
        dispute["updatedAt"] = now_iso()

        bundle.kafka.publish("disputes.chargeback", did, {
            "disputeId": did,
            "chargebackRef": chargeback_ref,
            "amount": dispute["disputedAmount"],
            "network": body.get("network", "visa"),
            "reasonCode": body.get("reasonCode", "10.4"),
        })
        respond_json(self, 200, {"dispute": dispute, "chargebackRef": chargeback_ref})

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8102"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"Dispute Management service listening on :{port}")
    server.serve_forever()
