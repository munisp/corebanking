from __future__ import annotations

import json
import os
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional
import sys

import asyncpg
import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from audit_middleware import AuditMiddleware
from pydantic import BaseModel, Field

try:
    import redis.asyncio as redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None

try:
    from fx_aggregator import AggregationStrategy, create_aggregator
except Exception:  # pragma: no cover - fallback when optional deps are missing
    AggregationStrategy = None
    create_aggregator = None


sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared/python'))

try:
    from services.common.lakehouse.lakehouse_publisher import LakehousePublisher
except ImportError:
    LakehousePublisher = None

app = FastAPI(title="54link-dev FX Service", version="1.3.0")

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


allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "https://app.54link-dev.internal,https://admin.54link-dev.internal,https://pwa.54link-dev.internal").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id", "X-Actor-Id", "Idempotency-Key"],
)
app.add_middleware(AuditMiddleware)

db_pool: Optional[asyncpg.Pool] = None
redis_client = None
aggregator = create_aggregator() if create_aggregator else None
fx_lakehouse: Optional[Any] = None
SUPPORTED_CURRENCIES = {"NGN", "USD", "GBP", "EUR"}
DEFAULT_MARGIN_BY_PAIR = {
    ("NGN", "USD"): Decimal("1.50"),
    ("USD", "NGN"): Decimal("0.85"),
    ("NGN", "GBP"): Decimal("1.70"),
    ("GBP", "NGN"): Decimal("0.90"),
    ("NGN", "EUR"): Decimal("1.60"),
    ("EUR", "NGN"): Decimal("0.85"),
}
FALLBACK_RATES = {
    ("NGN", "USD"): Decimal("0.00065"),
    ("USD", "NGN"): Decimal("1550.00"),
    ("NGN", "GBP"): Decimal("0.00052"),
    ("GBP", "NGN"): Decimal("1950.00"),
    ("NGN", "EUR"): Decimal("0.00060"),
    ("EUR", "NGN"): Decimal("1680.00"),
    ("USD", "EUR"): Decimal("0.92"),
    ("EUR", "USD"): Decimal("1.09"),
    ("USD", "GBP"): Decimal("0.79"),
    ("GBP", "USD"): Decimal("1.27"),
}


class RateRequest(BaseModel):
    tenant_id: str
    from_currency: str = Field(min_length=3, max_length=3)
    to_currency: str = Field(min_length=3, max_length=3)
    strategy: Optional[str] = Field(default=None, max_length=20)


class ExchangeRequest(BaseModel):
    tenant_id: str
    customer_id: str = Field(min_length=3, max_length=100)
    from_currency: str = Field(min_length=3, max_length=3)
    to_currency: str = Field(min_length=3, max_length=3)
    from_amount: Decimal = Field(gt=0)
    purpose: str = Field(default="customer_conversion", min_length=3, max_length=120)
    initiated_by: str = Field(default="system", min_length=2, max_length=100)
    margin_percent: Optional[Decimal] = Field(default=None, ge=Decimal("0"), le=Decimal("10"))
    idempotency_key: Optional[str] = Field(default=None, min_length=8, max_length=128)


class RateSeed(BaseModel):
    tenant_id: str
    from_currency: str = Field(min_length=3, max_length=3)
    to_currency: str = Field(min_length=3, max_length=3)
    rate: Decimal = Field(gt=0)
    source: str = Field(default="manual_seed", min_length=2, max_length=50)


async def get_db() -> asyncpg.Pool:
    if db_pool is None:
        raise HTTPException(status_code=503, detail="database unavailable")
    return db_pool


async def require_tenant(x_tenant_id: str = Header(...)) -> str:
    return x_tenant_id


async def require_actor(x_actor_id: str = Header(...)) -> str:
    return x_actor_id


def normalize_currency(currency: str) -> str:
    normalized = currency.strip().upper()
    if normalized not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")
    return normalized



def serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value



def serialize_record(row: Any) -> dict[str, Any]:
    return {key: serialize_value(val) for key, val in dict(row).items()}



def determine_margin(from_currency: str, to_currency: str, requested_margin: Optional[Decimal]) -> Decimal:
    if requested_margin is not None:
        return requested_margin.quantize(Decimal("0.01"))
    return DEFAULT_MARGIN_BY_PAIR.get((from_currency, to_currency), Decimal("1.00"))



def build_cache_key(from_currency: str, to_currency: str) -> str:
    return f"fx_rate:{from_currency}:{to_currency}"


def publish_fx_event(event_type: str, tenant_id: str, payload: dict[str, Any], entity_id: Optional[str] = None, user_id: Optional[str] = None) -> None:
    if not fx_lakehouse:
        return
    fx_lakehouse.publish_event(
        event_type=event_type,
        payload=payload,
        tenant_id=tenant_id,
        user_id=user_id,
        entity_id=entity_id,
        entity_type="fx_transaction" if entity_id else "fx_rate",
    )


async def fetch_provider_rate(from_currency: str, to_currency: str, strategy: Optional[str] = None) -> dict[str, Any]:
    cache_key = build_cache_key(from_currency, to_currency)
    if redis_client is not None:
        cached = await redis_client.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

    if aggregator is not None:
        if strategy and AggregationStrategy is not None:
            aggregator.strategy = AggregationStrategy(strategy)
        payload = await aggregator.get_aggregated_rate(from_currency, to_currency, redis_client)
        return payload

    rate = FALLBACK_RATES.get((from_currency, to_currency))
    if rate is None and (to_currency, from_currency) in FALLBACK_RATES:
        rate = (Decimal("1") / FALLBACK_RATES[(to_currency, from_currency)]).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    if rate is None:
        raise HTTPException(status_code=503, detail="No FX rate source available")
    payload = {
        "from_currency": from_currency,
        "to_currency": to_currency,
        "rate": float(rate),
        "source": "static_fallback",
        "strategy": strategy or "fallback",
        "timestamp": datetime.utcnow().isoformat(),
        "providers": {"fallback": {"rate": float(rate), "status": "active"}},
    }
    if redis_client is not None:
        await redis_client.setex(cache_key, 300, json.dumps(payload))
    return payload


async def persist_rate_snapshot(
    conn: asyncpg.Connection,
    tenant_id: str,
    from_currency: str,
    to_currency: str,
    rate_info: dict[str, Any],
) -> None:
    await conn.execute(
        """
        INSERT INTO fx_rates (tenant_id, from_currency, to_currency, rate, source, strategy, provider_rates)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        tenant_id,
        from_currency,
        to_currency,
        Decimal(str(rate_info["rate"])),
        rate_info.get("source", "unknown"),
        rate_info.get("strategy", "best_rate"),
        json.dumps(rate_info.get("providers", {})),
    )
    publish_fx_event(
        event_type="FX_RATE_SNAPSHOT",
        tenant_id=tenant_id,
        payload={
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": float(rate_info["rate"]),
            "source": rate_info.get("source", "unknown"),
            "strategy": rate_info.get("strategy", "best_rate"),
            "providers": rate_info.get("providers", {}),
        },
        entity_id=f"{from_currency}-{to_currency}",
    )


async def ensure_schema(conn: asyncpg.Connection) -> None:
    await conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fx_rates (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(50) NOT NULL,
            from_currency VARCHAR(3) NOT NULL,
            to_currency VARCHAR(3) NOT NULL,
            rate DECIMAL(15,6) NOT NULL,
            source VARCHAR(50) NOT NULL,
            strategy VARCHAR(20) NOT NULL,
            provider_rates JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_fx_rates_tenant_pair ON fx_rates(tenant_id, from_currency, to_currency, created_at DESC);

        CREATE TABLE IF NOT EXISTS fx_transactions (
            id SERIAL PRIMARY KEY,
            transaction_id VARCHAR(50) UNIQUE NOT NULL,
            tenant_id VARCHAR(50) NOT NULL,
            customer_id VARCHAR(50) NOT NULL,
            from_currency VARCHAR(3) NOT NULL,
            to_currency VARCHAR(3) NOT NULL,
            from_amount DECIMAL(15,2) NOT NULL,
            to_amount DECIMAL(15,2) NOT NULL,
            exchange_rate DECIMAL(15,6) NOT NULL,
            base_rate DECIMAL(15,6) NOT NULL,
            rate_source VARCHAR(50) NOT NULL,
            strategy VARCHAR(20) NOT NULL,
            purpose VARCHAR(120) NOT NULL,
            margin_applied DECIMAL(5,2) DEFAULT 0,
            initiated_by VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'completed',
            idempotency_key VARCHAR(128),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, idempotency_key)
        );
        CREATE INDEX IF NOT EXISTS idx_fx_transactions_tenant_created ON fx_transactions(tenant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_fx_transactions_customer ON fx_transactions(customer_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS fx_workflow_events (
            id SERIAL PRIMARY KEY,
            transaction_id VARCHAR(50) NOT NULL,
            tenant_id VARCHAR(50) NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            actor VARCHAR(100) NOT NULL,
            details JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_fx_workflow_events_tenant ON fx_workflow_events(tenant_id, created_at DESC);
        """
    )


async def seed_bootstrap(conn: asyncpg.Connection) -> dict[str, Any]:
    existing = await conn.fetchval("SELECT COUNT(*) FROM fx_transactions")
    if existing:
        return {"status": "already_seeded", "records": 0}

    seeds = [
        ("tenant_demo", "CUST-001", "USD", "NGN", Decimal("2500.00"), Decimal("1545.00"), "treasury_seed"),
        ("tenant_demo", "CUST-002", "NGN", "USD", Decimal("500000.00"), Decimal("0.00065"), "customer_seed"),
    ]
    seeded = 0
    for index, (tenant_id, customer_id, from_currency, to_currency, from_amount, base_rate, purpose) in enumerate(seeds, start=1):
        margin = determine_margin(from_currency, to_currency, None)
        effective_rate = (base_rate * (Decimal("1") - (margin / Decimal("100")))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        to_amount = (from_amount * effective_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        transaction_id = f"FXSEED{index:04d}"
        await conn.execute(
            """
            INSERT INTO fx_transactions (
                transaction_id, tenant_id, customer_id, from_currency, to_currency, from_amount,
                to_amount, exchange_rate, base_rate, rate_source, strategy, purpose, margin_applied,
                initiated_by, status, idempotency_key
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'completed',$15)
            ON CONFLICT (transaction_id) DO NOTHING
            """,
            transaction_id,
            tenant_id,
            customer_id,
            from_currency,
            to_currency,
            from_amount,
            to_amount,
            effective_rate,
            base_rate,
            "seeded_ratebook",
            "seed",
            purpose,
            margin,
            "seed",
            f"seed-{transaction_id}",
        )
        await conn.execute(
            "INSERT INTO fx_workflow_events (transaction_id, tenant_id, event_type, actor, details) VALUES ($1, $2, 'seeded', 'seed', $3)",
            transaction_id,
            tenant_id,
            json.dumps({"base_rate": float(base_rate), "margin": float(margin)}),
        )
        await conn.execute(
            "INSERT INTO fx_rates (tenant_id, from_currency, to_currency, rate, source, strategy, provider_rates) VALUES ($1,$2,$3,$4,'seeded_ratebook','seed',$5)",
            tenant_id,
            from_currency,
            to_currency,
            base_rate,
            json.dumps({"seeded_ratebook": {"rate": float(base_rate), "status": "active"}}),
        )
        seeded += 1
    return {"status": "seeded", "records": seeded}


@app.on_event("startup")
async def startup() -> None:
    global db_pool, redis_client, fx_lakehouse
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "fx_db"),
        min_size=1,
        max_size=10,
    )
    if LakehousePublisher:
        fx_lakehouse = LakehousePublisher(
            service_name="fx-service",
            table_name="bronze.fx_events",
        )
    if redis is not None:
        try:
            redis_client = redis.from_url(os.getenv("REDIS_URL", "redis://redis-master:6379/0"), decode_responses=True)
            await redis_client.ping()
        except Exception:
            redis_client = None
    async with db_pool.acquire() as conn:
        await ensure_schema(conn)
        await seed_bootstrap(conn)


@app.on_event("shutdown")
async def shutdown() -> None:
    global db_pool, redis_client
    if db_pool:
        await db_pool.close()
    if redis_client:
        await redis_client.close()


@app.get("/health")
async def health_check() -> dict[str, Any]:
    return {
        "status": "healthy",
        "service": "fx-service",
        "provider_mode": "aggregated" if aggregator is not None else "fallback",
        "allowed_origins": allowed_origins,
    }


@app.get("/readiness")
async def readiness_check(db: asyncpg.Pool = Depends(get_db)) -> dict[str, Any]:
    async with db.acquire() as conn:
        transaction_count = await conn.fetchval("SELECT COUNT(*) FROM fx_transactions")
        rate_count = await conn.fetchval("SELECT COUNT(*) FROM fx_rates")
        event_count = await conn.fetchval("SELECT COUNT(*) FROM fx_workflow_events")
    return {
        "status": "ready",
        "service": "fx-service",
        "transactions": transaction_count,
        "rate_snapshots": rate_count,
        "workflow_events": event_count,
        "redis_cache": redis_client is not None,
        "aggregator_available": aggregator is not None,
    }


@app.post("/bootstrap")
async def bootstrap(db: asyncpg.Pool = Depends(get_db)) -> dict[str, Any]:
    async with db.acquire() as conn:
        return await seed_bootstrap(conn)


@app.get("/api/v1/fx/providers")
async def get_provider_status() -> dict[str, Any]:
    if aggregator is None:
        return {"strategy": "fallback", "providers": [{"name": "fallback", "status": "active"}]}
    return {"strategy": aggregator.strategy.value, "providers": aggregator.get_provider_status()}


@app.get("/api/v1/fx/rates")
async def get_fx_rates(
    tenant_id: str,
    from_currency: str,
    to_currency: str,
    strategy: Optional[str] = Query(default=None),
    x_tenant_id: str = Depends(require_tenant),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    if tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    normalized_from = normalize_currency(from_currency)
    normalized_to = normalize_currency(to_currency)
    if normalized_from == normalized_to:
        raise HTTPException(status_code=400, detail="Source and destination currencies must differ")
    rate_info = await fetch_provider_rate(normalized_from, normalized_to, strategy)
    async with db.acquire() as conn:
        await persist_rate_snapshot(conn, tenant_id, normalized_from, normalized_to, rate_info)
    return {**rate_info, "tenant_id": tenant_id}


@app.get("/api/v1/fx/rates/all")
async def get_all_rates(
    tenant_id: str,
    base_currency: str = Query(default="NGN"),
    x_tenant_id: str = Depends(require_tenant),
) -> dict[str, Any]:
    if tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    normalized_base = normalize_currency(base_currency)
    rates = {}
    for candidate in sorted(SUPPORTED_CURRENCIES - {normalized_base}):
        payload = await fetch_provider_rate(normalized_base, candidate)
        rates[candidate] = payload["rate"]
    return {"tenant_id": tenant_id, "base_currency": normalized_base, "rates": rates, "count": len(rates)}


@app.post("/api/v1/fx/rates/seed")
async def seed_manual_rate(payload: RateSeed, x_tenant_id: str = Depends(require_tenant), db: asyncpg.Pool = Depends(get_db)) -> dict[str, Any]:
    if payload.tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    normalized_from = normalize_currency(payload.from_currency)
    normalized_to = normalize_currency(payload.to_currency)
    async with db.acquire() as conn:
        await conn.execute(
            "INSERT INTO fx_rates (tenant_id, from_currency, to_currency, rate, source, strategy, provider_rates) VALUES ($1,$2,$3,$4,$5,'manual_seed',$6)",
            payload.tenant_id,
            normalized_from,
            normalized_to,
            payload.rate,
            payload.source,
            json.dumps({payload.source: {"rate": float(payload.rate), "status": "manual"}}),
        )
    return {"status": "seeded", "tenant_id": payload.tenant_id, "from_currency": normalized_from, "to_currency": normalized_to, "rate": float(payload.rate)}


@app.post("/api/v1/fx/exchange")
async def exchange_currency(
    req: ExchangeRequest,
    x_tenant_id: str = Depends(require_tenant),
    x_actor_id: str = Depends(require_actor),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    if req.tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    normalized_from = normalize_currency(req.from_currency)
    normalized_to = normalize_currency(req.to_currency)
    if normalized_from == normalized_to:
        raise HTTPException(status_code=400, detail="Source and destination currencies must differ")
    if req.from_amount < Decimal("1"):
        raise HTTPException(status_code=400, detail="Minimum FX amount is 1 unit of source currency")

    async with db.acquire() as conn:
        if req.idempotency_key:
            replay = await conn.fetchrow(
                "SELECT * FROM fx_transactions WHERE tenant_id = $1 AND idempotency_key = $2",
                req.tenant_id,
                req.idempotency_key,
            )
            if replay:
                return {**serialize_record(replay), "idempotent_replay": True}

    rate_info = await fetch_provider_rate(normalized_from, normalized_to)
    base_rate = Decimal(str(rate_info["rate"]))
    margin = determine_margin(normalized_from, normalized_to, req.margin_percent)
    effective_rate = (base_rate * (Decimal("1") - (margin / Decimal("100")))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    to_amount = (req.from_amount * effective_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    transaction_id = f"FX{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')[-14:]}"

    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO fx_transactions (
                transaction_id, tenant_id, customer_id, from_currency, to_currency, from_amount,
                to_amount, exchange_rate, base_rate, rate_source, strategy, purpose,
                margin_applied, initiated_by, status, idempotency_key
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'completed',$15)
            """,
            transaction_id,
            req.tenant_id,
            req.customer_id,
            normalized_from,
            normalized_to,
            req.from_amount,
            to_amount,
            effective_rate,
            base_rate,
            rate_info.get("source", "unknown"),
            rate_info.get("strategy", "best_rate"),
            req.purpose,
            margin,
            x_actor_id or req.initiated_by,
            req.idempotency_key,
        )
        await persist_rate_snapshot(conn, req.tenant_id, normalized_from, normalized_to, rate_info)
        await conn.execute(
            "INSERT INTO fx_workflow_events (transaction_id, tenant_id, event_type, actor, details) VALUES ($1,$2,'exchanged',$3,$4)",
            transaction_id,
            req.tenant_id,
            x_actor_id or req.initiated_by,
            json.dumps(
                {
                    "customer_id": req.customer_id,
                    "purpose": req.purpose,
                    "from_amount": float(req.from_amount),
                    "to_amount": float(to_amount),
                    "base_rate": float(base_rate),
                    "effective_rate": float(effective_rate),
                    "margin": float(margin),
                }
            ),
        )

    response = {
        "status": "completed",
        "transaction_id": transaction_id,
        "tenant_id": req.tenant_id,
        "customer_id": req.customer_id,
        "from_currency": normalized_from,
        "to_currency": normalized_to,
        "from_amount": float(req.from_amount),
        "to_amount": float(to_amount),
        "exchange_rate": float(effective_rate),
        "base_rate": float(base_rate),
        "margin_applied": float(margin),
        "rate_source": rate_info.get("source", "unknown"),
        "providers": rate_info.get("providers", {}),
    }
    publish_fx_event(
        event_type="FX_EXCHANGED",
        tenant_id=req.tenant_id,
        entity_id=transaction_id,
        user_id=x_actor_id or req.initiated_by,
        payload={
            **response,
            "purpose": req.purpose,
            "strategy": rate_info.get("strategy", "best_rate"),
        },
    )
    return response


@app.get("/api/v1/fx/transactions")
async def list_fx_transactions(
    tenant_id: str,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    x_tenant_id: str = Depends(require_tenant),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    if tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    query = "SELECT * FROM fx_transactions WHERE tenant_id = $1"
    params: list[Any] = [tenant_id]
    if customer_id:
        params.append(customer_id)
        query += f" AND customer_id = ${len(params)}"
    if search:
        params.append(f"%{search.lower()}%")
        query += f" AND (LOWER(transaction_id) LIKE ${len(params)} OR LOWER(customer_id) LIKE ${len(params)} OR LOWER(purpose) LIKE ${len(params)})"
    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    query += f" ORDER BY created_at DESC LIMIT ${len(params)+1} OFFSET ${len(params)+2}"
    params_with_paging = params + [limit, offset]
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params_with_paging)
        total = await conn.fetchval(count_query, *params)
    return {"tenant_id": tenant_id, "transactions": [serialize_record(row) for row in rows], "total": total, "limit": limit, "offset": offset}


@app.get("/api/v1/fx/transactions/{transaction_id}")
async def get_fx_transaction(transaction_id: str, x_tenant_id: str = Depends(require_tenant), db: asyncpg.Pool = Depends(get_db)) -> dict[str, Any]:
    async with db.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM fx_transactions WHERE transaction_id = $1 AND tenant_id = $2", transaction_id, x_tenant_id)
        if not row:
            raise HTTPException(status_code=404, detail="FX transaction not found")
        events = await conn.fetch(
            "SELECT * FROM fx_workflow_events WHERE transaction_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
            transaction_id,
            x_tenant_id,
        )
    return {**serialize_record(row), "workflow_events": [serialize_record(event) for event in events]}


@app.get("/api/v1/fx/history")
async def get_rate_history(
    tenant_id: str,
    from_currency: str,
    to_currency: str,
    days: int = Query(default=7, ge=1, le=30),
    x_tenant_id: str = Depends(require_tenant),
    db: asyncpg.Pool = Depends(get_db),
) -> dict[str, Any]:
    if tenant_id != x_tenant_id:
        raise HTTPException(status_code=403, detail="tenant mismatch")
    normalized_from = normalize_currency(from_currency)
    normalized_to = normalize_currency(to_currency)
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT rate, source, strategy, provider_rates, created_at
            FROM fx_rates
            WHERE tenant_id = $1 AND from_currency = $2 AND to_currency = $3
              AND created_at >= NOW() - ($4::text || ' days')::interval
            ORDER BY created_at DESC
            LIMIT 200
            """,
            tenant_id,
            normalized_from,
            normalized_to,
            days,
        )
    return {
        "tenant_id": tenant_id,
        "from_currency": normalized_from,
        "to_currency": normalized_to,
        "days": days,
        "rates": [serialize_record(row) for row in rows],
        "count": len(rows),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8007")))
