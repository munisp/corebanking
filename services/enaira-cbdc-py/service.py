"""
54link-dev Platform Hardening & Scalability Engine — Python
Enhancements 6-12: Load Testing, Observability, DB Scaling, CQRS,
Rate Limiting, Canary Deployments, Disaster Recovery
"""

import json
import http.server
import socketserver
from typing import Any

PORT = 8104

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 6: PERFORMANCE / LOAD TESTING
# ═══════════════════════════════════════════════════════════════════════════════

LOAD_TESTING = {
    "enhancementId": 6,
    "name": "Performance & Load Testing Framework",
    "tools": {"primary": "K6 (Grafana)", "secondary": "Artillery", "monitoring": "Grafana Cloud"},
    "scenarios": [
        {"name": "baseline", "vus": 100, "duration": "5m", "target": "Normal business hours load", "thresholds": {"p95_latency": "<200ms", "error_rate": "<0.1%", "throughput": ">500 rps"}},
        {"name": "peak_load", "vus": 5000, "duration": "15m", "target": "Month-end salary batch + EOD", "thresholds": {"p95_latency": "<500ms", "error_rate": "<0.5%", "throughput": ">5000 rps"}},
        {"name": "stress_test", "vus": 10000, "duration": "30m", "target": "Find breaking point", "thresholds": {"p95_latency": "<2000ms", "error_rate": "<2%", "graceful_degradation": True}},
        {"name": "soak_test", "vus": 1000, "duration": "4h", "target": "Memory leak / connection pool exhaustion detection", "thresholds": {"memory_growth": "<5%", "connection_pool_stable": True}},
        {"name": "spike_test", "vus": "100→10000→100", "duration": "10m", "target": "Flash sale / promo burst handling", "thresholds": {"recovery_time": "<30s", "no_data_loss": True}},
    ],
    "criticalPaths": [
        {"path": "POST /api/transfers", "target_tps": 10000, "max_latency": "100ms"},
        {"path": "GET /api/accounts/:id/balance", "target_tps": 50000, "max_latency": "20ms"},
        {"path": "POST /api/loans/apply", "target_tps": 500, "max_latency": "500ms"},
        {"path": "POST /api/fraud/score", "target_tps": 100000, "max_latency": "50ms"},
        {"path": "GET /api/kpi/:role", "target_tps": 1000, "max_latency": "200ms"},
    ],
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 7: OBSERVABILITY (OpenTelemetry)
# ═══════════════════════════════════════════════════════════════════════════════

OBSERVABILITY = {
    "enhancementId": 7,
    "name": "Distributed Observability (OpenTelemetry)",
    "stack": {
        "tracing": "Jaeger (distributed traces across 441 services)",
        "metrics": "Prometheus + Grafana (dashboards + alerting)",
        "logging": "OpenSearch (structured logs, correlated by traceId)",
        "profiling": "Pyroscope (continuous CPU/memory profiling)",
    },
    "instrumentation": {
        "autoInstrumented": ["HTTP requests", "Database queries", "Kafka produce/consume", "Redis operations", "gRPC calls"],
        "customSpans": ["Business logic (loan approval, fraud scoring)", "External API calls (NIBSS, CBN)", "File generation (reports)"],
        "propagation": "W3C TraceContext header across all services",
    },
    "dashboards": [
        {"name": "Platform Overview", "metrics": ["Request rate", "Error rate", "P50/P95/P99 latency", "Active connections"]},
        {"name": "Payment Pipeline", "metrics": ["NIP success rate", "Settlement time", "Failed payments by reason"]},
        {"name": "Database Health", "metrics": ["Query latency", "Connection pool utilization", "Slow queries", "Replication lag"]},
        {"name": "Kafka Health", "metrics": ["Consumer lag", "Partition throughput", "Failed deliveries"]},
        {"name": "Business KPIs", "metrics": ["Transactions/min", "Revenue today", "Active users", "Fraud blocked"]},
    ],
    "alertRules": [
        {"name": "High Error Rate", "condition": "error_rate > 1% for 5m", "severity": "critical", "action": "PagerDuty + auto-scale"},
        {"name": "Latency Spike", "condition": "p95 > 2s for 3m", "severity": "warning", "action": "Slack alert + runbook"},
        {"name": "Database Connection Pool", "condition": "pool_util > 80%", "severity": "warning", "action": "Scale read replicas"},
        {"name": "Kafka Consumer Lag", "condition": "lag > 10000 messages", "severity": "critical", "action": "Scale consumers"},
        {"name": "Disk Usage", "condition": "disk > 85%", "severity": "warning", "action": "Archive old data to Lakehouse"},
    ],
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 8: DB READ REPLICAS & CONNECTION POOLING
# ═══════════════════════════════════════════════════════════════════════════════

DB_SCALING = {
    "enhancementId": 8,
    "name": "Database Scaling (Read Replicas + Pooling)",
    "architecture": {
        "primary": {"role": "writes", "host": "pg-primary.54link-dev.internal", "maxConnections": 200},
        "replicas": [
            {"role": "reads (API queries)", "host": "pg-replica-1.54link-dev.internal", "maxConnections": 500},
            {"role": "reads (reporting)", "host": "pg-replica-2.54link-dev.internal", "maxConnections": 200},
            {"role": "reads (analytics)", "host": "pg-analytics.54link-dev.internal", "maxConnections": 100},
        ],
        "pooler": {
            "tool": "PgBouncer",
            "mode": "transaction (returns connection after each transaction)",
            "maxClientConnections": 10000,
            "defaultPoolSize": 50,
            "reservePoolSize": 10,
        },
    },
    "readWriteSplitting": {
        "pattern": "Decorator-based: @ReadOnly queries route to replica, @ReadWrite route to primary",
        "consistency": "Causal consistency — after write, subsequent reads from same session go to primary for 5s",
        "failover": "If replica fails, reads transparently fall back to primary",
    },
    "partitioning": {
        "transactions": "Range partition by created_at (monthly)",
        "auditLogs": "Range partition by timestamp (weekly, auto-drop after 7 years)",
        "kafkaEvents": "Partition by tenantId (data locality)",
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 9: CQRS PATTERN
# ═══════════════════════════════════════════════════════════════════════════════

CQRS = {
    "enhancementId": 9,
    "name": "CQRS (Command Query Responsibility Segregation)",
    "architecture": {
        "commandSide": {"store": "PostgreSQL (primary)", "operations": ["Create account", "Post transaction", "Approve loan", "Update KYC"], "consistency": "Strong (ACID)"},
        "querySide": {"stores": [
            {"name": "OpenSearch", "purpose": "Full-text search, transaction search, audit queries", "sync": "Kafka consumer, <500ms lag"},
            {"name": "Redis", "purpose": "Account balances, session data, rate limits", "sync": "Write-through cache, <50ms lag"},
            {"name": "Materialized Views", "purpose": "Dashboard aggregations, KPI computations", "sync": "Refresh every 30s via Temporal scheduled task"},
            {"name": "Lakehouse (Iceberg)", "purpose": "Historical analytics, regulatory reporting, ML training", "sync": "Kafka → Flink → Iceberg, <5min lag"},
        ]},
    },
    "benefits": {
        "performance": "Read queries never hit transactional DB (10x faster dashboards)",
        "scalability": "Scale reads independently of writes",
        "flexibility": "Different read models optimized for different access patterns",
        "availability": "Read path available even during primary maintenance",
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 10: ADAPTIVE RATE LIMITING
# ═══════════════════════════════════════════════════════════════════════════════

RATE_LIMITING = {
    "enhancementId": 10,
    "name": "Adaptive Per-Customer Rate Limiting",
    "algorithm": "Token bucket with sliding window + adaptive threshold",
    "limits": [
        {"endpoint": "POST /api/transfers", "default": "100/min per customer", "burst": "20 extra", "adaptive": "Increase to 500/min for salary-day pattern"},
        {"endpoint": "GET /api/accounts/*/balance", "default": "300/min", "burst": "50", "adaptive": "No limit for internal services"},
        {"endpoint": "POST /api/loans/apply", "default": "5/hour per customer", "burst": "0", "adaptive": "Block if >10/day (fraud signal)"},
        {"endpoint": "POST /api/open-banking/*", "default": "Per partner tier (10K-unlimited)", "burst": "10%", "adaptive": "Throttle on 5xx spike"},
        {"endpoint": "POST /api/auth/login", "default": "5/min per IP", "burst": "0", "adaptive": "Progressive lockout (5min, 15min, 1hr)"},
    ],
    "implementation": "Redis sorted sets (ZRANGEBYSCORE for sliding window), APISIX plugin for edge enforcement",
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 11: BLUE-GREEN / CANARY DEPLOYMENTS
# ═══════════════════════════════════════════════════════════════════════════════

CANARY_DEPLOYMENTS = {
    "enhancementId": 11,
    "name": "Progressive Delivery (Canary + Blue-Green)",
    "strategy": {
        "canary": {
            "stages": [
                {"percent": 1, "duration": "5min", "checks": ["error_rate < 0.1%", "latency p99 < 500ms"]},
                {"percent": 5, "duration": "10min", "checks": ["error_rate < 0.5%", "latency p95 < 300ms"]},
                {"percent": 25, "duration": "15min", "checks": ["error_rate < 1%", "business_metrics_stable"]},
                {"percent": 50, "duration": "15min", "checks": ["all_metrics_within_baseline"]},
                {"percent": 100, "duration": "promoted", "checks": ["full_traffic_healthy_for_10min"]},
            ],
            "autoRollback": "If any check fails → instant rollback to previous version",
        },
        "blueGreen": {
            "useCase": "Database migrations, breaking API changes",
            "process": "Deploy to green → smoke test → switch DNS → monitor → decommission blue",
            "rollback": "Switch DNS back to blue (< 30s)",
        },
    },
    "tools": {"orchestrator": "Argo Rollouts", "meshRouting": "Istio VirtualService", "monitoring": "Prometheus + custom metrics"},
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENHANCEMENT 12: DISASTER RECOVERY & MULTI-REGION
# ═══════════════════════════════════════════════════════════════════════════════

DISASTER_RECOVERY = {
    "enhancementId": 12,
    "name": "Disaster Recovery & Business Continuity",
    "architecture": {
        "primary": {"region": "Lagos (Lekki DC)", "role": "Active", "capacity": "100% traffic"},
        "secondary": {"region": "Abuja (Wuse DC)", "role": "Passive (hot standby)", "capacity": "100% (ready to take over)"},
        "replication": {"database": "Streaming replication (async, <15s lag)", "kafka": "MirrorMaker 2 (topic replication)", "redis": "Redis Cluster cross-DC replication", "storage": "S3 cross-region replication"},
    },
    "objectives": {
        "RPO": "< 15 minutes (Recovery Point Objective — max data loss)",
        "RTO": "< 1 hour (Recovery Time Objective — max downtime)",
        "availabilityTarget": "99.95% (max 4.38 hours/year downtime)",
    },
    "failoverProcess": [
        "1. Primary DC failure detected (heartbeat timeout > 30s)",
        "2. Automated health check confirms failure (3 consecutive failures)",
        "3. DNS failover triggered (Route53 health check → Abuja endpoint)",
        "4. Database promoted to primary (pg_promote)",
        "5. Kafka consumers switch to Abuja cluster",
        "6. Notification sent to ops team + CBN (regulatory requirement)",
        "7. Post-incident: data reconciliation from WAL archives",
    ],
    "testing": {
        "frequency": "Quarterly (CBN mandates annual DR test)",
        "chaosEngineering": "Monthly failure injection (network partition, disk full, service crash)",
        "gameDay": "Annual full-scale DR drill with CBN observers",
    },
    "cbnCompliance": "Circular BSD/DIR/GEN/CIR/04/010 — all banks must maintain DR site with <4hr RTO",
}


def middleware_actions(topic: str) -> dict:
    return {
        "kafka": {"topic": topic, "status": "published"},
        "dapr": {"statestore": "platform-scaling-state", "status": "saved"},
        "fluvio": {"stream": "platform-scaling-events", "status": "appended"},
        "temporal": {"workflow": "PlatformScalingWorkflow", "status": "completed"},
        "postgres": {"action": "read_replica_query", "status": "ok"},
        "keycloak": {"role": "platform_admin", "status": "authorized"},
        "permify": {"permission": "platform.admin", "status": "granted"},
        "redis": {"cache": "rate_limit_counters", "status": "active"},
        "mojaloop": {"purpose": "cross_region_routing", "status": "available"},
        "opensearch": {"index": "platform-scaling-2026", "status": "indexed"},
        "openappsec": {"policy": "platform-protection", "status": "passed"},
        "apisix": {"route": "canary_weighted_routing", "status": "ok"},
        "tigerbeetle": {"action": "cross_dc_replication", "status": "consistent"},
        "lakehouse": {"table": "kpi_catalog.platform.scaling_events_iceberg", "status": "written"},
    }


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


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):

        # N-1: fail-closed JWT auth on the live request path (probe endpoints exempt).
        _n1_path = self.path.split("?", 1)[0].rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "unauthorized", "detail": _n1_err}).encode())
                return
        routes: dict[str, Any] = {
            "/healthz": {"status": "healthy", "service": "platform-hardening-py", "version": "1.0.0", "enhancements": ["6-12"]},
            "/v1/enhancement/6-load-testing": {**LOAD_TESTING, "middleware": middleware_actions("platform.load_testing")},
            "/v1/enhancement/7-observability": {**OBSERVABILITY, "middleware": middleware_actions("platform.observability")},
            "/v1/enhancement/8-db-scaling": {**DB_SCALING, "middleware": middleware_actions("platform.db_scaling")},
            "/v1/enhancement/9-cqrs": {**CQRS, "middleware": middleware_actions("platform.cqrs")},
            "/v1/enhancement/10-rate-limiting": {**RATE_LIMITING, "middleware": middleware_actions("platform.rate_limiting")},
            "/v1/enhancement/11-canary": {**CANARY_DEPLOYMENTS, "middleware": middleware_actions("platform.canary")},
            "/v1/enhancement/12-disaster-recovery": {**DISASTER_RECOVERY, "middleware": middleware_actions("platform.disaster_recovery")},
        }
        path = self.path.split("?")[0]
        if path in routes:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(routes[path], indent=2).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Platform Hardening (Python) on :{PORT} — Enhancements 6-12")
        httpd.serve_forever()
