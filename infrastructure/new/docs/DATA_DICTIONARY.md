# 54Bank Data Dictionary

## Overview
267 Drizzle tables across 46 banking domains, backed by PostgreSQL.

## Core Banking Tables

### accounts
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| account_number | varchar(20) | NUBAN 10-digit account number |
| customer_id | varchar(50) | Reference to customers table |
| account_type | varchar(20) | savings, current, domiciliary, corporate, joint, fixed_deposit |
| balance | decimal(18,2) | Current account balance |
| currency | varchar(3) | ISO 4217 currency code (NGN, USD, GBP, EUR) |
| status | varchar(20) | active, dormant, frozen, closed |
| branch_code | varchar(10) | Branch identifier |
| opened_at | timestamp | Account opening date |
| kyc_tier | integer | KYC tier level (1, 2, 3) |

### customers
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| customer_id | varchar(50) | Unique customer identifier |
| first_name | varchar(100) | Customer first name |
| last_name | varchar(100) | Customer last name |
| email | varchar(255) | Email address |
| phone | varchar(20) | Nigerian phone number (+234...) |
| bvn | varchar(11) | Bank Verification Number |
| nin | varchar(11) | National Identification Number |
| kyc_status | varchar(20) | pending, verified, rejected, expired |
| risk_rating | varchar(10) | low, medium, high |
| date_of_birth | date | Customer DOB |
| address | text | Residential address |

### transactions
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| transaction_id | varchar(50) | Unique transaction reference |
| source_account | varchar(20) | Debit account number |
| dest_account | varchar(20) | Credit account number |
| amount | decimal(18,2) | Transaction amount |
| currency | varchar(3) | ISO 4217 currency code |
| transaction_type | varchar(20) | debit, credit, transfer, reversal |
| status | varchar(20) | pending, completed, failed, reversed |
| channel | varchar(20) | branch, atm, mobile, web, ussd, pos |
| narration | text | Transaction description |
| created_at | timestamp | Transaction timestamp |

### transfers
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| transfer_id | varchar(50) | Unique transfer reference |
| source_bank | varchar(10) | Source bank code |
| dest_bank | varchar(10) | Destination bank code |
| amount | decimal(18,2) | Transfer amount |
| fee | decimal(18,2) | Transfer fee |
| type | varchar(20) | nip, neft, rtgs, internal |
| status | varchar(20) | pending, completed, failed |

## Lending Tables

### loans
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| loan_id | varchar(50) | Unique loan identifier |
| customer_id | varchar(50) | Borrower reference |
| loan_type | varchar(30) | personal, mortgage, auto, business, agriculture, micro |
| principal | decimal(18,2) | Loan principal amount |
| interest_rate | decimal(5,2) | Annual interest rate (%) |
| term_months | integer | Loan tenor in months |
| status | varchar(20) | applied, approved, disbursed, repaying, closed, defaulted |
| disbursement_date | date | Date of disbursement |
| maturity_date | date | Expected maturity date |
| collateral_type | varchar(50) | Type of collateral |
| collateral_value | decimal(18,2) | Collateral valuation |

### loan_repayments
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| repayment_id | varchar(50) | Unique repayment reference |
| loan_id | varchar(50) | Reference to loans table |
| amount | decimal(18,2) | Repayment amount |
| principal_portion | decimal(18,2) | Principal component |
| interest_portion | decimal(18,2) | Interest component |
| due_date | date | Expected payment date |
| paid_date | date | Actual payment date |
| status | varchar(20) | pending, paid, overdue, waived |

## KYC/AML Tables

### kyc_verifications
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| customer_id | varchar(50) | Customer reference |
| verification_type | varchar(30) | bvn, nin, passport, utility_bill, biometric |
| status | varchar(20) | pending, verified, failed, expired |
| verified_at | timestamp | Verification timestamp |
| expiry_date | date | Verification expiry |
| verifier | varchar(50) | Verification agent/system |

### aml_screenings
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| screening_id | varchar(50) | Unique screening reference |
| customer_id | varchar(50) | Customer reference |
| screening_type | varchar(30) | sanctions, pep, adverse_media, watchlist |
| result | varchar(20) | clear, match, potential_match |
| risk_level | varchar(10) | low, medium, high, critical |
| reviewed_by | varchar(50) | Compliance officer |

## Treasury Tables

### treasury_positions
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| position_id | varchar(50) | Position identifier |
| instrument_type | varchar(30) | tbill, bond, repo, fx_spot, fx_forward |
| currency | varchar(3) | Currency code |
| amount | decimal(18,2) | Position amount |
| market_value | decimal(18,2) | Current market value |
| maturity_date | date | Maturity/expiry date |

### fx_rates
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| base_currency | varchar(3) | Base currency |
| quote_currency | varchar(3) | Quote currency |
| bid_rate | decimal(12,6) | Bid price |
| ask_rate | decimal(12,6) | Ask price |
| mid_rate | decimal(12,6) | Mid-market rate |
| source | varchar(20) | cbn, interbank, parallel |

## Agriculture Tables

### farmers
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| farmer_id | varchar(50) | Unique farmer identifier |
| bvn | varchar(11) | BVN |
| farm_size_hectares | decimal(8,2) | Farm size |
| crop_types | text[] | Array of crop types |
| cooperative_id | varchar(50) | Cooperative reference |
| state | varchar(50) | Nigerian state |
| lga | varchar(50) | Local Government Area |
| gps_lat | decimal(10,6) | Farm GPS latitude |
| gps_lng | decimal(10,6) | Farm GPS longitude |

### agri_loans
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| loan_id | varchar(50) | Loan identifier |
| farmer_id | varchar(50) | Farmer reference |
| crop_type | varchar(50) | Crop being financed |
| amount | decimal(18,2) | Loan amount |
| interest_rate | decimal(5,2) | Interest rate |
| status | varchar(20) | applied, approved, disbursed, repaid |
| nirsal_guarantee | boolean | NIRSAL CRG coverage |

## Channel Banking Tables

### voice_sessions
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| session_id | varchar(50) | Voice call session ID |
| caller_phone | varchar(20) | Caller phone number |
| language | varchar(10) | en, ha, yo, ig, pcm |
| intent | varchar(50) | Detected banking intent |
| status | varchar(20) | active, completed, transferred |

### ussd_sessions
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| session_id | varchar(50) | USSD session ID |
| phone | varchar(20) | Subscriber phone |
| service_code | varchar(20) | Short code (*737#, etc.) |
| current_menu | varchar(50) | Current menu position |
| status | varchar(20) | active, completed, timeout |

## Compliance Tables

### regulatory_reports
| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| report_type | varchar(50) | cbn_returns, nfiu_str, ctr, sar |
| period | varchar(20) | Reporting period (YYYY-MM) |
| status | varchar(20) | draft, submitted, accepted, rejected |
| submitted_at | timestamp | Submission timestamp |
| submitted_by | varchar(50) | Submitting officer |

---

*Total: 267 tables across 46 domains. This dictionary covers the primary tables. See `drizzle/schema.ts` for complete schema definitions.*
