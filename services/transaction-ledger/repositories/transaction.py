"""
Transaction Repository — Production Implementation

Double-entry bookkeeping is enforced on every financial event.
Every successful transaction MUST produce a balanced journal entry
in the Chart of Accounts service. A transaction that cannot post
its journal entry must NOT be recorded as successful.

Write ordering (durable-record-first):
  1. The transaction record is persisted FIRST, status=PENDING, with an
     atomic INSERT ... ON CONFLICT (tenant_id, transaction_id) DO NOTHING —
     no check-then-act race; duplicate Dapr deliveries collapse atomically.
  2. Only with a durable record in place is the journal entry posted to the
     GL. No GL posting ever happens without a durable record.
  3. On GL failure the record is marked GL_FAILED and a row is written to
     the GL posting outbox (same DB transaction) for retry. The transaction
     is only moved to its final state after a confirmed GL post.

Money is integer minor units (kobo) at the GL boundary; amounts are strictly
validated (positive, <=2dp, bounded) at the schema boundary and again here.
"""

from __future__ import annotations

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, Numeric
from sqlalchemy.dialects.postgresql import insert as pg_insert
import datetime

from schemas import TransactionEventSchema, Pagination, Context
from models import Transaction, GLPostingOutbox
from adapters import AccountServiceAdapter
from utils.coa_client import CoAClient
from utils import TransactionStatus, AccountLookupError
from utils.config import MAX_TRANSACTION_AMOUNT_NAIRA

logger = logging.getLogger(__name__)

# CoA account codes for double-entry routing
# These must match the chart-of-accounts-service seed data / tenant COA setup
COA_CUSTOMER_DEPOSITS_CODE = "2100"   # Liability: Customer Deposits
COA_MINT_SUSPENSE_CODE = "2900"       # Liability: Mint/System Suspense
COA_INTER_BANK_NOSTRO_CODE = "1150"   # Asset: Interbank Nostro


_MAX_AMOUNT_KOBO = int(MAX_TRANSACTION_AMOUNT_NAIRA * 100)


def _to_kobo(amount_str: str) -> int:
    """Convert string amount (in Naira) to integer kobo for GL posting.

    All monetary amounts inside the GL must be integers in the smallest
    denomination (kobo for NGN) to avoid floating-point rounding errors.

    Strict validation (defense in depth behind the schema boundary):
    negative, zero, unbounded or non-parseable amounts are rejected — they
    must never reach the GL (e.g. via sign-flipped journals).
    """
    try:
        d = Decimal(str(amount_str)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except Exception as exc:
        raise ValueError(f"Invalid amount: {exc.__class__.__name__}") from exc
    kobo = int(d * 100)
    if kobo <= 0:
        raise ValueError("Amount must be greater than zero")
    if kobo > _MAX_AMOUNT_KOBO:
        raise ValueError("Amount exceeds the configured maximum")
    return kobo


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

        Ordering guarantee: the durable DB record (status=PENDING) is written
        FIRST, atomically (INSERT ... ON CONFLICT DO NOTHING), then the GL
        journal entry is posted. On GL failure the record is marked GL_FAILED
        and a GL-posting outbox row is written for retry — the transaction is
        never left without a durable record and never marked successful
        without a confirmed GL post.

        Idempotent: the (tenant_id, transaction_id) unique constraint makes
        the insert race-free; duplicate deliveries return the existing record
        (retrying the GL post if a previous attempt failed).

        Raises:
            ValueError: If amount is invalid (negative/zero/unbounded).
            Exception: If GL posting fails after the record was durably
                       persisted (status=GL_FAILED, outbox row written).
        """
        amount_kobo = _to_kobo(payload.amount)

        context = Context(tenant_id=payload.tenant_id)

        # Resolve human-readable account metadata from account-service.
        # Failures here are non-fatal; we fall back to bare IDs.
        payer_meta = self._safe_get_account(payload.payer, context)
        payee_meta = self._safe_get_account(payload.payee, context)

        # STEP 1: Persist the durable record FIRST — atomic idempotency via
        # INSERT ... ON CONFLICT DO NOTHING (no check-then-act race).
        stmt = (
            pg_insert(Transaction)
            .values(
                transaction_id=payload.transaction_id,
                payer=payload.payer,
                payer_account_number=payer_meta.get("account", {}).get("account_number"),
                payer_name=payer_meta.get("account", {}).get("name"),
                payee=payload.payee,
                payee_account_number=payee_meta.get("account", {}).get("account_number"),
                payee_name=payee_meta.get("account", {}).get("name"),
                amount=Decimal(str(payload.amount)),
                status=TransactionStatus.PENDING,
                currency=payload.currency,
                completed_at=payload.completed_at,
                note=payload.note,
                tag=payload.tag,
                tenant_id=payload.tenant_id,
                ledger_id=payload.ledger_id,
            )
            .on_conflict_do_nothing(constraint="uq_transaction_tenant_txn_id")
            .returning(Transaction.id)
        )
        inserted_id = self._db.execute(stmt).scalar_one_or_none()

        if inserted_id is None:
            # Duplicate delivery — the record already exists. Never re-post a
            # confirmed GL entry; do retry a previously failed one (outbox).
            self._db.rollback()
            existing = self._get_existing(payload.tenant_id, payload.transaction_id)
            if existing is None:
                raise Exception("Transaction insert conflicted but no record found")
            logger.info(
                "Idempotent skip — transaction already exists "
                "transaction_id=%s tenant_id=%s",
                payload.transaction_id,
                payload.tenant_id,
            )
            if existing.status == TransactionStatus.GL_FAILED:
                await self._retry_gl_post(existing, payload)
            return existing

        self._db.commit()
        transaction = self._get_existing(payload.tenant_id, payload.transaction_id)

        # STEP 2: Post the journal entry to the Chart of Accounts service —
        # only now that a durable record exists.
        try:
            await self._post_journal(transaction, payload, amount_kobo, payer_meta, payee_meta)
        except Exception as exc:
            # Compensation: mark GL_FAILED + outbox row for retry, atomically.
            logger.error(
                "GL journal entry FAILED — record marked gl_failed "
                "transaction_id=%s tenant_id=%s error=%s",
                payload.transaction_id,
                payload.tenant_id,
                exc,
                exc_info=True,
            )
            self._mark_gl_failed(
                transaction, payload, amount_kobo, payer_meta, payee_meta, exc
            )
            raise Exception(
                "GL posting failed; transaction recorded as gl_failed "
                "and queued for retry"
            ) from exc

        # STEP 3: Only after a confirmed GL post move to the final state.
        transaction.gl_posted_at = datetime.datetime.now()
        transaction.status = payload.status
        self._db.commit()

        logger.info(
            "Transaction recorded with GL entry "
            "transaction_id=%s tenant_id=%s amount_kobo=%d",
            payload.transaction_id,
            payload.tenant_id,
            amount_kobo,
        )
        return transaction

    # ------------------------------------------------------------------
    # GL posting helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _journal_args(
        transaction_id: str,
        payer: str,
        payee: str,
        amount_kobo: int,
        payer_meta: dict,
        payee_meta: dict,
        note: Optional[str],
        ledger_id: Optional[str],
        tag: Optional[str],
        currency_value: str,
    ) -> dict:
        payer_code = _gl_account_code(str(payer))
        payee_code = _gl_account_code(str(payee))
        return dict(
            user_id="system",
            user_role="system",
            description=(
                note
                or f"Transfer {transaction_id[:8]} — "
                f"{payer_meta.get('account', {}).get('account_number', payer)} → "
                f"{payee_meta.get('account', {}).get('account_number', payee)}"
            ),
            lines=[
                {
                    "account_id": payer_code,
                    "description": (
                        f"Debit payer "
                        f"{payer_meta.get('account', {}).get('account_number', payer)}"
                    ),
                    "debit_amount": amount_kobo,
                    "credit_amount": 0,
                },
                {
                    "account_id": payee_code,
                    "description": (
                        f"Credit payee "
                        f"{payee_meta.get('account', {}).get('account_number', payee)}"
                    ),
                    "debit_amount": 0,
                    "credit_amount": amount_kobo,
                },
            ],
            reference=transaction_id,
            metadata={
                "ledger_id": ledger_id,
                "tag": tag,
                "currency": currency_value or "NGN",
                "channel": "dapr-event",
            },
        )

    async def _post_journal(
        self,
        transaction: Transaction,
        payload: TransactionEventSchema,
        amount_kobo: int,
        payer_meta: dict,
        payee_meta: dict,
    ) -> None:
        args = self._journal_args(
            transaction_id=transaction.transaction_id,
            payer=transaction.payer,
            payee=transaction.payee,
            amount_kobo=amount_kobo,
            payer_meta=payer_meta,
            payee_meta=payee_meta,
            note=payload.note,
            ledger_id=payload.ledger_id,
            tag=payload.tag,
            currency_value=payload.currency.value if payload.currency else "NGN",
        )
        await self._coa.create_journal_entry(tenant_id=transaction.tenant_id, **args)

    def _mark_gl_failed(
        self,
        transaction: Transaction,
        payload: TransactionEventSchema,
        amount_kobo: int,
        payer_meta: dict,
        payee_meta: dict,
        exc: Exception,
    ) -> None:
        """Atomically mark the record GL_FAILED and enqueue an outbox row."""
        entry_payload = self._journal_args(
            transaction_id=transaction.transaction_id,
            payer=transaction.payer,
            payee=transaction.payee,
            amount_kobo=amount_kobo,
            payer_meta=payer_meta,
            payee_meta=payee_meta,
            note=payload.note,
            ledger_id=payload.ledger_id,
            tag=payload.tag,
            currency_value=payload.currency.value if payload.currency else "NGN",
        )
        transaction.status = TransactionStatus.GL_FAILED
        self._db.add(
            GLPostingOutbox(
                transaction_id=transaction.transaction_id,
                tenant_id=transaction.tenant_id,
                entry_payload={
                    "tenant_id": transaction.tenant_id,
                    **entry_payload,
                },
                status="pending",
                attempts=0,
                last_error=f"{exc.__class__.__name__}",
            )
        )
        self._db.commit()

    async def _retry_gl_post(
        self, transaction: Transaction, payload: TransactionEventSchema
    ) -> None:
        """Retry the GL post for a record stuck in GL_FAILED (outbox drain)."""
        amount_kobo = _to_kobo(str(transaction.amount))
        context = Context(tenant_id=transaction.tenant_id)
        payer_meta = self._safe_get_account(transaction.payer, context)
        payee_meta = self._safe_get_account(transaction.payee, context)
        try:
            await self._post_journal(transaction, payload, amount_kobo, payer_meta, payee_meta)
        except Exception as exc:
            logger.error(
                "GL retry FAILED transaction_id=%s error=%s",
                transaction.transaction_id, exc, exc_info=True,
            )
            raise Exception("GL posting retry failed; still queued") from exc

        transaction.gl_posted_at = datetime.datetime.now()
        transaction.status = payload.status
        # Resolve pending outbox rows for this transaction.
        for row in (
            self._db.query(GLPostingOutbox)
            .filter(
                GLPostingOutbox.tenant_id == transaction.tenant_id,
                GLPostingOutbox.transaction_id == transaction.transaction_id,
                GLPostingOutbox.status == "pending",
            )
            .all()
        ):
            row.status = "done"
        self._db.commit()
        logger.info(
            "GL retry succeeded transaction_id=%s tenant_id=%s",
            transaction.transaction_id, transaction.tenant_id,
        )

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

        if transaction.gl_posted_at is not None:
            # Post a reversal entry only if the GL has actually seen this
            # transaction (keeps the GL balanced; no phantom reversals).
            await self._post_reversal(payload, reason="transaction-failed")

        transaction.status = TransactionStatus.FAILED
        # Cancel any pending GL outbox rows — a failed transaction must not
        # be posted to the GL later by the retry path.
        for row in (
            self._db.query(GLPostingOutbox)
            .filter(
                GLPostingOutbox.tenant_id == transaction.tenant_id,
                GLPostingOutbox.transaction_id == transaction.transaction_id,
                GLPostingOutbox.status == "pending",
            )
            .all()
        ):
            row.status = "cancelled"
        self._db.commit()
        logger.info(
            "Transaction marked FAILED transaction_id=%s tenant_id=%s",
            payload.transaction_id,
            payload.tenant_id,
        )

    async def mark_transaction_success(self, payload: TransactionEventSchema) -> None:
        """Mark an existing transaction as successful.

        Fail closed: a transaction whose GL journal entry has not been
        durably posted (gl_posted_at IS NULL — e.g. GL_FAILED or an
        out-of-order stub) is never marked SUCCESS. The GL post is attempted
        first; if it fails the record goes to GL_FAILED with an outbox row.
        """
        transaction = self._ensure_stub(payload)
        if transaction.status == TransactionStatus.FAILED:
            logger.error(
                "Attempt to mark already-FAILED transaction as SUCCESS "
                "transaction_id=%s — ignoring",
                payload.transaction_id,
            )
            return

        if transaction.gl_posted_at is None:
            amount_kobo = _to_kobo(str(transaction.amount))
            context = Context(tenant_id=transaction.tenant_id)
            payer_meta = self._safe_get_account(transaction.payer, context)
            payee_meta = self._safe_get_account(transaction.payee, context)
            try:
                await self._post_journal(
                    transaction, payload, amount_kobo, payer_meta, payee_meta
                )
            except Exception as exc:
                logger.error(
                    "GL post before SUCCESS failed transaction_id=%s error=%s",
                    payload.transaction_id, exc, exc_info=True,
                )
                self._mark_gl_failed(
                    transaction, payload, amount_kobo, payer_meta, payee_meta, exc
                )
                return
            transaction.gl_posted_at = datetime.datetime.now()
            for row in (
                self._db.query(GLPostingOutbox)
                .filter(
                    GLPostingOutbox.tenant_id == transaction.tenant_id,
                    GLPostingOutbox.transaction_id == transaction.transaction_id,
                    GLPostingOutbox.status == "pending",
                )
                .all()
            ):
                row.status = "done"

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
