"""
Complete LPO Financing Service - Local Purchase Order financing with verification and disbursement
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Header, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from audit_middleware import AuditMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from enum import Enum
from decimal import Decimal
import uvicorn
import asyncpg
import os
import json
from dotenv import load_dotenv
from adapters import PaymentServiceAdapter
from utils.kafka_client import LpoKafkaClient, LpoKafkaTopics, LpoKafkaEventTypes
from utils.coa_client import CoAClient

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link LPO Financing Service", version="1.0.0")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Convert HTTPException to the standard error format"""
    error_detail = (
        exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    )

    # If detail is already in the correct format, use it
    if isinstance(exc.detail, dict) and "message" in exc.detail:
        detail = {
            "message": exc.detail.get("message"),
            "status": "error",
            "code": exc.detail.get("code", f"LPO-LPO-ERR-{exc.status_code}"),
            "service": exc.detail.get("service", "lpo-service"),
        }
    else:
        # Convert simple string detail to proper format
        detail = {
            "message": str(exc.detail),
            "status": "error",
            "code": f"LPO-LPO-ERR-{exc.status_code}",
            "service": "lpo-service",
        }

    return JSONResponse(status_code=exc.status_code, content={"detail": detail})


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
lpo_kafka_client = LpoKafkaClient()


class LPOStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    VERIFIED = "verified"
    APPROVED = "approved"
    REJECTED = "rejected"
    DISBURSED = "disbursed"
    COMPLETED = "completed"


class RepaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    DEFAULTED = "defaulted"


class LPOApplication(BaseModel):
    supplier_id: str
    lpo_number: str
    issuing_organization: str
    lpo_amount: Decimal
    currency: str = "NGN"
    financing_amount: Decimal
    repayment_days: int
    lpo_document_url: str
    additional_documents: Optional[List[str]] = None


class LPOVerification(BaseModel):
    lpo_id: str
    verified_by: str
    is_authentic: bool
    verification_notes: Optional[str] = None


class LPOApproval(BaseModel):
    lpo_id: str
    approved_by: str


class LPORejection(BaseModel):
    lpo_id: str
    rejected_by: str


class BankAccount(BaseModel):
    account_number: str
    bank_name: str
    account_name: str
    iban: Optional[str] = None
    swift_code: Optional[str] = None


class LPODisbursal(BaseModel):
    lpo_id: str
    disbursed_to: str
    bank_account: BankAccount | None = None


class LPORepayment(BaseModel):
    amount: Decimal
    payment_date: str
    payment_method: str
    transaction_id: str


@app.on_event("startup")
async def startup():
    global db_pool
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "lpo_db"),
        min_size=5,
        max_size=20,
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS lpo_applications (
                id SERIAL PRIMARY KEY,
                lpo_id VARCHAR(50) UNIQUE NOT NULL,
                supplier_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                lpo_number VARCHAR(100) NOT NULL,
                issuing_organization VARCHAR(255) NOT NULL,
                lpo_amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'NGN',
                financing_amount DECIMAL(15,2) NOT NULL,
                interest_rate DECIMAL(5,2) DEFAULT 5.0,
                total_repayment DECIMAL(15,2),
                repayment_days INT NOT NULL,
                repayment_due_date DATE,
                lpo_document_url VARCHAR(500) NOT NULL,
                additional_documents JSONB,
                status VARCHAR(20) DEFAULT 'submitted',
                risk_score INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_lpo_supplier ON lpo_applications(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_lpo_status ON lpo_applications(status);
            
            CREATE TABLE IF NOT EXISTS lpo_verifications (
                id SERIAL PRIMARY KEY,
                verification_id VARCHAR(50) UNIQUE NOT NULL,
                lpo_id VARCHAR(50) NOT NULL,
                verified_by VARCHAR(255) NOT NULL,
                is_authentic BOOLEAN NOT NULL,
                verification_method VARCHAR(100),
                verification_notes TEXT,
                verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_verifications_lpo ON lpo_verifications(lpo_id);
            
            CREATE TABLE IF NOT EXISTS lpo_disbursements (
                id SERIAL PRIMARY KEY,
                disbursement_id VARCHAR(50) UNIQUE NOT NULL,
                lpo_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                disbursed_to VARCHAR(255) NOT NULL,
                bank_account JSONB NOT NULL,
                transaction_reference VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending',
                disbursed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_disbursements_lpo ON lpo_disbursements(lpo_id);
            
            CREATE TABLE IF NOT EXISTS lpo_repayments (
                id SERIAL PRIMARY KEY,
                repayment_id VARCHAR(50) UNIQUE NOT NULL,
                lpo_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payment_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                transaction_reference VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_repayments_lpo ON lpo_repayments(lpo_id);
            
            CREATE TABLE IF NOT EXISTS supplier_profiles (
                id SERIAL PRIMARY KEY,
                supplier_id VARCHAR(50) UNIQUE NOT NULL,
                business_name VARCHAR(255) NOT NULL,
                registration_number VARCHAR(100),
                total_lpos_financed INT DEFAULT 0,
                total_amount_financed DECIMAL(15,2) DEFAULT 0,
                successful_repayments INT DEFAULT 0,
                defaulted_repayments INT DEFAULT 0,
                credit_score INT DEFAULT 50,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_suppliers_id ON supplier_profiles(supplier_id);
        """
        )

    print("LPO financing service started successfully")


@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "lpo-service"}


@app.get("/api/v1/lpo")
async def get_lpos(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """Get LPOs"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM lpo_applications WHERE tenant_id = $1 AND lpo_number = $2 ORDER BY created_at DESC
        """,
            tenant_id,
            keycloak_id,
        )
        return [dict(row) for row in rows]


@app.get("/api/v1/lpo/administration")
async def get_lpos_administration(
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    """Get LPOs with pagination"""
    async with db.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM lpo_applications WHERE tenant_id = $1", tenant_id
        )
        rows = await conn.fetch(
            "SELECT * FROM lpo_applications WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            tenant_id, limit, (page - 1) * limit,
        )
        return {"data": [dict(row) for row in rows], "total": total, "page": page, "limit": limit}


@app.post("/api/v1/lpo/apply")
async def apply_for_lpo_financing(
    application: LPOApplication,
    background_tasks: BackgroundTasks,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Apply for LPO financing"""
    lpo_id = f"LPO{int(datetime.now().timestamp())}"

    # Calculate interest and total repayment
    interest_rate = Decimal("5.0")  # 5% default rate
    interest_amount = (application.financing_amount * interest_rate / 100).quantize(
        Decimal("0.01")
    )
    total_repayment = (application.financing_amount + interest_amount).quantize(
        Decimal("0.01")
    )
    repayment_due_date = datetime.now().date() + timedelta(
        days=application.repayment_days
    )

    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO lpo_applications (
                lpo_id, supplier_id, tenant_id, lpo_number, issuing_organization,
                lpo_amount, currency, financing_amount, interest_rate, total_repayment,
                repayment_days, repayment_due_date, lpo_document_url, additional_documents,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'under_review')
        """,
            lpo_id,
            application.supplier_id,
            tenant_id,
            application.lpo_number,
            application.issuing_organization,
            application.lpo_amount,
            application.currency,
            application.financing_amount,
            interest_rate,
            total_repayment,
            application.repayment_days,
            repayment_due_date,
            application.lpo_document_url,
            json.dumps(application.additional_documents or []),
        )

    # Publish event to Kafka
    event = {
        "type": LpoKafkaEventTypes.LPO_SUBMITTED,
        "lpo_id": lpo_id,
        "tenant_id": tenant_id,
        "supplier_id": application.supplier_id,
        "lpo_number": application.lpo_number,
        "issuing_organization": application.issuing_organization,
        "lpo_amount": float(application.lpo_amount),
        "currency": application.currency,
        "financing_amount": float(application.financing_amount),
        "interest_rate": float(interest_rate),
        "total_repayment": float(total_repayment),
        "repayment_days": application.repayment_days,
        "repayment_due_date": str(repayment_due_date),
        "status": "under_review",
        "submitted_at": datetime.now().isoformat(),
    }
    lpo_kafka_client.publish_event(LpoKafkaTopics.LPO_APPLICATION, event, key=lpo_id)

    # Start verification in background
    background_tasks.add_task(assess_lpo_risk, lpo_id, application)

    return {
        "status": "submitted",
        "lpo_id": lpo_id,
        "lpo_number": application.lpo_number,
        "financing_amount": float(application.financing_amount),
        "interest_rate": float(interest_rate),
        "total_repayment": float(total_repayment),
        "repayment_due_date": repayment_due_date,
        "submitted_at": datetime.now(),
    }


async def assess_lpo_risk(
    lpo_id: str,
    application: LPOApplication,
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Background task to assess LPO risk"""

    if not db_pool:
        return

    async with db_pool.acquire() as conn:
        # Get supplier profile
        supplier = await conn.fetchrow(
            """
            SELECT * FROM supplier_profiles WHERE supplier_id = $1 AND tenant_id = $2
        """,
            application.supplier_id,
            tenant_id,
        )

        # Calculate risk score
        risk_score = 50  # Base score

        if supplier:
            # Good repayment history
            if supplier["successful_repayments"] > 5:
                risk_score += 20

            # No defaults
            if supplier["defaulted_repayments"] == 0:
                risk_score += 15

            # High credit score
            if supplier["credit_score"] > 70:
                risk_score += 15

        # LPO amount vs financing amount ratio
        ratio = float(application.financing_amount / application.lpo_amount)
        if ratio <= 0.7:  # Financing 70% or less
            risk_score += 10

        # Update LPO with risk score
        await conn.execute(
            """
            UPDATE lpo_applications
            SET risk_score = $1, updated_at = CURRENT_TIMESTAMP
            WHERE lpo_id = $2
        """,
            risk_score,
            lpo_id,
        )


@app.get("/api/v1/lpo/{lpo_id}")
async def get_lpo(
    lpo_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Get LPO details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM lpo_applications WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="LPO not found")
        return dict(row)


@app.post("/api/v1/lpo/{lpo_id}/verify")
async def verify_lpo(
    lpo_id: str,
    verification: LPOVerification,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Verify LPO authenticity"""
    verification_id = f"VER{int(datetime.now().timestamp())}"

    async with db.acquire() as conn:
        # Record verification
        await conn.execute(
            """
            INSERT INTO lpo_verifications (
                verification_id, lpo_id, verified_by, is_authentic,
                verification_method, verification_notes
            ) VALUES ($1, $2, $3, $4, 'manual', $5)
        """,
            verification_id,
            lpo_id,
            verification.verified_by,
            verification.is_authentic,
            verification.verification_notes,
        )

        # Update LPO status
        new_status = "verified" if verification.is_authentic else "rejected"
        await conn.execute(
            """
            UPDATE lpo_applications
            SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE lpo_id = $2 AND tenant_id = $3
        """,
            new_status,
            lpo_id,
            tenant_id,
        )

    return {
        "status": "verified",
        "verification_id": verification_id,
        "lpo_id": lpo_id,
        "is_authentic": verification.is_authentic,
        "verified_at": datetime.now(),
    }


@app.post("/api/v1/lpo/{lpo_id}/approve")
async def approve_lpo(
    lpo_id: str,
    approval: LPOApproval,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Approve LPO financing"""
    async with db.acquire() as conn:
        # Check if verified
        lpo = await conn.fetchrow(
            """
            SELECT status, risk_score FROM lpo_applications WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

        if not lpo:
            raise HTTPException(status_code=404, detail="LPO not found")

        if lpo["status"] != "verified":
            raise HTTPException(status_code=400, detail="LPO not verified")

        risk_score = lpo.get("risk_score") or 0

        if risk_score > 60:
            raise HTTPException(
                status_code=400, detail="Risk score too low for approval"
            )

        # Approve LPO
        await conn.execute(
            """
            UPDATE lpo_applications
            SET status = 'approved', updated_at = CURRENT_TIMESTAMP
            WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

    return {
        "status": "approved",
        "lpo_id": lpo_id,
        "approved_by": approval.approved_by,
        "approved_at": datetime.now(),
    }


@app.post("/api/v1/lpo/{lpo_id}/decline")
async def decline_lpo(
    lpo_id: str,
    approval: LPORejection,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Decline LPO financing"""
    async with db.acquire() as conn:
        # Check if verified
        lpo = await conn.fetchrow(
            """
            SELECT status, risk_score FROM lpo_applications WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

        if not lpo:
            raise HTTPException(status_code=404, detail="LPO not found")

        # decline LPO
        await conn.execute(
            """
            UPDATE lpo_applications
            SET status = 'reject', updated_at = CURRENT_TIMESTAMP
            WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

    return {
        "status": "rejected",
        "lpo_id": lpo_id,
        "rejected_by": approval.rejected_by,
        "rejected_at": datetime.now(),
    }


@app.post("/api/v1/lpo/{lpo_id}/disburse")
async def disburse_lpo_funds(
    lpo_id: str,
    disbursal: LPODisbursal,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
    mint_account_id: str = Header(..., alias="x-mint-account-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id")
                            
):
    """Disburse LPO financing funds"""
    disbursement_id = f"DIS{int(datetime.now().timestamp())}"

    async with db.acquire() as conn:
        # Get LPO details
        lpo = await conn.fetchrow(
            """
            SELECT status, financing_amount, supplier_id
            FROM lpo_applications WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

        if not lpo:
            raise HTTPException(status_code=404, detail="LPO not found")

        if lpo["status"] == "disbursed":
            raise HTTPException(status_code=400, detail="LPO already disbursed")

        if lpo["status"] != "approved":
            raise HTTPException(status_code=400, detail="LPO not approved")

        print("Initiating payment via PaymentServiceAdapter...")
        print(f"Disbursing {lpo['financing_amount']} to {disbursal.disbursed_to}...")

        payment_service_adapter = PaymentServiceAdapter({"x-tenant-id": tenant_id, "x-keycloak-id": keycloak_id, "x-mint-account-id": mint_account_id, "x-ledger-id": ledger_id})
        payment = payment_service_adapter.process_payment(
            recipient=disbursal.disbursed_to,
            amount=float(lpo["financing_amount"]),
            note=f"LPO Financing Disbursement for LPO ID {lpo_id}",
        )
        print(f"Payment response: {payment}")
        if payment.get("message", "").lower() != "success":
            raise HTTPException(status_code=500, detail="Payment processing failed")
        transaction_reference = payment.get("reference", "N/A")

        # Fail-fast: Record journal entry in Chart of Accounts
        try:
            await coa_client.create_journal_entry(
                tenant_id=tenant_id,
                user_id=disbursal.disbursed_to,
                user_role="bank_admin",
                description=f"LPO Disbursement for LPO ID {lpo_id}",
                lines=[
                    {
                        "account_id": "1400",  # Loans Receivable (Asset)
                        "description": f"LPO Disbursement Asset for {lpo_id}",
                        "debit_amount": int(float(lpo["financing_amount"]) * 100),
                        "credit_amount": 0,
                    },
                    {
                        "account_id": disbursal.disbursed_to,
                        "description": "LPO Disbursement to Supplier",
                        "debit_amount": 0,
                        "credit_amount": int(float(lpo["financing_amount"]) * 100),
                    },
                ],
                reference=lpo_id,
                metadata={
                    "lpo_id": lpo_id,
                    "disbursement_id": disbursement_id,
                    "event_type": "disbursement",
                },
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to record accounting entry: {e}"
            )

        # Record disbursement
        await conn.execute(
            """
            INSERT INTO lpo_disbursements (
                disbursement_id, lpo_id, amount, disbursed_to, bank_account,
                transaction_reference, status, disbursed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'completed', CURRENT_TIMESTAMP)
        """,
            disbursement_id,
            lpo_id,
            lpo["financing_amount"],
            disbursal.disbursed_to,
            json.dumps(disbursal.bank_account or {}),
            transaction_reference,
        )

        # Update LPO status
        await conn.execute(
            """
            UPDATE lpo_applications
            SET status = 'disbursed', updated_at = CURRENT_TIMESTAMP
            WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

        # Update supplier profile
        await conn.execute(
            """
            UPDATE supplier_profiles
            SET total_lpos_financed = total_lpos_financed + 1,
                total_amount_financed = total_amount_financed + $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE supplier_id = $2
        """,
            lpo["financing_amount"],
            lpo["supplier_id"],
        )

    return {
        "status": "disbursed",
        "disbursement_id": disbursement_id,
        "lpo_id": lpo_id,
        "amount": float(lpo["financing_amount"]),
        "transaction_reference": transaction_reference,
        "disbursed_at": datetime.now(),
    }


@app.post("/api/v1/lpo/{lpo_id}/record-payment")
async def record_lpo_repayment(
    lpo_id: str,
    payload: LPORepayment,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Record LPO repayment"""
    repayment_id = f"REP{int(datetime.now().timestamp())}"

    async with db.acquire() as conn:
        # Get LPO details
        lpo = await conn.fetchrow(
            """
            SELECT * FROM lpo_applications WHERE lpo_id = $1 AND tenant_id = $2
        """,
            lpo_id,
            tenant_id,
        )

        if not lpo:
            raise HTTPException(status_code=404, detail="LPO not found")

        if lpo["status"] == "completed":
            raise HTTPException(status_code=400, detail="LPO payment already completed")

        if lpo["status"] != "disbursed":
            raise HTTPException(status_code=400, detail="LPO not disbursed yet")

        # Record repayment
        await conn.execute(
            """
            INSERT INTO lpo_repayments (
                repayment_id, lpo_id, amount, payment_date, status, transaction_reference
            ) VALUES ($1, $2, $3, CURRENT_DATE, 'paid', $4)
        """,
            repayment_id,
            lpo_id,
            payload.amount,
            payload.transaction_id,
        )

        # Check if fully repaid
        total_repaid = await conn.fetchval(
            """
            SELECT COALESCE(SUM(amount), 0) FROM lpo_repayments
            WHERE lpo_id = $1 AND status = 'paid'
        """,
            lpo_id,
        )

        if total_repaid >= lpo["total_repayment"]:
            # Mark as completed
            await conn.execute(
                """
                UPDATE lpo_applications
                SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                WHERE lpo_id = $1 AND tenant_id = $2
            """,
                lpo_id,
                tenant_id,
            )

            # Update supplier profile
            await conn.execute(
                """
                UPDATE supplier_profiles
                SET successful_repayments = successful_repayments + 1,
                    credit_score = LEAST(credit_score + 5, 100),
                    updated_at = CURRENT_TIMESTAMP
                WHERE supplier_id = $1
            """,
                lpo["supplier_id"],
            )

    return {
        "status": "success",
        "repayment_id": repayment_id,
        "lpo_id": lpo_id,
        "amount": float(payload.amount),
        "payment_date": datetime.now().date(),
    }


@app.get("/api/v1/lpo/{lpo_id}/repayments")
async def list_lpo_repayments(lpo_id: str, db=Depends(lambda: db_pool)):
    """List repayments for LPO"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM lpo_repayments WHERE lpo_id = $1 ORDER BY payment_date DESC
        """,
            lpo_id,
        )

        total_repaid = sum(
            float(row["amount"]) for row in rows if row["status"] == "paid"
        )

        return {
            "lpo_id": lpo_id,
            "repayments": [dict(row) for row in rows],
            "total": len(rows),
            "total_repaid": total_repaid,
        }


@app.get("/api/v1/lpo/supplier/{supplier_id}")
async def list_supplier_lpos(
    supplier_id: str,
    status: Optional[LPOStatus] = None,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """List LPOs for supplier"""
    query = "SELECT * FROM lpo_applications WHERE supplier_id = $1 AND tenant_id = $2 ORDER BY created_at DESC"
    params = [supplier_id, tenant_id]

    if status:
        query += " AND status = $3"
        params.append(status.value)

    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "supplier_id": supplier_id,
            "lpos": [dict(row) for row in rows],
            "total": len(rows),
        }


@app.post("/api/v1/lpo/supplier/register")
async def register_supplier(
    supplier_id: str,
    business_name: str,
    registration_number: Optional[str] = None,
    db=Depends(lambda: db_pool),
):
    """Register supplier profile"""
    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO supplier_profiles (supplier_id, business_name, registration_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (supplier_id) DO UPDATE
            SET business_name = $2, registration_number = $3, updated_at = CURRENT_TIMESTAMP
        """,
            supplier_id,
            business_name,
            registration_number,
        )

    return {
        "status": "registered",
        "supplier_id": supplier_id,
        "business_name": business_name,
    }


@app.get("/api/v1/suppliers")
async def get_suppliers(db=Depends(lambda: db_pool)):
    """Get suppliers"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM supplier_profiles ORDER BY created_at DESC
        """
        )
        return [dict(row) for row in rows]


@app.get("/api/v1/lpo/supplier/{supplier_id}/profile")
async def get_supplier_profile(supplier_id: str, db=Depends(lambda: db_pool)):
    """Get supplier profile"""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM supplier_profiles WHERE supplier_id = $1
        """,
            supplier_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return dict(row)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8012)))
