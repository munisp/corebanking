"""
Merchant Settlement Module
Handles automated settlement calculations, processing, and payouts
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
import asyncpg
import json

from middleware_events import post_ledger_transfer, publish_domain_event

router = APIRouter(prefix="/api/v1/merchants", tags=["Settlement"])

class SettlementFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"

class SettlementStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class SettlementCreate(BaseModel):
    merchant_id: str
    settlement_period_start: datetime
    settlement_period_end: datetime
    bank_account_number: str
    bank_code: str
    account_name: str

class SettlementConfig(BaseModel):
    merchant_id: str
    settlement_frequency: SettlementFrequency
    settlement_day: Optional[int] = None  # Day of week (1-7) or month (1-31)
    auto_settlement: bool = True
    minimum_settlement_amount: Decimal = Decimal("1000.00")
    bank_account_number: str
    bank_code: str
    account_name: str

class SettlementAdjustment(BaseModel):
    settlement_id: str
    adjustment_type: str  # refund, chargeback, fee_adjustment
    amount: Decimal
    reason: str
    reference: Optional[str] = None

@router.post("/{merchant_id}/settlements/calculate")
async def calculate_settlement(
    merchant_id: str,
    period_start: datetime,
    period_end: datetime,
    db: asyncpg.Pool = Depends()
):
    """Calculate settlement amount for a given period"""
    async with db.acquire() as conn:
        # Verify merchant exists
        merchant = await conn.fetchrow(
            "SELECT * FROM merchants WHERE merchant_id = $1",
            merchant_id
        )
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        # Get fee configuration
        fee_config = await conn.fetchrow(
            "SELECT * FROM merchant_fee_config WHERE merchant_id = $1",
            merchant_id
        )
        
        transaction_fee_pct = fee_config['transaction_fee_pct'] if fee_config else Decimal("2.5")
        fixed_fee = fee_config['fixed_fee'] if fee_config else Decimal("0")
        settlement_fee = fee_config['settlement_fee'] if fee_config else Decimal("0")
        
        # Get transactions for the period
        transactions = await conn.fetch("""
            SELECT 
                transaction_id,
                amount,
                status,
                created_at
            FROM merchant_transactions
            WHERE merchant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'successful'
            ORDER BY created_at
        """, merchant_id, period_start, period_end)
        
        # Calculate totals
        total_transactions = len(transactions)
        gross_amount = sum(Decimal(str(t['amount'])) for t in transactions)
        
        # Calculate fees
        transaction_fees = (gross_amount * transaction_fee_pct / 100) + (fixed_fee * total_transactions)
        total_fees = transaction_fees + settlement_fee
        
        # Get refunds and chargebacks
        refunds = await conn.fetch("""
            SELECT COALESCE(SUM(amount), 0) as total
            FROM merchant_refunds
            WHERE merchant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'completed'
        """, merchant_id, period_start, period_end)
        
        chargebacks = await conn.fetch("""
            SELECT COALESCE(SUM(dispute_amount), 0) as total,
                   COUNT(*) as count
            FROM merchant_disputes
            WHERE merchant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'resolved'
                AND resolution = 'chargeback'
        """, merchant_id, period_start, period_end)
        
        refund_amount = Decimal(str(refunds[0]['total'])) if refunds else Decimal("0")
        chargeback_amount = Decimal(str(chargebacks[0]['total'])) if chargebacks else Decimal("0")
        chargeback_count = chargebacks[0]['count'] if chargebacks else 0
        
        # Calculate chargeback fees
        chargeback_fee = fee_config['chargeback_fee'] if fee_config else Decimal("2500")
        total_chargeback_fees = chargeback_fee * chargeback_count
        
        # Calculate net amount
        net_amount = gross_amount - total_fees - refund_amount - chargeback_amount - total_chargeback_fees
        
        return {
            "merchant_id": merchant_id,
            "period_start": period_start,
            "period_end": period_end,
            "summary": {
                "total_transactions": total_transactions,
                "gross_amount": float(gross_amount),
                "transaction_fees": float(transaction_fees),
                "settlement_fee": float(settlement_fee),
                "refunds": float(refund_amount),
                "chargebacks": float(chargeback_amount),
                "chargeback_count": chargeback_count,
                "chargeback_fees": float(total_chargeback_fees),
                "total_fees": float(total_fees + total_chargeback_fees),
                "net_amount": float(net_amount)
            },
            "transactions": [
                {
                    "transaction_id": t['transaction_id'],
                    "amount": float(t['amount']),
                    "created_at": t['created_at']
                }
                for t in transactions
            ]
        }

@router.post("/{merchant_id}/settlements/create")
async def create_settlement(
    merchant_id: str,
    settlement: SettlementCreate,
    db: asyncpg.Pool = Depends()
):
    """Create a new settlement for processing"""
    async with db.acquire() as conn:
        # Calculate settlement
        calc_result = await calculate_settlement(
            merchant_id,
            settlement.settlement_period_start,
            settlement.settlement_period_end,
            db
        )
        
        summary = calc_result['summary']
        
        # Generate settlement ID
        settlement_id = f"STL{int(datetime.now().timestamp())}"
        
        # Create settlement record
        row = await conn.fetchrow("""
            INSERT INTO merchant_settlements (
                settlement_id, merchant_id, settlement_period_start, settlement_period_end,
                total_transactions, gross_amount, fees_amount, net_amount,
                bank_account_number, bank_code, account_name, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
            RETURNING *
        """, settlement_id, merchant_id, settlement.settlement_period_start,
            settlement.settlement_period_end, summary['total_transactions'],
            summary['gross_amount'], summary['total_fees'], summary['net_amount'],
            settlement.bank_account_number, settlement.bank_code, settlement.account_name)
        
        await publish_domain_event("merchant.settlement.created", merchant_id, {
            "settlement_id": settlement_id,
            "merchant_id": merchant_id,
            "net_amount": summary['net_amount'],
        })
        return {
            "status": "created",
            "settlement": dict(row),
            "summary": summary
        }

@router.post("/{merchant_id}/settlements/{settlement_id}/process")
async def process_settlement(
    merchant_id: str,
    settlement_id: str,
    db: asyncpg.Pool = Depends()
):
    """Process a pending settlement"""
    async with db.acquire() as conn:
        # Get settlement
        settlement = await conn.fetchrow("""
            SELECT * FROM merchant_settlements
            WHERE settlement_id = $1 AND merchant_id = $2
        """, settlement_id, merchant_id)
        
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        
        if settlement['status'] != 'pending':
            raise HTTPException(
                status_code=400,
                detail=f"Settlement cannot be processed. Current status: {settlement['status']}"
            )
        
        # Update status to processing
        await conn.execute("""
            UPDATE merchant_settlements
            SET status = 'processing', updated_at = CURRENT_TIMESTAMP
            WHERE settlement_id = $1
        """, settlement_id)
        
        # Simulate payment processing (would integrate with payment gateway)
        # In production, this would call bank API to initiate transfer
        try:
            # Simulate successful processing
            await conn.execute("""
                UPDATE merchant_settlements
                SET status = 'completed', processed_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE settlement_id = $1
            """, settlement_id)
            
            # Record payout transaction
            await conn.execute("""
                INSERT INTO merchant_payouts (
                    settlement_id, merchant_id, amount, bank_account_number,
                    bank_code, account_name, status
                ) VALUES ($1, $2, $3, $4, $5, $6, 'completed')
            """, settlement_id, merchant_id, settlement['net_amount'],
                settlement['bank_account_number'], settlement['bank_code'],
                settlement['account_name'])
            
            # Post the payout to the ledger (Dr settlement payable, Cr cash) and
            # publish the settlement-completed event.
            await post_ledger_transfer(settlement_id, float(settlement['net_amount']), merchant_id)
            await publish_domain_event("merchant.settlement.completed", merchant_id, {
                "settlement_id": settlement_id,
                "merchant_id": merchant_id,
                "amount": float(settlement['net_amount']),
            })
            return {
                "status": "completed",
                "settlement_id": settlement_id,
                "merchant_id": merchant_id,
                "amount": float(settlement['net_amount']),
                "processed_at": datetime.now()
            }
            
        except Exception as e:
            # Mark as failed
            await conn.execute("""
                UPDATE merchant_settlements
                SET status = 'failed', updated_at = CURRENT_TIMESTAMP
                WHERE settlement_id = $1
            """, settlement_id)
            
            raise HTTPException(
                status_code=500,
                detail=f"Settlement processing failed: {str(e)}"
            )

@router.get("/{merchant_id}/settlements")
async def list_settlements(
    merchant_id: str,
    status: Optional[SettlementStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: asyncpg.Pool = Depends()
):
    """List settlements for a merchant"""
    query = "SELECT * FROM merchant_settlements WHERE merchant_id = $1"
    params = [merchant_id]
    param_count = 2
    
    if status:
        query += f" AND status = ${param_count}"
        params.append(status.value)
        param_count += 1
    
    if start_date:
        query += f" AND created_at >= ${param_count}"
        params.append(start_date)
        param_count += 1
    
    if end_date:
        query += f" AND created_at <= ${param_count}"
        params.append(end_date)
        param_count += 1
    
    query += f" ORDER BY created_at DESC LIMIT ${param_count} OFFSET ${param_count + 1}"
    params.extend([limit, skip])
    
    async with db.acquire() as conn:
        rows = await conn.fetch(query, *params)
        return {
            "merchant_id": merchant_id,
            "settlements": [dict(row) for row in rows],
            "total": len(rows),
            "skip": skip,
            "limit": limit
        }

@router.get("/{merchant_id}/settlements/{settlement_id}")
async def get_settlement(
    merchant_id: str,
    settlement_id: str,
    db: asyncpg.Pool = Depends()
):
    """Get settlement details"""
    async with db.acquire() as conn:
        settlement = await conn.fetchrow("""
            SELECT * FROM merchant_settlements
            WHERE settlement_id = $1 AND merchant_id = $2
        """, settlement_id, merchant_id)
        
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        
        # Get associated transactions
        transactions = await conn.fetch("""
            SELECT transaction_id, amount, created_at
            FROM merchant_transactions
            WHERE merchant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'successful'
        """, merchant_id, settlement['settlement_period_start'],
            settlement['settlement_period_end'])
        
        return {
            "settlement": dict(settlement),
            "transactions": [dict(t) for t in transactions]
        }

@router.post("/{merchant_id}/settlements/config")
async def set_settlement_config(
    merchant_id: str,
    config: SettlementConfig,
    db: asyncpg.Pool = Depends()
):
    """Configure settlement preferences for merchant"""
    async with db.acquire() as conn:
        # Verify merchant exists
        merchant = await conn.fetchrow(
            "SELECT * FROM merchants WHERE merchant_id = $1",
            merchant_id
        )
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        
        # Upsert settlement configuration
        await conn.execute("""
            INSERT INTO merchant_settlement_config (
                merchant_id, settlement_frequency, settlement_day, auto_settlement,
                minimum_settlement_amount, bank_account_number, bank_code, account_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (merchant_id)
            DO UPDATE SET
                settlement_frequency = EXCLUDED.settlement_frequency,
                settlement_day = EXCLUDED.settlement_day,
                auto_settlement = EXCLUDED.auto_settlement,
                minimum_settlement_amount = EXCLUDED.minimum_settlement_amount,
                bank_account_number = EXCLUDED.bank_account_number,
                bank_code = EXCLUDED.bank_code,
                account_name = EXCLUDED.account_name,
                updated_at = CURRENT_TIMESTAMP
        """, merchant_id, config.settlement_frequency.value, config.settlement_day,
            config.auto_settlement, config.minimum_settlement_amount,
            config.bank_account_number, config.bank_code, config.account_name)
        
        return {
            "status": "configured",
            "merchant_id": merchant_id,
            "config": config.dict()
        }

@router.get("/{merchant_id}/settlements/config")
async def get_settlement_config(merchant_id: str, db: asyncpg.Pool = Depends()):
    """Get settlement configuration for merchant"""
    async with db.acquire() as conn:
        config = await conn.fetchrow("""
            SELECT * FROM merchant_settlement_config
            WHERE merchant_id = $1
        """, merchant_id)
        
        if not config:
            return {
                "merchant_id": merchant_id,
                "message": "No settlement configuration found",
                "default_config": {
                    "settlement_frequency": "weekly",
                    "auto_settlement": True,
                    "minimum_settlement_amount": 1000.00
                }
            }
        
        return {
            "merchant_id": merchant_id,
            "config": dict(config)
        }

@router.post("/{merchant_id}/settlements/{settlement_id}/adjust")
async def adjust_settlement(
    merchant_id: str,
    settlement_id: str,
    adjustment: SettlementAdjustment,
    db: asyncpg.Pool = Depends()
):
    """Apply adjustment to a settlement"""
    async with db.acquire() as conn:
        # Get settlement
        settlement = await conn.fetchrow("""
            SELECT * FROM merchant_settlements
            WHERE settlement_id = $1 AND merchant_id = $2
        """, settlement_id, merchant_id)
        
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        
        if settlement['status'] == 'completed':
            raise HTTPException(
                status_code=400,
                detail="Cannot adjust completed settlement"
            )
        
        # Record adjustment
        await conn.execute("""
            INSERT INTO merchant_settlement_adjustments (
                settlement_id, merchant_id, adjustment_type, amount, reason, reference
            ) VALUES ($1, $2, $3, $4, $5, $6)
        """, settlement_id, merchant_id, adjustment.adjustment_type,
            adjustment.amount, adjustment.reason, adjustment.reference)
        
        # Update settlement net amount
        new_net_amount = Decimal(str(settlement['net_amount'])) - adjustment.amount
        
        await conn.execute("""
            UPDATE merchant_settlements
            SET net_amount = $1, updated_at = CURRENT_TIMESTAMP
            WHERE settlement_id = $2
        """, new_net_amount, settlement_id)
        
        return {
            "status": "adjusted",
            "settlement_id": settlement_id,
            "adjustment": adjustment.dict(),
            "previous_amount": float(settlement['net_amount']),
            "new_amount": float(new_net_amount)
        }

# Database schema additions
async def create_settlement_tables(conn: asyncpg.Connection):
    """Create settlement-related tables"""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS merchant_transactions (
            id SERIAL PRIMARY KEY,
            transaction_id VARCHAR(50) UNIQUE NOT NULL,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            amount DECIMAL(15,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'NGN',
            status VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_transactions_merchant_date ON merchant_transactions(merchant_id, created_at);
        
        CREATE TABLE IF NOT EXISTS merchant_settlement_config (
            id SERIAL PRIMARY KEY,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE UNIQUE,
            settlement_frequency VARCHAR(20) DEFAULT 'weekly',
            settlement_day INT,
            auto_settlement BOOLEAN DEFAULT true,
            minimum_settlement_amount DECIMAL(15,2) DEFAULT 1000.00,
            bank_account_number VARCHAR(50),
            bank_code VARCHAR(20),
            account_name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS merchant_payouts (
            id SERIAL PRIMARY KEY,
            payout_id VARCHAR(50) UNIQUE NOT NULL DEFAULT 'PYT' || nextval('merchant_payouts_id_seq'),
            settlement_id VARCHAR(50) REFERENCES merchant_settlements(settlement_id),
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            amount DECIMAL(15,2) NOT NULL,
            bank_account_number VARCHAR(50),
            bank_code VARCHAR(20),
            account_name VARCHAR(255),
            status VARCHAR(20) DEFAULT 'pending',
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_payouts_merchant ON merchant_payouts(merchant_id);
        
        CREATE TABLE IF NOT EXISTS merchant_settlement_adjustments (
            id SERIAL PRIMARY KEY,
            settlement_id VARCHAR(50) REFERENCES merchant_settlements(settlement_id),
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            adjustment_type VARCHAR(50) NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            reason TEXT,
            reference VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS merchant_refunds (
            id SERIAL PRIMARY KEY,
            refund_id VARCHAR(50) UNIQUE NOT NULL,
            merchant_id VARCHAR(50) REFERENCES merchants(merchant_id) ON DELETE CASCADE,
            transaction_id VARCHAR(50),
            amount DECIMAL(15,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
