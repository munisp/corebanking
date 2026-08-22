"""
Merchant Service - Complete Production Implementation
Handles merchant onboarding, KYB verification, settlement, disputes, and analytics
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime, timedelta
from enum import Enum
import uvicorn
import asyncpg
import hashlib
import os
import secrets
import sys
from decimal import Decimal
import json

from merchant_settlement import (
    router as settlement_router,
    set_db_pool as settlement_set_db_pool,
    create_settlement_tables,
)
from merchant_kyb import (
    router as kyb_router,
    set_db_pool as kyb_set_db_pool,
    create_kyb_tables,
)
from docling_kyb_integration import DoclingKYBProcessor
from kyb_document_endpoints import (
    router as kyb_documents_router,
    init_kyb_endpoints,
)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared/python'))

try:
    from services.common.lakehouse.lakehouse_publisher import LakehousePublisher
except ImportError:
    LakehousePublisher = None

app = FastAPI(
    title="54link-dev Merchant Service",
    description="Complete merchant management and settlement service",
    version="1.0.0"
)

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


# Mount the settlement and KYB routers so the real endpoints serve traffic.
app.include_router(settlement_router)
app.include_router(kyb_router)
app.include_router(kyb_documents_router)

allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "https://app.54link-dev.internal,https://admin.54link-dev.internal,https://pwa.54link-dev.internal").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id"],
)

# Database connection pool
db_pool = None
merchant_lakehouse: Optional[Any] = None

# Enums
class MerchantStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CLOSED = "closed"

class KYBStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    VERIFIED = "verified"
    REJECTED = "rejected"

class SettlementStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DisputeStatus(str, Enum):
    OPEN = "open"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    ESCALATED = "escalated"

# Models
class MerchantCreate(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=255)
    business_email: EmailStr
    business_phone: str
    business_address: str
    business_type: str
    registration_number: str
    tax_id: str
    contact_person_name: str
    contact_person_email: EmailStr
    contact_person_phone: str
    industry: str
    website: Optional[str] = None
    tenant_id: str

class MerchantUpdate(BaseModel):
    business_name: Optional[str] = None
    business_email: Optional[EmailStr] = None
    business_phone: Optional[str] = None
    business_address: Optional[str] = None
    website: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_person_email: Optional[EmailStr] = None
    contact_person_phone: Optional[str] = None

class MerchantResponse(BaseModel):
    """Merchant as returned by list/get endpoints.

    NEVER contains the API key or its hash — only the last-4 identifier.
    The full key is returned exactly once, at creation (MerchantCreatedResponse).
    """
    id: int
    merchant_id: str
    tenant_id: str
    business_name: str
    business_email: str
    business_phone: str
    status: MerchantStatus
    kyb_status: KYBStatus
    api_key_last4: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class MerchantCreatedResponse(MerchantResponse):
    """Creation response — the ONLY place the full API key is ever returned."""
    api_key: str

class KYBVerificationRequest(BaseModel):
    merchant_id: str
    documents: List[dict]
    verification_notes: Optional[str] = None

class SettlementRequest(BaseModel):
    merchant_id: str
    settlement_period_start: datetime
    settlement_period_end: datetime
    bank_account_number: str
    bank_code: str
    account_name: str

class DisputeCreate(BaseModel):
    merchant_id: str
    transaction_id: str
    dispute_reason: str
    dispute_amount: Decimal
    customer_name: str
    customer_email: str
    description: str

class FeeConfigUpdate(BaseModel):
    merchant_id: str
    transaction_fee_pct: Decimal
    fixed_fee: Decimal
    settlement_fee: Decimal
    chargeback_fee: Decimal

# Database functions
async def get_db():
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return db_pool


def publish_merchant_event(event_type: str, tenant_id: str, merchant_id: str, payload: dict, user_id: Optional[str] = None) -> None:
    if not merchant_lakehouse:
        return
    merchant_lakehouse.publish_event(
        event_type=event_type,
        payload=payload,
        tenant_id=tenant_id,
        user_id=user_id,
        entity_id=merchant_id,
        entity_type="merchant",
    )

@app.on_event("startup")
async def startup():
    global db_pool, merchant_lakehouse
    db_host = os.getenv("DB_HOST", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    db_name = os.getenv("DB_NAME", "merchant_db")

    try:
        db_pool = await asyncpg.create_pool(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name,
            min_size=5,
            max_size=20
        )
        if LakehousePublisher:
            merchant_lakehouse = LakehousePublisher(
                service_name="merchant-service",
                table_name="bronze.merchant_events",
            )

        async with db_pool.acquire() as conn:
            await conn.execute("""
                CREATE EXTENSION IF NOT EXISTS pgcrypto;

                CREATE TABLE IF NOT EXISTS merchants (
                    id SERIAL PRIMARY KEY,
                    merchant_id VARCHAR(50) UNIQUE NOT NULL,
                    tenant_id VARCHAR(50) NOT NULL,
                    business_name VARCHAR(255) NOT NULL,
                    business_email VARCHAR(255) NOT NULL,
                    business_phone VARCHAR(50) NOT NULL,
                    business_address TEXT NOT NULL,
                    business_type VARCHAR(100) NOT NULL,
                    registration_number VARCHAR(100) NOT NULL,
                    tax_id VARCHAR(100) NOT NULL,
                    contact_person_name VARCHAR(255) NOT NULL,
                    contact_person_email VARCHAR(255) NOT NULL,
                    contact_person_phone VARCHAR(50) NOT NULL,
                    industry VARCHAR(100) NOT NULL,
                    website VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'pending',
                    kyb_status VARCHAR(20) DEFAULT 'not_started',
                    api_key VARCHAR(255),
                    api_key_hash VARCHAR(64),
                    api_key_last4 VARCHAR(4),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Upgrades for pre-existing deployments (plaintext api_key no
                -- longer written; only a SHA-256 hash + last-4 are stored).
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS api_key_hash VARCHAR(64);
                ALTER TABLE merchants ADD COLUMN IF NOT EXISTS api_key_last4 VARCHAR(4);
                UPDATE merchants
                    SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex'),
                        api_key_last4 = right(api_key, 4),
                        api_key = NULL
                WHERE api_key IS NOT NULL;

                CREATE INDEX IF NOT EXISTS idx_merchants_merchant_id ON merchants(merchant_id);
                CREATE INDEX IF NOT EXISTS idx_merchants_tenant_id ON merchants(tenant_id);
                CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

                CREATE TABLE IF NOT EXISTS merchant_kyb_verification (
                    id SERIAL PRIMARY KEY,
                    merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
                    verification_status VARCHAR(20) DEFAULT 'pending',
                    documents JSONB,
                    verification_notes TEXT,
                    verified_by VARCHAR(255),
                    verified_at TIMESTAMP,
                    rejection_reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS merchant_settlements (
                    id SERIAL PRIMARY KEY,
                    settlement_id VARCHAR(50) UNIQUE NOT NULL,
                    merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
                    settlement_period_start TIMESTAMP NOT NULL,
                    settlement_period_end TIMESTAMP NOT NULL,
                    total_transactions INT DEFAULT 0,
                    gross_amount DECIMAL(15,2) DEFAULT 0,
                    fees_amount DECIMAL(15,2) DEFAULT 0,
                    net_amount DECIMAL(15,2) DEFAULT 0,
                    bank_account_number VARCHAR(50),
                    bank_code VARCHAR(20),
                    account_name VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'pending',
                    claimed_at TIMESTAMP,
                    processed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                -- Upgrades for pre-existing deployments (atomic claim uses
                -- claimed_at; all status transitions touch updated_at).
                ALTER TABLE merchant_settlements ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;
                ALTER TABLE merchant_settlements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

                CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON merchant_settlements(merchant_id);
                CREATE INDEX IF NOT EXISTS idx_settlements_status ON merchant_settlements(status);

                CREATE TABLE IF NOT EXISTS merchant_disputes (
                    id SERIAL PRIMARY KEY,
                    dispute_id VARCHAR(50) UNIQUE NOT NULL,
                    merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
                    transaction_id VARCHAR(50) NOT NULL,
                    dispute_reason VARCHAR(255) NOT NULL,
                    dispute_amount DECIMAL(15,2) NOT NULL,
                    customer_name VARCHAR(255),
                    customer_email VARCHAR(255),
                    description TEXT,
                    status VARCHAR(20) DEFAULT 'open',
                    resolution TEXT,
                    resolved_at TIMESTAMP,
                    resolved_by VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_disputes_merchant_id ON merchant_disputes(merchant_id);
                CREATE INDEX IF NOT EXISTS idx_disputes_status ON merchant_disputes(status);

                CREATE TABLE IF NOT EXISTS merchant_fee_config (
                    id SERIAL PRIMARY KEY,
                    merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE UNIQUE,
                    transaction_fee_pct DECIMAL(5,2) DEFAULT 2.5,
                    fixed_fee DECIMAL(10,2) DEFAULT 0,
                    settlement_fee DECIMAL(10,2) DEFAULT 0,
                    chargeback_fee DECIMAL(10,2) DEFAULT 2500,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS merchant_analytics (
                    id SERIAL PRIMARY KEY,
                    merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
                    period VARCHAR(20) NOT NULL,
                    total_transactions INT DEFAULT 0,
                    successful_transactions INT DEFAULT 0,
                    failed_transactions INT DEFAULT 0,
                    total_volume DECIMAL(15,2) DEFAULT 0,
                    avg_transaction_amount DECIMAL(15,2) DEFAULT 0,
                    total_fees DECIMAL(15,2) DEFAULT 0,
                    disputes_count INT DEFAULT 0,
                    chargeback_count INT DEFAULT 0,
                    period_start TIMESTAMP NOT NULL,
                    period_end TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_analytics_merchant_period ON merchant_analytics(merchant_id, period, period_start);

                CREATE TABLE IF NOT EXISTS kyb_documents (
                    id SERIAL PRIMARY KEY,
                    document_id VARCHAR(64) UNIQUE NOT NULL,
                    merchant_id VARCHAR(50) NOT NULL,
                    tenant_id VARCHAR(64) NOT NULL,
                    document_type VARCHAR(64) NOT NULL,
                    extracted_data JSONB,
                    confidence_score DECIMAL(5,2) DEFAULT 0,
                    verification_status VARCHAR(32) DEFAULT 'pending',
                    original_filename VARCHAR(255),
                    processing_metadata JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_kyb_documents_merchant ON kyb_documents(merchant_id, tenant_id);
                CREATE INDEX IF NOT EXISTS idx_kyb_documents_type ON kyb_documents(document_type);
            """)

            # Settlement/KYB router tables + one-payout-per-settlement guard.
            await create_settlement_tables(conn)
            await create_kyb_tables(conn)
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_settlement
                ON merchant_payouts(settlement_id);
            """)

        # Inject live dependencies into the mounted routers.
        settlement_set_db_pool(db_pool)
        kyb_set_db_pool(db_pool)
        init_kyb_endpoints(
            db_pool,
            DoclingKYBProcessor(os.getenv("DOCLING_URL", "http://docling-service:8010")),
        )

        print("Merchant service started successfully")
    except Exception as e:
        print(f"DB unavailable at startup, service running in degraded mode: {e}", file=sys.stderr)

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "merchant-service"}

def _generate_api_key() -> tuple:
    """Generate an unpredictable live API key (CSPRNG).

    Returns (plaintext_key, sha256_hash, last4). Only the hash and last-4 are
    ever stored; the plaintext is returned to the caller exactly once.
    """
    plaintext = "sk_live_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
    return plaintext, key_hash, plaintext[-4:]


def _scrub_api_key(record: dict) -> dict:
    """Remove key material from a merchants row before returning it."""
    record.pop("api_key", None)
    record.pop("api_key_hash", None)
    return record


# Merchant Management Endpoints
@app.post("/api/v1/merchants", response_model=MerchantCreatedResponse, status_code=201)
async def create_merchant(
    merchant: MerchantCreate,
    db=Depends(get_db)
):
    """Create a new merchant account.

    The full API key is returned ONLY in this response; afterwards only the
    SHA-256 hash and last-4 characters are stored/retrievable.
    """
    merchant_id = f"MER{int(datetime.now().timestamp())}"
    api_key, api_key_hash, api_key_last4 = _generate_api_key()

    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO merchants (
                merchant_id, tenant_id, business_name, business_email, business_phone,
                business_address, business_type, registration_number, tax_id,
                contact_person_name, contact_person_email, contact_person_phone,
                industry, website, api_key, api_key_hash, api_key_last4
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        """, merchant_id, merchant.tenant_id, merchant.business_name, merchant.business_email,
            merchant.business_phone, merchant.business_address, merchant.business_type,
            merchant.registration_number, merchant.tax_id, merchant.contact_person_name,
            merchant.contact_person_email, merchant.contact_person_phone, merchant.industry,
            merchant.website, None, api_key_hash, api_key_last4)

        # Initialize fee configuration with defaults
        await conn.execute("""
            INSERT INTO merchant_fee_config (merchant_id)
            VALUES ($1)
        """, merchant_id)

        merchant_payload = _scrub_api_key(dict(row))
        merchant_payload["api_key"] = api_key  # shown exactly once, at creation

    publish_merchant_event(
        event_type="MERCHANT_CREATED",
        tenant_id=merchant.tenant_id,
        merchant_id=merchant_id,
        user_id=merchant.contact_person_email,
        payload={
            "business_name": merchant.business_name,
            "business_email": merchant.business_email,
            "business_phone": merchant.business_phone,
            "industry": merchant.industry,
            "kyb_status": merchant_payload.get("kyb_status"),
            "status": merchant_payload.get("status"),
        },
    )
    return merchant_payload

@app.get("/api/v1/merchants", response_model=List[MerchantResponse])
async def list_merchants(
    tenant_id: Optional[str] = Query(None),
    status: Optional[MerchantStatus] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db)
):
    """List all merchants with optional filtering"""
    query = "SELECT * FROM merchants WHERE 1=1"
    params = []
    param_count = 1
    
    if tenant_id:
        query += f" AND tenant_id = ${param_count}"
        params.append(tenant_id)
        param_count += 1
    
    if status:
        query += f" AND status = ${param_count}"
        params.append(status.value)
        param_count += 1
    
    query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
    params.extend([limit, skip])
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        # Never return key material (full key or hash) in list responses.
        return [_scrub_api_key(dict(row)) for row in rows]

@app.get("/api/v1/merchants/{merchant_id}", response_model=MerchantResponse)
async def get_merchant(merchant_id: str, db=Depends(get_db)):
    """Get merchant details by ID"""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM merchants WHERE merchant_id = $1",
            merchant_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Merchant not found")
        return _scrub_api_key(dict(row))

@app.put("/api/v1/merchants/{merchant_id}")
async def update_merchant(
    merchant_id: str,
    merchant: MerchantUpdate,
    db=Depends(get_db)
):
    """Update merchant information"""
    update_fields = []
    params = []
    param_count = 1
    
    for field, value in merchant.dict(exclude_unset=True).items():
        if value is not None:
            update_fields.append(f"{field} = ${param_count}")
            params.append(value)
            param_count += 1
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    update_fields.append(f"updated_at = ${param_count}")
    params.append(datetime.now())
    param_count += 1
    params.append(merchant_id)
    
    query = f"""
        UPDATE merchants 
        SET {', '.join(update_fields)}
        WHERE merchant_id = ${param_count}
        RETURNING *
    """
    
    async with db.acquire() as conn:
        row = await conn.fetchrow(query, *params)
        if not row:
            raise HTTPException(status_code=404, detail="Merchant not found")
        updated = _scrub_api_key(dict(row))
    publish_merchant_event(
        event_type="MERCHANT_UPDATED",
        tenant_id=updated.get("tenant_id", "tenant-demo"),
        merchant_id=merchant_id,
        payload={"changes": merchant.dict(exclude_unset=True), "status": updated.get("status")},
    )
    return {"status": "updated", "merchant": updated}

@app.post("/api/v1/merchants/{merchant_id}/suspend")
async def suspend_merchant(merchant_id: str, reason: str, db=Depends(get_db)):
    """Suspend a merchant account"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE merchants 
            SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $1 AND status = 'active'
            RETURNING merchant_id
        """, merchant_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Merchant not found or already suspended")

    publish_merchant_event(
        event_type="MERCHANT_SUSPENDED",
        tenant_id="system",
        merchant_id=merchant_id,
        payload={"reason": reason, "status": "suspended"},
    )
    return {"status": "suspended", "merchant_id": merchant_id, "reason": reason}

@app.post("/api/v1/merchants/{merchant_id}/activate")
async def activate_merchant(merchant_id: str, db=Depends(get_db)):
    """Activate a merchant account"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            UPDATE merchants 
            SET status = 'active', updated_at = CURRENT_TIMESTAMP
            WHERE merchant_id = $1 AND status IN ('pending', 'suspended')
            RETURNING merchant_id
        """, merchant_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Merchant not found or cannot be activated")

    publish_merchant_event(
        event_type="MERCHANT_ACTIVATED",
        tenant_id="system",
        merchant_id=merchant_id,
        payload={"status": "active"},
    )
    return {"status": "activated", "merchant_id": merchant_id}

# Continue in next file due to length...

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
