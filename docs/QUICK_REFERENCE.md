# Payment Type Standardization - Quick Reference Card

## 17 Standardized Payment Types

### All Payment Types (Alphabetical)
```
Airtime Purchase    | Commission         | Data Bundle         | Deposit
FX                  | Insurance Premium  | Loan Disbursement   | Loan Repayment
LPO Issuance        | LPO Payment        | Supply Chain Financing | System Payout
Bill Payment        | Card Payment       | Float Top Up        | Transfer
Withdrawal
```

---

## Quick Imports

### Python
```python
from utils.payment_types import PaymentType, PaymentTypeHelper

# Use constants
PaymentType.TRANSFER
PaymentType.LOAN_REPAYMENT
PaymentType.LPO_PAYMENT

# Normalize user input
normalized = PaymentTypeHelper.normalize_payment_type("loan_repayment")
```

### TypeScript
```typescript
import { PaymentType, PaymentTypeHelper } from "./utils/payment-types";

// Use constants
PaymentType.TRANSFER
PaymentType.LOAN_REPAYMENT
PaymentType.LPO_PAYMENT

// Normalize user input
const normalized = PaymentTypeHelper.normalizePaymentType("loan_repayment");
```

### Go
```go
import "security-service/payment_types"

// Use constants
payment_types.TRANSFER
payment_types.LOAN_REPAYMENT
payment_types.LPO_PAYMENT

// Normalize user input
normalized, err := payment_types.NormalizePaymentType("loan_repayment")
```

---

## Common Operations

### Python

**Check if valid**:
```python
PaymentTypeHelper.is_valid_payment_type("transfer")  # True
PaymentTypeHelper.is_valid_payment_type("xyz")       # False
```

**Get category**:
```python
PaymentTypeHelper.get_category(PaymentType.LOAN_REPAYMENT)
# Returns: PaymentTypeCategory.LENDING
```

**Get direction**:
```python
PaymentTypeHelper.get_direction(PaymentType.DEPOSIT)
# Returns: PaymentTypeDirection.INCOMING

PaymentTypeHelper.get_direction(PaymentType.TRANSFER)
# Returns: None (bidirectional)
```

**List all types**:
```python
PaymentTypeHelper.list_all_types()
# Returns: ["Transfer", "Deposit", "Withdrawal", ...]

PaymentTypeHelper.list_types_by_category(PaymentTypeCategory.LENDING)
# Returns: [PaymentType.LOAN_REPAYMENT, PaymentType.LOAN_DISBURSEMENT]
```

### TypeScript

**Check if valid**:
```typescript
PaymentTypeHelper.isValidPaymentType("transfer")  // true
PaymentTypeHelper.isValidPaymentType("xyz")       // false
```

**Get category**:
```typescript
PaymentTypeHelper.getCategory(PaymentType.LOAN_REPAYMENT)
// Returns: PaymentTypeCategory.LENDING
```

**Get direction**:
```typescript
PaymentTypeHelper.getDirection(PaymentType.DEPOSIT)
// Returns: PaymentTypeDirection.INCOMING

PaymentTypeHelper.getDirection(PaymentType.TRANSFER)
// Returns: null (bidirectional)
```

**List all types**:
```typescript
PaymentTypeHelper.listAllTypes()
// Returns: ["Transfer", "Deposit", "Withdrawal", ...]

PaymentTypeHelper.listTypesByCategory(PaymentTypeCategory.LENDING)
// Returns: [PaymentType.LOAN_REPAYMENT, PaymentType.LOAN_DISBURSEMENT]
```

### Go

**Check if valid**:
```go
payment_types.IsValidPaymentType(payment_types.TRANSFER)  // true
```

**Get category**:
```go
category := payment_types.GetCategory(payment_types.LOAN_REPAYMENT)
// Returns: payment_types.LENDING
```

**Get direction**:
```go
direction := payment_types.GetDirection(payment_types.DEPOSIT)
// Returns: &PaymentTypeDirection.INCOMING

direction = payment_types.GetDirection(payment_types.TRANSFER)
// Returns: nil (bidirectional)
```

**List all types**:
```go
allTypes := payment_types.GetAllPaymentTypes()
// Returns: []PaymentType with all 17 types

lendingTypes := payment_types.ListTypesByCategory(payment_types.LENDING)
// Returns: [LOAN_REPAYMENT, LOAN_DISBURSEMENT]
```

---

## Category Mappings

| Payment Type | Category | Group |
|---|---|---|
| Transfer, Deposit, Withdrawal, FX | transfers | TRANSFERS |
| Loan Repayment, Loan Disbursement | lending | LENDING |
| LPO Issuance, LPO Payment, Supply Chain Financing | supply_chain | SUPPLY_CHAIN |
| Insurance Premium | special_services | SPECIAL_SERVICES |
| Card Payment, Bill Payment | cards_payments | CARDS_PAYMENTS |
| Commission, Float Top Up | agent_operations | AGENT_OPERATIONS |
| Airtime Purchase, Data Bundle | utilities | UTILITIES |
| System Payout | system | SYSTEM |

---

## Direction Reference

### Incoming Only
- Deposit
- Loan Disbursement
- System Payout

### Outgoing Only
- Withdrawal
- Loan Repayment
- LPO Payment
- Bill Payment
- Card Payment
- FX
- Commission
- Float Top Up
- Airtime Purchase
- Data Bundle
- Insurance Premium
- Supply Chain Financing

### Bidirectional (Context-Dependent)
- Transfer

---

## Legacy String Mappings

| Old Value | Maps To |
|---|---|
| "transfer" | TRANSFER |
| "deposit" | DEPOSIT |
| "withdrawal" | WITHDRAWAL |
| "payment" | TRANSFER |
| "bill_payment" | BILL_PAYMENT |
| "card_payment" | CARD_PAYMENT |
| "fx" | FX |
| "loan_repayment" | LOAN_REPAYMENT |
| "loan_payment" | LOAN_REPAYMENT |
| "loan_disbursement" | LOAN_DISBURSEMENT |
| "lpo" | LPO_ISSUANCE |
| "lpo_issuance" | LPO_ISSUANCE |
| "lpo_payment" | LPO_PAYMENT |
| "supply_chain_financing" | SUPPLY_CHAIN_FINANCING |
| "insurance_premium" | INSURANCE_PREMIUM |
| "commission" | COMMISSION |
| "float_topup" | FLOAT_TOP_UP |
| "airtime_purchase" | AIRTIME_PURCHASE |
| "airtime" | AIRTIME_PURCHASE |
| "data_bundle" | DATA_BUNDLE |
| "data" | DATA_BUNDLE |
| "system_payout" | SYSTEM_PAYOUT |

---

## File Locations

### Centralized Definitions
- **Python**: `services/payment-processing-service/utils/payment_types.py`
- **TypeScript (Payment Hub)**: `services/payment-hub/src/utils/payment-types.ts`
- **TypeScript (Mojaloop)**: `services/mojaloop-connector/src/utils/payment-types.ts`
- **Go**: `services/security-service/payment_types/payment_types.go`

### Service Integrations
- **Payment Processing**: `services/payment-processing-service/utils/enums.py`
- **Security Service**: `services/security-service/transaction_limits.go`
- **Payment Hub**: `services/payment-hub/src/utils/enums.ts`
- **Mojaloop Connector**: `services/mojaloop-connector/src/utils/enums.ts`
- **Transaction Ledger**: `services/transaction-ledger/utils/enums.py`
- **UI**: `uis/client/web2/src/models/transaction.ts`

### Documentation
- **Architecture**: `docs/PAYMENT_TYPE_STANDARDIZATION.md`
- **Migration Guide**: `docs/PAYMENT_TYPE_MIGRATION_GUIDE.md`
- **Implementation Summary**: `docs/IMPLEMENTATION_SUMMARY.md`
- **Implementation Checklist**: `docs/IMPLEMENTATION_CHECKLIST.md`

---

## Error Handling

### Python
```python
try:
    ptype = PaymentTypeHelper.normalize_payment_type(user_input)
except ValueError as e:
    logger.error(f"Invalid payment type: {e}")
    return {"error": "Invalid payment type"}, 400
```

### TypeScript
```typescript
try {
    const ptype = PaymentTypeHelper.normalizePaymentType(userInput);
} catch (error) {
    logger.error(`Invalid payment type: ${error}`);
    return { error: "Invalid payment type" };
}
```

### Go
```go
ptype, err := payment_types.NormalizePaymentType(userInput)
if err != nil {
    log.Printf("Invalid payment type: %v", err)
    return fmt.Errorf("invalid payment type")
}
```

---

## Testing Examples

### Python
```python
def test_payment_type_normalization():
    assert PaymentTypeHelper.normalize_payment_type("transfer") == PaymentType.TRANSFER
    assert PaymentTypeHelper.normalize_payment_type("TRANSFER") == PaymentType.TRANSFER
    assert PaymentTypeHelper.normalize_payment_type("Transfer") == PaymentType.TRANSFER
    
    with pytest.raises(ValueError):
        PaymentTypeHelper.normalize_payment_type("invalid")

def test_payment_type_category():
    assert PaymentTypeHelper.get_category(PaymentType.TRANSFER) == PaymentTypeCategory.TRANSFERS
    assert PaymentTypeHelper.get_category(PaymentType.LOAN_REPAYMENT) == PaymentTypeCategory.LENDING
```

### TypeScript
```typescript
describe("PaymentType", () => {
  it("should normalize payment types", () => {
    expect(PaymentTypeHelper.normalizePaymentType("transfer")).toBe(PaymentType.TRANSFER);
    expect(PaymentTypeHelper.normalizePaymentType("TRANSFER")).toBe(PaymentType.TRANSFER);
    expect(PaymentTypeHelper.normalizePaymentType("Transfer")).toBe(PaymentType.TRANSFER);
  });

  it("should throw on invalid types", () => {
    expect(() => PaymentTypeHelper.normalizePaymentType("invalid"))
      .toThrow();
  });

  it("should get correct categories", () => {
    expect(PaymentTypeHelper.getCategory(PaymentType.TRANSFER))
      .toBe(PaymentTypeCategory.TRANSFERS);
  });
});
```

---

## Key Takeaways

✅ **Use the centralized enum** - Don't create local definitions  
✅ **Normalize input strings** - Users may input in various formats  
✅ **Check validity** - Validate payment types before processing  
✅ **Use helper functions** - They handle edge cases  
✅ **Refer to documentation** - See PAYMENT_TYPE_STANDARDIZATION.md for details  
✅ **Follow category mappings** - Use standardized categories for filtering  

---

## Support

**Questions?** Check:
1. This quick reference card
2. Full documentation in `docs/` folder
3. Code comments in definition files
4. Contact payments platform team

---

**Last Updated**: May 2026  
**Version**: 1.0
