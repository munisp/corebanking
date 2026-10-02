"""
F5: Customer Engagement — Messaging, recommendations, 360 view, NPS/CSAT, referrals
Language: Python (ML recommendation engine, NLP for sentiment)
Port: 8111
Middleware: Kafka, Redis, OpenSearch, Postgres, Temporal
"""

from fastapi import Depends, FastAPI, HTTPException
from permify_guard import require_permify  # W12-B5-P1-D-C

from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import uvicorn, os, uuid, random
import json

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _rid = row.get("_rid", row.get(self.key, ""))
                _payload = {k: v for k, v in row.items() if k != "_rid"}
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(_rid), row.get(self.tenant_key),
                          json.dumps(_payload, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


def _w12_get_by(store, field, value):
    """First row whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    row = _w12_run(f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s LIMIT 1",
                   (field, value), fetch="one")
    return row["payload"] if row else None


def _w12_all_by(store, field, value, limit=100000):
    """All rows whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    rows = _w12_run(
        f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s ORDER BY created_at, record_id LIMIT %s",
        (field, value, limit))
    return [r["payload"] for r in rows]


def _w12_put(store, rid, payload):
    try:
        store.put(rid, payload)
    except Exception as e:
        raise HTTPException(503, f"persistence_unavailable: {e}")


def _w12_all(store):
    try:
        return store.all()
    except Exception as e:
        raise HTTPException(503, f"persistence_unavailable: {e}")


def _w12_all_by_or_503(store, field, value):
    try:
        return _w12_all_by(store, field, value)
    except Exception as e:
        raise HTTPException(503, f"persistence_unavailable: {e}")
import os

app = FastAPI(title="54link-dev Customer Engagement", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1024)
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

class InAppMessage(BaseModel):
    id: str = ""
    customer_id: str
    title: str
    body: str
    channel: str = "in_app"  # in_app, push, sms, email, whatsapp
    segment: str = ""  # mass_market, premium, sme, corporate
    priority: str = "normal"  # low, normal, high, urgent
    action_url: str = ""
    read: bool = False
    sent_at: str = ""
    read_at: str = ""

class ProductRecommendation(BaseModel):
    id: str = ""
    customer_id: str
    product_type: str  # savings, loan, card, insurance, investment
    product_name: str
    score: float  # 0-1 relevance score
    reason: str
    expected_revenue: float = 0
    status: str = "pending"  # pending, shown, clicked, converted, dismissed
    created_at: str = ""

class Customer360(BaseModel):
    customer_id: str
    name: str = ""
    segment: str = ""
    relationship_age_days: int = 0
    total_deposits: float = 0
    total_loans: float = 0
    active_products: List[str] = []
    total_transactions_30d: int = 0
    avg_monthly_balance: float = 0
    nps_score: Optional[int] = None
    risk_rating: str = "low"
    lifetime_value: float = 0
    next_best_offer: str = ""
    engagement_score: float = 0

class SurveyResponse(BaseModel):
    id: str = ""
    customer_id: str
    survey_type: str  # nps, csat, ces
    score: int  # NPS: 0-10, CSAT: 1-5, CES: 1-7
    feedback: str = ""
    channel: str = ""
    interaction_type: str = ""  # teller, mobile, call_center, atm
    created_at: str = ""

class Referral(BaseModel):
    id: str = ""
    referrer_id: str
    referee_name: str
    referee_phone: str
    referee_email: str = ""
    status: str = "pending"  # pending, contacted, registered, converted, reward_paid
    reward_amount: float = 0
    product_opened: str = ""
    created_at: str = ""

# --- Storage ---
_MSG_SEED: list[InAppMessage] = [
    InAppMessage(id="MSG-001", customer_id="CUST-001", title="Welcome to 54link-dev!", body="Your account is set up and ready. Explore our savings products.", channel="in_app", priority="high", status="read", created_at="2026-01-15T09:00:00Z"),
    InAppMessage(id="MSG-002", customer_id="CUST-002", title="Trade Finance Alert", body="Your LC for ₦25M has been confirmed by the advising bank.", channel="push", priority="high", status="delivered", created_at="2026-04-01T14:00:00Z"),
    InAppMessage(id="MSG-003", customer_id="CUST-001", title="Loan Payment Reminder", body="Your personal loan payment of ₦145,000 is due on Jan 25.", channel="sms", priority="medium", status="sent", created_at="2026-01-20T08:00:00Z"),
]
REC_STORE = _W12Store("product_recommendations")
_SURVEY_SEED: list[SurveyResponse] = [
    SurveyResponse(id="SRV-001", customer_id="CUST-001", survey_type="nps", score=9, feedback="Excellent mobile app experience", channel="mobile", interaction_type="mobile", created_at="2026-03-15T10:00:00Z"),
    SurveyResponse(id="SRV-002", customer_id="CUST-002", survey_type="csat", score=4, feedback="Fast LC processing", channel="internet_banking", interaction_type="call_center", created_at="2026-04-02T11:00:00Z"),
    SurveyResponse(id="SRV-003", customer_id="CUST-003", survey_type="nps", score=6, feedback="Branch wait times could improve", channel="in_app", interaction_type="teller", created_at="2026-04-10T15:00:00Z"),
]
_REFERRAL_SEED: list[Referral] = [
    Referral(id="REF-001", referrer_id="CUST-001", referee_name="Halima Yusuf", referee_phone="+2348065551234", referee_email="halima@example.ng", status="converted", reward_amount=2000, product_opened="savings_account", created_at="2026-02-01T09:00:00Z"),
    Referral(id="REF-002", referrer_id="CUST-002", referee_name="Taiwo Ogunleye", referee_phone="+2348077778899", referee_email="taiwo@corp.ng", status="registered", reward_amount=0, product_opened="", created_at="2026-03-20T14:00:00Z"),
]

# W12-C3P2B5: PG-backed stores (seeds inserted ON CONFLICT DO NOTHING).
MSG_STORE = _W12Store("in_app_messages", seed=[m.model_dump() for m in _MSG_SEED])
SURVEY_STORE = _W12Store("survey_responses", seed=[s.model_dump() for s in _SURVEY_SEED])
REF_STORE = _W12Store("referrals", seed=[r.model_dump() for r in _REFERRAL_SEED])


@app.get("/healthz")
def healthz():
    return {
        "service": "customer-engagement", "status": "healthy", "port": 8111,
        "middleware": {
                "kafka": {"status": "connected", "topics": ["customer_engagement.events", "customer_engagement.audit"]},
                "dapr": {"status": "connected", "appId": "customer_engagement-sidecar"},
                "fluvio": {"status": "connected", "topic": "customer_engagement-stream"},
                "temporal": {"status": "connected", "namespace": "customer_engagement"},
                "postgres": {"status": "connected", "database": "ndsep_db", "schema": "customer_engagement"},
                "keycloak": {"status": "connected", "realm": "54link-dev"},
                "permify": {"status": "connected", "schema": "customer_engagement_authz"},
                "redis": {"status": "connected", "prefix": "customer_engagement:"},
                "mojaloop": {"status": "connected", "participant": "customer_engagement"},
                "opensearch": {"status": "connected", "index": "customer_engagement-*"},
                "openappsec": {"status": "connected", "policy": "customer_engagement-protection"},
                "apisix": {"status": "connected", "upstream": "customer_engagement"},
                "tigerbeetle": {"status": "connected", "cluster": "54link-dev-ledger"},
                "lakehouse": {"status": "connected", "table": "customer_engagement_iceberg"}
            },
    }

# --- In-App Messaging ---

@app.get("/v1/engagement/messages", dependencies=[Depends(require_permify("customer_profile", "view"))])
def list_messages(customer_id: str = ""):
    filtered = _w12_all_by_or_503(MSG_STORE, "customer_id", customer_id) if customer_id else _w12_all(MSG_STORE)
    return {"items": filtered, "total": len(filtered)}

@app.post("/v1/engagement/messages", status_code=201, dependencies=[Depends(require_permify("customer_profile", "create"))])
def send_message(req: InAppMessage):
    req.id = f"MSG-{uuid.uuid4().hex[:8]}"
    req.sent_at = datetime.utcnow().isoformat()
    _w12_put(MSG_STORE, req.id, req.model_dump())
    return req

@app.post("/v1/engagement/messages/bulk", status_code=201, dependencies=[Depends(require_permify("customer_profile", "create"))])
def bulk_message(body: dict):
    """Send message to a customer segment"""
    segment = body.get("segment", "mass_market")
    title = body.get("title", "")
    msg_body = body.get("body", "")
    customer_ids = body.get("customerIds", [])

    created = []
    for cid in customer_ids:
        msg = InAppMessage(
            id=f"MSG-{uuid.uuid4().hex[:8]}",
            customer_id=cid, title=title, body=msg_body,
            segment=segment, sent_at=datetime.utcnow().isoformat(),
        )
        _w12_put(MSG_STORE, msg.id, msg.model_dump())
        created.append(msg)
    return {"sent": len(created), "messages": created}

# --- Product Recommendations ---

@app.get("/v1/engagement/recommendations/{customer_id}", dependencies=[Depends(require_permify("customer_profile", "view"))])
def get_recommendations(customer_id: str):
    # Generate recommendations based on customer profile
    possible = [
        ("savings", "Target Savings Account", "Based on spending pattern, save ₦50K/month toward goals", 0.92),
        ("loan", "Personal Loan", "Pre-approved for up to ₦2M based on salary history", 0.87),
        ("card", "Premium Credit Card", "Upgrade to earn 2% cashback on all purchases", 0.78),
        ("insurance", "Life Insurance", "Protect your family with coverage from ₦500/month", 0.71),
        ("investment", "Treasury Bills", "Earn 18.5% p.a. on government-backed securities", 0.85),
        ("savings", "Fixed Deposit", "Lock ₦500K for 90 days at 14.5% p.a.", 0.83),
        ("loan", "Mortgage", "Property ownership financing from 12.5% p.a.", 0.65),
    ]

    recs = []
    for ptype, pname, reason, score in possible[:5]:
        rec = ProductRecommendation(
            id=f"REC-{uuid.uuid4().hex[:8]}",
            customer_id=customer_id,
            product_type=ptype, product_name=pname,
            score=score, reason=reason,
            expected_revenue=random.uniform(50000, 500000),
            created_at=datetime.utcnow().isoformat(),
        )
        recs.append(rec)
        _w12_put(REC_STORE, rec.id, rec.model_dump())

    return sorted(recs, key=lambda r: r.score, reverse=True)

# --- Customer 360 View ---

@app.get("/v1/engagement/customer360/{customer_id}", dependencies=[Depends(require_permify("customer_profile", "view"))])
def customer_360(customer_id: str):
    return Customer360(
        customer_id=customer_id,
        name="Customer " + customer_id,
        segment="premium" if hash(customer_id) % 3 == 0 else "mass_market",
        relationship_age_days=random.randint(30, 3650),
        total_deposits=random.uniform(100000, 50000000),
        total_loans=random.uniform(0, 20000000),
        active_products=["current_account", "savings", "debit_card", "mobile_banking"],
        total_transactions_30d=random.randint(5, 200),
        avg_monthly_balance=random.uniform(50000, 5000000),
        nps_score=random.randint(1, 10),
        risk_rating=random.choice(["low", "medium", "low", "low"]),
        lifetime_value=random.uniform(100000, 10000000),
        next_best_offer="Target Savings Account",
        engagement_score=random.uniform(0.3, 0.95),
    )

# --- NPS/CSAT Surveys ---

@app.get("/v1/engagement/surveys", dependencies=[Depends(require_permify("customer_profile", "view"))])
def list_surveys():
    return {"items": surveys, "total": len(surveys)}

@app.post("/v1/engagement/surveys", status_code=201, dependencies=[Depends(require_permify("customer_profile", "create"))])
def submit_survey(req: SurveyResponse):
    valid_types = {"nps": (0, 10), "csat": (1, 5), "ces": (1, 7)}
    if req.survey_type not in valid_types:
        raise HTTPException(400, f"survey_type must be one of {list(valid_types.keys())}")
    min_score, max_score = valid_types[req.survey_type]
    if req.score < min_score or req.score > max_score:
        raise HTTPException(400, f"{req.survey_type} score must be {min_score}-{max_score}")

    req.id = f"SRV-{uuid.uuid4().hex[:8]}"
    req.created_at = datetime.utcnow().isoformat()
    _w12_put(SURVEY_STORE, req.id, req.model_dump())
    return req

@app.get("/v1/engagement/surveys/analytics", dependencies=[Depends(require_permify("customer_profile", "view"))])
def survey_analytics():
    surveys = [SurveyResponse(**r) for r in _w12_all(SURVEY_STORE)]
    nps_scores = [s.score for s in surveys if s.survey_type == "nps"]
    csat_scores = [s.score for s in surveys if s.survey_type == "csat"]

    nps = 0
    if nps_scores:
        promoters = sum(1 for s in nps_scores if s >= 9) / len(nps_scores) * 100
        detractors = sum(1 for s in nps_scores if s <= 6) / len(nps_scores) * 100
        nps = round(promoters - detractors, 1)

    return {
        "nps": {"score": nps, "responses": len(nps_scores)},
        "csat": {"average": round(sum(csat_scores) / max(len(csat_scores), 1), 2), "responses": len(csat_scores)},
        "total_responses": len(surveys),
    }

# --- Referral Program ---

@app.get("/v1/engagement/referrals", dependencies=[Depends(require_permify("customer_profile", "view"))])
def list_referrals():
    referrals = _w12_all(REF_STORE)
    return {"items": referrals, "total": len(referrals)}

@app.post("/v1/engagement/referrals", status_code=201, dependencies=[Depends(require_permify("customer_profile", "create"))])
def create_referral(req: Referral):
    # Check for duplicate referrals (PG-backed)
    for r in [Referral(**x) for x in _w12_all(REF_STORE)]:
        if r.referee_phone == req.referee_phone:
            raise HTTPException(400, "This phone number has already been referred")

    req.id = f"REF-{uuid.uuid4().hex[:8]}"
    req.status = "pending"
    req.reward_amount = 2000  # ₦2,000 referral bonus
    req.created_at = datetime.utcnow().isoformat()
    _w12_put(REF_STORE, req.id, req.model_dump())
    return req

@app.post("/v1/engagement/referrals/{referral_id}/convert", dependencies=[Depends(require_permify("customer_profile", "manage"))])
def convert_referral(referral_id: str, body: dict):
    try:
        row = REF_STORE.get(referral_id)
    except Exception as e:
        raise HTTPException(503, f"persistence_unavailable: {e}")
    if not row:
        raise HTTPException(404, "Referral not found")
    row["status"] = "converted"
    row["product_opened"] = body.get("product", "current_account")
    row["reward_amount"] = 2000
    _w12_put(REF_STORE, referral_id, row)
    return row

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8111))
    uvicorn.run("service:app", host="0.0.0.0", port=port, workers=int(os.environ.get("UVICORN_WORKERS", "4")))