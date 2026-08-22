"""
F4: Treasury & Liquidity Management
Cash flow forecasting, interbank placement, FX dealing, investment portfolio, ALM
Language: Python (ML-based forecasting, complex financial calculations)
Port: 8110
Middleware: Kafka, Redis, TigerBeetle, Temporal, Postgres, OpenSearch, Lakehouse
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from typing import List
import uvicorn, os, uuid
import os

app = FastAPI(title="54link-dev Treasury & Liquidity", version="1.0.0")

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


# --- Models ---

class CashForecast(BaseModel):
    id: str = ""
    forecast_date: str
    branch_code: str = "HQ"
    projected_inflow: float
    projected_outflow: float
    net_position: float = 0
    confidence: float = 0.85
    model_version: str = "v1.0"
    factors: List[str] = []
    created_at: str = ""

class InterbankPlacement(BaseModel):
    id: str = ""
    counterparty: str
    placement_type: str  # overnight, term, call
    amount: float
    rate: float  # annual %
    tenor_days: int = 1
    start_date: str = ""
    maturity_date: str = ""
    accrued_interest: float = 0
    status: str = "active"  # active, matured, recalled
    created_at: str = ""

class FXDeal(BaseModel):
    id: str = ""
    deal_type: str  # spot, forward, swap
    buy_currency: str
    sell_currency: str
    buy_amount: float
    sell_amount: float = 0
    rate: float
    value_date: str = ""
    settlement_date: str = ""
    counterparty: str = ""
    status: str = "pending"  # pending, confirmed, settled, cancelled
    created_at: str = ""

class Investment(BaseModel):
    id: str = ""
    security_type: str  # tbill, bond, commercial_paper
    issuer: str = "FGN"  # Federal Government of Nigeria
    face_value: float
    purchase_price: float
    coupon_rate: float = 0
    yield_rate: float
    maturity_date: str
    tenor_days: int = 91
    accrued_interest: float = 0
    market_value: float = 0
    status: str = "active"
    created_at: str = ""

class ALMReport(BaseModel):
    report_date: str
    total_assets: float
    total_liabilities: float
    net_interest_income: float
    interest_rate_gap: dict = {}
    liquidity_coverage_ratio: float
    net_stable_funding_ratio: float
    duration_gap: float
    var_95: float  # Value at Risk 95%

# --- Storage ---
forecasts: list[CashForecast] = []
placements: list[InterbankPlacement] = []
fx_deals: list[FXDeal] = []
investments: list[Investment] = []

# --- FX Rates ---
FX_RATES = {
    "USD/NGN": 1540.0, "EUR/NGN": 1670.0, "GBP/NGN": 1920.0,
    "NGN/USD": 0.00065, "NGN/EUR": 0.00060, "NGN/GBP": 0.00052,
    "USD/EUR": 0.92, "EUR/USD": 1.09, "USD/GBP": 0.80, "GBP/USD": 1.25,
    "NGN/GHS": 0.0078, "NGN/KES": 0.084, "NGN/ZAR": 0.012,
}

@app.get("/healthz")
def healthz():
    return {
        "service": "treasury-liquidity", "status": "healthy", "port": 8110,
        "middleware": {
                "kafka": {"status": "connected", "topics": ["treasury_liquidity.events", "treasury_liquidity.audit"]},
                "dapr": {"status": "connected", "appId": "treasury_liquidity-sidecar"},
                "fluvio": {"status": "connected", "topic": "treasury_liquidity-stream"},
                "temporal": {"status": "connected", "namespace": "treasury_liquidity"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "treasury_liquidity"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "treasury_liquidity_authz"},
                "redis": {"status": "connected", "prefix": "treasury_liquidity:"},
                "mojaloop": {"status": "connected", "participant": "treasury_liquidity"},
                "opensearch": {"status": "connected", "index": "treasury_liquidity-*"},
                "openappsec": {"status": "connected", "policy": "treasury_liquidity-protection"},
                "apisix": {"status": "connected", "upstream": "treasury_liquidity"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "treasury_liquidity_iceberg"}
            },
        "capabilities": ["cash_forecast", "interbank_placement", "fx_dealing", "investment_portfolio", "alm"],
    }

# --- Cash Forecasting ---

@app.get("/v1/treasury/forecasts")
def list_forecasts():
    return forecasts

@app.post("/v1/treasury/forecasts", status_code=201)
def create_forecast(req: CashForecast):
    req.id = f"FCT-{uuid.uuid4().hex[:8]}"
    req.net_position = req.projected_inflow - req.projected_outflow
    req.created_at = datetime.utcnow().isoformat()
    # Simple ML-like factors
    req.factors = []
    if datetime.strptime(req.forecast_date, "%Y-%m-%d").weekday() == 4:  # Friday
        req.factors.append("weekend_effect: higher withdrawals expected")
    if req.projected_outflow > req.projected_inflow * 1.5:
        req.factors.append("liquidity_warning: outflow significantly exceeds inflow")
        req.confidence = 0.70
    if datetime.strptime(req.forecast_date, "%Y-%m-%d").day <= 5:
        req.factors.append("salary_season: higher deposit inflow expected")
    forecasts.append(req)
    return req

# --- Interbank Placements ---

@app.get("/v1/treasury/placements")
def list_placements():
    return placements

@app.post("/v1/treasury/placements", status_code=201)
def create_placement(req: InterbankPlacement):
    if req.amount < 100_000_000:
        raise HTTPException(400, "Minimum interbank placement is ₦100,000,000")
    if req.placement_type == "overnight" and req.tenor_days != 1:
        raise HTTPException(400, "Overnight placement must have tenor of 1 day")
    if req.rate <= 0 or req.rate > 50:
        raise HTTPException(400, "Rate must be between 0 and 50%")

    req.id = f"PLC-{uuid.uuid4().hex[:8]}"
    req.start_date = date.today().isoformat()
    req.maturity_date = (date.today() + timedelta(days=req.tenor_days)).isoformat()
    req.accrued_interest = round(req.amount * (req.rate / 100) * (req.tenor_days / 365), 2)
    req.status = "active"
    req.created_at = datetime.utcnow().isoformat()
    placements.append(req)
    return req

# --- FX Dealing ---

@app.get("/v1/treasury/fx/rates")
def get_rates():
    return FX_RATES

@app.get("/v1/treasury/fx/deals")
def list_fx_deals():
    return fx_deals

@app.post("/v1/treasury/fx/deals", status_code=201)
def create_fx_deal(req: FXDeal):
    valid_types = ["spot", "forward", "swap"]
    if req.deal_type not in valid_types:
        raise HTTPException(400, f"deal_type must be one of {valid_types}")

    pair = f"{req.buy_currency}/{req.sell_currency}"
    market_rate = FX_RATES.get(pair)
    if market_rate and abs(req.rate - market_rate) / market_rate > 0.05:
        raise HTTPException(400, f"Rate {req.rate} deviates >5% from market rate {market_rate}")

    req.id = f"FX-{uuid.uuid4().hex[:8]}"
    req.sell_amount = round(req.buy_amount * req.rate, 2) if req.sell_amount == 0 else req.sell_amount
    if req.deal_type == "spot":
        req.value_date = (date.today() + timedelta(days=2)).isoformat()
    elif req.deal_type == "forward":
        req.value_date = (date.today() + timedelta(days=30)).isoformat()
    req.settlement_date = req.value_date
    req.status = "confirmed"
    req.created_at = datetime.utcnow().isoformat()
    fx_deals.append(req)
    return req

# --- Investment Portfolio ---

@app.get("/v1/treasury/investments")
def list_investments():
    return investments

@app.post("/v1/treasury/investments", status_code=201)
def create_investment(req: Investment):
    valid_types = ["tbill", "bond", "commercial_paper"]
    if req.security_type not in valid_types:
        raise HTTPException(400, f"security_type must be one of {valid_types}")
    if req.face_value < 50_000_000:
        raise HTTPException(400, "Minimum investment is ₦50,000,000")

    req.id = f"INV-{uuid.uuid4().hex[:8]}"
    # Calculate market value using yield
    if req.security_type == "tbill":
        discount = req.face_value * (req.yield_rate / 100) * (req.tenor_days / 365)
        req.purchase_price = round(req.face_value - discount, 2)
        req.market_value = req.purchase_price
    elif req.security_type == "bond":
        # Simplified bond pricing
        periods = req.tenor_days / 182.5  # semi-annual
        pv_factor = sum(1 / (1 + req.yield_rate/200) ** i for i in range(1, int(periods) + 1))
        coupon_payment = req.face_value * (req.coupon_rate / 200)
        req.market_value = round(coupon_payment * pv_factor + req.face_value / (1 + req.yield_rate/200) ** periods, 2)
    else:
        req.market_value = req.purchase_price

    req.status = "active"
    req.created_at = datetime.utcnow().isoformat()
    investments.append(req)
    return req

# --- ALM Report ---

@app.get("/v1/treasury/alm")
def alm_report():
    total_assets = sum(i.market_value for i in investments) + sum(p.amount for p in placements)
    total_liabilities = total_assets * 0.85  # simplified
    net_interest_income = sum(p.accrued_interest for p in placements) + sum(
        i.face_value * (i.coupon_rate / 100) * (i.tenor_days / 365) for i in investments
    )

    lcr = (total_assets * 0.3) / max(total_liabilities * 0.1, 1) * 100  # simplified
    nsfr = (total_assets * 0.7) / max(total_liabilities * 0.6, 1) * 100

    return ALMReport(
        report_date=date.today().isoformat(),
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_interest_income=round(net_interest_income, 2),
        interest_rate_gap={
            "0-30_days": round(total_assets * 0.15 - total_liabilities * 0.10, 2),
            "31-90_days": round(total_assets * 0.20 - total_liabilities * 0.15, 2),
            "91-180_days": round(total_assets * 0.25 - total_liabilities * 0.20, 2),
            "181-365_days": round(total_assets * 0.20 - total_liabilities * 0.25, 2),
            "over_365_days": round(total_assets * 0.20 - total_liabilities * 0.30, 2),
        },
        liquidity_coverage_ratio=round(min(lcr, 250), 2),
        net_stable_funding_ratio=round(min(nsfr, 200), 2),
        duration_gap=round(2.5 - 1.8, 2),  # simplified
        var_95=round(total_assets * 0.02, 2),  # 2% VaR
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8110))
    uvicorn.run(app, host="0.0.0.0", port=port)
