"""
Centralized Payment Type Definitions
====================================

This module defines all standardized payment types across the 54link system.
It serves as the single source of truth for payment type classification,
ensuring consistency across backend services, APIs, and UI layers.

All transaction types are strictly defined with unambiguous labels following
the naming convention: "TransactionType" format (e.g., "Transfer", "Loan Repayment").

Payment Type Categories:
1. Core Transfer Types: Transfer, Deposit, Withdrawal
2. Loan Management: Loan Repayment, Loan Disbursement
3. Supply Chain Finance: LPO Issuance, LPO Payment, Supply Chain Financing
4. Special Finance: Insurance Premium
5. Cards & Payments: Card Payment, Bill Payment
6. FX & Remittance: FX
7. Agent Operations: Commission, Float Top Up
8. Utilities: Airtime Purchase, Data Bundle
9. System Operations: System Payout
"""

import enum
from typing import Dict, List, Optional


class PaymentType(enum.Enum):
    """
    Enumeration of all valid payment types in the system.
    
    Each payment type has a strict, unambiguous label that is:
    - Consistent across all backend services
    - Used for API responses and UI display
    - Never duplicated or aliased
    """
    
    # Core Transfer Types
    TRANSFER = "Transfer"
    DEPOSIT = "Deposit"
    WITHDRAWAL = "Withdrawal"
    
    # Loan Management
    LOAN_REPAYMENT = "Loan Repayment"
    LOAN_DISBURSEMENT = "Loan Disbursement"
    
    # Supply Chain Finance
    LPO_ISSUANCE = "LPO Issuance"
    LPO_PAYMENT = "LPO Payment"
    SUPPLY_CHAIN_FINANCING = "Supply Chain Financing"
    
    # Special Finance
    INSURANCE_PREMIUM = "Insurance Premium"
    
    # Cards & Payments
    CARD_PAYMENT = "Card Payment"
    BILL_PAYMENT = "Bill Payment"
    
    # FX & Remittance
    FX = "FX"
    
    # Agent Operations
    COMMISSION = "Commission"
    FLOAT_TOP_UP = "Float Top Up"
    
    # Utilities
    AIRTIME_PURCHASE = "Airtime Purchase"
    DATA_BUNDLE = "Data Bundle"
    
    # System Operations
    SYSTEM_PAYOUT = "System Payout"


class PaymentTypeCategory(enum.Enum):
    """
    Logical grouping of payment types for reporting and filtering.
    """
    TRANSFERS = "transfers"
    LENDING = "lending"
    SUPPLY_CHAIN = "supply_chain"
    SPECIAL_SERVICES = "special_services"
    CARDS_PAYMENTS = "cards_payments"
    AGENT_OPERATIONS = "agent_operations"
    UTILITIES = "utilities"
    SYSTEM = "system"


class PaymentTypeDirection(enum.Enum):
    """
    Direction of payment flow (credit/debit perspective of account holder).
    """
    INCOMING = "incoming"
    OUTGOING = "outgoing"


# Mapping of payment types to their categories for grouping and filtering
PAYMENT_TYPE_TO_CATEGORY: Dict[PaymentType, PaymentTypeCategory] = {
    PaymentType.TRANSFER: PaymentTypeCategory.TRANSFERS,
    PaymentType.DEPOSIT: PaymentTypeCategory.TRANSFERS,
    PaymentType.WITHDRAWAL: PaymentTypeCategory.TRANSFERS,
    
    PaymentType.LOAN_REPAYMENT: PaymentTypeCategory.LENDING,
    PaymentType.LOAN_DISBURSEMENT: PaymentTypeCategory.LENDING,
    
    PaymentType.LPO_ISSUANCE: PaymentTypeCategory.SUPPLY_CHAIN,
    PaymentType.LPO_PAYMENT: PaymentTypeCategory.SUPPLY_CHAIN,
    PaymentType.SUPPLY_CHAIN_FINANCING: PaymentTypeCategory.SUPPLY_CHAIN,
    
    PaymentType.INSURANCE_PREMIUM: PaymentTypeCategory.SPECIAL_SERVICES,
    
    PaymentType.CARD_PAYMENT: PaymentTypeCategory.CARDS_PAYMENTS,
    PaymentType.BILL_PAYMENT: PaymentTypeCategory.CARDS_PAYMENTS,
    
    PaymentType.FX: PaymentTypeCategory.TRANSFERS,
    
    PaymentType.COMMISSION: PaymentTypeCategory.AGENT_OPERATIONS,
    PaymentType.FLOAT_TOP_UP: PaymentTypeCategory.AGENT_OPERATIONS,
    
    PaymentType.AIRTIME_PURCHASE: PaymentTypeCategory.UTILITIES,
    PaymentType.DATA_BUNDLE: PaymentTypeCategory.UTILITIES,
    
    PaymentType.SYSTEM_PAYOUT: PaymentTypeCategory.SYSTEM,
}


# Mapping for legacy string representations to standardized PaymentType enum
LEGACY_TO_STANDARD_MAPPING: Dict[str, PaymentType] = {
    # Legacy: Standardized mapping
    "transfer": PaymentType.TRANSFER,
    "deposit": PaymentType.DEPOSIT,
    "withdrawal": PaymentType.WITHDRAWAL,
    "payment": PaymentType.TRANSFER,  # Generic "payment" defaults to Transfer
    "bill_payment": PaymentType.BILL_PAYMENT,
    "card_payment": PaymentType.CARD_PAYMENT,
    "fx": PaymentType.FX,
    "loan_repayment": PaymentType.LOAN_REPAYMENT,
    "loan_payment": PaymentType.LOAN_REPAYMENT,
    "loan_disbursement": PaymentType.LOAN_DISBURSEMENT,
    "lpo": PaymentType.LPO_ISSUANCE,  # Default LPO to issuance
    "lpo_issuance": PaymentType.LPO_ISSUANCE,
    "lpo_payment": PaymentType.LPO_PAYMENT,
    "supply_chain_financing": PaymentType.SUPPLY_CHAIN_FINANCING,
    "insurance_premium": PaymentType.INSURANCE_PREMIUM,
    "commission": PaymentType.COMMISSION,
    "float_topup": PaymentType.FLOAT_TOP_UP,
    "airtime_purchase": PaymentType.AIRTIME_PURCHASE,
    "airtime": PaymentType.AIRTIME_PURCHASE,
    "data_bundle": PaymentType.DATA_BUNDLE,
    "data": PaymentType.DATA_BUNDLE,
    "system_payout": PaymentType.SYSTEM_PAYOUT,
}


# Payment types by direction (incoming vs outgoing)
INCOMING_PAYMENT_TYPES: List[PaymentType] = [
    PaymentType.TRANSFER,
    PaymentType.DEPOSIT,
    PaymentType.LOAN_DISBURSEMENT,
    PaymentType.SYSTEM_PAYOUT,
]

OUTGOING_PAYMENT_TYPES: List[PaymentType] = [
    PaymentType.TRANSFER,
    PaymentType.WITHDRAWAL,
    PaymentType.LOAN_REPAYMENT,
    PaymentType.LPO_PAYMENT,
    PaymentType.BILL_PAYMENT,
    PaymentType.CARD_PAYMENT,
    PaymentType.FX,
    PaymentType.COMMISSION,
    PaymentType.FLOAT_TOP_UP,
    PaymentType.AIRTIME_PURCHASE,
    PaymentType.DATA_BUNDLE,
    PaymentType.INSURANCE_PREMIUM,
]

# Bidirectional payment types (can be incoming or outgoing)
BIDIRECTIONAL_PAYMENT_TYPES: List[PaymentType] = [
    PaymentType.TRANSFER,
]


class PaymentTypeHelper:
    """
    Utility helper class for payment type operations and conversions.
    """
    
    @staticmethod
    def normalize_payment_type(payment_type: str | PaymentType) -> PaymentType:
        """
        Convert any payment type representation (string or enum) to standardized PaymentType.
        
        Args:
            payment_type: String or PaymentType enum value
            
        Returns:
            Standardized PaymentType enum value
            
        Raises:
            ValueError: If payment type is not recognized
        """
        if isinstance(payment_type, PaymentType):
            return payment_type
        
        if isinstance(payment_type, str):
            # Try direct enum name match first
            try:
                return PaymentType[payment_type.upper()]
            except KeyError:
                pass
            
            # Try value match
            for pt in PaymentType:
                if pt.value.lower() == payment_type.lower():
                    return pt
            
            # Try legacy mapping
            legacy_key = payment_type.lower()
            if legacy_key in LEGACY_TO_STANDARD_MAPPING:
                return LEGACY_TO_STANDARD_MAPPING[legacy_key]
        
        raise ValueError(f"Unknown payment type: {payment_type}")
    
    @staticmethod
    def get_category(payment_type: PaymentType | str) -> PaymentTypeCategory:
        """Get the category of a payment type."""
        pt = payment_type if isinstance(payment_type, PaymentType) else \
             PaymentTypeHelper.normalize_payment_type(payment_type)
        return PAYMENT_TYPE_TO_CATEGORY.get(pt, PaymentTypeCategory.SYSTEM)
    
    @staticmethod
    def get_direction(payment_type: PaymentType | str) -> Optional[PaymentTypeDirection]:
        """
        Get the direction (incoming/outgoing/bidirectional) of a payment type.
        
        Returns:
            PaymentTypeDirection.INCOMING, PaymentTypeDirection.OUTGOING, or None for bidirectional
        """
        pt = payment_type if isinstance(payment_type, PaymentType) else \
             PaymentTypeHelper.normalize_payment_type(payment_type)
        
        if pt in INCOMING_PAYMENT_TYPES and pt not in BIDIRECTIONAL_PAYMENT_TYPES:
            return PaymentTypeDirection.INCOMING
        elif pt in OUTGOING_PAYMENT_TYPES and pt not in BIDIRECTIONAL_PAYMENT_TYPES:
            return PaymentTypeDirection.OUTGOING
        else:
            return None  # Bidirectional
    
    @staticmethod
    def is_valid_payment_type(payment_type: str | PaymentType) -> bool:
        """Check if a payment type is valid."""
        try:
            PaymentTypeHelper.normalize_payment_type(payment_type)
            return True
        except ValueError:
            return False
    
    @staticmethod
    def list_all_types() -> List[str]:
        """Get list of all valid payment type values."""
        return [pt.value for pt in PaymentType]
    
    @staticmethod
    def list_types_by_category(category: PaymentTypeCategory) -> List[PaymentType]:
        """Get all payment types in a category."""
        return [
            pt for pt, cat in PAYMENT_TYPE_TO_CATEGORY.items()
            if cat == category
        ]


# Re-export for convenience
__all__ = [
    'PaymentType',
    'PaymentTypeCategory',
    'PaymentTypeDirection',
    'PaymentTypeHelper',
    'PAYMENT_TYPE_TO_CATEGORY',
    'LEGACY_TO_STANDARD_MAPPING',
    'INCOMING_PAYMENT_TYPES',
    'OUTGOING_PAYMENT_TYPES',
    'BIDIRECTIONAL_PAYMENT_TYPES',
]
