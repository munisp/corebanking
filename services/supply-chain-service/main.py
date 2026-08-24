"""
Complete Supply Chain Finance Service - Invoice financing, PO financing, supplier/buyer financing
Production-ready implementation
"""

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uvicorn
import asyncpg
import os
import json
from dotenv import load_dotenv
from middlewares import RequiredHeadersMiddleware
from adapters import PaymentServiceAdapter
from schemas import Context
from utils.coa_client import CoAClient

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link Supply Chain Finance Service", version="1.0.0")

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


app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-ledger-id",
        "x-mint-account-id",
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

db_pool = None

class FinancingType(str, Enum):
    INVOICE = "invoice"
    PURCHASE_ORDER = "purchase_order"
    SUPPLIER_EARLY_PAYMENT = "supplier_early_payment"
    BUYER_EXTENDED_TERMS = "buyer_extended_terms"

class FinancingStatus(str, Enum):
    SUBMITTED = "submitted"
    VERIFIED = "verified"
    APPROVED = "approved"
    DISBURSED = "disbursed"
    REPAID = "repaid"
    DEFAULTED = "defaulted"

class InvoiceFinancing(BaseModel):
    supplier_id: str
    invoice_number: str
    invoice_amount: Decimal
    financing_percentage: Decimal
    invoice_due_date: datetime
    invoice_document_url: str

class PurchaseOrderFinancing(BaseModel):
    supplier_id: str
    buyer_id: str
    po_number: str
    po_amount: Decimal
    financing_amount: Decimal
    delivery_date: datetime
    po_document_url: str

class RecordRePayment(BaseModel):
    transaction_id: str
    amount: int
    payment_date: str
    payment_method: str

@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "supply_chain_db"),
        min_size=5, max_size=20
    )
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS financing_applications (
                id SERIAL PRIMARY KEY,
                financing_id VARCHAR(50) UNIQUE NOT NULL,
                supplier_id VARCHAR(50) NOT NULL,
                buyer_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                financing_type VARCHAR(30) NOT NULL,
                reference_number VARCHAR(100) NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL,
                financing_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) DEFAULT 3.0,
                fee_amount DECIMAL(15,2) DEFAULT 0,
                net_amount DECIMAL(15,2) NOT NULL,
                repayment_amount DECIMAL(15,2) NOT NULL,
                due_date DATE NOT NULL,
                document_url VARCHAR(500) NOT NULL,
                status VARCHAR(20) DEFAULT 'submitted',
                risk_score INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_financing_supplier ON financing_applications(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_financing_buyer ON financing_applications(buyer_id);
            CREATE INDEX IF NOT EXISTS idx_financing_status ON financing_applications(status);
            
            CREATE TABLE IF NOT EXISTS supply_chain_relationships (
                id SERIAL PRIMARY KEY,
                relationship_id VARCHAR(50) UNIQUE NOT NULL,
                supplier_id VARCHAR(50) NOT NULL,
                buyer_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                relationship_start DATE DEFAULT CURRENT_DATE,
                total_transactions INT DEFAULT 0,
                total_volume DECIMAL(15,2) DEFAULT 0,
                avg_payment_days INT DEFAULT 0,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_relationships_supplier ON supply_chain_relationships(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_relationships_buyer ON supply_chain_relationships(buyer_id);
            
            CREATE TABLE IF NOT EXISTS disbursements (
                id SERIAL PRIMARY KEY,
                disbursement_id VARCHAR(50) UNIQUE NOT NULL,
                financing_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                recipient_id VARCHAR(50) NOT NULL,
                bank_account JSONB NOT NULL,
                transaction_reference VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending',
                disbursed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_disbursements_financing ON disbursements(financing_id);
            
            CREATE TABLE IF NOT EXISTS repayments (
                id SERIAL PRIMARY KEY,
                repayment_id VARCHAR(50) UNIQUE NOT NULL,
                financing_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payer_id VARCHAR(50) NOT NULL,
                payment_date DATE NOT NULL,
                transaction_reference VARCHAR(100),
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_repayments_financing ON repayments(financing_id);
            
            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                invoice_id VARCHAR(50) UNIQUE NOT NULL,
                supplier_id VARCHAR(50) NOT NULL,
                buyer_id VARCHAR(50) NOT NULL,
                invoice_number VARCHAR(100) NOT NULL,
                invoice_amount DECIMAL(15,2) NOT NULL,
                invoice_date DATE NOT NULL,
                due_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                paid_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_invoices_buyer ON invoices(buyer_id);
            
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id SERIAL PRIMARY KEY,
                po_id VARCHAR(50) UNIQUE NOT NULL,
                supplier_id VARCHAR(50) NOT NULL,
                buyer_id VARCHAR(50) NOT NULL,
                po_number VARCHAR(100) NOT NULL,
                po_amount DECIMAL(15,2) NOT NULL,
                po_date DATE NOT NULL,
                delivery_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                fulfilled_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_pos_supplier ON purchase_orders(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_pos_buyer ON purchase_orders(buyer_id);
        """)
    
    print("Supply chain finance service started successfully")

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "supply-chain-service"}

@app.post("/api/v1/supply-chain/invoice-financing/apply")
async def apply_invoice_financing(
    application: InvoiceFinancing,
    background_tasks: BackgroundTasks,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Apply for invoice financing"""
    financing_id = f"INV{int(datetime.now().timestamp())}"
    
    # Calculate financing details
    financing_amount = (application.invoice_amount * application.financing_percentage / 100).quantize(Decimal("0.01"))
    interest_rate = Decimal("3.0")  # 3% fee
    fee_amount = (financing_amount * interest_rate / 100).quantize(Decimal("0.01"))
    net_amount = (financing_amount - fee_amount).quantize(Decimal("0.01"))
    repayment_amount = application.invoice_amount
    
    async with db.acquire() as conn:
        # Record application
        await conn.execute("""
            INSERT INTO financing_applications (
                financing_id, supplier_id, buyer_id, tenant_id, financing_type,
                reference_number, total_amount, financing_amount, interest_rate,
                fee_amount, net_amount, repayment_amount, due_date, document_url, status
            ) VALUES ($1, $2, $3, $4, 'invoice', $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted')
        """, financing_id, application.supplier_id, keycloak_id, tenant_id,
            application.invoice_number, application.invoice_amount, financing_amount,
            interest_rate, fee_amount, net_amount, repayment_amount,
            application.invoice_due_date.date(), application.invoice_document_url)
        
        # Record invoice
        invoice_id = f"INVDOC{int(datetime.now().timestamp())}"
        await conn.execute("""
            INSERT INTO invoices (
                invoice_id, supplier_id, buyer_id, invoice_number, invoice_amount,
                invoice_date, due_date, status
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'pending')
        """, invoice_id, application.supplier_id, keycloak_id,
            application.invoice_number, application.invoice_amount, application.invoice_due_date.date())
    
    # Assess risk in background
    background_tasks.add_task(assess_supply_chain_risk, financing_id, application.supplier_id, keycloak_id)
    
    return {
        "status": "submitted",
        "financing_id": financing_id,
        "invoice_number": application.invoice_number,
        "financing_amount": float(financing_amount),
        "fee_amount": float(fee_amount),
        "net_amount": float(net_amount),
        "submitted_at": datetime.now()
    }

@app.post("/api/v1/supply-chain/po-financing/apply")
async def apply_po_financing(
    application: PurchaseOrderFinancing,
    background_tasks: BackgroundTasks,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Apply for purchase order financing"""
    financing_id = f"POF{int(datetime.now().timestamp())}"
    
    # Calculate financing details
    interest_rate = Decimal("4.0")  # 4% fee for PO financing
    fee_amount = (application.financing_amount * interest_rate / 100).quantize(Decimal("0.01"))
    net_amount = (application.financing_amount - fee_amount).quantize(Decimal("0.01"))
    repayment_amount = application.financing_amount + fee_amount
    
    async with db.acquire() as conn:
        # Record application
        await conn.execute("""
            INSERT INTO financing_applications (
                financing_id, supplier_id, buyer_id, tenant_id, financing_type,
                reference_number, total_amount, financing_amount, interest_rate,
                fee_amount, net_amount, repayment_amount, due_date, document_url, status
            ) VALUES ($1, $2, $3, $4, 'purchase_order', $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted')
        """, financing_id, application.supplier_id, application.buyer_id, tenant_id,
            application.po_number, application.po_amount, application.financing_amount,
            interest_rate, fee_amount, net_amount, repayment_amount,
            application.delivery_date.date(), application.po_document_url)
        
        # Record PO
        po_id = f"PODOC{int(datetime.now().timestamp())}"
        await conn.execute("""
            INSERT INTO purchase_orders (
                po_id, supplier_id, buyer_id, po_number, po_amount,
                po_date, delivery_date, status
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, 'pending')
        """, po_id, application.supplier_id, application.buyer_id,
            application.po_number, application.po_amount, application.delivery_date.date())
    
    # Assess risk in background
    background_tasks.add_task(assess_supply_chain_risk, financing_id, application.supplier_id, application.buyer_id)
    
    return {
        "status": "submitted",
        "financing_id": financing_id,
        "po_number": application.po_number,
        "financing_amount": float(application.financing_amount),
        "fee_amount": float(fee_amount),
        "net_amount": float(net_amount),
        "submitted_at": datetime.now()
    }

async def assess_supply_chain_risk(financing_id: str, supplier_id: str, buyer_id: str):
    """Background task to assess supply chain financing risk"""
    async with db_pool.acquire() as conn:
        # Check relationship
        relationship = await conn.fetchrow("""
            SELECT * FROM supply_chain_relationships
            WHERE supplier_id = $1 AND buyer_id = $2
        """, supplier_id, buyer_id)
        
        risk_score = 50  # Base score
        
        if relationship:
            # Established relationship
            if relationship['total_transactions'] > 10:
                risk_score += 20
            
            # Good payment history
            if relationship['avg_payment_days'] <= 30:
                risk_score += 15
            
            # Verified relationship
            if relationship['is_verified']:
                risk_score += 15
        
        # Update financing with risk score
        await conn.execute("""
            UPDATE financing_applications
            SET risk_score = $1, updated_at = CURRENT_TIMESTAMP
            WHERE financing_id = $2
        """, risk_score, financing_id)

@app.get("/api/v1/supply-chain/financing/{financing_id}")
async def get_financing(
    financing_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Get financing details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM financing_applications
            WHERE tenant_id = $1 AND buyer_id = $2 AND financing_id = $3
        """, tenant_id, keycloak_id, financing_id)
        return dict(row)

@app.get("/api/v1/supply-chain/financing")
async def get_all_financing(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Get all customer financings"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM financing_applications
            WHERE tenant_id = $1 AND buyer_id = $2 ORDER BY created_at DESC
        """, tenant_id, keycloak_id)
        return [dict(row) for row in rows]

@app.post("/api/v1/supply-chain/financing/{financing_id}/approve")
async def approve_financing(
    financing_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Approve supply chain financing"""
    async with db.acquire() as conn:
        financing = await conn.fetchrow("""
            SELECT * FROM financing_applications WHERE financing_id = $1 AND tenant_id = $2
        """, financing_id, tenant_id)
        
        if not financing:
            raise HTTPException(status_code=404, detail="Financing not found")
        
        if financing['status'] != 'submitted':
            raise HTTPException(status_code=400, detail="Financing already processed")
        
        if financing['risk_score'] < 60:
            raise HTTPException(status_code=400, detail="Risk score too low")
        
        await conn.execute("""
            UPDATE financing_applications
            SET status = 'approved', updated_at = CURRENT_TIMESTAMP
            WHERE financing_id = $1
        """, financing_id)
    
    return {
        "status": "approved",
        "financing_id": financing_id,
        "approved_by": keycloak_id,
        "approved_at": datetime.now()
    }

@app.post("/api/v1/supply-chain/financing/{financing_id}/disburse")
async def disburse_financing(
    financing_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
    mint_accout_id: str = Header(..., alias="x-mint-account-id"),
):
    """Disburse supply chain financing"""
    disbursement_id = f"DIS{int(datetime.now().timestamp())}"

    context = Context(
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
        ledger_id=ledger_id,
        mint_account_id=mint_accout_id
    )
    
    async with db.acquire() as conn:
        financing = await conn.fetchrow("""
            SELECT * FROM financing_applications
            WHERE financing_id = $1 AND tenant_id = $2
        """, financing_id, tenant_id)
        
        if not financing:
            raise HTTPException(status_code=404, detail="Financing not found")
        
        if financing['status'] != 'approved':
            raise HTTPException(status_code=400, detail="Financing not approved")
        
        payment_service_adapter = PaymentServiceAdapter()

        payment = payment_service_adapter.process_payment(
            recipient=financing['supplier_id'],
            amount=float(financing['net_amount']),
            note=f"SUPPLY CHAIN FINANCING PAYOUT",
            context=context
        )

        print(f"Payment response: {payment}")

        if payment.get("message", "") != "success":
            raise HTTPException(status_code=500, detail="Payment processing failed")
        
        # Record disbursement
        await conn.execute("""
            INSERT INTO disbursements (
                disbursement_id, financing_id, amount, recipient_id, bank_account,
                transaction_reference, status, disbursed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', CURRENT_TIMESTAMP)
        """, disbursement_id, financing_id, financing['net_amount'],
            financing['supplier_id'], json.dumps({}), payment.get("reference"))
        
        # Update financing status
        await conn.execute("""
            UPDATE financing_applications
            SET status = 'disbursed', updated_at = CURRENT_TIMESTAMP
            WHERE financing_id = $1 AND tenant_id = $2
        """, financing_id, tenant_id)
    
    return {
        "status": "disbursed",
        "disbursement_id": disbursement_id,
        "financing_id": financing_id,
        "amount": float(financing['net_amount']),
        "transaction_reference": payment.get("reference"),
        "disbursed_at": datetime.now()
    }

@app.post("/api/v1/system/supply-chain/financing/record-payment/{financing_id}")
async def record_repayment(
    financing_id: str,
    payment: RecordRePayment,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
    mint_accout_id: str = Header(..., alias="x-mint-account-id"),
):
    """Record financing repayment"""
    repayment_id = f"REP{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        financing = await conn.fetchrow("""
            SELECT * FROM financing_applications WHERE financing_id = $1 AND tenant_id = $2
        """, financing_id, tenant_id)
        
        if not financing:
            raise HTTPException(status_code=404, detail="Financing not found")
        
        # Record repayment
        await conn.execute("""
            INSERT INTO repayments (
                repayment_id, financing_id, amount, payer_id, payment_date, transaction_reference
            ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
        """, repayment_id, financing_id, payment.amount, "BUYER", payment.transaction_id)
        
        # Check if fully repaid
        total_repaid = await conn.fetchval("""
            SELECT COALESCE(SUM(amount), 0) FROM repayments
            WHERE financing_id = $1 AND status = 'completed'
        """, financing_id)
        
        if total_repaid >= financing['repayment_amount']:
            await conn.execute("""
                UPDATE financing_applications
                SET status = 'repaid', updated_at = CURRENT_TIMESTAMP
                WHERE financing_id = $1
            """, financing_id)
    
    return {
        "status": "success",
        "repayment_id": repayment_id,
        "financing_id": financing_id,
        "amount": float(payment.amount),
        "payment_date": datetime.now().date()
    }

@app.post("/api/v1/supply-chain/relationships/create")
async def create_relationship(
    supplier_id: str,
    buyer_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
):
    """Create supply chain relationship"""
    relationship_id = f"REL{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO supply_chain_relationships (
                relationship_id, supplier_id, buyer_id, tenant_id
            ) VALUES ($1, $2, $3, $4)
        """, relationship_id, supplier_id, buyer_id, tenant_id)
    
    return {
        "status": "created",
        "relationship_id": relationship_id,
        "supplier_id": supplier_id,
        "buyer_id": buyer_id
    }

@app.get("/api/v1/supply-chain/relationships/{supplier_id}/{buyer_id}")
async def get_relationship(
    supplier_id: str,
    buyer_id: str,
    db=Depends(lambda: db_pool)
):
    """Get supply chain relationship"""
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT * FROM supply_chain_relationships
            WHERE supplier_id = $1 AND buyer_id = $2
        """, supplier_id, buyer_id)
        
        if not row:
            raise HTTPException(status_code=404, detail="Relationship not found")
        
        return dict(row)

@app.get("/api/v1/supply-chain/financing/supplier/{supplier_id}")
async def list_supplier_financing(
    supplier_id: str,
    status: Optional[FinancingStatus] = None,
    db=Depends(lambda: db_pool)
):
    """List financing for supplier"""
    query = "SELECT * FROM financing_applications WHERE supplier_id = $1 ORDER BY created_at DESC"
    params = [supplier_id]
    
    if status:
        query += " AND status = $2"
        params.append(status.value)
    
    query += " ORDER BY created_at DESC"
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "supplier_id": supplier_id,
            "financing": [dict(row) for row in rows],
            "total": len(rows)
        }

@app.get("/api/v1/supply-chain/financing/buyer/{buyer_id}")
async def list_buyer_financing(
    buyer_id: str,
    status: Optional[FinancingStatus] = None,
    db=Depends(lambda: db_pool)
):
    """List financing for buyer"""
    query = "SELECT * FROM financing_applications WHERE buyer_id = $1 ORDER BY created_at DESC"
    params = [buyer_id]
    
    if status:
        query += " AND status = $2"
        params.append(status.value)
    
    query += " ORDER BY created_at DESC"
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "buyer_id": buyer_id,
            "financing": [dict(row) for row in rows],
            "total": len(rows)
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8020")))
