"""
54link-dev Customer Onboarding Service
Unified service for customer registration with automatic KYC/KYB verification
"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime
import asyncio
from enum import Enum
import logging
import os

app = FastAPI(
    title="54link-dev Customer Onboarding API",
    description="Unified customer registration with KYC/KYB verification",
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


logger = logging.getLogger("customer-onboarding")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())


def parse_allowed_origins() -> list[str]:
    configured = os.getenv("ALLOWED_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    defaults = [
        os.getenv("PUBLIC_WEB_BASE_URL", "https://app.54link-dev.internal"),
        os.getenv("PUBLIC_PWA_BASE_URL", "https://pwa.54link-dev.internal"),
        os.getenv("PUBLIC_ADMIN_BASE_URL", "https://admin.54link-dev.internal"),
        os.getenv("PUBLIC_AGRICULTURE_BASE_URL", "https://agri.54link-dev.internal"),
    ]
    return [origin for origin in defaults if origin]


app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-ID", "x-keycloak-id"],
)

# Configuration
KYC_SERVICE_URL = os.getenv("KYC_SERVICE_URL", "https://kyc.54link-dev.internal")
KYB_SERVICE_URL = os.getenv("KYB_SERVICE_URL", "https://kyb.54link-dev.internal")
TEMPORAL_ADDRESS = os.getenv("TEMPORAL_ADDRESS", "temporal-frontend.54link-dev.svc.cluster.local:7233")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
def _require_env(name):
    """Fail-fast required environment variable (finding R3-NEW-3).

    No credential-bearing or otherwise insecure defaults: refuse to start when
    the variable is unset or left as an unexpanded '${...}' placeholder."""
    val = os.environ.get(name, "").strip()
    if not val or val.startswith("${"):
        raise RuntimeError(
            f"FATAL: required environment variable {name} is not set; "
            "refusing to start with an insecure default"
        )
    return val


DATABASE_URL = _require_env("DATABASE_URL")

# Enums
class CustomerType(str, Enum):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"
    SME = "sme"
    GOVERNMENT = "government"

class AccountTier(str, Enum):
    TIER_1 = "tier_1"  # ₦300k daily limit
    TIER_2 = "tier_2"  # ₦5M daily limit
    TIER_3 = "tier_3"  # Unlimited
    VIP = "vip"        # Premium features

class VerificationStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    MANUAL_REVIEW = "manual_review"

# Request Models
class IndividualCustomerRequest(BaseModel):
    # Personal Information
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    date_of_birth: str = Field(..., description="YYYY-MM-DD format")
    gender: Literal["male", "female", "other"]
    
    # Contact Information
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+234[0-9]{10}$", description="Nigerian phone number")
    address: str = Field(..., min_length=10)
    city: str
    state: str
    
    # Identity Documents
    bvn: str = Field(..., pattern=r"^[0-9]{11}$", description="11-digit BVN")
    nin: Optional[str] = Field(None, pattern=r"^[0-9]{11}$", description="11-digit NIN")
    id_type: Literal["passport", "drivers_license", "national_id", "voters_card"]
    id_number: str
    
    # Account Preferences
    account_tier: AccountTier = AccountTier.TIER_1
    preferred_language: Literal["en", "yo", "ig", "ha"] = "en"
    
    # Marketing
    marketing_consent: bool = False

class CorporateCustomerRequest(BaseModel):
    # Company Information
    company_name: str = Field(..., min_length=2, max_length=200)
    company_type: Literal["limited_liability", "plc", "ngo", "partnership", "sole_proprietorship"]
    cac_number: str = Field(..., pattern=r"^RC[0-9]{6,}$", description="CAC registration number")
    tin: str = Field(..., pattern=r"^[0-9]{8}-[0-9]{4}$", description="Tax Identification Number")
    incorporation_date: str = Field(..., description="YYYY-MM-DD format")
    
    # Business Address
    business_address: str = Field(..., min_length=10)
    city: str
    state: str
    
    # Contact Information
    business_email: EmailStr
    business_phone: str = Field(..., pattern=r"^\+234[0-9]{10}$")
    website: Optional[str] = None
    
    # Primary Contact Person
    contact_person_name: str
    contact_person_email: EmailStr
    contact_person_phone: str = Field(..., pattern=r"^\+234[0-9]{10}$")
    contact_person_designation: str
    
    # Beneficial Owners (for KYB verification)
    beneficial_owners: list[dict] = Field(
        ..., 
        min_items=1,
        description="List of beneficial owners with >25% ownership"
    )
    
    # Business Details
    industry: str
    annual_revenue: Optional[float] = None
    employee_count: Optional[int] = None
    
    # Account Preferences
    account_tier: AccountTier = AccountTier.TIER_2
    
class OnboardingResponse(BaseModel):
    customer_id: str
    customer_type: CustomerType
    verification_status: VerificationStatus
    workflow_id: str
    estimated_completion: str
    message: str
    next_steps: list[str]

# Database Models (SQLAlchemy)
from sqlalchemy import create_engine, Column, String, DateTime, Enum as SQLEnum, JSON, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()

class Customer(Base):
    __tablename__ = "customers"
    
    customer_id = Column(String(50), primary_key=True)
    tenant_id = Column(String(50), index=True, nullable=False, default=os.getenv("TENANT_ID", "tenant-54link-dev-primary"))
    customer_type = Column(SQLEnum(CustomerType), nullable=False)
    verification_status = Column(SQLEnum(VerificationStatus), default=VerificationStatus.PENDING)
    workflow_id = Column(String(100), nullable=True)
    workflow_channel = Column(String(50), nullable=True)
    
    # Individual fields
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), nullable=False)
    bvn = Column(String(11), nullable=True)
    nin = Column(String(11), nullable=True)
    
    # Corporate fields
    company_name = Column(String(200), nullable=True)
    cac_number = Column(String(20), nullable=True)
    tin = Column(String(20), nullable=True)
    
    # Metadata
    account_tier = Column(SQLEnum(AccountTier), default=AccountTier.TIER_1)
    risk_score = Column(Float, nullable=True)
    fraud_score = Column(Float, nullable=True)
    kyc_data = Column(JSON, nullable=True)
    kyb_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    verified_at = Column(DateTime, nullable=True)

# Database setup
engine = None
SessionLocal = None

def seed_demo_data():
    db = SessionLocal()
    try:
        existing = db.query(Customer).count()
        if existing == 0:
            db.add(Customer(
                customer_id="CUST-SEED-001",
                tenant_id=os.getenv("TENANT_ID", "tenant-54link-dev-primary"),
                customer_type=CustomerType.INDIVIDUAL,
                verification_status=VerificationStatus.COMPLETED,
                workflow_id="seed-workflow",
                workflow_channel="seed",
                first_name="Demo",
                last_name="Customer",
                email="demo.customer@54link-dev.test",
                phone="+2348012345678",
                bvn="12345678901",
                nin="10987654321",
                account_tier=AccountTier.TIER_2,
                risk_score=18.0,
                fraud_score=4.0,
                kyc_data={"city": "Lagos", "state": "Lagos"},
                verified_at=datetime.utcnow(),
            ))
            db.commit()
    finally:
        db.close()


def init_db():
    global engine, SessionLocal
    if engine is None:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)
        seed_demo_data()

@app.on_event("startup")
def startup_event():
    init_db()

def get_db():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_security_context(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="x-keycloak-id"),
):
    require_auth = os.getenv("REQUIRE_AUTH_CONTEXT", "true").lower() == "true"
    if not require_auth:
        return {"authenticated": False, "principal": x_user_id or "anonymous"}

    has_bearer = bool(authorization and authorization.startswith("Bearer ") and len(authorization.split(" ", 1)[1].strip()) >= 16)
    has_trusted_user = bool(x_user_id and x_user_id.strip())
    if not (has_bearer or has_trusted_user):
        raise HTTPException(status_code=401, detail="Authentication context required")
    return {"authenticated": True, "principal": x_user_id or "bearer-token"}


def mask_value(value: Optional[str], visible_prefix: int = 2, visible_suffix: int = 2) -> Optional[str]:
    if value is None:
        return None
    if len(value) <= visible_prefix + visible_suffix:
        return "*" * len(value)
    return f"{value[:visible_prefix]}{'*' * (len(value) - visible_prefix - visible_suffix)}{value[-visible_suffix:]}"

# Kafka Producer
from kafka import KafkaProducer
import json

kafka_producer = None

def get_kafka_producer():
    global kafka_producer
    if kafka_producer is None:
        kafka_producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(','),
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            acks='all',
            retries=3
        )
    return kafka_producer

def publish_event(topic: str, event: dict):
    """Publish event to Kafka"""
    try:
        producer = get_kafka_producer()
        producer.send(topic, event)
        producer.flush()
    except Exception as e:
        print(f"Failed to publish event to {topic}: {e}")

# Temporal Client
from temporalio.client import Client as TemporalClient

async def get_temporal_client():
    """Get Temporal client"""
    return await TemporalClient.connect(TEMPORAL_ADDRESS)

# API Endpoints

async def _db_run(fn, *args, **kwargs):
    """Run a blocking sync SQLAlchemy call off the event loop (M-31)."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


@app.post("/api/v1/onboarding/individual", response_model=OnboardingResponse)
async def onboard_individual_customer(
    request: IndividualCustomerRequest,
    x_tenant_id: str = Header(..., description="Tenant/Bank ID"),
    security_context: dict = Depends(validate_security_context),
    db = Depends(get_db)
):
    """
    Onboard individual customer with automatic KYC verification
    
    Workflow:
    1. Create customer record
    2. Trigger KYC workflow (Temporal)
    3. Publish onboarding event (Kafka)
    4. Return workflow ID for tracking
    """
    
    # Generate customer ID
    import uuid
    customer_id = f"CUST-{uuid.uuid4().hex[:12].upper()}"
    
    # Create customer record
    customer = Customer(
        customer_id=customer_id,
        tenant_id=x_tenant_id,
        customer_type=CustomerType.INDIVIDUAL,
        verification_status=VerificationStatus.PENDING,
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        phone=request.phone,
        bvn=request.bvn,
        nin=request.nin,
        account_tier=request.account_tier,
        kyc_data={
            "middle_name": request.middle_name,
            "date_of_birth": request.date_of_birth,
            "gender": request.gender,
            "address": request.address,
            "city": request.city,
            "state": request.state,
            "id_type": request.id_type,
            "id_number": request.id_number,
            "preferred_language": request.preferred_language,
            "marketing_consent": request.marketing_consent,
        },
    )
    
    await _db_run(db.add, customer)
    await _db_run(db.commit)
    
    # Trigger KYC workflow via Temporal
    try:
        temporal_client = await get_temporal_client()
        workflow_id = f"kyc-{customer_id}-{int(datetime.utcnow().timestamp())}"
        
        # Start KYC workflow
        workflow_handle = await temporal_client.start_workflow(
            "kyc_verification_workflow",
            {
                "customer_id": customer_id,
                "tenant_id": x_tenant_id,
                "bvn": request.bvn,
                "nin": request.nin,
                "phone": request.phone,
                "email": request.email,
                "id_type": request.id_type,
                "id_number": request.id_number,
                "date_of_birth": request.date_of_birth
            },
            id=workflow_id,
            task_queue="kyc-verification"
        )
        
        # Update customer with workflow ID
        customer.workflow_id = workflow_id
        customer.workflow_channel = "temporal"
        customer.verification_status = VerificationStatus.IN_PROGRESS
        await _db_run(db.commit)
        
    except Exception as e:
        logger.warning("Failed to start KYC workflow for %s: %s", customer_id, e)
        workflow_id = f"manual-review-{customer_id}"
        customer.workflow_id = workflow_id
        customer.workflow_channel = "manual_review"
        customer.verification_status = VerificationStatus.MANUAL_REVIEW
        await _db_run(db.commit)
    
    # Publish onboarding event
    publish_event("customer.onboarded", {
        "customer_id": customer_id,
        "customer_type": "individual",
        "tenant_id": x_tenant_id,
        "email_masked": mask_value(request.email, 2, 10),
        "phone_masked": mask_value(request.phone, 4, 2),
        "account_tier": request.account_tier.value,
        "initiated_by": security_context["principal"],
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Publish KYC initiated event
    publish_event("kyc.initiated", {
        "customer_id": customer_id,
        "workflow_id": workflow_id,
        "tenant_id": x_tenant_id,
        "bvn_masked": mask_value(request.bvn, 0, 2),
        "nin_present": bool(request.nin),
        "initiated_by": security_context["principal"],
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return OnboardingResponse(
        customer_id=customer_id,
        customer_type=CustomerType.INDIVIDUAL,
        verification_status=customer.verification_status,
        workflow_id=workflow_id,
        estimated_completion="15-30 minutes",
        message="Customer onboarding initiated. KYC verification in progress.",
        next_steps=[
            "Upload selfie photo for face matching",
            "Upload government-issued ID document",
            "Wait for BVN verification (automatic)",
            "Complete liveness check (if required)",
            "Receive verification result via email/SMS"
        ]
    )


@app.post("/api/v1/onboarding/corporate", response_model=OnboardingResponse)
async def onboard_corporate_customer(
    request: CorporateCustomerRequest,
    x_tenant_id: str = Header(..., description="Tenant/Bank ID"),
    security_context: dict = Depends(validate_security_context),
    db = Depends(get_db)
):
    """
    Onboard corporate customer with automatic KYB verification
    
    Workflow:
    1. Create customer record
    2. Trigger KYB workflow (Temporal)
    3. Trigger KYC workflows for beneficial owners (parallel)
    4. Publish onboarding event (Kafka)
    5. Return workflow ID for tracking
    """
    
    # Generate customer ID
    import uuid
    customer_id = f"CORP-{uuid.uuid4().hex[:12].upper()}"
    
    # Create customer record
    customer = Customer(
        customer_id=customer_id,
        tenant_id=x_tenant_id,
        customer_type=CustomerType.CORPORATE,
        verification_status=VerificationStatus.PENDING,
        company_name=request.company_name,
        cac_number=request.cac_number,
        tin=request.tin,
        email=request.business_email,
        phone=request.business_phone,
        account_tier=request.account_tier,
        kyb_data={
            "company_type": request.company_type,
            "incorporation_date": request.incorporation_date,
            "business_address": request.business_address,
            "city": request.city,
            "state": request.state,
            "website": request.website,
            "contact_person": {
                "name": request.contact_person_name,
                "email": request.contact_person_email,
                "phone": request.contact_person_phone,
                "designation": request.contact_person_designation,
            },
            "beneficial_owners": request.beneficial_owners,
            "industry": request.industry,
            "annual_revenue": request.annual_revenue,
            "employee_count": request.employee_count,
        },
    )
    
    await _db_run(db.add, customer)
    await _db_run(db.commit)
    
    # Trigger KYB workflow via Temporal
    try:
        temporal_client = await get_temporal_client()
        workflow_id = f"kyb-{customer_id}-{int(datetime.utcnow().timestamp())}"
        
        # Start KYB workflow
        workflow_handle = await temporal_client.start_workflow(
            "kyb_verification_workflow",
            {
                "customer_id": customer_id,
                "tenant_id": x_tenant_id,
                "company_name": request.company_name,
                "cac_number": request.cac_number,
                "tin": request.tin,
                "beneficial_owners": request.beneficial_owners,
                "industry": request.industry,
                "annual_revenue": request.annual_revenue
            },
            id=workflow_id,
            task_queue="kyb-verification"
        )
        
        # Update customer with workflow ID
        customer.workflow_id = workflow_id
        customer.workflow_channel = "temporal"
        customer.verification_status = VerificationStatus.IN_PROGRESS
        await _db_run(db.commit)
        
    except Exception as e:
        logger.warning("Failed to start KYB workflow for %s: %s", customer_id, e)
        workflow_id = f"manual-review-{customer_id}"
        customer.workflow_id = workflow_id
        customer.workflow_channel = "manual_review"
        customer.verification_status = VerificationStatus.MANUAL_REVIEW
        await _db_run(db.commit)

    publish_event("customer.onboarded", {
        "customer_id": customer_id,
        "customer_type": "corporate",
        "tenant_id": x_tenant_id,
        "company_name": request.company_name,
        "business_email_masked": mask_value(request.business_email, 2, 10),
        "business_phone_masked": mask_value(request.business_phone, 4, 2),
        "account_tier": request.account_tier.value,
        "initiated_by": security_context["principal"],
        "timestamp": datetime.utcnow().isoformat()
    })
    publish_event("kyb.initiated", {
        "customer_id": customer_id,
        "workflow_id": workflow_id,
        "tenant_id": x_tenant_id,
        "cac_number_masked": mask_value(request.cac_number, 2, 2),
        "initiated_by": security_context["principal"],
        "timestamp": datetime.utcnow().isoformat()
    })
    publish_event("beneficial_owners.recorded", {
        "customer_id": customer_id,
        "workflow_id": workflow_id,
        "tenant_id": x_tenant_id,
        "beneficial_owner_count": len(request.beneficial_owners),
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return OnboardingResponse(
        customer_id=customer_id,
        customer_type=CustomerType.CORPORATE,
        verification_status=customer.verification_status,
        workflow_id=workflow_id,
        estimated_completion="1-3 business days",
        message="Corporate customer onboarding initiated. KYB verification in progress.",
        next_steps=[
            "Upload company registration documents (CAC certificate)",
            "Upload Tax Identification Number (TIN) certificate",
            "Provide beneficial owner information (>25% ownership)",
            "Complete KYC for all beneficial owners",
            "Wait for manual review (if risk score ≥ 50)",
            "Receive verification result via email"
        ]
    )


@app.get("/api/v1/onboarding/status/{customer_id}")
async def get_onboarding_status(
    customer_id: str,
    x_tenant_id: str = Header(..., description="Tenant/Bank ID"),
    db = Depends(get_db)
):
    """Get customer onboarding status"""
    
    customer = await _db_run(lambda: db.query(Customer).filter(Customer.customer_id == customer_id, Customer.tenant_id == x_tenant_id).first())
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get workflow status from Temporal
    workflow_status = "UNKNOWN"
    workflow_result = None
    
    if customer.workflow_id and customer.workflow_id != "MANUAL-REVIEW-REQUIRED":
        try:
            temporal_client = await get_temporal_client()
            workflow_handle = temporal_client.get_workflow_handle(customer.workflow_id)
            workflow_desc = await workflow_handle.describe()
            workflow_status = workflow_desc.status.name
            
            # Try to get result if completed
            if workflow_status == "COMPLETED":
                try:
                    workflow_result = await workflow_handle.result()
                except:
                    pass
                    
        except Exception as e:
            print(f"Failed to get workflow status: {e}")
    
    return {
        "customer_id": customer.customer_id,
        "customer_type": customer.customer_type.value,
        "verification_status": customer.verification_status.value,
        "workflow_id": customer.workflow_id,
        "workflow_status": workflow_status,
        "workflow_channel": customer.workflow_channel,
        "workflow_result": workflow_result,
        "risk_score": customer.risk_score,
        "fraud_score": customer.fraud_score,
        "created_at": customer.created_at.isoformat(),
        "updated_at": customer.updated_at.isoformat(),
        "verified_at": customer.verified_at.isoformat() if customer.verified_at else None
    }


@app.get("/api/v1/onboarding/customers")
async def list_onboarding_customers(
    x_tenant_id: str = Header(..., description="Tenant/Bank ID"),
    status: Optional[VerificationStatus] = None,
    customer_type: Optional[CustomerType] = None,
    search: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db = Depends(get_db),
):
    query = db.query(Customer).filter(Customer.tenant_id == x_tenant_id)
    if status:
        query = query.filter(Customer.verification_status == status)
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Customer.customer_id.ilike(like)) |
            (Customer.email.ilike(like)) |
            (Customer.first_name.ilike(like)) |
            (Customer.last_name.ilike(like)) |
            (Customer.company_name.ilike(like))
        )
    rows = await _db_run(lambda: query.order_by(Customer.created_at.desc()).limit(limit).all())
    return {
        "tenant_id": x_tenant_id,
        "customers": [
            {
                "customer_id": row.customer_id,
                "customer_type": row.customer_type.value,
                "verification_status": row.verification_status.value,
                "workflow_id": row.workflow_id,
                "workflow_channel": row.workflow_channel,
                "email": row.email,
                "phone": row.phone,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ],
        "total": len(rows),
    }


@app.get("/ready")
async def readiness_check(db = Depends(get_db)):
    await _db_run(lambda: db.query(Customer).count())
    return {
        "status": "ready",
        "service": "customer-onboarding",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "customer-onboarding",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
