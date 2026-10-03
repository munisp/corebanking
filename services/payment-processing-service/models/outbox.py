"""Durable outbox tables (W13-RISK-15/16).

Audit events and outbound external-payment notifications must never be
silently dropped after the money-path debit is durable. When the downstream
call fails after retries, a row is persisted here and the outbox relay
(services/outbox_relay.py) retries delivery until it succeeds.
"""
import uuid

from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from database import Base


class AuditOutbox(Base):
    """Audit events that could not be shipped to the audit service."""

    __tablename__ = "audit_outbox"

    id = Column(String(64), primary_key=True, default=lambda: f"ao_{uuid.uuid4().hex}")
    tenant_id = Column(String(128), nullable=False, index=True)
    event_type = Column(String(128), nullable=False)
    payload = Column(JSONB, nullable=False)
    headers = Column(JSONB, nullable=False, default=dict)
    status = Column(String(16), nullable=False, default="pending", index=True)  # pending|shipped
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class ExternalNotificationOutbox(Base):
    """Outbound payment notifications (mojaloop/payment-rails) that failed
    after the debit was already durable in TigerBeetle."""

    __tablename__ = "external_notification_outbox"

    id = Column(String(64), primary_key=True, default=lambda: f"en_{uuid.uuid4().hex}")
    reference = Column(String(128), nullable=False, index=True)
    tenant_id = Column(String(128), nullable=False, index=True)
    payload = Column(JSONB, nullable=False)
    status = Column(String(16), nullable=False, default="pending", index=True)  # pending|shipped
    attempts = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
