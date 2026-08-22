"""Card Management Service"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from enum import Enum
import logging
import uvicorn
import asyncpg
import os
import random
import hashlib
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from utils.errors import raise_http_exception_handler
from utils.kafka_instance import KafkaClientInstance
from utils.kafka_client import CardEventTypes
from utils.coa_client import CoAClient

load_dotenv()

app = FastAPI(title="54Link Card Service", version="1.0.0")

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
    ],
    exclude_prefixes=["/health", "/dapr"],
)

_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

db_pool = None


class CardType(str, Enum):
    DEBIT = "debit"
    CREDIT = "credit"
    VIRTUAL = "virtual"


class CardStatus(str, Enum):
    ACTIVE = "active"
    BLOCKED = "blocked"
    LOST = "lost"


class CardCreation(BaseModel):
    account_id: str
    card_type: CardType
    name_on_card: str


class CardCreationAdmin(BaseModel):
    account_id: str
    card_type: CardType
    name_on_card: str
    customer_id: str


class SetPinSchema(BaseModel):
    pin: str


@app.on_event("startup")
async def startup():
    import logging
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "postgres"),
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "postgres"),
            database=os.getenv("DB_NAME", "card_db"),
            min_size=5,
            max_size=20,
        )
        async with db_pool.acquire() as conn:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cards (
                    id SERIAL PRIMARY KEY, tenant_id VARCHAR(50) NOT NULL, card_id VARCHAR(50) UNIQUE NOT NULL, card_number VARCHAR(16) UNIQUE NOT NULL,
                    card_type VARCHAR(20) NOT NULL, customer_id VARCHAR(50) NOT NULL, account_id VARCHAR(50) NOT NULL,
                    name_on_card VARCHAR(255) NOT NULL, expiry_date DATE NOT NULL, cvv VARCHAR(3) NOT NULL,
                    pin_hash VARCHAR(255), status VARCHAR(20) DEFAULT 'active', daily_limit DECIMAL(15,2) DEFAULT 500000,
                    monthly_limit DECIMAL(15,2) DEFAULT 5000000, daily_spent DECIMAL(15,2) DEFAULT 0,
                    monthly_spent DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_cards_customer ON cards(customer_id);"
            )
            # Ensure card_number column exists for databases created before this field was added
            await conn.execute(
                "ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_number VARCHAR(16);"
            )
    except Exception as exc:
        logging.getLogger(__name__).error(f"Startup DB init failed: {exc}", exc_info=True)
        raise


@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "card-service"}


@app.post("/api/v1/cards/issue")
async def issue_card(
    card: CardCreation,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):

    try:
        # Logic to issue a valid card.

        card_id = f"CRD{int(datetime.now().timestamp())}"
        card_number = f"4{random.randint(100000000000000, 999999999999999)}"
        cvv = f"{random.randint(100, 999)}"
        expiry_date = datetime.now().date() + timedelta(days=365 * 3)

        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO cards (card_id, card_number, card_type, customer_id, account_id, name_on_card, expiry_date, cvv, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
                card_id,
                card_number,
                card.card_type.value,
                customer_id,
                card.account_id,
                card.name_on_card,
                expiry_date,
                cvv,
                tenant_id,
            )

        # Publish Kafka event for card issuance
        KafkaClientInstance.publish_card_event(
            event_type=CardEventTypes.CARD_ISSUED,
            card_id=card_id,
            tenant_id=tenant_id,
            status="active",
            metadata={
                "card_number": card_number,
                "card_type": card.card_type.value,
                "customer_id": customer_id,
                "account_id": card.account_id,
                "name_on_card": card.name_on_card,
                "expiry_date": str(expiry_date),
            },
        )

        return {
            "status": "issued",
            "card_id": card_id,
            "card_number": card_number,
            "expiry_date": expiry_date,
        }
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to issue card: {str(e)}", "CRD-ISSUE-5001"
        )


@app.post("/api/v1/cards/issue/admin")
async def issue_card_admin(
    card: CardCreation,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):

    try:
        # Logic to issue a valid card.

        card_id = f"CRD{int(datetime.now().timestamp())}"
        card_number = f"4{random.randint(100000000000000, 999999999999999)}"
        cvv = f"{random.randint(100, 999)}"
        expiry_date = datetime.now().date() + timedelta(days=365 * 3)

        async with db.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO cards (card_id, card_number, card_type, customer_id, account_id, name_on_card, expiry_date, cvv, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
                card_id,
                card_number,
                card.card_type.value,
                card.customer_id,
                card.account_id,
                card.name_on_card,
                expiry_date,
                cvv,
                tenant_id,
            )

        # Publish Kafka event for card issuance
        KafkaClientInstance.publish_card_event(
            event_type=CardEventTypes.CARD_ISSUED,
            card_id=card_id,
            tenant_id=tenant_id,
            status="active",
            metadata={
                "card_number": card_number,
                "card_type": card.card_type.value,
                "customer_id": card.customer_id,
                "account_id": card.account_id,
                "name_on_card": card.name_on_card,
                "expiry_date": str(expiry_date),
            },
        )

        return {
            "status": "issued",
            "card_id": card_id,
            "card_number": card_number,
            "expiry_date": expiry_date,
        }
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to issue card: {str(e)}", "CRD-ISSUE-5001"
        )


@app.get("/api/v1/cards/tenant")
async def list_tenant_cards(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    try:
        async with db.acquire() as conn:
            rows = await conn.fetch(
                "SELECT * FROM cards WHERE tenant_id = $1 ORDER BY created_at DESC",
                tenant_id,
            )

        cards = []

        for row in rows:
            card = dict(row)
            raw_pan = card.get("card_number") or ""
            card["card_number"] = f"****{raw_pan[-4:]}" if raw_pan else None
            card["cvv"] = "***"
            cards.append(card)

        return {"cards": cards, "total": len(cards)}
    except Exception as e:
        logger.error(f"list_tenant_cards failed: {type(e).__name__}: {e}", exc_info=True)
        raise_http_exception_handler(
            500, f"Failed to fetch cards: {str(e)}", "CRD-LIST-5001"
        )


@app.get("/api/v1/cards/customer")
async def list_customer_cards(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    async with db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM cards WHERE customer_id = $1 AND tenant_id = $2 ORDER BY created_at DESC",
            customer_id,
            tenant_id,
        )

        cards = []

        for row in rows:
            cards.append(dict(row))

        return {"customer_id": customer_id, "cards": cards, "total": len(cards)}


@app.post("/api/v1/cards/{card_id}/set-pin")
async def set_pin(
    card_id: str,
    payload: SetPinSchema,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        if len(payload.pin) != 4 or not payload.pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN must be 4 digits")

        pin_hash = hashlib.sha256(payload.pin.encode()).hexdigest()

        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET pin_hash = $1 WHERE card_id = $2 AND customer_id = $3 AND tenant_id = $4",
                pin_hash,
                card_id,
                customer_id,
                tenant_id,
            )

        return {"message": "success", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to set PIN: {str(e)}", "CRD-SETPIN-5001"
        )


@app.post("/api/v1/cards/{card_id}/freeze")
async def freeze_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET status = 'frozen' WHERE card_id = $1 AND customer_id = $2 AND tenant_id = $3",
                card_id,
                customer_id,
                tenant_id,
            )

        return {"status": "frozen", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to freeze card: {str(e)}", "CRD-FREEZE-5001"
        )


@app.post("/api/v1/cards/{card_id}/unfreeze")
async def unfreeze_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            await conn.execute(
                "UPDATE cards SET status = 'active' WHERE card_id = $1 AND customer_id = $2 AND tenant_id = $3",
                card_id,
                customer_id,
                tenant_id,
            )

        return {"status": "active", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to unfreeze card: {str(e)}", "CRD-UNFREEZE-5001"
        )


@app.post("/api/v1/cards/{card_id}/block")
async def block_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    try:
        async with db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM cards WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

            if not row:
                raise Exception("Card not found")

            await conn.execute(
                "UPDATE cards SET status = 'blocked' WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

        return {"status": "blocked", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to block card: {str(e)}", "CRD-BLOCK-5001"
        )


@app.post("/api/v1/cards/{card_id}/unblock")
async def unblock_card(
    card_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    customer_id: str = Header(..., alias="x-keycloak-id"),
):
    try:
        async with db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM cards WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

            if not row:
                raise Exception("Card not found")

            await conn.execute(
                "UPDATE cards SET status = 'active' WHERE card_id = $1 AND tenant_id = $2",
                card_id,
                tenant_id,
            )

        return {"status": "active", "card_id": card_id}
    except Exception as e:
        raise_http_exception_handler(
            500, f"Failed to unblock card: {str(e)}", "CRD-UNBLOCK-5001"
        )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8017")))
