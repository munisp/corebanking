"""
Insurance Service - Policy management, premium calculation, claims processing, underwriting
"""

from fastapi import FastAPI, Depends, Header, BackgroundTasks
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
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from adapters import PaymentServiceAdapter
from schemas import Context
from utils.errors import raise_http_exception_handler
from utils.kafka_instance import kafka_client
from utils.kafka_client import InsuranceEventTypes
from utils.coa_client import CoAClient

load_dotenv()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(title="54Link Insurance Service", version="1.0.0")

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=["x-tenant-id", "x-keycloak-id"],
    exclude_prefixes=["/health", "/dapr"],
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-staff-id",
    ],
    include_prefixes=["/api/v1/administration"],
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


class PolicyType(str, Enum):
    LIFE = "life"
    HEALTH = "health"
    AUTO = "auto"
    HOME = "home"
    TERRORIST = "terrorist"
    FLOOD = "flood"
    BUSINESS = "business"
    TRAVEL = "travel"
    CROP = "crop"


class PolicyStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    LAPSED = "lapsed"


class ClaimStatus(str, Enum):
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


class ClaimReview(BaseModel):
    decision: ClaimStatus
    approved_amount: Optional[Decimal]
    rejection_reason: Optional[str] = None


class PolicyApplication(BaseModel):
    policy_type: PolicyType
    coverage_amount: Decimal
    duration_months: int
    beneficiaries: List[Dict]
    additional_info: Optional[Dict] = None


class ClaimSubmission(BaseModel):
    policy_id: str
    claim_amount: Decimal
    incident_date: datetime
    incident_description: str
    supporting_documents: List[str]


class RecordPremiumPayment(BaseModel):
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
        database=os.getenv("DB_NAME", "insurance_db"),
        min_size=5,
        max_size=20,
    )

    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS insurance_policies (
                id SERIAL PRIMARY KEY,
                policy_id VARCHAR(50) UNIQUE NOT NULL,
                customer_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                policy_type VARCHAR(20) NOT NULL,
                policy_number VARCHAR(100) UNIQUE,
                coverage_amount DECIMAL(15,2) NOT NULL,
                premium_amount DECIMAL(15,2) NOT NULL,
                duration_months INT NOT NULL,
                start_date DATE,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'draft',
                beneficiaries JSONB,
                additional_info JSONB,
                underwriting_score INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_policies_customer ON insurance_policies(customer_id);
            CREATE INDEX IF NOT EXISTS idx_policies_status ON insurance_policies(status);
            
            CREATE TABLE IF NOT EXISTS insurance_claims (
                id SERIAL PRIMARY KEY,
                claim_id VARCHAR(50) UNIQUE NOT NULL,
                policy_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                claim_amount DECIMAL(15,2) NOT NULL,
                approved_amount DECIMAL(15,2),
                incident_date DATE NOT NULL,
                incident_description TEXT NOT NULL,
                supporting_documents JSONB,
                status VARCHAR(20) DEFAULT 'submitted',
                reviewed_by VARCHAR(255),
                reviewed_at TIMESTAMP,
                paid_at TIMESTAMP,
                rejection_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_claims_policy ON insurance_claims(policy_id);
            CREATE INDEX IF NOT EXISTS idx_claims_status ON insurance_claims(status);
            
            CREATE TABLE IF NOT EXISTS premium_payments (
                id SERIAL PRIMARY KEY,
                payment_id VARCHAR(50) UNIQUE NOT NULL,
                policy_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payment_date DATE NOT NULL,
                payment_method VARCHAR(50),
                status VARCHAR(20) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_payments_policy ON premium_payments(policy_id);
            
            CREATE TABLE IF NOT EXISTS underwriting_assessments (
                id SERIAL PRIMARY KEY,
                assessment_id VARCHAR(50) UNIQUE NOT NULL,
                policy_id VARCHAR(50) NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                risk_factors JSONB,
                risk_score INT NOT NULL,
                risk_level VARCHAR(20) NOT NULL,
                premium_adjustment DECIMAL(5,2) DEFAULT 0,
                assessed_by VARCHAR(255),
                assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_assessments_policy ON underwriting_assessments(policy_id);
        """
        )

    print("Insurance service started successfully")


@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "insurance-service"}


@app.post("/api/v1/insurance/policies/apply")
async def apply_for_policy(
    application: PolicyApplication,
    background_tasks: BackgroundTasks,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """Apply for insurance policy"""
    policy_id = f"POL{int(datetime.now().timestamp())}"

    # Calculate premium based on policy type and coverage
    premium_rates = {
        "life": Decimal("0.05"),  # 5% of coverage annually
        "health": Decimal("0.08"),  # 8% of coverage annually
        "auto": Decimal("0.06"),  # 6% of coverage annually
        "home": Decimal("0.04"),  # 4% of coverage annually
        "terrorist": Decimal("0.09"),  # 9% of coverage annually
        "flood": Decimal("0.03"),  # 3% of coverage annually
        "business": Decimal("0.07"),  # 7% of coverage annually
        "travel": Decimal("0.02"),  # 2% of coverage
        "crop": Decimal("0.10"),  # 10% of coverage
    }

    rate = premium_rates.get(application.policy_type.value, Decimal("0.05"))
    annual_premium = (application.coverage_amount * rate).quantize(Decimal("0.01"))
    monthly_premium = (annual_premium / 12).quantize(Decimal("0.01"))
    total_premium = (monthly_premium * application.duration_months).quantize(
        Decimal("0.01")
    )

    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO insurance_policies (
                policy_id, customer_id, tenant_id, policy_type, coverage_amount,
                premium_amount, duration_months, beneficiaries, additional_info, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
        """,
            policy_id,
            keycloak_id,
            tenant_id,
            application.policy_type.value,
            application.coverage_amount,
            total_premium,
            application.duration_months,
            json.dumps(application.beneficiaries),
            json.dumps(application.additional_info or {}),
        )

    # Publish Kafka event for policy application
    kafka_client.publish_policy_event(
        event_type=InsuranceEventTypes.POLICY_APPLIED,
        policy_id=policy_id,
        tenant_id=tenant_id,
        status="draft",
        metadata={
            "customer_id": keycloak_id,
            "policy_type": application.policy_type.value,
            "coverage_amount": str(application.coverage_amount),
            "premium_amount": str(total_premium),
            "duration_months": application.duration_months,
            "beneficiaries": application.beneficiaries,
            "additional_info": application.additional_info or {},
        }
    )

    # Start underwriting in background
    background_tasks.add_task(perform_underwriting, policy_id, application)

    return {
        "status": "application_received",
        "policy_id": policy_id,
        "coverage_amount": float(application.coverage_amount),
        "premium_amount": float(total_premium),
        "monthly_premium": float(monthly_premium),
        "applied_at": datetime.now(),
    }


async def perform_underwriting(policy_id: str, application: PolicyApplication):
    """Background task for underwriting assessment"""
    async with db_pool.acquire() as conn:
        # Simulate underwriting assessment
        risk_factors = []
        risk_score = 50  # Base score

        # Age-based risk (if provided)
        if application.additional_info and "age" in application.additional_info:
            age = application.additional_info["age"]
            if age > 60:
                risk_score += 20
                risk_factors.append("advanced_age")
            elif age < 25:
                risk_score += 10
                risk_factors.append("young_age")

        # Coverage amount risk
        if application.coverage_amount > 10000000:  # 10M threshold
            risk_score += 15
            risk_factors.append("high_coverage_amount")

        # Determine risk level
        if risk_score >= 70:
            risk_level = "high"
        elif risk_score >= 50:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Record assessment
        assessment_id = f"UND{int(datetime.now().timestamp())}"
        await conn.execute(
            """
            INSERT INTO underwriting_assessments (
                assessment_id, policy_id, risk_factors, risk_score,
                risk_level, assessed_by
            ) VALUES ($1, $2, $3, $4, $5, 'automated_system')
        """,
            assessment_id,
            policy_id,
            json.dumps(risk_factors),
            risk_score,
            risk_level,
        )

        # Update policy
        await conn.execute(
            """
            UPDATE insurance_policies
            SET underwriting_score = $1, updated_at = CURRENT_TIMESTAMP
            WHERE policy_id = $2
        """,
            risk_score,
            policy_id,
        )


@app.get("/api/v1/insurance/policies/all")
async def list_policies(
    status: Optional[PolicyStatus] = None,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """List all insurance policies"""
    query = "SELECT * FROM insurance_policies WHERE tenant_id = $1"
    params = [tenant_id]

    if status:
        query += " AND status = $2"
        params.append(status.value)

    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {"policies": [dict(row) for row in rows], "total": len(rows)}


@app.get("/api/v1/insurance/policies/{policy_id}")
async def get_policy(
    policy_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Get policy details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            policy_id,
            tenant_id,
        )
        if not row:
            raise_http_exception_handler(404, "Policy not found", "INS-INS-NOT-4040")
        return dict(row)


@app.post("/api/v1/administration/insurance/policies/{policy_id}/activate")
async def activate_policy(
    policy_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Activate insurance policy after payment"""
    policy_number = f"INS{int(datetime.now().timestamp())}"
    start_date = datetime.now().date()

    async with db.acquire() as conn:
        # Get policy duration
        policy = await conn.fetchrow(
            """
            SELECT duration_months FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            policy_id,
            tenant_id,
        )
        if not policy:
            raise_http_exception_handler(404, "Policy not found", "INS-INS-NOT-4040")

        end_date = start_date + timedelta(days=30 * policy["duration_months"])

        # Activate policy
        await conn.execute(
            """
            UPDATE insurance_policies
            SET status = 'active', policy_number = $1, start_date = $2,
                end_date = $3, updated_at = CURRENT_TIMESTAMP
            WHERE policy_id = $4 AND tenant_id = $5
        """,
            policy_number,
            start_date,
            end_date,
            policy_id,
            tenant_id,
        )

    return {
        "status": "activated",
        "policy_id": policy_id,
        "policy_number": policy_number,
        "start_date": start_date,
        "end_date": end_date,
    }


@app.post("/api/v1/administration/insurance/policies/{policy_id}/deactivate")
async def deactivate_policy(
    policy_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Deactivate insurance policy"""
    policy_number = f"INS{int(datetime.now().timestamp())}"
    start_date = datetime.now().date()

    async with db.acquire() as conn:
        # Get policy duration
        policy = await conn.fetchrow(
            """
            SELECT duration_months FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            policy_id,
            tenant_id,
        )
        if not policy:
            raise_http_exception_handler(404, "Policy not found", "INS-INS-NOT-4040")

        end_date = start_date + timedelta(days=30 * policy["duration_months"])

        # Activate policy
        await conn.execute(
            """
            UPDATE insurance_policies
            SET status = 'inactive', policy_number = $1, start_date = $2,
                end_date = $3, updated_at = CURRENT_TIMESTAMP
            WHERE policy_id = $4 AND tenant_id = $5
        """,
            policy_number,
            start_date,
            end_date,
            policy_id,
            tenant_id,
        )

    return {
        "status": "deactivated",
        "policy_id": policy_id,
        "policy_number": policy_number,
        "start_date": start_date,
        "end_date": end_date,
    }


@app.get("/api/v1/insurance/policies/customer/all")
async def list_customer_policies(
    status: Optional[PolicyStatus] = None,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """List customer policies"""
    query = "SELECT * FROM insurance_policies WHERE customer_id = $1 AND tenant_id = $2"
    params = [keycloak_id, tenant_id]

    if status:
        query += " AND status = $3"
        params.append(status.value)

    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "customer_id": keycloak_id,
            "policies": [dict(row) for row in rows],
            "total": len(rows),
        }


@app.post("/api/v1/insurance/claims/submit")
async def submit_claim(
    claim: ClaimSubmission,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Submit insurance claim"""
    claim_id = f"CLM{int(datetime.now().timestamp())}"

    async with db.acquire() as conn:
        # Verify policy is active
        policy = await conn.fetchrow(
            """
            SELECT status, coverage_amount FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            claim.policy_id,
            tenant_id,
        )

        if not policy:
            raise_http_exception_handler(404, "Policy not found", "INS-INS-NOT-4040")

        if policy["status"] != "active":
            raise_http_exception_handler(
                400, "Policy is not active", "INS-INS-BAD-4001"
            )

        if claim.claim_amount > policy["coverage_amount"]:
            raise_http_exception_handler(
                400, "Claim amount exceeds coverage amount", "INS-INS-BAD-4001"
            )

        # Submit claim
        await conn.execute(
            """
            INSERT INTO insurance_claims (
                claim_id, policy_id, claim_amount, incident_date,
                incident_description, supporting_documents, status, tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted', $7)
        """,
            claim_id,
            claim.policy_id,
            claim.claim_amount,
            claim.incident_date,
            claim.incident_description,
            json.dumps(claim.supporting_documents),
            tenant_id,
        )

    return {
        "status": "submitted",
        "claim_id": claim_id,
        "policy_id": claim.policy_id,
        "claim_amount": float(claim.claim_amount),
        "submitted_at": datetime.now(),
    }


@app.get("/api/v1/insurance/claims/all")
async def list_all_claims(
    status: Optional[ClaimStatus] = None,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """List all insurance claims"""
    query = "SELECT * FROM insurance_claims WHERE tenant_id = $1"
    params = [tenant_id]

    if status:
        query += " AND status = $2"
        params.append(status.value)

    query += " ORDER BY created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {"claims": [dict(row) for row in rows], "total": len(rows)}


@app.get("/api/v1/insurance/claims/customer/all")
async def list_customer_claims(
    status: Optional[ClaimStatus] = None,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """List customer claims"""
    query = """
        SELECT ic.*
        FROM insurance_claims ic
        JOIN insurance_policies ip ON ic.policy_id = ip.policy_id
        WHERE ip.customer_id = $1 AND ic.tenant_id = $2
    """
    params = [keycloak_id, tenant_id]

    if status:
        query += " AND ic.status = $3"
        params.append(status.value)

    query += " ORDER BY ic.created_at DESC"

    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "customer_id": keycloak_id,
            "claims": [dict(row) for row in rows],
            "total": len(rows),
        }


@app.get("/api/v1/insurance/claims/{claim_id}")
async def get_claim(
    claim_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Get claim details"""
    async with db.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM insurance_claims WHERE claim_id = $1 AND tenant_id = $2
        """,
            claim_id,
            tenant_id,
        )
        if not row:
            raise_http_exception_handler(404, "Claim not found", "INS-INS-NOT-4040")
        return dict(row)


@app.post("/api/v1/administration/insurance/claims/{claim_id}/review")
async def review_claim(
    claim_id: str,
    review: ClaimReview,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    staff_id: str = Header(..., alias="x-staff-id"),
):
    """Review and decide on claim"""
    async with db.acquire() as conn:
        if review.decision == ClaimStatus.APPROVED:
            if not review.approved_amount:
                raise_http_exception_handler(
                    400, "Approved amount required for approval", "INS-INS-BAD-4001"
                )

            await conn.execute(
                """
                UPDATE insurance_claims
                SET status = $1, approved_amount = $2, reviewed_by = $3,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE claim_id = $4 AND tenant_id = $5
            """,
                review.decision.value,
                review.approved_amount,
                staff_id,
                claim_id,
                tenant_id,
            )

        elif review.decision == ClaimStatus.REJECTED:
            await conn.execute(
                """
                UPDATE insurance_claims
                SET status = $1, reviewed_by = $2, rejection_reason = $3,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE claim_id = $4 AND tenant_id = $5
            """,
                review.decision.value,
                staff_id,
                review.rejection_reason,
                claim_id,
                tenant_id,
            )

        else:
            await conn.execute(
                """
                UPDATE insurance_claims
                SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
                WHERE claim_id = $3
            """,
                review.decision.value,
                staff_id,
                claim_id,
                tenant_id,
            )

    return {
        "status": "reviewed",
        "claim_id": claim_id,
        "decision": review.decision.value,
        "reviewed_by": staff_id,
        "reviewed_at": datetime.now(),
    }


@app.post("/api/v1/administration/insurance/claims/{claim_id}/pay")
async def pay_claim(
    claim_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
    ledger_id: str = Header(..., alias="x-ledger-id"),
    mint_account_id: str = Header(..., alias="x-mint-account-id"),
    staff_id: str = Header(..., alias="x-staff-id"),
):
    """Process claim payment"""

    context = Context(
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
        ledger_id=ledger_id,
        mint_account_id=mint_account_id,
    )

    async with db.acquire() as conn:
        # Get claim details
        claim = await conn.fetchrow(
            """
            SELECT * FROM insurance_claims WHERE claim_id = $1 AND tenant_id = $2
        """,
            claim_id,
            tenant_id,
        )

        if not claim:
            raise_http_exception_handler(404, "Claim not found", "INS-INS-NOT-4040")

        if claim["status"] != "approved":
            raise_http_exception_handler(400, "Claim not approved", "INS-INS-BAD-4001")

        policy = await conn.fetchrow(
            """
            SELECT * FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            claim["policy_id"],
            tenant_id,
        )

        if policy["status"] != "active":
            raise_http_exception_handler(
                400, "Insurance policy is not active", "INS-INS-BAD-4001"
            )

        payment_service_adapter = PaymentServiceAdapter()

        payment = payment_service_adapter.process_payment(
            recipient=policy["customer_id"],
            amount=float(claim["approved_amount"]),
            note="INSURANCE CLAIM PAYOUT",
            context=context,
        )

        print(f"Payment response: {payment}")

        if payment.get("message", "") != "success":
            raise_http_exception_handler(
                500, "Payment processing failed", "INS-INS-INT-5001"
            )

        # Mark as paid
        await conn.execute(
            """
            UPDATE insurance_claims
            SET status = 'paid', paid_at = CURRENT_TIMESTAMP
            WHERE claim_id = $1 AND tenant_id = $2
        """,
            claim_id,
            tenant_id,
        )

    return {
        "status": "paid",
        "claim_id": claim_id,
        "amount": float(claim["approved_amount"]),
        "payment_reference": payment.get("reference"),
        "paid_at": datetime.now(),
    }


@app.get("/api/v1/insurance/claims/policy/{policy_id}")
async def list_policy_claims(
    policy_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """List claims for a policy"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM insurance_claims
            WHERE policy_id = $1
            AND tenant_id = $2
            ORDER BY created_at DESC
        """,
            policy_id,
            tenant_id,
        )

        total_claimed = sum(float(row["claim_amount"]) for row in rows)
        total_paid = sum(
            float(row["approved_amount"] or 0)
            for row in rows
            if row["status"] == "paid"
        )

        return {
            "policy_id": policy_id,
            "claims": [dict(row) for row in rows],
            "total": len(rows),
            "total_claimed": total_claimed,
            "total_paid": total_paid,
        }


@app.post("/api/v1/system/insurance/premiums/record-payment/{policy_id}")
async def pay_premium(
    policy_id: str,
    payment: RecordPremiumPayment,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Record premium payment"""

    async with db.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO premium_payments (
                payment_id, policy_id, amount, payment_date, payment_method, tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """,
            payment.transaction_id,
            policy_id,
            payment.amount,
            datetime.fromisoformat(payment.payment_date),
            payment.payment_method,
            tenant_id,
        )

    return {
        "status": "success",
        "reference": payment.transaction_id,
        "policy_id": policy_id,
        "amount": payment.amount,
        "paid_at": payment.payment_date,
    }


@app.get("/api/v1/insurance/premiums/policy/{policy_id}")
async def list_premium_payments(
    policy_id: str,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """List premium payments for policy"""
    async with db.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT * FROM premium_payments
            WHERE policy_id = $1
            AND tenant_id = $2
            ORDER BY payment_date DESC
        """,
            policy_id,
            tenant_id,
        )

        total_paid = sum(float(row["amount"]) for row in rows)

        return {
            "policy_id": policy_id,
            "payments": [dict(row) for row in rows],
            "total": len(rows),
            "total_paid": total_paid,
        }


@app.post("/api/v1/insurance/policies/{policy_id}/renew")
async def renew_policy(
    policy_id: str,
    duration_months: int,
    db=Depends(lambda: db_pool),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Renew insurance policy"""
    async with db.acquire() as conn:
        # Get current policy
        policy = await conn.fetchrow(
            """
            SELECT end_date, premium_amount, duration_months
            FROM insurance_policies WHERE policy_id = $1 AND tenant_id = $2
        """,
            policy_id,
            tenant_id,
        )

        if not policy:
            raise_http_exception_handler(404, "Policy not found", "INS-INS-NOT-4040")

        # Calculate new end date and premium
        new_end_date = policy["end_date"] + timedelta(days=30 * duration_months)
        renewal_premium = (
            policy["premium_amount"] / policy["duration_months"] * duration_months
        ).quantize(Decimal("0.01"))

        # Update policy
        await conn.execute(
            """
            UPDATE insurance_policies
            SET end_date = $1, duration_months = duration_months + $2,
                premium_amount = premium_amount + $3, updated_at = CURRENT_TIMESTAMP
            WHERE policy_id = $4 AND tenant_id = $5
        """,
            new_end_date,
            duration_months,
            renewal_premium,
            policy_id,
            tenant_id,
        )

    return {
        "status": "renewed",
        "policy_id": policy_id,
        "new_end_date": new_end_date,
        "renewal_premium": float(renewal_premium),
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8016)))
