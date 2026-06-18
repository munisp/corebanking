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
