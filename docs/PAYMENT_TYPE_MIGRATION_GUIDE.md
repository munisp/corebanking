# Payment Type Standardization - Developer Migration Guide

## Quick Start

This guide helps developers transition from the old fragmented payment type system to the new centralized standardized system.

---

## What Changed?

### Old System
```python
# Each service had its own definitions
# payment-processing-service/services/payment.py
InitiatePaymentSchema()          # Implied "transfer"
InitiateLoanPaymentSchema()      # Implied "loan_repayment"
InitiateLPOPaymentSchema()       # Implied "lpo_payment"

# security-service/transaction_limits.go
TxTypeTransfer = "transfer"      # Lowercase
TxTypePayment = "payment"        # Generic/ambiguous
```

### New System
```python
# Single source of truth with explicit types
from utils.payment_types import PaymentType

PaymentType.TRANSFER             # Explicit, with enum validation
PaymentType.LOAN_REPAYMENT       # Clear intent
PaymentType.LPO_PAYMENT          # Specific and unambiguous
```

---

## Per-Language Migration

### Python Developers

**Before**:
```python
# Implicit types via schemas
payment_service = PaymentService()
payment_service.initiate_transfer(InitiatePaymentSchema(...))
payment_service.initiate_loan_payment(InitiateLoanPaymentSchema(...))

# Manual type validation
if transaction_type == "transfer":
    # process transfer
elif transaction_type == "bill_payment":
    # process bill
else:
    # handle unknown
```

**After**:
```python
from utils.payment_types import PaymentType, PaymentTypeHelper, PaymentTypeCategory

# Explicit type handling
transaction_type = PaymentTypeHelper.normalize_payment_type("loan_repayment")
# → PaymentType.LOAN_REPAYMENT (with validation)

# Use in logging
logger.info(f"Processing {transaction_type.value} for user {user_id}")

# Get category for filtering
category = PaymentTypeHelper.get_category(transaction_type)
if category == PaymentTypeCategory.LENDING:
    apply_lending_fees()

# List all types in category
for ptype in PaymentTypeHelper.list_types_by_category(PaymentTypeCategory.TRANSFERS):
    print(f"Transfer type: {ptype.value}")
```

**Common Patterns**:

1. **Normalize user input**:
   ```python
   user_payment_type = request.json.get("payment_type")
   try:
       normalized = PaymentTypeHelper.normalize_payment_type(user_payment_type)
   except ValueError:
       return {"error": "Invalid payment type"}, 400
   ```

2. **Get direction for transaction**:
   ```python
   direction = PaymentTypeHelper.get_direction(normalized)
   if direction == PaymentTypeDirection.INCOMING:
       # Credit the account
   elif direction == PaymentTypeDirection.OUTGOING:
       # Debit the account
   else:
       # Bidirectional - get from context
       direction = get_transaction_direction_from_context(...)
   ```

3. **Filter by category**:
   ```python
   # Get all lending transactions
   lending_types = PaymentTypeHelper.list_types_by_category(PaymentTypeCategory.LENDING)
   query = query.filter(Transaction.payment_type.in_([t.value for t in lending_types]))
   ```

---

### TypeScript Developers

**Before**:
```typescript
// Fragmented enums across files
import { TransactionTypeEnum } from "./enums";
// Only has TRANSFER = "TRANSFER"

// Manual type checking
if (type === "TRANSFER") {
  // ...
} else if (type === "bill_payment") {  // Different casing!
  // ...
}
```

**After**:
```typescript
import { 
  PaymentType, 
  PaymentTypeHelper,
  PaymentTypeCategory,
  PAYMENT_TYPE_TO_CATEGORY 
} from "./utils/payment-types";

// Use consistent enum
const type: PaymentType = PaymentType.TRANSFER;  // "Transfer"

// Normalize from string
const normalized = PaymentTypeHelper.normalizePaymentType("transfer");
// → PaymentType.TRANSFER

// Type-safe switching
switch(type) {
  case PaymentType.TRANSFER:
    return "Transfer funds";
  case PaymentType.LOAN_REPAYMENT:
    return "Repay loan";
  case PaymentType.LPO_PAYMENT:
    return "Pay LPO";
  // TypeScript will warn if cases are missing
}

// Get category for display
const category = PAYMENT_TYPE_TO_CATEGORY[type];
```

**Common Patterns**:

1. **React component for transaction display**:
   ```typescript
   import { TransactionCategory, CATEGORY_TO_GROUP } from "./models/transaction";
   
   interface TransactionCardProps {
     category: TransactionCategory;
     amount: number;
   }
   
   export const TransactionCard: React.FC<TransactionCardProps> = ({
     category,
     amount,
   }) => {
     const group = CATEGORY_TO_GROUP[category];
     
     return (
       <div className={`transaction-${group}`}>
         <span>{category}</span>
         <span>{amount}</span>
       </div>
     );
   };
   ```

2. **Filtering transactions**:
   ```typescript
   import { PaymentTypeHelper, PaymentTypeCategory } from "./utils/payment-types";
   
   const lendingTypes = PaymentTypeHelper.listTypesByCategory(
     PaymentTypeCategory.LENDING
   );
   
   const filteredTransactions = transactions.filter(t => 
     lendingTypes.includes(t.category as PaymentType)
   );
   ```

3. **API request**:
   ```typescript
   const initiateTransfer = async (paymentType: PaymentType, amount: number) => {
     const response = await fetch("/api/payments", {
       method: "POST",
       body: JSON.stringify({
         paymentType,  // Will send standardized value like "Transfer"
         amount,
       }),
     });
   };
   ```

---

### Go Developers

**Before**:
```go
// Duplicate definitions in transaction_limits.go
const (
    TxTypeTransfer = "transfer"
    TxTypePayment = "payment"
)

// Manual validation
func validateTransactionType(txType string) bool {
    validTypes := []string{"transfer", "payment", "bill_payment"}
    for _, valid := range validTypes {
        if txType == valid {
            return true
        }
    }
    return false
}
```

**After**:
```go
import "security-service/payment_types"

// Use centralized types directly
paymentType := payment_types.TRANSFER  // Type-safe constant

// Normalize string input
normalized, err := payment_types.NormalizePaymentType(userInput)
if err != nil {
    return fmt.Errorf("invalid payment type: %v", err)
}

// Get category
category := payment_types.GetCategory(normalized)
if category == payment_types.LENDING {
    applyLendingRules()
}

// Check direction
direction := payment_types.GetDirection(normalized)
if direction != nil && *direction == payment_types.OUTGOING {
    validateSufficientBalance()
}

// List all types
allTypes := payment_types.GetAllPaymentTypes()
for _, pt := range allTypes {
    log.Printf("Type: %s", pt.String())
}
```

**Common Patterns**:

1. **JSON marshaling**:
   ```go
   type TransactionRequest struct {
       PaymentType payment_types.PaymentType `json:"payment_type"`
       Amount      float64                   `json:"amount"`
   }
   
   // Automatic JSON conversion - PaymentType has MarshalJSON/UnmarshalJSON
   var req TransactionRequest
   json.Unmarshal(data, &req)
   ```

2. **Limit validation**:
   ```go
   func CheckLimit(userTier string, txType payment_types.PaymentType, amount float64) bool {
       config := GetLimitConfig(userTier)
       if amount > config.SingleTxLimit {
           log.Printf("Limit exceeded for %s", txType.String())
           return false
       }
       return true
   }
   ```

3. **Transaction type switch**:
   ```go
   func ProcessTransaction(txType payment_types.PaymentType) error {
       switch txType {
       case payment_types.TRANSFER:
           return processTransfer()
       case payment_types.LOAN_REPAYMENT:
           return processLoanRepayment()
       case payment_types.LPO_PAYMENT:
           return processLPOPayment()
       default:
           return fmt.Errorf("unsupported payment type: %s", txType)
       }
   }
   ```

---

## Common Migration Tasks

### Task 1: Update API Response Format

**Endpoint**: `POST /api/v1/transfers`

**Old Response**:
```json
{
  "status": "success",
  "transaction": {
    "id": "txn_123",
    "type": "transfer",
    "amount": 50000
  }
}
```

**New Response**:
```json
{
  "status": "success",
  "transaction": {
    "id": "txn_123",
    "paymentType": "Transfer",
    "paymentCategory": "transfers",
    "direction": "outgoing",
    "amount": 50000
  }
}
```

**Implementation**:
```python
from utils.payment_types import PaymentTypeHelper

def serialize_transaction(tx):
    payment_type = PaymentTypeHelper.normalize_payment_type(tx.type)
    return {
        "id": tx.id,
        "paymentType": payment_type.value,
        "paymentCategory": PaymentTypeHelper.get_category(payment_type).value,
        "direction": PaymentTypeHelper.get_direction(payment_type),
        "amount": tx.amount,
    }
```

---

### Task 2: Update Database Queries

**Old**:
```sql
SELECT * FROM transactions WHERE type = 'transfer' OR type = 'payment';
```

**New**:
```sql
SELECT * FROM transactions 
WHERE payment_type IN ('Transfer', 'Deposit', 'Withdrawal', 'FX')
AND payment_category = 'transfers';
```

**Python ORM**:
```python
from utils.payment_types import PaymentTypeHelper, PaymentTypeCategory

transfer_types = PaymentTypeHelper.list_types_by_category(PaymentTypeCategory.TRANSFERS)
type_values = [pt.value for pt in transfer_types]

transactions = db.query(Transaction).filter(
    Transaction.payment_type.in_(type_values)
).all()
```

---

### Task 3: Update UI Components

**Old Transaction List**:
```typescript
// Component doesn't know about LPO or Insurance types
const TRANSACTION_ICONS: Record<TransactionCategory, string> = {
  'transfer': 'icon-transfer',
  'bill_payment': 'icon-bill',
  'loan_disbursement': 'icon-loan',
};
```

**New Transaction List**:
```typescript
import { TransactionCategory, CATEGORY_TO_GROUP } from "../models/transaction";

const TRANSACTION_ICONS: Record<TransactionCategory, string> = {
  'Transfer': 'icon-transfer',
  'Deposit': 'icon-deposit',
  'Withdrawal': 'icon-withdrawal',
  'Loan Repayment': 'icon-loan-repayment',
  'Loan Disbursement': 'icon-loan-disbursement',
  'LPO Issuance': 'icon-lpo-issuance',
  'LPO Payment': 'icon-lpo-payment',
  'Supply Chain Financing': 'icon-supply-chain',
  'Insurance Premium': 'icon-insurance',
  'Card Payment': 'icon-card',
  'Bill Payment': 'icon-bill',
  'FX': 'icon-fx',
  'Commission': 'icon-commission',
  'Float Top Up': 'icon-float',
  'Airtime Purchase': 'icon-airtime',
  'Data Bundle': 'icon-data',
  'System Payout': 'icon-system',
};

export const TransactionListItem: React.FC<{category: TransactionCategory}> = ({category}) => {
  const icon = TRANSACTION_ICONS[category] || 'icon-default';
  const group = CATEGORY_TO_GROUP[category];
  
  return (
    <div className={`transaction-item transaction-${group}`}>
      <img src={icon} alt={category} />
      <span>{category}</span>
    </div>
  );
};
```

---

### Task 4: Update Tests

**Old Test**:
```python
def test_process_transfer():
    result = payment_service.initiate_transfer(InitiatePaymentSchema(...))
    assert result.transaction_type == "transfer"
```

**New Test**:
```python
from utils.payment_types import PaymentType, PaymentTypeHelper

def test_process_transfer():
    result = payment_service.initiate_transfer(InitiatePaymentSchema(...))
    
    # Normalize and validate
    normalized = PaymentTypeHelper.normalize_payment_type(result.payment_type)
    assert normalized == PaymentType.TRANSFER
    
    # Check category
    assert PaymentTypeHelper.get_category(normalized) == PaymentTypeCategory.TRANSFERS

def test_normalize_legacy_types():
    assert PaymentTypeHelper.normalize_payment_type("transfer") == PaymentType.TRANSFER
    assert PaymentTypeHelper.normalize_payment_type("payment") == PaymentType.TRANSFER
    assert PaymentTypeHelper.normalize_payment_type("bill_payment") == PaymentType.BILL_PAYMENT
    
    with pytest.raises(ValueError):
        PaymentTypeHelper.normalize_payment_type("unknown_type")
```

---

## Troubleshooting

### "Unknown payment type" Error

**Problem**: `ValueError: Unknown payment type: xyz`

**Solution**: Check the value is in `PaymentType` enum or legacy mappings:
```python
# List all valid types
valid_types = PaymentTypeHelper.list_all_types()
print(f"Valid types: {valid_types}")

# Check legacy mapping
from utils.payment_types import LEGACY_TO_STANDARD_MAPPING
print(f"Legacy mappings: {LEGACY_TO_STANDARD_MAPPING.keys()}")
```

---

### Case Sensitivity Issues

**Problem**: `"transfer"` vs `"Transfer"`

**Solution**: Use normalization function which is case-insensitive:
```python
# All work identically
PaymentTypeHelper.normalize_payment_type("transfer")       # ✅
PaymentTypeHelper.normalize_payment_type("TRANSFER")       # ✅
PaymentTypeHelper.normalize_payment_type("Transfer")       # ✅
PaymentTypeHelper.normalize_payment_type(PaymentType.TRANSFER)  # ✅
```

---

### TypeScript Type Errors

**Problem**: Passing string instead of enum
```typescript
// ❌ Type error
const type: PaymentType = "transfer";

// ✅ Correct
const type: PaymentType = PaymentType.TRANSFER;

// ✅ Or normalize string
const type = PaymentTypeHelper.normalizePaymentType("transfer");
```

---

## Rollback Plan

If issues arise during deployment:

1. **Immediate**: Keep legacy type definitions in place
2. **Normalization**: Use `normalize_payment_type()` wrapper
3. **Gradual**: Migrate one service at a time
4. **Monitor**: Check logs for normalization errors
5. **Rollback**: Switch back to legacy types if critical issues

Legacy mappings are built into `LEGACY_TO_STANDARD_MAPPING`, so old strings will continue to work through normalization.

---

## Performance Considerations

The standardization introduces negligible overhead:

- **Enum lookup**: O(1) constant time
- **Normalization**: O(n) where n is number of types (17), performed once per request
- **Category lookup**: O(1) via dictionary/map
- **Memory**: ~2KB per service for enum definitions

---

## Next Steps

1. **Update your service** to import centralized types
2. **Replace manual type checking** with enum constants
3. **Update API responses** to include standardized types
4. **Add tests** for payment type normalization
5. **Update UI** to handle all 17 payment types
6. **Deploy** and monitor logs for issues

---

## Questions?

Refer to:
- [PAYMENT_TYPE_STANDARDIZATION.md](./PAYMENT_TYPE_STANDARDIZATION.md) - Full architecture
- Code comments in `payment_types.py`, `payment-types.ts`, `payment_types.go`
- Test examples in test files
- Ask the payments platform team

---

**Last Updated**: May 2026
