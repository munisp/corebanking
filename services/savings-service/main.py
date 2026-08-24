"""Savings Service — DEPRECATED: superseded by savings-products-go (platform canonical).
Decommission after savings-products-go reaches feature parity with fixed-deposit and
target-savings product types. Do not add new features here."""
import logging as _logging
_logging.warning("DEPRECATED: savings-service — migrate to savings-products-go")

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from datetime import datetime
from decimal import Decimal
from typing import Optional
import uvicorn
import asyncpg
import os
from dotenv import load_dotenv
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from pydantic import BaseModel
from adapters import AccountServiceAdapter, PaymentHubAdapter
from schemas import Context
from utils.kafka_instance import kafka_client
from utils.kafka_client import SavingsEventTypes
from utils.coa_client import CoAClient

load_dotenv()

app = FastAPI(title="54Link Savings Service", version="1.0.0")

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


# Initialize CoA client
coa_client = CoAClient()

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-ledger-id"
    ],
    exclude_prefixes=["/health", "/dapr"],
)

app.add_middleware(AuditMiddleware)

db_pool = None


class SavingsGoal(BaseModel):
    name: str
    target_amount: Decimal
    target_date: str
    enable_auto_save: bool

class DepositRequest(BaseModel):
    account_id: str
    amount: Decimal
    customer_account: str
    pin: str
    

class WithdrawalRequest(BaseModel):
    account_id: str
    amount: Decimal
    customer_account: str

class UpdateSavingsGoal(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[Decimal] = None
    target_date: Optional[str] = None
    enable_auto_save: Optional[bool] = None
    status: Optional[str] = None

@app.on_event("startup")
async def startup():
    global db_pool

    db_pool = await asyncpg.create_pool(host=os.getenv("DB_HOST", "postgres"), port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"), password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "savings_db"), min_size=5, max_size=20)
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS savings_goals (
                id SERIAL PRIMARY KEY, goal_id VARCHAR(50) UNIQUE NOT NULL, customer_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL, savings_account_id INT NOT NULL, enable_auto_save BOOLEAN NOT NULL,
                goal_name VARCHAR(255) NOT NULL, target_amount DECIMAL(15,2) NOT NULL,
                target_date DATE, interest_rate DECIMAL(5,2) DEFAULT 2.5,
                status VARCHAR(20) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_savings_customer ON savings_goals(customer_id);
        """)

@app.on_event("shutdown")
async def shutdown():
    if db_pool: await db_pool.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "savings-service"}


# Savings goal creation endpoint remains unchanged
@app.post("/api/v1/savings")
async def create_savings_goal(
    payload: SavingsGoal,
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
    goal_id = f"SAV{int(datetime.now().timestamp())}"
    account_service_adapter = AccountServiceAdapter()
    account_response = account_service_adapter.create_account(name=goal_id, context=context)
    account_id = account_response.get("account", {}).get("id")
    if not account_id:
        raise Exception("Failed to create savings account.")
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO savings_goals (goal_id, customer_id, goal_name, target_amount, target_date, savings_account_id, enable_auto_save, tenant_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """, goal_id, keycloak_id, payload.name, payload.target_amount, datetime.fromisoformat(payload.target_date), account_id, payload.enable_auto_save, tenant_id)
    kafka_client.publish_goal_event(
        event_type=SavingsEventTypes.GOAL_CREATED,
        goal_id=goal_id,
        tenant_id=tenant_id,
        status="active",
        metadata={
            "customer_id": keycloak_id,
            "goal_name": payload.name,
            "target_amount": str(payload.target_amount),
            "target_date": payload.target_date,
            "savings_account_id": account_id,
            "enable_auto_save": payload.enable_auto_save,
        }
    )
    return {"status": "created", "goal_id": goal_id, "goal_name": payload.name, "savings_account_id": account_id, "enable_auto_save": payload.enable_auto_save}

# Deposit endpoint with fail-fast CoA journal entry
@app.post("/api/v1/savings/deposit")
async def deposit(
    payload: DepositRequest,
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

    try:
        async with db.acquire() as conn:

            #  Fetch savings account
            account = await conn.fetchrow(
                """
                SELECT *
                FROM account
                WHERE name = $1
                  AND tenant_id = $2
                """,
                payload.account_id,
                tenant_id,
            )

            if not account:
                raise HTTPException(
                    status_code=404,
                    detail="Savings account not found"
                )

            #  Use account number as saving_id
            saving_account_number = account["account_number"]


            #  Transfer funds
            payment_hub_adapter = PaymentHubAdapter()
            payment_hub_adapter.transfer(
                amount=float(payload.amount),
                saving_id=saving_account_number,
                customer_account=payload.customer_account,
                pin=payload.pin,
                context=context,
            )

        return {
            "status": "success",
            "account_id": payload.account_id,
            "saving_account_number": saving_account_number,
            "amount": payload.amount,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process deposit: {e}"
        )

# Withdrawal endpoint with fail-fast CoA journal entry
@app.post("/api/v1/savings/withdrawal")
async def withdrawal(
    payload: WithdrawalRequest,
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    context = Context(
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
        ledger_id=ledger_id
    )
    # Record in Chart of Accounts (fail-fast)
    try:
        await coa_client.record_savings_withdrawal(
            tenant_id=tenant_id,
            user_id=keycloak_id,
            user_role="bank_admin",
            account_id=payload.account_id,
            amount=int(payload.amount * 100),  # Convert to kobo
            customer_account=payload.customer_account,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record accounting entry: {e}")
    # ... process withdrawal in system (DB update, etc.) ...
    return {"status": "success", "account_id": payload.account_id, "amount": payload.amount}

@app.get("/api/v1/savings")
async def get_savings_goals(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: Optional[str] = Header(None, alias="x-ledger-id"),
):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM savings_goals WHERE customer_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
            keycloak_id, tenant_id
        )
        return [dict(row) for row in rows]

@app.get("/api/v1/tenant/savings")
async def get_tenant_savings(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    async with db.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM savings_goals WHERE tenant_id = $1", tenant_id
        )
        rows = await conn.fetch(
            "SELECT * FROM savings_goals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            tenant_id, limit, (page - 1) * limit,
        )
        return {"data": [dict(row) for row in rows], "total": total, "page": page, "limit": limit}

@app.put("/api/v1/savings/{goal_id}")
async def update_savings_goal(
    goal_id: str,
    payload: UpdateSavingsGoal,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Savings goal not found")

        updates = []
        values = []
        idx = 1

        if payload.name is not None:
            updates.append(f"goal_name = ${idx}")
            values.append(payload.name)
            idx += 1
        if payload.target_amount is not None:
            updates.append(f"target_amount = ${idx}")
            values.append(payload.target_amount)
            idx += 1
        if payload.target_date is not None:
            updates.append(f"target_date = ${idx}")
            values.append(datetime.fromisoformat(payload.target_date))
            idx += 1
        if payload.enable_auto_save is not None:
            updates.append(f"enable_auto_save = ${idx}")
            values.append(payload.enable_auto_save)
            idx += 1
        if payload.status is not None:
            updates.append(f"status = ${idx}")
            values.append(payload.status)
            idx += 1

        if updates:
            values.extend([goal_id, keycloak_id, tenant_id])
            await conn.execute(
                f"UPDATE savings_goals SET {', '.join(updates)} WHERE goal_id = ${idx} AND customer_id = ${idx+1} AND tenant_id = ${idx+2}",
                *values
            )

        updated_row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        return {"data": dict(updated_row)}

@app.delete("/api/v1/savings/{goal_id}")
async def delete_savings_goal(
    goal_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    async with db.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Savings goal not found")
        return {"success": True, "message": "Savings goal deleted successfully"}

@app.post("/api/v1/savings/{goal_id}/pause")
async def pause_savings_goal(
    goal_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Savings goal not found")
        await conn.execute(
            "UPDATE savings_goals SET status = 'paused' WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        updated_row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        return {"data": dict(updated_row)}

@app.post("/api/v1/savings/{goal_id}/resume")
async def resume_savings_goal(
    goal_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        if not row:
            raise HTTPException(status_code=404, detail="Savings goal not found")
        await conn.execute(
            "UPDATE savings_goals SET status = 'active' WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        updated_row = await conn.fetchrow(
            "SELECT * FROM savings_goals WHERE goal_id = $1 AND customer_id = $2 AND tenant_id = $3",
            goal_id, keycloak_id, tenant_id
        )
        return {"data": dict(updated_row)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8018")))
