-- ════════════════════════════════════════════════════════════════════════════
-- 54Bank Chart of Accounts — CBN Standard Structure
-- 200+ GL Codes following Nigerian Banking Industry CoA
-- Maps to eFASS MBR 100-900 forms
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1000: ASSETS ───────────────────────────────────────────────────────────

INSERT INTO "glAccounts" ("glAccountCode", "tenantId", "name", "category", "subcategory", "parentCode", "currency", "balance", "status", "isControlAccount") VALUES
-- Cash & Balances with CBN
('1000', 'tenant-lagos-main', 'ASSETS', 'asset', 'header', NULL, 'NGN', 0, 'active', 0),
('1001', 'tenant-lagos-main', 'Cash in Vault - Local Currency', 'asset', 'cash', '1000', 'NGN', 2850000000, 'active', 1),
('1002', 'tenant-lagos-main', 'Cash in Vault - Foreign Currency', 'asset', 'cash', '1000', 'USD', 15000000, 'active', 1),
('1003', 'tenant-lagos-main', 'Cash in Transit', 'asset', 'cash', '1000', 'NGN', 450000000, 'active', 0),
('1004', 'tenant-lagos-main', 'ATM Cash Holdings', 'asset', 'cash', '1000', 'NGN', 1200000000, 'active', 0),
('1005', 'tenant-lagos-main', 'Cash Reserve Requirement (CRR) with CBN', 'asset', 'cash_cbn', '1000', 'NGN', 18500000000, 'active', 1),
('1006', 'tenant-lagos-main', 'Current Account with CBN', 'asset', 'cash_cbn', '1000', 'NGN', 5200000000, 'active', 1),
('1007', 'tenant-lagos-main', 'Special Deposits with CBN', 'asset', 'cash_cbn', '1000', 'NGN', 2000000000, 'active', 0),

-- Balances with Banks (Placements)
('1100', 'tenant-lagos-main', 'PLACEMENTS & BALANCES WITH BANKS', 'asset', 'placements_header', '1000', 'NGN', 0, 'active', 0),
('1101', 'tenant-lagos-main', 'Nostro Accounts - USD', 'asset', 'placements', '1100', 'USD', 85000000, 'active', 1),
('1102', 'tenant-lagos-main', 'Nostro Accounts - GBP', 'asset', 'placements', '1100', 'GBP', 12000000, 'active', 1),
('1103', 'tenant-lagos-main', 'Nostro Accounts - EUR', 'asset', 'placements', '1100', 'EUR', 8000000, 'active', 1),
('1104', 'tenant-lagos-main', 'Interbank Placements - Local', 'asset', 'placements', '1100', 'NGN', 15000000000, 'active', 1),
('1105', 'tenant-lagos-main', 'Interbank Placements - Foreign', 'asset', 'placements', '1100', 'USD', 50000000, 'active', 1),
('1106', 'tenant-lagos-main', 'Money Market Placements', 'asset', 'placements', '1100', 'NGN', 8500000000, 'active', 0),
('1107', 'tenant-lagos-main', 'Discount Houses Placements', 'asset', 'placements', '1100', 'NGN', 3000000000, 'active', 0),
('1108', 'tenant-lagos-main', 'CBN Standing Lending Facility', 'asset', 'placements', '1100', 'NGN', 0, 'active', 0),

-- Government Securities
('1200', 'tenant-lagos-main', 'INVESTMENT SECURITIES', 'asset', 'investments_header', '1000', 'NGN', 0, 'active', 0),
('1201', 'tenant-lagos-main', 'Treasury Bills (NTBs)', 'asset', 'investments_govt', '1200', 'NGN', 25000000000, 'active', 1),
('1202', 'tenant-lagos-main', 'FGN Bonds', 'asset', 'investments_govt', '1200', 'NGN', 18000000000, 'active', 1),
('1203', 'tenant-lagos-main', 'State Government Bonds', 'asset', 'investments_govt', '1200', 'NGN', 2500000000, 'active', 0),
('1204', 'tenant-lagos-main', 'Sukuk Bonds', 'asset', 'investments_govt', '1200', 'NGN', 1500000000, 'active', 0),
('1205', 'tenant-lagos-main', 'OMO Bills', 'asset', 'investments_govt', '1200', 'NGN', 12000000000, 'active', 1),
('1206', 'tenant-lagos-main', 'Eurobonds', 'asset', 'investments_foreign', '1200', 'USD', 30000000, 'active', 0),
('1207', 'tenant-lagos-main', 'Corporate Bonds', 'asset', 'investments_corporate', '1200', 'NGN', 3500000000, 'active', 0),
('1208', 'tenant-lagos-main', 'Equity Investments - Quoted', 'asset', 'investments_equity', '1200', 'NGN', 2000000000, 'active', 0),
('1209', 'tenant-lagos-main', 'Equity Investments - Unquoted', 'asset', 'investments_equity', '1200', 'NGN', 800000000, 'active', 0),
('1210', 'tenant-lagos-main', 'Investment in Subsidiaries', 'asset', 'investments_subsidiary', '1200', 'NGN', 5000000000, 'active', 0),
('1211', 'tenant-lagos-main', 'AMCON Bonds', 'asset', 'investments_govt', '1200', 'NGN', 4500000000, 'active', 0),

-- Loans & Advances
('1300', 'tenant-lagos-main', 'LOANS & ADVANCES', 'asset', 'loans_header', '1000', 'NGN', 0, 'active', 0),
('1301', 'tenant-lagos-main', 'Overdrafts - Corporate', 'asset', 'loans_corporate', '1300', 'NGN', 28000000000, 'active', 1),
('1302', 'tenant-lagos-main', 'Term Loans - Corporate', 'asset', 'loans_corporate', '1300', 'NGN', 45000000000, 'active', 1),
('1303', 'tenant-lagos-main', 'Project Finance Loans', 'asset', 'loans_corporate', '1300', 'NGN', 15000000000, 'active', 0),
('1304', 'tenant-lagos-main', 'Syndicated Loans - Participation', 'asset', 'loans_corporate', '1300', 'NGN', 8000000000, 'active', 0),
('1305', 'tenant-lagos-main', 'LPO/Contract Finance', 'asset', 'loans_sme', '1300', 'NGN', 5500000000, 'active', 0),
('1306', 'tenant-lagos-main', 'SME Loans', 'asset', 'loans_sme', '1300', 'NGN', 12000000000, 'active', 1),
('1307', 'tenant-lagos-main', 'Agricultural Loans (ABP)', 'asset', 'loans_agric', '1300', 'NGN', 8500000000, 'active', 1),
('1308', 'tenant-lagos-main', 'Personal/Consumer Loans', 'asset', 'loans_retail', '1300', 'NGN', 6000000000, 'active', 1),
('1309', 'tenant-lagos-main', 'Mortgage Loans', 'asset', 'loans_retail', '1300', 'NGN', 4500000000, 'active', 1),
('1310', 'tenant-lagos-main', 'Staff Loans', 'asset', 'loans_staff', '1300', 'NGN', 2800000000, 'active', 0),
('1311', 'tenant-lagos-main', 'Micro Credit Loans', 'asset', 'loans_micro', '1300', 'NGN', 3500000000, 'active', 0),
('1312', 'tenant-lagos-main', 'Credit Card Receivables', 'asset', 'loans_retail', '1300', 'NGN', 1200000000, 'active', 0),
('1313', 'tenant-lagos-main', 'Lease Receivables', 'asset', 'loans_lease', '1300', 'NGN', 2000000000, 'active', 0),
('1314', 'tenant-lagos-main', 'Loans under CBN Intervention (NIRSAL)', 'asset', 'loans_intervention', '1300', 'NGN', 6000000000, 'active', 0),
('1315', 'tenant-lagos-main', 'Loans to Government', 'asset', 'loans_govt', '1300', 'NGN', 10000000000, 'active', 0),
('1316', 'tenant-lagos-main', 'Foreign Currency Loans', 'asset', 'loans_fx', '1300', 'USD', 25000000, 'active', 0),

-- Loan Provisions (Contra)
('1350', 'tenant-lagos-main', 'LOAN LOSS PROVISIONS', 'asset', 'provisions_header', '1300', 'NGN', 0, 'active', 0),
('1351', 'tenant-lagos-main', 'Specific Provision - Substandard', 'asset', 'provision_specific', '1350', 'NGN', -2500000000, 'active', 0),
('1352', 'tenant-lagos-main', 'Specific Provision - Doubtful', 'asset', 'provision_specific', '1350', 'NGN', -1800000000, 'active', 0),
('1353', 'tenant-lagos-main', 'Specific Provision - Lost', 'asset', 'provision_specific', '1350', 'NGN', -3200000000, 'active', 0),
('1354', 'tenant-lagos-main', 'General Provision (1% Performing)', 'asset', 'provision_general', '1350', 'NGN', -1500000000, 'active', 0),
('1355', 'tenant-lagos-main', 'IFRS 9 ECL Stage 1 (12-month)', 'asset', 'provision_ecl', '1350', 'NGN', -800000000, 'active', 0),
('1356', 'tenant-lagos-main', 'IFRS 9 ECL Stage 2 (Lifetime)', 'asset', 'provision_ecl', '1350', 'NGN', -1200000000, 'active', 0),
('1357', 'tenant-lagos-main', 'IFRS 9 ECL Stage 3 (Credit-impaired)', 'asset', 'provision_ecl', '1350', 'NGN', -2500000000, 'active', 0),
('1358', 'tenant-lagos-main', 'Regulatory Risk Reserve', 'asset', 'provision_regulatory', '1350', 'NGN', -500000000, 'active', 0),

-- Other Assets
('1400', 'tenant-lagos-main', 'OTHER ASSETS', 'asset', 'other_assets_header', '1000', 'NGN', 0, 'active', 0),
('1401', 'tenant-lagos-main', 'Accounts Receivable', 'asset', 'receivables', '1400', 'NGN', 1500000000, 'active', 0),
('1402', 'tenant-lagos-main', 'Accrued Interest Receivable - Loans', 'asset', 'accruals', '1400', 'NGN', 3200000000, 'active', 0),
('1403', 'tenant-lagos-main', 'Accrued Interest Receivable - Investments', 'asset', 'accruals', '1400', 'NGN', 1800000000, 'active', 0),
('1404', 'tenant-lagos-main', 'Prepaid Expenses', 'asset', 'prepayments', '1400', 'NGN', 450000000, 'active', 0),
('1405', 'tenant-lagos-main', 'Clearing Items (Inward)', 'asset', 'clearing', '1400', 'NGN', 2200000000, 'active', 0),
('1406', 'tenant-lagos-main', 'Clearing Items (Outward)', 'asset', 'clearing', '1400', 'NGN', 1800000000, 'active', 0),
('1407', 'tenant-lagos-main', 'Suspense Account - Debit', 'asset', 'suspense', '1400', 'NGN', 350000000, 'active', 0),
('1408', 'tenant-lagos-main', 'NIBSS Settlement Account', 'asset', 'clearing', '1400', 'NGN', 500000000, 'active', 0),
('1409', 'tenant-lagos-main', 'Deferred Tax Asset', 'asset', 'tax', '1400', 'NGN', 1200000000, 'active', 0),
('1410', 'tenant-lagos-main', 'Inventory - Stationery & Supplies', 'asset', 'inventory', '1400', 'NGN', 85000000, 'active', 0),

-- Fixed Assets
('1500', 'tenant-lagos-main', 'PROPERTY, PLANT & EQUIPMENT', 'asset', 'ppe_header', '1000', 'NGN', 0, 'active', 0),
('1501', 'tenant-lagos-main', 'Land', 'asset', 'ppe_land', '1500', 'NGN', 8000000000, 'active', 0),
('1502', 'tenant-lagos-main', 'Buildings', 'asset', 'ppe_buildings', '1500', 'NGN', 12000000000, 'active', 0),
('1503', 'tenant-lagos-main', 'Leasehold Improvements', 'asset', 'ppe_leasehold', '1500', 'NGN', 3500000000, 'active', 0),
('1504', 'tenant-lagos-main', 'Computer Hardware & IT Equipment', 'asset', 'ppe_it', '1500', 'NGN', 4500000000, 'active', 0),
('1505', 'tenant-lagos-main', 'Furniture & Fittings', 'asset', 'ppe_furniture', '1500', 'NGN', 1200000000, 'active', 0),
('1506', 'tenant-lagos-main', 'Motor Vehicles', 'asset', 'ppe_vehicles', '1500', 'NGN', 800000000, 'active', 0),
('1507', 'tenant-lagos-main', 'ATM Machines', 'asset', 'ppe_atm', '1500', 'NGN', 2500000000, 'active', 0),
('1508', 'tenant-lagos-main', 'Vaults & Security Equipment', 'asset', 'ppe_security', '1500', 'NGN', 950000000, 'active', 0),
('1509', 'tenant-lagos-main', 'Work-in-Progress (Capital)', 'asset', 'ppe_wip', '1500', 'NGN', 1500000000, 'active', 0),
('1550', 'tenant-lagos-main', 'Accumulated Depreciation - Buildings', 'asset', 'depreciation', '1500', 'NGN', -3500000000, 'active', 0),
('1551', 'tenant-lagos-main', 'Accumulated Depreciation - IT Equipment', 'asset', 'depreciation', '1500', 'NGN', -2800000000, 'active', 0),
('1552', 'tenant-lagos-main', 'Accumulated Depreciation - F&F', 'asset', 'depreciation', '1500', 'NGN', -600000000, 'active', 0),
('1553', 'tenant-lagos-main', 'Accumulated Depreciation - Vehicles', 'asset', 'depreciation', '1500', 'NGN', -450000000, 'active', 0),

-- Intangible Assets
('1600', 'tenant-lagos-main', 'INTANGIBLE ASSETS', 'asset', 'intangible_header', '1000', 'NGN', 0, 'active', 0),
('1601', 'tenant-lagos-main', 'Software Licenses', 'asset', 'intangible_software', '1600', 'NGN', 3500000000, 'active', 0),
('1602', 'tenant-lagos-main', 'Core Banking System', 'asset', 'intangible_software', '1600', 'NGN', 5000000000, 'active', 0),
('1603', 'tenant-lagos-main', 'Goodwill', 'asset', 'intangible_goodwill', '1600', 'NGN', 2000000000, 'active', 0),
('1604', 'tenant-lagos-main', 'Banking License', 'asset', 'intangible_license', '1600', 'NGN', 1000000000, 'active', 0),
('1605', 'tenant-lagos-main', 'Amortization - Software', 'asset', 'amortization', '1600', 'NGN', -2200000000, 'active', 0),

-- ─── 2000: LIABILITIES ──────────────────────────────────────────────────────

('2000', 'tenant-lagos-main', 'LIABILITIES', 'liability', 'header', NULL, 'NGN', 0, 'active', 0),

-- Customer Deposits
('2100', 'tenant-lagos-main', 'CUSTOMER DEPOSITS', 'liability', 'deposits_header', '2000', 'NGN', 0, 'active', 0),
('2101', 'tenant-lagos-main', 'Demand Deposits - Current Accounts', 'liability', 'deposits_demand', '2100', 'NGN', 85000000000, 'active', 1),
('2102', 'tenant-lagos-main', 'Savings Deposits', 'liability', 'deposits_savings', '2100', 'NGN', 45000000000, 'active', 1),
('2103', 'tenant-lagos-main', 'Time/Fixed Deposits (< 90 days)', 'liability', 'deposits_time', '2100', 'NGN', 25000000000, 'active', 1),
('2104', 'tenant-lagos-main', 'Time/Fixed Deposits (90-180 days)', 'liability', 'deposits_time', '2100', 'NGN', 18000000000, 'active', 1),
('2105', 'tenant-lagos-main', 'Time/Fixed Deposits (> 180 days)', 'liability', 'deposits_time', '2100', 'NGN', 12000000000, 'active', 1),
('2106', 'tenant-lagos-main', 'Domiciliary Account Deposits - USD', 'liability', 'deposits_fx', '2100', 'USD', 120000000, 'active', 1),
('2107', 'tenant-lagos-main', 'Domiciliary Account Deposits - GBP', 'liability', 'deposits_fx', '2100', 'GBP', 25000000, 'active', 1),
('2108', 'tenant-lagos-main', 'Domiciliary Account Deposits - EUR', 'liability', 'deposits_fx', '2100', 'EUR', 18000000, 'active', 1),
('2109', 'tenant-lagos-main', 'Government Deposits (TSA)', 'liability', 'deposits_govt', '2100', 'NGN', 8000000000, 'active', 0),
('2110', 'tenant-lagos-main', 'Margin Deposits (LCs/Guarantees)', 'liability', 'deposits_margin', '2100', 'NGN', 5500000000, 'active', 0),
('2111', 'tenant-lagos-main', 'Escrow Account Deposits', 'liability', 'deposits_escrow', '2100', 'NGN', 3200000000, 'active', 0),
('2112', 'tenant-lagos-main', 'Agent Banking Float', 'liability', 'deposits_agent', '2100', 'NGN', 1500000000, 'active', 0),
('2113', 'tenant-lagos-main', 'Mobile Money Wallet Balances', 'liability', 'deposits_mobile', '2100', 'NGN', 2800000000, 'active', 0),
('2114', 'tenant-lagos-main', 'Dormant Account Balances', 'liability', 'deposits_dormant', '2100', 'NGN', 4500000000, 'active', 0),
('2115', 'tenant-lagos-main', 'Unclaimed Deposits (>10 years)', 'liability', 'deposits_unclaimed', '2100', 'NGN', 1200000000, 'active', 0),

-- Borrowings
('2200', 'tenant-lagos-main', 'BORROWINGS', 'liability', 'borrowings_header', '2000', 'NGN', 0, 'active', 0),
('2201', 'tenant-lagos-main', 'Interbank Takings - Local', 'liability', 'borrowings_interbank', '2200', 'NGN', 8000000000, 'active', 1),
('2202', 'tenant-lagos-main', 'Interbank Takings - Foreign', 'liability', 'borrowings_interbank', '2200', 'USD', 20000000, 'active', 0),
('2203', 'tenant-lagos-main', 'CBN Standing Deposit Facility', 'liability', 'borrowings_cbn', '2200', 'NGN', 0, 'active', 0),
('2204', 'tenant-lagos-main', 'CBN Intervention Fund Borrowings', 'liability', 'borrowings_cbn', '2200', 'NGN', 5000000000, 'active', 0),
('2205', 'tenant-lagos-main', 'Long-term Bonds Issued', 'liability', 'borrowings_bonds', '2200', 'NGN', 15000000000, 'active', 0),
('2206', 'tenant-lagos-main', 'Subordinated Debt (Tier 2)', 'liability', 'borrowings_sub', '2200', 'NGN', 8000000000, 'active', 1),
('2207', 'tenant-lagos-main', 'Commercial Papers', 'liability', 'borrowings_cp', '2200', 'NGN', 3000000000, 'active', 0),
('2208', 'tenant-lagos-main', 'DFI Credit Lines (IFC/AfDB)', 'liability', 'borrowings_dfi', '2200', 'USD', 50000000, 'active', 0),

-- Other Liabilities
('2300', 'tenant-lagos-main', 'OTHER LIABILITIES', 'liability', 'other_liab_header', '2000', 'NGN', 0, 'active', 0),
('2301', 'tenant-lagos-main', 'Accrued Interest Payable - Deposits', 'liability', 'accruals', '2300', 'NGN', 2800000000, 'active', 0),
('2302', 'tenant-lagos-main', 'Accrued Interest Payable - Borrowings', 'liability', 'accruals', '2300', 'NGN', 850000000, 'active', 0),
('2303', 'tenant-lagos-main', 'Accounts Payable & Accrued Expenses', 'liability', 'payables', '2300', 'NGN', 1500000000, 'active', 0),
('2304', 'tenant-lagos-main', 'Dividend Payable', 'liability', 'payables', '2300', 'NGN', 3500000000, 'active', 0),
('2305', 'tenant-lagos-main', 'Tax Payable - CIT', 'liability', 'tax', '2300', 'NGN', 2200000000, 'active', 0),
('2306', 'tenant-lagos-main', 'Tax Payable - WHT', 'liability', 'tax', '2300', 'NGN', 450000000, 'active', 0),
('2307', 'tenant-lagos-main', 'Tax Payable - VAT', 'liability', 'tax', '2300', 'NGN', 180000000, 'active', 0),
('2308', 'tenant-lagos-main', 'NDIC Premium Payable', 'liability', 'regulatory', '2300', 'NGN', 650000000, 'active', 0),
('2309', 'tenant-lagos-main', 'AMCON Contribution Payable', 'liability', 'regulatory', '2300', 'NGN', 1200000000, 'active', 0),
('2310', 'tenant-lagos-main', 'Pension Obligations', 'liability', 'staff', '2300', 'NGN', 1800000000, 'active', 0),
('2311', 'tenant-lagos-main', 'Gratuity Provisions', 'liability', 'staff', '2300', 'NGN', 950000000, 'active', 0),
('2312', 'tenant-lagos-main', 'Bankers Acceptances', 'liability', 'contingent', '2300', 'NGN', 4000000000, 'active', 0),
('2313', 'tenant-lagos-main', 'Bills Payable', 'liability', 'contingent', '2300', 'NGN', 2500000000, 'active', 0),
('2314', 'tenant-lagos-main', 'Deferred Income', 'liability', 'deferred', '2300', 'NGN', 350000000, 'active', 0),
('2315', 'tenant-lagos-main', 'Lease Liabilities (IFRS 16)', 'liability', 'lease', '2300', 'NGN', 2200000000, 'active', 0),
('2316', 'tenant-lagos-main', 'Customers Deposit for Letters of Credit', 'liability', 'trade', '2300', 'NGN', 3800000000, 'active', 0),
('2317', 'tenant-lagos-main', 'Suspense Account - Credit', 'liability', 'suspense', '2300', 'NGN', 280000000, 'active', 0),
('2318', 'tenant-lagos-main', 'Unearned Discount', 'liability', 'deferred', '2300', 'NGN', 450000000, 'active', 0),

-- ─── 3000: EQUITY ───────────────────────────────────────────────────────────

('3000', 'tenant-lagos-main', 'SHAREHOLDERS EQUITY', 'equity', 'header', NULL, 'NGN', 0, 'active', 0),
('3001', 'tenant-lagos-main', 'Authorized Share Capital', 'equity', 'share_capital', '3000', 'NGN', 50000000000, 'active', 1),
('3002', 'tenant-lagos-main', 'Issued & Paid-up Capital', 'equity', 'share_capital', '3000', 'NGN', 25000000000, 'active', 1),
('3003', 'tenant-lagos-main', 'Share Premium', 'equity', 'share_premium', '3000', 'NGN', 15000000000, 'active', 0),
('3004', 'tenant-lagos-main', 'Statutory Reserve (30% of PAT)', 'equity', 'reserves', '3000', 'NGN', 12000000000, 'active', 1),
('3005', 'tenant-lagos-main', 'General Reserve', 'equity', 'reserves', '3000', 'NGN', 8000000000, 'active', 0),
('3006', 'tenant-lagos-main', 'Retained Earnings', 'equity', 'retained', '3000', 'NGN', 18500000000, 'active', 1),
('3007', 'tenant-lagos-main', 'SMEEIS Reserve', 'equity', 'reserves', '3000', 'NGN', 2500000000, 'active', 0),
('3008', 'tenant-lagos-main', 'Revaluation Reserve', 'equity', 'reserves', '3000', 'NGN', 3500000000, 'active', 0),
('3009', 'tenant-lagos-main', 'Foreign Currency Translation Reserve', 'equity', 'reserves', '3000', 'NGN', -800000000, 'active', 0),
('3010', 'tenant-lagos-main', 'FVOCI Reserve (Available-for-Sale)', 'equity', 'reserves', '3000', 'NGN', 1200000000, 'active', 0),
('3011', 'tenant-lagos-main', 'Regulatory Risk Reserve (IFRS/CBN delta)', 'equity', 'reserves', '3000', 'NGN', 2000000000, 'active', 1),
('3012', 'tenant-lagos-main', 'Treasury Shares', 'equity', 'treasury', '3000', 'NGN', -1500000000, 'active', 0),
('3013', 'tenant-lagos-main', 'Non-Controlling Interest', 'equity', 'nci', '3000', 'NGN', 500000000, 'active', 0),

-- ─── 4000: INCOME ───────────────────────────────────────────────────────────

('4000', 'tenant-lagos-main', 'INCOME', 'income', 'header', NULL, 'NGN', 0, 'active', 0),

-- Interest Income
('4100', 'tenant-lagos-main', 'INTEREST & SIMILAR INCOME', 'income', 'interest_header', '4000', 'NGN', 0, 'active', 0),
('4101', 'tenant-lagos-main', 'Interest on Loans & Advances - Corporate', 'income', 'interest_loans', '4100', 'NGN', 18500000000, 'active', 1),
('4102', 'tenant-lagos-main', 'Interest on Loans & Advances - Retail', 'income', 'interest_loans', '4100', 'NGN', 4500000000, 'active', 1),
('4103', 'tenant-lagos-main', 'Interest on Loans & Advances - SME', 'income', 'interest_loans', '4100', 'NGN', 3200000000, 'active', 0),
('4104', 'tenant-lagos-main', 'Interest on Treasury Bills', 'income', 'interest_investments', '4100', 'NGN', 5500000000, 'active', 0),
('4105', 'tenant-lagos-main', 'Interest on FGN Bonds', 'income', 'interest_investments', '4100', 'NGN', 2800000000, 'active', 0),
('4106', 'tenant-lagos-main', 'Interest on Placements', 'income', 'interest_placements', '4100', 'NGN', 2200000000, 'active', 0),
('4107', 'tenant-lagos-main', 'Interest on Staff Loans', 'income', 'interest_loans', '4100', 'NGN', 280000000, 'active', 0),
('4108', 'tenant-lagos-main', 'Lease Income', 'income', 'interest_lease', '4100', 'NGN', 350000000, 'active', 0),

-- Fee & Commission Income
('4200', 'tenant-lagos-main', 'FEE & COMMISSION INCOME', 'income', 'fee_header', '4000', 'NGN', 0, 'active', 0),
('4201', 'tenant-lagos-main', 'Account Maintenance Fees (COT)', 'income', 'fee_account', '4200', 'NGN', 2500000000, 'active', 0),
('4202', 'tenant-lagos-main', 'Credit-related Fees', 'income', 'fee_credit', '4200', 'NGN', 1800000000, 'active', 0),
('4203', 'tenant-lagos-main', 'Transfer & Remittance Fees', 'income', 'fee_transfer', '4200', 'NGN', 3500000000, 'active', 0),
('4204', 'tenant-lagos-main', 'Card Fees (Issuance/Annual)', 'income', 'fee_cards', '4200', 'NGN', 1200000000, 'active', 0),
('4205', 'tenant-lagos-main', 'POS/ATM Fee Income', 'income', 'fee_channels', '4200', 'NGN', 2800000000, 'active', 0),
('4206', 'tenant-lagos-main', 'Trade Finance Fees (LC/BG)', 'income', 'fee_trade', '4200', 'NGN', 1500000000, 'active', 0),
('4207', 'tenant-lagos-main', 'SMS/Alert Fees', 'income', 'fee_digital', '4200', 'NGN', 850000000, 'active', 0),
('4208', 'tenant-lagos-main', 'Internet/Mobile Banking Fees', 'income', 'fee_digital', '4200', 'NGN', 650000000, 'active', 0),
('4209', 'tenant-lagos-main', 'Insurance Commission', 'income', 'fee_insurance', '4200', 'NGN', 320000000, 'active', 0),
('4210', 'tenant-lagos-main', 'USSD Service Fees', 'income', 'fee_digital', '4200', 'NGN', 450000000, 'active', 0),

-- Other Income
('4300', 'tenant-lagos-main', 'OTHER OPERATING INCOME', 'income', 'other_income_header', '4000', 'NGN', 0, 'active', 0),
('4301', 'tenant-lagos-main', 'FX Trading Income', 'income', 'fx_income', '4300', 'NGN', 8500000000, 'active', 1),
('4302', 'tenant-lagos-main', 'FX Revaluation Gains', 'income', 'fx_income', '4300', 'NGN', 2200000000, 'active', 0),
('4303', 'tenant-lagos-main', 'Dividend Income', 'income', 'investment_income', '4300', 'NGN', 500000000, 'active', 0),
('4304', 'tenant-lagos-main', 'Gain on Sale of Securities', 'income', 'investment_income', '4300', 'NGN', 350000000, 'active', 0),
('4305', 'tenant-lagos-main', 'Recoveries from Written-off Loans', 'income', 'recovery', '4300', 'NGN', 1200000000, 'active', 0),
('4306', 'tenant-lagos-main', 'Rental Income', 'income', 'rental', '4300', 'NGN', 180000000, 'active', 0),
('4307', 'tenant-lagos-main', 'Gain on Disposal of PPE', 'income', 'disposal', '4300', 'NGN', 50000000, 'active', 0),

-- ─── 5000: EXPENSES ─────────────────────────────────────────────────────────

('5000', 'tenant-lagos-main', 'EXPENSES', 'expense', 'header', NULL, 'NGN', 0, 'active', 0),

-- Interest Expense
('5100', 'tenant-lagos-main', 'INTEREST & SIMILAR EXPENSE', 'expense', 'interest_exp_header', '5000', 'NGN', 0, 'active', 0),
('5101', 'tenant-lagos-main', 'Interest on Customer Deposits - Savings', 'expense', 'interest_deposits', '5100', 'NGN', 3500000000, 'active', 1),
('5102', 'tenant-lagos-main', 'Interest on Customer Deposits - Term', 'expense', 'interest_deposits', '5100', 'NGN', 5800000000, 'active', 1),
('5103', 'tenant-lagos-main', 'Interest on Interbank Takings', 'expense', 'interest_borrowings', '5100', 'NGN', 1200000000, 'active', 0),
('5104', 'tenant-lagos-main', 'Interest on Bonds Issued', 'expense', 'interest_borrowings', '5100', 'NGN', 2500000000, 'active', 0),
('5105', 'tenant-lagos-main', 'Interest on CBN Facilities', 'expense', 'interest_cbn', '5100', 'NGN', 800000000, 'active', 0),
('5106', 'tenant-lagos-main', 'Interest on Subordinated Debt', 'expense', 'interest_sub', '5100', 'NGN', 1200000000, 'active', 0),

-- Impairment Charges
('5200', 'tenant-lagos-main', 'IMPAIRMENT CHARGES', 'expense', 'impairment_header', '5000', 'NGN', 0, 'active', 0),
('5201', 'tenant-lagos-main', 'Loan Impairment Charge - Stage 1', 'expense', 'impairment_loans', '5200', 'NGN', 1500000000, 'active', 0),
('5202', 'tenant-lagos-main', 'Loan Impairment Charge - Stage 2', 'expense', 'impairment_loans', '5200', 'NGN', 2200000000, 'active', 0),
('5203', 'tenant-lagos-main', 'Loan Impairment Charge - Stage 3', 'expense', 'impairment_loans', '5200', 'NGN', 3500000000, 'active', 0),
('5204', 'tenant-lagos-main', 'Investment Impairment', 'expense', 'impairment_investments', '5200', 'NGN', 200000000, 'active', 0),
('5205', 'tenant-lagos-main', 'Other Asset Impairment', 'expense', 'impairment_other', '5200', 'NGN', 150000000, 'active', 0),

-- Operating Expenses
('5300', 'tenant-lagos-main', 'OPERATING EXPENSES', 'expense', 'opex_header', '5000', 'NGN', 0, 'active', 0),
('5301', 'tenant-lagos-main', 'Staff Costs - Salaries & Wages', 'expense', 'staff_costs', '5300', 'NGN', 12000000000, 'active', 1),
('5302', 'tenant-lagos-main', 'Staff Costs - Pension Contributions', 'expense', 'staff_costs', '5300', 'NGN', 1800000000, 'active', 0),
('5303', 'tenant-lagos-main', 'Staff Costs - Medical/Insurance', 'expense', 'staff_costs', '5300', 'NGN', 850000000, 'active', 0),
('5304', 'tenant-lagos-main', 'Staff Costs - Training & Development', 'expense', 'staff_costs', '5300', 'NGN', 450000000, 'active', 0),
('5305', 'tenant-lagos-main', 'Staff Costs - Gratuity & Benefits', 'expense', 'staff_costs', '5300', 'NGN', 650000000, 'active', 0),
('5310', 'tenant-lagos-main', 'Occupancy Costs - Rent', 'expense', 'occupancy', '5300', 'NGN', 2200000000, 'active', 0),
('5311', 'tenant-lagos-main', 'Occupancy Costs - Utilities', 'expense', 'occupancy', '5300', 'NGN', 850000000, 'active', 0),
('5312', 'tenant-lagos-main', 'Occupancy Costs - Maintenance', 'expense', 'occupancy', '5300', 'NGN', 1200000000, 'active', 0),
('5313', 'tenant-lagos-main', 'Occupancy Costs - Security', 'expense', 'occupancy', '5300', 'NGN', 650000000, 'active', 0),
('5320', 'tenant-lagos-main', 'Depreciation - Buildings', 'expense', 'depreciation', '5300', 'NGN', 600000000, 'active', 0),
('5321', 'tenant-lagos-main', 'Depreciation - IT Equipment', 'expense', 'depreciation', '5300', 'NGN', 1200000000, 'active', 0),
('5322', 'tenant-lagos-main', 'Depreciation - Other Assets', 'expense', 'depreciation', '5300', 'NGN', 450000000, 'active', 0),
('5323', 'tenant-lagos-main', 'Amortization - Software', 'expense', 'amortization', '5300', 'NGN', 800000000, 'active', 0),
('5330', 'tenant-lagos-main', 'IT & Technology Costs', 'expense', 'technology', '5300', 'NGN', 3500000000, 'active', 0),
('5331', 'tenant-lagos-main', 'Communication Costs', 'expense', 'technology', '5300', 'NGN', 650000000, 'active', 0),
('5332', 'tenant-lagos-main', 'Card Operations Costs (Visa/MC)', 'expense', 'channels', '5300', 'NGN', 1800000000, 'active', 0),
('5333', 'tenant-lagos-main', 'NIBSS/NIP Transaction Fees', 'expense', 'channels', '5300', 'NGN', 1200000000, 'active', 0),
('5340', 'tenant-lagos-main', 'Professional Fees - Audit', 'expense', 'professional', '5300', 'NGN', 450000000, 'active', 0),
('5341', 'tenant-lagos-main', 'Professional Fees - Legal', 'expense', 'professional', '5300', 'NGN', 350000000, 'active', 0),
('5342', 'tenant-lagos-main', 'Professional Fees - Consulting', 'expense', 'professional', '5300', 'NGN', 800000000, 'active', 0),
('5343', 'tenant-lagos-main', 'Insurance Premiums', 'expense', 'insurance', '5300', 'NGN', 650000000, 'active', 0),
('5344', 'tenant-lagos-main', 'Advertising & Marketing', 'expense', 'marketing', '5300', 'NGN', 1500000000, 'active', 0),
('5345', 'tenant-lagos-main', 'Donation & CSR', 'expense', 'csr', '5300', 'NGN', 200000000, 'active', 0),
('5346', 'tenant-lagos-main', 'NDIC Premium', 'expense', 'regulatory', '5300', 'NGN', 1300000000, 'active', 0),
('5347', 'tenant-lagos-main', 'AMCON Levy', 'expense', 'regulatory', '5300', 'NGN', 2400000000, 'active', 0),
('5348', 'tenant-lagos-main', 'Penalties & Fines (Regulatory)', 'expense', 'regulatory', '5300', 'NGN', 50000000, 'active', 0),
('5349', 'tenant-lagos-main', 'Directors Fees & Expenses', 'expense', 'governance', '5300', 'NGN', 350000000, 'active', 0),
('5350', 'tenant-lagos-main', 'AGM & Shareholder Expenses', 'expense', 'governance', '5300', 'NGN', 120000000, 'active', 0),

-- Tax
('5400', 'tenant-lagos-main', 'TAXATION', 'expense', 'tax_header', '5000', 'NGN', 0, 'active', 0),
('5401', 'tenant-lagos-main', 'Company Income Tax', 'expense', 'tax_cit', '5400', 'NGN', 5500000000, 'active', 1),
('5402', 'tenant-lagos-main', 'Education Tax', 'expense', 'tax_education', '5400', 'NGN', 650000000, 'active', 0),
('5403', 'tenant-lagos-main', 'Police Trust Fund Levy', 'expense', 'tax_levy', '5400', 'NGN', 30000000, 'active', 0),
('5404', 'tenant-lagos-main', 'IT Development Levy (NITDA)', 'expense', 'tax_levy', '5400', 'NGN', 180000000, 'active', 0),
('5405', 'tenant-lagos-main', 'Deferred Tax Expense', 'expense', 'tax_deferred', '5400', 'NGN', 800000000, 'active', 0)

ON CONFLICT ("glAccountCode") DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- GL-to-eFASS MAPPING TABLE
-- Maps each GL code range to specific CBN eFASS MBR form and line number
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "efassMapping" (
  "id" SERIAL PRIMARY KEY,
  "glCodeStart" VARCHAR(32) NOT NULL,
  "glCodeEnd" VARCHAR(32) NOT NULL,
  "mbrForm" VARCHAR(16) NOT NULL,
  "mbrLine" INTEGER NOT NULL,
  "lineName" VARCHAR(191) NOT NULL,
  "reportCategory" VARCHAR(64) NOT NULL,
  "aggregationType" VARCHAR(16) NOT NULL DEFAULT 'sum',
  "signConvention" VARCHAR(8) NOT NULL DEFAULT 'normal',
  "cbnCode" VARCHAR(32),
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

INSERT INTO "efassMapping" ("glCodeStart", "glCodeEnd", "mbrForm", "mbrLine", "lineName", "reportCategory", "aggregationType", "signConvention", "cbnCode", "notes") VALUES
-- MBR 100: BALANCE SHEET - ASSETS
('1001', '1007', 'MBR100', 1, 'Cash & Balances with Central Bank', 'assets', 'sum', 'normal', 'BS-A-001', 'Includes CRR, current account with CBN'),
('1101', '1108', 'MBR100', 2, 'Due from Banks', 'assets', 'sum', 'normal', 'BS-A-002', 'Nostro, interbank placements, money market'),
('1201', '1211', 'MBR100', 3, 'Investment Securities', 'assets', 'sum', 'normal', 'BS-A-003', 'NTBs, FGN bonds, OMO bills, corporate bonds'),
('1301', '1316', 'MBR100', 4, 'Loans and Advances to Customers (Gross)', 'assets', 'sum', 'normal', 'BS-A-004', 'All loan categories before provisions'),
('1351', '1358', 'MBR100', 5, 'Less: Allowance for Loan Losses', 'assets', 'sum', 'negate', 'BS-A-005', 'Specific + general + ECL provisions'),
('1401', '1410', 'MBR100', 6, 'Other Assets', 'assets', 'sum', 'normal', 'BS-A-006', 'Receivables, accruals, prepayments, clearing'),
('1501', '1553', 'MBR100', 7, 'Property, Plant & Equipment (Net)', 'assets', 'sum', 'normal', 'BS-A-007', 'PP&E less accumulated depreciation'),
('1601', '1605', 'MBR100', 8, 'Intangible Assets (Net)', 'assets', 'sum', 'normal', 'BS-A-008', 'Software, goodwill, licenses less amortization'),

-- MBR 200: BALANCE SHEET - LIABILITIES
('2101', '2115', 'MBR200', 1, 'Deposits from Customers', 'liabilities', 'sum', 'normal', 'BS-L-001', 'All customer deposits by type'),
('2201', '2208', 'MBR200', 2, 'Due to Banks & Borrowings', 'liabilities', 'sum', 'normal', 'BS-L-002', 'Interbank, CBN facilities, bonds, DFI'),
('2301', '2318', 'MBR200', 3, 'Other Liabilities', 'liabilities', 'sum', 'normal', 'BS-L-003', 'Accruals, payables, tax, deferred'),

-- MBR 300: SHAREHOLDERS EQUITY
('3001', '3002', 'MBR300', 1, 'Share Capital', 'equity', 'sum', 'normal', 'BS-E-001', 'Issued and paid-up'),
('3003', '3003', 'MBR300', 2, 'Share Premium', 'equity', 'sum', 'normal', 'BS-E-002', NULL),
('3004', '3011', 'MBR300', 3, 'Reserves', 'equity', 'sum', 'normal', 'BS-E-003', 'Statutory, general, revaluation, FVOCI, regulatory'),
('3006', '3006', 'MBR300', 4, 'Retained Earnings', 'equity', 'sum', 'normal', 'BS-E-004', NULL),
('3012', '3012', 'MBR300', 5, 'Treasury Shares', 'equity', 'sum', 'normal', 'BS-E-005', 'Deducted from equity'),
('3013', '3013', 'MBR300', 6, 'Non-Controlling Interest', 'equity', 'sum', 'normal', 'BS-E-006', NULL),

-- MBR 400: PROFIT & LOSS - INCOME
('4101', '4108', 'MBR400', 1, 'Interest & Similar Income', 'income', 'sum', 'normal', 'PL-I-001', 'Loans, investments, placements'),
('4201', '4210', 'MBR400', 2, 'Fees & Commission Income', 'income', 'sum', 'normal', 'PL-I-002', 'All fee categories'),
('4301', '4307', 'MBR400', 3, 'Other Operating Income', 'income', 'sum', 'normal', 'PL-I-003', 'FX, dividends, recoveries'),

-- MBR 500: PROFIT & LOSS - EXPENSES
('5101', '5106', 'MBR500', 1, 'Interest & Similar Expense', 'expenses', 'sum', 'normal', 'PL-E-001', 'Deposits, borrowings, bonds'),
('5201', '5205', 'MBR500', 2, 'Impairment Charges', 'expenses', 'sum', 'normal', 'PL-E-002', 'Loan and investment impairment'),
('5301', '5350', 'MBR500', 3, 'Operating Expenses', 'expenses', 'sum', 'normal', 'PL-E-003', 'Staff, occupancy, depreciation, technology, regulatory'),
('5401', '5405', 'MBR500', 4, 'Taxation', 'expenses', 'sum', 'normal', 'PL-E-004', 'CIT, education tax, levies'),

-- MBR 600: CAPITAL ADEQUACY
('3002', '3002', 'MBR600', 1, 'Tier 1 Capital - Paid-up Capital', 'capital', 'sum', 'normal', 'CAR-T1-001', NULL),
('3003', '3003', 'MBR600', 2, 'Tier 1 Capital - Share Premium', 'capital', 'sum', 'normal', 'CAR-T1-002', NULL),
('3004', '3006', 'MBR600', 3, 'Tier 1 Capital - Reserves & Retained', 'capital', 'sum', 'normal', 'CAR-T1-003', NULL),
('2206', '2206', 'MBR600', 4, 'Tier 2 Capital - Subordinated Debt', 'capital', 'sum', 'normal', 'CAR-T2-001', 'Max 50% of Tier 1'),
('3008', '3008', 'MBR600', 5, 'Tier 2 Capital - Revaluation Reserve', 'capital', 'sum', 'normal', 'CAR-T2-002', '50% of revaluation'),

-- MBR 700: LIQUIDITY
('1001', '1007', 'MBR700', 1, 'Liquid Assets - Cash & CBN Balances', 'liquidity', 'sum', 'normal', 'LQR-LA-001', NULL),
('1201', '1205', 'MBR700', 2, 'Liquid Assets - Government Securities', 'liquidity', 'sum', 'normal', 'LQR-LA-002', 'NTBs, FGN Bonds, OMO'),
('1104', '1107', 'MBR700', 3, 'Liquid Assets - Interbank Placements (<90d)', 'liquidity', 'sum', 'normal', 'LQR-LA-003', NULL),
('2101', '2103', 'MBR700', 4, 'Current Liabilities - Demand & Short-term Deposits', 'liquidity', 'sum', 'normal', 'LQR-CL-001', NULL),
('2201', '2201', 'MBR700', 5, 'Current Liabilities - Interbank Takings', 'liquidity', 'sum', 'normal', 'LQR-CL-002', NULL),

-- MBR 800: SECTORAL CREDIT
('1301', '1302', 'MBR800', 1, 'Loans to Corporate Sector', 'sectoral', 'sum', 'normal', 'SEC-001', 'Manufacturing, services, trade'),
('1306', '1306', 'MBR800', 2, 'Loans to SME Sector', 'sectoral', 'sum', 'normal', 'SEC-002', 'Small & medium enterprises'),
('1307', '1307', 'MBR800', 3, 'Loans to Agriculture', 'sectoral', 'sum', 'normal', 'SEC-003', 'ABP, NIRSAL, agric credit'),
('1308', '1309', 'MBR800', 4, 'Loans to Retail/Consumer', 'sectoral', 'sum', 'normal', 'SEC-004', 'Personal, mortgage, cards'),
('1315', '1315', 'MBR800', 5, 'Loans to Government', 'sectoral', 'sum', 'normal', 'SEC-005', 'Federal, state, LGA'),

-- MBR 900: MATURITY ANALYSIS
('2103', '2103', 'MBR900', 1, 'Deposits Maturing < 90 days', 'maturity', 'sum', 'normal', 'MAT-001', NULL),
('2104', '2104', 'MBR900', 2, 'Deposits Maturing 90-180 days', 'maturity', 'sum', 'normal', 'MAT-002', NULL),
('2105', '2105', 'MBR900', 3, 'Deposits Maturing > 180 days', 'maturity', 'sum', 'normal', 'MAT-003', NULL),
('2205', '2205', 'MBR900', 4, 'Bonds Maturing > 1 year', 'maturity', 'sum', 'normal', 'MAT-004', NULL)

ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- TRIAL BALANCE — Seed April 2026 period
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO "trialBalances" ("trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd", "openingBalance", "totalDebits", "totalCredits", "closingBalance", "currency", "status") VALUES
-- Assets
('TB-2026-04-1001', 'tenant-lagos-main', '1001', '2026-04-01', '2026-04-30', 2500000000, 45000000000, 44650000000, 2850000000, 'NGN', 'finalized'),
('TB-2026-04-1005', 'tenant-lagos-main', '1005', '2026-04-01', '2026-04-30', 18200000000, 500000000, 200000000, 18500000000, 'NGN', 'finalized'),
('TB-2026-04-1006', 'tenant-lagos-main', '1006', '2026-04-01', '2026-04-30', 4800000000, 12000000000, 11600000000, 5200000000, 'NGN', 'finalized'),
('TB-2026-04-1104', 'tenant-lagos-main', '1104', '2026-04-01', '2026-04-30', 12000000000, 25000000000, 22000000000, 15000000000, 'NGN', 'finalized'),
('TB-2026-04-1201', 'tenant-lagos-main', '1201', '2026-04-01', '2026-04-30', 22000000000, 8000000000, 5000000000, 25000000000, 'NGN', 'finalized'),
('TB-2026-04-1202', 'tenant-lagos-main', '1202', '2026-04-01', '2026-04-30', 18000000000, 0, 0, 18000000000, 'NGN', 'finalized'),
('TB-2026-04-1301', 'tenant-lagos-main', '1301', '2026-04-01', '2026-04-30', 25000000000, 8000000000, 5000000000, 28000000000, 'NGN', 'finalized'),
('TB-2026-04-1302', 'tenant-lagos-main', '1302', '2026-04-01', '2026-04-30', 42000000000, 5000000000, 2000000000, 45000000000, 'NGN', 'finalized'),
('TB-2026-04-1306', 'tenant-lagos-main', '1306', '2026-04-01', '2026-04-30', 10000000000, 3000000000, 1000000000, 12000000000, 'NGN', 'finalized'),
-- Liabilities
('TB-2026-04-2101', 'tenant-lagos-main', '2101', '2026-04-01', '2026-04-30', 80000000000, 15000000000, 20000000000, 85000000000, 'NGN', 'finalized'),
('TB-2026-04-2102', 'tenant-lagos-main', '2102', '2026-04-01', '2026-04-30', 42000000000, 8000000000, 11000000000, 45000000000, 'NGN', 'finalized'),
('TB-2026-04-2103', 'tenant-lagos-main', '2103', '2026-04-01', '2026-04-30', 22000000000, 12000000000, 15000000000, 25000000000, 'NGN', 'finalized'),
-- Equity
('TB-2026-04-3002', 'tenant-lagos-main', '3002', '2026-04-01', '2026-04-30', 25000000000, 0, 0, 25000000000, 'NGN', 'finalized'),
('TB-2026-04-3006', 'tenant-lagos-main', '3006', '2026-04-01', '2026-04-30', 16500000000, 0, 2000000000, 18500000000, 'NGN', 'finalized'),
-- Income
('TB-2026-04-4101', 'tenant-lagos-main', '4101', '2026-04-01', '2026-04-30', 0, 0, 1542000000, 1542000000, 'NGN', 'finalized'),
('TB-2026-04-4201', 'tenant-lagos-main', '4201', '2026-04-01', '2026-04-30', 0, 0, 208000000, 208000000, 'NGN', 'finalized'),
('TB-2026-04-4301', 'tenant-lagos-main', '4301', '2026-04-01', '2026-04-30', 0, 0, 708000000, 708000000, 'NGN', 'finalized'),
-- Expenses
('TB-2026-04-5101', 'tenant-lagos-main', '5101', '2026-04-01', '2026-04-30', 0, 292000000, 0, 292000000, 'NGN', 'finalized'),
('TB-2026-04-5301', 'tenant-lagos-main', '5301', '2026-04-01', '2026-04-30', 0, 1000000000, 0, 1000000000, 'NGN', 'finalized'),
('TB-2026-04-5401', 'tenant-lagos-main', '5401', '2026-04-01', '2026-04-30', 0, 458000000, 0, 458000000, 'NGN', 'finalized')

ON CONFLICT ("trialBalanceId") DO NOTHING;
