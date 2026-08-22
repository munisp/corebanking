"""
Transaction Ledger Enums
========================

This module imports centralized payment types from the payment-processing-service
for consistent transaction classification and reporting across the system.
"""

import enum

from utils.payment_types import PaymentType, PaymentTypeCategory, PaymentTypeDirection


class TransactionStatus(enum.Enum):
    """Standardized transaction status values."""
    PENDING = "pending"
    FAILED = "failed"
    SUCCESS = "success"
    REVERSED = "reversed"
    FRAUD = "fraud"
    # Durable record exists but the GL journal entry could not be posted.
    # A GL posting outbox row is written for retry; the transaction must
    # never reach SUCCESS from this state without a successful GL post.
    GL_FAILED = "gl_failed"


class CurrencyEnum(enum.Enum):
    """Supported currencies in the system."""
    NGN = "NGN"


class PubsubTopics(enum.Enum):
    """Pub/Sub topic names for transaction events."""
    TRANSACTION_INITIATED = "transaction_initiated"
    TRANSACTION_FAILED = "transaction_failed"
    TRANSACTION_SUCCESS = "transaction_success"


# Re-export centralized payment types for use in transaction ledger
__all__ = [
    'TransactionStatus',
    'CurrencyEnum',
    'PubsubTopics',
    'PaymentType',
    'PaymentTypeCategory',
    'PaymentTypeDirection',
]

    