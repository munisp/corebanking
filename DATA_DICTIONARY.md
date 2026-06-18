# 54Bank Data Dictionary

**Total Tables:** 267 | **Total Columns:** 3310 | **Total Rows:** 3312
**Database:** PostgreSQL 14+ | **ORM:** Drizzle ORM | **Schema:** `drizzle/schema.ts`

---

## Table of Contents

- [Core Banking](#core-banking) (9 tables)
- [Accounts & Transactions](#accounts--transactions) (14 tables)
- [Lending & Credit](#lending--credit) (10 tables)
- [Treasury & FX](#treasury--fx) (1 tables)
- [Trade Finance](#trade-finance) (1 tables)
- [AML & Compliance](#aml--compliance) (19 tables)
- [KYC & Verification](#kyc--verification) (8 tables)
- [Agriculture Banking](#agriculture-banking) (20 tables)
- [Channel Banking](#channel-banking) (17 tables)
- [Agent Banking](#agent-banking) (2 tables)
- [Platform & Tenants](#platform--tenants) (17 tables)
- [Audit & Security](#audit--security) (11 tables)
- [Analytics & Reporting](#analytics--reporting) (4 tables)
- [Infrastructure & Operations](#infrastructure--operations) (134 tables)

---

## Core Banking

*9 tables, 45 rows*

### `billingRateCards`

**Columns:** 13 | **Rows:** 9

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `rateCardId` | varchar | ✗ | rateCard ID |
| `billingAccountId` | varchar | ✓ | billingAccount ID |
| `name` | varchar | ✗ | name |
| `version` | integer | ✗ | version |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `effectiveFrom` | timestamp | ✗ | effectiveFrom |
| `effectiveTo` | timestamp | ✓ | effectiveTo |
| `pricingCurrency` | varchar | ✗ | pricingCurrency |
| `createdBy` | varchar | ✗ | createdBy |
| `approvalState` | text | ✗ | approvalState |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `customerCards`

**Columns:** 15 | **Rows:** 3

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `cardId` | varchar | ✗ | card ID |
| `customerId` | varchar | ✗ | customer ID |
| `cardType` | text | ✗ | cardType |
| `brand` | text | ✗ | brand |
| `lastFour` | varchar | ✗ | lastFour |
| `expiryDate` | varchar | ✗ | expiryDate |
| `cardHolder` | varchar | ✗ | cardHolder |
| `balance` | float8 | ✗ | balance |
| `isLocked` | integer | ✗ | isLocked |
| `controls` | jsonb | ✗ | controls |
| `spendingLimits` | jsonb | ✗ | spendingLimits |
| `colorTone` | text | ✗ | colorTone |
| `updatedAt` | timestamp | ✗ | Last update timestamp |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerSavedBillers`

**Columns:** 12 | **Rows:** 3

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `billerRecordId` | varchar | ✗ | billerRecord ID |
| `customerId` | varchar | ✗ | customer ID |
| `category` | text | ✗ | category |
| `provider` | varchar | ✗ | provider |
| `billerId` | varchar | ✗ | biller ID |
| `customerReference` | varchar | ✗ | customerReference |
| `nickname` | varchar | ✗ | nickname |
| `lastAmount` | float8 | ✗ | lastAmount |
| `verifiedName` | varchar | ✓ | verifiedName |
| `lastPaidAt` | timestamp | ✓ | lastPaidAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerSessionPreferences`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `actorId` | varchar | ✗ | actor ID |
| `actorRole` | varchar | ✗ | actorRole |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `activeCustomerId` | varchar | ✗ | activeCustomer ID |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `customerStatementExports`

**Columns:** 8 | **Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `exportRequestId` | varchar | ✗ | exportRequest ID |
| `customerId` | varchar | ✗ | customer ID |
| `exportJobId` | varchar | ✗ | exportJob ID |
| `format` | text | ✗ | format |
| `rowCount` | integer | ✗ | rowCount |
| `title` | varchar | ✗ | title |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerStatements`

**Columns:** 13 | **Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `statementId` | varchar | ✗ | statement ID |
| `customerId` | varchar | ✗ | customer ID |
| `title` | varchar | ✗ | title |
| `detail` | text | ✗ | detail |
| `amount` | float8 | ✗ | amount |
| `direction` | text | ✗ | direction |
| `statementType` | text | ✗ | statementType |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `occurredAt` | timestamp | ✗ | occurredAt |
| `reference` | varchar | ✓ | reference |
| `category` | varchar | ✓ | category |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customers`

**Columns:** 17 | **Rows:** 6

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `segment` | varchar | ✗ | segment |
| `tier` | varchar | ✗ | tier |
| `location` | varchar | ✗ | location |
| `relationshipManager` | varchar | ✗ | relationshipManager |
| `risk` | varchar | ✗ | risk |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `bvn` | varchar | ✗ | bvn |
| `phone` | varchar | ✗ | phone |
| `balance` | float8 | ✗ | balance |
| `lastTouchpointLabel` | varchar | ✗ | lastTouchpointLabel |
| `lastTouchpointAt` | timestamp | ✗ | lastTouchpointAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `grid_cards`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `grid_card_id` | text | ✗ | grid card id |
| `customer_id` | text | ✗ | customer id |
| `card_serial` | text | ✗ | card serial |
| `grid_size` | text | ✗ | grid size |
| `grid_values_encrypted` | text | ✓ | grid values encrypted |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `usage_count` | integer | ✓ | usage count |
| `branch_code` | text | ✓ | branch code |
| `issued_at` | timestamp | ✓ | issued at |
| `expires_at` | timestamp | ✓ | expires at |
| `last_used_at` | timestamp | ✓ | last used at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `scratch_cards`

**Columns:** 22 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `card_id` | text | ✗ | card id |
| `batch_id` | text | ✗ | batch id |
| `serial_number` | text | ✗ | serial number |
| `card_type` | text | ✗ | card type |
| `pin_hash` | text | ✓ | pin hash |
| `pin_length` | integer | ✓ | pin length |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `max_attempts` | integer | ✓ | max attempts |
| `used_attempts` | integer | ✓ | used attempts |
| `value` | real | ✓ | value |
| `currency` | text | ✓ | currency |
| `issued_to` | text | ✓ | issued to |
| `customer_id` | text | ✓ | customer id |
| `branch_code` | text | ✓ | branch code |
| `expires_at` | timestamp | ✓ | expires at |
| `activated_at` | timestamp | ✓ | activated at |
| `used_at` | timestamp | ✓ | used at |
| `revoked_at` | timestamp | ✓ | revoked at |
| `revoke_reason` | text | ✓ | revoke reason |
| `tamper_detected` | boolean | ✓ | tamper detected |
| `created_at` | timestamp | ✓ | Record creation timestamp |

---

## Accounts & Transactions

*14 tables, 128 rows*

### `accounts`

**Columns:** 18 | **Rows:** 16

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `accountId` | varchar | ✗ | account ID |
| `customerId` | varchar | ✗ | customer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `accountName` | varchar | ✗ | accountName |
| `accountType` | text | ✗ | accountType |
| `currency` | varchar | ✗ | currency |
| `balance` | float8 | ✗ | balance |
| `availableBalance` | float8 | ✗ | availableBalance |
| `ledgerBalance` | float8 | ✗ | ledgerBalance |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `branchCode` | varchar | ✗ | branchCode |
| `openedAt` | timestamp | ✗ | openedAt |
| `lastTransactionAt` | timestamp | ✓ | lastTransactionAt |
| `version` | integer | ✗ | version |
| `tigerbeetleAccountId` | varchar | ✓ | tigerbeetleAccount ID |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingAccounts`

**Columns:** 15 | **Rows:** 9

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `accountName` | varchar | ✗ | accountName |
| `billingModel` | text | ✗ | billingModel |
| `currency` | varchar | ✗ | currency |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `contractStartAt` | timestamp | ✗ | contractStartAt |
| `contractEndAt` | timestamp | ✓ | contractEndAt |
| `defaultRateCardId` | varchar | ✗ | defaultRateCard ID |
| `minimumCommitAmount` | float8 | ✗ | minimumCommitAmount |
| `defaultBillingPeriodType` | text | ✗ | defaultBillingPeriodType |
| `invoiceDueDays` | integer | ✗ | invoiceDueDays |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `cardTransactions`

**Columns:** 17 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `cardTxnId` | varchar | ✗ | cardTxn ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `cardId` | varchar | ✗ | card ID |
| `accountId` | varchar | ✗ | account ID |
| `merchantName` | varchar | ✓ | merchantName |
| `merchantCategory` | varchar | ✓ | merchantCategory |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `type` | text | ✗ | type |
| `channel` | text | ✗ | channel |
| `authorizationCode` | varchar | ✓ | authorizationCode |
| `stan` | varchar | ✓ | stan |
| `rrn` | varchar | ✓ | rrn |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `declineReason` | text | ✓ | declineReason |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerTransfers`

**Columns:** 20 | **Rows:** 2

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `transferId` | varchar | ✗ | transfer ID |
| `customerId` | varchar | ✗ | customer ID |
| `beneficiaryId` | varchar | ✓ | beneficiary ID |
| `beneficiaryName` | varchar | ✗ | beneficiaryName |
| `amount` | float8 | ✗ | amount |
| `narration` | text | ✓ | narration |
| `transferType` | text | ✗ | transferType |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `bankCode` | varchar | ✓ | bankCode |
| `bankName` | varchar | ✓ | bankName |
| `accountNumber` | varchar | ✓ | accountNumber |
| `accountName` | varchar | ✓ | accountName |
| `workflowId` | varchar | ✓ | workflow ID |
| `otpReference` | varchar | ✓ | otpReference |
| `otpIssuedAt` | timestamp | ✓ | otpIssuedAt |
| `confirmedAt` | timestamp | ✓ | confirmedAt |
| `approvalState` | text | ✓ | approvalState |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `escrow_accounts`

**Columns:** 25 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `escrowId` | varchar | ✗ | escrow ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `escrowType` | varchar | ✗ | escrowType |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `condition` | text | ✓ | condition |
| `expiresAt` | timestamp | ✓ | expiresAt |
| `interestRate` | float8 | ✓ | interestRate |
| `accruedInterest` | float8 | ✓ | accruedInterest |
| `setupFee` | float8 | ✓ | setupFee |
| `holdingFeeAnnual` | float8 | ✓ | holdingFeeAnnual |
| `totalFeesCharged` | float8 | ✓ | totalFeesCharged |
| `tigerBeetleTxId` | varchar | ✓ | tigerBeetleTx ID |
| `kafkaEventId` | varchar | ✓ | kafkaEvent ID |
| `temporalWorkflowId` | varchar | ✓ | temporalWorkflow ID |
| `approvedBy` | varchar | ✓ | approvedBy |
| `releasedAt` | timestamp | ✓ | releasedAt |
| `cancelledAt` | timestamp | ✓ | cancelledAt |
| `disputeReason` | text | ✓ | disputeReason |
| `notes` | text | ✓ | notes |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `escrow_transactions`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `txId` | varchar | ✗ | tx ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `type` | varchar | ✗ | type |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `fromAccount` | varchar | ✓ | fromAccount |
| `toAccount` | varchar | ✓ | toAccount |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `ledgerRef` | varchar | ✓ | ledgerRef |
| `milestoneId` | varchar | ✓ | milestone ID |
| `narration` | text | ✓ | narration |
| `fxRate` | float8 | ✓ | fxRate |
| `fxSourceCurrency` | varchar | ✓ | fxSourceCurrency |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `glAccounts`

**Columns:** 13 | **Rows:** 16

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `glAccountCode` | varchar | ✗ | glAccountCode |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `category` | text | ✗ | category |
| `subcategory` | text | ✗ | subcategory |
| `parentCode` | varchar | ✓ | parentCode |
| `currency` | varchar | ✗ | currency |
| `balance` | float8 | ✗ | balance |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `isControlAccount` | integer | ✗ | isControlAccount |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `nipTransactions`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `nipId` | varchar | ✗ | nip ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `sessionId` | varchar | ✗ | session ID |
| `direction` | text | ✗ | direction |
| `sourceBank` | varchar | ✗ | sourceBank |
| `destinationBank` | varchar | ✗ | destinationBank |
| `sourceAccount` | varchar | ✗ | sourceAccount |
| `destinationAccount` | varchar | ✗ | destinationAccount |
| `amount` | float8 | ✗ | amount |
| `narration` | text | ✗ | narration |
| `responseCode` | varchar | ✓ | responseCode |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `completedAt` | timestamp | ✓ | completedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `nostroAccounts`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `nostroId` | varchar | ✗ | nostro ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `correspondentBank` | varchar | ✗ | correspondentBank |
| `currency` | varchar | ✗ | currency |
| `accountNumber` | varchar | ✗ | accountNumber |
| `swiftCode` | varchar | ✗ | swiftCode |
| `balance` | float8 | ✗ | balance |
| `lastReconciledAt` | timestamp | ✓ | lastReconciledAt |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `settlements`

**Columns:** 17 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `settlementId` | varchar | ✗ | settlement ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `windowId` | varchar | ✗ | window ID |
| `model` | text | ✗ | model |
| `corridor` | varchar | ✓ | corridor |
| `totalDebits` | float8 | ✗ | totalDebits |
| `totalCredits` | float8 | ✗ | totalCredits |
| `netPosition` | float8 | ✗ | netPosition |
| `currency` | varchar | ✗ | currency |
| `participantCount` | integer | ✗ | participantCount |
| `transferCount` | integer | ✗ | transferCount |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `openedAt` | timestamp | ✗ | openedAt |
| `closedAt` | timestamp | ✓ | closedAt |
| `settledAt` | timestamp | ✓ | settledAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `tellerTransactions`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `txnId` | varchar | ✗ | txn ID |
| `sessionId` | varchar | ✗ | session ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `txnType` | varchar | ✗ | txnType |
| `customerId` | varchar | ✗ | customer ID |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `reference` | varchar | ✓ | reference |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `processedAt` | varchar | ✗ | processedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `transactions`

**Columns:** 16 | **Rows:** 13

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `transactionId` | varchar | ✗ | transaction ID |
| `accountId` | varchar | ✗ | account ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `type` | text | ✗ | type |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `narration` | text | ✗ | narration |
| `reference` | varchar | ✗ | reference |
| `channel` | text | ✗ | channel |
| `counterpartyAccountId` | varchar | ✓ | counterpartyAccount ID |
| `counterpartyName` | varchar | ✓ | counterpartyName |
| `balanceAfter` | float8 | ✗ | balanceAfter |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `valueDate` | timestamp | ✗ | valueDate |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `transfers`

**Columns:** 20 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `transferId` | varchar | ✗ | transfer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `sourceAccountId` | varchar | ✗ | sourceAccount ID |
| `destinationAccountId` | varchar | ✓ | destinationAccount ID |
| `destinationBank` | varchar | ✓ | destinationBank |
| `destinationAccountNumber` | varchar | ✓ | destinationAccountNumber |
| `beneficiaryName` | varchar | ✓ | beneficiaryName |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `channel` | text | ✗ | channel |
| `narration` | text | ✗ | narration |
| `nipSessionId` | varchar | ✓ | nipSession ID |
| `mojaloopTransferId` | varchar | ✓ | mojaloopTransfer ID |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `failureReason` | text | ✓ | failureReason |
| `idempotencyKey` | varchar | ✓ | idempotencyKey |
| `transferDate` | timestamp | ✗ | transferDate |
| `completedAt` | timestamp | ✓ | completedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `virtualAccounts`

**Columns:** 19 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `accountId` | varchar | ✗ | account ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `van` | varchar | ✗ | van |
| `parentAccountId` | varchar | ✓ | parentAccount ID |
| `ownerId` | varchar | ✗ | owner ID |
| `ownerName` | varchar | ✗ | ownerName |
| `ownerType` | varchar | ✗ | ownerType |
| `purpose` | text | ✓ | purpose |
| `currency` | varchar | ✗ | currency |
| `balance` | float8 | ✓ | balance |
| `availableBalance` | float8 | ✓ | availableBalance |
| `holdAmount` | float8 | ✓ | holdAmount |
| `dailyLimit` | float8 | ✓ | dailyLimit |
| `monthlyLimit` | float8 | ✓ | monthlyLimit |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `expiryDate` | timestamp | ✓ | expiryDate |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

---

## Lending & Credit

*10 tables, 83 rows*

### `agriLoans`

**Columns:** 25 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `loanId` | varchar | ✗ | loan ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `farmerId` | varchar | ✗ | farmer ID |
| `loanType` | varchar | ✗ | loanType |
| `productCode` | varchar | ✗ | productCode |
| `principalAmount` | float8 | ✗ | principalAmount |
| `interestRateBps` | integer | ✗ | interestRateBps |
| `tenorMonths` | integer | ✗ | tenorMonths |
| `currency` | varchar | ✗ | currency |
| `purpose` | text | ✗ | purpose |
| `collateralType` | varchar | ✗ | collateralType |
| `collateralValue` | float8 | ✗ | collateralValue |
| `cropCycle` | varchar | ✗ | cropCycle |
| `expectedHarvestDate` | varchar | ✗ | expectedHarvestDate |
| `disbursementDate` | varchar | ✓ | disbursementDate |
| `maturityDate` | varchar | ✓ | maturityDate |
| `outstandingBalance` | float8 | ✗ | outstandingBalance |
| `totalRepaid` | float8 | ✗ | totalRepaid |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `approvalStatus` | varchar | ✗ | approvalStatus |
| `riskGrade` | varchar | ✗ | riskGrade |
| `repaymentSchedule` | jsonb | ✗ | repaymentSchedule |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `cooperative_credit_scoring`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `educationLoans`

**Columns:** 20 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `loanId` | varchar | ✗ | loan ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `studentId` | varchar | ✓ | student ID |
| `studentName` | varchar | ✗ | studentName |
| `institutionName` | varchar | ✗ | institutionName |
| `programName` | varchar | ✓ | programName |
| `loanAmount` | float8 | ✗ | loanAmount |
| `interestRate` | float8 | ✗ | interestRate |
| `tenorMonths` | integer | ✗ | tenorMonths |
| `graceMonths` | integer | ✗ | graceMonths |
| `emi` | float8 | ✗ | emi |
| `totalDisbursed` | float8 | ✓ | totalDisbursed |
| `totalRepaid` | float8 | ✓ | totalRepaid |
| `outstandingBalance` | float8 | ✗ | outstandingBalance |
| `cosignerName` | varchar | ✓ | cosignerName |
| `cosignerType` | varchar | ✓ | cosignerType |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `ijaraContracts`

**Columns:** 23 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `contractId` | varchar | ✗ | contract ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `assetDescription` | text | ✗ | assetDescription |
| `assetCategory` | varchar | ✗ | assetCategory |
| `assetValue` | float8 | ✗ | assetValue |
| `rentalAmount` | float8 | ✗ | rentalAmount |
| `rentalFrequency` | varchar | ✗ | rentalFrequency |
| `currency` | varchar | ✗ | currency |
| `leaseStart` | varchar | ✗ | leaseStart |
| `leaseEnd` | varchar | ✗ | leaseEnd |
| `tenorMonths` | integer | ✗ | tenorMonths |
| `residualValue` | float8 | ✗ | residualValue |
| `purchaseOption` | integer | ✗ | purchaseOption |
| `purchasePrice` | float8 | ✓ | purchasePrice |
| `totalRentPaid` | float8 | ✗ | totalRentPaid |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `shariaCompliance` | varchar | ✗ | shariaCompliance |
| `maintenanceResponsibility` | varchar | ✗ | maintenanceResponsibility |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `lendingGroups`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `groupId` | varchar | ✗ | group ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `purpose` | text | ✓ | purpose |
| `groupLeaderId` | varchar | ✗ | groupLeader ID |
| `groupLeaderName` | varchar | ✓ | groupLeaderName |
| `maxMembers` | integer | ✗ | maxMembers |
| `liabilityType` | varchar | ✗ | liabilityType |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `lettersOfCredit`

**Columns:** 24 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `lcId` | varchar | ✗ | lc ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `lcType` | varchar | ✗ | lcType |
| `applicantId` | varchar | ✗ | applicant ID |
| `applicantName` | varchar | ✗ | applicantName |
| `beneficiaryName` | varchar | ✗ | beneficiaryName |
| `beneficiaryBank` | varchar | ✓ | beneficiaryBank |
| `beneficiaryCountry` | varchar | ✓ | beneficiaryCountry |
| `issuingBank` | varchar | ✗ | issuingBank |
| `advisingBank` | varchar | ✓ | advisingBank |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `commodity` | varchar | ✓ | commodity |
| `incoterm` | varchar | ✓ | incoterm |
| `portOfLoading` | varchar | ✓ | portOfLoading |
| `portOfDischarge` | varchar | ✓ | portOfDischarge |
| `latestShipDate` | varchar | ✓ | latestShipDate |
| `expiryDate` | varchar | ✗ | expiryDate |
| `documentsRequired` | jsonb | ✗ | documentsRequired |
| `amendments` | jsonb | ✗ | amendments |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `loans`

**Columns:** 21 | **Rows:** 11

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `loanId` | varchar | ✗ | loan ID |
| `customerId` | varchar | ✗ | customer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `loanType` | text | ✗ | loanType |
| `principalAmount` | float8 | ✗ | principalAmount |
| `outstandingBalance` | float8 | ✗ | outstandingBalance |
| `interestRate` | float8 | ✗ | interestRate |
| `currency` | varchar | ✗ | currency |
| `tenor` | integer | ✗ | tenor |
| `tenorUnit` | text | ✗ | tenorUnit |
| `disbursementDate` | timestamp | ✓ | disbursementDate |
| `maturityDate` | timestamp | ✓ | maturityDate |
| `nextPaymentDate` | timestamp | ✓ | nextPaymentDate |
| `nextPaymentAmount` | float8 | ✓ | nextPaymentAmount |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `classificationIFRS9` | text | ✓ | classificationIFRS9 |
| `collateralValue` | float8 | ✓ | collateralValue |
| `approvedBy` | varchar | ✓ | approvedBy |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `mudarabahContracts`

**Columns:** 22 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `contractId` | varchar | ✗ | contract ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `investorId` | varchar | ✗ | investor ID |
| `investorName` | varchar | ✗ | investorName |
| `fundManagerId` | varchar | ✗ | fundManager ID |
| `investmentPurpose` | text | ✗ | investmentPurpose |
| `capitalAmount` | float8 | ✗ | capitalAmount |
| `currency` | varchar | ✗ | currency |
| `profitSharingRatioInvestor` | float8 | ✗ | profitSharingRatioInvestor |
| `profitSharingRatioManager` | float8 | ✗ | profitSharingRatioManager |
| `investmentPeriodMonths` | integer | ✗ | investmentPeriodMonths |
| `startDate` | varchar | ✗ | startDate |
| `maturityDate` | varchar | ✗ | maturityDate |
| `realizedProfit` | float8 | ✗ | realizedProfit |
| `realizedLoss` | float8 | ✗ | realizedLoss |
| `distributions` | jsonb | ✗ | distributions |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `shariaCompliance` | varchar | ✗ | shariaCompliance |
| `riskCategory` | varchar | ✗ | riskCategory |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `murabahaContracts`

**Columns:** 23 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `contractId` | varchar | ✗ | contract ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `assetDescription` | text | ✗ | assetDescription |
| `assetCategory` | varchar | ✗ | assetCategory |
| `costPrice` | float8 | ✗ | costPrice |
| `profitMarginPct` | float8 | ✗ | profitMarginPct |
| `sellingPrice` | float8 | ✗ | sellingPrice |
| `currency` | varchar | ✗ | currency |
| `tenorMonths` | integer | ✗ | tenorMonths |
| `instalmentAmount` | float8 | ✗ | instalmentAmount |
| `totalPaid` | float8 | ✗ | totalPaid |
| `outstandingBalance` | float8 | ✗ | outstandingBalance |
| `disbursementDate` | varchar | ✓ | disbursementDate |
| `maturityDate` | varchar | ✓ | maturityDate |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `shariaCompliance` | varchar | ✗ | shariaCompliance |
| `shariaBoardReference` | text | ✓ | shariaBoardReference |
| `instalmentSchedule` | jsonb | ✗ | instalmentSchedule |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `nirsal_credit_guarantee`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Treasury & FX

*1 tables, 8 rows*

### `fxTrades`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tradeId` | varchar | ✗ | trade ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `buyCurrency` | varchar | ✗ | buyCurrency |
| `sellCurrency` | varchar | ✗ | sellCurrency |
| `buyAmount` | float8 | ✗ | buyAmount |
| `sellAmount` | float8 | ✗ | sellAmount |
| `exchangeRate` | float8 | ✗ | exchangeRate |
| `tradeType` | text | ✗ | tradeType |
| `counterparty` | varchar | ✓ | counterparty |
| `valueDate` | timestamp | ✗ | valueDate |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `traderId` | varchar | ✓ | trader ID |
| `approvedBy` | varchar | ✓ | approvedBy |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

---

## Trade Finance

*1 tables, 8 rows*

### `crossborder_agri_trade`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## AML & Compliance

*19 tables, 250 rows*

### `adverse_media_hits`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `entity_name` | text | ✗ | entity name |
| `source` | varchar | ✗ | source |
| `headline` | text | ✓ | headline |
| `risk_impact` | varchar | ✗ | risk impact |
| `sentiment` | float8 | ✓ | sentiment |
| `url` | text | ✓ | url |
| `detected_at` | timestamp | ✓ | detected at |
| `reviewed_at` | timestamp | ✓ | reviewed at |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |

### `adverse_media_scans`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `relevantArticles` | integer | ✓ | relevantArticles |
| `sentiment` | varchar | ✗ | sentiment |
| `riskImpact` | varchar | ✗ | riskImpact |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `amlAlerts`

**Columns:** 16 | **Rows:** 10

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `alertId` | varchar | ✗ | alert ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `customerId` | varchar | ✗ | customer ID |
| `entityType` | text | ✗ | entityType |
| `entityId` | varchar | ✗ | entity ID |
| `ruleId` | varchar | ✗ | rule ID |
| `ruleName` | varchar | ✗ | ruleName |
| `riskScore` | float8 | ✗ | riskScore |
| `severity` | text | ✗ | severity |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `assignedTo` | varchar | ✓ | assignedTo |
| `notes` | text | ✓ | notes |
| `detectedAt` | timestamp | ✗ | detectedAt |
| `resolvedAt` | timestamp | ✓ | resolvedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `aml_cases`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `caseType` | varchar | ✗ | caseType |
| `riskLevel` | varchar | ✗ | riskLevel |
| `assignedTo` | varchar | ✗ | assignedTo |
| `sarFiled` | boolean | ✓ | sarFiled |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `aml_compliance_metrics`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `period` | varchar | ✗ | period |
| `totalScreenings` | integer | ✓ | totalScreenings |
| `sarsFiled` | integer | ✓ | sarsFiled |
| `ctrsFiled` | integer | ✓ | ctrsFiled |
| `complianceScore` | integer | ✓ | complianceScore |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `aml_risk_scores`

**Columns:** 11 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `riskScore` | integer | ✓ | riskScore |
| `riskLevel` | varchar | ✗ | riskLevel |
| `sanctionsHits` | integer | ✓ | sanctionsHits |
| `pepMatch` | boolean | ✓ | pepMatch |
| `adverseMedia` | integer | ✓ | adverseMedia |
| `cddLevel` | varchar | ✗ | cddLevel |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `aml_training_records`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `staffId` | varchar | ✗ | staff ID |
| `staffName` | varchar | ✗ | staffName |
| `role` | varchar | ✗ | role |
| `trainingModule` | varchar | ✗ | trainingModule |
| `score` | integer | ✓ | score |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `cbn_agri_returns`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cbn_agsmeis`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cbn_anchor_borrowers`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cbn_compliance_checks`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `circular` | varchar | ✗ | circular |
| `title` | text | ✓ | title |
| `category` | varchar | ✓ | category |
| `total_controls` | integer | ✓ | total controls |
| `passing` | integer | ✓ | passing |
| `failing` | integer | ✓ | failing |
| `compliance_score` | real | ✓ | compliance score |
| `last_assessed` | timestamp | ✓ | last assessed |
| `next_assessment` | timestamp | ✓ | next assessment |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `ctr_reports_aml`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `transactionId` | varchar | ✗ | transaction ID |
| `amount` | bigint | ✓ | amount |
| `currency` | varchar | ✗ | currency |
| `transactionType` | varchar | ✗ | transactionType |
| `nfiuReference` | varchar | ✗ | nfiuReference |
| `autoFiled` | boolean | ✓ | autoFiled |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `escrow_regulatory_reports`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `reportId` | varchar | ✗ | report ID |
| `reportType` | varchar | ✗ | reportType |
| `reportingPeriodStart` | timestamp | ✗ | reportingPeriodStart |
| `reportingPeriodEnd` | timestamp | ✗ | reportingPeriodEnd |
| `totalEscrowAccounts` | integer | ✓ | totalEscrowAccounts |
| `totalHeldValue` | float8 | ✓ | totalHeldValue |
| `totalReleasedValue` | float8 | ✓ | totalReleasedValue |
| `totalDisputedValue` | float8 | ✓ | totalDisputedValue |
| `totalInterestAccrued` | float8 | ✓ | totalInterestAccrued |
| `filedAt` | timestamp | ✓ | filedAt |
| `filingReference` | varchar | ✓ | filingReference |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `reportData` | jsonb | ✓ | reportData |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `goaml_reports`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `reportType` | varchar | ✗ | reportType |
| `subject` | varchar | ✗ | subject |
| `amount` | bigint | ✓ | amount |
| `nfiuAcknowledgement` | varchar | ✗ | nfiuAcknowledgement |
| `xmlValidated` | boolean | ✓ | xmlValidated |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `regulatoryReports`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `reportId` | varchar | ✗ | report ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `reportType` | varchar | ✗ | reportType |
| `period` | varchar | ✗ | period |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `submittedTo` | varchar | ✓ | submittedTo |
| `submittedAt` | timestamp | ✓ | submittedAt |
| `data` | jsonb | ✓ | data |
| `summary` | jsonb | ✓ | summary |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `regulatory_reports_aml`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `reportType` | varchar | ✗ | reportType |
| `period` | varchar | ✗ | period |
| `submittedTo` | varchar | ✗ | submittedTo |
| `filedDate` | varchar | ✗ | filedDate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sanctions_batch_runs`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `triggerType` | varchar | ✗ | triggerType |
| `customersScreened` | integer | ✓ | customersScreened |
| `newMatches` | integer | ✓ | newMatches |
| `processingTimeMin` | integer | ✓ | processingTimeMin |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sanctions_screenings`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `entity_name` | text | ✗ | entity name |
| `entity_type` | varchar | ✗ | entity type |
| `lists_checked` | jsonb | ✓ | lists checked |
| `match_found` | integer | ✗ | match found |
| `highest_score` | float8 | ✓ | highest score |
| `match_details` | jsonb | ✓ | match details |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `screened_by` | varchar | ✓ | screened by |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sar_reports_aml`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `reportType` | varchar | ✗ | reportType |
| `reason` | text | ✗ | reason |
| `amount` | bigint | ✓ | amount |
| `currency` | varchar | ✗ | currency |
| `nfiuReference` | varchar | ✗ | nfiuReference |
| `priority` | varchar | ✗ | priority |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

---

## KYC & Verification

*8 tables, 64 rows*

### `agent_kyc_captures`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `agent_id` | varchar | ✗ | agent id |
| `agent_name` | text | ✓ | agent name |
| `customer_id` | varchar | ✓ | customer id |
| `customer_name` | text | ✓ | customer name |
| `lga` | varchar | ✓ | lga |
| `state` | varchar | ✓ | state |
| `offline_capture` | integer | ✗ | offline capture |
| `quality_score` | float8 | ✓ | quality score |
| `gps_lat` | float8 | ✓ | gps lat |
| `gps_lng` | float8 | ✓ | gps lng |
| `synced_at` | timestamp | ✓ | synced at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `kycVerifications`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `verificationId` | varchar | ✗ | verification ID |
| `customerId` | varchar | ✗ | customer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `verificationType` | text | ✗ | verificationType |
| `documentReference` | varchar | ✓ | documentReference |
| `provider` | varchar | ✗ | provider |
| `providerResponse` | jsonb | ✓ | providerResponse |
| `matchScore` | float8 | ✓ | matchScore |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `verifiedAt` | timestamp | ✓ | verifiedAt |
| `expiresAt` | timestamp | ✓ | expiresAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `kyc_data_quality_metrics`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `total_customers` | integer | ✗ | total customers |
| `kyc_complete` | integer | ✗ | kyc complete |
| `kyc_complete_pct` | float8 | ✓ | kyc complete pct |
| `expired_documents` | integer | ✗ | expired documents |
| `duplicate_bvn` | integer | ✗ | duplicate bvn |
| `missing_nin` | integer | ✗ | missing nin |
| `snapshot_date` | timestamp | ✓ | snapshot date |

### `kyc_tier_history`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customer_id` | varchar | ✗ | customer id |
| `previous_tier` | integer | ✗ | previous tier |
| `new_tier` | integer | ✗ | new tier |
| `reason` | text | ✓ | reason |
| `changed_by` | varchar | ✓ | changed by |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `kyc_tiers`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customer_id` | varchar | ✗ | customer id |
| `customer_name` | text | ✗ | customer name |
| `current_tier` | integer | ✗ | current tier |
| `daily_limit_ngn` | float8 | ✗ | daily limit ngn |
| `daily_used_ngn` | float8 | ✗ | daily used ngn |
| `evaluation_score` | float8 | ✓ | evaluation score |
| `risk_flags` | jsonb | ✓ | risk flags |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `last_evaluated_at` | timestamp | ✓ | last evaluated at |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `pin_verifications`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `verification_id` | text | ✗ | verification id |
| `card_id` | text | ✗ | card id |
| `serial_number` | text | ✗ | serial number |
| `customer_id` | text | ✗ | customer id |
| `transaction_id` | text | ✓ | transaction id |
| `channel` | text | ✓ | channel |
| `result` | text | ✗ | result |
| `ip_address` | text | ✓ | ip address |
| `device_id` | text | ✓ | device id |
| `timestamp` | timestamp | ✓ | timestamp |

### `telegram_kyc_bot`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `voice_biometric_auth`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Agriculture Banking

*20 tables, 160 rows*

### `agent_farmer_onboarding`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_esg_impact`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_evoucher`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_input_marketplace`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_iot_sensor`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_logistics`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_reinsurance`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `agri_savings_cycles`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cooperative_financials`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cooperative_management`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cooperative_meetings`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `cropInsurancePolicies`

**Columns:** 18 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `policyId` | varchar | ✗ | policy ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `farmerId` | varchar | ✗ | farmer ID |
| `policyType` | varchar | ✗ | policyType |
| `cropCovered` | varchar | ✗ | cropCovered |
| `coverageAreaHectares` | float8 | ✗ | coverageAreaHectares |
| `sumInsured` | float8 | ✗ | sumInsured |
| `premiumAmount` | float8 | ✗ | premiumAmount |
| `premiumFrequency` | varchar | ✗ | premiumFrequency |
| `policyStart` | varchar | ✗ | policyStart |
| `policyEnd` | varchar | ✗ | policyEnd |
| `weatherTrigger` | jsonb | ✓ | weatherTrigger |
| `claims` | jsonb | ✗ | claims |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `underwriter` | varchar | ✗ | underwriter |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `crop_yield_prediction`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `farmers`

**Columns:** 21 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `farmerId` | varchar | ✗ | farmer ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `bvn` | varchar | ✗ | bvn |
| `phone` | varchar | ✗ | phone |
| `region` | varchar | ✗ | region |
| `localGovernment` | varchar | ✗ | localGovernment |
| `farmSizeHectares` | float8 | ✗ | farmSizeHectares |
| `primaryCrop` | varchar | ✗ | primaryCrop |
| `secondaryCrops` | jsonb | ✗ | secondaryCrops |
| `cooperativeId` | varchar | ✓ | cooperative ID |
| `cooperativeName` | varchar | ✓ | cooperativeName |
| `bankAccountNumber` | varchar | ✓ | bankAccountNumber |
| `riskScore` | float8 | ✗ | riskScore |
| `riskTier` | varchar | ✗ | riskTier |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `geoCoordinates` | jsonb | ✓ | geoCoordinates |
| `registrationChannel` | varchar | ✗ | registrationChannel |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `interactive_ussd_agri`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `livestock_finance`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `livestock_insurance`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `livestock_management`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `multi_peril_crop_insurance`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `satellite_crop_monitor`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Channel Banking

*17 tables, 136 rows*

### `sms_alert_notification`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `sms_banking_gateway`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `sms_otp_service`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `telegram_banking_commands`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `telegram_bot_gateway`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `telegram_mini_app`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `telegram_notification`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `ussd_banking_gateway`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `ussd_multilingual`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `ussd_sim_toolkit`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `ussd_transaction_engine`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `voice_banking_gateway`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `whatsapp_banking_flows`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `whatsapp_business_gateway`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `whatsapp_document_service`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `whatsapp_notification`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `whatsapp_payment_integration`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Agent Banking

*2 tables, 16 rows*

### `agentBankingAgents`

**Columns:** 20 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `agentId` | varchar | ✗ | agent ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `agentCode` | varchar | ✗ | agentCode |
| `businessName` | varchar | ✗ | businessName |
| `ownerName` | varchar | ✗ | ownerName |
| `phoneNumber` | varchar | ✗ | phoneNumber |
| `email` | varchar | ✓ | email |
| `bvn` | varchar | ✓ | bvn |
| `lga` | varchar | ✓ | lga |
| `state` | varchar | ✓ | state |
| `agentType` | varchar | ✗ | agentType |
| `superAgentId` | varchar | ✓ | superAgent ID |
| `floatBalance` | float8 | ✓ | floatBalance |
| `commissionEarned` | float8 | ✓ | commissionEarned |
| `transactionCount` | integer | ✓ | transactionCount |
| `kycStatus` | varchar | ✓ | kycStatus |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `voice_agent_escalation`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Platform & Tenants

*17 tables, 152 rows*

### `billingAccrualSnapshots`

**Columns:** 16 | **Rows:** 11

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `accrualSnapshotId` | varchar | ✗ | accrualSnapshot ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `billingPeriodKey` | varchar | ✗ | billingPeriodKey |
| `meterKey` | varchar | ✗ | meterKey |
| `productKey` | varchar | ✗ | productKey |
| `ratedEventCount` | integer | ✗ | ratedEventCount |
| `usageQuantity` | integer | ✗ | usageQuantity |
| `accruedAmount` | float8 | ✗ | accruedAmount |
| `unratedEventCount` | integer | ✗ | unratedEventCount |
| `lastUsageAt` | timestamp | ✓ | lastUsageAt |
| `lastRatedAt` | timestamp | ✓ | lastRatedAt |
| `snapshotStatus` | text | ✗ | snapshotStatus |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingContractOverrides`

**Columns:** 16 | **Rows:** 10

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `contractOverrideId` | varchar | ✗ | contractOverride ID |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `overrideType` | text | ✗ | overrideType |
| `meterKey` | varchar | ✓ | meterKey |
| `productKey` | varchar | ✓ | productKey |
| `valueNumber` | float8 | ✓ | valueNumber |
| `valueText` | varchar | ✓ | valueText |
| `effectiveFrom` | timestamp | ✗ | effectiveFrom |
| `effectiveTo` | timestamp | ✓ | effectiveTo |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdBy` | varchar | ✗ | createdBy |
| `notes` | text | ✓ | notes |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingDiscountRules`

**Columns:** 17 | **Rows:** 9

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `discountRuleId` | varchar | ✗ | discountRule ID |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `discountType` | text | ✗ | discountType |
| `meterKey` | varchar | ✓ | meterKey |
| `productKey` | varchar | ✓ | productKey |
| `percentage` | float8 | ✓ | percentage |
| `fixedAmount` | float8 | ✓ | fixedAmount |
| `thresholdAmount` | float8 | ✓ | thresholdAmount |
| `effectiveFrom` | timestamp | ✗ | effectiveFrom |
| `effectiveTo` | timestamp | ✓ | effectiveTo |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdBy` | varchar | ✗ | createdBy |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingInvoiceApprovals`

**Columns:** 10 | **Rows:** 10

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `billingInvoiceApprovalId` | varchar | ✗ | billingInvoiceApproval ID |
| `billingInvoiceId` | varchar | ✗ | billingInvoice ID |
| `stageKey` | varchar | ✗ | stageKey |
| `actorRole` | text | ✗ | actorRole |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `actedAt` | timestamp | ✓ | actedAt |
| `note` | text | ✓ | note |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingInvoiceLines`

**Columns:** 12 | **Rows:** 15

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `billingInvoiceLineId` | varchar | ✗ | billingInvoiceLine ID |
| `billingInvoiceId` | varchar | ✗ | billingInvoice ID |
| `lineType` | text | ✗ | lineType |
| `meterKey` | varchar | ✓ | meterKey |
| `productKey` | varchar | ✓ | productKey |
| `description` | varchar | ✗ | description |
| `quantity` | float8 | ✗ | quantity |
| `unitPrice` | float8 | ✗ | unitPrice |
| `amount` | float8 | ✗ | amount |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `billingInvoices`

**Columns:** 24 | **Rows:** 9

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `billingInvoiceId` | varchar | ✗ | billingInvoice ID |
| `invoiceNumber` | varchar | ✗ | invoiceNumber |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `billingPeriodKey` | varchar | ✗ | billingPeriodKey |
| `billingPeriodType` | text | ✗ | billingPeriodType |
| `periodStartAt` | timestamp | ✗ | periodStartAt |
| `periodEndAt` | timestamp | ✗ | periodEndAt |
| `currency` | varchar | ✗ | currency |
| `subtotalAmount` | float8 | ✗ | subtotalAmount |
| `discountAmount` | float8 | ✗ | discountAmount |
| `revenueShareAmount` | float8 | ✗ | revenueShareAmount |
| `minimumCommitAdjustment` | float8 | ✗ | minimumCommitAdjustment |
| `taxAmount` | float8 | ✗ | taxAmount |
| `totalAmount` | float8 | ✗ | totalAmount |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `approvalStatus` | text | ✗ | approvalStatus |
| `generatedAt` | timestamp | ✗ | generatedAt |
| `dueAt` | timestamp | ✗ | dueAt |
| `approvalStepCount` | integer | ✗ | approvalStepCount |
| `issuedAt` | timestamp | ✓ | issuedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingRateCardLines`

**Columns:** 16 | **Rows:** 13

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `rateCardLineId` | varchar | ✗ | rateCardLine ID |
| `rateCardId` | varchar | ✗ | rateCard ID |
| `meterKey` | varchar | ✗ | meterKey |
| `productKey` | varchar | ✗ | productKey |
| `chargeType` | text | ✗ | chargeType |
| `unitPrice` | float8 | ✗ | unitPrice |
| `includedUnits` | integer | ✗ | includedUnits |
| `tierStart` | integer | ✓ | tierStart |
| `tierEnd` | integer | ✓ | tierEnd |
| `minimumCharge` | float8 | ✓ | minimumCharge |
| `maximumCharge` | float8 | ✓ | maximumCharge |
| `pricingFormula` | jsonb | ✓ | pricingFormula |
| `settlementLedgerCode` | varchar | ✓ | settlementLedgerCode |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingRatedEvents`

**Columns:** 12 | **Rows:** 11

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `ratedEventId` | varchar | ✗ | ratedEvent ID |
| `usageEventId` | varchar | ✗ | usageEvent ID |
| `rateCardId` | varchar | ✗ | rateCard ID |
| `rateCardLineId` | varchar | ✗ | rateCardLine ID |
| `billingPeriodKey` | varchar | ✗ | billingPeriodKey |
| `quantityRated` | integer | ✗ | quantityRated |
| `billableUnits` | float8 | ✗ | billableUnits |
| `amountAccrued` | float8 | ✗ | amountAccrued |
| `currency` | varchar | ✗ | currency |
| `ratingExplanation` | jsonb | ✗ | ratingExplanation |
| `ratedAt` | timestamp | ✗ | ratedAt |

### `billingRevenueShareRules`

**Columns:** 15 | **Rows:** 9

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `revenueShareRuleId` | varchar | ✗ | revenueShareRule ID |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `target` | text | ✗ | target |
| `percentage` | float8 | ✗ | percentage |
| `beneficiaryName` | varchar | ✗ | beneficiaryName |
| `settlementLedgerCode` | varchar | ✓ | settlementLedgerCode |
| `effectiveFrom` | timestamp | ✗ | effectiveFrom |
| `effectiveTo` | timestamp | ✓ | effectiveTo |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdBy` | varchar | ✗ | createdBy |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `billingUsageEvents`

**Columns:** 20 | **Rows:** 11

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `usageEventId` | varchar | ✗ | usageEvent ID |
| `idempotencyKey` | varchar | ✗ | idempotencyKey |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `billingAccountId` | varchar | ✗ | billingAccount ID |
| `sourceService` | varchar | ✗ | sourceService |
| `sourceEventType` | varchar | ✗ | sourceEventType |
| `meterKey` | varchar | ✗ | meterKey |
| `productKey` | varchar | ✗ | productKey |
| `quantity` | integer | ✗ | quantity |
| `unitAmount` | float8 | ✓ | unitAmount |
| `currency` | varchar | ✗ | currency |
| `eventTimestamp` | timestamp | ✗ | eventTimestamp |
| `ingestedAt` | timestamp | ✗ | ingestedAt |
| `correlationId` | varchar | ✓ | correlation ID |
| `actorId` | varchar | ✓ | actor ID |
| `resourceId` | varchar | ✓ | resource ID |
| `payload` | jsonb | ✗ | payload |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `exportJobs`

**Columns:** 17 | **Rows:** 10

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `exportJobId` | varchar | ✗ | exportJob ID |
| `domainKey` | varchar | ✗ | domainKey |
| `title` | varchar | ✗ | title |
| `format` | text | ✗ | format |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `requestedByRole` | varchar | ✗ | requestedByRole |
| `route` | varchar | ✗ | route |
| `rowCount` | integer | ✗ | rowCount |
| `approvalState` | text | ✗ | approvalState |
| `approvalSignature` | varchar | ✗ | approvalSignature |
| `downloadUrl` | varchar | ✗ | downloadUrl |
| `retainedUntil` | timestamp | ✓ | retainedUntil |
| `reportVersion` | varchar | ✓ | reportVersion |
| `approvalChain` | jsonb | ✗ | approvalChain |
| `signedBy` | jsonb | ✗ | signedBy |

### `operatorActions`

**Columns:** 12 | **Rows:** 16

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `actionId` | varchar | ✗ | action ID |
| `domainKey` | varchar | ✗ | domainKey |
| `title` | varchar | ✗ | title |
| `detail` | text | ✗ | detail |
| `owner` | varchar | ✗ | owner |
| `dueAt` | timestamp | ✗ | dueAt |
| `route` | varchar | ✗ | route |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `roles` | jsonb | ✗ | roles |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `partnerApprovalRecords`

**Columns:** 12 | **Rows:** 4

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `approvalId` | varchar | ✗ | approval ID |
| `partnerId` | varchar | ✗ | partner ID |
| `stage` | text | ✗ | stage |
| `title` | varchar | ✗ | title |
| `detail` | text | ✗ | detail |
| `state` | text | ✗ | state |
| `requiredRole` | text | ✗ | requiredRole |
| `requestedAt` | timestamp | ✗ | requestedAt |
| `requestedById` | varchar | ✗ | requestedBy ID |
| `resolvedAt` | timestamp | ✓ | resolvedAt |
| `resolutionNote` | text | ✓ | resolutionNote |

### `partnerOnboardingRecords`

**Columns:** 22 | **Rows:** 2

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `partnerId` | varchar | ✗ | partner ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `partnerName` | varchar | ✗ | partnerName |
| `legalEntity` | varchar | ✗ | legalEntity |
| `partnerType` | text | ✗ | partnerType |
| `region` | varchar | ✗ | region |
| `stage` | text | ✗ | stage |
| `requestedModules` | jsonb | ✗ | requestedModules |
| `primaryContact` | jsonb | ✗ | primaryContact |
| `operationsContact` | jsonb | ✗ | operationsContact |
| `commercial` | jsonb | ✗ | commercial |
| `compliance` | jsonb | ✗ | compliance |
| `branding` | jsonb | ✗ | branding |
| `checklist` | jsonb | ✗ | checklist |
| `blockers` | jsonb | ✗ | blockers |
| `readinessScore` | integer | ✗ | readinessScore |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |
| `submittedAt` | timestamp | ✓ | submittedAt |
| `launchedAt` | timestamp | ✓ | launchedAt |
| `lastSubmittedBy` | varchar | ✓ | lastSubmittedBy |

### `tenantFeatureFlags`

**Columns:** 12 | **Rows:** 1

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `featureKey` | varchar | ✗ | featureKey |
| `label` | varchar | ✗ | label |
| `category` | text | ✗ | category |
| `description` | text | ✗ | description |
| `enabled` | integer | ✗ | enabled |
| `rolloutStage` | text | ✗ | rolloutStage |
| `adminManaged` | integer | ✗ | adminManaged |
| `dependsOn` | jsonb | ✗ | dependsOn |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `tenants`

**Columns:** 10 | **Rows:** 1

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `onboardingStatus` | text | ✗ | onboardingStatus |
| `segment` | text | ✗ | segment |
| `region` | varchar | ✗ | region |
| `enabledModules` | jsonb | ✗ | enabledModules |
| `whiteLabel` | jsonb | ✗ | whiteLabel |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `workflowCases`

**Columns:** 12 | **Rows:** 10

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `workflowId` | varchar | ✗ | workflow ID |
| `customer` | varchar | ✗ | customer |
| `product` | varchar | ✗ | product |
| `stage` | varchar | ✗ | stage |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `channel` | varchar | ✗ | channel |
| `amount` | float8 | ✗ | amount |
| `nextAction` | text | ✗ | nextAction |
| `slaHours` | integer | ✗ | slaHours |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

---

## Audit & Security

*11 tables, 118 rows*

### `api_key_policies`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `prefix` | varchar | ✓ | prefix |
| `required_scopes` | jsonb | ✓ | required scopes |
| `ip_whitelist` | jsonb | ✓ | ip whitelist |
| `rate_limit` | integer | ✓ | rate limit |
| `rotation_warning_days` | integer | ✓ | rotation warning days |
| `active_keys` | integer | ✓ | active keys |
| `violations_24h` | integer | ✓ | violations 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `api_keys`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `api_key_id` | text | ✗ | api key id |
| `name` | text | ✗ | name |
| `key_prefix` | text | ✓ | key prefix |
| `tenant_id` | text | ✓ | Multi-tenant isolation key |
| `scopes` | text | ✓ | scopes |
| `rate_limit` | integer | ✓ | rate limit |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `ip_whitelist` | text | ✓ | ip whitelist |
| `usage_count` | bigint | ✓ | usage count |
| `last_used_at` | timestamp | ✓ | last used at |
| `expires_at` | timestamp | ✓ | expires at |
| `created_by` | text | ✓ | created by |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `auditEntries`

**Columns:** 13 | **Rows:** 14

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `auditId` | varchar | ✗ | audit ID |
| `timestampAt` | timestamp | ✗ | timestampAt |
| `actorRole` | varchar | ✗ | actorRole |
| `actorId` | varchar | ✗ | actor ID |
| `entityType` | varchar | ✗ | entityType |
| `entityId` | varchar | ✗ | entity ID |
| `action` | varchar | ✗ | action |
| `outcome` | text | ✗ | outcome |
| `severity` | text | ✗ | severity |
| `route` | varchar | ✗ | route |
| `middleware` | jsonb | ✗ | middleware |
| `detail` | text | ✗ | detail |

### `auditTrail`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `auditId` | varchar | ✗ | audit ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `entityType` | text | ✗ | entityType |
| `entityId` | varchar | ✗ | entity ID |
| `action` | text | ✗ | action |
| `actorId` | varchar | ✗ | actor ID |
| `actorRole` | varchar | ✗ | actorRole |
| `changes` | jsonb | ✓ | changes |
| `ipAddress` | varchar | ✓ | ipAddress |
| `userAgent` | text | ✓ | userAgent |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `escrow_audit_log`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `auditId` | varchar | ✗ | audit ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `action` | varchar | ✗ | action |
| `actor` | varchar | ✗ | actor |
| `details` | text | ✓ | details |
| `ipAddress` | varchar | ✓ | ipAddress |
| `kafkaTopic` | varchar | ✓ | kafkaTopic |
| `kafkaOffset` | varchar | ✓ | kafkaOffset |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `immutable_audit_blocks`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `block_number` | bigint | ✗ | block number |
| `previous_hash` | varchar | ✓ | previous hash |
| `merkle_root` | varchar | ✓ | merkle root |
| `transactions` | integer | ✓ | transactions |
| `validator` | varchar | ✓ | validator |
| `anchored_to_chain` | varchar | ✓ | anchored to chain |
| `anchor_tx_hash` | text | ✓ | anchor tx hash |
| `verified` | boolean | ✓ | verified |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `redis_sessions`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `sessionId` | varchar | ✗ | session ID |
| `userId` | varchar | ✗ | user ID |
| `deviceType` | varchar | ✗ | deviceType |
| `ipAddress` | varchar | ✗ | ipAddress |
| `expiresIn` | varchar | ✗ | expiresIn |
| `slidingTTL` | boolean | ✓ | slidingTTL |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `security_events`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `event_id` | text | ✗ | event id |
| `event_type` | text | ✗ | event type |
| `sub_type` | text | ✓ | sub type |
| `actor` | text | ✓ | actor |
| `channel` | text | ✓ | channel |
| `ip_address` | text | ✓ | ip address |
| `geo_location` | text | ✓ | geo location |
| `details` | text | ✓ | details |
| `risk_score` | real | ✓ | risk score |
| `severity` | text | ✓ | severity |
| `hash_chain` | text | ✓ | hash chain |
| `timestamp` | timestamp | ✓ | timestamp |

### `session_records`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `session_id` | text | ✗ | session id |
| `customer_id` | text | ✗ | customer id |
| `channel` | text | ✓ | channel |
| `device_fingerprint` | text | ✓ | device fingerprint |
| `ip_address` | text | ✓ | ip address |
| `geo_location` | text | ✓ | geo location |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `mfa_level` | text | ✓ | mfa level |
| `risk_score` | real | ✓ | risk score |
| `last_activity` | timestamp | ✓ | last activity |
| `expires_at` | timestamp | ✓ | expires at |
| `terminated_reason` | text | ✓ | terminated reason |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `tellerSessions`

**Columns:** 17 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `sessionId` | varchar | ✗ | session ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `tellerId` | varchar | ✗ | teller ID |
| `tellerName` | varchar | ✗ | tellerName |
| `branchCode` | varchar | ✗ | branchCode |
| `branchName` | varchar | ✗ | branchName |
| `windowNumber` | integer | ✗ | windowNumber |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `openedAt` | varchar | ✗ | openedAt |
| `closedAt` | varchar | ✓ | closedAt |
| `openingBalance` | float8 | ✗ | openingBalance |
| `currentBalance` | float8 | ✗ | currentBalance |
| `transactionCount` | integer | ✗ | transactionCount |
| `cashDrawer` | jsonb | ✗ | cashDrawer |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `token_families`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `family_id` | varchar | ✗ | family id |
| `user_id` | varchar | ✓ | user id |
| `client_id` | varchar | ✓ | client id |
| `generation` | integer | ✓ | generation |
| `max_generations` | integer | ✓ | max generations |
| `replay_detected` | boolean | ✓ | replay detected |
| `revoked_descendants` | integer | ✓ | revoked descendants |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

---

## Analytics & Reporting

*4 tables, 32 rows*

### `insurance_portfolio_analytics`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `parametric_insurance_iot`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `prometheus_dashboards`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `dashboard` | varchar | ✗ | dashboard |
| `panels` | integer | ✓ | panels |
| `refreshInterval` | varchar | ✗ | refreshInterval |
| `alertRules` | integer | ✓ | alertRules |
| `dataSourceRetention` | varchar | ✗ | dataSourceRetention |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `voice_call_analytics`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

---

## Infrastructure & Operations

*134 tables, 2112 rows*

### `acgsf_guarantee`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `aggregation_center`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `animal_id_traceability`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `anomaly_models`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `model_type` | varchar | ✓ | model type |
| `features` | jsonb | ✓ | features |
| `accuracy` | real | ✓ | accuracy |
| `precision` | real | ✓ | precision |
| `recall` | real | ✓ | recall |
| `f1_score` | real | ✓ | f1 score |
| `training_size` | bigint | ✓ | training size |
| `anomalies_24h` | integer | ✓ | anomalies 24h |
| `true_positives` | integer | ✓ | true positives |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `apisix_plugin_chains`

**Columns:** 6 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `route` | varchar | ✗ | route |
| `avgLatencyMs` | real | ✓ | avgLatencyMs |
| `latencySaving` | varchar | ✗ | latencySaving |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `area_yield_index_insurance`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `avro_schemas`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `subject` | varchar | ✗ | subject |
| `version` | integer | ✓ | version |
| `compatibilityMode` | varchar | ✗ | compatibilityMode |
| `serializedSizeBytes` | integer | ✓ | serializedSizeBytes |
| `compressionRatio` | varchar | ✗ | compressionRatio |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `bankGuarantees`

**Columns:** 18 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `guaranteeId` | varchar | ✗ | guarantee ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `guaranteeType` | varchar | ✗ | guaranteeType |
| `applicantId` | varchar | ✗ | applicant ID |
| `applicantName` | varchar | ✗ | applicantName |
| `beneficiaryName` | varchar | ✗ | beneficiaryName |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `purpose` | text | ✗ | purpose |
| `effectiveDate` | varchar | ✗ | effectiveDate |
| `expiryDate` | varchar | ✗ | expiryDate |
| `claimDeadline` | varchar | ✓ | claimDeadline |
| `commissionRate` | float8 | ✗ | commissionRate |
| `commissionAmount` | float8 | ✗ | commissionAmount |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `batch_aggregator_configs`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `endpoint` | varchar | ✗ | endpoint |
| `maxRequests` | integer | ✓ | maxRequests |
| `timeoutMs` | integer | ✓ | timeoutMs |
| `avgBatchSize` | real | ✓ | avgBatchSize |
| `requestsSaved24h` | bigint | ✓ | requestsSaved24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `beneficial_owners`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `entityId` | varchar | ✗ | entity ID |
| `entityName` | varchar | ✗ | entityName |
| `entityType` | varchar | ✗ | entityType |
| `rcNumber` | varchar | ✗ | rcNumber |
| `totalLayers` | integer | ✓ | totalLayers |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `bloom_filters`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `capacity` | bigint | ✓ | capacity |
| `falsePositiveRate` | varchar | ✗ | falsePositiveRate |
| `hashFunctions` | integer | ✓ | hashFunctions |
| `memoryMB` | real | ✓ | memoryMB |
| `lookups24h` | bigint | ✓ | lookups24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `body_limit_rules`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `path` | text | ✗ | path |
| `method` | varchar | ✓ | method |
| `max_body_bytes` | bigint | ✓ | max body bytes |
| `content_types` | jsonb | ✓ | content types |
| `enforced` | boolean | ✓ | enforced |
| `violations_24h` | integer | ✓ | violations 24h |
| `blocked_24h` | integer | ✓ | blocked 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `bundle_split_configs`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `chunk` | varchar | ✗ | chunk |
| `routes` | integer | ✓ | routes |
| `sizeKB` | integer | ✓ | sizeKB |
| `loadTimeMs` | integer | ✓ | loadTimeMs |
| `preloadHint` | varchar | ✗ | preloadHint |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `bureau_checks`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customer_id` | varchar | ✗ | customer id |
| `bureau` | varchar | ✗ | bureau |
| `credit_score` | integer | ✓ | credit score |
| `risk_grade` | varchar | ✓ | risk grade |
| `active_loans` | integer | ✗ | active loans |
| `default_history` | integer | ✗ | default history |
| `checked_at` | timestamp | ✓ | checked at |

### `cache_invalidations`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `channel` | varchar | ✗ | channel |
| `subscribers` | integer | ✓ | subscribers |
| `invalidations24h` | integer | ✓ | invalidations24h |
| `avgPropagationMs` | real | ✓ | avgPropagationMs |
| `pattern` | varchar | ✗ | pattern |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `card_batches`

**Columns:** 12 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `batch_id` | text | ✗ | batch id |
| `batch_size` | integer | ✗ | batch size |
| `card_type` | text | ✗ | card type |
| `generated_by` | text | ✓ | generated by |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `cards_issued` | integer | ✓ | cards issued |
| `cards_used` | integer | ✓ | cards used |
| `cards_revoked` | integer | ✓ | cards revoked |
| `branch_code` | text | ✓ | branch code |
| `expires_at` | timestamp | ✓ | expires at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `cdn_edge_configs`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `provider` | varchar | ✗ | provider |
| `origin` | varchar | ✗ | origin |
| `ttlStatic` | integer | ✓ | ttlStatic |
| `ttlApi` | integer | ✓ | ttlApi |
| `brotliEnabled` | boolean | ✓ | brotliEnabled |
| `bandwidthSaved24h` | varchar | ✗ | bandwidthSaved24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `certificates`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `cert_id` | text | ✗ | cert id |
| `common_name` | text | ✗ | common name |
| `cert_type` | text | ✗ | cert type |
| `algorithm` | text | ✓ | algorithm |
| `issuer` | text | ✓ | issuer |
| `serial_number` | text | ✓ | serial number |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `valid_from` | timestamp | ✓ | valid from |
| `valid_to` | timestamp | ✓ | valid to |
| `renewal_days` | integer | ✓ | renewal days |
| `last_renewed` | timestamp | ✓ | last renewed |
| `revoked_at` | timestamp | ✓ | revoked at |
| `revocation_reason` | text | ✓ | revocation reason |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `coalescing_rules`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `route` | varchar | ✗ | route |
| `windowMs` | integer | ✓ | windowMs |
| `coalescedRequests24h` | bigint | ✓ | coalescedRequests24h |
| `uniqueRequests24h` | bigint | ✓ | uniqueRequests24h |
| `savingsRatio` | varchar | ✗ | savingsRatio |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `commodity_exchange`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `commodity_price_intelligence`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `compression_configs`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `algorithm` | varchar | ✗ | algorithm |
| `level` | integer | ✓ | level |
| `minBytes` | integer | ✓ | minBytes |
| `compressionRatio` | varchar | ✗ | compressionRatio |
| `bandwidthSaved24h` | varchar | ✗ | bandwidthSaved24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `corporate_monitoring_events`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `company_id` | varchar | ✗ | company id |
| `event_type` | varchar | ✗ | event type |
| `description` | text | ✓ | description |
| `risk_impact` | varchar | ✗ | risk impact |
| `source_system` | varchar | ✓ | source system |
| `detected_at` | timestamp | ✓ | detected at |
| `acknowledged_at` | timestamp | ✓ | acknowledged at |

### `correlation_rules`

**Columns:** 11 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `mitre_ids` | jsonb | ✓ | mitre ids |
| `kill_chain_phase` | varchar | ✓ | kill chain phase |
| `trigger_events` | jsonb | ✓ | trigger events |
| `correlation_window` | varchar | ✓ | correlation window |
| `triggered_24h` | integer | ✓ | triggered 24h |
| `true_positives` | integer | ✓ | true positives |
| `false_positives` | integer | ✓ | false positives |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `crypto_keys`

**Columns:** 17 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `key_id` | text | ✗ | key id |
| `name` | text | ✗ | name |
| `key_type` | text | ✗ | key type |
| `algorithm` | text | ✗ | algorithm |
| `purpose` | text | ✗ | purpose |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `key_size_bits` | integer | ✓ | key size bits |
| `rotation_period_days` | integer | ✓ | rotation period days |
| `hsm_slot` | text | ✓ | hsm slot |
| `custodian_1` | text | ✓ | custodian 1 |
| `custodian_2` | text | ✓ | custodian 2 |
| `usage_count` | bigint | ✓ | usage count |
| `last_used_at` | timestamp | ✓ | last used at |
| `expires_at` | timestamp | ✓ | expires at |
| `rotated_at` | timestamp | ✓ | rotated at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `csp_policies`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `domain` | varchar | ✗ | domain |
| `directives` | jsonb | ✓ | directives |
| `report_uri` | text | ✓ | report uri |
| `violations_24h` | integer | ✓ | violations 24h |
| `unique_sources` | integer | ✓ | unique sources |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `customerApprovals`

**Columns:** 15 | **Rows:** 2

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `approvalId` | varchar | ✗ | approval ID |
| `customerId` | varchar | ✗ | customer ID |
| `entityType` | text | ✗ | entityType |
| `entityId` | varchar | ✗ | entity ID |
| `title` | varchar | ✗ | title |
| `detail` | text | ✗ | detail |
| `route` | varchar | ✗ | route |
| `state` | text | ✗ | state |
| `requestedAt` | timestamp | ✗ | requestedAt |
| `requestedByRole` | varchar | ✗ | requestedByRole |
| `requestedById` | varchar | ✗ | requestedBy ID |
| `approvalRole` | varchar | ✗ | approvalRole |
| `resolvedAt` | timestamp | ✓ | resolvedAt |
| `resolutionNote` | text | ✓ | resolutionNote |

### `customerBillPayments`

**Columns:** 16 | **Rows:** 3

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `paymentId` | varchar | ✗ | payment ID |
| `customerId` | varchar | ✗ | customer ID |
| `category` | text | ✗ | category |
| `provider` | varchar | ✗ | provider |
| `amount` | float8 | ✗ | amount |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `paidAt` | timestamp | ✗ | paidAt |
| `reference` | varchar | ✗ | reference |
| `billerId` | varchar | ✓ | biller ID |
| `customerReference` | varchar | ✓ | customerReference |
| `customerName` | varchar | ✓ | customerName |
| `scheduledFor` | timestamp | ✓ | scheduledFor |
| `evidenceStatus` | text | ✓ | evidenceStatus |
| `channel` | text | ✓ | channel |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerCardEvents`

**Columns:** 8 | **Rows:** 11

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `eventId` | varchar | ✗ | event ID |
| `cardId` | varchar | ✗ | card ID |
| `customerId` | varchar | ✗ | customer ID |
| `title` | varchar | ✗ | title |
| `detail` | text | ✗ | detail |
| `severity` | text | ✗ | severity |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `customerNotifications`

**Columns:** 9 | **Rows:** 0

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `notificationId` | varchar | ✗ | notification ID |
| `customerId` | varchar | ✗ | customer ID |
| `title` | varchar | ✗ | title |
| `message` | text | ✗ | message |
| `notificationType` | text | ✗ | notificationType |
| `isRead` | integer | ✗ | isRead |
| `actionUrl` | varchar | ✓ | actionUrl |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `ddos_rules`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `layer` | varchar | ✓ | layer |
| `threshold` | varchar | ✓ | threshold |
| `action` | varchar | ✓ | action |
| `mitigated_24h` | integer | ✓ | mitigated 24h |
| `false_positives` | integer | ✓ | false positives |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `device_profiles`

**Columns:** 12 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `fingerprint_hash` | varchar | ✓ | fingerprint hash |
| `user_id` | varchar | ✓ | user id |
| `device_type` | varchar | ✓ | device type |
| `browser` | varchar | ✓ | browser |
| `os` | varchar | ✓ | os |
| `screen_res` | varchar | ✓ | screen res |
| `timezone` | varchar | ✓ | timezone |
| `trust_score` | integer | ✓ | trust score |
| `sessions_count` | integer | ✓ | sessions count |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `disputeCases`

**Columns:** 19 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `disputeId` | varchar | ✗ | dispute ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `customerId` | varchar | ✓ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `category` | varchar | ✗ | category |
| `description` | text | ✓ | description |
| `transactionId` | varchar | ✓ | transaction ID |
| `transactionAmount` | float8 | ✓ | transactionAmount |
| `disputedAmount` | float8 | ✓ | disputedAmount |
| `channel` | varchar | ✓ | channel |
| `priority` | varchar | ✓ | priority |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `slaDeadline` | timestamp | ✓ | slaDeadline |
| `assignedTo` | varchar | ✓ | assignedTo |
| `resolution` | varchar | ✓ | resolution |
| `resolutionAmount` | float8 | ✓ | resolutionAmount |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `distroless_images`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `service` | varchar | ✗ | service |
| `baseImage` | varchar | ✗ | baseImage |
| `imageSizeMB` | real | ✓ | imageSizeMB |
| `previousSizeMB` | real | ✓ | previousSizeMB |
| `reductionPct` | varchar | ✗ | reductionPct |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `docker_hardening_checks`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `check_name` | varchar | ✗ | check name |
| `category` | varchar | ✓ | category |
| `cis_benchmark` | varchar | ✓ | cis benchmark |
| `passing_containers` | integer | ✓ | passing containers |
| `failing_containers` | integer | ✓ | failing containers |
| `total_containers` | integer | ✓ | total containers |
| `severity` | varchar | ✓ | severity |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `efass_returns`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `period` | varchar | ✗ | period |
| `type` | varchar | ✗ | type |
| `tier1_count` | integer | ✗ | tier1 count |
| `tier2_count` | integer | ✗ | tier2 count |
| `tier3_count` | integer | ✗ | tier3 count |
| `total_customers` | integer | ✗ | total customers |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `submitted_at` | timestamp | ✓ | submitted at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `egress_policies`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `domains` | jsonb | ✓ | domains |
| `ports` | jsonb | ✓ | ports |
| `protocol` | varchar | ✓ | protocol |
| `allowed` | boolean | ✓ | allowed |
| `requests_24h` | bigint | ✓ | requests 24h |
| `blocked_24h` | integer | ✓ | blocked 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `equipment_leasing`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `erpnextSyncJobs`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `jobId` | varchar | ✗ | job ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `syncType` | varchar | ✗ | syncType |
| `direction` | varchar | ✗ | direction |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `recordsProcessed` | integer | ✓ | recordsProcessed |
| `recordsFailed` | integer | ✓ | recordsFailed |
| `recordsSkipped` | integer | ✓ | recordsSkipped |
| `retryCount` | integer | ✓ | retryCount |
| `startedAt` | timestamp | ✓ | startedAt |
| `completedAt` | timestamp | ✓ | completedAt |
| `errorMessage` | text | ✓ | errorMessage |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `escrow_disputes`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `disputeId` | varchar | ✗ | dispute ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `raisedBy` | varchar | ✗ | raisedBy |
| `raisedByPartyId` | integer | ✓ | raisedByParty ID |
| `reason` | text | ✗ | reason |
| `category` | varchar | ✓ | category |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `resolution` | text | ✓ | resolution |
| `arbitratorName` | varchar | ✓ | arbitratorName |
| `arbitratorDecision` | text | ✓ | arbitratorDecision |
| `resolvedAt` | timestamp | ✓ | resolvedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `escrow_documents`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `documentId` | varchar | ✗ | document ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `documentType` | varchar | ✗ | documentType |
| `fileName` | varchar | ✗ | fileName |
| `fileSize` | integer | ✓ | fileSize |
| `mimeType` | varchar | ✓ | mimeType |
| `storageUrl` | text | ✓ | storageUrl |
| `uploadedBy` | varchar | ✓ | uploadedBy |
| `verifiedBy` | varchar | ✓ | verifiedBy |
| `verifiedAt` | timestamp | ✓ | verifiedAt |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `escrow_fees`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `feeId` | varchar | ✗ | fee ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `feeType` | varchar | ✗ | feeType |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `chargedAt` | timestamp | ✗ | chargedAt |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `ledgerRef` | varchar | ✓ | ledgerRef |
| `narration` | text | ✓ | narration |

### `escrow_interest_accruals`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `accrualId` | varchar | ✗ | accrual ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `principalAmount` | float8 | ✗ | principalAmount |
| `rate` | float8 | ✗ | rate |
| `accrualPeriodStart` | timestamp | ✗ | accrualPeriodStart |
| `accrualPeriodEnd` | timestamp | ✗ | accrualPeriodEnd |
| `daysInPeriod` | integer | ✗ | daysInPeriod |
| `interestAmount` | float8 | ✗ | interestAmount |
| `cumulativeInterest` | float8 | ✗ | cumulativeInterest |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `ledgerRef` | varchar | ✓ | ledgerRef |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `escrow_milestones`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `milestoneId` | varchar | ✗ | milestone ID |
| `escrowId` | varchar | ✗ | escrow ID |
| `description` | text | ✗ | description |
| `releaseAmount` | float8 | ✓ | releaseAmount |
| `releasePercent` | float8 | ✓ | releasePercent |
| `dueDate` | timestamp | ✓ | dueDate |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `verifiedBy` | varchar | ✓ | verifiedBy |
| `verifiedAt` | timestamp | ✓ | verifiedAt |
| `evidenceDocId` | varchar | ✓ | evidenceDoc ID |
| `sequenceOrder` | integer | ✓ | sequenceOrder |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `escrow_parties`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `escrowId` | varchar | ✗ | escrow ID |
| `role` | varchar | ✗ | role |
| `name` | varchar | ✗ | name |
| `accountId` | varchar | ✓ | account ID |
| `email` | varchar | ✓ | email |
| `phone` | varchar | ✓ | phone |
| `kycStatus` | varchar | ✓ | kycStatus |
| `kybStatus` | varchar | ✓ | kybStatus |
| `sharePercent` | float8 | ✓ | sharePercent |
| `signedAt` | timestamp | ✓ | signedAt |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `esusuGroups`

**Columns:** 16 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `groupId` | varchar | ✗ | group ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `name` | varchar | ✗ | name |
| `organiserId` | varchar | ✗ | organiser ID |
| `organiserName` | varchar | ✗ | organiserName |
| `contributionAmount` | float8 | ✗ | contributionAmount |
| `currency` | varchar | ✗ | currency |
| `frequency` | varchar | ✗ | frequency |
| `maxMembers` | integer | ✗ | maxMembers |
| `currentCycle` | integer | ✓ | currentCycle |
| `totalCycles` | integer | ✓ | totalCycles |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `startDate` | timestamp | ✓ | startDate |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `event_dedup_configs`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `topic` | varchar | ✗ | topic |
| `windowMs` | integer | ✓ | windowMs |
| `strategy` | varchar | ✗ | strategy |
| `duplicatesBlocked24h` | bigint | ✓ | duplicatesBlocked24h |
| `totalEvents24h` | bigint | ✓ | totalEvents24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `farm_boundary_mapping`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `fast_json_schemas`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `schemaName` | varchar | ✗ | schemaName |
| `compiledSizeBytes` | integer | ✓ | compiledSizeBytes |
| `serializationsPerSec` | integer | ✓ | serializationsPerSec |
| `avgSerializeNs` | integer | ✓ | avgSerializeNs |
| `speedup` | varchar | ✗ | speedup |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `fisheries_aquaculture`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `fluvio_smart_modules`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `moduleType` | varchar | ✗ | moduleType |
| `wasmSizeKB` | integer | ✓ | wasmSizeKB |
| `avgLatencyUs` | integer | ✓ | avgLatencyUs |
| `throughputEps` | integer | ✓ | throughputEps |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `frame_policies`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `domain` | varchar | ✗ | domain |
| `frame_ancestors` | varchar | ✓ | frame ancestors |
| `x_frame_options` | varchar | ✓ | x frame options |
| `frame_detection` | varchar | ✓ | frame detection |
| `violations_24h` | integer | ✓ | violations 24h |
| `unique_framers` | integer | ✓ | unique framers |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `grpc_services`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `service` | varchar | ✗ | service |
| `proto` | varchar | ✗ | proto |
| `avgLatencyMs` | real | ✓ | avgLatencyMs |
| `throughputRps` | integer | ✓ | throughputRps |
| `compressionRatio` | varchar | ✗ | compressionRatio |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `hot_data_caches`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `service` | varchar | ✗ | service |
| `cacheType` | varchar | ✗ | cacheType |
| `maxEntries` | integer | ✓ | maxEntries |
| `currentEntries` | integer | ✓ | currentEntries |
| `hitRate` | varchar | ✗ | hitRate |
| `memoryMB` | real | ✓ | memoryMB |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `hpa_configs`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `deployment` | varchar | ✗ | deployment |
| `minReplicas` | integer | ✓ | minReplicas |
| `maxReplicas` | integer | ✓ | maxReplicas |
| `currentReplicas` | integer | ✓ | currentReplicas |
| `cpuTargetPct` | integer | ✓ | cpuTargetPct |
| `customMetric` | varchar | ✗ | customMetric |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `http2_connections`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `clientIp` | varchar | ✗ | clientIp |
| `streams` | integer | ✓ | streams |
| `maxConcurrentStreams` | integer | ✓ | maxConcurrentStreams |
| `windowSize` | varchar | ✗ | windowSize |
| `serverPushEnabled` | boolean | ✓ | serverPushEnabled |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `identityProfiles`

**Columns:** 17 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `profileId` | varchar | ✗ | profile ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✓ | customerName |
| `email` | varchar | ✓ | email |
| `phoneNumber` | varchar | ✗ | phoneNumber |
| `bvn` | varchar | ✓ | bvn |
| `nin` | varchar | ✓ | nin |
| `mfaEnabled` | integer | ✓ | mfaEnabled |
| `mfaMethods` | jsonb | ✓ | mfaMethods |
| `activeChannels` | jsonb | ✓ | activeChannels |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `lastLoginAt` | timestamp | ✓ | lastLoginAt |
| `failedAttempts` | integer | ✓ | failedAttempts |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `image_scans`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `image_name` | text | ✗ | image name |
| `registry` | varchar | ✓ | registry |
| `base_image` | varchar | ✓ | base image |
| `total_vulns` | integer | ✓ | total vulns |
| `critical` | integer | ✓ | critical |
| `high` | integer | ✓ | high |
| `medium` | integer | ✓ | medium |
| `low` | integer | ✓ | low |
| `sbom_artifacts` | integer | ✓ | sbom artifacts |
| `last_scanned` | timestamp | ✓ | last scanned |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `incidents`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `title` | text | ✗ | title |
| `severity` | varchar | ✓ | severity |
| `category` | varchar | ✓ | category |
| `affected_systems` | jsonb | ✓ | affected systems |
| `containment_actions` | jsonb | ✓ | containment actions |
| `escalation_level` | integer | ✓ | escalation level |
| `assignee` | varchar | ✓ | assignee |
| `detected_at` | timestamp | ✓ | detected at |
| `contained_at` | timestamp | ✓ | contained at |
| `ttd_minutes` | integer | ✓ | ttd minutes |
| `ttc_minutes` | integer | ✓ | ttc minutes |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `ip_rules`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `cidr` | varchar | ✓ | cidr |
| `rule_type` | varchar | ✓ | rule type |
| `applies_to` | varchar | ✓ | applies to |
| `hits_24h` | integer | ✓ | hits 24h |
| `blocked_24h` | integer | ✓ | blocked 24h |
| `geo_country` | varchar | ✓ | geo country |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `journalEntries`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `entryId` | varchar | ✗ | entry ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `accountId` | varchar | ✗ | account ID |
| `glAccountCode` | varchar | ✗ | glAccountCode |
| `type` | text | ✗ | type |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `narration` | text | ✗ | narration |
| `transactionRef` | varchar | ✗ | transactionRef |
| `batchId` | varchar | ✓ | batch ID |
| `reversalOf` | varchar | ✓ | reversalOf |
| `postingDate` | timestamp | ✗ | postingDate |
| `valueDate` | timestamp | ✗ | valueDate |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `jwt_validations`

**Columns:** 11 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `token_type` | varchar | ✗ | token type |
| `issuer` | text | ✗ | issuer |
| `audience` | varchar | ✓ | audience |
| `algorithm` | varchar | ✓ | algorithm |
| `validations_24h` | bigint | ✓ | validations 24h |
| `rejections_24h` | integer | ✓ | rejections 24h |
| `avg_latency_ms` | real | ✓ | avg latency ms |
| `cache_hit_rate` | real | ✓ | cache hit rate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `kafka_batch_producers`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `topic` | varchar | ✗ | topic |
| `lingerMs` | integer | ✓ | lingerMs |
| `batchSizeKB` | integer | ✓ | batchSizeKB |
| `compressionType` | varchar | ✗ | compressionType |
| `throughputMps` | integer | ✓ | throughputMps |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `kafka_consumer_groups`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `groupId` | varchar | ✗ | group ID |
| `topic` | varchar | ✗ | topic |
| `partitions` | integer | ✓ | partitions |
| `consumers` | integer | ✓ | consumers |
| `lag` | bigint | ✓ | lag |
| `throughputMps` | integer | ✓ | throughputMps |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `keda_scale_triggers`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `scaleObject` | varchar | ✗ | scaleObject |
| `trigger` | varchar | ✗ | trigger |
| `metric` | varchar | ✗ | metric |
| `threshold` | integer | ✓ | threshold |
| `currentReplicas` | integer | ✓ | currentReplicas |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `keepalive_configs`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `service` | varchar | ✗ | service |
| `keepAliveTimeout` | integer | ✓ | keepAliveTimeout |
| `maxIdlePerHost` | integer | ✓ | max IDlePerHost |
| `activeConnections` | integer | ✓ | activeConnections |
| `reuseRate` | varchar | ✗ | reuseRate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `key_rotation_schedules`

**Columns:** 12 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `key_id` | varchar | ✗ | key id |
| `algorithm` | varchar | ✓ | algorithm |
| `rotation_interval` | varchar | ✓ | rotation interval |
| `grace_period` | varchar | ✓ | grace period |
| `active_version` | integer | ✓ | active version |
| `previous_version` | integer | ✓ | previous version |
| `next_rotation` | timestamp | ✓ | next rotation |
| `rotations_completed` | integer | ✓ | rotations completed |
| `failed_rotations` | integer | ✓ | failed rotations |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `kms_keys`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `provider` | varchar | ✗ | provider |
| `key_id` | text | ✗ | key id |
| `algorithm` | varchar | ✓ | algorithm |
| `usage` | varchar | ✓ | usage |
| `state` | varchar | ✓ | state |
| `rotation_enabled` | boolean | ✓ | rotation enabled |
| `encryption_ops_24h` | bigint | ✓ | encryption ops 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `loanRepayments`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `repaymentId` | varchar | ✗ | repayment ID |
| `loanId` | varchar | ✗ | loan ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `principalPortion` | float8 | ✗ | principalPortion |
| `interestPortion` | float8 | ✗ | interestPortion |
| `penaltyPortion` | float8 | ✗ | penaltyPortion |
| `totalAmount` | float8 | ✗ | totalAmount |
| `dueDate` | timestamp | ✗ | dueDate |
| `paidDate` | timestamp | ✓ | paidDate |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `transactionRef` | varchar | ✓ | transactionRef |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `materialized_views_perf`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `viewName` | varchar | ✗ | viewName |
| `refreshIntervalSec` | integer | ✓ | refreshIntervalSec |
| `lastRefreshMs` | integer | ✓ | lastRefreshMs |
| `rowCount` | integer | ✓ | rowCount |
| `autoRefresh` | boolean | ✓ | autoRefresh |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `memoization_targets`

**Columns:** 7 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `component` | varchar | ✗ | component |
| `rerendersPer60s` | integer | ✓ | rerendersPer60s |
| `estimatedSavingPct` | varchar | ✗ | estimatedSavingPct |
| `recommendation` | varchar | ✗ | recommendation |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `mfa_enrollments`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `enrollment_id` | text | ✗ | enrollment id |
| `customer_id` | text | ✗ | customer id |
| `methods` | text | ✗ | methods |
| `primary_method` | text | ✓ | primary method |
| `backup_method` | text | ✓ | backup method |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `risk_level` | text | ✓ | risk level |
| `channel` | text | ✓ | channel |
| `enrolled_at` | timestamp | ✓ | enrolled at |
| `last_verified` | timestamp | ✓ | last verified |

### `mfa_policies`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `policy_id` | text | ✗ | policy id |
| `name` | text | ✗ | name |
| `transaction_type` | text | ✓ | transaction type |
| `amount_threshold_ngn` | real | ✓ | amount threshold ngn |
| `required_factors` | integer | ✓ | required factors |
| `allowed_methods` | text | ✓ | allowed methods |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `mortgageApplications`

**Columns:** 21 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `mortgageId` | varchar | ✗ | mortgage ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `applicantId` | varchar | ✗ | applicant ID |
| `applicantName` | varchar | ✗ | applicantName |
| `propertyValue` | float8 | ✗ | propertyValue |
| `loanAmount` | float8 | ✗ | loanAmount |
| `downPayment` | float8 | ✗ | downPayment |
| `interestRatePct` | float8 | ✗ | interestRatePct |
| `tenorMonths` | integer | ✗ | tenorMonths |
| `mortgageType` | varchar | ✗ | mortgageType |
| `emi` | float8 | ✗ | emi |
| `ltvPct` | float8 | ✗ | ltvPct |
| `ltvGrade` | varchar | ✗ | ltvGrade |
| `dtiRatio` | float8 | ✗ | dtiRatio |
| `propertyAddress` | text | ✓ | propertyAddress |
| `propertyType` | varchar | ✓ | propertyType |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `disbursedAt` | timestamp | ✓ | disbursedAt |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `mtls_nodes`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `service_name` | varchar | ✗ | service name |
| `spiffe_id` | text | ✓ | spiffe id |
| `cert_serial` | varchar | ✓ | cert serial |
| `cert_expiry` | timestamp | ✓ | cert expiry |
| `issuer` | varchar | ✓ | issuer |
| `peer_connections` | integer | ✓ | peer connections |
| `handshakes_24h` | bigint | ✓ | handshakes 24h |
| `failed_handshakes` | integer | ✓ | failed handshakes |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `ndpr_records`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `record_type` | varchar | ✗ | record type |
| `subject` | varchar | ✓ | subject |
| `request_type` | varchar | ✓ | request type |
| `response_time_days` | integer | ✓ | response time days |
| `sla_deadline_days` | integer | ✓ | sla deadline days |
| `data_categories` | jsonb | ✓ | data categories |
| `dpo` | varchar | ✓ | dpo |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `network_policies`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `namespace` | varchar | ✓ | namespace |
| `pod_selector` | text | ✓ | pod selector |
| `ingress_rules` | jsonb | ✓ | ingress rules |
| `egress_rules` | jsonb | ✓ | egress rules |
| `applied_pods` | integer | ✓ | applied pods |
| `denied_connections_24h` | integer | ✓ | denied connections 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `nfiu_filings`

**Columns:** 11 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `report_type` | varchar | ✗ | report type |
| `customer_id` | varchar | ✗ | customer id |
| `customer_name` | text | ✓ | customer name |
| `amount_ngn` | float8 | ✗ | amount ngn |
| `transaction_type` | varchar | ✓ | transaction type |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `cbn_reference` | varchar | ✓ | cbn reference |
| `sla_deadline` | timestamp | ✓ | sla deadline |
| `filed_at` | timestamp | ✓ | filed at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `nirsal_agro_geocoop`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `opensearch_index_configs`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `indexName` | varchar | ✗ | indexName |
| `shards` | integer | ✓ | shards |
| `replicas` | integer | ✓ | replicas |
| `avgQueryMs` | real | ✓ | avgQueryMs |
| `resultCacheEnabled` | boolean | ✓ | resultCacheEnabled |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `optimistic_ui_configs`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `action` | varchar | ✗ | action |
| `endpoint` | varchar | ✗ | endpoint |
| `rollbackOnError` | boolean | ✓ | rollbackOnError |
| `successRate` | varchar | ✗ | successRate |
| `perceivedLatencyMs` | integer | ✓ | perceivedLatencyMs |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `otp_records`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `otp_id` | text | ✗ | otp id |
| `policy_id` | text | ✓ | policy id |
| `customer_id` | text | ✗ | customer id |
| `channel` | text | ✓ | channel |
| `purpose` | text | ✓ | purpose |
| `otp_hash` | text | ✓ | otp hash |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `attempts` | integer | ✓ | attempts |
| `delivered_via` | text | ✓ | delivered via |
| `expires_at` | timestamp | ✓ | expires at |
| `verified_at` | timestamp | ✓ | verified at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `output_encoding_rules`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `context` | varchar | ✗ | context |
| `encoder` | varchar | ✓ | encoder |
| `chars_encoded` | jsonb | ✓ | chars encoded |
| `applied_24h` | bigint | ✓ | applied 24h |
| `xss_blocked` | integer | ✓ | xss blocked |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `path_validation_rules`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `pattern` | varchar | ✗ | pattern |
| `regex` | text | ✓ | regex |
| `blocked_24h` | integer | ✓ | blocked 24h |
| `passed_24h` | bigint | ✓ | passed 24h |
| `common_violations` | jsonb | ✓ | common violations |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `pci_scans`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `requirement` | text | ✗ | requirement |
| `total_controls` | integer | ✓ | total controls |
| `passing` | integer | ✓ | passing |
| `failing` | integer | ✓ | failing |
| `findings` | jsonb | ✓ | findings |
| `last_scan` | timestamp | ✓ | last scan |
| `scan_duration` | varchar | ✓ | scan duration |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `pentest_scans`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `scope` | varchar | ✓ | scope |
| `scan_type` | varchar | ✓ | scan type |
| `target` | text | ✓ | target |
| `total_findings` | integer | ✓ | total findings |
| `critical` | integer | ✓ | critical |
| `high` | integer | ✓ | high |
| `medium` | integer | ✓ | medium |
| `low` | integer | ✓ | low |
| `remediated` | integer | ✓ | remediated |
| `vendor` | varchar | ✓ | vendor |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `pgbouncer_pools`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `database` | varchar | ✗ | database |
| `poolMode` | varchar | ✗ | poolMode |
| `activeConnections` | integer | ✓ | activeConnections |
| `idleConnections` | integer | ✓ | idleConnections |
| `maxClientConn` | integer | ✓ | maxClientConn |
| `avgQueryMs` | real | ✓ | avgQueryMs |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `pin_hashes`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `algorithm` | varchar | ✗ | algorithm |
| `memory_cost` | integer | ✓ | memory cost |
| `time_cost` | integer | ✓ | time cost |
| `parallelism` | integer | ✓ | parallelism |
| `salt_length` | integer | ✓ | salt length |
| `hash_length` | integer | ✓ | hash length |
| `active_hashes` | bigint | ✓ | active hashes |
| `migrated_from_bcrypt` | integer | ✓ | migrated from bcrypt |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `pkce_flows`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `client_id` | varchar | ✗ | client id |
| `grant_type` | varchar | ✓ | grant type |
| `code_challenge_method` | varchar | ✓ | code challenge method |
| `redirect_uri` | text | ✓ | redirect uri |
| `scopes` | jsonb | ✓ | scopes |
| `token_lifetime` | integer | ✓ | token lifetime |
| `refresh_lifetime` | integer | ✓ | refresh lifetime |
| `active_flows` | bigint | ✓ | active flows |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `post_harvest_loss_tracker`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `prepared_statements`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `queryPattern` | text | ✗ | queryPattern |
| `executions24h` | bigint | ✓ | executions24h |
| `avgExecMs` | real | ✓ | avgExecMs |
| `planCacheHits` | varchar | ✗ | planCacheHits |
| `paramTypes` | varchar | ✗ | paramTypes |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `quality_certification`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `query_cache_entries`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `queryHash` | varchar | ✗ | queryHash |
| `tableName` | varchar | ✗ | tableName |
| `resultCount` | integer | ✓ | resultCount |
| `ttlSeconds` | integer | ✓ | ttlSeconds |
| `hitCount` | bigint | ✓ | hitCount |
| `hitRate` | varchar | ✗ | hitRate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `read_replica_configs`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `replicaHost` | varchar | ✗ | replicaHost |
| `lagMs` | integer | ✓ | lagMs |
| `queriesRouted24h` | bigint | ✓ | queriesRouted24h |
| `loadPct` | integer | ✓ | loadPct |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `reconciliationRuns`

**Columns:** 15 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `runId` | varchar | ✗ | run ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `runType` | varchar | ✗ | runType |
| `scope` | varchar | ✗ | scope |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `totalEntriesChecked` | integer | ✓ | totalEntriesChecked |
| `matches` | integer | ✓ | matches |
| `discrepancies` | integer | ✓ | discrepancies |
| `autoRepaired` | integer | ✓ | autoRepaired |
| `manualTriage` | integer | ✓ | manualTriage |
| `durationMs` | integer | ✓ | durationMs |
| `startTime` | timestamp | ✓ | startTime |
| `endTime` | timestamp | ✓ | endTime |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `redis_cache_entries`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `route` | varchar | ✗ | route |
| `ttlSeconds` | integer | ✓ | ttlSeconds |
| `hitCount` | bigint | ✓ | hitCount |
| `missCount` | integer | ✓ | missCount |
| `hitRate` | varchar | ✗ | hitRate |
| `avgLatencyMs` | real | ✓ | avgLatencyMs |
| `memoryMB` | real | ✓ | memoryMB |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `risk_scores`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customer_id` | varchar | ✗ | customer id |
| `static_score` | float8 | ✗ | static score |
| `dynamic_score` | float8 | ✗ | dynamic score |
| `total_score` | float8 | ✗ | total score |
| `risk_tier` | varchar | ✗ | risk tier |
| `factors` | jsonb | ✓ | factors |
| `last_calculated_at` | timestamp | ✓ | last calculated at |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `route_schemas`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `path` | text | ✗ | path |
| `method` | varchar | ✗ | method |
| `schema_name` | varchar | ✓ | schema name |
| `validation_count` | integer | ✓ | validation count |
| `pass_rate` | real | ✓ | pass rate |
| `failed_requests` | integer | ✓ | failed requests |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `route_trie_stats`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `routePrefix` | varchar | ✗ | routePrefix |
| `totalRoutes` | integer | ✓ | totalRoutes |
| `trieDepth` | integer | ✓ | trieDepth |
| `avgLookupNs` | integer | ✓ | avgLookupNs |
| `cacheHitRate` | varchar | ✗ | cacheHitRate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `siem_pipelines`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `format` | varchar | ✓ | format |
| `destination` | text | ✓ | destination |
| `events_exported_24h` | bigint | ✓ | events exported 24h |
| `avg_latency_ms` | real | ✓ | avg latency ms |
| `error_rate` | real | ✓ | error rate |
| `batch_size` | integer | ✓ | batch size |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `soc2_evidence`

**Columns:** 11 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `control_id` | varchar | ✗ | control id |
| `category` | varchar | ✓ | category |
| `title` | text | ✓ | title |
| `evidence_type` | varchar | ✓ | evidence type |
| `result` | varchar | ✓ | result |
| `period` | varchar | ✓ | period |
| `artifacts` | jsonb | ✓ | artifacts |
| `auditor` | varchar | ✓ | auditor |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `soil_analysis`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `sorted_set_rankings`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `members` | integer | ✓ | members |
| `topScore` | real | ✓ | topScore |
| `updateFrequency` | varchar | ✗ | updateFrequency |
| `queryLatencyMs` | real | ✓ | queryLatencyMs |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sql_queries`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `original_query` | text | ✗ | original query |
| `parameterized` | boolean | ✓ | parameterized |
| `parameter_count` | integer | ✓ | parameter count |
| `execution_count` | bigint | ✓ | execution count |
| `avg_latency_ms` | real | ✓ | avg latency ms |
| `injection_attempts` | integer | ✓ | injection attempts |
| `blocked` | integer | ✓ | blocked |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sri_hashes`

**Columns:** 9 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `resource` | text | ✗ | resource |
| `algorithm` | varchar | ✓ | algorithm |
| `hash` | text | ✓ | hash |
| `last_verified` | timestamp | ✓ | last verified |
| `violations` | integer | ✓ | violations |
| `cdn_provider` | varchar | ✓ | cdn provider |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `stream_response_configs`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `endpoint` | varchar | ✗ | endpoint |
| `thresholdBytes` | integer | ✓ | thresholdBytes |
| `chunksizeKB` | integer | ✓ | chunksizeKB |
| `bytesStreamed24h` | varchar | ✗ | bytesStreamed24h |
| `memoryReductionPct` | varchar | ✗ | memoryReductionPct |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `sw_cache_strategies`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `pattern` | varchar | ✗ | pattern |
| `strategy` | varchar | ✗ | strategy |
| `maxAge` | integer | ✓ | maxAge |
| `cacheHitRate` | varchar | ✗ | cacheHitRate |
| `offlineCapable` | boolean | ✓ | offlineCapable |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `swiftMessages`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `messageId` | varchar | ✗ | message ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `messageType` | varchar | ✗ | messageType |
| `direction` | text | ✗ | direction |
| `senderBic` | varchar | ✗ | senderBic |
| `receiverBic` | varchar | ✗ | receiverBic |
| `amount` | float8 | ✓ | amount |
| `currency` | varchar | ✓ | currency |
| `valueDate` | timestamp | ✓ | valueDate |
| `rawMessage` | text | ✗ | rawMessage |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `relatedTransferId` | varchar | ✓ | relatedTransfer ID |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `table_partitions`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tableName` | varchar | ✗ | tableName |
| `partitionKey` | varchar | ✗ | partitionKey |
| `partitionType` | varchar | ✗ | partitionType |
| `activePartitions` | integer | ✓ | activePartitions |
| `rowsPerPartition` | varchar | ✗ | rowsPerPartition |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `tb_batch_configs`

**Columns:** 7 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `batchSize` | integer | ✓ | batchSize |
| `avgBatchLatencyMs` | real | ✓ | avgBatchLatencyMs |
| `throughputTps` | integer | ✓ | throughputTps |
| `transfersProcessed24h` | bigint | ✓ | transfersProcessed24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `temporal_memoized_activities`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `workflow` | varchar | ✗ | workflow |
| `activity` | varchar | ✗ | activity |
| `replaySpeedup` | varchar | ✗ | replaySpeedup |
| `cacheTTL` | varchar | ✗ | cacheTTL |
| `cacheHitRate` | varchar | ✗ | cacheHitRate |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `tls_configs`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `domain` | varchar | ✗ | domain |
| `protocol` | varchar | ✓ | protocol |
| `cipher_suites` | jsonb | ✓ | cipher suites |
| `cert_expiry` | timestamp | ✓ | cert expiry |
| `ocsp_stapling` | boolean | ✓ | ocsp stapling |
| `hsts_preload` | boolean | ✓ | hsts preload |
| `handshakes_24h` | bigint | ✓ | handshakes 24h |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `transaction_alerts`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `rule_id` | integer | ✓ | rule id |
| `customer_id` | varchar | ✗ | customer id |
| `alert_type` | varchar | ✗ | alert type |
| `severity` | varchar | ✗ | severity |
| `amount_ngn` | float8 | ✓ | amount ngn |
| `description` | text | ✓ | description |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `assigned_to` | varchar | ✓ | assigned to |
| `resolved_at` | timestamp | ✓ | resolved at |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `transaction_monitoring_rules`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | text | ✗ | name |
| `category` | varchar | ✗ | category |
| `scenario_code` | varchar | ✓ | scenario code |
| `description` | text | ✓ | description |
| `risk_score_impact` | integer | ✗ | risk score impact |
| `enabled` | integer | ✗ | enabled |
| `cbn_prescribed` | integer | ✗ | cbn prescribed |
| `threshold_config` | jsonb | ✓ | threshold config |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `trialBalances`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `trialBalanceId` | varchar | ✗ | trialBalance ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `glAccountCode` | varchar | ✗ | glAccountCode |
| `periodStart` | timestamp | ✗ | periodStart |
| `periodEnd` | timestamp | ✗ | periodEnd |
| `openingBalance` | float8 | ✗ | openingBalance |
| `totalDebits` | float8 | ✗ | totalDebits |
| `totalCredits` | float8 | ✗ | totalCredits |
| `closingBalance` | float8 | ✗ | closingBalance |
| `currency` | varchar | ✗ | currency |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `txn_pattern_analyses`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `customerId` | varchar | ✗ | customer ID |
| `customerName` | varchar | ✗ | customerName |
| `anomalyScore` | real | ✓ | anomalyScore |
| `baselineDeviation` | varchar | ✗ | baselineDeviation |
| `recommendation` | varchar | ✗ | recommendation |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `typology_matches`

**Columns:** 8 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `typologyCode` | varchar | ✗ | typologyCode |
| `typologyName` | varchar | ✗ | typologyName |
| `riskLevel` | varchar | ✗ | riskLevel |
| `customersTriggered` | integer | ✓ | customersTriggered |
| `autoSARGeneration` | boolean | ✓ | autoSARGeneration |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `ubo_graph_edges`

**Columns:** 6 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `source_id` | integer | ✗ | source id |
| `target_id` | integer | ✗ | target id |
| `relationship` | varchar | ✗ | relationship |
| `ownership_pct` | float8 | ✓ | ownership pct |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `ubo_graph_nodes`

**Columns:** 7 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `entity_name` | text | ✗ | entity name |
| `entity_type` | varchar | ✗ | entity type |
| `nationality` | varchar | ✓ | nationality |
| `risk_level` | varchar | ✓ | risk level |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `users`

**Columns:** 9 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `openId` | varchar | ✗ | open ID |
| `name` | text | ✓ | name |
| `email` | varchar | ✓ | email |
| `loginMethod` | varchar | ✓ | loginMethod |
| `role` | text | ✗ | role |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |
| `lastSignedIn` | timestamp | ✗ | lastSignedIn |

### `valueChainContracts`

**Columns:** 20 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `contractId` | varchar | ✗ | contract ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `contractType` | varchar | ✗ | contractType |
| `buyerName` | varchar | ✗ | buyerName |
| `buyerId` | varchar | ✗ | buyer ID |
| `sellerFarmerId` | varchar | ✗ | sellerFarmer ID |
| `commodity` | varchar | ✗ | commodity |
| `quantityTonnes` | float8 | ✗ | quantityTonnes |
| `pricePerTonne` | float8 | ✗ | pricePerTonne |
| `totalValue` | float8 | ✗ | totalValue |
| `currency` | varchar | ✗ | currency |
| `deliveryLocation` | varchar | ✗ | deliveryLocation |
| `deliveryDeadline` | varchar | ✗ | deliveryDeadline |
| `warehouseReceiptId` | varchar | ✓ | warehouseReceipt ID |
| `qualityGrade` | varchar | ✗ | qualityGrade |
| `milestones` | jsonb | ✗ | milestones |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `vaultOperations`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `operationId` | varchar | ✗ | operation ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `operationType` | varchar | ✗ | operationType |
| `fromLocation` | varchar | ✗ | fromLocation |
| `toLocation` | varchar | ✗ | toLocation |
| `amount` | float8 | ✗ | amount |
| `currency` | varchar | ✗ | currency |
| `authorizedBy` | varchar | ✗ | authorizedBy |
| `dualControlBy` | varchar | ✓ | dualControlBy |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `reason` | text | ✗ | reason |
| `createdAt` | timestamp | ✗ | Record creation timestamp |

### `vault_engines`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `path` | text | ✗ | path |
| `engine_type` | varchar | ✓ | engine type |
| `description` | text | ✓ | description |
| `leases` | integer | ✓ | leases |
| `max_ttl` | varchar | ✓ | max ttl |
| `default_ttl` | varchar | ✓ | default ttl |
| `rotations_completed` | integer | ✓ | rotations completed |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `vault_secrets`

**Columns:** 10 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `path` | text | ✗ | path |
| `engine` | varchar | ✗ | engine |
| `version` | integer | ✓ | version |
| `rotation_days` | integer | ✓ | rotation days |
| `last_rotated` | timestamp | ✓ | last rotated |
| `next_rotation` | timestamp | ✓ | next rotation |
| `access_count` | bigint | ✓ | access count |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `virtual_scroll_configs`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tableName` | varchar | ✗ | tableName |
| `totalRows` | bigint | ✓ | totalRows |
| `viewportRows` | integer | ✓ | viewportRows |
| `renderTimeMs` | real | ✓ | renderTimeMs |
| `scrollFps` | integer | ✓ | scrollFps |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `voice_asr_nigerian`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `voice_ivr_menu`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `voice_nlu_banking`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `voice_tts_nigerian`

**Columns:** 14 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `channel` | text | ✓ | channel |
| `msisdn` | text | ✓ | msisdn |
| `session_id` | text | ✓ | session id |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `waf_rules`

**Columns:** 11 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `rule_id` | varchar | ✗ | rule id |
| `name` | varchar | ✓ | name |
| `category` | varchar | ✓ | category |
| `severity` | varchar | ✓ | severity |
| `paranoia` | integer | ✓ | paranoia |
| `matched_24h` | integer | ✓ | matched 24h |
| `blocked_24h` | integer | ✓ | blocked 24h |
| `false_positives` | integer | ✓ | false positives |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `warehouseReceipts`

**Columns:** 22 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `receiptId` | varchar | ✗ | receipt ID |
| `tenantId` | varchar | ✗ | Multi-tenant isolation key |
| `depositorId` | varchar | ✗ | depositor ID |
| `depositorName` | varchar | ✗ | depositorName |
| `warehouseId` | varchar | ✗ | warehouse ID |
| `warehouseName` | varchar | ✓ | warehouseName |
| `location` | varchar | ✗ | location |
| `commodity` | varchar | ✗ | commodity |
| `quantity` | float8 | ✗ | quantity |
| `quantityUnit` | varchar | ✗ | quantityUnit |
| `qualityGrade` | varchar | ✗ | qualityGrade |
| `storageStartDate` | varchar | ✗ | storageStartDate |
| `expiryDate` | varchar | ✓ | expiryDate |
| `marketValue` | float8 | ✗ | marketValue |
| `currency` | varchar | ✗ | currency |
| `pledgedAsCollateral` | integer | ✗ | pledgedAsCollateral |
| `collateralLoanId` | varchar | ✓ | collateralLoan ID |
| `insurancePolicyId` | varchar | ✓ | insurancePolicy ID |
| `status` | varchar | ✗ | Current status (active/inactive/pending) |
| `createdAt` | timestamp | ✗ | Record creation timestamp |
| `updatedAt` | timestamp | ✗ | Last update timestamp |

### `warehouse_management`

**Columns:** 13 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `tenant_id` | text | ✗ | Multi-tenant isolation key |
| `record_id` | text | ✗ | record id |
| `name` | text | ✗ | name |
| `category` | text | ✗ | category |
| `description` | text | ✓ | description |
| `status` | text | ✗ | Current status (active/inactive/pending) |
| `amount` | float8 | ✓ | amount |
| `region` | text | ✓ | region |
| `reference` | text | ✓ | reference |
| `metadata` | jsonb | ✓ | Flexible JSON metadata |
| `created_at` | timestamp | ✓ | Record creation timestamp |
| `updated_at` | timestamp | ✓ | Last update timestamp |

### `watchlist_sources`

**Columns:** 10 | **Rows:** 32

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `name` | varchar | ✗ | name |
| `source` | varchar | ✗ | source |
| `url` | varchar | ✗ | url |
| `format` | varchar | ✗ | format |
| `entries` | integer | ✓ | entries |
| `syncFrequency` | varchar | ✗ | syncFrequency |
| `autoSync` | boolean | ✓ | autoSync |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

### `wire_transfer_monitor`

**Columns:** 8 | **Rows:** 8

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | ✗ | Primary key (auto-increment) |
| `originatorName` | varchar | ✗ | originatorName |
| `beneficiaryName` | varchar | ✗ | beneficiaryName |
| `amount` | bigint | ✓ | amount |
| `currency` | varchar | ✗ | currency |
| `travelRuleCompliant` | boolean | ✓ | travelRuleCompliant |
| `status` | varchar | ✓ | Current status (active/inactive/pending) |
| `created_at` | timestamp | ✓ | Record creation timestamp |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total tables | 267 |
| Total columns | 3310 |
| Total seeded rows | 3312 |
| Tables with data | 264 |
| Empty tables | 3 |
| Domains covered | 14 |