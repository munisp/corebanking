/**
 * Centralized Payment Type Definitions (TypeScript) - Mojaloop Connector
 * ===================================================================
 *
 * This is a shared copy of the centralized payment type definitions
 * for use in the mojaloop-connector service.
 *
 * File location: services/mojaloop-connector/src/utils/payment-types.ts
 *
 * Import from here within this service. For cross-service consistency,
 * this file mirrors the definitions in payment-hub/src/utils/payment-types.ts
 */

/**
 * Enumeration of all valid payment types in the system.
 * 
 * Each payment type has a strict, unambiguous label that is:
 * - Consistent across all backend services
 * - Used for API responses and UI display
 * - Never duplicated or aliased
 */
export enum PaymentType {
  // Core Transfer Types
  TRANSFER = "TRANSFER",
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  
  // Loan Management
  LOAN_REPAYMENT = "LOAN_REPAYMENT",
  LOAN_DISBURSEMENT = "LOAN_DISBURSEMENT",
  
  // Supply Chain Finance
  LPO_ISSUANCE = "LPO_ISSUANCE",
  LPO_PAYMENT = "LPO_PAYMENT",
  SUPPLY_CHAIN_FINANCING = "SUPPLY_CHAIN_FINANCING",
  
  // Special Finance
  INSURANCE_PREMIUM = "INSURANCE_PREMIUM",
  
  // Cards & Payments
  CARD_PAYMENT = "CARD_PAYMENT",
  BILL_PAYMENT = "BILL_PAYMENT",
  
  // FX & Remittance
  FX = "FX",
  
  // Agent Operations
  COMMISSION = "COMMISSION",
  FLOAT_TOP_UP = "FLOAT_TOP_UP",
  
  // Utilities
  AIRTIME_PURCHASE = "AIRTIME_PURCHASE",
  DATA_BUNDLE = "DATA_BUNDLE",
  
  // System Operations
  SYSTEM_PAYOUT = "SYSTEM_PAYOUT",
}

/**
 * Logical grouping of payment types for reporting and filtering.
 */
export enum PaymentTypeCategory {
  TRANSFERS = "transfers",
  LENDING = "lending",
  SUPPLY_CHAIN = "supply_chain",
  SPECIAL_SERVICES = "special_services",
  CARDS_PAYMENTS = "cards_payments",
  AGENT_OPERATIONS = "agent_operations",
  UTILITIES = "utilities",
  SYSTEM = "system",
}

/**
 * Direction of payment flow (credit/debit perspective of account holder).
 */
export enum PaymentTypeDirection {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
}

/**
 * Mapping of payment types to their categories for grouping and filtering.
 */
export const PAYMENT_TYPE_TO_CATEGORY: Record<PaymentType, PaymentTypeCategory> = {
  [PaymentType.TRANSFER]: PaymentTypeCategory.TRANSFERS,
  [PaymentType.DEPOSIT]: PaymentTypeCategory.TRANSFERS,
  [PaymentType.WITHDRAWAL]: PaymentTypeCategory.TRANSFERS,
  
  [PaymentType.LOAN_REPAYMENT]: PaymentTypeCategory.LENDING,
  [PaymentType.LOAN_DISBURSEMENT]: PaymentTypeCategory.LENDING,
  
  [PaymentType.LPO_ISSUANCE]: PaymentTypeCategory.SUPPLY_CHAIN,
  [PaymentType.LPO_PAYMENT]: PaymentTypeCategory.SUPPLY_CHAIN,
  [PaymentType.SUPPLY_CHAIN_FINANCING]: PaymentTypeCategory.SUPPLY_CHAIN,
  
  [PaymentType.INSURANCE_PREMIUM]: PaymentTypeCategory.SPECIAL_SERVICES,
  
  [PaymentType.CARD_PAYMENT]: PaymentTypeCategory.CARDS_PAYMENTS,
  [PaymentType.BILL_PAYMENT]: PaymentTypeCategory.CARDS_PAYMENTS,
  
  [PaymentType.FX]: PaymentTypeCategory.TRANSFERS,
  
  [PaymentType.COMMISSION]: PaymentTypeCategory.AGENT_OPERATIONS,
  [PaymentType.FLOAT_TOP_UP]: PaymentTypeCategory.AGENT_OPERATIONS,
  
  [PaymentType.AIRTIME_PURCHASE]: PaymentTypeCategory.UTILITIES,
  [PaymentType.DATA_BUNDLE]: PaymentTypeCategory.UTILITIES,
  
  [PaymentType.SYSTEM_PAYOUT]: PaymentTypeCategory.SYSTEM,
};

/**
 * Mapping for legacy string representations to standardized PaymentType enum.
 */
export const LEGACY_TO_STANDARD_MAPPING: Record<string, PaymentType> = {
  "transfer": PaymentType.TRANSFER,
  "deposit": PaymentType.DEPOSIT,
  "withdrawal": PaymentType.WITHDRAWAL,
  "payment": PaymentType.TRANSFER,
  "bill_payment": PaymentType.BILL_PAYMENT,
  "card_payment": PaymentType.CARD_PAYMENT,
  "fx": PaymentType.FX,
  "loan_repayment": PaymentType.LOAN_REPAYMENT,
  "loan_payment": PaymentType.LOAN_REPAYMENT,
  "loan_disbursement": PaymentType.LOAN_DISBURSEMENT,
  "lpo": PaymentType.LPO_ISSUANCE,
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
};

/**
 * Payment types by direction (incoming vs outgoing).
 */
export const INCOMING_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.TRANSFER,
  PaymentType.DEPOSIT,
  PaymentType.LOAN_DISBURSEMENT,
  PaymentType.SYSTEM_PAYOUT,
];

export const OUTGOING_PAYMENT_TYPES: PaymentType[] = [
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
];

/**
 * Bidirectional payment types (can be incoming or outgoing).
 */
export const BIDIRECTIONAL_PAYMENT_TYPES: PaymentType[] = [
  PaymentType.TRANSFER,
];

/**
 * Utility helper class for payment type operations and conversions.
 */
export class PaymentTypeHelper {
  /**
   * Convert any payment type representation (string or enum) to standardized PaymentType.
   */
  static normalizePaymentType(paymentType: string | PaymentType): PaymentType {
    if (typeof paymentType === "string") {
      const normalized = paymentType.toUpperCase().replace(/\s+/g, "_");
      if (normalized in PaymentType) {
        return PaymentType[normalized as keyof typeof PaymentType];
      }
      
      for (const [key, value] of Object.entries(PaymentType)) {
        if (value.toLowerCase() === paymentType.toLowerCase()) {
          return value as PaymentType;
        }
      }
      
      const legacyKey = paymentType.toLowerCase();
      if (legacyKey in LEGACY_TO_STANDARD_MAPPING) {
        return LEGACY_TO_STANDARD_MAPPING[legacyKey];
      }
    } else {
      return paymentType;
    }
    
    throw new Error(`Unknown payment type: ${paymentType}`);
  }
  
  /**
   * Get the category of a payment type.
   */
  static getCategory(paymentType: PaymentType | string): PaymentTypeCategory {
    const pt = typeof paymentType === "string" 
      ? this.normalizePaymentType(paymentType)
      : paymentType;
    return PAYMENT_TYPE_TO_CATEGORY[pt] || PaymentTypeCategory.SYSTEM;
  }
  
  /**
   * Get the direction of a payment type.
   */
  static getDirection(paymentType: PaymentType | string): PaymentTypeDirection | null {
    const pt = typeof paymentType === "string" 
      ? this.normalizePaymentType(paymentType)
      : paymentType;
    
    const isIncoming = INCOMING_PAYMENT_TYPES.includes(pt);
    const isOutgoing = OUTGOING_PAYMENT_TYPES.includes(pt);
    const isBidirectional = BIDIRECTIONAL_PAYMENT_TYPES.includes(pt);
    
    if (isIncoming && !isBidirectional) {
      return PaymentTypeDirection.INCOMING;
    } else if (isOutgoing && !isBidirectional) {
      return PaymentTypeDirection.OUTGOING;
    }
    
    return null;
  }
  
  /**
   * Check if a payment type is valid.
   */
  static isValidPaymentType(paymentType: string | PaymentType): boolean {
    try {
      this.normalizePaymentType(paymentType);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get list of all valid payment type values.
   */
  static listAllTypes(): string[] {
    return Object.values(PaymentType);
  }
  
  /**
   * Get all payment types in a category.
   */
  static listTypesByCategory(category: PaymentTypeCategory): PaymentType[] {
    return Object.values(PaymentType).filter(
      (pt) => PAYMENT_TYPE_TO_CATEGORY[pt as PaymentType] === category
    );
  }
}

export default PaymentType;
