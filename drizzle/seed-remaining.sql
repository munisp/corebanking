-- 54Bank: Seed data for remaining empty tables
-- Generated: 2026-05-12T21:45:38.202053
-- Tables: 72 with 8 rows each

-- Table: adverse_media_hits
INSERT INTO "adverse_media_hits" ("entity_name", "source", "headline", "risk_impact", "sentiment", "url", "detected_at", "reviewed_at", "status") VALUES
  ('Adeyemi Adebayo', 'CBN', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'risk_impact-1', 0.6691, 'https://54bank.ng/api/v1/url/1', '2026-04-30 21:45:38', '2025-12-23 21:45:38', 'active'),
  ('Chidinma Okafor', 'NIBSS', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'risk_impact-2', 0.318, 'https://54bank.ng/api/v1/url/2', '2026-03-02 21:45:38', '2026-03-21 21:45:38', 'completed'),
  ('Babajide Williams', 'Interswitch', 'Nigerian banking operation for Babajide Williams in Kano', 'risk_impact-3', 0.7023, 'https://54bank.ng/api/v1/url/3', '2025-08-06 21:45:38', '2026-03-29 21:45:38', 'pending'),
  ('Ngozi Eze', 'Flutterwave', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'risk_impact-4', 0.6255, 'https://54bank.ng/api/v1/url/4', '2026-04-26 21:45:38', '2026-04-27 21:45:38', 'processing'),
  ('Tunde Akinola', 'Paystack', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'risk_impact-5', 0.1834, 'https://54bank.ng/api/v1/url/5', '2026-01-13 21:45:38', '2025-08-27 21:45:38', 'approved'),
  ('Fatima Abdulrahman', 'NFIU', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'risk_impact-6', 0.6358, 'https://54bank.ng/api/v1/url/6', '2025-07-29 21:45:38', '2026-01-31 21:45:38', 'rejected'),
  ('Emeka Nwankwo', 'OFAC', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'risk_impact-7', 0.7373, 'https://54bank.ng/api/v1/url/7', '2025-05-18 21:45:38', '2025-08-06 21:45:38', 'investigating'),
  ('Blessing Okoro', 'WorldCheck', 'Nigerian banking operation for Blessing Okoro in Benin', 'risk_impact-8', 0.4734, 'https://54bank.ng/api/v1/url/8', '2025-09-25 21:45:38', '2025-07-15 21:45:38', 'resolved')
ON CONFLICT DO NOTHING;

-- Table: adverse_media_scans
INSERT INTO "adverse_media_scans" ("customerId", "customerName", "relevantArticles", "sentiment", "riskImpact", "status", "created_at") VALUES
  ('CUST-001', 'Adeyemi Adebayo', 17, 'sentiment-1', 'riskImpact-1', 'active', '2026-05-09 21:45:38'),
  ('CUST-002', 'Chidinma Okafor', 48, 'sentiment-2', 'riskImpact-2', 'completed', '2026-02-20 21:45:38'),
  ('CUST-003', 'Babajide Williams', 44, 'sentiment-3', 'riskImpact-3', 'pending', '2025-10-08 21:45:38'),
  ('CUST-004', 'Ngozi Eze', 21, 'sentiment-4', 'riskImpact-4', 'processing', '2025-12-21 21:45:38'),
  ('CUST-005', 'Tunde Akinola', 9, 'sentiment-5', 'riskImpact-5', 'approved', '2026-01-22 21:45:38'),
  ('CUST-006', 'Fatima Abdulrahman', 48, 'sentiment-6', 'riskImpact-6', 'rejected', '2025-11-21 21:45:38'),
  ('CUST-007', 'Emeka Nwankwo', 6, 'sentiment-7', 'riskImpact-7', 'investigating', '2026-03-26 21:45:38'),
  ('CUST-008', 'Blessing Okoro', 24, 'sentiment-8', 'riskImpact-8', 'resolved', '2026-03-24 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: agriLoans
INSERT INTO "agriLoans" ("loanId", "tenantId", "farmerId", "loanType", "productCode", "principalAmount", "interestRateBps", "tenorMonths", "currency", "purpose", "collateralType", "collateralValue", "cropCycle", "expectedHarvestDate", "disbursementDate", "maturityDate", "outstandingBalance", "totalRepaid", "status", "approvalStatus", "riskGrade", "repaymentSchedule", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'I-001', 'standard', '476417', 42376243.37, 1183, 52, 'NGN', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'standard', 2182087.64, 'wet-season', '2025-09-19 21:45:38', '2025-08-11 21:45:38', '2026-03-10 21:45:38', 48656057.04, 37854.06, 'active', 'approvalStatus-1', 'stand', '{"status": "active", "region": "Nigeria"}', '2025-08-03 21:45:38', '2025-12-13 21:45:38'),
  ('I-002', 'I-002', 'I-002', 'premium', '969693', 31435703.58, 1581, 37, 'NGN', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'premium', 9622506.63, 'dry-season', '2026-04-07 21:45:38', '2026-04-19 21:45:38', '2025-06-08 21:45:38', 11402634.8, 28939.51, 'completed', 'approvalStatus-2', 'premi', '{"status": "active", "region": "Nigeria"}', '2026-04-02 21:45:38', '2026-01-13 21:45:38'),
  ('I-003', 'I-003', 'I-003', 'basic', '205907', 19012509.99, 1957, 41, 'NGN', 'Nigerian banking operation for Babajide Williams in Kano', 'basic', 41707180.23, 'irrigated', '2026-02-18 21:45:38', '2025-11-04 21:45:38', '2025-11-12 21:45:38', 10483256.47, 26698.52, 'pending', 'approvalStatus-3', 'basic', '{"status": "active", "region": "Nigeria"}', '2025-05-28 21:45:38', '2025-06-15 21:45:38'),
  ('I-004', 'I-004', 'I-004', 'enterprise', '174870', 30460458.97, 800, 35, 'NGN', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'enterprise', 36459048.63, 'rainfed', '2026-02-18 21:45:38', '2025-09-18 21:45:38', '2025-10-30 21:45:38', 13504691.86, 92539.19, 'processing', 'approvalStatus-4', 'enter', '{"status": "active", "region": "Nigeria"}', '2025-05-25 21:45:38', '2025-07-31 21:45:38'),
  ('I-005', 'I-005', 'I-005', 'micro', '330283', 34233866.41, 329, 15, 'NGN', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'micro', 41091911.67, 'wet-season', '2025-12-02 21:45:38', '2025-10-19 21:45:38', '2025-12-26 21:45:38', 3318768.37, 91313.7, 'approved', 'approvalStatus-5', 'micro', '{"status": "active", "region": "Nigeria"}', '2025-07-26 21:45:38', '2025-12-02 21:45:38'),
  ('I-006', 'I-006', 'I-006', 'high', '322955', 32775378.88, 1720, 57, 'NGN', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'high', 45728234.01, 'dry-season', '2025-09-20 21:45:38', '2026-02-28 21:45:38', '2025-12-28 21:45:38', 6990119.67, 74499.15, 'rejected', 'approvalStatus-6', 'high', '{"status": "active", "region": "Nigeria"}', '2025-08-10 21:45:38', '2025-12-29 21:45:38'),
  ('I-007', 'I-007', 'I-007', 'medium', '883300', 29233453.65, 2490, 26, 'NGN', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'medium', 18106202.22, 'irrigated', '2026-03-03 21:45:38', '2025-08-25 21:45:38', '2025-09-02 21:45:38', 4554561.51, 4712.59, 'investigating', 'approvalStatus-7', 'mediu', '{"status": "active", "region": "Nigeria"}', '2026-03-17 21:45:38', '2026-02-23 21:45:38'),
  ('I-008', 'I-008', 'I-008', 'low', '757924', 8007500.27, 1829, 39, 'NGN', 'Nigerian banking operation for Blessing Okoro in Benin', 'low', 3185750.03, 'rainfed', '2025-10-29 21:45:38', '2025-07-11 21:45:38', '2025-09-15 21:45:38', 26460426.11, 97107.87, 'resolved', 'approvalStatus-8', 'low', '{"status": "active", "region": "Nigeria"}', '2026-05-07 21:45:38', '2025-05-29 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: aml_cases
INSERT INTO "aml_cases" ("customerId", "customerName", "caseType", "riskLevel", "assignedTo", "sarFiled", "status", "created_at") VALUES
  ('CUST-001', 'Adeyemi Adebayo', 'standard', 'standard', 'assignedTo-1', true, 'active', '2025-05-28 21:45:38'),
  ('CUST-002', 'Chidinma Okafor', 'premium', 'premium', 'assignedTo-2', true, 'completed', '2025-12-27 21:45:38'),
  ('CUST-003', 'Babajide Williams', 'basic', 'basic', 'assignedTo-3', true, 'pending', '2025-11-19 21:45:38'),
  ('CUST-004', 'Ngozi Eze', 'enterprise', 'enterprise', 'assignedTo-4', false, 'processing', '2025-10-02 21:45:38'),
  ('CUST-005', 'Tunde Akinola', 'micro', 'micro', 'assignedTo-5', false, 'approved', '2026-05-11 21:45:38'),
  ('CUST-006', 'Fatima Abdulrahman', 'high', 'high', 'assignedTo-6', true, 'rejected', '2025-12-29 21:45:38'),
  ('CUST-007', 'Emeka Nwankwo', 'medium', 'medium', 'assignedTo-7', true, 'investigating', '2026-02-10 21:45:38'),
  ('CUST-008', 'Blessing Okoro', 'low', 'low', 'assignedTo-8', true, 'resolved', '2026-03-19 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: aml_risk_scores
INSERT INTO "aml_risk_scores" ("customerId", "customerName", "riskScore", "riskLevel", "sanctionsHits", "pepMatch", "adverseMedia", "cddLevel", "status", "created_at") VALUES
  ('CUST-001', 'Adeyemi Adebayo', 81, 'standard', 19, true, 520, 'standard', 'active', '2025-07-05 21:45:38'),
  ('CUST-002', 'Chidinma Okafor', 26, 'premium', 9, false, 166, 'premium', 'completed', '2025-08-09 21:45:38'),
  ('CUST-003', 'Babajide Williams', 100, 'basic', 33, true, 614, 'basic', 'pending', '2025-11-28 21:45:38'),
  ('CUST-004', 'Ngozi Eze', 63, 'enterprise', 1, false, 372, 'enterprise', 'processing', '2025-12-06 21:45:38'),
  ('CUST-005', 'Tunde Akinola', 31, 'micro', 3, false, 581, 'micro', 'approved', '2026-04-02 21:45:38'),
  ('CUST-006', 'Fatima Abdulrahman', 11, 'high', 46, false, 71, 'high', 'rejected', '2025-08-13 21:45:38'),
  ('CUST-007', 'Emeka Nwankwo', 99, 'medium', 8, false, 487, 'medium', 'investigating', '2025-08-04 21:45:38'),
  ('CUST-008', 'Blessing Okoro', 22, 'low', 16, true, 622, 'low', 'resolved', '2025-10-08 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: apisix_plugin_chains
INSERT INTO "apisix_plugin_chains" ("route", "avgLatencyMs", "latencySaving", "status", "created_at") VALUES
  ('/api/v1/customers', 96436.33, '79%', 'active', '2025-05-24 21:45:38'),
  ('/api/v1/accounts', 20115.91, '49%', 'completed', '2025-10-20 21:45:38'),
  ('/api/v1/transactions', 99514.94, '57%', 'pending', '2025-09-30 21:45:38'),
  ('/api/v1/loans', 89961.51, '67%', 'processing', '2026-03-12 21:45:38'),
  ('/api/v1/payments', 24791.31, '18%', 'approved', '2025-11-20 21:45:38'),
  ('/api/v1/transfers', 2104.4, '80%', 'rejected', '2026-01-15 21:45:38'),
  ('/api/v1/cards', 58844.42, '10%', 'investigating', '2026-04-06 21:45:38'),
  ('/api/v1/fx', 70784.39, '17%', 'resolved', '2026-01-15 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: avro_schemas
INSERT INTO "avro_schemas" ("subject", "version", "compatibilityMode", "serializedSizeBytes", "compressionRatio", "status", "created_at") VALUES
  ('Item 1 - Lagos', 1, 'standard', 950425, '14%', 'active', '2025-11-24 21:45:38'),
  ('Item 2 - Abuja', 1, 'premium', 540155, '40%', 'completed', '2025-12-21 21:45:38'),
  ('Item 3 - Kano', 4, 'basic', 225667, '79%', 'pending', '2026-03-06 21:45:38'),
  ('Item 4 - Port Harcourt', 5, 'enterprise', 605225, '70%', 'processing', '2026-01-08 21:45:38'),
  ('Item 5 - Ibadan', 4, 'micro', 847745, '62%', 'approved', '2026-02-04 21:45:38'),
  ('Item 6 - Enugu', 1, 'high', 102663, '65%', 'rejected', '2025-11-12 21:45:38'),
  ('Item 7 - Kaduna', 4, 'medium', 432095, '69%', 'investigating', '2026-04-15 21:45:38'),
  ('Item 8 - Benin', 1, 'low', 64580, '61%', 'resolved', '2025-11-20 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: bankGuarantees
INSERT INTO "bankGuarantees" ("guaranteeId", "tenantId", "guaranteeType", "applicantId", "applicantName", "beneficiaryName", "amount", "currency", "purpose", "effectiveDate", "expiryDate", "claimDeadline", "commissionRate", "commissionAmount", "status", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'standard', 'I-001', 'Adeyemi Adebayo', 'Adeyemi Adebayo', 40031619.62, 'NGN', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', '2026-03-18 21:45:38', '2026-01-05 21:45:38', 'claimDeadline-1', 0.2705, 26818924.84, 'active', '2026-03-02 21:45:38', '2025-10-08 21:45:38'),
  ('I-002', 'I-002', 'premium', 'I-002', 'Chidinma Okafor', 'Chidinma Okafor', 9182566.91, 'NGN', 'Nigerian banking operation for Chidinma Okafor in Abuja', '2025-09-18 21:45:38', '2026-01-05 21:45:38', 'claimDeadline-2', 0.8783, 3778490.57, 'completed', '2025-08-04 21:45:38', '2026-03-23 21:45:38'),
  ('I-003', 'I-003', 'basic', 'I-003', 'Babajide Williams', 'Babajide Williams', 2538910.59, 'NGN', 'Nigerian banking operation for Babajide Williams in Kano', '2025-08-09 21:45:38', '2026-05-05 21:45:38', 'claimDeadline-3', 0.9624, 46319085.48, 'pending', '2026-01-11 21:45:38', '2026-02-16 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'I-004', 'Ngozi Eze', 'Ngozi Eze', 20326638.76, 'NGN', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', '2025-09-08 21:45:38', '2026-01-23 21:45:38', 'claimDeadline-4', 0.8695, 45123118.85, 'processing', '2026-02-17 21:45:38', '2025-10-30 21:45:38'),
  ('I-005', 'I-005', 'micro', 'I-005', 'Tunde Akinola', 'Tunde Akinola', 117747.36, 'NGN', 'Nigerian banking operation for Tunde Akinola in Ibadan', '2025-10-25 21:45:38', '2025-12-28 21:45:38', 'claimDeadline-5', 0.9246, 39258616.55, 'approved', '2025-12-17 21:45:38', '2025-10-08 21:45:38'),
  ('I-006', 'I-006', 'high', 'I-006', 'Fatima Abdulrahman', 'Fatima Abdulrahman', 34832609.26, 'NGN', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', '2025-08-01 21:45:38', '2025-06-08 21:45:38', 'claimDeadline-6', 0.7394, 7748293.3, 'rejected', '2025-12-12 21:45:38', '2026-01-21 21:45:38'),
  ('I-007', 'I-007', 'medium', 'I-007', 'Emeka Nwankwo', 'Emeka Nwankwo', 48435781.15, 'NGN', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', '2025-07-20 21:45:38', '2025-08-08 21:45:38', 'claimDeadline-7', 0.1543, 15687104.44, 'investigating', '2026-04-17 21:45:38', '2025-07-17 21:45:38'),
  ('I-008', 'I-008', 'low', 'I-008', 'Blessing Okoro', 'Blessing Okoro', 23844657.97, 'NGN', 'Nigerian banking operation for Blessing Okoro in Benin', '2025-08-14 21:45:38', '2026-02-21 21:45:38', 'claimDeadline-8', 0.1506, 25396346.56, 'resolved', '2026-02-06 21:45:38', '2026-04-07 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: bloom_filters
INSERT INTO "bloom_filters" ("name", "capacity", "falsePositiveRate", "hashFunctions", "memoryMB", "lookups24h", "status", "created_at") VALUES
  ('Item 1 - Lagos', 624963, 'falsePositiveRate-1', 4, 345.9, 124314, 'active', '2025-10-18 21:45:38'),
  ('Item 2 - Abuja', 126734, 'falsePositiveRate-2', 36, 126.4, 312699, 'completed', '2026-04-22 21:45:38'),
  ('Item 3 - Kano', 650492, 'falsePositiveRate-3', 5, 214.9, 307012, 'pending', '2025-07-27 21:45:38'),
  ('Item 4 - Port Harcourt', 549201, 'falsePositiveRate-4', 20, 478.6, 108090, 'processing', '2025-06-04 21:45:38'),
  ('Item 5 - Ibadan', 752005, 'falsePositiveRate-5', 20, 122.6, 208505, 'approved', '2026-03-06 21:45:38'),
  ('Item 6 - Enugu', 705342, 'falsePositiveRate-6', 41, 153.9, 166767, 'rejected', '2026-04-05 21:45:38'),
  ('Item 7 - Kaduna', 10791, 'falsePositiveRate-7', 29, 318.2, 296170, 'investigating', '2026-03-22 21:45:38'),
  ('Item 8 - Benin', 77843, 'falsePositiveRate-8', 34, 109.5, 140041, 'resolved', '2026-03-06 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: bundle_split_configs
INSERT INTO "bundle_split_configs" ("chunk", "routes", "sizeKB", "loadTimeMs", "preloadHint", "status", "created_at") VALUES
  ('/api/v1/customers', 12, 924677, 573, 'prefetch', 'active', '2026-01-07 21:45:38'),
  ('/api/v1/accounts', 12, 299854, 1302, 'preload', 'completed', '2025-09-30 21:45:38'),
  ('/api/v1/transactions', 18, 738739, 2488, 'preconnect', 'pending', '2025-07-03 21:45:38'),
  ('/api/v1/loans', 17, 9227, 4553, 'dns-prefetch', 'processing', '2025-12-10 21:45:38'),
  ('/api/v1/payments', 4, 985563, 1110, 'prerender', 'approved', '2025-12-28 21:45:38'),
  ('/api/v1/transfers', 4, 933955, 886, 'prefetch', 'rejected', '2025-08-02 21:45:38'),
  ('/api/v1/cards', 5, 286601, 2318, 'preload', 'investigating', '2025-07-07 21:45:38'),
  ('/api/v1/fx', 7, 753494, 2818, 'preconnect', 'resolved', '2026-01-28 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: cardTransactions
INSERT INTO "cardTransactions" ("cardTxnId", "tenantId", "cardId", "accountId", "merchantName", "merchantCategory", "amount", "currency", "type", "channel", "authorizationCode", "stan", "rrn", "status", "declineReason", "createdAt") VALUES
  ('TI-001', 'I-001', 'I-001', 'I-001', 'Shoprite NG', 'standard', 34377981.47, 'NGN', 'standard', 'web', '994343', '376807', '629959', 'active', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', '2025-09-04 21:45:38'),
  ('TI-002', 'I-002', 'I-002', 'I-002', 'Jumia Nigeria', 'premium', 12563551.39, 'NGN', 'premium', 'mobile', '987204', '153266', '196781', 'completed', 'Nigerian banking operation for Chidinma Okafor in Abuja', '2025-06-22 21:45:38'),
  ('TI-003', 'I-003', 'I-003', 'I-003', 'GTBank POS', 'basic', 21184552.87, 'NGN', 'basic', 'ussd', '390120', '146228', '103717', 'pending', 'Nigerian banking operation for Babajide Williams in Kano', '2025-11-23 21:45:38'),
  ('TI-004', 'I-004', 'I-004', 'I-004', 'Total Energies', 'enterpri', 38558249.96, 'NGN', 'enterprise', 'pos', '768061', '374680', '269430', 'processing', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', '2025-09-28 21:45:38'),
  ('TI-005', 'I-005', 'I-005', 'I-005', 'Dangote Cement', 'micro', 27588504.25, 'NGN', 'micro', 'atm', '548462', '688153', '110139', 'approved', 'Nigerian banking operation for Tunde Akinola in Ibadan', '2026-03-16 21:45:38'),
  ('TI-006', 'I-006', 'I-006', 'I-006', 'MTN Nigeria', 'high', 3771440.57, 'NGN', 'high', 'branch', '824586', '256294', '672092', 'rejected', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', '2026-04-24 21:45:38'),
  ('TI-007', 'I-007', 'I-007', 'I-007', 'Uber NG', 'medium', 41731405.04, 'NGN', 'medium', 'api', '710805', '679364', '255287', 'investigating', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', '2025-10-04 21:45:38'),
  ('TI-008', 'I-008', 'I-008', 'I-008', 'Bolt Nigeria', 'low', 6381001.51, 'NGN', 'low', 'agent', '423232', '482364', '934794', 'resolved', 'Nigerian banking operation for Blessing Okoro in Benin', '2026-04-22 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: cdn_edge_configs
INSERT INTO "cdn_edge_configs" ("provider", "origin", "ttlStatic", "ttlApi", "brotliEnabled", "bandwidthSaved24h", "status", "created_at") VALUES
  ('CBN', 'https://54bank.ng/api/v1/origin/1', 46958, 27595, true, '23%', 'active', '2025-11-12 21:45:38'),
  ('NIBSS', 'https://54bank.ng/api/v1/origin/2', 73445, 53324, true, '29%', 'completed', '2026-01-11 21:45:38'),
  ('Interswitch', 'https://54bank.ng/api/v1/origin/3', 21359, 23266, true, '13%', 'pending', '2026-02-10 21:45:38'),
  ('Flutterwave', 'https://54bank.ng/api/v1/origin/4', 43600, 54024, true, '41%', 'processing', '2025-12-27 21:45:38'),
  ('Paystack', 'https://54bank.ng/api/v1/origin/5', 20926, 14228, false, '14%', 'approved', '2025-09-14 21:45:38'),
  ('NFIU', 'https://54bank.ng/api/v1/origin/6', 29214, 26218, true, '68%', 'rejected', '2025-11-14 21:45:38'),
  ('OFAC', 'https://54bank.ng/api/v1/origin/7', 40061, 29891, false, '34%', 'investigating', '2025-10-20 21:45:38'),
  ('WorldCheck', 'https://54bank.ng/api/v1/origin/8', 43085, 36577, true, '45%', 'resolved', '2025-11-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: coalescing_rules
INSERT INTO "coalescing_rules" ("route", "windowMs", "coalescedRequests24h", "uniqueRequests24h", "savingsRatio", "status", "created_at") VALUES
  ('/api/v1/customers', 4183, 210546, 357263, '78%', 'active', '2025-11-24 21:45:38'),
  ('/api/v1/accounts', 236, 61472, 460820, '43%', 'completed', '2026-02-10 21:45:38'),
  ('/api/v1/transactions', 4766, 140180, 21057, '23%', 'pending', '2025-07-11 21:45:38'),
  ('/api/v1/loans', 3569, 182239, 382967, '50%', 'processing', '2025-10-01 21:45:38'),
  ('/api/v1/payments', 4976, 269132, 61631, '59%', 'approved', '2025-07-21 21:45:38'),
  ('/api/v1/transfers', 1567, 134547, 24271, '65%', 'rejected', '2026-05-12 21:45:38'),
  ('/api/v1/cards', 4269, 486267, 423843, '78%', 'investigating', '2025-05-26 21:45:38'),
  ('/api/v1/fx', 1624, 191956, 227124, '18%', 'resolved', '2025-06-06 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: compression_configs
INSERT INTO "compression_configs" ("algorithm", "level", "minBytes", "compressionRatio", "bandwidthSaved24h", "status", "created_at") VALUES
  ('gzip', 6, 654449, '50%', '25%', 'active', '2025-12-10 21:45:38'),
  ('brotli', 9, 325332, '62%', '51%', 'completed', '2025-10-18 21:45:38'),
  ('zstd', 5, 582367, '26%', '34%', 'pending', '2025-10-09 21:45:38'),
  ('lz4', 7, 711243, '32%', '48%', 'processing', '2025-10-17 21:45:38'),
  ('snappy', 9, 875248, '10%', '48%', 'approved', '2025-12-17 21:45:38'),
  ('deflate', 4, 451794, '51%', '69%', 'rejected', '2025-09-28 21:45:38'),
  ('lzma', 8, 709470, '37%', '75%', 'investigating', '2025-09-12 21:45:38'),
  ('gzip', 3, 691879, '20%', '46%', 'resolved', '2025-08-22 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: corporate_monitoring_events
INSERT INTO "corporate_monitoring_events" ("company_id", "event_type", "description", "risk_impact", "source_system", "detected_at", "acknowledged_at") VALUES
  ('_-001', 'standard', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'risk_impact-1', 'CBN', '2025-06-07 21:45:38', '2025-06-22 21:45:38'),
  ('_-002', 'premium', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'risk_impact-2', 'NIBSS', '2025-06-29 21:45:38', '2025-11-22 21:45:38'),
  ('_-003', 'basic', 'Nigerian banking operation for Babajide Williams in Kano', 'risk_impact-3', 'Interswitch', '2026-03-26 21:45:38', '2026-01-12 21:45:38'),
  ('_-004', 'enterprise', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'risk_impact-4', 'Flutterwave', '2025-06-02 21:45:38', '2025-12-05 21:45:38'),
  ('_-005', 'micro', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'risk_impact-5', 'Paystack', '2026-01-17 21:45:38', '2026-01-31 21:45:38'),
  ('_-006', 'high', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'risk_impact-6', 'NFIU', '2026-02-26 21:45:38', '2026-04-30 21:45:38'),
  ('_-007', 'medium', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'risk_impact-7', 'OFAC', '2026-04-19 21:45:38', '2026-01-07 21:45:38'),
  ('_-008', 'low', 'Nigerian banking operation for Blessing Okoro in Benin', 'risk_impact-8', 'WorldCheck', '2025-09-11 21:45:38', '2025-07-04 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: correlation_rules
INSERT INTO "correlation_rules" ("name", "mitre_ids", "kill_chain_phase", "trigger_events", "correlation_window", "triggered_24h", "true_positives", "false_positives", "status", "created_at") VALUES
  ('Item 1 - Lagos', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-1', '{"status": "active", "region": "Nigeria"}', 'correlation_window-1', 871, 787, 75, 'active', '2025-09-21 21:45:38'),
  ('Item 2 - Abuja', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-2', '{"status": "active", "region": "Nigeria"}', 'correlation_window-2', 425, 908, 645, 'completed', '2025-07-22 21:45:38'),
  ('Item 3 - Kano', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-3', '{"status": "active", "region": "Nigeria"}', 'correlation_window-3', 200, 736, 714, 'pending', '2025-10-28 21:45:38'),
  ('Item 4 - Port Harcourt', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-4', '{"status": "active", "region": "Nigeria"}', 'correlation_window-4', 507, 410, 250, 'processing', '2026-02-26 21:45:38'),
  ('Item 5 - Ibadan', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-5', '{"status": "active", "region": "Nigeria"}', 'correlation_window-5', 672, 705, 6, 'approved', '2026-03-19 21:45:38'),
  ('Item 6 - Enugu', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-6', '{"status": "active", "region": "Nigeria"}', 'correlation_window-6', 798, 436, 225, 'rejected', '2026-02-11 21:45:38'),
  ('Item 7 - Kaduna', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-7', '{"status": "active", "region": "Nigeria"}', 'correlation_window-7', 824, 981, 713, 'investigating', '2025-08-20 21:45:38'),
  ('Item 8 - Benin', '{"status": "active", "region": "Nigeria"}', 'kill_chain_phase-8', '{"status": "active", "region": "Nigeria"}', 'correlation_window-8', 476, 52, 571, 'resolved', '2026-01-05 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: cropInsurancePolicies
INSERT INTO "cropInsurancePolicies" ("policyId", "tenantId", "farmerId", "policyType", "cropCovered", "coverageAreaHectares", "sumInsured", "premiumAmount", "premiumFrequency", "policyStart", "policyEnd", "weatherTrigger", "claims", "status", "underwriter", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'I-001', 'standard', 'cropCovered-1', 91747.08, 12136.74, 6675621.89, 'premiumFrequency-1', 'policyStart-1', 'policyEnd-1', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'active', 'underwriter-1', '2025-09-17 21:45:38', '2025-06-05 21:45:38'),
  ('I-002', 'I-002', 'I-002', 'premium', 'cropCovered-2', 53113.66, 55892.97, 15871724.89, 'premiumFrequency-2', 'policyStart-2', 'policyEnd-2', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'completed', 'underwriter-2', '2025-09-28 21:45:38', '2025-07-03 21:45:38'),
  ('I-003', 'I-003', 'I-003', 'basic', 'cropCovered-3', 81500.84, 89202.14, 21342770.44, 'premiumFrequency-3', 'policyStart-3', 'policyEnd-3', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'pending', 'underwriter-3', '2025-08-05 21:45:38', '2025-09-26 21:45:38'),
  ('I-004', 'I-004', 'I-004', 'enterprise', 'cropCovered-4', 89720.91, 74365.8, 23738975.1, 'premiumFrequency-4', 'policyStart-4', 'policyEnd-4', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'processing', 'underwriter-4', '2025-12-31 21:45:38', '2026-01-06 21:45:38'),
  ('I-005', 'I-005', 'I-005', 'micro', 'cropCovered-5', 83986.45, 27731.86, 38885965.02, 'premiumFrequency-5', 'policyStart-5', 'policyEnd-5', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'approved', 'underwriter-5', '2025-09-06 21:45:38', '2025-06-26 21:45:38'),
  ('I-006', 'I-006', 'I-006', 'high', 'cropCovered-6', 23925.35, 43987.82, 35680107.68, 'premiumFrequency-6', 'policyStart-6', 'policyEnd-6', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'rejected', 'underwriter-6', '2026-01-12 21:45:38', '2025-12-24 21:45:38'),
  ('I-007', 'I-007', 'I-007', 'medium', 'cropCovered-7', 33585.42, 89302.79, 4038077.11, 'premiumFrequency-7', 'policyStart-7', 'policyEnd-7', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'investigating', 'underwriter-7', '2026-02-24 21:45:38', '2026-01-14 21:45:38'),
  ('I-008', 'I-008', 'I-008', 'low', 'cropCovered-8', 38304.15, 15281.37, 10705504.33, 'premiumFrequency-8', 'policyStart-8', 'policyEnd-8', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'resolved', 'underwriter-8', '2025-10-12 21:45:38', '2025-10-16 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: customerNotifications
INSERT INTO "customerNotifications" ("notificationId", "customerId", "title", "message", "notificationType", "isRead", "actionUrl", "createdAt") VALUES
  ('I-001', 'CUST-001', 'title-1', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'standard', 339, 'https://54bank.ng/api/v1/actionUrl/1', '2025-08-08 21:45:38'),
  ('I-002', 'CUST-002', 'title-2', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'premium', 478, 'https://54bank.ng/api/v1/actionUrl/2', '2025-10-12 21:45:38'),
  ('I-003', 'CUST-003', 'title-3', 'Nigerian banking operation for Babajide Williams in Kano', 'basic', 64, 'https://54bank.ng/api/v1/actionUrl/3', '2026-01-27 21:45:38'),
  ('I-004', 'CUST-004', 'title-4', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'enterprise', 853, 'https://54bank.ng/api/v1/actionUrl/4', '2025-10-09 21:45:38'),
  ('I-005', 'CUST-005', 'title-5', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'micro', 399, 'https://54bank.ng/api/v1/actionUrl/5', '2025-07-17 21:45:38'),
  ('I-006', 'CUST-006', 'title-6', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'high', 969, 'https://54bank.ng/api/v1/actionUrl/6', '2025-05-21 21:45:38'),
  ('I-007', 'CUST-007', 'title-7', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'medium', 21, 'https://54bank.ng/api/v1/actionUrl/7', '2025-07-22 21:45:38'),
  ('I-008', 'CUST-008', 'title-8', 'Nigerian banking operation for Blessing Okoro in Benin', 'low', 390, 'https://54bank.ng/api/v1/actionUrl/8', '2025-09-10 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: customerStatementExports
INSERT INTO "customerStatementExports" ("exportRequestId", "customerId", "exportJobId", "format", "rowCount", "title", "createdAt") VALUES
  ('RI-001', 'CUST-001', 'JI-001', 'format-1', 0, 'title-1', '2025-11-13 21:45:38'),
  ('RI-002', 'CUST-002', 'JI-002', 'format-2', 19, 'title-2', '2025-10-25 21:45:38'),
  ('RI-003', 'CUST-003', 'JI-003', 'format-3', 26, 'title-3', '2025-08-10 21:45:38'),
  ('RI-004', 'CUST-004', 'JI-004', 'format-4', 47, 'title-4', '2025-08-06 21:45:38'),
  ('RI-005', 'CUST-005', 'JI-005', 'format-5', 38, 'title-5', '2026-01-20 21:45:38'),
  ('RI-006', 'CUST-006', 'JI-006', 'format-6', 31, 'title-6', '2026-01-20 21:45:38'),
  ('RI-007', 'CUST-007', 'JI-007', 'format-7', 17, 'title-7', '2025-10-01 21:45:38'),
  ('RI-008', 'CUST-008', 'JI-008', 'format-8', 31, 'title-8', '2026-04-28 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: customerStatements
INSERT INTO "customerStatements" ("statementId", "customerId", "title", "detail", "amount", "direction", "statementType", "status", "occurredAt", "reference", "category", "createdAt") VALUES
  ('I-001', 'CUST-001', 'title-1', 'detail-1', 19448971.59, 'direction-1', 'standard', 'active', '2025-06-04 21:45:38', 'reference-1', 'standard', '2025-05-30 21:45:38'),
  ('I-002', 'CUST-002', 'title-2', 'detail-2', 39909134.8, 'direction-2', 'premium', 'completed', '2026-02-17 21:45:38', 'reference-2', 'premium', '2025-09-15 21:45:38'),
  ('I-003', 'CUST-003', 'title-3', 'detail-3', 45977885.62, 'direction-3', 'basic', 'pending', '2025-06-28 21:45:38', 'reference-3', 'basic', '2025-08-12 21:45:38'),
  ('I-004', 'CUST-004', 'title-4', 'detail-4', 1358052.93, 'direction-4', 'enterprise', 'processing', '2025-10-23 21:45:38', 'reference-4', 'enterprise', '2025-07-13 21:45:38'),
  ('I-005', 'CUST-005', 'title-5', 'detail-5', 28223955.23, 'direction-5', 'micro', 'approved', '2026-04-29 21:45:38', 'reference-5', 'micro', '2026-03-31 21:45:38'),
  ('I-006', 'CUST-006', 'title-6', 'detail-6', 32141054.9, 'direction-6', 'high', 'rejected', '2026-03-04 21:45:38', 'reference-6', 'high', '2025-09-18 21:45:38'),
  ('I-007', 'CUST-007', 'title-7', 'detail-7', 9094634.04, 'direction-7', 'medium', 'investigating', '2025-12-30 21:45:38', 'reference-7', 'medium', '2025-10-30 21:45:38'),
  ('I-008', 'CUST-008', 'title-8', 'detail-8', 16374359.82, 'direction-8', 'low', 'resolved', '2025-09-22 21:45:38', 'reference-8', 'low', '2025-11-26 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: ddos_rules
INSERT INTO "ddos_rules" ("name", "layer", "threshold", "action", "mitigated_24h", "false_positives", "status", "created_at") VALUES
  ('Item 1 - Lagos', 'layer', 'threshold-1', 'action-1', 346, 780, 'active', '2025-10-30 21:45:38'),
  ('Item 2 - Abuja', 'layer', 'threshold-2', 'action-2', 285, 771, 'completed', '2025-10-09 21:45:38'),
  ('Item 3 - Kano', 'layer', 'threshold-3', 'action-3', 259, 855, 'pending', '2026-04-01 21:45:38'),
  ('Item 4 - Port Harcourt', 'layer', 'threshold-4', 'action-4', 482, 20, 'processing', '2025-08-09 21:45:38'),
  ('Item 5 - Ibadan', 'layer', 'threshold-5', 'action-5', 54, 975, 'approved', '2025-11-14 21:45:38'),
  ('Item 6 - Enugu', 'layer', 'threshold-6', 'action-6', 230, 666, 'rejected', '2026-04-07 21:45:38'),
  ('Item 7 - Kaduna', 'layer', 'threshold-7', 'action-7', 800, 981, 'investigating', '2025-06-13 21:45:38'),
  ('Item 8 - Benin', 'layer', 'threshold-8', 'action-8', 42, 773, 'resolved', '2026-04-27 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: device_profiles
INSERT INTO "device_profiles" ("fingerprint_hash", "user_id", "device_type", "browser", "os", "screen_res", "timezone", "trust_score", "sessions_count", "status", "created_at") VALUES
  ('fingerprint_hash-1', '_-001', 'standard', 'browser-1', 'os-1', 'screen_res-1', 'timezone-1', 32, 12, 'active', '2026-05-02 21:45:38'),
  ('fingerprint_hash-2', '_-002', 'premium', 'browser-2', 'os-2', 'screen_res-2', 'timezone-2', 80, 9, 'completed', '2026-01-10 21:45:38'),
  ('fingerprint_hash-3', '_-003', 'basic', 'browser-3', 'os-3', 'screen_res-3', 'timezone-3', 17, 30, 'pending', '2025-06-04 21:45:38'),
  ('fingerprint_hash-4', '_-004', 'enterprise', 'browser-4', 'os-4', 'screen_res-4', 'timezone-4', 15, 36, 'processing', '2026-01-21 21:45:38'),
  ('fingerprint_hash-5', '_-005', 'micro', 'browser-5', 'os-5', 'screen_res-5', 'timezone-5', 60, 44, 'approved', '2026-01-01 21:45:38'),
  ('fingerprint_hash-6', '_-006', 'high', 'browser-6', 'os-6', 'screen_res-6', 'timezone-6', 99, 23, 'rejected', '2026-02-16 21:45:38'),
  ('fingerprint_hash-7', '_-007', 'medium', 'browser-7', 'os-7', 'screen_res-7', 'timezone-7', 78, 38, 'investigating', '2026-03-15 21:45:38'),
  ('fingerprint_hash-8', '_-008', 'low', 'browser-8', 'os-8', 'screen_res-8', 'timezone-8', 100, 10, 'resolved', '2025-12-04 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: disputeCases
INSERT INTO "disputeCases" ("disputeId", "tenantId", "customerId", "customerName", "category", "description", "transactionId", "transactionAmount", "disputedAmount", "channel", "priority", "status", "slaDeadline", "assignedTo", "resolution", "resolutionAmount", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'CUST-001', 'Adeyemi Adebayo', 'standard', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'I-001', 5413856.5, 1293664.49, 'web', 'priority-1', 'active', '2025-12-04 21:45:38', 'assignedTo-1', 'resolution-1', 28794078.45, '2025-11-01 21:45:38', '2025-10-21 21:45:38'),
  ('I-002', 'I-002', 'CUST-002', 'Chidinma Okafor', 'premium', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'I-002', 47074115.22, 9924505.56, 'mobile', 'priority-2', 'completed', '2025-07-13 21:45:38', 'assignedTo-2', 'resolution-2', 34533814.65, '2025-06-25 21:45:38', '2026-01-08 21:45:38'),
  ('I-003', 'I-003', 'CUST-003', 'Babajide Williams', 'basic', 'Nigerian banking operation for Babajide Williams in Kano', 'I-003', 5104046.26, 38626319.44, 'ussd', 'priority-3', 'pending', '2025-05-27 21:45:38', 'assignedTo-3', 'resolution-3', 30024576.62, '2026-03-12 21:45:38', '2025-07-27 21:45:38'),
  ('I-004', 'I-004', 'CUST-004', 'Ngozi Eze', 'enterprise', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'I-004', 39133940.96, 17366716.23, 'pos', 'priority-4', 'processing', '2025-10-05 21:45:38', 'assignedTo-4', 'resolution-4', 33079451.82, '2026-04-07 21:45:38', '2025-08-26 21:45:38'),
  ('I-005', 'I-005', 'CUST-005', 'Tunde Akinola', 'micro', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'I-005', 32380687.27, 642480.99, 'atm', 'priority-5', 'approved', '2025-10-09 21:45:38', 'assignedTo-5', 'resolution-5', 41118322.6, '2026-03-19 21:45:38', '2025-10-03 21:45:38'),
  ('I-006', 'I-006', 'CUST-006', 'Fatima Abdulrahman', 'high', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'I-006', 48039770.49, 31782899.45, 'branch', 'priority-6', 'rejected', '2025-09-19 21:45:38', 'assignedTo-6', 'resolution-6', 35368359.1, '2025-10-02 21:45:38', '2026-02-11 21:45:38'),
  ('I-007', 'I-007', 'CUST-007', 'Emeka Nwankwo', 'medium', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'I-007', 36692427.25, 48274031.82, 'api', 'priority-7', 'investigating', '2025-12-25 21:45:38', 'assignedTo-7', 'resolution-7', 30799458.58, '2025-08-10 21:45:38', '2025-09-07 21:45:38'),
  ('I-008', 'I-008', 'CUST-008', 'Blessing Okoro', 'low', 'Nigerian banking operation for Blessing Okoro in Benin', 'I-008', 23249039.84, 41288472.58, 'agent', 'priority-8', 'resolved', '2025-07-13 21:45:38', 'assignedTo-8', 'resolution-8', 13427092.95, '2026-01-07 21:45:38', '2026-03-29 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: distroless_images
INSERT INTO "distroless_images" ("service", "baseImage", "imageSizeMB", "previousSizeMB", "reductionPct", "status", "created_at") VALUES
  ('service-1', 'baseImage-1', 143.2, 231.1, 'reductionP', 'active', '2025-09-17 21:45:38'),
  ('service-2', 'baseImage-2', 292.0, 342.3, 'reductionP', 'completed', '2025-11-21 21:45:38'),
  ('service-3', 'baseImage-3', 15.2, 435.8, 'reductionP', 'pending', '2026-02-08 21:45:38'),
  ('service-4', 'baseImage-4', 249.9, 182.0, 'reductionP', 'processing', '2025-12-31 21:45:38'),
  ('service-5', 'baseImage-5', 174.6, 450.8, 'reductionP', 'approved', '2025-05-18 21:45:38'),
  ('service-6', 'baseImage-6', 450.7, 284.8, 'reductionP', 'rejected', '2025-08-21 21:45:38'),
  ('service-7', 'baseImage-7', 485.4, 44.3, 'reductionP', 'investigating', '2025-10-16 21:45:38'),
  ('service-8', 'baseImage-8', 250.4, 388.3, 'reductionP', 'resolved', '2025-05-24 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: docker_hardening_checks
INSERT INTO "docker_hardening_checks" ("check_name", "category", "cis_benchmark", "passing_containers", "failing_containers", "total_containers", "severity", "status", "created_at") VALUES
  ('check_name-1', 'standard', 'cis_benchmark-1', 488, 662, 729, 'severity-1', 'active', '2025-09-03 21:45:38'),
  ('check_name-2', 'premium', 'cis_benchmark-2', 459, 812, 18, 'severity-2', 'completed', '2026-03-26 21:45:38'),
  ('check_name-3', 'basic', 'cis_benchmark-3', 302, 227, 415, 'severity-3', 'pending', '2025-05-23 21:45:38'),
  ('check_name-4', 'enterprise', 'cis_benchmark-4', 250, 314, 680, 'severity-4', 'processing', '2025-07-19 21:45:38'),
  ('check_name-5', 'micro', 'cis_benchmark-5', 378, 485, 567, 'severity-5', 'approved', '2025-08-14 21:45:38'),
  ('check_name-6', 'high', 'cis_benchmark-6', 353, 436, 764, 'severity-6', 'rejected', '2025-08-04 21:45:38'),
  ('check_name-7', 'medium', 'cis_benchmark-7', 339, 361, 720, 'severity-7', 'investigating', '2025-09-22 21:45:38'),
  ('check_name-8', 'low', 'cis_benchmark-8', 278, 314, 258, 'severity-8', 'resolved', '2026-01-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: egress_policies
INSERT INTO "egress_policies" ("name", "domains", "ports", "protocol", "allowed", "requests_24h", "blocked_24h", "status", "created_at") VALUES
  ('Item 1 - Lagos', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-1', false, 101969, 324, 'active', '2026-03-12 21:45:38'),
  ('Item 2 - Abuja', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-2', true, 499533, 781, 'completed', '2025-05-24 21:45:38'),
  ('Item 3 - Kano', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-3', false, 114447, 757, 'pending', '2025-09-07 21:45:38'),
  ('Item 4 - Port Harcourt', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-4', false, 310113, 779, 'processing', '2025-08-17 21:45:38'),
  ('Item 5 - Ibadan', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-5', true, 53704, 853, 'approved', '2026-02-02 21:45:38'),
  ('Item 6 - Enugu', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-6', false, 190205, 184, 'rejected', '2025-12-09 21:45:38'),
  ('Item 7 - Kaduna', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-7', false, 281040, 130, 'investigating', '2025-12-23 21:45:38'),
  ('Item 8 - Benin', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'protocol-8', false, 29587, 567, 'resolved', '2025-12-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: erpnextSyncJobs
INSERT INTO "erpnextSyncJobs" ("jobId", "tenantId", "syncType", "direction", "status", "recordsProcessed", "recordsFailed", "recordsSkipped", "retryCount", "startedAt", "completedAt", "errorMessage", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'standard', 'direction-1', 'active', 715, 967, 130, 40, '2025-09-03 21:45:38', '2026-03-21 21:45:38', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', '2026-05-06 21:45:38', '2025-07-23 21:45:38'),
  ('I-002', 'I-002', 'premium', 'direction-2', 'completed', 292, 481, 491, 28, '2025-11-19 21:45:38', '2026-02-07 21:45:38', 'Nigerian banking operation for Chidinma Okafor in Abuja', '2026-04-16 21:45:38', '2026-01-03 21:45:38'),
  ('I-003', 'I-003', 'basic', 'direction-3', 'pending', 964, 883, 490, 7, '2026-04-09 21:45:38', '2025-10-19 21:45:38', 'Nigerian banking operation for Babajide Williams in Kano', '2025-09-03 21:45:38', '2026-04-05 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'direction-4', 'processing', 591, 645, 703, 3, '2026-02-24 21:45:38', '2026-02-25 21:45:38', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', '2025-07-28 21:45:38', '2025-12-08 21:45:38'),
  ('I-005', 'I-005', 'micro', 'direction-5', 'approved', 88, 255, 122, 35, '2025-10-11 21:45:38', '2025-07-06 21:45:38', 'Nigerian banking operation for Tunde Akinola in Ibadan', '2025-07-11 21:45:38', '2025-06-30 21:45:38'),
  ('I-006', 'I-006', 'high', 'direction-6', 'rejected', 232, 795, 536, 24, '2025-09-24 21:45:38', '2025-09-28 21:45:38', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', '2025-12-11 21:45:38', '2025-07-15 21:45:38'),
  ('I-007', 'I-007', 'medium', 'direction-7', 'investigating', 440, 313, 583, 39, '2026-04-12 21:45:38', '2025-07-04 21:45:38', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', '2026-03-23 21:45:38', '2026-01-26 21:45:38'),
  ('I-008', 'I-008', 'low', 'direction-8', 'resolved', 641, 217, 271, 42, '2026-04-01 21:45:38', '2026-02-21 21:45:38', 'Nigerian banking operation for Blessing Okoro in Benin', '2026-01-10 21:45:38', '2026-02-13 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: esusuGroups
INSERT INTO "esusuGroups" ("groupId", "tenantId", "name", "organiserId", "organiserName", "contributionAmount", "currency", "frequency", "maxMembers", "currentCycle", "totalCycles", "status", "startDate", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'Item 1 - Lagos', 'I-001', 'organiserName-1', 27604092.36, 'NGN', 'frequency-1', 161, 3, 419, 'active', '2025-09-24 21:45:38', '2025-05-25 21:45:38', '2025-07-12 21:45:38'),
  ('I-002', 'I-002', 'Item 2 - Abuja', 'I-002', 'organiserName-2', 23500924.83, 'NGN', 'frequency-2', 34, 238, 296, 'completed', '2025-05-16 21:45:38', '2025-12-19 21:45:38', '2025-05-18 21:45:38'),
  ('I-003', 'I-003', 'Item 3 - Kano', 'I-003', 'organiserName-3', 42981740.5, 'NGN', 'frequency-3', 73, 704, 240, 'pending', '2025-12-28 21:45:38', '2025-06-26 21:45:38', '2025-07-15 21:45:38'),
  ('I-004', 'I-004', 'Item 4 - Port Harcourt', 'I-004', 'organiserName-4', 33062540.31, 'NGN', 'frequency-4', 957, 203, 436, 'processing', '2026-03-15 21:45:38', '2025-08-07 21:45:38', '2026-01-17 21:45:38'),
  ('I-005', 'I-005', 'Item 5 - Ibadan', 'I-005', 'organiserName-5', 32385259.82, 'NGN', 'frequency-5', 931, 273, 847, 'approved', '2026-03-01 21:45:38', '2026-04-06 21:45:38', '2026-04-12 21:45:38'),
  ('I-006', 'I-006', 'Item 6 - Enugu', 'I-006', 'organiserName-6', 8304480.23, 'NGN', 'frequency-6', 315, 610, 767, 'rejected', '2025-07-25 21:45:38', '2025-12-16 21:45:38', '2025-09-30 21:45:38'),
  ('I-007', 'I-007', 'Item 7 - Kaduna', 'I-007', 'organiserName-7', 6226439.37, 'NGN', 'frequency-7', 706, 312, 717, 'investigating', '2025-10-18 21:45:38', '2025-12-24 21:45:38', '2025-08-29 21:45:38'),
  ('I-008', 'I-008', 'Item 8 - Benin', 'I-008', 'organiserName-8', 27003678.31, 'NGN', 'frequency-8', 449, 83, 613, 'resolved', '2026-04-22 21:45:38', '2025-10-03 21:45:38', '2025-11-28 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: farmers
INSERT INTO "farmers" ("farmerId", "tenantId", "name", "bvn", "phone", "region", "localGovernment", "farmSizeHectares", "primaryCrop", "secondaryCrops", "cooperativeId", "cooperativeName", "bankAccountNumber", "riskScore", "riskTier", "status", "geoCoordinates", "registrationChannel", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'Item 1 - Lagos', 'bvn-1', 'phone-1', 'region-1', 'localGovernment-1', 60371.76, 'primaryCrop-1', '{"status": "active", "region": "Nigeria"}', 'I-001', 'cooperativeName-1', 'bankAccountNumber-1', 2587.46, 'riskTier-1', 'active', '{"status": "active", "region": "Nigeria"}', 'web', '2026-01-15 21:45:38', '2025-06-01 21:45:38'),
  ('I-002', 'I-002', 'Item 2 - Abuja', 'bvn-2', 'phone-2', 'region-2', 'localGovernment-2', 83596.03, 'primaryCrop-2', '{"status": "active", "region": "Nigeria"}', 'I-002', 'cooperativeName-2', 'bankAccountNumber-2', 57520.34, 'riskTier-2', 'completed', '{"status": "active", "region": "Nigeria"}', 'mobile', '2026-05-02 21:45:38', '2025-06-02 21:45:38'),
  ('I-003', 'I-003', 'Item 3 - Kano', 'bvn-3', 'phone-3', 'region-3', 'localGovernment-3', 82142.3, 'primaryCrop-3', '{"status": "active", "region": "Nigeria"}', 'I-003', 'cooperativeName-3', 'bankAccountNumber-3', 57625.12, 'riskTier-3', 'pending', '{"status": "active", "region": "Nigeria"}', 'ussd', '2026-02-12 21:45:38', '2025-09-14 21:45:38'),
  ('I-004', 'I-004', 'Item 4 - Port Harcourt', 'bvn-4', 'phone-4', 'region-4', 'localGovernment-4', 51896.87, 'primaryCrop-4', '{"status": "active", "region": "Nigeria"}', 'I-004', 'cooperativeName-4', 'bankAccountNumber-4', 44223.5, 'riskTier-4', 'processing', '{"status": "active", "region": "Nigeria"}', 'pos', '2025-12-21 21:45:38', '2026-02-09 21:45:38'),
  ('I-005', 'I-005', 'Item 5 - Ibadan', 'bvn-5', 'phone-5', 'region-5', 'localGovernment-5', 99694.55, 'primaryCrop-5', '{"status": "active", "region": "Nigeria"}', 'I-005', 'cooperativeName-5', 'bankAccountNumber-5', 43589.06, 'riskTier-5', 'approved', '{"status": "active", "region": "Nigeria"}', 'atm', '2025-09-03 21:45:38', '2026-03-27 21:45:38'),
  ('I-006', 'I-006', 'Item 6 - Enugu', 'bvn-6', 'phone-6', 'region-6', 'localGovernment-6', 47001.57, 'primaryCrop-6', '{"status": "active", "region": "Nigeria"}', 'I-006', 'cooperativeName-6', 'bankAccountNumber-6', 40835.4, 'riskTier-6', 'rejected', '{"status": "active", "region": "Nigeria"}', 'branch', '2025-11-29 21:45:38', '2025-06-03 21:45:38'),
  ('I-007', 'I-007', 'Item 7 - Kaduna', 'bvn-7', 'phone-7', 'region-7', 'localGovernment-7', 10460.88, 'primaryCrop-7', '{"status": "active", "region": "Nigeria"}', 'I-007', 'cooperativeName-7', 'bankAccountNumber-7', 16083.32, 'riskTier-7', 'investigating', '{"status": "active", "region": "Nigeria"}', 'api', '2025-10-14 21:45:38', '2025-05-22 21:45:38'),
  ('I-008', 'I-008', 'Item 8 - Benin', 'bvn-8', 'phone-8', 'region-8', 'localGovernment-8', 49547.41, 'primaryCrop-8', '{"status": "active", "region": "Nigeria"}', 'I-008', 'cooperativeName-8', 'bankAccountNumber-8', 66258.69, 'riskTier-8', 'resolved', '{"status": "active", "region": "Nigeria"}', 'agent', '2025-10-19 21:45:38', '2025-08-04 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: fast_json_schemas
INSERT INTO "fast_json_schemas" ("schemaName", "compiledSizeBytes", "serializationsPerSec", "avgSerializeNs", "speedup", "status", "created_at") VALUES
  ('schemaName-1', 39503, 466, 91, 'speedup-1', 'active', '2025-12-02 21:45:38'),
  ('schemaName-2', 265683, 332, 119, 'speedup-2', 'completed', '2025-10-18 21:45:38'),
  ('schemaName-3', 907948, 527, 845, 'speedup-3', 'pending', '2026-05-12 21:45:38'),
  ('schemaName-4', 690630, 891, 556, 'speedup-4', 'processing', '2025-09-18 21:45:38'),
  ('schemaName-5', 434345, 56, 193, 'speedup-5', 'approved', '2025-08-20 21:45:38'),
  ('schemaName-6', 380377, 638, 775, 'speedup-6', 'rejected', '2025-08-30 21:45:38'),
  ('schemaName-7', 656812, 453, 779, 'speedup-7', 'investigating', '2026-04-16 21:45:38'),
  ('schemaName-8', 214470, 274, 563, 'speedup-8', 'resolved', '2026-03-06 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: frame_policies
INSERT INTO "frame_policies" ("domain", "frame_ancestors", "x_frame_options", "frame_detection", "violations_24h", "unique_framers", "status", "created_at") VALUES
  ('domain-1', 'frame_ancestors-1', 'x_frame_options-1', 'frame_detection-1', 950, 295, 'active', '2025-09-30 21:45:38'),
  ('domain-2', 'frame_ancestors-2', 'x_frame_options-2', 'frame_detection-2', 902, 716, 'completed', '2025-09-06 21:45:38'),
  ('domain-3', 'frame_ancestors-3', 'x_frame_options-3', 'frame_detection-3', 125, 30, 'pending', '2025-06-24 21:45:38'),
  ('domain-4', 'frame_ancestors-4', 'x_frame_options-4', 'frame_detection-4', 624, 819, 'processing', '2026-01-10 21:45:38'),
  ('domain-5', 'frame_ancestors-5', 'x_frame_options-5', 'frame_detection-5', 727, 163, 'approved', '2025-12-04 21:45:38'),
  ('domain-6', 'frame_ancestors-6', 'x_frame_options-6', 'frame_detection-6', 565, 15, 'rejected', '2025-08-03 21:45:38'),
  ('domain-7', 'frame_ancestors-7', 'x_frame_options-7', 'frame_detection-7', 418, 96, 'investigating', '2026-01-17 21:45:38'),
  ('domain-8', 'frame_ancestors-8', 'x_frame_options-8', 'frame_detection-8', 862, 935, 'resolved', '2026-03-15 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: grpc_services
INSERT INTO "grpc_services" ("service", "proto", "avgLatencyMs", "throughputRps", "compressionRatio", "status", "created_at") VALUES
  ('service-1', 'proto-1', 46145.33, 121, '29%', 'active', '2025-08-30 21:45:38'),
  ('service-2', 'proto-2', 93265.37, 299, '75%', 'completed', '2025-05-16 21:45:38'),
  ('service-3', 'proto-3', 27343.22, 855, '71%', 'pending', '2025-09-13 21:45:38'),
  ('service-4', 'proto-4', 24373.85, 565, '28%', 'processing', '2025-10-28 21:45:38'),
  ('service-5', 'proto-5', 19061.85, 614, '75%', 'approved', '2026-03-04 21:45:38'),
  ('service-6', 'proto-6', 86402.83, 283, '63%', 'rejected', '2025-11-19 21:45:38'),
  ('service-7', 'proto-7', 93424.91, 520, '44%', 'investigating', '2026-05-11 21:45:38'),
  ('service-8', 'proto-8', 28284.62, 306, '72%', 'resolved', '2026-02-25 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: hot_data_caches
INSERT INTO "hot_data_caches" ("service", "cacheType", "maxEntries", "currentEntries", "hitRate", "memoryMB", "status", "created_at") VALUES
  ('service-1', 'standard', 458, 552, 'hitRate-1', 248.2, 'active', '2025-11-23 21:45:38'),
  ('service-2', 'premium', 566, 782, 'hitRate-2', 278.5, 'completed', '2025-09-21 21:45:38'),
  ('service-3', 'basic', 956, 330, 'hitRate-3', 445.3, 'pending', '2025-05-20 21:45:38'),
  ('service-4', 'enterprise', 245, 586, 'hitRate-4', 196.4, 'processing', '2025-10-14 21:45:38'),
  ('service-5', 'micro', 45, 326, 'hitRate-5', 381.4, 'approved', '2025-05-16 21:45:38'),
  ('service-6', 'high', 936, 831, 'hitRate-6', 195.5, 'rejected', '2025-06-07 21:45:38'),
  ('service-7', 'medium', 812, 841, 'hitRate-7', 334.0, 'investigating', '2026-02-24 21:45:38'),
  ('service-8', 'low', 508, 988, 'hitRate-8', 19.4, 'resolved', '2025-08-28 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: http2_connections
INSERT INTO "http2_connections" ("clientIp", "streams", "maxConcurrentStreams", "windowSize", "serverPushEnabled", "status", "created_at") VALUES
  ('clientIp-1', 4844, 2729, 'windowSize-1', true, 'active', '2025-09-29 21:45:38'),
  ('clientIp-2', 826, 4318, 'windowSize-2', true, 'completed', '2026-05-05 21:45:38'),
  ('clientIp-3', 1190, 3368, 'windowSize-3', true, 'pending', '2026-02-22 21:45:38'),
  ('clientIp-4', 622, 3856, 'windowSize-4', true, 'processing', '2025-12-28 21:45:38'),
  ('clientIp-5', 2783, 3266, 'windowSize-5', true, 'approved', '2025-11-25 21:45:38'),
  ('clientIp-6', 4381, 3123, 'windowSize-6', true, 'rejected', '2025-06-26 21:45:38'),
  ('clientIp-7', 4007, 4442, 'windowSize-7', false, 'investigating', '2026-04-07 21:45:38'),
  ('clientIp-8', 1933, 2364, 'windowSize-8', true, 'resolved', '2026-03-27 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: ijaraContracts
INSERT INTO "ijaraContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "assetValue", "rentalAmount", "rentalFrequency", "currency", "leaseStart", "leaseEnd", "tenorMonths", "residualValue", "purchaseOption", "purchasePrice", "totalRentPaid", "status", "shariaCompliance", "maintenanceResponsibility", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'CUST-001', 'Adeyemi Adebayo', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'standard', 21704233.88, 4931171.89, 'rentalFrequency-1', 'NGN', 'leaseStart-1', 'leaseEnd-1', 41, 35197502.56, 103, 44368.41, 69400.42, 'active', 'shariaCompliance-1', 'maintenanceResponsib', '2026-04-28 21:45:38', '2026-04-19 21:45:38'),
  ('I-002', 'I-002', 'CUST-002', 'Chidinma Okafor', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'premium', 16225489.59, 2815400.21, 'rentalFrequency-2', 'NGN', 'leaseStart-2', 'leaseEnd-2', 23, 18748306.08, 150, 24420.5, 41205.76, 'completed', 'shariaCompliance-2', 'maintenanceResponsib', '2025-05-28 21:45:38', '2026-02-09 21:45:38'),
  ('I-003', 'I-003', 'CUST-003', 'Babajide Williams', 'Nigerian banking operation for Babajide Williams in Kano', 'basic', 8507482.62, 3957627.85, 'rentalFrequency-3', 'NGN', 'leaseStart-3', 'leaseEnd-3', 56, 19133389.49, 700, 24083.74, 91282.99, 'pending', 'shariaCompliance-3', 'maintenanceResponsib', '2026-02-28 21:45:38', '2026-01-14 21:45:38'),
  ('I-004', 'I-004', 'CUST-004', 'Ngozi Eze', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'enterprise', 23062884.17, 12706327.2, 'rentalFrequency-4', 'NGN', 'leaseStart-4', 'leaseEnd-4', 17, 33345367.46, 921, 80463.5, 90121.04, 'processing', 'shariaCompliance-4', 'maintenanceResponsib', '2025-05-31 21:45:38', '2025-08-06 21:45:38'),
  ('I-005', 'I-005', 'CUST-005', 'Tunde Akinola', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'micro', 7907201.35, 22092071.88, 'rentalFrequency-5', 'NGN', 'leaseStart-5', 'leaseEnd-5', 23, 49382708.24, 307, 63894.23, 42431.47, 'approved', 'shariaCompliance-5', 'maintenanceResponsib', '2026-01-04 21:45:38', '2025-09-21 21:45:38'),
  ('I-006', 'I-006', 'CUST-006', 'Fatima Abdulrahman', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'high', 42266743.22, 9968857.79, 'rentalFrequency-6', 'NGN', 'leaseStart-6', 'leaseEnd-6', 25, 42668239.58, 110, 23721.33, 57192.7, 'rejected', 'shariaCompliance-6', 'maintenanceResponsib', '2025-07-22 21:45:38', '2025-12-12 21:45:38'),
  ('I-007', 'I-007', 'CUST-007', 'Emeka Nwankwo', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'medium', 49634675.26, 14768585.39, 'rentalFrequency-7', 'NGN', 'leaseStart-7', 'leaseEnd-7', 54, 32914908.5, 282, 810.79, 86506.87, 'investigating', 'shariaCompliance-7', 'maintenanceResponsib', '2026-04-17 21:45:38', '2025-07-06 21:45:38'),
  ('I-008', 'I-008', 'CUST-008', 'Blessing Okoro', 'Nigerian banking operation for Blessing Okoro in Benin', 'low', 37261155.99, 41643616.59, 'rentalFrequency-8', 'NGN', 'leaseStart-8', 'leaseEnd-8', 58, 14316845.63, 819, 23012.61, 80193.39, 'resolved', 'shariaCompliance-8', 'maintenanceResponsib', '2026-01-20 21:45:38', '2025-06-21 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: ip_rules
INSERT INTO "ip_rules" ("name", "cidr", "rule_type", "applies_to", "hits_24h", "blocked_24h", "geo_country", "status", "created_at") VALUES
  ('Item 1 - Lagos', 'cidr-1', 'standard', 'applies_to-1', 12, 636, 'geo_countr', 'active', '2026-01-04 21:45:38'),
  ('Item 2 - Abuja', 'cidr-2', 'premium', 'applies_to-2', 43, 774, 'geo_countr', 'completed', '2025-06-09 21:45:38'),
  ('Item 3 - Kano', 'cidr-3', 'basic', 'applies_to-3', 43, 859, 'geo_countr', 'pending', '2026-03-03 21:45:38'),
  ('Item 4 - Port Harcourt', 'cidr-4', 'enterprise', 'applies_to-4', 40, 100, 'geo_countr', 'processing', '2025-06-25 21:45:38'),
  ('Item 5 - Ibadan', 'cidr-5', 'micro', 'applies_to-5', 41, 41, 'geo_countr', 'approved', '2025-12-05 21:45:38'),
  ('Item 6 - Enugu', 'cidr-6', 'high', 'applies_to-6', 50, 452, 'geo_countr', 'rejected', '2026-04-25 21:45:38'),
  ('Item 7 - Kaduna', 'cidr-7', 'medium', 'applies_to-7', 37, 374, 'geo_countr', 'investigating', '2026-03-06 21:45:38'),
  ('Item 8 - Benin', 'cidr-8', 'low', 'applies_to-8', 5, 932, 'geo_countr', 'resolved', '2025-12-12 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: jwt_validations
INSERT INTO "jwt_validations" ("token_type", "issuer", "audience", "algorithm", "validations_24h", "rejections_24h", "avg_latency_ms", "cache_hit_rate", "status", "created_at") VALUES
  ('standard', 'issuer-1', 'audience-1', 'gzip', 335, 766, 41550.89, 0.2787, 'active', '2025-08-09 21:45:38'),
  ('premium', 'issuer-2', 'audience-2', 'brotli', 898, 995, 36586.39, 0.5466, 'completed', '2025-12-24 21:45:38'),
  ('basic', 'issuer-3', 'audience-3', 'zstd', 851, 169, 25697.75, 0.834, 'pending', '2025-09-08 21:45:38'),
  ('enterprise', 'issuer-4', 'audience-4', 'lz4', 991, 826, 29514.85, 0.8747, 'processing', '2026-03-15 21:45:38'),
  ('micro', 'issuer-5', 'audience-5', 'snappy', 480, 987, 7530.86, 0.7712, 'approved', '2026-01-17 21:45:38'),
  ('high', 'issuer-6', 'audience-6', 'deflate', 881, 693, 72421.95, 0.9721, 'rejected', '2025-07-31 21:45:38'),
  ('medium', 'issuer-7', 'audience-7', 'lzma', 375, 93, 79068.41, 0.1124, 'investigating', '2025-08-11 21:45:38'),
  ('low', 'issuer-8', 'audience-8', 'gzip', 127, 466, 36859.2, 0.7666, 'resolved', '2025-12-29 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: keepalive_configs
INSERT INTO "keepalive_configs" ("service", "keepAliveTimeout", "maxIdlePerHost", "activeConnections", "reuseRate", "status", "created_at") VALUES
  ('service-1', 4798, 391, 843, 'reuseRate-1', 'active', '2025-06-20 21:45:38'),
  ('service-2', 3053, 111, 692, 'reuseRate-2', 'completed', '2026-01-13 21:45:38'),
  ('service-3', 3872, 26, 635, 'reuseRate-3', 'pending', '2025-07-29 21:45:38'),
  ('service-4', 2697, 938, 625, 'reuseRate-4', 'processing', '2026-01-19 21:45:38'),
  ('service-5', 527, 651, 844, 'reuseRate-5', 'approved', '2025-09-17 21:45:38'),
  ('service-6', 2485, 665, 419, 'reuseRate-6', 'rejected', '2026-03-14 21:45:38'),
  ('service-7', 1155, 47, 969, 'reuseRate-7', 'investigating', '2026-04-23 21:45:38'),
  ('service-8', 2503, 505, 119, 'reuseRate-8', 'resolved', '2026-03-24 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: key_rotation_schedules
INSERT INTO "key_rotation_schedules" ("key_id", "algorithm", "rotation_interval", "grace_period", "active_version", "previous_version", "next_rotation", "rotations_completed", "failed_rotations", "status", "created_at") VALUES
  ('_-001', 'gzip', 'rotation_interval-1', 'grace_period-1', 2, 5, '2026-03-04 21:45:38', 398, 465, 'active', '2025-11-04 21:45:38'),
  ('_-002', 'brotli', 'rotation_interval-2', 'grace_period-2', 5, 4, '2025-07-16 21:45:38', 761, 745, 'completed', '2026-02-22 21:45:38'),
  ('_-003', 'zstd', 'rotation_interval-3', 'grace_period-3', 4, 1, '2025-09-04 21:45:38', 631, 418, 'pending', '2025-12-20 21:45:38'),
  ('_-004', 'lz4', 'rotation_interval-4', 'grace_period-4', 1, 3, '2026-01-21 21:45:38', 455, 456, 'processing', '2026-01-12 21:45:38'),
  ('_-005', 'snappy', 'rotation_interval-5', 'grace_period-5', 3, 1, '2025-05-26 21:45:38', 377, 558, 'approved', '2025-06-16 21:45:38'),
  ('_-006', 'deflate', 'rotation_interval-6', 'grace_period-6', 3, 1, '2025-10-21 21:45:38', 283, 195, 'rejected', '2026-03-11 21:45:38'),
  ('_-007', 'lzma', 'rotation_interval-7', 'grace_period-7', 4, 1, '2025-06-07 21:45:38', 218, 658, 'investigating', '2025-06-19 21:45:38'),
  ('_-008', 'gzip', 'rotation_interval-8', 'grace_period-8', 5, 1, '2026-04-17 21:45:38', 806, 342, 'resolved', '2026-01-08 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: kms_keys
INSERT INTO "kms_keys" ("provider", "key_id", "algorithm", "usage", "state", "rotation_enabled", "encryption_ops_24h", "status", "created_at") VALUES
  ('CBN', '_-001', 'gzip', 'usage-1', 'state-1', true, 806, 'active', '2025-07-27 21:45:38'),
  ('NIBSS', '_-002', 'brotli', 'usage-2', 'state-2', false, 850, 'completed', '2025-08-02 21:45:38'),
  ('Interswitch', '_-003', 'zstd', 'usage-3', 'state-3', false, 222, 'pending', '2026-01-13 21:45:38'),
  ('Flutterwave', '_-004', 'lz4', 'usage-4', 'state-4', false, 152, 'processing', '2025-07-11 21:45:38'),
  ('Paystack', '_-005', 'snappy', 'usage-5', 'state-5', false, 880, 'approved', '2026-02-27 21:45:38'),
  ('NFIU', '_-006', 'deflate', 'usage-6', 'state-6', true, 554, 'rejected', '2026-01-04 21:45:38'),
  ('OFAC', '_-007', 'lzma', 'usage-7', 'state-7', true, 113, 'investigating', '2025-06-08 21:45:38'),
  ('WorldCheck', '_-008', 'gzip', 'usage-8', 'state-8', true, 135, 'resolved', '2026-05-05 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: lettersOfCredit
INSERT INTO "lettersOfCredit" ("lcId", "tenantId", "lcType", "applicantId", "applicantName", "beneficiaryName", "beneficiaryBank", "beneficiaryCountry", "issuingBank", "advisingBank", "amount", "currency", "commodity", "incoterm", "portOfLoading", "portOfDischarge", "latestShipDate", "expiryDate", "documentsRequired", "amendments", "status", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'standard', 'I-001', 'Adeyemi Adebayo', 'Adeyemi Adebayo', 'beneficiaryBank-1', 'beneficiaryCountry-1', 'issuingBank-1', 'advisingBank-1', 17918531.54, 'NGN', 'commodity-1', 'incoterm-1', 'portOfLoading-1', 'portOfDischarge-1', '2026-01-11 21:45:38', '2025-07-15 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'active', '2025-11-28 21:45:38', '2026-05-04 21:45:38'),
  ('I-002', 'I-002', 'premium', 'I-002', 'Chidinma Okafor', 'Chidinma Okafor', 'beneficiaryBank-2', 'beneficiaryCountry-2', 'issuingBank-2', 'advisingBank-2', 8720567.61, 'NGN', 'commodity-2', 'incoterm-2', 'portOfLoading-2', 'portOfDischarge-2', '2026-04-16 21:45:38', '2026-03-09 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'completed', '2025-10-09 21:45:38', '2025-08-16 21:45:38'),
  ('I-003', 'I-003', 'basic', 'I-003', 'Babajide Williams', 'Babajide Williams', 'beneficiaryBank-3', 'beneficiaryCountry-3', 'issuingBank-3', 'advisingBank-3', 5691328.85, 'NGN', 'commodity-3', 'incoterm-3', 'portOfLoading-3', 'portOfDischarge-3', '2026-04-10 21:45:38', '2025-09-11 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'pending', '2025-09-25 21:45:38', '2025-11-08 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'I-004', 'Ngozi Eze', 'Ngozi Eze', 'beneficiaryBank-4', 'beneficiaryCountry-4', 'issuingBank-4', 'advisingBank-4', 25666765.5, 'NGN', 'commodity-4', 'incoterm-4', 'portOfLoading-4', 'portOfDischarge-4', '2026-03-18 21:45:38', '2025-09-23 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'processing', '2025-08-28 21:45:38', '2026-01-19 21:45:38'),
  ('I-005', 'I-005', 'micro', 'I-005', 'Tunde Akinola', 'Tunde Akinola', 'beneficiaryBank-5', 'beneficiaryCountry-5', 'issuingBank-5', 'advisingBank-5', 47271327.99, 'NGN', 'commodity-5', 'incoterm-5', 'portOfLoading-5', 'portOfDischarge-5', '2026-04-20 21:45:38', '2025-06-09 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'approved', '2025-08-19 21:45:38', '2025-12-09 21:45:38'),
  ('I-006', 'I-006', 'high', 'I-006', 'Fatima Abdulrahman', 'Fatima Abdulrahman', 'beneficiaryBank-6', 'beneficiaryCountry-6', 'issuingBank-6', 'advisingBank-6', 22907545.68, 'NGN', 'commodity-6', 'incoterm-6', 'portOfLoading-6', 'portOfDischarge-6', '2026-04-27 21:45:38', '2026-04-11 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'rejected', '2025-09-09 21:45:38', '2025-10-19 21:45:38'),
  ('I-007', 'I-007', 'medium', 'I-007', 'Emeka Nwankwo', 'Emeka Nwankwo', 'beneficiaryBank-7', 'beneficiaryCountry-7', 'issuingBank-7', 'advisingBank-7', 21319418.23, 'NGN', 'commodity-7', 'incoterm-7', 'portOfLoading-7', 'portOfDischarge-7', '2026-03-18 21:45:38', '2025-09-03 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'investigating', '2025-05-13 21:45:38', '2025-09-27 21:45:38'),
  ('I-008', 'I-008', 'low', 'I-008', 'Blessing Okoro', 'Blessing Okoro', 'beneficiaryBank-8', 'beneficiaryCountry-8', 'issuingBank-8', 'advisingBank-8', 3683800.88, 'NGN', 'commodity-8', 'incoterm-8', 'portOfLoading-8', 'portOfDischarge-8', '2026-04-01 21:45:38', '2025-11-29 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 'resolved', '2025-07-05 21:45:38', '2026-02-26 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: memoization_targets
INSERT INTO "memoization_targets" ("component", "rerendersPer60s", "estimatedSavingPct", "recommendation", "status", "created_at") VALUES
  ('component-1', 68, '26%', 'recommendation-1', 'active', '2025-12-23 21:45:38'),
  ('component-2', 640, '80%', 'recommendation-2', 'completed', '2025-05-13 21:45:38'),
  ('component-3', 333, '58%', 'recommendation-3', 'pending', '2025-07-11 21:45:38'),
  ('component-4', 544, '47%', 'recommendation-4', 'processing', '2025-09-22 21:45:38'),
  ('component-5', 518, '65%', 'recommendation-5', 'approved', '2026-03-23 21:45:38'),
  ('component-6', 813, '24%', 'recommendation-6', 'rejected', '2025-06-11 21:45:38'),
  ('component-7', 667, '80%', 'recommendation-7', 'investigating', '2026-01-22 21:45:38'),
  ('component-8', 441, '67%', 'recommendation-8', 'resolved', '2026-01-16 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: mudarabahContracts
INSERT INTO "mudarabahContracts" ("contractId", "tenantId", "investorId", "investorName", "fundManagerId", "investmentPurpose", "capitalAmount", "currency", "profitSharingRatioInvestor", "profitSharingRatioManager", "investmentPeriodMonths", "startDate", "maturityDate", "realizedProfit", "realizedLoss", "distributions", "status", "shariaCompliance", "riskCategory", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'I-001', 'investorName-1', 'MI-001', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 20696540.42, 'NGN', 0.8364, 0.4549, 47, '2026-03-25 21:45:38', '2025-12-03 21:45:38', 42676.97, 66511.12, '{"status": "active", "region": "Nigeria"}', 'active', 'shariaCompliance-1', 'standard', '2025-11-02 21:45:38', '2026-02-23 21:45:38'),
  ('I-002', 'I-002', 'I-002', 'investorName-2', 'MI-002', 'Nigerian banking operation for Chidinma Okafor in Abuja', 34344183.56, 'NGN', 0.5221, 0.1812, 6, '2026-03-26 21:45:38', '2025-10-03 21:45:38', 9657.35, 73879.86, '{"status": "active", "region": "Nigeria"}', 'completed', 'shariaCompliance-2', 'premium', '2026-03-07 21:45:38', '2025-08-01 21:45:38'),
  ('I-003', 'I-003', 'I-003', 'investorName-3', 'MI-003', 'Nigerian banking operation for Babajide Williams in Kano', 3008449.09, 'NGN', 0.9514, 0.5999, 43, '2026-03-11 21:45:38', '2025-10-14 21:45:38', 35360.45, 66534.39, '{"status": "active", "region": "Nigeria"}', 'pending', 'shariaCompliance-3', 'basic', '2025-10-08 21:45:38', '2026-04-16 21:45:38'),
  ('I-004', 'I-004', 'I-004', 'investorName-4', 'MI-004', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 48420247.28, 'NGN', 0.6344, 0.413, 37, '2025-08-26 21:45:38', '2026-01-24 21:45:38', 15473.86, 48219.46, '{"status": "active", "region": "Nigeria"}', 'processing', 'shariaCompliance-4', 'enterprise', '2026-03-18 21:45:38', '2025-11-14 21:45:38'),
  ('I-005', 'I-005', 'I-005', 'investorName-5', 'MI-005', 'Nigerian banking operation for Tunde Akinola in Ibadan', 42270217.2, 'NGN', 0.4271, 0.7787, 37, '2026-01-17 21:45:38', '2025-10-05 21:45:38', 84515.67, 97454.69, '{"status": "active", "region": "Nigeria"}', 'approved', 'shariaCompliance-5', 'micro', '2025-06-28 21:45:38', '2025-07-02 21:45:38'),
  ('I-006', 'I-006', 'I-006', 'investorName-6', 'MI-006', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 33752085.8, 'NGN', 0.5955, 0.642, 43, '2025-05-22 21:45:38', '2025-12-27 21:45:38', 2896.29, 27327.77, '{"status": "active", "region": "Nigeria"}', 'rejected', 'shariaCompliance-6', 'high', '2025-12-05 21:45:38', '2025-11-20 21:45:38'),
  ('I-007', 'I-007', 'I-007', 'investorName-7', 'MI-007', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 17557660.8, 'NGN', 0.2615, 0.2275, 43, '2025-10-19 21:45:38', '2026-04-07 21:45:38', 14188.32, 63317.57, '{"status": "active", "region": "Nigeria"}', 'investigating', 'shariaCompliance-7', 'medium', '2026-04-27 21:45:38', '2026-03-27 21:45:38'),
  ('I-008', 'I-008', 'I-008', 'investorName-8', 'MI-008', 'Nigerian banking operation for Blessing Okoro in Benin', 37308126.98, 'NGN', 0.2915, 0.4737, 22, '2026-02-21 21:45:38', '2025-11-04 21:45:38', 31164.43, 32438.96, '{"status": "active", "region": "Nigeria"}', 'resolved', 'shariaCompliance-8', 'low', '2025-07-26 21:45:38', '2025-07-11 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: murabahaContracts
INSERT INTO "murabahaContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "costPrice", "profitMarginPct", "sellingPrice", "currency", "tenorMonths", "instalmentAmount", "totalPaid", "outstandingBalance", "disbursementDate", "maturityDate", "status", "shariaCompliance", "shariaBoardReference", "instalmentSchedule", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'CUST-001', 'Adeyemi Adebayo', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'standard', 8496.62, 5261.83, 15741.83, 'NGN', 40, 2497627.0, 8159.07, 22161217.59, '2025-10-07 21:45:38', '2025-09-06 21:45:38', 'active', 'shariaCompliance-1', 'shariaBoardReference-1', '{"status": "active", "region": "Nigeria"}', '2025-07-06 21:45:38', '2025-09-28 21:45:38'),
  ('I-002', 'I-002', 'CUST-002', 'Chidinma Okafor', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'premium', 41418.96, 21557.68, 51235.12, 'NGN', 23, 21501382.53, 28325.36, 33927527.88, '2025-09-05 21:45:38', '2025-08-16 21:45:38', 'completed', 'shariaCompliance-2', 'shariaBoardReference-2', '{"status": "active", "region": "Nigeria"}', '2025-06-05 21:45:38', '2025-12-06 21:45:38'),
  ('I-003', 'I-003', 'CUST-003', 'Babajide Williams', 'Nigerian banking operation for Babajide Williams in Kano', 'basic', 4542.69, 39526.94, 59932.9, 'NGN', 1, 10229111.99, 94532.46, 38369802.87, '2026-01-02 21:45:38', '2025-12-15 21:45:38', 'pending', 'shariaCompliance-3', 'shariaBoardReference-3', '{"status": "active", "region": "Nigeria"}', '2025-11-26 21:45:38', '2026-03-12 21:45:38'),
  ('I-004', 'I-004', 'CUST-004', 'Ngozi Eze', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'enterprise', 773.98, 74701.67, 17570.3, 'NGN', 25, 26633791.57, 23011.84, 27940591.15, '2025-06-04 21:45:38', '2025-11-12 21:45:38', 'processing', 'shariaCompliance-4', 'shariaBoardReference-4', '{"status": "active", "region": "Nigeria"}', '2026-04-06 21:45:38', '2025-10-21 21:45:38'),
  ('I-005', 'I-005', 'CUST-005', 'Tunde Akinola', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'micro', 86176.57, 4231.18, 1875.13, 'NGN', 59, 3902351.97, 31306.75, 21469921.47, '2025-10-17 21:45:38', '2025-05-14 21:45:38', 'approved', 'shariaCompliance-5', 'shariaBoardReference-5', '{"status": "active", "region": "Nigeria"}', '2025-06-19 21:45:38', '2025-10-11 21:45:38'),
  ('I-006', 'I-006', 'CUST-006', 'Fatima Abdulrahman', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'high', 28952.23, 40503.83, 96620.0, 'NGN', 11, 40068094.49, 61812.91, 41602975.39, '2025-11-08 21:45:38', '2026-03-28 21:45:38', 'rejected', 'shariaCompliance-6', 'shariaBoardReference-6', '{"status": "active", "region": "Nigeria"}', '2025-10-01 21:45:38', '2026-03-19 21:45:38'),
  ('I-007', 'I-007', 'CUST-007', 'Emeka Nwankwo', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'medium', 24332.4, 58887.54, 52396.73, 'NGN', 26, 43527515.57, 74580.74, 11086387.22, '2026-02-15 21:45:38', '2026-04-03 21:45:38', 'investigating', 'shariaCompliance-7', 'shariaBoardReference-7', '{"status": "active", "region": "Nigeria"}', '2025-08-24 21:45:38', '2025-06-22 21:45:38'),
  ('I-008', 'I-008', 'CUST-008', 'Blessing Okoro', 'Nigerian banking operation for Blessing Okoro in Benin', 'low', 11403.55, 50995.7, 90592.37, 'NGN', 23, 17561475.75, 95822.38, 32275694.38, '2026-02-26 21:45:38', '2026-01-12 21:45:38', 'resolved', 'shariaCompliance-8', 'shariaBoardReference-8', '{"status": "active", "region": "Nigeria"}', '2026-03-21 21:45:38', '2026-02-27 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: nfiu_filings
INSERT INTO "nfiu_filings" ("report_type", "customer_id", "customer_name", "amount_ngn", "transaction_type", "status", "cbn_reference", "sla_deadline", "filed_at", "created_at") VALUES
  ('standard', 'CUST-001', 'Adeyemi Adebayo', 12805851.42, 'standard', 'active', 'cbn_reference-1', '2026-02-13 21:45:38', '2025-07-08 21:45:38', '2026-02-23 21:45:38'),
  ('premium', 'CUST-002', 'Chidinma Okafor', 38013162.62, 'premium', 'completed', 'cbn_reference-2', '2025-06-11 21:45:38', '2026-04-04 21:45:38', '2026-02-11 21:45:38'),
  ('basic', 'CUST-003', 'Babajide Williams', 47565094.11, 'basic', 'pending', 'cbn_reference-3', '2025-06-25 21:45:38', '2025-09-02 21:45:38', '2025-09-17 21:45:38'),
  ('enterpri', 'CUST-004', 'Ngozi Eze', 37724746.8, 'enterprise', 'processing', 'cbn_reference-4', '2025-07-20 21:45:38', '2025-09-25 21:45:38', '2025-05-29 21:45:38'),
  ('micro', 'CUST-005', 'Tunde Akinola', 46208471.38, 'micro', 'approved', 'cbn_reference-5', '2025-07-27 21:45:38', '2025-06-17 21:45:38', '2025-06-21 21:45:38'),
  ('high', 'CUST-006', 'Fatima Abdulrahman', 49326732.07, 'high', 'rejected', 'cbn_reference-6', '2025-11-28 21:45:38', '2025-06-25 21:45:38', '2025-12-02 21:45:38'),
  ('medium', 'CUST-007', 'Emeka Nwankwo', 7556360.5, 'medium', 'investigating', 'cbn_reference-7', '2026-04-08 21:45:38', '2025-09-14 21:45:38', '2025-09-28 21:45:38'),
  ('low', 'CUST-008', 'Blessing Okoro', 31572942.15, 'low', 'resolved', 'cbn_reference-8', '2025-12-23 21:45:38', '2025-07-14 21:45:38', '2026-04-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: nipTransactions
INSERT INTO "nipTransactions" ("nipId", "tenantId", "sessionId", "direction", "sourceBank", "destinationBank", "sourceAccount", "destinationAccount", "amount", "narration", "responseCode", "status", "completedAt", "createdAt") VALUES
  ('I-001', 'I-001', 'I-001', 'direction-1', 'CBN', 'destinat', 'CBN', 'destinationAccount-1', 17603591.71, 'Nigerian banking operation for Adeyemi Adebayo in Lagos', '1777', 'active', '2025-12-05 21:45:38', '2025-09-18 21:45:38'),
  ('I-002', 'I-002', 'I-002', 'direction-2', 'NIBSS', 'destinat', 'NIBSS', 'destinationAccount-2', 22601174.05, 'Nigerian banking operation for Chidinma Okafor in Abuja', '1596', 'completed', '2025-11-05 21:45:38', '2025-12-17 21:45:38'),
  ('I-003', 'I-003', 'I-003', 'direction-3', 'Interswi', 'destinat', 'Interswitch', 'destinationAccount-3', 3845782.75, 'Nigerian banking operation for Babajide Williams in Kano', '9968', 'pending', '2026-03-27 21:45:38', '2025-07-02 21:45:38'),
  ('I-004', 'I-004', 'I-004', 'direction-4', 'Flutterw', 'destinat', 'Flutterwave', 'destinationAccount-4', 29708050.13, 'Nigerian banking operation for Ngozi Eze in Port Harcourt', '5031', 'processing', '2025-09-18 21:45:38', '2025-07-19 21:45:38'),
  ('I-005', 'I-005', 'I-005', 'direction-5', 'Paystack', 'destinat', 'Paystack', 'destinationAccount-5', 27720275.4, 'Nigerian banking operation for Tunde Akinola in Ibadan', '9302', 'approved', '2026-04-21 21:45:38', '2025-09-24 21:45:38'),
  ('I-006', 'I-006', 'I-006', 'direction-6', 'NFIU', 'destinat', 'NFIU', 'destinationAccount-6', 45453407.33, 'Nigerian banking operation for Fatima Abdulrahman in Enugu', '6994', 'rejected', '2025-06-13 21:45:38', '2026-02-05 21:45:38'),
  ('I-007', 'I-007', 'I-007', 'direction-7', 'OFAC', 'destinat', 'OFAC', 'destinationAccount-7', 16083122.88, 'Nigerian banking operation for Emeka Nwankwo in Kaduna', '5987', 'investigating', '2025-08-29 21:45:38', '2026-02-24 21:45:38'),
  ('I-008', 'I-008', 'I-008', 'direction-8', 'WorldChe', 'destinat', 'WorldCheck', 'destinationAccount-8', 47886540.72, 'Nigerian banking operation for Blessing Okoro in Benin', '5724', 'resolved', '2026-03-21 21:45:38', '2025-11-18 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: optimistic_ui_configs
INSERT INTO "optimistic_ui_configs" ("action", "endpoint", "rollbackOnError", "successRate", "perceivedLatencyMs", "status", "created_at") VALUES
  ('action-1', 'endpoint-1', true, 'successRat', 700, 'active', '2025-08-27 21:45:38'),
  ('action-2', 'endpoint-2', true, 'successRat', 330, 'completed', '2026-01-06 21:45:38'),
  ('action-3', 'endpoint-3', true, 'successRat', 3609, 'pending', '2025-08-17 21:45:38'),
  ('action-4', 'endpoint-4', true, 'successRat', 1310, 'processing', '2025-11-07 21:45:38'),
  ('action-5', 'endpoint-5', false, 'successRat', 2327, 'approved', '2025-10-26 21:45:38'),
  ('action-6', 'endpoint-6', false, 'successRat', 2781, 'rejected', '2025-05-30 21:45:38'),
  ('action-7', 'endpoint-7', true, 'successRat', 2751, 'investigating', '2026-04-09 21:45:38'),
  ('action-8', 'endpoint-8', false, 'successRat', 4580, 'resolved', '2025-05-30 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: partnerApprovalRecords
INSERT INTO "partnerApprovalRecords" ("approvalId", "partnerId", "stage", "title", "detail", "state", "requiredRole", "requestedAt", "requestedById", "resolvedAt", "resolutionNote") VALUES
  ('I-001', 'I-001', 'stage-1', 'title-1', 'detail-1', 'state-1', 'requiredRole-1', '2025-10-27 21:45:38', 'BI-001', '2025-12-18 21:45:38', 'resolutionNote-1'),
  ('I-002', 'I-002', 'stage-2', 'title-2', 'detail-2', 'state-2', 'requiredRole-2', '2026-01-03 21:45:38', 'BI-002', '2025-06-10 21:45:38', 'resolutionNote-2'),
  ('I-003', 'I-003', 'stage-3', 'title-3', 'detail-3', 'state-3', 'requiredRole-3', '2025-07-08 21:45:38', 'BI-003', '2026-02-25 21:45:38', 'resolutionNote-3'),
  ('I-004', 'I-004', 'stage-4', 'title-4', 'detail-4', 'state-4', 'requiredRole-4', '2025-11-23 21:45:38', 'BI-004', '2026-04-01 21:45:38', 'resolutionNote-4'),
  ('I-005', 'I-005', 'stage-5', 'title-5', 'detail-5', 'state-5', 'requiredRole-5', '2025-07-18 21:45:38', 'BI-005', '2025-06-07 21:45:38', 'resolutionNote-5'),
  ('I-006', 'I-006', 'stage-6', 'title-6', 'detail-6', 'state-6', 'requiredRole-6', '2026-03-01 21:45:38', 'BI-006', '2025-11-14 21:45:38', 'resolutionNote-6'),
  ('I-007', 'I-007', 'stage-7', 'title-7', 'detail-7', 'state-7', 'requiredRole-7', '2025-12-05 21:45:38', 'BI-007', '2025-06-11 21:45:38', 'resolutionNote-7'),
  ('I-008', 'I-008', 'stage-8', 'title-8', 'detail-8', 'state-8', 'requiredRole-8', '2025-05-20 21:45:38', 'BI-008', '2025-06-07 21:45:38', 'resolutionNote-8')
ON CONFLICT DO NOTHING;

-- Table: partnerOnboardingRecords
INSERT INTO "partnerOnboardingRecords" ("partnerId", "tenantId", "partnerName", "legalEntity", "partnerType", "region", "stage", "requestedModules", "primaryContact", "operationsContact", "commercial", "compliance", "branding", "checklist", "blockers", "readinessScore", "createdAt", "updatedAt", "submittedAt", "launchedAt", "lastSubmittedBy") VALUES
  ('I-001', 'I-001', 'partnerName-1', 'legalEntity-1', 'standard', 'region-1', 'stage-1', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 51, '2026-03-07 21:45:38', '2025-07-12 21:45:38', '2025-05-15 21:45:38', '2026-03-30 21:45:38', 'lastSubmittedBy-1'),
  ('I-002', 'I-002', 'partnerName-2', 'legalEntity-2', 'premium', 'region-2', 'stage-2', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 40, '2025-07-30 21:45:38', '2025-11-01 21:45:38', '2025-06-17 21:45:38', '2025-11-25 21:45:38', 'lastSubmittedBy-2'),
  ('I-003', 'I-003', 'partnerName-3', 'legalEntity-3', 'basic', 'region-3', 'stage-3', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 17, '2025-06-03 21:45:38', '2025-05-18 21:45:38', '2025-05-27 21:45:38', '2025-08-16 21:45:38', 'lastSubmittedBy-3'),
  ('I-004', 'I-004', 'partnerName-4', 'legalEntity-4', 'enterprise', 'region-4', 'stage-4', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 12, '2025-06-16 21:45:38', '2025-06-03 21:45:38', '2025-10-08 21:45:38', '2025-08-25 21:45:38', 'lastSubmittedBy-4'),
  ('I-005', 'I-005', 'partnerName-5', 'legalEntity-5', 'micro', 'region-5', 'stage-5', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 47, '2026-05-03 21:45:38', '2025-11-08 21:45:38', '2025-12-05 21:45:38', '2026-02-09 21:45:38', 'lastSubmittedBy-5'),
  ('I-006', 'I-006', 'partnerName-6', 'legalEntity-6', 'high', 'region-6', 'stage-6', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 28, '2025-11-19 21:45:38', '2025-09-06 21:45:38', '2026-02-03 21:45:38', '2026-01-17 21:45:38', 'lastSubmittedBy-6'),
  ('I-007', 'I-007', 'partnerName-7', 'legalEntity-7', 'medium', 'region-7', 'stage-7', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 18, '2026-02-22 21:45:38', '2026-04-03 21:45:38', '2025-12-12 21:45:38', '2026-03-22 21:45:38', 'lastSubmittedBy-7'),
  ('I-008', 'I-008', 'partnerName-8', 'legalEntity-8', 'low', 'region-8', 'stage-8', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', 65, '2025-08-09 21:45:38', '2025-08-16 21:45:38', '2026-04-23 21:45:38', '2025-06-08 21:45:38', 'lastSubmittedBy-8')
ON CONFLICT DO NOTHING;

-- Table: pci_scans
INSERT INTO "pci_scans" ("requirement", "total_controls", "passing", "failing", "findings", "last_scan", "scan_duration", "status", "created_at") VALUES
  ('requirement-1', 345, 898, 785, '{"status": "active", "region": "Nigeria"}', '2025-06-30 21:45:38', '26%', 'active', '2025-07-11 21:45:38'),
  ('requirement-2', 386, 158, 167, '{"status": "active", "region": "Nigeria"}', '2026-02-09 21:45:38', '31%', 'completed', '2025-09-30 21:45:38'),
  ('requirement-3', 45, 421, 374, '{"status": "active", "region": "Nigeria"}', '2025-05-31 21:45:38', '40%', 'pending', '2025-09-27 21:45:38'),
  ('requirement-4', 626, 292, 771, '{"status": "active", "region": "Nigeria"}', '2025-09-25 21:45:38', '39%', 'processing', '2025-08-12 21:45:38'),
  ('requirement-5', 245, 317, 989, '{"status": "active", "region": "Nigeria"}', '2025-09-14 21:45:38', '34%', 'approved', '2025-11-05 21:45:38'),
  ('requirement-6', 695, 970, 585, '{"status": "active", "region": "Nigeria"}', '2025-09-29 21:45:38', '69%', 'rejected', '2025-12-19 21:45:38'),
  ('requirement-7', 797, 392, 515, '{"status": "active", "region": "Nigeria"}', '2025-08-15 21:45:38', '63%', 'investigating', '2026-02-19 21:45:38'),
  ('requirement-8', 837, 205, 821, '{"status": "active", "region": "Nigeria"}', '2025-07-07 21:45:38', '27%', 'resolved', '2026-01-04 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: prepared_statements
INSERT INTO "prepared_statements" ("queryPattern", "executions24h", "avgExecMs", "planCacheHits", "paramTypes", "status", "created_at") VALUES
  ('queryPattern-1', 54, 64118.26, 'planCacheHits-1', 'standard', 'active', '2025-11-03 21:45:38'),
  ('queryPattern-2', 568, 93429.42, 'planCacheHits-2', 'premium', 'completed', '2025-05-13 21:45:38'),
  ('queryPattern-3', 867, 51591.42, 'planCacheHits-3', 'basic', 'pending', '2026-03-10 21:45:38'),
  ('queryPattern-4', 292, 8388.43, 'planCacheHits-4', 'enterprise', 'processing', '2026-02-19 21:45:38'),
  ('queryPattern-5', 280, 44932.47, 'planCacheHits-5', 'micro', 'approved', '2025-08-23 21:45:38'),
  ('queryPattern-6', 151, 83104.84, 'planCacheHits-6', 'high', 'rejected', '2026-03-27 21:45:38'),
  ('queryPattern-7', 970, 91050.58, 'planCacheHits-7', 'medium', 'investigating', '2025-09-24 21:45:38'),
  ('queryPattern-8', 906, 34959.16, 'planCacheHits-8', 'low', 'resolved', '2026-04-29 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: query_cache_entries
INSERT INTO "query_cache_entries" ("queryHash", "tableName", "resultCount", "ttlSeconds", "hitCount", "hitRate", "status", "created_at") VALUES
  ('queryHash-1', 'tableName-1', 26, 7040, 25, 'hitRate-1', 'active', '2025-08-28 21:45:38'),
  ('queryHash-2', 'tableName-2', 23, 30963, 24, 'hitRate-2', 'completed', '2026-04-01 21:45:38'),
  ('queryHash-3', 'tableName-3', 23, 29490, 1, 'hitRate-3', 'pending', '2025-11-30 21:45:38'),
  ('queryHash-4', 'tableName-4', 6, 85251, 21, 'hitRate-4', 'processing', '2026-02-27 21:45:38'),
  ('queryHash-5', 'tableName-5', 8, 5080, 18, 'hitRate-5', 'approved', '2025-09-13 21:45:38'),
  ('queryHash-6', 'tableName-6', 44, 18251, 48, 'hitRate-6', 'rejected', '2025-05-16 21:45:38'),
  ('queryHash-7', 'tableName-7', 30, 58859, 39, 'hitRate-7', 'investigating', '2026-05-10 21:45:38'),
  ('queryHash-8', 'tableName-8', 5, 2550, 16, 'hitRate-8', 'resolved', '2026-01-22 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: redis_cache_entries
INSERT INTO "redis_cache_entries" ("route", "ttlSeconds", "hitCount", "missCount", "hitRate", "avgLatencyMs", "memoryMB", "status", "created_at") VALUES
  ('/api/v1/customers', 19657, 35, 46, 'hitRate-1', 60888.4, 217.0, 'active', '2025-12-16 21:45:38'),
  ('/api/v1/accounts', 31207, 19, 7, 'hitRate-2', 4775.9, 215.2, 'completed', '2025-06-28 21:45:38'),
  ('/api/v1/transactions', 59974, 4, 7, 'hitRate-3', 83668.94, 256.2, 'pending', '2025-08-11 21:45:38'),
  ('/api/v1/loans', 2214, 40, 32, 'hitRate-4', 57505.17, 368.0, 'processing', '2025-12-14 21:45:38'),
  ('/api/v1/payments', 56321, 0, 39, 'hitRate-5', 35282.25, 292.4, 'approved', '2026-02-06 21:45:38'),
  ('/api/v1/transfers', 11281, 33, 23, 'hitRate-6', 6768.86, 269.6, 'rejected', '2025-08-26 21:45:38'),
  ('/api/v1/cards', 66595, 35, 1, 'hitRate-7', 39045.98, 241.0, 'investigating', '2025-06-21 21:45:38'),
  ('/api/v1/fx', 50769, 23, 16, 'hitRate-8', 74731.91, 183.2, 'resolved', '2026-04-08 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: redis_sessions
INSERT INTO "redis_sessions" ("sessionId", "userId", "deviceType", "ipAddress", "expiresIn", "slidingTTL", "status", "created_at") VALUES
  ('I-001', 'I-001', 'standard', 'ipAddress-1', 'expiresIn-1', false, 'active', '2025-06-10 21:45:38'),
  ('I-002', 'I-002', 'premium', 'ipAddress-2', 'expiresIn-2', true, 'completed', '2025-07-19 21:45:38'),
  ('I-003', 'I-003', 'basic', 'ipAddress-3', 'expiresIn-3', true, 'pending', '2025-11-23 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'ipAddress-4', 'expiresIn-4', false, 'processing', '2025-11-13 21:45:38'),
  ('I-005', 'I-005', 'micro', 'ipAddress-5', 'expiresIn-5', true, 'approved', '2025-06-17 21:45:38'),
  ('I-006', 'I-006', 'high', 'ipAddress-6', 'expiresIn-6', false, 'rejected', '2025-05-27 21:45:38'),
  ('I-007', 'I-007', 'medium', 'ipAddress-7', 'expiresIn-7', false, 'investigating', '2025-05-21 21:45:38'),
  ('I-008', 'I-008', 'low', 'ipAddress-8', 'expiresIn-8', false, 'resolved', '2026-02-08 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: regulatoryReports
INSERT INTO "regulatoryReports" ("reportId", "tenantId", "reportType", "period", "status", "submittedTo", "submittedAt", "data", "summary", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'standard', 'period-1', 'active', 'submittedTo-1', '2026-03-04 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2026-04-10 21:45:38', '2025-09-20 21:45:38'),
  ('I-002', 'I-002', 'premium', 'period-2', 'completed', 'submittedTo-2', '2026-04-24 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2025-12-13 21:45:38', '2026-01-29 21:45:38'),
  ('I-003', 'I-003', 'basic', 'period-3', 'pending', 'submittedTo-3', '2026-04-20 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2026-01-30 21:45:38', '2026-04-21 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'period-4', 'processing', 'submittedTo-4', '2025-12-02 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2025-12-05 21:45:38', '2025-08-22 21:45:38'),
  ('I-005', 'I-005', 'micro', 'period-5', 'approved', 'submittedTo-5', '2025-10-21 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2025-08-07 21:45:38', '2025-09-12 21:45:38'),
  ('I-006', 'I-006', 'high', 'period-6', 'rejected', 'submittedTo-6', '2026-01-03 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2026-04-24 21:45:38', '2025-06-15 21:45:38'),
  ('I-007', 'I-007', 'medium', 'period-7', 'investigating', 'submittedTo-7', '2026-02-04 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2025-12-17 21:45:38', '2025-11-11 21:45:38'),
  ('I-008', 'I-008', 'low', 'period-8', 'resolved', 'submittedTo-8', '2026-04-18 21:45:38', '{"status": "active", "region": "Nigeria"}', '{"status": "active", "region": "Nigeria"}', '2025-06-11 21:45:38', '2025-11-24 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: route_trie_stats
INSERT INTO "route_trie_stats" ("routePrefix", "totalRoutes", "trieDepth", "avgLookupNs", "cacheHitRate", "status", "created_at") VALUES
  ('/api/v1/customers', 9, 128, 819, 'cacheHitRate-1', 'active', '2025-11-05 21:45:38'),
  ('/api/v1/accounts', 14, 911, 410, 'cacheHitRate-2', 'completed', '2025-09-29 21:45:38'),
  ('/api/v1/transactions', 13, 348, 998, 'cacheHitRate-3', 'pending', '2026-02-06 21:45:38'),
  ('/api/v1/loans', 16, 709, 510, 'cacheHitRate-4', 'processing', '2025-11-05 21:45:38'),
  ('/api/v1/payments', 17, 274, 821, 'cacheHitRate-5', 'approved', '2026-03-31 21:45:38'),
  ('/api/v1/transfers', 14, 81, 441, 'cacheHitRate-6', 'rejected', '2025-07-08 21:45:38'),
  ('/api/v1/cards', 6, 559, 301, 'cacheHitRate-7', 'investigating', '2025-11-29 21:45:38'),
  ('/api/v1/fx', 4, 82, 336, 'cacheHitRate-8', 'resolved', '2025-06-08 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: soc2_evidence
INSERT INTO "soc2_evidence" ("control_id", "category", "title", "evidence_type", "result", "period", "artifacts", "auditor", "status", "created_at") VALUES
  ('_-001', 'standard', 'title-1', 'standard', 'result-1', 'period-1', '{"status": "active", "region": "Nigeria"}', 'auditor-1', 'active', '2025-12-12 21:45:38'),
  ('_-002', 'premium', 'title-2', 'premium', 'result-2', 'period-2', '{"status": "active", "region": "Nigeria"}', 'auditor-2', 'completed', '2025-12-07 21:45:38'),
  ('_-003', 'basic', 'title-3', 'basic', 'result-3', 'period-3', '{"status": "active", "region": "Nigeria"}', 'auditor-3', 'pending', '2025-09-26 21:45:38'),
  ('_-004', 'enterprise', 'title-4', 'enterprise', 'result-4', 'period-4', '{"status": "active", "region": "Nigeria"}', 'auditor-4', 'processing', '2025-07-08 21:45:38'),
  ('_-005', 'micro', 'title-5', 'micro', 'result-5', 'period-5', '{"status": "active", "region": "Nigeria"}', 'auditor-5', 'approved', '2025-10-06 21:45:38'),
  ('_-006', 'high', 'title-6', 'high', 'result-6', 'period-6', '{"status": "active", "region": "Nigeria"}', 'auditor-6', 'rejected', '2026-02-16 21:45:38'),
  ('_-007', 'medium', 'title-7', 'medium', 'result-7', 'period-7', '{"status": "active", "region": "Nigeria"}', 'auditor-7', 'investigating', '2025-05-24 21:45:38'),
  ('_-008', 'low', 'title-8', 'low', 'result-8', 'period-8', '{"status": "active", "region": "Nigeria"}', 'auditor-8', 'resolved', '2025-09-27 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: sri_hashes
INSERT INTO "sri_hashes" ("resource", "algorithm", "hash", "last_verified", "violations", "cdn_provider", "status", "created_at") VALUES
  ('CBN', 'gzip', 'hash-1', '2025-11-14 21:45:38', 458, 'CBN', 'active', '2026-04-21 21:45:38'),
  ('NIBSS', 'brotli', 'hash-2', '2025-11-13 21:45:38', 630, 'NIBSS', 'completed', '2025-10-02 21:45:38'),
  ('Interswitch', 'zstd', 'hash-3', '2025-12-23 21:45:38', 655, 'Interswitch', 'pending', '2026-04-13 21:45:38'),
  ('Flutterwave', 'lz4', 'hash-4', '2026-04-04 21:45:38', 688, 'Flutterwave', 'processing', '2025-06-20 21:45:38'),
  ('Paystack', 'snappy', 'hash-5', '2025-10-17 21:45:38', 373, 'Paystack', 'approved', '2025-08-23 21:45:38'),
  ('NFIU', 'deflate', 'hash-6', '2025-05-30 21:45:38', 164, 'NFIU', 'rejected', '2026-04-27 21:45:38'),
  ('OFAC', 'lzma', 'hash-7', '2026-02-28 21:45:38', 870, 'OFAC', 'investigating', '2025-07-05 21:45:38'),
  ('WorldCheck', 'gzip', 'hash-8', '2025-05-30 21:45:38', 801, 'WorldCheck', 'resolved', '2025-09-30 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: stream_response_configs
INSERT INTO "stream_response_configs" ("endpoint", "thresholdBytes", "chunksizeKB", "bytesStreamed24h", "memoryReductionPct", "status", "created_at") VALUES
  ('endpoint-1', 37513, 133385, 'bytesStreamed24h-1', 'memoryRedu', 'active', '2026-04-08 21:45:38'),
  ('endpoint-2', 248483, 817356, 'bytesStreamed24h-2', 'memoryRedu', 'completed', '2025-06-16 21:45:38'),
  ('endpoint-3', 385147, 380766, 'bytesStreamed24h-3', 'memoryRedu', 'pending', '2025-10-28 21:45:38'),
  ('endpoint-4', 996612, 595823, 'bytesStreamed24h-4', 'memoryRedu', 'processing', '2026-04-26 21:45:38'),
  ('endpoint-5', 635511, 161915, 'bytesStreamed24h-5', 'memoryRedu', 'approved', '2025-05-30 21:45:38'),
  ('endpoint-6', 472802, 995937, 'bytesStreamed24h-6', 'memoryRedu', 'rejected', '2025-11-04 21:45:38'),
  ('endpoint-7', 391108, 466528, 'bytesStreamed24h-7', 'memoryRedu', 'investigating', '2026-04-03 21:45:38'),
  ('endpoint-8', 602824, 145407, 'bytesStreamed24h-8', 'memoryRedu', 'resolved', '2025-08-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: sw_cache_strategies
INSERT INTO "sw_cache_strategies" ("pattern", "strategy", "maxAge", "cacheHitRate", "offlineCapable", "status", "created_at") VALUES
  ('pattern-1', 'strategy-1', 376, 'cacheHitRate-1', false, 'active', '2025-06-14 21:45:38'),
  ('pattern-2', 'strategy-2', 286, 'cacheHitRate-2', false, 'completed', '2026-03-15 21:45:38'),
  ('pattern-3', 'strategy-3', 27, 'cacheHitRate-3', true, 'pending', '2025-08-30 21:45:38'),
  ('pattern-4', 'strategy-4', 531, 'cacheHitRate-4', false, 'processing', '2025-07-29 21:45:38'),
  ('pattern-5', 'strategy-5', 121, 'cacheHitRate-5', false, 'approved', '2025-12-30 21:45:38'),
  ('pattern-6', 'strategy-6', 721, 'cacheHitRate-6', false, 'rejected', '2025-07-03 21:45:38'),
  ('pattern-7', 'strategy-7', 293, 'cacheHitRate-7', true, 'investigating', '2025-09-03 21:45:38'),
  ('pattern-8', 'strategy-8', 205, 'cacheHitRate-8', false, 'resolved', '2026-04-05 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: swiftMessages
INSERT INTO "swiftMessages" ("messageId", "tenantId", "messageType", "direction", "senderBic", "receiverBic", "amount", "currency", "valueDate", "rawMessage", "status", "relatedTransferId", "createdAt") VALUES
  ('I-001', 'I-001', 'Nigerian', 'direction-1', 'senderBic-1', 'receiverBic', 22607613.84, 'NGN', '44934964.75', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'active', 'TI-001', '2025-09-27 21:45:38'),
  ('I-002', 'I-002', 'Nigerian', 'direction-2', 'senderBic-2', 'receiverBic', 49863147.58, 'NGN', '40527555.79', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'completed', 'TI-002', '2025-11-30 21:45:38'),
  ('I-003', 'I-003', 'Nigerian', 'direction-3', 'senderBic-3', 'receiverBic', 33395311.13, 'NGN', '35479928.94', 'Nigerian banking operation for Babajide Williams in Kano', 'pending', 'TI-003', '2025-08-04 21:45:38'),
  ('I-004', 'I-004', 'Nigerian', 'direction-4', 'senderBic-4', 'receiverBic', 27113146.35, 'NGN', '44567670.8', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'processing', 'TI-004', '2026-02-21 21:45:38'),
  ('I-005', 'I-005', 'Nigerian', 'direction-5', 'senderBic-5', 'receiverBic', 35593337.11, 'NGN', '46366949.59', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'approved', 'TI-005', '2025-06-20 21:45:38'),
  ('I-006', 'I-006', 'Nigerian', 'direction-6', 'senderBic-6', 'receiverBic', 8712809.58, 'NGN', '18080994.23', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'rejected', 'TI-006', '2026-01-18 21:45:38'),
  ('I-007', 'I-007', 'Nigerian', 'direction-7', 'senderBic-7', 'receiverBic', 6076909.13, 'NGN', '10057008.76', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'investigating', 'TI-007', '2026-03-02 21:45:38'),
  ('I-008', 'I-008', 'Nigerian', 'direction-8', 'senderBic-8', 'receiverBic', 11844441.85, 'NGN', '24706156.65', 'Nigerian banking operation for Blessing Okoro in Benin', 'resolved', 'TI-008', '2025-11-09 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: table_partitions
INSERT INTO "table_partitions" ("tableName", "partitionKey", "partitionType", "activePartitions", "rowsPerPartition", "status", "created_at") VALUES
  ('tableName-1', 'partitionKey-1', 'standard', 568, 'rowsPerPartition-1', 'active', '2025-07-23 21:45:38'),
  ('tableName-2', 'partitionKey-2', 'premium', 378, 'rowsPerPartition-2', 'completed', '2025-09-15 21:45:38'),
  ('tableName-3', 'partitionKey-3', 'basic', 823, 'rowsPerPartition-3', 'pending', '2025-08-03 21:45:38'),
  ('tableName-4', 'partitionKey-4', 'enterprise', 133, 'rowsPerPartition-4', 'processing', '2025-07-03 21:45:38'),
  ('tableName-5', 'partitionKey-5', 'micro', 906, 'rowsPerPartition-5', 'approved', '2026-03-29 21:45:38'),
  ('tableName-6', 'partitionKey-6', 'high', 68, 'rowsPerPartition-6', 'rejected', '2025-12-05 21:45:38'),
  ('tableName-7', 'partitionKey-7', 'medium', 408, 'rowsPerPartition-7', 'investigating', '2025-09-09 21:45:38'),
  ('tableName-8', 'partitionKey-8', 'low', 539, 'rowsPerPartition-8', 'resolved', '2025-10-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: temporal_memoized_activities
INSERT INTO "temporal_memoized_activities" ("workflow", "activity", "replaySpeedup", "cacheTTL", "cacheHitRate", "status", "created_at") VALUES
  ('workflow-1', 'activity-1', 'replaySpee', 'cacheTTL-1', 'cacheHitRate-1', 'active', '2025-10-15 21:45:38'),
  ('workflow-2', 'activity-2', 'replaySpee', 'cacheTTL-2', 'cacheHitRate-2', 'completed', '2025-07-22 21:45:38'),
  ('workflow-3', 'activity-3', 'replaySpee', 'cacheTTL-3', 'cacheHitRate-3', 'pending', '2026-04-05 21:45:38'),
  ('workflow-4', 'activity-4', 'replaySpee', 'cacheTTL-4', 'cacheHitRate-4', 'processing', '2026-03-09 21:45:38'),
  ('workflow-5', 'activity-5', 'replaySpee', 'cacheTTL-5', 'cacheHitRate-5', 'approved', '2025-12-01 21:45:38'),
  ('workflow-6', 'activity-6', 'replaySpee', 'cacheTTL-6', 'cacheHitRate-6', 'rejected', '2025-06-18 21:45:38'),
  ('workflow-7', 'activity-7', 'replaySpee', 'cacheTTL-7', 'cacheHitRate-7', 'investigating', '2026-04-05 21:45:38'),
  ('workflow-8', 'activity-8', 'replaySpee', 'cacheTTL-8', 'cacheHitRate-8', 'resolved', '2025-09-24 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: tls_configs
INSERT INTO "tls_configs" ("domain", "protocol", "cipher_suites", "cert_expiry", "ocsp_stapling", "hsts_preload", "handshakes_24h", "status", "created_at") VALUES
  ('domain-1', 'protocol-1', '{"status": "active", "region": "Nigeria"}', '2025-09-16 21:45:38', true, false, 900, 'active', '2025-08-03 21:45:38'),
  ('domain-2', 'protocol-2', '{"status": "active", "region": "Nigeria"}', '2025-06-19 21:45:38', true, true, 133, 'completed', '2025-10-03 21:45:38'),
  ('domain-3', 'protocol-3', '{"status": "active", "region": "Nigeria"}', '2025-08-28 21:45:38', true, false, 128, 'pending', '2025-08-20 21:45:38'),
  ('domain-4', 'protocol-4', '{"status": "active", "region": "Nigeria"}', '2026-02-23 21:45:38', false, false, 958, 'processing', '2025-05-14 21:45:38'),
  ('domain-5', 'protocol-5', '{"status": "active", "region": "Nigeria"}', '2026-01-17 21:45:38', false, true, 917, 'approved', '2025-12-18 21:45:38'),
  ('domain-6', 'protocol-6', '{"status": "active", "region": "Nigeria"}', '2026-04-02 21:45:38', false, true, 565, 'rejected', '2025-12-23 21:45:38'),
  ('domain-7', 'protocol-7', '{"status": "active", "region": "Nigeria"}', '2026-03-09 21:45:38', true, true, 96, 'investigating', '2025-08-28 21:45:38'),
  ('domain-8', 'protocol-8', '{"status": "active", "region": "Nigeria"}', '2025-06-18 21:45:38', false, true, 158, 'resolved', '2026-02-14 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: txn_pattern_analyses
INSERT INTO "txn_pattern_analyses" ("customerId", "customerName", "anomalyScore", "baselineDeviation", "recommendation", "status", "created_at") VALUES
  ('CUST-001', 'Adeyemi Adebayo', 65873.63, 'baselineDeviation-1', 'recommendation-1', 'active', '2025-07-07 21:45:38'),
  ('CUST-002', 'Chidinma Okafor', 33762.62, 'baselineDeviation-2', 'recommendation-2', 'completed', '2025-07-28 21:45:38'),
  ('CUST-003', 'Babajide Williams', 4120.39, 'baselineDeviation-3', 'recommendation-3', 'pending', '2026-04-28 21:45:38'),
  ('CUST-004', 'Ngozi Eze', 8123.2, 'baselineDeviation-4', 'recommendation-4', 'processing', '2025-06-18 21:45:38'),
  ('CUST-005', 'Tunde Akinola', 77102.47, 'baselineDeviation-5', 'recommendation-5', 'approved', '2025-12-28 21:45:38'),
  ('CUST-006', 'Fatima Abdulrahman', 65113.35, 'baselineDeviation-6', 'recommendation-6', 'rejected', '2025-07-24 21:45:38'),
  ('CUST-007', 'Emeka Nwankwo', 41659.26, 'baselineDeviation-7', 'recommendation-7', 'investigating', '2025-06-19 21:45:38'),
  ('CUST-008', 'Blessing Okoro', 3029.56, 'baselineDeviation-8', 'recommendation-8', 'resolved', '2025-06-25 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: typology_matches
INSERT INTO "typology_matches" ("typologyCode", "typologyName", "riskLevel", "customersTriggered", "autoSARGeneration", "status", "created_at") VALUES
  ('672079', 'typologyName-1', 'standard', 297, true, 'active', '2025-12-09 21:45:38'),
  ('606404', 'typologyName-2', 'premium', 251, true, 'completed', '2025-05-27 21:45:38'),
  ('525818', 'typologyName-3', 'basic', 305, false, 'pending', '2025-05-25 21:45:38'),
  ('162823', 'typologyName-4', 'enterprise', 162, false, 'processing', '2025-09-07 21:45:38'),
  ('587002', 'typologyName-5', 'micro', 209, false, 'approved', '2026-02-28 21:45:38'),
  ('427766', 'typologyName-6', 'high', 883, true, 'rejected', '2025-11-17 21:45:38'),
  ('518084', 'typologyName-7', 'medium', 134, true, 'investigating', '2025-08-22 21:45:38'),
  ('688933', 'typologyName-8', 'low', 109, false, 'resolved', '2025-09-16 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: ubo_graph_nodes
INSERT INTO "ubo_graph_nodes" ("entity_name", "entity_type", "nationality", "risk_level", "metadata", "created_at") VALUES
  ('Adeyemi Adebayo', 'standard', 'nationality-1', 'standard', '{"status": "active", "region": "Nigeria"}', '2026-03-11 21:45:38'),
  ('Chidinma Okafor', 'premium', 'nationality-2', 'premium', '{"status": "active", "region": "Nigeria"}', '2025-12-27 21:45:38'),
  ('Babajide Williams', 'basic', 'nationality-3', 'basic', '{"status": "active", "region": "Nigeria"}', '2025-09-24 21:45:38'),
  ('Ngozi Eze', 'enterprise', 'nationality-4', 'enterprise', '{"status": "active", "region": "Nigeria"}', '2026-01-06 21:45:38'),
  ('Tunde Akinola', 'micro', 'nationality-5', 'micro', '{"status": "active", "region": "Nigeria"}', '2026-03-01 21:45:38'),
  ('Fatima Abdulrahman', 'high', 'nationality-6', 'high', '{"status": "active", "region": "Nigeria"}', '2026-03-24 21:45:38'),
  ('Emeka Nwankwo', 'medium', 'nationality-7', 'medium', '{"status": "active", "region": "Nigeria"}', '2026-04-17 21:45:38'),
  ('Blessing Okoro', 'low', 'nationality-8', 'low', '{"status": "active", "region": "Nigeria"}', '2025-12-15 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: valueChainContracts
INSERT INTO "valueChainContracts" ("contractId", "tenantId", "contractType", "buyerName", "buyerId", "sellerFarmerId", "commodity", "quantityTonnes", "pricePerTonne", "totalValue", "currency", "deliveryLocation", "deliveryDeadline", "warehouseReceiptId", "qualityGrade", "milestones", "status", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'standard', 'buyerName-1', 'I-001', 'FI-001', 'commodity-1', 94538.54, 86416.52, 20912555.82, 'NGN', 'deliveryLocation-1', 'deliveryDeadline-1', 'RI-001', 'standard', '{"status": "active", "region": "Nigeria"}', 'active', '2026-02-20 21:45:38', '2025-11-26 21:45:38'),
  ('I-002', 'I-002', 'premium', 'buyerName-2', 'I-002', 'FI-002', 'commodity-2', 93375.22, 72113.12, 9499806.72, 'NGN', 'deliveryLocation-2', 'deliveryDeadline-2', 'RI-002', 'premium', '{"status": "active", "region": "Nigeria"}', 'completed', '2026-02-20 21:45:38', '2025-08-30 21:45:38'),
  ('I-003', 'I-003', 'basic', 'buyerName-3', 'I-003', 'FI-003', 'commodity-3', 99596.95, 46682.04, 43954992.42, 'NGN', 'deliveryLocation-3', 'deliveryDeadline-3', 'RI-003', 'basic', '{"status": "active", "region": "Nigeria"}', 'pending', '2025-08-31 21:45:38', '2026-05-01 21:45:38'),
  ('I-004', 'I-004', 'enterprise', 'buyerName-4', 'I-004', 'FI-004', 'commodity-4', 9005.82, 39324.83, 22866959.8, 'NGN', 'deliveryLocation-4', 'deliveryDeadline-4', 'RI-004', 'enterprise', '{"status": "active", "region": "Nigeria"}', 'processing', '2026-01-09 21:45:38', '2026-01-22 21:45:38'),
  ('I-005', 'I-005', 'micro', 'buyerName-5', 'I-005', 'FI-005', 'commodity-5', 58334.83, 4866.76, 14075003.36, 'NGN', 'deliveryLocation-5', 'deliveryDeadline-5', 'RI-005', 'micro', '{"status": "active", "region": "Nigeria"}', 'approved', '2025-07-11 21:45:38', '2025-06-12 21:45:38'),
  ('I-006', 'I-006', 'high', 'buyerName-6', 'I-006', 'FI-006', 'commodity-6', 67252.39, 28575.55, 418788.52, 'NGN', 'deliveryLocation-6', 'deliveryDeadline-6', 'RI-006', 'high', '{"status": "active", "region": "Nigeria"}', 'rejected', '2026-03-18 21:45:38', '2025-10-04 21:45:38'),
  ('I-007', 'I-007', 'medium', 'buyerName-7', 'I-007', 'FI-007', 'commodity-7', 13394.36, 26448.03, 18295224.21, 'NGN', 'deliveryLocation-7', 'deliveryDeadline-7', 'RI-007', 'medium', '{"status": "active", "region": "Nigeria"}', 'investigating', '2025-10-18 21:45:38', '2025-11-06 21:45:38'),
  ('I-008', 'I-008', 'low', 'buyerName-8', 'I-008', 'FI-008', 'commodity-8', 4525.19, 5116.72, 28095225.09, 'NGN', 'deliveryLocation-8', 'deliveryDeadline-8', 'RI-008', 'low', '{"status": "active", "region": "Nigeria"}', 'resolved', '2025-11-08 21:45:38', '2025-08-02 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: vault_engines
INSERT INTO "vault_engines" ("path", "engine_type", "description", "leases", "max_ttl", "default_ttl", "rotations_completed", "status", "created_at") VALUES
  ('path-1', 'standard', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 296, 'max_ttl-1', 'default_ttl-1', 76, 'active', '2025-10-27 21:45:38'),
  ('path-2', 'premium', 'Nigerian banking operation for Chidinma Okafor in Abuja', 517, 'max_ttl-2', 'default_ttl-2', 462, 'completed', '2025-08-04 21:45:38'),
  ('path-3', 'basic', 'Nigerian banking operation for Babajide Williams in Kano', 287, 'max_ttl-3', 'default_ttl-3', 846, 'pending', '2025-06-27 21:45:38'),
  ('path-4', 'enterprise', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 697, 'max_ttl-4', 'default_ttl-4', 626, 'processing', '2026-03-13 21:45:38'),
  ('path-5', 'micro', 'Nigerian banking operation for Tunde Akinola in Ibadan', 132, 'max_ttl-5', 'default_ttl-5', 999, 'approved', '2026-03-24 21:45:38'),
  ('path-6', 'high', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 404, 'max_ttl-6', 'default_ttl-6', 383, 'rejected', '2025-11-20 21:45:38'),
  ('path-7', 'medium', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 572, 'max_ttl-7', 'default_ttl-7', 962, 'investigating', '2025-11-06 21:45:38'),
  ('path-8', 'low', 'Nigerian banking operation for Blessing Okoro in Benin', 774, 'max_ttl-8', 'default_ttl-8', 148, 'resolved', '2026-01-31 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: virtualAccounts
INSERT INTO "virtualAccounts" ("accountId", "tenantId", "van", "parentAccountId", "ownerId", "ownerName", "ownerType", "purpose", "currency", "balance", "availableBalance", "holdAmount", "dailyLimit", "monthlyLimit", "status", "expiryDate", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'van-1', 'AI-001', 'I-001', 'ownerName-1', 'standard', 'Nigerian banking operation for Adeyemi Adebayo in Lagos', 'NGN', 30127122.93, 20075340.34, 2022342.76, 3892.36, 71359.47, 'active', '2025-09-12 21:45:38', '2025-08-20 21:45:38', '2025-09-21 21:45:38'),
  ('I-002', 'I-002', 'van-2', 'AI-002', 'I-002', 'ownerName-2', 'premium', 'Nigerian banking operation for Chidinma Okafor in Abuja', 'NGN', 7455543.82, 44657653.29, 6997651.48, 93136.94, 31853.68, 'completed', '2025-10-23 21:45:38', '2025-07-01 21:45:38', '2025-12-10 21:45:38'),
  ('I-003', 'I-003', 'van-3', 'AI-003', 'I-003', 'ownerName-3', 'basic', 'Nigerian banking operation for Babajide Williams in Kano', 'NGN', 29690295.53, 25370676.16, 25490607.9, 48985.18, 56292.86, 'pending', '2025-09-11 21:45:38', '2026-05-04 21:45:38', '2025-11-05 21:45:38'),
  ('I-004', 'I-004', 'van-4', 'AI-004', 'I-004', 'ownerName-4', 'enterprise', 'Nigerian banking operation for Ngozi Eze in Port Harcourt', 'NGN', 16568667.28, 5489133.43, 20832848.07, 30768.48, 89876.81, 'processing', '2025-05-25 21:45:38', '2025-06-24 21:45:38', '2026-04-29 21:45:38'),
  ('I-005', 'I-005', 'van-5', 'AI-005', 'I-005', 'ownerName-5', 'micro', 'Nigerian banking operation for Tunde Akinola in Ibadan', 'NGN', 29849511.7, 13283866.54, 32782992.7, 97205.71, 57847.85, 'approved', '2026-01-16 21:45:38', '2026-04-16 21:45:38', '2025-07-18 21:45:38'),
  ('I-006', 'I-006', 'van-6', 'AI-006', 'I-006', 'ownerName-6', 'high', 'Nigerian banking operation for Fatima Abdulrahman in Enugu', 'NGN', 24027634.7, 26216374.31, 36061929.93, 77460.84, 38019.65, 'rejected', '2025-05-29 21:45:38', '2026-01-08 21:45:38', '2026-04-26 21:45:38'),
  ('I-007', 'I-007', 'van-7', 'AI-007', 'I-007', 'ownerName-7', 'medium', 'Nigerian banking operation for Emeka Nwankwo in Kaduna', 'NGN', 28632787.87, 35029040.35, 9547308.55, 44104.42, 41878.61, 'investigating', '2025-10-13 21:45:38', '2025-05-24 21:45:38', '2026-01-28 21:45:38'),
  ('I-008', 'I-008', 'van-8', 'AI-008', 'I-008', 'ownerName-8', 'low', 'Nigerian banking operation for Blessing Okoro in Benin', 'NGN', 20524766.69, 38750865.37, 46026842.29, 87281.9, 73583.99, 'resolved', '2026-04-11 21:45:38', '2025-05-16 21:45:38', '2026-03-03 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: warehouseReceipts
INSERT INTO "warehouseReceipts" ("receiptId", "tenantId", "depositorId", "depositorName", "warehouseId", "warehouseName", "location", "commodity", "quantity", "quantityUnit", "qualityGrade", "storageStartDate", "expiryDate", "marketValue", "currency", "pledgedAsCollateral", "collateralLoanId", "insurancePolicyId", "status", "createdAt", "updatedAt") VALUES
  ('I-001', 'I-001', 'I-001', 'depositorName-1', 'I-001', 'warehouseName-1', 'location-1', 'commodity-1', 51868.8, 'quantityUnit-1', 'standard', '2025-07-29 21:45:38', '2025-11-27 21:45:38', 49906162.19, 'NGN', 490, 'LI-001', 'PI-001', 'active', '2025-08-16 21:45:38', '2025-11-01 21:45:38'),
  ('I-002', 'I-002', 'I-002', 'depositorName-2', 'I-002', 'warehouseName-2', 'location-2', 'commodity-2', 31375.95, 'quantityUnit-2', 'premium', '2026-02-13 21:45:38', '2025-09-19 21:45:38', 45607086.8, 'NGN', 351, 'LI-002', 'PI-002', 'completed', '2025-08-06 21:45:38', '2025-11-12 21:45:38'),
  ('I-003', 'I-003', 'I-003', 'depositorName-3', 'I-003', 'warehouseName-3', 'location-3', 'commodity-3', 67587.18, 'quantityUnit-3', 'basic', '2025-05-29 21:45:38', '2025-06-17 21:45:38', 40184589.98, 'NGN', 271, 'LI-003', 'PI-003', 'pending', '2025-07-04 21:45:38', '2025-09-07 21:45:38'),
  ('I-004', 'I-004', 'I-004', 'depositorName-4', 'I-004', 'warehouseName-4', 'location-4', 'commodity-4', 19227.22, 'quantityUnit-4', 'enterprise', '2026-01-06 21:45:38', '2025-12-21 21:45:38', 27908751.67, 'NGN', 231, 'LI-004', 'PI-004', 'processing', '2025-12-11 21:45:38', '2025-12-16 21:45:38'),
  ('I-005', 'I-005', 'I-005', 'depositorName-5', 'I-005', 'warehouseName-5', 'location-5', 'commodity-5', 70490.39, 'quantityUnit-5', 'micro', '2025-05-24 21:45:38', '2025-05-17 21:45:38', 24455263.94, 'NGN', 492, 'LI-005', 'PI-005', 'approved', '2025-11-15 21:45:38', '2025-07-30 21:45:38'),
  ('I-006', 'I-006', 'I-006', 'depositorName-6', 'I-006', 'warehouseName-6', 'location-6', 'commodity-6', 93370.1, 'quantityUnit-6', 'high', '2025-12-23 21:45:38', '2025-12-16 21:45:38', 6102486.55, 'NGN', 693, 'LI-006', 'PI-006', 'rejected', '2025-08-07 21:45:38', '2025-10-30 21:45:38'),
  ('I-007', 'I-007', 'I-007', 'depositorName-7', 'I-007', 'warehouseName-7', 'location-7', 'commodity-7', 89576.15, 'quantityUnit-7', 'medium', '2025-10-22 21:45:38', '2025-11-17 21:45:38', 47730897.08, 'NGN', 824, 'LI-007', 'PI-007', 'investigating', '2026-02-27 21:45:38', '2025-12-15 21:45:38'),
  ('I-008', 'I-008', 'I-008', 'depositorName-8', 'I-008', 'warehouseName-8', 'location-8', 'commodity-8', 4207.61, 'quantityUnit-8', 'low', '2025-05-12 21:45:38', '2026-04-02 21:45:38', 17324712.07, 'NGN', 453, 'LI-008', 'PI-008', 'resolved', '2025-06-11 21:45:38', '2026-01-01 21:45:38')
ON CONFLICT DO NOTHING;

-- Table: watchlist_sources
INSERT INTO "watchlist_sources" ("name", "source", "url", "format", "entries", "syncFrequency", "autoSync", "status", "created_at") VALUES
  ('Item 1 - Lagos', 'CBN', 'https://54bank.ng/api/v1/url/1', 'format-1', 766, 'syncFrequency-1', false, 'active', '2026-01-29 21:45:38'),
  ('Item 2 - Abuja', 'NIBSS', 'https://54bank.ng/api/v1/url/2', 'format-2', 848, 'syncFrequency-2', true, 'completed', '2025-07-29 21:45:38'),
  ('Item 3 - Kano', 'Interswitch', 'https://54bank.ng/api/v1/url/3', 'format-3', 713, 'syncFrequency-3', false, 'pending', '2026-03-18 21:45:38'),
  ('Item 4 - Port Harcourt', 'Flutterwave', 'https://54bank.ng/api/v1/url/4', 'format-4', 631, 'syncFrequency-4', true, 'processing', '2026-01-10 21:45:38'),
  ('Item 5 - Ibadan', 'Paystack', 'https://54bank.ng/api/v1/url/5', 'format-5', 249, 'syncFrequency-5', false, 'approved', '2025-08-14 21:45:38'),
  ('Item 6 - Enugu', 'NFIU', 'https://54bank.ng/api/v1/url/6', 'format-6', 232, 'syncFrequency-6', true, 'rejected', '2026-04-16 21:45:38'),
  ('Item 7 - Kaduna', 'OFAC', 'https://54bank.ng/api/v1/url/7', 'format-7', 103, 'syncFrequency-7', false, 'investigating', '2025-09-13 21:45:38'),
  ('Item 8 - Benin', 'WorldCheck', 'https://54bank.ng/api/v1/url/8', 'format-8', 103, 'syncFrequency-8', true, 'resolved', '2026-03-03 21:45:38')
ON CONFLICT DO NOTHING;
