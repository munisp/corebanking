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
