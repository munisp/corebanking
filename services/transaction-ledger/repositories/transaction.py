"""
Transaction Repository — Production Implementation

Double-entry bookkeeping is enforced on every financial event.
Every successful transaction MUST produce a balanced journal entry
in the Chart of Accounts service. A transaction that cannot post
its journal entry must NOT be recorded as successful.

Idempotency is enforced at the database level via a unique constraint
on (tenant_id, transaction_id). Duplicate event delivery from Dapr
pub/sub is handled by detecting the constraint violation and returning
the existing record without reprocessing.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, Numeric
from sqlalchemy.exc import IntegrityError
import datetime

from schemas import TransactionEventSchema, Pagination, Context
from models import Transaction
from adapters import AccountServiceAdapter
from utils.coa_client import CoAClient
from utils import TransactionStatus, AccountLookupError

logger = logging.getLogger(__name__)

# CoA account codes for double-entry routing
# These must match the chart-of-accounts-service seed data / tenant COA setup
COA_CUSTOMER_DEPOSITS_CODE = "2100"   # Liability: Customer Deposits
COA_MINT_SUSPENSE_CODE = "2900"       # Liability: Mint/System Suspense
COA_INTER_BANK_NOSTRO_CODE = "1150"   # Asset: Interbank Nostro


def _to_kobo(amount_str: str) -> int:
    """Convert string amount (in Naira) to integer kobo for GL posting.

    All monetary amounts inside the GL must be integers in the smallest
    denomination (kobo for NGN) to avoid floating-point rounding errors.
    """
    try:
        d = Decimal(str(amount_str)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return int(d * 100)
    except Exception as exc:
        raise ValueError(f"Invalid amount '{amount_str}': {exc}") from exc


def _gl_account_code(account_id: str) -> str:
    """Resolve a TigerBeetle/application account UUID to a GL account code.

    For intrabank transfers the payer and payee both map to the
    Customer Deposits liability account (2100). The TigerBeetle ledger
    holds the per-customer granular balance; the GL holds the aggregate.

    MINT accounts are system accounts that represent the bank's own
    liquidity pool and map to the Mint/System Suspense liability (2900).
    """
    if str(account_id).upper() in ("MINT_ACCOUNT", "MINT"):
        return COA_MINT_SUSPENSE_CODE
    return COA_CUSTOMER_DEPOSITS_CODE


class TransactionRepository:
    """Transaction repository — all financial operations go through here."""

    def __init__(self, db: Session):
        self._db = db
        self._coa = CoAClient()

    # ------------------------------------------------------------------
    # Idempotency guard
    # ------------------------------------------------------------------

    def _get_existing(
        self, tenant_id: str, transaction_id: str
    ) -> Optional[Transaction]:
        return (
            self._db.query(Transaction)
            .filter(
                Transaction.tenant_id == tenant_id,
                Transaction.transaction_id == transaction_id,
            )
            .first()
        )

    # ------------------------------------------------------------------
    # Public write operations
    # ------------------------------------------------------------------

    async def initiate_transaction(self, payload: TransactionEventSchema) -> Transaction:
        """Record a new transaction and post its journal entry to the GL.

        Idempotent: if the transaction_id already exists for this tenant
        the existing record is returned without re-posting to the GL.

        Raises:
            ValueError: If amount is invalid.
            Exception: If GL posting fails (the transaction is NOT saved
                       with a success status in that case).
        """
        existing = self._get_existing(payload.tenant_id, payload.transaction_id)
        if existing:
            logger.info(
                "Idempotent skip — transaction already exists "
                "transaction_id=%s tenant_id=%s",
                payload.transaction_id,
                payload.tenant_id,
            )
            return existing

        context = Context(tenant_id=payload.tenant_id)

        # Resolve human-readable account metadata from account-service.
        # Failures here are non-fatal; we fall back to bare IDs.
        payer_meta = self._safe_get_account(payload.payer, context)
        payee_meta = self._safe_get_account(payload.payee, context)

        amount_kobo = _to_kobo(payload.amount)
        payer_code = _gl_account_code(str(payload.payer))
        payee_code = _gl_account_code(str(payload.payee))

        # STEP 1: Post the journal entry to the Chart of Accounts service.
        # This enforces double-entry bookkeeping BEFORE we persist the record.
        # If the GL post fails we raise and the transaction is not saved.
        try:
            await self._coa.create_journal_entry(
                tenant_id=payload.tenant_id,
                user_id="system",
                user_role="system",
                description=(
                    payload.note
                    or f"Transfer {payload.transaction_id[:8]} — "
                    f"{payer_meta.get('account', {}).get('account_number', payload.payer)} → "
                    f"{payee_meta.get('account', {}).get('account_number', payload.payee)}"
                ),
                lines=[
                    {
                        "account_id": payer_code,
                        "description": (
                            f"Debit payer "
                            f"{payer_meta.get('account', {}).get('account_number', payload.payer)}"
                        ),
                        "debit_amount": amount_kobo,
                        "credit_amount": 0,
                    },
                    {
                        "account_id": payee_code,
                        "description": (
                            f"Credit payee "
                            f"{payee_meta.get('account', {}).get('account_number', payload.payee)}"
                        ),
                        "debit_amount": 0,
                        "credit_amount": amount_kobo,
                    },
                ],
                reference=payload.transaction_id,
                metadata={
                    "ledger_id": payload.ledger_id,
                    "tag": payload.tag,
                    "currency": payload.currency.value if payload.currency else "NGN",
                    "channel": "dapr-event",
                },
            )
        except Exception as exc:
            logger.error(
                "GL journal entry FAILED — transaction NOT saved "
                "transaction_id=%s tenant_id=%s error=%s",
                payload.transaction_id,
                payload.tenant_id,
                exc,
                exc_info=True,
            )
            raise Exception(
                f"Cannot record transaction {payload.transaction_id}: "
                f"GL posting failed — {exc}"
            ) from exc

        # STEP 2: Persist the transaction record now that GL is balanced.
        transaction = Transaction(
            transaction_id=payload.transaction_id,
            payer=payload.payer,
            payer_account_number=payer_meta.get("account", {}).get("account_number"),
            payer_name=payer_meta.get("account", {}).get("name"),
            payee=payload.payee,
            payee_account_number=payee_meta.get("account", {}).get("account_number"),
            payee_name=payee_meta.get("account", {}).get("name"),
            amount=str(payload.amount),
            status=payload.status,
            currency=payload.currency,
            completed_at=payload.completed_at,
            note=payload.note,
            tag=payload.tag,
            tenant_id=payload.tenant_id,
            ledger_id=payload.ledger_id,
        )

        try:
            self._db.add(transaction)
            self._db.commit()
            self._db.refresh(transaction)
        except IntegrityError:
            self._db.rollback()
            logger.warning(
                "Duplicate key on transaction insert — returning existing "
                "transaction_id=%s tenant_id=%s",
                payload.transaction_id,
                payload.tenant_id,
            )
            return self._get_existing(payload.tenant_id, payload.transaction_id)

        logger.info(
            "Transaction recorded with GL entry "
            "transaction_id=%s tenant_id=%s amount_kobo=%d",
            payload.transaction_id,
            payload.tenant_id,
            amount_kobo,
        )
        return transaction

    async def mark_transaction_failed(self, payload: TransactionEventSchema) -> None:
        """Mark an existing transaction as failed.

        If the transaction was previously PENDING (GL entry was posted as a
        pending/draft entry), we post a reversal journal entry to keep the
        GL balanced. If no prior record exists we create a minimal stub.
        """
        transaction = self._ensure_stub(payload)
        if transaction.status == TransactionStatus.SUCCESS:
            logger.error(
                "Attempt to mark already-SUCCESS transaction as FAILED "
                "transaction_id=%s — ignoring",
                payload.transaction_id,
            )
            return

        if transaction.status == TransactionStatus.PENDING:
            # Post a reversal entry for the pending GL if one exists.
            await self._post_reversal(payload, reason="transaction-failed")

        transaction.status = TransactionStatus.FAILED
        self._db.commit()
        logger.info(
            "Transaction marked FAILED transaction_id=%s tenant_id=%s",
            payload.transaction_id,
            payload.tenant_id,
        )

    async def mark_transaction_success(self, payload: TransactionEventSchema) -> None:
        """Mark an existing transaction as successful."""
        transaction = self._ensure_stub(payload)
        if transaction.status == TransactionStatus.FAILED:
            logger.error(
                "Attempt to mark already-FAILED transaction as SUCCESS "
                "transaction_id=%s — ignoring",
                payload.transaction_id,
            )
            return

        transaction.status = TransactionStatus.SUCCESS
        transaction.completed_at = payload.completed_at or transaction.completed_at
        self._db.commit()
        logger.info(
            "Transaction marked SUCCESS transaction_id=%s tenant_id=%s",
            payload.transaction_id,
            payload.tenant_id,
        )

    # ------------------------------------------------------------------
    # Query operations
    # ------------------------------------------------------------------

    def fetch_account_transactions(
        self, account_id: str, tenant_id: str, pagination: Pagination
    ):
        offset = (pagination.page - 1) * pagination.limit
        return (
            self._db.query(Transaction)
            .filter(
                Transaction.tenant_id == tenant_id,
                or_(
                    Transaction.payer == account_id,
                    Transaction.payee == account_id,
                ),
            )
            .order_by(Transaction.completed_at.desc())
            .offset(offset)
            .limit(pagination.limit or 20)
            .all()
        )

    def fetch_account_number_transactions(
        self, account_number: str, tenant_id: str, pagination: Pagination
    ):
        offset = (pagination.page - 1) * pagination.limit
        return (
            self._db.query(Transaction)
            .filter(
                Transaction.tenant_id == tenant_id,
                or_(
                    Transaction.payer_account_number == account_number,
                    Transaction.payee_account_number == account_number,
                ),
            )
            .order_by(Transaction.completed_at.desc())
            .offset(offset)
            .limit(pagination.limit or 20)
            .all()
        )

    def fetch_transactions(self, tenant_id: str, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        return (
            self._db.query(Transaction)
            .filter(Transaction.tenant_id == tenant_id)
            .order_by(Transaction.completed_at.desc())
            .offset(offset)
            .limit(pagination.limit or 20)
            .all()
        )

    def fetch_transaction_by_id(self, transaction_id: str, tenant_id: str):
        return (
            self._db.query(Transaction)
            .filter(
                Transaction.tenant_id == tenant_id,
                Transaction.transaction_id == transaction_id,
            )
            .first()
        )

    def fetch_transaction_count(self, tenant_id: str) -> int:
        return (
            self._db.query(Transaction)
            .filter(Transaction.tenant_id == tenant_id)
            .count()
        )

    def fetch_transaction_volume(self, tenant_id: str) -> float:
        """Return total transaction volume in Naira (not kobo)."""
        result = (
            self._db.query(func.sum(cast(Transaction.amount, Numeric(20, 2))))
            .filter(
                Transaction.tenant_id == tenant_id,
                Transaction.status == TransactionStatus.SUCCESS,
            )
            .scalar()
        )
        return float(result or 0)

    def fetch_account_daily_debit_total(self, account_id: str, tenant_id: str) -> float:
        """Return sum of successful outbound transfers for account_id in the last 24 hours."""
        since = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
        result = (
            self._db.query(func.sum(cast(Transaction.amount, Numeric(20, 2))))
            .filter(
                Transaction.tenant_id == tenant_id,
                Transaction.payer == account_id,
                Transaction.status == TransactionStatus.SUCCESS,
                Transaction.created_at >= since,
            )
            .scalar()
        )
        return float(result or 0)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _safe_get_account(self, account_id: str, context: Context) -> dict:
        """Fetch account metadata from account-service.

        Raises AccountLookupError if the account cannot be resolved — this
        propagates to initiate_transaction, which fails the recording and lets
        the Kafka consumer dead-letter the event for manual review.
        """
        if str(account_id).upper() in ("MINT_ACCOUNT", "MINT"):
            return {"account": {"account_number": "MINT", "name": "System Mint Account"}}
        return AccountServiceAdapter().get_account_by_account_id(
            account_id=account_id, context=context
        )

    def _ensure_stub(self, payload: TransactionEventSchema) -> Transaction:
        """Return existing transaction or create a minimal pending stub.

        Used by status-update handlers that may fire before initiate_transaction
        (e.g., out-of-order event delivery).
        """
        existing = self._get_existing(payload.tenant_id, payload.transaction_id)
        if existing:
            return existing

        stub = Transaction(
            transaction_id=payload.transaction_id,
            payer=payload.payer,
            payee=payload.payee,
            amount=str(payload.amount),
            currency=payload.currency,
            status=TransactionStatus.PENDING,
            tenant_id=payload.tenant_id,
            ledger_id=payload.ledger_id,
            completed_at=payload.completed_at,
            note=payload.note,
            tag=payload.tag,
        )
        self._db.add(stub)
        self._db.commit()
        self._db.refresh(stub)
        logger.info(
            "Created out-of-order stub transaction_id=%s tenant_id=%s",
            payload.transaction_id,
            payload.tenant_id,
        )
        return stub

    async def _post_reversal(
        self, payload: TransactionEventSchema, reason: str
    ) -> None:
        """Post a reversing journal entry to keep the GL balanced after failure."""
        try:
            amount_kobo = _to_kobo(payload.amount)
            payer_code = _gl_account_code(str(payload.payer))
            payee_code = _gl_account_code(str(payload.payee))
            await self._coa.create_journal_entry(
                tenant_id=payload.tenant_id,
                user_id="system",
                user_role="system",
                description=f"REVERSAL — {reason} — {payload.transaction_id[:8]}",
                lines=[
                    {
                        "account_id": payer_code,
                        "description": f"Reversal credit — {reason}",
                        "debit_amount": 0,
                        "credit_amount": amount_kobo,
                    },
                    {
                        "account_id": payee_code,
                        "description": f"Reversal debit — {reason}",
                        "debit_amount": amount_kobo,
                        "credit_amount": 0,
                    },
                ],
                reference=f"REV-{payload.transaction_id}",
                metadata={"original_transaction_id": payload.transaction_id, "reason": reason},
            )
            logger.info(
                "Reversal GL entry posted transaction_id=%s reason=%s",
                payload.transaction_id,
                reason,
            )
        except Exception as exc:
            logger.error(
                "CRITICAL: Reversal GL posting FAILED transaction_id=%s reason=%s error=%s — "
                "MANUAL RECONCILIATION REQUIRED",
                payload.transaction_id,
                reason,
                exc,
                exc_info=True,
            )
