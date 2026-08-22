"""
Transaction Model

amount is stored as NUMERIC(20,2) — never a String — to preserve
precision for all arithmetic operations and allow database-level
SUM/AVG without casting.

The (tenant_id, transaction_id) unique constraint enforces
idempotency at the database level; duplicate inserts are caught
by IntegrityError and handled gracefully in the repository.
"""

import uuid
import datetime
from decimal import Decimal
from database import Base
from utils import TransactionStatus, CurrencyEnum
from .mixins import TimestampMixin, SoftDeleteMixin

from sqlalchemy import String, Enum, TIMESTAMP, Numeric, UniqueConstraint, Index, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.orm import Mapped, mapped_column


class Transaction(Base, SerializerMixin, TimestampMixin, SoftDeleteMixin):
    """Transaction Model — immutable financial event record."""

    __tablename__ = "transaction"

    __table_args__ = (
        # Idempotency constraint: one record per (tenant, transaction_id)
        UniqueConstraint(
            "tenant_id", "transaction_id",
            name="uq_transaction_tenant_txn_id",
        ),
        Index("ix_transaction_tenant_status", "tenant_id", "status"),
        Index("ix_transaction_payer_tenant", "payer", "tenant_id"),
        Index("ix_transaction_payee_tenant", "payee", "tenant_id"),
        Index(
            "ix_transaction_account_numbers",
            "payer_account_number",
            "payee_account_number",
            "tenant_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transaction_id: Mapped[str] = mapped_column(String(128), nullable=False)
    payer: Mapped[str] = mapped_column(String(128), nullable=False)
    payer_account_number: Mapped[str] = mapped_column(String(64), nullable=True)
    payer_name: Mapped[str] = mapped_column(String(256), nullable=True)
    payee: Mapped[str] = mapped_column(String(128), nullable=False)
    payee_account_number: Mapped[str] = mapped_column(String(64), nullable=True)
    payee_name: Mapped[str] = mapped_column(String(256), nullable=True)

    # NUMERIC(20,2): supports up to 999,999,999,999,999,999.99 Naira
    # with exactly 2 decimal places. No floating-point drift.
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=20, scale=2), nullable=False
    )

    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus), nullable=False, default=TransactionStatus.PENDING
    )
    currency: Mapped[CurrencyEnum] = mapped_column(
        Enum(CurrencyEnum), nullable=False, default=CurrencyEnum.NGN
    )
    completed_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP, nullable=True)
    # Set once the GL journal entry has been durably posted. NULL means the GL
    # has NOT seen this transaction — such a record must never reach SUCCESS.
    gl_posted_at: Mapped[datetime.datetime] = mapped_column(TIMESTAMP, nullable=True)
    note: Mapped[str] = mapped_column(String(512), nullable=True)
    tag: Mapped[str] = mapped_column(String(128), nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False)
    ledger_id: Mapped[str] = mapped_column(String(128), nullable=False)

    def __repr__(self) -> str:
        return (
            f"<Transaction id={self.id} txn={self.transaction_id} "
            f"payer={self.payer} payee={self.payee} amount={self.amount} "
            f"status={self.status.value}>"
        )


class GLPostingOutbox(Base, SerializerMixin, TimestampMixin):
    """Outbox for GL journal postings that failed after the durable record
    was committed.

    A row with status='pending' means: the transaction record exists in the
    database but the GL has not (successfully) seen the journal entry yet.
    A retry worker / event redelivery drains this outbox. Fail-closed: rows
    are only marked 'done' after a confirmed GL post.
    """

    __tablename__ = "gl_posting_outbox"

    __table_args__ = (
        Index("ix_gl_outbox_tenant_txn", "tenant_id", "transaction_id"),
        Index("ix_gl_outbox_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    transaction_id: Mapped[str] = mapped_column(String(128), nullable=False)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False)
    entry_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str] = mapped_column(Text, nullable=True)
