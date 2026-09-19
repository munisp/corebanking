"""Dispute Resolution Service"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from decimal import Decimal
import uvicorn, asyncpg, os
from utils.kafka_instance import kafka_client
from utils.kafka_client import DisputeEventTypes
from utils.coa_client import CoAClient
from dotenv import load_dotenv
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from adapters import TransactionLedgerAdapter
from schemas import Context
import os

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link Dispute Service", version="1.0.0")

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

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-ledger-id",
    ],
    exclude_prefixes=["/health", "/dapr"],
)

app.add_middleware(AuditMiddleware)

db_pool = None

class DisputeStatus(str, Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    CLOSED = "closed"

class DisputeSchema(BaseModel):
    transaction_id: str
    dispute_type: str
    description: str

@app.on_event("startup")
async def startup():
    global db_pool
    
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=int(os.getenv("DB_PORT", "5432")),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "dispute_db"),
        min_size=int(os.getenv("DB_POOL_MIN", "1")),
        max_size=int(os.getenv("DB_POOL_MAX", "5")),
        ssl="require" if os.getenv("DB_PORT", "5432") == "25060" else None,
    )
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS disputes (
                id SERIAL PRIMARY KEY, dispute_id VARCHAR(50) UNIQUE NOT NULL, customer_id VARCHAR(50) NOT NULL,
                transaction_id VARCHAR(50) NOT NULL, dispute_type VARCHAR(50) NOT NULL, tenant_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL, description TEXT, status VARCHAR(20) DEFAULT 'open',
                resolution TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_disputes_customer ON disputes(customer_id);
            -- MN-06: expand-only — track provisional credit lifecycle.
            ALTER TABLE disputes ADD COLUMN IF NOT EXISTS provisional_credit BOOLEAN NOT NULL DEFAULT FALSE;
            ALTER TABLE disputes ADD COLUMN IF NOT EXISTS provisional_reversed BOOLEAN NOT NULL DEFAULT FALSE;
        """)

@app.on_event("shutdown")
async def shutdown():
    if db_pool: await db_pool.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "dispute-service"}

@app.post("/api/v1/disputes")
async def create_dispute(
    payload: DisputeSchema,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    dispute_id = f"DSP{int(datetime.now().timestamp())}"

    context = Context(
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
        ledger_id=ledger_id
    )

    # Get transaction being disputed
    transaction_ledger_adapter = TransactionLedgerAdapter()

    transaction_response = transaction_ledger_adapter.get_transaction_by_id(payload.transaction_id, context)

    transaction = transaction_response.get("transaction")

    if not transaction:
        raise Exception("Invalid transaction.")

    amount = transaction.get("amount")

    if not amount:
        raise Exception("Invalid transaction.")

    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO disputes (dispute_id, customer_id, transaction_id, dispute_type, amount, description, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, dispute_id, keycloak_id, payload.transaction_id, payload.dispute_type, Decimal(amount), payload.description, tenant_id)

        # MN-06: provisional credit on filing for ATM/POS failure types
        # (CBN 72h rule). Posted before the response; marked on the dispute.
        if payload.dispute_type.strip().lower() in PROVISIONAL_CREDIT_TYPES:
            customer_account = _customer_account_id(transaction)
            _post_provisional_credit(
                dispute_id=dispute_id,
                tenant_id=tenant_id,
                customer_account=customer_account,
                amount_kobo=_amount_kobo(amount),
            )
            await conn.execute(
                "UPDATE disputes SET provisional_credit=TRUE WHERE dispute_id=$1",
                dispute_id,
            )

    # Publish Kafka event for dispute creation
    kafka_client.publish_dispute_event(
        event_type=DisputeEventTypes.DISPUTE_CREATED,
        dispute_id=dispute_id,
        tenant_id=tenant_id,
        status="open",
        metadata={
            "customer_id": keycloak_id,
            "transaction_id": payload.transaction_id,
            "dispute_type": payload.dispute_type,
            "amount": str(amount),
            "description": payload.description,
        }
    )

    return { "status": "created", "dispute_id": dispute_id }

@app.get("/api/v1/disputes")
async def get_customer_disputes(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    async with db.acquire() as conn:
        disputes = await conn.fetch("SELECT * FROM disputes WHERE tenant_id = $1 AND customer_id = $2 ORDER BY created_at DESC", tenant_id, keycloak_id)
        return [dict(dispute) for dispute in disputes]
    
@app.get("/api/v1/disputes/tenant")
async def get_tenant_disputes(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    async with db.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM disputes WHERE tenant_id = $1", tenant_id
        )
        disputes = await conn.fetch(
            "SELECT * FROM disputes WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            tenant_id, limit, (page - 1) * limit,
        )
        return {"data": [dict(d) for d in disputes], "total": total, "page": page, "limit": limit}

@app.get("/api/v1/disputes/{dispute_id}")
async def get_dispute(
    dispute_id: str, 
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    context = Context(
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
        ledger_id=ledger_id
    )
    async with db.acquire() as conn:
        dispute = await conn.fetchrow("SELECT * FROM disputes WHERE dispute_id = $1 AND tenant_id = $2 AND customer_id = $3", dispute_id, tenant_id, keycloak_id)

        if not dispute: raise HTTPException(status_code=404, detail="Dispute not found")

        # Get transaction being disputed
        transaction_ledger_adapter = TransactionLedgerAdapter()

        transaction_response = transaction_ledger_adapter.get_transaction_by_id(dispute['transaction_id'], context)

        transaction = transaction_response.get("transaction")

        if not transaction:
            transaction = {}
        
        return { **dict(dispute), "transaction": transaction }

# ---------------------------------------------------------------------------
# MN-06 (S6): dispute money movement. Resolution posts a REAL balanced journal
# via journal-posting-go (Dr chargeback-suspense / Cr customer) with
# deterministic transactionRef dispute:{id}:refund; provisional credit is
# posted at filing for ATM/POS failure types and auto-reversed when the
# dispute resolves against the customer.
# ---------------------------------------------------------------------------

from utils import ExternalAPIClient as _ExternalAPIClient

JOURNAL_POSTING_URL = os.getenv("JOURNAL_POSTING_URL", "http://journal-posting-go:8080")
CHARGEBACK_SUSPENSE_ACCOUNT_ID = os.getenv("CHARGEBACK_SUSPENSE_ACCOUNT_ID", "")
INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")

PROVISIONAL_CREDIT_TYPES = {
    "atm_failure", "atm_cash_not_dispensed", "pos_failure", "pos_debit_no_value",
    "atm", "pos",
}
REFUND_RESOLUTIONS = {"refund", "partial_credit", "customer_upheld", "upheld"}
AGAINST_CUSTOMER_RESOLUTIONS = {"rejected", "denied", "customer_liable", "merchant_upheld"}


def _journal_headers(tenant_id: str) -> dict:
    headers = {"Content-Type": "application/json", "x-tenant-id": tenant_id}
    if INTERNAL_SERVICE_TOKEN:
        headers["Authorization"] = f"Bearer {INTERNAL_SERVICE_TOKEN}"
    return headers


def _post_balanced_journal(
    *,
    tenant_id: str,
    transaction_ref: str,
    narration: str,
    debit_account: int,
    credit_account: int,
    amount_kobo: int,
) -> None:
    """Post a balanced double-entry journal to TigerBeetle via
    journal-posting-go. Fail-closed: raises on any error so the dispute status
    is NOT flipped without the money moving. Deterministic transactionRef makes
    retries idempotent."""
    if not CHARGEBACK_SUSPENSE_ACCOUNT_ID:
        raise HTTPException(
            status_code=503,
            detail="CHARGEBACK_SUSPENSE_ACCOUNT_ID not configured; dispute money movement disabled (fail-closed)",
        )
    client = _ExternalAPIClient(base_url=JOURNAL_POSTING_URL, headers=_journal_headers(tenant_id))
    client._post(
        "/v1/journals",
        data={
            "tenantId": tenant_id,
            "transactionRef": transaction_ref,
            "narration": narration,
            "currency": "NGN",
            "legs": [
                {"accountId": int(debit_account), "type": "debit", "amount": int(amount_kobo)},
                {"accountId": int(credit_account), "type": "credit", "amount": int(amount_kobo)},
            ],
        },
    )


def _customer_account_id(transaction: dict) -> int:
    """The customer's TB account in the disputed transaction: the non-mint party."""
    payer = str(transaction.get("payer") or "")
    payee = str(transaction.get("payee") or "")
    candidate = payee if payer.upper() == "MINT_ACCOUNT" else payer
    if not candidate.isdigit():
        raise HTTPException(
            status_code=422,
            detail="Cannot resolve customer ledger account from disputed transaction",
        )
    return int(candidate)


def _amount_kobo(amount) -> int:
    from decimal import ROUND_HALF_UP

    return int((Decimal(str(amount)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _post_provisional_credit(
    *, dispute_id: str, tenant_id: str, customer_account: int, amount_kobo: int
) -> None:
    _post_balanced_journal(
        tenant_id=tenant_id,
        transaction_ref=f"dispute:{dispute_id}:provisional",
        narration=f"Provisional credit for dispute {dispute_id} (CBN 72h rule)",
        debit_account=int(CHARGEBACK_SUSPENSE_ACCOUNT_ID),
        credit_account=customer_account,
        amount_kobo=amount_kobo,
    )


@app.put("/api/v1/administration/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    resolution: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header("1", alias="x-ledger-id"),
):
    resolution_norm = (resolution or "").strip().lower()
    context = Context(tenant_id=tenant_id, keycloak_id=keycloak_id, ledger_id=ledger_id)

    async with db.acquire() as conn:
        dispute = await conn.fetchrow(
            "SELECT * FROM disputes WHERE dispute_id = $1 AND tenant_id = $2",
            dispute_id, tenant_id,
        )
        if not dispute:
            raise HTTPException(status_code=404, detail="Dispute not found")
        if dispute["status"] == "resolved":
            # Idempotent replay.
            return {"status": "resolved", "dispute_id": dispute_id, "idempotent_replay": True}

        amount_kobo = _amount_kobo(dispute["amount"])

        # Fetch the disputed transaction to resolve the customer's ledger account.
        transaction = {}
        if resolution_norm in REFUND_RESOLUTIONS | AGAINST_CUSTOMER_RESOLUTIONS or dispute["provisional_credit"]:
            txn_resp = TransactionLedgerAdapter().get_transaction_by_id(
                dispute["transaction_id"], context
            )
            transaction = (txn_resp or {}).get("transaction") or {}

        if resolution_norm in REFUND_RESOLUTIONS:
            customer_account = _customer_account_id(transaction)
            if dispute["provisional_credit"] and not dispute["provisional_reversed"]:
                # Provisional credit already moved funds to the customer; the
                # final refund only needs to settle the suspense account — the
                # refund journal below is posted with the SAME suspense/customer
                # direction only when no provisional credit exists, otherwise we
                # mark the provisional credit as final (no double credit).
                await conn.execute(
                    "UPDATE disputes SET status='resolved', resolution=$1 WHERE dispute_id=$2 AND tenant_id=$3",
                    resolution, dispute_id, tenant_id,
                )
            else:
                # MN-06: real refund — Dr chargeback-suspense / Cr customer.
                _post_balanced_journal(
                    tenant_id=tenant_id,
                    transaction_ref=f"dispute:{dispute_id}:refund",
                    narration=f"Refund for dispute {dispute_id} ({resolution_norm})",
                    debit_account=int(CHARGEBACK_SUSPENSE_ACCOUNT_ID),
                    credit_account=customer_account,
                    amount_kobo=amount_kobo,
                )
                await conn.execute(
                    "UPDATE disputes SET status='resolved', resolution=$1 WHERE dispute_id=$2 AND tenant_id=$3",
                    resolution, dispute_id, tenant_id,
                )
        elif resolution_norm in AGAINST_CUSTOMER_RESOLUTIONS:
            # Auto-reversal of any provisional credit: Dr customer / Cr suspense.
            if dispute["provisional_credit"] and not dispute["provisional_reversed"]:
                customer_account = _customer_account_id(transaction)
                _post_balanced_journal(
                    tenant_id=tenant_id,
                    transaction_ref=f"dispute:{dispute_id}:provisional-reversal",
                    narration=f"Provisional credit reversal for dispute {dispute_id}",
                    debit_account=customer_account,
                    credit_account=int(CHARGEBACK_SUSPENSE_ACCOUNT_ID),
                    amount_kobo=amount_kobo,
                )
                await conn.execute(
                    "UPDATE disputes SET provisional_reversed=TRUE WHERE dispute_id=$1 AND tenant_id=$2",
                    dispute_id, tenant_id,
                )
            await conn.execute(
                "UPDATE disputes SET status='resolved', resolution=$1 WHERE dispute_id=$2 AND tenant_id=$3",
                resolution, dispute_id, tenant_id,
            )
        else:
            await conn.execute(
                "UPDATE disputes SET status='resolved', resolution=$1 WHERE dispute_id=$2 AND tenant_id=$3",
                resolution, dispute_id, tenant_id,
            )

    # Keep publishing disputes.resolved (consumers: notification, suspense recon).
    kafka_client.publish_dispute_event(
        event_type=DisputeEventTypes.DISPUTE_RESOLVED,
        dispute_id=dispute_id,
        tenant_id=tenant_id,
        status="resolved",
        metadata={"resolution": resolution_norm},
    )
    return {"status": "resolved", "dispute_id": dispute_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8019")))
