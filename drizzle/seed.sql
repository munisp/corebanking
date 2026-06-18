-- 54Bank Platform — Comprehensive Postgres Seed Data
-- Generated from actual DB schema (information_schema)
-- Generated: 2026-05-12T16:36:54.847698
-- Tables: 267

-- Table: accounts
INSERT INTO "accounts" ("accountId", "customerId", "tenantId", "accountName", "accountType", "currency", "balance", "availableBalance", "ledgerBalance", "status", "branchCode", "openedAt", "lastTransactionAt", "version", "tigerbeetleAccountId", "createdAt", "updatedAt") VALUES
  ('ACCO-244156', 'CUST-560259', 'TENA-683081', 'Grace Adeniyi - approved', 'enterprise', 'EUR', 10950858.49, 16504247.08, 36564959.84, 'pending', 'BR-KN08', '2025-09-01 16:36:54'::timestamp, '2025-08-04 16:36:54'::timestamp, 7420, 'TIGE-726721', '2026-03-27 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp),
  ('ACCO-456628', 'CUST-640807', 'TENA-407516', 'Muhammed Lawal - completed', 'micro', 'USD', 4838756.7, 32278006.05, 47297910.73, 'approved', 'BR-OY05', '2025-11-01 16:36:54'::timestamp, '2025-05-31 16:36:54'::timestamp, 208, 'TIGE-479761', '2025-12-27 16:36:54'::timestamp, '2026-05-12 16:36:54'::timestamp),
  ('ACCO-340413', 'CUST-863314', 'TENA-121570', 'Abdullahi Sani - processing', 'premium', 'EUR', 12138305.11, 49031998.59, 35022733.48, 'approved', 'BR-RV75', '2026-02-11 16:36:54'::timestamp, '2025-09-30 16:36:54'::timestamp, 3918, 'TIGE-356393', '2025-06-23 16:36:54'::timestamp, '2025-07-11 16:36:54'::timestamp),
  ('ACCO-116810', 'CUST-778277', 'TENA-608546', 'Amina Garba - completed', 'enterprise', 'EUR', 21354533.85, 44717297.91, 18227214.51, 'active', 'BR-RV60', '2025-12-12 16:36:54'::timestamp, '2026-01-22 16:36:54'::timestamp, 5813, 'TIGE-607492', '2025-12-16 16:36:54'::timestamp, '2026-04-01 16:36:54'::timestamp),
  ('ACCO-161381', 'CUST-787882', 'TENA-630270', 'Babajide Williams - pending', 'micro', 'EUR', 45366705.55, 46479665.85, 38870711.25, 'rejected', 'BR-AB65', '2025-12-07 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp, 4490, 'TIGE-907132', '2026-04-20 16:36:54'::timestamp, '2026-03-24 16:36:54'::timestamp),
  ('ACCO-733990', 'CUST-434915', 'TENA-502904', 'Nkechi Nwankwo - approved', 'enterprise', 'USD', 21496562.91, 15854563.08, 21816864.22, 'processing', 'BR-OY13', '2026-03-01 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp, 9139, 'TIGE-456031', '2025-09-18 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp),
  ('ACCO-724227', 'CUST-790036', 'TENA-238448', 'Muhammed Lawal - completed', 'basic', 'USD', 38650483.21, 27843382.68, 46497924.94, 'completed', 'BR-AB14', '2025-09-16 16:36:54'::timestamp, '2026-03-25 16:36:54'::timestamp, 3299, 'TIGE-721185', '2026-03-11 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('ACCO-286539', 'CUST-833235', 'TENA-357241', 'Zainab Mohammed - pending', 'premium', 'USD', 31466853.9, 16639296.86, 15988638.34, 'pending', 'BR-RV34', '2025-07-17 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp, 8518, 'TIGE-968049', '2026-04-23 16:36:54'::timestamp, '2026-05-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: acgsf_guarantee
INSERT INTO "acgsf_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-121291', 'RECO-758572', 'Blessing Okoro', 'basic', 'Processed for Hauwa Yusuf in Delta - completed', 'approved', 16793291.88, 'Abuja', 'REF-338547', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-24 16:36:54'::timestamp, '2025-08-28 16:36:54'::timestamp),
  ('TENA-502974', 'RECO-618645', 'Abdullahi Sani', 'premium', 'Processed for Aisha Bello in Enugu - approved', 'rejected', 2795716.26, 'Ogun', 'REF-348825', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-10 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp),
  ('TENA-142875', 'RECO-677666', 'Ifeanyi Obi', 'enterprise', 'Processed for Chidinma Okafor in Enugu - pending', 'approved', 44609405.82, 'Enugu', 'REF-117932', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-31 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp),
  ('TENA-680352', 'RECO-888362', 'Ifeanyi Obi', 'enterprise', 'Processed for Victoria Etim in Lagos - active', 'pending', 40267359.39, 'Abuja', 'REF-612816', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-20 16:36:54'::timestamp, '2025-12-24 16:36:54'::timestamp),
  ('TENA-980590', 'RECO-677641', 'Yusuf Ibrahim', 'basic', 'Processed for Ifeanyi Obi in Abuja - rejected', 'processing', 37848004.93, 'Delta', 'REF-112291', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-07 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp),
  ('TENA-451182', 'RECO-609951', 'Fatima Abdulrahman', 'corporate', 'Processed for Nkechi Nwankwo in Anambra - rejected', 'pending', 48411046.21, 'Delta', 'REF-489315', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-11 16:36:54'::timestamp, '2025-07-15 16:36:54'::timestamp),
  ('TENA-838579', 'RECO-667995', 'Joy Okonkwo', 'enterprise', 'Processed for Halima Usman in Ogun - completed', 'active', 19639734.93, 'Delta', 'REF-544047', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-05 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('TENA-959268', 'RECO-296721', 'Rasheed Olanrewaju', 'micro', 'Processed for Suleiman Abubakar in Lagos - approved', 'processing', 14642441.14, 'Abuja', 'REF-422306', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-06 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: adverse_media_hits
INSERT INTO "adverse_media_hits" ("entity_name", "source", "headline", "risk_impact", "sentiment", "url", "detected_at", "reviewed_at", "status") VALUES
  ('Sterling Microfinance Bank', 'OFAC', 'Processed for Kabiru Aliyu in Enugu - completed', 'Kabiru Aliyu - completed', 9438.19, 'https://api.54bank.ng/adverse_media_hits/654278', '2026-02-18 16:36:54'::timestamp, '2025-10-24 16:36:54'::timestamp, 'pending'),
  ('Sterling Microfinance Bank', 'OFAC', 'Processed for Chukwuemeka Nwosu in Abuja - approved', 'Musa Danjuma - completed', 9150.78, 'https://api.54bank.ng/adverse_media_hits/854150', '2026-03-26 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp, 'processing'),
  ('Zenith Bank PLC', 'API', 'Processed for Abdullahi Sani in Abuja - active', 'Yusuf Ibrahim - rejected', 3545.99, 'https://api.54bank.ng/adverse_media_hits/137545', '2026-04-15 16:36:54'::timestamp, '2026-02-04 16:36:54'::timestamp, 'rejected'),
  ('Access Bank PLC', 'internal', 'Processed for Chioma Nnamdi in Abuja - completed', 'Halima Usman - pending', 3053.21, 'https://api.54bank.ng/adverse_media_hits/926691', '2025-09-30 16:36:54'::timestamp, '2026-04-05 16:36:54'::timestamp, 'processing'),
  ('Lagos Farms Cooperative', 'CBN', 'Processed for Halima Usman in Rivers - approved', 'Aisha Bello - approved', 9248.42, 'https://api.54bank.ng/adverse_media_hits/509316', '2025-05-20 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp, 'approved'),
  ('FCMB Group', 'API', 'Processed for Yusuf Ibrahim in Oyo - pending', 'Ifeanyi Obi - approved', 7324.76, 'https://api.54bank.ng/adverse_media_hits/992758', '2026-01-10 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp, 'processing'),
  ('Seplat Energy', 'OFAC', 'Processed for Chioma Nnamdi in Ogun - processing', 'Joy Okonkwo - active', 8586.3, 'https://api.54bank.ng/adverse_media_hits/530659', '2026-02-09 16:36:54'::timestamp, '2025-08-19 16:36:54'::timestamp, 'pending'),
  ('FCMB Group', 'OFAC', 'Processed for Nkechi Nwankwo in Kano - pending', 'Abdullahi Sani - approved', 4673.02, 'https://api.54bank.ng/adverse_media_hits/544164', '2025-07-29 16:36:54'::timestamp, '2025-12-10 16:36:54'::timestamp, 'completed')
ON CONFLICT DO NOTHING;

-- Table: adverse_media_scans
INSERT INTO "adverse_media_scans" ("customerId", "customerName", "relevantArticles", "sentiment", "riskImpact", "status", "created_at") VALUES
  ('CUST-682365', 'Obinna Igwe', 2110, 'neutral', 'Grace Adeniyi - active', 'processing', '2026-05-10 16:36:54'::timestamp),
  ('CUST-291526', 'Joy Okonkwo', 1890, 'positive', 'Emmanuel Ogbonna - completed', 'completed', '2025-12-20 16:36:54'::timestamp),
  ('CUST-297896', 'Kabiru Aliyu', 3933, 'negative', 'Musa Danjuma - processing', 'processing', '2026-05-05 16:36:54'::timestamp),
  ('CUST-562474', 'Babajide Williams', 692, 'positive', 'Ngozi Eze - pending', 'rejected', '2025-09-10 16:36:54'::timestamp),
  ('CUST-616061', 'Ifeanyi Obi', 3121, 'negative', 'Fatima Abdulrahman - rejected', 'rejected', '2025-10-14 16:36:54'::timestamp),
  ('CUST-470044', 'Yusuf Ibrahim', 638, 'positive', 'Adebayo Ogundimu - approved', 'active', '2025-05-31 16:36:54'::timestamp),
  ('CUST-943393', 'Musa Danjuma', 6015, 'positive', 'Yusuf Ibrahim - processing', 'rejected', '2026-04-15 16:36:54'::timestamp),
  ('CUST-126150', 'Obinna Igwe', 4287, 'neutral', 'Amina Garba - rejected', 'pending', '2026-04-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agentBankingAgents
INSERT INTO "agentBankingAgents" ("agentId", "tenantId", "agentCode", "businessName", "ownerName", "phoneNumber", "email", "bvn", "lga", "state", "agentType", "superAgentId", "floatBalance", "commissionEarned", "transactionCount", "kycStatus", "status", "createdAt", "updatedAt") VALUES
  ('AGEN-731803', 'TENA-977748', 'CODE-900709', 'Victoria Etim', 'Joy Okonkwo', '+2348787166211', 'kabiru.aliyu@54bank.ng', '12253378899', 'Ikorodu', 'Oyo', 'standard', 'SUPE-454805', 36327509.46, 2410.55, 377, 'rejected', 'processing', '2025-07-26 16:36:54'::timestamp, '2026-02-19 16:36:54'::timestamp),
  ('AGEN-990020', 'TENA-912425', 'CODE-303602', 'Kabiru Aliyu', 'Yusuf Ibrahim', '+2348452339970', 'amina.garba@54bank.ng', '99696239473', 'Ikorodu', 'Rivers', 'premium', 'SUPE-754539', 21966968.23, 7225.97, 156, 'processing', 'completed', '2025-05-15 16:36:54'::timestamp, '2026-04-17 16:36:54'::timestamp),
  ('AGEN-979539', 'TENA-578674', 'CODE-106789', 'Suleiman Abubakar', 'Folake Bakare', '+2348121996578', 'kabiru.aliyu@54bank.ng', '66448098279', 'Ikeja', 'Abuja', 'corporate', 'SUPE-775099', 42060218.49, 5580.43, 192, 'active', 'approved', '2025-06-09 16:36:54'::timestamp, '2025-08-20 16:36:54'::timestamp),
  ('AGEN-954780', 'TENA-738991', 'CODE-818748', 'Zainab Mohammed', 'Obinna Igwe', '+2348230681462', 'yusuf.ibrahim@54bank.ng', '75933254936', 'Ikorodu', 'Abuja', 'basic', 'SUPE-718626', 30061507.52, 7133.29, 426, 'completed', 'completed', '2025-10-21 16:36:54'::timestamp, '2026-04-08 16:36:54'::timestamp),
  ('AGEN-210896', 'TENA-671579', 'CODE-189568', 'Halima Usman', 'Nkechi Nwankwo', '+2347951569122', 'victoria.etim@54bank.ng', '57192058335', 'Ikeja', 'Abuja', 'basic', 'SUPE-406850', 42257109.19, 7626.36, 181, 'approved', 'pending', '2025-11-06 16:36:54'::timestamp, '2025-12-11 16:36:54'::timestamp),
  ('AGEN-836622', 'TENA-941884', 'CODE-639974', 'Muhammed Lawal', 'Chukwuemeka Nwosu', '+2348865282957', 'blessing.okoro@54bank.ng', '97646916711', 'Alimosho', 'Kano', 'corporate', 'SUPE-388351', 16842084.85, 9757.96, 375, 'rejected', 'approved', '2025-07-30 16:36:54'::timestamp, '2026-01-29 16:36:54'::timestamp),
  ('AGEN-501927', 'TENA-740100', 'CODE-890818', 'Kabiru Aliyu', 'Suleiman Abubakar', '+2348528334987', 'grace.adeniyi@54bank.ng', '86109238052', 'Ikorodu', 'Delta', 'corporate', 'SUPE-446972', 41997765.36, 9306.17, 258, 'completed', 'active', '2025-09-06 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp),
  ('AGEN-128935', 'TENA-175345', 'CODE-635014', 'Grace Adeniyi', 'Tunde Akinola', '+2348872028610', 'zainab.mohammed@54bank.ng', '35130532416', 'Lekki', 'Delta', 'basic', 'SUPE-301068', 22387270.51, 2464.45, 453, 'approved', 'completed', '2025-09-29 16:36:54'::timestamp, '2026-02-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agent_farmer_onboarding
INSERT INTO "agent_farmer_onboarding" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-933669', 'RECO-178244', 'Tunde Akinola', 'corporate', 'Processed for Zainab Mohammed in Ogun - approved', 'approved', 13659927.16, 'Kano', 'REF-360173', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-23 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  ('TENA-311128', 'RECO-511273', 'Adebayo Ogundimu', 'corporate', 'Processed for Kabiru Aliyu in Ogun - pending', 'rejected', 48108302.05, 'Ogun', 'REF-333460', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-17 16:36:54'::timestamp, '2026-03-30 16:36:54'::timestamp),
  ('TENA-927008', 'RECO-638898', 'Blessing Okoro', 'corporate', 'Processed for Adebayo Ogundimu in Ogun - completed', 'completed', 33530987.25, 'Ogun', 'REF-106994', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-29 16:36:54'::timestamp, '2025-10-23 16:36:54'::timestamp),
  ('TENA-257920', 'RECO-837274', 'Obinna Igwe', 'enterprise', 'Processed for Folake Bakare in Oyo - approved', 'processing', 4220843.82, 'Oyo', 'REF-262189', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-16 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp),
  ('TENA-982799', 'RECO-694385', 'Obinna Igwe', 'micro', 'Processed for Adebayo Ogundimu in Delta - active', 'active', 17502931.13, 'Kaduna', 'REF-491203', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-22 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp),
  ('TENA-748421', 'RECO-793439', 'Tunde Akinola', 'micro', 'Processed for Babajide Williams in Anambra - processing', 'completed', 23769710.94, 'Rivers', 'REF-583142', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-26 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-516450', 'RECO-265422', 'Muhammed Lawal', 'basic', 'Processed for Adebayo Ogundimu in Abuja - pending', 'approved', 11870632.89, 'Ogun', 'REF-757376', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-15 16:36:54'::timestamp, '2025-10-20 16:36:54'::timestamp),
  ('TENA-666420', 'RECO-636637', 'Khadija Musa', 'basic', 'Processed for Rasheed Olanrewaju in Enugu - completed', 'approved', 25678011.37, 'Lagos', 'REF-509898', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-12 16:36:54'::timestamp, '2026-03-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agent_kyc_captures
INSERT INTO "agent_kyc_captures" ("agent_id", "agent_name", "customer_id", "customer_name", "lga", "state", "offline_capture", "quality_score", "gps_lat", "gps_lng", "synced_at", "created_at") VALUES
  ('AGEN-991859', 'Aisha Bello', 'CUST-442340', 'Chukwuemeka Nwosu', 'Alimosho', 'Kaduna', 1315, 8854.77, 13.226023, 5.228282, '2025-06-08 16:36:54'::timestamp, '2025-06-08 16:36:54'::timestamp),
  ('AGEN-901172', 'Folake Bakare', 'CUST-406338', 'Adebayo Ogundimu', 'Victoria Island', 'Oyo', 5562, 7328.01, 13.163364, 3.274097, '2025-08-08 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('AGEN-798078', 'Victoria Etim', 'CUST-660583', 'Kabiru Aliyu', 'Victoria Island', 'Anambra', 9762, 459.06, 10.176241, 6.324514, '2026-03-21 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp),
  ('AGEN-377258', 'Ifeanyi Obi', 'CUST-761298', 'Yusuf Ibrahim', 'Ikeja', 'Enugu', 7399, 2461.51, 11.334535, 7.745116, '2025-08-24 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('AGEN-912966', 'Grace Adeniyi', 'CUST-599970', 'Ngozi Eze', 'Ikeja', 'Rivers', 6839, 7477.0, 11.121865, 2.189018, '2026-05-06 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp),
  ('AGEN-867630', 'Tunde Akinola', 'CUST-412406', 'Tunde Akinola', 'Surulere', 'Lagos', 4888, 7430.33, 12.353954, 5.729353, '2025-10-27 16:36:54'::timestamp, '2026-02-01 16:36:54'::timestamp),
  ('AGEN-543792', 'Nkechi Nwankwo', 'CUST-521228', 'Amina Garba', 'Lekki', 'Rivers', 7197, 9607.15, 11.734758, 10.169772, '2025-12-05 16:36:54'::timestamp, '2026-02-05 16:36:54'::timestamp),
  ('AGEN-487772', 'Obinna Igwe', 'CUST-239279', 'Oluwaseun Adeyemi', 'Surulere', 'Rivers', 8092, 2897.34, 8.709894, 12.024699, '2026-05-04 16:36:54'::timestamp, '2025-07-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: aggregation_center
INSERT INTO "aggregation_center" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-912659', 'RECO-776952', 'Ngozi Eze', 'standard', 'Processed for Ifeanyi Obi in Lagos - rejected', 'approved', 47190531.67, 'Anambra', 'REF-370032', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-29 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp),
  ('TENA-387213', 'RECO-348611', 'Chioma Nnamdi', 'enterprise', 'Processed for Segun Oladipo in Abuja - processing', 'pending', 11413318.42, 'Anambra', 'REF-942187', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-05 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp),
  ('TENA-254472', 'RECO-422633', 'Chukwuemeka Nwosu', 'premium', 'Processed for Tunde Akinola in Rivers - active', 'active', 30704398.31, 'Ogun', 'REF-215564', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-19 16:36:54'::timestamp, '2025-12-01 16:36:54'::timestamp),
  ('TENA-862783', 'RECO-725704', 'Rasheed Olanrewaju', 'basic', 'Processed for Emmanuel Ogbonna in Anambra - pending', 'processing', 6985885.26, 'Anambra', 'REF-468708', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-28 16:36:54'::timestamp, '2025-07-04 16:36:54'::timestamp),
  ('TENA-334961', 'RECO-351852', 'Kabiru Aliyu', 'basic', 'Processed for Musa Danjuma in Ogun - completed', 'processing', 5572398.21, 'Enugu', 'REF-468989', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp),
  ('TENA-129037', 'RECO-994461', 'Muhammed Lawal', 'enterprise', 'Processed for Victoria Etim in Rivers - rejected', 'approved', 1146786.02, 'Kaduna', 'REF-821985', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-25 16:36:54'::timestamp, '2025-12-22 16:36:54'::timestamp),
  ('TENA-395105', 'RECO-162272', 'Kabiru Aliyu', 'basic', 'Processed for Babajide Williams in Delta - pending', 'processing', 29080157.21, 'Ogun', 'REF-852651', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-13 16:36:54'::timestamp, '2025-06-29 16:36:54'::timestamp),
  ('TENA-657595', 'RECO-886148', 'Joy Okonkwo', 'micro', 'Processed for Adebayo Ogundimu in Abuja - processing', 'active', 5025478.49, 'Ogun', 'REF-979241', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-26 16:36:54'::timestamp, '2026-02-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agriLoans
INSERT INTO "agriLoans" ("loanId", "tenantId", "farmerId", "loanType", "productCode", "principalAmount", "interestRateBps", "tenorMonths", "currency", "purpose", "collateralType", "collateralValue", "cropCycle", "expectedHarvestDate", "disbursementDate", "maturityDate", "outstandingBalance", "totalRepaid", "status", "approvalStatus", "riskGrade", "repaymentSchedule", "createdAt", "updatedAt") VALUES
  ('LOAN-292027', 'TENA-720631', 'FARM-664477', 'enterprise', 'CODE-900423', 42408308.38, 40, 74, 'USD', 'Processed for Musa Danjuma in Abuja - active', 'standard', 8141268.05, 'Sorghum', 'Khadija Musa - completed', 'Emmanuel Ogbonna - pending', 'https://api.54bank.ng/agriLoans/479379', 37987166.84, 4681.71, 'processing', 'pending', 'B', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-20 16:36:54'::timestamp, '2026-05-11 16:36:54'::timestamp),
  ('LOAN-650076', 'TENA-480444', 'FARM-760837', 'standard', 'CODE-871241', 27829875.1, 291, 131, 'NGN', 'Processed for Obinna Igwe in Ogun - approved', 'basic', 17746097.14, 'Cocoa', 'Ngozi Eze - processing', 'Khadija Musa - active', 'https://api.54bank.ng/agriLoans/463132', 1224692.06, 6234.87, 'processing', 'pending', 'A', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-04 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp),
  ('LOAN-266574', 'TENA-526966', 'FARM-912422', 'premium', 'CODE-298452', 28336200.67, 154, 293, 'GBP', 'Processed for Muhammed Lawal in Kano - active', 'basic', 15925374.15, 'Maize', 'Chidinma Okafor - approved', 'Suleiman Abubakar - approved', 'https://api.54bank.ng/agriLoans/766264', 1559495.08, 7773.78, 'active', 'approved', 'D', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-24 16:36:54'::timestamp, '2025-06-25 16:36:54'::timestamp),
  ('LOAN-807656', 'TENA-578374', 'FARM-854936', 'corporate', 'CODE-378993', 24138056.68, 5, 25, 'NGN', 'Processed for Chioma Nnamdi in Kano - processing', 'corporate', 12885299.63, 'Maize', 'Chidinma Okafor - pending', 'Tunde Akinola - active', 'https://api.54bank.ng/agriLoans/166304', 18323136.35, 9943.22, 'completed', 'rejected', 'C', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-25 16:36:54'::timestamp, '2025-09-25 16:36:54'::timestamp),
  ('LOAN-845173', 'TENA-749921', 'FARM-214785', 'standard', 'CODE-315608', 44418880.23, 232, 344, 'NGN', 'Processed for Obinna Igwe in Enugu - pending', 'premium', 7077925.76, 'Maize', 'Abdullahi Sani - processing', 'Khadija Musa - approved', 'https://api.54bank.ng/agriLoans/102489', 45471581.94, 7705.14, 'pending', 'rejected', 'A', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-07 16:36:54'::timestamp, '2025-09-25 16:36:54'::timestamp),
  ('LOAN-488275', 'TENA-343783', 'FARM-894505', 'premium', 'CODE-735272', 26056127.46, 270, 102, 'USD', 'Processed for Oluwaseun Adeyemi in Oyo - approved', 'basic', 5542779.63, 'Cassava', 'Khadija Musa - approved', 'Segun Oladipo - completed', 'https://api.54bank.ng/agriLoans/206005', 204352.28, 377.03, 'pending', 'pending', 'B', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-16 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  ('LOAN-814510', 'TENA-942109', 'FARM-779647', 'corporate', 'CODE-431421', 209142.91, 280, 121, 'GBP', 'Processed for Blessing Okoro in Abuja - pending', 'standard', 7138191.55, 'Millet', 'Chioma Nnamdi - pending', 'Suleiman Abubakar - active', 'https://api.54bank.ng/agriLoans/584174', 9312812.63, 4074.4, 'processing', 'rejected', 'B', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp),
  ('LOAN-968853', 'TENA-856380', 'FARM-760413', 'corporate', 'CODE-479858', 37927667.37, 77, 286, 'USD', 'Processed for Hauwa Yusuf in Kaduna - active', 'basic', 20291955.21, 'Cassava', 'Tunde Akinola - processing', 'Fatima Abdulrahman - rejected', 'https://api.54bank.ng/agriLoans/257405', 12607129.91, 658.07, 'rejected', 'rejected', 'B', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-15 16:36:54'::timestamp, '2026-04-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_esg_impact
INSERT INTO "agri_esg_impact" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-514762', 'RECO-253968', 'Victoria Etim', 'enterprise', 'Processed for Nkechi Nwankwo in Kano - processing', 'completed', 9673587.29, 'Ogun', 'REF-975088', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-19 16:36:54'::timestamp, '2025-12-13 16:36:54'::timestamp),
  ('TENA-591543', 'RECO-718834', 'Victoria Etim', 'premium', 'Processed for Suleiman Abubakar in Enugu - approved', 'processing', 36789050.59, 'Kano', 'REF-241850', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-25 16:36:54'::timestamp, '2026-04-01 16:36:54'::timestamp),
  ('TENA-293850', 'RECO-169305', 'Muhammed Lawal', 'micro', 'Processed for Amina Garba in Abuja - processing', 'rejected', 42060894.57, 'Lagos', 'REF-859762', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-27 16:36:54'::timestamp, '2025-12-10 16:36:54'::timestamp),
  ('TENA-735977', 'RECO-793794', 'Victoria Etim', 'basic', 'Processed for Muhammed Lawal in Rivers - pending', 'pending', 10629569.9, 'Anambra', 'REF-774696', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-20 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp),
  ('TENA-681654', 'RECO-888351', 'Hauwa Yusuf', 'enterprise', 'Processed for Emmanuel Ogbonna in Lagos - approved', 'rejected', 5046843.87, 'Enugu', 'REF-247806', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-19 16:36:54'::timestamp, '2026-04-12 16:36:54'::timestamp),
  ('TENA-632163', 'RECO-239987', 'Yusuf Ibrahim', 'premium', 'Processed for Zainab Mohammed in Kaduna - pending', 'completed', 35448551.66, 'Lagos', 'REF-351388', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-03 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp),
  ('TENA-257490', 'RECO-724460', 'Blessing Okoro', 'basic', 'Processed for Ifeanyi Obi in Oyo - pending', 'processing', 45831145.7, 'Lagos', 'REF-406265', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2026-05-02 16:36:54'::timestamp),
  ('TENA-665696', 'RECO-327976', 'Emmanuel Ogbonna', 'corporate', 'Processed for Muhammed Lawal in Ogun - approved', 'completed', 4423894.2, 'Rivers', 'REF-603814', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-23 16:36:54'::timestamp, '2025-08-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_evoucher
INSERT INTO "agri_evoucher" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-986676', 'RECO-182999', 'Zainab Mohammed', 'corporate', 'Processed for Ifeanyi Obi in Lagos - approved', 'completed', 12995373.81, 'Kaduna', 'REF-906622', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-11 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp),
  ('TENA-575691', 'RECO-799653', 'Nkechi Nwankwo', 'standard', 'Processed for Hauwa Yusuf in Lagos - completed', 'approved', 37903709.69, 'Rivers', 'REF-398462', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-14 16:36:54'::timestamp, '2025-12-26 16:36:54'::timestamp),
  ('TENA-499324', 'RECO-954362', 'Oluwaseun Adeyemi', 'standard', 'Processed for Halima Usman in Oyo - active', 'approved', 516435.74, 'Anambra', 'REF-165966', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-31 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp),
  ('TENA-675293', 'RECO-404022', 'Rasheed Olanrewaju', 'premium', 'Processed for Obinna Igwe in Enugu - active', 'approved', 41680582.72, 'Delta', 'REF-498515', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-09 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp),
  ('TENA-311799', 'RECO-546280', 'Oluwaseun Adeyemi', 'basic', 'Processed for Yusuf Ibrahim in Rivers - processing', 'rejected', 23103241.3, 'Ogun', 'REF-942498', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-27 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp),
  ('TENA-981234', 'RECO-723642', 'Babajide Williams', 'enterprise', 'Processed for Khadija Musa in Oyo - active', 'rejected', 45222867.06, 'Ogun', 'REF-377634', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-05 16:36:54'::timestamp, '2025-06-29 16:36:54'::timestamp),
  ('TENA-828282', 'RECO-487368', 'Victoria Etim', 'corporate', 'Processed for Chidinma Okafor in Abuja - rejected', 'rejected', 44100771.96, 'Ogun', 'REF-348171', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-02 16:36:54'::timestamp, '2025-08-16 16:36:54'::timestamp),
  ('TENA-818236', 'RECO-575883', 'Suleiman Abubakar', 'basic', 'Processed for Joy Okonkwo in Lagos - active', 'completed', 10879065.16, 'Anambra', 'REF-494512', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-19 16:36:54'::timestamp, '2026-03-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_input_marketplace
INSERT INTO "agri_input_marketplace" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-721707', 'RECO-711992', 'Zainab Mohammed', 'enterprise', 'Processed for Muhammed Lawal in Kano - pending', 'approved', 15662852.1, 'Anambra', 'REF-955213', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-14 16:36:54'::timestamp, '2026-04-12 16:36:54'::timestamp),
  ('TENA-318321', 'RECO-753165', 'Blessing Okoro', 'micro', 'Processed for Rasheed Olanrewaju in Kaduna - active', 'rejected', 20599778.66, 'Ogun', 'REF-953801', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-18 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp),
  ('TENA-663935', 'RECO-492886', 'Nkechi Nwankwo', 'micro', 'Processed for Kabiru Aliyu in Ogun - processing', 'approved', 37892190.45, 'Kaduna', 'REF-389024', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-24 16:36:54'::timestamp, '2025-11-08 16:36:54'::timestamp),
  ('TENA-644737', 'RECO-669617', 'Tunde Akinola', 'corporate', 'Processed for Chidinma Okafor in Enugu - pending', 'rejected', 5429855.82, 'Abuja', 'REF-273908', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-15 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('TENA-118174', 'RECO-988789', 'Obinna Igwe', 'micro', 'Processed for Kabiru Aliyu in Delta - processing', 'active', 21093029.31, 'Delta', 'REF-246155', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-14 16:36:54'::timestamp, '2026-02-03 16:36:54'::timestamp),
  ('TENA-415979', 'RECO-549063', 'Blessing Okoro', 'corporate', 'Processed for Babajide Williams in Oyo - approved', 'pending', 16195073.13, 'Anambra', 'REF-707124', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-29 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp),
  ('TENA-686798', 'RECO-375994', 'Ngozi Eze', 'basic', 'Processed for Nkechi Nwankwo in Anambra - approved', 'pending', 15768944.48, 'Anambra', 'REF-702893', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-24 16:36:54'::timestamp, '2025-07-06 16:36:54'::timestamp),
  ('TENA-416156', 'RECO-768103', 'Hauwa Yusuf', 'basic', 'Processed for Musa Danjuma in Abuja - completed', 'rejected', 5894707.69, 'Kaduna', 'REF-867984', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-14 16:36:54'::timestamp, '2026-03-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_iot_sensor
INSERT INTO "agri_iot_sensor" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-923052', 'RECO-329659', 'Kabiru Aliyu', 'enterprise', 'Processed for Halima Usman in Kano - rejected', 'completed', 34331905.78, 'Rivers', 'REF-819183', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-23 16:36:54'::timestamp, '2025-08-13 16:36:54'::timestamp),
  ('TENA-906117', 'RECO-544571', 'Chidinma Okafor', 'micro', 'Processed for Aisha Bello in Lagos - rejected', 'active', 22458854.24, 'Kano', 'REF-746359', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-05 16:36:54'::timestamp, '2025-12-24 16:36:54'::timestamp),
  ('TENA-409279', 'RECO-675431', 'Oluwaseun Adeyemi', 'standard', 'Processed for Nkechi Nwankwo in Lagos - rejected', 'completed', 45250645.33, 'Kano', 'REF-504884', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-24 16:36:54'::timestamp, '2025-09-28 16:36:54'::timestamp),
  ('TENA-685638', 'RECO-211320', 'Chidinma Okafor', 'basic', 'Processed for Tunde Akinola in Oyo - approved', 'processing', 49156951.83, 'Enugu', 'REF-350906', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-27 16:36:54'::timestamp, '2025-05-29 16:36:54'::timestamp),
  ('TENA-996714', 'RECO-630452', 'Ngozi Eze', 'standard', 'Processed for Segun Oladipo in Rivers - active', 'approved', 41752539.54, 'Ogun', 'REF-505686', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-17 16:36:54'::timestamp, '2025-10-03 16:36:54'::timestamp),
  ('TENA-112208', 'RECO-875947', 'Folake Bakare', 'premium', 'Processed for Babajide Williams in Lagos - completed', 'completed', 20343346.95, 'Ogun', 'REF-819992', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-16 16:36:54'::timestamp, '2025-12-06 16:36:54'::timestamp),
  ('TENA-838162', 'RECO-668166', 'Chukwuemeka Nwosu', 'micro', 'Processed for Amina Garba in Delta - approved', 'rejected', 44802851.52, 'Lagos', 'REF-332544', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-11 16:36:54'::timestamp, '2025-09-09 16:36:54'::timestamp),
  ('TENA-767571', 'RECO-606693', 'Chukwuemeka Nwosu', 'enterprise', 'Processed for Kabiru Aliyu in Kano - approved', 'pending', 6591623.92, 'Delta', 'REF-183376', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-08 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_logistics
INSERT INTO "agri_logistics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-251140', 'RECO-104193', 'Rasheed Olanrewaju', 'corporate', 'Processed for Chioma Nnamdi in Lagos - completed', 'processing', 8292695.51, 'Kano', 'REF-346455', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-18 16:36:54'::timestamp, '2026-04-22 16:36:54'::timestamp),
  ('TENA-491841', 'RECO-720836', 'Aisha Bello', 'corporate', 'Processed for Ngozi Eze in Ogun - active', 'approved', 32510249.41, 'Anambra', 'REF-593553', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-14 16:36:54'::timestamp, '2025-10-17 16:36:54'::timestamp),
  ('TENA-265015', 'RECO-276881', 'Chioma Nnamdi', 'basic', 'Processed for Victoria Etim in Kaduna - rejected', 'pending', 37689657.02, 'Abuja', 'REF-363953', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-21 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp),
  ('TENA-873052', 'RECO-233510', 'Muhammed Lawal', 'corporate', 'Processed for Chukwuemeka Nwosu in Ogun - pending', 'active', 27460694.09, 'Rivers', 'REF-297765', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-20 16:36:54'::timestamp, '2025-11-17 16:36:54'::timestamp),
  ('TENA-110992', 'RECO-165785', 'Fatima Abdulrahman', 'standard', 'Processed for Muhammed Lawal in Kaduna - completed', 'processing', 3245693.13, 'Oyo', 'REF-418150', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-20 16:36:54'::timestamp, '2025-08-31 16:36:54'::timestamp),
  ('TENA-923572', 'RECO-686281', 'Segun Oladipo', 'basic', 'Processed for Fatima Abdulrahman in Rivers - pending', 'pending', 10931395.45, 'Kaduna', 'REF-898609', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-06-01 16:36:54'::timestamp),
  ('TENA-479073', 'RECO-286346', 'Kabiru Aliyu', 'basic', 'Processed for Victoria Etim in Lagos - pending', 'rejected', 9492118.09, 'Delta', 'REF-309371', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-09 16:36:54'::timestamp, '2025-05-16 16:36:54'::timestamp),
  ('TENA-291360', 'RECO-104457', 'Nkechi Nwankwo', 'micro', 'Processed for Halima Usman in Kaduna - rejected', 'processing', 30833068.43, 'Lagos', 'REF-826515', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-20 16:36:54'::timestamp, '2025-07-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_reinsurance
INSERT INTO "agri_reinsurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-684349', 'RECO-580431', 'Amina Garba', 'enterprise', 'Processed for Segun Oladipo in Kaduna - processing', 'active', 32268681.79, 'Enugu', 'REF-822018', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-03 16:36:54'::timestamp, '2025-09-02 16:36:54'::timestamp),
  ('TENA-470083', 'RECO-966747', 'Nkechi Nwankwo', 'micro', 'Processed for Zainab Mohammed in Oyo - processing', 'rejected', 17069030.87, 'Oyo', 'REF-983465', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-04 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  ('TENA-984843', 'RECO-364011', 'Emmanuel Ogbonna', 'premium', 'Processed for Abdullahi Sani in Oyo - completed', 'active', 8200839.67, 'Rivers', 'REF-529081', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-06 16:36:54'::timestamp, '2025-10-31 16:36:54'::timestamp),
  ('TENA-137645', 'RECO-727616', 'Chukwuemeka Nwosu', 'enterprise', 'Processed for Babajide Williams in Rivers - rejected', 'processing', 17412106.52, 'Enugu', 'REF-692909', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-09 16:36:54'::timestamp, '2025-07-21 16:36:54'::timestamp),
  ('TENA-689790', 'RECO-945220', 'Segun Oladipo', 'micro', 'Processed for Nkechi Nwankwo in Lagos - processing', 'active', 12711070.81, 'Delta', 'REF-800404', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-26 16:36:54'::timestamp, '2025-05-25 16:36:54'::timestamp),
  ('TENA-891605', 'RECO-380245', 'Ifeanyi Obi', 'basic', 'Processed for Folake Bakare in Rivers - rejected', 'pending', 11524169.61, 'Anambra', 'REF-881333', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-27 16:36:54'::timestamp, '2025-07-06 16:36:54'::timestamp),
  ('TENA-804074', 'RECO-174812', 'Zainab Mohammed', 'basic', 'Processed for Nkechi Nwankwo in Kano - rejected', 'completed', 16712568.33, 'Enugu', 'REF-981923', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-23 16:36:54'::timestamp, '2026-01-12 16:36:54'::timestamp),
  ('TENA-669484', 'RECO-293448', 'Ifeanyi Obi', 'corporate', 'Processed for Suleiman Abubakar in Kano - approved', 'processing', 30211663.16, 'Kano', 'REF-656126', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-11 16:36:54'::timestamp, '2026-03-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: agri_savings_cycles
INSERT INTO "agri_savings_cycles" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-435782', 'RECO-305567', 'Suleiman Abubakar', 'corporate', 'Processed for Joy Okonkwo in Kaduna - completed', 'processing', 47581664.56, 'Oyo', 'REF-278718', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-27 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('TENA-349217', 'RECO-188649', 'Nkechi Nwankwo', 'micro', 'Processed for Obinna Igwe in Kaduna - active', 'rejected', 493845.21, 'Delta', 'REF-219990', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-22 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('TENA-869277', 'RECO-304266', 'Grace Adeniyi', 'micro', 'Processed for Musa Danjuma in Lagos - rejected', 'approved', 12276051.32, 'Enugu', 'REF-755705', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2026-03-03 16:36:54'::timestamp),
  ('TENA-260070', 'RECO-893933', 'Joy Okonkwo', 'enterprise', 'Processed for Grace Adeniyi in Abuja - completed', 'rejected', 20378118.66, 'Enugu', 'REF-724688', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-20 16:36:54'::timestamp, '2025-09-12 16:36:54'::timestamp),
  ('TENA-542644', 'RECO-444938', 'Victoria Etim', 'corporate', 'Processed for Ifeanyi Obi in Rivers - active', 'pending', 42568682.74, 'Lagos', 'REF-205427', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-07 16:36:54'::timestamp, '2026-02-09 16:36:54'::timestamp),
  ('TENA-689309', 'RECO-215649', 'Joy Okonkwo', 'premium', 'Processed for Rasheed Olanrewaju in Ogun - completed', 'pending', 33240529.97, 'Kaduna', 'REF-593871', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-18 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('TENA-644002', 'RECO-493079', 'Chidinma Okafor', 'standard', 'Processed for Joy Okonkwo in Abuja - approved', 'active', 3785400.29, 'Oyo', 'REF-727529', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-03 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp),
  ('TENA-997439', 'RECO-609726', 'Musa Danjuma', 'enterprise', 'Processed for Chidinma Okafor in Lagos - rejected', 'pending', 48179351.42, 'Anambra', 'REF-568198', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: amlAlerts
INSERT INTO "amlAlerts" ("alertId", "tenantId", "customerId", "entityType", "entityId", "ruleId", "ruleName", "riskScore", "severity", "status", "assignedTo", "notes", "detectedAt", "resolvedAt", "createdAt") VALUES
  ('ALER-936359', 'TENA-942291', 'CUST-383973', 'enterprise', 'ENTI-962220', 'RULE-483054', 'Khadija Musa - rejected', 5323.32, 'info', 'completed', 'Segun Oladipo', 'Processed for Obinna Igwe in Ogun - active', '2026-04-14 16:36:54'::timestamp, '2026-01-27 16:36:54'::timestamp, '2025-08-16 16:36:54'::timestamp),
  ('ALER-989610', 'TENA-585131', 'CUST-836630', 'basic', 'ENTI-519672', 'RULE-490916', 'Halima Usman - active', 3602.95, 'high', 'completed', 'Suleiman Abubakar', 'Processed for Segun Oladipo in Abuja - completed', '2025-08-05 16:36:54'::timestamp, '2026-05-09 16:36:54'::timestamp, '2025-06-23 16:36:54'::timestamp),
  ('ALER-924654', 'TENA-183551', 'CUST-197779', 'basic', 'ENTI-547613', 'RULE-607301', 'Adebayo Ogundimu - processing', 2260.12, 'warning', 'processing', 'Babajide Williams', 'Processed for Emmanuel Ogbonna in Enugu - approved', '2025-05-21 16:36:54'::timestamp, '2025-06-23 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp),
  ('ALER-481511', 'TENA-436003', 'CUST-957881', 'basic', 'ENTI-720539', 'RULE-578989', 'Muhammed Lawal - processing', 7233.89, 'warning', 'pending', 'Chukwuemeka Nwosu', 'Processed for Halima Usman in Rivers - completed', '2025-07-23 16:36:54'::timestamp, '2026-05-07 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('ALER-998418', 'TENA-457000', 'CUST-900076', 'corporate', 'ENTI-673863', 'RULE-328221', 'Oluwaseun Adeyemi - rejected', 4544.65, 'info', 'rejected', 'Tunde Akinola', 'Processed for Nkechi Nwankwo in Kano - approved', '2025-07-29 16:36:54'::timestamp, '2025-12-24 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp),
  ('ALER-624874', 'TENA-205104', 'CUST-482350', 'standard', 'ENTI-972321', 'RULE-661048', 'Chioma Nnamdi - pending', 3521.76, 'medium', 'pending', 'Halima Usman', 'Processed for Folake Bakare in Anambra - pending', '2026-03-17 16:36:54'::timestamp, '2026-02-21 16:36:54'::timestamp, '2025-08-04 16:36:54'::timestamp),
  ('ALER-250318', 'TENA-328793', 'CUST-724370', 'standard', 'ENTI-381840', 'RULE-465913', 'Suleiman Abubakar - active', 441.57, 'critical', 'approved', 'Nkechi Nwankwo', 'Processed for Abdullahi Sani in Anambra - rejected', '2025-09-24 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp),
  ('ALER-298033', 'TENA-114757', 'CUST-949919', 'enterprise', 'ENTI-427599', 'RULE-908011', 'Rasheed Olanrewaju - active', 6501.32, 'high', 'pending', 'Hauwa Yusuf', 'Processed for Suleiman Abubakar in Oyo - processing', '2026-04-14 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: aml_cases
INSERT INTO "aml_cases" ("customerId", "customerName", "caseType", "riskLevel", "assignedTo", "sarFiled", "status", "created_at") VALUES
  ('CUST-671184', 'Segun Oladipo', 'corporate', 'Muhammed Lawal - completed', 'Halima Usman', false, 'active', '2025-09-18 16:36:54'::timestamp),
  ('CUST-765441', 'Obinna Igwe', 'standard', 'Rasheed Olanrewaju - pending', 'Babajide Williams', true, 'rejected', '2025-10-17 16:36:54'::timestamp),
  ('CUST-921377', 'Ifeanyi Obi', 'micro', 'Babajide Williams - pending', 'Nkechi Nwankwo', true, 'completed', '2026-01-05 16:36:54'::timestamp),
  ('CUST-941526', 'Zainab Mohammed', 'standard', 'Fatima Abdulrahman - approved', 'Victoria Etim', false, 'processing', '2025-06-24 16:36:54'::timestamp),
  ('CUST-751429', 'Halima Usman', 'standard', 'Musa Danjuma - pending', 'Chioma Nnamdi', true, 'approved', '2026-03-04 16:36:54'::timestamp),
  ('CUST-876846', 'Emmanuel Ogbonna', 'premium', 'Amina Garba - approved', 'Grace Adeniyi', false, 'pending', '2026-01-07 16:36:54'::timestamp),
  ('CUST-363057', 'Zainab Mohammed', 'standard', 'Khadija Musa - completed', 'Yusuf Ibrahim', false, 'completed', '2025-06-02 16:36:54'::timestamp),
  ('CUST-787664', 'Kabiru Aliyu', 'basic', 'Hauwa Yusuf - rejected', 'Tunde Akinola', true, 'processing', '2025-11-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: aml_compliance_metrics
INSERT INTO "aml_compliance_metrics" ("period", "totalScreenings", "sarsFiled", "ctrsFiled", "complianceScore", "status", "created_at") VALUES
  ('2026-Q1', 44510047, 9187, 1760, 42, 'rejected', '2025-09-12 16:36:54'::timestamp),
  ('2026-Q3', 9169311, 5019, 6286, 39, 'active', '2026-01-30 16:36:54'::timestamp),
  ('2026-Q3', 42954628, 1342, 1155, 34, 'active', '2025-09-02 16:36:54'::timestamp),
  ('2026-Q4', 25371375, 9261, 6337, 90, 'rejected', '2025-09-09 16:36:54'::timestamp),
  ('2026-Q2', 13197172, 9222, 1787, 29, 'approved', '2025-09-24 16:36:54'::timestamp),
  ('2026-Q4', 3616476, 1991, 1430, 24, 'completed', '2025-09-10 16:36:54'::timestamp),
  ('2026-Q4', 3827697, 931, 6575, 29, 'rejected', '2025-08-28 16:36:54'::timestamp),
  ('2026-Q3', 5898993, 3866, 7587, 63, 'rejected', '2025-06-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: aml_risk_scores
INSERT INTO "aml_risk_scores" ("customerId", "customerName", "riskScore", "riskLevel", "sanctionsHits", "pepMatch", "adverseMedia", "cddLevel", "status", "created_at") VALUES
  ('CUST-784190', 'Babajide Williams', 70, 'Chioma Nnamdi - active', 9528, true, 34, 'Ngozi Eze - rejected', 'rejected', '2026-01-14 16:36:54'::timestamp),
  ('CUST-711062', 'Adebayo Ogundimu', 20, 'Halima Usman - rejected', 1327, false, 6414, 'Grace Adeniyi - active', 'rejected', '2025-07-03 16:36:54'::timestamp),
  ('CUST-282506', 'Amina Garba', 42, 'Chioma Nnamdi - pending', 815, true, 9756, 'Ifeanyi Obi - active', 'rejected', '2025-09-04 16:36:54'::timestamp),
  ('CUST-422638', 'Chukwuemeka Nwosu', 85, 'Rasheed Olanrewaju - active', 3365, false, 4428, 'Hauwa Yusuf - rejected', 'rejected', '2025-08-15 16:36:54'::timestamp),
  ('CUST-970944', 'Halima Usman', 34, 'Abdullahi Sani - rejected', 2160, false, 9936, 'Khadija Musa - processing', 'completed', '2025-08-13 16:36:54'::timestamp),
  ('CUST-822020', 'Chukwuemeka Nwosu', 66, 'Abdullahi Sani - processing', 2026, true, 1861, 'Joy Okonkwo - rejected', 'rejected', '2025-06-01 16:36:54'::timestamp),
  ('CUST-318211', 'Joy Okonkwo', 18, 'Chidinma Okafor - approved', 6036, false, 2142, 'Chidinma Okafor - processing', 'processing', '2026-01-12 16:36:54'::timestamp),
  ('CUST-877015', 'Kabiru Aliyu', 96, 'Aisha Bello - processing', 188, true, 1223, 'Tunde Akinola - active', 'completed', '2025-08-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: aml_training_records
INSERT INTO "aml_training_records" ("staffId", "staffName", "role", "trainingModule", "score", "status", "created_at") VALUES
  ('STAF-297175', 'Segun Oladipo', 'branch', 'Adebayo Ogundimu - pending', 36, 'active', '2025-05-23 16:36:54'::timestamp),
  ('STAF-755546', 'Fatima Abdulrahman', 'branch', 'Folake Bakare - rejected', 69, 'processing', '2025-08-17 16:36:54'::timestamp),
  ('STAF-459218', 'Folake Bakare', 'compliance', 'Halima Usman - rejected', 99, 'completed', '2026-02-15 16:36:54'::timestamp),
  ('STAF-565301', 'Hauwa Yusuf', 'treasury', 'Segun Oladipo - processing', 26, 'active', '2026-01-07 16:36:54'::timestamp),
  ('STAF-736584', 'Musa Danjuma', 'treasury', 'Emmanuel Ogbonna - completed', 77, 'completed', '2025-12-22 16:36:54'::timestamp),
  ('STAF-782046', 'Nkechi Nwankwo', 'branch', 'Blessing Okoro - processing', 17, 'rejected', '2025-09-29 16:36:54'::timestamp),
  ('STAF-872836', 'Blessing Okoro', 'operations', 'Blessing Okoro - rejected', 67, 'active', '2026-01-15 16:36:54'::timestamp),
  ('STAF-829188', 'Blessing Okoro', 'operations', 'Adebayo Ogundimu - rejected', 72, 'rejected', '2025-05-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: animal_id_traceability
INSERT INTO "animal_id_traceability" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-609174', 'RECO-934831', 'Rasheed Olanrewaju', 'basic', 'Processed for Segun Oladipo in Abuja - active', 'completed', 38027641.81, 'Ogun', 'REF-188376', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-12 16:36:54'::timestamp, '2026-04-20 16:36:54'::timestamp),
  ('TENA-709757', 'RECO-959514', 'Emmanuel Ogbonna', 'premium', 'Processed for Zainab Mohammed in Kano - approved', 'processing', 24717020.15, 'Enugu', 'REF-711529', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-15 16:36:54'::timestamp, '2025-07-04 16:36:54'::timestamp),
  ('TENA-970196', 'RECO-540358', 'Joy Okonkwo', 'enterprise', 'Processed for Folake Bakare in Rivers - active', 'active', 18168270.44, 'Lagos', 'REF-751910', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-07 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('TENA-711602', 'RECO-888102', 'Chioma Nnamdi', 'premium', 'Processed for Kabiru Aliyu in Lagos - completed', 'completed', 19303753.7, 'Delta', 'REF-498098', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-01 16:36:54'::timestamp, '2025-12-13 16:36:54'::timestamp),
  ('TENA-830310', 'RECO-410536', 'Khadija Musa', 'enterprise', 'Processed for Hauwa Yusuf in Rivers - processing', 'active', 35984984.11, 'Kano', 'REF-296941', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-30 16:36:54'::timestamp, '2026-02-10 16:36:54'::timestamp),
  ('TENA-671040', 'RECO-925942', 'Grace Adeniyi', 'corporate', 'Processed for Amina Garba in Enugu - processing', 'approved', 43409864.09, 'Rivers', 'REF-260862', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-28 16:36:54'::timestamp, '2025-11-13 16:36:54'::timestamp),
  ('TENA-161072', 'RECO-964598', 'Fatima Abdulrahman', 'micro', 'Processed for Abdullahi Sani in Kaduna - rejected', 'rejected', 951965.05, 'Anambra', 'REF-514525', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-02 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('TENA-127135', 'RECO-927608', 'Chioma Nnamdi', 'standard', 'Processed for Kabiru Aliyu in Anambra - processing', 'approved', 25531809.69, 'Ogun', 'REF-882920', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-03 16:36:54'::timestamp, '2025-12-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: anomaly_models
INSERT INTO "anomaly_models" ("name", "model_type", "features", "accuracy", "precision", "recall", "f1_score", "training_size", "anomalies_24h", "true_positives", "status", "created_at") VALUES
  ('Babajide Williams', 'premium', '{"status": "active", "region": "Nigeria"}'::jsonb, 7009.04, 137.53, 1051.7, 980.03, 358, 4327, 445, 'completed', '2026-04-26 16:36:54'::timestamp),
  ('Musa Danjuma', 'basic', '{"status": "active", "region": "Nigeria"}'::jsonb, 1667.55, 3388.31, 8382.32, 4081.31, 200, 9426, 1644, 'completed', '2025-06-03 16:36:54'::timestamp),
  ('Yusuf Ibrahim', 'premium', '{"status": "active", "region": "Nigeria"}'::jsonb, 5795.0, 1997.08, 9575.06, 8631.88, 382, 9390, 3698, 'pending', '2025-10-27 16:36:54'::timestamp),
  ('Joy Okonkwo', 'standard', '{"status": "active", "region": "Nigeria"}'::jsonb, 665.56, 6330.0, 9494.99, 443.08, 434, 2632, 9649, 'approved', '2025-06-06 16:36:54'::timestamp),
  ('Ngozi Eze', 'enterprise', '{"status": "active", "region": "Nigeria"}'::jsonb, 9088.05, 7212.43, 6934.22, 1826.38, 256, 6509, 6019, 'rejected', '2025-06-23 16:36:54'::timestamp),
  ('Musa Danjuma', 'premium', '{"status": "active", "region": "Nigeria"}'::jsonb, 5608.41, 2537.04, 6949.45, 9181.68, 96, 4150, 1795, 'completed', '2026-03-21 16:36:54'::timestamp),
  ('Hauwa Yusuf', 'micro', '{"status": "active", "region": "Nigeria"}'::jsonb, 6401.61, 3225.79, 7811.14, 6435.08, 340, 3443, 3332, 'pending', '2026-03-16 16:36:54'::timestamp),
  ('Nkechi Nwankwo', 'micro', '{"status": "active", "region": "Nigeria"}'::jsonb, 8801.84, 6866.75, 9789.97, 9291.38, 194, 5858, 3745, 'approved', '2025-06-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: api_key_policies
INSERT INTO "api_key_policies" ("name", "prefix", "required_scopes", "ip_whitelist", "rate_limit", "rotation_warning_days", "active_keys", "violations_24h", "status", "created_at") VALUES
  ('Fatima Abdulrahman', 'REF-884130', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 3230, 223, 2846, 4707, 'rejected', '2025-08-19 16:36:54'::timestamp),
  ('Suleiman Abubakar', 'REF-999315', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 3578, 338, 3285, 4611, 'rejected', '2026-01-10 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'REF-381273', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 8289, 177, 5523, 7015, 'pending', '2025-11-30 16:36:54'::timestamp),
  ('Suleiman Abubakar', 'REF-900904', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 3169, 91, 4846, 9331, 'rejected', '2025-09-09 16:36:54'::timestamp),
  ('Victoria Etim', 'REF-511096', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 9482, 212, 9565, 8438, 'rejected', '2026-01-07 16:36:54'::timestamp),
  ('Grace Adeniyi', 'REF-162372', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 8220, 239, 5907, 1941, 'active', '2025-07-13 16:36:54'::timestamp),
  ('Fatima Abdulrahman', 'REF-304613', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 5197, 335, 8907, 1691, 'completed', '2026-05-01 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'REF-896406', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"status": "active", "region": "Nigeria"}'::jsonb, 298, 43, 4278, 5416, 'completed', '2025-11-15 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: api_keys
INSERT INTO "api_keys" ("api_key_id", "name", "key_prefix", "tenant_id", "scopes", "rate_limit", "status", "ip_whitelist", "usage_count", "last_used_at", "expires_at", "created_by", "created_at") VALUES
  ('API_-812976', 'Folake Bakare', '6fa90e7f8f39f41e4cdad7b19d573ebbae29dfd6a932eec0f9a24176dfeddfeb', 'TENA-203047', 'Adebayo Ogundimu - processing', 3737, 'approved', 'Zainab Mohammed - completed', 120, '2025-05-21 16:36:54'::timestamp, '2025-12-13 16:36:54'::timestamp, 'Hauwa Yusuf - completed', '2026-04-26 16:36:54'::timestamp),
  ('API_-551608', 'Yusuf Ibrahim', 'cafe08d57e8b5aa97019f23d32abbc52322bceab4dfc651e72aa50d9b98a35ac', 'TENA-386137', 'Hauwa Yusuf - approved', 4128, 'processing', 'Babajide Williams - processing', 264, '2026-02-21 16:36:54'::timestamp, '2026-02-18 16:36:54'::timestamp, 'Blessing Okoro - active', '2025-07-12 16:36:54'::timestamp),
  ('API_-203544', 'Fatima Abdulrahman', 'cddf558fefc2cd812bba7dd7eead0e1ccfaaf1ea66eebddaaabeaad4bfbe482c', 'TENA-171278', 'Yusuf Ibrahim - completed', 7167, 'pending', 'Babajide Williams - processing', 309, '2025-09-06 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp, 'Ngozi Eze - pending', '2025-11-06 16:36:54'::timestamp),
  ('API_-219618', 'Zainab Mohammed', '1ccbaa9b9bead96c5e11fed1cbcd437c1b55aad80aefdc59fd1fdfccceaeeba5', 'TENA-593462', 'Chioma Nnamdi - pending', 8555, 'rejected', 'Aisha Bello - approved', 484, '2025-08-12 16:36:54'::timestamp, '2026-04-25 16:36:54'::timestamp, 'Khadija Musa - completed', '2025-10-21 16:36:54'::timestamp),
  ('API_-610912', 'Halima Usman', '430e2a67e663cde3b5ce4439785a56ab4eaaadafb7cc33f78220d5b444e1ccc0', 'TENA-185928', 'Amina Garba - completed', 7826, 'pending', 'Chioma Nnamdi - active', 491, '2025-11-17 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp, 'Amina Garba - approved', '2026-01-02 16:36:54'::timestamp),
  ('API_-498707', 'Ngozi Eze', 'e415f9fdfbe3c0bfec32edb0dacb776d050f16be79bfce8ba3c883e9a95fbca9', 'TENA-166170', 'Suleiman Abubakar - completed', 447, 'approved', 'Musa Danjuma - completed', 53, '2026-03-29 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp, 'Blessing Okoro - approved', '2025-06-02 16:36:54'::timestamp),
  ('API_-298167', 'Abdullahi Sani', 'cbe46ccc478fcbebca78406cf8a1b05be2468b41c6e8dccab7efce778ecab98e', 'TENA-653674', 'Yusuf Ibrahim - completed', 2447, 'active', 'Khadija Musa - approved', 383, '2025-07-18 16:36:54'::timestamp, '2026-03-27 16:36:54'::timestamp, 'Emmanuel Ogbonna - processing', '2026-02-07 16:36:54'::timestamp),
  ('API_-752980', 'Zainab Mohammed', 'e1dab2770c9dcfcbcbb3be712e7a85dee81a9482cada77146e6bf4bfbaf407b6', 'TENA-165643', 'Fatima Abdulrahman - pending', 3610, 'approved', 'Muhammed Lawal - pending', 482, '2025-11-08 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp, 'Blessing Okoro - active', '2025-11-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: apisix_plugin_chains
INSERT INTO "apisix_plugin_chains" ("route", "avgLatencyMs", "latencySaving", "status", "created_at") VALUES
  ('/api/platform/apisix-plugin-chains', 4.950301, 'Yusuf Ibrahim - active', 'processing', '2026-02-28 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 7.894052, 'Babajide Williams - processing', 'approved', '2025-09-20 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 13.477182, 'Zainab Mohammed - completed', 'rejected', '2025-12-30 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 9.470784, 'Musa Danjuma - processing', 'processing', '2025-11-01 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 11.090219, 'Hauwa Yusuf - completed', 'processing', '2025-07-14 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 4.357147, 'Aisha Bello - approved', 'approved', '2026-02-20 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 11.488853, 'Halima Usman - completed', 'pending', '2026-04-08 16:36:54'::timestamp),
  ('/api/platform/apisix-plugin-chains', 13.522037, 'Abdullahi Sani - pending', 'pending', '2025-06-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: area_yield_index_insurance
INSERT INTO "area_yield_index_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-512748', 'RECO-874134', 'Victoria Etim', 'corporate', 'Processed for Ngozi Eze in Ogun - active', 'processing', 6770475.85, 'Anambra', 'REF-927051', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-12 16:36:54'::timestamp, '2026-02-04 16:36:54'::timestamp),
  ('TENA-482808', 'RECO-936950', 'Blessing Okoro', 'standard', 'Processed for Chidinma Okafor in Kaduna - approved', 'processing', 12440017.36, 'Abuja', 'REF-772229', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-01 16:36:54'::timestamp, '2026-01-24 16:36:54'::timestamp),
  ('TENA-451241', 'RECO-524313', 'Ifeanyi Obi', 'standard', 'Processed for Emmanuel Ogbonna in Kaduna - processing', 'rejected', 24990186.05, 'Anambra', 'REF-212077', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-19 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp),
  ('TENA-483884', 'RECO-628908', 'Musa Danjuma', 'standard', 'Processed for Abdullahi Sani in Lagos - pending', 'processing', 8899446.35, 'Kano', 'REF-931133', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-19 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp),
  ('TENA-806194', 'RECO-659329', 'Zainab Mohammed', 'corporate', 'Processed for Joy Okonkwo in Anambra - completed', 'approved', 15686255.2, 'Delta', 'REF-162423', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-30 16:36:54'::timestamp, '2026-02-10 16:36:54'::timestamp),
  ('TENA-465759', 'RECO-141713', 'Ifeanyi Obi', 'corporate', 'Processed for Ifeanyi Obi in Lagos - approved', 'pending', 41736549.24, 'Delta', 'REF-566850', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-21 16:36:54'::timestamp, '2026-04-06 16:36:54'::timestamp),
  ('TENA-954906', 'RECO-254749', 'Hauwa Yusuf', 'premium', 'Processed for Grace Adeniyi in Delta - active', 'active', 13922198.93, 'Kaduna', 'REF-558393', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-20 16:36:54'::timestamp, '2026-01-08 16:36:54'::timestamp),
  ('TENA-989255', 'RECO-759593', 'Amina Garba', 'basic', 'Processed for Ifeanyi Obi in Enugu - completed', 'completed', 40157650.93, 'Ogun', 'REF-697585', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-02 16:36:54'::timestamp, '2025-11-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: auditEntries
INSERT INTO "auditEntries" ("auditId", "timestampAt", "actorRole", "actorId", "entityType", "entityId", "action", "outcome", "severity", "route", "middleware", "detail") VALUES
  ('AUDI-900613', '2025-12-23 16:36:54'::timestamp, 'treasury', 'ACTO-403359', 'corporate', 'ENTI-688966', 'verify', 'Processed for Suleiman Abubakar in Enugu - approved', 'warning', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Zainab Mohammed in Ogun - rejected'),
  ('AUDI-908812', '2026-01-03 16:36:54'::timestamp, 'operations', 'ACTO-528203', 'corporate', 'ENTI-692539', 'approve', 'Processed for Hauwa Yusuf in Ogun - approved', 'medium', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Joy Okonkwo in Abuja - approved'),
  ('AUDI-667812', '2025-05-26 16:36:54'::timestamp, 'treasury', 'ACTO-934639', 'micro', 'ENTI-131044', 'verify', 'Processed for Yusuf Ibrahim in Oyo - active', 'low', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Nkechi Nwankwo in Kano - approved'),
  ('AUDI-610763', '2026-04-12 16:36:54'::timestamp, 'branch', 'ACTO-434864', 'standard', 'ENTI-351680', 'update', 'Processed for Kabiru Aliyu in Oyo - processing', 'info', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Khadija Musa in Anambra - rejected'),
  ('AUDI-822881', '2026-04-01 16:36:54'::timestamp, 'operations', 'ACTO-447047', 'basic', 'ENTI-785937', 'update', 'Processed for Victoria Etim in Kaduna - processing', 'medium', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Emmanuel Ogbonna in Lagos - completed'),
  ('AUDI-311016', '2025-06-04 16:36:54'::timestamp, 'branch', 'ACTO-455493', 'standard', 'ENTI-497763', 'reject', 'Processed for Abdullahi Sani in Abuja - rejected', 'high', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Blessing Okoro in Delta - approved'),
  ('AUDI-152154', '2025-08-15 16:36:54'::timestamp, 'treasury', 'ACTO-160532', 'enterprise', 'ENTI-836321', 'update', 'Processed for Chioma Nnamdi in Anambra - processing', 'critical', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Rasheed Olanrewaju in Ogun - rejected'),
  ('AUDI-155171', '2026-03-31 16:36:54'::timestamp, 'compliance', 'ACTO-212325', 'micro', 'ENTI-105924', 'reject', 'Processed for Aisha Bello in Kaduna - approved', 'low', '/api/platform/auditEntries', '{}'::jsonb, 'Processed for Victoria Etim in Delta - active')
ON CONFLICT DO NOTHING;

-- Table: auditTrail
INSERT INTO "auditTrail" ("auditId", "tenantId", "entityType", "entityId", "action", "actorId", "actorRole", "changes", "ipAddress", "userAgent", "createdAt") VALUES
  ('AUDI-490397', 'TENA-772474', 'premium', 'ENTI-189724', 'update', 'ACTO-605277', 'treasury', '{"status": "active", "region": "Nigeria"}'::jsonb, '179.6.116.71', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-10-11 16:36:54'::timestamp),
  ('AUDI-675690', 'TENA-979161', 'corporate', 'ENTI-770847', 'transfer', 'ACTO-649464', 'compliance', '{"status": "active", "region": "Nigeria"}'::jsonb, '221.228.183.87', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-10-21 16:36:54'::timestamp),
  ('AUDI-629712', 'TENA-486067', 'premium', 'ENTI-488034', 'approve', 'ACTO-899997', 'compliance', '{"status": "active", "region": "Nigeria"}'::jsonb, '236.179.81.103', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-11-03 16:36:54'::timestamp),
  ('AUDI-762941', 'TENA-326530', 'standard', 'ENTI-810402', 'update', 'ACTO-398030', 'branch', '{"status": "active", "region": "Nigeria"}'::jsonb, '89.71.197.157', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-06-12 16:36:54'::timestamp),
  ('AUDI-980462', 'TENA-236895', 'standard', 'ENTI-556607', 'transfer', 'ACTO-316681', 'branch', '{"status": "active", "region": "Nigeria"}'::jsonb, '135.9.152.117', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-08-17 16:36:54'::timestamp),
  ('AUDI-840705', 'TENA-777307', 'micro', 'ENTI-280105', 'approve', 'ACTO-879550', 'treasury', '{"status": "active", "region": "Nigeria"}'::jsonb, '134.206.2.81', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2026-02-05 16:36:54'::timestamp),
  ('AUDI-452517', 'TENA-608177', 'premium', 'ENTI-256805', 'transfer', 'ACTO-787281', 'compliance', '{"status": "active", "region": "Nigeria"}'::jsonb, '118.62.233.155', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-07-24 16:36:54'::timestamp),
  ('AUDI-760751', 'TENA-777023', 'enterprise', 'ENTI-923112', 'verify', 'ACTO-891100', 'branch', '{"status": "active", "region": "Nigeria"}'::jsonb, '235.23.64.112', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0', '2025-06-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: avro_schemas
INSERT INTO "avro_schemas" ("subject", "version", "compatibilityMode", "serializedSizeBytes", "compressionRatio", "status", "created_at") VALUES
  ('Processed for Kabiru Aliyu in Enugu - pending', 5968, 'Segun Oladipo - completed', 246, 'Musa Danjuma - completed', 'processing', '2025-09-28 16:36:54'::timestamp),
  ('Processed for Halima Usman in Oyo - pending', 1071, 'Yusuf Ibrahim - approved', 483, 'Muhammed Lawal - completed', 'processing', '2026-02-05 16:36:54'::timestamp),
  ('Processed for Chukwuemeka Nwosu in Rivers - processing', 2934, 'Musa Danjuma - pending', 314, 'Adebayo Ogundimu - processing', 'rejected', '2026-03-13 16:36:54'::timestamp),
  ('Processed for Tunde Akinola in Ogun - rejected', 3752, 'Segun Oladipo - active', 265, 'Obinna Igwe - approved', 'completed', '2026-04-06 16:36:54'::timestamp),
  ('Processed for Oluwaseun Adeyemi in Oyo - pending', 8032, 'Oluwaseun Adeyemi - approved', 256, 'Segun Oladipo - processing', 'rejected', '2025-06-09 16:36:54'::timestamp),
  ('Processed for Muhammed Lawal in Kaduna - completed', 3929, 'Obinna Igwe - approved', 423, 'Nkechi Nwankwo - completed', 'pending', '2025-12-31 16:36:54'::timestamp),
  ('Processed for Fatima Abdulrahman in Ogun - completed', 204, 'Adebayo Ogundimu - completed', 343, 'Ngozi Eze - active', 'rejected', '2025-12-09 16:36:54'::timestamp),
  ('Processed for Victoria Etim in Abuja - active', 2974, 'Obinna Igwe - processing', 67, 'Musa Danjuma - pending', 'completed', '2025-11-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: bankGuarantees
INSERT INTO "bankGuarantees" ("guaranteeId", "tenantId", "guaranteeType", "applicantId", "applicantName", "beneficiaryName", "amount", "currency", "purpose", "effectiveDate", "expiryDate", "claimDeadline", "commissionRate", "commissionAmount", "status", "createdAt", "updatedAt") VALUES
  ('GUAR-853605', 'TENA-135490', 'standard', 'APPL-814057', 'Yusuf Ibrahim', 'Kabiru Aliyu - pending', 19843110.21, 'USD', 'Processed for Abdullahi Sani in Ogun - completed', 'Hauwa Yusuf - processing', 'Yusuf Ibrahim - processing', 'Folake Bakare - pending', 0.1525, 20008632.41, 'approved', '2026-02-17 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp),
  ('GUAR-127036', 'TENA-210015', 'premium', 'APPL-668308', 'Ifeanyi Obi', 'Aisha Bello - completed', 46612471.64, 'NGN', 'Processed for Folake Bakare in Abuja - processing', 'Kabiru Aliyu - completed', 'Chioma Nnamdi - active', 'Halima Usman - active', 15.2353, 23678685.88, 'completed', '2025-09-17 16:36:54'::timestamp, '2025-08-28 16:36:54'::timestamp),
  ('GUAR-146910', 'TENA-409728', 'enterprise', 'APPL-268985', 'Babajide Williams', 'Hauwa Yusuf - completed', 8914171.43, 'NGN', 'Processed for Chioma Nnamdi in Kaduna - pending', 'Fatima Abdulrahman - active', 'Chioma Nnamdi - processing', 'Ngozi Eze - approved', 10.3664, 49635399.63, 'approved', '2025-06-07 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp),
  ('GUAR-778571', 'TENA-826260', 'micro', 'APPL-759242', 'Fatima Abdulrahman', 'Zainab Mohammed - approved', 17741246.49, 'EUR', 'Processed for Adebayo Ogundimu in Lagos - active', 'Babajide Williams - processing', 'Tunde Akinola - pending', 'Yusuf Ibrahim - active', 18.4232, 40753964.52, 'completed', '2026-02-14 16:36:54'::timestamp, '2026-05-05 16:36:54'::timestamp),
  ('GUAR-108114', 'TENA-119202', 'basic', 'APPL-278566', 'Chioma Nnamdi', 'Tunde Akinola - completed', 38521142.93, 'EUR', 'Processed for Hauwa Yusuf in Oyo - rejected', 'Obinna Igwe - approved', 'Musa Danjuma - pending', 'Tunde Akinola - pending', 13.2609, 2867229.74, 'pending', '2025-11-23 16:36:54'::timestamp, '2025-08-15 16:36:54'::timestamp),
  ('GUAR-943319', 'TENA-395513', 'basic', 'APPL-607193', 'Tunde Akinola', 'Suleiman Abubakar - completed', 22933491.47, 'EUR', 'Processed for Kabiru Aliyu in Lagos - approved', 'Emmanuel Ogbonna - active', 'Aisha Bello - completed', 'Victoria Etim - completed', 11.0449, 37775240.24, 'pending', '2025-11-06 16:36:54'::timestamp, '2026-01-11 16:36:54'::timestamp),
  ('GUAR-700842', 'TENA-158350', 'standard', 'APPL-902192', 'Suleiman Abubakar', 'Musa Danjuma - active', 21425716.83, 'EUR', 'Processed for Babajide Williams in Kaduna - processing', 'Segun Oladipo - approved', 'Rasheed Olanrewaju - active', 'Aisha Bello - completed', 4.2699, 8212903.66, 'rejected', '2026-01-18 16:36:54'::timestamp, '2025-10-10 16:36:54'::timestamp),
  ('GUAR-739889', 'TENA-696188', 'basic', 'APPL-586207', 'Chidinma Okafor', 'Hauwa Yusuf - completed', 42098511.26, 'GBP', 'Processed for Suleiman Abubakar in Kaduna - pending', 'Amina Garba - completed', 'Khadija Musa - processing', 'Obinna Igwe - active', 21.4786, 47555890.98, 'rejected', '2025-10-11 16:36:54'::timestamp, '2026-04-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: batch_aggregator_configs
INSERT INTO "batch_aggregator_configs" ("endpoint", "maxRequests", "timeoutMs", "avgBatchSize", "requestsSaved24h", "status", "created_at") VALUES
  ('https://api.54bank.ng/batch_aggregator_configs/345098', 5661, 935, 6170.24, 5966, 'completed', '2026-04-06 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/616019', 9522, 5521, 6750.76, 1830, 'pending', '2026-02-23 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/420162', 904, 9633, 8021.2, 2589, 'processing', '2025-08-31 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/317163', 7089, 439, 792.51, 4628, 'active', '2026-03-12 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/472437', 8181, 2315, 5261.6, 7904, 'completed', '2026-02-03 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/819984', 2645, 6022, 4158.8, 2708, 'approved', '2025-12-10 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/810492', 1424, 844, 9032.64, 3966, 'completed', '2026-01-24 16:36:54'::timestamp),
  ('https://api.54bank.ng/batch_aggregator_configs/686765', 3028, 4087, 9011.8, 9730, 'pending', '2025-10-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: beneficial_owners
INSERT INTO "beneficial_owners" ("entityId", "entityName", "entityType", "rcNumber", "totalLayers", "status", "created_at") VALUES
  ('ENTI-468446', 'Zenith Bank PLC', 'micro', 'Yusuf Ibrahim - rejected', 24918689, 'completed', '2025-12-16 16:36:54'::timestamp),
  ('ENTI-409794', 'BUA Group', 'basic', 'Rasheed Olanrewaju - approved', 30459528, 'completed', '2025-08-26 16:36:54'::timestamp),
  ('ENTI-402444', 'Lafarge Africa', 'micro', 'Rasheed Olanrewaju - pending', 4779309, 'completed', '2025-12-26 16:36:54'::timestamp),
  ('ENTI-522820', 'United Bank for Africa', 'micro', 'Kabiru Aliyu - processing', 356161, 'active', '2026-01-06 16:36:54'::timestamp),
  ('ENTI-859797', 'Plateau Agro Services', 'micro', 'Zainab Mohammed - rejected', 7226349, 'active', '2025-07-24 16:36:54'::timestamp),
  ('ENTI-385411', 'Oando PLC', 'micro', 'Aisha Bello - active', 18152577, 'approved', '2025-12-03 16:36:54'::timestamp),
  ('ENTI-817019', 'Oyo Cooperative Union', 'premium', 'Adebayo Ogundimu - approved', 19051871, 'completed', '2025-07-20 16:36:54'::timestamp),
  ('ENTI-349944', 'Dangote Industries Ltd', 'corporate', 'Abdullahi Sani - pending', 17891774, 'pending', '2025-09-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingAccounts
INSERT INTO "billingAccounts" ("billingAccountId", "tenantId", "accountName", "billingModel", "currency", "status", "contractStartAt", "contractEndAt", "defaultRateCardId", "minimumCommitAmount", "defaultBillingPeriodType", "invoiceDueDays", "createdAt", "updatedAt") VALUES
  ('BILL-814750', 'TENA-912949', 'Emmanuel Ogbonna - approved', 'random_forest', 'NGN', 'rejected', '2025-12-21 16:36:54'::timestamp, '2025-07-11 16:36:54'::timestamp, 'DEFA-198122', 25976540.42, 'standard', 43, '2025-10-03 16:36:54'::timestamp, '2025-08-03 16:36:54'::timestamp),
  ('BILL-952048', 'TENA-949139', 'Blessing Okoro - completed', 'autoencoder', 'NGN', 'rejected', '2025-06-04 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp, 'DEFA-659263', 27349419.89, 'premium', 303, '2025-09-11 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp),
  ('BILL-769254', 'TENA-621092', 'Ifeanyi Obi - approved', 'isolation_forest', 'USD', 'pending', '2025-06-28 16:36:54'::timestamp, '2025-11-05 16:36:54'::timestamp, 'DEFA-423299', 19003381.28, 'corporate', 317, '2025-10-27 16:36:54'::timestamp, '2025-05-18 16:36:54'::timestamp),
  ('BILL-345521', 'TENA-729234', 'Muhammed Lawal - active', 'random_forest', 'EUR', 'active', '2025-09-17 16:36:54'::timestamp, '2025-06-13 16:36:54'::timestamp, 'DEFA-987373', 31697724.78, 'basic', 267, '2025-09-24 16:36:54'::timestamp, '2025-06-08 16:36:54'::timestamp),
  ('BILL-586452', 'TENA-756592', 'Blessing Okoro - completed', 'autoencoder', 'GBP', 'rejected', '2025-09-28 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp, 'DEFA-109525', 35518964.05, 'enterprise', 235, '2025-06-22 16:36:54'::timestamp, '2025-06-14 16:36:54'::timestamp),
  ('BILL-929716', 'TENA-379147', 'Muhammed Lawal - completed', 'isolation_forest', 'EUR', 'active', '2026-04-25 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp, 'DEFA-649351', 42814898.55, 'premium', 103, '2026-04-30 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp),
  ('BILL-688588', 'TENA-350780', 'Grace Adeniyi - completed', 'autoencoder', 'EUR', 'completed', '2025-08-09 16:36:54'::timestamp, '2026-04-06 16:36:54'::timestamp, 'DEFA-662188', 23699864.57, 'corporate', 49, '2025-10-03 16:36:54'::timestamp, '2025-09-08 16:36:54'::timestamp),
  ('BILL-199758', 'TENA-464884', 'Tunde Akinola - pending', 'xgboost', 'GBP', 'processing', '2026-04-24 16:36:54'::timestamp, '2026-03-20 16:36:54'::timestamp, 'DEFA-991122', 44109093.58, 'basic', 346, '2025-08-13 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingAccrualSnapshots
INSERT INTO "billingAccrualSnapshots" ("accrualSnapshotId", "tenantId", "billingAccountId", "billingPeriodKey", "meterKey", "productKey", "ratedEventCount", "usageQuantity", "accruedAmount", "unratedEventCount", "lastUsageAt", "lastRatedAt", "snapshotStatus", "createdAt", "updatedAt") VALUES
  ('ACCR-727768', 'TENA-933011', 'BILL-490743', '2026-Q3', 'Ifeanyi Obi - pending', 'Babajide Williams - processing', 301, 50, 7235102.55, 422, '2025-09-27 16:36:54'::timestamp, '2025-07-12 16:36:54'::timestamp, 'active', '2025-06-10 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp),
  ('ACCR-412093', 'TENA-667048', 'BILL-358775', '2026-Q4', 'Emmanuel Ogbonna - rejected', 'Khadija Musa - processing', 111, 134, 23073705.59, 385, '2026-01-31 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp, 'pending', '2026-01-22 16:36:54'::timestamp, '2026-04-05 16:36:54'::timestamp),
  ('ACCR-853702', 'TENA-678239', 'BILL-104846', '2026-Q4', 'Grace Adeniyi - rejected', 'Victoria Etim - processing', 116, 238, 24248584.23, 111, '2026-03-08 16:36:54'::timestamp, '2026-03-15 16:36:54'::timestamp, 'rejected', '2026-04-19 16:36:54'::timestamp, '2025-10-25 16:36:54'::timestamp),
  ('ACCR-213402', 'TENA-610537', 'BILL-636915', '2026-Q1', 'Ngozi Eze - rejected', 'Abdullahi Sani - active', 236, 107, 9561133.33, 115, '2026-05-01 16:36:54'::timestamp, '2025-11-09 16:36:54'::timestamp, 'completed', '2025-09-27 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp),
  ('ACCR-421711', 'TENA-514187', 'BILL-851774', '2026-Q3', 'Fatima Abdulrahman - active', 'Joy Okonkwo - processing', 217, 188, 16409827.97, 162, '2025-12-31 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp, 'pending', '2025-06-23 16:36:54'::timestamp, '2025-07-08 16:36:54'::timestamp),
  ('ACCR-712563', 'TENA-151708', 'BILL-118835', '2026-Q4', 'Chidinma Okafor - approved', 'Suleiman Abubakar - completed', 143, 364, 14011874.83, 67, '2025-07-01 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp, 'active', '2025-11-27 16:36:54'::timestamp, '2026-02-07 16:36:54'::timestamp),
  ('ACCR-348246', 'TENA-614757', 'BILL-395878', '2026-Q3', 'Tunde Akinola - pending', 'Joy Okonkwo - approved', 79, 68, 4071522.49, 139, '2026-05-07 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp, 'rejected', '2025-07-31 16:36:54'::timestamp, '2026-02-11 16:36:54'::timestamp),
  ('ACCR-659543', 'TENA-834908', 'BILL-610539', '2026-Q1', 'Rasheed Olanrewaju - completed', 'Chidinma Okafor - pending', 409, 142, 49290484.67, 168, '2025-06-28 16:36:54'::timestamp, '2025-09-16 16:36:54'::timestamp, 'approved', '2025-08-19 16:36:54'::timestamp, '2025-11-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingContractOverrides
INSERT INTO "billingContractOverrides" ("contractOverrideId", "billingAccountId", "tenantId", "overrideType", "meterKey", "productKey", "valueNumber", "valueText", "effectiveFrom", "effectiveTo", "status", "createdBy", "notes", "createdAt", "updatedAt") VALUES
  ('CONT-624704', 'BILL-411920', 'TENA-600133', 'enterprise', 'Zainab Mohammed - rejected', 'Abdullahi Sani - rejected', 47835582.56, '41724830.81', '2025-11-18 16:36:54'::timestamp, '2025-06-03 16:36:54'::timestamp, 'rejected', 'Muhammed Lawal - completed', 'Processed for Emmanuel Ogbonna in Kano - completed', '2026-01-09 16:36:54'::timestamp, '2025-09-22 16:36:54'::timestamp),
  ('CONT-386833', 'BILL-396700', 'TENA-962850', 'standard', 'Abdullahi Sani - processing', 'Halima Usman - pending', 34490978.89, '37366382.22', '2025-12-10 16:36:54'::timestamp, '2025-08-25 16:36:54'::timestamp, 'approved', 'Adebayo Ogundimu - processing', 'Processed for Emmanuel Ogbonna in Enugu - active', '2025-05-24 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp),
  ('CONT-191019', 'BILL-148638', 'TENA-578457', 'micro', 'Folake Bakare - pending', 'Suleiman Abubakar - pending', 45837748.85, '38820326.33', '2026-01-14 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp, 'active', 'Tunde Akinola - pending', 'Processed for Kabiru Aliyu in Anambra - processing', '2025-11-26 16:36:54'::timestamp, '2026-04-27 16:36:54'::timestamp),
  ('CONT-501433', 'BILL-730771', 'TENA-335889', 'premium', 'Tunde Akinola - rejected', 'Halima Usman - processing', 3099292.0, '49153533.94', '2025-09-14 16:36:54'::timestamp, '2025-06-15 16:36:54'::timestamp, 'completed', 'Halima Usman - processing', 'Processed for Hauwa Yusuf in Anambra - rejected', '2025-06-24 16:36:54'::timestamp, '2026-03-08 16:36:54'::timestamp),
  ('CONT-350622', 'BILL-411269', 'TENA-658419', 'corporate', 'Abdullahi Sani - processing', 'Aisha Bello - rejected', 47353711.18, '38755176.97', '2025-12-20 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp, 'active', 'Chioma Nnamdi - rejected', 'Processed for Yusuf Ibrahim in Delta - approved', '2025-09-20 16:36:54'::timestamp, '2025-09-12 16:36:54'::timestamp),
  ('CONT-749773', 'BILL-466663', 'TENA-823949', 'enterprise', 'Chioma Nnamdi - active', 'Grace Adeniyi - completed', 25495463.79, '15170803.11', '2025-07-31 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp, 'rejected', 'Emmanuel Ogbonna - approved', 'Processed for Folake Bakare in Kaduna - active', '2025-12-16 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp),
  ('CONT-375264', 'BILL-989921', 'TENA-479453', 'micro', 'Grace Adeniyi - active', 'Victoria Etim - pending', 17193934.01, '28943379.01', '2025-07-27 16:36:54'::timestamp, '2025-07-07 16:36:54'::timestamp, 'approved', 'Emmanuel Ogbonna - active', 'Processed for Adebayo Ogundimu in Abuja - active', '2025-12-31 16:36:54'::timestamp, '2025-06-27 16:36:54'::timestamp),
  ('CONT-705616', 'BILL-916843', 'TENA-422930', 'premium', 'Hauwa Yusuf - approved', 'Amina Garba - completed', 29254232.5, '45739414.18', '2025-09-23 16:36:54'::timestamp, '2026-04-17 16:36:54'::timestamp, 'pending', 'Yusuf Ibrahim - approved', 'Processed for Joy Okonkwo in Lagos - pending', '2025-11-21 16:36:54'::timestamp, '2025-11-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingDiscountRules
INSERT INTO "billingDiscountRules" ("discountRuleId", "billingAccountId", "tenantId", "name", "discountType", "meterKey", "productKey", "percentage", "fixedAmount", "thresholdAmount", "effectiveFrom", "effectiveTo", "status", "createdBy", "createdAt", "updatedAt") VALUES
  ('DISC-127895', 'BILL-828891', 'TENA-932042', 'Yusuf Ibrahim', 'micro', 'Chioma Nnamdi - rejected', 'Nkechi Nwankwo - pending', 11.8158, 16735994.17, 20142422.96, '2026-01-19 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp, 'processing', 'Zainab Mohammed - active', '2026-04-20 16:36:54'::timestamp, '2026-01-06 16:36:54'::timestamp),
  ('DISC-781657', 'BILL-733458', 'TENA-664330', 'Tunde Akinola', 'micro', 'Adebayo Ogundimu - processing', 'Oluwaseun Adeyemi - approved', 16.5546, 17875234.0, 27935363.25, '2025-07-03 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp, 'rejected', 'Halima Usman - rejected', '2025-06-30 16:36:54'::timestamp, '2025-09-09 16:36:54'::timestamp),
  ('DISC-384316', 'BILL-192297', 'TENA-859584', 'Aisha Bello', 'premium', 'Khadija Musa - approved', 'Ngozi Eze - active', 20.7839, 32499938.83, 43505710.02, '2026-02-03 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp, 'completed', 'Musa Danjuma - pending', '2026-01-30 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp),
  ('DISC-748589', 'BILL-272567', 'TENA-879234', 'Khadija Musa', 'corporate', 'Suleiman Abubakar - pending', 'Abdullahi Sani - rejected', 24.7233, 42561029.73, 858288.61, '2026-04-27 16:36:54'::timestamp, '2025-07-06 16:36:54'::timestamp, 'approved', 'Musa Danjuma - approved', '2026-01-06 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp),
  ('DISC-131289', 'BILL-922112', 'TENA-749409', 'Musa Danjuma', 'corporate', 'Fatima Abdulrahman - rejected', 'Emmanuel Ogbonna - rejected', 17.326, 39494230.81, 1551745.7, '2026-04-13 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp, 'active', 'Amina Garba - approved', '2025-08-06 16:36:54'::timestamp, '2025-11-28 16:36:54'::timestamp),
  ('DISC-904128', 'BILL-433043', 'TENA-886561', 'Blessing Okoro', 'standard', 'Babajide Williams - completed', 'Emmanuel Ogbonna - processing', 9.208, 32184697.96, 13861513.12, '2025-11-07 16:36:54'::timestamp, '2026-04-08 16:36:54'::timestamp, 'active', 'Khadija Musa - active', '2025-07-23 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp),
  ('DISC-717585', 'BILL-885318', 'TENA-514168', 'Babajide Williams', 'micro', 'Ngozi Eze - rejected', 'Zainab Mohammed - rejected', 19.1916, 5229226.45, 15210933.34, '2025-12-31 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp, 'rejected', 'Joy Okonkwo - processing', '2026-03-12 16:36:54'::timestamp, '2026-02-21 16:36:54'::timestamp),
  ('DISC-710371', 'BILL-940452', 'TENA-330996', 'Yusuf Ibrahim', 'micro', 'Ifeanyi Obi - completed', 'Muhammed Lawal - active', 13.9871, 43491972.49, 14458413.23, '2025-08-29 16:36:54'::timestamp, '2025-11-22 16:36:54'::timestamp, 'completed', 'Suleiman Abubakar - active', '2025-11-02 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingInvoiceApprovals
INSERT INTO "billingInvoiceApprovals" ("billingInvoiceApprovalId", "billingInvoiceId", "stageKey", "actorRole", "status", "actedAt", "note", "createdAt", "updatedAt") VALUES
  ('Folake Bakare - approved', 'BILL-363220', 'Amina Garba - pending', 'compliance', 'active', '2025-11-22 16:36:54'::timestamp, 'Abdullahi Sani - active', '2026-04-12 16:36:54'::timestamp, '2026-04-16 16:36:54'::timestamp),
  ('Yusuf Ibrahim - approved', 'BILL-249952', 'Rasheed Olanrewaju - processing', 'compliance', 'active', '2025-06-29 16:36:54'::timestamp, 'Ngozi Eze - rejected', '2026-03-29 16:36:54'::timestamp, '2025-12-24 16:36:54'::timestamp),
  ('Blessing Okoro - approved', 'BILL-512568', 'Fatima Abdulrahman - approved', 'branch', 'rejected', '2025-10-23 16:36:54'::timestamp, 'Joy Okonkwo - active', '2025-10-15 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('Nkechi Nwankwo - rejected', 'BILL-215854', 'Chukwuemeka Nwosu - completed', 'treasury', 'pending', '2025-09-12 16:36:54'::timestamp, 'Babajide Williams - pending', '2025-05-18 16:36:54'::timestamp, '2025-07-19 16:36:54'::timestamp),
  ('Nkechi Nwankwo - rejected', 'BILL-878252', 'Muhammed Lawal - completed', 'compliance', 'processing', '2025-05-22 16:36:54'::timestamp, 'Folake Bakare - approved', '2026-05-03 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('Victoria Etim - pending', 'BILL-696166', 'Adebayo Ogundimu - approved', 'branch', 'rejected', '2026-01-21 16:36:54'::timestamp, 'Blessing Okoro - pending', '2025-11-18 16:36:54'::timestamp, '2025-10-10 16:36:54'::timestamp),
  ('Tunde Akinola - processing', 'BILL-373529', 'Aisha Bello - active', 'branch', 'pending', '2026-01-26 16:36:54'::timestamp, 'Segun Oladipo - approved', '2026-04-02 16:36:54'::timestamp, '2026-03-13 16:36:54'::timestamp),
  ('Blessing Okoro - rejected', 'BILL-463187', 'Segun Oladipo - pending', 'compliance', 'approved', '2026-03-16 16:36:54'::timestamp, 'Khadija Musa - approved', '2025-10-31 16:36:54'::timestamp, '2025-06-13 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingInvoiceLines
INSERT INTO "billingInvoiceLines" ("billingInvoiceLineId", "billingInvoiceId", "lineType", "meterKey", "productKey", "description", "quantity", "unitPrice", "amount", "metadata", "createdAt") VALUES
  ('BILL-859822', 'BILL-317119', 'standard', 'Tunde Akinola - rejected', 'Chidinma Okafor - rejected', 'Processed for Chioma Nnamdi in Kano - processing', 8935.56, 10964899.2, 8413364.64, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-22 16:36:54'::timestamp),
  ('BILL-766162', 'BILL-435579', 'corporate', 'Ngozi Eze - rejected', 'Tunde Akinola - rejected', 'Processed for Obinna Igwe in Oyo - approved', 1396.13, 18431352.26, 48527887.64, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-16 16:36:54'::timestamp),
  ('BILL-659099', 'BILL-250106', 'standard', 'Ngozi Eze - processing', 'Chukwuemeka Nwosu - rejected', 'Processed for Zainab Mohammed in Ogun - approved', 4741.2, 4241147.35, 42195043.88, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-20 16:36:54'::timestamp),
  ('BILL-338084', 'BILL-238117', 'basic', 'Yusuf Ibrahim - pending', 'Yusuf Ibrahim - rejected', 'Processed for Ngozi Eze in Ogun - approved', 3617.83, 30666595.22, 14505145.97, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-18 16:36:54'::timestamp),
  ('BILL-181519', 'BILL-483340', 'enterprise', 'Musa Danjuma - completed', 'Folake Bakare - active', 'Processed for Chukwuemeka Nwosu in Anambra - approved', 1038.44, 37333831.48, 35768297.15, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-06 16:36:54'::timestamp),
  ('BILL-910743', 'BILL-303627', 'micro', 'Chioma Nnamdi - active', 'Hauwa Yusuf - rejected', 'Processed for Emmanuel Ogbonna in Ogun - processing', 3773.78, 23230728.09, 27652614.92, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-28 16:36:54'::timestamp),
  ('BILL-236304', 'BILL-214576', 'enterprise', 'Hauwa Yusuf - active', 'Zainab Mohammed - pending', 'Processed for Abdullahi Sani in Rivers - rejected', 317.49, 20859638.71, 16915930.19, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-10 16:36:54'::timestamp),
  ('BILL-754966', 'BILL-308353', 'basic', 'Emmanuel Ogbonna - processing', 'Joy Okonkwo - rejected', 'Processed for Aisha Bello in Rivers - active', 89.42, 22413493.7, 13602576.61, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingInvoices
INSERT INTO "billingInvoices" ("billingInvoiceId", "invoiceNumber", "tenantId", "billingAccountId", "billingPeriodKey", "billingPeriodType", "periodStartAt", "periodEndAt", "currency", "subtotalAmount", "discountAmount", "revenueShareAmount", "minimumCommitAdjustment", "taxAmount", "totalAmount", "status", "approvalStatus", "generatedAt", "dueAt", "approvalStepCount", "issuedAt", "createdAt", "updatedAt") VALUES
  ('BILL-453811', 'Victoria Etim - pending', 'TENA-722325', 'BILL-149092', '2026-Q3', 'micro', '2026-05-02 16:36:54'::timestamp, '2025-07-10 16:36:54'::timestamp, 'USD', 21492040.35, 15025703.76, 46894694.87, 5064.66, 44814974.71, 46660566.6, 'pending', 'processing', '2025-11-19 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp, 415, '2026-03-15 16:36:54'::timestamp, '2025-08-22 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp),
  ('BILL-632397', 'Chukwuemeka Nwosu - approved', 'TENA-853679', 'BILL-508811', '2026-Q1', 'premium', '2025-07-11 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp, 'NGN', 49552077.08, 46632039.6, 41350307.22, 8053.98, 583187.27, 4348506.66, 'rejected', 'approved', '2025-09-28 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp, 53, '2025-07-19 16:36:54'::timestamp, '2025-08-15 16:36:54'::timestamp, '2026-04-08 16:36:54'::timestamp),
  ('BILL-492409', 'Abdullahi Sani - processing', 'TENA-249068', 'BILL-402066', '2026-Q2', 'premium', '2025-09-27 16:36:54'::timestamp, '2025-08-07 16:36:54'::timestamp, 'EUR', 435900.93, 25589512.65, 40798927.1, 3671.13, 43930219.17, 22500289.48, 'active', 'processing', '2026-03-07 16:36:54'::timestamp, '2026-03-12 16:36:54'::timestamp, 259, '2026-05-01 16:36:54'::timestamp, '2025-07-15 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp),
  ('BILL-889609', 'Zainab Mohammed - active', 'TENA-831573', 'BILL-558475', '2026-Q1', 'basic', '2025-06-06 16:36:54'::timestamp, '2025-09-27 16:36:54'::timestamp, 'GBP', 39009912.61, 38941006.4, 16396128.3, 741.24, 31250739.88, 42630443.62, 'active', 'approved', '2025-08-10 16:36:54'::timestamp, '2026-04-30 16:36:54'::timestamp, 52, '2026-05-10 16:36:54'::timestamp, '2025-10-09 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp),
  ('BILL-319939', 'Chioma Nnamdi - approved', 'TENA-740185', 'BILL-253777', '2026-Q4', 'basic', '2025-11-03 16:36:54'::timestamp, '2026-01-17 16:36:54'::timestamp, 'EUR', 12105502.31, 5840911.28, 45802755.66, 1357.05, 31980077.48, 17878655.82, 'processing', 'approved', '2025-11-22 16:36:54'::timestamp, '2026-01-16 16:36:54'::timestamp, 483, '2026-02-05 16:36:54'::timestamp, '2025-12-22 16:36:54'::timestamp, '2026-02-07 16:36:54'::timestamp),
  ('BILL-780576', 'Oluwaseun Adeyemi - pending', 'TENA-222236', 'BILL-697586', '2026-Q4', 'corporate', '2025-08-02 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp, 'USD', 41217367.82, 48932833.7, 16554233.72, 613.58, 22771261.0, 25771390.57, 'processing', 'pending', '2025-09-24 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp, 439, '2025-08-09 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp, '2025-11-28 16:36:54'::timestamp),
  ('BILL-776124', 'Fatima Abdulrahman - active', 'TENA-487878', 'BILL-436172', '2026-Q3', 'standard', '2026-03-06 16:36:54'::timestamp, '2025-11-20 16:36:54'::timestamp, 'NGN', 33836048.23, 25822571.54, 44492454.81, 8045.0, 47580127.5, 27831560.55, 'rejected', 'pending', '2026-01-29 16:36:54'::timestamp, '2026-04-25 16:36:54'::timestamp, 45, '2025-10-15 16:36:54'::timestamp, '2025-08-02 16:36:54'::timestamp, '2026-02-10 16:36:54'::timestamp),
  ('BILL-251226', 'Rasheed Olanrewaju - completed', 'TENA-396617', 'BILL-343780', '2026-Q4', 'basic', '2025-11-10 16:36:54'::timestamp, '2025-06-06 16:36:54'::timestamp, 'NGN', 10457196.47, 33459460.54, 49679232.42, 1066.86, 42391887.52, 27737529.85, 'pending', 'active', '2026-03-22 16:36:54'::timestamp, '2026-02-06 16:36:54'::timestamp, 273, '2026-01-29 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingRateCardLines
INSERT INTO "billingRateCardLines" ("rateCardLineId", "rateCardId", "meterKey", "productKey", "chargeType", "unitPrice", "includedUnits", "tierStart", "tierEnd", "minimumCharge", "maximumCharge", "pricingFormula", "settlementLedgerCode", "createdAt", "updatedAt") VALUES
  ('RATE-190302', 'RATE-233734', 'Tunde Akinola - processing', 'Zainab Mohammed - approved', 'micro', 9556735.27, 1660, 7995, 1174, 9659.22, 2708.23, '{}'::jsonb, 'CODE-623116', '2025-09-20 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp),
  ('RATE-447275', 'RATE-475709', 'Yusuf Ibrahim - active', 'Aisha Bello - completed', 'premium', 13516047.43, 2423, 6977, 7204, 9227.16, 5817.54, '{}'::jsonb, 'CODE-928001', '2026-03-22 16:36:54'::timestamp, '2026-02-22 16:36:54'::timestamp),
  ('RATE-566372', 'RATE-184571', 'Segun Oladipo - pending', 'Tunde Akinola - rejected', 'micro', 41310679.55, 6889, 3107, 2391, 9557.92, 5188.41, '{}'::jsonb, 'CODE-931473', '2025-10-14 16:36:54'::timestamp, '2026-01-26 16:36:54'::timestamp),
  ('RATE-908667', 'RATE-772055', 'Hauwa Yusuf - pending', 'Segun Oladipo - completed', 'basic', 40133137.1, 5302, 8811, 7069, 4939.14, 969.0, '{}'::jsonb, 'CODE-548162', '2025-12-23 16:36:54'::timestamp, '2025-12-14 16:36:54'::timestamp),
  ('RATE-696115', 'RATE-855387', 'Obinna Igwe - active', 'Kabiru Aliyu - pending', 'corporate', 1559818.18, 4684, 9177, 5385, 7571.96, 9600.4, '{}'::jsonb, 'CODE-688304', '2025-12-10 16:36:54'::timestamp, '2026-02-08 16:36:54'::timestamp),
  ('RATE-664703', 'RATE-535464', 'Aisha Bello - rejected', 'Rasheed Olanrewaju - approved', 'premium', 49284169.45, 891, 6869, 3961, 1522.82, 9065.39, '{}'::jsonb, 'CODE-172690', '2025-08-06 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp),
  ('RATE-200558', 'RATE-315931', 'Amina Garba - completed', 'Nkechi Nwankwo - active', 'standard', 38753629.6, 3329, 5413, 3720, 7715.79, 8785.86, '{}'::jsonb, 'CODE-858054', '2025-06-10 16:36:54'::timestamp, '2026-02-25 16:36:54'::timestamp),
  ('RATE-921779', 'RATE-490857', 'Segun Oladipo - pending', 'Ngozi Eze - rejected', 'standard', 43635931.25, 3894, 4853, 4283, 8992.5, 9629.38, '{}'::jsonb, 'CODE-838311', '2026-05-01 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingRateCards
INSERT INTO "billingRateCards" ("rateCardId", "billingAccountId", "name", "version", "status", "effectiveFrom", "effectiveTo", "pricingCurrency", "createdBy", "approvalState", "createdAt", "updatedAt") VALUES
  ('RATE-888125', 'BILL-672875', 'Rasheed Olanrewaju', 7041, 'active', '2025-09-07 16:36:54'::timestamp, '2025-09-12 16:36:54'::timestamp, 'NGN', 'Babajide Williams - approved', 'Ogun', '2026-05-03 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('RATE-523273', 'BILL-632025', 'Suleiman Abubakar', 9020, 'approved', '2025-08-11 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp, 'NGN', 'Hauwa Yusuf - approved', 'Delta', '2025-05-26 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('RATE-547650', 'BILL-933818', 'Ngozi Eze', 52, 'approved', '2025-10-12 16:36:54'::timestamp, '2026-05-04 16:36:54'::timestamp, 'NGN', 'Tunde Akinola - pending', 'Anambra', '2025-11-24 16:36:54'::timestamp, '2026-02-13 16:36:54'::timestamp),
  ('RATE-617902', 'BILL-448151', 'Chidinma Okafor', 3224, 'rejected', '2025-09-09 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp, 'EUR', 'Musa Danjuma - pending', 'Kano', '2026-05-11 16:36:54'::timestamp, '2026-01-08 16:36:54'::timestamp),
  ('RATE-458914', 'BILL-547214', 'Oluwaseun Adeyemi', 9824, 'pending', '2025-08-09 16:36:54'::timestamp, '2025-05-26 16:36:54'::timestamp, 'NGN', 'Suleiman Abubakar - pending', 'Abuja', '2025-10-04 16:36:54'::timestamp, '2026-05-06 16:36:54'::timestamp),
  ('RATE-296354', 'BILL-577319', 'Obinna Igwe', 600, 'approved', '2026-01-03 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp, 'GBP', 'Grace Adeniyi - rejected', 'Lagos', '2026-04-19 16:36:54'::timestamp, '2025-05-21 16:36:54'::timestamp),
  ('RATE-552315', 'BILL-725343', 'Kabiru Aliyu', 9328, 'approved', '2026-03-25 16:36:54'::timestamp, '2025-11-16 16:36:54'::timestamp, 'GBP', 'Chukwuemeka Nwosu - pending', 'Abuja', '2025-09-23 16:36:54'::timestamp, '2025-09-23 16:36:54'::timestamp),
  ('RATE-336438', 'BILL-577776', 'Zainab Mohammed', 4347, 'active', '2025-07-23 16:36:54'::timestamp, '2025-10-20 16:36:54'::timestamp, 'GBP', 'Amina Garba - approved', 'Abuja', '2025-09-29 16:36:54'::timestamp, '2025-07-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingRatedEvents
INSERT INTO "billingRatedEvents" ("ratedEventId", "usageEventId", "rateCardId", "rateCardLineId", "billingPeriodKey", "quantityRated", "billableUnits", "amountAccrued", "currency", "ratingExplanation", "ratedAt") VALUES
  ('RATE-904423', 'USAG-385082', 'RATE-444071', 'RATE-246431', '2026-Q3', 90, 3595.64, 45909166.47, 'USD', '{}'::jsonb, '2025-07-30 16:36:54'::timestamp),
  ('RATE-746276', 'USAG-967118', 'RATE-810803', 'RATE-931222', '2026-Q2', 259, 4532.15, 18075415.66, 'EUR', '{}'::jsonb, '2025-05-12 16:36:54'::timestamp),
  ('RATE-945729', 'USAG-729762', 'RATE-600311', 'RATE-933031', '2026-Q1', 295, 9570.11, 10010432.42, 'NGN', '{}'::jsonb, '2025-06-08 16:36:54'::timestamp),
  ('RATE-888780', 'USAG-632166', 'RATE-402396', 'RATE-470132', '2026-Q3', 146, 4178.85, 1734856.14, 'EUR', '{}'::jsonb, '2026-05-06 16:36:54'::timestamp),
  ('RATE-775025', 'USAG-613470', 'RATE-701461', 'RATE-213879', '2026-Q1', 132, 8038.18, 19986375.63, 'EUR', '{}'::jsonb, '2025-11-27 16:36:54'::timestamp),
  ('RATE-247633', 'USAG-547357', 'RATE-899338', 'RATE-233993', '2026-Q3', 97, 9614.95, 26103083.71, 'USD', '{}'::jsonb, '2026-01-04 16:36:54'::timestamp),
  ('RATE-819926', 'USAG-211538', 'RATE-877321', 'RATE-187021', '2026-Q3', 309, 1589.65, 2203436.95, 'EUR', '{}'::jsonb, '2025-10-08 16:36:54'::timestamp),
  ('RATE-747415', 'USAG-178369', 'RATE-322206', 'RATE-815161', '2026-Q4', 90, 3741.49, 29528905.85, 'NGN', '{}'::jsonb, '2025-07-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingRevenueShareRules
INSERT INTO "billingRevenueShareRules" ("revenueShareRuleId", "billingAccountId", "tenantId", "name", "target", "percentage", "beneficiaryName", "settlementLedgerCode", "effectiveFrom", "effectiveTo", "status", "createdBy", "createdAt", "updatedAt") VALUES
  ('REVE-930344', 'BILL-588632', 'TENA-651186', 'Chidinma Okafor', 'Obinna Igwe - rejected', 11.4738, 'Ngozi Eze - processing', 'CODE-348075', '2025-10-09 16:36:54'::timestamp, '2026-01-18 16:36:54'::timestamp, 'approved', 'Obinna Igwe - active', '2026-05-04 16:36:54'::timestamp, '2026-05-02 16:36:54'::timestamp),
  ('REVE-294159', 'BILL-640732', 'TENA-480686', 'Chidinma Okafor', 'Rasheed Olanrewaju - active', 1.0274, 'Aisha Bello - active', 'CODE-337288', '2025-08-11 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp, 'pending', 'Suleiman Abubakar - pending', '2025-07-01 16:36:54'::timestamp, '2025-09-17 16:36:54'::timestamp),
  ('REVE-434497', 'BILL-571505', 'TENA-725168', 'Chidinma Okafor', 'Abdullahi Sani - pending', 7.7837, 'Rasheed Olanrewaju - processing', 'CODE-199863', '2025-06-01 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp, 'rejected', 'Blessing Okoro - active', '2025-11-11 16:36:54'::timestamp, '2025-08-22 16:36:54'::timestamp),
  ('REVE-176567', 'BILL-229919', 'TENA-459232', 'Emmanuel Ogbonna', 'Babajide Williams - processing', 9.4981, 'Obinna Igwe - pending', 'CODE-278204', '2025-11-11 16:36:54'::timestamp, '2025-07-03 16:36:54'::timestamp, 'approved', 'Rasheed Olanrewaju - processing', '2026-03-21 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('REVE-510586', 'BILL-757174', 'TENA-717712', 'Amina Garba', 'Nkechi Nwankwo - active', 17.8925, 'Amina Garba - completed', 'CODE-944439', '2025-07-30 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp, 'completed', 'Victoria Etim - active', '2025-06-03 16:36:54'::timestamp, '2025-09-16 16:36:54'::timestamp),
  ('REVE-168343', 'BILL-626713', 'TENA-130638', 'Aisha Bello', 'Yusuf Ibrahim - active', 10.1914, 'Yusuf Ibrahim - rejected', 'CODE-260988', '2025-10-25 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp, 'active', 'Chioma Nnamdi - rejected', '2026-04-04 16:36:54'::timestamp, '2026-03-23 16:36:54'::timestamp),
  ('REVE-892091', 'BILL-484608', 'TENA-320330', 'Chidinma Okafor', 'Amina Garba - approved', 5.5395, 'Victoria Etim - pending', 'CODE-401512', '2026-04-14 16:36:54'::timestamp, '2025-06-20 16:36:54'::timestamp, 'processing', 'Adebayo Ogundimu - completed', '2025-08-01 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp),
  ('REVE-709720', 'BILL-246667', 'TENA-160808', 'Chidinma Okafor', 'Oluwaseun Adeyemi - completed', 15.7078, 'Musa Danjuma - approved', 'CODE-517500', '2026-02-11 16:36:54'::timestamp, '2026-01-15 16:36:54'::timestamp, 'pending', 'Joy Okonkwo - pending', '2026-02-06 16:36:54'::timestamp, '2025-09-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: billingUsageEvents
INSERT INTO "billingUsageEvents" ("usageEventId", "idempotencyKey", "tenantId", "billingAccountId", "sourceService", "sourceEventType", "meterKey", "productKey", "quantity", "unitAmount", "currency", "eventTimestamp", "ingestedAt", "correlationId", "actorId", "resourceId", "payload", "status", "createdAt") VALUES
  ('USAG-356205', 'Joy Okonkwo - pending', 'TENA-291733', 'BILL-500953', 'API', 'enterprise', 'Emmanuel Ogbonna - pending', 'Zainab Mohammed - approved', 406, 24059853.43, 'GBP', '2025-09-04 16:36:54'::timestamp, '2026-01-01 16:36:54'::timestamp, 'CORR-393017', 'ACTO-167713', 'RESO-287701', '{"status": "active", "region": "Nigeria"}'::jsonb, 'completed', '2025-11-30 16:36:54'::timestamp),
  ('USAG-643316', 'Joy Okonkwo - approved', 'TENA-581550', 'BILL-997843', 'API', 'micro', 'Kabiru Aliyu - processing', 'Musa Danjuma - rejected', 428, 45497117.55, 'NGN', '2026-04-25 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp, 'CORR-529914', 'ACTO-433540', 'RESO-232013', '{"status": "active", "region": "Nigeria"}'::jsonb, 'approved', '2025-06-28 16:36:54'::timestamp),
  ('USAG-235377', 'Victoria Etim - completed', 'TENA-944449', 'BILL-374105', 'CBN', 'enterprise', 'Folake Bakare - active', 'Halima Usman - pending', 441, 2988320.77, 'NGN', '2025-11-28 16:36:54'::timestamp, '2025-07-13 16:36:54'::timestamp, 'CORR-198055', 'ACTO-729618', 'RESO-955930', '{"status": "active", "region": "Nigeria"}'::jsonb, 'active', '2025-06-13 16:36:54'::timestamp),
  ('USAG-954655', 'Aisha Bello - completed', 'TENA-889610', 'BILL-212126', 'NFIU', 'premium', 'Suleiman Abubakar - active', 'Tunde Akinola - rejected', 435, 29821818.06, 'EUR', '2025-07-12 16:36:54'::timestamp, '2025-07-13 16:36:54'::timestamp, 'CORR-181295', 'ACTO-271485', 'RESO-719299', '{"status": "active", "region": "Nigeria"}'::jsonb, 'processing', '2025-06-30 16:36:54'::timestamp),
  ('USAG-846254', 'Rasheed Olanrewaju - active', 'TENA-886899', 'BILL-631344', 'API', 'standard', 'Suleiman Abubakar - completed', 'Joy Okonkwo - completed', 427, 8054850.44, 'EUR', '2025-08-02 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp, 'CORR-944450', 'ACTO-288206', 'RESO-659045', '{"status": "active", "region": "Nigeria"}'::jsonb, 'approved', '2026-04-03 16:36:54'::timestamp),
  ('USAG-431889', 'Tunde Akinola - pending', 'TENA-542037', 'BILL-371544', 'OFAC', 'basic', 'Tunde Akinola - active', 'Chukwuemeka Nwosu - processing', 80, 8465891.36, 'USD', '2026-01-27 16:36:54'::timestamp, '2025-07-12 16:36:54'::timestamp, 'CORR-646350', 'ACTO-299444', 'RESO-342347', '{"status": "active", "region": "Nigeria"}'::jsonb, 'completed', '2026-04-24 16:36:54'::timestamp),
  ('USAG-199867', 'Obinna Igwe - pending', 'TENA-471861', 'BILL-182979', 'NFIU', 'enterprise', 'Ifeanyi Obi - approved', 'Khadija Musa - pending', 3, 23499666.17, 'EUR', '2026-02-13 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp, 'CORR-485195', 'ACTO-712885', 'RESO-445821', '{"status": "active", "region": "Nigeria"}'::jsonb, 'pending', '2026-02-06 16:36:54'::timestamp),
  ('USAG-996754', 'Zainab Mohammed - approved', 'TENA-217630', 'BILL-894965', 'NFIU', 'premium', 'Rasheed Olanrewaju - approved', 'Muhammed Lawal - approved', 268, 12653566.46, 'GBP', '2025-08-28 16:36:54'::timestamp, '2025-07-27 16:36:54'::timestamp, 'CORR-624725', 'ACTO-389358', 'RESO-869631', '{"status": "active", "region": "Nigeria"}'::jsonb, 'active', '2026-03-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: bloom_filters
INSERT INTO "bloom_filters" ("name", "capacity", "falsePositiveRate", "hashFunctions", "memoryMB", "lookups24h", "status", "created_at") VALUES
  ('Segun Oladipo', 3767, 'Chukwuemeka Nwosu - pending', 7083, 3648.02, 2385, 'pending', '2026-01-05 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 6448, 'Musa Danjuma - active', 5512, 175.97, 1432, 'approved', '2025-08-05 16:36:54'::timestamp),
  ('Suleiman Abubakar', 4505, 'Joy Okonkwo - rejected', 9946, 6235.73, 4742, 'active', '2025-07-18 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu', 2510, 'Muhammed Lawal - processing', 4607, 1522.25, 8073, 'pending', '2025-12-09 16:36:54'::timestamp),
  ('Victoria Etim', 8382, 'Aisha Bello - rejected', 3371, 9557.57, 9035, 'processing', '2025-07-28 16:36:54'::timestamp),
  ('Halima Usman', 1335, 'Zainab Mohammed - rejected', 1398, 3377.32, 8493, 'completed', '2026-04-08 16:36:54'::timestamp),
  ('Hauwa Yusuf', 2820, 'Rasheed Olanrewaju - active', 1701, 8794.09, 740, 'pending', '2026-03-24 16:36:54'::timestamp),
  ('Zainab Mohammed', 931, 'Grace Adeniyi - approved', 4962, 8839.02, 7991, 'completed', '2025-07-07 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: body_limit_rules
INSERT INTO "body_limit_rules" ("path", "method", "max_body_bytes", "content_types", "enforced", "violations_24h", "blocked_24h", "status", "created_at") VALUES
  ('Blessing Okoro - completed', 'update', 1935, '{}'::jsonb, true, 4678, 9760, 'active', '2025-08-27 16:36:54'::timestamp),
  ('Folake Bakare - processing', 'update', 3136, '{}'::jsonb, false, 9156, 9284, 'processing', '2026-02-22 16:36:54'::timestamp),
  ('Babajide Williams - completed', 'transfer', 9426, '{}'::jsonb, false, 3715, 4958, 'active', '2025-09-19 16:36:54'::timestamp),
  ('Victoria Etim - completed', 'transfer', 6262, '{}'::jsonb, true, 5461, 1776, 'active', '2025-08-10 16:36:54'::timestamp),
  ('Ifeanyi Obi - rejected', 'create', 4918, '{}'::jsonb, false, 7000, 6065, 'pending', '2025-12-25 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 'verify', 1693, '{}'::jsonb, false, 9242, 7923, 'approved', '2025-08-06 16:36:54'::timestamp),
  ('Ngozi Eze - active', 'update', 4959, '{}'::jsonb, false, 826, 9942, 'approved', '2025-09-22 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 'verify', 3169, '{}'::jsonb, false, 6408, 9874, 'approved', '2025-11-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: bundle_split_configs
INSERT INTO "bundle_split_configs" ("chunk", "routes", "sizeKB", "loadTimeMs", "preloadHint", "status", "created_at") VALUES
  ('Blessing Okoro - approved', 7306, 118, 6634, 'Emmanuel Ogbonna - completed', 'pending', '2025-08-16 16:36:54'::timestamp),
  ('Muhammed Lawal - approved', 1300, 393, 1124, 'Suleiman Abubakar - rejected', 'processing', '2026-02-08 16:36:54'::timestamp),
  ('Zainab Mohammed - approved', 7846, 87, 3991, 'Khadija Musa - completed', 'rejected', '2025-06-01 16:36:54'::timestamp),
  ('Yusuf Ibrahim - rejected', 2886, 244, 8407, 'Kabiru Aliyu - processing', 'approved', '2025-06-21 16:36:54'::timestamp),
  ('Ifeanyi Obi - processing', 3818, 451, 6297, 'Chidinma Okafor - approved', 'completed', '2025-10-17 16:36:54'::timestamp),
  ('Babajide Williams - pending', 6357, 66, 7752, 'Adebayo Ogundimu - active', 'completed', '2026-04-23 16:36:54'::timestamp),
  ('Joy Okonkwo - approved', 8874, 456, 1247, 'Aisha Bello - active', 'approved', '2025-08-15 16:36:54'::timestamp),
  ('Suleiman Abubakar - processing', 8425, 491, 512, 'Amina Garba - processing', 'pending', '2025-06-04 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: bureau_checks
INSERT INTO "bureau_checks" ("customer_id", "bureau", "credit_score", "risk_grade", "active_loans", "default_history", "checked_at") VALUES
  ('CUST-657566', 'Oluwaseun Adeyemi - active', 10, 'A', 518, 4811, '2026-03-26 16:36:54'::timestamp),
  ('CUST-562653', 'Emmanuel Ogbonna - approved', 92, 'B', 6564, 2287, '2025-10-31 16:36:54'::timestamp),
  ('CUST-398236', 'Obinna Igwe - rejected', 51, 'D', 2666, 6072, '2025-06-23 16:36:54'::timestamp),
  ('CUST-690532', 'Nkechi Nwankwo - rejected', 82, 'B', 232, 5665, '2025-08-13 16:36:54'::timestamp),
  ('CUST-213070', 'Musa Danjuma - completed', 64, 'D', 809, 1, '2025-08-20 16:36:54'::timestamp),
  ('CUST-937469', 'Ngozi Eze - approved', 61, 'A', 6610, 2184, '2025-12-25 16:36:54'::timestamp),
  ('CUST-319943', 'Chidinma Okafor - processing', 29, 'C', 2244, 6611, '2025-10-15 16:36:54'::timestamp),
  ('CUST-247176', 'Khadija Musa - pending', 58, 'B', 464, 4133, '2026-04-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cache_invalidations
INSERT INTO "cache_invalidations" ("channel", "subscribers", "invalidations24h", "avgPropagationMs", "pattern", "status", "created_at") VALUES
  ('Kabiru Aliyu - rejected', 2889, 815, 2757.36, 'Segun Oladipo - approved', 'rejected', '2025-07-07 16:36:54'::timestamp),
  ('Adebayo Ogundimu - rejected', 3728, 7782, 9656.05, 'Segun Oladipo - approved', 'approved', '2025-09-21 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 6469, 997, 634.71, 'Adebayo Ogundimu - approved', 'pending', '2025-11-18 16:36:54'::timestamp),
  ('Blessing Okoro - approved', 7643, 7464, 5777.24, 'Joy Okonkwo - pending', 'pending', '2025-11-23 16:36:54'::timestamp),
  ('Khadija Musa - pending', 4583, 6390, 3247.62, 'Chioma Nnamdi - pending', 'processing', '2025-11-01 16:36:54'::timestamp),
  ('Fatima Abdulrahman - pending', 4872, 5406, 8498.9, 'Adebayo Ogundimu - processing', 'completed', '2025-05-23 16:36:54'::timestamp),
  ('Abdullahi Sani - completed', 7781, 8651, 3689.11, 'Tunde Akinola - pending', 'completed', '2025-08-26 16:36:54'::timestamp),
  ('Aisha Bello - completed', 396, 6841, 3741.61, 'Yusuf Ibrahim - approved', 'rejected', '2025-06-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cardTransactions
INSERT INTO "cardTransactions" ("cardTxnId", "tenantId", "cardId", "accountId", "merchantName", "merchantCategory", "amount", "currency", "type", "channel", "authorizationCode", "stan", "rrn", "status", "declineReason", "createdAt") VALUES
  ('CARD-392754', 'TENA-858216', 'CARD-409751', 'ACCO-760796', 'Tunde Akinola - completed', 'basic', 8606103.17, 'NGN', 'micro', 'Khadija Musa - processing', 'CODE-457745', 'Joy Okonkwo - completed', 'Chioma Nnamdi - active', 'pending', 'Processed for Suleiman Abubakar in Enugu - rejected', '2026-03-25 16:36:54'::timestamp),
  ('CARD-579647', 'TENA-396609', 'CARD-744904', 'ACCO-334152', 'Ngozi Eze - completed', 'basic', 22742068.7, 'USD', 'basic', 'Ifeanyi Obi - completed', 'CODE-564895', 'Emmanuel Ogbonna - processing', 'Adebayo Ogundimu - approved', 'approved', 'Processed for Suleiman Abubakar in Lagos - pending', '2025-09-14 16:36:54'::timestamp),
  ('CARD-325265', 'TENA-354233', 'CARD-204969', 'ACCO-932909', 'Ngozi Eze - rejected', 'micro', 23015235.27, 'USD', 'premium', 'Aisha Bello - processing', 'CODE-837029', 'Victoria Etim - processing', 'Aisha Bello - approved', 'pending', 'Processed for Fatima Abdulrahman in Oyo - processing', '2025-07-27 16:36:54'::timestamp),
  ('CARD-795988', 'TENA-738010', 'CARD-205931', 'ACCO-540318', 'Adebayo Ogundimu - completed', 'premium', 31131111.69, 'NGN', 'enterprise', 'Folake Bakare - completed', 'CODE-855886', 'Ifeanyi Obi - rejected', 'Ifeanyi Obi - active', 'rejected', 'Processed for Babajide Williams in Delta - rejected', '2025-09-25 16:36:54'::timestamp),
  ('CARD-927013', 'TENA-744604', 'CARD-261222', 'ACCO-673203', 'Grace Adeniyi - pending', 'micro', 27921237.57, 'USD', 'standard', 'Yusuf Ibrahim - rejected', 'CODE-219058', 'Adebayo Ogundimu - completed', 'Ngozi Eze - pending', 'pending', 'Processed for Fatima Abdulrahman in Enugu - active', '2025-12-23 16:36:54'::timestamp),
  ('CARD-259378', 'TENA-775688', 'CARD-645037', 'ACCO-417381', 'Obinna Igwe - pending', 'premium', 23645001.47, 'GBP', 'enterprise', 'Hauwa Yusuf - rejected', 'CODE-814894', 'Kabiru Aliyu - processing', 'Obinna Igwe - completed', 'approved', 'Processed for Muhammed Lawal in Ogun - pending', '2025-08-18 16:36:54'::timestamp),
  ('CARD-808494', 'TENA-638870', 'CARD-895554', 'ACCO-747892', 'Victoria Etim - pending', 'standard', 13774254.21, 'USD', 'standard', 'Suleiman Abubakar - processing', 'CODE-361460', 'Nkechi Nwankwo - approved', 'Yusuf Ibrahim - completed', 'active', 'Processed for Chukwuemeka Nwosu in Lagos - approved', '2026-03-28 16:36:54'::timestamp),
  ('CARD-781570', 'TENA-488818', 'CARD-832067', 'ACCO-809283', 'Abdullahi Sani - pending', 'standard', 14786772.85, 'NGN', 'corporate', 'Babajide Williams - rejected', 'CODE-283583', 'Adebayo Ogundimu - approved', 'Grace Adeniyi - active', 'rejected', 'Processed for Oluwaseun Adeyemi in Anambra - rejected', '2025-05-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: card_batches
INSERT INTO "card_batches" ("batch_id", "batch_size", "card_type", "generated_by", "status", "cards_issued", "cards_used", "cards_revoked", "branch_code", "expires_at", "created_at") VALUES
  ('BATC-347117', 124, 'standard', 'Chidinma Okafor - pending', 'completed', 3565, 6298, 2934, 'BR-OY52', '2026-02-07 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('BATC-773204', 281, 'basic', 'Adebayo Ogundimu - approved', 'approved', 2102, 9072, 8227, 'BR-LG28', '2025-11-23 16:36:54'::timestamp, '2025-11-25 16:36:54'::timestamp),
  ('BATC-485880', 93, 'micro', 'Nkechi Nwankwo - completed', 'active', 7211, 8876, 2488, 'BR-LG20', '2025-05-24 16:36:54'::timestamp, '2025-10-29 16:36:54'::timestamp),
  ('BATC-762067', 259, 'standard', 'Kabiru Aliyu - active', 'processing', 144, 2299, 9296, 'BR-KN37', '2025-10-19 16:36:54'::timestamp, '2025-05-23 16:36:54'::timestamp),
  ('BATC-780927', 139, 'enterprise', 'Obinna Igwe - approved', 'completed', 708, 5261, 3267, 'BR-AB14', '2026-03-28 16:36:54'::timestamp, '2025-09-26 16:36:54'::timestamp),
  ('BATC-197718', 469, 'premium', 'Abdullahi Sani - active', 'processing', 5398, 9702, 5811, 'BR-OY83', '2026-02-21 16:36:54'::timestamp, '2025-10-20 16:36:54'::timestamp),
  ('BATC-679614', 9, 'micro', 'Khadija Musa - active', 'pending', 9807, 7015, 4373, 'BR-AB66', '2025-05-12 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp),
  ('BATC-629871', 265, 'enterprise', 'Halima Usman - approved', 'processing', 535, 9906, 6198, 'BR-LG38', '2026-05-01 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cbn_agri_returns
INSERT INTO "cbn_agri_returns" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-655332', 'RECO-758690', 'Nkechi Nwankwo', 'premium', 'Processed for Blessing Okoro in Enugu - processing', 'pending', 30651843.38, 'Oyo', 'REF-703612', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-09 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-227270', 'RECO-107935', 'Halima Usman', 'corporate', 'Processed for Ifeanyi Obi in Rivers - processing', 'processing', 38516819.36, 'Delta', 'REF-435934', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-15 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp),
  ('TENA-545943', 'RECO-893825', 'Victoria Etim', 'standard', 'Processed for Musa Danjuma in Lagos - processing', 'rejected', 41483113.96, 'Anambra', 'REF-894794', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-03 16:36:54'::timestamp, '2026-04-15 16:36:54'::timestamp),
  ('TENA-739879', 'RECO-301760', 'Blessing Okoro', 'corporate', 'Processed for Ifeanyi Obi in Kano - rejected', 'rejected', 4602650.64, 'Kano', 'REF-519229', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-01 16:36:54'::timestamp, '2025-08-19 16:36:54'::timestamp),
  ('TENA-893825', 'RECO-577997', 'Halima Usman', 'basic', 'Processed for Hauwa Yusuf in Kaduna - active', 'approved', 12800689.08, 'Lagos', 'REF-250078', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-08 16:36:54'::timestamp, '2025-07-10 16:36:54'::timestamp),
  ('TENA-363436', 'RECO-587959', 'Muhammed Lawal', 'standard', 'Processed for Adebayo Ogundimu in Abuja - active', 'pending', 35179021.22, 'Kaduna', 'REF-892234', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-19 16:36:54'::timestamp, '2025-05-28 16:36:54'::timestamp),
  ('TENA-130699', 'RECO-672105', 'Abdullahi Sani', 'premium', 'Processed for Suleiman Abubakar in Delta - completed', 'active', 27467361.23, 'Lagos', 'REF-141495', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-19 16:36:54'::timestamp, '2026-03-06 16:36:54'::timestamp),
  ('TENA-518734', 'RECO-952476', 'Obinna Igwe', 'enterprise', 'Processed for Victoria Etim in Lagos - approved', 'approved', 15993634.27, 'Kano', 'REF-826467', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-23 16:36:54'::timestamp, '2025-12-15 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cbn_agsmeis
INSERT INTO "cbn_agsmeis" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-129067', 'RECO-634813', 'Folake Bakare', 'enterprise', 'Processed for Chioma Nnamdi in Rivers - rejected', 'rejected', 18713782.66, 'Kaduna', 'REF-483765', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-27 16:36:54'::timestamp, '2025-12-16 16:36:54'::timestamp),
  ('TENA-593290', 'RECO-590355', 'Chukwuemeka Nwosu', 'micro', 'Processed for Rasheed Olanrewaju in Delta - completed', 'rejected', 9183088.83, 'Delta', 'REF-398281', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-22 16:36:54'::timestamp, '2026-03-01 16:36:54'::timestamp),
  ('TENA-680560', 'RECO-805176', 'Ngozi Eze', 'basic', 'Processed for Ngozi Eze in Rivers - processing', 'completed', 12866784.31, 'Anambra', 'REF-459738', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp),
  ('TENA-164744', 'RECO-798986', 'Aisha Bello', 'enterprise', 'Processed for Adebayo Ogundimu in Abuja - rejected', 'processing', 46324267.61, 'Rivers', 'REF-755150', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-07 16:36:54'::timestamp, '2026-04-01 16:36:54'::timestamp),
  ('TENA-667478', 'RECO-414484', 'Oluwaseun Adeyemi', 'enterprise', 'Processed for Nkechi Nwankwo in Oyo - approved', 'pending', 1981562.24, 'Lagos', 'REF-930155', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-13 16:36:54'::timestamp, '2025-10-03 16:36:54'::timestamp),
  ('TENA-566947', 'RECO-654715', 'Chidinma Okafor', 'corporate', 'Processed for Ifeanyi Obi in Rivers - active', 'active', 2268948.76, 'Lagos', 'REF-104637', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-09 16:36:54'::timestamp, '2025-12-18 16:36:54'::timestamp),
  ('TENA-426485', 'RECO-641130', 'Obinna Igwe', 'premium', 'Processed for Segun Oladipo in Rivers - approved', 'pending', 44469264.44, 'Kaduna', 'REF-801783', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-01 16:36:54'::timestamp, '2025-09-14 16:36:54'::timestamp),
  ('TENA-593380', 'RECO-352395', 'Musa Danjuma', 'enterprise', 'Processed for Rasheed Olanrewaju in Enugu - active', 'rejected', 47583851.68, 'Lagos', 'REF-250417', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-08 16:36:54'::timestamp, '2025-07-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cbn_anchor_borrowers
INSERT INTO "cbn_anchor_borrowers" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-915286', 'RECO-269192', 'Folake Bakare', 'premium', 'Processed for Joy Okonkwo in Ogun - approved', 'pending', 41859283.2, 'Anambra', 'REF-957455', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-27 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('TENA-685319', 'RECO-285161', 'Rasheed Olanrewaju', 'corporate', 'Processed for Ngozi Eze in Rivers - rejected', 'pending', 40813292.39, 'Oyo', 'REF-792868', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-03 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp),
  ('TENA-149472', 'RECO-747301', 'Rasheed Olanrewaju', 'corporate', 'Processed for Chukwuemeka Nwosu in Kano - pending', 'approved', 4621874.16, 'Enugu', 'REF-991965', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-02 16:36:54'::timestamp, '2026-05-09 16:36:54'::timestamp),
  ('TENA-910863', 'RECO-318306', 'Hauwa Yusuf', 'corporate', 'Processed for Muhammed Lawal in Kano - active', 'processing', 45193306.69, 'Anambra', 'REF-448462', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-11 16:36:54'::timestamp, '2026-03-08 16:36:54'::timestamp),
  ('TENA-663148', 'RECO-304816', 'Victoria Etim', 'standard', 'Processed for Halima Usman in Abuja - approved', 'rejected', 32156196.25, 'Anambra', 'REF-397939', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-01 16:36:54'::timestamp, '2025-10-28 16:36:54'::timestamp),
  ('TENA-197010', 'RECO-525415', 'Ngozi Eze', 'micro', 'Processed for Kabiru Aliyu in Kano - completed', 'approved', 16030400.3, 'Delta', 'REF-101280', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-03 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp),
  ('TENA-303213', 'RECO-400173', 'Abdullahi Sani', 'standard', 'Processed for Musa Danjuma in Delta - active', 'completed', 9789333.13, 'Abuja', 'REF-542079', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-07 16:36:54'::timestamp, '2025-08-17 16:36:54'::timestamp),
  ('TENA-353181', 'RECO-185849', 'Rasheed Olanrewaju', 'premium', 'Processed for Blessing Okoro in Lagos - approved', 'approved', 18474356.38, 'Kano', 'REF-640136', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2025-06-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cbn_compliance_checks
INSERT INTO "cbn_compliance_checks" ("circular", "title", "category", "total_controls", "passing", "failing", "compliance_score", "last_assessed", "next_assessment", "status", "created_at") VALUES
  ('Abdullahi Sani - pending', 'Musa Danjuma - active', 'enterprise', 18425816, 7810, 2738, 7988.89, '2025-11-04 16:36:54'::timestamp, '2025-09-11 16:36:54'::timestamp, 'active', '2026-02-14 16:36:54'::timestamp),
  ('Ifeanyi Obi - active', 'Abdullahi Sani - active', 'enterprise', 44856382, 6989, 7900, 7875.61, '2025-09-12 16:36:54'::timestamp, '2026-02-01 16:36:54'::timestamp, 'pending', '2025-08-17 16:36:54'::timestamp),
  ('Muhammed Lawal - processing', 'Khadija Musa - rejected', 'micro', 38350004, 6662, 2799, 5017.47, '2025-07-12 16:36:54'::timestamp, '2025-11-15 16:36:54'::timestamp, 'rejected', '2025-10-13 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 'Aisha Bello - processing', 'standard', 537338, 6614, 7998, 6882.94, '2025-05-31 16:36:54'::timestamp, '2025-10-17 16:36:54'::timestamp, 'processing', '2025-07-17 16:36:54'::timestamp),
  ('Segun Oladipo - processing', 'Fatima Abdulrahman - active', 'standard', 1328166, 2752, 3949, 8737.6, '2025-05-12 16:36:54'::timestamp, '2025-09-11 16:36:54'::timestamp, 'approved', '2026-01-13 16:36:54'::timestamp),
  ('Obinna Igwe - processing', 'Khadija Musa - pending', 'standard', 46598096, 1154, 275, 3711.47, '2026-03-15 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp, 'approved', '2025-06-20 16:36:54'::timestamp),
  ('Amina Garba - active', 'Babajide Williams - active', 'basic', 20146989, 6342, 6224, 5895.7, '2025-09-25 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp, 'processing', '2026-04-03 16:36:54'::timestamp),
  ('Nkechi Nwankwo - processing', 'Chidinma Okafor - active', 'enterprise', 5484416, 1539, 4423, 9077.86, '2026-05-12 16:36:54'::timestamp, '2025-07-21 16:36:54'::timestamp, 'rejected', '2025-07-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cdn_edge_configs
INSERT INTO "cdn_edge_configs" ("provider", "origin", "ttlStatic", "ttlApi", "brotliEnabled", "bandwidthSaved24h", "status", "created_at") VALUES
  ('Suleiman Abubakar - approved', 'Yusuf Ibrahim - pending', 301, 7694, false, 'Zainab Mohammed - processing', 'processing', '2026-03-10 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - approved', 'Halima Usman - pending', 2353, 8031, false, 'Zainab Mohammed - pending', 'rejected', '2025-10-02 16:36:54'::timestamp),
  ('Zainab Mohammed - rejected', 'Chidinma Okafor - completed', 6797, 4701, false, 'Obinna Igwe - completed', 'processing', '2026-04-24 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - pending', 'Abdullahi Sani - completed', 5957, 4839, true, 'Aisha Bello - active', 'approved', '2025-10-18 16:36:54'::timestamp),
  ('Khadija Musa - processing', 'Rasheed Olanrewaju - active', 9692, 2589, true, 'Rasheed Olanrewaju - processing', 'active', '2025-05-25 16:36:54'::timestamp),
  ('Yusuf Ibrahim - completed', 'Emmanuel Ogbonna - pending', 6729, 2757, true, 'Yusuf Ibrahim - rejected', 'processing', '2026-03-04 16:36:54'::timestamp),
  ('Segun Oladipo - approved', 'Adebayo Ogundimu - processing', 5992, 1440, true, 'Kabiru Aliyu - rejected', 'pending', '2025-09-05 16:36:54'::timestamp),
  ('Khadija Musa - approved', 'Chioma Nnamdi - processing', 7734, 5328, true, 'Zainab Mohammed - processing', 'completed', '2025-11-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: certificates
INSERT INTO "certificates" ("cert_id", "common_name", "cert_type", "algorithm", "issuer", "serial_number", "status", "valid_from", "valid_to", "renewal_days", "last_renewed", "revoked_at", "revocation_reason", "created_at") VALUES
  ('CERT-746268', 'Kabiru Aliyu - approved', 'corporate', 'Hauwa Yusuf - completed', 'Folake Bakare - processing', 'Blessing Okoro - rejected', 'approved', '2025-12-18 16:36:54'::timestamp, '2025-09-29 16:36:54'::timestamp, 159, '2025-12-01 16:36:54'::timestamp, '2026-05-11 16:36:54'::timestamp, 'Processed for Tunde Akinola in Oyo - completed', '2025-06-05 16:36:54'::timestamp),
  ('CERT-853296', 'Ifeanyi Obi - processing', 'standard', 'Nkechi Nwankwo - pending', 'Zainab Mohammed - completed', 'Rasheed Olanrewaju - completed', 'pending', '2025-06-23 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp, 317, '2025-10-19 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp, 'Processed for Musa Danjuma in Kano - active', '2025-12-07 16:36:54'::timestamp),
  ('CERT-917870', 'Zainab Mohammed - rejected', 'premium', 'Emmanuel Ogbonna - completed', 'Kabiru Aliyu - processing', 'Aisha Bello - approved', 'pending', '2025-06-11 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp, 225, '2025-10-26 16:36:54'::timestamp, '2025-09-17 16:36:54'::timestamp, 'Processed for Ifeanyi Obi in Abuja - rejected', '2025-07-15 16:36:54'::timestamp),
  ('CERT-482846', 'Nkechi Nwankwo - processing', 'basic', 'Ngozi Eze - rejected', 'Joy Okonkwo - completed', 'Zainab Mohammed - active', 'processing', '2026-01-08 16:36:54'::timestamp, '2026-04-06 16:36:54'::timestamp, 319, '2026-04-27 16:36:54'::timestamp, '2025-07-11 16:36:54'::timestamp, 'Processed for Ifeanyi Obi in Oyo - approved', '2026-01-13 16:36:54'::timestamp),
  ('CERT-167416', 'Blessing Okoro - approved', 'enterprise', 'Joy Okonkwo - active', 'Nkechi Nwankwo - rejected', 'Joy Okonkwo - active', 'rejected', '2026-03-02 16:36:54'::timestamp, '2025-08-22 16:36:54'::timestamp, 40, '2026-05-10 16:36:54'::timestamp, '2026-04-21 16:36:54'::timestamp, 'Processed for Zainab Mohammed in Enugu - completed', '2025-06-15 16:36:54'::timestamp),
  ('CERT-411332', 'Emmanuel Ogbonna - approved', 'micro', 'Emmanuel Ogbonna - active', 'Abdullahi Sani - active', 'Rasheed Olanrewaju - pending', 'completed', '2025-07-18 16:36:54'::timestamp, '2025-05-29 16:36:54'::timestamp, 309, '2025-09-27 16:36:54'::timestamp, '2026-03-07 16:36:54'::timestamp, 'Processed for Abdullahi Sani in Ogun - rejected', '2025-11-21 16:36:54'::timestamp),
  ('CERT-856601', 'Suleiman Abubakar - pending', 'standard', 'Segun Oladipo - rejected', 'Chidinma Okafor - completed', 'Khadija Musa - completed', 'approved', '2026-03-29 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp, 233, '2026-05-02 16:36:54'::timestamp, '2026-04-05 16:36:54'::timestamp, 'Processed for Khadija Musa in Rivers - completed', '2026-02-06 16:36:54'::timestamp),
  ('CERT-844008', 'Kabiru Aliyu - pending', 'micro', 'Suleiman Abubakar - approved', 'Segun Oladipo - rejected', 'Nkechi Nwankwo - completed', 'active', '2025-07-05 16:36:54'::timestamp, '2026-03-19 16:36:54'::timestamp, 130, '2026-04-06 16:36:54'::timestamp, '2025-08-03 16:36:54'::timestamp, 'Processed for Babajide Williams in Kano - processing', '2026-04-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: coalescing_rules
INSERT INTO "coalescing_rules" ("route", "windowMs", "coalescedRequests24h", "uniqueRequests24h", "savingsRatio", "status", "created_at") VALUES
  ('/api/platform/coalescing-rules', 7173, 7493, 8581, 'Khadija Musa - approved', 'active', '2025-09-10 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 2361, 4262, 3900, 'Ngozi Eze - completed', 'active', '2025-12-13 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 2580, 9835, 7369, 'Obinna Igwe - active', 'pending', '2025-10-12 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 7631, 6790, 3829, 'Tunde Akinola - completed', 'approved', '2026-03-19 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 2208, 9070, 8374, 'Obinna Igwe - pending', 'processing', '2026-02-21 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 6521, 3547, 6712, 'Oluwaseun Adeyemi - completed', 'pending', '2026-02-16 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 4534, 5313, 6698, 'Rasheed Olanrewaju - rejected', 'pending', '2026-04-17 16:36:54'::timestamp),
  ('/api/platform/coalescing-rules', 2092, 1788, 9511, 'Chioma Nnamdi - rejected', 'pending', '2025-05-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: commodity_exchange
INSERT INTO "commodity_exchange" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-931356', 'RECO-862167', 'Grace Adeniyi', 'premium', 'Processed for Hauwa Yusuf in Anambra - processing', 'processing', 3939733.64, 'Anambra', 'REF-533660', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-02 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp),
  ('TENA-713359', 'RECO-261679', 'Ifeanyi Obi', 'premium', 'Processed for Ifeanyi Obi in Delta - active', 'pending', 41943545.23, 'Kaduna', 'REF-858912', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-25 16:36:54'::timestamp, '2025-09-03 16:36:54'::timestamp),
  ('TENA-425024', 'RECO-925607', 'Yusuf Ibrahim', 'micro', 'Processed for Chioma Nnamdi in Kano - processing', 'completed', 43813409.02, 'Anambra', 'REF-282367', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2025-11-07 16:36:54'::timestamp),
  ('TENA-307126', 'RECO-106890', 'Rasheed Olanrewaju', 'standard', 'Processed for Grace Adeniyi in Ogun - approved', 'rejected', 15293944.67, 'Oyo', 'REF-507884', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-17 16:36:54'::timestamp, '2025-12-28 16:36:54'::timestamp),
  ('TENA-677683', 'RECO-644742', 'Hauwa Yusuf', 'micro', 'Processed for Nkechi Nwankwo in Ogun - active', 'pending', 5150252.6, 'Abuja', 'REF-712146', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-06 16:36:54'::timestamp, '2025-11-27 16:36:54'::timestamp),
  ('TENA-293401', 'RECO-416816', 'Adebayo Ogundimu', 'corporate', 'Processed for Victoria Etim in Anambra - active', 'approved', 46043695.8, 'Kano', 'REF-247062', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-27 16:36:54'::timestamp, '2026-04-17 16:36:54'::timestamp),
  ('TENA-519649', 'RECO-990001', 'Victoria Etim', 'standard', 'Processed for Ifeanyi Obi in Rivers - approved', 'active', 252878.66, 'Rivers', 'REF-897214', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-21 16:36:54'::timestamp, '2026-04-05 16:36:54'::timestamp),
  ('TENA-590070', 'RECO-651904', 'Tunde Akinola', 'enterprise', 'Processed for Aisha Bello in Kaduna - rejected', 'pending', 48436582.09, 'Kaduna', 'REF-113264', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-15 16:36:54'::timestamp, '2026-03-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: commodity_price_intelligence
INSERT INTO "commodity_price_intelligence" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-344547', 'RECO-415244', 'Chioma Nnamdi', 'premium', 'Processed for Blessing Okoro in Anambra - active', 'approved', 25526549.97, 'Lagos', 'REF-239926', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-01 16:36:54'::timestamp, '2025-12-12 16:36:54'::timestamp),
  ('TENA-424608', 'RECO-342459', 'Aisha Bello', 'premium', 'Processed for Chukwuemeka Nwosu in Kano - rejected', 'approved', 3403916.74, 'Lagos', 'REF-850148', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('TENA-905240', 'RECO-617727', 'Victoria Etim', 'corporate', 'Processed for Suleiman Abubakar in Kaduna - active', 'active', 15721814.88, 'Lagos', 'REF-470062', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-19 16:36:54'::timestamp, '2026-03-31 16:36:54'::timestamp),
  ('TENA-992481', 'RECO-406809', 'Amina Garba', 'premium', 'Processed for Folake Bakare in Lagos - rejected', 'pending', 48362620.61, 'Rivers', 'REF-887437', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-14 16:36:54'::timestamp, '2025-11-18 16:36:54'::timestamp),
  ('TENA-716228', 'RECO-623092', 'Oluwaseun Adeyemi', 'standard', 'Processed for Emmanuel Ogbonna in Oyo - processing', 'pending', 24075919.58, 'Rivers', 'REF-718866', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-23 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp),
  ('TENA-352922', 'RECO-408791', 'Amina Garba', 'premium', 'Processed for Emmanuel Ogbonna in Ogun - completed', 'processing', 25475248.04, 'Kano', 'REF-367080', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-08 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp),
  ('TENA-907154', 'RECO-463939', 'Yusuf Ibrahim', 'corporate', 'Processed for Zainab Mohammed in Enugu - completed', 'pending', 21055243.34, 'Ogun', 'REF-787424', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-31 16:36:54'::timestamp, '2025-08-10 16:36:54'::timestamp),
  ('TENA-223823', 'RECO-837167', 'Ifeanyi Obi', 'enterprise', 'Processed for Victoria Etim in Rivers - active', 'approved', 36675601.23, 'Abuja', 'REF-609060', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-23 16:36:54'::timestamp, '2025-06-15 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: compression_configs
INSERT INTO "compression_configs" ("algorithm", "level", "minBytes", "compressionRatio", "bandwidthSaved24h", "status", "created_at") VALUES
  ('Khadija Musa - approved', 1694, 3668, 'Rasheed Olanrewaju - approved', 'Tunde Akinola - completed', 'processing', '2025-07-02 16:36:54'::timestamp),
  ('Nkechi Nwankwo - completed', 851, 8502, 'Chidinma Okafor - pending', 'Chioma Nnamdi - processing', 'completed', '2025-07-12 16:36:54'::timestamp),
  ('Chioma Nnamdi - approved', 2625, 9527, 'Ngozi Eze - rejected', 'Muhammed Lawal - rejected', 'completed', '2025-08-15 16:36:54'::timestamp),
  ('Halima Usman - rejected', 1541, 4297, 'Obinna Igwe - approved', 'Khadija Musa - processing', 'approved', '2026-03-08 16:36:54'::timestamp),
  ('Blessing Okoro - active', 4731, 9701, 'Rasheed Olanrewaju - rejected', 'Oluwaseun Adeyemi - pending', 'rejected', '2026-04-29 16:36:54'::timestamp),
  ('Grace Adeniyi - rejected', 922, 3274, 'Victoria Etim - approved', 'Folake Bakare - active', 'approved', '2026-01-10 16:36:54'::timestamp),
  ('Kabiru Aliyu - processing', 1000, 1570, 'Ngozi Eze - rejected', 'Emmanuel Ogbonna - completed', 'active', '2026-03-26 16:36:54'::timestamp),
  ('Muhammed Lawal - pending', 3568, 6062, 'Khadija Musa - processing', 'Chioma Nnamdi - rejected', 'completed', '2025-08-11 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cooperative_credit_scoring
INSERT INTO "cooperative_credit_scoring" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-631451', 'RECO-700014', 'Aisha Bello', 'corporate', 'Processed for Segun Oladipo in Kaduna - approved', 'approved', 28639946.98, 'Abuja', 'REF-775231', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-02 16:36:54'::timestamp, '2026-02-26 16:36:54'::timestamp),
  ('TENA-195543', 'RECO-199881', 'Musa Danjuma', 'enterprise', 'Processed for Chukwuemeka Nwosu in Ogun - processing', 'approved', 30224796.91, 'Kaduna', 'REF-280412', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-10 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp),
  ('TENA-285688', 'RECO-123940', 'Suleiman Abubakar', 'basic', 'Processed for Blessing Okoro in Abuja - approved', 'rejected', 44378907.7, 'Anambra', 'REF-121287', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-31 16:36:54'::timestamp, '2025-07-22 16:36:54'::timestamp),
  ('TENA-527554', 'RECO-480395', 'Obinna Igwe', 'corporate', 'Processed for Babajide Williams in Delta - completed', 'processing', 42460811.42, 'Abuja', 'REF-368575', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-06 16:36:54'::timestamp, '2025-11-15 16:36:54'::timestamp),
  ('TENA-577240', 'RECO-188353', 'Hauwa Yusuf', 'standard', 'Processed for Folake Bakare in Delta - pending', 'rejected', 1541137.3, 'Delta', 'REF-681358', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-03 16:36:54'::timestamp, '2025-06-20 16:36:54'::timestamp),
  ('TENA-121570', 'RECO-942024', 'Chioma Nnamdi', 'enterprise', 'Processed for Obinna Igwe in Lagos - pending', 'pending', 14138932.31, 'Lagos', 'REF-716552', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2025-09-30 16:36:54'::timestamp),
  ('TENA-772344', 'RECO-185252', 'Oluwaseun Adeyemi', 'basic', 'Processed for Khadija Musa in Kaduna - approved', 'approved', 8226013.32, 'Kano', 'REF-627898', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-24 16:36:54'::timestamp, '2025-11-18 16:36:54'::timestamp),
  ('TENA-259002', 'RECO-241035', 'Oluwaseun Adeyemi', 'corporate', 'Processed for Segun Oladipo in Delta - active', 'processing', 39294295.78, 'Delta', 'REF-186377', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-25 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cooperative_financials
INSERT INTO "cooperative_financials" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-555874', 'RECO-290474', 'Khadija Musa', 'standard', 'Processed for Khadija Musa in Anambra - approved', 'pending', 18987018.54, 'Rivers', 'REF-293679', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-20 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp),
  ('TENA-241651', 'RECO-219228', 'Zainab Mohammed', 'micro', 'Processed for Halima Usman in Oyo - pending', 'rejected', 42884363.08, 'Delta', 'REF-912725', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-12 16:36:54'::timestamp, '2025-09-14 16:36:54'::timestamp),
  ('TENA-130162', 'RECO-329590', 'Chukwuemeka Nwosu', 'corporate', 'Processed for Aisha Bello in Enugu - pending', 'active', 18965429.42, 'Anambra', 'REF-447002', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-01 16:36:54'::timestamp, '2025-08-13 16:36:54'::timestamp),
  ('TENA-263057', 'RECO-369508', 'Chidinma Okafor', 'corporate', 'Processed for Victoria Etim in Lagos - processing', 'pending', 23095612.04, 'Anambra', 'REF-868004', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-14 16:36:54'::timestamp, '2025-08-24 16:36:54'::timestamp),
  ('TENA-362864', 'RECO-620998', 'Emmanuel Ogbonna', 'corporate', 'Processed for Amina Garba in Kano - completed', 'processing', 17858004.5, 'Abuja', 'REF-424769', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-07 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp),
  ('TENA-152407', 'RECO-929985', 'Grace Adeniyi', 'enterprise', 'Processed for Abdullahi Sani in Anambra - active', 'processing', 18790187.56, 'Oyo', 'REF-971317', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-22 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp),
  ('TENA-284618', 'RECO-616237', 'Victoria Etim', 'micro', 'Processed for Nkechi Nwankwo in Delta - processing', 'rejected', 23323638.67, 'Anambra', 'REF-547856', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-13 16:36:54'::timestamp, '2026-03-12 16:36:54'::timestamp),
  ('TENA-646992', 'RECO-554916', 'Fatima Abdulrahman', 'standard', 'Processed for Grace Adeniyi in Enugu - approved', 'completed', 48499221.4, 'Oyo', 'REF-926175', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-13 16:36:54'::timestamp, '2026-01-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cooperative_management
INSERT INTO "cooperative_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-545223', 'RECO-474749', 'Segun Oladipo', 'enterprise', 'Processed for Abdullahi Sani in Rivers - approved', 'approved', 9728503.54, 'Abuja', 'REF-564722', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-12 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp),
  ('TENA-874863', 'RECO-588192', 'Musa Danjuma', 'enterprise', 'Processed for Halima Usman in Oyo - completed', 'pending', 20369109.07, 'Anambra', 'REF-987806', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-08 16:36:54'::timestamp, '2025-09-27 16:36:54'::timestamp),
  ('TENA-641711', 'RECO-254835', 'Joy Okonkwo', 'micro', 'Processed for Aisha Bello in Rivers - rejected', 'processing', 24062715.73, 'Ogun', 'REF-385524', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-24 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp),
  ('TENA-241073', 'RECO-289317', 'Hauwa Yusuf', 'micro', 'Processed for Suleiman Abubakar in Oyo - processing', 'completed', 35750145.94, 'Kano', 'REF-656611', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-29 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('TENA-749616', 'RECO-844184', 'Kabiru Aliyu', 'enterprise', 'Processed for Rasheed Olanrewaju in Ogun - completed', 'active', 26981508.75, 'Kaduna', 'REF-874684', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-10 16:36:54'::timestamp, '2025-07-19 16:36:54'::timestamp),
  ('TENA-930472', 'RECO-195628', 'Khadija Musa', 'corporate', 'Processed for Victoria Etim in Anambra - active', 'rejected', 33393255.06, 'Rivers', 'REF-109418', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-23 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp),
  ('TENA-438413', 'RECO-930457', 'Muhammed Lawal', 'premium', 'Processed for Muhammed Lawal in Kano - rejected', 'processing', 29803117.51, 'Kaduna', 'REF-121757', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2025-12-23 16:36:54'::timestamp),
  ('TENA-631962', 'RECO-470597', 'Aisha Bello', 'micro', 'Processed for Obinna Igwe in Rivers - pending', 'rejected', 34247197.21, 'Lagos', 'REF-626315', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-08 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cooperative_meetings
INSERT INTO "cooperative_meetings" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-573842', 'RECO-296565', 'Hauwa Yusuf', 'enterprise', 'Processed for Oluwaseun Adeyemi in Enugu - active', 'approved', 29112956.12, 'Kano', 'REF-690807', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-09 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('TENA-861581', 'RECO-541274', 'Joy Okonkwo', 'basic', 'Processed for Yusuf Ibrahim in Kaduna - active', 'processing', 42527739.24, 'Lagos', 'REF-329648', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-13 16:36:54'::timestamp, '2025-06-27 16:36:54'::timestamp),
  ('TENA-783330', 'RECO-398951', 'Tunde Akinola', 'micro', 'Processed for Hauwa Yusuf in Enugu - processing', 'processing', 565433.31, 'Rivers', 'REF-866313', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-02 16:36:54'::timestamp, '2025-06-07 16:36:54'::timestamp),
  ('TENA-435316', 'RECO-657442', 'Rasheed Olanrewaju', 'basic', 'Processed for Kabiru Aliyu in Abuja - approved', 'approved', 21652123.89, 'Enugu', 'REF-630135', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-06 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp),
  ('TENA-961915', 'RECO-866813', 'Victoria Etim', 'enterprise', 'Processed for Chioma Nnamdi in Lagos - approved', 'completed', 2318634.48, 'Kano', 'REF-897457', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-30 16:36:54'::timestamp, '2025-05-25 16:36:54'::timestamp),
  ('TENA-845977', 'RECO-544041', 'Babajide Williams', 'micro', 'Processed for Khadija Musa in Rivers - completed', 'processing', 47962940.42, 'Kano', 'REF-514623', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2026-01-27 16:36:54'::timestamp),
  ('TENA-240690', 'RECO-883212', 'Kabiru Aliyu', 'premium', 'Processed for Muhammed Lawal in Rivers - rejected', 'pending', 37169730.03, 'Kaduna', 'REF-474554', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-11 16:36:54'::timestamp, '2025-09-13 16:36:54'::timestamp),
  ('TENA-122368', 'RECO-381929', 'Muhammed Lawal', 'basic', 'Processed for Suleiman Abubakar in Enugu - active', 'processing', 21995645.09, 'Ogun', 'REF-239090', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: corporate_monitoring_events
INSERT INTO "corporate_monitoring_events" ("company_id", "event_type", "description", "risk_impact", "source_system", "detected_at", "acknowledged_at") VALUES
  ('Kano Textiles Ltd', 'corporate', 'Processed for Yusuf Ibrahim in Kano - completed', 'Chioma Nnamdi - completed', 'NFIU', '2025-07-14 16:36:54'::timestamp, '2026-01-03 16:36:54'::timestamp),
  ('Plateau Agro Services', 'enterprise', 'Processed for Oluwaseun Adeyemi in Rivers - active', 'Obinna Igwe - processing', 'CBN', '2026-03-13 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp),
  ('Niger Delta Fisheries', 'standard', 'Processed for Blessing Okoro in Anambra - completed', 'Suleiman Abubakar - approved', 'API', '2025-08-14 16:36:54'::timestamp, '2026-02-11 16:36:54'::timestamp),
  ('Sterling Microfinance Bank', 'enterprise', 'Processed for Zainab Mohammed in Lagos - rejected', 'Segun Oladipo - rejected', 'OFAC', '2025-06-18 16:36:54'::timestamp, '2026-02-07 16:36:54'::timestamp),
  ('Oyo Cooperative Union', 'enterprise', 'Processed for Yusuf Ibrahim in Delta - processing', 'Folake Bakare - processing', 'OFAC', '2026-01-15 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp),
  ('Niger Delta Fisheries', 'corporate', 'Processed for Nkechi Nwankwo in Lagos - completed', 'Chukwuemeka Nwosu - approved', 'internal', '2025-12-30 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('United Bank for Africa', 'basic', 'Processed for Yusuf Ibrahim in Kano - rejected', 'Folake Bakare - approved', 'OFAC', '2026-03-13 16:36:54'::timestamp, '2026-03-21 16:36:54'::timestamp),
  ('Abuja Capital Holdings', 'corporate', 'Processed for Ifeanyi Obi in Kaduna - rejected', 'Obinna Igwe - pending', 'API', '2025-08-05 16:36:54'::timestamp, '2025-11-06 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: correlation_rules
INSERT INTO "correlation_rules" ("name", "mitre_ids", "kill_chain_phase", "trigger_events", "correlation_window", "triggered_24h", "true_positives", "false_positives", "status", "created_at") VALUES
  ('Fatima Abdulrahman', '{}'::jsonb, 'Fatima Abdulrahman - approved', '{}'::jsonb, 'Joy Okonkwo - completed', 6011, 3464, 9867, 'active', '2025-06-04 16:36:54'::timestamp),
  ('Babajide Williams', '{}'::jsonb, 'Aisha Bello - approved', '{}'::jsonb, 'Victoria Etim - completed', 2699, 193, 976, 'processing', '2026-01-23 16:36:54'::timestamp),
  ('Amina Garba', '{}'::jsonb, 'Hauwa Yusuf - rejected', '{}'::jsonb, 'Segun Oladipo - completed', 6399, 8834, 44, 'rejected', '2025-08-27 16:36:54'::timestamp),
  ('Adebayo Ogundimu', '{}'::jsonb, 'Zainab Mohammed - active', '{}'::jsonb, 'Emmanuel Ogbonna - active', 9095, 4699, 7801, 'active', '2025-08-07 16:36:54'::timestamp),
  ('Khadija Musa', '{}'::jsonb, 'Emmanuel Ogbonna - approved', '{}'::jsonb, 'Adebayo Ogundimu - pending', 6000, 2250, 788, 'processing', '2026-04-10 16:36:54'::timestamp),
  ('Blessing Okoro', '{}'::jsonb, 'Adebayo Ogundimu - rejected', '{}'::jsonb, 'Nkechi Nwankwo - processing', 652, 1348, 6088, 'approved', '2025-12-27 16:36:54'::timestamp),
  ('Musa Danjuma', '{}'::jsonb, 'Abdullahi Sani - completed', '{}'::jsonb, 'Adebayo Ogundimu - processing', 4619, 429, 4876, 'pending', '2026-01-31 16:36:54'::timestamp),
  ('Halima Usman', '{}'::jsonb, 'Ngozi Eze - completed', '{}'::jsonb, 'Blessing Okoro - active', 5153, 586, 6373, 'rejected', '2025-06-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: cropInsurancePolicies
INSERT INTO "cropInsurancePolicies" ("policyId", "tenantId", "farmerId", "policyType", "cropCovered", "coverageAreaHectares", "sumInsured", "premiumAmount", "premiumFrequency", "policyStart", "policyEnd", "weatherTrigger", "claims", "status", "underwriter", "createdAt", "updatedAt") VALUES
  ('POLI-947282', 'TENA-264420', 'FARM-282071', 'premium', 'Millet', 7367.39, 255.31, 49531859.56, 'Suleiman Abubakar - processing', 'Abdullahi Sani - completed', 'Folake Bakare - completed', '{}'::jsonb, '{}'::jsonb, 'pending', 'Chukwuemeka Nwosu - rejected', '2025-05-30 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp),
  ('POLI-557381', 'TENA-734224', 'FARM-666737', 'corporate', 'Rice', 3363.63, 3654.56, 10515944.65, 'Ngozi Eze - approved', 'Ifeanyi Obi - rejected', 'Khadija Musa - processing', '{}'::jsonb, '{}'::jsonb, 'approved', 'Tunde Akinola - completed', '2025-06-26 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('POLI-716044', 'TENA-296350', 'FARM-452646', 'micro', 'Cocoa', 1034.23, 210.41, 12395241.42, 'Joy Okonkwo - processing', 'Halima Usman - pending', 'Blessing Okoro - processing', '{}'::jsonb, '{}'::jsonb, 'completed', 'Blessing Okoro - processing', '2026-03-21 16:36:54'::timestamp, '2025-12-01 16:36:54'::timestamp),
  ('POLI-711647', 'TENA-562480', 'FARM-111110', 'basic', 'Cassava', 2615.26, 6120.41, 38618859.45, 'Folake Bakare - rejected', 'Halima Usman - active', 'Kabiru Aliyu - approved', '{}'::jsonb, '{}'::jsonb, 'pending', 'Babajide Williams - active', '2026-04-27 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp),
  ('POLI-646461', 'TENA-555656', 'FARM-802978', 'standard', 'Maize', 3559.93, 5356.09, 27354274.57, 'Segun Oladipo - pending', 'Hauwa Yusuf - rejected', 'Fatima Abdulrahman - approved', '{}'::jsonb, '{}'::jsonb, 'pending', 'Suleiman Abubakar - rejected', '2025-06-14 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp),
  ('POLI-759603', 'TENA-117669', 'FARM-515398', 'basic', 'Yam', 8291.09, 7822.08, 46831587.97, 'Folake Bakare - processing', 'Grace Adeniyi - active', 'Joy Okonkwo - pending', '{}'::jsonb, '{}'::jsonb, 'approved', 'Grace Adeniyi - completed', '2026-03-17 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp),
  ('POLI-871340', 'TENA-103491', 'FARM-301105', 'enterprise', 'Cassava', 948.44, 1184.67, 14851783.75, 'Chioma Nnamdi - approved', 'Emmanuel Ogbonna - active', 'Obinna Igwe - rejected', '{}'::jsonb, '{}'::jsonb, 'completed', 'Fatima Abdulrahman - active', '2025-07-15 16:36:54'::timestamp, '2026-05-05 16:36:54'::timestamp),
  ('POLI-189727', 'TENA-441069', 'FARM-835097', 'standard', 'Cassava', 7149.62, 5428.75, 20282841.68, 'Abdullahi Sani - completed', 'Obinna Igwe - processing', 'Nkechi Nwankwo - approved', '{}'::jsonb, '{}'::jsonb, 'active', 'Fatima Abdulrahman - pending', '2026-01-06 16:36:54'::timestamp, '2025-06-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: crop_yield_prediction
INSERT INTO "crop_yield_prediction" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-177194', 'RECO-234569', 'Blessing Okoro', 'basic', 'Processed for Muhammed Lawal in Kaduna - rejected', 'approved', 26178644.99, 'Kano', 'REF-615789', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-16 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp),
  ('TENA-286019', 'RECO-743443', 'Chukwuemeka Nwosu', 'micro', 'Processed for Nkechi Nwankwo in Anambra - rejected', 'completed', 14820715.81, 'Kaduna', 'REF-661850', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-05 16:36:54'::timestamp, '2025-12-14 16:36:54'::timestamp),
  ('TENA-514925', 'RECO-630653', 'Aisha Bello', 'basic', 'Processed for Joy Okonkwo in Lagos - pending', 'processing', 11866373.58, 'Enugu', 'REF-427186', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-29 16:36:54'::timestamp, '2025-11-02 16:36:54'::timestamp),
  ('TENA-116511', 'RECO-502747', 'Babajide Williams', 'premium', 'Processed for Kabiru Aliyu in Lagos - approved', 'rejected', 47861533.01, 'Oyo', 'REF-512015', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-24 16:36:54'::timestamp, '2025-12-30 16:36:54'::timestamp),
  ('TENA-310060', 'RECO-143715', 'Emmanuel Ogbonna', 'micro', 'Processed for Emmanuel Ogbonna in Rivers - pending', 'completed', 49591943.45, 'Rivers', 'REF-133291', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-29 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('TENA-773221', 'RECO-448844', 'Ifeanyi Obi', 'basic', 'Processed for Victoria Etim in Oyo - rejected', 'processing', 2677973.03, 'Ogun', 'REF-533684', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-27 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('TENA-807167', 'RECO-116672', 'Oluwaseun Adeyemi', 'micro', 'Processed for Ngozi Eze in Kaduna - active', 'completed', 48119109.61, 'Ogun', 'REF-354071', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-09 16:36:54'::timestamp, '2025-12-27 16:36:54'::timestamp),
  ('TENA-634551', 'RECO-451169', 'Grace Adeniyi', 'enterprise', 'Processed for Chukwuemeka Nwosu in Oyo - processing', 'active', 20924270.44, 'Abuja', 'REF-764292', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-12 16:36:54'::timestamp, '2025-11-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: crossborder_agri_trade
INSERT INTO "crossborder_agri_trade" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-225741', 'RECO-310456', 'Folake Bakare', 'basic', 'Processed for Obinna Igwe in Kano - completed', 'processing', 47353847.5, 'Ogun', 'REF-147373', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-22 16:36:54'::timestamp, '2026-01-01 16:36:54'::timestamp),
  ('TENA-661585', 'RECO-621529', 'Abdullahi Sani', 'micro', 'Processed for Hauwa Yusuf in Kaduna - rejected', 'approved', 10614940.26, 'Ogun', 'REF-560881', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2025-05-23 16:36:54'::timestamp),
  ('TENA-340370', 'RECO-644740', 'Blessing Okoro', 'premium', 'Processed for Aisha Bello in Enugu - active', 'pending', 38804173.34, 'Enugu', 'REF-413664', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-22 16:36:54'::timestamp, '2025-08-28 16:36:54'::timestamp),
  ('TENA-467216', 'RECO-992318', 'Rasheed Olanrewaju', 'enterprise', 'Processed for Abdullahi Sani in Oyo - completed', 'processing', 10486394.2, 'Oyo', 'REF-786783', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-28 16:36:54'::timestamp, '2025-10-15 16:36:54'::timestamp),
  ('TENA-584037', 'RECO-245854', 'Musa Danjuma', 'standard', 'Processed for Adebayo Ogundimu in Kano - approved', 'completed', 37085412.78, 'Lagos', 'REF-903283', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-529564', 'RECO-506196', 'Victoria Etim', 'standard', 'Processed for Abdullahi Sani in Ogun - pending', 'active', 7601601.85, 'Lagos', 'REF-633835', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-08 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('TENA-978931', 'RECO-950552', 'Victoria Etim', 'enterprise', 'Processed for Victoria Etim in Kaduna - active', 'rejected', 25010978.12, 'Abuja', 'REF-152855', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-23 16:36:54'::timestamp, '2025-11-08 16:36:54'::timestamp),
  ('TENA-732250', 'RECO-820609', 'Khadija Musa', 'basic', 'Processed for Suleiman Abubakar in Delta - rejected', 'active', 5542639.57, 'Ogun', 'REF-624772', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-28 16:36:54'::timestamp, '2025-11-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: crypto_keys
INSERT INTO "crypto_keys" ("key_id", "name", "key_type", "algorithm", "purpose", "status", "key_size_bits", "rotation_period_days", "hsm_slot", "custodian_1", "custodian_2", "usage_count", "last_used_at", "expires_at", "rotated_at", "created_at") VALUES
  ('KEY-358946', 'Suleiman Abubakar', 'standard', 'Chukwuemeka Nwosu - approved', 'Processed for Adebayo Ogundimu in Ogun - approved', 'active', 200, 27, 'Ngozi Eze - rejected', 'Amina Garba - pending', 'Khadija Musa - approved', 262, '2025-05-24 16:36:54'::timestamp, '2026-04-02 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('KEY-780110', 'Kabiru Aliyu', 'standard', 'Victoria Etim - approved', 'Processed for Blessing Okoro in Kano - pending', 'active', 146, 284, 'Chidinma Okafor - completed', 'Khadija Musa - approved', 'Muhammed Lawal - completed', 422, '2026-02-15 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp, '2025-12-26 16:36:54'::timestamp),
  ('KEY-472508', 'Amina Garba', 'enterprise', 'Babajide Williams - pending', 'Processed for Abdullahi Sani in Lagos - rejected', 'active', 483, 296, 'Zainab Mohammed - processing', 'Halima Usman - approved', 'Nkechi Nwankwo - processing', 489, '2025-07-16 16:36:54'::timestamp, '2025-11-06 16:36:54'::timestamp, '2025-11-05 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp),
  ('KEY-915587', 'Abdullahi Sani', 'premium', 'Blessing Okoro - completed', 'Processed for Tunde Akinola in Ogun - processing', 'completed', 231, 182, 'Emmanuel Ogbonna - processing', 'Rasheed Olanrewaju - processing', 'Halima Usman - completed', 362, '2025-05-28 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp),
  ('KEY-858555', 'Chukwuemeka Nwosu', 'enterprise', 'Muhammed Lawal - pending', 'Processed for Obinna Igwe in Kaduna - rejected', 'completed', 39, 303, 'Chioma Nnamdi - pending', 'Yusuf Ibrahim - completed', 'Ifeanyi Obi - pending', 234, '2026-05-12 16:36:54'::timestamp, '2025-10-07 16:36:54'::timestamp, '2026-04-22 16:36:54'::timestamp, '2026-01-18 16:36:54'::timestamp),
  ('KEY-134855', 'Chioma Nnamdi', 'basic', 'Halima Usman - approved', 'Processed for Chidinma Okafor in Oyo - active', 'active', 35, 42, 'Segun Oladipo - completed', 'Grace Adeniyi - approved', 'Blessing Okoro - pending', 162, '2025-06-15 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp),
  ('KEY-994824', 'Fatima Abdulrahman', 'basic', 'Chukwuemeka Nwosu - approved', 'Processed for Grace Adeniyi in Rivers - approved', 'processing', 358, 346, 'Muhammed Lawal - rejected', 'Muhammed Lawal - approved', 'Muhammed Lawal - rejected', 489, '2026-03-19 16:36:54'::timestamp, '2026-04-13 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp, '2025-07-23 16:36:54'::timestamp),
  ('KEY-591720', 'Suleiman Abubakar', 'premium', 'Obinna Igwe - rejected', 'Processed for Folake Bakare in Kano - pending', 'pending', 64, 345, 'Chidinma Okafor - approved', 'Segun Oladipo - rejected', 'Rasheed Olanrewaju - active', 121, '2026-02-03 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp, '2025-07-16 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: csp_policies
INSERT INTO "csp_policies" ("domain", "directives", "report_uri", "violations_24h", "unique_sources", "status", "created_at") VALUES
  ('Ngozi Eze - approved', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/867137', 8355, 2772, 'processing', '2025-09-14 16:36:54'::timestamp),
  ('Abdullahi Sani - approved', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/140614', 6802, 5442, 'completed', '2026-05-02 16:36:54'::timestamp),
  ('Chioma Nnamdi - rejected', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/671812', 6569, 8546, 'pending', '2026-04-08 16:36:54'::timestamp),
  ('Blessing Okoro - pending', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/740594', 6081, 324, 'active', '2025-10-07 16:36:54'::timestamp),
  ('Segun Oladipo - completed', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/906902', 2082, 2501, 'processing', '2025-12-07 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/461616', 3259, 2552, 'rejected', '2025-08-16 16:36:54'::timestamp),
  ('Khadija Musa - pending', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/829752', 336, 9210, 'active', '2026-03-02 16:36:54'::timestamp),
  ('Muhammed Lawal - completed', '{}'::jsonb, 'https://api.54bank.ng/csp_policies/892238', 284, 6526, 'active', '2026-01-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ctr_reports_aml
INSERT INTO "ctr_reports_aml" ("customerId", "customerName", "transactionId", "amount", "currency", "transactionType", "nfiuReference", "autoFiled", "status", "created_at") VALUES
  ('CUST-256637', 'Musa Danjuma', 'TRAN-923305', 14386711, 'GBP', 'micro', 'REF-729076', false, 'rejected', '2026-04-11 16:36:54'::timestamp),
  ('CUST-792428', 'Emmanuel Ogbonna', 'TRAN-419876', 13232151, 'GBP', 'premium', 'REF-387617', true, 'pending', '2025-08-06 16:36:54'::timestamp),
  ('CUST-193844', 'Chidinma Okafor', 'TRAN-735600', 32081003, 'USD', 'standard', 'REF-969862', true, 'rejected', '2025-08-01 16:36:54'::timestamp),
  ('CUST-871131', 'Victoria Etim', 'TRAN-784554', 47964304, 'NGN', 'micro', 'REF-892930', true, 'approved', '2025-12-11 16:36:54'::timestamp),
  ('CUST-252097', 'Ngozi Eze', 'TRAN-912579', 5687839, 'NGN', 'premium', 'REF-909302', true, 'approved', '2025-07-21 16:36:54'::timestamp),
  ('CUST-341584', 'Yusuf Ibrahim', 'TRAN-209005', 10649292, 'GBP', 'enterprise', 'REF-450270', true, 'rejected', '2025-07-19 16:36:54'::timestamp),
  ('CUST-171289', 'Muhammed Lawal', 'TRAN-692244', 18612178, 'GBP', 'corporate', 'REF-562467', true, 'active', '2025-09-15 16:36:54'::timestamp),
  ('CUST-451169', 'Chidinma Okafor', 'TRAN-565559', 24086960, 'NGN', 'standard', 'REF-864190', true, 'completed', '2025-10-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerApprovals
INSERT INTO "customerApprovals" ("approvalId", "customerId", "entityType", "entityId", "title", "detail", "route", "state", "requestedAt", "requestedByRole", "requestedById", "approvalRole", "resolvedAt", "resolutionNote") VALUES
  ('Muhammed Lawal - completed', 'CUST-352114', 'standard', 'ENTI-495290', 'Suleiman Abubakar - active', 'Processed for Victoria Etim in Lagos - active', '/api/platform/customerApprovals', 'Rivers', '2026-01-04 16:36:54'::timestamp, 'operations', 'REQU-718649', 'operations', '2025-07-23 16:36:54'::timestamp, 'Babajide Williams - approved'),
  ('Yusuf Ibrahim - processing', 'CUST-534120', 'micro', 'ENTI-494618', 'Adebayo Ogundimu - processing', 'Processed for Ngozi Eze in Anambra - completed', '/api/platform/customerApprovals', 'Rivers', '2025-12-08 16:36:54'::timestamp, 'treasury', 'REQU-780215', 'compliance', '2026-01-17 16:36:54'::timestamp, 'Kabiru Aliyu - completed'),
  ('Segun Oladipo - rejected', 'CUST-534216', 'micro', 'ENTI-856423', 'Ifeanyi Obi - processing', 'Processed for Oluwaseun Adeyemi in Enugu - active', '/api/platform/customerApprovals', 'Anambra', '2025-11-20 16:36:54'::timestamp, 'treasury', 'REQU-682207', 'compliance', '2025-09-18 16:36:54'::timestamp, 'Adebayo Ogundimu - processing'),
  ('Rasheed Olanrewaju - rejected', 'CUST-167667', 'corporate', 'ENTI-902647', 'Kabiru Aliyu - pending', 'Processed for Chioma Nnamdi in Kano - processing', '/api/platform/customerApprovals', 'Kano', '2025-05-21 16:36:54'::timestamp, 'branch', 'REQU-413077', 'branch', '2025-07-16 16:36:54'::timestamp, 'Halima Usman - approved'),
  ('Joy Okonkwo - active', 'CUST-747006', 'micro', 'ENTI-705127', 'Zainab Mohammed - active', 'Processed for Rasheed Olanrewaju in Oyo - approved', '/api/platform/customerApprovals', 'Ogun', '2025-08-13 16:36:54'::timestamp, 'branch', 'REQU-335325', 'branch', '2025-10-15 16:36:54'::timestamp, 'Chidinma Okafor - processing'),
  ('Rasheed Olanrewaju - active', 'CUST-926338', 'corporate', 'ENTI-717316', 'Hauwa Yusuf - approved', 'Processed for Grace Adeniyi in Kano - active', '/api/platform/customerApprovals', 'Oyo', '2025-06-30 16:36:54'::timestamp, 'operations', 'REQU-256698', 'compliance', '2025-06-12 16:36:54'::timestamp, 'Blessing Okoro - completed'),
  ('Muhammed Lawal - processing', 'CUST-296542', 'basic', 'ENTI-490837', 'Muhammed Lawal - processing', 'Processed for Suleiman Abubakar in Abuja - pending', '/api/platform/customerApprovals', 'Kaduna', '2025-06-26 16:36:54'::timestamp, 'branch', 'REQU-544848', 'operations', '2026-01-18 16:36:54'::timestamp, 'Nkechi Nwankwo - active'),
  ('Oluwaseun Adeyemi - processing', 'CUST-364858', 'enterprise', 'ENTI-796831', 'Fatima Abdulrahman - completed', 'Processed for Tunde Akinola in Kaduna - completed', '/api/platform/customerApprovals', 'Enugu', '2025-12-26 16:36:54'::timestamp, 'compliance', 'REQU-923884', 'compliance', '2025-10-05 16:36:54'::timestamp, 'Oluwaseun Adeyemi - processing')
ON CONFLICT DO NOTHING;

-- Table: customerBillPayments
INSERT INTO "customerBillPayments" ("paymentId", "customerId", "category", "provider", "amount", "status", "paidAt", "reference", "billerId", "customerReference", "customerName", "scheduledFor", "evidenceStatus", "channel", "createdAt") VALUES
  ('PAYM-791926', 'CUST-524647', 'micro', 'Khadija Musa - processing', 24916571.73, 'processing', '2025-12-02 16:36:54'::timestamp, 'REF-809325', 'BILL-708061', 'REF-203542', 'Segun Oladipo', '2026-01-04 16:36:54'::timestamp, 'processing', 'Musa Danjuma - active', '2025-06-11 16:36:54'::timestamp),
  ('PAYM-185487', 'CUST-647730', 'corporate', 'Musa Danjuma - active', 19552402.31, 'rejected', '2026-01-11 16:36:54'::timestamp, 'REF-863039', 'BILL-356192', 'REF-111684', 'Muhammed Lawal', '2025-09-30 16:36:54'::timestamp, 'active', 'Zainab Mohammed - rejected', '2025-09-11 16:36:54'::timestamp),
  ('PAYM-455968', 'CUST-169423', 'micro', 'Babajide Williams - completed', 36194947.6, 'completed', '2026-04-10 16:36:54'::timestamp, 'REF-274865', 'BILL-577033', 'REF-534491', 'Khadija Musa', '2025-11-24 16:36:54'::timestamp, 'completed', 'Musa Danjuma - active', '2026-03-12 16:36:54'::timestamp),
  ('PAYM-153831', 'CUST-211100', 'basic', 'Suleiman Abubakar - approved', 36230472.81, 'rejected', '2026-01-16 16:36:54'::timestamp, 'REF-532908', 'BILL-373916', 'REF-637644', 'Fatima Abdulrahman', '2026-02-16 16:36:54'::timestamp, 'active', 'Aisha Bello - pending', '2025-12-22 16:36:54'::timestamp),
  ('PAYM-953921', 'CUST-588007', 'basic', 'Adebayo Ogundimu - completed', 23988452.51, 'rejected', '2025-05-24 16:36:54'::timestamp, 'REF-270745', 'BILL-953787', 'REF-919812', 'Halima Usman', '2026-04-15 16:36:54'::timestamp, 'rejected', 'Hauwa Yusuf - active', '2025-12-21 16:36:54'::timestamp),
  ('PAYM-970042', 'CUST-135018', 'premium', 'Tunde Akinola - active', 24224456.64, 'active', '2025-11-04 16:36:54'::timestamp, 'REF-905185', 'BILL-506096', 'REF-538400', 'Khadija Musa', '2025-11-28 16:36:54'::timestamp, 'pending', 'Kabiru Aliyu - approved', '2025-08-05 16:36:54'::timestamp),
  ('PAYM-593014', 'CUST-675415', 'enterprise', 'Suleiman Abubakar - completed', 4588912.96, 'active', '2026-04-10 16:36:54'::timestamp, 'REF-669334', 'BILL-445033', 'REF-144678', 'Chioma Nnamdi', '2026-01-06 16:36:54'::timestamp, 'rejected', 'Muhammed Lawal - approved', '2025-07-27 16:36:54'::timestamp),
  ('PAYM-515807', 'CUST-831527', 'basic', 'Babajide Williams - approved', 46147169.42, 'pending', '2025-11-23 16:36:54'::timestamp, 'REF-936339', 'BILL-830382', 'REF-468964', 'Emmanuel Ogbonna', '2025-09-22 16:36:54'::timestamp, 'active', 'Joy Okonkwo - processing', '2026-02-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerCardEvents
INSERT INTO "customerCardEvents" ("eventId", "cardId", "customerId", "title", "detail", "severity", "createdAt") VALUES
  ('EVEN-699813', 'CARD-752944', 'CUST-849591', 'Grace Adeniyi - active', 'Processed for Zainab Mohammed in Ogun - completed', 'high', '2025-08-28 16:36:54'::timestamp),
  ('EVEN-497965', 'CARD-368478', 'CUST-669516', 'Adebayo Ogundimu - processing', 'Processed for Adebayo Ogundimu in Abuja - rejected', 'info', '2025-12-06 16:36:54'::timestamp),
  ('EVEN-428679', 'CARD-996776', 'CUST-677277', 'Emmanuel Ogbonna - completed', 'Processed for Muhammed Lawal in Rivers - rejected', 'warning', '2025-07-24 16:36:54'::timestamp),
  ('EVEN-300566', 'CARD-585406', 'CUST-507927', 'Tunde Akinola - pending', 'Processed for Musa Danjuma in Delta - rejected', 'medium', '2025-08-19 16:36:54'::timestamp),
  ('EVEN-442934', 'CARD-388048', 'CUST-504241', 'Muhammed Lawal - approved', 'Processed for Oluwaseun Adeyemi in Ogun - completed', 'critical', '2025-12-15 16:36:54'::timestamp),
  ('EVEN-338817', 'CARD-995286', 'CUST-192221', 'Chidinma Okafor - active', 'Processed for Musa Danjuma in Ogun - approved', 'warning', '2026-04-19 16:36:54'::timestamp),
  ('EVEN-312241', 'CARD-719565', 'CUST-537318', 'Khadija Musa - approved', 'Processed for Hauwa Yusuf in Ogun - completed', 'info', '2025-12-03 16:36:54'::timestamp),
  ('EVEN-420254', 'CARD-518776', 'CUST-536017', 'Suleiman Abubakar - pending', 'Processed for Muhammed Lawal in Ogun - pending', 'critical', '2025-11-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerCards
INSERT INTO "customerCards" ("cardId", "customerId", "cardType", "brand", "lastFour", "expiryDate", "cardHolder", "balance", "isLocked", "controls", "spendingLimits", "colorTone", "updatedAt", "createdAt") VALUES
  ('CARD-190229', 'CUST-160304', 'premium', 'Muhammed Lawal - active', 'Kabiru Aliyu - approved', 'Halima Usman - rejected', 'Zainab Mohammed - rejected', 25610620.94, 8111, '{}'::jsonb, '{}'::jsonb, 'Segun Oladipo - pending', '2026-03-17 16:36:54'::timestamp, '2025-07-03 16:36:54'::timestamp),
  ('CARD-854498', 'CUST-318860', 'enterprise', 'Chioma Nnamdi - rejected', 'Nkechi Nwankwo - active', 'Musa Danjuma - pending', 'Grace Adeniyi - pending', 40057877.55, 1123, '{}'::jsonb, '{}'::jsonb, 'Muhammed Lawal - rejected', '2025-07-01 16:36:54'::timestamp, '2025-11-13 16:36:54'::timestamp),
  ('CARD-759445', 'CUST-884920', 'micro', 'Victoria Etim - active', 'Ngozi Eze - completed', 'Yusuf Ibrahim - processing', 'Suleiman Abubakar - approved', 31919169.44, 9582, '{}'::jsonb, '{}'::jsonb, 'Yusuf Ibrahim - pending', '2025-07-08 16:36:54'::timestamp, '2026-04-16 16:36:54'::timestamp),
  ('CARD-227867', 'CUST-980920', 'enterprise', 'Chukwuemeka Nwosu - approved', 'Zainab Mohammed - active', 'Segun Oladipo - approved', 'Hauwa Yusuf - approved', 44806933.82, 204, '{}'::jsonb, '{}'::jsonb, 'Victoria Etim - rejected', '2026-01-09 16:36:54'::timestamp, '2026-04-30 16:36:54'::timestamp),
  ('CARD-937611', 'CUST-400127', 'corporate', 'Suleiman Abubakar - completed', 'Muhammed Lawal - completed', 'Khadija Musa - active', 'Suleiman Abubakar - processing', 43719112.96, 2412, '{}'::jsonb, '{}'::jsonb, 'Aisha Bello - rejected', '2025-07-08 16:36:54'::timestamp, '2025-12-13 16:36:54'::timestamp),
  ('CARD-439132', 'CUST-818915', 'micro', 'Zainab Mohammed - processing', 'Hauwa Yusuf - active', 'Grace Adeniyi - rejected', 'Muhammed Lawal - approved', 33423195.65, 4250, '{}'::jsonb, '{}'::jsonb, 'Rasheed Olanrewaju - completed', '2025-09-03 16:36:54'::timestamp, '2025-05-27 16:36:54'::timestamp),
  ('CARD-355873', 'CUST-233256', 'corporate', 'Emmanuel Ogbonna - approved', 'Muhammed Lawal - rejected', 'Chioma Nnamdi - active', 'Babajide Williams - processing', 48339597.86, 958, '{}'::jsonb, '{}'::jsonb, 'Chukwuemeka Nwosu - rejected', '2026-05-07 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp),
  ('CARD-151010', 'CUST-840877', 'enterprise', 'Fatima Abdulrahman - processing', 'Chukwuemeka Nwosu - pending', 'Muhammed Lawal - rejected', 'Suleiman Abubakar - rejected', 29016687.45, 5521, '{}'::jsonb, '{}'::jsonb, 'Amina Garba - approved', '2025-08-18 16:36:54'::timestamp, '2025-11-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerNotifications
INSERT INTO "customerNotifications" ("notificationId", "customerId", "title", "message", "notificationType", "isRead", "actionUrl", "createdAt") VALUES
  ('NOTI-310802', 'CUST-201082', 'Obinna Igwe - pending', 'Processed for Obinna Igwe in Lagos - approved', 'corporate', 7125, 'https://api.54bank.ng/customerNotifications/406614', '2025-11-26 16:36:54'::timestamp),
  ('NOTI-767661', 'CUST-314752', 'Amina Garba - approved', 'Processed for Obinna Igwe in Ogun - active', 'enterprise', 9165, 'https://api.54bank.ng/customerNotifications/709687', '2025-06-30 16:36:54'::timestamp),
  ('NOTI-828955', 'CUST-107769', 'Chioma Nnamdi - pending', 'Processed for Nkechi Nwankwo in Rivers - processing', 'corporate', 2583, 'https://api.54bank.ng/customerNotifications/251943', '2026-03-02 16:36:54'::timestamp),
  ('NOTI-698904', 'CUST-391577', 'Adebayo Ogundimu - approved', 'Processed for Chukwuemeka Nwosu in Rivers - approved', 'enterprise', 9334, 'https://api.54bank.ng/customerNotifications/876910', '2025-12-03 16:36:54'::timestamp),
  ('NOTI-678637', 'CUST-551827', 'Yusuf Ibrahim - approved', 'Processed for Grace Adeniyi in Rivers - rejected', 'standard', 23, 'https://api.54bank.ng/customerNotifications/604618', '2025-08-20 16:36:54'::timestamp),
  ('NOTI-559021', 'CUST-157795', 'Chukwuemeka Nwosu - approved', 'Processed for Suleiman Abubakar in Anambra - approved', 'basic', 2622, 'https://api.54bank.ng/customerNotifications/605672', '2025-10-23 16:36:54'::timestamp),
  ('NOTI-626076', 'CUST-220840', 'Abdullahi Sani - pending', 'Processed for Segun Oladipo in Lagos - active', 'micro', 7922, 'https://api.54bank.ng/customerNotifications/374951', '2025-09-23 16:36:54'::timestamp),
  ('NOTI-239000', 'CUST-860238', 'Ifeanyi Obi - processing', 'Processed for Joy Okonkwo in Enugu - completed', 'enterprise', 3434, 'https://api.54bank.ng/customerNotifications/336292', '2026-01-11 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerSavedBillers
INSERT INTO "customerSavedBillers" ("billerRecordId", "customerId", "category", "provider", "billerId", "customerReference", "nickname", "lastAmount", "verifiedName", "lastPaidAt", "createdAt") VALUES
  ('BILL-889279', 'CUST-602343', 'enterprise', 'Victoria Etim - rejected', 'BILL-483202', 'REF-536162', 'Chioma Nnamdi - approved', 44929857.97, 'Segun Oladipo - active', '2026-01-04 16:36:54'::timestamp, '2026-01-22 16:36:54'::timestamp),
  ('BILL-212731', 'CUST-186147', 'standard', 'Segun Oladipo - processing', 'BILL-643940', 'REF-460817', 'Chioma Nnamdi - rejected', 32614530.45, 'Chioma Nnamdi - processing', '2026-01-06 16:36:54'::timestamp, '2025-05-15 16:36:54'::timestamp),
  ('BILL-481237', 'CUST-943127', 'standard', 'Halima Usman - completed', 'BILL-823376', 'REF-745417', 'Babajide Williams - pending', 18069788.55, 'Ngozi Eze - active', '2025-12-03 16:36:54'::timestamp, '2026-01-27 16:36:54'::timestamp),
  ('BILL-448114', 'CUST-729970', 'corporate', 'Abdullahi Sani - rejected', 'BILL-599430', 'REF-577640', 'Rasheed Olanrewaju - completed', 15716097.09, 'Ifeanyi Obi - active', '2026-05-08 16:36:54'::timestamp, '2025-08-05 16:36:54'::timestamp),
  ('BILL-268778', 'CUST-943877', 'basic', 'Chidinma Okafor - pending', 'BILL-640342', 'REF-383624', 'Hauwa Yusuf - completed', 14784350.29, 'Victoria Etim - rejected', '2026-01-23 16:36:54'::timestamp, '2026-05-12 16:36:54'::timestamp),
  ('BILL-481422', 'CUST-603967', 'micro', 'Obinna Igwe - pending', 'BILL-212209', 'REF-719714', 'Chidinma Okafor - active', 16291268.46, 'Joy Okonkwo - rejected', '2026-03-01 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp),
  ('BILL-368781', 'CUST-657892', 'basic', 'Kabiru Aliyu - pending', 'BILL-168277', 'REF-515072', 'Adebayo Ogundimu - approved', 16045746.19, 'Emmanuel Ogbonna - completed', '2025-11-02 16:36:54'::timestamp, '2026-04-16 16:36:54'::timestamp),
  ('BILL-303874', 'CUST-940451', 'corporate', 'Joy Okonkwo - rejected', 'BILL-629898', 'REF-542760', 'Tunde Akinola - active', 6770492.99, 'Babajide Williams - pending', '2026-01-05 16:36:54'::timestamp, '2025-12-06 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerSessionPreferences
INSERT INTO "customerSessionPreferences" ("actorId", "actorRole", "tenantId", "activeCustomerId", "createdAt", "updatedAt") VALUES
  ('ACTO-119895', 'branch', 'TENA-241831', 'ACTI-943351', '2025-11-15 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('ACTO-745269', 'treasury', 'TENA-454513', 'ACTI-310299', '2026-05-10 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp),
  ('ACTO-352251', 'compliance', 'TENA-211187', 'ACTI-117961', '2026-02-12 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('ACTO-600811', 'treasury', 'TENA-238810', 'ACTI-221357', '2025-09-25 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('ACTO-369637', 'treasury', 'TENA-113321', 'ACTI-290883', '2025-10-13 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp),
  ('ACTO-933897', 'compliance', 'TENA-358269', 'ACTI-484835', '2025-05-17 16:36:54'::timestamp, '2025-06-01 16:36:54'::timestamp),
  ('ACTO-489058', 'treasury', 'TENA-579476', 'ACTI-448722', '2025-08-11 16:36:54'::timestamp, '2025-08-18 16:36:54'::timestamp),
  ('ACTO-685055', 'compliance', 'TENA-827750', 'ACTI-532364', '2025-09-21 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerStatementExports
INSERT INTO "customerStatementExports" ("exportRequestId", "customerId", "exportJobId", "format", "rowCount", "title", "createdAt") VALUES
  ('EXPO-319480', 'CUST-553072', 'EXPO-590301', 'Abdullahi Sani - processing', 457, 'Chukwuemeka Nwosu - rejected', '2026-04-17 16:36:54'::timestamp),
  ('EXPO-141193', 'CUST-683847', 'EXPO-720790', 'Amina Garba - completed', 342, 'Muhammed Lawal - processing', '2025-12-01 16:36:54'::timestamp),
  ('EXPO-157771', 'CUST-853538', 'EXPO-895762', 'Amina Garba - processing', 396, 'Khadija Musa - processing', '2025-09-26 16:36:54'::timestamp),
  ('EXPO-185212', 'CUST-233698', 'EXPO-693889', 'Hauwa Yusuf - active', 243, 'Folake Bakare - processing', '2026-02-06 16:36:54'::timestamp),
  ('EXPO-104185', 'CUST-241080', 'EXPO-630960', 'Zainab Mohammed - processing', 1, 'Adebayo Ogundimu - processing', '2026-02-04 16:36:54'::timestamp),
  ('EXPO-537409', 'CUST-321530', 'EXPO-974853', 'Folake Bakare - active', 377, 'Khadija Musa - approved', '2025-10-10 16:36:54'::timestamp),
  ('EXPO-707140', 'CUST-976364', 'EXPO-164308', 'Rasheed Olanrewaju - rejected', 369, 'Muhammed Lawal - completed', '2026-02-22 16:36:54'::timestamp),
  ('EXPO-495106', 'CUST-442693', 'EXPO-892045', 'Abdullahi Sani - pending', 324, 'Folake Bakare - active', '2025-07-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerStatements
INSERT INTO "customerStatements" ("statementId", "customerId", "title", "detail", "amount", "direction", "statementType", "status", "occurredAt", "reference", "category", "createdAt") VALUES
  ('Kano', 'CUST-550230', 'Yusuf Ibrahim - processing', 'Processed for Zainab Mohammed in Kano - approved', 34890948.59, 'Khadija Musa - completed', 'Kaduna', 'completed', '2025-08-07 16:36:54'::timestamp, 'REF-449211', 'standard', '2025-10-26 16:36:54'::timestamp),
  ('Ogun', 'CUST-387841', 'Adebayo Ogundimu - active', 'Processed for Blessing Okoro in Enugu - pending', 42619575.79, 'Khadija Musa - active', 'Delta', 'completed', '2025-12-03 16:36:54'::timestamp, 'REF-151869', 'premium', '2025-09-19 16:36:54'::timestamp),
  ('Rivers', 'CUST-953611', 'Chidinma Okafor - processing', 'Processed for Zainab Mohammed in Anambra - rejected', 47704222.61, 'Zainab Mohammed - approved', 'Rivers', 'rejected', '2026-02-09 16:36:54'::timestamp, 'REF-797816', 'enterprise', '2025-07-13 16:36:54'::timestamp),
  ('Enugu', 'CUST-683924', 'Halima Usman - completed', 'Processed for Emmanuel Ogbonna in Lagos - pending', 28240135.48, 'Tunde Akinola - approved', 'Lagos', 'pending', '2026-01-13 16:36:54'::timestamp, 'REF-819243', 'premium', '2026-05-08 16:36:54'::timestamp),
  ('Rivers', 'CUST-801145', 'Segun Oladipo - processing', 'Processed for Musa Danjuma in Enugu - pending', 22226940.12, 'Muhammed Lawal - active', 'Ogun', 'rejected', '2026-04-10 16:36:54'::timestamp, 'REF-509710', 'enterprise', '2026-04-03 16:36:54'::timestamp),
  ('Enugu', 'CUST-407990', 'Yusuf Ibrahim - active', 'Processed for Chidinma Okafor in Oyo - pending', 13044422.46, 'Nkechi Nwankwo - rejected', 'Abuja', 'completed', '2025-07-10 16:36:54'::timestamp, 'REF-653707', 'premium', '2025-06-30 16:36:54'::timestamp),
  ('Rivers', 'CUST-293107', 'Halima Usman - rejected', 'Processed for Yusuf Ibrahim in Rivers - approved', 20217435.09, 'Musa Danjuma - approved', 'Enugu', 'completed', '2025-08-13 16:36:54'::timestamp, 'REF-285114', 'standard', '2025-09-27 16:36:54'::timestamp),
  ('Anambra', 'CUST-476959', 'Tunde Akinola - approved', 'Processed for Amina Garba in Kaduna - approved', 18140695.56, 'Obinna Igwe - approved', 'Abuja', 'approved', '2025-07-15 16:36:54'::timestamp, 'REF-526027', 'premium', '2026-02-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customerTransfers
INSERT INTO "customerTransfers" ("transferId", "customerId", "beneficiaryId", "beneficiaryName", "amount", "narration", "transferType", "status", "bankCode", "bankName", "accountNumber", "accountName", "workflowId", "otpReference", "otpIssuedAt", "confirmedAt", "approvalState", "createdAt", "updatedAt") VALUES
  ('TRAN-951536', 'CUST-168366', 'BENE-653512', 'Ifeanyi Obi - processing', 16481744.47, 'Amina Garba - approved', 'premium', 'active', 'CODE-967905', 'Halima Usman - completed', 'Obinna Igwe - active', 'Halima Usman - approved', 'WORK-802586', 'REF-873548', '2025-10-15 16:36:54'::timestamp, '2025-08-14 16:36:54'::timestamp, 'Rivers', '2025-08-31 16:36:54'::timestamp, '2025-06-24 16:36:54'::timestamp),
  ('TRAN-973698', 'CUST-254262', 'BENE-617559', 'Adebayo Ogundimu - active', 2760191.39, 'Aisha Bello - approved', 'premium', 'rejected', 'CODE-477264', 'Aisha Bello - approved', 'Yusuf Ibrahim - completed', 'Nkechi Nwankwo - active', 'WORK-306077', 'REF-995862', '2025-11-06 16:36:54'::timestamp, '2025-12-14 16:36:54'::timestamp, 'Oyo', '2025-12-02 16:36:54'::timestamp, '2025-09-02 16:36:54'::timestamp),
  ('TRAN-547698', 'CUST-820787', 'BENE-866598', 'Chidinma Okafor - pending', 39112897.28, 'Tunde Akinola - processing', 'enterprise', 'active', 'CODE-650287', 'Zainab Mohammed - pending', 'Chidinma Okafor - active', 'Hauwa Yusuf - pending', 'WORK-639119', 'REF-340137', '2026-04-02 16:36:54'::timestamp, '2025-10-06 16:36:54'::timestamp, 'Enugu', '2025-05-26 16:36:54'::timestamp, '2026-05-01 16:36:54'::timestamp),
  ('TRAN-394144', 'CUST-640568', 'BENE-545598', 'Adebayo Ogundimu - active', 37301522.23, 'Fatima Abdulrahman - active', 'premium', 'rejected', 'CODE-385635', 'Chukwuemeka Nwosu - completed', 'Amina Garba - rejected', 'Khadija Musa - active', 'WORK-573181', 'REF-252317', '2026-01-12 16:36:54'::timestamp, '2025-07-13 16:36:54'::timestamp, 'Abuja', '2026-03-30 16:36:54'::timestamp, '2026-04-17 16:36:54'::timestamp),
  ('TRAN-792908', 'CUST-904170', 'BENE-290886', 'Aisha Bello - approved', 10286011.26, 'Amina Garba - rejected', 'micro', 'pending', 'CODE-779946', 'Fatima Abdulrahman - pending', 'Yusuf Ibrahim - active', 'Chidinma Okafor - pending', 'WORK-247129', 'REF-206143', '2025-07-07 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp, 'Anambra', '2026-02-02 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp),
  ('TRAN-168161', 'CUST-348541', 'BENE-263560', 'Ngozi Eze - completed', 45362770.11, 'Joy Okonkwo - rejected', 'premium', 'processing', 'CODE-699905', 'Nkechi Nwankwo - approved', 'Kabiru Aliyu - processing', 'Muhammed Lawal - rejected', 'WORK-983299', 'REF-473509', '2026-05-07 16:36:54'::timestamp, '2026-05-10 16:36:54'::timestamp, 'Ogun', '2026-04-12 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp),
  ('TRAN-557049', 'CUST-272110', 'BENE-677976', 'Emmanuel Ogbonna - completed', 2263596.5, 'Oluwaseun Adeyemi - active', 'standard', 'approved', 'CODE-930449', 'Chioma Nnamdi - approved', 'Obinna Igwe - rejected', 'Halima Usman - completed', 'WORK-394409', 'REF-843940', '2025-06-24 16:36:54'::timestamp, '2026-02-24 16:36:54'::timestamp, 'Rivers', '2026-04-06 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('TRAN-906693', 'CUST-359135', 'BENE-540950', 'Khadija Musa - approved', 12697664.76, 'Adebayo Ogundimu - pending', 'corporate', 'approved', 'CODE-215859', 'Amina Garba - approved', 'Obinna Igwe - active', 'Kabiru Aliyu - processing', 'WORK-322999', 'REF-567537', '2025-08-27 16:36:54'::timestamp, '2025-05-27 16:36:54'::timestamp, 'Abuja', '2025-11-06 16:36:54'::timestamp, '2025-11-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: customers
INSERT INTO "customers" ("customerId", "tenantId", "name", "segment", "tier", "location", "relationshipManager", "risk", "status", "bvn", "phone", "balance", "lastTouchpointLabel", "lastTouchpointAt", "createdAt", "updatedAt") VALUES
  ('CUST-481907', 'TENA-545328', 'Babajide Williams', 'basic', 'standard', 'Tunde Akinola - completed', 'Folake Bakare - approved', 'Chukwuemeka Nwosu - pending', 'completed', '63960846281', '+2347905332603', 36643925.3, 'Suleiman Abubakar - completed', '2026-01-25 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp),
  ('CUST-501943', 'TENA-784116', 'Khadija Musa', 'corporate', 'enterprise', 'Hauwa Yusuf - pending', 'Ngozi Eze - approved', 'Segun Oladipo - rejected', 'processing', '13194011561', '+2347224516716', 5121599.76, 'Hauwa Yusuf - active', '2026-03-24 16:36:54'::timestamp, '2026-03-19 16:36:54'::timestamp, '2026-03-03 16:36:54'::timestamp),
  ('CUST-626023', 'TENA-390865', 'Kabiru Aliyu', 'basic', 'standard', 'Folake Bakare - approved', 'Abdullahi Sani - processing', 'Segun Oladipo - approved', 'pending', '16629814935', '+2348699409905', 29018375.76, 'Khadija Musa - active', '2025-06-27 16:36:54'::timestamp, '2025-07-23 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp),
  ('CUST-181337', 'TENA-232874', 'Suleiman Abubakar', 'premium', 'standard', 'Nkechi Nwankwo - pending', 'Yusuf Ibrahim - approved', 'Grace Adeniyi - completed', 'approved', '44346023230', '+2347783867365', 16501882.6, 'Chioma Nnamdi - completed', '2026-03-19 16:36:54'::timestamp, '2025-11-07 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('CUST-981350', 'TENA-403238', 'Suleiman Abubakar', 'corporate', 'premium', 'Hauwa Yusuf - approved', 'Fatima Abdulrahman - pending', 'Abdullahi Sani - processing', 'processing', '16609027903', '+2348424013749', 20469871.73, 'Zainab Mohammed - pending', '2025-06-05 16:36:54'::timestamp, '2026-03-19 16:36:54'::timestamp, '2025-11-11 16:36:54'::timestamp),
  ('CUST-259070', 'TENA-158425', 'Obinna Igwe', 'basic', 'enterprise', 'Blessing Okoro - pending', 'Ifeanyi Obi - active', 'Aisha Bello - completed', 'rejected', '61066443240', '+2348346179974', 4415712.77, 'Chidinma Okafor - approved', '2026-03-08 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('CUST-442195', 'TENA-227701', 'Oluwaseun Adeyemi', 'basic', 'basic', 'Fatima Abdulrahman - active', 'Amina Garba - completed', 'Suleiman Abubakar - pending', 'pending', '98058954035', '+2348587591477', 22838203.83, 'Muhammed Lawal - rejected', '2025-10-15 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('CUST-291725', 'TENA-937929', 'Abdullahi Sani', 'corporate', 'premium', 'Fatima Abdulrahman - processing', 'Suleiman Abubakar - completed', 'Joy Okonkwo - approved', 'rejected', '32236455350', '+2347777325813', 18239371.83, 'Folake Bakare - pending', '2026-01-04 16:36:54'::timestamp, '2026-05-08 16:36:54'::timestamp, '2025-12-16 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ddos_rules
INSERT INTO "ddos_rules" ("name", "layer", "threshold", "action", "mitigated_24h", "false_positives", "status", "created_at") VALUES
  ('Fatima Abdulrahman', 'Yusuf Ibrahim - pending', 'Muhammed Lawal - pending', 'create', 4413, 1840, 'completed', '2025-10-23 16:36:54'::timestamp),
  ('Chidinma Okafor', 'Khadija Musa - processing', 'Nkechi Nwankwo - approved', 'approve', 8704, 1966, 'processing', '2026-05-12 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu', 'Abdullahi Sani - rejected', 'Segun Oladipo - active', 'verify', 6683, 8538, 'processing', '2025-11-04 16:36:54'::timestamp),
  ('Hauwa Yusuf', 'Rasheed Olanrewaju - pending', 'Joy Okonkwo - processing', 'update', 5852, 3312, 'pending', '2025-07-15 16:36:54'::timestamp),
  ('Aisha Bello', 'Chukwuemeka Nwosu - rejected', 'Kabiru Aliyu - processing', 'verify', 2994, 7933, 'pending', '2025-12-01 16:36:54'::timestamp),
  ('Babajide Williams', 'Babajide Williams - completed', 'Adebayo Ogundimu - approved', 'reject', 7181, 5344, 'rejected', '2025-05-25 16:36:54'::timestamp),
  ('Chioma Nnamdi', 'Victoria Etim - pending', 'Tunde Akinola - active', 'transfer', 7655, 6760, 'processing', '2025-12-24 16:36:54'::timestamp),
  ('Adebayo Ogundimu', 'Obinna Igwe - active', 'Rasheed Olanrewaju - completed', 'verify', 5866, 573, 'pending', '2026-01-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: device_profiles
INSERT INTO "device_profiles" ("fingerprint_hash", "user_id", "device_type", "browser", "os", "screen_res", "timezone", "trust_score", "sessions_count", "status", "created_at") VALUES
  ('f75e4495a98eafb2fcfab7a0c4cacbec1214cdca6ccb46cd9cf191bd6ab5ea6e', 'USER-359801', 'enterprise', 'Chukwuemeka Nwosu - processing', 'Chukwuemeka Nwosu - completed', 'Chioma Nnamdi - processing', 'Muhammed Lawal - rejected', 45, 111, 'pending', '2025-06-15 16:36:54'::timestamp),
  ('3fd6b61eb14c7f9cc4b71f28bdbc5b0d9a682fe969c94df0c60cff3ec49feaab', 'USER-468303', 'standard', 'Victoria Etim - processing', 'Rasheed Olanrewaju - pending', 'Yusuf Ibrahim - approved', 'Chukwuemeka Nwosu - rejected', 78, 154, 'approved', '2026-01-18 16:36:54'::timestamp),
  ('c964dac6dd79d28e39fddc8c7efcca7dc4e58c1bfecebf1bc6ca7a6b1b4ff0ba', 'USER-850577', 'standard', 'Victoria Etim - approved', 'Folake Bakare - active', 'Hauwa Yusuf - pending', 'Suleiman Abubakar - processing', 76, 64, 'active', '2025-07-27 16:36:54'::timestamp),
  ('ba2b6b7dfbe1afdb64f1bef7c646d0263d9a174de9759b573fb2c3bcaae3cede', 'USER-738166', 'premium', 'Yusuf Ibrahim - pending', 'Ifeanyi Obi - active', 'Emmanuel Ogbonna - rejected', 'Nkechi Nwankwo - processing', 78, 458, 'completed', '2026-03-22 16:36:54'::timestamp),
  ('1cdc1ef35eb6b92b2e8bbda29f75bcf9f08dcaedf9aca08eead321da1ee27e01', 'USER-675974', 'premium', 'Zainab Mohammed - completed', 'Fatima Abdulrahman - processing', 'Emmanuel Ogbonna - rejected', 'Amina Garba - pending', 83, 168, 'approved', '2026-01-09 16:36:54'::timestamp),
  ('a8f6c9faaba1aae2ffc8a3339bd25a83df65f435cf4c003f3fc36bd63bc866dd', 'USER-741214', 'standard', 'Segun Oladipo - rejected', 'Folake Bakare - rejected', 'Chidinma Okafor - active', 'Chidinma Okafor - pending', 41, 188, 'processing', '2025-05-12 16:36:54'::timestamp),
  ('13d9a1cfbbe2c7e42e60caa0dbc39aa86ca7be17d7dd67cda1ef3bff87cb6adc', 'USER-639334', 'enterprise', 'Ngozi Eze - pending', 'Victoria Etim - completed', 'Suleiman Abubakar - pending', 'Hauwa Yusuf - processing', 36, 85, 'processing', '2026-01-24 16:36:54'::timestamp),
  ('5bb9b9dc99da5b1fb467b1bcf47bf74ea5b1e1d76863fafdba2fa8ff8edae1cb', 'USER-631760', 'premium', 'Segun Oladipo - active', 'Folake Bakare - pending', 'Tunde Akinola - completed', 'Kabiru Aliyu - active', 11, 229, 'pending', '2025-08-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: disputeCases
INSERT INTO "disputeCases" ("disputeId", "tenantId", "customerId", "customerName", "category", "description", "transactionId", "transactionAmount", "disputedAmount", "channel", "priority", "status", "slaDeadline", "assignedTo", "resolution", "resolutionAmount", "createdAt", "updatedAt") VALUES
  ('DISP-440651', 'TENA-472844', 'CUST-518593', 'Oluwaseun Adeyemi', 'standard', 'Processed for Oluwaseun Adeyemi in Enugu - processing', 'TRAN-152369', 20285753.93, 10663395.84, 'Blessing Okoro - pending', 'urgent', 'pending', '2026-02-10 16:36:54'::timestamp, 'Hauwa Yusuf', 'Kabiru Aliyu - completed', 7787637.56, '2025-07-11 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp),
  ('DISP-503726', 'TENA-330260', 'CUST-598228', 'Hauwa Yusuf', 'premium', 'Processed for Chidinma Okafor in Abuja - rejected', 'TRAN-706441', 23938003.5, 19346440.64, 'Hauwa Yusuf - processing', 'urgent', 'pending', '2026-04-25 16:36:54'::timestamp, 'Amina Garba', 'Babajide Williams - rejected', 27669807.34, '2025-09-19 16:36:54'::timestamp, '2026-04-21 16:36:54'::timestamp),
  ('DISP-774030', 'TENA-301131', 'CUST-202477', 'Zainab Mohammed', 'premium', 'Processed for Chukwuemeka Nwosu in Kaduna - approved', 'TRAN-807426', 21146815.56, 20153828.12, 'Nkechi Nwankwo - pending', 'high', 'pending', '2025-08-02 16:36:54'::timestamp, 'Adebayo Ogundimu', 'Fatima Abdulrahman - active', 41223342.84, '2026-02-25 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp),
  ('DISP-325105', 'TENA-464503', 'CUST-762469', 'Suleiman Abubakar', 'micro', 'Processed for Oluwaseun Adeyemi in Anambra - active', 'TRAN-116715', 47695169.14, 29839077.36, 'Khadija Musa - completed', 'urgent', 'approved', '2025-07-07 16:36:54'::timestamp, 'Chidinma Okafor', 'Folake Bakare - completed', 25883997.74, '2026-03-03 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp),
  ('DISP-267070', 'TENA-725008', 'CUST-688953', 'Zainab Mohammed', 'standard', 'Processed for Chidinma Okafor in Abuja - completed', 'TRAN-651864', 6891424.59, 5216475.39, 'Muhammed Lawal - rejected', 'low', 'pending', '2025-11-25 16:36:54'::timestamp, 'Khadija Musa', 'Joy Okonkwo - completed', 3354208.87, '2026-02-08 16:36:54'::timestamp, '2025-05-18 16:36:54'::timestamp),
  ('DISP-680623', 'TENA-890039', 'CUST-411485', 'Chidinma Okafor', 'standard', 'Processed for Muhammed Lawal in Anambra - rejected', 'TRAN-392747', 41182989.52, 35000580.48, 'Suleiman Abubakar - rejected', 'medium', 'approved', '2025-09-23 16:36:54'::timestamp, 'Chidinma Okafor', 'Emmanuel Ogbonna - processing', 34709554.19, '2025-08-11 16:36:54'::timestamp, '2025-05-14 16:36:54'::timestamp),
  ('DISP-355490', 'TENA-619286', 'CUST-797196', 'Grace Adeniyi', 'enterprise', 'Processed for Oluwaseun Adeyemi in Oyo - pending', 'TRAN-315099', 49103334.23, 20654977.3, 'Zainab Mohammed - rejected', 'high', 'pending', '2025-09-06 16:36:54'::timestamp, 'Oluwaseun Adeyemi', 'Victoria Etim - processing', 17209891.37, '2026-01-20 16:36:54'::timestamp, '2025-10-28 16:36:54'::timestamp),
  ('DISP-291289', 'TENA-386896', 'CUST-691438', 'Ifeanyi Obi', 'standard', 'Processed for Joy Okonkwo in Oyo - completed', 'TRAN-659039', 13608879.97, 24991713.39, 'Folake Bakare - rejected', 'medium', 'rejected', '2025-11-27 16:36:54'::timestamp, 'Chioma Nnamdi', 'Hauwa Yusuf - completed', 36797422.82, '2025-08-18 16:36:54'::timestamp, '2026-02-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: distroless_images
INSERT INTO "distroless_images" ("service", "baseImage", "imageSizeMB", "previousSizeMB", "reductionPct", "status", "created_at") VALUES
  ('Nkechi Nwankwo - completed', 'Ifeanyi Obi - active', 8519.63, 9694.56, 'Nkechi Nwankwo - approved', 'active', '2025-06-25 16:36:54'::timestamp),
  ('Obinna Igwe - active', 'Tunde Akinola - approved', 6109.25, 5470.12, 'Halima Usman - completed', 'approved', '2025-05-12 16:36:54'::timestamp),
  ('Khadija Musa - pending', 'Ifeanyi Obi - rejected', 6063.19, 5195.33, 'Emmanuel Ogbonna - approved', 'approved', '2025-10-19 16:36:54'::timestamp),
  ('Ngozi Eze - completed', 'Folake Bakare - completed', 8671.24, 176.19, 'Khadija Musa - completed', 'rejected', '2025-10-07 16:36:54'::timestamp),
  ('Babajide Williams - active', 'Suleiman Abubakar - pending', 7766.22, 8632.28, 'Hauwa Yusuf - processing', 'completed', '2026-04-06 16:36:54'::timestamp),
  ('Chidinma Okafor - approved', 'Chioma Nnamdi - pending', 8070.8, 5632.35, 'Joy Okonkwo - rejected', 'approved', '2025-10-12 16:36:54'::timestamp),
  ('Babajide Williams - approved', 'Obinna Igwe - processing', 678.77, 827.85, 'Zainab Mohammed - completed', 'approved', '2026-04-21 16:36:54'::timestamp),
  ('Kabiru Aliyu - completed', 'Kabiru Aliyu - completed', 2306.8, 4950.12, 'Folake Bakare - approved', 'completed', '2025-07-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: docker_hardening_checks
INSERT INTO "docker_hardening_checks" ("check_name", "category", "cis_benchmark", "passing_containers", "failing_containers", "total_containers", "severity", "status", "created_at") VALUES
  ('Folake Bakare - processing', 'corporate', 'Babajide Williams - rejected', 5998, 27, 2381239, 'warning', 'active', '2026-02-08 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - active', 'premium', 'Halima Usman - rejected', 1337, 5825, 894679, 'warning', 'processing', '2025-10-28 16:36:54'::timestamp),
  ('Tunde Akinola - completed', 'corporate', 'Kabiru Aliyu - rejected', 8505, 2183, 47971774, 'critical', 'approved', '2026-01-19 16:36:54'::timestamp),
  ('Aisha Bello - rejected', 'corporate', 'Victoria Etim - approved', 6375, 3779, 2359790, 'critical', 'active', '2025-08-08 16:36:54'::timestamp),
  ('Chioma Nnamdi - active', 'enterprise', 'Amina Garba - active', 5767, 6364, 13245255, 'info', 'approved', '2025-07-18 16:36:54'::timestamp),
  ('Halima Usman - approved', 'micro', 'Victoria Etim - pending', 3812, 9690, 39542958, 'critical', 'processing', '2026-03-29 16:36:54'::timestamp),
  ('Folake Bakare - pending', 'standard', 'Joy Okonkwo - approved', 2708, 4542, 37960653, 'info', 'completed', '2025-09-09 16:36:54'::timestamp),
  ('Nkechi Nwankwo - pending', 'micro', 'Muhammed Lawal - processing', 6986, 6115, 13157584, 'critical', 'pending', '2025-06-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: educationLoans
INSERT INTO "educationLoans" ("loanId", "tenantId", "studentId", "studentName", "institutionName", "programName", "loanAmount", "interestRate", "tenorMonths", "graceMonths", "emi", "totalDisbursed", "totalRepaid", "outstandingBalance", "cosignerName", "cosignerType", "status", "createdAt", "updatedAt") VALUES
  ('LOAN-731518', 'TENA-706790', 'STUD-875852', 'Joy Okonkwo - active', 'Kano Textiles Ltd', 'Chukwuemeka Nwosu - active', 43639631.32, 15.582, 126, 23, 3953.57, 2139.01, 1065.03, 33393088.3, 'Folake Bakare - rejected', 'standard', 'pending', '2026-03-31 16:36:54'::timestamp, '2025-09-13 16:36:54'::timestamp),
  ('LOAN-763795', 'TENA-292248', 'STUD-716335', 'Suleiman Abubakar - processing', 'Sterling Microfinance Bank', 'Amina Garba - active', 7421259.44, 2.9252, 122, 337, 4610.45, 1922.23, 814.16, 2224994.74, 'Folake Bakare - completed', 'corporate', 'approved', '2025-07-21 16:36:54'::timestamp, '2026-04-07 16:36:54'::timestamp),
  ('LOAN-981985', 'TENA-730742', 'STUD-124535', 'Chioma Nnamdi - rejected', 'GTBank PLC', 'Muhammed Lawal - rejected', 19268181.35, 20.017, 146, 7, 4603.06, 8721.2, 2056.45, 32883910.97, 'Chioma Nnamdi - pending', 'corporate', 'active', '2026-04-08 16:36:54'::timestamp, '2026-02-09 16:36:54'::timestamp),
  ('LOAN-499820', 'TENA-665461', 'STUD-248233', 'Hauwa Yusuf - completed', 'Sterling Microfinance Bank', 'Zainab Mohammed - rejected', 2693155.44, 7.8055, 264, 144, 9519.86, 2171.27, 4722.39, 3762861.69, 'Amina Garba - completed', 'enterprise', 'approved', '2025-11-11 16:36:54'::timestamp, '2025-05-20 16:36:54'::timestamp),
  ('LOAN-979360', 'TENA-272049', 'STUD-732931', 'Suleiman Abubakar - pending', 'Zenith Bank PLC', 'Joy Okonkwo - pending', 1353064.97, 21.1695, 80, 113, 8936.1, 7659.76, 5749.47, 48524013.37, 'Suleiman Abubakar - active', 'standard', 'completed', '2025-06-18 16:36:54'::timestamp, '2026-01-26 16:36:54'::timestamp),
  ('LOAN-821271', 'TENA-754835', 'STUD-349267', 'Hauwa Yusuf - pending', 'Lafarge Africa', 'Adebayo Ogundimu - approved', 47033430.04, 15.2027, 262, 56, 3049.9, 4097.01, 6078.2, 4307792.68, 'Grace Adeniyi - completed', 'standard', 'processing', '2025-10-01 16:36:54'::timestamp, '2025-06-25 16:36:54'::timestamp),
  ('LOAN-476176', 'TENA-779599', 'STUD-995401', 'Victoria Etim - rejected', 'Stanbic IBTC', 'Abdullahi Sani - processing', 17170120.25, 13.3067, 115, 171, 3597.99, 4869.38, 3912.01, 32645978.9, 'Hauwa Yusuf - completed', 'enterprise', 'approved', '2026-01-02 16:36:54'::timestamp, '2025-08-30 16:36:54'::timestamp),
  ('LOAN-473709', 'TENA-622597', 'STUD-944902', 'Adebayo Ogundimu - active', 'Oando PLC', 'Folake Bakare - pending', 20014334.98, 3.4791, 235, 71, 293.22, 8141.89, 8424.94, 28736820.03, 'Halima Usman - approved', 'enterprise', 'approved', '2025-09-18 16:36:54'::timestamp, '2025-05-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: efass_returns
INSERT INTO "efass_returns" ("period", "type", "tier1_count", "tier2_count", "tier3_count", "total_customers", "status", "submitted_at", "created_at") VALUES
  ('2026-Q1', 'micro', 39, 353, 218, 27973316, 'approved', '2025-07-15 16:36:54'::timestamp, '2025-10-05 16:36:54'::timestamp),
  ('2026-Q1', 'corporate', 203, 51, 339, 28986882, 'active', '2025-10-09 16:36:54'::timestamp, '2026-04-19 16:36:54'::timestamp),
  ('2026-Q4', 'corporate', 178, 396, 71, 14951117, 'approved', '2025-11-05 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp),
  ('2026-Q4', 'enterprise', 74, 338, 103, 16702723, 'processing', '2026-04-04 16:36:54'::timestamp, '2025-07-07 16:36:54'::timestamp),
  ('2026-Q2', 'basic', 160, 39, 408, 9559798, 'rejected', '2025-10-06 16:36:54'::timestamp, '2026-04-23 16:36:54'::timestamp),
  ('2026-Q1', 'premium', 316, 252, 20, 36631622, 'processing', '2026-04-28 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp),
  ('2026-Q1', 'micro', 466, 289, 89, 24852505, 'pending', '2026-04-17 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp),
  ('2026-Q3', 'corporate', 202, 327, 494, 29949352, 'approved', '2025-07-16 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: egress_policies
INSERT INTO "egress_policies" ("name", "domains", "ports", "protocol", "allowed", "requests_24h", "blocked_24h", "status", "created_at") VALUES
  ('Emmanuel Ogbonna', '{}'::jsonb, '{}'::jsonb, 'Suleiman Abubakar - completed', false, 7017, 698, 'approved', '2026-04-04 16:36:54'::timestamp),
  ('Zainab Mohammed', '{}'::jsonb, '{}'::jsonb, 'Segun Oladipo - pending', false, 9643, 4107, 'rejected', '2026-03-19 16:36:54'::timestamp),
  ('Musa Danjuma', '{}'::jsonb, '{}'::jsonb, 'Fatima Abdulrahman - active', false, 2214, 4520, 'approved', '2026-02-07 16:36:54'::timestamp),
  ('Tunde Akinola', '{}'::jsonb, '{}'::jsonb, 'Abdullahi Sani - active', true, 6837, 3231, 'active', '2026-04-22 16:36:54'::timestamp),
  ('Tunde Akinola', '{}'::jsonb, '{}'::jsonb, 'Suleiman Abubakar - rejected', true, 2152, 3711, 'processing', '2026-05-07 16:36:54'::timestamp),
  ('Tunde Akinola', '{}'::jsonb, '{}'::jsonb, 'Yusuf Ibrahim - processing', true, 4163, 4392, 'rejected', '2025-10-13 16:36:54'::timestamp),
  ('Muhammed Lawal', '{}'::jsonb, '{}'::jsonb, 'Zainab Mohammed - completed', true, 6890, 6259, 'processing', '2026-03-25 16:36:54'::timestamp),
  ('Hauwa Yusuf', '{}'::jsonb, '{}'::jsonb, 'Oluwaseun Adeyemi - pending', false, 1183, 7515, 'active', '2025-09-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: equipment_leasing
INSERT INTO "equipment_leasing" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-413438', 'RECO-285277', 'Muhammed Lawal', 'enterprise', 'Processed for Obinna Igwe in Rivers - pending', 'rejected', 44875757.71, 'Enugu', 'REF-238164', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-06 16:36:54'::timestamp, '2025-07-11 16:36:54'::timestamp),
  ('TENA-347506', 'RECO-591902', 'Ifeanyi Obi', 'standard', 'Processed for Zainab Mohammed in Abuja - active', 'processing', 33683061.1, 'Rivers', 'REF-931593', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-02 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp),
  ('TENA-596912', 'RECO-381502', 'Tunde Akinola', 'micro', 'Processed for Babajide Williams in Kano - approved', 'processing', 41442950.77, 'Rivers', 'REF-915053', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-02 16:36:54'::timestamp, '2025-10-20 16:36:54'::timestamp),
  ('TENA-586453', 'RECO-884072', 'Grace Adeniyi', 'basic', 'Processed for Adebayo Ogundimu in Abuja - active', 'processing', 32403350.04, 'Kano', 'REF-618930', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-25 16:36:54'::timestamp, '2026-03-13 16:36:54'::timestamp),
  ('TENA-281296', 'RECO-872180', 'Folake Bakare', 'micro', 'Processed for Rasheed Olanrewaju in Abuja - completed', 'rejected', 28793605.82, 'Anambra', 'REF-509549', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-23 16:36:54'::timestamp, '2025-12-27 16:36:54'::timestamp),
  ('TENA-520769', 'RECO-283366', 'Emmanuel Ogbonna', 'premium', 'Processed for Kabiru Aliyu in Ogun - pending', 'rejected', 12037253.19, 'Rivers', 'REF-516994', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-08 16:36:54'::timestamp, '2025-12-21 16:36:54'::timestamp),
  ('TENA-305586', 'RECO-508068', 'Khadija Musa', 'standard', 'Processed for Joy Okonkwo in Enugu - pending', 'pending', 18328154.05, 'Anambra', 'REF-533171', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-29 16:36:54'::timestamp, '2025-07-03 16:36:54'::timestamp),
  ('TENA-313573', 'RECO-174951', 'Ifeanyi Obi', 'micro', 'Processed for Blessing Okoro in Rivers - approved', 'pending', 19768605.24, 'Anambra', 'REF-215878', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-12 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: erpnextSyncJobs
INSERT INTO "erpnextSyncJobs" ("jobId", "tenantId", "syncType", "direction", "status", "recordsProcessed", "recordsFailed", "recordsSkipped", "retryCount", "startedAt", "completedAt", "errorMessage", "createdAt", "updatedAt") VALUES
  ('JOB-660078', 'TENA-808661', 'premium', 'Muhammed Lawal - rejected', 'processing', 3920, 8185, 3331, 28, '2026-04-28 16:36:54'::timestamp, '2025-07-13 16:36:54'::timestamp, 'Processed for Khadija Musa in Rivers - pending', '2025-07-19 16:36:54'::timestamp, '2026-01-06 16:36:54'::timestamp),
  ('JOB-687213', 'TENA-103809', 'premium', 'Musa Danjuma - processing', 'pending', 7694, 7238, 2669, 343, '2025-05-19 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp, 'Processed for Chukwuemeka Nwosu in Oyo - pending', '2025-08-31 16:36:54'::timestamp, '2026-05-06 16:36:54'::timestamp),
  ('JOB-732282', 'TENA-246514', 'corporate', 'Muhammed Lawal - active', 'approved', 7668, 2217, 5935, 444, '2026-04-05 16:36:54'::timestamp, '2025-12-01 16:36:54'::timestamp, 'Processed for Musa Danjuma in Rivers - processing', '2026-05-12 16:36:54'::timestamp, '2026-02-21 16:36:54'::timestamp),
  ('JOB-823616', 'TENA-885652', 'basic', 'Tunde Akinola - approved', 'pending', 9561, 9027, 7001, 115, '2025-07-09 16:36:54'::timestamp, '2026-02-25 16:36:54'::timestamp, 'Processed for Yusuf Ibrahim in Abuja - completed', '2026-01-12 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('JOB-431342', 'TENA-607653', 'micro', 'Zainab Mohammed - pending', 'approved', 1233, 1450, 157, 395, '2026-04-23 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp, 'Processed for Segun Oladipo in Abuja - pending', '2025-06-21 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp),
  ('JOB-100601', 'TENA-409063', 'micro', 'Ifeanyi Obi - approved', 'rejected', 2052, 200, 2741, 274, '2026-04-13 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp, 'Processed for Abdullahi Sani in Enugu - rejected', '2025-10-25 16:36:54'::timestamp, '2026-02-19 16:36:54'::timestamp),
  ('JOB-193572', 'TENA-253322', 'micro', 'Joy Okonkwo - rejected', 'rejected', 4673, 5617, 4887, 122, '2025-08-07 16:36:54'::timestamp, '2026-02-25 16:36:54'::timestamp, 'Processed for Khadija Musa in Rivers - completed', '2025-08-01 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp),
  ('JOB-224406', 'TENA-427762', 'corporate', 'Rasheed Olanrewaju - processing', 'approved', 7667, 9712, 8629, 215, '2026-03-14 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp, 'Processed for Joy Okonkwo in Kano - active', '2026-01-27 16:36:54'::timestamp, '2025-08-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_accounts
INSERT INTO "escrow_accounts" ("escrowId", "tenantId", "escrowType", "status", "amount", "currency", "condition", "expiresAt", "interestRate", "accruedInterest", "setupFee", "holdingFeeAnnual", "totalFeesCharged", "tigerBeetleTxId", "kafkaEventId", "temporalWorkflowId", "approvedBy", "releasedAt", "cancelledAt", "disputeReason", "notes", "metadata", "createdAt", "updatedAt") VALUES
  ('ESCR-199028', 'TENA-465802', 'enterprise', 'approved', 26874700.31, 'GBP', 'Hauwa Yusuf - processing', '2026-05-11 16:36:54'::timestamp, 10.6165, 4639.64, 8726.95, 8869.57, 7588.02, 'TIGE-426641', 'KAFK-985371', 'TEMP-561256', 'Muhammed Lawal - completed', '2025-10-13 16:36:54'::timestamp, '2025-10-09 16:36:54'::timestamp, 'Processed for Folake Bakare in Ogun - rejected', 'Processed for Ifeanyi Obi in Enugu - completed', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-19 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp),
  ('ESCR-540512', 'TENA-869550', 'premium', 'active', 6907285.94, 'GBP', 'Khadija Musa - active', '2026-05-02 16:36:54'::timestamp, 1.8713, 9950.43, 1686.69, 6365.25, 3413.1, 'TIGE-575226', 'KAFK-610107', 'TEMP-159998', 'Grace Adeniyi - completed', '2025-06-13 16:36:54'::timestamp, '2025-09-19 16:36:54'::timestamp, 'Processed for Chukwuemeka Nwosu in Abuja - processing', 'Processed for Muhammed Lawal in Kano - processing', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-23 16:36:54'::timestamp, '2026-04-29 16:36:54'::timestamp),
  ('ESCR-313333', 'TENA-154822', 'basic', 'approved', 20432732.38, 'NGN', 'Obinna Igwe - rejected', '2026-03-15 16:36:54'::timestamp, 4.9694, 553.65, 9619.99, 1743.4, 7556.3, 'TIGE-871952', 'KAFK-636218', 'TEMP-323618', 'Joy Okonkwo - rejected', '2025-09-05 16:36:54'::timestamp, '2025-06-09 16:36:54'::timestamp, 'Processed for Adebayo Ogundimu in Abuja - rejected', 'Processed for Adebayo Ogundimu in Kano - processing', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-29 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('ESCR-905357', 'TENA-557179', 'enterprise', 'active', 39695529.97, 'EUR', 'Hauwa Yusuf - processing', '2025-11-08 16:36:54'::timestamp, 10.9172, 2663.32, 417.48, 8066.37, 4345.97, 'TIGE-590559', 'KAFK-398233', 'TEMP-553515', 'Chukwuemeka Nwosu - active', '2026-03-01 16:36:54'::timestamp, '2025-05-13 16:36:54'::timestamp, 'Processed for Ifeanyi Obi in Ogun - pending', 'Processed for Ifeanyi Obi in Kano - approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-15 16:36:54'::timestamp, '2025-05-16 16:36:54'::timestamp),
  ('ESCR-280446', 'TENA-513098', 'standard', 'active', 13354196.8, 'USD', 'Chukwuemeka Nwosu - rejected', '2026-02-01 16:36:54'::timestamp, 3.972, 4865.55, 7561.01, 3513.14, 1895.17, 'TIGE-632441', 'KAFK-382261', 'TEMP-735022', 'Segun Oladipo - rejected', '2025-05-14 16:36:54'::timestamp, '2025-10-14 16:36:54'::timestamp, 'Processed for Muhammed Lawal in Kaduna - pending', 'Processed for Ifeanyi Obi in Ogun - rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-29 16:36:54'::timestamp, '2025-10-15 16:36:54'::timestamp),
  ('ESCR-635850', 'TENA-578744', 'enterprise', 'approved', 18384874.01, 'NGN', 'Nkechi Nwankwo - approved', '2025-07-22 16:36:54'::timestamp, 3.4045, 3761.32, 7017.79, 5650.27, 8408.82, 'TIGE-489966', 'KAFK-752972', 'TEMP-671059', 'Fatima Abdulrahman - active', '2025-05-16 16:36:54'::timestamp, '2025-08-09 16:36:54'::timestamp, 'Processed for Chukwuemeka Nwosu in Rivers - active', 'Processed for Segun Oladipo in Enugu - pending', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-04 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp),
  ('ESCR-590135', 'TENA-676814', 'premium', 'processing', 33440537.3, 'NGN', 'Abdullahi Sani - rejected', '2025-09-05 16:36:54'::timestamp, 16.0295, 3015.86, 6162.44, 4149.68, 9988.76, 'TIGE-804046', 'KAFK-105511', 'TEMP-987591', 'Chidinma Okafor - rejected', '2026-03-08 16:36:54'::timestamp, '2026-01-11 16:36:54'::timestamp, 'Processed for Nkechi Nwankwo in Kano - active', 'Processed for Nkechi Nwankwo in Delta - pending', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-06 16:36:54'::timestamp, '2026-02-16 16:36:54'::timestamp),
  ('ESCR-823645', 'TENA-912032', 'micro', 'approved', 19672586.48, 'GBP', 'Chioma Nnamdi - approved', '2025-07-08 16:36:54'::timestamp, 13.3078, 6533.0, 8374.16, 7889.63, 4941.91, 'TIGE-570010', 'KAFK-579886', 'TEMP-624355', 'Chidinma Okafor - rejected', '2025-11-16 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp, 'Processed for Abdullahi Sani in Ogun - pending', 'Processed for Folake Bakare in Delta - rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-16 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_audit_log
INSERT INTO "escrow_audit_log" ("auditId", "escrowId", "action", "actor", "details", "ipAddress", "kafkaTopic", "kafkaOffset", "createdAt") VALUES
  ('AUDI-929579', 'ESCR-140822', 'approve', 'Chidinma Okafor - approved', 'Processed for Emmanuel Ogbonna in Rivers - approved', '222.143.193.79', 'Muhammed Lawal - completed', 'Yusuf Ibrahim - processing', '2025-06-30 16:36:54'::timestamp),
  ('AUDI-179546', 'ESCR-712596', 'approve', 'Chioma Nnamdi - approved', 'Processed for Suleiman Abubakar in Kaduna - approved', '224.156.63.116', 'Segun Oladipo - approved', 'Hauwa Yusuf - pending', '2025-12-23 16:36:54'::timestamp),
  ('AUDI-408328', 'ESCR-767059', 'reject', 'Rasheed Olanrewaju - active', 'Processed for Ifeanyi Obi in Kaduna - rejected', '49.250.162.144', 'Victoria Etim - completed', 'Tunde Akinola - rejected', '2026-03-06 16:36:54'::timestamp),
  ('AUDI-428778', 'ESCR-672595', 'transfer', 'Grace Adeniyi - processing', 'Processed for Fatima Abdulrahman in Kaduna - pending', '199.36.11.123', 'Chidinma Okafor - pending', 'Grace Adeniyi - rejected', '2025-10-05 16:36:54'::timestamp),
  ('AUDI-867001', 'ESCR-211170', 'reject', 'Kabiru Aliyu - rejected', 'Processed for Tunde Akinola in Lagos - approved', '178.240.15.139', 'Adebayo Ogundimu - pending', 'Yusuf Ibrahim - processing', '2025-10-09 16:36:54'::timestamp),
  ('AUDI-930939', 'ESCR-469431', 'create', 'Chukwuemeka Nwosu - processing', 'Processed for Oluwaseun Adeyemi in Kano - processing', '126.146.130.244', 'Suleiman Abubakar - active', 'Hauwa Yusuf - rejected', '2026-03-23 16:36:54'::timestamp),
  ('AUDI-268321', 'ESCR-998334', 'reject', 'Halima Usman - approved', 'Processed for Suleiman Abubakar in Delta - pending', '105.109.77.232', 'Yusuf Ibrahim - processing', 'Obinna Igwe - approved', '2026-03-14 16:36:54'::timestamp),
  ('AUDI-651337', 'ESCR-731416', 'reject', 'Victoria Etim - pending', 'Processed for Halima Usman in Kaduna - pending', '3.67.23.178', 'Rasheed Olanrewaju - processing', 'Victoria Etim - processing', '2026-03-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_disputes
INSERT INTO "escrow_disputes" ("disputeId", "escrowId", "raisedBy", "raisedByPartyId", "reason", "category", "status", "resolution", "arbitratorName", "arbitratorDecision", "resolvedAt", "createdAt") VALUES
  ('DISP-832770', 'ESCR-907296', 'Abdullahi Sani - processing', 9893, 'Processed for Victoria Etim in Ogun - processing', 'basic', 'approved', 'Segun Oladipo - approved', 'Grace Adeniyi - pending', 'Hauwa Yusuf - processing', '2025-08-26 16:36:54'::timestamp, '2025-08-01 16:36:54'::timestamp),
  ('DISP-423189', 'ESCR-421518', 'Nkechi Nwankwo - completed', 4901, 'Processed for Musa Danjuma in Anambra - active', 'corporate', 'rejected', 'Oluwaseun Adeyemi - pending', 'Obinna Igwe - approved', 'Kabiru Aliyu - pending', '2026-01-25 16:36:54'::timestamp, '2026-04-23 16:36:54'::timestamp),
  ('DISP-545097', 'ESCR-396482', 'Oluwaseun Adeyemi - completed', 752, 'Processed for Aisha Bello in Anambra - completed', 'standard', 'processing', 'Chioma Nnamdi - completed', 'Chukwuemeka Nwosu - completed', 'Babajide Williams - completed', '2026-04-01 16:36:54'::timestamp, '2026-01-17 16:36:54'::timestamp),
  ('DISP-629626', 'ESCR-746340', 'Yusuf Ibrahim - completed', 1559, 'Processed for Ngozi Eze in Kano - approved', 'corporate', 'completed', 'Obinna Igwe - processing', 'Tunde Akinola - processing', 'Khadija Musa - active', '2025-10-30 16:36:54'::timestamp, '2025-12-29 16:36:54'::timestamp),
  ('DISP-617884', 'ESCR-997315', 'Chioma Nnamdi - completed', 8239, 'Processed for Adebayo Ogundimu in Abuja - rejected', 'enterprise', 'approved', 'Joy Okonkwo - active', 'Chukwuemeka Nwosu - active', 'Ngozi Eze - completed', '2025-06-05 16:36:54'::timestamp, '2025-12-18 16:36:54'::timestamp),
  ('DISP-777046', 'ESCR-418617', 'Musa Danjuma - pending', 6339, 'Processed for Ifeanyi Obi in Oyo - completed', 'basic', 'pending', 'Segun Oladipo - processing', 'Hauwa Yusuf - rejected', 'Abdullahi Sani - approved', '2026-04-27 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('DISP-251957', 'ESCR-686032', 'Nkechi Nwankwo - completed', 8893, 'Processed for Folake Bakare in Oyo - rejected', 'corporate', 'processing', 'Hauwa Yusuf - pending', 'Aisha Bello - rejected', 'Rasheed Olanrewaju - active', '2025-09-28 16:36:54'::timestamp, '2025-12-24 16:36:54'::timestamp),
  ('DISP-904990', 'ESCR-731755', 'Musa Danjuma - completed', 8118, 'Processed for Amina Garba in Lagos - rejected', 'basic', 'rejected', 'Oluwaseun Adeyemi - pending', 'Blessing Okoro - active', 'Yusuf Ibrahim - completed', '2025-08-03 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_documents
INSERT INTO "escrow_documents" ("documentId", "escrowId", "documentType", "fileName", "fileSize", "mimeType", "storageUrl", "uploadedBy", "verifiedBy", "verifiedAt", "status", "metadata", "createdAt") VALUES
  ('DOCU-596168', 'ESCR-592012', 'micro', 'Musa Danjuma - processing', 497, 'corporate', 'https://api.54bank.ng/escrow_documents/816364', 'Yusuf Ibrahim - rejected', 'Kabiru Aliyu - completed', '2025-11-30 16:36:54'::timestamp, 'active', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-24 16:36:54'::timestamp),
  ('DOCU-883663', 'ESCR-639555', 'basic', 'Aisha Bello - active', 367, 'corporate', 'https://api.54bank.ng/escrow_documents/202706', 'Kabiru Aliyu - completed', 'Joy Okonkwo - rejected', '2026-01-24 16:36:54'::timestamp, 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-22 16:36:54'::timestamp),
  ('DOCU-135751', 'ESCR-524877', 'corporate', 'Halima Usman - pending', 274, 'corporate', 'https://api.54bank.ng/escrow_documents/155849', 'Kabiru Aliyu - approved', 'Amina Garba - processing', '2026-01-11 16:36:54'::timestamp, 'completed', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-14 16:36:54'::timestamp),
  ('DOCU-967950', 'ESCR-561003', 'enterprise', 'Yusuf Ibrahim - active', 31, 'standard', 'https://api.54bank.ng/escrow_documents/776725', 'Fatima Abdulrahman - completed', 'Chidinma Okafor - completed', '2025-09-23 16:36:54'::timestamp, 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-14 16:36:54'::timestamp),
  ('DOCU-815484', 'ESCR-746588', 'premium', 'Chukwuemeka Nwosu - approved', 424, 'basic', 'https://api.54bank.ng/escrow_documents/350078', 'Adebayo Ogundimu - approved', 'Halima Usman - pending', '2026-01-09 16:36:54'::timestamp, 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-07 16:36:54'::timestamp),
  ('DOCU-534172', 'ESCR-501527', 'basic', 'Kabiru Aliyu - active', 19, 'premium', 'https://api.54bank.ng/escrow_documents/552633', 'Grace Adeniyi - pending', 'Amina Garba - approved', '2026-01-17 16:36:54'::timestamp, 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-06 16:36:54'::timestamp),
  ('DOCU-295237', 'ESCR-909678', 'enterprise', 'Babajide Williams - active', 193, 'enterprise', 'https://api.54bank.ng/escrow_documents/439320', 'Obinna Igwe - pending', 'Rasheed Olanrewaju - processing', '2025-06-23 16:36:54'::timestamp, 'active', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-18 16:36:54'::timestamp),
  ('DOCU-804238', 'ESCR-385683', 'corporate', 'Yusuf Ibrahim - rejected', 326, 'standard', 'https://api.54bank.ng/escrow_documents/362038', 'Yusuf Ibrahim - processing', 'Muhammed Lawal - completed', '2025-06-20 16:36:54'::timestamp, 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_fees
INSERT INTO "escrow_fees" ("feeId", "escrowId", "feeType", "amount", "currency", "chargedAt", "status", "ledgerRef", "narration") VALUES
  ('FEE-299208', 'ESCR-856852', 'premium', 45239621.4, 'USD', '2025-12-06 16:36:54'::timestamp, 'pending', 'REF-571472', 'Halima Usman - rejected'),
  ('FEE-127143', 'ESCR-942229', 'basic', 18848438.04, 'NGN', '2026-04-18 16:36:54'::timestamp, 'completed', 'REF-420168', 'Obinna Igwe - processing'),
  ('FEE-769946', 'ESCR-164156', 'corporate', 30000582.12, 'NGN', '2026-02-12 16:36:54'::timestamp, 'approved', 'REF-827843', 'Chukwuemeka Nwosu - pending'),
  ('FEE-623517', 'ESCR-675410', 'enterprise', 10374389.65, 'GBP', '2025-12-24 16:36:54'::timestamp, 'processing', 'REF-597626', 'Nkechi Nwankwo - completed'),
  ('FEE-219176', 'ESCR-178211', 'premium', 32149231.4, 'NGN', '2026-05-02 16:36:54'::timestamp, 'pending', 'REF-533011', 'Zainab Mohammed - active'),
  ('FEE-738608', 'ESCR-952473', 'standard', 33784530.67, 'NGN', '2026-04-03 16:36:54'::timestamp, 'processing', 'REF-928981', 'Muhammed Lawal - completed'),
  ('FEE-957540', 'ESCR-475128', 'enterprise', 17649661.22, 'GBP', '2026-01-14 16:36:54'::timestamp, 'rejected', 'REF-696332', 'Suleiman Abubakar - completed'),
  ('FEE-756151', 'ESCR-959137', 'premium', 23358926.7, 'GBP', '2026-05-07 16:36:54'::timestamp, 'active', 'REF-937659', 'Nkechi Nwankwo - approved')
ON CONFLICT DO NOTHING;

-- Table: escrow_interest_accruals
INSERT INTO "escrow_interest_accruals" ("accrualId", "escrowId", "principalAmount", "rate", "accrualPeriodStart", "accrualPeriodEnd", "daysInPeriod", "interestAmount", "cumulativeInterest", "status", "ledgerRef", "createdAt") VALUES
  ('ACCR-292219', 'ESCR-463539', 44885410.62, 1.3852, '2025-07-10 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp, 314, 654545.88, 12.862421, 'completed', 'REF-417721', '2025-09-18 16:36:54'::timestamp),
  ('ACCR-611472', 'ESCR-977777', 41438735.51, 4.2816, '2025-11-18 16:36:54'::timestamp, '2025-11-12 16:36:54'::timestamp, 75, 16455678.41, 11.398585, 'rejected', 'REF-326277', '2025-08-28 16:36:54'::timestamp),
  ('ACCR-173480', 'ESCR-470657', 22201968.28, 2.1927, '2025-12-14 16:36:54'::timestamp, '2025-07-18 16:36:54'::timestamp, 45, 47389061.26, 12.086248, 'active', 'REF-180378', '2026-02-15 16:36:54'::timestamp),
  ('ACCR-832157', 'ESCR-591502', 13679001.29, 0.6746, '2025-08-05 16:36:54'::timestamp, '2025-07-05 16:36:54'::timestamp, 83, 15322811.33, 7.250268, 'active', 'REF-634373', '2025-07-06 16:36:54'::timestamp),
  ('ACCR-446299', 'ESCR-897493', 3037736.62, 17.6223, '2025-05-24 16:36:54'::timestamp, '2025-10-04 16:36:54'::timestamp, 27, 5013792.1, 12.058987, 'processing', 'REF-373434', '2026-05-03 16:36:54'::timestamp),
  ('ACCR-554499', 'ESCR-140037', 30825080.79, 15.1421, '2025-11-12 16:36:54'::timestamp, '2025-11-18 16:36:54'::timestamp, 9, 1322262.03, 10.216354, 'rejected', 'REF-783942', '2025-09-03 16:36:54'::timestamp),
  ('ACCR-536220', 'ESCR-908072', 44285873.23, 7.1055, '2025-09-20 16:36:54'::timestamp, '2025-08-20 16:36:54'::timestamp, 149, 3478200.18, 11.435076, 'completed', 'REF-575095', '2025-12-23 16:36:54'::timestamp),
  ('ACCR-525534', 'ESCR-110843', 8535542.61, 18.1035, '2025-07-12 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp, 77, 15826369.75, 9.183173, 'completed', 'REF-499253', '2026-01-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_milestones
INSERT INTO "escrow_milestones" ("milestoneId", "escrowId", "description", "releaseAmount", "releasePercent", "dueDate", "status", "verifiedBy", "verifiedAt", "evidenceDocId", "sequenceOrder", "createdAt") VALUES
  ('MILE-403382', 'ESCR-346631', 'Processed for Nkechi Nwankwo in Enugu - active', 11566407.03, 3435.69, '2025-12-29 16:36:54'::timestamp, 'rejected', 'Aisha Bello - completed', '2026-01-08 16:36:54'::timestamp, 'EVEN-178500', 1385, '2026-01-27 16:36:54'::timestamp),
  ('MILE-125380', 'ESCR-819913', 'Processed for Abdullahi Sani in Enugu - approved', 26045230.23, 6641.36, '2025-08-12 16:36:54'::timestamp, 'completed', 'Halima Usman - approved', '2025-11-29 16:36:54'::timestamp, 'EVEN-310901', 5915, '2025-09-11 16:36:54'::timestamp),
  ('MILE-162089', 'ESCR-944693', 'Processed for Suleiman Abubakar in Enugu - approved', 28609170.54, 741.78, '2025-09-19 16:36:54'::timestamp, 'approved', 'Joy Okonkwo - completed', '2025-06-30 16:36:54'::timestamp, 'EVEN-268507', 7596, '2026-01-05 16:36:54'::timestamp),
  ('MILE-113360', 'ESCR-462710', 'Processed for Nkechi Nwankwo in Abuja - rejected', 16268387.36, 8137.32, '2025-05-19 16:36:54'::timestamp, 'active', 'Folake Bakare - active', '2025-08-09 16:36:54'::timestamp, 'EVEN-418792', 2953, '2025-09-02 16:36:54'::timestamp),
  ('MILE-709869', 'ESCR-173208', 'Processed for Victoria Etim in Abuja - approved', 35032221.52, 1428.31, '2025-05-23 16:36:54'::timestamp, 'active', 'Musa Danjuma - processing', '2025-09-28 16:36:54'::timestamp, 'EVEN-586574', 6329, '2025-08-20 16:36:54'::timestamp),
  ('MILE-975787', 'ESCR-857366', 'Processed for Emmanuel Ogbonna in Kano - approved', 11500138.76, 7075.03, '2026-01-15 16:36:54'::timestamp, 'completed', 'Amina Garba - active', '2026-01-18 16:36:54'::timestamp, 'EVEN-399817', 6575, '2025-10-04 16:36:54'::timestamp),
  ('MILE-129930', 'ESCR-693250', 'Processed for Halima Usman in Anambra - approved', 3006094.42, 8548.58, '2025-11-22 16:36:54'::timestamp, 'approved', 'Muhammed Lawal - active', '2026-03-09 16:36:54'::timestamp, 'EVEN-534946', 6699, '2026-05-04 16:36:54'::timestamp),
  ('MILE-839151', 'ESCR-239515', 'Processed for Musa Danjuma in Kano - pending', 43137189.46, 6954.71, '2025-09-29 16:36:54'::timestamp, 'active', 'Abdullahi Sani - active', '2025-10-03 16:36:54'::timestamp, 'EVEN-981608', 9429, '2025-12-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_parties
INSERT INTO "escrow_parties" ("escrowId", "role", "name", "accountId", "email", "phone", "kycStatus", "kybStatus", "sharePercent", "signedAt", "metadata", "createdAt") VALUES
  ('ESCR-623108', 'treasury', 'Oluwaseun Adeyemi', 'ACCO-477326', 'chioma.nnamdi@54bank.ng', '+2348399091699', 'rejected', 'active', 9209.91, '2026-05-11 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-28 16:36:54'::timestamp),
  ('ESCR-296599', 'compliance', 'Kabiru Aliyu', 'ACCO-542169', 'zainab.mohammed@54bank.ng', '+2348344406066', 'active', 'completed', 4706.48, '2025-09-12 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-08 16:36:54'::timestamp),
  ('ESCR-621413', 'treasury', 'Amina Garba', 'ACCO-774259', 'ngozi.eze@54bank.ng', '+2347803593740', 'completed', 'pending', 5429.39, '2025-08-03 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-02 16:36:54'::timestamp),
  ('ESCR-506345', 'treasury', 'Musa Danjuma', 'ACCO-815576', 'oluwaseun.adeyemi@54bank.ng', '+2348989354309', 'processing', 'approved', 2143.09, '2026-03-10 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-13 16:36:54'::timestamp),
  ('ESCR-454745', 'treasury', 'Yusuf Ibrahim', 'ACCO-532736', 'segun.oladipo@54bank.ng', '+2348866731703', 'processing', 'completed', 5113.57, '2026-02-05 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-05 16:36:54'::timestamp),
  ('ESCR-492544', 'treasury', 'Segun Oladipo', 'ACCO-644427', 'ngozi.eze@54bank.ng', '+2347932094085', 'approved', 'rejected', 8999.12, '2025-06-30 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-12 16:36:54'::timestamp),
  ('ESCR-850396', 'treasury', 'Muhammed Lawal', 'ACCO-656650', 'emmanuel.ogbonna@54bank.ng', '+2348160913110', 'pending', 'approved', 4396.31, '2026-01-01 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-02 16:36:54'::timestamp),
  ('ESCR-375108', 'branch', 'Nkechi Nwankwo', 'ACCO-473801', 'oluwaseun.adeyemi@54bank.ng', '+2347585679185', 'approved', 'completed', 9790.4, '2025-09-25 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_regulatory_reports
INSERT INTO "escrow_regulatory_reports" ("reportId", "reportType", "reportingPeriodStart", "reportingPeriodEnd", "totalEscrowAccounts", "totalHeldValue", "totalReleasedValue", "totalDisputedValue", "totalInterestAccrued", "filedAt", "filingReference", "status", "reportData", "createdAt") VALUES
  ('REPO-217954', 'standard', '2025-11-28 16:36:54'::timestamp, '2026-02-16 16:36:54'::timestamp, 25047039, 20571479.99, 30573677.88, 2427262.93, 1347.77, '2025-11-20 16:36:54'::timestamp, 'REF-739752', 'active', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-15 16:36:54'::timestamp),
  ('REPO-187325', 'premium', '2026-02-21 16:36:54'::timestamp, '2025-10-05 16:36:54'::timestamp, 47008726, 22943622.44, 25287509.56, 4743232.04, 7658.98, '2026-04-26 16:36:54'::timestamp, 'REF-551487', 'completed', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-12 16:36:54'::timestamp),
  ('REPO-973899', 'standard', '2025-08-24 16:36:54'::timestamp, '2025-11-11 16:36:54'::timestamp, 8089051, 14135161.68, 32656417.9, 43114543.76, 7419.67, '2025-12-07 16:36:54'::timestamp, 'REF-874718', 'approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-19 16:36:54'::timestamp),
  ('REPO-695161', 'premium', '2025-10-01 16:36:54'::timestamp, '2026-02-08 16:36:54'::timestamp, 32422135, 39177310.23, 7481121.36, 35608765.21, 2169.69, '2026-05-03 16:36:54'::timestamp, 'REF-458039', 'rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-18 16:36:54'::timestamp),
  ('REPO-249162', 'basic', '2025-08-08 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp, 31621712, 40990148.95, 35094577.37, 29750556.83, 4154.32, '2025-08-01 16:36:54'::timestamp, 'REF-840419', 'pending', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-06 16:36:54'::timestamp),
  ('REPO-637287', 'standard', '2025-10-19 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp, 23357457, 45586040.17, 11069277.07, 22600507.38, 3192.03, '2025-11-01 16:36:54'::timestamp, 'REF-859286', 'completed', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-27 16:36:54'::timestamp),
  ('REPO-675699', 'basic', '2025-10-27 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp, 42770955, 38490552.39, 3297215.44, 35468626.12, 9195.98, '2025-08-28 16:36:54'::timestamp, 'REF-672507', 'processing', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-24 16:36:54'::timestamp),
  ('REPO-691977', 'basic', '2025-06-12 16:36:54'::timestamp, '2026-02-20 16:36:54'::timestamp, 11801818, 28919103.52, 23417706.83, 7699522.58, 9100.37, '2025-07-13 16:36:54'::timestamp, 'REF-788795', 'pending', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: escrow_transactions
INSERT INTO "escrow_transactions" ("txId", "escrowId", "type", "amount", "currency", "fromAccount", "toAccount", "status", "ledgerRef", "milestoneId", "narration", "fxRate", "fxSourceCurrency", "createdAt") VALUES
  ('TX-180301', 'ESCR-534357', 'micro', 39401632.99, 'GBP', 'Adebayo Ogundimu - rejected', 'Fatima Abdulrahman - active', 'approved', 'REF-866625', 'MILE-671051', 'Hauwa Yusuf - pending', 16.4856, 'GBP', '2025-07-26 16:36:54'::timestamp),
  ('TX-896855', 'ESCR-173753', 'enterprise', 27025061.63, 'USD', 'Tunde Akinola - approved', 'Zainab Mohammed - processing', 'rejected', 'REF-815554', 'MILE-633919', 'Aisha Bello - active', 1.4965, 'EUR', '2026-03-31 16:36:54'::timestamp),
  ('TX-533277', 'ESCR-618630', 'standard', 29576830.31, 'USD', 'Chukwuemeka Nwosu - active', 'Hauwa Yusuf - rejected', 'pending', 'REF-402516', 'MILE-596288', 'Grace Adeniyi - processing', 13.6298, 'EUR', '2025-11-03 16:36:54'::timestamp),
  ('TX-594230', 'ESCR-943235', 'enterprise', 40694624.29, 'EUR', 'Hauwa Yusuf - rejected', 'Ifeanyi Obi - approved', 'pending', 'REF-789312', 'MILE-532636', 'Oluwaseun Adeyemi - approved', 21.4408, 'GBP', '2025-05-20 16:36:54'::timestamp),
  ('TX-883880', 'ESCR-166556', 'micro', 47707662.82, 'USD', 'Tunde Akinola - approved', 'Segun Oladipo - processing', 'rejected', 'REF-775362', 'MILE-887327', 'Amina Garba - processing', 13.7995, 'EUR', '2026-02-04 16:36:54'::timestamp),
  ('TX-829493', 'ESCR-450511', 'corporate', 11367431.36, 'USD', 'Abdullahi Sani - approved', 'Abdullahi Sani - processing', 'completed', 'REF-629828', 'MILE-795155', 'Segun Oladipo - active', 0.3951, 'NGN', '2026-05-08 16:36:54'::timestamp),
  ('TX-429658', 'ESCR-876641', 'corporate', 30527215.34, 'EUR', 'Chioma Nnamdi - pending', 'Khadija Musa - active', 'rejected', 'REF-616496', 'MILE-348113', 'Amina Garba - processing', 20.862, 'USD', '2026-01-18 16:36:54'::timestamp),
  ('TX-462693', 'ESCR-235395', 'basic', 49605775.71, 'GBP', 'Chukwuemeka Nwosu - rejected', 'Chukwuemeka Nwosu - completed', 'completed', 'REF-559433', 'MILE-822270', 'Nkechi Nwankwo - active', 0.8075, 'GBP', '2025-09-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: esusuGroups
INSERT INTO "esusuGroups" ("groupId", "tenantId", "name", "organiserId", "organiserName", "contributionAmount", "currency", "frequency", "maxMembers", "currentCycle", "totalCycles", "status", "startDate", "createdAt", "updatedAt") VALUES
  ('GROU-111020', 'TENA-334253', 'Zainab Mohammed', 'ORGA-824788', 'Musa Danjuma - completed', 19658302.84, 'EUR', 'Yusuf Ibrahim - processing', 3698, 9780, 37243742, 'approved', '2025-06-04 16:36:54'::timestamp, '2025-06-10 16:36:54'::timestamp, '2025-08-10 16:36:54'::timestamp),
  ('GROU-228064', 'TENA-828339', 'Rasheed Olanrewaju', 'ORGA-488539', 'Halima Usman - completed', 9531339.02, 'NGN', 'Victoria Etim - active', 1593, 1568, 30475159, 'completed', '2025-10-29 16:36:54'::timestamp, '2025-07-06 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('GROU-881956', 'TENA-362478', 'Yusuf Ibrahim', 'ORGA-919322', 'Adebayo Ogundimu - approved', 47940196.57, 'USD', 'Zainab Mohammed - active', 6429, 3283, 21698389, 'completed', '2026-04-17 16:36:54'::timestamp, '2026-03-20 16:36:54'::timestamp, '2025-07-03 16:36:54'::timestamp),
  ('GROU-715442', 'TENA-807143', 'Suleiman Abubakar', 'ORGA-445690', 'Chioma Nnamdi - completed', 45879144.33, 'GBP', 'Halima Usman - pending', 7353, 9434, 9750065, 'rejected', '2026-01-25 16:36:54'::timestamp, '2025-08-10 16:36:54'::timestamp, '2025-05-17 16:36:54'::timestamp),
  ('GROU-423674', 'TENA-390275', 'Adebayo Ogundimu', 'ORGA-474531', 'Yusuf Ibrahim - processing', 46504206.79, 'GBP', 'Babajide Williams - completed', 2162, 3487, 24744770, 'processing', '2025-07-27 16:36:54'::timestamp, '2025-12-12 16:36:54'::timestamp, '2026-01-15 16:36:54'::timestamp),
  ('GROU-597997', 'TENA-249929', 'Victoria Etim', 'ORGA-687583', 'Rasheed Olanrewaju - rejected', 48553346.64, 'EUR', 'Zainab Mohammed - rejected', 6172, 5122, 17703674, 'pending', '2025-07-22 16:36:54'::timestamp, '2025-10-09 16:36:54'::timestamp, '2025-11-17 16:36:54'::timestamp),
  ('GROU-911966', 'TENA-443230', 'Rasheed Olanrewaju', 'ORGA-397355', 'Chukwuemeka Nwosu - approved', 28047649.5, 'EUR', 'Ifeanyi Obi - rejected', 9120, 4029, 14220064, 'rejected', '2025-07-23 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp),
  ('GROU-412479', 'TENA-940357', 'Tunde Akinola', 'ORGA-668929', 'Blessing Okoro - approved', 19380423.5, 'GBP', 'Aisha Bello - approved', 4033, 1408, 7837555, 'pending', '2025-12-12 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp, '2025-07-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: event_dedup_configs
INSERT INTO "event_dedup_configs" ("topic", "windowMs", "strategy", "duplicatesBlocked24h", "totalEvents24h", "status", "created_at") VALUES
  ('Oluwaseun Adeyemi - rejected', 4155, 'Adebayo Ogundimu - approved', 1000, 7857524, 'pending', '2025-05-25 16:36:54'::timestamp),
  ('Suleiman Abubakar - approved', 1771, 'Grace Adeniyi - pending', 9080, 21880637, 'approved', '2025-07-03 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', 7524, 'Tunde Akinola - completed', 4781, 47688230, 'completed', '2026-03-11 16:36:54'::timestamp),
  ('Musa Danjuma - rejected', 2078, 'Chidinma Okafor - active', 2516, 20840136, 'pending', '2026-04-25 16:36:54'::timestamp),
  ('Ngozi Eze - approved', 3781, 'Kabiru Aliyu - completed', 3160, 46593818, 'processing', '2026-02-03 16:36:54'::timestamp),
  ('Babajide Williams - processing', 4434, 'Ngozi Eze - pending', 6468, 18771015, 'pending', '2025-12-18 16:36:54'::timestamp),
  ('Muhammed Lawal - approved', 4408, 'Tunde Akinola - completed', 8059, 26994822, 'rejected', '2025-11-15 16:36:54'::timestamp),
  ('Amina Garba - processing', 6797, 'Grace Adeniyi - rejected', 6837, 36128861, 'processing', '2025-07-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: exportJobs
INSERT INTO "exportJobs" ("exportJobId", "domainKey", "title", "format", "status", "createdAt", "requestedByRole", "route", "rowCount", "approvalState", "approvalSignature", "downloadUrl", "retainedUntil", "reportVersion", "approvalChain", "signedBy") VALUES
  ('EXPO-638439', 'Yusuf Ibrahim - active', 'Yusuf Ibrahim - approved', 'Oluwaseun Adeyemi - completed', 'rejected', '2026-01-16 16:36:54'::timestamp, 'treasury', '/api/platform/exportJobs', 218, 'Abuja', '280cca4ab688d99a7e09722db1dfcbbdebdeb7927aacb5dadaa3fc5cec09f8fc', 'https://api.54bank.ng/exportJobs/288262', '2026-02-23 16:36:54'::timestamp, 'Babajide Williams - active', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-508031', 'Segun Oladipo - approved', 'Joy Okonkwo - processing', 'Joy Okonkwo - rejected', 'processing', '2026-04-07 16:36:54'::timestamp, 'branch', '/api/platform/exportJobs', 396, 'Rivers', 'ada9d43a4d68d5f44ff5e249f1cbe4e85945b1d01340d5abbdcdabba0fa9bf76', 'https://api.54bank.ng/exportJobs/760654', '2026-01-01 16:36:54'::timestamp, 'Zainab Mohammed - approved', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-195331', 'Folake Bakare - rejected', 'Obinna Igwe - approved', 'Oluwaseun Adeyemi - approved', 'approved', '2026-02-07 16:36:54'::timestamp, 'operations', '/api/platform/exportJobs', 175, 'Lagos', 'c0efcaeafac055b1fd67dcde81924d8a30e9b2ca9cc6e51ae924d4dbda04e23d', 'https://api.54bank.ng/exportJobs/572288', '2025-11-28 16:36:54'::timestamp, 'Kabiru Aliyu - approved', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-409906', 'Ngozi Eze - pending', 'Joy Okonkwo - approved', 'Tunde Akinola - active', 'pending', '2026-02-15 16:36:54'::timestamp, 'branch', '/api/platform/exportJobs', 46, 'Abuja', 'dae3dba7e3a2c81f8bcfcc26acfa1c5292522cdf5e1f8adbc0febffcc109e97b', 'https://api.54bank.ng/exportJobs/535698', '2026-03-19 16:36:54'::timestamp, 'Chidinma Okafor - completed', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-731706', 'Folake Bakare - active', 'Chioma Nnamdi - pending', 'Musa Danjuma - processing', 'active', '2025-12-04 16:36:54'::timestamp, 'operations', '/api/platform/exportJobs', 313, 'Delta', 'ad17f074f407b9dd8ebabc85c265adff7a3d9fa95abbe0f7bd424aeadfebbbfd', 'https://api.54bank.ng/exportJobs/511473', '2025-11-17 16:36:54'::timestamp, 'Joy Okonkwo - completed', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-824055', 'Amina Garba - processing', 'Oluwaseun Adeyemi - processing', 'Babajide Williams - active', 'processing', '2025-08-27 16:36:54'::timestamp, 'branch', '/api/platform/exportJobs', 462, 'Ogun', 'accc5bba4a88bf491eda3ca7edfe0f3d070bc8ffeacda88cdcdddc1cdbe64bdd', 'https://api.54bank.ng/exportJobs/308337', '2025-09-16 16:36:54'::timestamp, 'Halima Usman - rejected', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-353154', 'Adebayo Ogundimu - processing', 'Abdullahi Sani - completed', 'Yusuf Ibrahim - pending', 'rejected', '2025-07-11 16:36:54'::timestamp, 'compliance', '/api/platform/exportJobs', 105, 'Anambra', 'bed7ffa6fafa58f6cfb27aedf0a2caeec1b2ec74dbeea1ec78409c00a92e2d21', 'https://api.54bank.ng/exportJobs/894501', '2025-11-08 16:36:54'::timestamp, 'Blessing Okoro - processing', '{}'::jsonb, '{}'::jsonb),
  ('EXPO-222459', 'Chidinma Okafor - rejected', 'Kabiru Aliyu - processing', 'Joy Okonkwo - active', 'completed', '2026-05-10 16:36:54'::timestamp, 'branch', '/api/platform/exportJobs', 450, 'Oyo', 'deb8d3bfe9707deddc4fce41bfe5a9c3aa00865f20bde52c6fad8ad31cd2fafd', 'https://api.54bank.ng/exportJobs/471786', '2025-08-05 16:36:54'::timestamp, 'Babajide Williams - processing', '{}'::jsonb, '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- Table: farm_boundary_mapping
INSERT INTO "farm_boundary_mapping" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-776776', 'RECO-406210', 'Musa Danjuma', 'standard', 'Processed for Rasheed Olanrewaju in Oyo - active', 'rejected', 14864722.72, 'Kaduna', 'REF-391176', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-23 16:36:54'::timestamp, '2025-11-19 16:36:54'::timestamp),
  ('TENA-829273', 'RECO-909927', 'Tunde Akinola', 'basic', 'Processed for Emmanuel Ogbonna in Oyo - processing', 'completed', 754438.34, 'Rivers', 'REF-565869', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-07 16:36:54'::timestamp, '2026-05-06 16:36:54'::timestamp),
  ('TENA-111465', 'RECO-255268', 'Chukwuemeka Nwosu', 'corporate', 'Processed for Segun Oladipo in Lagos - processing', 'pending', 5358356.43, 'Kaduna', 'REF-748341', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-18 16:36:54'::timestamp, '2025-07-26 16:36:54'::timestamp),
  ('TENA-310817', 'RECO-858226', 'Khadija Musa', 'premium', 'Processed for Oluwaseun Adeyemi in Abuja - active', 'completed', 22085249.24, 'Abuja', 'REF-558367', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-06 16:36:54'::timestamp, '2026-03-30 16:36:54'::timestamp),
  ('TENA-835525', 'RECO-873730', 'Obinna Igwe', 'micro', 'Processed for Aisha Bello in Enugu - processing', 'approved', 8701857.03, 'Anambra', 'REF-660001', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-23 16:36:54'::timestamp, '2026-04-23 16:36:54'::timestamp),
  ('TENA-503559', 'RECO-823166', 'Halima Usman', 'premium', 'Processed for Nkechi Nwankwo in Kaduna - processing', 'approved', 13998906.47, 'Kano', 'REF-812948', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-13 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp),
  ('TENA-121483', 'RECO-646004', 'Joy Okonkwo', 'micro', 'Processed for Musa Danjuma in Ogun - active', 'pending', 41827389.96, 'Kaduna', 'REF-600728', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-10 16:36:54'::timestamp, '2026-02-06 16:36:54'::timestamp),
  ('TENA-168547', 'RECO-594729', 'Halima Usman', 'basic', 'Processed for Segun Oladipo in Kano - active', 'approved', 10549314.23, 'Ogun', 'REF-674000', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-06 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: farmers
INSERT INTO "farmers" ("farmerId", "tenantId", "name", "bvn", "phone", "region", "localGovernment", "farmSizeHectares", "primaryCrop", "secondaryCrops", "cooperativeId", "cooperativeName", "bankAccountNumber", "riskScore", "riskTier", "status", "geoCoordinates", "registrationChannel", "createdAt", "updatedAt") VALUES
  ('FARM-838105', 'TENA-886285', 'Yusuf Ibrahim', '58571190998', '+2347564013226', 'Ogun', 'Joy Okonkwo - completed', 9641.07, 'Rice', '{}'::jsonb, 'Flour Mills Nigeria', 'Sterling Microfinance Bank', 'Segun Oladipo - pending', 6334.8, 'micro', 'processing', '{}'::jsonb, 'Suleiman Abubakar - completed', '2025-05-24 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp),
  ('FARM-303109', 'TENA-181656', 'Oluwaseun Adeyemi', '65129643040', '+2347721660805', 'Kano', 'Nkechi Nwankwo - completed', 7819.95, 'Yam', '{}'::jsonb, 'Zenith Bank PLC', 'GTBank PLC', 'Muhammed Lawal - processing', 8683.22, 'corporate', 'pending', '{}'::jsonb, 'Blessing Okoro - rejected', '2025-09-04 16:36:54'::timestamp, '2026-04-27 16:36:54'::timestamp),
  ('FARM-321331', 'TENA-133991', 'Victoria Etim', '43305062657', '+2348169684049', 'Lagos', 'Rasheed Olanrewaju - processing', 8666.59, 'Sorghum', '{}'::jsonb, 'GTBank PLC', 'Oyo Cooperative Union', 'Grace Adeniyi - pending', 7535.12, 'enterprise', 'completed', '{}'::jsonb, 'Halima Usman - rejected', '2026-01-16 16:36:54'::timestamp, '2025-12-29 16:36:54'::timestamp),
  ('FARM-919088', 'TENA-715631', 'Yusuf Ibrahim', '13524583382', '+2347268682746', 'Abuja', 'Segun Oladipo - approved', 6357.94, 'Millet', '{}'::jsonb, 'Lagos Farms Cooperative', 'Dangote Industries Ltd', 'Nkechi Nwankwo - pending', 224.64, 'corporate', 'completed', '{}'::jsonb, 'Obinna Igwe - active', '2025-10-22 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp),
  ('FARM-136987', 'TENA-916217', 'Ifeanyi Obi', '11548420061', '+2348661373350', 'Oyo', 'Fatima Abdulrahman - rejected', 7299.74, 'Cassava', '{}'::jsonb, 'Nigerian Breweries', 'Plateau Agro Services', 'Musa Danjuma - rejected', 8053.84, 'micro', 'processing', '{}'::jsonb, 'Nkechi Nwankwo - rejected', '2025-12-16 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp),
  ('FARM-504184', 'TENA-360331', 'Abdullahi Sani', '90685835170', '+2348461494737', 'Delta', 'Muhammed Lawal - completed', 6549.01, 'Yam', '{}'::jsonb, 'Niger Delta Fisheries', 'GTBank PLC', 'Oluwaseun Adeyemi - processing', 8510.51, 'corporate', 'approved', '{}'::jsonb, 'Oluwaseun Adeyemi - approved', '2025-08-05 16:36:54'::timestamp, '2026-04-15 16:36:54'::timestamp),
  ('FARM-464973', 'TENA-478393', 'Chukwuemeka Nwosu', '50355033662', '+2348326601330', 'Rivers', 'Grace Adeniyi - processing', 1038.78, 'Millet', '{}'::jsonb, 'GTBank PLC', 'BUA Group', 'Segun Oladipo - active', 5064.78, 'enterprise', 'pending', '{}'::jsonb, 'Oluwaseun Adeyemi - processing', '2026-02-14 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp),
  ('FARM-510080', 'TENA-914634', 'Amina Garba', '12706273521', '+2347648500844', 'Kano', 'Suleiman Abubakar - approved', 6173.56, 'Cocoa', '{}'::jsonb, 'Kano Textiles Ltd', 'Niger Delta Fisheries', 'Grace Adeniyi - approved', 621.18, 'standard', 'processing', '{}'::jsonb, 'Ifeanyi Obi - active', '2026-01-07 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: fast_json_schemas
INSERT INTO "fast_json_schemas" ("schemaName", "compiledSizeBytes", "serializationsPerSec", "avgSerializeNs", "speedup", "status", "created_at") VALUES
  ('Zainab Mohammed - processing', 223, 9768, 1685, 'Grace Adeniyi - active', 'pending', '2025-07-18 16:36:54'::timestamp),
  ('Segun Oladipo - active', 350, 884, 7768, 'Zainab Mohammed - rejected', 'completed', '2026-04-14 16:36:54'::timestamp),
  ('Grace Adeniyi - completed', 247, 8291, 8128, 'Ngozi Eze - rejected', 'approved', '2025-12-27 16:36:54'::timestamp),
  ('Halima Usman - rejected', 443, 8026, 751, 'Khadija Musa - approved', 'processing', '2026-02-04 16:36:54'::timestamp),
  ('Hauwa Yusuf - processing', 2, 58, 1738, 'Tunde Akinola - active', 'rejected', '2026-03-25 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - approved', 175, 9254, 6689, 'Tunde Akinola - processing', 'active', '2025-07-12 16:36:54'::timestamp),
  ('Blessing Okoro - approved', 417, 6731, 1430, 'Hauwa Yusuf - pending', 'completed', '2026-02-14 16:36:54'::timestamp),
  ('Folake Bakare - processing', 234, 430, 584, 'Nkechi Nwankwo - approved', 'processing', '2026-01-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: fisheries_aquaculture
INSERT INTO "fisheries_aquaculture" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-332773', 'RECO-195921', 'Tunde Akinola', 'standard', 'Processed for Ifeanyi Obi in Lagos - pending', 'approved', 24291830.23, 'Enugu', 'REF-405688', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-16 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('TENA-215117', 'RECO-152655', 'Nkechi Nwankwo', 'premium', 'Processed for Hauwa Yusuf in Delta - active', 'processing', 7380941.19, 'Rivers', 'REF-841475', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-19 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp),
  ('TENA-483577', 'RECO-279023', 'Zainab Mohammed', 'basic', 'Processed for Suleiman Abubakar in Ogun - rejected', 'approved', 12475515.63, 'Anambra', 'REF-309212', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-22 16:36:54'::timestamp, '2025-09-17 16:36:54'::timestamp),
  ('TENA-967288', 'RECO-584515', 'Amina Garba', 'standard', 'Processed for Amina Garba in Kaduna - active', 'pending', 6690033.41, 'Enugu', 'REF-253601', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-27 16:36:54'::timestamp, '2025-09-04 16:36:54'::timestamp),
  ('TENA-300388', 'RECO-835006', 'Rasheed Olanrewaju', 'enterprise', 'Processed for Khadija Musa in Kaduna - completed', 'active', 27966862.87, 'Abuja', 'REF-764699', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-09 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('TENA-576374', 'RECO-640031', 'Khadija Musa', 'basic', 'Processed for Victoria Etim in Abuja - processing', 'pending', 8189901.53, 'Oyo', 'REF-290480', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-21 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp),
  ('TENA-497566', 'RECO-668919', 'Blessing Okoro', 'corporate', 'Processed for Musa Danjuma in Enugu - completed', 'pending', 36651743.36, 'Enugu', 'REF-538320', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-01 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('TENA-311829', 'RECO-779548', 'Fatima Abdulrahman', 'enterprise', 'Processed for Musa Danjuma in Anambra - rejected', 'rejected', 17402678.0, 'Abuja', 'REF-943729', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-13 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: fluvio_smart_modules
INSERT INTO "fluvio_smart_modules" ("name", "moduleType", "wasmSizeKB", "avgLatencyUs", "throughputEps", "status", "created_at") VALUES
  ('Suleiman Abubakar', 'enterprise', 103, 4504, 5715, 'approved', '2025-07-10 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi', 'standard', 397, 4094, 3129, 'active', '2025-10-04 16:36:54'::timestamp),
  ('Ngozi Eze', 'premium', 321, 8371, 3026, 'pending', '2025-10-09 16:36:54'::timestamp),
  ('Kabiru Aliyu', 'standard', 45, 8874, 5654, 'pending', '2026-02-26 16:36:54'::timestamp),
  ('Nkechi Nwankwo', 'enterprise', 103, 5965, 8856, 'completed', '2025-12-30 16:36:54'::timestamp),
  ('Hauwa Yusuf', 'premium', 256, 6943, 902, 'processing', '2025-08-28 16:36:54'::timestamp),
  ('Babajide Williams', 'basic', 479, 5389, 5163, 'approved', '2025-11-24 16:36:54'::timestamp),
  ('Nkechi Nwankwo', 'micro', 401, 5950, 4742, 'approved', '2025-12-04 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: frame_policies
INSERT INTO "frame_policies" ("domain", "frame_ancestors", "x_frame_options", "frame_detection", "violations_24h", "unique_framers", "status", "created_at") VALUES
  ('Segun Oladipo - approved', 'Amina Garba - pending', 'Suleiman Abubakar - approved', 'Nkechi Nwankwo - processing', 5742, 3912, 'rejected', '2026-04-10 16:36:54'::timestamp),
  ('Chioma Nnamdi - approved', 'Tunde Akinola - active', 'Abdullahi Sani - completed', 'Rasheed Olanrewaju - pending', 9353, 3423, 'processing', '2026-01-07 16:36:54'::timestamp),
  ('Adebayo Ogundimu - completed', 'Chioma Nnamdi - pending', 'Folake Bakare - approved', 'Segun Oladipo - completed', 9161, 7276, 'pending', '2026-03-19 16:36:54'::timestamp),
  ('Folake Bakare - active', 'Emmanuel Ogbonna - rejected', 'Joy Okonkwo - pending', 'Muhammed Lawal - processing', 6081, 9323, 'pending', '2026-04-20 16:36:54'::timestamp),
  ('Chioma Nnamdi - pending', 'Segun Oladipo - completed', 'Chioma Nnamdi - pending', 'Segun Oladipo - processing', 3584, 7788, 'processing', '2025-09-24 16:36:54'::timestamp),
  ('Joy Okonkwo - completed', 'Suleiman Abubakar - processing', 'Ngozi Eze - processing', 'Victoria Etim - completed', 48, 7582, 'active', '2026-01-21 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - completed', 'Chidinma Okafor - processing', 'Khadija Musa - completed', 'Halima Usman - completed', 109, 368, 'active', '2026-03-22 16:36:54'::timestamp),
  ('Chioma Nnamdi - completed', 'Chioma Nnamdi - processing', 'Adebayo Ogundimu - active', 'Adebayo Ogundimu - completed', 1557, 929, 'processing', '2025-06-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: fxTrades
INSERT INTO "fxTrades" ("tradeId", "tenantId", "buyCurrency", "sellCurrency", "buyAmount", "sellAmount", "exchangeRate", "tradeType", "counterparty", "valueDate", "status", "traderId", "approvedBy", "createdAt") VALUES
  ('TRAD-258437', 'TENA-618518', 'NGN', 'USD', 40168010.38, 37913606.62, 17.3593, 'premium', 'Ngozi Eze - pending', '2026-02-28 16:36:54'::timestamp, 'pending', 'TRAD-813057', 'Suleiman Abubakar - pending', '2025-11-12 16:36:54'::timestamp),
  ('TRAD-670240', 'TENA-346731', 'USD', 'USD', 33709425.39, 38470311.36, 1.012, 'premium', 'Oluwaseun Adeyemi - processing', '2025-10-28 16:36:54'::timestamp, 'rejected', 'TRAD-773455', 'Chioma Nnamdi - pending', '2025-09-21 16:36:54'::timestamp),
  ('TRAD-110433', 'TENA-696423', 'EUR', 'GBP', 48768801.6, 19056435.81, 12.6169, 'corporate', 'Suleiman Abubakar - rejected', '2025-09-14 16:36:54'::timestamp, 'processing', 'TRAD-278528', 'Babajide Williams - rejected', '2025-07-23 16:36:54'::timestamp),
  ('TRAD-901470', 'TENA-346587', 'NGN', 'GBP', 33667648.26, 44521275.59, 10.4416, 'corporate', 'Nkechi Nwankwo - processing', '2026-01-14 16:36:54'::timestamp, 'completed', 'TRAD-588775', 'Zainab Mohammed - active', '2026-02-27 16:36:54'::timestamp),
  ('TRAD-999013', 'TENA-746133', 'EUR', 'EUR', 24707892.07, 25598554.01, 14.6751, 'micro', 'Halima Usman - approved', '2026-04-06 16:36:54'::timestamp, 'rejected', 'TRAD-745250', 'Segun Oladipo - active', '2026-02-16 16:36:54'::timestamp),
  ('TRAD-401493', 'TENA-207935', 'NGN', 'USD', 20857081.55, 30358196.97, 5.7953, 'enterprise', 'Aisha Bello - processing', '2025-08-14 16:36:54'::timestamp, 'processing', 'TRAD-346789', 'Oluwaseun Adeyemi - rejected', '2025-08-29 16:36:54'::timestamp),
  ('TRAD-139298', 'TENA-995263', 'NGN', 'EUR', 45758315.9, 49363854.65, 19.9746, 'premium', 'Obinna Igwe - processing', '2026-03-15 16:36:54'::timestamp, 'active', 'TRAD-206885', 'Tunde Akinola - completed', '2026-03-28 16:36:54'::timestamp),
  ('TRAD-120541', 'TENA-759210', 'EUR', 'EUR', 1302762.14, 245266.5, 13.5697, 'corporate', 'Suleiman Abubakar - active', '2026-04-17 16:36:54'::timestamp, 'completed', 'TRAD-196490', 'Amina Garba - processing', '2025-11-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: glAccounts
INSERT INTO "glAccounts" ("glAccountCode", "tenantId", "name", "category", "subcategory", "parentCode", "currency", "balance", "status", "isControlAccount", "createdAt", "updatedAt") VALUES
  ('CODE-360152', 'TENA-267066', 'Amina Garba', 'basic', 'standard', 'CODE-534303', 'USD', 20888621.26, 'completed', 268, '2025-06-26 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp),
  ('CODE-700764', 'TENA-647908', 'Ifeanyi Obi', 'standard', 'standard', 'CODE-280368', 'NGN', 11524215.77, 'active', 85, '2026-04-14 16:36:54'::timestamp, '2026-03-20 16:36:54'::timestamp),
  ('CODE-125024', 'TENA-140617', 'Joy Okonkwo', 'basic', 'micro', 'CODE-898736', 'GBP', 36630106.7, 'processing', 87, '2025-09-18 16:36:54'::timestamp, '2026-05-10 16:36:54'::timestamp),
  ('CODE-783952', 'TENA-979203', 'Abdullahi Sani', 'standard', 'micro', 'CODE-462356', 'NGN', 5055874.02, 'active', 266, '2026-02-15 16:36:54'::timestamp, '2025-06-29 16:36:54'::timestamp),
  ('CODE-850895', 'TENA-531163', 'Kabiru Aliyu', 'standard', 'basic', 'CODE-220672', 'GBP', 14157792.87, 'pending', 372, '2026-03-10 16:36:54'::timestamp, '2025-09-19 16:36:54'::timestamp),
  ('CODE-164907', 'TENA-611182', 'Chioma Nnamdi', 'corporate', 'basic', 'CODE-772228', 'NGN', 5386811.64, 'processing', 402, '2025-07-08 16:36:54'::timestamp, '2025-08-16 16:36:54'::timestamp),
  ('CODE-418086', 'TENA-956957', 'Amina Garba', 'enterprise', 'enterprise', 'CODE-551561', 'NGN', 28184993.4, 'pending', 12, '2025-08-04 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp),
  ('CODE-725701', 'TENA-540498', 'Amina Garba', 'standard', 'micro', 'CODE-920015', 'USD', 28263698.22, 'pending', 139, '2026-03-13 16:36:54'::timestamp, '2026-04-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: goaml_reports
INSERT INTO "goaml_reports" ("reportType", "subject", "amount", "nfiuAcknowledgement", "xmlValidated", "status", "created_at") VALUES
  ('basic', 'Processed for Abdullahi Sani in Ogun - completed', 46286950, 'Oluwaseun Adeyemi - pending', true, 'active', '2025-06-27 16:36:54'::timestamp),
  ('corporate', 'Processed for Zainab Mohammed in Oyo - active', 12053282, 'Amina Garba - rejected', false, 'processing', '2025-10-17 16:36:54'::timestamp),
  ('basic', 'Processed for Segun Oladipo in Delta - pending', 9131938, 'Musa Danjuma - approved', true, 'processing', '2025-10-15 16:36:54'::timestamp),
  ('premium', 'Processed for Segun Oladipo in Rivers - rejected', 26383198, 'Ngozi Eze - completed', true, 'rejected', '2026-05-11 16:36:54'::timestamp),
  ('corporate', 'Processed for Joy Okonkwo in Ogun - processing', 34834273, 'Chioma Nnamdi - rejected', false, 'processing', '2025-05-22 16:36:54'::timestamp),
  ('corporate', 'Processed for Fatima Abdulrahman in Oyo - rejected', 15036788, 'Blessing Okoro - approved', true, 'processing', '2025-11-21 16:36:54'::timestamp),
  ('basic', 'Processed for Chukwuemeka Nwosu in Lagos - pending', 41414076, 'Hauwa Yusuf - completed', false, 'completed', '2026-02-25 16:36:54'::timestamp),
  ('corporate', 'Processed for Musa Danjuma in Lagos - active', 3085818, 'Muhammed Lawal - pending', false, 'active', '2026-04-13 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: grid_cards
INSERT INTO "grid_cards" ("grid_card_id", "customer_id", "card_serial", "grid_size", "grid_values_encrypted", "status", "usage_count", "branch_code", "issued_at", "expires_at", "last_used_at", "created_at") VALUES
  ('GR_C-657500', 'CUST-862416', 'Emmanuel Ogbonna - active', 'Abdullahi Sani - completed', '14027522.6', 'pending', 368, 'BR-OY81', '2026-02-11 16:36:54'::timestamp, '2025-07-26 16:36:54'::timestamp, '2026-04-12 16:36:54'::timestamp, '2025-11-21 16:36:54'::timestamp),
  ('GR_C-923734', 'CUST-365405', 'Hauwa Yusuf - processing', 'Muhammed Lawal - completed', '24192475.69', 'pending', 183, 'BR-OY16', '2025-09-13 16:36:54'::timestamp, '2026-04-24 16:36:54'::timestamp, '2026-03-25 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp),
  ('GR_C-524754', 'CUST-254470', 'Obinna Igwe - rejected', 'Chioma Nnamdi - processing', '45603688.08', 'active', 395, 'BR-LG80', '2026-04-18 16:36:54'::timestamp, '2025-10-15 16:36:54'::timestamp, '2026-01-22 16:36:54'::timestamp, '2025-07-18 16:36:54'::timestamp),
  ('GR_C-660743', 'CUST-212909', 'Fatima Abdulrahman - approved', 'Ngozi Eze - completed', '26937253.96', 'rejected', 252, 'BR-KN08', '2026-03-02 16:36:54'::timestamp, '2025-10-08 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp),
  ('GR_C-401737', 'CUST-652507', 'Rasheed Olanrewaju - rejected', 'Amina Garba - approved', '48793052.42', 'completed', 24, 'BR-AB39', '2025-05-15 16:36:54'::timestamp, '2025-11-19 16:36:54'::timestamp, '2026-04-22 16:36:54'::timestamp, '2025-08-22 16:36:54'::timestamp),
  ('GR_C-416798', 'CUST-376412', 'Chioma Nnamdi - approved', 'Muhammed Lawal - pending', '41705690.54', 'rejected', 99, 'BR-AB33', '2026-04-18 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp, '2026-04-02 16:36:54'::timestamp, '2025-09-25 16:36:54'::timestamp),
  ('GR_C-564604', 'CUST-665337', 'Suleiman Abubakar - completed', 'Victoria Etim - completed', '38245571.78', 'rejected', 307, 'BR-AB26', '2025-08-04 16:36:54'::timestamp, '2026-02-03 16:36:54'::timestamp, '2026-02-03 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp),
  ('GR_C-497751', 'CUST-912688', 'Chukwuemeka Nwosu - processing', 'Muhammed Lawal - rejected', '34237563.32', 'processing', 413, 'BR-AB98', '2025-08-27 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: grpc_services
INSERT INTO "grpc_services" ("service", "proto", "avgLatencyMs", "throughputRps", "compressionRatio", "status", "created_at") VALUES
  ('Folake Bakare - completed', 'Halima Usman - active', 4.698989, 7898, 'Chioma Nnamdi - processing', 'approved', '2025-06-05 16:36:54'::timestamp),
  ('Aisha Bello - approved', 'Ifeanyi Obi - processing', 12.854724, 8554, 'Abdullahi Sani - completed', 'pending', '2025-12-11 16:36:54'::timestamp),
  ('Chioma Nnamdi - pending', 'Nkechi Nwankwo - pending', 10.120508, 2560, 'Ngozi Eze - completed', 'completed', '2026-02-02 16:36:54'::timestamp),
  ('Chioma Nnamdi - processing', 'Nkechi Nwankwo - processing', 4.544223, 8341, 'Kabiru Aliyu - rejected', 'completed', '2026-05-11 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - approved', 'Nkechi Nwankwo - completed', 5.445638, 9373, 'Musa Danjuma - active', 'approved', '2025-06-03 16:36:54'::timestamp),
  ('Nkechi Nwankwo - active', 'Yusuf Ibrahim - pending', 10.869218, 6810, 'Ngozi Eze - rejected', 'pending', '2026-05-12 16:36:54'::timestamp),
  ('Grace Adeniyi - processing', 'Grace Adeniyi - rejected', 11.528804, 2175, 'Babajide Williams - rejected', 'approved', '2026-01-10 16:36:54'::timestamp),
  ('Aisha Bello - rejected', 'Ngozi Eze - active', 9.067289, 5621, 'Chukwuemeka Nwosu - approved', 'pending', '2025-06-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: hot_data_caches
INSERT INTO "hot_data_caches" ("service", "cacheType", "maxEntries", "currentEntries", "hitRate", "memoryMB", "status", "created_at") VALUES
  ('Segun Oladipo - pending', 'basic', 5069, 804, 'Chukwuemeka Nwosu - active', 752.13, 'processing', '2025-08-04 16:36:54'::timestamp),
  ('Aisha Bello - pending', 'premium', 2334, 1786, 'Joy Okonkwo - pending', 7013.93, 'rejected', '2025-10-20 16:36:54'::timestamp),
  ('Adebayo Ogundimu - rejected', 'basic', 768, 605, 'Nkechi Nwankwo - rejected', 2489.01, 'completed', '2025-11-27 16:36:54'::timestamp),
  ('Segun Oladipo - completed', 'micro', 4635, 3153, 'Zainab Mohammed - rejected', 4086.51, 'active', '2025-08-04 16:36:54'::timestamp),
  ('Kabiru Aliyu - rejected', 'premium', 6868, 2981, 'Halima Usman - completed', 1043.64, 'processing', '2025-06-01 16:36:54'::timestamp),
  ('Victoria Etim - pending', 'standard', 4461, 8529, 'Ngozi Eze - completed', 9681.78, 'completed', '2025-08-19 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', 'premium', 7419, 3697, 'Ifeanyi Obi - processing', 1210.56, 'approved', '2025-09-04 16:36:54'::timestamp),
  ('Suleiman Abubakar - pending', 'premium', 2387, 4056, 'Tunde Akinola - approved', 704.98, 'processing', '2025-05-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: hpa_configs
INSERT INTO "hpa_configs" ("deployment", "minReplicas", "maxReplicas", "currentReplicas", "cpuTargetPct", "customMetric", "status", "created_at") VALUES
  ('Joy Okonkwo - pending', 3281, 9508, 3886, 9985, 'Ngozi Eze - rejected', 'approved', '2025-07-17 16:36:54'::timestamp),
  ('Grace Adeniyi - active', 4631, 211, 8612, 690, 'Suleiman Abubakar - approved', 'processing', '2026-04-29 16:36:54'::timestamp),
  ('Suleiman Abubakar - completed', 3430, 8731, 1604, 4159, 'Victoria Etim - rejected', 'approved', '2025-05-13 16:36:54'::timestamp),
  ('Amina Garba - rejected', 4150, 4898, 6228, 2863, 'Halima Usman - active', 'rejected', '2026-04-06 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - approved', 7390, 1560, 9844, 6169, 'Obinna Igwe - pending', 'completed', '2026-04-07 16:36:54'::timestamp),
  ('Adebayo Ogundimu - active', 1091, 6624, 7929, 6531, 'Suleiman Abubakar - approved', 'processing', '2025-09-29 16:36:54'::timestamp),
  ('Folake Bakare - processing', 841, 758, 1554, 6771, 'Ngozi Eze - processing', 'active', '2026-02-20 16:36:54'::timestamp),
  ('Yusuf Ibrahim - active', 4921, 8805, 8277, 3298, 'Abdullahi Sani - rejected', 'rejected', '2026-04-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: http2_connections
INSERT INTO "http2_connections" ("clientIp", "streams", "maxConcurrentStreams", "windowSize", "serverPushEnabled", "status", "created_at") VALUES
  ('Kabiru Aliyu - active', 1323, 9896, 'Fatima Abdulrahman - active', false, 'approved', '2025-07-15 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - completed', 2992, 1269, 'Blessing Okoro - completed', false, 'completed', '2025-05-18 16:36:54'::timestamp),
  ('Victoria Etim - rejected', 8787, 5722, 'Chukwuemeka Nwosu - active', false, 'active', '2025-10-25 16:36:54'::timestamp),
  ('Chioma Nnamdi - pending', 9942, 9886, 'Victoria Etim - pending', true, 'completed', '2025-09-27 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 9234, 9837, 'Tunde Akinola - pending', true, 'completed', '2026-01-29 16:36:54'::timestamp),
  ('Babajide Williams - completed', 2055, 475, 'Chidinma Okafor - approved', true, 'rejected', '2025-08-25 16:36:54'::timestamp),
  ('Grace Adeniyi - rejected', 6875, 5437, 'Oluwaseun Adeyemi - rejected', true, 'rejected', '2025-07-14 16:36:54'::timestamp),
  ('Victoria Etim - active', 6002, 2169, 'Chukwuemeka Nwosu - rejected', false, 'processing', '2026-02-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: identityProfiles
INSERT INTO "identityProfiles" ("profileId", "tenantId", "customerId", "customerName", "email", "phoneNumber", "bvn", "nin", "mfaEnabled", "mfaMethods", "activeChannels", "status", "lastLoginAt", "failedAttempts", "createdAt", "updatedAt") VALUES
  ('PROF-928064', 'TENA-668364', 'CUST-472705', 'Kabiru Aliyu', 'yusuf.ibrahim@54bank.ng', '+2347934170780', '40716454650', '56640952618', 5782, '{}'::jsonb, '{}'::jsonb, 'processing', '2025-07-13 16:36:54'::timestamp, 5893, '2025-10-24 16:36:54'::timestamp, '2025-07-07 16:36:54'::timestamp),
  ('PROF-716919', 'TENA-241390', 'CUST-416974', 'Folake Bakare', 'halima.usman@54bank.ng', '+2348056492153', '62565474129', '61332845047', 6395, '{}'::jsonb, '{}'::jsonb, 'processing', '2025-05-25 16:36:54'::timestamp, 8431, '2025-09-08 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp),
  ('PROF-366261', 'TENA-328620', 'CUST-966867', 'Victoria Etim', 'folake.bakare@54bank.ng', '+2347177792062', '28521929961', '28882522437', 8550, '{}'::jsonb, '{}'::jsonb, 'approved', '2026-01-03 16:36:54'::timestamp, 3098, '2025-09-21 16:36:54'::timestamp, '2025-07-22 16:36:54'::timestamp),
  ('PROF-404507', 'TENA-498667', 'CUST-819549', 'Emmanuel Ogbonna', 'amina.garba@54bank.ng', '+2348628285147', '25971590430', '39162071916', 6680, '{}'::jsonb, '{}'::jsonb, 'completed', '2025-12-23 16:36:54'::timestamp, 7121, '2026-02-15 16:36:54'::timestamp, '2025-11-24 16:36:54'::timestamp),
  ('PROF-590538', 'TENA-583072', 'CUST-486678', 'Folake Bakare', 'nkechi.nwankwo@54bank.ng', '+2348605466358', '40912048077', '94972685416', 5201, '{}'::jsonb, '{}'::jsonb, 'completed', '2025-07-22 16:36:54'::timestamp, 122, '2025-10-27 16:36:54'::timestamp, '2026-04-01 16:36:54'::timestamp),
  ('PROF-589872', 'TENA-377817', 'CUST-409437', 'Chioma Nnamdi', 'khadija.musa@54bank.ng', '+2347783425325', '28900130818', '66685461308', 8806, '{}'::jsonb, '{}'::jsonb, 'active', '2025-05-25 16:36:54'::timestamp, 165, '2025-06-12 16:36:54'::timestamp, '2025-07-22 16:36:54'::timestamp),
  ('PROF-805256', 'TENA-210895', 'CUST-998681', 'Folake Bakare', 'khadija.musa@54bank.ng', '+2347920435290', '26677458847', '25154718616', 5576, '{}'::jsonb, '{}'::jsonb, 'approved', '2025-12-29 16:36:54'::timestamp, 6247, '2026-05-07 16:36:54'::timestamp, '2025-06-14 16:36:54'::timestamp),
  ('PROF-478565', 'TENA-225276', 'CUST-350018', 'Chidinma Okafor', 'aisha.bello@54bank.ng', '+2347792014701', '35027807433', '62953688553', 509, '{}'::jsonb, '{}'::jsonb, 'approved', '2025-07-12 16:36:54'::timestamp, 147, '2025-12-19 16:36:54'::timestamp, '2025-07-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ijaraContracts
INSERT INTO "ijaraContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "assetValue", "rentalAmount", "rentalFrequency", "currency", "leaseStart", "leaseEnd", "tenorMonths", "residualValue", "purchaseOption", "purchasePrice", "totalRentPaid", "status", "shariaCompliance", "maintenanceResponsibility", "createdAt", "updatedAt") VALUES
  ('CONT-795675', 'TENA-966539', 'CUST-229499', 'Tunde Akinola', 'Processed for Emmanuel Ogbonna in Kano - rejected', 'micro', 7211258.81, 15119276.0, 'Chidinma Okafor - approved', 'USD', 'Khadija Musa - processing', 'Zainab Mohammed - rejected', 270, 21391382.42, 1869, 43819780.72, 8489.2, 'approved', 'Muhammed Lawal - active', 'Grace Adeniyi - approved', '2025-07-24 16:36:54'::timestamp, '2026-05-09 16:36:54'::timestamp),
  ('CONT-951755', 'TENA-855477', 'CUST-954610', 'Babajide Williams', 'Processed for Folake Bakare in Kano - processing', 'corporate', 46704617.37, 38249641.38, 'Folake Bakare - rejected', 'EUR', 'Fatima Abdulrahman - pending', 'Suleiman Abubakar - approved', 145, 26619991.07, 294, 4436410.04, 1663.78, 'rejected', 'Segun Oladipo - rejected', 'Nkechi Nwankwo - approved', '2026-03-04 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp),
  ('CONT-380091', 'TENA-894882', 'CUST-793778', 'Nkechi Nwankwo', 'Processed for Victoria Etim in Anambra - approved', 'micro', 10588599.99, 38069205.33, 'Folake Bakare - rejected', 'NGN', 'Hauwa Yusuf - active', 'Aisha Bello - active', 318, 6327269.73, 1733, 9547653.04, 3166.4, 'active', 'Kabiru Aliyu - completed', 'Amina Garba - processing', '2025-08-24 16:36:54'::timestamp, '2025-12-09 16:36:54'::timestamp),
  ('CONT-530426', 'TENA-540057', 'CUST-937777', 'Zainab Mohammed', 'Processed for Fatima Abdulrahman in Kaduna - processing', 'standard', 6926445.04, 41547429.67, 'Oluwaseun Adeyemi - rejected', 'NGN', 'Joy Okonkwo - processing', 'Adebayo Ogundimu - approved', 280, 30111486.46, 6618, 5902733.56, 9656.28, 'approved', 'Segun Oladipo - completed', 'Chidinma Okafor - processing', '2025-12-04 16:36:54'::timestamp, '2025-08-28 16:36:54'::timestamp),
  ('CONT-339604', 'TENA-815372', 'CUST-685696', 'Joy Okonkwo', 'Processed for Nkechi Nwankwo in Ogun - rejected', 'basic', 30628901.95, 41494182.16, 'Oluwaseun Adeyemi - rejected', 'USD', 'Muhammed Lawal - rejected', 'Chukwuemeka Nwosu - active', 138, 23198344.91, 5804, 21206200.71, 5872.09, 'active', 'Ngozi Eze - completed', 'Adebayo Ogundimu - processing', '2026-04-22 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp),
  ('CONT-426381', 'TENA-303268', 'CUST-110486', 'Yusuf Ibrahim', 'Processed for Segun Oladipo in Rivers - completed', 'micro', 23175714.32, 39642703.29, 'Kabiru Aliyu - processing', 'GBP', 'Oluwaseun Adeyemi - approved', 'Tunde Akinola - processing', 360, 30881662.57, 9060, 18527606.38, 7749.46, 'active', 'Chidinma Okafor - processing', 'Oluwaseun Adeyemi - pending', '2026-02-10 16:36:54'::timestamp, '2026-05-02 16:36:54'::timestamp),
  ('CONT-914068', 'TENA-423747', 'CUST-330447', 'Amina Garba', 'Processed for Aisha Bello in Kano - rejected', 'premium', 3157374.61, 24259938.64, 'Joy Okonkwo - active', 'USD', 'Zainab Mohammed - approved', 'Folake Bakare - completed', 83, 49790680.44, 9479, 42335132.23, 9560.6, 'completed', 'Khadija Musa - completed', 'Blessing Okoro - active', '2025-12-05 16:36:54'::timestamp, '2026-01-17 16:36:54'::timestamp),
  ('CONT-772262', 'TENA-827426', 'CUST-612428', 'Hauwa Yusuf', 'Processed for Emmanuel Ogbonna in Oyo - rejected', 'micro', 35378312.92, 14435035.14, 'Obinna Igwe - processing', 'GBP', 'Blessing Okoro - approved', 'Aisha Bello - completed', 339, 30875467.57, 4841, 25900514.37, 9010.32, 'processing', 'Halima Usman - completed', 'Tunde Akinola - pending', '2026-02-07 16:36:54'::timestamp, '2026-02-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: image_scans
INSERT INTO "image_scans" ("image_name", "registry", "base_image", "total_vulns", "critical", "high", "medium", "low", "sbom_artifacts", "last_scanned", "status", "created_at") VALUES
  ('Obinna Igwe - approved', 'Muhammed Lawal - completed', 'Aisha Bello - processing', 37120358, 3641, 560, 3727, 5042, 5139, '2025-06-01 16:36:54'::timestamp, 'pending', '2025-08-05 16:36:54'::timestamp),
  ('Victoria Etim - processing', 'Folake Bakare - rejected', 'Oluwaseun Adeyemi - completed', 7417467, 2558, 4649, 2659, 9615, 516, '2025-12-25 16:36:54'::timestamp, 'active', '2025-09-09 16:36:54'::timestamp),
  ('Zainab Mohammed - completed', 'Grace Adeniyi - completed', 'Khadija Musa - pending', 49467783, 401, 9461, 9971, 1407, 3278, '2025-08-30 16:36:54'::timestamp, 'processing', '2026-01-21 16:36:54'::timestamp),
  ('Chidinma Okafor - completed', 'Musa Danjuma - completed', 'Ngozi Eze - pending', 29043215, 5243, 2450, 2905, 9782, 2861, '2025-10-11 16:36:54'::timestamp, 'completed', '2025-12-05 16:36:54'::timestamp),
  ('Folake Bakare - active', 'Adebayo Ogundimu - active', 'Fatima Abdulrahman - active', 9541015, 5013, 5177, 3648, 4726, 3843, '2025-05-14 16:36:54'::timestamp, 'completed', '2025-06-05 16:36:54'::timestamp),
  ('Obinna Igwe - rejected', 'Ifeanyi Obi - approved', 'Aisha Bello - completed', 46712996, 6624, 7844, 8397, 7895, 2712, '2025-08-08 16:36:54'::timestamp, 'active', '2026-03-03 16:36:54'::timestamp),
  ('Khadija Musa - completed', 'Ifeanyi Obi - rejected', 'Zainab Mohammed - rejected', 10723816, 844, 3606, 7583, 5442, 1307, '2026-01-04 16:36:54'::timestamp, 'completed', '2025-11-12 16:36:54'::timestamp),
  ('Muhammed Lawal - rejected', 'Hauwa Yusuf - rejected', 'Khadija Musa - processing', 27339614, 4263, 7248, 4811, 9296, 8932, '2026-03-02 16:36:54'::timestamp, 'active', '2026-04-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: immutable_audit_blocks
INSERT INTO "immutable_audit_blocks" ("block_number", "previous_hash", "merkle_root", "transactions", "validator", "anchored_to_chain", "anchor_tx_hash", "verified", "status", "created_at") VALUES
  (6881, 'efaed0abb2cd1abebc9cf51879cbcd8e86667406aa3fb834b65a0e85ce6babc0', 'Fatima Abdulrahman - processing', 3253, 'Ngozi Eze - pending', 'FCMB Group', 'Nestle Nigeria', true, 'rejected', '2025-11-08 16:36:54'::timestamp),
  (9399, '6bdfb0f95876aadb7aa96334efb12cfaebe1f1dcda6f3d992cef3fb1bbfdcec8', 'Grace Adeniyi - rejected', 9610, 'Blessing Okoro - completed', 'Niger Delta Fisheries', 'Access Bank PLC', true, 'completed', '2025-12-21 16:36:54'::timestamp),
  (8330, 'd28bb9b75f3d6fbdafabcddece1cf23f2f3eabfadefae7b3e4dae7a03367da8e', 'Musa Danjuma - processing', 3879, 'Adebayo Ogundimu - processing', 'GTBank PLC', 'Access Bank PLC', true, 'active', '2025-10-19 16:36:54'::timestamp),
  (5760, 'b86ebfcabd9f5e992ebbcab0fd3c65cc0bcefbd6cef3caf77f37a5e12df6db90', 'Joy Okonkwo - rejected', 8551, 'Obinna Igwe - active', 'First Bank Nigeria', 'Access Bank PLC', false, 'processing', '2026-05-07 16:36:54'::timestamp),
  (684, '87b4fd6fb5d8df1c4f044bce3b1e78f43b0cfecc5b59df44c0d78c5435edced4', 'Chukwuemeka Nwosu - rejected', 1806, 'Halima Usman - approved', 'GTBank PLC', 'Dangote Industries Ltd', true, 'pending', '2026-03-25 16:36:54'::timestamp),
  (7925, '68c857ab11832b99bf16bea8acbef9f5e879beb7b2d16a9cf96c68fc5a5539f8', 'Segun Oladipo - processing', 855, 'Chidinma Okafor - completed', 'Oyo Cooperative Union', 'Lagos Farms Cooperative', false, 'pending', '2025-11-16 16:36:54'::timestamp),
  (5410, 'aed35ac7eb5edace67cd7a5f63dae5fd3eaa7ddec18c4146cf990bfcf6257fa9', 'Chioma Nnamdi - rejected', 8238, 'Tunde Akinola - active', 'Dangote Industries Ltd', 'Stanbic IBTC', true, 'processing', '2025-09-07 16:36:54'::timestamp),
  (613, '2e3c9ab715de3eb609b530a597446bbbe1afacb4bebbfaac2fe6cc4c6aa19b90', 'Babajide Williams - completed', 8950, 'Emmanuel Ogbonna - processing', 'Plateau Agro Services', 'Oando PLC', false, 'active', '2025-07-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: incidents
INSERT INTO "incidents" ("title", "severity", "category", "affected_systems", "containment_actions", "escalation_level", "assignee", "detected_at", "contained_at", "ttd_minutes", "ttc_minutes", "status", "created_at") VALUES
  ('Fatima Abdulrahman - approved', 'high', 'corporate', '{}'::jsonb, '{}'::jsonb, 9687, 'Yusuf Ibrahim - rejected', '2025-09-18 16:36:54'::timestamp, '2026-02-12 16:36:54'::timestamp, 6910, 7055, 'rejected', '2025-11-25 16:36:54'::timestamp),
  ('Segun Oladipo - rejected', 'warning', 'basic', '{}'::jsonb, '{}'::jsonb, 9113, 'Grace Adeniyi - active', '2025-12-06 16:36:54'::timestamp, '2026-04-14 16:36:54'::timestamp, 760, 6508, 'pending', '2026-03-09 16:36:54'::timestamp),
  ('Joy Okonkwo - pending', 'high', 'corporate', '{}'::jsonb, '{}'::jsonb, 2477, 'Joy Okonkwo - pending', '2025-09-15 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp, 6376, 4670, 'completed', '2026-03-07 16:36:54'::timestamp),
  ('Khadija Musa - active', 'low', 'enterprise', '{}'::jsonb, '{}'::jsonb, 3192, 'Musa Danjuma - processing', '2025-08-10 16:36:54'::timestamp, '2025-09-25 16:36:54'::timestamp, 4019, 8278, 'processing', '2025-07-13 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - pending', 'warning', 'corporate', '{}'::jsonb, '{}'::jsonb, 7404, 'Zainab Mohammed - completed', '2026-01-16 16:36:54'::timestamp, '2026-04-02 16:36:54'::timestamp, 8680, 2302, 'rejected', '2025-06-04 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - rejected', 'medium', 'standard', '{}'::jsonb, '{}'::jsonb, 536, 'Ifeanyi Obi - pending', '2025-08-06 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp, 5275, 6035, 'pending', '2026-03-18 16:36:54'::timestamp),
  ('Muhammed Lawal - pending', 'info', 'corporate', '{}'::jsonb, '{}'::jsonb, 5515, 'Hauwa Yusuf - processing', '2026-03-27 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp, 4223, 719, 'completed', '2026-03-28 16:36:54'::timestamp),
  ('Babajide Williams - pending', 'critical', 'basic', '{}'::jsonb, '{}'::jsonb, 2224, 'Oluwaseun Adeyemi - pending', '2025-09-02 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp, 5403, 5294, 'completed', '2025-06-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: insurance_portfolio_analytics
INSERT INTO "insurance_portfolio_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-417046', 'RECO-874544', 'Babajide Williams', 'basic', 'Processed for Nkechi Nwankwo in Lagos - pending', 'approved', 11063298.08, 'Enugu', 'REF-653072', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-20 16:36:54'::timestamp, '2026-02-04 16:36:54'::timestamp),
  ('TENA-137472', 'RECO-792166', 'Segun Oladipo', 'premium', 'Processed for Muhammed Lawal in Delta - processing', 'approved', 16932214.98, 'Oyo', 'REF-712764', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-24 16:36:54'::timestamp, '2025-10-26 16:36:54'::timestamp),
  ('TENA-533361', 'RECO-735063', 'Adebayo Ogundimu', 'corporate', 'Processed for Halima Usman in Oyo - rejected', 'processing', 48808016.28, 'Kaduna', 'REF-275624', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2025-07-17 16:36:54'::timestamp),
  ('TENA-918252', 'RECO-799350', 'Victoria Etim', 'premium', 'Processed for Chioma Nnamdi in Abuja - approved', 'completed', 10916229.06, 'Anambra', 'REF-426450', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-23 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp),
  ('TENA-973383', 'RECO-458148', 'Segun Oladipo', 'enterprise', 'Processed for Zainab Mohammed in Kaduna - pending', 'active', 26711215.36, 'Anambra', 'REF-480701', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-03 16:36:54'::timestamp, '2025-11-16 16:36:54'::timestamp),
  ('TENA-635598', 'RECO-383649', 'Ngozi Eze', 'premium', 'Processed for Chidinma Okafor in Oyo - processing', 'processing', 40143754.49, 'Delta', 'REF-275682', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-25 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-343854', 'RECO-602053', 'Rasheed Olanrewaju', 'corporate', 'Processed for Joy Okonkwo in Rivers - completed', 'rejected', 26766230.23, 'Anambra', 'REF-883830', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-11 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('TENA-316591', 'RECO-431121', 'Chioma Nnamdi', 'premium', 'Processed for Babajide Williams in Ogun - approved', 'active', 36444632.43, 'Kano', 'REF-783858', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-16 16:36:54'::timestamp, '2026-02-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: interactive_ussd_agri
INSERT INTO "interactive_ussd_agri" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-661608', 'RECO-647909', 'Segun Oladipo', 'basic', 'Processed for Fatima Abdulrahman in Delta - rejected', 'active', 24509185.19, 'Delta', 'REF-822214', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-11 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp),
  ('TENA-633986', 'RECO-557789', 'Zainab Mohammed', 'micro', 'Processed for Ifeanyi Obi in Abuja - completed', 'rejected', 5948203.24, 'Rivers', 'REF-734859', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-20 16:36:54'::timestamp, '2026-03-16 16:36:54'::timestamp),
  ('TENA-622285', 'RECO-912012', 'Oluwaseun Adeyemi', 'enterprise', 'Processed for Ifeanyi Obi in Oyo - completed', 'approved', 4445182.91, 'Kano', 'REF-683715', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-07 16:36:54'::timestamp, '2025-05-29 16:36:54'::timestamp),
  ('TENA-312759', 'RECO-954309', 'Yusuf Ibrahim', 'micro', 'Processed for Abdullahi Sani in Oyo - approved', 'pending', 16834729.01, 'Ogun', 'REF-652736', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-26 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp),
  ('TENA-445623', 'RECO-582184', 'Suleiman Abubakar', 'enterprise', 'Processed for Babajide Williams in Kaduna - rejected', 'processing', 39787221.61, 'Abuja', 'REF-391231', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-01 16:36:54'::timestamp, '2025-05-26 16:36:54'::timestamp),
  ('TENA-434713', 'RECO-922099', 'Joy Okonkwo', 'corporate', 'Processed for Babajide Williams in Anambra - active', 'active', 10777632.09, 'Ogun', 'REF-747130', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-20 16:36:54'::timestamp, '2025-05-29 16:36:54'::timestamp),
  ('TENA-483513', 'RECO-535112', 'Chukwuemeka Nwosu', 'corporate', 'Processed for Tunde Akinola in Abuja - active', 'completed', 21739300.82, 'Rivers', 'REF-237915', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-12 16:36:54'::timestamp, '2025-10-12 16:36:54'::timestamp),
  ('TENA-809985', 'RECO-444344', 'Yusuf Ibrahim', 'premium', 'Processed for Abdullahi Sani in Kano - processing', 'pending', 19053710.15, 'Rivers', 'REF-452253', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-05 16:36:54'::timestamp, '2026-01-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ip_rules
INSERT INTO "ip_rules" ("name", "cidr", "rule_type", "applies_to", "hits_24h", "blocked_24h", "geo_country", "status", "created_at") VALUES
  ('Suleiman Abubakar', 'Suleiman Abubakar - processing', 'standard', 'Rasheed Olanrewaju - processing', 8220, 4766, 'Oluwaseun Adeyemi - approved', 'active', '2025-10-17 16:36:54'::timestamp),
  ('Tunde Akinola', 'Chukwuemeka Nwosu - pending', 'micro', 'Hauwa Yusuf - approved', 230, 2702, 'Hauwa Yusuf - approved', 'processing', '2025-10-17 16:36:54'::timestamp),
  ('Chioma Nnamdi', 'Halima Usman - pending', 'micro', 'Chukwuemeka Nwosu - pending', 5526, 8126, 'Halima Usman - rejected', 'approved', '2025-12-19 16:36:54'::timestamp),
  ('Obinna Igwe', 'Babajide Williams - completed', 'corporate', 'Joy Okonkwo - active', 5528, 5494, 'Joy Okonkwo - approved', 'rejected', '2025-08-07 16:36:54'::timestamp),
  ('Khadija Musa', 'Blessing Okoro - rejected', 'corporate', 'Tunde Akinola - approved', 5551, 9753, 'Segun Oladipo - active', 'processing', '2025-05-28 16:36:54'::timestamp),
  ('Kabiru Aliyu', 'Grace Adeniyi - approved', 'standard', 'Rasheed Olanrewaju - rejected', 449, 5509, 'Muhammed Lawal - rejected', 'rejected', '2025-05-13 16:36:54'::timestamp),
  ('Kabiru Aliyu', 'Abdullahi Sani - approved', 'basic', 'Folake Bakare - approved', 5626, 5290, 'Musa Danjuma - completed', 'processing', '2026-02-21 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'Rasheed Olanrewaju - processing', 'corporate', 'Oluwaseun Adeyemi - rejected', 8900, 7287, 'Zainab Mohammed - completed', 'active', '2026-04-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: journalEntries
INSERT INTO "journalEntries" ("entryId", "tenantId", "accountId", "glAccountCode", "type", "amount", "currency", "narration", "transactionRef", "batchId", "reversalOf", "postingDate", "valueDate", "createdAt") VALUES
  ('ENTR-966336', 'TENA-986829', 'ACCO-861605', 'CODE-110346', 'micro', 25769136.52, 'USD', 'Segun Oladipo - rejected', 'reject', 'BATC-439795', 'Khadija Musa - rejected', '2025-07-28 16:36:54'::timestamp, '2025-07-27 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp),
  ('ENTR-495933', 'TENA-796391', 'ACCO-894947', 'CODE-337199', 'micro', 29686185.75, 'USD', 'Segun Oladipo - completed', 'update', 'BATC-223456', 'Blessing Okoro - completed', '2025-06-05 16:36:54'::timestamp, '2026-05-07 16:36:54'::timestamp, '2025-06-11 16:36:54'::timestamp),
  ('ENTR-836331', 'TENA-259800', 'ACCO-386430', 'CODE-628823', 'premium', 47029265.36, 'USD', 'Tunde Akinola - processing', 'transfer', 'BATC-626731', 'Zainab Mohammed - active', '2026-04-26 16:36:54'::timestamp, '2025-07-17 16:36:54'::timestamp, '2025-12-30 16:36:54'::timestamp),
  ('ENTR-437866', 'TENA-911868', 'ACCO-642610', 'CODE-531806', 'corporate', 32716717.55, 'USD', 'Joy Okonkwo - approved', 'reject', 'BATC-163380', 'Segun Oladipo - approved', '2025-05-12 16:36:54'::timestamp, '2026-02-05 16:36:54'::timestamp, '2026-02-01 16:36:54'::timestamp),
  ('ENTR-409967', 'TENA-278401', 'ACCO-976900', 'CODE-455238', 'premium', 47846028.08, 'GBP', 'Babajide Williams - completed', 'create', 'BATC-398702', 'Kabiru Aliyu - active', '2025-10-15 16:36:54'::timestamp, '2025-07-10 16:36:54'::timestamp, '2026-02-26 16:36:54'::timestamp),
  ('ENTR-151118', 'TENA-613669', 'ACCO-144586', 'CODE-899497', 'premium', 32024452.37, 'GBP', 'Chukwuemeka Nwosu - approved', 'transfer', 'BATC-397855', 'Joy Okonkwo - approved', '2026-02-27 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp, '2026-04-27 16:36:54'::timestamp),
  ('ENTR-230560', 'TENA-510109', 'ACCO-672679', 'CODE-247876', 'corporate', 11586012.86, 'USD', 'Segun Oladipo - completed', 'update', 'BATC-152319', 'Babajide Williams - pending', '2026-04-05 16:36:54'::timestamp, '2025-09-27 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp),
  ('ENTR-475063', 'TENA-436538', 'ACCO-208041', 'CODE-488112', 'enterprise', 1063669.52, 'GBP', 'Oluwaseun Adeyemi - approved', 'update', 'BATC-570653', 'Kabiru Aliyu - completed', '2025-10-28 16:36:54'::timestamp, '2025-05-23 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: jwt_validations
INSERT INTO "jwt_validations" ("token_type", "issuer", "audience", "algorithm", "validations_24h", "rejections_24h", "avg_latency_ms", "cache_hit_rate", "status", "created_at") VALUES
  ('micro', 'Chukwuemeka Nwosu - completed', 'Nkechi Nwankwo - active', 'Aisha Bello - completed', 4009, 5833, 7.619858, 9.3096, 'completed', '2025-05-20 16:36:54'::timestamp),
  ('premium', 'Rasheed Olanrewaju - completed', 'Folake Bakare - rejected', 'Yusuf Ibrahim - pending', 9405, 3768, 13.839697, 15.904, 'rejected', '2025-09-19 16:36:54'::timestamp),
  ('premium', 'Halima Usman - processing', 'Yusuf Ibrahim - processing', 'Amina Garba - completed', 2523, 2536, 12.891896, 13.4753, 'processing', '2025-10-11 16:36:54'::timestamp),
  ('corporate', 'Musa Danjuma - approved', 'Chioma Nnamdi - pending', 'Aisha Bello - rejected', 8034, 3678, 12.283743, 5.4509, 'active', '2025-11-09 16:36:54'::timestamp),
  ('basic', 'Yusuf Ibrahim - active', 'Muhammed Lawal - active', 'Halima Usman - approved', 1440, 4717, 8.363488, 15.6156, 'completed', '2026-01-27 16:36:54'::timestamp),
  ('corporate', 'Grace Adeniyi - completed', 'Halima Usman - processing', 'Ifeanyi Obi - rejected', 4067, 4515, 5.544519, 22.189, 'approved', '2025-08-19 16:36:54'::timestamp),
  ('premium', 'Chukwuemeka Nwosu - approved', 'Chukwuemeka Nwosu - active', 'Musa Danjuma - rejected', 7196, 4098, 10.457357, 10.8544, 'processing', '2025-09-24 16:36:54'::timestamp),
  ('premium', 'Chioma Nnamdi - completed', 'Amina Garba - pending', 'Segun Oladipo - active', 5727, 6085, 6.015965, 12.6086, 'pending', '2025-06-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kafka_batch_producers
INSERT INTO "kafka_batch_producers" ("topic", "lingerMs", "batchSizeKB", "compressionType", "throughputMps", "status", "created_at") VALUES
  ('Ifeanyi Obi - pending', 7017, 62, 'standard', 7501, 'completed', '2025-12-06 16:36:54'::timestamp),
  ('Segun Oladipo - pending', 4581, 300, 'enterprise', 3887, 'approved', '2025-11-11 16:36:54'::timestamp),
  ('Hauwa Yusuf - rejected', 6462, 73, 'standard', 1515, 'active', '2025-05-21 16:36:54'::timestamp),
  ('Ngozi Eze - completed', 4503, 291, 'corporate', 589, 'active', '2026-04-10 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - processing', 9492, 179, 'enterprise', 2172, 'active', '2026-04-29 16:36:54'::timestamp),
  ('Segun Oladipo - pending', 5125, 431, 'basic', 6398, 'rejected', '2026-01-01 16:36:54'::timestamp),
  ('Ifeanyi Obi - rejected', 9941, 406, 'corporate', 9425, 'pending', '2025-09-06 16:36:54'::timestamp),
  ('Joy Okonkwo - rejected', 8221, 340, 'corporate', 4696, 'pending', '2025-11-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kafka_consumer_groups
INSERT INTO "kafka_consumer_groups" ("groupId", "topic", "partitions", "consumers", "lag", "throughputMps", "status", "created_at") VALUES
  ('GROU-780329', 'Aisha Bello - completed', 3624, 7698, 4392, 2837, 'processing', '2025-10-24 16:36:54'::timestamp),
  ('GROU-957584', 'Nkechi Nwankwo - rejected', 3036, 8599, 1810, 47, 'approved', '2025-12-12 16:36:54'::timestamp),
  ('GROU-984834', 'Zainab Mohammed - completed', 8166, 8646, 5265, 9554, 'approved', '2025-08-26 16:36:54'::timestamp),
  ('GROU-899560', 'Hauwa Yusuf - pending', 4885, 4266, 67, 8259, 'pending', '2025-10-07 16:36:54'::timestamp),
  ('GROU-453036', 'Joy Okonkwo - rejected', 5769, 782, 5503, 767, 'processing', '2025-06-01 16:36:54'::timestamp),
  ('GROU-233667', 'Abdullahi Sani - active', 1848, 2889, 9333, 2763, 'rejected', '2025-09-30 16:36:54'::timestamp),
  ('GROU-968378', 'Musa Danjuma - pending', 5398, 2336, 2129, 1381, 'active', '2026-04-17 16:36:54'::timestamp),
  ('GROU-859179', 'Emmanuel Ogbonna - pending', 6614, 8054, 1813, 9748, 'completed', '2026-03-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: keda_scale_triggers
INSERT INTO "keda_scale_triggers" ("scaleObject", "trigger", "metric", "threshold", "currentReplicas", "status", "created_at") VALUES
  ('Grace Adeniyi - approved', 'Emmanuel Ogbonna - completed', 'Amina Garba - pending', 776, 5215, 'rejected', '2025-06-08 16:36:54'::timestamp),
  ('Blessing Okoro - processing', 'Oluwaseun Adeyemi - approved', 'Blessing Okoro - pending', 4372, 8093, 'approved', '2026-02-02 16:36:54'::timestamp),
  ('Aisha Bello - rejected', 'Hauwa Yusuf - processing', 'Yusuf Ibrahim - rejected', 7292, 4846, 'rejected', '2025-08-07 16:36:54'::timestamp),
  ('Suleiman Abubakar - approved', 'Chioma Nnamdi - rejected', 'Grace Adeniyi - processing', 3062, 1887, 'active', '2026-03-24 16:36:54'::timestamp),
  ('Victoria Etim - active', 'Chidinma Okafor - active', 'Victoria Etim - pending', 942, 69, 'approved', '2025-06-20 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - pending', 'Joy Okonkwo - rejected', 'Nkechi Nwankwo - processing', 3626, 407, 'processing', '2026-01-27 16:36:54'::timestamp),
  ('Muhammed Lawal - approved', 'Obinna Igwe - processing', 'Folake Bakare - processing', 8456, 5873, 'rejected', '2025-08-01 16:36:54'::timestamp),
  ('Joy Okonkwo - active', 'Adebayo Ogundimu - pending', 'Aisha Bello - rejected', 3282, 5742, 'pending', '2026-03-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: keepalive_configs
INSERT INTO "keepalive_configs" ("service", "keepAliveTimeout", "maxIdlePerHost", "activeConnections", "reuseRate", "status", "created_at") VALUES
  ('Joy Okonkwo - pending', 7175, 6462, 6751, 'Tunde Akinola - approved', 'rejected', '2025-07-04 16:36:54'::timestamp),
  ('Obinna Igwe - active', 2430, 6267, 4934, 'Ngozi Eze - pending', 'approved', '2026-01-11 16:36:54'::timestamp),
  ('Halima Usman - processing', 1912, 8825, 781, 'Khadija Musa - rejected', 'processing', '2025-10-08 16:36:54'::timestamp),
  ('Yusuf Ibrahim - processing', 5331, 5660, 1521, 'Obinna Igwe - processing', 'completed', '2026-03-25 16:36:54'::timestamp),
  ('Victoria Etim - approved', 7348, 5422, 6480, 'Muhammed Lawal - pending', 'pending', '2025-08-17 16:36:54'::timestamp),
  ('Nkechi Nwankwo - approved', 6250, 6004, 3783, 'Khadija Musa - rejected', 'processing', '2025-07-17 16:36:54'::timestamp),
  ('Victoria Etim - rejected', 1987, 9945, 5827, 'Obinna Igwe - processing', 'pending', '2026-03-13 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - completed', 4504, 9855, 4338, 'Chukwuemeka Nwosu - completed', 'pending', '2026-04-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: key_rotation_schedules
INSERT INTO "key_rotation_schedules" ("key_id", "algorithm", "rotation_interval", "grace_period", "active_version", "previous_version", "next_rotation", "rotations_completed", "failed_rotations", "status", "created_at") VALUES
  ('KEY-822757', 'Adebayo Ogundimu - approved', 'Halima Usman - completed', '2026-Q3', 2201, 4686, '2025-11-24 16:36:54'::timestamp, 9002, 696, 'pending', '2025-08-30 16:36:54'::timestamp),
  ('KEY-111645', 'Aisha Bello - processing', 'Folake Bakare - completed', '2026-Q1', 4172, 9359, '2025-08-16 16:36:54'::timestamp, 3752, 735, 'active', '2026-05-07 16:36:54'::timestamp),
  ('KEY-195544', 'Yusuf Ibrahim - active', 'Abdullahi Sani - rejected', '2026-Q2', 9300, 2835, '2025-11-07 16:36:54'::timestamp, 6873, 5189, 'approved', '2025-11-24 16:36:54'::timestamp),
  ('KEY-517981', 'Folake Bakare - rejected', 'Chukwuemeka Nwosu - processing', '2026-Q2', 4601, 7374, '2025-09-04 16:36:54'::timestamp, 2824, 8499, 'pending', '2025-09-04 16:36:54'::timestamp),
  ('KEY-860767', 'Fatima Abdulrahman - rejected', 'Halima Usman - approved', '2026-Q1', 8798, 2970, '2026-01-30 16:36:54'::timestamp, 8443, 8474, 'pending', '2025-08-08 16:36:54'::timestamp),
  ('KEY-219926', 'Khadija Musa - rejected', 'Oluwaseun Adeyemi - pending', '2026-Q2', 8210, 3007, '2025-08-05 16:36:54'::timestamp, 2983, 5914, 'pending', '2025-12-30 16:36:54'::timestamp),
  ('KEY-188439', 'Suleiman Abubakar - processing', 'Blessing Okoro - active', '2026-Q2', 3624, 1013, '2025-10-12 16:36:54'::timestamp, 445, 5181, 'approved', '2025-10-22 16:36:54'::timestamp),
  ('KEY-540115', 'Victoria Etim - active', 'Chioma Nnamdi - pending', '2026-Q3', 3296, 4668, '2025-07-21 16:36:54'::timestamp, 8930, 2886, 'completed', '2025-06-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kms_keys
INSERT INTO "kms_keys" ("provider", "key_id", "algorithm", "usage", "state", "rotation_enabled", "encryption_ops_24h", "status", "created_at") VALUES
  ('Blessing Okoro - active', 'KEY-647930', 'Hauwa Yusuf - active', 'Yusuf Ibrahim - active', 'Lagos', false, 5289, 'approved', '2025-07-21 16:36:54'::timestamp),
  ('Folake Bakare - pending', 'KEY-433122', 'Ifeanyi Obi - pending', 'Nkechi Nwankwo - completed', 'Oyo', false, 7201, 'rejected', '2026-02-02 16:36:54'::timestamp),
  ('Muhammed Lawal - active', 'KEY-342168', 'Chukwuemeka Nwosu - active', 'Folake Bakare - active', 'Kano', false, 8487, 'completed', '2026-04-06 16:36:54'::timestamp),
  ('Fatima Abdulrahman - pending', 'KEY-673665', 'Kabiru Aliyu - pending', 'Musa Danjuma - processing', 'Anambra', false, 8824, 'approved', '2025-12-06 16:36:54'::timestamp),
  ('Segun Oladipo - rejected', 'KEY-649544', 'Suleiman Abubakar - pending', 'Blessing Okoro - rejected', 'Lagos', true, 5606, 'pending', '2026-02-22 16:36:54'::timestamp),
  ('Halima Usman - processing', 'KEY-859004', 'Joy Okonkwo - pending', 'Rasheed Olanrewaju - approved', 'Rivers', false, 393, 'approved', '2026-02-07 16:36:54'::timestamp),
  ('Aisha Bello - rejected', 'KEY-570752', 'Adebayo Ogundimu - processing', 'Victoria Etim - processing', 'Abuja', true, 4875, 'processing', '2025-08-28 16:36:54'::timestamp),
  ('Hauwa Yusuf - active', 'KEY-203982', 'Hauwa Yusuf - processing', 'Babajide Williams - approved', 'Abuja', false, 9399, 'active', '2026-02-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kycVerifications
INSERT INTO "kycVerifications" ("verificationId", "customerId", "tenantId", "verificationType", "documentReference", "provider", "providerResponse", "matchScore", "status", "verifiedAt", "expiresAt", "createdAt") VALUES
  ('VERI-398136', 'CUST-384055', 'TENA-458269', 'corporate', 'REF-709153', 'Rasheed Olanrewaju - active', '{}'::jsonb, 8536.36, 'pending', '2025-12-06 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp),
  ('VERI-248900', 'CUST-831732', 'TENA-639795', 'enterprise', 'REF-472969', 'Tunde Akinola - approved', '{}'::jsonb, 928.86, 'active', '2026-03-03 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp, '2026-04-14 16:36:54'::timestamp),
  ('VERI-458304', 'CUST-952648', 'TENA-333790', 'enterprise', 'REF-119899', 'Halima Usman - approved', '{}'::jsonb, 1765.62, 'approved', '2025-07-14 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('VERI-609701', 'CUST-823745', 'TENA-553909', 'standard', 'REF-502489', 'Emmanuel Ogbonna - completed', '{}'::jsonb, 1027.0, 'processing', '2026-05-04 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp, '2025-09-28 16:36:54'::timestamp),
  ('VERI-578127', 'CUST-438872', 'TENA-790812', 'premium', 'REF-889780', 'Yusuf Ibrahim - approved', '{}'::jsonb, 5718.38, 'approved', '2025-11-09 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp, '2026-03-13 16:36:54'::timestamp),
  ('VERI-424337', 'CUST-745446', 'TENA-754864', 'enterprise', 'REF-201604', 'Fatima Abdulrahman - completed', '{}'::jsonb, 1088.39, 'pending', '2025-06-08 16:36:54'::timestamp, '2025-11-06 16:36:54'::timestamp, '2026-04-16 16:36:54'::timestamp),
  ('VERI-470958', 'CUST-475774', 'TENA-113099', 'basic', 'REF-636388', 'Yusuf Ibrahim - processing', '{}'::jsonb, 4668.99, 'pending', '2026-03-11 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp, '2026-04-10 16:36:54'::timestamp),
  ('VERI-632325', 'CUST-308755', 'TENA-125861', 'micro', 'REF-428454', 'Fatima Abdulrahman - rejected', '{}'::jsonb, 1145.86, 'approved', '2026-03-04 16:36:54'::timestamp, '2025-12-20 16:36:54'::timestamp, '2026-05-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kyc_data_quality_metrics
INSERT INTO "kyc_data_quality_metrics" ("total_customers", "kyc_complete", "kyc_complete_pct", "expired_documents", "duplicate_bvn", "missing_nin", "snapshot_date") VALUES
  (12534573, 3432, 6211.11, 7788, 5898, 4594, '2026-02-14 16:36:54'::timestamp),
  (45950786, 2353, 6782.44, 7930, 4243, 4368, '2026-05-10 16:36:54'::timestamp),
  (17649582, 9506, 20.18, 1235, 8182, 6440, '2025-10-05 16:36:54'::timestamp),
  (33400941, 3210, 2541.29, 4026, 7128, 2954, '2025-09-20 16:36:54'::timestamp),
  (2151843, 7411, 9594.54, 1297, 8255, 3762, '2025-09-01 16:36:54'::timestamp),
  (17343733, 7948, 3899.34, 6828, 5978, 1308, '2025-07-20 16:36:54'::timestamp),
  (20610038, 423, 4397.97, 9437, 1280, 4443, '2026-04-01 16:36:54'::timestamp),
  (37698845, 6176, 4365.17, 521, 7440, 8102, '2025-12-31 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kyc_tier_history
INSERT INTO "kyc_tier_history" ("customer_id", "previous_tier", "new_tier", "reason", "changed_by", "created_at") VALUES
  ('CUST-119284', 3058, 2570, 'Processed for Blessing Okoro in Oyo - pending', 'Nkechi Nwankwo - pending', '2026-03-19 16:36:54'::timestamp),
  ('CUST-313517', 1770, 2520, 'Processed for Folake Bakare in Abuja - processing', 'Amina Garba - approved', '2025-09-16 16:36:54'::timestamp),
  ('CUST-488396', 2631, 8592, 'Processed for Fatima Abdulrahman in Lagos - approved', 'Chidinma Okafor - processing', '2026-03-23 16:36:54'::timestamp),
  ('CUST-609629', 7569, 9707, 'Processed for Chukwuemeka Nwosu in Kano - rejected', 'Joy Okonkwo - processing', '2025-10-07 16:36:54'::timestamp),
  ('CUST-742485', 302, 5967, 'Processed for Joy Okonkwo in Delta - rejected', 'Chukwuemeka Nwosu - rejected', '2025-05-22 16:36:54'::timestamp),
  ('CUST-395760', 7616, 9929, 'Processed for Kabiru Aliyu in Rivers - approved', 'Kabiru Aliyu - pending', '2025-08-31 16:36:54'::timestamp),
  ('CUST-186093', 8811, 2810, 'Processed for Obinna Igwe in Kaduna - approved', 'Ifeanyi Obi - rejected', '2026-03-05 16:36:54'::timestamp),
  ('CUST-881723', 8401, 3439, 'Processed for Hauwa Yusuf in Oyo - rejected', 'Abdullahi Sani - completed', '2025-12-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: kyc_tiers
INSERT INTO "kyc_tiers" ("customer_id", "customer_name", "current_tier", "daily_limit_ngn", "daily_used_ngn", "evaluation_score", "risk_flags", "status", "last_evaluated_at", "created_at", "updated_at") VALUES
  ('CUST-138333', 'Folake Bakare', 3544, 2916.15, 1737.93, 721.82, '{}'::jsonb, 'completed', '2025-08-09 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp, '2025-09-20 16:36:54'::timestamp),
  ('CUST-532584', 'Hauwa Yusuf', 7062, 5960.68, 2024.44, 8816.81, '{}'::jsonb, 'approved', '2026-01-27 16:36:54'::timestamp, '2025-06-03 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp),
  ('CUST-960188', 'Chioma Nnamdi', 5679, 5808.08, 90.48, 9553.31, '{}'::jsonb, 'rejected', '2026-03-31 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp, '2025-08-09 16:36:54'::timestamp),
  ('CUST-542847', 'Khadija Musa', 5487, 6944.24, 7757.11, 1894.62, '{}'::jsonb, 'approved', '2026-05-08 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp, '2025-05-16 16:36:54'::timestamp),
  ('CUST-726764', 'Musa Danjuma', 8817, 6145.07, 6076.96, 1010.7, '{}'::jsonb, 'rejected', '2025-08-28 16:36:54'::timestamp, '2026-02-20 16:36:54'::timestamp, '2025-11-06 16:36:54'::timestamp),
  ('CUST-815591', 'Aisha Bello', 4203, 8.13, 526.72, 4059.52, '{}'::jsonb, 'approved', '2025-12-12 16:36:54'::timestamp, '2026-02-05 16:36:54'::timestamp, '2026-01-08 16:36:54'::timestamp),
  ('CUST-628840', 'Suleiman Abubakar', 3968, 2012.62, 319.43, 1214.01, '{}'::jsonb, 'approved', '2025-10-09 16:36:54'::timestamp, '2025-07-22 16:36:54'::timestamp, '2025-11-03 16:36:54'::timestamp),
  ('CUST-881828', 'Amina Garba', 1958, 4513.23, 2025.04, 1991.48, '{}'::jsonb, 'approved', '2025-10-15 16:36:54'::timestamp, '2025-09-14 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: lendingGroups
INSERT INTO "lendingGroups" ("groupId", "tenantId", "name", "purpose", "groupLeaderId", "groupLeaderName", "maxMembers", "liabilityType", "status", "createdAt", "updatedAt") VALUES
  ('GROU-657899', 'TENA-154034', 'Abdullahi Sani', 'Processed for Chidinma Okafor in Delta - active', 'GROU-499977', 'Kabiru Aliyu - approved', 3832, 'enterprise', 'active', '2025-06-14 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp),
  ('GROU-274849', 'TENA-114905', 'Amina Garba', 'Processed for Suleiman Abubakar in Kano - active', 'GROU-274815', 'Abdullahi Sani - completed', 4653, 'enterprise', 'active', '2026-03-10 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp),
  ('GROU-584408', 'TENA-458655', 'Joy Okonkwo', 'Processed for Segun Oladipo in Kaduna - processing', 'GROU-457503', 'Yusuf Ibrahim - completed', 5990, 'basic', 'processing', '2025-09-03 16:36:54'::timestamp, '2025-07-15 16:36:54'::timestamp),
  ('GROU-574859', 'TENA-449484', 'Blessing Okoro', 'Processed for Joy Okonkwo in Abuja - pending', 'GROU-967917', 'Abdullahi Sani - approved', 9707, 'enterprise', 'completed', '2026-03-18 16:36:54'::timestamp, '2025-10-31 16:36:54'::timestamp),
  ('GROU-452084', 'TENA-928382', 'Victoria Etim', 'Processed for Hauwa Yusuf in Lagos - rejected', 'GROU-281810', 'Chidinma Okafor - pending', 1217, 'enterprise', 'active', '2026-02-13 16:36:54'::timestamp, '2026-01-16 16:36:54'::timestamp),
  ('GROU-153194', 'TENA-886393', 'Grace Adeniyi', 'Processed for Babajide Williams in Delta - completed', 'GROU-134479', 'Grace Adeniyi - active', 9964, 'basic', 'pending', '2025-08-02 16:36:54'::timestamp, '2026-04-23 16:36:54'::timestamp),
  ('GROU-731304', 'TENA-233951', 'Babajide Williams', 'Processed for Folake Bakare in Enugu - processing', 'GROU-480179', 'Chukwuemeka Nwosu - pending', 5632, 'enterprise', 'approved', '2025-11-30 16:36:54'::timestamp, '2026-02-03 16:36:54'::timestamp),
  ('GROU-163118', 'TENA-872787', 'Ngozi Eze', 'Processed for Ngozi Eze in Delta - active', 'GROU-911659', 'Kabiru Aliyu - rejected', 5440, 'basic', 'completed', '2025-06-14 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: lettersOfCredit
INSERT INTO "lettersOfCredit" ("lcId", "tenantId", "lcType", "applicantId", "applicantName", "beneficiaryName", "beneficiaryBank", "beneficiaryCountry", "issuingBank", "advisingBank", "amount", "currency", "commodity", "incoterm", "portOfLoading", "portOfDischarge", "latestShipDate", "expiryDate", "documentsRequired", "amendments", "status", "createdAt", "updatedAt") VALUES
  ('LC-130632', 'TENA-632857', 'basic', 'APPL-947028', 'Grace Adeniyi', 'Grace Adeniyi - rejected', 'Khadija Musa - processing', 'Halima Usman - processing', 'Folake Bakare - completed', 'Muhammed Lawal - completed', 508526.74, 'NGN', 'Abdullahi Sani - active', 'Obinna Igwe - rejected', 'Oluwaseun Adeyemi - pending', 'Fatima Abdulrahman - pending', 'Muhammed Lawal - processing', 'Zainab Mohammed - completed', '{}'::jsonb, '{}'::jsonb, 'active', '2025-06-17 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp),
  ('LC-570637', 'TENA-986879', 'corporate', 'APPL-649839', 'Chidinma Okafor', 'Fatima Abdulrahman - rejected', 'Amina Garba - rejected', 'Chidinma Okafor - pending', 'Hauwa Yusuf - approved', 'Fatima Abdulrahman - approved', 30786847.32, 'EUR', 'Chioma Nnamdi - rejected', 'Ifeanyi Obi - approved', 'Obinna Igwe - pending', 'Zainab Mohammed - rejected', 'Victoria Etim - pending', 'Amina Garba - completed', '{}'::jsonb, '{}'::jsonb, 'rejected', '2025-11-10 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp),
  ('LC-808396', 'TENA-726020', 'standard', 'APPL-241835', 'Chioma Nnamdi', 'Tunde Akinola - active', 'Emmanuel Ogbonna - pending', 'Suleiman Abubakar - pending', 'Chukwuemeka Nwosu - approved', 'Amina Garba - rejected', 26286717.47, 'NGN', 'Muhammed Lawal - processing', 'Musa Danjuma - processing', 'Victoria Etim - completed', 'Emmanuel Ogbonna - active', 'Chukwuemeka Nwosu - approved', 'Chukwuemeka Nwosu - processing', '{}'::jsonb, '{}'::jsonb, 'processing', '2025-10-08 16:36:54'::timestamp, '2025-11-11 16:36:54'::timestamp),
  ('LC-548774', 'TENA-172996', 'corporate', 'APPL-213668', 'Khadija Musa', 'Suleiman Abubakar - completed', 'Emmanuel Ogbonna - active', 'Tunde Akinola - approved', 'Chukwuemeka Nwosu - active', 'Kabiru Aliyu - pending', 48016141.09, 'NGN', 'Obinna Igwe - pending', 'Grace Adeniyi - active', 'Babajide Williams - active', 'Chidinma Okafor - processing', 'Chioma Nnamdi - active', 'Hauwa Yusuf - approved', '{}'::jsonb, '{}'::jsonb, 'completed', '2025-08-19 16:36:54'::timestamp, '2025-10-27 16:36:54'::timestamp),
  ('LC-789409', 'TENA-783668', 'micro', 'APPL-229696', 'Chukwuemeka Nwosu', 'Muhammed Lawal - pending', 'Suleiman Abubakar - rejected', 'Abdullahi Sani - pending', 'Nkechi Nwankwo - active', 'Abdullahi Sani - rejected', 46767981.16, 'NGN', 'Joy Okonkwo - completed', 'Halima Usman - approved', 'Ifeanyi Obi - pending', 'Blessing Okoro - pending', 'Rasheed Olanrewaju - processing', 'Aisha Bello - completed', '{}'::jsonb, '{}'::jsonb, 'pending', '2025-07-13 16:36:54'::timestamp, '2025-06-30 16:36:54'::timestamp),
  ('LC-679809', 'TENA-805476', 'enterprise', 'APPL-425862', 'Chidinma Okafor', 'Folake Bakare - pending', 'Hauwa Yusuf - processing', 'Segun Oladipo - pending', 'Chidinma Okafor - processing', 'Abdullahi Sani - completed', 22591293.74, 'NGN', 'Kabiru Aliyu - pending', 'Babajide Williams - pending', 'Obinna Igwe - processing', 'Khadija Musa - completed', 'Kabiru Aliyu - pending', 'Ifeanyi Obi - rejected', '{}'::jsonb, '{}'::jsonb, 'completed', '2025-11-10 16:36:54'::timestamp, '2026-01-16 16:36:54'::timestamp),
  ('LC-442138', 'TENA-425066', 'micro', 'APPL-928413', 'Kabiru Aliyu', 'Chioma Nnamdi - completed', 'Ngozi Eze - approved', 'Nkechi Nwankwo - rejected', 'Khadija Musa - processing', 'Abdullahi Sani - rejected', 1807766.32, 'GBP', 'Ifeanyi Obi - processing', 'Zainab Mohammed - completed', 'Halima Usman - processing', 'Joy Okonkwo - completed', 'Chukwuemeka Nwosu - pending', 'Nkechi Nwankwo - approved', '{}'::jsonb, '{}'::jsonb, 'active', '2026-01-07 16:36:54'::timestamp, '2025-09-19 16:36:54'::timestamp),
  ('LC-765514', 'TENA-862724', 'corporate', 'APPL-107457', 'Victoria Etim', 'Babajide Williams - completed', 'Chukwuemeka Nwosu - completed', 'Nkechi Nwankwo - pending', 'Zainab Mohammed - pending', 'Hauwa Yusuf - pending', 5593260.88, 'EUR', 'Nkechi Nwankwo - active', 'Tunde Akinola - active', 'Folake Bakare - active', 'Tunde Akinola - pending', 'Ngozi Eze - active', 'Suleiman Abubakar - rejected', '{}'::jsonb, '{}'::jsonb, 'active', '2026-04-19 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: livestock_finance
INSERT INTO "livestock_finance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-956386', 'RECO-606805', 'Aisha Bello', 'enterprise', 'Processed for Kabiru Aliyu in Rivers - approved', 'rejected', 45234691.24, 'Lagos', 'REF-540264', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-20 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('TENA-427642', 'RECO-960939', 'Babajide Williams', 'corporate', 'Processed for Musa Danjuma in Lagos - completed', 'pending', 46821486.61, 'Kaduna', 'REF-382751', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-01 16:36:54'::timestamp, '2025-10-12 16:36:54'::timestamp),
  ('TENA-287126', 'RECO-246673', 'Ifeanyi Obi', 'enterprise', 'Processed for Fatima Abdulrahman in Enugu - processing', 'processing', 37081507.72, 'Delta', 'REF-314326', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-23 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp),
  ('TENA-702704', 'RECO-425034', 'Grace Adeniyi', 'micro', 'Processed for Suleiman Abubakar in Enugu - active', 'pending', 29556336.45, 'Ogun', 'REF-917542', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-21 16:36:54'::timestamp, '2026-03-31 16:36:54'::timestamp),
  ('TENA-794511', 'RECO-910757', 'Abdullahi Sani', 'premium', 'Processed for Chidinma Okafor in Anambra - approved', 'processing', 27186290.8, 'Rivers', 'REF-376262', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-12 16:36:54'::timestamp, '2025-10-03 16:36:54'::timestamp),
  ('TENA-367940', 'RECO-422473', 'Zainab Mohammed', 'enterprise', 'Processed for Chidinma Okafor in Oyo - approved', 'rejected', 10215337.2, 'Enugu', 'REF-650021', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-03 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp),
  ('TENA-822041', 'RECO-372957', 'Joy Okonkwo', 'corporate', 'Processed for Halima Usman in Oyo - active', 'pending', 38220689.36, 'Ogun', 'REF-303324', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-21 16:36:54'::timestamp, '2026-01-03 16:36:54'::timestamp),
  ('TENA-852067', 'RECO-443598', 'Suleiman Abubakar', 'micro', 'Processed for Tunde Akinola in Ogun - completed', 'rejected', 203578.52, 'Delta', 'REF-347488', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-30 16:36:54'::timestamp, '2026-03-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: livestock_insurance
INSERT INTO "livestock_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-815524', 'RECO-303659', 'Ngozi Eze', 'corporate', 'Processed for Ifeanyi Obi in Anambra - rejected', 'approved', 40214300.97, 'Kaduna', 'REF-447060', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-26 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp),
  ('TENA-709201', 'RECO-387457', 'Victoria Etim', 'premium', 'Processed for Joy Okonkwo in Kano - rejected', 'completed', 42377129.06, 'Kano', 'REF-930118', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-21 16:36:54'::timestamp, '2025-12-23 16:36:54'::timestamp),
  ('TENA-446869', 'RECO-742883', 'Tunde Akinola', 'standard', 'Processed for Amina Garba in Kaduna - approved', 'approved', 376549.09, 'Lagos', 'REF-495079', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-04 16:36:54'::timestamp, '2026-03-01 16:36:54'::timestamp),
  ('TENA-781827', 'RECO-200056', 'Zainab Mohammed', 'basic', 'Processed for Abdullahi Sani in Enugu - active', 'rejected', 40397849.81, 'Oyo', 'REF-461341', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-27 16:36:54'::timestamp, '2025-06-06 16:36:54'::timestamp),
  ('TENA-597885', 'RECO-814342', 'Kabiru Aliyu', 'basic', 'Processed for Adebayo Ogundimu in Abuja - processing', 'active', 22123567.18, 'Delta', 'REF-877450', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-12 16:36:54'::timestamp, '2026-02-13 16:36:54'::timestamp),
  ('TENA-542783', 'RECO-906498', 'Obinna Igwe', 'basic', 'Processed for Oluwaseun Adeyemi in Kano - approved', 'processing', 42375182.06, 'Enugu', 'REF-554235', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-26 16:36:54'::timestamp, '2025-10-08 16:36:54'::timestamp),
  ('TENA-899159', 'RECO-518711', 'Babajide Williams', 'enterprise', 'Processed for Amina Garba in Abuja - rejected', 'approved', 5373620.13, 'Kano', 'REF-965720', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-10 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp),
  ('TENA-234850', 'RECO-219392', 'Obinna Igwe', 'corporate', 'Processed for Musa Danjuma in Kano - active', 'pending', 41328514.91, 'Enugu', 'REF-290573', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-17 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: livestock_management
INSERT INTO "livestock_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-701554', 'RECO-615405', 'Chukwuemeka Nwosu', 'corporate', 'Processed for Tunde Akinola in Abuja - processing', 'active', 11971389.11, 'Kaduna', 'REF-133629', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-21 16:36:54'::timestamp, '2026-02-08 16:36:54'::timestamp),
  ('TENA-253526', 'RECO-540798', 'Chioma Nnamdi', 'enterprise', 'Processed for Blessing Okoro in Rivers - rejected', 'pending', 44723734.75, 'Lagos', 'REF-407184', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-11 16:36:54'::timestamp, '2025-07-16 16:36:54'::timestamp),
  ('TENA-684884', 'RECO-281524', 'Musa Danjuma', 'micro', 'Processed for Victoria Etim in Rivers - pending', 'completed', 15435994.44, 'Rivers', 'REF-367720', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-19 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp),
  ('TENA-652071', 'RECO-916403', 'Aisha Bello', 'corporate', 'Processed for Zainab Mohammed in Abuja - pending', 'pending', 5987567.95, 'Oyo', 'REF-623563', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-29 16:36:54'::timestamp, '2026-03-31 16:36:54'::timestamp),
  ('TENA-163561', 'RECO-701156', 'Joy Okonkwo', 'enterprise', 'Processed for Chioma Nnamdi in Kaduna - completed', 'active', 32470658.93, 'Oyo', 'REF-807472', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-09 16:36:54'::timestamp, '2025-09-23 16:36:54'::timestamp),
  ('TENA-770453', 'RECO-128882', 'Fatima Abdulrahman', 'premium', 'Processed for Aisha Bello in Delta - processing', 'rejected', 22074366.59, 'Enugu', 'REF-857274', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-29 16:36:54'::timestamp, '2026-01-13 16:36:54'::timestamp),
  ('TENA-525371', 'RECO-183992', 'Fatima Abdulrahman', 'micro', 'Processed for Musa Danjuma in Kano - active', 'completed', 21423922.86, 'Anambra', 'REF-728674', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-13 16:36:54'::timestamp, '2025-07-01 16:36:54'::timestamp),
  ('TENA-886496', 'RECO-925180', 'Adebayo Ogundimu', 'corporate', 'Processed for Joy Okonkwo in Oyo - processing', 'completed', 5409136.34, 'Kaduna', 'REF-323400', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-17 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: loanRepayments
INSERT INTO "loanRepayments" ("repaymentId", "loanId", "tenantId", "principalPortion", "interestPortion", "penaltyPortion", "totalAmount", "dueDate", "paidDate", "status", "transactionRef", "createdAt") VALUES
  ('REPA-955731', 'LOAN-188571', 'TENA-425904', 4519.61, 7722.01, 8440.89, 28056711.02, '2025-12-20 16:36:54'::timestamp, '2026-04-16 16:36:54'::timestamp, 'pending', 'reject', '2026-04-09 16:36:54'::timestamp),
  ('REPA-584400', 'LOAN-324830', 'TENA-808751', 7945.38, 8138.51, 9954.38, 7370719.67, '2025-12-30 16:36:54'::timestamp, '2026-05-09 16:36:54'::timestamp, 'pending', 'transfer', '2026-03-15 16:36:54'::timestamp),
  ('REPA-969070', 'LOAN-574250', 'TENA-145254', 6229.02, 7733.54, 6405.48, 37646031.22, '2026-03-04 16:36:54'::timestamp, '2026-01-13 16:36:54'::timestamp, 'processing', 'reject', '2026-03-08 16:36:54'::timestamp),
  ('REPA-423179', 'LOAN-838410', 'TENA-783164', 2694.5, 4804.21, 9284.09, 6852783.5, '2025-06-04 16:36:54'::timestamp, '2025-08-27 16:36:54'::timestamp, 'completed', 'update', '2025-11-07 16:36:54'::timestamp),
  ('REPA-977527', 'LOAN-124559', 'TENA-263761', 7684.02, 6163.06, 2375.06, 5159401.43, '2026-05-01 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp, 'pending', 'create', '2026-04-07 16:36:54'::timestamp),
  ('REPA-580168', 'LOAN-809818', 'TENA-471553', 4266.03, 9854.07, 3304.03, 7394066.18, '2026-03-15 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp, 'completed', 'approve', '2025-05-12 16:36:54'::timestamp),
  ('REPA-284586', 'LOAN-759390', 'TENA-689031', 2333.15, 4247.92, 1585.61, 47035426.83, '2025-10-04 16:36:54'::timestamp, '2025-06-09 16:36:54'::timestamp, 'approved', 'verify', '2025-05-15 16:36:54'::timestamp),
  ('REPA-757231', 'LOAN-808376', 'TENA-412259', 5906.69, 1946.77, 5503.49, 6321119.9, '2025-06-30 16:36:54'::timestamp, '2025-06-22 16:36:54'::timestamp, 'pending', 'transfer', '2026-01-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: loans
INSERT INTO "loans" ("loanId", "customerId", "tenantId", "loanType", "principalAmount", "outstandingBalance", "interestRate", "currency", "tenor", "tenorUnit", "disbursementDate", "maturityDate", "nextPaymentDate", "nextPaymentAmount", "status", "classificationIFRS9", "collateralValue", "approvedBy", "createdAt", "updatedAt") VALUES
  ('LOAN-143879', 'CUST-741205', 'TENA-701243', 'basic', 15374165.22, 4575967.78, 3.0105, 'USD', 7426, 'Tunde Akinola - approved', '2025-12-29 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp, 41631807.13, 'approved', 'Victoria Etim - processing', 25221992.77, 'Oluwaseun Adeyemi - processing', '2025-11-09 16:36:54'::timestamp, '2025-05-29 16:36:54'::timestamp),
  ('LOAN-354336', 'CUST-994429', 'TENA-967667', 'corporate', 7870823.24, 37147773.72, 15.3033, 'GBP', 3654, 'Joy Okonkwo - completed', '2025-11-14 16:36:54'::timestamp, '2025-07-30 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp, 34670427.0, 'approved', 'Hauwa Yusuf - approved', 18977148.46, 'Fatima Abdulrahman - processing', '2025-10-17 16:36:54'::timestamp, '2025-12-07 16:36:54'::timestamp),
  ('LOAN-987143', 'CUST-701387', 'TENA-664501', 'basic', 14863409.77, 32085206.36, 13.355, 'GBP', 9803, 'Fatima Abdulrahman - active', '2026-03-18 16:36:54'::timestamp, '2025-08-24 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp, 40010901.4, 'completed', 'Chioma Nnamdi - completed', 43591487.59, 'Folake Bakare - pending', '2026-03-09 16:36:54'::timestamp, '2026-04-17 16:36:54'::timestamp),
  ('LOAN-268653', 'CUST-141255', 'TENA-329922', 'standard', 37352761.03, 863877.42, 23.1728, 'USD', 1202, 'Rasheed Olanrewaju - approved', '2025-08-16 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp, 29779409.11, 'processing', 'Hauwa Yusuf - processing', 45460100.51, 'Halima Usman - completed', '2025-12-05 16:36:54'::timestamp, '2025-10-28 16:36:54'::timestamp),
  ('LOAN-262006', 'CUST-914702', 'TENA-101055', 'premium', 9031496.26, 46593476.08, 19.4531, 'EUR', 6, 'Obinna Igwe - processing', '2025-08-20 16:36:54'::timestamp, '2025-09-14 16:36:54'::timestamp, '2025-12-06 16:36:54'::timestamp, 1332247.66, 'processing', 'Folake Bakare - pending', 45246549.71, 'Chioma Nnamdi - rejected', '2025-07-06 16:36:54'::timestamp, '2025-12-30 16:36:54'::timestamp),
  ('LOAN-541868', 'CUST-459681', 'TENA-550875', 'basic', 43673279.68, 42785763.37, 9.3981, 'USD', 4415, 'Chidinma Okafor - active', '2025-09-08 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp, '2025-08-05 16:36:54'::timestamp, 17644915.19, 'processing', 'Halima Usman - completed', 19684405.86, 'Chidinma Okafor - rejected', '2025-07-28 16:36:54'::timestamp, '2026-02-10 16:36:54'::timestamp),
  ('LOAN-991071', 'CUST-613488', 'TENA-272563', 'premium', 43953041.76, 36156450.96, 1.9448, 'GBP', 5571, 'Zainab Mohammed - pending', '2025-09-16 16:36:54'::timestamp, '2026-04-18 16:36:54'::timestamp, '2025-11-25 16:36:54'::timestamp, 41729414.38, 'completed', 'Ifeanyi Obi - processing', 36690428.48, 'Ifeanyi Obi - approved', '2025-09-16 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  ('LOAN-106314', 'CUST-108676', 'TENA-209353', 'standard', 1104924.67, 8096692.22, 13.836, 'NGN', 7526, 'Joy Okonkwo - completed', '2025-09-23 16:36:54'::timestamp, '2025-05-21 16:36:54'::timestamp, '2026-04-25 16:36:54'::timestamp, 45837691.11, 'approved', 'Halima Usman - pending', 24965155.9, 'Chioma Nnamdi - processing', '2025-11-29 16:36:54'::timestamp, '2025-06-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: materialized_views_perf
INSERT INTO "materialized_views_perf" ("viewName", "refreshIntervalSec", "lastRefreshMs", "rowCount", "autoRefresh", "status", "created_at") VALUES
  ('Kabiru Aliyu - active', 7973, 7558, 112, false, 'completed', '2026-03-14 16:36:54'::timestamp),
  ('Amina Garba - rejected', 1930, 7703, 110, false, 'rejected', '2025-09-16 16:36:54'::timestamp),
  ('Musa Danjuma - active', 4, 5417, 486, true, 'active', '2026-02-27 16:36:54'::timestamp),
  ('Joy Okonkwo - rejected', 9455, 3114, 22, true, 'completed', '2025-12-12 16:36:54'::timestamp),
  ('Folake Bakare - approved', 2427, 5648, 443, true, 'pending', '2026-03-20 16:36:54'::timestamp),
  ('Khadija Musa - rejected', 3654, 3617, 151, false, 'pending', '2025-12-15 16:36:54'::timestamp),
  ('Blessing Okoro - completed', 1600, 9760, 320, false, 'approved', '2026-04-07 16:36:54'::timestamp),
  ('Zainab Mohammed - pending', 9306, 3608, 425, false, 'active', '2026-05-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: memoization_targets
INSERT INTO "memoization_targets" ("component", "rerendersPer60s", "estimatedSavingPct", "recommendation", "status", "created_at") VALUES
  ('Obinna Igwe - processing', 9795, 'Yusuf Ibrahim - active', 'Ifeanyi Obi - processing', 'approved', '2026-02-08 16:36:54'::timestamp),
  ('Aisha Bello - active', 426, 'Grace Adeniyi - pending', 'Tunde Akinola - processing', 'pending', '2025-12-27 16:36:54'::timestamp),
  ('Musa Danjuma - pending', 4802, 'Fatima Abdulrahman - rejected', 'Muhammed Lawal - rejected', 'completed', '2025-07-13 16:36:54'::timestamp),
  ('Adebayo Ogundimu - processing', 4785, 'Fatima Abdulrahman - rejected', 'Segun Oladipo - approved', 'completed', '2025-05-14 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - pending', 365, 'Ngozi Eze - approved', 'Oluwaseun Adeyemi - completed', 'rejected', '2026-02-14 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 4658, 'Chukwuemeka Nwosu - pending', 'Grace Adeniyi - active', 'approved', '2025-10-06 16:36:54'::timestamp),
  ('Ngozi Eze - completed', 3467, 'Victoria Etim - active', 'Suleiman Abubakar - pending', 'rejected', '2026-01-14 16:36:54'::timestamp),
  ('Grace Adeniyi - rejected', 2033, 'Muhammed Lawal - processing', 'Blessing Okoro - processing', 'approved', '2026-01-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: mfa_enrollments
INSERT INTO "mfa_enrollments" ("enrollment_id", "customer_id", "methods", "primary_method", "backup_method", "status", "risk_level", "channel", "enrolled_at", "last_verified") VALUES
  ('ENRO-839625', 'CUST-588148', 'transfer', 'transfer', 'create', 'processing', 'Babajide Williams - processing', 'Aisha Bello - completed', '2026-02-23 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp),
  ('ENRO-836251', 'CUST-199788', 'reject', 'approve', 'approve', 'active', 'Babajide Williams - active', 'Blessing Okoro - rejected', '2026-03-04 16:36:54'::timestamp, '2025-12-09 16:36:54'::timestamp),
  ('ENRO-278735', 'CUST-590161', 'verify', 'update', 'update', 'completed', 'Blessing Okoro - pending', 'Kabiru Aliyu - completed', '2025-09-12 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp),
  ('ENRO-100184', 'CUST-892699', 'update', 'reject', 'transfer', 'approved', 'Chidinma Okafor - active', 'Grace Adeniyi - approved', '2025-11-07 16:36:54'::timestamp, '2026-04-29 16:36:54'::timestamp),
  ('ENRO-738684', 'CUST-468861', 'approve', 'approve', 'reject', 'pending', 'Obinna Igwe - rejected', 'Blessing Okoro - completed', '2025-05-28 16:36:54'::timestamp, '2025-11-07 16:36:54'::timestamp),
  ('ENRO-205719', 'CUST-546288', 'create', 'transfer', 'reject', 'approved', 'Muhammed Lawal - rejected', 'Tunde Akinola - processing', '2025-10-04 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp),
  ('ENRO-931337', 'CUST-945752', 'reject', 'approve', 'reject', 'completed', 'Yusuf Ibrahim - pending', 'Blessing Okoro - processing', '2025-07-10 16:36:54'::timestamp, '2026-04-25 16:36:54'::timestamp),
  ('ENRO-150151', 'CUST-355126', 'transfer', 'verify', 'reject', 'active', 'Adebayo Ogundimu - rejected', 'Ifeanyi Obi - approved', '2025-07-04 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: mfa_policies
INSERT INTO "mfa_policies" ("policy_id", "name", "transaction_type", "amount_threshold_ngn", "required_factors", "allowed_methods", "status", "created_at") VALUES
  ('POLI-994924', 'Obinna Igwe', 'basic', 8580905.79, 1262, 'transfer', 'active', '2025-08-31 16:36:54'::timestamp),
  ('POLI-522641', 'Chukwuemeka Nwosu', 'enterprise', 29991902.65, 2850, 'update', 'completed', '2025-08-05 16:36:54'::timestamp),
  ('POLI-625021', 'Segun Oladipo', 'enterprise', 2859155.96, 4121, 'approve', 'completed', '2025-05-15 16:36:54'::timestamp),
  ('POLI-190791', 'Suleiman Abubakar', 'micro', 32503085.49, 47, 'transfer', 'processing', '2026-01-03 16:36:54'::timestamp),
  ('POLI-478465', 'Suleiman Abubakar', 'standard', 2839043.21, 162, 'approve', 'pending', '2025-09-21 16:36:54'::timestamp),
  ('POLI-711143', 'Khadija Musa', 'enterprise', 20651299.54, 5128, 'reject', 'active', '2025-06-26 16:36:54'::timestamp),
  ('POLI-114480', 'Fatima Abdulrahman', 'micro', 39693579.47, 5830, 'create', 'approved', '2025-09-02 16:36:54'::timestamp),
  ('POLI-173873', 'Chioma Nnamdi', 'enterprise', 39137713.36, 1327, 'update', 'pending', '2026-04-29 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: mortgageApplications
INSERT INTO "mortgageApplications" ("mortgageId", "tenantId", "applicantId", "applicantName", "propertyValue", "loanAmount", "downPayment", "interestRatePct", "tenorMonths", "mortgageType", "emi", "ltvPct", "ltvGrade", "dtiRatio", "propertyAddress", "propertyType", "status", "disbursedAt", "createdAt", "updatedAt") VALUES
  ('MORT-990664', 'TENA-341511', 'APPL-456055', 'Chidinma Okafor', 32781476.62, 9913007.64, 2996.35, 23.3359, 114, 'corporate', 1488.31, 6087.2, 'A', 16.7838, '65 Adeola Odeku Street, Lagos', 'standard', 'active', '2025-12-09 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp, '2026-04-11 16:36:54'::timestamp),
  ('MORT-757399', 'TENA-898100', 'APPL-909747', 'Ifeanyi Obi', 48416334.46, 9147636.21, 3531.28, 24.3967, 50, 'premium', 3467.05, 2292.24, 'A', 15.9172, '35 Broad Street, Delta', 'premium', 'pending', '2025-12-04 16:36:54'::timestamp, '2026-03-06 16:36:54'::timestamp, '2025-10-10 16:36:54'::timestamp),
  ('MORT-371894', 'TENA-261112', 'APPL-924381', 'Nkechi Nwankwo', 41662306.09, 15178610.29, 4617.54, 9.7763, 201, 'basic', 7101.66, 4539.15, 'C', 14.7774, '85 Adeola Odeku Street, Delta', 'corporate', 'processing', '2026-03-10 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp),
  ('MORT-502965', 'TENA-444267', 'APPL-742920', 'Suleiman Abubakar', 6322551.35, 1100435.67, 2070.87, 19.0038, 220, 'standard', 5158.07, 9197.63, 'B', 6.308, '163 Adeola Odeku Street, Kaduna', 'enterprise', 'completed', '2025-05-19 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp, '2026-01-07 16:36:54'::timestamp),
  ('MORT-700553', 'TENA-619655', 'APPL-837314', 'Victoria Etim', 37405793.69, 2302211.92, 5888.51, 2.9478, 304, 'basic', 7142.74, 7793.86, 'B', 8.1193, '160 Adeola Odeku Street, Enugu', 'corporate', 'pending', '2025-08-03 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp, '2025-07-26 16:36:54'::timestamp),
  ('MORT-283549', 'TENA-956609', 'APPL-527030', 'Muhammed Lawal', 2729830.3, 18178392.25, 2977.11, 13.2912, 352, 'micro', 4784.24, 8393.33, 'A', 9.813, '163 Adeola Odeku Street, Abuja', 'enterprise', 'processing', '2026-05-06 16:36:54'::timestamp, '2025-10-01 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp),
  ('MORT-605825', 'TENA-470481', 'APPL-372156', 'Hauwa Yusuf', 5239445.33, 14147928.43, 2400.88, 20.4931, 311, 'enterprise', 1193.13, 6493.53, 'C', 22.235, '167 Awolowo Road, Kaduna', 'enterprise', 'active', '2025-12-24 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp),
  ('MORT-200400', 'TENA-247477', 'APPL-647776', 'Emmanuel Ogbonna', 11282636.45, 48417050.18, 5770.59, 18.0311, 240, 'micro', 6474.93, 1656.69, 'D', 17.2174, '55 Marina Road, Abuja', 'premium', 'active', '2026-04-17 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp, '2025-09-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: mtls_nodes
INSERT INTO "mtls_nodes" ("service_name", "spiffe_id", "cert_serial", "cert_expiry", "issuer", "peer_connections", "handshakes_24h", "failed_handshakes", "status", "created_at") VALUES
  ('Ifeanyi Obi - pending', 'SPIF-686728', 'Yusuf Ibrahim - processing', '2026-01-21 16:36:54'::timestamp, 'Babajide Williams - active', 7775, 2096, 5477, 'rejected', '2025-09-25 16:36:54'::timestamp),
  ('Halima Usman - rejected', 'SPIF-650796', 'Zainab Mohammed - approved', '2025-11-07 16:36:54'::timestamp, 'Nkechi Nwankwo - active', 9474, 4029, 2914, 'active', '2025-09-06 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 'SPIF-569382', 'Abdullahi Sani - pending', '2026-03-30 16:36:54'::timestamp, 'Emmanuel Ogbonna - rejected', 5659, 9056, 3699, 'rejected', '2025-09-12 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 'SPIF-904757', 'Khadija Musa - processing', '2025-05-23 16:36:54'::timestamp, 'Babajide Williams - active', 7113, 3935, 8366, 'completed', '2025-12-28 16:36:54'::timestamp),
  ('Joy Okonkwo - processing', 'SPIF-909855', 'Babajide Williams - active', '2025-06-11 16:36:54'::timestamp, 'Muhammed Lawal - active', 2402, 3461, 8192, 'rejected', '2026-02-17 16:36:54'::timestamp),
  ('Tunde Akinola - pending', 'SPIF-857789', 'Obinna Igwe - active', '2025-09-30 16:36:54'::timestamp, 'Halima Usman - active', 4328, 3141, 8202, 'pending', '2026-03-20 16:36:54'::timestamp),
  ('Victoria Etim - rejected', 'SPIF-925688', 'Victoria Etim - processing', '2026-05-12 16:36:54'::timestamp, 'Chukwuemeka Nwosu - pending', 3317, 170, 2802, 'pending', '2026-02-16 16:36:54'::timestamp),
  ('Grace Adeniyi - active', 'SPIF-745080', 'Folake Bakare - active', '2026-02-04 16:36:54'::timestamp, 'Adebayo Ogundimu - approved', 5725, 9892, 7064, 'processing', '2025-05-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: mudarabahContracts
INSERT INTO "mudarabahContracts" ("contractId", "tenantId", "investorId", "investorName", "fundManagerId", "investmentPurpose", "capitalAmount", "currency", "profitSharingRatioInvestor", "profitSharingRatioManager", "investmentPeriodMonths", "startDate", "maturityDate", "realizedProfit", "realizedLoss", "distributions", "status", "shariaCompliance", "riskCategory", "createdAt", "updatedAt") VALUES
  ('CONT-228039', 'TENA-489974', 'INVE-357003', 'Nkechi Nwankwo - approved', 'FUND-589144', 'Processed for Kabiru Aliyu in Lagos - approved', 21936491.42, 'NGN', 23.3488, 21.7197, 88, 'Zainab Mohammed - active', 'https://api.54bank.ng/mudarabahContracts/224353', 617.76, 6837.91, '{}'::jsonb, 'processing', 'Grace Adeniyi - processing', 'standard', '2025-11-12 16:36:54'::timestamp, '2026-02-13 16:36:54'::timestamp),
  ('CONT-249957', 'TENA-209265', 'INVE-485255', 'Blessing Okoro - pending', 'FUND-483016', 'Processed for Blessing Okoro in Rivers - rejected', 1254887.27, 'GBP', 18.2968, 4.5256, 123, 'Musa Danjuma - approved', 'https://api.54bank.ng/mudarabahContracts/356683', 2784.27, 6161.78, '{}'::jsonb, 'approved', 'Chioma Nnamdi - active', 'standard', '2026-01-25 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp),
  ('CONT-511769', 'TENA-788379', 'INVE-131820', 'Zainab Mohammed - rejected', 'FUND-630710', 'Processed for Chioma Nnamdi in Kaduna - approved', 1712572.5, 'EUR', 1.7244, 4.4686, 251, 'Rasheed Olanrewaju - rejected', 'https://api.54bank.ng/mudarabahContracts/830029', 9180.32, 2525.24, '{}'::jsonb, 'rejected', 'Babajide Williams - approved', 'micro', '2025-10-10 16:36:54'::timestamp, '2025-06-11 16:36:54'::timestamp),
  ('CONT-675831', 'TENA-662571', 'INVE-612945', 'Oluwaseun Adeyemi - pending', 'FUND-243672', 'Processed for Fatima Abdulrahman in Rivers - processing', 42322133.45, 'GBP', 20.4015, 1.6962, 12, 'Joy Okonkwo - active', 'https://api.54bank.ng/mudarabahContracts/729459', 3444.96, 4519.05, '{}'::jsonb, 'pending', 'Hauwa Yusuf - active', 'premium', '2025-07-01 16:36:54'::timestamp, '2025-05-31 16:36:54'::timestamp),
  ('CONT-226410', 'TENA-960864', 'INVE-789737', 'Segun Oladipo - completed', 'FUND-166292', 'Processed for Ifeanyi Obi in Oyo - rejected', 25047556.38, 'USD', 12.0429, 14.967, 208, 'Babajide Williams - rejected', 'https://api.54bank.ng/mudarabahContracts/156748', 2277.39, 3513.06, '{}'::jsonb, 'processing', 'Adebayo Ogundimu - rejected', 'basic', '2025-06-22 16:36:54'::timestamp, '2025-05-31 16:36:54'::timestamp),
  ('CONT-427145', 'TENA-787857', 'INVE-387648', 'Hauwa Yusuf - completed', 'FUND-423439', 'Processed for Joy Okonkwo in Kano - pending', 43638202.16, 'GBP', 21.9749, 10.0698, 160, 'Grace Adeniyi - active', 'https://api.54bank.ng/mudarabahContracts/199293', 239.85, 9907.74, '{}'::jsonb, 'approved', 'Oluwaseun Adeyemi - completed', 'basic', '2026-01-20 16:36:54'::timestamp, '2025-08-23 16:36:54'::timestamp),
  ('CONT-175132', 'TENA-718403', 'INVE-511399', 'Rasheed Olanrewaju - active', 'FUND-417158', 'Processed for Amina Garba in Kaduna - rejected', 27593846.1, 'EUR', 7.8089, 14.3022, 57, 'Amina Garba - active', 'https://api.54bank.ng/mudarabahContracts/981682', 6350.73, 5498.82, '{}'::jsonb, 'completed', 'Emmanuel Ogbonna - active', 'basic', '2025-11-06 16:36:54'::timestamp, '2025-12-27 16:36:54'::timestamp),
  ('CONT-373950', 'TENA-417605', 'INVE-454817', 'Babajide Williams - approved', 'FUND-562390', 'Processed for Fatima Abdulrahman in Enugu - rejected', 34975839.83, 'GBP', 6.2318, 8.6414, 231, 'Kabiru Aliyu - processing', 'https://api.54bank.ng/mudarabahContracts/993173', 351.67, 6609.89, '{}'::jsonb, 'approved', 'Adebayo Ogundimu - active', 'basic', '2026-01-09 16:36:54'::timestamp, '2025-06-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: multi_peril_crop_insurance
INSERT INTO "multi_peril_crop_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-841251', 'RECO-661743', 'Halima Usman', 'corporate', 'Processed for Ngozi Eze in Abuja - processing', 'rejected', 17485539.31, 'Enugu', 'REF-874828', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-20 16:36:54'::timestamp, '2025-12-23 16:36:54'::timestamp),
  ('TENA-353618', 'RECO-523132', 'Rasheed Olanrewaju', 'basic', 'Processed for Muhammed Lawal in Delta - active', 'pending', 39594201.19, 'Abuja', 'REF-877858', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-16 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp),
  ('TENA-569644', 'RECO-786064', 'Joy Okonkwo', 'enterprise', 'Processed for Obinna Igwe in Rivers - processing', 'processing', 18160966.81, 'Kaduna', 'REF-916580', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-29 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp),
  ('TENA-295103', 'RECO-439774', 'Fatima Abdulrahman', 'standard', 'Processed for Ngozi Eze in Kano - approved', 'rejected', 27995443.26, 'Ogun', 'REF-127165', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-09 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('TENA-141899', 'RECO-784018', 'Ngozi Eze', 'standard', 'Processed for Grace Adeniyi in Delta - active', 'rejected', 10515949.37, 'Oyo', 'REF-319307', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-03 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp),
  ('TENA-313637', 'RECO-860836', 'Nkechi Nwankwo', 'enterprise', 'Processed for Halima Usman in Enugu - completed', 'completed', 36341416.59, 'Lagos', 'REF-148036', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-17 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp),
  ('TENA-355310', 'RECO-367472', 'Muhammed Lawal', 'micro', 'Processed for Obinna Igwe in Anambra - approved', 'rejected', 46444311.84, 'Delta', 'REF-690602', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-25 16:36:54'::timestamp, '2025-11-20 16:36:54'::timestamp),
  ('TENA-967689', 'RECO-245370', 'Kabiru Aliyu', 'corporate', 'Processed for Folake Bakare in Enugu - completed', 'pending', 26117847.46, 'Lagos', 'REF-865306', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-25 16:36:54'::timestamp, '2025-05-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: murabahaContracts
INSERT INTO "murabahaContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "costPrice", "profitMarginPct", "sellingPrice", "currency", "tenorMonths", "instalmentAmount", "totalPaid", "outstandingBalance", "disbursementDate", "maturityDate", "status", "shariaCompliance", "shariaBoardReference", "instalmentSchedule", "createdAt", "updatedAt") VALUES
  ('CONT-561064', 'TENA-136648', 'CUST-721892', 'Hauwa Yusuf', 'Processed for Obinna Igwe in Oyo - pending', 'corporate', 47054998.21, 1070.05, 23042359.38, 'USD', 279, 31062068.16, 6892.68, 20725423.57, 'Segun Oladipo - approved', 'https://api.54bank.ng/murabahaContracts/114409', 'pending', 'Amina Garba - active', 'REF-677019', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-26 16:36:54'::timestamp, '2025-05-27 16:36:54'::timestamp),
  ('CONT-972094', 'TENA-325006', 'CUST-582201', 'Zainab Mohammed', 'Processed for Ngozi Eze in Delta - processing', 'micro', 30530736.88, 7339.82, 9752825.97, 'GBP', 27, 36378266.88, 8141.31, 3006338.53, 'Chioma Nnamdi - pending', 'https://api.54bank.ng/murabahaContracts/430783', 'processing', 'Suleiman Abubakar - active', 'REF-827706', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-09 16:36:54'::timestamp, '2026-02-24 16:36:54'::timestamp),
  ('CONT-420969', 'TENA-852965', 'CUST-721220', 'Yusuf Ibrahim', 'Processed for Muhammed Lawal in Ogun - active', 'basic', 39935449.56, 1440.51, 274011.4, 'GBP', 84, 21144829.49, 1134.9, 30065001.36, 'Babajide Williams - approved', 'https://api.54bank.ng/murabahaContracts/134851', 'active', 'Hauwa Yusuf - rejected', 'REF-881402', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-28 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp),
  ('CONT-679356', 'TENA-327271', 'CUST-112363', 'Hauwa Yusuf', 'Processed for Muhammed Lawal in Oyo - processing', 'micro', 41593066.46, 4139.05, 20757717.44, 'EUR', 105, 7395534.6, 1065.77, 42832307.78, 'Kabiru Aliyu - approved', 'https://api.54bank.ng/murabahaContracts/347903', 'completed', 'Ifeanyi Obi - active', 'REF-676412', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-22 16:36:54'::timestamp, '2025-07-10 16:36:54'::timestamp),
  ('CONT-945681', 'TENA-243093', 'CUST-385548', 'Zainab Mohammed', 'Processed for Yusuf Ibrahim in Anambra - processing', 'standard', 16624011.77, 2221.05, 29391164.17, 'GBP', 312, 23966722.91, 7656.72, 49441000.81, 'Chidinma Okafor - pending', 'https://api.54bank.ng/murabahaContracts/582702', 'rejected', 'Babajide Williams - processing', 'REF-632883', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-07 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp),
  ('CONT-936771', 'TENA-692670', 'CUST-446074', 'Halima Usman', 'Processed for Oluwaseun Adeyemi in Delta - rejected', 'basic', 8471938.42, 275.93, 27462193.74, 'USD', 9, 8780004.53, 2081.57, 28069664.51, 'Kabiru Aliyu - processing', 'https://api.54bank.ng/murabahaContracts/821199', 'approved', 'Obinna Igwe - active', 'REF-161080', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-30 16:36:54'::timestamp, '2025-11-12 16:36:54'::timestamp),
  ('CONT-148489', 'TENA-372443', 'CUST-345883', 'Blessing Okoro', 'Processed for Victoria Etim in Ogun - completed', 'premium', 17261020.64, 9165.46, 12615152.48, 'NGN', 114, 33959186.17, 2098.8, 15643543.2, 'Chioma Nnamdi - approved', 'https://api.54bank.ng/murabahaContracts/953583', 'rejected', 'Babajide Williams - active', 'REF-471639', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-10 16:36:54'::timestamp, '2026-02-08 16:36:54'::timestamp),
  ('CONT-932488', 'TENA-674619', 'CUST-963757', 'Folake Bakare', 'Processed for Fatima Abdulrahman in Rivers - pending', 'enterprise', 36943241.52, 5709.76, 42756102.45, 'GBP', 269, 1304712.43, 2437.46, 28481874.08, 'Ngozi Eze - rejected', 'https://api.54bank.ng/murabahaContracts/775026', 'pending', 'Ifeanyi Obi - processing', 'REF-492262', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-29 16:36:54'::timestamp, '2026-01-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ndpr_records
INSERT INTO "ndpr_records" ("record_type", "subject", "request_type", "response_time_days", "sla_deadline_days", "data_categories", "dpo", "status", "created_at") VALUES
  ('basic', 'Processed for Halima Usman in Delta - active', 'enterprise', 188, 315, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Grace Adeniyi - active', 'rejected', '2026-01-06 16:36:54'::timestamp),
  ('enterprise', 'Processed for Yusuf Ibrahim in Delta - processing', 'corporate', 344, 170, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Segun Oladipo - active', 'pending', '2025-06-07 16:36:54'::timestamp),
  ('standard', 'Processed for Emmanuel Ogbonna in Rivers - processing', 'basic', 22, 146, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Rasheed Olanrewaju - rejected', 'pending', '2025-07-31 16:36:54'::timestamp),
  ('corporate', 'Processed for Yusuf Ibrahim in Enugu - processing', 'micro', 163, 92, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Abdullahi Sani - active', 'pending', '2026-03-07 16:36:54'::timestamp),
  ('enterprise', 'Processed for Fatima Abdulrahman in Ogun - processing', 'micro', 58, 146, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Khadija Musa - rejected', 'rejected', '2026-04-27 16:36:54'::timestamp),
  ('premium', 'Processed for Kabiru Aliyu in Anambra - pending', 'corporate', 102, 357, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Zainab Mohammed - pending', 'rejected', '2025-06-18 16:36:54'::timestamp),
  ('enterprise', 'Processed for Grace Adeniyi in Delta - active', 'premium', 179, 77, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Emmanuel Ogbonna - pending', 'pending', '2026-05-10 16:36:54'::timestamp),
  ('corporate', 'Processed for Fatima Abdulrahman in Kaduna - active', 'corporate', 184, 171, '{"status": "active", "region": "Nigeria"}'::jsonb, 'Kabiru Aliyu - active', 'completed', '2025-09-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: network_policies
INSERT INTO "network_policies" ("name", "namespace", "pod_selector", "ingress_rules", "egress_rules", "applied_pods", "denied_connections_24h", "status", "created_at") VALUES
  ('Grace Adeniyi', 'Amina Garba - rejected', 'Fatima Abdulrahman - processing', '{}'::jsonb, '{}'::jsonb, 1994, 9844, 'completed', '2025-06-12 16:36:54'::timestamp),
  ('Amina Garba', 'Tunde Akinola - active', 'Ngozi Eze - completed', '{}'::jsonb, '{}'::jsonb, 6286, 9519, 'completed', '2026-01-20 16:36:54'::timestamp),
  ('Grace Adeniyi', 'Hauwa Yusuf - pending', 'Aisha Bello - active', '{}'::jsonb, '{}'::jsonb, 499, 9689, 'rejected', '2025-05-25 16:36:54'::timestamp),
  ('Victoria Etim', 'Segun Oladipo - processing', 'Chidinma Okafor - processing', '{}'::jsonb, '{}'::jsonb, 9253, 8476, 'pending', '2025-10-28 16:36:54'::timestamp),
  ('Abdullahi Sani', 'Fatima Abdulrahman - processing', 'Emmanuel Ogbonna - processing', '{}'::jsonb, '{}'::jsonb, 957, 5338, 'active', '2025-07-15 16:36:54'::timestamp),
  ('Halima Usman', 'Nkechi Nwankwo - completed', 'Tunde Akinola - completed', '{}'::jsonb, '{}'::jsonb, 6831, 4389, 'completed', '2026-01-19 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu', 'Chioma Nnamdi - active', 'Adebayo Ogundimu - pending', '{}'::jsonb, '{}'::jsonb, 8503, 1814, 'approved', '2025-07-26 16:36:54'::timestamp),
  ('Musa Danjuma', 'Babajide Williams - processing', 'Chioma Nnamdi - processing', '{}'::jsonb, '{}'::jsonb, 5480, 8898, 'pending', '2026-03-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: nfiu_filings
INSERT INTO "nfiu_filings" ("report_type", "customer_id", "customer_name", "amount_ngn", "transaction_type", "status", "cbn_reference", "sla_deadline", "filed_at", "created_at") VALUES
  ('corporate', 'CUST-197937', 'Muhammed Lawal', 40882560.3, 'enterprise', 'active', 'REF-502550', '2026-05-03 16:36:54'::timestamp, '2026-03-16 16:36:54'::timestamp, '2025-10-08 16:36:54'::timestamp),
  ('premium', 'CUST-197139', 'Emmanuel Ogbonna', 45095066.91, 'premium', 'pending', 'REF-282968', '2025-05-25 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp, '2026-04-25 16:36:54'::timestamp),
  ('enterprise', 'CUST-657677', 'Halima Usman', 9648727.02, 'basic', 'completed', 'REF-946018', '2026-03-25 16:36:54'::timestamp, '2025-09-09 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('basic', 'CUST-179198', 'Zainab Mohammed', 33873050.41, 'premium', 'processing', 'REF-374426', '2025-06-30 16:36:54'::timestamp, '2025-07-08 16:36:54'::timestamp, '2026-01-07 16:36:54'::timestamp),
  ('premium', 'CUST-279335', 'Zainab Mohammed', 28217591.87, 'corporate', 'processing', 'REF-800326', '2025-11-18 16:36:54'::timestamp, '2025-07-12 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp),
  ('corporate', 'CUST-988437', 'Chioma Nnamdi', 35487125.66, 'basic', 'approved', 'REF-287585', '2026-05-01 16:36:54'::timestamp, '2026-04-12 16:36:54'::timestamp, '2025-06-29 16:36:54'::timestamp),
  ('basic', 'CUST-933123', 'Amina Garba', 28576121.57, 'corporate', 'approved', 'REF-513193', '2025-05-19 16:36:54'::timestamp, '2025-10-18 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp),
  ('premium', 'CUST-225799', 'Khadija Musa', 24756311.73, 'enterprise', 'processing', 'REF-681281', '2026-02-22 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: nipTransactions
INSERT INTO "nipTransactions" ("nipId", "tenantId", "sessionId", "direction", "sourceBank", "destinationBank", "sourceAccount", "destinationAccount", "amount", "narration", "responseCode", "status", "completedAt", "createdAt") VALUES
  ('NIP-766315', 'TENA-786028', 'SESS-700405', 'Joy Okonkwo - rejected', 'CBN', 'Zainab Mohammed - processing', 'API', 'Emmanuel Ogbonna - rejected', 26124625.7, 'Aisha Bello - pending', 'CODE-451967', 'completed', '2025-07-07 16:36:54'::timestamp, '2025-08-07 16:36:54'::timestamp),
  ('NIP-821205', 'TENA-562508', 'SESS-244156', 'Zainab Mohammed - rejected', 'CBN', 'Adebayo Ogundimu - processing', 'internal', 'Adebayo Ogundimu - pending', 43595991.47, 'Blessing Okoro - active', 'CODE-346376', 'rejected', '2025-08-12 16:36:54'::timestamp, '2025-10-03 16:36:54'::timestamp),
  ('NIP-165774', 'TENA-226138', 'SESS-198062', 'Hauwa Yusuf - rejected', 'CBN', 'Nkechi Nwankwo - approved', 'internal', 'Khadija Musa - processing', 48041638.41, 'Segun Oladipo - pending', 'CODE-303258', 'active', '2026-03-03 16:36:54'::timestamp, '2025-12-09 16:36:54'::timestamp),
  ('NIP-148401', 'TENA-500672', 'SESS-266392', 'Kabiru Aliyu - approved', 'NFIU', 'Fatima Abdulrahman - active', 'OFAC', 'Aisha Bello - approved', 42750861.17, 'Babajide Williams - pending', 'CODE-170945', 'processing', '2026-02-04 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp),
  ('NIP-144997', 'TENA-303383', 'SESS-663090', 'Folake Bakare - rejected', 'internal', 'Rasheed Olanrewaju - approved', 'NFIU', 'Muhammed Lawal - pending', 41591855.04, 'Hauwa Yusuf - processing', 'CODE-693192', 'rejected', '2025-07-08 16:36:54'::timestamp, '2025-09-26 16:36:54'::timestamp),
  ('NIP-322138', 'TENA-802576', 'SESS-699555', 'Abdullahi Sani - completed', 'OFAC', 'Chidinma Okafor - processing', 'OFAC', 'Fatima Abdulrahman - active', 19541232.99, 'Amina Garba - pending', 'CODE-223229', 'completed', '2025-12-20 16:36:54'::timestamp, '2025-06-16 16:36:54'::timestamp),
  ('NIP-988509', 'TENA-320676', 'SESS-687928', 'Yusuf Ibrahim - approved', 'NFIU', 'Fatima Abdulrahman - approved', 'API', 'Adebayo Ogundimu - rejected', 6144701.48, 'Musa Danjuma - approved', 'CODE-971334', 'processing', '2026-03-05 16:36:54'::timestamp, '2025-06-19 16:36:54'::timestamp),
  ('NIP-452877', 'TENA-715894', 'SESS-471549', 'Blessing Okoro - approved', 'OFAC', 'Muhammed Lawal - pending', 'OFAC', 'Nkechi Nwankwo - pending', 35051476.07, 'Halima Usman - approved', 'CODE-181509', 'rejected', '2025-06-13 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: nirsal_agro_geocoop
INSERT INTO "nirsal_agro_geocoop" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-801347', 'RECO-200113', 'Chidinma Okafor', 'basic', 'Processed for Grace Adeniyi in Kano - pending', 'rejected', 10858495.19, 'Oyo', 'REF-441172', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-17 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp),
  ('TENA-826962', 'RECO-996492', 'Grace Adeniyi', 'premium', 'Processed for Yusuf Ibrahim in Abuja - active', 'processing', 38153288.71, 'Rivers', 'REF-232793', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-11 16:36:54'::timestamp, '2026-04-22 16:36:54'::timestamp),
  ('TENA-965180', 'RECO-745966', 'Segun Oladipo', 'micro', 'Processed for Chioma Nnamdi in Rivers - pending', 'completed', 15006456.51, 'Lagos', 'REF-116823', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-02 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp),
  ('TENA-659455', 'RECO-382894', 'Chukwuemeka Nwosu', 'standard', 'Processed for Musa Danjuma in Rivers - completed', 'rejected', 4753867.28, 'Anambra', 'REF-823776', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-05 16:36:54'::timestamp, '2025-12-28 16:36:54'::timestamp),
  ('TENA-825457', 'RECO-182246', 'Hauwa Yusuf', 'basic', 'Processed for Rasheed Olanrewaju in Ogun - rejected', 'pending', 47099717.9, 'Kaduna', 'REF-359526', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-26 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp),
  ('TENA-184932', 'RECO-310072', 'Rasheed Olanrewaju', 'corporate', 'Processed for Halima Usman in Enugu - processing', 'rejected', 19786478.61, 'Ogun', 'REF-362780', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-29 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp),
  ('TENA-978500', 'RECO-325042', 'Babajide Williams', 'micro', 'Processed for Fatima Abdulrahman in Anambra - active', 'rejected', 30145738.55, 'Enugu', 'REF-998489', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-06 16:36:54'::timestamp, '2026-04-10 16:36:54'::timestamp),
  ('TENA-369475', 'RECO-191573', 'Hauwa Yusuf', 'standard', 'Processed for Musa Danjuma in Oyo - active', 'rejected', 30159055.14, 'Anambra', 'REF-537979', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-14 16:36:54'::timestamp, '2025-06-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: nirsal_credit_guarantee
INSERT INTO "nirsal_credit_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-246104', 'RECO-306544', 'Amina Garba', 'premium', 'Processed for Oluwaseun Adeyemi in Rivers - active', 'active', 9914636.29, 'Lagos', 'REF-417855', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-24 16:36:54'::timestamp, '2025-10-21 16:36:54'::timestamp),
  ('TENA-516080', 'RECO-984679', 'Joy Okonkwo', 'standard', 'Processed for Segun Oladipo in Rivers - rejected', 'approved', 41984821.2, 'Oyo', 'REF-565311', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-11 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp),
  ('TENA-333288', 'RECO-394154', 'Muhammed Lawal', 'basic', 'Processed for Adebayo Ogundimu in Enugu - active', 'completed', 44481340.41, 'Anambra', 'REF-941169', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-14 16:36:54'::timestamp, '2025-08-16 16:36:54'::timestamp),
  ('TENA-780498', 'RECO-642049', 'Chukwuemeka Nwosu', 'basic', 'Processed for Ifeanyi Obi in Enugu - processing', 'approved', 48871861.96, 'Ogun', 'REF-516653', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-12 16:36:54'::timestamp, '2025-07-06 16:36:54'::timestamp),
  ('TENA-353592', 'RECO-724915', 'Oluwaseun Adeyemi', 'premium', 'Processed for Joy Okonkwo in Kano - completed', 'rejected', 9969089.88, 'Ogun', 'REF-790752', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-13 16:36:54'::timestamp, '2025-10-19 16:36:54'::timestamp),
  ('TENA-482476', 'RECO-757029', 'Babajide Williams', 'premium', 'Processed for Muhammed Lawal in Rivers - processing', 'approved', 33929806.26, 'Oyo', 'REF-434151', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-03 16:36:54'::timestamp, '2026-04-02 16:36:54'::timestamp),
  ('TENA-904927', 'RECO-402667', 'Oluwaseun Adeyemi', 'corporate', 'Processed for Victoria Etim in Ogun - active', 'rejected', 11414180.31, 'Lagos', 'REF-803636', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-13 16:36:54'::timestamp, '2026-01-12 16:36:54'::timestamp),
  ('TENA-539738', 'RECO-387087', 'Folake Bakare', 'standard', 'Processed for Nkechi Nwankwo in Lagos - active', 'approved', 35030593.77, 'Abuja', 'REF-935358', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-27 16:36:54'::timestamp, '2025-06-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: nostroAccounts
INSERT INTO "nostroAccounts" ("nostroId", "tenantId", "correspondentBank", "currency", "accountNumber", "swiftCode", "balance", "lastReconciledAt", "status", "createdAt", "updatedAt") VALUES
  ('NOST-985612', 'TENA-340973', 'Amina Garba - active', 'USD', 'Babajide Williams - active', 'CODE-107179', 46988785.66, '2025-06-04 16:36:54'::timestamp, 'processing', '2026-04-17 16:36:54'::timestamp, '2025-07-27 16:36:54'::timestamp),
  ('NOST-266391', 'TENA-111735', 'Rasheed Olanrewaju - active', 'USD', 'Folake Bakare - active', 'CODE-426886', 12491275.6, '2025-10-08 16:36:54'::timestamp, 'completed', '2025-07-03 16:36:54'::timestamp, '2025-10-08 16:36:54'::timestamp),
  ('NOST-266488', 'TENA-880015', 'Oluwaseun Adeyemi - pending', 'GBP', 'Rasheed Olanrewaju - processing', 'CODE-327863', 23531626.37, '2025-11-17 16:36:54'::timestamp, 'pending', '2025-07-11 16:36:54'::timestamp, '2025-06-27 16:36:54'::timestamp),
  ('NOST-761203', 'TENA-985868', 'Ifeanyi Obi - processing', 'GBP', 'Abdullahi Sani - active', 'CODE-218823', 14333959.48, '2025-12-11 16:36:54'::timestamp, 'pending', '2025-08-12 16:36:54'::timestamp, '2025-09-17 16:36:54'::timestamp),
  ('NOST-799890', 'TENA-754877', 'Kabiru Aliyu - pending', 'EUR', 'Grace Adeniyi - pending', 'CODE-118839', 10840670.92, '2025-08-01 16:36:54'::timestamp, 'completed', '2025-07-24 16:36:54'::timestamp, '2025-10-28 16:36:54'::timestamp),
  ('NOST-714579', 'TENA-669772', 'Babajide Williams - processing', 'USD', 'Halima Usman - approved', 'CODE-939599', 27816820.9, '2026-01-14 16:36:54'::timestamp, 'rejected', '2025-07-23 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp),
  ('NOST-102443', 'TENA-940181', 'Babajide Williams - pending', 'GBP', 'Obinna Igwe - processing', 'CODE-476132', 17504569.83, '2025-09-11 16:36:54'::timestamp, 'rejected', '2025-08-03 16:36:54'::timestamp, '2025-11-28 16:36:54'::timestamp),
  ('NOST-603811', 'TENA-946444', 'Amina Garba - approved', 'NGN', 'Fatima Abdulrahman - pending', 'CODE-332590', 27246403.17, '2025-11-26 16:36:54'::timestamp, 'rejected', '2025-08-12 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: opensearch_index_configs
INSERT INTO "opensearch_index_configs" ("indexName", "shards", "replicas", "avgQueryMs", "resultCacheEnabled", "status", "created_at") VALUES
  ('Aisha Bello - rejected', 4130, 7319, 4233.39, true, 'pending', '2025-11-03 16:36:54'::timestamp),
  ('Chidinma Okafor - approved', 8062, 499, 6787.14, false, 'active', '2025-06-05 16:36:54'::timestamp),
  ('Abdullahi Sani - rejected', 3227, 7302, 1100.66, false, 'completed', '2025-06-08 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - rejected', 8830, 3110, 5249.98, false, 'pending', '2026-02-19 16:36:54'::timestamp),
  ('Ngozi Eze - completed', 7359, 3638, 400.11, false, 'rejected', '2025-06-16 16:36:54'::timestamp),
  ('Nkechi Nwankwo - completed', 3810, 2068, 1306.82, true, 'processing', '2025-07-16 16:36:54'::timestamp),
  ('Segun Oladipo - processing', 6432, 3869, 2175.38, true, 'active', '2025-09-27 16:36:54'::timestamp),
  ('Musa Danjuma - active', 3123, 671, 7875.92, true, 'processing', '2026-04-29 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: operatorActions
INSERT INTO "operatorActions" ("actionId", "domainKey", "title", "detail", "owner", "dueAt", "route", "status", "roles", "createdAt", "updatedAt") VALUES
  ('ACTI-256783', 'Chukwuemeka Nwosu - pending', 'Ifeanyi Obi - processing', 'Processed for Ngozi Eze in Delta - processing', 'Nkechi Nwankwo - processing', '2026-01-13 16:36:54'::timestamp, '/api/platform/operatorActions', 'approved', '{}'::jsonb, '2026-04-21 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp),
  ('ACTI-788707', 'Ifeanyi Obi - pending', 'Grace Adeniyi - rejected', 'Processed for Chioma Nnamdi in Ogun - processing', 'Suleiman Abubakar - rejected', '2026-04-05 16:36:54'::timestamp, '/api/platform/operatorActions', 'approved', '{}'::jsonb, '2025-06-11 16:36:54'::timestamp, '2025-07-05 16:36:54'::timestamp),
  ('ACTI-802932', 'Chukwuemeka Nwosu - pending', 'Emmanuel Ogbonna - rejected', 'Processed for Victoria Etim in Ogun - rejected', 'Adebayo Ogundimu - pending', '2026-01-17 16:36:54'::timestamp, '/api/platform/operatorActions', 'active', '{}'::jsonb, '2025-09-08 16:36:54'::timestamp, '2025-05-25 16:36:54'::timestamp),
  ('ACTI-868604', 'Victoria Etim - approved', 'Ngozi Eze - rejected', 'Processed for Hauwa Yusuf in Ogun - approved', 'Tunde Akinola - pending', '2025-12-22 16:36:54'::timestamp, '/api/platform/operatorActions', 'approved', '{}'::jsonb, '2026-03-31 16:36:54'::timestamp, '2025-09-29 16:36:54'::timestamp),
  ('ACTI-258322', 'Emmanuel Ogbonna - rejected', 'Chioma Nnamdi - processing', 'Processed for Adebayo Ogundimu in Delta - pending', 'Khadija Musa - processing', '2025-10-13 16:36:54'::timestamp, '/api/platform/operatorActions', 'active', '{}'::jsonb, '2025-11-21 16:36:54'::timestamp, '2025-09-16 16:36:54'::timestamp),
  ('ACTI-959382', 'Babajide Williams - rejected', 'Muhammed Lawal - approved', 'Processed for Abdullahi Sani in Oyo - approved', 'Obinna Igwe - processing', '2026-03-17 16:36:54'::timestamp, '/api/platform/operatorActions', 'processing', '{}'::jsonb, '2026-04-05 16:36:54'::timestamp, '2025-11-17 16:36:54'::timestamp),
  ('ACTI-482721', 'Nkechi Nwankwo - completed', 'Grace Adeniyi - rejected', 'Processed for Joy Okonkwo in Enugu - processing', 'Babajide Williams - processing', '2025-08-14 16:36:54'::timestamp, '/api/platform/operatorActions', 'rejected', '{}'::jsonb, '2025-06-16 16:36:54'::timestamp, '2026-03-21 16:36:54'::timestamp),
  ('ACTI-108801', 'Joy Okonkwo - processing', 'Adebayo Ogundimu - processing', 'Processed for Victoria Etim in Delta - pending', 'Chioma Nnamdi - processing', '2026-03-22 16:36:54'::timestamp, '/api/platform/operatorActions', 'active', '{}'::jsonb, '2025-09-27 16:36:54'::timestamp, '2025-12-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: optimistic_ui_configs
INSERT INTO "optimistic_ui_configs" ("action", "endpoint", "rollbackOnError", "successRate", "perceivedLatencyMs", "status", "created_at") VALUES
  ('transfer', 'https://api.54bank.ng/optimistic_ui_configs/930752', true, 'Victoria Etim - rejected', 2908, 'active', '2026-03-01 16:36:54'::timestamp),
  ('reject', 'https://api.54bank.ng/optimistic_ui_configs/175567', true, 'Zainab Mohammed - pending', 3356, 'rejected', '2025-06-16 16:36:54'::timestamp),
  ('create', 'https://api.54bank.ng/optimistic_ui_configs/230691', true, 'Amina Garba - pending', 4090, 'rejected', '2025-12-15 16:36:54'::timestamp),
  ('verify', 'https://api.54bank.ng/optimistic_ui_configs/282148', false, 'Blessing Okoro - rejected', 6887, 'completed', '2025-10-18 16:36:54'::timestamp),
  ('verify', 'https://api.54bank.ng/optimistic_ui_configs/568731', false, 'Aisha Bello - completed', 5285, 'active', '2026-01-03 16:36:54'::timestamp),
  ('create', 'https://api.54bank.ng/optimistic_ui_configs/793388', false, 'Zainab Mohammed - approved', 3582, 'rejected', '2026-04-21 16:36:54'::timestamp),
  ('transfer', 'https://api.54bank.ng/optimistic_ui_configs/449780', true, 'Segun Oladipo - active', 5034, 'active', '2025-12-11 16:36:54'::timestamp),
  ('reject', 'https://api.54bank.ng/optimistic_ui_configs/673245', false, 'Victoria Etim - pending', 8508, 'pending', '2026-01-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: otp_records
INSERT INTO "otp_records" ("otp_id", "policy_id", "customer_id", "channel", "purpose", "otp_hash", "status", "attempts", "delivered_via", "expires_at", "verified_at", "created_at") VALUES
  ('OTP-811336', 'POLI-123794', 'CUST-434681', 'Aisha Bello - processing', 'Processed for Oluwaseun Adeyemi in Delta - completed', '0ec24bea10ad0ab3b3ce64cec7fce5740cbb8dc48fecf6e90f2d3adf4da8cbb6', 'completed', 1816, 'Babajide Williams - rejected', '2026-03-28 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('OTP-919644', 'POLI-188168', 'CUST-299748', 'Segun Oladipo - processing', 'Processed for Chukwuemeka Nwosu in Anambra - active', '4bbdcc8adfed8a2dbe52fdddf86c06a2ad90b9cd319b4abbe35a2f75c119db7b', 'active', 6746, 'Hauwa Yusuf - approved', '2025-12-20 16:36:54'::timestamp, '2026-03-31 16:36:54'::timestamp, '2025-06-24 16:36:54'::timestamp),
  ('OTP-720656', 'POLI-746371', 'CUST-835189', 'Obinna Igwe - pending', 'Processed for Joy Okonkwo in Kaduna - approved', '0ea4fea3d293440512b2d79de9fdc0aae4f1ffda9b8c8bf70e2c7ce7df24ee1c', 'processing', 5688, 'Rasheed Olanrewaju - processing', '2025-10-03 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp, '2025-09-24 16:36:54'::timestamp),
  ('OTP-789436', 'POLI-445656', 'CUST-822132', 'Kabiru Aliyu - rejected', 'Processed for Chidinma Okafor in Kano - rejected', 'bcfe655599a6aa4acbe31e8aceaffa4afc67dc78aa5dd40ce0afe78b7ceeebaa', 'completed', 3094, 'Victoria Etim - pending', '2025-09-20 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp),
  ('OTP-300343', 'POLI-712822', 'CUST-729840', 'Ngozi Eze - approved', 'Processed for Zainab Mohammed in Anambra - active', 'f021a0ea7da68a6443cbd70128226bcbd1d8dfaab09c06bb9ebbfff1190bba1d', 'pending', 9269, 'Emmanuel Ogbonna - rejected', '2025-10-27 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp),
  ('OTP-297766', 'POLI-152697', 'CUST-690723', 'Chioma Nnamdi - completed', 'Processed for Amina Garba in Kaduna - pending', 'dd9ecec67cc85f21dcdabfb09ff81a905117c0acd5bb0bdfc6974f5f5e290df4', 'rejected', 1928, 'Aisha Bello - pending', '2025-10-22 16:36:54'::timestamp, '2025-07-04 16:36:54'::timestamp, '2025-11-10 16:36:54'::timestamp),
  ('OTP-706201', 'POLI-724340', 'CUST-225407', 'Fatima Abdulrahman - pending', 'Processed for Amina Garba in Oyo - pending', '2f3c451ade85c89da92ecff4652ac94d0ffdf00af1be6b45e64f1fdbed258d1a', 'approved', 6004, 'Khadija Musa - rejected', '2026-04-14 16:36:54'::timestamp, '2025-08-26 16:36:54'::timestamp, '2026-03-21 16:36:54'::timestamp),
  ('OTP-385829', 'POLI-746366', 'CUST-233777', 'Victoria Etim - rejected', 'Processed for Ngozi Eze in Delta - rejected', 'eeb3bc89f7fb9d535eaaf4d44d3e694ea918a3dbb6d62c2adbb5def5f0720f99', 'pending', 1976, 'Chidinma Okafor - pending', '2025-10-04 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp, '2025-07-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: output_encoding_rules
INSERT INTO "output_encoding_rules" ("context", "encoder", "chars_encoded", "applied_24h", "xss_blocked", "status", "created_at") VALUES
  ('Halima Usman - completed', 'CODE-913693', '{}'::jsonb, 2916, 6775, 'rejected', '2025-07-15 16:36:54'::timestamp),
  ('Victoria Etim - approved', 'CODE-580484', '{}'::jsonb, 7643, 3275, 'rejected', '2026-03-19 16:36:54'::timestamp),
  ('Victoria Etim - completed', 'CODE-797192', '{}'::jsonb, 3150, 8511, 'processing', '2025-10-13 16:36:54'::timestamp),
  ('Yusuf Ibrahim - approved', 'CODE-278682', '{}'::jsonb, 5434, 2598, 'completed', '2025-12-09 16:36:54'::timestamp),
  ('Aisha Bello - completed', 'CODE-859064', '{}'::jsonb, 6697, 8224, 'approved', '2025-08-21 16:36:54'::timestamp),
  ('Segun Oladipo - completed', 'CODE-671027', '{}'::jsonb, 3103, 2098, 'rejected', '2025-06-28 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - rejected', 'CODE-173813', '{}'::jsonb, 4323, 8492, 'approved', '2025-10-22 16:36:54'::timestamp),
  ('Fatima Abdulrahman - processing', 'CODE-571134', '{}'::jsonb, 2092, 3291, 'rejected', '2025-08-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: parametric_insurance_iot
INSERT INTO "parametric_insurance_iot" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-346879', 'RECO-295256', 'Khadija Musa', 'micro', 'Processed for Aisha Bello in Enugu - active', 'approved', 13761648.34, 'Enugu', 'REF-583226', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-29 16:36:54'::timestamp, '2025-09-09 16:36:54'::timestamp),
  ('TENA-873306', 'RECO-103877', 'Abdullahi Sani', 'basic', 'Processed for Blessing Okoro in Kaduna - active', 'active', 46633381.01, 'Abuja', 'REF-801362', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-11 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp),
  ('TENA-110371', 'RECO-941121', 'Khadija Musa', 'corporate', 'Processed for Grace Adeniyi in Ogun - completed', 'processing', 15831441.83, 'Ogun', 'REF-891989', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-17 16:36:54'::timestamp, '2025-11-22 16:36:54'::timestamp),
  ('TENA-248848', 'RECO-978515', 'Muhammed Lawal', 'basic', 'Processed for Ngozi Eze in Oyo - approved', 'rejected', 6545550.59, 'Kaduna', 'REF-550904', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-30 16:36:54'::timestamp, '2025-06-21 16:36:54'::timestamp),
  ('TENA-416357', 'RECO-389983', 'Oluwaseun Adeyemi', 'standard', 'Processed for Folake Bakare in Abuja - approved', 'completed', 43209812.75, 'Lagos', 'REF-314518', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-12 16:36:54'::timestamp, '2026-03-20 16:36:54'::timestamp),
  ('TENA-759803', 'RECO-207034', 'Hauwa Yusuf', 'enterprise', 'Processed for Kabiru Aliyu in Rivers - pending', 'active', 15278886.0, 'Anambra', 'REF-534830', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-05 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp),
  ('TENA-311427', 'RECO-275815', 'Suleiman Abubakar', 'enterprise', 'Processed for Obinna Igwe in Abuja - active', 'active', 41000590.29, 'Lagos', 'REF-113383', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-02 16:36:54'::timestamp, '2026-04-02 16:36:54'::timestamp),
  ('TENA-658702', 'RECO-296057', 'Khadija Musa', 'enterprise', 'Processed for Chidinma Okafor in Abuja - active', 'processing', 2181007.58, 'Kano', 'REF-972857', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: partnerApprovalRecords
INSERT INTO "partnerApprovalRecords" ("approvalId", "partnerId", "stage", "title", "detail", "state", "requiredRole", "requestedAt", "requestedById", "resolvedAt", "resolutionNote") VALUES
  ('Grace Adeniyi - approved', 'PART-559991', 'Obinna Igwe - processing', 'Kabiru Aliyu - rejected', 'Processed for Chidinma Okafor in Kaduna - processing', 'Abuja', 'compliance', '2025-09-05 16:36:54'::timestamp, 'REQU-204961', '2025-09-13 16:36:54'::timestamp, 'Oluwaseun Adeyemi - rejected'),
  ('Tunde Akinola - approved', 'PART-740566', 'Folake Bakare - active', 'Chioma Nnamdi - processing', 'Processed for Zainab Mohammed in Delta - rejected', 'Kaduna', 'branch', '2025-12-22 16:36:54'::timestamp, 'REQU-612903', '2025-12-28 16:36:54'::timestamp, 'Khadija Musa - completed'),
  ('Abdullahi Sani - approved', 'PART-113813', 'Musa Danjuma - processing', 'Musa Danjuma - completed', 'Processed for Segun Oladipo in Enugu - processing', 'Delta', 'treasury', '2025-12-18 16:36:54'::timestamp, 'REQU-596940', '2025-10-18 16:36:54'::timestamp, 'Rasheed Olanrewaju - pending'),
  ('Emmanuel Ogbonna - rejected', 'PART-847559', 'Emmanuel Ogbonna - pending', 'Blessing Okoro - completed', 'Processed for Fatima Abdulrahman in Ogun - completed', 'Abuja', 'operations', '2025-09-08 16:36:54'::timestamp, 'REQU-820886', '2025-08-03 16:36:54'::timestamp, 'Muhammed Lawal - pending'),
  ('Segun Oladipo - rejected', 'PART-866454', 'Segun Oladipo - rejected', 'Fatima Abdulrahman - pending', 'Processed for Chioma Nnamdi in Lagos - approved', 'Kaduna', 'branch', '2025-08-22 16:36:54'::timestamp, 'REQU-641209', '2025-07-26 16:36:54'::timestamp, 'Khadija Musa - approved'),
  ('Victoria Etim - pending', 'PART-701823', 'Folake Bakare - approved', 'Yusuf Ibrahim - completed', 'Processed for Obinna Igwe in Oyo - completed', 'Kano', 'treasury', '2025-10-09 16:36:54'::timestamp, 'REQU-678192', '2025-09-18 16:36:54'::timestamp, 'Hauwa Yusuf - processing'),
  ('Chioma Nnamdi - rejected', 'PART-663935', 'Halima Usman - active', 'Chioma Nnamdi - rejected', 'Processed for Muhammed Lawal in Abuja - processing', 'Delta', 'compliance', '2025-06-08 16:36:54'::timestamp, 'REQU-839084', '2025-10-08 16:36:54'::timestamp, 'Aisha Bello - approved'),
  ('Oluwaseun Adeyemi - approved', 'PART-325034', 'Folake Bakare - completed', 'Segun Oladipo - rejected', 'Processed for Oluwaseun Adeyemi in Delta - active', 'Kano', 'treasury', '2026-02-02 16:36:54'::timestamp, 'REQU-515390', '2025-09-05 16:36:54'::timestamp, 'Kabiru Aliyu - completed')
ON CONFLICT DO NOTHING;

-- Table: partnerOnboardingRecords
INSERT INTO "partnerOnboardingRecords" ("partnerId", "tenantId", "partnerName", "legalEntity", "partnerType", "region", "stage", "requestedModules", "primaryContact", "operationsContact", "commercial", "compliance", "branding", "checklist", "blockers", "readinessScore", "createdAt", "updatedAt", "submittedAt", "launchedAt", "lastSubmittedBy") VALUES
  ('PART-664663', 'TENA-294347', 'Muhammed Lawal - pending', 'Suleiman Abubakar - processing', 'corporate', 'Abuja', 'Nkechi Nwankwo - active', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 45, '2025-09-20 16:36:54'::timestamp, '2025-12-19 16:36:54'::timestamp, '2026-05-02 16:36:54'::timestamp, '2025-05-22 16:36:54'::timestamp, 'Chukwuemeka Nwosu - active'),
  ('PART-871401', 'TENA-368855', 'Nkechi Nwankwo - approved', 'Rasheed Olanrewaju - pending', 'corporate', 'Enugu', 'Amina Garba - active', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 37, '2025-10-20 16:36:54'::timestamp, '2025-08-13 16:36:54'::timestamp, '2025-06-14 16:36:54'::timestamp, '2025-05-28 16:36:54'::timestamp, 'Zainab Mohammed - processing'),
  ('PART-151397', 'TENA-825710', 'Amina Garba - active', 'Obinna Igwe - active', 'corporate', 'Enugu', 'Hauwa Yusuf - active', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 60, '2025-12-21 16:36:54'::timestamp, '2025-07-11 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp, 'Babajide Williams - completed'),
  ('PART-939913', 'TENA-864736', 'Khadija Musa - approved', 'Khadija Musa - active', 'premium', 'Anambra', 'Ngozi Eze - active', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 5, '2025-09-05 16:36:54'::timestamp, '2025-09-08 16:36:54'::timestamp, '2026-02-01 16:36:54'::timestamp, '2025-09-26 16:36:54'::timestamp, 'Victoria Etim - approved'),
  ('PART-663047', 'TENA-768034', 'Joy Okonkwo - approved', 'Segun Oladipo - rejected', 'premium', 'Anambra', 'Halima Usman - pending', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 80, '2025-12-03 16:36:54'::timestamp, '2026-05-01 16:36:54'::timestamp, '2025-12-23 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp, 'Babajide Williams - pending'),
  ('PART-427905', 'TENA-614226', 'Fatima Abdulrahman - active', 'Chioma Nnamdi - processing', 'basic', 'Anambra', 'Chioma Nnamdi - rejected', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 40, '2025-08-22 16:36:54'::timestamp, '2026-01-13 16:36:54'::timestamp, '2025-11-13 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp, 'Chioma Nnamdi - processing'),
  ('PART-548254', 'TENA-433436', 'Yusuf Ibrahim - completed', 'Suleiman Abubakar - pending', 'standard', 'Ogun', 'Kabiru Aliyu - pending', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 9, '2025-07-06 16:36:54'::timestamp, '2025-11-08 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp, 'Chukwuemeka Nwosu - approved'),
  ('PART-640585', 'TENA-610830', 'Chukwuemeka Nwosu - approved', 'Emmanuel Ogbonna - pending', 'basic', 'Enugu', 'Aisha Bello - processing', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 63, '2025-06-06 16:36:54'::timestamp, '2025-10-03 16:36:54'::timestamp, '2025-06-09 16:36:54'::timestamp, '2026-03-16 16:36:54'::timestamp, 'Adebayo Ogundimu - active')
ON CONFLICT DO NOTHING;

-- Table: path_validation_rules
INSERT INTO "path_validation_rules" ("pattern", "regex", "blocked_24h", "passed_24h", "common_violations", "status", "created_at") VALUES
  ('Emmanuel Ogbonna - approved', 'Ngozi Eze - approved', 5797, 5291, '{}'::jsonb, 'active', '2026-03-13 16:36:54'::timestamp),
  ('Victoria Etim - approved', 'Hauwa Yusuf - active', 6294, 9240, '{}'::jsonb, 'completed', '2025-07-08 16:36:54'::timestamp),
  ('Muhammed Lawal - approved', 'Muhammed Lawal - processing', 8294, 9398, '{}'::jsonb, 'pending', '2026-05-01 16:36:54'::timestamp),
  ('Tunde Akinola - approved', 'Abdullahi Sani - pending', 8721, 4823, '{}'::jsonb, 'active', '2026-02-28 16:36:54'::timestamp),
  ('Zainab Mohammed - approved', 'Emmanuel Ogbonna - rejected', 5007, 3318, '{}'::jsonb, 'processing', '2026-05-03 16:36:54'::timestamp),
  ('Obinna Igwe - approved', 'Rasheed Olanrewaju - pending', 7348, 867, '{}'::jsonb, 'processing', '2025-07-13 16:36:54'::timestamp),
  ('Muhammed Lawal - processing', 'Musa Danjuma - pending', 4150, 6387, '{}'::jsonb, 'processing', '2026-03-12 16:36:54'::timestamp),
  ('Folake Bakare - processing', 'Chioma Nnamdi - pending', 8261, 7197, '{}'::jsonb, 'active', '2025-10-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pci_scans
INSERT INTO "pci_scans" ("requirement", "total_controls", "passing", "failing", "findings", "last_scan", "scan_duration", "status", "created_at") VALUES
  ('Adebayo Ogundimu - rejected', 29859350, 5834, 320, '{}'::jsonb, '2025-05-28 16:36:54'::timestamp, 'Victoria Etim - approved', 'active', '2025-05-29 16:36:54'::timestamp),
  ('Halima Usman - rejected', 12236586, 6098, 706, '{}'::jsonb, '2026-04-05 16:36:54'::timestamp, 'Fatima Abdulrahman - pending', 'pending', '2026-04-04 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', 49453936, 7876, 1946, '{}'::jsonb, '2025-06-09 16:36:54'::timestamp, 'Victoria Etim - completed', 'completed', '2025-06-19 16:36:54'::timestamp),
  ('Chidinma Okafor - completed', 8889818, 8208, 9117, '{}'::jsonb, '2025-07-24 16:36:54'::timestamp, 'Fatima Abdulrahman - active', 'rejected', '2026-03-09 16:36:54'::timestamp),
  ('Adebayo Ogundimu - pending', 4043068, 5871, 4622, '{}'::jsonb, '2025-07-13 16:36:54'::timestamp, 'Chidinma Okafor - rejected', 'rejected', '2025-06-08 16:36:54'::timestamp),
  ('Zainab Mohammed - processing', 8923566, 2861, 7105, '{}'::jsonb, '2025-05-18 16:36:54'::timestamp, 'Chukwuemeka Nwosu - completed', 'processing', '2025-06-02 16:36:54'::timestamp),
  ('Chidinma Okafor - pending', 12765157, 3138, 5628, '{}'::jsonb, '2026-04-25 16:36:54'::timestamp, 'Blessing Okoro - pending', 'approved', '2025-10-13 16:36:54'::timestamp),
  ('Hauwa Yusuf - completed', 23921181, 2818, 120, '{}'::jsonb, '2026-04-22 16:36:54'::timestamp, 'Oluwaseun Adeyemi - processing', 'approved', '2025-12-06 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pentest_scans
INSERT INTO "pentest_scans" ("name", "scope", "scan_type", "target", "total_findings", "critical", "high", "medium", "low", "remediated", "vendor", "status", "created_at") VALUES
  ('Grace Adeniyi', 'Fatima Abdulrahman - approved', 'basic', 'Folake Bakare - rejected', 1577078, 9953, 3859, 2255, 1340, 9139, 'Joy Okonkwo - active', 'pending', '2026-01-14 16:36:54'::timestamp),
  ('Abdullahi Sani', 'Tunde Akinola - completed', 'micro', 'Zainab Mohammed - rejected', 49752473, 585, 2579, 5873, 2213, 6908, 'Blessing Okoro - approved', 'processing', '2025-11-20 16:36:54'::timestamp),
  ('Chidinma Okafor', 'Nkechi Nwankwo - approved', 'corporate', 'Aisha Bello - pending', 14652224, 4688, 5613, 7964, 5886, 1966, 'Muhammed Lawal - approved', 'completed', '2026-02-20 16:36:54'::timestamp),
  ('Ngozi Eze', 'Zainab Mohammed - processing', 'corporate', 'Oluwaseun Adeyemi - active', 47167046, 7301, 4791, 9507, 203, 5677, 'Kabiru Aliyu - approved', 'pending', '2026-04-13 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'Muhammed Lawal - completed', 'enterprise', 'Zainab Mohammed - approved', 10083372, 9402, 9144, 5896, 5247, 3236, 'Ifeanyi Obi - processing', 'completed', '2025-11-27 16:36:54'::timestamp),
  ('Suleiman Abubakar', 'Zainab Mohammed - pending', 'corporate', 'Chidinma Okafor - pending', 29882526, 5113, 5044, 4136, 5260, 4649, 'Halima Usman - completed', 'active', '2026-02-27 16:36:54'::timestamp),
  ('Folake Bakare', 'Adebayo Ogundimu - processing', 'corporate', 'Adebayo Ogundimu - completed', 35446773, 4195, 9383, 4381, 4909, 3596, 'Kabiru Aliyu - processing', 'pending', '2026-04-15 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi', 'Nkechi Nwankwo - processing', 'basic', 'Adebayo Ogundimu - active', 33720994, 7873, 4269, 3415, 871, 1002, 'Joy Okonkwo - active', 'active', '2025-08-06 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pgbouncer_pools
INSERT INTO "pgbouncer_pools" ("database", "poolMode", "activeConnections", "idleConnections", "maxClientConn", "avgQueryMs", "status", "created_at") VALUES
  ('Blessing Okoro - active', 'Obinna Igwe - completed', 5591, 700, 3457, 4809.13, 'pending', '2025-09-02 16:36:54'::timestamp),
  ('Ifeanyi Obi - rejected', 'Chioma Nnamdi - approved', 7698, 6585, 8282, 3521.41, 'completed', '2025-11-20 16:36:54'::timestamp),
  ('Zainab Mohammed - processing', 'Abdullahi Sani - approved', 6517, 3564, 6062, 4178.74, 'pending', '2026-03-18 16:36:54'::timestamp),
  ('Tunde Akinola - active', 'Adebayo Ogundimu - completed', 5304, 638, 5520, 7654.91, 'pending', '2026-05-11 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 'Joy Okonkwo - pending', 5730, 2052, 9261, 6553.79, 'rejected', '2025-12-25 16:36:54'::timestamp),
  ('Amina Garba - pending', 'Zainab Mohammed - pending', 7201, 1586, 198, 3999.69, 'processing', '2025-07-10 16:36:54'::timestamp),
  ('Nkechi Nwankwo - completed', 'Folake Bakare - approved', 1430, 8045, 6895, 9906.38, 'rejected', '2026-04-01 16:36:54'::timestamp),
  ('Segun Oladipo - active', 'Fatima Abdulrahman - rejected', 7596, 8141, 4778, 301.45, 'pending', '2025-10-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pin_hashes
INSERT INTO "pin_hashes" ("algorithm", "memory_cost", "time_cost", "parallelism", "salt_length", "hash_length", "active_hashes", "migrated_from_bcrypt", "status", "created_at") VALUES
  ('Victoria Etim - pending', 3355, 6048, 4591, 6754, 2859, 1501, 7513, 'active', '2025-12-31 16:36:54'::timestamp),
  ('Yusuf Ibrahim - active', 917, 3855, 1854, 7649, 9957, 1682, 4409, 'active', '2025-11-15 16:36:54'::timestamp),
  ('Folake Bakare - completed', 7858, 8118, 402, 6472, 67, 9224, 5918, 'active', '2025-12-17 16:36:54'::timestamp),
  ('Ngozi Eze - processing', 2407, 521, 8264, 6488, 5693, 166, 8673, 'active', '2025-11-17 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - pending', 1680, 8540, 1693, 3246, 893, 8463, 367, 'pending', '2025-12-17 16:36:54'::timestamp),
  ('Fatima Abdulrahman - active', 5684, 6262, 2809, 4289, 9062, 1728, 2254, 'rejected', '2025-08-15 16:36:54'::timestamp),
  ('Blessing Okoro - rejected', 4625, 9505, 413, 872, 7395, 8076, 3554, 'approved', '2025-07-31 16:36:54'::timestamp),
  ('Ifeanyi Obi - completed', 924, 7552, 2912, 3188, 5563, 3013, 2558, 'pending', '2025-11-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pin_verifications
INSERT INTO "pin_verifications" ("verification_id", "card_id", "serial_number", "customer_id", "transaction_id", "channel", "result", "ip_address", "device_id", "timestamp") VALUES
  ('VERI-878071', 'CARD-495452', 'Musa Danjuma - completed', 'CUST-708326', 'TRAN-392434', 'Ngozi Eze - rejected', 'Khadija Musa - approved', '248.77.226.141', 'DEVI-622179', '2025-09-15 16:36:54'::timestamp),
  ('VERI-795484', 'CARD-634594', 'Babajide Williams - pending', 'CUST-488770', 'TRAN-694751', 'Obinna Igwe - pending', 'Musa Danjuma - active', '166.82.64.225', 'DEVI-457446', '2026-03-24 16:36:54'::timestamp),
  ('VERI-284466', 'CARD-897153', 'Blessing Okoro - completed', 'CUST-598118', 'TRAN-445795', 'Hauwa Yusuf - processing', 'Emmanuel Ogbonna - pending', '54.210.10.160', 'DEVI-332540', '2025-07-17 16:36:54'::timestamp),
  ('VERI-241435', 'CARD-989455', 'Oluwaseun Adeyemi - completed', 'CUST-552133', 'TRAN-850257', 'Victoria Etim - rejected', 'Chioma Nnamdi - active', '79.226.5.62', 'DEVI-553951', '2025-07-12 16:36:54'::timestamp),
  ('VERI-327157', 'CARD-230674', 'Aisha Bello - completed', 'CUST-628128', 'TRAN-837803', 'Hauwa Yusuf - processing', 'Victoria Etim - approved', '158.18.229.69', 'DEVI-195183', '2025-10-01 16:36:54'::timestamp),
  ('VERI-665810', 'CARD-778627', 'Adebayo Ogundimu - processing', 'CUST-617398', 'TRAN-113328', 'Aisha Bello - processing', 'Babajide Williams - approved', '243.165.64.112', 'DEVI-102020', '2026-01-17 16:36:54'::timestamp),
  ('VERI-574206', 'CARD-154249', 'Hauwa Yusuf - approved', 'CUST-225568', 'TRAN-416224', 'Blessing Okoro - approved', 'Suleiman Abubakar - completed', '252.36.149.119', 'DEVI-826053', '2026-04-12 16:36:54'::timestamp),
  ('VERI-577596', 'CARD-651889', 'Obinna Igwe - rejected', 'CUST-495594', 'TRAN-964244', 'Hauwa Yusuf - processing', 'Chukwuemeka Nwosu - rejected', '114.176.46.188', 'DEVI-473533', '2025-05-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: pkce_flows
INSERT INTO "pkce_flows" ("client_id", "grant_type", "code_challenge_method", "redirect_uri", "scopes", "token_lifetime", "refresh_lifetime", "active_flows", "status", "created_at") VALUES
  ('CLIE-847283', 'standard', 'create', 'https://api.54bank.ng/pkce_flows/955157', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 3011, 6441, 5481, 'completed', '2025-07-27 16:36:54'::timestamp),
  ('CLIE-184819', 'corporate', 'update', 'https://api.54bank.ng/pkce_flows/175889', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 2273, 6040, 5042, 'processing', '2025-06-28 16:36:54'::timestamp),
  ('CLIE-798672', 'standard', 'verify', 'https://api.54bank.ng/pkce_flows/336107', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 9914, 1457, 4442, 'active', '2026-02-13 16:36:54'::timestamp),
  ('CLIE-728024', 'corporate', 'transfer', 'https://api.54bank.ng/pkce_flows/752892', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 269, 2424, 5918, 'completed', '2025-09-29 16:36:54'::timestamp),
  ('CLIE-648560', 'premium', 'transfer', 'https://api.54bank.ng/pkce_flows/888409', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 4615, 1183, 28, 'processing', '2025-11-03 16:36:54'::timestamp),
  ('CLIE-900803', 'corporate', 'transfer', 'https://api.54bank.ng/pkce_flows/424057', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 6313, 1590, 6193, 'active', '2026-04-22 16:36:54'::timestamp),
  ('CLIE-644502', 'corporate', 'transfer', 'https://api.54bank.ng/pkce_flows/202032', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 7309, 2991, 2313, 'processing', '2025-12-08 16:36:54'::timestamp),
  ('CLIE-646275', 'premium', 'update', 'https://api.54bank.ng/pkce_flows/657318', '["core_banking", "payments", "kyc", "aml"]'::jsonb, 6614, 5530, 7874, 'approved', '2025-08-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: post_harvest_loss_tracker
INSERT INTO "post_harvest_loss_tracker" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-132942', 'RECO-475050', 'Oluwaseun Adeyemi', 'corporate', 'Processed for Nkechi Nwankwo in Kano - active', 'pending', 12374869.31, 'Delta', 'REF-950699', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-27 16:36:54'::timestamp, '2025-12-05 16:36:54'::timestamp),
  ('TENA-495962', 'RECO-653437', 'Chioma Nnamdi', 'micro', 'Processed for Fatima Abdulrahman in Ogun - approved', 'rejected', 8863753.2, 'Lagos', 'REF-705409', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-12 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp),
  ('TENA-184584', 'RECO-362868', 'Grace Adeniyi', 'corporate', 'Processed for Rasheed Olanrewaju in Kano - pending', 'active', 47112078.64, 'Anambra', 'REF-435679', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-10 16:36:54'::timestamp, '2026-05-02 16:36:54'::timestamp),
  ('TENA-612195', 'RECO-601884', 'Obinna Igwe', 'standard', 'Processed for Emmanuel Ogbonna in Rivers - approved', 'processing', 3533141.25, 'Enugu', 'REF-167457', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-23 16:36:54'::timestamp, '2025-09-22 16:36:54'::timestamp),
  ('TENA-806953', 'RECO-869076', 'Tunde Akinola', 'standard', 'Processed for Musa Danjuma in Oyo - pending', 'approved', 31298978.1, 'Oyo', 'REF-425785', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-05 16:36:54'::timestamp, '2025-12-21 16:36:54'::timestamp),
  ('TENA-490828', 'RECO-330573', 'Aisha Bello', 'premium', 'Processed for Chukwuemeka Nwosu in Delta - approved', 'rejected', 31155089.86, 'Oyo', 'REF-726801', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-10 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp),
  ('TENA-159761', 'RECO-397100', 'Abdullahi Sani', 'micro', 'Processed for Oluwaseun Adeyemi in Kano - pending', 'active', 21377490.95, 'Ogun', 'REF-618550', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp),
  ('TENA-884753', 'RECO-446222', 'Ngozi Eze', 'standard', 'Processed for Babajide Williams in Delta - processing', 'pending', 36921750.57, 'Rivers', 'REF-581930', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-27 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: prepared_statements
INSERT INTO "prepared_statements" ("queryPattern", "executions24h", "avgExecMs", "planCacheHits", "paramTypes", "status", "created_at") VALUES
  ('Halima Usman - rejected', 3607, 2206.02, 'Khadija Musa - approved', 'basic', 'active', '2025-06-29 16:36:54'::timestamp),
  ('Abdullahi Sani - active', 5836, 3226.51, 'Tunde Akinola - completed', 'corporate', 'approved', '2026-02-18 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 9507, 9904.56, 'Nkechi Nwankwo - pending', 'standard', 'pending', '2025-10-22 16:36:54'::timestamp),
  ('Grace Adeniyi - processing', 3215, 4212.78, 'Chidinma Okafor - active', 'premium', 'approved', '2025-09-12 16:36:54'::timestamp),
  ('Victoria Etim - rejected', 5654, 9540.05, 'Ngozi Eze - pending', 'basic', 'pending', '2025-10-03 16:36:54'::timestamp),
  ('Tunde Akinola - approved', 5949, 6416.83, 'Joy Okonkwo - completed', 'enterprise', 'processing', '2025-09-22 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', 9540, 8944.42, 'Suleiman Abubakar - pending', 'standard', 'approved', '2025-12-14 16:36:54'::timestamp),
  ('Ifeanyi Obi - completed', 7319, 6985.07, 'Musa Danjuma - approved', 'enterprise', 'active', '2025-08-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: prometheus_dashboards
INSERT INTO "prometheus_dashboards" ("dashboard", "panels", "refreshInterval", "alertRules", "dataSourceRetention", "status", "created_at") VALUES
  ('Abdullahi Sani - completed', 3653, 'REF-215769', 8192, 'internal', 'pending', '2025-05-23 16:36:54'::timestamp),
  ('Zainab Mohammed - completed', 9507, 'REF-527723', 7109, 'API', 'active', '2026-02-15 16:36:54'::timestamp),
  ('Suleiman Abubakar - active', 474, 'REF-467611', 4862, 'CBN', 'rejected', '2025-10-23 16:36:54'::timestamp),
  ('Chidinma Okafor - approved', 7919, 'REF-602586', 1916, 'internal', 'approved', '2026-01-16 16:36:54'::timestamp),
  ('Hauwa Yusuf - rejected', 7048, 'REF-498474', 5255, 'API', 'processing', '2025-08-18 16:36:54'::timestamp),
  ('Grace Adeniyi - completed', 4517, 'REF-691797', 5931, 'CBN', 'completed', '2026-02-20 16:36:54'::timestamp),
  ('Obinna Igwe - approved', 1590, 'REF-414349', 38, 'CBN', 'active', '2026-05-09 16:36:54'::timestamp),
  ('Amina Garba - rejected', 7702, 'REF-332288', 9974, 'API', 'processing', '2026-02-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: quality_certification
INSERT INTO "quality_certification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-436830', 'RECO-708192', 'Emmanuel Ogbonna', 'standard', 'Processed for Nkechi Nwankwo in Rivers - processing', 'rejected', 27741598.78, 'Anambra', 'REF-831975', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-15 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp),
  ('TENA-564388', 'RECO-586954', 'Chioma Nnamdi', 'micro', 'Processed for Ifeanyi Obi in Abuja - pending', 'pending', 37483736.74, 'Anambra', 'REF-485985', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-22 16:36:54'::timestamp, '2025-12-11 16:36:54'::timestamp),
  ('TENA-628411', 'RECO-796547', 'Yusuf Ibrahim', 'basic', 'Processed for Nkechi Nwankwo in Rivers - approved', 'pending', 1855941.92, 'Kano', 'REF-629641', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-20 16:36:54'::timestamp, '2026-03-07 16:36:54'::timestamp),
  ('TENA-720503', 'RECO-618552', 'Ngozi Eze', 'premium', 'Processed for Ngozi Eze in Lagos - pending', 'active', 21823339.83, 'Ogun', 'REF-568569', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-15 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp),
  ('TENA-854669', 'RECO-599573', 'Grace Adeniyi', 'enterprise', 'Processed for Chukwuemeka Nwosu in Ogun - processing', 'rejected', 46904732.02, 'Anambra', 'REF-238379', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-06 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp),
  ('TENA-366101', 'RECO-404834', 'Emmanuel Ogbonna', 'standard', 'Processed for Ngozi Eze in Kaduna - active', 'pending', 30738277.25, 'Abuja', 'REF-296625', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-26 16:36:54'::timestamp, '2026-04-20 16:36:54'::timestamp),
  ('TENA-132564', 'RECO-589289', 'Aisha Bello', 'standard', 'Processed for Tunde Akinola in Delta - processing', 'pending', 3488081.5, 'Anambra', 'REF-281470', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-19 16:36:54'::timestamp, '2025-05-18 16:36:54'::timestamp),
  ('TENA-893292', 'RECO-837157', 'Hauwa Yusuf', 'premium', 'Processed for Chukwuemeka Nwosu in Rivers - rejected', 'completed', 35689020.06, 'Ogun', 'REF-533036', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-07 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: query_cache_entries
INSERT INTO "query_cache_entries" ("queryHash", "tableName", "resultCount", "ttlSeconds", "hitCount", "hitRate", "status", "created_at") VALUES
  ('ffdfbd8fc521e069cd5a1de4ea46dbbdeeff13fc0faebf31f4e0c2c0342a0afc', 'Blessing Okoro - active', 168, 3674, 274, 'Blessing Okoro - completed', 'completed', '2025-12-31 16:36:54'::timestamp),
  ('fb063be32e596e21d2becaed2fde92cf5d72c4ecb07deaf2e3b65b3ff2fff1b9', 'Amina Garba - approved', 426, 2573, 217, 'Musa Danjuma - completed', 'completed', '2025-10-01 16:36:54'::timestamp),
  ('d9ade02eca19d9d224d575e8d65d3cc6844ed8d6b5e82b8a734142fddc2bbafb', 'Segun Oladipo - rejected', 216, 973, 381, 'Suleiman Abubakar - processing', 'completed', '2026-04-23 16:36:54'::timestamp),
  ('60f041ddedeecad94bd0755db67f1d68d2455762260e3ef7bebb2ecdfc7f699d', 'Khadija Musa - approved', 31, 6259, 467, 'Aisha Bello - rejected', 'pending', '2025-06-23 16:36:54'::timestamp),
  ('b56b6af663e6cc070dbd1a1eda3fe6ae3cb09a34f0b0909cba3e8475a3bd45ec', 'Ifeanyi Obi - rejected', 225, 7007, 328, 'Aisha Bello - completed', 'approved', '2025-06-23 16:36:54'::timestamp),
  ('bdfd5c6b50e6ca9e6e006a5e9af3dba3fdde0adbac15ea5be796cfaf75daa92c', 'Aisha Bello - active', 59, 165, 381, 'Khadija Musa - processing', 'pending', '2025-11-26 16:36:54'::timestamp),
  ('aeef21be8d49c86f1cacdaaeced90c6fcdfd1c34effdddbbdb5aba4b71abecfb', 'Oluwaseun Adeyemi - active', 293, 4224, 81, 'Muhammed Lawal - processing', 'active', '2025-12-13 16:36:54'::timestamp),
  ('7edcd27edda73c131f3d21d7f2d5e89b04861427f835bacb1e5ce4207a140eae', 'Joy Okonkwo - rejected', 159, 5684, 452, 'Joy Okonkwo - active', 'completed', '2026-04-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: read_replica_configs
INSERT INTO "read_replica_configs" ("replicaHost", "lagMs", "queriesRouted24h", "loadPct", "status", "created_at") VALUES
  ('Yusuf Ibrahim - processing', 3845, 2753, 2546, 'approved', '2025-06-05 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - completed', 6475, 1774, 7999, 'rejected', '2025-09-30 16:36:54'::timestamp),
  ('Abdullahi Sani - processing', 9899, 2209, 3660, 'pending', '2025-07-03 16:36:54'::timestamp),
  ('Amina Garba - rejected', 2008, 863, 7134, 'completed', '2025-11-23 16:36:54'::timestamp),
  ('Babajide Williams - rejected', 5898, 8645, 3550, 'pending', '2025-08-31 16:36:54'::timestamp),
  ('Chidinma Okafor - active', 1702, 6703, 1792, 'processing', '2026-05-10 16:36:54'::timestamp),
  ('Nkechi Nwankwo - approved', 2417, 141, 6008, 'active', '2026-01-03 16:36:54'::timestamp),
  ('Obinna Igwe - pending', 3717, 6285, 191, 'rejected', '2025-12-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: reconciliationRuns
INSERT INTO "reconciliationRuns" ("runId", "tenantId", "runType", "scope", "status", "totalEntriesChecked", "matches", "discrepancies", "autoRepaired", "manualTriage", "durationMs", "startTime", "endTime", "createdAt") VALUES
  ('RUN-781281', 'TENA-792787', 'micro', 'Nkechi Nwankwo - completed', 'rejected', 23688881, 1536, 5362, 7927, 7458, 556, '2025-06-17 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp, '2025-05-24 16:36:54'::timestamp),
  ('RUN-809869', 'TENA-731390', 'premium', 'Kabiru Aliyu - pending', 'pending', 25544937, 5897, 8071, 1877, 1998, 7363, '2025-07-29 16:36:54'::timestamp, '2025-05-21 16:36:54'::timestamp, '2025-06-08 16:36:54'::timestamp),
  ('RUN-698250', 'TENA-541785', 'standard', 'Halima Usman - rejected', 'active', 49250282, 9172, 186, 1730, 3648, 5765, '2025-07-29 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp, '2025-05-20 16:36:54'::timestamp),
  ('RUN-238166', 'TENA-112591', 'enterprise', 'Halima Usman - completed', 'pending', 22297488, 8703, 3227, 7653, 6980, 1773, '2025-06-10 16:36:54'::timestamp, '2025-07-30 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('RUN-292208', 'TENA-460569', 'micro', 'Chukwuemeka Nwosu - completed', 'completed', 40941083, 5353, 4517, 8993, 2204, 9985, '2025-05-15 16:36:54'::timestamp, '2025-10-22 16:36:54'::timestamp, '2025-09-16 16:36:54'::timestamp),
  ('RUN-579796', 'TENA-885511', 'standard', 'Suleiman Abubakar - completed', 'rejected', 16240283, 8155, 2064, 4629, 4071, 8741, '2026-01-14 16:36:54'::timestamp, '2025-12-18 16:36:54'::timestamp, '2026-05-04 16:36:54'::timestamp),
  ('RUN-535510', 'TENA-430002', 'basic', 'Fatima Abdulrahman - approved', 'processing', 20084511, 1847, 5601, 8802, 9175, 3723, '2025-06-19 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp),
  ('RUN-577675', 'TENA-701159', 'corporate', 'Folake Bakare - completed', 'processing', 24594865, 5372, 5387, 3348, 9145, 3614, '2026-03-09 16:36:54'::timestamp, '2025-11-27 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: redis_cache_entries
INSERT INTO "redis_cache_entries" ("route", "ttlSeconds", "hitCount", "missCount", "hitRate", "avgLatencyMs", "memoryMB", "status", "created_at") VALUES
  ('/api/platform/redis-cache-entries', 6445, 278, 227, 'Rasheed Olanrewaju - approved', 12.035924, 2949.6, 'rejected', '2026-01-23 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 1083, 51, 69, 'Suleiman Abubakar - pending', 5.481406, 2709.99, 'rejected', '2025-08-05 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 9505, 30, 288, 'Joy Okonkwo - rejected', 12.549021, 724.25, 'processing', '2025-08-06 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 1142, 65, 23, 'Aisha Bello - rejected', 9.096982, 8732.82, 'processing', '2025-06-28 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 3309, 162, 73, 'Aisha Bello - completed', 11.571469, 1161.74, 'approved', '2025-06-08 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 931, 319, 497, 'Obinna Igwe - active', 11.396937, 545.55, 'completed', '2026-01-15 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 7014, 32, 11, 'Ngozi Eze - pending', 8.193517, 2405.92, 'processing', '2025-06-16 16:36:54'::timestamp),
  ('/api/platform/redis-cache-entries', 3214, 7, 260, 'Grace Adeniyi - completed', 9.706746, 6020.14, 'processing', '2026-01-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: redis_sessions
INSERT INTO "redis_sessions" ("sessionId", "userId", "deviceType", "ipAddress", "expiresIn", "slidingTTL", "status", "created_at") VALUES
  ('SESS-231122', 'USER-336024', 'enterprise', '240.56.110.204', 'Adebayo Ogundimu - processing', true, 'active', '2025-07-04 16:36:54'::timestamp),
  ('SESS-702759', 'USER-596981', 'basic', '49.74.25.233', 'Adebayo Ogundimu - completed', false, 'completed', '2026-04-02 16:36:54'::timestamp),
  ('SESS-752680', 'USER-191390', 'standard', '104.52.124.58', 'Chioma Nnamdi - pending', false, 'processing', '2025-10-23 16:36:54'::timestamp),
  ('SESS-379923', 'USER-414785', 'corporate', '178.142.27.23', 'Grace Adeniyi - processing', true, 'processing', '2025-11-13 16:36:54'::timestamp),
  ('SESS-189588', 'USER-452044', 'standard', '83.185.154.77', 'Aisha Bello - processing', true, 'processing', '2025-09-07 16:36:54'::timestamp),
  ('SESS-631748', 'USER-280397', 'enterprise', '175.169.240.205', 'Musa Danjuma - rejected', false, 'processing', '2025-09-05 16:36:54'::timestamp),
  ('SESS-749132', 'USER-796770', 'micro', '193.227.14.87', 'Ifeanyi Obi - completed', false, 'processing', '2025-05-31 16:36:54'::timestamp),
  ('SESS-153918', 'USER-285708', 'micro', '111.115.86.195', 'Joy Okonkwo - approved', false, 'completed', '2026-05-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: regulatoryReports
INSERT INTO "regulatoryReports" ("reportId", "tenantId", "reportType", "period", "status", "submittedTo", "submittedAt", "data", "summary", "createdAt", "updatedAt") VALUES
  ('REPO-557122', 'TENA-425189', 'standard', '2026-Q4', 'active', 'Blessing Okoro - rejected', '2025-10-06 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2026-03-05 16:36:54'::timestamp, '2026-02-20 16:36:54'::timestamp),
  ('REPO-264729', 'TENA-148241', 'micro', '2026-Q4', 'rejected', 'Abdullahi Sani - active', '2025-08-23 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2026-04-25 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp),
  ('REPO-723186', 'TENA-883572', 'corporate', '2026-Q4', 'active', 'Musa Danjuma - completed', '2026-05-11 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2025-10-17 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp),
  ('REPO-397362', 'TENA-446090', 'micro', '2026-Q2', 'active', 'Ifeanyi Obi - approved', '2025-07-18 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2025-11-17 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('REPO-900925', 'TENA-468052', 'basic', '2026-Q4', 'active', 'Halima Usman - pending', '2025-12-17 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2026-01-21 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('REPO-742736', 'TENA-188810', 'enterprise', '2026-Q1', 'processing', 'Fatima Abdulrahman - processing', '2025-07-15 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2026-03-20 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('REPO-433750', 'TENA-886814', 'corporate', '2026-Q2', 'rejected', 'Abdullahi Sani - active', '2025-11-13 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2026-04-09 16:36:54'::timestamp, '2026-01-11 16:36:54'::timestamp),
  ('REPO-376456', 'TENA-527771', 'enterprise', '2026-Q4', 'processing', 'Halima Usman - approved', '2025-10-05 16:36:54'::timestamp, '{"status": "active", "region": "Nigeria"}'::jsonb, '{}'::jsonb, '2025-10-30 16:36:54'::timestamp, '2026-03-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: regulatory_reports_aml
INSERT INTO "regulatory_reports_aml" ("reportType", "period", "submittedTo", "filedDate", "status", "created_at") VALUES
  ('enterprise', '2026-Q4', 'Chioma Nnamdi - pending', 'Joy Okonkwo - active', 'rejected', '2025-07-23 16:36:54'::timestamp),
  ('basic', '2026-Q1', 'Victoria Etim - active', 'Hauwa Yusuf - completed', 'active', '2025-09-04 16:36:54'::timestamp),
  ('premium', '2026-Q4', 'Musa Danjuma - pending', 'Segun Oladipo - pending', 'processing', '2025-07-31 16:36:54'::timestamp),
  ('basic', '2026-Q1', 'Musa Danjuma - rejected', 'Kabiru Aliyu - pending', 'approved', '2025-11-20 16:36:54'::timestamp),
  ('premium', '2026-Q1', 'Tunde Akinola - processing', 'Nkechi Nwankwo - approved', 'completed', '2025-11-14 16:36:54'::timestamp),
  ('basic', '2026-Q4', 'Obinna Igwe - processing', 'Aisha Bello - rejected', 'pending', '2025-10-17 16:36:54'::timestamp),
  ('premium', '2026-Q3', 'Victoria Etim - pending', 'Chioma Nnamdi - active', 'active', '2026-03-25 16:36:54'::timestamp),
  ('corporate', '2026-Q4', 'Yusuf Ibrahim - approved', 'Emmanuel Ogbonna - pending', 'completed', '2025-10-11 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: risk_scores
INSERT INTO "risk_scores" ("customer_id", "static_score", "dynamic_score", "total_score", "risk_tier", "factors", "last_calculated_at", "created_at", "updated_at") VALUES
  ('CUST-459571', 2337.29, 8941.51, 9527.71, 'corporate', '{}'::jsonb, '2026-03-11 16:36:54'::timestamp, '2025-08-09 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp),
  ('CUST-272113', 1596.7, 8821.25, 5334.5, 'corporate', '{}'::jsonb, '2026-01-04 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp, '2025-08-10 16:36:54'::timestamp),
  ('CUST-141468', 3555.63, 4775.34, 4945.98, 'enterprise', '{}'::jsonb, '2025-07-22 16:36:54'::timestamp, '2026-04-06 16:36:54'::timestamp, '2025-09-30 16:36:54'::timestamp),
  ('CUST-759042', 5579.69, 7516.79, 4468.61, 'micro', '{}'::jsonb, '2026-04-13 16:36:54'::timestamp, '2025-10-19 16:36:54'::timestamp, '2025-10-19 16:36:54'::timestamp),
  ('CUST-517349', 5573.64, 2864.25, 8962.91, 'standard', '{}'::jsonb, '2026-05-05 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp, '2025-09-09 16:36:54'::timestamp),
  ('CUST-334067', 9128.53, 1978.76, 6374.22, 'corporate', '{}'::jsonb, '2025-07-21 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp, '2026-01-15 16:36:54'::timestamp),
  ('CUST-746892', 1153.94, 1601.77, 347.92, 'micro', '{}'::jsonb, '2026-03-14 16:36:54'::timestamp, '2025-07-30 16:36:54'::timestamp, '2025-10-27 16:36:54'::timestamp),
  ('CUST-597035', 7000.52, 6558.4, 568.89, 'standard', '{}'::jsonb, '2025-06-20 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: route_schemas
INSERT INTO "route_schemas" ("path", "method", "schema_name", "validation_count", "pass_rate", "failed_requests", "status", "created_at") VALUES
  ('Chidinma Okafor - completed', 'approve', 'Blessing Okoro - processing', 44, 22.2013, 9871, 'rejected', '2025-09-13 16:36:54'::timestamp),
  ('Kabiru Aliyu - approved', 'transfer', 'Grace Adeniyi - processing', 138, 4.2129, 8626, 'completed', '2025-09-13 16:36:54'::timestamp),
  ('Obinna Igwe - completed', 'transfer', 'Ifeanyi Obi - completed', 224, 13.178, 9814, 'pending', '2026-03-29 16:36:54'::timestamp),
  ('Khadija Musa - rejected', 'update', 'Joy Okonkwo - pending', 402, 3.834, 2355, 'active', '2026-02-19 16:36:54'::timestamp),
  ('Ngozi Eze - rejected', 'create', 'Musa Danjuma - completed', 303, 0.7478, 5300, 'completed', '2025-12-31 16:36:54'::timestamp),
  ('Amina Garba - pending', 'transfer', 'Chidinma Okafor - pending', 320, 2.7234, 5411, 'processing', '2025-05-28 16:36:54'::timestamp),
  ('Abdullahi Sani - rejected', 'transfer', 'Babajide Williams - pending', 424, 7.9614, 2298, 'approved', '2025-10-11 16:36:54'::timestamp),
  ('Suleiman Abubakar - completed', 'reject', 'Tunde Akinola - active', 497, 15.9382, 7307, 'pending', '2026-02-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: route_trie_stats
INSERT INTO "route_trie_stats" ("routePrefix", "totalRoutes", "trieDepth", "avgLookupNs", "cacheHitRate", "status", "created_at") VALUES
  ('/api/platform/route-trie-stats', 49384216, 492, 9568, 'Rasheed Olanrewaju - approved', 'rejected', '2026-03-12 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 27160402, 6807, 9630, 'Hauwa Yusuf - pending', 'processing', '2026-01-09 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 33362983, 7341, 4908, 'Chidinma Okafor - processing', 'rejected', '2025-12-15 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 18170077, 2460, 496, 'Obinna Igwe - processing', 'active', '2026-02-13 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 24048063, 3147, 2517, 'Zainab Mohammed - rejected', 'active', '2025-08-14 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 13575893, 4387, 96, 'Chukwuemeka Nwosu - completed', 'pending', '2026-01-13 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 10654007, 7688, 3737, 'Kabiru Aliyu - completed', 'rejected', '2025-11-25 16:36:54'::timestamp),
  ('/api/platform/route-trie-stats', 1377139, 708, 4870, 'Segun Oladipo - rejected', 'rejected', '2026-03-04 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sanctions_batch_runs
INSERT INTO "sanctions_batch_runs" ("triggerType", "customersScreened", "newMatches", "processingTimeMin", "status", "created_at") VALUES
  ('standard', 6731, 5771, 9912, 'processing', '2026-03-23 16:36:54'::timestamp),
  ('standard', 6584, 4186, 5995, 'active', '2026-04-21 16:36:54'::timestamp),
  ('corporate', 9266, 6100, 9145, 'active', '2025-08-31 16:36:54'::timestamp),
  ('corporate', 3395, 4381, 3606, 'rejected', '2026-03-25 16:36:54'::timestamp),
  ('enterprise', 2867, 1279, 4251, 'completed', '2026-02-04 16:36:54'::timestamp),
  ('standard', 5427, 1032, 8224, 'completed', '2026-04-11 16:36:54'::timestamp),
  ('enterprise', 7369, 6342, 211, 'approved', '2025-09-15 16:36:54'::timestamp),
  ('basic', 818, 6052, 4209, 'completed', '2025-08-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sanctions_screenings
INSERT INTO "sanctions_screenings" ("entity_name", "entity_type", "lists_checked", "match_found", "highest_score", "match_details", "status", "screened_by", "created_at") VALUES
  ('Stanbic IBTC', 'corporate', '{}'::jsonb, 5808, 2657.57, '{"status": "active", "region": "Nigeria"}'::jsonb, 'approved', 'Halima Usman - processing', '2026-05-12 16:36:54'::timestamp),
  ('Access Bank PLC', 'corporate', '{}'::jsonb, 1263, 8027.03, '{"status": "active", "region": "Nigeria"}'::jsonb, 'processing', 'Abdullahi Sani - completed', '2026-02-20 16:36:54'::timestamp),
  ('Nestle Nigeria', 'premium', '{}'::jsonb, 9900, 3016.64, '{"status": "active", "region": "Nigeria"}'::jsonb, 'completed', 'Halima Usman - approved', '2026-03-15 16:36:54'::timestamp),
  ('Lagos Farms Cooperative', 'micro', '{}'::jsonb, 2542, 9887.53, '{"status": "active", "region": "Nigeria"}'::jsonb, 'processing', 'Chioma Nnamdi - completed', '2025-05-13 16:36:54'::timestamp),
  ('Nestle Nigeria', 'enterprise', '{}'::jsonb, 3895, 7996.12, '{"status": "active", "region": "Nigeria"}'::jsonb, 'approved', 'Emmanuel Ogbonna - active', '2026-02-16 16:36:54'::timestamp),
  ('Lafarge Africa', 'micro', '{}'::jsonb, 4367, 1735.78, '{"status": "active", "region": "Nigeria"}'::jsonb, 'pending', 'Khadija Musa - processing', '2026-03-11 16:36:54'::timestamp),
  ('Nigerian Breweries', 'corporate', '{}'::jsonb, 3073, 9079.02, '{"status": "active", "region": "Nigeria"}'::jsonb, 'completed', 'Nkechi Nwankwo - pending', '2025-12-24 16:36:54'::timestamp),
  ('Kano Textiles Ltd', 'premium', '{}'::jsonb, 2450, 937.54, '{"status": "active", "region": "Nigeria"}'::jsonb, 'completed', 'Victoria Etim - active', '2025-12-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sar_reports_aml
INSERT INTO "sar_reports_aml" ("customerId", "customerName", "reportType", "reason", "amount", "currency", "nfiuReference", "priority", "status", "created_at") VALUES
  ('CUST-466159', 'Victoria Etim', 'corporate', 'Processed for Chioma Nnamdi in Abuja - completed', 49549712, 'USD', 'REF-648794', 'urgent', 'active', '2025-10-18 16:36:54'::timestamp),
  ('CUST-662621', 'Rasheed Olanrewaju', 'premium', 'Processed for Rasheed Olanrewaju in Oyo - processing', 25711660, 'EUR', 'REF-134393', 'low', 'processing', '2025-10-14 16:36:54'::timestamp),
  ('CUST-748233', 'Grace Adeniyi', 'micro', 'Processed for Oluwaseun Adeyemi in Kano - rejected', 12750071, 'NGN', 'REF-920224', 'urgent', 'completed', '2025-08-22 16:36:54'::timestamp),
  ('CUST-653547', 'Suleiman Abubakar', 'standard', 'Processed for Ngozi Eze in Abuja - processing', 603902, 'NGN', 'REF-911092', 'urgent', 'active', '2025-05-17 16:36:54'::timestamp),
  ('CUST-970437', 'Halima Usman', 'basic', 'Processed for Grace Adeniyi in Enugu - pending', 15135159, 'USD', 'REF-253412', 'high', 'rejected', '2026-01-25 16:36:54'::timestamp),
  ('CUST-362684', 'Folake Bakare', 'corporate', 'Processed for Oluwaseun Adeyemi in Ogun - completed', 31799983, 'NGN', 'REF-384095', 'high', 'active', '2026-02-25 16:36:54'::timestamp),
  ('CUST-278998', 'Ngozi Eze', 'corporate', 'Processed for Aisha Bello in Rivers - processing', 42424925, 'EUR', 'REF-651111', 'medium', 'processing', '2026-04-12 16:36:54'::timestamp),
  ('CUST-580306', 'Nkechi Nwankwo', 'corporate', 'Processed for Muhammed Lawal in Lagos - processing', 5777581, 'GBP', 'REF-319119', 'low', 'approved', '2026-04-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: satellite_crop_monitor
INSERT INTO "satellite_crop_monitor" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-229909', 'RECO-461051', 'Yusuf Ibrahim', 'basic', 'Processed for Chioma Nnamdi in Kano - approved', 'approved', 26677556.24, 'Ogun', 'REF-788377', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-02 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('TENA-362816', 'RECO-469836', 'Amina Garba', 'premium', 'Processed for Halima Usman in Abuja - processing', 'approved', 30219718.69, 'Oyo', 'REF-731276', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-14 16:36:54'::timestamp, '2026-02-03 16:36:54'::timestamp),
  ('TENA-222897', 'RECO-258289', 'Chioma Nnamdi', 'basic', 'Processed for Blessing Okoro in Kano - active', 'active', 30139555.53, 'Rivers', 'REF-766033', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-14 16:36:54'::timestamp, '2025-12-28 16:36:54'::timestamp),
  ('TENA-928125', 'RECO-237884', 'Oluwaseun Adeyemi', 'premium', 'Processed for Blessing Okoro in Abuja - completed', 'processing', 32462414.88, 'Ogun', 'REF-964206', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-01 16:36:54'::timestamp, '2025-06-07 16:36:54'::timestamp),
  ('TENA-113432', 'RECO-525283', 'Abdullahi Sani', 'enterprise', 'Processed for Blessing Okoro in Kano - pending', 'pending', 2723287.96, 'Lagos', 'REF-229662', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-07 16:36:54'::timestamp, '2025-12-15 16:36:54'::timestamp),
  ('TENA-308396', 'RECO-874804', 'Musa Danjuma', 'standard', 'Processed for Musa Danjuma in Abuja - processing', 'approved', 19324664.81, 'Enugu', 'REF-291051', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-04 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp),
  ('TENA-315190', 'RECO-166158', 'Yusuf Ibrahim', 'premium', 'Processed for Grace Adeniyi in Enugu - processing', 'active', 31165891.28, 'Oyo', 'REF-238832', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-01 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp),
  ('TENA-859036', 'RECO-219590', 'Nkechi Nwankwo', 'enterprise', 'Processed for Khadija Musa in Kano - pending', 'approved', 45033368.88, 'Enugu', 'REF-191569', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-12 16:36:54'::timestamp, '2025-12-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: scratch_cards
INSERT INTO "scratch_cards" ("card_id", "batch_id", "serial_number", "card_type", "pin_hash", "pin_length", "status", "max_attempts", "used_attempts", "value", "currency", "issued_to", "customer_id", "branch_code", "expires_at", "activated_at", "used_at", "revoked_at", "revoke_reason", "tamper_detected", "created_at") VALUES
  ('CARD-425141', 'BATC-527725', 'Victoria Etim - active', 'premium', '49eb5c1ea1aed0bbe56af89ba4333aae23c1a4ae40b03078ba2d870a232cfb9a', 3244, 'completed', 1659, 7153, 45337214.51, 'GBP', 'Victoria Etim - completed', 'CUST-122058', 'BR-KN86', '2025-10-23 16:36:54'::timestamp, '2025-11-27 16:36:54'::timestamp, '2025-08-25 16:36:54'::timestamp, '2025-07-16 16:36:54'::timestamp, 'Processed for Adebayo Ogundimu in Delta - active', false, '2026-04-06 16:36:54'::timestamp),
  ('CARD-204039', 'BATC-898965', 'Adebayo Ogundimu - active', 'basic', 'fcfd6dee8fbcf32fdf9bbc13cecdcfab1b6937912768a9d797beead8cbcbf4df', 1702, 'rejected', 5642, 1838, 44427395.89, 'GBP', 'Nkechi Nwankwo - approved', 'CUST-180005', 'BR-LG61', '2025-09-21 16:36:54'::timestamp, '2025-07-28 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp, '2026-01-25 16:36:54'::timestamp, 'Processed for Blessing Okoro in Anambra - active', true, '2026-02-06 16:36:54'::timestamp),
  ('CARD-587882', 'BATC-347769', 'Blessing Okoro - processing', 'enterprise', 'c486fdb9db5a2c04fcc05b1be98a93e8d9774b9d8dafb0bcf055bf2e682c0dba', 9915, 'pending', 9834, 68, 24713054.05, 'NGN', 'Emmanuel Ogbonna - active', 'CUST-988987', 'BR-KN47', '2025-08-04 16:36:54'::timestamp, '2025-12-05 16:36:54'::timestamp, '2025-10-04 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp, 'Processed for Victoria Etim in Kaduna - approved', true, '2026-05-11 16:36:54'::timestamp),
  ('CARD-865623', 'BATC-444341', 'Chidinma Okafor - active', 'micro', 'fb5554fb1960adf4c1bf79e2e3f1cf05ace0b119cca101b90dc7a626f97e4072', 5786, 'processing', 2798, 6481, 27562844.87, 'USD', 'Abdullahi Sani - pending', 'CUST-229753', 'BR-LG86', '2025-09-02 16:36:54'::timestamp, '2025-10-23 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp, '2026-03-17 16:36:54'::timestamp, 'Processed for Abdullahi Sani in Enugu - pending', false, '2025-06-18 16:36:54'::timestamp),
  ('CARD-267205', 'BATC-855043', 'Chukwuemeka Nwosu - rejected', 'premium', '72f7da99dacceab9daff1ea12b3cbcd445ad6a4f744a4c6ba3fce81fc2d2b4fd', 5076, 'approved', 776, 9501, 27610560.42, 'GBP', 'Khadija Musa - rejected', 'CUST-288856', 'BR-AB52', '2025-10-29 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp, '2025-09-11 16:36:54'::timestamp, 'Processed for Folake Bakare in Lagos - rejected', true, '2025-08-31 16:36:54'::timestamp),
  ('CARD-440981', 'BATC-655851', 'Ifeanyi Obi - rejected', 'micro', 'cbb8b49a25a7b7169f0182accea87b1e6b492a6aa24dcfb2ba5ceeaa87f78232', 6763, 'active', 908, 6630, 33564564.03, 'USD', 'Amina Garba - processing', 'CUST-213111', 'BR-LG84', '2026-02-24 16:36:54'::timestamp, '2025-12-10 16:36:54'::timestamp, '2026-01-03 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp, 'Processed for Hauwa Yusuf in Oyo - approved', true, '2026-03-12 16:36:54'::timestamp),
  ('CARD-911584', 'BATC-372401', 'Folake Bakare - completed', 'premium', 'c4d65a6374bcfdfbd94f2fee596c2eaede19522e4d58c2d56cc73fede5c3d7cd', 9547, 'approved', 8703, 6727, 43502242.49, 'EUR', 'Obinna Igwe - rejected', 'CUST-916254', 'BR-OY04', '2026-04-16 16:36:54'::timestamp, '2025-05-23 16:36:54'::timestamp, '2026-05-10 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp, 'Processed for Joy Okonkwo in Kano - processing', false, '2026-02-28 16:36:54'::timestamp),
  ('CARD-507117', 'BATC-755934', 'Fatima Abdulrahman - active', 'micro', 'da9eb23ded70f48bfcd6cdaaafaabccc625dcbb0b0debf0a2db54acc87def8d9', 2062, 'pending', 3833, 6881, 15355482.73, 'GBP', 'Halima Usman - processing', 'CUST-749632', 'BR-RV73', '2025-11-16 16:36:54'::timestamp, '2025-12-10 16:36:54'::timestamp, '2025-11-25 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp, 'Processed for Zainab Mohammed in Ogun - processing', false, '2026-01-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: security_events
INSERT INTO "security_events" ("event_id", "event_type", "sub_type", "actor", "channel", "ip_address", "geo_location", "details", "risk_score", "severity", "hash_chain", "timestamp") VALUES
  ('EVEN-822198', 'corporate', 'corporate', 'Emmanuel Ogbonna - rejected', 'Muhammed Lawal - active', '224.230.167.70', 'Rasheed Olanrewaju - rejected', 'Processed for Obinna Igwe in Kano - active', 3955.99, 'critical', '3dbfc1758ddb1d8cbf6693bc4ac74cdab00aefe018edbc4effc2de6f2afd57f6', '2026-03-22 16:36:54'::timestamp),
  ('EVEN-214099', 'micro', 'premium', 'Segun Oladipo - active', 'Khadija Musa - completed', '18.220.251.85', 'Chidinma Okafor - completed', 'Processed for Zainab Mohammed in Kaduna - active', 9353.78, 'medium', 'df02501187dbcee9b7150b9bdba483cdc3d5cf6eeaa7730bdcb7f09de8aa1d3d', '2025-11-02 16:36:54'::timestamp),
  ('EVEN-532544', 'basic', 'basic', 'Zainab Mohammed - pending', 'Chidinma Okafor - active', '156.233.123.203', 'Chidinma Okafor - approved', 'Processed for Grace Adeniyi in Ogun - active', 1543.33, 'low', '9b2b46fbecce04affd7b1b2db7a7dad1b6e575c8eeeae6cb9bccfd439b9bddad', '2025-05-30 16:36:54'::timestamp),
  ('EVEN-226059', 'enterprise', 'enterprise', 'Babajide Williams - processing', 'Emmanuel Ogbonna - pending', '226.175.8.126', 'Joy Okonkwo - pending', 'Processed for Chukwuemeka Nwosu in Delta - rejected', 3205.54, 'high', '09b5fdc77bda8586e29cff027c85c3acb56c89af8ccccbe2be4e7bb127f56dfa', '2025-09-27 16:36:54'::timestamp),
  ('EVEN-982151', 'micro', 'corporate', 'Folake Bakare - completed', 'Grace Adeniyi - processing', '97.106.160.163', 'Victoria Etim - approved', 'Processed for Babajide Williams in Kano - completed', 9119.93, 'info', 'dfecafd7a9fc9df7b25ae34c47e0e3583f93aadfb6ab4c895cf78253f685ee3d', '2026-01-23 16:36:54'::timestamp),
  ('EVEN-833334', 'premium', 'enterprise', 'Blessing Okoro - approved', 'Segun Oladipo - approved', '240.228.212.15', 'Amina Garba - completed', 'Processed for Amina Garba in Oyo - rejected', 6004.33, 'high', 'dcfc2df3a10c9edb3b92c0ef3ad4d5865a4b3f5eef2ecd0bb9abbfd3de2c6e5e', '2025-05-29 16:36:54'::timestamp),
  ('EVEN-731104', 'micro', 'enterprise', 'Yusuf Ibrahim - approved', 'Tunde Akinola - active', '132.48.163.114', 'Chukwuemeka Nwosu - approved', 'Processed for Emmanuel Ogbonna in Delta - rejected', 9478.8, 'low', 'eb5eb6a39f6b6ab2e32afe0dd95263af4baefe31bdc932e9a0de014a5dfde676', '2026-03-14 16:36:54'::timestamp),
  ('EVEN-695132', 'enterprise', 'premium', 'Ifeanyi Obi - rejected', 'Obinna Igwe - processing', '5.125.210.15', 'Oluwaseun Adeyemi - active', 'Processed for Folake Bakare in Delta - active', 5522.49, 'medium', '946eaafacc67eab3a544178c413cddea6a0b92aabbef5a9ab3bbaccd3b4bdb9a', '2025-12-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: session_records
INSERT INTO "session_records" ("session_id", "customer_id", "channel", "device_fingerprint", "ip_address", "geo_location", "status", "mfa_level", "risk_score", "last_activity", "expires_at", "terminated_reason", "created_at") VALUES
  ('SESS-176357', 'CUST-976725', 'Muhammed Lawal - active', 'Kabiru Aliyu - active', '213.33.164.176', 'Aisha Bello - rejected', 'pending', 'Muhammed Lawal - rejected', 9610.53, '2025-11-02 16:36:54'::timestamp, '2025-12-22 16:36:54'::timestamp, 'Processed for Babajide Williams in Delta - active', '2025-09-26 16:36:54'::timestamp),
  ('SESS-755801', 'CUST-417766', 'Ngozi Eze - pending', 'Chukwuemeka Nwosu - pending', '36.182.48.148', 'Emmanuel Ogbonna - active', 'processing', 'Yusuf Ibrahim - active', 6591.62, '2026-02-09 16:36:54'::timestamp, '2025-11-05 16:36:54'::timestamp, 'Processed for Ifeanyi Obi in Oyo - approved', '2026-04-06 16:36:54'::timestamp),
  ('SESS-177217', 'CUST-453117', 'Babajide Williams - rejected', 'Amina Garba - approved', '153.125.36.168', 'Adebayo Ogundimu - approved', 'processing', 'Chioma Nnamdi - active', 2645.51, '2025-07-19 16:36:54'::timestamp, '2025-10-26 16:36:54'::timestamp, 'Processed for Muhammed Lawal in Ogun - rejected', '2025-07-15 16:36:54'::timestamp),
  ('SESS-290223', 'CUST-599534', 'Chioma Nnamdi - pending', 'Chidinma Okafor - completed', '112.170.225.221', 'Fatima Abdulrahman - pending', 'completed', 'Halima Usman - pending', 2827.31, '2025-10-23 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp, 'Processed for Halima Usman in Ogun - active', '2026-01-21 16:36:54'::timestamp),
  ('SESS-404486', 'CUST-248046', 'Victoria Etim - processing', 'Aisha Bello - rejected', '36.170.65.253', 'Kabiru Aliyu - active', 'approved', 'Blessing Okoro - pending', 3403.74, '2025-08-13 16:36:54'::timestamp, '2025-09-29 16:36:54'::timestamp, 'Processed for Babajide Williams in Anambra - rejected', '2025-08-11 16:36:54'::timestamp),
  ('SESS-775560', 'CUST-748493', 'Ngozi Eze - processing', 'Oluwaseun Adeyemi - active', '71.73.3.109', 'Suleiman Abubakar - processing', 'rejected', 'Fatima Abdulrahman - completed', 2724.89, '2026-03-30 16:36:54'::timestamp, '2026-02-04 16:36:54'::timestamp, 'Processed for Victoria Etim in Anambra - rejected', '2025-06-13 16:36:54'::timestamp),
  ('SESS-803976', 'CUST-671914', 'Segun Oladipo - completed', 'Halima Usman - processing', '183.231.206.182', 'Musa Danjuma - active', 'processing', 'Blessing Okoro - processing', 5512.77, '2026-04-15 16:36:54'::timestamp, '2025-12-09 16:36:54'::timestamp, 'Processed for Fatima Abdulrahman in Delta - active', '2026-01-18 16:36:54'::timestamp),
  ('SESS-661309', 'CUST-186908', 'Blessing Okoro - active', 'Kabiru Aliyu - approved', '109.7.192.161', 'Musa Danjuma - rejected', 'approved', 'Emmanuel Ogbonna - active', 905.59, '2025-07-19 16:36:54'::timestamp, '2025-11-05 16:36:54'::timestamp, 'Processed for Aisha Bello in Delta - pending', '2025-11-16 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: settlements
INSERT INTO "settlements" ("settlementId", "tenantId", "windowId", "model", "corridor", "totalDebits", "totalCredits", "netPosition", "currency", "participantCount", "transferCount", "status", "openedAt", "closedAt", "settledAt", "createdAt") VALUES
  ('SETT-799092', 'TENA-488556', 'WIND-826825', 'isolation_forest', 'Obinna Igwe - active', 9315.44, 7916.49, 3352.47, 'USD', 117, 332, 'active', '2026-02-23 16:36:54'::timestamp, '2025-09-25 16:36:54'::timestamp, '2025-10-31 16:36:54'::timestamp, '2026-05-11 16:36:54'::timestamp),
  ('SETT-896349', 'TENA-487455', 'WIND-849418', 'random_forest', 'Chukwuemeka Nwosu - completed', 3218.15, 7827.65, 9045.45, 'EUR', 101, 131, 'approved', '2026-03-22 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp, '2026-02-09 16:36:54'::timestamp, '2025-10-02 16:36:54'::timestamp),
  ('SETT-430066', 'TENA-227797', 'WIND-641930', 'isolation_forest', 'Hauwa Yusuf - approved', 552.84, 8898.08, 6484.57, 'NGN', 382, 189, 'approved', '2026-02-15 16:36:54'::timestamp, '2026-01-13 16:36:54'::timestamp, '2026-01-03 16:36:54'::timestamp, '2026-04-11 16:36:54'::timestamp),
  ('SETT-875914', 'TENA-393741', 'WIND-388760', 'random_forest', 'Hauwa Yusuf - processing', 7518.32, 2544.67, 7204.15, 'NGN', 168, 102, 'pending', '2026-02-10 16:36:54'::timestamp, '2025-06-25 16:36:54'::timestamp, '2025-06-29 16:36:54'::timestamp, '2026-01-17 16:36:54'::timestamp),
  ('SETT-739955', 'TENA-529381', 'WIND-456409', 'isolation_forest', 'Suleiman Abubakar - completed', 860.85, 5530.16, 8837.9, 'USD', 296, 90, 'completed', '2025-10-10 16:36:54'::timestamp, '2025-09-01 16:36:54'::timestamp, '2025-06-10 16:36:54'::timestamp, '2026-05-08 16:36:54'::timestamp),
  ('SETT-195513', 'TENA-135804', 'WIND-492413', 'random_forest', 'Kabiru Aliyu - rejected', 8520.67, 1521.67, 661.91, 'EUR', 149, 63, 'rejected', '2026-04-03 16:36:54'::timestamp, '2025-06-13 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp, '2026-05-07 16:36:54'::timestamp),
  ('SETT-920122', 'TENA-241816', 'WIND-813561', 'isolation_forest', 'Adebayo Ogundimu - rejected', 6158.11, 6301.95, 98.06, 'GBP', 71, 256, 'completed', '2025-06-14 16:36:54'::timestamp, '2025-07-21 16:36:54'::timestamp, '2025-11-09 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp),
  ('SETT-419411', 'TENA-853223', 'WIND-642367', 'random_forest', 'Victoria Etim - approved', 1183.4, 1641.46, 6002.66, 'EUR', 314, 98, 'active', '2026-01-26 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp, '2026-05-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: siem_pipelines
INSERT INTO "siem_pipelines" ("name", "format", "destination", "events_exported_24h", "avg_latency_ms", "error_rate", "batch_size", "status", "created_at") VALUES
  ('Chioma Nnamdi', 'Aisha Bello - rejected', 'Aisha Bello - approved', 8821, 7.887044, 11.6695, 216, 'active', '2026-04-12 16:36:54'::timestamp),
  ('Zainab Mohammed', 'Khadija Musa - completed', 'Babajide Williams - rejected', 8324, 4.284012, 10.0119, 30, 'completed', '2025-10-17 16:36:54'::timestamp),
  ('Hauwa Yusuf', 'Yusuf Ibrahim - rejected', 'Chidinma Okafor - processing', 8268, 6.557504, 17.5147, 58, 'pending', '2025-05-24 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'Segun Oladipo - rejected', 'Musa Danjuma - processing', 8398, 4.230361, 13.858, 406, 'approved', '2025-06-02 16:36:54'::timestamp),
  ('Blessing Okoro', 'Amina Garba - processing', 'Emmanuel Ogbonna - completed', 8109, 11.455347, 19.0875, 418, 'processing', '2026-03-12 16:36:54'::timestamp),
  ('Chioma Nnamdi', 'Abdullahi Sani - completed', 'Folake Bakare - rejected', 8546, 10.498567, 15.2003, 264, 'processing', '2025-08-06 16:36:54'::timestamp),
  ('Aisha Bello', 'Ngozi Eze - completed', 'Obinna Igwe - approved', 8095, 6.650839, 20.0208, 195, 'rejected', '2026-05-11 16:36:54'::timestamp),
  ('Aisha Bello', 'Khadija Musa - rejected', 'Musa Danjuma - approved', 8940, 8.611682, 21.2852, 477, 'approved', '2025-12-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sms_alert_notification
INSERT INTO "sms_alert_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-513347', 'RECO-601445', 'Fatima Abdulrahman', 'corporate', 'Processed for Musa Danjuma in Lagos - active', 'pending', 871765.39, 'Oluwaseun Adeyemi - rejected', '+2348356712157', 'SESS-975994', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-17 16:36:54'::timestamp, '2026-03-15 16:36:54'::timestamp),
  ('TENA-504610', 'RECO-492103', 'Khadija Musa', 'micro', 'Processed for Obinna Igwe in Lagos - rejected', 'active', 31776563.5, 'Hauwa Yusuf - approved', '+2347506567722', 'SESS-583739', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-30 16:36:54'::timestamp, '2025-10-25 16:36:54'::timestamp),
  ('TENA-387688', 'RECO-828104', 'Blessing Okoro', 'corporate', 'Processed for Halima Usman in Kaduna - approved', 'rejected', 46442241.34, 'Segun Oladipo - rejected', '+2348589584362', 'SESS-857092', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-24 16:36:54'::timestamp, '2026-02-21 16:36:54'::timestamp),
  ('TENA-701180', 'RECO-818650', 'Khadija Musa', 'enterprise', 'Processed for Babajide Williams in Ogun - pending', 'completed', 36489044.08, 'Kabiru Aliyu - completed', '+2347033175901', 'SESS-713856', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-19 16:36:54'::timestamp, '2025-07-21 16:36:54'::timestamp),
  ('TENA-343888', 'RECO-101305', 'Musa Danjuma', 'corporate', 'Processed for Fatima Abdulrahman in Ogun - active', 'rejected', 2992967.16, 'Fatima Abdulrahman - active', '+2348969007904', 'SESS-540430', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-11-16 16:36:54'::timestamp),
  ('TENA-156282', 'RECO-904691', 'Fatima Abdulrahman', 'standard', 'Processed for Adebayo Ogundimu in Enugu - active', 'completed', 38897759.79, 'Halima Usman - processing', '+2347275990068', 'SESS-967153', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-15 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp),
  ('TENA-630581', 'RECO-264397', 'Segun Oladipo', 'standard', 'Processed for Aisha Bello in Enugu - approved', 'pending', 13548606.69, 'Abdullahi Sani - active', '+2347478141161', 'SESS-934561', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-11 16:36:54'::timestamp, '2026-05-11 16:36:54'::timestamp),
  ('TENA-197687', 'RECO-113215', 'Emmanuel Ogbonna', 'premium', 'Processed for Adebayo Ogundimu in Kaduna - completed', 'rejected', 22826337.82, 'Hauwa Yusuf - pending', '+2347803609523', 'SESS-756751', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-12 16:36:54'::timestamp, '2025-10-21 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sms_banking_gateway
INSERT INTO "sms_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-766238', 'RECO-768946', 'Halima Usman', 'enterprise', 'Processed for Grace Adeniyi in Kaduna - rejected', 'completed', 29864613.31, 'Oluwaseun Adeyemi - approved', '+2347708446426', 'SESS-965631', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-25 16:36:54'::timestamp, '2026-05-01 16:36:54'::timestamp),
  ('TENA-440206', 'RECO-576491', 'Victoria Etim', 'premium', 'Processed for Yusuf Ibrahim in Abuja - completed', 'processing', 12050612.62, 'Victoria Etim - rejected', '+2348433628359', 'SESS-611363', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-16 16:36:54'::timestamp, '2025-06-16 16:36:54'::timestamp),
  ('TENA-603574', 'RECO-887231', 'Zainab Mohammed', 'corporate', 'Processed for Yusuf Ibrahim in Lagos - processing', 'processing', 5547396.21, 'Segun Oladipo - approved', '+2348594449046', 'SESS-684952', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-10 16:36:54'::timestamp, '2025-11-16 16:36:54'::timestamp),
  ('TENA-518792', 'RECO-481466', 'Muhammed Lawal', 'enterprise', 'Processed for Victoria Etim in Abuja - active', 'active', 29548329.14, 'Amina Garba - active', '+2348408126435', 'SESS-747085', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-17 16:36:54'::timestamp, '2025-10-10 16:36:54'::timestamp),
  ('TENA-460719', 'RECO-141125', 'Yusuf Ibrahim', 'corporate', 'Processed for Grace Adeniyi in Rivers - pending', 'pending', 40601677.03, 'Hauwa Yusuf - pending', '+2347726962677', 'SESS-435981', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-03 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('TENA-956195', 'RECO-210969', 'Nkechi Nwankwo', 'corporate', 'Processed for Nkechi Nwankwo in Delta - pending', 'approved', 4903876.49, 'Halima Usman - rejected', '+2347653671038', 'SESS-231908', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-17 16:36:54'::timestamp, '2025-08-09 16:36:54'::timestamp),
  ('TENA-894799', 'RECO-679886', 'Oluwaseun Adeyemi', 'micro', 'Processed for Blessing Okoro in Kano - approved', 'processing', 14003232.08, 'Chioma Nnamdi - active', '+2348566907756', 'SESS-469287', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-21 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp),
  ('TENA-365231', 'RECO-703197', 'Abdullahi Sani', 'corporate', 'Processed for Chukwuemeka Nwosu in Enugu - pending', 'processing', 547294.16, 'Joy Okonkwo - completed', '+2348398995616', 'SESS-186943', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-17 16:36:54'::timestamp, '2026-02-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sms_otp_service
INSERT INTO "sms_otp_service" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-962008', 'RECO-839565', 'Chioma Nnamdi', 'enterprise', 'Processed for Amina Garba in Abuja - rejected', 'approved', 12857484.65, 'Hauwa Yusuf - rejected', '+2349041333414', 'SESS-309415', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-21 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp),
  ('TENA-779029', 'RECO-628799', 'Tunde Akinola', 'micro', 'Processed for Kabiru Aliyu in Anambra - pending', 'processing', 47317166.48, 'Ifeanyi Obi - rejected', '+2347286148290', 'SESS-176348', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-07-20 16:36:54'::timestamp),
  ('TENA-451038', 'RECO-252619', 'Abdullahi Sani', 'standard', 'Processed for Babajide Williams in Delta - approved', 'rejected', 27363692.07, 'Aisha Bello - completed', '+2348485432615', 'SESS-693813', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-02 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp),
  ('TENA-361048', 'RECO-232913', 'Zainab Mohammed', 'corporate', 'Processed for Kabiru Aliyu in Abuja - completed', 'rejected', 34244174.86, 'Halima Usman - processing', '+2347200712581', 'SESS-616084', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-01 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp),
  ('TENA-922624', 'RECO-720211', 'Joy Okonkwo', 'corporate', 'Processed for Fatima Abdulrahman in Lagos - active', 'approved', 20833494.8, 'Rasheed Olanrewaju - active', '+2348998883409', 'SESS-837781', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-24 16:36:54'::timestamp, '2026-01-01 16:36:54'::timestamp),
  ('TENA-513272', 'RECO-926502', 'Fatima Abdulrahman', 'basic', 'Processed for Fatima Abdulrahman in Abuja - active', 'processing', 3329387.82, 'Ifeanyi Obi - completed', '+2349054638733', 'SESS-733548', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-18 16:36:54'::timestamp, '2026-02-17 16:36:54'::timestamp),
  ('TENA-951922', 'RECO-875574', 'Suleiman Abubakar', 'micro', 'Processed for Chukwuemeka Nwosu in Lagos - pending', 'completed', 41154690.81, 'Musa Danjuma - processing', '+2347339926524', 'SESS-309037', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-06 16:36:54'::timestamp, '2026-03-13 16:36:54'::timestamp),
  ('TENA-364121', 'RECO-579571', 'Yusuf Ibrahim', 'premium', 'Processed for Hauwa Yusuf in Kaduna - active', 'active', 22087515.6, 'Rasheed Olanrewaju - approved', '+2347905106950', 'SESS-633143', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-01 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: soc2_evidence
INSERT INTO "soc2_evidence" ("control_id", "category", "title", "evidence_type", "result", "period", "artifacts", "auditor", "status", "created_at") VALUES
  ('CONT-751635', 'corporate', 'Rasheed Olanrewaju - completed', 'enterprise', 'Zainab Mohammed - rejected', '2026-Q4', '{}'::jsonb, 'Chidinma Okafor - processing', 'completed', '2025-10-09 16:36:54'::timestamp),
  ('CONT-506484', 'micro', 'Ngozi Eze - processing', 'enterprise', 'Emmanuel Ogbonna - active', '2026-Q2', '{}'::jsonb, 'Kabiru Aliyu - active', 'completed', '2026-01-27 16:36:54'::timestamp),
  ('CONT-439162', 'micro', 'Nkechi Nwankwo - rejected', 'corporate', 'Kabiru Aliyu - pending', '2026-Q3', '{}'::jsonb, 'Babajide Williams - completed', 'approved', '2025-11-07 16:36:54'::timestamp),
  ('CONT-138995', 'enterprise', 'Chidinma Okafor - completed', 'corporate', 'Muhammed Lawal - completed', '2026-Q1', '{}'::jsonb, 'Aisha Bello - approved', 'approved', '2025-07-22 16:36:54'::timestamp),
  ('CONT-178987', 'premium', 'Abdullahi Sani - pending', 'enterprise', 'Rasheed Olanrewaju - rejected', '2026-Q2', '{}'::jsonb, 'Joy Okonkwo - pending', 'approved', '2026-03-25 16:36:54'::timestamp),
  ('CONT-797811', 'corporate', 'Babajide Williams - completed', 'enterprise', 'Ifeanyi Obi - active', '2026-Q1', '{}'::jsonb, 'Kabiru Aliyu - completed', 'completed', '2025-08-13 16:36:54'::timestamp),
  ('CONT-384630', 'basic', 'Kabiru Aliyu - rejected', 'standard', 'Nkechi Nwankwo - rejected', '2026-Q3', '{}'::jsonb, 'Obinna Igwe - processing', 'pending', '2025-11-29 16:36:54'::timestamp),
  ('CONT-332834', 'corporate', 'Hauwa Yusuf - processing', 'standard', 'Grace Adeniyi - pending', '2026-Q1', '{}'::jsonb, 'Grace Adeniyi - approved', 'rejected', '2025-11-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: soil_analysis
INSERT INTO "soil_analysis" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-364767', 'RECO-616653', 'Halima Usman', 'micro', 'Processed for Oluwaseun Adeyemi in Kaduna - completed', 'processing', 47409941.24, 'Kano', 'REF-662217', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-06 16:36:54'::timestamp, '2025-08-18 16:36:54'::timestamp),
  ('TENA-504706', 'RECO-144076', 'Grace Adeniyi', 'micro', 'Processed for Segun Oladipo in Oyo - pending', 'pending', 48067600.21, 'Oyo', 'REF-532376', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-18 16:36:54'::timestamp, '2025-08-05 16:36:54'::timestamp),
  ('TENA-952177', 'RECO-527421', 'Muhammed Lawal', 'enterprise', 'Processed for Tunde Akinola in Enugu - active', 'completed', 30956206.07, 'Anambra', 'REF-743533', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-08 16:36:54'::timestamp, '2026-04-24 16:36:54'::timestamp),
  ('TENA-910653', 'RECO-876941', 'Grace Adeniyi', 'micro', 'Processed for Blessing Okoro in Kano - processing', 'completed', 19075617.25, 'Kaduna', 'REF-745349', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-31 16:36:54'::timestamp, '2026-04-10 16:36:54'::timestamp),
  ('TENA-405102', 'RECO-649115', 'Muhammed Lawal', 'premium', 'Processed for Blessing Okoro in Delta - rejected', 'processing', 49039131.38, 'Lagos', 'REF-121173', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-14 16:36:54'::timestamp, '2025-05-12 16:36:54'::timestamp),
  ('TENA-173478', 'RECO-771040', 'Hauwa Yusuf', 'standard', 'Processed for Segun Oladipo in Anambra - active', 'rejected', 3896104.33, 'Kaduna', 'REF-653650', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-12 16:36:54'::timestamp, '2025-11-21 16:36:54'::timestamp),
  ('TENA-974833', 'RECO-203062', 'Rasheed Olanrewaju', 'standard', 'Processed for Musa Danjuma in Ogun - approved', 'pending', 18429897.48, 'Lagos', 'REF-443032', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-20 16:36:54'::timestamp, '2025-11-12 16:36:54'::timestamp),
  ('TENA-573886', 'RECO-297298', 'Kabiru Aliyu', 'premium', 'Processed for Fatima Abdulrahman in Abuja - processing', 'processing', 31523969.96, 'Ogun', 'REF-579392', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-16 16:36:54'::timestamp, '2026-01-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sorted_set_rankings
INSERT INTO "sorted_set_rankings" ("name", "members", "topScore", "updateFrequency", "queryLatencyMs", "status", "created_at") VALUES
  ('Ifeanyi Obi', 8538, 1015.86, 'Chidinma Okafor - rejected', 10.07013, 'pending', '2025-05-12 16:36:54'::timestamp),
  ('Zainab Mohammed', 9439, 5277.15, 'Ifeanyi Obi - processing', 8.483801, 'pending', '2025-12-15 16:36:54'::timestamp),
  ('Khadija Musa', 5710, 9211.83, 'Khadija Musa - pending', 7.534085, 'pending', '2025-11-24 16:36:54'::timestamp),
  ('Suleiman Abubakar', 3227, 6509.55, 'Chidinma Okafor - completed', 13.905911, 'completed', '2026-01-24 16:36:54'::timestamp),
  ('Segun Oladipo', 7378, 3665.02, 'Yusuf Ibrahim - completed', 5.787564, 'pending', '2025-11-25 16:36:54'::timestamp),
  ('Abdullahi Sani', 1326, 101.03, 'Victoria Etim - processing', 10.745594, 'approved', '2025-12-28 16:36:54'::timestamp),
  ('Tunde Akinola', 694, 129.57, 'Adebayo Ogundimu - pending', 11.545249, 'completed', '2025-09-26 16:36:54'::timestamp),
  ('Kabiru Aliyu', 2302, 6515.4, 'Ifeanyi Obi - approved', 6.84842, 'rejected', '2025-11-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sql_queries
INSERT INTO "sql_queries" ("original_query", "parameterized", "parameter_count", "execution_count", "avg_latency_ms", "injection_attempts", "blocked", "status", "created_at") VALUES
  ('Halima Usman - processing', false, 206, 267, 8.748054, 4651, 5720, 'completed', '2026-02-07 16:36:54'::timestamp),
  ('Adebayo Ogundimu - rejected', true, 362, 150, 12.49647, 3664, 9532, 'processing', '2026-04-11 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - rejected', false, 434, 448, 9.320689, 3005, 2835, 'active', '2026-03-22 16:36:54'::timestamp),
  ('Folake Bakare - completed', true, 322, 477, 6.386458, 7966, 1009, 'rejected', '2025-07-21 16:36:54'::timestamp),
  ('Segun Oladipo - approved', true, 34, 135, 6.13994, 4726, 4766, 'approved', '2026-04-27 16:36:54'::timestamp),
  ('Amina Garba - completed', false, 36, 466, 12.120404, 1844, 9026, 'rejected', '2025-09-09 16:36:54'::timestamp),
  ('Chioma Nnamdi - completed', true, 227, 152, 9.258814, 4875, 7803, 'pending', '2026-04-27 16:36:54'::timestamp),
  ('Adebayo Ogundimu - completed', true, 310, 219, 9.309928, 4143, 4101, 'active', '2025-11-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sri_hashes
INSERT INTO "sri_hashes" ("resource", "algorithm", "hash", "last_verified", "violations", "cdn_provider", "status", "created_at") VALUES
  ('OFAC', 'Chidinma Okafor - rejected', 'd3587bc53d02606aaaa7cbeacfe1d09ef88201c9ee52d7e7248ce427ce98c5b5', '2025-05-18 16:36:54'::timestamp, 4128, 'Amina Garba - completed', 'pending', '2026-04-14 16:36:54'::timestamp),
  ('CBN', 'Joy Okonkwo - processing', '190da12aefaefa885ed8c2fbf13bdab409dfdec1ca3dc0a9f76822b3e3ed1e7d', '2026-03-09 16:36:54'::timestamp, 1406, 'Chioma Nnamdi - pending', 'processing', '2025-08-12 16:36:54'::timestamp),
  ('NFIU', 'Blessing Okoro - processing', '9b5bdcfebbadf65d00cd8387b0c4e91f9cdcd7b7adfa3c356dc3dfc6ded8f250', '2025-07-27 16:36:54'::timestamp, 7792, 'Emmanuel Ogbonna - pending', 'rejected', '2025-09-27 16:36:54'::timestamp),
  ('OFAC', 'Zainab Mohammed - processing', '4c6c27b3ad8faa1cb694eece0caa5c75fee6aeb4bf52df9a2cadb4d93d12c162', '2025-07-02 16:36:54'::timestamp, 4718, 'Yusuf Ibrahim - completed', 'processing', '2025-10-24 16:36:54'::timestamp),
  ('internal', 'Suleiman Abubakar - pending', '876becf732d250dab9ee1b3a82ac0b411b1efee5caacbda5abed0aa7b976dbb1', '2025-06-29 16:36:54'::timestamp, 7101, 'Obinna Igwe - processing', 'pending', '2026-04-22 16:36:54'::timestamp),
  ('internal', 'Hauwa Yusuf - pending', 'aae0cbbfebddafeede7c49a2cbfd0abdefb51b59bbbf2e6a7ca2ddf54c055e4b', '2025-11-12 16:36:54'::timestamp, 5587, 'Oluwaseun Adeyemi - approved', 'pending', '2025-06-05 16:36:54'::timestamp),
  ('NFIU', 'Aisha Bello - rejected', 'b3a2cf52bcd0aaec31abc6fbc5c4d9a5b6fea5bea98a3ceae53f85dbfa7aac79', '2025-12-25 16:36:54'::timestamp, 6547, 'Nkechi Nwankwo - processing', 'approved', '2025-12-13 16:36:54'::timestamp),
  ('NFIU', 'Khadija Musa - completed', 'fbedf4dae71b5aeafda92812fd32a68fc1ded5cbbf1dab2eecfc2eabaffeadce', '2026-05-04 16:36:54'::timestamp, 479, 'Blessing Okoro - processing', 'approved', '2025-09-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: stream_response_configs
INSERT INTO "stream_response_configs" ("endpoint", "thresholdBytes", "chunksizeKB", "bytesStreamed24h", "memoryReductionPct", "status", "created_at") VALUES
  ('https://api.54bank.ng/stream_response_configs/381746', 7476, 417, 'Muhammed Lawal - active', 'Hauwa Yusuf - active', 'completed', '2025-12-11 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/897000', 8434, 330, 'Joy Okonkwo - approved', 'Hauwa Yusuf - completed', 'approved', '2026-01-11 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/462067', 623, 107, 'Halima Usman - completed', 'Zainab Mohammed - processing', 'approved', '2025-09-04 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/584805', 9624, 222, 'Suleiman Abubakar - active', 'Chukwuemeka Nwosu - processing', 'pending', '2025-07-14 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/727395', 4081, 500, 'Tunde Akinola - completed', 'Segun Oladipo - active', 'pending', '2025-11-17 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/756516', 7699, 227, 'Chukwuemeka Nwosu - pending', 'Ifeanyi Obi - active', 'active', '2025-11-08 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/231463', 7326, 399, 'Grace Adeniyi - rejected', 'Chioma Nnamdi - processing', 'processing', '2025-07-30 16:36:54'::timestamp),
  ('https://api.54bank.ng/stream_response_configs/687766', 496, 335, 'Grace Adeniyi - approved', 'Zainab Mohammed - approved', 'rejected', '2025-09-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: sw_cache_strategies
INSERT INTO "sw_cache_strategies" ("pattern", "strategy", "maxAge", "cacheHitRate", "offlineCapable", "status", "created_at") VALUES
  ('Halima Usman - completed', 'Emmanuel Ogbonna - active', 2397, 'Musa Danjuma - pending', false, 'processing', '2025-10-07 16:36:54'::timestamp),
  ('Nkechi Nwankwo - approved', 'Yusuf Ibrahim - rejected', 1605, 'Chidinma Okafor - approved', false, 'approved', '2026-03-20 16:36:54'::timestamp),
  ('Ngozi Eze - pending', 'Musa Danjuma - completed', 9924, 'Amina Garba - completed', true, 'completed', '2025-08-09 16:36:54'::timestamp),
  ('Ifeanyi Obi - active', 'Yusuf Ibrahim - pending', 1592, 'Suleiman Abubakar - rejected', false, 'rejected', '2025-07-01 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - rejected', 'Segun Oladipo - pending', 5779, 'Emmanuel Ogbonna - approved', true, 'pending', '2026-04-07 16:36:54'::timestamp),
  ('Fatima Abdulrahman - completed', 'Abdullahi Sani - approved', 283, 'Ngozi Eze - completed', true, 'pending', '2025-10-11 16:36:54'::timestamp),
  ('Babajide Williams - approved', 'Grace Adeniyi - rejected', 5525, 'Nkechi Nwankwo - pending', false, 'completed', '2025-08-24 16:36:54'::timestamp),
  ('Kabiru Aliyu - rejected', 'Suleiman Abubakar - approved', 7754, 'Babajide Williams - active', true, 'rejected', '2025-09-11 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: swiftMessages
INSERT INTO "swiftMessages" ("messageId", "tenantId", "messageType", "direction", "senderBic", "receiverBic", "amount", "currency", "valueDate", "rawMessage", "status", "relatedTransferId", "createdAt") VALUES
  ('MESS-904673', 'TENA-381335', 'Processed for Halima Usman in Anambra - approved', 'Nkechi Nwankwo - pending', 'Fatima Abdulrahman - pending', 'Amina Garba - approved', 17915007.09, 'NGN', '2026-01-11 16:36:54'::timestamp, 'Processed for Adebayo Ogundimu in Anambra - processing', 'completed', 'RELA-964759', '2025-12-02 16:36:54'::timestamp),
  ('MESS-120704', 'TENA-537320', 'Processed for Emmanuel Ogbonna in Rivers - active', 'Abdullahi Sani - approved', 'Halima Usman - approved', 'Joy Okonkwo - completed', 25818917.86, 'EUR', '2025-07-26 16:36:54'::timestamp, 'Processed for Rasheed Olanrewaju in Delta - rejected', 'approved', 'RELA-403514', '2025-11-29 16:36:54'::timestamp),
  ('MESS-115367', 'TENA-629082', 'Processed for Ifeanyi Obi in Kano - approved', 'Yusuf Ibrahim - pending', 'Tunde Akinola - approved', 'Tunde Akinola - active', 2061989.25, 'NGN', '2025-12-06 16:36:54'::timestamp, 'Processed for Yusuf Ibrahim in Enugu - active', 'processing', 'RELA-448704', '2026-02-24 16:36:54'::timestamp),
  ('MESS-134236', 'TENA-347647', 'Processed for Aisha Bello in Kano - processing', 'Fatima Abdulrahman - rejected', 'Chidinma Okafor - completed', 'Grace Adeniyi - completed', 11161365.52, 'NGN', '2025-09-03 16:36:54'::timestamp, 'Processed for Blessing Okoro in Rivers - active', 'approved', 'RELA-231159', '2026-01-30 16:36:54'::timestamp),
  ('MESS-731971', 'TENA-367949', 'Processed for Hauwa Yusuf in Delta - processing', 'Suleiman Abubakar - rejected', 'Segun Oladipo - pending', 'Obinna Igwe - pending', 41525947.09, 'EUR', '2025-10-31 16:36:54'::timestamp, 'Processed for Emmanuel Ogbonna in Abuja - rejected', 'processing', 'RELA-770163', '2026-02-16 16:36:54'::timestamp),
  ('MESS-721744', 'TENA-355054', 'Processed for Segun Oladipo in Anambra - pending', 'Chidinma Okafor - rejected', 'Tunde Akinola - completed', 'Fatima Abdulrahman - pending', 35356805.62, 'GBP', '2026-01-11 16:36:54'::timestamp, 'Processed for Obinna Igwe in Anambra - rejected', 'pending', 'RELA-442551', '2025-09-17 16:36:54'::timestamp),
  ('MESS-162728', 'TENA-435453', 'Processed for Khadija Musa in Kaduna - completed', 'Halima Usman - completed', 'Folake Bakare - active', 'Babajide Williams - rejected', 46001668.22, 'GBP', '2025-06-12 16:36:54'::timestamp, 'Processed for Folake Bakare in Enugu - approved', 'rejected', 'RELA-705666', '2025-07-24 16:36:54'::timestamp),
  ('MESS-346765', 'TENA-729687', 'Processed for Aisha Bello in Anambra - processing', 'Rasheed Olanrewaju - pending', 'Folake Bakare - completed', 'Hauwa Yusuf - approved', 13005438.86, 'NGN', '2026-02-18 16:36:54'::timestamp, 'Processed for Segun Oladipo in Lagos - approved', 'pending', 'RELA-737092', '2025-07-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: table_partitions
INSERT INTO "table_partitions" ("tableName", "partitionKey", "partitionType", "activePartitions", "rowsPerPartition", "status", "created_at") VALUES
  ('Nkechi Nwankwo - approved', 'Halima Usman - rejected', 'premium', 4463, 'Ifeanyi Obi - pending', 'pending', '2025-07-03 16:36:54'::timestamp),
  ('Babajide Williams - active', 'Zainab Mohammed - completed', 'enterprise', 4552, 'Amina Garba - rejected', 'active', '2025-06-27 16:36:54'::timestamp),
  ('Aisha Bello - pending', 'Amina Garba - rejected', 'enterprise', 3948, 'Amina Garba - active', 'active', '2026-04-19 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - completed', 'Nkechi Nwankwo - rejected', 'corporate', 6065, 'Babajide Williams - approved', 'pending', '2026-04-10 16:36:54'::timestamp),
  ('Victoria Etim - approved', 'Obinna Igwe - pending', 'basic', 694, 'Yusuf Ibrahim - rejected', 'processing', '2025-08-12 16:36:54'::timestamp),
  ('Blessing Okoro - active', 'Grace Adeniyi - approved', 'premium', 4617, 'Suleiman Abubakar - pending', 'rejected', '2025-08-10 16:36:54'::timestamp),
  ('Chioma Nnamdi - approved', 'Oluwaseun Adeyemi - completed', 'standard', 7267, 'Suleiman Abubakar - pending', 'rejected', '2025-09-21 16:36:54'::timestamp),
  ('Khadija Musa - completed', 'Joy Okonkwo - completed', 'enterprise', 8750, 'Hauwa Yusuf - active', 'approved', '2026-04-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tb_batch_configs
INSERT INTO "tb_batch_configs" ("batchSize", "avgBatchLatencyMs", "throughputTps", "transfersProcessed24h", "status", "created_at") VALUES
  (47, 8.237632, 6694, 9657, 'rejected', '2025-09-10 16:36:54'::timestamp),
  (27, 6.995925, 4744, 4912, 'active', '2025-05-18 16:36:54'::timestamp),
  (398, 11.252367, 7050, 6075, 'processing', '2026-04-07 16:36:54'::timestamp),
  (263, 4.792573, 5405, 9053, 'pending', '2026-04-08 16:36:54'::timestamp),
  (335, 12.646433, 5655, 7104, 'active', '2025-08-24 16:36:54'::timestamp),
  (215, 12.318486, 6570, 169, 'processing', '2025-11-22 16:36:54'::timestamp),
  (71, 6.512562, 6334, 9437, 'approved', '2025-06-28 16:36:54'::timestamp),
  (66, 10.255638, 9300, 6761, 'active', '2026-04-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: telegram_banking_commands
INSERT INTO "telegram_banking_commands" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-423521', 'RECO-797599', 'Adebayo Ogundimu', 'corporate', 'Processed for Halima Usman in Anambra - active', 'completed', 27898428.0, 'Adebayo Ogundimu - approved', '+2347155302446', 'SESS-392019', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-15 16:36:54'::timestamp, '2025-08-11 16:36:54'::timestamp),
  ('TENA-989575', 'RECO-825967', 'Blessing Okoro', 'corporate', 'Processed for Rasheed Olanrewaju in Ogun - processing', 'pending', 6300294.8, 'Muhammed Lawal - approved', '+2348076693675', 'SESS-996570', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-07 16:36:54'::timestamp, '2025-11-18 16:36:54'::timestamp),
  ('TENA-493930', 'RECO-246996', 'Folake Bakare', 'corporate', 'Processed for Kabiru Aliyu in Enugu - processing', 'active', 16569891.98, 'Fatima Abdulrahman - rejected', '+2347708068523', 'SESS-190339', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-12 16:36:54'::timestamp, '2025-10-24 16:36:54'::timestamp),
  ('TENA-474375', 'RECO-317009', 'Ifeanyi Obi', 'basic', 'Processed for Babajide Williams in Rivers - rejected', 'processing', 38768713.2, 'Nkechi Nwankwo - approved', '+2347890142619', 'SESS-236421', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-25 16:36:54'::timestamp, '2025-11-23 16:36:54'::timestamp),
  ('TENA-906673', 'RECO-316132', 'Zainab Mohammed', 'premium', 'Processed for Joy Okonkwo in Lagos - active', 'completed', 39804381.26, 'Joy Okonkwo - active', '+2348145439314', 'SESS-156943', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-20 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp),
  ('TENA-920318', 'RECO-933064', 'Obinna Igwe', 'premium', 'Processed for Joy Okonkwo in Kaduna - active', 'active', 16376249.71, 'Segun Oladipo - processing', '+2347335728780', 'SESS-231801', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-19 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp),
  ('TENA-418630', 'RECO-929767', 'Kabiru Aliyu', 'enterprise', 'Processed for Ngozi Eze in Enugu - rejected', 'rejected', 45562435.23, 'Grace Adeniyi - rejected', '+2349041505468', 'SESS-174828', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2026-04-13 16:36:54'::timestamp),
  ('TENA-797936', 'RECO-632998', 'Chukwuemeka Nwosu', 'micro', 'Processed for Musa Danjuma in Ogun - approved', 'pending', 23235446.06, 'Khadija Musa - completed', '+2348442154715', 'SESS-259487', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-17 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: telegram_bot_gateway
INSERT INTO "telegram_bot_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-882923', 'RECO-304277', 'Yusuf Ibrahim', 'premium', 'Processed for Fatima Abdulrahman in Oyo - completed', 'active', 13601192.91, 'Ngozi Eze - rejected', '+2348649872076', 'SESS-552195', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-28 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('TENA-171290', 'RECO-536573', 'Ifeanyi Obi', 'premium', 'Processed for Abdullahi Sani in Kano - pending', 'processing', 3067744.58, 'Oluwaseun Adeyemi - processing', '+2347529741061', 'SESS-588084', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-05 16:36:54'::timestamp, '2025-09-20 16:36:54'::timestamp),
  ('TENA-462442', 'RECO-739204', 'Segun Oladipo', 'standard', 'Processed for Emmanuel Ogbonna in Anambra - completed', 'pending', 23678667.77, 'Nkechi Nwankwo - rejected', '+2349050111324', 'SESS-182577', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-01 16:36:54'::timestamp, '2025-08-26 16:36:54'::timestamp),
  ('TENA-939846', 'RECO-897084', 'Oluwaseun Adeyemi', 'premium', 'Processed for Kabiru Aliyu in Kano - rejected', 'active', 48282807.28, 'Fatima Abdulrahman - rejected', '+2347337515416', 'SESS-714440', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-29 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp),
  ('TENA-329702', 'RECO-664915', 'Amina Garba', 'standard', 'Processed for Blessing Okoro in Rivers - processing', 'active', 47196199.81, 'Nkechi Nwankwo - completed', '+2349099328206', 'SESS-300357', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-06 16:36:54'::timestamp, '2025-09-17 16:36:54'::timestamp),
  ('TENA-431515', 'RECO-763794', 'Rasheed Olanrewaju', 'basic', 'Processed for Kabiru Aliyu in Abuja - pending', 'active', 22290446.48, 'Kabiru Aliyu - approved', '+2348254197230', 'SESS-650003', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-16 16:36:54'::timestamp, '2026-01-08 16:36:54'::timestamp),
  ('TENA-503692', 'RECO-534567', 'Musa Danjuma', 'micro', 'Processed for Segun Oladipo in Enugu - active', 'rejected', 1758185.57, 'Grace Adeniyi - processing', '+2349009969831', 'SESS-351141', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-27 16:36:54'::timestamp, '2025-12-26 16:36:54'::timestamp),
  ('TENA-630957', 'RECO-840239', 'Suleiman Abubakar', 'standard', 'Processed for Fatima Abdulrahman in Rivers - pending', 'completed', 16016776.51, 'Kabiru Aliyu - completed', '+2347780106152', 'SESS-127882', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-22 16:36:54'::timestamp, '2026-03-15 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: telegram_kyc_bot
INSERT INTO "telegram_kyc_bot" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-487418', 'RECO-594149', 'Blessing Okoro', 'premium', 'Processed for Yusuf Ibrahim in Oyo - rejected', 'pending', 9286026.95, 'Hauwa Yusuf - active', '+2348026866379', 'SESS-186260', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-14 16:36:54'::timestamp, '2026-05-05 16:36:54'::timestamp),
  ('TENA-565375', 'RECO-176442', 'Fatima Abdulrahman', 'corporate', 'Processed for Adebayo Ogundimu in Kaduna - processing', 'approved', 4922069.53, 'Aisha Bello - active', '+2347688149758', 'SESS-425362', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-12 16:36:54'::timestamp, '2025-12-03 16:36:54'::timestamp),
  ('TENA-164436', 'RECO-183803', 'Emmanuel Ogbonna', 'enterprise', 'Processed for Hauwa Yusuf in Kaduna - pending', 'rejected', 24908307.01, 'Abdullahi Sani - rejected', '+2347674682693', 'SESS-333755', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-30 16:36:54'::timestamp, '2025-10-18 16:36:54'::timestamp),
  ('TENA-200471', 'RECO-693916', 'Kabiru Aliyu', 'corporate', 'Processed for Zainab Mohammed in Enugu - processing', 'approved', 41505452.18, 'Chidinma Okafor - processing', '+2347753690666', 'SESS-740595', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-18 16:36:54'::timestamp, '2025-11-19 16:36:54'::timestamp),
  ('TENA-937857', 'RECO-719590', 'Khadija Musa', 'micro', 'Processed for Halima Usman in Delta - approved', 'active', 25696479.18, 'Fatima Abdulrahman - rejected', '+2348478093868', 'SESS-741963', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-01 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp),
  ('TENA-983385', 'RECO-624029', 'Grace Adeniyi', 'premium', 'Processed for Halima Usman in Ogun - completed', 'active', 44241360.6, 'Chukwuemeka Nwosu - rejected', '+2347205983468', 'SESS-674177', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-02 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp),
  ('TENA-774314', 'RECO-584266', 'Chukwuemeka Nwosu', 'corporate', 'Processed for Ifeanyi Obi in Anambra - approved', 'processing', 40056645.33, 'Fatima Abdulrahman - processing', '+2347449364419', 'SESS-396288', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-24 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp),
  ('TENA-953593', 'RECO-365053', 'Emmanuel Ogbonna', 'basic', 'Processed for Adebayo Ogundimu in Enugu - completed', 'approved', 28467515.17, 'Folake Bakare - active', '+2347250453726', 'SESS-145386', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-16 16:36:54'::timestamp, '2025-06-22 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: telegram_mini_app
INSERT INTO "telegram_mini_app" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-247064', 'RECO-437032', 'Babajide Williams', 'micro', 'Processed for Babajide Williams in Anambra - active', 'approved', 42732259.56, 'Muhammed Lawal - processing', '+2347778570576', 'SESS-856442', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-12 16:36:54'::timestamp, '2026-01-20 16:36:54'::timestamp),
  ('TENA-383915', 'RECO-945444', 'Chioma Nnamdi', 'premium', 'Processed for Muhammed Lawal in Kaduna - pending', 'processing', 23312638.27, 'Amina Garba - processing', '+2347742559938', 'SESS-553090', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-17 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp),
  ('TENA-305439', 'RECO-763183', 'Chukwuemeka Nwosu', 'micro', 'Processed for Abdullahi Sani in Delta - completed', 'processing', 49687674.52, 'Oluwaseun Adeyemi - processing', '+2349064342537', 'SESS-296074', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-26 16:36:54'::timestamp, '2025-09-16 16:36:54'::timestamp),
  ('TENA-609027', 'RECO-441468', 'Fatima Abdulrahman', 'standard', 'Processed for Yusuf Ibrahim in Delta - processing', 'completed', 39635980.76, 'Chioma Nnamdi - rejected', '+2348593766454', 'SESS-123996', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-08 16:36:54'::timestamp, '2025-10-05 16:36:54'::timestamp),
  ('TENA-685975', 'RECO-893155', 'Oluwaseun Adeyemi', 'corporate', 'Processed for Tunde Akinola in Abuja - pending', 'completed', 18505843.48, 'Muhammed Lawal - completed', '+2347292209761', 'SESS-842108', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-23 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp),
  ('TENA-852981', 'RECO-388392', 'Suleiman Abubakar', 'standard', 'Processed for Grace Adeniyi in Lagos - active', 'processing', 2725127.0, 'Segun Oladipo - completed', '+2348730496526', 'SESS-671021', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-20 16:36:54'::timestamp, '2026-03-08 16:36:54'::timestamp),
  ('TENA-289775', 'RECO-108899', 'Oluwaseun Adeyemi', 'standard', 'Processed for Tunde Akinola in Oyo - pending', 'pending', 91878.75, 'Joy Okonkwo - rejected', '+2347924819904', 'SESS-215724', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-30 16:36:54'::timestamp, '2026-04-30 16:36:54'::timestamp),
  ('TENA-720461', 'RECO-952560', 'Yusuf Ibrahim', 'standard', 'Processed for Joy Okonkwo in Rivers - approved', 'approved', 7686161.51, 'Blessing Okoro - processing', '+2348006154071', 'SESS-183577', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-19 16:36:54'::timestamp, '2025-09-04 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: telegram_notification
INSERT INTO "telegram_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-226504', 'RECO-581935', 'Zainab Mohammed', 'micro', 'Processed for Fatima Abdulrahman in Ogun - completed', 'processing', 15123477.67, 'Blessing Okoro - active', '+2348492225895', 'SESS-989944', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-14 16:36:54'::timestamp, '2025-08-03 16:36:54'::timestamp),
  ('TENA-359862', 'RECO-278582', 'Blessing Okoro', 'basic', 'Processed for Joy Okonkwo in Abuja - rejected', 'rejected', 17980183.98, 'Khadija Musa - completed', '+2348107912816', 'SESS-677079', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-18 16:36:54'::timestamp, '2025-10-01 16:36:54'::timestamp),
  ('TENA-912220', 'RECO-492843', 'Oluwaseun Adeyemi', 'micro', 'Processed for Adebayo Ogundimu in Enugu - completed', 'pending', 46189217.95, 'Adebayo Ogundimu - rejected', '+2347534607351', 'SESS-997811', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-18 16:36:54'::timestamp, '2026-04-19 16:36:54'::timestamp),
  ('TENA-720127', 'RECO-915148', 'Fatima Abdulrahman', 'standard', 'Processed for Muhammed Lawal in Kano - pending', 'approved', 37605242.38, 'Amina Garba - active', '+2347101921701', 'SESS-681105', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-17 16:36:54'::timestamp, '2025-05-15 16:36:54'::timestamp),
  ('TENA-821325', 'RECO-670746', 'Muhammed Lawal', 'enterprise', 'Processed for Nkechi Nwankwo in Lagos - pending', 'active', 24569872.31, 'Obinna Igwe - pending', '+2348259591922', 'SESS-758420', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-05 16:36:54'::timestamp, '2025-06-13 16:36:54'::timestamp),
  ('TENA-908632', 'RECO-142530', 'Rasheed Olanrewaju', 'enterprise', 'Processed for Fatima Abdulrahman in Enugu - approved', 'completed', 21249714.4, 'Chioma Nnamdi - approved', '+2348688095878', 'SESS-937969', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-30 16:36:54'::timestamp, '2026-03-30 16:36:54'::timestamp),
  ('TENA-165829', 'RECO-174022', 'Chukwuemeka Nwosu', 'micro', 'Processed for Halima Usman in Oyo - completed', 'active', 26696569.49, 'Babajide Williams - completed', '+2347479307180', 'SESS-207537', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-19 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-436696', 'RECO-895544', 'Chidinma Okafor', 'standard', 'Processed for Chidinma Okafor in Ogun - processing', 'active', 17711307.88, 'Oluwaseun Adeyemi - pending', '+2347051977766', 'SESS-910255', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-13 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tellerSessions
INSERT INTO "tellerSessions" ("sessionId", "tenantId", "tellerId", "tellerName", "branchCode", "branchName", "windowNumber", "status", "openedAt", "closedAt", "openingBalance", "currentBalance", "transactionCount", "cashDrawer", "createdAt", "updatedAt") VALUES
  ('SESS-299777', 'TENA-663664', 'TELL-869027', 'Khadija Musa - pending', 'BR-LG90', 'Obinna Igwe - processing', 5170, 'processing', 'Suleiman Abubakar - approved', 'Chukwuemeka Nwosu - rejected', 20478097.48, 43763563.09, 146, '{}'::jsonb, '2026-03-31 16:36:54'::timestamp, '2026-05-12 16:36:54'::timestamp),
  ('SESS-742639', 'TENA-901193', 'TELL-729939', 'Oluwaseun Adeyemi - completed', 'BR-OY14', 'Abdullahi Sani - pending', 2694, 'rejected', 'Halima Usman - completed', 'Abdullahi Sani - approved', 14459183.83, 43023314.58, 94, '{}'::jsonb, '2026-03-17 16:36:54'::timestamp, '2025-10-24 16:36:54'::timestamp),
  ('SESS-966126', 'TENA-561302', 'TELL-252348', 'Zainab Mohammed - pending', 'BR-AB18', 'Adebayo Ogundimu - processing', 3225, 'active', 'Zainab Mohammed - rejected', 'Musa Danjuma - approved', 41880565.78, 30571099.28, 114, '{}'::jsonb, '2026-04-07 16:36:54'::timestamp, '2025-12-05 16:36:54'::timestamp),
  ('SESS-604952', 'TENA-502957', 'TELL-130804', 'Kabiru Aliyu - rejected', 'BR-OY32', 'Nkechi Nwankwo - processing', 8951, 'completed', 'Segun Oladipo - processing', 'Folake Bakare - active', 3261615.6, 5250205.23, 485, '{}'::jsonb, '2025-07-02 16:36:54'::timestamp, '2025-09-20 16:36:54'::timestamp),
  ('SESS-924026', 'TENA-834384', 'TELL-156577', 'Ngozi Eze - completed', 'BR-RV37', 'Zainab Mohammed - active', 4183, 'completed', 'Khadija Musa - active', 'Chioma Nnamdi - completed', 30094785.99, 2026577.14, 194, '{}'::jsonb, '2026-03-05 16:36:54'::timestamp, '2025-05-18 16:36:54'::timestamp),
  ('SESS-271159', 'TENA-658612', 'TELL-474736', 'Chioma Nnamdi - rejected', 'BR-OY75', 'Joy Okonkwo - completed', 2173, 'approved', 'Emmanuel Ogbonna - processing', 'Joy Okonkwo - active', 15840740.82, 31282349.18, 328, '{}'::jsonb, '2026-04-12 16:36:54'::timestamp, '2025-08-04 16:36:54'::timestamp),
  ('SESS-965613', 'TENA-427303', 'TELL-115486', 'Chioma Nnamdi - approved', 'BR-OY33', 'Hauwa Yusuf - completed', 5501, 'processing', 'Fatima Abdulrahman - active', 'Fatima Abdulrahman - approved', 17379727.75, 5262732.34, 254, '{}'::jsonb, '2025-06-18 16:36:54'::timestamp, '2025-12-22 16:36:54'::timestamp),
  ('SESS-641374', 'TENA-938829', 'TELL-114866', 'Kabiru Aliyu - pending', 'BR-AB28', 'Khadija Musa - rejected', 1644, 'processing', 'Khadija Musa - completed', 'Ngozi Eze - rejected', 25661452.99, 12428549.42, 433, '{}'::jsonb, '2025-07-06 16:36:54'::timestamp, '2026-05-08 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tellerTransactions
INSERT INTO "tellerTransactions" ("txnId", "sessionId", "tenantId", "txnType", "customerId", "amount", "currency", "reference", "status", "processedAt", "createdAt") VALUES
  ('TXN-995398', 'SESS-956652', 'TENA-973495', 'enterprise', 'CUST-415928', 39018679.66, 'USD', 'REF-922148', 'processing', 'Ngozi Eze - approved', '2025-05-13 16:36:54'::timestamp),
  ('TXN-221659', 'SESS-458603', 'TENA-840611', 'basic', 'CUST-764895', 17272996.41, 'GBP', 'REF-890206', 'pending', 'Hauwa Yusuf - active', '2026-01-11 16:36:54'::timestamp),
  ('TXN-387647', 'SESS-867769', 'TENA-690766', 'basic', 'CUST-615409', 18378548.83, 'NGN', 'REF-397091', 'active', 'Segun Oladipo - rejected', '2025-06-06 16:36:54'::timestamp),
  ('TXN-327396', 'SESS-931619', 'TENA-787001', 'corporate', 'CUST-189643', 47320686.38, 'USD', 'REF-312406', 'processing', 'Tunde Akinola - rejected', '2025-08-26 16:36:54'::timestamp),
  ('TXN-511667', 'SESS-798431', 'TENA-458404', 'premium', 'CUST-536530', 18404320.74, 'NGN', 'REF-920242', 'active', 'Ifeanyi Obi - active', '2025-07-31 16:36:54'::timestamp),
  ('TXN-283262', 'SESS-307139', 'TENA-664042', 'basic', 'CUST-521101', 13464782.75, 'USD', 'REF-461940', 'approved', 'Chioma Nnamdi - completed', '2026-01-01 16:36:54'::timestamp),
  ('TXN-116939', 'SESS-841851', 'TENA-807801', 'standard', 'CUST-952693', 38546719.05, 'USD', 'REF-808542', 'rejected', 'Grace Adeniyi - rejected', '2025-06-24 16:36:54'::timestamp),
  ('TXN-642941', 'SESS-801255', 'TENA-460123', 'micro', 'CUST-259442', 34079633.14, 'USD', 'REF-909656', 'active', 'Chukwuemeka Nwosu - rejected', '2026-01-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: temporal_memoized_activities
INSERT INTO "temporal_memoized_activities" ("workflow", "activity", "replaySpeedup", "cacheTTL", "cacheHitRate", "status", "created_at") VALUES
  ('Grace Adeniyi - completed', 'Zainab Mohammed - completed', 'Nkechi Nwankwo - completed', 'Adebayo Ogundimu - completed', 'Ifeanyi Obi - rejected', 'processing', '2025-10-14 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - processing', 'Emmanuel Ogbonna - approved', 'Kabiru Aliyu - completed', 'Aisha Bello - completed', 'Hauwa Yusuf - rejected', 'active', '2025-10-02 16:36:54'::timestamp),
  ('Victoria Etim - completed', 'Joy Okonkwo - rejected', 'Khadija Musa - active', 'Nkechi Nwankwo - active', 'Ifeanyi Obi - approved', 'pending', '2025-12-03 16:36:54'::timestamp),
  ('Khadija Musa - completed', 'Amina Garba - rejected', 'Adebayo Ogundimu - pending', 'Yusuf Ibrahim - completed', 'Suleiman Abubakar - completed', 'approved', '2025-07-14 16:36:54'::timestamp),
  ('Tunde Akinola - rejected', 'Victoria Etim - rejected', 'Yusuf Ibrahim - approved', 'Kabiru Aliyu - completed', 'Babajide Williams - completed', 'processing', '2025-07-14 16:36:54'::timestamp),
  ('Blessing Okoro - active', 'Muhammed Lawal - approved', 'Abdullahi Sani - active', 'Babajide Williams - active', 'Khadija Musa - rejected', 'rejected', '2025-08-02 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu - pending', 'Fatima Abdulrahman - rejected', 'Suleiman Abubakar - approved', 'Folake Bakare - rejected', 'Segun Oladipo - processing', 'approved', '2025-11-13 16:36:54'::timestamp),
  ('Kabiru Aliyu - approved', 'Hauwa Yusuf - completed', 'Blessing Okoro - active', 'Amina Garba - completed', 'Adebayo Ogundimu - completed', 'rejected', '2026-03-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tenantFeatureFlags
INSERT INTO "tenantFeatureFlags" ("tenantId", "featureKey", "label", "category", "description", "enabled", "rolloutStage", "adminManaged", "dependsOn", "createdAt", "updatedAt") VALUES
  ('TENA-107617', 'Yusuf Ibrahim - approved', 'Zainab Mohammed - pending', 'enterprise', 'Processed for Zainab Mohammed in Lagos - approved', 3836, 'Blessing Okoro - completed', 3857, '{}'::jsonb, '2026-03-06 16:36:54'::timestamp, '2025-08-28 16:36:54'::timestamp),
  ('TENA-128891', 'Amina Garba - active', 'Blessing Okoro - rejected', 'corporate', 'Processed for Hauwa Yusuf in Enugu - approved', 6524, 'Musa Danjuma - active', 6268, '{}'::jsonb, '2026-05-11 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp),
  ('TENA-653280', 'Joy Okonkwo - completed', 'Ifeanyi Obi - completed', 'corporate', 'Processed for Tunde Akinola in Anambra - pending', 3319, 'Yusuf Ibrahim - processing', 6122, '{}'::jsonb, '2026-01-30 16:36:54'::timestamp, '2025-11-19 16:36:54'::timestamp),
  ('TENA-572580', 'Fatima Abdulrahman - pending', 'Segun Oladipo - pending', 'corporate', 'Processed for Ifeanyi Obi in Enugu - approved', 5592, 'Nkechi Nwankwo - completed', 2122, '{}'::jsonb, '2026-01-04 16:36:54'::timestamp, '2026-03-21 16:36:54'::timestamp),
  ('TENA-384884', 'Kabiru Aliyu - approved', 'Muhammed Lawal - completed', 'enterprise', 'Processed for Ifeanyi Obi in Anambra - processing', 1838, 'Joy Okonkwo - approved', 3848, '{}'::jsonb, '2025-10-08 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('TENA-402030', 'Ifeanyi Obi - active', 'Emmanuel Ogbonna - active', 'micro', 'Processed for Aisha Bello in Kaduna - active', 4212, 'Rasheed Olanrewaju - approved', 4740, '{}'::jsonb, '2025-07-27 16:36:54'::timestamp, '2026-02-12 16:36:54'::timestamp),
  ('TENA-736756', 'Chukwuemeka Nwosu - pending', 'Adebayo Ogundimu - active', 'basic', 'Processed for Halima Usman in Abuja - rejected', 2801, 'Adebayo Ogundimu - completed', 9970, '{}'::jsonb, '2026-04-22 16:36:54'::timestamp, '2026-05-06 16:36:54'::timestamp),
  ('TENA-519557', 'Muhammed Lawal - pending', 'Victoria Etim - pending', 'premium', 'Processed for Chidinma Okafor in Ogun - completed', 7942, 'Tunde Akinola - rejected', 280, '{}'::jsonb, '2025-10-10 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tenants
INSERT INTO "tenants" ("tenantId", "name", "onboardingStatus", "segment", "region", "enabledModules", "whiteLabel", "createdAt", "updatedAt") VALUES
  ('TENA-610806', 'Blessing Okoro', 'completed', 'micro', 'Rivers', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2026-01-15 16:36:54'::timestamp, '2026-01-05 16:36:54'::timestamp),
  ('TENA-733481', 'Grace Adeniyi', 'rejected', 'enterprise', 'Enugu', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-06-14 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp),
  ('TENA-610443', 'Halima Usman', 'rejected', 'standard', 'Anambra', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2026-02-15 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp),
  ('TENA-287263', 'Ngozi Eze', 'active', 'micro', 'Enugu', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-12-24 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp),
  ('TENA-637294', 'Chioma Nnamdi', 'approved', 'corporate', 'Kano', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-10-23 16:36:54'::timestamp, '2026-01-08 16:36:54'::timestamp),
  ('TENA-746480', 'Chidinma Okafor', 'approved', 'corporate', 'Abuja', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-06-18 16:36:54'::timestamp, '2025-09-23 16:36:54'::timestamp),
  ('TENA-633650', 'Nkechi Nwankwo', 'processing', 'micro', 'Anambra', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-06-16 16:36:54'::timestamp, '2025-12-11 16:36:54'::timestamp),
  ('TENA-965107', 'Chukwuemeka Nwosu', 'pending', 'enterprise', 'Enugu', '["core_banking", "payments", "kyc", "aml"]'::jsonb, '{"displayName": "54Bank", "primaryColor": "#1a5276"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-12-07 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: tls_configs
INSERT INTO "tls_configs" ("domain", "protocol", "cipher_suites", "cert_expiry", "ocsp_stapling", "hsts_preload", "handshakes_24h", "status", "created_at") VALUES
  ('Nkechi Nwankwo - processing', 'Fatima Abdulrahman - approved', '{}'::jsonb, '2025-12-10 16:36:54'::timestamp, false, true, 2933, 'approved', '2025-08-11 16:36:54'::timestamp),
  ('Fatima Abdulrahman - processing', 'Aisha Bello - completed', '{}'::jsonb, '2025-12-27 16:36:54'::timestamp, false, true, 8537, 'rejected', '2025-10-22 16:36:54'::timestamp),
  ('Hauwa Yusuf - active', 'Adebayo Ogundimu - pending', '{}'::jsonb, '2025-10-17 16:36:54'::timestamp, true, true, 6166, 'pending', '2025-08-22 16:36:54'::timestamp),
  ('Aisha Bello - processing', 'Chioma Nnamdi - rejected', '{}'::jsonb, '2025-09-17 16:36:54'::timestamp, true, false, 405, 'rejected', '2025-11-01 16:36:54'::timestamp),
  ('Abdullahi Sani - approved', 'Amina Garba - completed', '{}'::jsonb, '2025-07-01 16:36:54'::timestamp, false, true, 196, 'completed', '2025-11-06 16:36:54'::timestamp),
  ('Nkechi Nwankwo - approved', 'Joy Okonkwo - rejected', '{}'::jsonb, '2026-03-08 16:36:54'::timestamp, true, false, 1950, 'active', '2025-07-20 16:36:54'::timestamp),
  ('Folake Bakare - completed', 'Aisha Bello - pending', '{}'::jsonb, '2025-06-19 16:36:54'::timestamp, false, false, 6679, 'pending', '2026-03-04 16:36:54'::timestamp),
  ('Kabiru Aliyu - approved', 'Rasheed Olanrewaju - pending', '{}'::jsonb, '2026-04-25 16:36:54'::timestamp, false, true, 1537, 'completed', '2026-01-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: token_families
INSERT INTO "token_families" ("family_id", "user_id", "client_id", "generation", "max_generations", "replay_detected", "revoked_descendants", "status", "created_at") VALUES
  ('FAMI-263255', 'USER-681702', 'CLIE-508272', 8045, 3890, false, 6134, 'active', '2025-07-25 16:36:54'::timestamp),
  ('FAMI-597866', 'USER-816367', 'CLIE-766944', 2690, 8312, true, 7497, 'approved', '2026-04-18 16:36:54'::timestamp),
  ('FAMI-369035', 'USER-408794', 'CLIE-227552', 3171, 8403, true, 1809, 'rejected', '2025-08-23 16:36:54'::timestamp),
  ('FAMI-992531', 'USER-995505', 'CLIE-940905', 2301, 5400, false, 3174, 'rejected', '2025-05-30 16:36:54'::timestamp),
  ('FAMI-129018', 'USER-542249', 'CLIE-675271', 1785, 8985, true, 5300, 'completed', '2026-04-29 16:36:54'::timestamp),
  ('FAMI-300686', 'USER-128086', 'CLIE-216756', 1112, 9626, true, 6454, 'active', '2025-09-08 16:36:54'::timestamp),
  ('FAMI-998777', 'USER-447446', 'CLIE-886207', 4267, 8064, true, 8224, 'processing', '2026-02-22 16:36:54'::timestamp),
  ('FAMI-262261', 'USER-451829', 'CLIE-605466', 7106, 2793, true, 6120, 'processing', '2025-06-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: transaction_alerts
INSERT INTO "transaction_alerts" ("rule_id", "customer_id", "alert_type", "severity", "amount_ngn", "description", "status", "assigned_to", "resolved_at", "created_at") VALUES
  (3395, 'CUST-321406', 'standard', 'low', 13947021.58, 'Processed for Amina Garba in Kaduna - approved', 'active', 'Yusuf Ibrahim - pending', '2025-08-06 16:36:54'::timestamp, '2026-01-16 16:36:54'::timestamp),
  (189, 'CUST-534833', 'corporate', 'warning', 5705739.78, 'Processed for Rasheed Olanrewaju in Abuja - completed', 'approved', 'Folake Bakare - approved', '2025-05-28 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp),
  (1593, 'CUST-807118', 'corporate', 'warning', 5175466.6, 'Processed for Zainab Mohammed in Oyo - completed', 'rejected', 'Obinna Igwe - rejected', '2026-04-29 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  (6143, 'CUST-548775', 'micro', 'info', 12398607.07, 'Processed for Abdullahi Sani in Lagos - active', 'completed', 'Yusuf Ibrahim - approved', '2026-02-01 16:36:54'::timestamp, '2026-03-01 16:36:54'::timestamp),
  (5860, 'CUST-152067', 'enterprise', 'high', 7679794.72, 'Processed for Hauwa Yusuf in Enugu - active', 'pending', 'Adebayo Ogundimu - processing', '2026-04-04 16:36:54'::timestamp, '2025-05-14 16:36:54'::timestamp),
  (8984, 'CUST-535610', 'premium', 'warning', 42326894.09, 'Processed for Chukwuemeka Nwosu in Lagos - completed', 'rejected', 'Joy Okonkwo - active', '2025-08-06 16:36:54'::timestamp, '2025-10-26 16:36:54'::timestamp),
  (5058, 'CUST-205285', 'premium', 'critical', 37716918.91, 'Processed for Folake Bakare in Kano - approved', 'pending', 'Ngozi Eze - rejected', '2025-07-30 16:36:54'::timestamp, '2025-12-19 16:36:54'::timestamp),
  (407, 'CUST-756866', 'basic', 'info', 476685.27, 'Processed for Victoria Etim in Abuja - active', 'rejected', 'Victoria Etim - approved', '2025-08-18 16:36:54'::timestamp, '2025-10-12 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: transaction_monitoring_rules
INSERT INTO "transaction_monitoring_rules" ("name", "category", "scenario_code", "description", "risk_score_impact", "enabled", "cbn_prescribed", "threshold_config", "created_at", "updated_at") VALUES
  ('Folake Bakare', 'standard', 'CODE-466873', 'Processed for Grace Adeniyi in Abuja - processing', 95, 9624, 4158, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-25 16:36:54'::timestamp, '2025-12-08 16:36:54'::timestamp),
  ('Rasheed Olanrewaju', 'basic', 'CODE-732688', 'Processed for Khadija Musa in Delta - processing', 92, 5395, 2658, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-29 16:36:54'::timestamp, '2025-10-28 16:36:54'::timestamp),
  ('Khadija Musa', 'basic', 'CODE-370715', 'Processed for Nkechi Nwankwo in Lagos - approved', 47, 66, 8035, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-31 16:36:54'::timestamp, '2025-09-01 16:36:54'::timestamp),
  ('Halima Usman', 'corporate', 'CODE-560790', 'Processed for Ngozi Eze in Enugu - active', 69, 985, 4118, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-10 16:36:54'::timestamp, '2025-07-18 16:36:54'::timestamp),
  ('Adebayo Ogundimu', 'premium', 'CODE-286805', 'Processed for Babajide Williams in Rivers - active', 71, 6534, 5309, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-16 16:36:54'::timestamp, '2025-06-26 16:36:54'::timestamp),
  ('Chukwuemeka Nwosu', 'enterprise', 'CODE-290221', 'Processed for Suleiman Abubakar in Abuja - rejected', 85, 8627, 3321, '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-24 16:36:54'::timestamp, '2025-07-01 16:36:54'::timestamp),
  ('Muhammed Lawal', 'enterprise', 'CODE-842980', 'Processed for Ifeanyi Obi in Kaduna - processing', 90, 4552, 4359, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-14 16:36:54'::timestamp, '2026-02-25 16:36:54'::timestamp),
  ('Folake Bakare', 'basic', 'CODE-784229', 'Processed for Suleiman Abubakar in Abuja - rejected', 21, 5665, 4452, '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-27 16:36:54'::timestamp, '2025-10-06 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: transactions
INSERT INTO "transactions" ("transactionId", "accountId", "tenantId", "type", "amount", "currency", "narration", "reference", "channel", "counterpartyAccountId", "counterpartyName", "balanceAfter", "status", "valueDate", "createdAt") VALUES
  ('TRAN-541011', 'ACCO-992293', 'TENA-436275', 'standard', 17105971.39, 'USD', 'Babajide Williams - active', 'REF-942546', 'Fatima Abdulrahman - pending', 'COUN-196790', 'Tunde Akinola - active', 26156410.67, 'rejected', '2025-12-10 16:36:54'::timestamp, '2026-02-15 16:36:54'::timestamp),
  ('TRAN-217912', 'ACCO-591234', 'TENA-925487', 'standard', 48716674.05, 'GBP', 'Chukwuemeka Nwosu - completed', 'REF-224169', 'Chukwuemeka Nwosu - completed', 'COUN-554072', 'Segun Oladipo - approved', 16767499.18, 'completed', '2025-09-13 16:36:54'::timestamp, '2025-08-21 16:36:54'::timestamp),
  ('TRAN-338735', 'ACCO-223598', 'TENA-571391', 'standard', 9704743.15, 'USD', 'Chukwuemeka Nwosu - rejected', 'REF-737756', 'Nkechi Nwankwo - rejected', 'COUN-415159', 'Chidinma Okafor - pending', 7104011.0, 'active', '2025-10-07 16:36:54'::timestamp, '2025-12-25 16:36:54'::timestamp),
  ('TRAN-346630', 'ACCO-454821', 'TENA-308044', 'premium', 23876107.08, 'USD', 'Muhammed Lawal - pending', 'REF-560980', 'Victoria Etim - active', 'COUN-140529', 'Victoria Etim - completed', 13023547.5, 'pending', '2025-10-26 16:36:54'::timestamp, '2025-09-30 16:36:54'::timestamp),
  ('TRAN-530774', 'ACCO-113781', 'TENA-894618', 'corporate', 33371063.6, 'GBP', 'Suleiman Abubakar - pending', 'REF-804134', 'Chioma Nnamdi - pending', 'COUN-206053', 'Chioma Nnamdi - pending', 47217962.26, 'approved', '2025-10-03 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp),
  ('TRAN-630036', 'ACCO-819881', 'TENA-342822', 'basic', 46032332.75, 'GBP', 'Amina Garba - processing', 'REF-234664', 'Musa Danjuma - active', 'COUN-898385', 'Obinna Igwe - processing', 23928869.6, 'approved', '2025-08-27 16:36:54'::timestamp, '2025-08-17 16:36:54'::timestamp),
  ('TRAN-840560', 'ACCO-180121', 'TENA-763894', 'corporate', 26865248.0, 'NGN', 'Chidinma Okafor - processing', 'REF-878827', 'Muhammed Lawal - active', 'COUN-337961', 'Amina Garba - processing', 31043456.47, 'approved', '2025-09-09 16:36:54'::timestamp, '2025-08-15 16:36:54'::timestamp),
  ('TRAN-905640', 'ACCO-850122', 'TENA-701935', 'basic', 28128188.49, 'GBP', 'Amina Garba - active', 'REF-866851', 'Abdullahi Sani - approved', 'COUN-278585', 'Zainab Mohammed - completed', 21096742.35, 'pending', '2025-12-03 16:36:54'::timestamp, '2026-03-03 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: transfers
INSERT INTO "transfers" ("transferId", "tenantId", "sourceAccountId", "destinationAccountId", "destinationBank", "destinationAccountNumber", "beneficiaryName", "amount", "currency", "channel", "narration", "nipSessionId", "mojaloopTransferId", "status", "failureReason", "idempotencyKey", "transferDate", "completedAt", "createdAt") VALUES
  ('TRAN-504637', 'TENA-548260', 'SOUR-970074', 'DEST-789295', 'Aisha Bello - processing', 'Ifeanyi Obi - rejected', 'Aisha Bello - completed', 15574094.9, 'USD', 'Folake Bakare - active', 'Grace Adeniyi - approved', 'NIPS-596588', 'MOJA-618382', 'completed', 'Processed for Kabiru Aliyu in Enugu - completed', 'Khadija Musa - active', '2025-10-23 16:36:54'::timestamp, '2025-06-13 16:36:54'::timestamp, '2025-06-18 16:36:54'::timestamp),
  ('TRAN-609620', 'TENA-987554', 'SOUR-311590', 'DEST-189760', 'Kabiru Aliyu - rejected', 'Musa Danjuma - pending', 'Khadija Musa - rejected', 27683503.13, 'USD', 'Abdullahi Sani - active', 'Victoria Etim - active', 'NIPS-695158', 'MOJA-223491', 'pending', 'Processed for Suleiman Abubakar in Anambra - pending', 'Chidinma Okafor - completed', '2025-05-18 16:36:54'::timestamp, '2025-09-27 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp),
  ('TRAN-937171', 'TENA-940802', 'SOUR-606557', 'DEST-134221', 'Suleiman Abubakar - completed', 'Folake Bakare - approved', 'Ifeanyi Obi - completed', 43348062.5, 'GBP', 'Joy Okonkwo - pending', 'Chukwuemeka Nwosu - processing', 'NIPS-278415', 'MOJA-293771', 'rejected', 'Processed for Emmanuel Ogbonna in Enugu - pending', 'Joy Okonkwo - processing', '2025-06-23 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp, '2025-12-30 16:36:54'::timestamp),
  ('TRAN-508055', 'TENA-690657', 'SOUR-958090', 'DEST-962612', 'Chidinma Okafor - active', 'Obinna Igwe - completed', 'Chidinma Okafor - approved', 10909694.36, 'NGN', 'Yusuf Ibrahim - rejected', 'Musa Danjuma - pending', 'NIPS-890247', 'MOJA-994622', 'processing', 'Processed for Musa Danjuma in Abuja - processing', 'Kabiru Aliyu - approved', '2025-06-02 16:36:54'::timestamp, '2025-11-01 16:36:54'::timestamp, '2025-08-30 16:36:54'::timestamp),
  ('TRAN-485126', 'TENA-518418', 'SOUR-740135', 'DEST-413890', 'Ifeanyi Obi - active', 'Aisha Bello - rejected', 'Khadija Musa - approved', 29898435.79, 'USD', 'Fatima Abdulrahman - processing', 'Tunde Akinola - processing', 'NIPS-726642', 'MOJA-844562', 'pending', 'Processed for Chidinma Okafor in Anambra - rejected', 'Yusuf Ibrahim - rejected', '2025-11-07 16:36:54'::timestamp, '2026-04-14 16:36:54'::timestamp, '2025-08-07 16:36:54'::timestamp),
  ('TRAN-668500', 'TENA-673073', 'SOUR-702319', 'DEST-265909', 'Rasheed Olanrewaju - rejected', 'Chukwuemeka Nwosu - completed', 'Tunde Akinola - completed', 13417380.41, 'EUR', 'Kabiru Aliyu - rejected', 'Ifeanyi Obi - completed', 'NIPS-805228', 'MOJA-904499', 'active', 'Processed for Chioma Nnamdi in Enugu - active', 'Emmanuel Ogbonna - pending', '2025-11-04 16:36:54'::timestamp, '2025-06-07 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp),
  ('TRAN-805599', 'TENA-324536', 'SOUR-195429', 'DEST-496904', 'Joy Okonkwo - pending', 'Fatima Abdulrahman - completed', 'Nkechi Nwankwo - rejected', 34056002.3, 'GBP', 'Aisha Bello - completed', 'Zainab Mohammed - active', 'NIPS-502401', 'MOJA-604604', 'approved', 'Processed for Nkechi Nwankwo in Abuja - rejected', 'Adebayo Ogundimu - pending', '2026-02-08 16:36:54'::timestamp, '2026-04-11 16:36:54'::timestamp, '2025-12-14 16:36:54'::timestamp),
  ('TRAN-100226', 'TENA-738695', 'SOUR-232634', 'DEST-369049', 'Nkechi Nwankwo - approved', 'Khadija Musa - rejected', 'Amina Garba - rejected', 2670643.55, 'USD', 'Babajide Williams - completed', 'Khadija Musa - completed', 'NIPS-757097', 'MOJA-679067', 'pending', 'Processed for Adebayo Ogundimu in Oyo - pending', 'Adebayo Ogundimu - approved', '2025-10-04 16:36:54'::timestamp, '2025-09-14 16:36:54'::timestamp, '2026-02-25 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: trialBalances
INSERT INTO "trialBalances" ("trialBalanceId", "tenantId", "glAccountCode", "periodStart", "periodEnd", "openingBalance", "totalDebits", "totalCredits", "closingBalance", "currency", "status", "createdAt") VALUES
  ('TRIA-577691', 'TENA-582295', 'CODE-230835', '2025-12-20 16:36:54'::timestamp, '2025-10-24 16:36:54'::timestamp, 15040210.79, 9069.67, 3860.38, 45453605.16, 'GBP', 'completed', '2026-01-05 16:36:54'::timestamp),
  ('TRIA-193689', 'TENA-628990', 'CODE-946455', '2025-07-04 16:36:54'::timestamp, '2025-12-13 16:36:54'::timestamp, 24691284.85, 1027.54, 763.77, 3579835.19, 'EUR', 'processing', '2026-03-02 16:36:54'::timestamp),
  ('TRIA-746738', 'TENA-762082', 'CODE-365898', '2025-11-24 16:36:54'::timestamp, '2026-03-26 16:36:54'::timestamp, 41732766.44, 5571.46, 5842.26, 8264421.68, 'EUR', 'active', '2026-04-30 16:36:54'::timestamp),
  ('TRIA-131615', 'TENA-527669', 'CODE-791533', '2025-06-04 16:36:54'::timestamp, '2025-08-27 16:36:54'::timestamp, 30336029.09, 7109.89, 9192.35, 45073781.73, 'NGN', 'pending', '2025-08-24 16:36:54'::timestamp),
  ('TRIA-960153', 'TENA-269608', 'CODE-239460', '2025-10-18 16:36:54'::timestamp, '2025-11-26 16:36:54'::timestamp, 354977.0, 3582.22, 2039.71, 35488574.18, 'USD', 'approved', '2025-08-29 16:36:54'::timestamp),
  ('TRIA-570844', 'TENA-552501', 'CODE-256425', '2025-12-01 16:36:54'::timestamp, '2026-04-21 16:36:54'::timestamp, 4410917.32, 5135.15, 939.18, 14394929.17, 'EUR', 'rejected', '2025-09-23 16:36:54'::timestamp),
  ('TRIA-145582', 'TENA-102377', 'CODE-206745', '2025-07-18 16:36:54'::timestamp, '2025-10-30 16:36:54'::timestamp, 19699686.74, 2514.95, 7815.83, 44478098.6, 'NGN', 'rejected', '2025-06-29 16:36:54'::timestamp),
  ('TRIA-522382', 'TENA-187044', 'CODE-381708', '2025-07-30 16:36:54'::timestamp, '2026-02-22 16:36:54'::timestamp, 5040673.29, 8498.49, 2904.5, 43143448.39, 'EUR', 'active', '2026-03-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: txn_pattern_analyses
INSERT INTO "txn_pattern_analyses" ("customerId", "customerName", "anomalyScore", "baselineDeviation", "recommendation", "status", "created_at") VALUES
  ('CUST-938513', 'Muhammed Lawal', 82.79, 'Chukwuemeka Nwosu - pending', 'Kabiru Aliyu - pending', 'approved', '2026-02-05 16:36:54'::timestamp),
  ('CUST-198305', 'Hauwa Yusuf', 6822.96, 'Amina Garba - completed', 'Babajide Williams - pending', 'processing', '2026-04-12 16:36:54'::timestamp),
  ('CUST-245398', 'Rasheed Olanrewaju', 1965.74, 'Grace Adeniyi - processing', 'Halima Usman - completed', 'approved', '2025-10-03 16:36:54'::timestamp),
  ('CUST-349404', 'Tunde Akinola', 5886.18, 'Fatima Abdulrahman - active', 'Fatima Abdulrahman - rejected', 'active', '2025-07-07 16:36:54'::timestamp),
  ('CUST-735789', 'Obinna Igwe', 6575.43, 'Babajide Williams - processing', 'Tunde Akinola - pending', 'approved', '2025-08-01 16:36:54'::timestamp),
  ('CUST-654691', 'Musa Danjuma', 4463.81, 'Oluwaseun Adeyemi - rejected', 'Adebayo Ogundimu - processing', 'processing', '2025-11-27 16:36:54'::timestamp),
  ('CUST-253966', 'Blessing Okoro', 2199.27, 'Musa Danjuma - approved', 'Abdullahi Sani - pending', 'completed', '2025-10-30 16:36:54'::timestamp),
  ('CUST-811186', 'Kabiru Aliyu', 5420.2, 'Adebayo Ogundimu - processing', 'Folake Bakare - completed', 'pending', '2026-04-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: typology_matches
INSERT INTO "typology_matches" ("typologyCode", "typologyName", "riskLevel", "customersTriggered", "autoSARGeneration", "status", "created_at") VALUES
  ('CODE-829098', 'Obinna Igwe - active', 'Suleiman Abubakar - processing', 6720, true, 'approved', '2025-07-13 16:36:54'::timestamp),
  ('CODE-941891', 'Joy Okonkwo - approved', 'Kabiru Aliyu - completed', 9207, false, 'pending', '2025-07-30 16:36:54'::timestamp),
  ('CODE-842427', 'Chidinma Okafor - pending', 'Ifeanyi Obi - completed', 2597, true, 'approved', '2025-10-10 16:36:54'::timestamp),
  ('CODE-358501', 'Zainab Mohammed - rejected', 'Babajide Williams - processing', 1758, true, 'rejected', '2026-05-03 16:36:54'::timestamp),
  ('CODE-782704', 'Chioma Nnamdi - rejected', 'Halima Usman - rejected', 3990, true, 'rejected', '2025-08-08 16:36:54'::timestamp),
  ('CODE-927145', 'Zainab Mohammed - processing', 'Rasheed Olanrewaju - processing', 5611, true, 'active', '2026-01-11 16:36:54'::timestamp),
  ('CODE-654258', 'Oluwaseun Adeyemi - processing', 'Amina Garba - rejected', 210, true, 'rejected', '2026-02-24 16:36:54'::timestamp),
  ('CODE-215781', 'Blessing Okoro - processing', 'Victoria Etim - approved', 9878, true, 'completed', '2026-02-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ubo_graph_edges
INSERT INTO "ubo_graph_edges" ("source_id", "target_id", "relationship", "ownership_pct", "created_at") VALUES
  (1082, 1413, 'Fatima Abdulrahman - active', 5040.65, '2025-06-06 16:36:54'::timestamp),
  (1707, 7399, 'Chidinma Okafor - completed', 719.96, '2026-01-26 16:36:54'::timestamp),
  (9437, 2127, 'Ifeanyi Obi - approved', 8282.75, '2025-11-08 16:36:54'::timestamp),
  (1921, 8949, 'Grace Adeniyi - approved', 1396.49, '2025-12-04 16:36:54'::timestamp),
  (5212, 7693, 'Obinna Igwe - pending', 7896.19, '2025-11-13 16:36:54'::timestamp),
  (6946, 6251, 'Victoria Etim - active', 1072.11, '2025-11-07 16:36:54'::timestamp),
  (6180, 4394, 'Chidinma Okafor - active', 7057.19, '2026-05-04 16:36:54'::timestamp),
  (2098, 2349, 'Musa Danjuma - active', 8744.5, '2026-04-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ubo_graph_nodes
INSERT INTO "ubo_graph_nodes" ("entity_name", "entity_type", "nationality", "risk_level", "metadata", "created_at") VALUES
  ('Flour Mills Nigeria', 'basic', 'Tunde Akinola - approved', 'Musa Danjuma - pending', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-14 16:36:54'::timestamp),
  ('BUA Group', 'premium', 'Amina Garba - completed', 'Chidinma Okafor - rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-27 16:36:54'::timestamp),
  ('GTBank PLC', 'corporate', 'Kabiru Aliyu - active', 'Suleiman Abubakar - processing', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-14 16:36:54'::timestamp),
  ('Abuja Capital Holdings', 'premium', 'Kabiru Aliyu - rejected', 'Rasheed Olanrewaju - completed', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-14 16:36:54'::timestamp),
  ('Oando PLC', 'basic', 'Amina Garba - approved', 'Obinna Igwe - rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-31 16:36:54'::timestamp),
  ('Access Bank PLC', 'corporate', 'Segun Oladipo - approved', 'Fatima Abdulrahman - active', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-22 16:36:54'::timestamp),
  ('FCMB Group', 'standard', 'Hauwa Yusuf - processing', 'Yusuf Ibrahim - rejected', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-13 16:36:54'::timestamp),
  ('Seplat Energy', 'standard', 'Nkechi Nwankwo - completed', 'Amina Garba - approved', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-20 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: users
INSERT INTO "users" ("openId", "name", "email", "loginMethod", "role", "createdAt", "updatedAt", "lastSignedIn") VALUES
  ('OPEN-247784', 'Chioma Nnamdi', 'aisha.bello@54bank.ng', 'update', 'operations', '2025-09-06 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp),
  ('OPEN-753637', 'Oluwaseun Adeyemi', 'amina.garba@54bank.ng', 'create', 'branch', '2026-01-19 16:36:54'::timestamp, '2025-08-31 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp),
  ('OPEN-395805', 'Aisha Bello', 'amina.garba@54bank.ng', 'transfer', 'operations', '2025-10-27 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp, '2025-10-13 16:36:54'::timestamp),
  ('OPEN-428034', 'Ifeanyi Obi', 'aisha.bello@54bank.ng', 'create', 'treasury', '2025-06-30 16:36:54'::timestamp, '2026-03-03 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp),
  ('OPEN-489104', 'Halima Usman', 'ifeanyi.obi@54bank.ng', 'update', 'treasury', '2025-06-13 16:36:54'::timestamp, '2026-04-29 16:36:54'::timestamp, '2026-05-01 16:36:54'::timestamp),
  ('OPEN-148748', 'Yusuf Ibrahim', 'nkechi.nwankwo@54bank.ng', 'update', 'treasury', '2025-08-10 16:36:54'::timestamp, '2025-07-15 16:36:54'::timestamp, '2025-07-09 16:36:54'::timestamp),
  ('OPEN-814209', 'Musa Danjuma', 'amina.garba@54bank.ng', 'create', 'operations', '2025-06-12 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp, '2025-10-08 16:36:54'::timestamp),
  ('OPEN-333062', 'Chukwuemeka Nwosu', 'abdullahi.sani@54bank.ng', 'verify', 'operations', '2026-03-15 16:36:54'::timestamp, '2025-08-22 16:36:54'::timestamp, '2025-06-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ussd_banking_gateway
INSERT INTO "ussd_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-581697', 'RECO-581588', 'Nkechi Nwankwo', 'micro', 'Processed for Chioma Nnamdi in Delta - processing', 'processing', 48721260.67, 'Victoria Etim - processing', '+2348914717673', 'SESS-164757', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-08 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp),
  ('TENA-529874', 'RECO-326961', 'Adebayo Ogundimu', 'premium', 'Processed for Aisha Bello in Lagos - pending', 'rejected', 7355195.33, 'Ngozi Eze - completed', '+2348556584562', 'SESS-437725', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-26 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp),
  ('TENA-607467', 'RECO-860425', 'Halima Usman', 'enterprise', 'Processed for Muhammed Lawal in Delta - active', 'processing', 42037583.39, 'Segun Oladipo - pending', '+2348921236339', 'SESS-332071', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-08 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp),
  ('TENA-105480', 'RECO-723696', 'Oluwaseun Adeyemi', 'standard', 'Processed for Segun Oladipo in Delta - processing', 'active', 37857017.61, 'Joy Okonkwo - rejected', '+2348645980731', 'SESS-625015', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-18 16:36:54'::timestamp, '2026-05-04 16:36:54'::timestamp),
  ('TENA-239413', 'RECO-718158', 'Fatima Abdulrahman', 'premium', 'Processed for Grace Adeniyi in Anambra - active', 'approved', 36869495.07, 'Obinna Igwe - approved', '+2349027997999', 'SESS-868595', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-15 16:36:54'::timestamp, '2026-03-29 16:36:54'::timestamp),
  ('TENA-216307', 'RECO-326858', 'Tunde Akinola', 'standard', 'Processed for Yusuf Ibrahim in Abuja - completed', 'processing', 31252542.76, 'Musa Danjuma - active', '+2347536583040', 'SESS-922988', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-22 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp),
  ('TENA-426378', 'RECO-710659', 'Victoria Etim', 'corporate', 'Processed for Obinna Igwe in Kano - pending', 'active', 35783173.92, 'Chukwuemeka Nwosu - completed', '+2347529388422', 'SESS-945637', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-14 16:36:54'::timestamp, '2025-11-29 16:36:54'::timestamp),
  ('TENA-689234', 'RECO-113773', 'Victoria Etim', 'enterprise', 'Processed for Fatima Abdulrahman in Abuja - pending', 'pending', 19273746.65, 'Folake Bakare - rejected', '+2348784840510', 'SESS-587006', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-28 16:36:54'::timestamp, '2025-09-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ussd_multilingual
INSERT INTO "ussd_multilingual" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-160209', 'RECO-286245', 'Abdullahi Sani', 'corporate', 'Processed for Ifeanyi Obi in Rivers - completed', 'completed', 29418028.71, 'Hauwa Yusuf - processing', '+2347961297050', 'SESS-810761', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-06 16:36:54'::timestamp, '2026-05-03 16:36:54'::timestamp),
  ('TENA-267572', 'RECO-530972', 'Zainab Mohammed', 'basic', 'Processed for Babajide Williams in Anambra - approved', 'processing', 8164094.11, 'Folake Bakare - active', '+2348253203638', 'SESS-687674', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-14 16:36:54'::timestamp, '2026-02-08 16:36:54'::timestamp),
  ('TENA-955242', 'RECO-834745', 'Halima Usman', 'micro', 'Processed for Folake Bakare in Kano - processing', 'pending', 8245352.01, 'Aisha Bello - active', '+2347160798157', 'SESS-810652', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-02 16:36:54'::timestamp, '2025-10-19 16:36:54'::timestamp),
  ('TENA-355198', 'RECO-185866', 'Chukwuemeka Nwosu', 'premium', 'Processed for Segun Oladipo in Kaduna - active', 'active', 46779258.77, 'Babajide Williams - active', '+2348072428049', 'SESS-512046', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-10 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp),
  ('TENA-188048', 'RECO-319073', 'Chidinma Okafor', 'standard', 'Processed for Zainab Mohammed in Anambra - pending', 'completed', 21272930.15, 'Chioma Nnamdi - approved', '+2347140382046', 'SESS-906034', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-04 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp),
  ('TENA-315545', 'RECO-360990', 'Zainab Mohammed', 'micro', 'Processed for Fatima Abdulrahman in Enugu - approved', 'approved', 15964882.81, 'Segun Oladipo - rejected', '+2348254117423', 'SESS-302446', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-19 16:36:54'::timestamp, '2026-04-09 16:36:54'::timestamp),
  ('TENA-535392', 'RECO-105181', 'Hauwa Yusuf', 'premium', 'Processed for Blessing Okoro in Delta - approved', 'active', 21972381.38, 'Folake Bakare - rejected', '+2347708301046', 'SESS-857496', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-23 16:36:54'::timestamp, '2025-08-19 16:36:54'::timestamp),
  ('TENA-575613', 'RECO-744770', 'Zainab Mohammed', 'standard', 'Processed for Oluwaseun Adeyemi in Oyo - rejected', 'completed', 41592186.3, 'Ifeanyi Obi - processing', '+2348538669032', 'SESS-682803', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-26 16:36:54'::timestamp, '2025-12-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ussd_sim_toolkit
INSERT INTO "ussd_sim_toolkit" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-232601', 'RECO-882517', 'Segun Oladipo', 'enterprise', 'Processed for Muhammed Lawal in Oyo - rejected', 'completed', 17505082.5, 'Rasheed Olanrewaju - pending', '+2348257787041', 'SESS-587775', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-20 16:36:54'::timestamp, '2025-10-31 16:36:54'::timestamp),
  ('TENA-687026', 'RECO-480183', 'Tunde Akinola', 'corporate', 'Processed for Chidinma Okafor in Ogun - processing', 'rejected', 25039081.37, 'Abdullahi Sani - processing', '+2348146550314', 'SESS-900508', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-27 16:36:54'::timestamp, '2025-05-19 16:36:54'::timestamp),
  ('TENA-260215', 'RECO-565387', 'Hauwa Yusuf', 'corporate', 'Processed for Ngozi Eze in Delta - processing', 'processing', 40587263.6, 'Khadija Musa - processing', '+2347553587919', 'SESS-217239', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-16 16:36:54'::timestamp, '2026-04-30 16:36:54'::timestamp),
  ('TENA-564087', 'RECO-372989', 'Blessing Okoro', 'standard', 'Processed for Ifeanyi Obi in Abuja - approved', 'pending', 7170534.47, 'Adebayo Ogundimu - rejected', '+2347378950958', 'SESS-869058', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-28 16:36:54'::timestamp, '2025-11-23 16:36:54'::timestamp),
  ('TENA-612230', 'RECO-519971', 'Victoria Etim', 'corporate', 'Processed for Rasheed Olanrewaju in Rivers - processing', 'completed', 46916493.23, 'Yusuf Ibrahim - rejected', '+2348420491245', 'SESS-942528', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-10 16:36:54'::timestamp, '2026-01-26 16:36:54'::timestamp),
  ('TENA-635110', 'RECO-573878', 'Tunde Akinola', 'corporate', 'Processed for Ngozi Eze in Abuja - pending', 'approved', 22981862.94, 'Amina Garba - pending', '+2347897880607', 'SESS-181466', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-19 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp),
  ('TENA-650618', 'RECO-286669', 'Babajide Williams', 'standard', 'Processed for Khadija Musa in Anambra - approved', 'processing', 42993983.84, 'Obinna Igwe - completed', '+2347001321627', 'SESS-294792', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-31 16:36:54'::timestamp, '2025-08-30 16:36:54'::timestamp),
  ('TENA-921519', 'RECO-439673', 'Abdullahi Sani', 'micro', 'Processed for Amina Garba in Rivers - active', 'rejected', 24420470.41, 'Amina Garba - pending', '+2347498920088', 'SESS-283561', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-28 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: ussd_transaction_engine
INSERT INTO "ussd_transaction_engine" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-256995', 'RECO-523730', 'Muhammed Lawal', 'corporate', 'Processed for Victoria Etim in Lagos - processing', 'approved', 40114002.72, 'Segun Oladipo - processing', '+2348276686718', 'SESS-907064', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-01 16:36:54'::timestamp, '2026-02-20 16:36:54'::timestamp),
  ('TENA-333432', 'RECO-138485', 'Yusuf Ibrahim', 'basic', 'Processed for Fatima Abdulrahman in Ogun - approved', 'active', 45335262.94, 'Babajide Williams - processing', '+2348326922712', 'SESS-953285', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-27 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp),
  ('TENA-930726', 'RECO-950833', 'Suleiman Abubakar', 'corporate', 'Processed for Kabiru Aliyu in Kano - processing', 'completed', 26285631.04, 'Muhammed Lawal - active', '+2347551175163', 'SESS-782259', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-06 16:36:54'::timestamp, '2025-10-12 16:36:54'::timestamp),
  ('TENA-332604', 'RECO-696078', 'Hauwa Yusuf', 'basic', 'Processed for Khadija Musa in Kaduna - active', 'pending', 40617453.02, 'Emmanuel Ogbonna - approved', '+2348871126567', 'SESS-657390', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-01 16:36:54'::timestamp, '2026-03-31 16:36:54'::timestamp),
  ('TENA-546889', 'RECO-988134', 'Yusuf Ibrahim', 'enterprise', 'Processed for Chukwuemeka Nwosu in Kano - pending', 'approved', 19200223.87, 'Babajide Williams - active', '+2348879397472', 'SESS-927925', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-20 16:36:54'::timestamp, '2025-07-29 16:36:54'::timestamp),
  ('TENA-463152', 'RECO-772644', 'Fatima Abdulrahman', 'enterprise', 'Processed for Blessing Okoro in Delta - completed', 'approved', 19798584.02, 'Nkechi Nwankwo - completed', '+2349088287938', 'SESS-868364', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-03 16:36:54'::timestamp, '2025-12-04 16:36:54'::timestamp),
  ('TENA-449291', 'RECO-350356', 'Tunde Akinola', 'premium', 'Processed for Victoria Etim in Kano - pending', 'rejected', 40284269.92, 'Zainab Mohammed - processing', '+2347325176751', 'SESS-796837', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-30 16:36:54'::timestamp, '2025-07-04 16:36:54'::timestamp),
  ('TENA-151766', 'RECO-666552', 'Chukwuemeka Nwosu', 'standard', 'Processed for Emmanuel Ogbonna in Lagos - approved', 'rejected', 27896112.58, 'Babajide Williams - approved', '+2347691559378', 'SESS-511391', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-28 16:36:54'::timestamp, '2026-03-15 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: valueChainContracts
INSERT INTO "valueChainContracts" ("contractId", "tenantId", "contractType", "buyerName", "buyerId", "sellerFarmerId", "commodity", "quantityTonnes", "pricePerTonne", "totalValue", "currency", "deliveryLocation", "deliveryDeadline", "warehouseReceiptId", "qualityGrade", "milestones", "status", "createdAt", "updatedAt") VALUES
  ('CONT-872894', 'TENA-426638', 'enterprise', 'Adebayo Ogundimu - processing', 'BUYE-685363', 'SELL-550421', 'Kabiru Aliyu - pending', 7764.66, 38940037.27, 853875.46, 'GBP', 'Joy Okonkwo - completed', 'Zainab Mohammed - completed', 'WARE-185311', 'B', '{}'::jsonb, 'pending', '2025-08-25 16:36:54'::timestamp, '2026-02-02 16:36:54'::timestamp),
  ('CONT-497363', 'TENA-760252', 'premium', 'Aisha Bello - rejected', 'BUYE-641895', 'SELL-202091', 'Chidinma Okafor - pending', 4739.67, 39982937.49, 13670758.36, 'NGN', 'Chidinma Okafor - active', 'Suleiman Abubakar - completed', 'WARE-733839', 'B', '{}'::jsonb, 'rejected', '2026-04-08 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp),
  ('CONT-371218', 'TENA-243071', 'micro', 'Tunde Akinola - rejected', 'BUYE-831770', 'SELL-939414', 'Ifeanyi Obi - rejected', 8425.25, 48116306.75, 11312693.79, 'NGN', 'Segun Oladipo - rejected', 'Adebayo Ogundimu - completed', 'WARE-744467', 'A', '{}'::jsonb, 'completed', '2025-11-07 16:36:54'::timestamp, '2025-06-05 16:36:54'::timestamp),
  ('CONT-974649', 'TENA-533905', 'premium', 'Victoria Etim - rejected', 'BUYE-357064', 'SELL-142854', 'Khadija Musa - active', 8775.23, 14062051.38, 46096308.79, 'NGN', 'Rasheed Olanrewaju - pending', 'Victoria Etim - processing', 'WARE-119117', 'A', '{}'::jsonb, 'processing', '2025-12-20 16:36:54'::timestamp, '2026-01-04 16:36:54'::timestamp),
  ('CONT-682947', 'TENA-582801', 'premium', 'Hauwa Yusuf - completed', 'BUYE-138814', 'SELL-905604', 'Suleiman Abubakar - approved', 647.52, 41102994.21, 22468595.28, 'USD', 'Joy Okonkwo - processing', 'Khadija Musa - pending', 'WARE-221325', 'B', '{}'::jsonb, 'pending', '2025-12-15 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp),
  ('CONT-375682', 'TENA-523704', 'premium', 'Adebayo Ogundimu - completed', 'BUYE-127482', 'SELL-905908', 'Chukwuemeka Nwosu - processing', 9227.75, 26884019.84, 36619518.87, 'EUR', 'Rasheed Olanrewaju - approved', 'Adebayo Ogundimu - approved', 'WARE-345716', 'D', '{}'::jsonb, 'processing', '2025-06-13 16:36:54'::timestamp, '2025-08-08 16:36:54'::timestamp),
  ('CONT-911500', 'TENA-395379', 'corporate', 'Hauwa Yusuf - rejected', 'BUYE-234099', 'SELL-509159', 'Folake Bakare - completed', 8214.96, 43603994.91, 27422878.13, 'USD', 'Suleiman Abubakar - active', 'Blessing Okoro - pending', 'WARE-320065', 'B', '{}'::jsonb, 'active', '2026-02-15 16:36:54'::timestamp, '2025-11-24 16:36:54'::timestamp),
  ('CONT-752047', 'TENA-610029', 'basic', 'Blessing Okoro - completed', 'BUYE-919959', 'SELL-750263', 'Kabiru Aliyu - rejected', 1365.79, 10631829.46, 18929232.42, 'GBP', 'Abdullahi Sani - rejected', 'Suleiman Abubakar - rejected', 'WARE-291773', 'A', '{}'::jsonb, 'processing', '2025-09-25 16:36:54'::timestamp, '2026-03-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: vaultOperations
INSERT INTO "vaultOperations" ("operationId", "tenantId", "operationType", "fromLocation", "toLocation", "amount", "currency", "authorizedBy", "dualControlBy", "status", "reason", "createdAt") VALUES
  ('OPER-587898', 'TENA-528523', 'micro', 'Victoria Etim - active', 'Halima Usman - processing', 38823299.09, 'NGN', 'Adebayo Ogundimu - approved', 'Rasheed Olanrewaju - completed', 'completed', 'Processed for Folake Bakare in Ogun - approved', '2026-01-14 16:36:54'::timestamp),
  ('OPER-144045', 'TENA-414149', 'corporate', 'Chidinma Okafor - completed', 'Chukwuemeka Nwosu - rejected', 1734482.56, 'GBP', 'Nkechi Nwankwo - completed', 'Joy Okonkwo - rejected', 'active', 'Processed for Abdullahi Sani in Kaduna - completed', '2026-05-12 16:36:54'::timestamp),
  ('OPER-939879', 'TENA-919755', 'micro', 'Yusuf Ibrahim - rejected', 'Blessing Okoro - active', 27021779.43, 'NGN', 'Babajide Williams - active', 'Kabiru Aliyu - pending', 'completed', 'Processed for Victoria Etim in Enugu - approved', '2025-08-22 16:36:54'::timestamp),
  ('OPER-373615', 'TENA-563635', 'micro', 'Chidinma Okafor - active', 'Tunde Akinola - rejected', 35670140.67, 'EUR', 'Folake Bakare - pending', 'Abdullahi Sani - rejected', 'rejected', 'Processed for Folake Bakare in Abuja - rejected', '2025-11-30 16:36:54'::timestamp),
  ('OPER-862555', 'TENA-718081', 'basic', 'Halima Usman - pending', 'Segun Oladipo - approved', 25647337.96, 'USD', 'Oluwaseun Adeyemi - processing', 'Ifeanyi Obi - pending', 'completed', 'Processed for Victoria Etim in Ogun - rejected', '2026-03-16 16:36:54'::timestamp),
  ('OPER-343384', 'TENA-825162', 'enterprise', 'Oluwaseun Adeyemi - completed', 'Ifeanyi Obi - active', 30414012.94, 'USD', 'Nkechi Nwankwo - approved', 'Abdullahi Sani - completed', 'completed', 'Processed for Blessing Okoro in Oyo - rejected', '2025-08-22 16:36:54'::timestamp),
  ('OPER-677536', 'TENA-606399', 'corporate', 'Amina Garba - approved', 'Emmanuel Ogbonna - active', 32631067.75, 'EUR', 'Adebayo Ogundimu - processing', 'Kabiru Aliyu - active', 'completed', 'Processed for Oluwaseun Adeyemi in Delta - processing', '2025-11-08 16:36:54'::timestamp),
  ('OPER-328675', 'TENA-765491', 'standard', 'Emmanuel Ogbonna - completed', 'Suleiman Abubakar - approved', 48342326.04, 'EUR', 'Grace Adeniyi - active', 'Obinna Igwe - pending', 'rejected', 'Processed for Segun Oladipo in Anambra - approved', '2025-12-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: vault_engines
INSERT INTO "vault_engines" ("path", "engine_type", "description", "leases", "max_ttl", "default_ttl", "rotations_completed", "status", "created_at") VALUES
  ('Zainab Mohammed - active', 'corporate', 'Processed for Muhammed Lawal in Enugu - processing', 6422, 'Grace Adeniyi - rejected', 'Tunde Akinola - approved', 6308, 'completed', '2026-03-31 16:36:54'::timestamp),
  ('Folake Bakare - approved', 'micro', 'Processed for Chioma Nnamdi in Kaduna - rejected', 8777, 'Chukwuemeka Nwosu - completed', 'Rasheed Olanrewaju - approved', 5146, 'rejected', '2025-07-07 16:36:54'::timestamp),
  ('Adebayo Ogundimu - completed', 'premium', 'Processed for Obinna Igwe in Anambra - completed', 4140, 'Grace Adeniyi - completed', 'Abdullahi Sani - processing', 3502, 'active', '2025-09-08 16:36:54'::timestamp),
  ('Joy Okonkwo - pending', 'micro', 'Processed for Chioma Nnamdi in Lagos - rejected', 7589, 'Blessing Okoro - approved', 'Tunde Akinola - approved', 8153, 'active', '2025-08-08 16:36:54'::timestamp),
  ('Oluwaseun Adeyemi - rejected', 'standard', 'Processed for Ifeanyi Obi in Lagos - active', 999, 'Aisha Bello - processing', 'Aisha Bello - rejected', 6057, 'completed', '2026-01-30 16:36:54'::timestamp),
  ('Folake Bakare - rejected', 'enterprise', 'Processed for Folake Bakare in Enugu - rejected', 6658, 'Emmanuel Ogbonna - rejected', 'Segun Oladipo - rejected', 7156, 'processing', '2025-06-30 16:36:54'::timestamp),
  ('Yusuf Ibrahim - completed', 'basic', 'Processed for Obinna Igwe in Abuja - active', 2508, 'Ngozi Eze - approved', 'Obinna Igwe - active', 7349, 'completed', '2026-02-06 16:36:54'::timestamp),
  ('Amina Garba - pending', 'corporate', 'Processed for Ifeanyi Obi in Kaduna - approved', 5517, 'Chioma Nnamdi - active', 'Ngozi Eze - pending', 9778, 'approved', '2025-07-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: vault_secrets
INSERT INTO "vault_secrets" ("path", "engine", "version", "rotation_days", "last_rotated", "next_rotation", "access_count", "status", "created_at") VALUES
  ('Khadija Musa - active', 'Khadija Musa - completed', 861, 164, '2026-02-24 16:36:54'::timestamp, '2025-10-11 16:36:54'::timestamp, 23, 'completed', '2025-05-17 16:36:54'::timestamp),
  ('Aisha Bello - rejected', 'Zainab Mohammed - rejected', 8425, 27, '2025-09-11 16:36:54'::timestamp, '2026-01-21 16:36:54'::timestamp, 299, 'processing', '2026-01-07 16:36:54'::timestamp),
  ('Ngozi Eze - processing', 'Emmanuel Ogbonna - approved', 5288, 285, '2025-11-01 16:36:54'::timestamp, '2025-10-04 16:36:54'::timestamp, 225, 'processing', '2025-07-17 16:36:54'::timestamp),
  ('Joy Okonkwo - completed', 'Hauwa Yusuf - approved', 7595, 32, '2025-11-22 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp, 479, 'approved', '2026-03-13 16:36:54'::timestamp),
  ('Ifeanyi Obi - processing', 'Halima Usman - pending', 8639, 327, '2026-04-04 16:36:54'::timestamp, '2026-02-24 16:36:54'::timestamp, 476, 'approved', '2025-06-06 16:36:54'::timestamp),
  ('Kabiru Aliyu - pending', 'Kabiru Aliyu - pending', 9827, 145, '2025-10-16 16:36:54'::timestamp, '2025-12-02 16:36:54'::timestamp, 113, 'rejected', '2026-01-11 16:36:54'::timestamp),
  ('Rasheed Olanrewaju - completed', 'Tunde Akinola - approved', 5031, 281, '2025-09-29 16:36:54'::timestamp, '2025-07-24 16:36:54'::timestamp, 248, 'processing', '2025-12-23 16:36:54'::timestamp),
  ('Zainab Mohammed - completed', 'Aisha Bello - approved', 6313, 208, '2026-02-01 16:36:54'::timestamp, '2025-05-13 16:36:54'::timestamp, 190, 'processing', '2025-12-01 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: virtualAccounts
INSERT INTO "virtualAccounts" ("accountId", "tenantId", "van", "parentAccountId", "ownerId", "ownerName", "ownerType", "purpose", "currency", "balance", "availableBalance", "holdAmount", "dailyLimit", "monthlyLimit", "status", "expiryDate", "createdAt", "updatedAt") VALUES
  ('ACCO-891794', 'TENA-961667', 'Chidinma Okafor - rejected', 'PARE-434204', 'OWNE-515046', 'Chioma Nnamdi', 'enterprise', 'Processed for Amina Garba in Rivers - completed', 'GBP', 36933039.24, 25621956.86, 47727457.6, 7709.36, 5821.73, 'pending', '2025-11-20 16:36:54'::timestamp, '2025-10-04 16:36:54'::timestamp, '2026-01-11 16:36:54'::timestamp),
  ('ACCO-572670', 'TENA-495725', 'Victoria Etim - rejected', 'PARE-258707', 'OWNE-234755', 'Rasheed Olanrewaju', 'corporate', 'Processed for Aisha Bello in Enugu - rejected', 'NGN', 9595757.47, 5420618.89, 29482822.8, 2270.22, 5409.8, 'rejected', '2026-04-23 16:36:54'::timestamp, '2025-08-07 16:36:54'::timestamp, '2026-02-23 16:36:54'::timestamp),
  ('ACCO-588104', 'TENA-318806', 'Fatima Abdulrahman - approved', 'PARE-314531', 'OWNE-326413', 'Babajide Williams', 'enterprise', 'Processed for Zainab Mohammed in Rivers - active', 'USD', 2198231.48, 23171250.1, 4553718.34, 1663.52, 5401.34, 'completed', '2025-11-11 16:36:54'::timestamp, '2025-12-01 16:36:54'::timestamp, '2026-02-13 16:36:54'::timestamp),
  ('ACCO-504515', 'TENA-654505', 'Nkechi Nwankwo - processing', 'PARE-180123', 'OWNE-502469', 'Yusuf Ibrahim', 'corporate', 'Processed for Muhammed Lawal in Delta - processing', 'GBP', 27869491.2, 24657162.63, 41440573.75, 481.86, 2810.78, 'active', '2025-05-31 16:36:54'::timestamp, '2025-11-14 16:36:54'::timestamp, '2025-12-09 16:36:54'::timestamp),
  ('ACCO-728726', 'TENA-508740', 'Ngozi Eze - pending', 'PARE-149939', 'OWNE-703023', 'Rasheed Olanrewaju', 'micro', 'Processed for Chioma Nnamdi in Anambra - pending', 'NGN', 6929752.08, 38049437.44, 41672579.54, 6004.41, 3329.55, 'approved', '2026-03-31 16:36:54'::timestamp, '2026-03-05 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp),
  ('ACCO-323018', 'TENA-684004', 'Grace Adeniyi - rejected', 'PARE-809610', 'OWNE-936409', 'Yusuf Ibrahim', 'corporate', 'Processed for Emmanuel Ogbonna in Abuja - processing', 'NGN', 14916901.92, 10276388.69, 23174541.52, 8272.33, 6293.91, 'active', '2025-06-27 16:36:54'::timestamp, '2025-05-17 16:36:54'::timestamp, '2025-10-10 16:36:54'::timestamp),
  ('ACCO-778892', 'TENA-942929', 'Kabiru Aliyu - rejected', 'PARE-946683', 'OWNE-837757', 'Ngozi Eze', 'premium', 'Processed for Emmanuel Ogbonna in Oyo - approved', 'NGN', 35214425.09, 342854.58, 49478456.91, 4958.12, 4605.2, 'pending', '2026-04-06 16:36:54'::timestamp, '2026-03-07 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp),
  ('ACCO-297270', 'TENA-368386', 'Tunde Akinola - pending', 'PARE-414729', 'OWNE-556563', 'Chioma Nnamdi', 'enterprise', 'Processed for Grace Adeniyi in Delta - completed', 'GBP', 34245377.46, 31987830.5, 45912317.55, 5649.92, 8033.47, 'active', '2026-02-11 16:36:54'::timestamp, '2026-01-14 16:36:54'::timestamp, '2025-07-10 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: virtual_scroll_configs
INSERT INTO "virtual_scroll_configs" ("tableName", "totalRows", "viewportRows", "renderTimeMs", "scrollFps", "status", "created_at") VALUES
  ('Halima Usman - rejected', 35091443, 8855, 4819.51, 211, 'approved', '2025-07-25 16:36:54'::timestamp),
  ('Hauwa Yusuf - approved', 9829596, 8678, 4598.72, 1328, 'completed', '2025-12-01 16:36:54'::timestamp),
  ('Blessing Okoro - rejected', 34127035, 8583, 447.51, 3292, 'approved', '2025-12-06 16:36:54'::timestamp),
  ('Joy Okonkwo - processing', 48305822, 8051, 5164.99, 5830, 'processing', '2026-04-13 16:36:54'::timestamp),
  ('Kabiru Aliyu - active', 37520236, 8022, 7540.24, 8629, 'completed', '2025-08-07 16:36:54'::timestamp),
  ('Halima Usman - completed', 41220257, 8145, 2081.82, 7531, 'completed', '2025-09-20 16:36:54'::timestamp),
  ('Tunde Akinola - processing', 19202358, 8555, 9034.62, 128, 'active', '2025-07-02 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - processing', 40466935, 8997, 8795.39, 2424, 'completed', '2026-04-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_agent_escalation
INSERT INTO "voice_agent_escalation" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-332295', 'RECO-653880', 'Abdullahi Sani', 'corporate', 'Processed for Ngozi Eze in Rivers - approved', 'pending', 8966147.94, 'Yusuf Ibrahim - completed', '+2347746820451', 'SESS-323495', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2025-06-26 16:36:54'::timestamp),
  ('TENA-324147', 'RECO-882007', 'Obinna Igwe', 'standard', 'Processed for Muhammed Lawal in Anambra - processing', 'approved', 24098.25, 'Abdullahi Sani - completed', '+2348407681750', 'SESS-481075', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-17 16:36:54'::timestamp, '2026-01-26 16:36:54'::timestamp),
  ('TENA-664398', 'RECO-140937', 'Halima Usman', 'micro', 'Processed for Adebayo Ogundimu in Lagos - approved', 'processing', 34244287.16, 'Emmanuel Ogbonna - active', '+2347425204699', 'SESS-548530', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-27 16:36:54'::timestamp, '2026-04-07 16:36:54'::timestamp),
  ('TENA-415976', 'RECO-654693', 'Hauwa Yusuf', 'premium', 'Processed for Victoria Etim in Abuja - processing', 'active', 41794746.7, 'Grace Adeniyi - approved', '+2348365025516', 'SESS-450176', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-13 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp),
  ('TENA-179546', 'RECO-527835', 'Suleiman Abubakar', 'corporate', 'Processed for Nkechi Nwankwo in Kaduna - rejected', 'rejected', 45795782.53, 'Aisha Bello - active', '+2347384365599', 'SESS-315149', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-18 16:36:54'::timestamp, '2025-05-17 16:36:54'::timestamp),
  ('TENA-378349', 'RECO-408241', 'Emmanuel Ogbonna', 'enterprise', 'Processed for Aisha Bello in Ogun - completed', 'approved', 21530046.78, 'Chidinma Okafor - completed', '+2347707035040', 'SESS-370195', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-26 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp),
  ('TENA-402101', 'RECO-697017', 'Joy Okonkwo', 'enterprise', 'Processed for Adebayo Ogundimu in Oyo - approved', 'approved', 36806268.66, 'Zainab Mohammed - active', '+2347361790609', 'SESS-235057', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-21 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp),
  ('TENA-701068', 'RECO-755181', 'Adebayo Ogundimu', 'enterprise', 'Processed for Joy Okonkwo in Lagos - active', 'completed', 45664182.55, 'Blessing Okoro - rejected', '+2348953594404', 'SESS-603863', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-13 16:36:54'::timestamp, '2025-11-23 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_asr_nigerian
INSERT INTO "voice_asr_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-669469', 'RECO-280847', 'Abdullahi Sani', 'standard', 'Processed for Ifeanyi Obi in Oyo - pending', 'approved', 13802324.12, 'Tunde Akinola - processing', '+2347604752177', 'SESS-598617', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-29 16:36:54'::timestamp, '2026-03-22 16:36:54'::timestamp),
  ('TENA-108319', 'RECO-457372', 'Fatima Abdulrahman', 'standard', 'Processed for Blessing Okoro in Enugu - active', 'processing', 28296694.43, 'Khadija Musa - active', '+2349052710032', 'SESS-453018', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-04 16:36:54'::timestamp, '2025-06-25 16:36:54'::timestamp),
  ('TENA-592586', 'RECO-241960', 'Musa Danjuma', 'micro', 'Processed for Babajide Williams in Oyo - rejected', 'completed', 14727177.27, 'Chioma Nnamdi - approved', '+2348575096201', 'SESS-795255', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-30 16:36:54'::timestamp, '2026-04-29 16:36:54'::timestamp),
  ('TENA-592601', 'RECO-534641', 'Joy Okonkwo', 'premium', 'Processed for Hauwa Yusuf in Ogun - processing', 'rejected', 43551740.67, 'Blessing Okoro - completed', '+2347794654051', 'SESS-987181', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-22 16:36:54'::timestamp, '2026-02-16 16:36:54'::timestamp),
  ('TENA-816657', 'RECO-243425', 'Amina Garba', 'enterprise', 'Processed for Oluwaseun Adeyemi in Delta - pending', 'rejected', 10464183.8, 'Rasheed Olanrewaju - processing', '+2348713472368', 'SESS-540029', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-10 16:36:54'::timestamp, '2025-11-30 16:36:54'::timestamp),
  ('TENA-620022', 'RECO-440737', 'Yusuf Ibrahim', 'micro', 'Processed for Grace Adeniyi in Anambra - active', 'rejected', 23727935.24, 'Zainab Mohammed - completed', '+2348153504330', 'SESS-481186', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-18 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-350339', 'RECO-483679', 'Zainab Mohammed', 'micro', 'Processed for Oluwaseun Adeyemi in Abuja - processing', 'approved', 30400883.56, 'Ngozi Eze - approved', '+2348535978769', 'SESS-501934', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-08 16:36:54'::timestamp, '2025-10-18 16:36:54'::timestamp),
  ('TENA-244950', 'RECO-266012', 'Blessing Okoro', 'basic', 'Processed for Ngozi Eze in Kano - pending', 'active', 17554395.8, 'Fatima Abdulrahman - processing', '+2347776557899', 'SESS-382451', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-08 16:36:54'::timestamp, '2026-01-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_banking_gateway
INSERT INTO "voice_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-182586', 'RECO-572225', 'Zainab Mohammed', 'micro', 'Processed for Joy Okonkwo in Abuja - processing', 'active', 43030240.64, 'Tunde Akinola - active', '+2348124917012', 'SESS-244575', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-12 16:36:54'::timestamp, '2025-10-21 16:36:54'::timestamp),
  ('TENA-903732', 'RECO-965345', 'Kabiru Aliyu', 'enterprise', 'Processed for Hauwa Yusuf in Abuja - completed', 'completed', 12034003.79, 'Muhammed Lawal - approved', '+2348050766822', 'SESS-409149', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-18 16:36:54'::timestamp, '2025-12-31 16:36:54'::timestamp),
  ('TENA-168955', 'RECO-635666', 'Babajide Williams', 'micro', 'Processed for Tunde Akinola in Ogun - active', 'pending', 14861906.3, 'Folake Bakare - completed', '+2347758053934', 'SESS-789522', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-21 16:36:54'::timestamp, '2026-04-01 16:36:54'::timestamp),
  ('TENA-631848', 'RECO-189184', 'Khadija Musa', 'premium', 'Processed for Babajide Williams in Enugu - approved', 'completed', 35081287.48, 'Hauwa Yusuf - processing', '+2348547776684', 'SESS-790933', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-01 16:36:54'::timestamp, '2026-05-01 16:36:54'::timestamp),
  ('TENA-239340', 'RECO-880284', 'Abdullahi Sani', 'premium', 'Processed for Chukwuemeka Nwosu in Enugu - completed', 'pending', 36407519.03, 'Segun Oladipo - active', '+2348744727222', 'SESS-293899', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-29 16:36:54'::timestamp, '2025-10-14 16:36:54'::timestamp),
  ('TENA-110539', 'RECO-789925', 'Victoria Etim', 'enterprise', 'Processed for Yusuf Ibrahim in Anambra - active', 'pending', 27618780.48, 'Khadija Musa - rejected', '+2348075755200', 'SESS-441784', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-17 16:36:54'::timestamp, '2026-01-10 16:36:54'::timestamp),
  ('TENA-420585', 'RECO-627338', 'Blessing Okoro', 'basic', 'Processed for Chukwuemeka Nwosu in Rivers - completed', 'pending', 7999614.5, 'Hauwa Yusuf - approved', '+2347085680140', 'SESS-253288', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-14 16:36:54'::timestamp, '2026-02-07 16:36:54'::timestamp),
  ('TENA-452770', 'RECO-797874', 'Aisha Bello', 'corporate', 'Processed for Zainab Mohammed in Anambra - pending', 'processing', 36791803.61, 'Emmanuel Ogbonna - rejected', '+2347083212728', 'SESS-851076', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-05 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_biometric_auth
INSERT INTO "voice_biometric_auth" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-284681', 'RECO-402474', 'Victoria Etim', 'premium', 'Processed for Khadija Musa in Lagos - active', 'rejected', 12106628.17, 'Grace Adeniyi - active', '+2348792884984', 'SESS-864214', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-04 16:36:54'::timestamp, '2026-02-22 16:36:54'::timestamp),
  ('TENA-457259', 'RECO-714575', 'Abdullahi Sani', 'enterprise', 'Processed for Fatima Abdulrahman in Delta - completed', 'completed', 34047605.67, 'Rasheed Olanrewaju - approved', '+2348847584164', 'SESS-943515', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-20 16:36:54'::timestamp, '2025-12-21 16:36:54'::timestamp),
  ('TENA-126653', 'RECO-552196', 'Ifeanyi Obi', 'basic', 'Processed for Oluwaseun Adeyemi in Delta - pending', 'processing', 32531484.29, 'Rasheed Olanrewaju - active', '+2347073728042', 'SESS-880643', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-23 16:36:54'::timestamp, '2025-08-27 16:36:54'::timestamp),
  ('TENA-296949', 'RECO-176466', 'Adebayo Ogundimu', 'corporate', 'Processed for Oluwaseun Adeyemi in Delta - active', 'pending', 32394848.82, 'Yusuf Ibrahim - rejected', '+2347930417821', 'SESS-225090', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-04 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp),
  ('TENA-138775', 'RECO-283936', 'Fatima Abdulrahman', 'enterprise', 'Processed for Blessing Okoro in Enugu - processing', 'approved', 23093469.28, 'Aisha Bello - rejected', '+2348197171349', 'SESS-309824', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-27 16:36:54'::timestamp, '2025-07-26 16:36:54'::timestamp),
  ('TENA-486130', 'RECO-862517', 'Ifeanyi Obi', 'micro', 'Processed for Obinna Igwe in Delta - processing', 'active', 16655097.68, 'Abdullahi Sani - processing', '+2348807788853', 'SESS-868104', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-06 16:36:54'::timestamp, '2026-04-26 16:36:54'::timestamp),
  ('TENA-232848', 'RECO-607076', 'Rasheed Olanrewaju', 'standard', 'Processed for Folake Bakare in Lagos - approved', 'rejected', 21829547.52, 'Nkechi Nwankwo - approved', '+2348109921768', 'SESS-142918', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-23 16:36:54'::timestamp, '2026-01-19 16:36:54'::timestamp),
  ('TENA-872358', 'RECO-760322', 'Obinna Igwe', 'basic', 'Processed for Kabiru Aliyu in Kano - approved', 'processing', 39278304.86, 'Khadija Musa - approved', '+2349000076685', 'SESS-383614', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-27 16:36:54'::timestamp, '2025-06-02 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_call_analytics
INSERT INTO "voice_call_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-633241', 'RECO-499470', 'Musa Danjuma', 'micro', 'Processed for Halima Usman in Oyo - completed', 'rejected', 30178141.35, 'Blessing Okoro - approved', '+2348100930370', 'SESS-165340', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-04 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp),
  ('TENA-606858', 'RECO-149979', 'Zainab Mohammed', 'corporate', 'Processed for Aisha Bello in Lagos - approved', 'approved', 22039778.56, 'Chidinma Okafor - approved', '+2348552971982', 'SESS-452868', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-02 16:36:54'::timestamp, '2025-08-04 16:36:54'::timestamp),
  ('TENA-219301', 'RECO-997613', 'Chidinma Okafor', 'standard', 'Processed for Suleiman Abubakar in Anambra - approved', 'pending', 1483687.21, 'Aisha Bello - pending', '+2348827313034', 'SESS-439945', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-21 16:36:54'::timestamp, '2025-08-30 16:36:54'::timestamp),
  ('TENA-965209', 'RECO-452074', 'Muhammed Lawal', 'standard', 'Processed for Halima Usman in Kaduna - completed', 'active', 39856293.2, 'Zainab Mohammed - completed', '+2347281250476', 'SESS-203705', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-25 16:36:54'::timestamp, '2025-11-08 16:36:54'::timestamp),
  ('TENA-560847', 'RECO-433701', 'Hauwa Yusuf', 'micro', 'Processed for Halima Usman in Rivers - completed', 'rejected', 35106823.49, 'Kabiru Aliyu - completed', '+2347997908874', 'SESS-557699', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-25 16:36:54'::timestamp, '2025-12-19 16:36:54'::timestamp),
  ('TENA-175022', 'RECO-560148', 'Ifeanyi Obi', 'enterprise', 'Processed for Tunde Akinola in Ogun - processing', 'completed', 31894331.98, 'Khadija Musa - processing', '+2347844250268', 'SESS-177256', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-30 16:36:54'::timestamp, '2025-10-17 16:36:54'::timestamp),
  ('TENA-496582', 'RECO-267742', 'Amina Garba', 'enterprise', 'Processed for Amina Garba in Kaduna - completed', 'completed', 38627015.91, 'Yusuf Ibrahim - active', '+2347917514250', 'SESS-919465', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-20 16:36:54'::timestamp, '2026-04-03 16:36:54'::timestamp),
  ('TENA-688498', 'RECO-628623', 'Kabiru Aliyu', 'enterprise', 'Processed for Kabiru Aliyu in Ogun - pending', 'completed', 39752150.95, 'Victoria Etim - processing', '+2348659542007', 'SESS-542054', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-26 16:36:54'::timestamp, '2025-09-18 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_ivr_menu
INSERT INTO "voice_ivr_menu" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-929823', 'RECO-182681', 'Kabiru Aliyu', 'premium', 'Processed for Hauwa Yusuf in Delta - approved', 'rejected', 17245824.13, 'Abdullahi Sani - pending', '+2347259411688', 'SESS-981390', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-19 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp),
  ('TENA-532674', 'RECO-484282', 'Aisha Bello', 'enterprise', 'Processed for Emmanuel Ogbonna in Enugu - rejected', 'completed', 41661300.99, 'Musa Danjuma - approved', '+2348095504901', 'SESS-878573', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-23 16:36:54'::timestamp, '2026-04-27 16:36:54'::timestamp),
  ('TENA-192451', 'RECO-507269', 'Folake Bakare', 'micro', 'Processed for Victoria Etim in Kano - active', 'processing', 10431425.06, 'Chidinma Okafor - rejected', '+2348669536883', 'SESS-194617', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-24 16:36:54'::timestamp, '2025-06-07 16:36:54'::timestamp),
  ('TENA-263399', 'RECO-264239', 'Amina Garba', 'premium', 'Processed for Muhammed Lawal in Kaduna - completed', 'pending', 46878625.71, 'Obinna Igwe - approved', '+2347941694010', 'SESS-695891', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-21 16:36:54'::timestamp, '2025-09-21 16:36:54'::timestamp),
  ('TENA-366553', 'RECO-957255', 'Ifeanyi Obi', 'enterprise', 'Processed for Halima Usman in Kaduna - rejected', 'completed', 43194218.3, 'Emmanuel Ogbonna - active', '+2347442840865', 'SESS-232552', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-19 16:36:54'::timestamp, '2026-01-16 16:36:54'::timestamp),
  ('TENA-571671', 'RECO-718139', 'Khadija Musa', 'premium', 'Processed for Chidinma Okafor in Enugu - completed', 'processing', 11733586.79, 'Amina Garba - processing', '+2348918328303', 'SESS-400572', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-07 16:36:54'::timestamp, '2026-03-27 16:36:54'::timestamp),
  ('TENA-406726', 'RECO-647675', 'Muhammed Lawal', 'enterprise', 'Processed for Babajide Williams in Oyo - rejected', 'approved', 34519767.17, 'Aisha Bello - processing', '+2348998630443', 'SESS-449626', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2026-04-04 16:36:54'::timestamp),
  ('TENA-159120', 'RECO-135289', 'Rasheed Olanrewaju', 'premium', 'Processed for Amina Garba in Lagos - active', 'completed', 30143714.98, 'Chioma Nnamdi - approved', '+2348961873389', 'SESS-308290', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-25 16:36:54'::timestamp, '2026-03-24 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_nlu_banking
INSERT INTO "voice_nlu_banking" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-857122', 'RECO-149318', 'Fatima Abdulrahman', 'basic', 'Processed for Suleiman Abubakar in Oyo - approved', 'pending', 8561335.79, 'Adebayo Ogundimu - approved', '+2347594674645', 'SESS-333279', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-07 16:36:54'::timestamp, '2026-01-02 16:36:54'::timestamp),
  ('TENA-262488', 'RECO-135370', 'Victoria Etim', 'standard', 'Processed for Oluwaseun Adeyemi in Enugu - rejected', 'completed', 2214975.62, 'Rasheed Olanrewaju - completed', '+2348619666736', 'SESS-225383', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-17 16:36:54'::timestamp, '2025-08-12 16:36:54'::timestamp),
  ('TENA-666827', 'RECO-552315', 'Chioma Nnamdi', 'micro', 'Processed for Musa Danjuma in Kano - processing', 'rejected', 45528338.16, 'Chukwuemeka Nwosu - approved', '+2348962131956', 'SESS-169230', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-01 16:36:54'::timestamp, '2026-01-23 16:36:54'::timestamp),
  ('TENA-352843', 'RECO-285380', 'Hauwa Yusuf', 'basic', 'Processed for Rasheed Olanrewaju in Anambra - rejected', 'completed', 46910567.75, 'Obinna Igwe - processing', '+2348777123613', 'SESS-247441', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-11 16:36:54'::timestamp, '2026-02-01 16:36:54'::timestamp),
  ('TENA-958458', 'RECO-826883', 'Obinna Igwe', 'premium', 'Processed for Muhammed Lawal in Rivers - rejected', 'processing', 31158148.8, 'Amina Garba - pending', '+2348908988231', 'SESS-770628', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-22 16:36:54'::timestamp, '2026-02-07 16:36:54'::timestamp),
  ('TENA-866344', 'RECO-365834', 'Musa Danjuma', 'basic', 'Processed for Khadija Musa in Rivers - processing', 'pending', 27550411.09, 'Chukwuemeka Nwosu - processing', '+2347345480799', 'SESS-135650', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-27 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('TENA-621386', 'RECO-685024', 'Yusuf Ibrahim', 'corporate', 'Processed for Halima Usman in Anambra - processing', 'rejected', 43757478.63, 'Muhammed Lawal - rejected', '+2348465517879', 'SESS-489671', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2026-02-27 16:36:54'::timestamp),
  ('TENA-272032', 'RECO-625954', 'Muhammed Lawal', 'enterprise', 'Processed for Obinna Igwe in Abuja - approved', 'pending', 43192004.47, 'Khadija Musa - completed', '+2347964816949', 'SESS-497401', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-06 16:36:54'::timestamp, '2026-03-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: voice_tts_nigerian
INSERT INTO "voice_tts_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-847484', 'RECO-773292', 'Victoria Etim', 'enterprise', 'Processed for Aisha Bello in Enugu - processing', 'completed', 39155592.91, 'Oluwaseun Adeyemi - pending', '+2348829905809', 'SESS-103710', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-05 16:36:54'::timestamp, '2026-04-11 16:36:54'::timestamp),
  ('TENA-402416', 'RECO-944093', 'Nkechi Nwankwo', 'enterprise', 'Processed for Folake Bakare in Ogun - completed', 'rejected', 9143878.95, 'Rasheed Olanrewaju - active', '+2347165958727', 'SESS-927194', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-21 16:36:54'::timestamp, '2025-09-15 16:36:54'::timestamp),
  ('TENA-832105', 'RECO-124512', 'Rasheed Olanrewaju', 'standard', 'Processed for Yusuf Ibrahim in Abuja - pending', 'pending', 5723903.58, 'Chioma Nnamdi - rejected', '+2347346104267', 'SESS-392518', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-19 16:36:54'::timestamp, '2026-03-14 16:36:54'::timestamp),
  ('TENA-160802', 'RECO-124400', 'Tunde Akinola', 'standard', 'Processed for Victoria Etim in Anambra - active', 'rejected', 22332581.1, 'Grace Adeniyi - pending', '+2349032028250', 'SESS-181542', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-28 16:36:54'::timestamp, '2025-05-20 16:36:54'::timestamp),
  ('TENA-492356', 'RECO-760002', 'Adebayo Ogundimu', 'basic', 'Processed for Khadija Musa in Lagos - completed', 'pending', 30880431.97, 'Emmanuel Ogbonna - processing', '+2348311831452', 'SESS-923124', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-06 16:36:54'::timestamp, '2025-07-05 16:36:54'::timestamp),
  ('TENA-558298', 'RECO-623310', 'Chioma Nnamdi', 'micro', 'Processed for Ngozi Eze in Ogun - rejected', 'approved', 49251639.26, 'Ngozi Eze - processing', '+2347866281453', 'SESS-379962', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-08 16:36:54'::timestamp, '2026-03-11 16:36:54'::timestamp),
  ('TENA-886108', 'RECO-581227', 'Grace Adeniyi', 'enterprise', 'Processed for Rasheed Olanrewaju in Anambra - rejected', 'approved', 4590194.13, 'Adebayo Ogundimu - completed', '+2347200063969', 'SESS-495398', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-12 16:36:54'::timestamp, '2025-07-14 16:36:54'::timestamp),
  ('TENA-812561', 'RECO-105948', 'Victoria Etim', 'premium', 'Processed for Amina Garba in Delta - pending', 'processing', 43587043.57, 'Chioma Nnamdi - completed', '+2347369160126', 'SESS-994365', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-30 16:36:54'::timestamp, '2025-09-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: waf_rules
INSERT INTO "waf_rules" ("rule_id", "name", "category", "severity", "paranoia", "matched_24h", "blocked_24h", "false_positives", "status", "created_at") VALUES
  ('RULE-190596', 'Victoria Etim', 'micro', 'high', 4463, 660, 9340, 3630, 'pending', '2025-07-01 16:36:54'::timestamp),
  ('RULE-375022', 'Yusuf Ibrahim', 'micro', 'medium', 7810, 8798, 5009, 5967, 'completed', '2025-10-31 16:36:54'::timestamp),
  ('RULE-521918', 'Fatima Abdulrahman', 'enterprise', 'high', 5379, 4161, 2333, 3992, 'pending', '2025-08-26 16:36:54'::timestamp),
  ('RULE-389766', 'Ngozi Eze', 'basic', 'critical', 7025, 3643, 4673, 6926, 'pending', '2026-01-22 16:36:54'::timestamp),
  ('RULE-726698', 'Chidinma Okafor', 'enterprise', 'high', 8672, 6784, 4617, 2925, 'completed', '2025-11-05 16:36:54'::timestamp),
  ('RULE-692305', 'Joy Okonkwo', 'enterprise', 'critical', 1658, 8268, 3853, 3166, 'completed', '2025-09-30 16:36:54'::timestamp),
  ('RULE-210665', 'Adebayo Ogundimu', 'micro', 'info', 8411, 1071, 9893, 136, 'rejected', '2026-03-12 16:36:54'::timestamp),
  ('RULE-734443', 'Tunde Akinola', 'corporate', 'high', 886, 9377, 667, 9372, 'pending', '2025-07-17 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: warehouseReceipts
INSERT INTO "warehouseReceipts" ("receiptId", "tenantId", "depositorId", "depositorName", "warehouseId", "warehouseName", "location", "commodity", "quantity", "quantityUnit", "qualityGrade", "storageStartDate", "expiryDate", "marketValue", "currency", "pledgedAsCollateral", "collateralLoanId", "insurancePolicyId", "status", "createdAt", "updatedAt") VALUES
  ('RECE-498614', 'TENA-102254', 'DEPO-512209', 'Fatima Abdulrahman - completed', 'WARE-839169', 'Grace Adeniyi - approved', 'Khadija Musa - rejected', 'Khadija Musa - active', 4321.47, 'Tunde Akinola - approved', 'D', 'Amina Garba - pending', 'Chukwuemeka Nwosu - pending', 46067559.93, 'NGN', 1307, 'COLL-703656', 'INSU-886741', 'active', '2025-09-09 16:36:54'::timestamp, '2026-02-15 16:36:54'::timestamp),
  ('RECE-205988', 'TENA-511512', 'DEPO-978370', 'Khadija Musa - active', 'WARE-331367', 'Chioma Nnamdi - processing', 'Ngozi Eze - pending', 'Fatima Abdulrahman - approved', 3120.12, 'Adebayo Ogundimu - rejected', 'D', 'Tunde Akinola - processing', 'Blessing Okoro - rejected', 15564037.24, 'NGN', 7561, 'COLL-885136', 'INSU-675127', 'rejected', '2025-09-26 16:36:54'::timestamp, '2025-09-01 16:36:54'::timestamp),
  ('RECE-196940', 'TENA-393970', 'DEPO-455857', 'Babajide Williams - approved', 'WARE-214711', 'Ifeanyi Obi - processing', 'Emmanuel Ogbonna - pending', 'Ngozi Eze - completed', 3435.39, 'Joy Okonkwo - rejected', 'D', 'Obinna Igwe - pending', 'Babajide Williams - completed', 41115916.5, 'GBP', 3460, 'COLL-261515', 'INSU-783982', 'active', '2026-03-17 16:36:54'::timestamp, '2025-07-02 16:36:54'::timestamp),
  ('RECE-617932', 'TENA-348714', 'DEPO-692826', 'Grace Adeniyi - active', 'WARE-273612', 'Folake Bakare - pending', 'Nkechi Nwankwo - active', 'Rasheed Olanrewaju - active', 3256.68, 'Chukwuemeka Nwosu - completed', 'D', 'Halima Usman - approved', 'Joy Okonkwo - pending', 21992313.26, 'GBP', 5908, 'COLL-294376', 'INSU-948446', 'completed', '2026-03-02 16:36:54'::timestamp, '2025-11-20 16:36:54'::timestamp),
  ('RECE-620931', 'TENA-846270', 'DEPO-448952', 'Babajide Williams - processing', 'WARE-412301', 'Halima Usman - rejected', 'Halima Usman - active', 'Musa Danjuma - processing', 3330.57, 'Hauwa Yusuf - processing', 'A', 'Fatima Abdulrahman - pending', 'Oluwaseun Adeyemi - rejected', 46137487.3, 'GBP', 846, 'COLL-804704', 'INSU-320933', 'processing', '2025-07-03 16:36:54'::timestamp, '2025-08-16 16:36:54'::timestamp),
  ('RECE-961556', 'TENA-833965', 'DEPO-527590', 'Emmanuel Ogbonna - active', 'WARE-678787', 'Blessing Okoro - completed', 'Aisha Bello - pending', 'Halima Usman - active', 6902.38, 'Khadija Musa - pending', 'A', 'Folake Bakare - processing', 'Amina Garba - rejected', 20412161.77, 'GBP', 6333, 'COLL-903564', 'INSU-505407', 'processing', '2025-12-21 16:36:54'::timestamp, '2025-05-18 16:36:54'::timestamp),
  ('RECE-525869', 'TENA-945061', 'DEPO-218162', 'Oluwaseun Adeyemi - active', 'WARE-438665', 'Adebayo Ogundimu - processing', 'Ifeanyi Obi - rejected', 'Zainab Mohammed - active', 4813.68, 'Fatima Abdulrahman - rejected', 'A', 'Blessing Okoro - completed', 'Ngozi Eze - completed', 2508304.76, 'GBP', 2181, 'COLL-955361', 'INSU-785781', 'processing', '2026-03-06 16:36:54'::timestamp, '2026-03-20 16:36:54'::timestamp),
  ('RECE-158488', 'TENA-986539', 'DEPO-264245', 'Segun Oladipo - active', 'WARE-882138', 'Babajide Williams - active', 'Obinna Igwe - rejected', 'Suleiman Abubakar - processing', 7740.59, 'Suleiman Abubakar - pending', 'B', 'Hauwa Yusuf - pending', 'Ngozi Eze - active', 7535890.15, 'GBP', 7994, 'COLL-303452', 'INSU-440261', 'approved', '2025-06-20 16:36:54'::timestamp, '2026-01-09 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: warehouse_management
INSERT INTO "warehouse_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('TENA-949850', 'RECO-614446', 'Khadija Musa', 'premium', 'Processed for Hauwa Yusuf in Oyo - rejected', 'active', 2463245.15, 'Rivers', 'REF-192262', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-19 16:36:54'::timestamp, '2025-07-30 16:36:54'::timestamp),
  ('TENA-459558', 'RECO-746947', 'Halima Usman', 'micro', 'Processed for Chukwuemeka Nwosu in Lagos - completed', 'active', 41655906.38, 'Anambra', 'REF-907626', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-31 16:36:54'::timestamp, '2025-10-14 16:36:54'::timestamp),
  ('TENA-506847', 'RECO-176482', 'Zainab Mohammed', 'enterprise', 'Processed for Aisha Bello in Abuja - approved', 'processing', 42839536.79, 'Delta', 'REF-987183', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-09-19 16:36:54'::timestamp, '2025-06-30 16:36:54'::timestamp),
  ('TENA-158002', 'RECO-270065', 'Adebayo Ogundimu', 'enterprise', 'Processed for Oluwaseun Adeyemi in Abuja - rejected', 'approved', 25659428.08, 'Kano', 'REF-122155', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-24 16:36:54'::timestamp, '2025-07-03 16:36:54'::timestamp),
  ('TENA-117189', 'RECO-124636', 'Obinna Igwe', 'basic', 'Processed for Chidinma Okafor in Ogun - active', 'active', 7678246.63, 'Abuja', 'REF-896519', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-10 16:36:54'::timestamp, '2026-01-07 16:36:54'::timestamp),
  ('TENA-133596', 'RECO-432042', 'Tunde Akinola', 'basic', 'Processed for Aisha Bello in Lagos - active', 'processing', 26919871.41, 'Ogun', 'REF-194829', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-09 16:36:54'::timestamp, '2026-02-26 16:36:54'::timestamp),
  ('TENA-613034', 'RECO-642723', 'Zainab Mohammed', 'corporate', 'Processed for Folake Bakare in Anambra - active', 'pending', 41285925.9, 'Anambra', 'REF-357139', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-07 16:36:54'::timestamp, '2026-04-29 16:36:54'::timestamp),
  ('TENA-463270', 'RECO-581848', 'Chukwuemeka Nwosu', 'enterprise', 'Processed for Rasheed Olanrewaju in Kaduna - rejected', 'approved', 29325495.54, 'Kano', 'REF-271723', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-19 16:36:54'::timestamp, '2025-11-13 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: watchlist_sources
INSERT INTO "watchlist_sources" ("name", "source", "url", "format", "entries", "syncFrequency", "autoSync", "status", "created_at") VALUES
  ('Grace Adeniyi', 'CBN', 'https://api.54bank.ng/watchlist_sources/559918', 'Ifeanyi Obi - rejected', 8377, 'Folake Bakare - pending', true, 'completed', '2025-10-09 16:36:54'::timestamp),
  ('Hauwa Yusuf', 'OFAC', 'https://api.54bank.ng/watchlist_sources/492066', 'Segun Oladipo - pending', 4623, 'Kabiru Aliyu - completed', false, 'pending', '2025-07-04 16:36:54'::timestamp),
  ('Zainab Mohammed', 'NFIU', 'https://api.54bank.ng/watchlist_sources/456263', 'Yusuf Ibrahim - rejected', 6326, 'Victoria Etim - rejected', false, 'active', '2026-01-24 16:36:54'::timestamp),
  ('Kabiru Aliyu', 'CBN', 'https://api.54bank.ng/watchlist_sources/227900', 'Adebayo Ogundimu - pending', 2250, 'Musa Danjuma - pending', true, 'rejected', '2025-08-23 16:36:54'::timestamp),
  ('Emmanuel Ogbonna', 'NFIU', 'https://api.54bank.ng/watchlist_sources/166250', 'Fatima Abdulrahman - processing', 9625, 'Kabiru Aliyu - processing', true, 'pending', '2025-05-24 16:36:54'::timestamp),
  ('Segun Oladipo', 'internal', 'https://api.54bank.ng/watchlist_sources/846784', 'Babajide Williams - approved', 3490, 'Tunde Akinola - active', false, 'active', '2025-10-17 16:36:54'::timestamp),
  ('Chioma Nnamdi', 'internal', 'https://api.54bank.ng/watchlist_sources/658068', 'Fatima Abdulrahman - rejected', 7050, 'Chukwuemeka Nwosu - active', true, 'active', '2026-01-16 16:36:54'::timestamp),
  ('Aisha Bello', 'internal', 'https://api.54bank.ng/watchlist_sources/683601', 'Grace Adeniyi - active', 5062, 'Ifeanyi Obi - active', true, 'rejected', '2025-11-05 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: whatsapp_banking_flows
INSERT INTO "whatsapp_banking_flows" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-103305', 'RECO-756494', 'Fatima Abdulrahman', 'basic', 'Processed for Hauwa Yusuf in Delta - approved', 'completed', 36478661.8, 'Chidinma Okafor - completed', '+2348365053881', 'SESS-260903', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-10 16:36:54'::timestamp, '2025-08-07 16:36:54'::timestamp),
  ('TENA-415066', 'RECO-155940', 'Folake Bakare', 'premium', 'Processed for Zainab Mohammed in Abuja - processing', 'rejected', 37271306.8, 'Chioma Nnamdi - active', '+2347536837401', 'SESS-368394', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-16 16:36:54'::timestamp, '2025-11-11 16:36:54'::timestamp),
  ('TENA-388481', 'RECO-397047', 'Joy Okonkwo', 'standard', 'Processed for Oluwaseun Adeyemi in Rivers - pending', 'rejected', 26702193.16, 'Suleiman Abubakar - active', '+2347973759391', 'SESS-737071', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-04 16:36:54'::timestamp, '2026-02-16 16:36:54'::timestamp),
  ('TENA-333900', 'RECO-278365', 'Blessing Okoro', 'corporate', 'Processed for Halima Usman in Anambra - pending', 'processing', 19599943.03, 'Victoria Etim - active', '+2347771091278', 'SESS-176136', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-10 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp),
  ('TENA-791827', 'RECO-505089', 'Segun Oladipo', 'standard', 'Processed for Chioma Nnamdi in Rivers - pending', 'approved', 31557175.72, 'Chioma Nnamdi - rejected', '+2348419434668', 'SESS-171639', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2025-08-31 16:36:54'::timestamp),
  ('TENA-293031', 'RECO-289876', 'Folake Bakare', 'enterprise', 'Processed for Zainab Mohammed in Enugu - approved', 'approved', 11305933.42, 'Joy Okonkwo - completed', '+2348113166895', 'SESS-194647', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-05 16:36:54'::timestamp, '2026-04-15 16:36:54'::timestamp),
  ('TENA-167534', 'RECO-748476', 'Yusuf Ibrahim', 'standard', 'Processed for Chidinma Okafor in Enugu - active', 'rejected', 48613828.75, 'Grace Adeniyi - approved', '+2348093152504', 'SESS-257696', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-13 16:36:54'::timestamp, '2026-05-04 16:36:54'::timestamp),
  ('TENA-652021', 'RECO-129026', 'Yusuf Ibrahim', 'standard', 'Processed for Tunde Akinola in Abuja - approved', 'pending', 42564801.54, 'Blessing Okoro - pending', '+2348707099320', 'SESS-367875', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-24 16:36:54'::timestamp, '2026-02-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: whatsapp_business_gateway
INSERT INTO "whatsapp_business_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-421175', 'RECO-140630', 'Oluwaseun Adeyemi', 'premium', 'Processed for Hauwa Yusuf in Oyo - completed', 'active', 15925717.29, 'Tunde Akinola - processing', '+2347197171849', 'SESS-237287', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-15 16:36:54'::timestamp, '2026-04-21 16:36:54'::timestamp),
  ('TENA-299001', 'RECO-970877', 'Ngozi Eze', 'basic', 'Processed for Khadija Musa in Lagos - pending', 'processing', 31633872.15, 'Amina Garba - processing', '+2347738313317', 'SESS-325934', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-08 16:36:54'::timestamp, '2025-06-12 16:36:54'::timestamp),
  ('TENA-130572', 'RECO-886151', 'Babajide Williams', 'corporate', 'Processed for Yusuf Ibrahim in Abuja - processing', 'completed', 47250111.08, 'Chidinma Okafor - approved', '+2348163385074', 'SESS-979294', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-25 16:36:54'::timestamp, '2025-05-30 16:36:54'::timestamp),
  ('TENA-940761', 'RECO-953001', 'Kabiru Aliyu', 'enterprise', 'Processed for Obinna Igwe in Oyo - processing', 'active', 19800046.12, 'Khadija Musa - pending', '+2347392279838', 'SESS-197800', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-31 16:36:54'::timestamp, '2025-07-18 16:36:54'::timestamp),
  ('TENA-926747', 'RECO-987750', 'Emmanuel Ogbonna', 'basic', 'Processed for Ifeanyi Obi in Kano - rejected', 'processing', 3567010.69, 'Halima Usman - rejected', '+2347062914272', 'SESS-901315', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-10 16:36:54'::timestamp, '2026-04-12 16:36:54'::timestamp),
  ('TENA-407124', 'RECO-855164', 'Babajide Williams', 'micro', 'Processed for Obinna Igwe in Oyo - pending', 'completed', 18459204.44, 'Emmanuel Ogbonna - completed', '+2348339738629', 'SESS-863928', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-29 16:36:54'::timestamp, '2025-09-02 16:36:54'::timestamp),
  ('TENA-489224', 'RECO-533843', 'Tunde Akinola', 'micro', 'Processed for Suleiman Abubakar in Lagos - rejected', 'approved', 42327852.14, 'Oluwaseun Adeyemi - pending', '+2347956337971', 'SESS-643696', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-03 16:36:54'::timestamp, '2025-09-13 16:36:54'::timestamp),
  ('TENA-477954', 'RECO-412307', 'Aisha Bello', 'premium', 'Processed for Zainab Mohammed in Kano - completed', 'pending', 49094231.84, 'Hauwa Yusuf - active', '+2347416308682', 'SESS-609820', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-13 16:36:54'::timestamp, '2026-04-28 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: whatsapp_document_service
INSERT INTO "whatsapp_document_service" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-277874', 'RECO-976983', 'Khadija Musa', 'basic', 'Processed for Halima Usman in Ogun - rejected', 'completed', 5940986.37, 'Oluwaseun Adeyemi - rejected', '+2348292160376', 'SESS-198783', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-18 16:36:54'::timestamp, '2026-03-19 16:36:54'::timestamp),
  ('TENA-757914', 'RECO-664240', 'Suleiman Abubakar', 'premium', 'Processed for Folake Bakare in Rivers - completed', 'active', 29098326.4, 'Zainab Mohammed - active', '+2347491268063', 'SESS-511059', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-23 16:36:54'::timestamp, '2025-08-15 16:36:54'::timestamp),
  ('TENA-897621', 'RECO-433491', 'Nkechi Nwankwo', 'corporate', 'Processed for Adebayo Ogundimu in Enugu - pending', 'processing', 9588388.05, 'Halima Usman - active', '+2348115762773', 'SESS-508796', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-01 16:36:54'::timestamp, '2026-01-31 16:36:54'::timestamp),
  ('TENA-930932', 'RECO-255682', 'Kabiru Aliyu', 'enterprise', 'Processed for Rasheed Olanrewaju in Kano - processing', 'processing', 39664719.57, 'Ngozi Eze - pending', '+2347024930869', 'SESS-160517', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-01-25 16:36:54'::timestamp, '2026-04-14 16:36:54'::timestamp),
  ('TENA-637429', 'RECO-219439', 'Amina Garba', 'premium', 'Processed for Yusuf Ibrahim in Lagos - rejected', 'active', 2213533.31, 'Adebayo Ogundimu - rejected', '+2347591740313', 'SESS-766713', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-21 16:36:54'::timestamp, '2025-12-07 16:36:54'::timestamp),
  ('TENA-709375', 'RECO-944039', 'Aisha Bello', 'enterprise', 'Processed for Musa Danjuma in Enugu - pending', 'active', 22423806.51, 'Joy Okonkwo - processing', '+2348370959505', 'SESS-705437', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-23 16:36:54'::timestamp, '2025-11-04 16:36:54'::timestamp),
  ('TENA-152678', 'RECO-256225', 'Victoria Etim', 'premium', 'Processed for Halima Usman in Lagos - pending', 'completed', 11220683.45, 'Victoria Etim - rejected', '+2348508156133', 'SESS-925111', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-08-11 16:36:54'::timestamp, '2026-05-05 16:36:54'::timestamp),
  ('TENA-573283', 'RECO-296472', 'Ngozi Eze', 'enterprise', 'Processed for Khadija Musa in Rivers - active', 'pending', 48990651.79, 'Khadija Musa - processing', '+2349044313163', 'SESS-765409', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-05 16:36:54'::timestamp, '2026-03-04 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: whatsapp_notification
INSERT INTO "whatsapp_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-470586', 'RECO-218244', 'Kabiru Aliyu', 'basic', 'Processed for Blessing Okoro in Enugu - completed', 'active', 685656.15, 'Suleiman Abubakar - approved', '+2347251145629', 'SESS-434598', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-20 16:36:54'::timestamp, '2025-09-06 16:36:54'::timestamp),
  ('TENA-600429', 'RECO-340706', 'Yusuf Ibrahim', 'micro', 'Processed for Segun Oladipo in Enugu - rejected', 'active', 10969983.31, 'Chioma Nnamdi - rejected', '+2347228651390', 'SESS-848009', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-05-16 16:36:54'::timestamp, '2026-01-29 16:36:54'::timestamp),
  ('TENA-349131', 'RECO-687171', 'Folake Bakare', 'premium', 'Processed for Segun Oladipo in Lagos - approved', 'completed', 15226977.26, 'Grace Adeniyi - completed', '+2347254409032', 'SESS-521441', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-11-07 16:36:54'::timestamp, '2025-09-19 16:36:54'::timestamp),
  ('TENA-227857', 'RECO-350494', 'Chukwuemeka Nwosu', 'micro', 'Processed for Oluwaseun Adeyemi in Delta - approved', 'active', 10284722.78, 'Folake Bakare - pending', '+2347933148795', 'SESS-364359', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-02-05 16:36:54'::timestamp, '2026-02-15 16:36:54'::timestamp),
  ('TENA-645806', 'RECO-959145', 'Folake Bakare', 'enterprise', 'Processed for Obinna Igwe in Lagos - active', 'approved', 45386887.45, 'Suleiman Abubakar - approved', '+2347276243070', 'SESS-291804', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-25 16:36:54'::timestamp, '2025-09-30 16:36:54'::timestamp),
  ('TENA-908427', 'RECO-774120', 'Chioma Nnamdi', 'basic', 'Processed for Muhammed Lawal in Kaduna - rejected', 'pending', 48180203.08, 'Ifeanyi Obi - completed', '+2348237957206', 'SESS-543708', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-06-04 16:36:54'::timestamp, '2025-12-15 16:36:54'::timestamp),
  ('TENA-843353', 'RECO-650117', 'Joy Okonkwo', 'standard', 'Processed for Musa Danjuma in Rivers - approved', 'pending', 11573768.39, 'Khadija Musa - processing', '+2348863386230', 'SESS-479473', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-03 16:36:54'::timestamp, '2025-10-06 16:36:54'::timestamp),
  ('TENA-707897', 'RECO-611856', 'Kabiru Aliyu', 'basic', 'Processed for Folake Bakare in Kano - completed', 'pending', 45222832.24, 'Ifeanyi Obi - completed', '+2347818234894', 'SESS-905087', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-22 16:36:54'::timestamp, '2026-03-30 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: whatsapp_payment_integration
INSERT INTO "whatsapp_payment_integration" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "channel", "msisdn", "session_id", "metadata", "created_at", "updated_at") VALUES
  ('TENA-449741', 'RECO-199008', 'Oluwaseun Adeyemi', 'enterprise', 'Processed for Khadija Musa in Rivers - pending', 'approved', 17331514.44, 'Khadija Musa - approved', '+2347130562403', 'SESS-189724', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-15 16:36:54'::timestamp, '2025-07-12 16:36:54'::timestamp),
  ('TENA-948020', 'RECO-361020', 'Zainab Mohammed', 'micro', 'Processed for Suleiman Abubakar in Kano - active', 'active', 40651751.7, 'Zainab Mohammed - active', '+2347231918194', 'SESS-334566', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-10-12 16:36:54'::timestamp, '2025-09-07 16:36:54'::timestamp),
  ('TENA-448865', 'RECO-429733', 'Muhammed Lawal', 'micro', 'Processed for Amina Garba in Enugu - completed', 'processing', 17282530.88, 'Segun Oladipo - processing', '+2348281980818', 'SESS-249612', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-07-09 16:36:54'::timestamp, '2026-02-21 16:36:54'::timestamp),
  ('TENA-522402', 'RECO-225035', 'Musa Danjuma', 'enterprise', 'Processed for Amina Garba in Delta - pending', 'approved', 20144781.53, 'Ifeanyi Obi - active', '+2347239063384', 'SESS-590134', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-03-05 16:36:54'::timestamp, '2025-10-27 16:36:54'::timestamp),
  ('TENA-987111', 'RECO-151884', 'Emmanuel Ogbonna', 'micro', 'Processed for Segun Oladipo in Abuja - completed', 'rejected', 20086316.41, 'Adebayo Ogundimu - rejected', '+2348989500797', 'SESS-765209', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-11 16:36:54'::timestamp, '2026-05-09 16:36:54'::timestamp),
  ('TENA-245394', 'RECO-251131', 'Rasheed Olanrewaju', 'basic', 'Processed for Grace Adeniyi in Abuja - completed', 'active', 48560804.15, 'Chidinma Okafor - approved', '+2347468367126', 'SESS-325834', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-04-22 16:36:54'::timestamp, '2025-08-29 16:36:54'::timestamp),
  ('TENA-121051', 'RECO-760096', 'Folake Bakare', 'enterprise', 'Processed for Suleiman Abubakar in Anambra - pending', 'pending', 3506866.26, 'Amina Garba - active', '+2348065974556', 'SESS-184103', '{"status": "active", "region": "Nigeria"}'::jsonb, '2025-12-20 16:36:54'::timestamp, '2025-09-03 16:36:54'::timestamp),
  ('TENA-982785', 'RECO-917420', 'Segun Oladipo', 'basic', 'Processed for Grace Adeniyi in Oyo - completed', 'processing', 35405273.6, 'Nkechi Nwankwo - pending', '+2349045618416', 'SESS-234733', '{"status": "active", "region": "Nigeria"}'::jsonb, '2026-05-08 16:36:54'::timestamp, '2025-09-26 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: wire_transfer_monitor
INSERT INTO "wire_transfer_monitor" ("originatorName", "beneficiaryName", "amount", "currency", "travelRuleCompliant", "status", "created_at") VALUES
  ('Yusuf Ibrahim - pending', 'Chukwuemeka Nwosu - processing', 10650669, 'NGN', false, 'completed', '2025-08-11 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - processing', 'Obinna Igwe - processing', 4337303, 'NGN', true, 'pending', '2026-04-03 16:36:54'::timestamp),
  ('Blessing Okoro - processing', 'Suleiman Abubakar - rejected', 28186006, 'USD', true, 'active', '2025-11-19 16:36:54'::timestamp),
  ('Muhammed Lawal - processing', 'Grace Adeniyi - pending', 41241349, 'NGN', false, 'completed', '2025-06-04 16:36:54'::timestamp),
  ('Musa Danjuma - completed', 'Chukwuemeka Nwosu - rejected', 4819586, 'GBP', true, 'pending', '2025-10-26 16:36:54'::timestamp),
  ('Muhammed Lawal - pending', 'Ifeanyi Obi - active', 41300303, 'NGN', false, 'approved', '2025-08-06 16:36:54'::timestamp),
  ('Emmanuel Ogbonna - active', 'Nkechi Nwankwo - processing', 8674060, 'GBP', false, 'approved', '2026-01-01 16:36:54'::timestamp),
  ('Victoria Etim - approved', 'Khadija Musa - rejected', 40627684, 'EUR', false, 'completed', '2026-03-19 16:36:54'::timestamp)
ON CONFLICT DO NOTHING;

-- Table: workflowCases
INSERT INTO "workflowCases" ("workflowId", "customer", "product", "stage", "status", "channel", "amount", "nextAction", "slaHours", "createdAt", "updatedAt") VALUES
  ('WORK-975954', 'Nkechi Nwankwo - pending', 'Ifeanyi Obi - rejected', 'Rasheed Olanrewaju - completed', 'completed', 'Suleiman Abubakar - rejected', 22427035.3, 'transfer', 9159, '2026-01-29 16:36:54'::timestamp, '2025-11-18 16:36:54'::timestamp),
  ('WORK-411810', 'Chioma Nnamdi - processing', 'Aisha Bello - processing', 'Chukwuemeka Nwosu - rejected', 'rejected', 'Oluwaseun Adeyemi - rejected', 15024513.87, 'reject', 712, '2025-10-19 16:36:54'::timestamp, '2026-03-18 16:36:54'::timestamp),
  ('WORK-787807', 'Chioma Nnamdi - approved', 'Segun Oladipo - processing', 'Chioma Nnamdi - active', 'processing', 'Fatima Abdulrahman - rejected', 35873712.6, 'approve', 5589, '2025-12-12 16:36:54'::timestamp, '2025-08-02 16:36:54'::timestamp),
  ('WORK-148062', 'Aisha Bello - rejected', 'Emmanuel Ogbonna - approved', 'Halima Usman - rejected', 'pending', 'Emmanuel Ogbonna - rejected', 6026911.14, 'approve', 7206, '2026-01-15 16:36:54'::timestamp, '2025-10-06 16:36:54'::timestamp),
  ('WORK-222219', 'Suleiman Abubakar - completed', 'Chidinma Okafor - pending', 'Victoria Etim - active', 'approved', 'Segun Oladipo - completed', 48997604.53, 'reject', 4529, '2026-02-04 16:36:54'::timestamp, '2026-03-28 16:36:54'::timestamp),
  ('WORK-589806', 'Kabiru Aliyu - approved', 'Abdullahi Sani - active', 'Chidinma Okafor - rejected', 'rejected', 'Abdullahi Sani - rejected', 11898972.89, 'update', 4213, '2026-04-29 16:36:55'::timestamp, '2026-02-03 16:36:55'::timestamp),
  ('WORK-225480', 'Chukwuemeka Nwosu - approved', 'Yusuf Ibrahim - processing', 'Grace Adeniyi - pending', 'pending', 'Zainab Mohammed - rejected', 35402810.94, 'create', 5802, '2025-12-25 16:36:55'::timestamp, '2025-11-21 16:36:55'::timestamp),
  ('WORK-791989', 'Segun Oladipo - completed', 'Joy Okonkwo - rejected', 'Babajide Williams - processing', 'completed', 'Ifeanyi Obi - approved', 41904841.64, 'approve', 9023, '2025-10-20 16:36:55'::timestamp, '2025-10-24 16:36:55'::timestamp)
ON CONFLICT DO NOTHING;
