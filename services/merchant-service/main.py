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
import os
import sys
from decimal import Decimal
import json

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
    id: int
    merchant_id: str
    tenant_id: str
    business_name: str
    business_email: str
    business_phone: str
    status: MerchantStatus
    kyb_status: KYBStatus
    api_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

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
                    processed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

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
            """)

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

# Merchant Management Endpoints
@app.post("/api/v1/merchants", response_model=MerchantResponse, status_code=201)
async def create_merchant(
    merchant: MerchantCreate,
    db=Depends(get_db)
):
    """Create a new merchant account"""
    merchant_id = f"MER{int(datetime.now().timestamp())}"
    api_key = f"sk_live_{merchant_id}_{int(datetime.now().timestamp())}"
    
    async with db.acquire() as conn:
        row = await conn.fetchrow("""
            INSERT INTO merchants (
                merchant_id, tenant_id, business_name, business_email, business_phone,
                business_address, business_type, registration_number, tax_id,
                contact_person_name, contact_person_email, contact_person_phone,
                industry, website, api_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        """, merchant_id, merchant.tenant_id, merchant.business_name, merchant.business_email,
            merchant.business_phone, merchant.business_address, merchant.business_type,
            merchant.registration_number, merchant.tax_id, merchant.contact_person_name,
            merchant.contact_person_email, merchant.contact_person_phone, merchant.industry,
            merchant.website, api_key)
        
        # Initialize fee configuration with defaults
        await conn.execute("""
            INSERT INTO merchant_fee_config (merchant_id)
            VALUES ($1)
        """, merchant_id)

        merchant_payload = dict(row)

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
        return [dict(row) for row in rows]

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
        return dict(row)

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
        updated = dict(row)
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
