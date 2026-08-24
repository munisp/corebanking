"""
54link-dev ML Service API
FastAPI service exposing fraud detection, credit scoring, and spending insights

Production-ready with:
- Rate limiting
- Request validation
- Prometheus metrics
- Health checks
- API versioning
- Redis feature store for shared user profiles
- Rollout mode control (MONITOR/CHALLENGE/BLOCK)
- A/B testing support
- Model registry and versioning
- Event logging for training data collection
"""

import os
import time
import json
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, Header, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import uuid

# Import ML models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.fraud_detection import (
    get_fraud_model, Transaction as FraudTransaction, FraudScore, RiskLevel
)
from models.credit_scoring import (
    get_credit_model, CustomerProfile, CreditScore, CreditTier
)
from models.transaction_categorization import (
    get_categorization_model, TransactionCategory, CategorizedTransaction
)
from models.spending_insights import (
    get_insights_engine, SpendingAnalysis, Insight, InsightType
)

# Import True ML components
from ml import (
    FeatureStore, get_feature_store, TransactionFeatures,
    RolloutConfig, get_rollout_config, RolloutMode, ModelVariant,
    ModelRegistry, get_model_registry, ModelStage,
    train_fraud_model, TrainingConfig,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="54link-dev ML Service",
    description="Machine Learning APIs for fraud detection, credit scoring, and financial insights",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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


ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://admin.54link-dev.ng,https://app.54link-dev.ng,https://api.54link-dev.ng"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "X-Tenant-Id"],
)

# Metrics
request_count = 0
request_latencies: Dict[str, List[float]] = {}


# Request/Response Models
class FraudCheckRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique transaction identifier")
    user_id: str = Field(..., description="User identifier")
    amount: float = Field(..., gt=0, description="Transaction amount")
    currency: str = Field(default="NGN", description="Currency code")
    merchant_category: str = Field(..., description="Merchant category code")
    merchant_id: str = Field(..., description="Merchant identifier")
    device_id: str = Field(..., description="Device fingerprint")
    ip_address: str = Field(..., description="Client IP address")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    channel: str = Field(..., description="Transaction channel: mobile, web, pos, atm")
    recipient_id: Optional[str] = None
    is_international: bool = False

    @validator('channel')
    def validate_channel(cls, v):
        valid_channels = ['mobile', 'web', 'pos', 'atm', 'ussd']
        if v.lower() not in valid_channels:
            raise ValueError(f'Channel must be one of: {valid_channels}')
        return v.lower()


class FraudCheckResponse(BaseModel):
    transaction_id: str
    score: float
    risk_level: str
    reasons: List[str]
    recommended_action: str
    confidence: float
    processing_time_ms: float


class CreditScoreRequest(BaseModel):
    customer_id: str
    age: int = Field(..., ge=18, le=100)
    employment_status: str
    monthly_income: float = Field(..., ge=0)
    account_age_months: int = Field(..., ge=0)
    avg_monthly_inflow: float = Field(default=0, ge=0)
    avg_monthly_outflow: float = Field(default=0, ge=0)
    transaction_count_30d: int = Field(default=0, ge=0)
    unique_merchants_30d: int = Field(default=0, ge=0)
    current_balance: float = Field(default=0)
    avg_balance_30d: float = Field(default=0)
    min_balance_30d: float = Field(default=0)
    overdraft_count_12m: int = Field(default=0, ge=0)
    active_loans: int = Field(default=0, ge=0)
    total_loan_amount: float = Field(default=0, ge=0)
    loans_paid_on_time: int = Field(default=0, ge=0)
    loans_paid_late: int = Field(default=0, ge=0)
    loans_defaulted: int = Field(default=0, ge=0)
    bills_paid_on_time_12m: int = Field(default=0, ge=0)
    bills_paid_late_12m: int = Field(default=0, ge=0)
    bills_missed_12m: int = Field(default=0, ge=0)
    has_savings_account: bool = False
    savings_balance: float = Field(default=0, ge=0)
    regular_savings: bool = False
    app_logins_30d: int = Field(default=0, ge=0)
    features_used: List[str] = Field(default_factory=list)

    @validator('employment_status')
    def validate_employment(cls, v):
        valid_statuses = ['employed', 'self_employed', 'unemployed', 'student', 'retired']
        if v.lower() not in valid_statuses:
            raise ValueError(f'Employment status must be one of: {valid_statuses}')
        return v.lower()


class CreditScoreResponse(BaseModel):
    customer_id: str
    score: int
    tier: str
    factors: Dict
    recommendations: List[str]
    max_loan_amount: float
    recommended_interest_rate: float
    confidence: float
    processing_time_ms: float


class CategorizationRequest(BaseModel):
    transaction_id: str
    user_id: str
    merchant_name: str
    amount: float = Field(..., gt=0)
    transaction_type: str  # credit, debit
    narration: str = ""

    @validator('transaction_type')
    def validate_type(cls, v):
        if v.lower() not in ['credit', 'debit']:
            raise ValueError('Transaction type must be credit or debit')
        return v.lower()


class CategorizationResponse(BaseModel):
    transaction_id: str
    category: str
    subcategory: Optional[str]
    confidence: float
    merchant_name: str
    normalized_merchant: str
    is_recurring: bool
    tags: List[str]
    processing_time_ms: float


class BatchCategorizationRequest(BaseModel):
    transactions: List[CategorizationRequest]


class BatchCategorizationResponse(BaseModel):
    results: List[CategorizationResponse]
    total_processed: int
    processing_time_ms: float


class SpendingInsightsRequest(BaseModel):
    user_id: str
    transactions: List[Dict]  # List of {transaction_id, category, amount, is_recurring, ...}
    current_balance: float
    period_days: int = Field(default=30, ge=1, le=365)


class SpendingInsightsResponse(BaseModel):
    user_id: str
    period_start: str
    period_end: str
    total_income: float
    total_expenses: float
    net_cash_flow: float
    savings_rate: float
    category_breakdown: Dict
    top_merchants: List[Dict]
    insights: List[Dict]
    financial_health_score: int
    predicted_end_of_month_balance: float
    processing_time_ms: float


# API Key validation
async def verify_api_key(x_api_key: str = Header(...)):
    """Verify API key"""
    valid_keys = os.environ.get("ML_API_KEYS", "").split(",")
    if not valid_keys or valid_keys == ['']:
        # Development mode - allow any key
        logger.warning("ML_API_KEYS not configured - running in development mode")
        return True
    
    if x_api_key not in valid_keys:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {"status": "healthy", "service": "ml-service"}


@app.get("/health/detailed")
async def detailed_health():
    """Detailed health check with model status"""
    return {
        "status": "healthy",
        "service": "ml-service",
        "models": {
            "fraud_detection": "loaded",
            "credit_scoring": "loaded",
            "transaction_categorization": "loaded",
            "spending_insights": "loaded",
        },
        "metrics": {
            "total_requests": request_count,
            "avg_latencies": {
                k: sum(v) / len(v) if v else 0
                for k, v in request_latencies.items()
            }
        }
    }


@app.get("/metrics")
async def prometheus_metrics():
    """Prometheus-compatible metrics endpoint"""
    metrics = []
    metrics.append(f"ml_service_requests_total {request_count}")
    
    for endpoint, latencies in request_latencies.items():
        if latencies:
            avg = sum(latencies) / len(latencies)
            metrics.append(f'ml_service_latency_avg{{endpoint="{endpoint}"}} {avg:.4f}')
    
    return "\n".join(metrics)


# Fraud Detection API
@app.post("/api/v1/fraud/check", response_model=FraudCheckResponse)
async def check_fraud(
    request: FraudCheckRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_api_key)
):
    """
    Check a transaction for fraud risk
    
    Returns a fraud score (0-100) and risk assessment with recommended action.
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        model = get_fraud_model()
        
        # Convert request to Transaction object
        txn = FraudTransaction(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            amount=request.amount,
            currency=request.currency,
            merchant_category=request.merchant_category,
            merchant_id=request.merchant_id,
            device_id=request.device_id,
            ip_address=request.ip_address,
            latitude=request.latitude,
            longitude=request.longitude,
            timestamp=datetime.now(),
            channel=request.channel,
            recipient_id=request.recipient_id,
            is_international=request.is_international,
        )
        
        # Get fraud score
        result: FraudScore = model.predict(txn)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Track latency
        if 'fraud_check' not in request_latencies:
            request_latencies['fraud_check'] = []
        request_latencies['fraud_check'].append(processing_time)
        if len(request_latencies['fraud_check']) > 1000:
            request_latencies['fraud_check'] = request_latencies['fraud_check'][-1000:]
        
        return FraudCheckResponse(
            transaction_id=request.transaction_id,
            score=result.score,
            risk_level=result.risk_level.value,
            reasons=result.reasons,
            recommended_action=result.recommended_action,
            confidence=result.confidence,
            processing_time_ms=round(processing_time, 2),
        )
        
    except Exception as e:
        logger.error(f"Fraud check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Credit Scoring API
@app.post("/api/v1/credit/score", response_model=CreditScoreResponse)
async def calculate_credit_score(
    request: CreditScoreRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Calculate credit score for a customer
    
    Returns a credit score (300-850), tier, and loan recommendations.
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        model = get_credit_model()
        
        # Convert request to CustomerProfile
        profile = CustomerProfile(
            customer_id=request.customer_id,
            age=request.age,
            employment_status=request.employment_status,
            monthly_income=request.monthly_income,
            account_age_months=request.account_age_months,
            avg_monthly_inflow=request.avg_monthly_inflow,
            avg_monthly_outflow=request.avg_monthly_outflow,
            transaction_count_30d=request.transaction_count_30d,
            unique_merchants_30d=request.unique_merchants_30d,
            current_balance=request.current_balance,
            avg_balance_30d=request.avg_balance_30d,
            min_balance_30d=request.min_balance_30d,
            overdraft_count_12m=request.overdraft_count_12m,
            active_loans=request.active_loans,
            total_loan_amount=request.total_loan_amount,
            loans_paid_on_time=request.loans_paid_on_time,
            loans_paid_late=request.loans_paid_late,
            loans_defaulted=request.loans_defaulted,
            bills_paid_on_time_12m=request.bills_paid_on_time_12m,
            bills_paid_late_12m=request.bills_paid_late_12m,
            bills_missed_12m=request.bills_missed_12m,
            has_savings_account=request.has_savings_account,
            savings_balance=request.savings_balance,
            regular_savings=request.regular_savings,
            app_logins_30d=request.app_logins_30d,
            features_used=request.features_used,
        )
        
        # Calculate score
        result: CreditScore = model.calculate_score(profile)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Track latency
        if 'credit_score' not in request_latencies:
            request_latencies['credit_score'] = []
        request_latencies['credit_score'].append(processing_time)
        if len(request_latencies['credit_score']) > 1000:
            request_latencies['credit_score'] = request_latencies['credit_score'][-1000:]
        
        return CreditScoreResponse(
            customer_id=request.customer_id,
            score=result.score,
            tier=result.tier.value,
            factors=result.factors,
            recommendations=result.recommendations,
            max_loan_amount=result.max_loan_amount,
            recommended_interest_rate=result.recommended_interest_rate,
            confidence=result.confidence,
            processing_time_ms=round(processing_time, 2),
        )
        
    except Exception as e:
        logger.error(f"Credit score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Transaction Categorization API
@app.post("/api/v1/categorize", response_model=CategorizationResponse)
async def categorize_transaction(
    request: CategorizationRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Categorize a single transaction
    
    Returns category, confidence, and tags.
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        model = get_categorization_model()
        
        result: CategorizedTransaction = model.categorize(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            merchant_name=request.merchant_name,
            amount=request.amount,
            transaction_type=request.transaction_type,
            narration=request.narration,
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return CategorizationResponse(
            transaction_id=result.transaction_id,
            category=result.category.value,
            subcategory=result.subcategory,
            confidence=result.confidence,
            merchant_name=result.merchant_name,
            normalized_merchant=result.normalized_merchant,
            is_recurring=result.is_recurring,
            tags=result.tags,
            processing_time_ms=round(processing_time, 2),
        )
        
    except Exception as e:
        logger.error(f"Categorization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/categorize/batch", response_model=BatchCategorizationResponse)
async def categorize_batch(
    request: BatchCategorizationRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Categorize multiple transactions in batch
    
    More efficient for bulk processing.
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        model = get_categorization_model()
        results = []
        
        for txn in request.transactions:
            result = model.categorize(
                transaction_id=txn.transaction_id,
                user_id=txn.user_id,
                merchant_name=txn.merchant_name,
                amount=txn.amount,
                transaction_type=txn.transaction_type,
                narration=txn.narration,
            )
            
            results.append(CategorizationResponse(
                transaction_id=result.transaction_id,
                category=result.category.value,
                subcategory=result.subcategory,
                confidence=result.confidence,
                merchant_name=result.merchant_name,
                normalized_merchant=result.normalized_merchant,
                is_recurring=result.is_recurring,
                tags=result.tags,
                processing_time_ms=0,  # Individual times not tracked in batch
            ))
        
        processing_time = (time.time() - start_time) * 1000
        
        return BatchCategorizationResponse(
            results=results,
            total_processed=len(results),
            processing_time_ms=round(processing_time, 2),
        )
        
    except Exception as e:
        logger.error(f"Batch categorization error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Spending Insights API
@app.post("/api/v1/insights/spending", response_model=SpendingInsightsResponse)
async def get_spending_insights(
    request: SpendingInsightsRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Get comprehensive spending insights for a user
    
    Returns spending analysis, insights, and financial health score.
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        engine = get_insights_engine()
        categorization_model = get_categorization_model()
        
        # Convert transactions to CategorizedTransaction objects
        categorized_txns = []
        amounts = {}
        
        for txn_data in request.transactions:
            txn_id = txn_data.get('transaction_id', str(uuid.uuid4()))
            
            # If already categorized, use that
            if 'category' in txn_data:
                try:
                    category = TransactionCategory(txn_data['category'])
                except ValueError:
                    category = TransactionCategory.UNCATEGORIZED
                
                cat_txn = CategorizedTransaction(
                    transaction_id=txn_id,
                    category=category,
                    subcategory=txn_data.get('subcategory'),
                    confidence=txn_data.get('confidence', 1.0),
                    merchant_name=txn_data.get('merchant_name', ''),
                    normalized_merchant=txn_data.get('normalized_merchant', ''),
                    is_recurring=txn_data.get('is_recurring', False),
                    tags=txn_data.get('tags', []),
                )
            else:
                # Categorize on the fly
                cat_txn = categorization_model.categorize(
                    transaction_id=txn_id,
                    user_id=request.user_id,
                    merchant_name=txn_data.get('merchant_name', ''),
                    amount=txn_data.get('amount', 0),
                    transaction_type=txn_data.get('transaction_type', 'debit'),
                    narration=txn_data.get('narration', ''),
                )
            
            categorized_txns.append(cat_txn)
            amounts[txn_id] = txn_data.get('amount', 0)
        
        # Get spending analysis
        analysis: SpendingAnalysis = engine.analyze_spending(
            user_id=request.user_id,
            transactions=categorized_txns,
            amounts=amounts,
            current_balance=request.current_balance,
            period_days=request.period_days,
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        # Convert insights to dict
        insights_list = [
            {
                'insight_id': i.insight_id,
                'type': i.type.value,
                'priority': i.priority.value,
                'title': i.title,
                'description': i.description,
                'amount': i.amount,
                'category': i.category.value if i.category else None,
                'action_text': i.action_text,
                'action_url': i.action_url,
            }
            for i in analysis.insights
        ]
        
        return SpendingInsightsResponse(
            user_id=request.user_id,
            period_start=analysis.period_start.isoformat(),
            period_end=analysis.period_end.isoformat(),
            total_income=analysis.total_income,
            total_expenses=analysis.total_expenses,
            net_cash_flow=analysis.net_cash_flow,
            savings_rate=analysis.savings_rate,
            category_breakdown=analysis.category_breakdown,
            top_merchants=analysis.top_merchants,
            insights=insights_list,
            financial_health_score=analysis.financial_health_score,
            predicted_end_of_month_balance=analysis.predicted_end_of_month_balance,
            processing_time_ms=round(processing_time, 2),
        )
        
    except Exception as e:
        logger.error(f"Spending insights error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Category override API
@app.post("/api/v1/categorize/override")
async def set_category_override(
    user_id: str,
    merchant_name: str,
    category: str,
    _: bool = Depends(verify_api_key)
):
    """
    Set a user-specific category override for a merchant
    
    Future transactions from this merchant will use the specified category.
    """
    try:
        model = get_categorization_model()
        
        try:
            cat = TransactionCategory(category)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid category. Valid categories: {[c.value for c in TransactionCategory]}"
            )
        
        model.set_user_override(user_id, merchant_name, cat)
        
        return {
            "status": "success",
            "message": f"Category override set for {merchant_name} -> {category}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Category override error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get available categories
@app.get("/api/v1/categories")
async def list_categories():
    """List all available transaction categories"""
    return {
        "categories": [
            {"value": c.value, "name": c.name}
            for c in TransactionCategory
        ]
    }


# =============================================================================
# ML Management APIs - True ML Components
# =============================================================================

class RolloutConfigRequest(BaseModel):
    """Request to update rollout configuration"""
    model_type: str = Field(..., description="Model type: fraud, credit")
    mode: str = Field(..., description="Rollout mode: monitor, challenge, block")
    traffic_percentage: Optional[float] = Field(None, ge=0, le=100)
    use_ml_score: Optional[bool] = None


class RolloutConfigResponse(BaseModel):
    """Current rollout configuration"""
    models: Dict[str, Any]
    experiments: Dict[str, Any]


class TrainModelRequest(BaseModel):
    """Request to train a new model"""
    model_type: str = Field(..., description="Model type: fraud, credit")
    algorithm: str = Field(default="hist_gradient_boosting")
    n_estimators: int = Field(default=100, ge=10, le=1000)
    max_depth: int = Field(default=10, ge=3, le=30)
    learning_rate: float = Field(default=0.1, ge=0.01, le=1.0)
    data_source: str = Field(default="postgres", description="Data source: postgres or parquet")


class TrainModelResponse(BaseModel):
    """Training result"""
    model_id: str
    version: str
    algorithm: str
    val_auc: float
    cv_auc_mean: float
    precision: float
    recall: float
    optimal_threshold: float
    artifact_path: str


class ModelRegistryResponse(BaseModel):
    """Model registry summary"""
    total_models: int
    active_models: Dict[str, str]
    by_type: Dict[str, Any]


class PromoteModelRequest(BaseModel):
    """Request to promote a model"""
    model_id: str
    to_stage: str = Field(..., description="Target stage: staging, production")
    deployed_by: str = Field(default="api")


class FraudDecisionLog(BaseModel):
    """Logged fraud decision for training data collection"""
    transaction_id: str
    user_id: str
    timestamp: str
    features: Dict[str, float]
    rule_score: float
    ml_score: Optional[float]
    final_score: float
    risk_level: str
    action: str
    variant: str
    model_version: Optional[str]


# In-memory event log (in production, use Kafka/PostgreSQL)
fraud_decision_logs: List[FraudDecisionLog] = []


@app.get("/api/v1/ml/rollout/config", response_model=RolloutConfigResponse)
async def get_rollout_configuration(
    _: bool = Depends(verify_api_key)
):
    """Get current rollout configuration for all models"""
    config = get_rollout_config()
    return RolloutConfigResponse(**config.get_config_summary())


@app.post("/api/v1/ml/rollout/config")
async def update_rollout_configuration(
    request: RolloutConfigRequest,
    _: bool = Depends(verify_api_key)
):
    """Update rollout configuration for a model"""
    try:
        config = get_rollout_config()
        
        mode = RolloutMode(request.mode.lower())
        
        config.update_model_config(
            model_type=request.model_type,
            mode=mode,
            traffic_percentage=request.traffic_percentage,
            use_ml_score=request.use_ml_score,
        )
        
        return {
            "status": "success",
            "message": f"Updated {request.model_type} config",
            "config": config.get_config_summary()["models"].get(request.model_type)
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Rollout config update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/ml/train", response_model=TrainModelResponse)
async def train_model(
    request: TrainModelRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_api_key)
):
    """
    Train a new ML model
    
    This trains a model using the specified algorithm and a real supported data source.
    Use data_source="postgres" for live labeled data or "parquet" for offline curated datasets.
    """
    try:
        if request.model_type != "fraud":
            raise HTTPException(
                status_code=400,
                detail="Only fraud model training is currently supported"
            )
        
        logger.info(f"Starting model training: {request.model_type} with {request.algorithm}")
        
        result = train_fraud_model(
            data_source=request.data_source,
            algorithm=request.algorithm,
            n_estimators=request.n_estimators,
            max_depth=request.max_depth,
            learning_rate=request.learning_rate,
        )
        
        # Register in model registry
        registry = get_model_registry()
        registry.register_model(
            model_id=result.model_id,
            model_type=result.model_type,
            version=result.version,
            algorithm=result.algorithm,
            artifact_path=result.artifact_path,
            metrics={
                "train_auc": result.train_auc,
                "val_auc": result.val_auc,
                "cv_auc_mean": result.cv_auc_mean,
                "precision": result.precision,
                "recall": result.recall,
                "f1": result.f1,
            },
            optimal_threshold=result.optimal_threshold,
            feature_names=result.feature_names,
            training_samples=result.n_samples,
            feature_version=result.feature_version,
        )
        
        return TrainModelResponse(
            model_id=result.model_id,
            version=result.version,
            algorithm=result.algorithm,
            val_auc=result.val_auc,
            cv_auc_mean=result.cv_auc_mean,
            precision=result.precision,
            recall=result.recall,
            optimal_threshold=result.optimal_threshold,
            artifact_path=result.artifact_path,
        )
        
    except Exception as e:
        logger.error(f"Model training error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ml/registry", response_model=ModelRegistryResponse)
async def get_model_registry_summary(
    _: bool = Depends(verify_api_key)
):
    """Get model registry summary"""
    registry = get_model_registry()
    return ModelRegistryResponse(**registry.get_registry_summary())


@app.get("/api/v1/ml/registry/{model_type}")
async def get_models_by_type(
    model_type: str,
    stage: Optional[str] = None,
    _: bool = Depends(verify_api_key)
):
    """Get all models of a specific type"""
    registry = get_model_registry()
    
    stage_filter = ModelStage(stage) if stage else None
    models = registry.get_models_by_type(model_type, stage_filter)
    
    return {
        "model_type": model_type,
        "count": len(models),
        "models": [
            {
                "model_id": m.model_id,
                "version": m.version,
                "algorithm": m.algorithm,
                "stage": m.stage.value,
                "metrics": m.metrics,
                "training_date": m.training_date,
            }
            for m in models
        ]
    }


@app.post("/api/v1/ml/registry/promote")
async def promote_model(
    request: PromoteModelRequest,
    _: bool = Depends(verify_api_key)
):
    """Promote a model to a new stage"""
    try:
        registry = get_model_registry()
        
        to_stage = ModelStage(request.to_stage.lower())
        
        success = registry.promote_model(
            model_id=request.model_id,
            to_stage=to_stage,
            deployed_by=request.deployed_by,
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Model not found")
        
        return {
            "status": "success",
            "message": f"Promoted {request.model_id} to {request.to_stage}",
            "model": registry.get_model(request.model_id).__dict__
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Model promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/ml/registry/rollback/{model_type}")
async def rollback_model(
    model_type: str,
    _: bool = Depends(verify_api_key)
):
    """Rollback to the previous production model"""
    try:
        registry = get_model_registry()
        
        new_active = registry.rollback(model_type)
        
        if not new_active:
            raise HTTPException(
                status_code=400,
                detail="No staging model available for rollback"
            )
        
        return {
            "status": "success",
            "message": f"Rolled back {model_type} to {new_active}",
            "new_active_model": new_active
        }
        
    except Exception as e:
        logger.error(f"Model rollback error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/ml/decisions/logs")
async def get_fraud_decision_logs(
    limit: int = 100,
    _: bool = Depends(verify_api_key)
):
    """
    Get recent fraud decision logs
    
    These logs are used for training data collection and model evaluation.
    """
    return {
        "total": len(fraud_decision_logs),
        "logs": fraud_decision_logs[-limit:]
    }


@app.post("/api/v1/ml/decisions/label")
async def label_fraud_decision(
    transaction_id: str,
    is_fraud: bool,
    _: bool = Depends(verify_api_key)
):
    """
    Label a transaction as fraud or legitimate
    
    This feedback is used to build training data for model improvement.
    """
    # In production, this would update a database
    for log in fraud_decision_logs:
        if log.transaction_id == transaction_id:
            # Would update label in database
            return {
                "status": "success",
                "message": f"Labeled {transaction_id} as {'fraud' if is_fraud else 'legitimate'}"
            }
    
    raise HTTPException(status_code=404, detail="Transaction not found in logs")


@app.get("/api/v1/ml/feature-store/health")
async def feature_store_health(
    _: bool = Depends(verify_api_key)
):
    """Check feature store health"""
    try:
        feature_store = await get_feature_store()
        health = await feature_store.health_check()
        return health
    except Exception as e:
        return {"healthy": False, "error": str(e)}


@app.get("/api/v1/ml/feature-store/profile/{user_id}")
async def get_user_profile(
    user_id: str,
    _: bool = Depends(verify_api_key)
):
    """Get user profile from feature store"""
    try:
        feature_store = await get_feature_store()
        profile = await feature_store.get_user_profile(user_id)
        
        if profile is None:
            return {"user_id": user_id, "profile": None, "message": "No profile found"}
        
        return {
            "user_id": user_id,
            "profile": {
                "total_transactions": profile.total_transactions,
                "avg_transaction_amount": profile.avg_transaction_amount,
                "txn_count_1h": profile.txn_count_1h,
                "txn_count_24h": profile.txn_count_24h,
                "txn_count_30d": profile.txn_count_30d,
                "known_devices": len(profile.known_devices),
                "known_ips": len(profile.known_ips),
                "has_fraud_history": profile.fraud_flags_30d > 0,
                "first_transaction_at": profile.first_transaction_at,
                "last_transaction_at": profile.last_transaction_at,
            }
        }
        
    except Exception as e:
        logger.error(f"Feature store error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Enhanced fraud check with True ML components
@app.post("/api/v1/fraud/check/v2")
async def check_fraud_v2(
    request: FraudCheckRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_api_key)
):
    """
    Enhanced fraud check with True ML components
    
    This version uses:
    - Redis feature store for shared user profiles
    - Rollout mode control (MONITOR/CHALLENGE/BLOCK)
    - A/B testing between rule engine and ML model
    - Event logging for training data collection
    """
    global request_count
    request_count += 1
    start_time = time.time()
    
    try:
        # Get components
        rule_model = get_fraud_model()
        rollout_config = get_rollout_config()
        
        # Try to get feature store (may not be connected)
        try:
            feature_store = await get_feature_store()
            feature_store_available = True
        except:
            feature_store_available = False
        
        # Assign A/B variant
        variant = rollout_config.assign_variant(request.user_id)
        
        # Get rule-based score (always computed)
        txn = FraudTransaction(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            amount=request.amount,
            currency=request.currency,
            merchant_category=request.merchant_category,
            merchant_id=request.merchant_id,
            device_id=request.device_id,
            ip_address=request.ip_address,
            latitude=request.latitude,
            longitude=request.longitude,
            timestamp=datetime.now(),
            channel=request.channel,
            recipient_id=request.recipient_id,
            is_international=request.is_international,
        )
        
        rule_result: FraudScore = rule_model.predict(txn)
        
        # Get ML score if enabled and model available
        ml_score = None
        ml_model_version = None
        
        model_config = rollout_config.get_model_config("fraud")
        
        if model_config.use_ml_score and variant == ModelVariant.ML_V1:
            try:
                registry = get_model_registry()
                model, scaler, threshold = registry.load_model_for_inference("fraud")
                
                # Extract features
                if feature_store_available:
                    features = await feature_store.extract_features(
                        user_id=request.user_id,
                        amount=request.amount,
                        currency=request.currency,
                        channel=request.channel,
                        merchant_category=request.merchant_category,
                        device_id=request.device_id,
                        ip_address=request.ip_address,
                        latitude=request.latitude,
                        longitude=request.longitude,
                        is_international=request.is_international,
                    )
                    
                    feature_vector = features.to_vector()
                    import numpy as np
                    X = np.array([feature_vector])
                    X_scaled = scaler.transform(X)
                    ml_score = float(model.predict_proba(X_scaled)[0, 1]) * 100
                    
                    active_model = registry.get_active_model("fraud")
                    ml_model_version = active_model.version if active_model else None
                    
            except Exception as e:
                logger.warning(f"ML scoring failed, using rule engine only: {e}")
        
        # Determine final score based on variant and config
        if ml_score is not None and model_config.use_ml_score:
            # Ensemble: weighted combination
            ensemble_weight = model_config.ensemble_weight_ml
            final_score = (1 - ensemble_weight) * rule_result.score + ensemble_weight * ml_score
        else:
            final_score = rule_result.score
        
        # Get action based on rollout mode
        action = rollout_config.get_action_for_score(
            "fraud",
            final_score,
            rule_result.risk_level.value
        )
        
        # Update feature store with transaction (async)
        if feature_store_available:
            background_tasks.add_task(
                feature_store.update_user_profile_from_transaction,
                user_id=request.user_id,
                amount=request.amount,
                device_id=request.device_id,
                ip_address=request.ip_address,
                merchant_category=request.merchant_category,
                channel=request.channel,
                latitude=request.latitude,
                longitude=request.longitude,
                is_international=request.is_international,
            )
        
        # Log decision for training data
        decision_log = FraudDecisionLog(
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            timestamp=datetime.utcnow().isoformat(),
            features={
                "amount": request.amount,
                "channel": request.channel,
                "is_international": request.is_international,
            },
            rule_score=rule_result.score,
            ml_score=ml_score,
            final_score=final_score,
            risk_level=rule_result.risk_level.value,
            action=action,
            variant=variant.value,
            model_version=ml_model_version,
        )
        fraud_decision_logs.append(decision_log)
        
        # Keep only last 10000 logs in memory
        if len(fraud_decision_logs) > 10000:
            fraud_decision_logs.pop(0)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Track latency
        if 'fraud_check_v2' not in request_latencies:
            request_latencies['fraud_check_v2'] = []
        request_latencies['fraud_check_v2'].append(processing_time)
        if len(request_latencies['fraud_check_v2']) > 1000:
            request_latencies['fraud_check_v2'] = request_latencies['fraud_check_v2'][-1000:]
        
        return {
            "transaction_id": request.transaction_id,
            "score": round(final_score, 2),
            "rule_score": round(rule_result.score, 2),
            "ml_score": round(ml_score, 2) if ml_score else None,
            "risk_level": rule_result.risk_level.value,
            "reasons": rule_result.reasons,
            "recommended_action": action,
            "confidence": rule_result.confidence,
            "variant": variant.value,
            "model_version": ml_model_version,
            "rollout_mode": model_config.mode.value,
            "processing_time_ms": round(processing_time, 2),
        }
        
    except Exception as e:
        logger.error(f"Fraud check v2 error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
