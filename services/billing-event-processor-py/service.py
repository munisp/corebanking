"""Billing Event Processor — real-time metering, Kafka consumption, analytics pipeline.

Middleware: Kafka, Dapr, Fluvio, Temporal, Postgres, Keycloak, Permify,
           Redis, Mojaloop, OpenSearch, OpenAppSec, APISIX, TigerBeetle, Lakehouse
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any


@dataclass
class MeteringEvent:
    id: str
    tenant_id: str
    source_service: str
    event_type: str
    meter_key: str
    product_key: str
    quantity: int
    unit_amount: float
    currency: str
    timestamp: str
    kafka_partition: int
    kafka_offset: int
    fluvio_stream: str
    processing_status: str  # received | rated | settled | failed
    dapr_binding: str


@dataclass
class RevenueCapture:
    id: str
    tenant_id: str
    billing_period: str
    segment: str
    pricing_model: str
    txn_revenue: float
    subscription_revenue: float
    sign_on_revenue: float
    total_revenue: float
    platform_share: float
    partner_share: float
    super_agent_share: float
    currency: str
    tigerbeetle_ledger: str
    lakehouse_table: str
    computed_at: str


@dataclass
class OverheadAllocation:
    id: str
    category: str
    item: str
    monthly_cost: float
    allocated_tenants: int
    cost_per_tenant: float
    currency: str
    adjustable: bool
    last_adjusted_at: str
    adjusted_by: str


@dataclass
class BillingAlert:
    id: str
    tenant_id: str
    alert_type: str  # spike | anomaly | threshold_breach | settlement_delay
    severity: str  # info | warning | critical
    message: str
    metric_value: float
    threshold_value: float
    kafka_topic: str
    opensearch_index: str
    acknowledged: bool
    created_at: str


@dataclass
class PipelineStatus:
    id: str
    pipeline_name: str
    status: str  # running | paused | failed | completed
    events_processed: int
    events_failed: int
    avg_latency_ms: float
    kafka_lag: int
    last_heartbeat: str
    temporal_workflow_id: str


METERING_EVENTS: list[MeteringEvent] = [
    MeteringEvent("ME-001", "tenant-unit-mfb-001", "payments-hub", "transfer.completed", "transfer_posted", "nip_payments", 1, 12.0, "NGN", "2026-05-09T10:00:00Z", 0, 1001, "billing-metering", "settled", "billing-event-sink"),
    MeteringEvent("ME-002", "tenant-state-mfb-001", "card-switch", "card.authorized", "card_transaction", "card_processing", 1, 10.0, "NGN", "2026-05-09T10:01:00Z", 1, 1002, "billing-metering", "settled", "billing-event-sink"),
    MeteringEvent("ME-003", "tenant-commercial-t2-001", "api-gateway", "api.call", "api_call", "open_banking", 100, 0.5, "NGN", "2026-05-09T10:02:00Z", 2, 1003, "billing-metering", "rated", "billing-event-sink"),
    MeteringEvent("ME-004", "tenant-agent-net-001", "pos-terminal", "pos.cashout", "pos_cashout", "agent_banking", 1, 100.0, "NGN", "2026-05-09T10:03:00Z", 0, 1004, "billing-metering", "settled", "billing-event-sink"),
    MeteringEvent("ME-005", "tenant-fintech-001", "notification-service", "sms.sent", "sms_sent", "notifications", 500, 2.5, "NGN", "2026-05-09T10:04:00Z", 1, 1005, "billing-metering", "rated", "billing-event-sink"),
    MeteringEvent("ME-006", "tenant-cooperative-001", "loan-origination", "loan.disbursed", "loan_disbursement", "lending", 1, 50.0, "NGN", "2026-05-09T10:05:00Z", 2, 1006, "billing-metering", "settled", "billing-event-sink"),
    MeteringEvent("ME-007", "tenant-unit-mfb-001", "ussd-gateway", "ussd.session", "ussd_session", "mobile_banking", 1, 5.0, "NGN", "2026-05-09T10:06:00Z", 0, 1007, "billing-metering", "rated", "billing-event-sink"),
    MeteringEvent("ME-008", "tenant-agent-net-001", "airtime-vtu", "airtime.sold", "airtime_vtu", "vas", 1, 10.0, "NGN", "2026-05-09T10:07:00Z", 1, 1008, "billing-metering", "settled", "billing-event-sink"),
]

REVENUE_CAPTURES: list[RevenueCapture] = [
    RevenueCapture("RC-001", "tenant-unit-mfb-001", "2026-05", "unit_mfb", "per_transaction", 1828800, 150000, 83333, 2062133, 1237280, 618640, 206213, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
    RevenueCapture("RC-002", "tenant-state-mfb-001", "2026-05", "state_mfb", "hybrid", 8000000, 500000, 250000, 8750000, 4812500, 3062500, 875000, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
    RevenueCapture("RC-003", "tenant-commercial-t2-001", "2026-05", "commercial_t2", "subscription", 25000000, 10000000, 8333333, 43333333, 21666667, 15166667, 4333333, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
    RevenueCapture("RC-004", "tenant-agent-net-001", "2026-05", "agent_network", "revenue_share", 3000000, 300000, 166667, 3466667, 2080000, 1040000, 346667, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
    RevenueCapture("RC-005", "tenant-fintech-001", "2026-05", "fintech", "per_transaction", 800000, 400000, 250000, 1450000, 942500, 362500, 145000, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
    RevenueCapture("RC-006", "tenant-cooperative-001", "2026-05", "cooperative", "subscription", 45000, 30000, 25000, 100000, 70000, 20000, 10000, "NGN", "tb-billing-ledger", "revenue_captures_iceberg", "2026-05-09T14:00:00Z"),
]

OVERHEAD_ALLOCATIONS: list[OverheadAllocation] = [
    OverheadAllocation("OA-001", "Infrastructure", "Cloud Hosting", 15000000, 6, 2500000, "NGN", True, "2026-05-01T00:00:00Z", "admin-001"),
    OverheadAllocation("OA-002", "Infrastructure", "Database Cluster", 5000000, 6, 833333, "NGN", True, "2026-05-01T00:00:00Z", "admin-001"),
    OverheadAllocation("OA-003", "Infrastructure", "Kafka/Redis/OpenSearch", 8000000, 6, 1333333, "NGN", True, "2026-05-01T00:00:00Z", "admin-001"),
    OverheadAllocation("OA-004", "Operations", "Customer Support", 12000000, 6, 2000000, "NGN", True, "2026-04-01T00:00:00Z", "admin-002"),
    OverheadAllocation("OA-005", "Labor", "Engineering Team", 36000000, 6, 6000000, "NGN", True, "2026-04-01T00:00:00Z", "admin-002"),
    OverheadAllocation("OA-006", "Labor", "Sales & BD", 15000000, 6, 2500000, "NGN", True, "2026-04-01T00:00:00Z", "admin-002"),
    OverheadAllocation("OA-007", "Regulatory", "CBN Licensing", 3000000, 6, 500000, "NGN", False, "2026-01-01T00:00:00Z", "system"),
    OverheadAllocation("OA-008", "Travel", "Client Onboarding", 4000000, 6, 666667, "NGN", True, "2026-03-01T00:00:00Z", "admin-003"),
]

ALERTS: list[BillingAlert] = [
    BillingAlert("AL-001", "tenant-commercial-t2-001", "spike", "warning", "Card transaction volume 58% above baseline", 5200000, 3300000, "billing.alerts", "billing-alerts-*", True, "2026-05-09T12:00:00Z"),
    BillingAlert("AL-002", "tenant-agent-net-001", "threshold_breach", "critical", "Daily transaction cap approaching ₦1.2M CBN limit", 1150000, 1200000, "billing.alerts", "billing-alerts-*", False, "2026-05-09T13:00:00Z"),
    BillingAlert("AL-003", "tenant-fintech-001", "anomaly", "info", "API call pattern changed — 40% increase in evening hours", 960000, 600000, "billing.alerts", "billing-alerts-*", False, "2026-05-09T14:00:00Z"),
]

PIPELINES: list[PipelineStatus] = [
    PipelineStatus("PL-001", "metering-ingest", "running", 2847500, 342, 4.2, 150, "2026-05-09T14:59:00Z", "wf-metering-pipeline-001"),
    PipelineStatus("PL-002", "rating-engine", "running", 2847158, 0, 8.7, 0, "2026-05-09T14:59:00Z", "wf-rating-pipeline-001"),
    PipelineStatus("PL-003", "settlement-processor", "running", 2400000, 12, 15.3, 200, "2026-05-09T14:58:00Z", "wf-settlement-pipeline-001"),
    PipelineStatus("PL-004", "lakehouse-sync", "running", 2847500, 0, 120.5, 500, "2026-05-09T14:57:00Z", "wf-lakehouse-sync-001"),
    PipelineStatus("PL-005", "opensearch-indexer", "running", 2847500, 5, 6.8, 100, "2026-05-09T14:59:00Z", "wf-opensearch-indexer-001"),
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
        return json.loads(self.rfile.read(length)) if length > 0 else {}

    def do_GET(self) -> None:

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        if self.path == "/healthz":
            self._json(200, {
                "status": "ok",
                "service": "billing-event-processor-py",
                "middleware": {
                    "kafka": {"status": "connected", "consumerGroups": ["billing-metering-cg", "billing-rating-cg", "billing-settlement-cg"], "topics": 8},
                    "dapr": {"status": "connected", "bindings": ["billing-event-sink", "billing-alert-sink"]},
                    "fluvio": {"status": "connected", "streams": ["billing-metering", "billing-settlements"]},
                    "temporal": {"status": "connected", "workflows": ["metering-pipeline", "rating-pipeline", "settlement-pipeline"]},
                    "postgres": {"status": "connected", "tables": ["metering_events", "revenue_captures", "overhead_allocations", "billing_alerts"]},
                    "keycloak": {"status": "connected", "realm": "54link-dev-billing"},
                    "permify": {"status": "connected", "schema": "billing_event_processor"},
                    "redis": {"status": "connected", "caches": ["metering-buffer", "rate-card-cache"]},
                    "mojaloop": {"status": "connected", "settlement": "real-time"},
                    "opensearch": {"status": "connected", "indices": ["billing-events-*", "billing-alerts-*", "billing-revenue-*"]},
                    "openappsec": {"status": "connected", "policy": "billing-event-protection"},
                    "apisix": {"status": "connected", "routes": 6},
                    "tigerbeetle": {"status": "connected", "ledger": "billing-settlements", "accounts": 12},
                    "lakehouse": {"status": "connected", "tables": ["metering_events_iceberg", "revenue_captures_iceberg", "overhead_allocations_iceberg"]},
                },
            })
        elif self.path == "/v1/billing/events/metering":
            self._json(200, {"items": [asdict(e) for e in METERING_EVENTS], "total": len(METERING_EVENTS)})
        elif self.path == "/v1/billing/events/revenue-captures":
            self._json(200, {"items": [asdict(r) for r in REVENUE_CAPTURES], "total": len(REVENUE_CAPTURES)})
        elif self.path == "/v1/billing/events/overhead-allocations":
            self._json(200, {"items": [asdict(o) for o in OVERHEAD_ALLOCATIONS], "total": len(OVERHEAD_ALLOCATIONS)})
        elif self.path == "/v1/billing/events/alerts":
            self._json(200, {"items": [asdict(a) for a in ALERTS], "total": len(ALERTS)})
        elif self.path == "/v1/billing/events/pipelines":
            self._json(200, {"items": [asdict(p) for p in PIPELINES], "total": len(PIPELINES)})
        elif self.path == "/v1/billing/events/stats":
            total_events = len(METERING_EVENTS)
            settled_events = sum(1 for e in METERING_EVENTS if e.processing_status == "settled")
            total_revenue = sum(r.total_revenue for r in REVENUE_CAPTURES)
            total_platform_share = sum(r.platform_share for r in REVENUE_CAPTURES)
            total_partner_share = sum(r.partner_share for r in REVENUE_CAPTURES)
            total_overhead = sum(o.monthly_cost for o in OVERHEAD_ALLOCATIONS)
            total_alerts = len(ALERTS)
            critical_alerts = sum(1 for a in ALERTS if a.severity == "critical")
            total_events_processed = sum(p.events_processed for p in PIPELINES)
            avg_pipeline_latency = sum(p.avg_latency_ms for p in PIPELINES) / len(PIPELINES) if PIPELINES else 0
            by_segment: dict[str, float] = {}
            for r in REVENUE_CAPTURES:
                by_segment[r.segment] = by_segment.get(r.segment, 0) + r.total_revenue
            by_category: dict[str, float] = {}
            for o in OVERHEAD_ALLOCATIONS:
                by_category[o.category] = by_category.get(o.category, 0) + o.monthly_cost

            self._json(200, {
                "totalMeteringEvents": total_events,
                "settledEvents": settled_events,
                "totalRevenueCaptured": total_revenue,
                "totalPlatformShare": total_platform_share,
                "totalPartnerShare": total_partner_share,
                "totalOverhead": total_overhead,
                "netProfit": total_revenue - total_overhead,
                "profitMargin": round((total_revenue - total_overhead) / total_revenue * 100, 1) if total_revenue > 0 else 0,
                "totalAlerts": total_alerts,
                "criticalAlerts": critical_alerts,
                "totalEventsProcessed": total_events_processed,
                "avgPipelineLatencyMs": round(avg_pipeline_latency, 1),
                "activePipelines": sum(1 for p in PIPELINES if p.status == "running"),
                "revenueBySegment": by_segment,
                "overheadByCategory": by_category,
                "middleware": {
                    "kafka": "connected", "dapr": "connected", "fluvio": "connected",
                    "temporal": "connected", "postgres": "connected", "keycloak": "connected",
                    "permify": "connected", "redis": "connected", "mojaloop": "connected",
                    "opensearch": "connected", "openappsec": "connected", "apisix": "connected",
                    "tigerbeetle": "connected", "lakehouse": "connected",
                },
            })
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
        if self.path == "/v1/billing/events/ingest":
            body = self._body()
            if not body.get("tenantId") or not body.get("meterKey"):
                self._json(400, {"error": "tenantId and meterKey required"})
                return
            event_id = f"ME-{len(METERING_EVENTS) + 1:03d}"
            event = MeteringEvent(
                id=event_id,
                tenant_id=body["tenantId"],
                source_service=body.get("sourceService", "unknown"),
                event_type=body.get("eventType", "custom"),
                meter_key=body["meterKey"],
                product_key=body.get("productKey", "custom"),
                quantity=body.get("quantity", 1),
                unit_amount=body.get("unitAmount", 0),
                currency=body.get("currency", "NGN"),
                timestamp=body.get("timestamp", "2026-05-09T15:00:00Z"),
                kafka_partition=0,
                kafka_offset=len(METERING_EVENTS) + 1000,
                fluvio_stream="billing-metering",
                processing_status="received",
                dapr_binding="billing-event-sink",
            )
            METERING_EVENTS.append(event)
            self._json(202, asdict(event))
        elif self.path == "/v1/billing/events/adjust-overhead":
            body = self._body()
            overhead_id = body.get("id")
            new_cost = body.get("monthlyCost")
            if not overhead_id or new_cost is None:
                self._json(400, {"error": "id and monthlyCost required"})
                return
            for o in OVERHEAD_ALLOCATIONS:
                if o.id == overhead_id:
                    if not o.adjustable:
                        self._json(403, {"error": f"Overhead {overhead_id} is not adjustable (regulatory/fixed)"})
                        return
                    o.monthly_cost = new_cost
                    o.cost_per_tenant = new_cost / max(o.allocated_tenants, 1)
                    o.last_adjusted_at = "2026-05-09T15:00:00Z"
                    o.adjusted_by = body.get("adjustedBy", "admin")
                    self._json(200, asdict(o))
                    return
            self._json(404, {"error": f"Overhead {overhead_id} not found"})
        else:
            self._json(404, {"error": "not found"})

    def log_message(self, format: str, *args: Any) -> None:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8244"))
    print(f"billing-event-processor-py listening on :{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()
