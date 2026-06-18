package payment_types

import (
	"encoding/json"
	"fmt"
	"strings"
)

/*
Centralized Payment Type Definitions (Go)
==========================================

This package defines all standardized payment types across the 54link system.
It serves as the single source of truth for payment type classification,
ensuring consistency across backend services, APIs, and UI layers.

All transaction types are strictly defined with unambiguous labels following
the naming convention: "TransactionType" format (e.g., "Transfer", "Loan Repayment").
*/

// PaymentType represents a standardized payment type in the system
type PaymentType string

const (
	// Core Transfer Types
	TRANSFER   PaymentType = "Transfer"
	DEPOSIT    PaymentType = "Deposit"
	WITHDRAWAL PaymentType = "Withdrawal"

	// Loan Management
	LOAN_REPAYMENT    PaymentType = "Loan Repayment"
	LOAN_DISBURSEMENT PaymentType = "Loan Disbursement"

	// Supply Chain Finance
	LPO_ISSUANCE           PaymentType = "LPO Issuance"
	LPO_PAYMENT            PaymentType = "LPO Payment"
	SUPPLY_CHAIN_FINANCING PaymentType = "Supply Chain Financing"

	// Special Finance
	INSURANCE_PREMIUM PaymentType = "Insurance Premium"

	// Cards & Payments
	CARD_PAYMENT PaymentType = "Card Payment"
	BILL_PAYMENT PaymentType = "Bill Payment"

	// FX & Remittance
	FX PaymentType = "FX"

	// Agent Operations
	COMMISSION   PaymentType = "Commission"
	FLOAT_TOP_UP PaymentType = "Float Top Up"

	// Utilities
	AIRTIME_PURCHASE PaymentType = "Airtime Purchase"
	DATA_BUNDLE      PaymentType = "Data Bundle"

	// System Operations
	SYSTEM_PAYOUT PaymentType = "System Payout"
)

// PaymentTypeCategory represents logical grouping of payment types
type PaymentTypeCategory string

const (
	TRANSFERS        PaymentTypeCategory = "transfers"
	LENDING          PaymentTypeCategory = "lending"
	SUPPLY_CHAIN     PaymentTypeCategory = "supply_chain"
	SPECIAL_SERVICES PaymentTypeCategory = "special_services"
	CARDS_PAYMENTS   PaymentTypeCategory = "cards_payments"
	AGENT_OPERATIONS PaymentTypeCategory = "agent_operations"
	UTILITIES        PaymentTypeCategory = "utilities"
	SYSTEM           PaymentTypeCategory = "system"
)

// PaymentTypeDirection represents the direction of payment flow
type PaymentTypeDirection string

const (
	INCOMING PaymentTypeDirection = "incoming"
	OUTGOING PaymentTypeDirection = "outgoing"
)

// PaymentTypeToCategory maps payment types to their categories
var PaymentTypeToCategory = map[PaymentType]PaymentTypeCategory{
	TRANSFER:               TRANSFERS,
	DEPOSIT:                TRANSFERS,
	WITHDRAWAL:             TRANSFERS,
	LOAN_REPAYMENT:         LENDING,
	LOAN_DISBURSEMENT:      LENDING,
	LPO_ISSUANCE:           SUPPLY_CHAIN,
	LPO_PAYMENT:            SUPPLY_CHAIN,
	SUPPLY_CHAIN_FINANCING: SUPPLY_CHAIN,
	INSURANCE_PREMIUM:      SPECIAL_SERVICES,
	CARD_PAYMENT:           CARDS_PAYMENTS,
	BILL_PAYMENT:           CARDS_PAYMENTS,
	FX:                     TRANSFERS,
	COMMISSION:             AGENT_OPERATIONS,
	FLOAT_TOP_UP:           AGENT_OPERATIONS,
	AIRTIME_PURCHASE:       UTILITIES,
	DATA_BUNDLE:            UTILITIES,
	SYSTEM_PAYOUT:          SYSTEM,
}

// LegacyToStandardMapping maps legacy string representations to standardized PaymentType
var LegacyToStandardMapping = map[string]PaymentType{
	"transfer":               TRANSFER,
	"deposit":                DEPOSIT,
	"withdrawal":             WITHDRAWAL,
	"payment":                TRANSFER, // Generic "payment" defaults to Transfer
	"bill_payment":           BILL_PAYMENT,
	"card_payment":           CARD_PAYMENT,
	"fx":                     FX,
	"loan_repayment":         LOAN_REPAYMENT,
	"loan_payment":           LOAN_REPAYMENT,
	"loan_disbursement":      LOAN_DISBURSEMENT,
	"lpo":                    LPO_ISSUANCE, // Default LPO to issuance
	"lpo_issuance":           LPO_ISSUANCE,
	"lpo_payment":            LPO_PAYMENT,
	"supply_chain_financing": SUPPLY_CHAIN_FINANCING,
	"insurance_premium":      INSURANCE_PREMIUM,
	"commission":             COMMISSION,
	"float_topup":            FLOAT_TOP_UP,
	"airtime_purchase":       AIRTIME_PURCHASE,
	"airtime":                AIRTIME_PURCHASE,
	"data_bundle":            DATA_BUNDLE,
	"data":                   DATA_BUNDLE,
	"system_payout":          SYSTEM_PAYOUT,
}

// IncomingPaymentTypes lists payment types that are typically incoming
var IncomingPaymentTypes = []PaymentType{
	TRANSFER,
	DEPOSIT,
	LOAN_DISBURSEMENT,
	SYSTEM_PAYOUT,
}

// OutgoingPaymentTypes lists payment types that are typically outgoing
var OutgoingPaymentTypes = []PaymentType{
	TRANSFER,
	WITHDRAWAL,
	LOAN_REPAYMENT,
	LPO_PAYMENT,
	BILL_PAYMENT,
	CARD_PAYMENT,
	FX,
	COMMISSION,
	FLOAT_TOP_UP,
	AIRTIME_PURCHASE,
	DATA_BUNDLE,
	INSURANCE_PREMIUM,
}

// BidirectionalPaymentTypes lists payment types that can be incoming or outgoing
var BidirectionalPaymentTypes = []PaymentType{
	TRANSFER,
}

// NormalizePaymentType converts any payment type representation to standardized PaymentType
func NormalizePaymentType(paymentType interface{}) (PaymentType, error) {
	switch v := paymentType.(type) {
	case PaymentType:
		return v, nil
	case string:
		// Try direct enum value match (case-sensitive)
		normalized := PaymentType(v)
		if IsValidPaymentType(normalized) {
			return normalized, nil
		}

		// Try case-insensitive match
		lowerV := strings.ToLower(v)
		if legacyType, ok := LegacyToStandardMapping[lowerV]; ok {
			return legacyType, nil
		}

		// Try matching against all known values
		for _, pt := range GetAllPaymentTypes() {
			if strings.EqualFold(string(pt), v) {
				return pt, nil
			}
		}

		return "", fmt.Errorf("unknown payment type: %s", v)
	default:
		return "", fmt.Errorf("invalid payment type type: %T", paymentType)
	}
}

// IsValidPaymentType checks if a payment type is valid
func IsValidPaymentType(pt PaymentType) bool {
	_, exists := PaymentTypeToCategory[pt]
	return exists
}

// GetCategory returns the category of a payment type
func GetCategory(pt PaymentType) PaymentTypeCategory {
	if category, ok := PaymentTypeToCategory[pt]; ok {
		return category
	}
	return SYSTEM
}

// GetDirection returns the direction (incoming/outgoing/bidirectional) of a payment type
func GetDirection(pt PaymentType) *PaymentTypeDirection {
	isIncoming := contains(IncomingPaymentTypes, pt)
	isOutgoing := contains(OutgoingPaymentTypes, pt)
	isBidirectional := contains(BidirectionalPaymentTypes, pt)

	if isIncoming && !isBidirectional {
		return stringToPaymentTypeDirection(string(INCOMING))
	} else if isOutgoing && !isBidirectional {
		return stringToPaymentTypeDirection(string(OUTGOING))
	}

	return nil // Bidirectional
}

// ListAllPaymentTypes returns all valid payment type values
func GetAllPaymentTypes() []PaymentType {
	return []PaymentType{
		TRANSFER,
		DEPOSIT,
		WITHDRAWAL,
		LOAN_REPAYMENT,
		LOAN_DISBURSEMENT,
		LPO_ISSUANCE,
		LPO_PAYMENT,
		SUPPLY_CHAIN_FINANCING,
		INSURANCE_PREMIUM,
		CARD_PAYMENT,
		BILL_PAYMENT,
		FX,
		COMMISSION,
		FLOAT_TOP_UP,
		AIRTIME_PURCHASE,
		DATA_BUNDLE,
		SYSTEM_PAYOUT,
	}
}

// ListTypesByCategory returns all payment types in a category
func ListTypesByCategory(category PaymentTypeCategory) []PaymentType {
	var result []PaymentType
	for pt, cat := range PaymentTypeToCategory {
		if cat == category {
			result = append(result, pt)
		}
	}
	return result
}

// Helper functions

func contains(slice []PaymentType, item PaymentType) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

func stringToPaymentTypeDirection(s string) *PaymentTypeDirection {
	direction := PaymentTypeDirection(s)
	return &direction
}

// MarshalJSON implements custom JSON marshaling for PaymentType
func (pt PaymentType) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(pt))
}

// UnmarshalJSON implements custom JSON unmarshaling for PaymentType
func (pt *PaymentType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	normalized, err := NormalizePaymentType(s)
	if err != nil {
		return err
	}
	*pt = normalized
	return nil
}

// String returns the string representation of PaymentType
func (pt PaymentType) String() string {
	return string(pt)
}
