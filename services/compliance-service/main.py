"""
Compliance & Regulatory Service - Complete Production Implementation
Handles regulatory reporting, AML/CFT, sanctions screening, transaction monitoring, and SAR filing
"""

from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from audit_middleware import AuditMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uvicorn
import asyncpg
import os
import json
import asyncio
import requests
from dotenv import load_dotenv
from utils import to_utc
from utils.kafka_instance import KafkaClientInstance
from utils.kafka_client import ComplianceEventTypes

load_dotenv()

# CP-02: SARs are filed through the real NFIU goAML filer service
# (nfiu-ctr-str-filing-py). When unset, SAR submission fails closed with 503.
NFIU_FILING_URL = os.getenv("NFIU_FILING_URL", "").rstrip("/")
NFIU_SERVICE_TOKEN = os.getenv("NFIU_SERVICE_TOKEN", "")
SAR_FILING_RETRY_SECONDS = int(os.getenv("SAR_FILING_RETRY_SECONDS", "300"))
SAR_ACK_POLL_SECONDS = int(os.getenv("SAR_ACK_POLL_SECONDS", "300"))
SAR_MAX_FILING_ATTEMPTS = int(os.getenv("SAR_MAX_FILING_ATTEMPTS", "10"))

app = FastAPI(
    title="54Link Compliance Service",
    description="Complete compliance and regulatory reporting service",
    version="1.0.0"
)
# --- OpenTelemetry (SPEC w9 §2.5 TEMPLATE): otelkit init + tenant middleware.
# OTLP gRPC traces+metrics (default http://otel-collector:4317), W3C
# tracecontext+baggage propagation, FastAPI server spans, TenantMiddleware
# (tenant.id span attr from x-tenant-id). Honors OTEL_SDK_DISABLED; never raises.
try:
    import os as _otel_os
    import sys as _otel_sys

    _otel_sys.path.insert(
        0,
        _otel_os.path.normpath(
            _otel_os.path.join(
                _otel_os.path.dirname(__file__), "..", "..", "shared", "otel", "python"
            )
        ),
    )
    from otelkit import init_telemetry, instrument_kafka

    init_telemetry("compliance-service", app)
    instrument_kafka()
except Exception as _otel_exc:
    import logging as _otel_logging

    _otel_logging.getLogger("otel").warning("otelkit init skipped: %s", _otel_exc)


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

# --- JWT enforcement middleware (finding N-1: fail-closed JWT auth on the live FastAPI path) ---
import inspect as _jwt_inspect
from starlette.middleware.base import BaseHTTPMiddleware as _JWTBaseHTTPMiddleware
from starlette.responses import JSONResponse as _JWTJSONResponse

# Probe endpoints are exempt; everything else requires a verifiable Bearer JWT.
_JWT_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"})


def _jwt_set_scope_header(scope, name, value):
    """Overwrite (or remove, when value is None) a request header in the ASGI scope so
    downstream handlers see identity derived ONLY from verified token claims."""
    encoded = name.lower().encode("latin-1")
    headers = [(k, v) for k, v in scope.get("headers", []) if k != encoded]
    if value is not None:
        headers.append((encoded, str(value).encode("latin-1")))
    scope["headers"] = headers


class JWTAuthMiddleware(_JWTBaseHTTPMiddleware):
    """Fail-closed JWT authentication for all domain routes.

    Only the probe paths /health, /ready, /metrics (and their k8s variants
    /healthz, /readyz, /livez) plus CORS preflight (OPTIONS) are exempt. On
    success the verified claims are stored on request.state.jwt_claims and the
    tenant identity headers (x-tenant-id / x-tenant) in the ASGI scope are
    overwritten with the verified claim values, so downstream header readers
    receive ONLY the authenticated tenant. Failure: 401 JSON (503 when the JWKS
    endpoint is unreachable with a cold cache). Works with sync or async
    validate_jwt implementations.
    """

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS" or request.url.path in _JWT_EXEMPT_PATHS:
            return await call_next(request)
        try:
            if _jwt_inspect.iscoroutinefunction(validate_jwt):
                claims, err = await validate_jwt(request.headers)
            else:
                claims, err = validate_jwt(request.headers)
        except Exception as exc:
            return _JWTJSONResponse(status_code=503, content={"error": "auth_unavailable", "detail": str(exc)})
        if not claims:
            status = 503 if err == "jwks_unavailable" else 401
            return _JWTJSONResponse(status_code=status, content={"error": "unauthorized", "detail": err})
        request.state.jwt_claims = claims
        tenant = claims.get("tenant_id") or claims.get("tenant")
        _jwt_set_scope_header(request.scope, "x-tenant-id", tenant)
        _jwt_set_scope_header(request.scope, "x-tenant", tenant)
        subject = claims.get("sub") or claims.get("keycloak_id")
        if subject:
            _jwt_set_scope_header(request.scope, "x-keycloak-id", subject)
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
app.add_middleware(AuditMiddleware)
db_pool = None

# Enums
class ReportType(str, Enum):
    CBN_DAILY = "cbn_daily"
    CBN_WEEKLY = "cbn_weekly"
    CBN_MONTHLY = "cbn_monthly"
    AML_MONTHLY = "aml_monthly"
    KYC_QUARTERLY = "kyc_quarterly"
    TRANSACTION_SUMMARY = "transaction_summary"
    REGULATORY_CAPITAL = "regulatory_capital"

class ReportStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    # CP-11: no real transmission integration exists, so a report can never be
    # silently flipped to 'submitted'. The honest terminal state is
    # 'prepared_for_manual_filing'.
    PREPARED_FOR_MANUAL_FILING = "prepared_for_manual_filing"
    SUBMITTED = "submitted"

class AlertSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SARStatus(str, Enum):
    DRAFT = "draft"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    SUBMITTED = "submitted"  # CP-02: accepted by NFIU filer, awaiting goAML ack
    FILED = "filed"
    REJECTED = "rejected"

# Models
class RegulatoryReport(BaseModel):
    tenant_id: str
    report_type: ReportType
    period_start: datetime
    period_end: datetime
    parameters: Optional[Dict] = None

class ComplianceAlert(BaseModel):
    tenant_id: str
    alert_type: str
    severity: AlertSeverity
    entity_type: str  # customer, transaction, merchant
    entity_id: str
    description: str
    metadata: Optional[Dict] = None

class ResolveComplianceAlert(BaseModel):
    note: str
    resolved_by: str

class SARFiling(BaseModel):
    tenant_id: str
    subject_name: str
    subject_type: str  # individual, entity
    subject_id: str
    suspicious_activity_type: str
    activity_description: str
    transaction_ids: List[str]
    total_amount: Decimal
    currency: str
    filing_reason: str
    supporting_documents: Optional[List[str]] = None

class TransactionMonitoringRule(BaseModel):
    tenant_id: str
    rule_name: str
    rule_type: str  # velocity, threshold, pattern, geographic
    conditions: Dict
    alert_severity: AlertSeverity
    is_active: bool = True

class AccessAMLRisk(BaseModel):
    tenant_id: str
    entity_type: str
    entity_id: str
    risk_factors: List[str]

class MonitoringRule(BaseModel):
    tenant_id: str
    rule_name: str
    rule_type: str
    conditions: Dict
    alert_severity: str

class MonitorTransaction(BaseModel):
    tenant_id: str
    transaction_id: str
    amount: Decimal
    # currency: str
    # customer_id: str
    # transaction_type: str
    # metadata: Optional[Dict] = None

class FileSar(BaseModel):
    tenant_id: str
    subject_name: str
    subject_type: str
    subject_id: str
    suspicious_activity_type: str
    activity_description: str
    transaction_ids: List[str]
    total_amount: Decimal
    currency: str
    filing_reason: str
    created_by: str
    supporting_documents: Optional[List[str]] = None

class SubmitSar(BaseModel):
    # CP-02: the caller-supplied filing_reference was removed — a typed-in
    # reference is not proof of filing. The filing reference is now fetched
    # from the NFIU filer's goAML acknowledgement.
    reviewed_by: str

# Database functions
async def get_db():
    return db_pool

_sar_workers: List[asyncio.Task] = []

@app.on_event("startup")
async def startup():
    global db_pool
    db_host = os.getenv("DB_HOST", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "compliance_db")
    
    try:
        db_pool = await asyncpg.create_pool(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name,
            min_size=2,
            max_size=10
        )
    except Exception as e:
        print(f"[compliance-service] DB connection failed on startup: {e}", flush=True)
        db_pool = None

    if db_pool is None:
        print("[compliance-service] Running without DB — endpoints requiring DB will return 503", flush=True)
        return

    # Create tables
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS regulatory_reports (
                id SERIAL PRIMARY KEY,
                report_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                report_type VARCHAR(50) NOT NULL,
                period_start TIMESTAMPTZ NOT NULL,
                period_end TIMESTAMPTZ NOT NULL,
                parameters JSONB,
                report_data JSONB,
                file_url VARCHAR(500),
                status VARCHAR(20) DEFAULT 'pending',
                generated_at TIMESTAMPTZ,
                submitted_at TIMESTAMPTZ,
                submission_reference VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_reports_tenant ON regulatory_reports(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_reports_type ON regulatory_reports(report_type);
            CREATE INDEX IF NOT EXISTS idx_reports_status ON regulatory_reports(status);
            
            CREATE TABLE IF NOT EXISTS compliance_alerts (
                id SERIAL PRIMARY KEY,
                alert_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                alert_type VARCHAR(100) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                metadata JSONB,
                status VARCHAR(20) DEFAULT 'open',
                assigned_to VARCHAR(255),
                resolved_at TIMESTAMPTZ,
                resolution_notes TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON compliance_alerts(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_alerts_severity ON compliance_alerts(severity);
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON compliance_alerts(status);
            
            CREATE TABLE IF NOT EXISTS sar_filings (
                id SERIAL PRIMARY KEY,
                sar_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                subject_name VARCHAR(255) NOT NULL,
                subject_type VARCHAR(50) NOT NULL,
                subject_id VARCHAR(100) NOT NULL,
                suspicious_activity_type VARCHAR(100) NOT NULL,
                activity_description TEXT NOT NULL,
                transaction_ids JSONB,
                total_amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'NGN',
                filing_reason TEXT NOT NULL,
                supporting_documents JSONB,
                status VARCHAR(20) DEFAULT 'draft',
                filed_at TIMESTAMPTZ,
                filing_reference VARCHAR(100),
                created_by VARCHAR(255),
                reviewed_by VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_sar_tenant ON sar_filings(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_sar_status ON sar_filings(status);
            
            CREATE TABLE IF NOT EXISTS transaction_monitoring_rules (
                id SERIAL PRIMARY KEY,
                rule_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                rule_name VARCHAR(255) NOT NULL,
                rule_type VARCHAR(50) NOT NULL,
                conditions JSONB NOT NULL,
                alert_severity VARCHAR(20) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                triggered_count INT DEFAULT 0,
                last_triggered_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_monitoring_rules_tenant ON transaction_monitoring_rules(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_monitoring_rules_active ON transaction_monitoring_rules(is_active);
            
            CREATE TABLE IF NOT EXISTS sanctions_screening (
                id SERIAL PRIMARY KEY,
                screening_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                entity_name VARCHAR(255) NOT NULL,
                screening_result VARCHAR(20) NOT NULL,
                match_score DECIMAL(5,2),
                matched_lists JSONB,
                screening_provider VARCHAR(100),
                screened_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_sanctions_entity ON sanctions_screening(entity_id);
            CREATE INDEX IF NOT EXISTS idx_sanctions_result ON sanctions_screening(screening_result);
            
            CREATE TABLE IF NOT EXISTS aml_risk_assessments (
                id SERIAL PRIMARY KEY,
                assessment_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                risk_level VARCHAR(20) NOT NULL,
                risk_score INT NOT NULL,
                risk_factors JSONB,
                assessment_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_aml_risk_entity ON aml_risk_assessments(entity_id);
            CREATE INDEX IF NOT EXISTS idx_aml_risk_level ON aml_risk_assessments(risk_level);

            -- CP-02: columns linking a SAR to the real NFIU STR filing.
            ALTER TABLE sar_filings ADD COLUMN IF NOT EXISTS nfiu_str_id VARCHAR(100);
            ALTER TABLE sar_filings ADD COLUMN IF NOT EXISTS goaml_ref VARCHAR(100);

            -- CP-02: durable retry queue for SAR filings that could not reach
            -- the NFIU filer — a submission failure is never silently dropped.
            CREATE TABLE IF NOT EXISTS sar_filing_queue (
                sar_id VARCHAR(50) PRIMARY KEY REFERENCES sar_filings(sar_id),
                tenant_id VARCHAR(50) NOT NULL,
                reviewed_by VARCHAR(255),
                attempts INT NOT NULL DEFAULT 0,
                max_attempts INT NOT NULL DEFAULT 10,
                last_error TEXT,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        """)

    # CP-02: background workers — retry queued SAR filings and poll the NFIU
    # filer for goAML acknowledgements so status 'filed' reflects a real ack.
    global _sar_workers
    _sar_workers = [
        asyncio.create_task(_sar_filing_retry_loop()),
        asyncio.create_task(_sar_ack_poll_loop()),
    ]

    print("Compliance service started successfully")

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    for t in _sar_workers:
        t.cancel()
    if db_pool:
        await db_pool.close()

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "compliance-service"}

# Regulatory Reporting Endpoints
@app.post("/api/v1/compliance/reports/generate")
async def generate_regulatory_report(
    report: RegulatoryReport,
    background_tasks: BackgroundTasks,
    db=Depends(get_db)
):
    """Generate a regulatory report"""
    report_id = f"RPT{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO regulatory_reports (
                report_id, tenant_id, report_type, period_start, period_end,
                parameters, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'generating')
        """, report_id, report.tenant_id, report.report_type.value,
            to_utc(report.period_start), to_utc(report.period_end), json.dumps(report.parameters or {}))
    
    # Generate report in background
    background_tasks.add_task(generate_report_data, report_id, report)
    
    return {
        "status": "initiated",
        "report_id": report_id,
        "report_type": report.report_type.value,
        "message": "Report generation started"
    }

async def generate_report_data(report_id: str, report: RegulatoryReport):
    """Background task to generate report data.

    CP-11: the hardcoded totals ("total_transactions": 15420, "total_volume":
    2450000000.00, "flagged_transactions": 23) were fabrication — deleted.
    Data is now generated from real queries against this service's own schema.
    Transaction count/volume are NOT available in the compliance schema (the
    OLTP ledger lives elsewhere); they are reported as null with an explicit
    note rather than invented. On DB failure the report is marked 'failed'.
    """
    if db_pool is None:
        return
    try:
        async with db_pool.acquire() as conn:
            start = to_utc(report.period_start)
            end = to_utc(report.period_end)
            tenant = report.tenant_id

            alerts_total = await conn.fetchval(
                "SELECT COUNT(*) FROM compliance_alerts WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3",
                tenant, start, end)
            alerts_open = await conn.fetchval(
                "SELECT COUNT(*) FROM compliance_alerts WHERE tenant_id=$1 AND status='open' AND created_at BETWEEN $2 AND $3",
                tenant, start, end)
            alerts_critical = await conn.fetchval(
                "SELECT COUNT(*) FROM compliance_alerts WHERE tenant_id=$1 AND severity='critical' AND created_at BETWEEN $2 AND $3",
                tenant, start, end)
            sars_created = await conn.fetchval(
                "SELECT COUNT(*) FROM sar_filings WHERE tenant_id=$1 AND created_at BETWEEN $2 AND $3",
                tenant, start, end)
            sars_filed = await conn.fetchval(
                "SELECT COUNT(*) FROM sar_filings WHERE tenant_id=$1 AND status='filed' AND created_at BETWEEN $2 AND $3",
                tenant, start, end)
            screenings = await conn.fetchval(
                "SELECT COUNT(*) FROM sanctions_screening WHERE tenant_id=$1 AND screened_at BETWEEN $2 AND $3",
                tenant, start, end)
            screening_hits = await conn.fetchval(
                "SELECT COUNT(*) FROM sanctions_screening WHERE tenant_id=$1 AND screening_result <> 'clear' AND screened_at BETWEEN $2 AND $3",
                tenant, start, end)

            report_data = {
                "report_id": report_id,
                "report_type": report.report_type.value,
                "period": {
                    "start": report.period_start.isoformat(),
                    "end": report.period_end.isoformat()
                },
                "summary": {
                    # Real counts from the compliance schema only.
                    "compliance_alerts_total": alerts_total,
                    "compliance_alerts_open": alerts_open,
                    "compliance_alerts_critical": alerts_critical,
                    "sars_created": sars_created,
                    "sars_filed": sars_filed,
                    "sanctions_screenings": screenings,
                    "sanctions_screening_hits": screening_hits,
                    # CP-11: not fabricatable from this schema — explicitly null.
                    "total_transactions": None,
                    "total_volume": None,
                },
                "data_notes": [
                    "total_transactions/total_volume are not available in the compliance schema; "
                    "use efass-generator-rs (GL-derived) for financial aggregates. Nulls are "
                    "honest absences, not zeroes.",
                ],
                "generated_at": datetime.now().isoformat()
            }

            await conn.execute("""
                UPDATE regulatory_reports
                SET report_data = $1, status = 'completed', generated_at = CURRENT_TIMESTAMP
                WHERE report_id = $2
            """, json.dumps(report_data), report_id)
    except Exception as exc:
        print(f"[compliance-service] report generation failed for {report_id}: {exc}", flush=True)
        async with db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE regulatory_reports SET status = 'failed' WHERE report_id = $1
            """, report_id)

@app.get("/api/v1/compliance/reports/{report_id}")
async def get_regulatory_report(report_id: str, db=Depends(get_db)):
    """Get regulatory report details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM regulatory_reports WHERE report_id = $1
        """, report_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return dict(row)

@app.get("/api/v1/compliance/reports/tenant/{tenant_id}")
async def list_regulatory_reports(
    tenant_id: str,
    report_type: Optional[ReportType] = None,
    status: Optional[ReportStatus] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db)
):
    """List regulatory reports for a tenant"""
    offset = (page - 1) * limit
    where = "WHERE tenant_id = $1"
    params = [tenant_id]
    param_count = 2

    if report_type:
        where += f" AND report_type = ${param_count}"
        params.append(report_type.value)
        param_count += 1

    if status:
        where += f" AND status = ${param_count}"
        params.append(status.value)
        param_count += 1

    async with db.acquire() as conn:
        total = await conn.fetchval(f"SELECT COUNT(*) FROM regulatory_reports {where}", *params)
        query = f"SELECT * FROM regulatory_reports {where} ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        rows = await conn.fetch(query, *params)
        return {
            "tenant_id": tenant_id,
            "reports": [dict(row) for row in rows],
            "total": total,
            "page": page,
            "limit": limit,
        }

@app.post("/api/v1/compliance/reports/{report_id}/submit")
async def submit_regulatory_report(
    report_id: str,
    db=Depends(get_db)
):
    """Prepare a regulatory report for filing.

    CP-11: no real transmission integration (eFASS upload / goAML for returns)
    exists, so this endpoint NEVER flips a report to 'submitted' with a
    caller-typed reference. The honest terminal state is
    'prepared_for_manual_filing': an officer must file the generated report
    through the regulator's portal and record the acknowledgement out of band.
    """
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE regulatory_reports
            SET status = 'prepared_for_manual_filing'
            WHERE report_id = $1 AND status = 'completed'
            RETURNING report_id
        """, report_id)

        if not row:
            raise HTTPException(
                status_code=400,
                detail="Report not found or not ready (must be status 'completed')"
            )

        return {
            "status": "prepared_for_manual_filing",
            "report_id": report_id,
            "message": "No automated transmission integration exists. File manually via the "
                       "regulator portal (eFASS/goAML); the platform does not self-certify "
                       "submission.",
        }

# Compliance Alerts Endpoints
@app.post("/api/v1/compliance/alerts")
async def create_compliance_alert(
    alert: ComplianceAlert,
    db=Depends(get_db)
):
    """Create a compliance alert"""
    alert_id = f"ALT{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO compliance_alerts (
                alert_id, tenant_id, alert_type, severity, entity_type,
                entity_id, description, metadata, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
        """, alert_id, alert.tenant_id, alert.alert_type, alert.severity, alert.entity_type,
            alert.entity_id, alert.description, json.dumps(alert.metadata or {}))
    
    return {
        "status": "created",
        "alert_id": alert_id,
        "severity": alert.severity,
        "created_at": datetime.now()
    }

@app.get("/api/v1/compliance/alerts/{alert_id}")
async def get_compliance_alert(alert_id: str, db=Depends(get_db)):
    """Get compliance alert details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM compliance_alerts WHERE alert_id = $1
        """, alert_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        return dict(row)

@app.get("/api/v1/compliance/alerts/tenant/{tenant_id}")
async def list_compliance_alerts(
    tenant_id: str,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db)
):
    """List compliance alerts for a tenant"""
    offset = (page - 1) * limit
    where = "WHERE tenant_id = $1"
    params = [tenant_id]
    param_count = 2

    if severity:
        where += f" AND severity = ${param_count}"
        params.append(severity)
        param_count += 1

    if status:
        where += f" AND status = ${param_count}"
        params.append(status)
        param_count += 1

    async with db.acquire() as conn:
        total = await conn.fetchval(f"SELECT COUNT(*) FROM compliance_alerts {where}", *params)
        query = f"SELECT * FROM compliance_alerts {where} ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
        params.extend([limit, offset])
        rows = await conn.fetch(query, *params)
        return {
            "tenant_id": tenant_id,
            "alerts": [dict(row) for row in rows],
            "total": total,
            "page": page,
            "limit": limit,
        }

@app.post("/api/v1/compliance/alerts/{alert_id}/resolve")
async def resolve_compliance_alert(
    alert_id: str,
    payload: ResolveComplianceAlert,
    db=Depends(get_db)
):
    """Resolve a compliance alert"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE compliance_alerts
            SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP,
                resolution_notes = $1, assigned_to = $2
            WHERE alert_id = $3 AND status = 'open'
            RETURNING alert_id
        """, payload.note, payload.resolved_by, alert_id)
        
        if not row:
            raise HTTPException(
                status_code=400,
                detail="Alert not found or already resolved"
            )
        
        return {
            "status": "resolved",
            "alert_id": alert_id,
            "resolved_by": payload.resolved_by,
            "resolved_at": datetime.now()
        }

# SAR Filing Endpoints
@app.post("/api/v1/compliance/sar/file")
async def file_sar(
    payload: FileSar,
    db = Depends(get_db)
):
    """File a Suspicious Activity Report (SAR)"""
    sar_id = f"SAR{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO sar_filings (
                sar_id, tenant_id, subject_name, subject_type, subject_id,
                suspicious_activity_type, activity_description, transaction_ids,
                total_amount, currency, filing_reason, supporting_documents,
                created_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
        """, sar_id, payload.tenant_id, payload.subject_name, payload.subject_type, payload.subject_id,
            payload.suspicious_activity_type, payload.activity_description, json.dumps(payload.transaction_ids),
            payload.total_amount, payload.currency, payload.filing_reason, json.dumps(payload.supporting_documents or []),
            payload.created_by)
    
    # Publish Kafka event for SAR filing
    KafkaClientInstance.publish_report_event(
        event_type=ComplianceEventTypes.REPORT_CREATED,
        report_id=sar_id,
        tenant_id=payload.tenant_id,
        status="draft",
        metadata={
            "subject_name": payload.subject_name,
            "subject_type": payload.subject_type,
            "subject_id": payload.subject_id,
            "suspicious_activity_type": payload.suspicious_activity_type,
            "activity_description": payload.activity_description,
            "transaction_ids": payload.transaction_ids,
            "total_amount": str(payload.total_amount),
            "currency": payload.currency,
            "filing_reason": payload.filing_reason,
            "created_by": payload.created_by,
        },
    )

    return {
        "status": "created",
        "sar_id": sar_id,
        "subject_name": payload.subject_name,
        "created_at": datetime.now()
    }

@app.get("/api/v1/compliance/sar/{sar_id}")
async def get_sar(sar_id: str, db = Depends(get_db)):
    """Get SAR filing details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM sar_filings WHERE sar_id = $1
        """, sar_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="SAR filing not found")
        
        return dict(row)

@app.get("/api/v1/compliance/sar/tenant/{tenant_id}")
async def list_sars(
    tenant_id: str,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db = Depends(get_db)
):
    """List SAR filings for a tenant"""
    query = "SELECT * FROM sar_filings WHERE tenant_id = $1"
    params = [tenant_id]
    
    if status:
        query += " AND status = $2"
        params.append(status)
    
    query += f" ORDER BY created_at DESC LIMIT {limit} OFFSET {skip}"
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "tenant_id": tenant_id,
            "sar_filings": [dict(row) for row in rows],
            "total": len(rows)
        }

# ── CP-02: real SAR filing through nfiu-ctr-str-filing-py ────────────────────

def _sar_to_str_payload(sar: dict) -> dict:
    """Map a compliance-service SAR row to the NFIU filer's STR contract.
    Money is converted to integer minor units (kobo)."""
    total_kobo = int((sar["total_amount"] or Decimal("0")) * 100)
    txn_ids = sar["transaction_ids"] or []
    if isinstance(txn_ids, str):
        txn_ids = json.loads(txn_ids)
    today = datetime.now().date()
    return {
        "customer_id": sar["subject_id"],
        "customer_name": sar["subject_name"],
        "customer_type": "individual" if sar["subject_type"] == "individual" else "corporate",
        "reason": f"{sar['suspicious_activity_type']}: {sar['filing_reason']}",
        "category": sar["suspicious_activity_type"],
        "total_amount_kobo": total_kobo,
        "transaction_count": len(txn_ids) or 1,
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "detection_method": "compliance_service_sar",
        "risk_score": 80,
        "risk_level": "high",
        "transaction_ids": txn_ids,
    }


def _post_str_to_filer(tenant_id: str, str_payload: dict) -> dict:
    """Blocking HTTP call (run via asyncio.to_thread). Raises on failure."""
    headers = {"x-tenant-id": tenant_id, "Content-Type": "application/json"}
    if NFIU_SERVICE_TOKEN:
        headers["Authorization"] = f"Bearer {NFIU_SERVICE_TOKEN}"
    resp = requests.post(
        f"{NFIU_FILING_URL}/api/strs", json=str_payload, headers=headers, timeout=20
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"nfiu filer returned {resp.status_code}: {resp.text[:200]}")
    return resp.json()


async def _enqueue_sar_filing(conn, sar_id: str, tenant_id: str, reviewed_by: str, error: str):
    await conn.execute("""
        INSERT INTO sar_filing_queue (sar_id, tenant_id, reviewed_by, last_error)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (sar_id) DO UPDATE
          SET last_error = EXCLUDED.last_error, updated_at = CURRENT_TIMESTAMP
    """, sar_id, tenant_id, reviewed_by, error)


async def _attempt_sar_filing(conn, sar: dict, reviewed_by: str) -> dict:
    """File one SAR with the NFIU filer. Returns the filer response.
    Raises on failure (caller decides queue/503)."""
    str_payload = _sar_to_str_payload(sar)
    result = await asyncio.to_thread(_post_str_to_filer, sar["tenant_id"], str_payload)
    nfiu_str_id = result.get("strId") or result.get("str_id")
    fiu_ref = result.get("fiuRef") or result.get("fiu_ref")
    # Status becomes 'submitted' — NEVER 'filed'. 'filed' is set only by the
    # ack poller when the filer reports a real goAML acknowledgement.
    await conn.execute("""
        UPDATE sar_filings
        SET status = 'submitted', nfiu_str_id = $1, filing_reference = $2,
            reviewed_by = $3, updated_at = CURRENT_TIMESTAMP
        WHERE sar_id = $4
    """, nfiu_str_id, fiu_ref, reviewed_by, sar["sar_id"])
    await conn.execute("DELETE FROM sar_filing_queue WHERE sar_id = $1", sar["sar_id"])
    return result


async def _sar_filing_retry_loop():
    """CP-02: retry SAR filings that failed to reach the NFIU filer."""
    while True:
        try:
            if db_pool is not None and NFIU_FILING_URL:
                async with db_pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT q.sar_id, q.reviewed_by, q.attempts, q.max_attempts, s.*
                        FROM sar_filing_queue q
                        JOIN sar_filings s ON s.sar_id = q.sar_id
                        WHERE s.status IN ('draft', 'under_review', 'approved')
                        ORDER BY q.updated_at LIMIT 25
                    """)
                    for row in rows:
                        sar = dict(row)
                        try:
                            await _attempt_sar_filing(conn, sar, row["reviewed_by"] or "retry-worker")
                            print(f"[compliance-service] CP-02 retry: SAR {sar['sar_id']} filed via nfiu filer", flush=True)
                        except Exception as exc:
                            attempts = row["attempts"] + 1
                            exhausted = attempts >= row["max_attempts"]
                            await conn.execute("""
                                UPDATE sar_filing_queue
                                SET attempts = $2, last_error = $3, updated_at = CURRENT_TIMESTAMP
                                WHERE sar_id = $1
                            """, sar["sar_id"], attempts, str(exc)[:500])
                            if exhausted:
                                print(
                                    f"[compliance-service] CRITICAL: SAR {sar['sar_id']} filing exhausted "
                                    f"{row['max_attempts']} attempts: {exc}. MANUAL FILING REQUIRED.",
                                    flush=True,
                                )
        except Exception as exc:
            print(f"[compliance-service] SAR filing retry loop error: {exc}", flush=True)
        await asyncio.sleep(SAR_FILING_RETRY_SECONDS)


async def _sar_ack_poll_loop():
    """CP-02: poll the NFIU filer for goAML acks; only a real ack flips a SAR
    to 'filed' and sets the goaml_ref."""
    while True:
        try:
            if db_pool is not None and NFIU_FILING_URL:
                async with db_pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT sar_id, tenant_id, nfiu_str_id FROM sar_filings
                        WHERE status = 'submitted' AND nfiu_str_id IS NOT NULL
                        LIMIT 50
                    """)
                for row in rows:
                    try:
                        def _get():
                            headers = {"x-tenant-id": row["tenant_id"]}
                            if NFIU_SERVICE_TOKEN:
                                headers["Authorization"] = f"Bearer {NFIU_SERVICE_TOKEN}"
                            return requests.get(
                                f"{NFIU_FILING_URL}/api/strs/{row['nfiu_str_id']}",
                                headers=headers, timeout=15,
                            )
                        resp = await asyncio.to_thread(_get)
                        if resp.status_code != 200:
                            continue
                        data = resp.json()
                        if data.get("status") == "filed" and data.get("goamlRef"):
                            async with db_pool.acquire() as conn:
                                await conn.execute("""
                                    UPDATE sar_filings
                                    SET status = 'filed', filed_at = CURRENT_TIMESTAMP,
                                        goaml_ref = $2, updated_at = CURRENT_TIMESTAMP
                                    WHERE sar_id = $1
                                """, row["sar_id"], str(data["goamlRef"]))
                    except Exception as exc:
                        print(f"[compliance-service] SAR ack poll error sar={row['sar_id']}: {exc}", flush=True)
        except Exception as exc:
            print(f"[compliance-service] SAR ack poll loop error: {exc}", flush=True)
        await asyncio.sleep(SAR_ACK_POLL_SECONDS)


@app.post("/api/v1/compliance/sar/{sar_id}/submit")
async def submit_sar(
    sar_id: str,
    payload: SubmitSar,
    db = Depends(get_db)
):
    """Submit SAR to the NFIU via the real goAML filing service.

    CP-02: previously this flipped status to 'filed' with a caller-supplied
    filing_reference — no XML, no transmission, no ack. Now the SAR is routed
    through nfiu-ctr-str-filing-py; the filing reference comes from the
    filer's goAML acknowledgement, fetched by the ack poller. On filer outage
    the request is queued durably (sar_filing_queue) and 503 is returned.
    """
    if not NFIU_FILING_URL:
        raise HTTPException(
            status_code=503,
            detail="NFIU filing service not configured (NFIU_FILING_URL) — SAR cannot be filed",
        )
    async with db.acquire() as conn:
        sar = await conn.fetchrow(
            "SELECT * FROM sar_filings WHERE sar_id = $1", sar_id
        )
        if not sar:
            raise HTTPException(status_code=404, detail="SAR not found")
        if sar["status"] not in ("draft", "under_review", "approved"):
            raise HTTPException(
                status_code=400,
                detail=f"SAR not ready for filing (status={sar['status']})",
            )
        try:
            result = await _attempt_sar_filing(conn, dict(sar), payload.reviewed_by)
        except Exception as exc:
            await _enqueue_sar_filing(conn, sar_id, sar["tenant_id"], payload.reviewed_by, str(exc)[:500])
            raise HTTPException(
                status_code=503,
                detail=f"NFIU filing service unavailable — SAR queued for automatic retry ({exc})",
            )
        return {
            "status": "submitted",
            "sar_id": sar_id,
            "nfiu_str_id": result.get("strId") or result.get("str_id"),
            "fiu_ref": result.get("fiuRef") or result.get("fiu_ref"),
            "message": "SAR accepted by NFIU filing service; status becomes 'filed' only on goAML acknowledgement",
        }

# Transaction Monitoring Endpoints
@app.post("/api/v1/compliance/monitoring/rules")
async def create_monitoring_rule(
    payload: MonitoringRule,
    db= Depends(get_db)
):
    """Create transaction monitoring rule"""
    rule_id = f"RULE{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO transaction_monitoring_rules (
                rule_id, tenant_id, rule_name, rule_type, conditions,
                alert_severity, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
        """, rule_id, payload.tenant_id, payload.rule_name, payload.rule_type, json.dumps(payload.conditions),
            payload.alert_severity)
    
    return {
        "status": "created",
        "rule_id": rule_id,
        "rule_name": payload.rule_name,
        "created_at": datetime.now()
    }

@app.get("/api/v1/compliance/monitoring/rules")
async def list_all_monitoring_rules(
    active_only: bool = True,
    db = Depends(get_db)
):
    """List all transaction monitoring rules across tenants"""
    query = "SELECT * FROM transaction_monitoring_rules"
    if active_only:
        query += " WHERE is_active = true"
    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query)
        return {
            "rules": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.get("/api/v1/compliance/monitoring/rules/{tenant_id}")
async def list_monitoring_rules(
    tenant_id: str,
    active_only: bool = True,
    db = Depends(get_db)
):
    """List transaction monitoring rules for a tenant"""
    query = "SELECT * FROM transaction_monitoring_rules WHERE tenant_id = $1"
    if active_only:
        query += " AND is_active = true"
    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, tenant_id)
        return {
            "tenant_id": tenant_id,
            "rules": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.put("/api/v1/compliance/monitoring/rules/{rule_id}/toggle")
async def toggle_monitoring_rule(
    rule_id: str,
    is_active: bool,
    db = Depends(get_db)
):
    """Toggle monitoring rule active status"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE transaction_monitoring_rules
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE rule_id = $2
            RETURNING rule_id
        """, is_active, rule_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        return {
            "status": "updated",
            "rule_id": rule_id,
            "is_active": is_active
        }

@app.post("/api/v1/compliance/monitoring/evaluate")
async def evaluate_transaction(
    payload: MonitorTransaction,
    db = Depends(get_db)
):
    """Evaluate transaction against monitoring rules"""
    async with db.acquire() as conn:
        # Get active rules
        rules = await conn.fetch("""
            SELECT * FROM transaction_monitoring_rules
            WHERE tenant_id = $1 AND is_active = true
        """, payload.tenant_id)
        
        triggered_rules = []
        
        for rule in rules:
            conditions = json.loads(rule['conditions'])
            
            # Evaluate based on rule type
            if rule['rule_type'] == 'threshold':
                threshold = Decimal(str(conditions.get('amount_threshold', 0)))
                if payload.amount > threshold:
                    triggered_rules.append({
                        "rule_id": rule['rule_id'],
                        "rule_name": rule['rule_name'],
                        "severity": rule['alert_severity']
                    })
            
            elif rule['rule_type'] == 'velocity':
                # Check transaction velocity (simplified)
                time_window = conditions.get('time_window_hours', 24)
                max_count = conditions.get('max_transactions', 10)
                
                # Would check actual transaction count in time window
                # For now, simulate
                triggered_rules.append({
                    "rule_id": rule['rule_id'],
                    "rule_name": rule['rule_name'],
                    "severity": rule['alert_severity']
                })
        
        # Create alerts for triggered rules
        for triggered in triggered_rules:
            alert_id = f"ALT{int(datetime.now().timestamp())}"
            await conn.execute("""
                INSERT INTO compliance_alerts (
                    alert_id, tenant_id, alert_type, severity, entity_type,
                    entity_id, description, metadata, status
                ) VALUES ($1, $2, 'transaction_monitoring', $3, 'transaction',
                         $4, $5, $6, 'open')
            """, alert_id, payload.tenant_id, triggered['severity'], payload.transaction_id,
                f"Transaction triggered rule: {triggered['rule_name']}",
                json.dumps({"rule_id": triggered['rule_id']}))
            
            # Update rule trigger count
            await conn.execute("""
                UPDATE transaction_monitoring_rules
                SET triggered_count = triggered_count + 1,
                    last_triggered_at = CURRENT_TIMESTAMP
                WHERE rule_id = $1
            """, triggered['rule_id'])
        
        return {
            "transaction_id": payload.transaction_id,
            "evaluated": True,
            "rules_triggered": len(triggered_rules),
            "triggered_rules": triggered_rules,
            "alerts_created": len(triggered_rules)
        }

# AML Risk Assessment Endpoints
@app.get("/api/v1/assessments")
async def list_assessments(
    tenantId: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db = Depends(get_db)
):
    """List AML risk assessments, optionally filtered by tenant"""
    if tenantId:
        query = "SELECT * FROM aml_risk_assessments WHERE tenant_id = $1 ORDER BY assessment_date DESC LIMIT $2 OFFSET $3"
        params = [tenantId, limit, skip]
    else:
        query = "SELECT * FROM aml_risk_assessments ORDER BY assessment_date DESC LIMIT $1 OFFSET $2"
        params = [limit, skip]

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "assessments": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.get("/api/v1/compliance/aml/assess")
async def list_aml_assessments(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db = Depends(get_db)
):
    """List all AML risk assessments"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM aml_risk_assessments ORDER BY assessment_date DESC LIMIT $1 OFFSET $2",
            limit, skip
        )
        return {
            "assessments": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.post("/api/v1/compliance/aml/assess")
async def assess_aml_risk(
    payload: AccessAMLRisk,
    db = Depends(get_db)
):
    """Perform AML risk assessment"""
    assessment_id = f"AML{int(datetime.now().timestamp())}"
    
    # Calculate risk score based on factors
    risk_score = 0
    risk_weights = {
        "high_risk_country": 25,
        "pep": 30,
        "high_transaction_volume": 20,
        "cash_intensive": 15,
        "new_customer": 10,
        "incomplete_kyc": 20,
        "suspicious_pattern": 35
    }
    
    for factor in payload.risk_factors:
        risk_score += risk_weights.get(factor, 5)
    
    # Determine risk level
    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 40:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO aml_risk_assessments (
                assessment_id, tenant_id, entity_type, entity_id,
                risk_level, risk_score, risk_factors
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, assessment_id, payload.tenant_id, payload.entity_type, payload.entity_id,
            risk_level, risk_score, json.dumps(payload.risk_factors))
        
        # Create alert for high risk
        if risk_level == "high":
            alert_id = f"ALT{int(datetime.now().timestamp())}"
            await conn.execute("""
                INSERT INTO compliance_alerts (
                    alert_id, tenant_id, alert_type, severity, entity_type,
                    entity_id, description, metadata, status
                ) VALUES ($1, $2, 'high_aml_risk', 'high', $3, $4, $5, $6, 'open')
            """, alert_id, payload.tenant_id, payload.entity_type, payload.entity_id,
                f"High AML risk detected (score: {risk_score})",
                json.dumps({"assessment_id": assessment_id, "risk_factors": payload.risk_factors}))
    
    return {
        "assessment_id": assessment_id,
        "entity_id": payload.entity_id,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "risk_factors": payload.risk_factors,
        "assessed_at": datetime.now()
    }

@app.get("/api/v1/compliance/aml/assessment/{assessment_id}")
async def get_aml_assessment(assessment_id: str, db = Depends(get_db)):
    """Get AML risk assessment"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM aml_risk_assessments WHERE assessment_id = $1
        """, assessment_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        return dict(row)

@app.get("/api/v1/compliance/aml/entity/{entity_id}")
async def get_entity_aml_assessments(
    entity_id: str,
    db = Depends(get_db)
):
    """Get all AML assessments for an entity"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM aml_risk_assessments
            WHERE entity_id = $1
            ORDER BY assessment_date DESC
        """, entity_id)
        
        return {
            "entity_id": entity_id,
            "assessments": [dict(row) for row in rows],
            "total": len(rows),
            "current_risk_level": dict(rows[0])['risk_level'] if rows else "unknown"
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8024)))
