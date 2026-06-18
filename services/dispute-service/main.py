"""Dispute Resolution Service"""

from fastapi import FastAPI, HTTPException, Depends, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link Dispute Service", version="1.0.0")

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

@app.put("/api/v1/administration/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str, 
    resolution: str, 
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    async with db.acquire() as conn:
        await conn.execute("UPDATE disputes SET status = 'resolved', resolution = $1 WHERE dispute_id = $2 AND tenant_id = $3", resolution, dispute_id, tenant_id)
    return {"status": "resolved", "dispute_id": dispute_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8019")))
