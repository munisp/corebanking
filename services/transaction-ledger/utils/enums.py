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

    