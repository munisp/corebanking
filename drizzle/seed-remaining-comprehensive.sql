-- ═══════════════════════════════════════════════════════════════════════════
-- 54Bank — Comprehensive Seed Data (Remaining Tables)
-- Generated: 2026-05-09T12:00:00
-- Tables: 256 remaining tables with 8 rows each
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;


-- ─── acgsf_guarantee ───
INSERT INTO "acgsf_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-580b18bb741d', 'Ifeoma Taiwo', 'finance', 'Ifeoma Taiwo - Benin City - Acgsf Guarantee', 'approved', 3804517.13, 'Plateau', 'REF-ADEF81ED4D', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-09-14 08:58:46', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-03187015fb04', 'Esther Garba', 'payments', 'Esther Garba - Kano - Acgsf Guarantee', 'active', 4957150.23, 'Akwa Ibom', 'REF-04838CCBF4', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-12-18 17:38:25', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-895f2620a31a', 'Femi Taiwo', 'finance', 'Femi Taiwo - Zaria - Acgsf Guarantee', 'approved', 2732227.08, 'Oyo', 'REF-57268734CB', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-03-17 03:40:56', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-31e9b5913cad', 'Segun Okafor', 'lending', 'Segun Okafor - Victoria Island - Acgsf Guarantee', 'approved', 6772379.76, 'Imo', 'REF-C34E791BE9', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-07-26 10:57:23', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f454d767d472', 'Olumide Adenuga', 'operations', 'Olumide Adenuga - Maitama - Acgsf Guarantee', 'pending', 3790045.75, 'Lagos', 'REF-B316FE1BAA', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-06-11 13:59:28', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-a00ee0e6a200', 'Esther Usman', 'compliance', 'Esther Usman - Warri - Acgsf Guarantee', 'pending', 2445910.02, 'Lagos', 'REF-8C7166F06E', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2026-01-12 16:49:10', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-1884bef6a302', 'Pelumi Kalu', 'technology', 'Pelumi Kalu - Asaba - Acgsf Guarantee', 'approved', 3883562.76, 'Imo', 'REF-E6E9B38318', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2026-03-05 03:47:53', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-57f2cf6dfdde', 'Kemi Okafor', 'finance', 'Kemi Okafor - Kano - Acgsf Guarantee', 'completed', 4840338.35, 'Delta', 'REF-E716486457', '{"source": "seed", "table": "acgsf_guarantee"}'::jsonb, '2025-03-05 02:08:38', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── adverse_media_hits ───
INSERT INTO "adverse_media_hits" ("entityName", "source", "headline", "riskImpact", "sentiment", "url", "detectedAt", "reviewedAt", "status") VALUES
  ('Maryam Jimoh', 'ADVERS-9fb09a6c0435', 'Adaeze Igwe - Victoria Island, Rivers - adverse_media_hits record', 'high', 3842396.24, 'https://cdn.54bank.ng/adverse_media_hits/66442a32', '2025-11-24 02:37:09', '2025-11-07 15:33:32', 'pending'),
  ('Titilayo Elumelu', 'ADVERS-39c992d728ee', 'Ibrahim Nwosu - Abeokuta, Anambra - adverse_media_hits record', 'medium', 7730051.24, 'https://cdn.54bank.ng/adverse_media_hits/05f13795', '2026-03-09 12:36:00', '2025-08-17 01:23:38', 'completed'),
  ('Ibrahim Garba', 'ADVERS-09f705473ce7', 'Musa Dangote - Abeokuta, Edo - adverse_media_hits record', 'high', 2161803.93, 'https://cdn.54bank.ng/adverse_media_hits/ab90c3e7', '2025-11-28 23:44:55', '2025-07-21 20:22:42', 'processing'),
  ('Bukola Chukwu', 'ADVERS-15ab406b58f0', 'Olumide Balogun - Awka, Borno - adverse_media_hits record', 'medium', 2141203.29, 'https://cdn.54bank.ng/adverse_media_hits/9d368c4a', '2025-11-15 04:04:58', '2025-12-13 20:09:43', 'processing'),
  ('Grace Eze', 'ADVERS-c5eaab4daad5', 'Hauwa Sanusi - Asaba, Lagos - adverse_media_hits record', 'low', 1708848.15, 'https://cdn.54bank.ng/adverse_media_hits/200270d0', '2025-06-26 04:34:10', '2025-10-29 16:18:02', 'completed'),
  ('Emeka Usman', 'ADVERS-bc3e96ee8ee0', 'Nnamdi Okafor - Ikeja, Anambra - adverse_media_hits record', 'high', 4863277.52, 'https://cdn.54bank.ng/adverse_media_hits/d20d25cb', '2025-02-16 22:22:10', '2025-11-01 21:02:59', 'processing'),
  ('Gbenga Mohammed', 'ADVERS-f7b82819c1f5', 'Chukwuemeka Peterside - Asaba, Delta - adverse_media_hits record', 'medium', 8787024.53, 'https://cdn.54bank.ng/adverse_media_hits/8035dc92', '2025-05-26 17:15:58', '2025-09-25 11:34:55', 'processing'),
  ('Dorcas Kalu', 'ADVERS-eb7c7159a4a1', 'Esther Jimoh - Abeokuta, Anambra - adverse_media_hits record', 'high', 5286011.17, 'https://cdn.54bank.ng/adverse_media_hits/f9114764', '2025-05-07 07:27:57', '2025-11-01 01:10:21', 'pending')
ON CONFLICT DO NOTHING;


-- ─── adverse_media_scans ───
INSERT INTO "adverse_media_scans" ("customerId", "customerName", "relevantArticles", "sentiment", "riskImpact", "status", "createdAt") VALUES
  ('CUST-f92a7856f815', 'Gbenga Jimoh', 937, 'ADVERS-b7e31cfd5eb2', 'low', 'approved', '2025-03-25 05:44:08'),
  ('CUST-3abad18fb623', 'Uzo Lawal', 525, 'ADVERS-b1e4a17cd560', 'low', 'active', '2025-05-29 10:08:41'),
  ('CUST-e1214a8db1fc', 'Sade Garba', 837, 'ADVERS-7c9365aca2dc', 'medium', 'completed', '2025-03-10 22:30:09'),
  ('CUST-ad2f97e8aa09', 'Kemi Dangote', 123, 'ADVERS-35552123f049', 'critical', 'approved', '2025-04-30 08:44:16'),
  ('CUST-cf71e7bc21c9', 'Olumide Okafor', 750, 'ADVERS-1f531f9e705a', 'medium', 'pending', '2025-02-28 05:53:54'),
  ('CUST-4f5781d85cd6', 'Hauwa Chukwu', 879, 'ADVERS-e0757fcb4812', 'high', 'approved', '2025-05-20 15:09:44'),
  ('CUST-b1c8ff43d90c', 'Pelumi Fashola', 775, 'ADVERS-533b92b8c400', 'critical', 'approved', '2025-11-26 00:15:57'),
  ('CUST-6425491b4386', 'Ibrahim Otedola', 318, 'ADVERS-c6aedd1197c0', 'low', 'active', '2025-05-22 20:55:11')
ON CONFLICT DO NOTHING;


-- ─── agent_farmer_onboarding ───
INSERT INTO "agent_farmer_onboarding" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-628e8e317c12', 'Hauwa Danladi', 'compliance', 'Hauwa Danladi - Benin City - Agent Farmer Onboarding', 'completed', 3397239.8, 'Anambra', 'REF-30E47109BA', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-05-27 14:09:50', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-b8466378926c', 'Pelumi Mohammed', 'operations', 'Pelumi Mohammed - Ikeja - Agent Farmer Onboarding', 'approved', 4409668.74, 'Enugu', 'REF-811EFF41F0', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-03-05 21:40:11', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-c3ecef55cda1', 'Sade Peterside', 'technology', 'Sade Peterside - Port Harcourt - Agent Farmer Onboarding', 'pending', 3717181.65, 'Osun', 'REF-D9271539FF', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-10-02 02:33:44', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-56e213440438', 'Chukwuemeka Hassan', 'risk', 'Chukwuemeka Hassan - Ikeja - Agent Farmer Onboarding', 'approved', 640963.65, 'Rivers', 'REF-5F78CF5809', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-10-13 03:26:10', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-0dd33bd0c673', 'Sade Balogun', 'payments', 'Sade Balogun - Victoria Island - Agent Farmer Onboarding', 'active', 2924997.22, 'Enugu', 'REF-494CBC399D', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2026-03-21 15:57:02', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-d79464c4bbcf', 'Chukwuemeka Yakubu', 'risk', 'Chukwuemeka Yakubu - Enugu - Agent Farmer Onboarding', 'approved', 8322308.98, 'Cross River', 'REF-12F0763BF5', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-01-01 20:45:24', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-60848923f7a5', 'Rasheed Chukwu', 'finance', 'Rasheed Chukwu - Port Harcourt - Agent Farmer Onboarding', 'pending', 7359250.02, 'Akwa Ibom', 'REF-68464F5670', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2026-03-17 01:05:19', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-1b7d72225340', 'Musa Kalu', 'operations', 'Musa Kalu - Port Harcourt - Agent Farmer Onboarding', 'processing', 1895772.93, 'Plateau', 'REF-DCCC716665', '{"source": "seed", "table": "agent_farmer_onboarding"}'::jsonb, '2025-08-14 08:58:22', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agent_kyc_captures ───
INSERT INTO "agent_kyc_captures" ("agentId", "agentName", "customerId", "customerName", "lga", "state", "offlineCapture", "qualityScore", "gpsLat", "gpsLng", "syncedAt", "createdAt") VALUES
  ('AGEN-31b0bd6601e9', 'Kunle Eze', 'CUST-2f9b421596af', 'Hauwa Danladi', 'Rivers', 'Lagos', 571, 62.9131, 4.124818, 12.570252, '2025-12-23 07:40:21', '2026-02-07 06:51:41'),
  ('AGEN-b2f4bf0eac26', 'Sade Yakubu', 'CUST-b2010af53d75', 'Bukola Otedola', 'Akwa Ibom', 'Edo', 874, 89.4693, 12.122111, 2.869353, '2026-02-28 09:25:02', '2025-03-08 08:19:37'),
  ('AGEN-e0d2a4f9fb47', 'Musa Lawal', 'CUST-3a7a2525bff8', 'Uche Otedola', 'Cross River', 'Osun', 941, 13.3299, 9.832633, 4.263418, '2026-05-02 00:53:16', '2025-05-05 10:41:38'),
  ('AGEN-8e069d1993cd', 'Patience Usman', 'CUST-db99e2c5cc94', 'Kemi Adenuga', 'Edo', 'Edo', 952, 42.3842, 12.252277, 12.687518, '2026-01-13 02:11:52', '2025-03-11 03:10:47'),
  ('AGEN-b89d1dbc3dec', 'Chidinma Otedola', 'CUST-7430254b16ce', 'Kunle Jimoh', 'Borno', 'Edo', 196, 44.7734, 6.46444, 13.476845, '2025-10-07 15:47:48', '2025-12-09 12:27:26'),
  ('AGEN-9f6d12d6cd8d', 'Sade Adeyemi', 'CUST-24ab09e2e538', 'Adaeze Dangote', 'Kaduna', 'Akwa Ibom', 985, 41.1754, 9.912296, 5.714086, '2026-02-04 04:24:55', '2025-05-18 08:30:16'),
  ('AGEN-2a602e4b1d6c', 'Jide Jimoh', 'CUST-1e9a79e5944e', 'Kemi Dangote', 'Kano', 'Akwa Ibom', 277, 15.4676, 10.418161, 9.369047, '2026-02-16 04:34:56', '2025-01-11 14:54:52'),
  ('AGEN-28558a43f214', 'Nneka Dangote', 'CUST-704444591d35', 'Uche Peterside', 'Ogun', 'Plateau', 921, 80.2224, 8.463831, 7.163056, '2026-04-22 17:47:22', '2025-11-16 04:29:17')
ON CONFLICT DO NOTHING;


-- ─── aggregation_center ───
INSERT INTO "aggregation_center" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-6d912dd1a916', 'Adewale Danladi', 'risk', 'Adewale Danladi - Port Harcourt - Aggregation Center', 'approved', 2374736.66, 'Cross River', 'REF-AD76690155', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-11-06 16:44:49', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-4b5c4ed6bb10', 'Maryam Peterside', 'finance', 'Maryam Peterside - Enugu - Aggregation Center', 'approved', 2764829.86, 'Cross River', 'REF-69B6287090', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-03-28 15:05:21', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-ebfa09ae84b5', 'Fatima Balogun', 'operations', 'Fatima Balogun - Wuse - Aggregation Center', 'completed', 1292763.91, 'Imo', 'REF-530A46CD93', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-03-04 07:25:59', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-db0014d4f7b6', 'Jide Jimoh', 'payments', 'Jide Jimoh - Ikeja - Aggregation Center', 'pending', 2719658.53, 'Kwara', 'REF-907B8A93A6', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-03-18 02:59:30', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-31b18a1dae1a', 'Sade Elumelu', 'finance', 'Sade Elumelu - Abeokuta - Aggregation Center', 'pending', 5010216.64, 'Abuja FCT', 'REF-F90BC14E60', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-09-29 08:36:07', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7cce695cfb97', 'Jide Kalu', 'operations', 'Jide Kalu - Maitama - Aggregation Center', 'completed', 7645613.74, 'Abuja FCT', 'REF-9EAB8FC33B', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-01-18 06:35:17', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-0c6f034a1be8', 'Ifeoma Hassan', 'finance', 'Ifeoma Hassan - Kano - Aggregation Center', 'approved', 7047087.53, 'Cross River', 'REF-8E2E521D5E', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-03-01 16:55:58', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-889ad3781c0c', 'Kemi Chukwu', 'operations', 'Kemi Chukwu - Kano - Aggregation Center', 'approved', 7477246.22, 'Borno', 'REF-7DE5A16B6C', '{"source": "seed", "table": "aggregation_center"}'::jsonb, '2025-01-12 07:02:30', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_esg_impact ───
INSERT INTO "agri_esg_impact" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-8f286d7f6ad4', 'Adewale Danladi', 'payments', 'Adewale Danladi - Kano - Agri Esg Impact', 'completed', 5988194.89, 'Borno', 'REF-69FF1A8DE8', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-02-10 18:53:01', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-95a3aaaf7452', 'Adaeze Jimoh', 'compliance', 'Adaeze Jimoh - Awka - Agri Esg Impact', 'pending', 4232909.68, 'Kwara', 'REF-14F5011F3E', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-11-09 00:30:16', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-66f9eeb369f8', 'Segun Garba', 'payments', 'Segun Garba - Warri - Agri Esg Impact', 'completed', 7734984.93, 'Delta', 'REF-E75B0AE3EF', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-05-27 12:39:11', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-de21ad3cd55f', 'Tunde Eze', 'operations', 'Tunde Eze - Awka - Agri Esg Impact', 'pending', 4939139.38, 'Rivers', 'REF-272FE9B845', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2026-01-01 19:52:42', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7fa64b670278', 'Bukola Adeyemi', 'risk', 'Bukola Adeyemi - Lekki - Agri Esg Impact', 'active', 2204844.4, 'Akwa Ibom', 'REF-26DA4545B6', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-12-09 17:59:21', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-772708701a95', 'Patience Igwe', 'operations', 'Patience Igwe - Ibadan - Agri Esg Impact', 'pending', 7820474.99, 'Edo', 'REF-AFE1890B61', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-12-31 11:54:30', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a9ee4635ec18', 'Hassan Adenuga', 'compliance', 'Hassan Adenuga - Port Harcourt - Agri Esg Impact', 'processing', 8031920.75, 'Oyo', 'REF-9743723EF6', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-08-27 23:42:18', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-cb2bae21b2f4', 'Olumide Garba', 'compliance', 'Olumide Garba - Lekki - Agri Esg Impact', 'active', 6141188.4, 'Rivers', 'REF-809729200E', '{"source": "seed", "table": "agri_esg_impact"}'::jsonb, '2025-08-08 09:41:38', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_evoucher ───
INSERT INTO "agri_evoucher" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-e0a61d75274b', 'Titilayo Lawal', 'risk', 'Titilayo Lawal - Abeokuta - Agri Evoucher', 'approved', 5154125.68, 'Oyo', 'REF-4FA99A6692', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2026-04-11 05:17:17', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-fe98fb04ea85', 'Chidinma Okafor', 'risk', 'Chidinma Okafor - Port Harcourt - Agri Evoucher', 'pending', 9376630.12, 'Imo', 'REF-F43D941A0A', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2026-01-25 00:39:20', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-30483a08006e', 'Titilayo Igwe', 'payments', 'Titilayo Igwe - Wuse - Agri Evoucher', 'completed', 7026898.76, 'Osun', 'REF-AA3413FCB8', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2025-10-01 07:48:48', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-e88b0b9d8078', 'Olumide Adeyemi', 'risk', 'Olumide Adeyemi - Asaba - Agri Evoucher', 'approved', 3658133.12, 'Ogun', 'REF-154D8F92B8', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2026-03-23 04:24:24', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-2a3a7ecd2ed0', 'Babajide Okafor', 'finance', 'Babajide Okafor - Ibadan - Agri Evoucher', 'completed', 9271980.55, 'Edo', 'REF-3AB628C4A2', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2025-10-02 03:33:19', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-0ea7ae0c785e', 'Ifeoma Hassan', 'payments', 'Ifeoma Hassan - Warri - Agri Evoucher', 'processing', 7178121.93, 'Osun', 'REF-A83F78116A', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2026-04-27 15:29:12', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-66e1df06232a', 'Hauwa Sanusi', 'operations', 'Hauwa Sanusi - Lekki - Agri Evoucher', 'active', 1005815.31, 'Kaduna', 'REF-B7C3C9A921', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2025-05-23 05:48:56', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-5dbdf449ac8e', 'Oluchi Mohammed', 'risk', 'Oluchi Mohammed - Awka - Agri Evoucher', 'active', 1432348.73, 'Kaduna', 'REF-E8BA4610F1', '{"source": "seed", "table": "agri_evoucher"}'::jsonb, '2025-03-16 03:46:29', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_input_marketplace ───
INSERT INTO "agri_input_marketplace" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-8de6e2badf35', 'Chukwuemeka Chukwu', 'compliance', 'Chukwuemeka Chukwu - Asaba - Agri Input Marketplace', 'approved', 3358974.6, 'Borno', 'REF-EBF46C0BE4', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-06-25 12:59:50', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-5a75b27e1cac', 'Sade Okafor', 'technology', 'Sade Okafor - Kano - Agri Input Marketplace', 'pending', 5798027.77, 'Cross River', 'REF-084F8F2AC1', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-10-09 19:27:26', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-cee83d5d98c1', 'Patience Usman', 'finance', 'Patience Usman - Lekki - Agri Input Marketplace', 'completed', 5914146.45, 'Imo', 'REF-1698EB2C5B', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-10-03 15:59:02', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-5fe5db159a37', 'Femi Elumelu', 'technology', 'Femi Elumelu - Wuse - Agri Input Marketplace', 'completed', 245718.83, 'Kaduna', 'REF-1462F5681C', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-03-11 23:51:45', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-886c6db314b4', 'Ifeoma Fashola', 'technology', 'Ifeoma Fashola - Port Harcourt - Agri Input Marketplace', 'pending', 5667586.76, 'Delta', 'REF-6381FB6C1A', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2026-03-20 10:09:06', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-56c93ab746a3', 'Patience Adenuga', 'technology', 'Patience Adenuga - Maitama - Agri Input Marketplace', 'active', 2791765.11, 'Delta', 'REF-8B843FECFA', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-02-08 07:36:18', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f23038b6dff6', 'Esther Mohammed', 'technology', 'Esther Mohammed - Ikeja - Agri Input Marketplace', 'active', 7773997.2, 'Lagos', 'REF-C50099C4D2', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-12-19 14:17:33', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-54ae92e01706', 'Jumoke Adenuga', 'payments', 'Jumoke Adenuga - Ibadan - Agri Input Marketplace', 'approved', 331309.99, 'Abuja FCT', 'REF-FDB4FC9CFD', '{"source": "seed", "table": "agri_input_marketplace"}'::jsonb, '2025-02-24 15:11:08', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_iot_sensor ───
INSERT INTO "agri_iot_sensor" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-6ee18922f3da', 'Kunle Elumelu', 'payments', 'Kunle Elumelu - Ibadan - Agri Iot Sensor', 'pending', 275078.11, 'Kaduna', 'REF-19BF2ED000', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-06-04 22:02:12', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-25a305eff0ff', 'Emeka Lawal', 'operations', 'Emeka Lawal - Ibadan - Agri Iot Sensor', 'processing', 3336739.76, 'Abuja FCT', 'REF-BE35F61F70', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-12-14 17:29:12', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9ca772e44e2f', 'Hassan Danladi', 'compliance', 'Hassan Danladi - Victoria Island - Agri Iot Sensor', 'approved', 9919103.72, 'Abuja FCT', 'REF-A76D58FDCE', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-08-16 09:06:24', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-b503918693a5', 'Lanre Garba', 'compliance', 'Lanre Garba - Wuse - Agri Iot Sensor', 'pending', 7274922.68, 'Kwara', 'REF-6FE979F44E', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-01-02 20:15:52', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-eceaf6ea7121', 'Ibrahim Garba', 'lending', 'Ibrahim Garba - Ikeja - Agri Iot Sensor', 'approved', 4481261.99, 'Enugu', 'REF-C36F6997EE', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-06-09 02:59:57', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9e0d0b0c1d51', 'Nneka Chukwu', 'lending', 'Nneka Chukwu - Kano - Agri Iot Sensor', 'pending', 743656.21, 'Anambra', 'REF-A2FCCFC5D6', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-12-22 23:47:11', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a22487f3aaf0', 'Hassan Kalu', 'payments', 'Hassan Kalu - Benin City - Agri Iot Sensor', 'approved', 5426125.07, 'Delta', 'REF-98FA85BE61', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-03-20 12:33:01', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-47f7e9a06765', 'Oluchi Balogun', 'risk', 'Oluchi Balogun - Port Harcourt - Agri Iot Sensor', 'pending', 2180780.55, 'Enugu', 'REF-F376E57372', '{"source": "seed", "table": "agri_iot_sensor"}'::jsonb, '2025-09-03 11:56:19', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_logistics ───
INSERT INTO "agri_logistics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-396ea70984cf', 'Oluchi Taiwo', 'compliance', 'Oluchi Taiwo - Zaria - Agri Logistics', 'processing', 8912246.1, 'Kano', 'REF-E7A897B8A9', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-05-25 21:50:24', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-309f1431dd97', 'Jide Usman', 'finance', 'Jide Usman - Kano - Agri Logistics', 'approved', 681330.64, 'Kaduna', 'REF-6245B55F60', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2026-05-07 21:43:00', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-888c696b7d0d', 'Fatima Otedola', 'risk', 'Fatima Otedola - Maitama - Agri Logistics', 'completed', 3187108.03, 'Imo', 'REF-D9429F55DC', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-04-26 08:25:54', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-83520ac3767e', 'Pelumi Okafor', 'finance', 'Pelumi Okafor - Ikeja - Agri Logistics', 'completed', 4058866.38, 'Edo', 'REF-1F1B115DC2', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-05-29 02:47:21', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-024a887b103a', 'Rahma Eze', 'finance', 'Rahma Eze - Wuse - Agri Logistics', 'active', 7655196.37, 'Cross River', 'REF-DD25129696', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-06-22 20:09:25', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-d78f677c6827', 'Chukwuemeka Mohammed', 'compliance', 'Chukwuemeka Mohammed - Enugu - Agri Logistics', 'approved', 9967083.4, 'Kwara', 'REF-C9123234D0', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-05-16 07:13:38', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-cf241db055d7', 'Musa Danladi', 'lending', 'Musa Danladi - Victoria Island - Agri Logistics', 'completed', 4688257.77, 'Imo', 'REF-9C5E6662F6', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-06-02 16:05:50', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-1eb8d6d2ba83', 'Esther Nwosu', 'technology', 'Esther Nwosu - Asaba - Agri Logistics', 'pending', 9812762.7, 'Ogun', 'REF-285644F80F', '{"source": "seed", "table": "agri_logistics"}'::jsonb, '2025-03-04 11:07:37', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_reinsurance ───
INSERT INTO "agri_reinsurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-c3eacbfc3768', 'Emeka Nwosu', 'lending', 'Emeka Nwosu - Port Harcourt - Agri Reinsurance', 'active', 8502433.44, 'Lagos', 'REF-31DC0D09EF', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-10-26 23:45:30', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c9843569fe41', 'Titilayo Elumelu', 'finance', 'Titilayo Elumelu - Enugu - Agri Reinsurance', 'approved', 1884704.19, 'Kaduna', 'REF-B04C3C4A81', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-06-15 02:41:50', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-68d9dd0c43cc', 'Gbenga Elumelu', 'lending', 'Gbenga Elumelu - Warri - Agri Reinsurance', 'approved', 5213249.33, 'Borno', 'REF-3DAAC5AD5F', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-02-06 05:36:35', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-87e1f867d6d3', 'Rahma Danladi', 'technology', 'Rahma Danladi - Garki - Agri Reinsurance', 'processing', 587422.93, 'Oyo', 'REF-3E19DC300E', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-02-02 14:24:58', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-f3ab6c87b747', 'Segun Dangote', 'finance', 'Segun Dangote - Kano - Agri Reinsurance', 'completed', 7089943.16, 'Lagos', 'REF-6BA95C3679', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-07-06 05:08:14', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f09b22f4c9b7', 'Adaeze Eze', 'lending', 'Adaeze Eze - Maitama - Agri Reinsurance', 'completed', 2255384.77, 'Kaduna', 'REF-FF5D6FEC9E', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-04-13 11:21:57', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-fcb18b2e9703', 'Tunde Lawal', 'risk', 'Tunde Lawal - Ikeja - Agri Reinsurance', 'processing', 2174931.25, 'Osun', 'REF-B8C8FEFAD0', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2026-04-23 20:48:52', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-771899956aa4', 'Tunde Chukwu', 'payments', 'Tunde Chukwu - Kano - Agri Reinsurance', 'approved', 5119531.8, 'Kano', 'REF-5305F41DDE', '{"source": "seed", "table": "agri_reinsurance"}'::jsonb, '2025-08-04 00:09:56', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── agri_savings_cycles ───
INSERT INTO "agri_savings_cycles" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-1cbca86aeaa6', 'Chukwuemeka Peterside', 'finance', 'Chukwuemeka Peterside - Ibadan - Agri Savings Cycles', 'pending', 3454372.29, 'Plateau', 'REF-DEFA82241D', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-11-06 20:44:39', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-4cde183f1ca6', 'Jumoke Balogun', 'finance', 'Jumoke Balogun - Warri - Agri Savings Cycles', 'processing', 1962422.0, 'Kaduna', 'REF-FF0B04D948', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-07-28 00:12:42', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f672e24f5384', 'Emeka Balogun', 'payments', 'Emeka Balogun - Kano - Agri Savings Cycles', 'completed', 471356.8, 'Lagos', 'REF-96C28CF90A', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2026-02-23 11:32:20', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-c64013b59fbd', 'Patience Lawal', 'lending', 'Patience Lawal - Zaria - Agri Savings Cycles', 'completed', 1718237.72, 'Delta', 'REF-4E6DF02EE3', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-12-06 07:52:31', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f62996b4eb1c', 'Hauwa Yakubu', 'technology', 'Hauwa Yakubu - Awka - Agri Savings Cycles', 'approved', 290668.17, 'Osun', 'REF-756D76F9D3', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-02-27 06:05:14', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-e3e2dfd807a7', 'Chukwuemeka Dangote', 'compliance', 'Chukwuemeka Dangote - Warri - Agri Savings Cycles', 'active', 5751208.29, 'Lagos', 'REF-405C3862DC', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-06-04 17:27:37', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-ec7dc1afcf54', 'Nneka Sanusi', 'payments', 'Nneka Sanusi - Warri - Agri Savings Cycles', 'approved', 6678335.25, 'Cross River', 'REF-C4283B3CC8', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2026-01-21 17:31:35', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-5ccbd7dd3f78', 'Adewale Taiwo', 'lending', 'Adewale Taiwo - Ibadan - Agri Savings Cycles', 'processing', 6209391.72, 'Imo', 'REF-689EAE6D96', '{"source": "seed", "table": "agri_savings_cycles"}'::jsonb, '2025-10-14 20:25:53', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── aml_cases ───
INSERT INTO "aml_cases" ("customerId", "customerName", "caseType", "riskLevel", "assignedTo", "sarFiled", "status", "createdAt") VALUES
  ('CUST-b0aa3d7dd53d', 'Tunde Otedola', 'full', 'critical', 'AML_CA-337a2880f320', false, 'active', '2025-01-19 20:17:44'),
  ('CUST-78c96c22600e', 'Sade Yakubu', 'basic', 'critical', 'AML_CA-7218f466ff0e', false, 'pending', '2025-04-28 08:12:06'),
  ('CUST-fd3d23f9121e', 'Chidinma Lawal', 'standard', 'critical', 'AML_CA-de0282ca1c90', true, 'processing', '2026-02-10 17:18:23'),
  ('CUST-a8883174f66b', 'Lilian Fashola', 'basic', 'high', 'AML_CA-959ccd921bdd', false, 'completed', '2026-02-08 12:12:52'),
  ('CUST-185e2760e586', 'Hassan Fashola', 'standard', 'critical', 'AML_CA-86f9f3c6477d', true, 'processing', '2025-08-14 03:56:41'),
  ('CUST-4adaff63d58a', 'Sade Garba', 'basic', 'critical', 'AML_CA-ed65b5136306', false, 'pending', '2025-12-16 06:29:11'),
  ('CUST-8ae83cbb410f', 'Nneka Taiwo', 'basic', 'low', 'AML_CA-b9f84db8b2fa', true, 'processing', '2025-10-30 06:45:14'),
  ('CUST-62653306bf28', 'Tunde Usman', 'full', 'low', 'AML_CA-0370ea488091', true, 'completed', '2026-02-12 04:02:14')
ON CONFLICT DO NOTHING;


-- ─── aml_compliance_metrics ───
INSERT INTO "aml_compliance_metrics" ("period", "totalScreenings", "sarsFiled", "ctrsFiled", "complianceScore", "status", "createdAt") VALUES
  ('2025-06', 7708, 574, 220, 16, 'processing', '2025-07-31 18:25:18'),
  ('2025-01', 1814, 15, 928, 69, 'active', '2025-12-15 21:03:44'),
  ('2025-09', 1054, 36, 411, 4, 'processing', '2025-07-25 03:08:41'),
  ('2025-01', 5940, 531, 644, 24, 'completed', '2026-01-18 07:26:19'),
  ('2025-11', 8288, 896, 95, 96, 'active', '2025-07-26 07:10:53'),
  ('2025-01', 7103, 953, 11, 94, 'pending', '2025-06-25 00:27:11'),
  ('2025-11', 6666, 315, 720, 69, 'pending', '2026-04-01 16:08:55'),
  ('2025-07', 7844, 651, 494, 17, 'approved', '2025-09-03 01:09:02')
ON CONFLICT DO NOTHING;


-- ─── aml_risk_scores ───
INSERT INTO "aml_risk_scores" ("customerId", "customerName", "riskScore", "riskLevel", "sanctionsHits", "pepMatch", "adverseMedia", "cddLevel", "status", "createdAt") VALUES
  ('CUST-07e541b488cb', 'Jide Adeyemi', 44, 'high', 988, true, 320, 'AML_RI-f98e19b3bede', 'pending', '2025-05-04 19:54:25'),
  ('CUST-00356cdd6074', 'Uzo Adeyemi', 49, 'high', 529, true, 414, 'AML_RI-c0d1bc5b62a9', 'pending', '2025-05-12 00:33:06'),
  ('CUST-7e34682201da', 'Gbenga Hassan', 94, 'medium', 423, false, 759, 'AML_RI-c8a612ae6069', 'pending', '2026-04-22 07:53:27'),
  ('CUST-12d29f1661ba', 'Emeka Usman', 6, 'low', 423, true, 340, 'AML_RI-d7fc478b802a', 'active', '2025-01-01 20:43:27'),
  ('CUST-4d4d8159bc9b', 'Damilola Hassan', 27, 'medium', 223, false, 779, 'AML_RI-e3ec2d32a2d8', 'completed', '2025-10-08 19:05:13'),
  ('CUST-c81f93942025', 'Musa Otedola', 57, 'medium', 67, false, 4, 'AML_RI-d3825779cfcc', 'approved', '2026-03-28 23:45:20'),
  ('CUST-48420093a745', 'Lilian Igwe', 42, 'low', 660, true, 705, 'AML_RI-b95771c66ba3', 'approved', '2026-01-18 20:18:37'),
  ('CUST-f5b9fc2b9b6a', 'Rasheed Chukwu', 30, 'high', 880, true, 182, 'AML_RI-d0eb8c5faa9d', 'pending', '2025-08-13 14:21:49')
ON CONFLICT DO NOTHING;


-- ─── aml_training_records ───
INSERT INTO "aml_training_records" ("staffId", "staffName", "role", "trainingModule", "score", "status", "createdAt") VALUES
  ('STAF-1f82c3e231e1', 'Rahma Dangote', 'compliance', '22695989499', 68, 'approved', '2025-02-09 07:22:46'),
  ('STAF-bc0a460c6864', 'Emeka Igwe', 'compliance', '22962955643', 69, 'pending', '2026-03-29 20:01:00'),
  ('STAF-503d2744bb26', 'Esther Elumelu', 'treasury', '22546423731', 50, 'processing', '2025-08-16 02:44:01'),
  ('STAF-e950fa028e28', 'Grace Hassan', 'admin', '22622674159', 52, 'approved', '2025-11-06 19:07:26'),
  ('STAF-49c2eb4e67de', 'Lanre Fashola', 'credit', '22162594265', 60, 'approved', '2026-02-07 23:08:57'),
  ('STAF-9a902feb7fbf', 'Gbenga Nwosu', 'admin', '22092875646', 46, 'approved', '2026-02-28 01:49:45'),
  ('STAF-a01b754c12cb', 'Dorcas Otedola', 'operator', '22055641480', 80, 'active', '2025-03-14 10:18:06'),
  ('STAF-d4d0be2fe24a', 'Adaeze Igwe', 'credit', '22767322335', 73, 'active', '2025-04-29 20:37:36')
ON CONFLICT DO NOTHING;


-- ─── animal_id_traceability ───
INSERT INTO "animal_id_traceability" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-ceb612032f66', 'Patience Garba', 'lending', 'Patience Garba - Lekki - Animal Id Traceability', 'processing', 4545187.34, 'Rivers', 'REF-1A6B613819', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2026-04-20 12:54:56', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-35c634167404', 'Fatima Elumelu', 'compliance', 'Fatima Elumelu - Asaba - Animal Id Traceability', 'processing', 9482648.32, 'Anambra', 'REF-6B6735FCD1', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2026-04-22 11:25:28', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-f791937df5fe', 'Gbenga Lawal', 'risk', 'Gbenga Lawal - Wuse - Animal Id Traceability', 'processing', 3291863.32, 'Imo', 'REF-C3F0C3AB80', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-02-12 09:23:06', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-06251937e0e5', 'Pelumi Garba', 'risk', 'Pelumi Garba - Garki - Animal Id Traceability', 'processing', 8226920.3, 'Rivers', 'REF-E2FB60A5AB', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-05-03 04:39:24', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-de8bd3bc84e5', 'Jide Garba', 'lending', 'Jide Garba - Victoria Island - Animal Id Traceability', 'completed', 9790187.85, 'Kwara', 'REF-D132C4CE66', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-02-25 08:07:45', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-22e2cfd745d3', 'Segun Mohammed', 'payments', 'Segun Mohammed - Awka - Animal Id Traceability', 'processing', 1604015.87, 'Cross River', 'REF-628F082616', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-12-17 08:36:58', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-50603aabee8a', 'Damilola Garba', 'operations', 'Damilola Garba - Awka - Animal Id Traceability', 'completed', 9978729.66, 'Imo', 'REF-1FAC852BCD', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-02-18 08:10:40', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-68f105b5fc2e', 'Patience Okafor', 'payments', 'Patience Okafor - Awka - Animal Id Traceability', 'completed', 6711438.25, 'Borno', 'REF-DAB6923506', '{"source": "seed", "table": "animal_id_traceability"}'::jsonb, '2025-12-04 06:52:02', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── anomaly_models ───
INSERT INTO "anomaly_models" ("name", "modelType", "features", "anomalies24h", "truePositives", "status", "createdAt") VALUES
  ('Babajide Okafor', 'basic', '{"data": "seed"}'::jsonb, 771, 116, 'completed', '2025-05-02 17:38:03'),
  ('Ifeoma Garba', 'enhanced', '{"data": "seed"}'::jsonb, 550, 731, 'processing', '2025-02-02 13:00:48'),
  ('Dorcas Mohammed', 'full', '{"data": "seed"}'::jsonb, 560, 704, 'pending', '2025-02-15 13:24:17'),
  ('Kemi Hassan', 'premium', '{"data": "seed"}'::jsonb, 410, 716, 'processing', '2025-08-27 17:37:18'),
  ('Rasheed Sanusi', 'standard', '{"data": "seed"}'::jsonb, 650, 859, 'processing', '2025-10-16 21:09:16'),
  ('Uzo Otedola', 'enhanced', '{"data": "seed"}'::jsonb, 574, 794, 'processing', '2026-01-29 13:03:24'),
  ('Gbenga Kalu', 'full', '{"data": "seed"}'::jsonb, 484, 996, 'completed', '2025-05-23 10:15:45'),
  ('Femi Chukwu', 'basic', '{"data": "seed"}'::jsonb, 58, 505, 'approved', '2026-01-30 02:57:03')
ON CONFLICT DO NOTHING;


-- ─── anti_spoofing_results ───
INSERT INTO "anti_spoofing_results" ("resultId", "tenantId", "customerId", "livenessCheckId", "isSpoof", "spoofType", "moireDetected", "reflectionAnomaly", "modelVersion", "createdAt") VALUES
  ('RESU-8a356dbee8b9', 'tenant-kano-north', 'CUST-4dd3aa563f06', 'LIVE-b62649619993', true, 'full', true, true, 'ANTI_S-1deafb381c61', '2025-12-08 22:39:26'),
  ('RESU-1b9bc5322678', 'tenant-portharcourt', 'CUST-5910175481a2', 'LIVE-83aa5c7eb8e4', true, 'enhanced', true, true, 'ANTI_S-274a8a5cd172', '2026-05-01 04:33:23'),
  ('RESU-24fa7deeb679', 'tenant-whitelabel-zenith', 'CUST-bafea9775696', 'LIVE-a36e110996a8', true, 'enhanced', true, false, 'ANTI_S-8da241bd7251', '2026-03-28 16:29:25'),
  ('RESU-ef193b942e52', 'tenant-whitelabel-zenith', 'CUST-9041a67e9544', 'LIVE-40bf457025af', true, 'premium', true, true, 'ANTI_S-7119c3953faa', '2025-10-27 15:57:01'),
  ('RESU-2fe79d61fe20', 'tenant-abuja-digital', 'CUST-9d55efdee016', 'LIVE-f3e49ef5ad6f', true, 'premium', true, true, 'ANTI_S-7fcb5f74c8bf', '2026-04-08 11:07:17'),
  ('RESU-20fd05766f58', 'tenant-abuja-digital', 'CUST-a49fcf1c4960', 'LIVE-e051ef293aed', true, 'basic', true, true, 'ANTI_S-55340e5b0caa', '2025-12-29 18:26:47'),
  ('RESU-13ebe8f3db63', 'tenant-abuja-digital', 'CUST-6e05df4072cc', 'LIVE-b3718ccaa070', true, 'full', true, false, 'ANTI_S-f69edf07e07d', '2025-09-14 04:44:26'),
  ('RESU-fb068ddd0a56', 'tenant-lagos-main', 'CUST-77251e21adfd', 'LIVE-0684cd827d8c', true, 'full', true, true, 'ANTI_S-971effd0d817', '2025-04-18 18:46:09')
ON CONFLICT DO NOTHING;


-- ─── api_key_policies ───
INSERT INTO "api_key_policies" ("name", "prefix", "requiredScopes", "ipWhitelist", "rateLimit", "rotationWarningDays", "activeKeys", "violations24h", "status", "createdAt") VALUES
  ('Babajide Adenuga', 'REF-97762B9D46C3', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 738309, 121, 758, 637, 'completed', '2025-03-31 06:18:37'),
  ('Musa Dangote', 'REF-0B022219DED4', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 273146, 305, 635, 583, 'approved', '2025-01-04 06:05:46'),
  ('Jide Usman', 'REF-35CD36CFF91B', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 560402, 356, 940, 787, 'processing', '2025-09-24 02:06:09'),
  ('Kunle Okafor', 'REF-D3B0D8AEEC3B', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 483458, 136, 267, 678, 'pending', '2025-02-26 04:47:44'),
  ('Kemi Jimoh', 'REF-CDBF1AE1095A', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 631565, 149, 282, 947, 'approved', '2025-12-16 00:10:41'),
  ('Lanre Yakubu', 'REF-72F8EDBA1803', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 542052, 41, 967, 234, 'pending', '2025-04-07 06:14:50'),
  ('Rasheed Danladi', 'REF-D40EEBAE65C2', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 33157, 157, 778, 950, 'processing', '2025-03-07 11:08:06'),
  ('Grace Otedola', 'REF-5270AD3985DA', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 519342, 186, 397, 597, 'processing', '2026-04-20 03:13:27')
ON CONFLICT DO NOTHING;


-- ─── api_keys ───
INSERT INTO "api_keys" ("apiKeyId", "name", "keyPrefix", "tenantId", "scopes", "rateLimit", "status", "ipWhitelist", "lastUsedAt", "expiresAt", "createdBy", "createdAt") VALUES
  ('APIK-ae8367b1ec9e', 'Uzo Otedola', 'REF-1488B170C140', 'tenant-lagos-main', 'API_KE-614b8d02cb6e', 652910, 'pending', '10.0.175.33', '2025-09-08 00:34:05', '2025-01-14 00:12:17', 'API_KE-962c516da20b', '2025-09-28 18:59:06'),
  ('APIK-52a2e1ff32d2', 'Ifeoma Sanusi', 'REF-64C70FEED95C', 'tenant-whitelabel-zenith', 'API_KE-8bcdc6d3ccad', 963342, 'approved', '10.0.126.180', '2025-03-28 14:09:31', '2025-04-24 14:53:23', 'API_KE-aea949eceb26', '2025-05-26 21:11:01'),
  ('APIK-4a7e2b27b128', 'Jide Garba', 'REF-F1FCA232269B', 'tenant-kano-north', 'API_KE-81e87eee7a0f', 62072, 'active', '10.0.85.246', '2025-10-03 15:26:37', '2026-04-23 00:07:18', 'API_KE-8968251eb1ee', '2026-03-01 05:25:56'),
  ('APIK-ae8d52f207d3', 'Maryam Otedola', 'REF-CD7889883B2F', 'tenant-portharcourt', 'API_KE-34eed2c5804d', 536430, 'active', '10.0.153.133', '2025-12-18 21:06:43', '2025-06-18 19:28:40', 'API_KE-150e0f5e23d4', '2025-09-21 14:48:27'),
  ('APIK-bf6cddccc115', 'Rasheed Fashola', 'REF-2C5595CD4EDD', 'tenant-kano-north', 'API_KE-fd77621b2684', 356288, 'active', '10.0.128.105', '2025-10-30 08:41:28', '2026-03-23 20:13:23', 'API_KE-ce5c20b1c55d', '2025-03-19 22:27:49'),
  ('APIK-4c272fa6b663', 'Musa Mohammed', 'REF-6AD233B7E0C9', 'tenant-portharcourt', 'API_KE-43d39d14ac26', 126462, 'active', '10.0.213.163', '2025-11-06 06:46:32', '2025-02-04 09:56:02', 'API_KE-989b50da7a2b', '2025-05-05 17:54:07'),
  ('APIK-dde04ab64c7b', 'Uzo Lawal', 'REF-A64CEE9E9CA0', 'tenant-whitelabel-zenith', 'API_KE-842ff6ce3dc9', 663408, 'processing', '10.0.51.37', '2026-03-12 14:49:35', '2025-07-17 01:21:43', 'API_KE-ae30e5bef8f7', '2025-11-20 22:42:25'),
  ('APIK-0b98daa2e380', 'Nnamdi Elumelu', 'REF-B40A3F5DC64F', 'tenant-whitelabel-zenith', 'API_KE-b7e016e91801', 221334, 'pending', '10.0.91.196', '2025-03-29 09:32:02', '2026-02-08 07:24:40', 'API_KE-cdf0c30ce486', '2025-11-05 13:23:04')
ON CONFLICT DO NOTHING;


-- ─── apisix_plugin_chains ───
INSERT INTO "apisix_plugin_chains" ("route", "latencySaving", "status", "createdAt") VALUES
  ('APISIX-7af87232f4be', 'APISIX-308158763a05', 'approved', '2025-10-21 07:44:37'),
  ('APISIX-a839ef3dbae0', 'APISIX-b87964093236', 'approved', '2025-02-14 09:28:15'),
  ('APISIX-288489607b21', 'APISIX-df6a5e03e1a2', 'pending', '2025-08-12 03:13:57'),
  ('APISIX-b2877b7f6a2f', 'APISIX-1b441b803ffe', 'approved', '2025-06-19 14:11:06'),
  ('APISIX-897a7dfee821', 'APISIX-ad3aaf5dc1c8', 'processing', '2025-07-06 11:08:00'),
  ('APISIX-126060fe1527', 'APISIX-5a4015b762ef', 'processing', '2025-09-25 12:33:10'),
  ('APISIX-f88b2cb0a578', 'APISIX-80b1e30f71ce', 'pending', '2025-09-06 02:08:48'),
  ('APISIX-ed9ca0b5f051', 'APISIX-a81fdca09c17', 'pending', '2025-08-18 17:00:15')
ON CONFLICT DO NOTHING;


-- ─── area_yield_index_insurance ───
INSERT INTO "area_yield_index_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-cc48f3d9555d', 'Nneka Peterside', 'finance', 'Nneka Peterside - Awka - Area Yield Index Insurance', 'processing', 8257594.97, 'Osun', 'REF-A7A870304E', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2026-03-30 10:46:32', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-62e7ee5678fb', 'Uzo Hassan', 'lending', 'Uzo Hassan - Zaria - Area Yield Index Insurance', 'active', 5017178.35, 'Imo', 'REF-1C0C32EE5D', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2025-04-03 00:03:24', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-92bd7abd09ed', 'Sade Balogun', 'compliance', 'Sade Balogun - Abeokuta - Area Yield Index Insurance', 'processing', 1032980.6, 'Lagos', 'REF-D44D51BC1D', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2026-01-11 20:31:12', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f3092d7c5f6e', 'Femi Igwe', 'payments', 'Femi Igwe - Abeokuta - Area Yield Index Insurance', 'completed', 7928025.84, 'Cross River', 'REF-CA7E51557F', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2025-04-28 12:18:59', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f92ef289945d', 'Uche Otedola', 'finance', 'Uche Otedola - Benin City - Area Yield Index Insurance', 'approved', 3381333.3, 'Imo', 'REF-8605291897', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2025-03-16 04:13:59', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f0e9d2bb7cb2', 'Hauwa Hassan', 'technology', 'Hauwa Hassan - Asaba - Area Yield Index Insurance', 'pending', 9596038.96, 'Rivers', 'REF-0A3CDFA572', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2026-03-02 14:26:30', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-3d00b4be901c', 'Adewale Balogun', 'lending', 'Adewale Balogun - Port Harcourt - Area Yield Index Insurance', 'approved', 8573143.63, 'Lagos', 'REF-F5F0711BE4', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2026-04-20 03:29:05', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-6c99368cdba0', 'Dorcas Lawal', 'operations', 'Dorcas Lawal - Ibadan - Area Yield Index Insurance', 'approved', 9727750.5, 'Enugu', 'REF-F84E759894', '{"source": "seed", "table": "area_yield_index_insurance"}'::jsonb, '2025-10-09 23:49:40', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── avro_schemas ───
INSERT INTO "avro_schemas" ("subject", "version", "compatibilityMode", "serializedSizeBytes", "compressionRatio", "status", "createdAt") VALUES
  ('AVRO_S-d4d46c24dfcb', 4, 'AVRO_S-3dd68d9dc975', 556, 'AVRO_S-fd0fcdbdbf01', 'completed', '2025-04-07 21:33:41'),
  ('AVRO_S-fc17d93f2942', 10, 'AVRO_S-65664754f970', 908, 'AVRO_S-58785b437e8f', 'completed', '2025-07-12 00:05:53'),
  ('AVRO_S-59b4c85df578', 3, 'AVRO_S-5860f3f059de', 834, 'AVRO_S-c5c16b484eb3', 'completed', '2025-01-07 18:53:00'),
  ('AVRO_S-6408699fb734', 1, 'AVRO_S-9fd0379d8cc9', 129, 'AVRO_S-3d22ec27ffec', 'pending', '2025-02-18 22:29:11'),
  ('AVRO_S-1b8970db1474', 9, 'AVRO_S-10b191089bfb', 718, 'AVRO_S-d656fd911ab2', 'processing', '2025-06-14 14:33:02'),
  ('AVRO_S-349f878f60fc', 2, 'AVRO_S-7ecb986dc287', 956, 'AVRO_S-e330f847d93d', 'active', '2026-05-03 22:55:04'),
  ('AVRO_S-52a3a276b5c5', 4, 'AVRO_S-f2c2313e731a', 812, 'AVRO_S-4eaa4023a5f7', 'completed', '2025-12-28 21:53:40'),
  ('AVRO_S-ceca7ffe2f12', 1, 'AVRO_S-6733f9558905', 850, 'AVRO_S-ce5642aae2cc', 'pending', '2025-12-30 05:32:49')
ON CONFLICT DO NOTHING;


-- ─── bankGuarantees ───
INSERT INTO "bankGuarantees" ("guaranteeId", "tenantId", "guaranteeType", "applicantId", "applicantName", "beneficiaryName", "amount", "currency", "purpose", "effectiveDate", "expiryDate", "claimDeadline", "commissionRate", "commissionAmount", "status", "createdAt", "updatedAt") VALUES
  ('GUAR-3873b8b19198', 'tenant-portharcourt', 'basic', 'APPL-c55135d2b450', 'Rasheed Adeyemi', 'Oluchi Balogun', 45007715.54, 'EUR', 'BANKGU-cf18fcfb1624', 'BANKGU-1a5d89b5c6f5', 'BANKGU-eca634802190', 'BANKGU-b1a1a6f0d808', 99.7568, 999813.15, 'pending', '2025-04-22 04:34:11', '2025-03-23 12:26:08'),
  ('GUAR-f2464e49f914', 'tenant-whitelabel-zenith', 'premium', 'APPL-ec9c81dc5afa', 'Ibrahim Dangote', 'Titilayo Okafor', 2726317.51, 'NGN', 'BANKGU-bcf47627980c', 'BANKGU-bb2b5cfde191', 'BANKGU-1087f8a1ccb6', 'BANKGU-898bcd38e587', 10.3478, 1142982.39, 'active', '2026-03-14 17:10:43', '2025-08-08 10:09:59'),
  ('GUAR-50fba45806ce', 'tenant-abuja-digital', 'premium', 'APPL-1f3fcf88b50f', 'Hauwa Sanusi', 'Ifeoma Dangote', 19127753.74, 'USD', 'BANKGU-c3295cc9e21c', 'BANKGU-0b65878fecde', 'BANKGU-bed18d106aa8', 'BANKGU-cd021793d6b0', 60.0135, 6609237.88, 'approved', '2025-07-19 02:16:31', '2025-11-26 14:20:01'),
  ('GUAR-a0a8a832fa93', 'tenant-whitelabel-zenith', 'premium', 'APPL-b85c709887d0', 'Ibrahim Igwe', 'Chidinma Mohammed', 36119123.9, 'USD', 'BANKGU-7db1aba70cb8', 'BANKGU-012608c99d05', 'BANKGU-6d653541f9e5', 'BANKGU-f00d6b92cf31', 91.8939, 9709022.61, 'processing', '2026-03-03 17:34:47', '2025-04-11 10:03:42'),
  ('GUAR-d79cb8d04a5c', 'tenant-kano-north', 'premium', 'APPL-a236ecf80662', 'Kemi Yakubu', 'Uzo Adeyemi', 47515514.98, 'EUR', 'BANKGU-56bc41904f2c', 'BANKGU-3c23ac61d521', 'BANKGU-1d436cb83187', 'BANKGU-188e620583cb', 8.2869, 5787772.71, 'pending', '2025-07-11 14:17:45', '2026-01-13 21:04:27'),
  ('GUAR-f1ceded62480', 'tenant-portharcourt', 'basic', 'APPL-27766dee854e', 'Jumoke Otedola', 'Nneka Adenuga', 46266248.78, 'GBP', 'BANKGU-9df13abf0157', 'BANKGU-d14deceb650f', 'BANKGU-06c653329e81', 'BANKGU-964de369eab6', 27.3878, 7665585.27, 'pending', '2025-02-14 16:18:44', '2026-03-09 22:39:37'),
  ('GUAR-d08941854037', 'tenant-whitelabel-zenith', 'enhanced', 'APPL-10470292c678', 'Femi Eze', 'Dorcas Danladi', 13290154.92, 'EUR', 'BANKGU-b13b7b38054a', 'BANKGU-94e3b5bb81f5', 'BANKGU-0c882d0845ee', 'BANKGU-17c540fce648', 63.1946, 6906845.68, 'approved', '2025-01-15 07:00:01', '2026-01-11 17:32:11'),
  ('GUAR-90f026252e5e', 'tenant-abuja-digital', 'enhanced', 'APPL-64cd73247d5d', 'Femi Yakubu', 'Damilola Kalu', 34996387.35, 'GBP', 'BANKGU-25b4fad7e7b8', 'BANKGU-96a3e0aeb980', 'BANKGU-51a21fa37f5a', 'BANKGU-99cb84007632', 86.0763, 5976737.89, 'completed', '2026-03-02 23:06:04', '2026-04-20 07:22:09')
ON CONFLICT DO NOTHING;


-- ─── batch_aggregator_configs ───
INSERT INTO "batch_aggregator_configs" ("endpoint", "maxRequests", "timeoutMs", "status", "createdAt") VALUES
  ('BATCH_-7b6538faa84b', 74, 359, 'processing', '2025-02-28 08:36:18'),
  ('BATCH_-84a23db428be', 270, 666, 'approved', '2025-03-27 05:54:10'),
  ('BATCH_-20a2fe581ae2', 599, 672, 'completed', '2026-04-28 08:18:57'),
  ('BATCH_-50a7289da1c0', 736, 437, 'processing', '2025-02-23 21:42:17'),
  ('BATCH_-c737bcdc66ab', 395, 876, 'active', '2025-07-08 22:52:10'),
  ('BATCH_-db4f8af64f07', 936, 799, 'processing', '2026-01-04 06:23:35'),
  ('BATCH_-ec44a65b1942', 144, 836, 'processing', '2026-04-06 10:55:10'),
  ('BATCH_-93e9649f3634', 743, 641, 'processing', '2026-03-06 05:02:34')
ON CONFLICT DO NOTHING;


-- ─── beneficial_owners ───
INSERT INTO "beneficial_owners" ("entityId", "entityName", "entityType", "rcNumber", "totalLayers", "status", "createdAt") VALUES
  ('ENTI-363e4b3bb5b3', 'Adaeze Eze', 'full', 'BENEFI-bd03efa4dccf', 352, 'active', '2025-04-02 15:33:52'),
  ('ENTI-04753db94024', 'Chukwuemeka Elumelu', 'basic', 'BENEFI-7f0fadd9e47a', 4570, 'completed', '2025-07-08 16:08:09'),
  ('ENTI-39fab2defd41', 'Nnamdi Yakubu', 'basic', 'BENEFI-ed1a1f3f4c91', 556, 'pending', '2025-08-19 23:58:29'),
  ('ENTI-a1d796bf9887', 'Chukwuemeka Kalu', 'enhanced', 'BENEFI-b3d0f9d15948', 9861, 'pending', '2026-01-23 07:08:38'),
  ('ENTI-20c72d20c758', 'Nnamdi Nwosu', 'enhanced', 'BENEFI-c69768b607fe', 7031, 'processing', '2026-01-04 20:33:04'),
  ('ENTI-81eaf5eafbc7', 'Ibrahim Usman', 'premium', 'BENEFI-9434a749a899', 9073, 'completed', '2025-05-15 19:55:49'),
  ('ENTI-b8ed684c9494', 'Fatima Hassan', 'premium', 'BENEFI-099894be75c7', 3261, 'active', '2025-03-29 22:54:10'),
  ('ENTI-d3527da8e2fb', 'Uzo Garba', 'premium', 'BENEFI-940e8b345355', 810, 'completed', '2026-03-11 03:09:59')
ON CONFLICT DO NOTHING;


-- ─── billingAccrualSnapshots ───
INSERT INTO "billingAccrualSnapshots" ("accrualSnapshotId", "tenantId", "billingAccountId", "billingPeriodKey", "meterKey", "productKey", "ratedEventCount", "usageQuantity", "accruedAmount", "unratedEventCount", "lastUsageAt", "lastRatedAt", "snapshotStatus", "createdAt", "updatedAt") VALUES
  ('ACCR-ed3b36884885', 'tenant-whitelabel-zenith', 'BILL-5be2247582ec', '2025-06', 'BILLIN-0a446ace2805', 'BILLIN-b74d2cf64b1f', 720, 981, 17239341.97, 4050, '2025-12-05 14:01:08', '2025-07-18 17:14:40', 'BILLIN-1043347ce3f7', '2025-10-23 08:07:35', '2025-03-14 16:45:12'),
  ('ACCR-0d6ec57c5ebe', 'tenant-whitelabel-zenith', 'BILL-8e91c4250edb', '2025-06', 'BILLIN-247a3a72306f', 'BILLIN-e5b1082d1150', 2274, 639, 41165262.3, 36, '2025-11-30 22:49:12', '2026-01-02 02:27:45', 'BILLIN-ae332c0640bf', '2025-09-24 12:40:04', '2025-05-13 21:32:29'),
  ('ACCR-f5c360c12395', 'tenant-kano-north', 'BILL-27a22d39bb39', '2025-09', 'BILLIN-b1b126faf665', 'BILLIN-5f89dab10137', 9929, 192, 491373.01, 4422, '2025-03-18 01:10:28', '2025-01-14 10:45:11', 'BILLIN-dbe1f025b3ae', '2025-09-02 15:00:07', '2025-03-04 10:43:33'),
  ('ACCR-78a1702c410b', 'tenant-whitelabel-zenith', 'BILL-10d07ef0c69d', '2025-06', 'BILLIN-7aab404c9a43', 'BILLIN-fb311a2edf6e', 4132, 394, 32526619.7, 1603, '2026-01-22 00:03:12', '2025-09-04 23:03:08', 'BILLIN-16beb0dc4196', '2025-05-05 08:02:26', '2026-03-31 16:41:24'),
  ('ACCR-ad2fe0aa9f95', 'tenant-kano-north', 'BILL-ef88e6999677', '2025-12', 'BILLIN-5264ca80b4eb', 'BILLIN-d44c2ef86a11', 8459, 884, 27976595.21, 6745, '2025-09-17 09:14:00', '2025-02-19 00:21:44', 'BILLIN-ffe13f26477a', '2026-02-25 21:34:46', '2025-10-25 04:23:21'),
  ('ACCR-ac2faa3aefbf', 'tenant-whitelabel-zenith', 'BILL-6f1c0cf95b1e', '2025-01', 'BILLIN-33e36e140064', 'BILLIN-701dd01b87d1', 3398, 214, 35015889.91, 8648, '2025-01-02 05:06:18', '2025-07-12 07:58:59', 'BILLIN-6c3e02063847', '2025-06-01 08:30:12', '2025-10-01 17:22:03'),
  ('ACCR-d92eb8fdc976', 'tenant-kano-north', 'BILL-2931239b5fd2', '2025-12', 'BILLIN-00cc433882a5', 'BILLIN-4f9c90693986', 6516, 851, 9891553.37, 230, '2025-01-04 11:50:37', '2025-08-11 23:01:42', 'BILLIN-2c4a38000af0', '2025-09-15 16:48:30', '2025-10-10 12:24:52'),
  ('ACCR-82436be4f1b4', 'tenant-portharcourt', 'BILL-ed19ee03336a', '2025-04', 'BILLIN-99edb267a45e', 'BILLIN-e9c8dc03bf1a', 5173, 628, 18323190.26, 88, '2025-06-26 04:40:40', '2026-02-21 13:39:27', 'BILLIN-62239e2b27c6', '2025-02-06 16:22:56', '2026-03-07 12:38:00')
ON CONFLICT DO NOTHING;


-- ─── billingContractOverrides ───
INSERT INTO "billingContractOverrides" ("contractOverrideId", "billingAccountId", "tenantId", "overrideType", "meterKey", "productKey", "valueNumber", "valueText", "effectiveFrom", "effectiveTo", "status", "createdBy", "notes", "createdAt", "updatedAt") VALUES
  ('CONT-d401a91ba7e0', 'BILL-72f59e328932', 'tenant-lagos-main', 'enhanced', 'BILLIN-317e7291d5f2', 'BILLIN-8656e68f6c0c', 7224194.32, 'BILLIN-e3946eac6b57', '2026-03-30 20:35:15', '2025-06-07 15:05:51', 'completed', 'BILLIN-3a1586ff45ad', 'Bukola Adeyemi - Awka, Delta - billingContractOverrides record', '2025-08-18 21:59:59', '2026-03-24 06:33:51'),
  ('CONT-91a033491e9c', 'BILL-e30e91b43039', 'tenant-portharcourt', 'enhanced', 'BILLIN-1d2539dd8957', 'BILLIN-9655a69841ee', 7470515.49, 'BILLIN-4e821d19d1a2', '2025-03-12 06:17:30', '2026-01-02 16:57:37', 'pending', 'BILLIN-fde70d3f641d', 'Uzo Igwe - Lekki, Rivers - billingContractOverrides record', '2026-05-04 06:25:58', '2025-01-05 13:50:51'),
  ('CONT-854d74948a18', 'BILL-29df1b19147a', 'tenant-kano-north', 'enhanced', 'BILLIN-ef813bcf42d8', 'BILLIN-eaa9ef6cca42', 7777737.26, 'BILLIN-3f9fd68f96ba', '2025-08-18 00:46:01', '2026-02-17 15:51:32', 'active', 'BILLIN-4dcf7c7e5012', 'Lanre Eze - Enugu, Oyo - billingContractOverrides record', '2025-03-02 00:20:02', '2025-04-06 05:26:53'),
  ('CONT-ae3212129105', 'BILL-961e81269aa6', 'tenant-portharcourt', 'standard', 'BILLIN-1b2917541dd7', 'BILLIN-781624f85ac0', 4427639.38, 'BILLIN-fe8d9879ab94', '2026-02-06 22:10:08', '2025-12-11 12:17:08', 'active', 'BILLIN-42bc39a818ce', 'Nnamdi Mohammed - Garki, Rivers - billingContractOverrides record', '2025-12-28 01:10:43', '2026-03-23 07:15:31'),
  ('CONT-573f45a7b790', 'BILL-830bfc3cfa10', 'tenant-whitelabel-zenith', 'basic', 'BILLIN-ed7cd5ce8c47', 'BILLIN-f3fab8b57bfb', 8562386.62, 'BILLIN-f29fafb15cf4', '2026-03-25 13:16:32', '2025-11-19 22:14:42', 'pending', 'BILLIN-1062f7540ae7', 'Maryam Danladi - Lekki, Borno - billingContractOverrides record', '2026-04-22 17:42:52', '2025-01-04 09:43:03'),
  ('CONT-34ac5da804a9', 'BILL-0d446b39eca8', 'tenant-portharcourt', 'premium', 'BILLIN-b01738782564', 'BILLIN-3b4f6ca52384', 9401148.66, 'BILLIN-ad677af80a53', '2025-12-30 19:31:27', '2025-05-17 09:30:48', 'active', 'BILLIN-fa9f1d5723bb', 'Dorcas Danladi - Victoria Island, Kano - billingContractOverrides record', '2025-04-22 06:12:30', '2025-10-30 11:02:23'),
  ('CONT-54823bbb4792', 'BILL-fb463cbae192', 'tenant-kano-north', 'full', 'BILLIN-d8dd1bac58e7', 'BILLIN-6473a652a452', 357147.21, 'BILLIN-5d3afa8c29d5', '2025-03-29 13:04:29', '2026-01-12 07:55:02', 'approved', 'BILLIN-1f8cc5b191c7', 'Kunle Adenuga - Awka, Ogun - billingContractOverrides record', '2025-10-14 16:09:56', '2025-06-15 20:02:51'),
  ('CONT-6cf2552ad37b', 'BILL-f3009f3c2cca', 'tenant-abuja-digital', 'basic', 'BILLIN-def4eee42bbe', 'BILLIN-ca8a95781437', 7981777.65, 'BILLIN-a1307156947f', '2025-03-06 18:10:21', '2026-04-11 16:06:10', 'active', 'BILLIN-6b3738420452', 'Adaeze Peterside - Port Harcourt, Rivers - billingContractOverrides record', '2026-01-20 20:05:40', '2025-06-14 06:28:38')
ON CONFLICT DO NOTHING;


-- ─── billingDiscountRules ───
INSERT INTO "billingDiscountRules" ("discountRuleId", "billingAccountId", "tenantId", "name", "discountType", "meterKey", "productKey", "percentage", "fixedAmount", "thresholdAmount", "effectiveFrom", "effectiveTo", "status", "createdBy", "createdAt", "updatedAt") VALUES
  ('DISC-d9e7df04bf1c', 'BILL-e6939021a3fc', 'tenant-whitelabel-zenith', 'Oluchi Danladi', 'standard', 'BILLIN-b7ea1ae2ec28', 'BILLIN-b9a725b5001e', 96.8164, 577638.14, 2360640.14, '2025-05-19 05:38:51', '2025-04-21 23:03:44', 'processing', 'BILLIN-1c259df57e8c', '2026-02-19 07:38:04', '2025-07-30 03:11:28'),
  ('DISC-d39f56a8f9f4', 'BILL-234b891822c8', 'tenant-abuja-digital', 'Chukwuemeka Okafor', 'premium', 'BILLIN-7a2e408e29de', 'BILLIN-f4f15dfd497b', 83.4728, 4669756.4, 413696.99, '2025-04-25 15:06:31', '2026-04-16 18:51:55', 'approved', 'BILLIN-e3327dd75fd4', '2025-06-12 19:51:36', '2025-08-20 04:05:13'),
  ('DISC-bbc53afe7982', 'BILL-7f2603312ba6', 'tenant-whitelabel-zenith', 'Titilayo Yakubu', 'full', 'BILLIN-ab03715a26f6', 'BILLIN-3549f4c7b317', 60.9132, 4205115.54, 3744659.33, '2026-04-04 17:09:54', '2026-03-19 15:44:25', 'pending', 'BILLIN-38e46b151ca4', '2025-10-13 21:11:56', '2025-08-02 00:35:40'),
  ('DISC-d26712e99617', 'BILL-964ff0af3a7d', 'tenant-whitelabel-zenith', 'Uzo Igwe', 'standard', 'BILLIN-2237a4fc6c48', 'BILLIN-5f27f3ecb649', 40.8367, 5650892.8, 9694664.66, '2026-03-26 01:56:29', '2026-01-08 03:36:46', 'processing', 'BILLIN-de1462cf369c', '2025-11-29 05:05:26', '2025-03-21 15:18:25'),
  ('DISC-58a7784f7a5f', 'BILL-80adb84a5c94', 'tenant-portharcourt', 'Damilola Peterside', 'basic', 'BILLIN-0e17f2abd941', 'BILLIN-982b21d4cd72', 94.8741, 8743896.06, 1682210.29, '2025-08-22 14:19:21', '2025-01-30 08:58:23', 'approved', 'BILLIN-dffab0cf5b55', '2026-01-28 09:55:02', '2026-03-09 02:40:25'),
  ('DISC-9973943260a6', 'BILL-99e9a863afae', 'tenant-lagos-main', 'Uche Garba', 'full', 'BILLIN-b858897e7bcd', 'BILLIN-665b93ca74f6', 44.7444, 534577.29, 3793366.06, '2025-05-09 07:49:28', '2025-02-25 09:47:03', 'processing', 'BILLIN-d3c131235be8', '2025-05-16 08:27:20', '2026-01-09 05:35:41'),
  ('DISC-0539c1c9bdaf', 'BILL-64927c06ecdc', 'tenant-whitelabel-zenith', 'Damilola Chukwu', 'premium', 'BILLIN-5be2cf4f6a66', 'BILLIN-9a5fdc452be4', 10.7122, 7531917.73, 56502.7, '2026-03-28 13:09:02', '2025-03-31 20:27:53', 'completed', 'BILLIN-f100f794e02a', '2026-01-09 22:05:21', '2025-11-10 00:42:47'),
  ('DISC-b42a49e49951', 'BILL-3f468638d457', 'tenant-kano-north', 'Grace Taiwo', 'full', 'BILLIN-dbdf69f6f86f', 'BILLIN-b2271abb6079', 52.401, 8608746.07, 7117451.9, '2025-11-05 18:34:50', '2026-01-28 09:07:08', 'completed', 'BILLIN-7d8d9655e0dc', '2025-06-19 15:50:40', '2025-10-15 10:23:08')
ON CONFLICT DO NOTHING;


-- ─── billingInvoiceApprovals ───
INSERT INTO "billingInvoiceApprovals" ("billingInvoiceApprovalId", "billingInvoiceId", "stageKey", "actorRole", "status", "actedAt", "note", "createdAt", "updatedAt") VALUES
  ('BILL-72ccb409d78f', 'BILL-7f7f8bb20d63', 'BILLIN-5a88362c2a48', 'operator', 'active', '2025-04-27 17:17:13', 'Tunde Peterside - Enugu, Anambra - billingInvoiceApprovals record', '2026-04-19 08:19:12', '2025-04-12 09:41:26'),
  ('BILL-83058b54e349', 'BILL-b24a3d86ce62', 'BILLIN-eb552885ddb4', 'operator', 'completed', '2025-09-19 19:17:38', 'Nneka Adeyemi - Abeokuta, Ogun - billingInvoiceApprovals record', '2025-09-19 02:58:34', '2026-01-12 10:15:28'),
  ('BILL-1597070c6415', 'BILL-7d518a27150e', 'BILLIN-a99b56c8b3ba', 'teller', 'approved', '2025-11-06 02:33:41', 'Femi Hassan - Asaba, Edo - billingInvoiceApprovals record', '2025-11-06 03:19:16', '2025-04-17 01:36:51'),
  ('BILL-921316db8c54', 'BILL-a58d8db71faa', 'BILLIN-1d88be3506d0', 'operator', 'completed', '2025-06-30 19:50:26', 'Emeka Balogun - Benin City, Osun - billingInvoiceApprovals record', '2025-09-02 15:46:05', '2025-05-27 17:47:44'),
  ('BILL-416e3b1b9ade', 'BILL-3cafdf4ab7cb', 'BILLIN-0f7f3867c64e', 'credit', 'processing', '2025-01-02 05:34:42', 'Sade Danladi - Kano, Enugu - billingInvoiceApprovals record', '2025-07-15 03:14:05', '2025-03-01 10:41:07'),
  ('BILL-25c502c32f55', 'BILL-d006dfbe356e', 'BILLIN-70336e1f9acb', 'auditor', 'active', '2025-11-25 02:34:55', 'Lilian Otedola - Ibadan, Akwa Ibom - billingInvoiceApprovals record', '2025-11-16 17:18:21', '2025-10-05 18:44:19'),
  ('BILL-ada64d438a07', 'BILL-a90b96657288', 'BILLIN-612cc8485eb1', 'teller', 'active', '2026-04-01 06:40:27', 'Tunde Adeyemi - Ikeja, Edo - billingInvoiceApprovals record', '2025-03-05 16:10:47', '2025-02-22 11:00:45'),
  ('BILL-4eb79430d17d', 'BILL-09ae886c08e0', 'BILLIN-d7a7a8d6bbfa', 'operator', 'completed', '2025-10-03 09:08:19', 'Chukwuemeka Chukwu - Victoria Island, Edo - billingInvoiceApprovals record', '2025-05-02 05:58:40', '2025-11-05 05:49:22')
ON CONFLICT DO NOTHING;


-- ─── billingInvoiceLines ───
INSERT INTO "billingInvoiceLines" ("billingInvoiceLineId", "billingInvoiceId", "lineType", "meterKey", "productKey", "description", "quantity", "unitPrice", "amount", "metadata", "createdAt") VALUES
  ('BILL-3cf59c7fc71a', 'BILL-de6cfaf568a5', 'standard', 'BILLIN-bb7e612e774a', 'BILLIN-da2697243093', 'Tunde Mohammed - Benin City, Borno - billingInvoiceLines record', 9321430.31, 1646994.8, 9747688.14, '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-05-08 23:00:09'),
  ('BILL-037827b8cd37', 'BILL-d260990f6cd1', 'basic', 'BILLIN-4c11e8cd4ea0', 'BILLIN-aecaa4014845', 'Gbenga Dangote - Kano, Kano - billingInvoiceLines record', 6092557.54, 4735631.89, 42780518.36, '{"source": "seed", "tenant": "tenant-kano-north"}'::jsonb, '2025-12-27 09:46:44'),
  ('BILL-512f5db81632', 'BILL-234f7e6e65b2', 'basic', 'BILLIN-27f1f886c013', 'BILLIN-54e7ff69cd0c', 'Bukola Hassan - Victoria Island, Rivers - billingInvoiceLines record', 6786278.88, 7357743.98, 4491505.27, '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2026-01-05 18:30:38'),
  ('BILL-d63cc103daf7', 'BILL-b12de9ba43ff', 'standard', 'BILLIN-1fa5863b9ba0', 'BILLIN-7f6b1b6da153', 'Ifeoma Elumelu - Kano, Ogun - billingInvoiceLines record', 7881414.3, 500178.76, 14997394.77, '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-09-12 04:41:29'),
  ('BILL-40dbc27c2cd7', 'BILL-cd6d665c1551', 'enhanced', 'BILLIN-01f5056aa6af', 'BILLIN-8fe74ef4e890', 'Titilayo Otedola - Awka, Cross River - billingInvoiceLines record', 6380371.64, 2733638.72, 27724172.64, '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-03-20 04:33:54'),
  ('BILL-6d1d0662d04c', 'BILL-6585e31529e0', 'enhanced', 'BILLIN-62e91a2cad7a', 'BILLIN-17eaae8a0130', 'Musa Mohammed - Enugu, Plateau - billingInvoiceLines record', 2636271.49, 4402240.91, 3010457.85, '{"source": "seed", "tenant": "tenant-whitelabel-zenith"}'::jsonb, '2026-01-01 09:01:44'),
  ('BILL-574243fd0fb9', 'BILL-0466b7f0568f', 'basic', 'BILLIN-cc59a70b3552', 'BILLIN-9792e4f61062', 'Pelumi Usman - Victoria Island, Lagos - billingInvoiceLines record', 7650301.04, 1008895.04, 21425716.83, '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-12-08 01:09:11'),
  ('BILL-08849a917de5', 'BILL-9788c4dde14d', 'enhanced', 'BILLIN-d53b0122d052', 'BILLIN-7b20da246adf', 'Kunle Sanusi - Port Harcourt, Osun - billingInvoiceLines record', 6102466.18, 3672822.75, 1410258.24, '{"source": "seed", "tenant": "tenant-kano-north"}'::jsonb, '2025-12-22 09:41:20')
ON CONFLICT DO NOTHING;


-- ─── billingInvoices ───
INSERT INTO "billingInvoices" ("billingInvoiceId", "invoiceNumber", "tenantId", "billingAccountId", "billingPeriodKey", "billingPeriodType", "periodStartAt", "periodEndAt", "currency", "subtotalAmount", "discountAmount", "revenueShareAmount", "minimumCommitAdjustment", "taxAmount", "totalAmount", "status", "approvalStatus", "generatedAt", "dueAt", "approvalStepCount", "issuedAt", "createdAt", "updatedAt") VALUES
  ('BILL-10fd9b870b05', 'BILLIN-9be239a15c65', 'tenant-whitelabel-zenith', 'BILL-846a7978e3ef', '2025-06', 'basic', '2025-02-24 21:31:02', '2026-01-18 05:40:42', 'EUR', 6509573.63, 6750760.8, 56.28, 1535268.9, 551470.86, 40106189.55, 'pending', 'BILLIN-4ee82e4d68ea', '2026-01-21 10:36:07', '2025-06-10 20:40:34', 7088, '2025-01-21 18:55:40', '2025-03-03 13:19:24', '2025-11-11 21:45:17'),
  ('BILL-2332699adadf', 'BILLIN-3005fb6e0d67', 'tenant-abuja-digital', 'BILL-2f93f37c3260', '2025-09', 'premium', '2025-07-13 17:00:34', '2026-04-07 05:51:07', 'NGN', 4034285.5, 1242927.45, 494.76, 5570691.6, 5049946.64, 10786044.1, 'completed', 'BILLIN-90e73c7c5b38', '2025-08-18 11:27:08', '2025-03-05 19:23:23', 5157, '2025-09-30 03:39:10', '2025-12-13 18:38:45', '2026-04-19 03:59:21'),
  ('BILL-67a413fd974c', 'BILLIN-a83d450e974f', 'tenant-abuja-digital', 'BILL-b4169e8199b6', '2025-01', 'full', '2025-07-31 09:59:22', '2025-10-01 07:23:08', 'EUR', 1137670.49, 1154413.85, 278.33, 7243408.51, 6838030.52, 44320035.96, 'pending', 'BILLIN-90733807e1e6', '2025-01-02 04:17:58', '2025-12-15 18:26:32', 6242, '2025-09-05 09:42:22', '2025-10-01 03:25:14', '2026-03-27 12:16:49'),
  ('BILL-2b7b9475cc4b', 'BILLIN-84d061300959', 'tenant-whitelabel-zenith', 'BILL-bdae8b4bd8a9', '2025-03', 'basic', '2025-06-02 05:58:07', '2025-02-11 13:42:04', 'EUR', 6697025.13, 9801037.35, 266.91, 9308123.23, 5903919.45, 12967260.87, 'approved', 'BILLIN-a50b605e3c60', '2026-05-09 10:00:31', '2026-04-05 22:25:48', 3724, '2025-11-23 16:27:46', '2026-03-07 05:35:58', '2025-03-04 09:18:04'),
  ('BILL-17ebbf4c0986', 'BILLIN-df6026f5dae9', 'tenant-portharcourt', 'BILL-d880bb503d84', '2025-05', 'full', '2025-12-16 20:09:21', '2025-12-27 08:02:38', 'GBP', 6559248.26, 9339048.21, 139.07, 8706948.35, 7489420.94, 46066827.97, 'approved', 'BILLIN-4291a85c40f6', '2025-08-11 14:35:52', '2025-01-08 01:20:58', 6255, '2025-12-22 14:37:14', '2026-05-07 22:23:36', '2025-07-26 18:36:55'),
  ('BILL-686a3417765b', 'BILLIN-0c876981ef82', 'tenant-lagos-main', 'BILL-a12dd1eec65f', '2025-09', 'enhanced', '2026-02-12 18:05:16', '2025-03-15 23:07:26', 'USD', 4818496.79, 3479805.38, 112.08, 8334977.17, 4706037.76, 25302207.58, 'active', 'BILLIN-ec4d2f974176', '2025-03-22 18:23:30', '2025-06-16 15:59:35', 5895, '2026-02-18 21:37:20', '2025-03-20 00:42:13', '2026-04-11 00:20:02'),
  ('BILL-b3d85ebaee89', 'BILLIN-507d614e83ec', 'tenant-whitelabel-zenith', 'BILL-1fd9d67c6d1f', '2025-08', 'premium', '2025-07-22 09:04:34', '2025-12-25 10:18:00', 'NGN', 7503177.76, 5163312.39, 72.39, 2156348.53, 7187871.53, 232081.43, 'processing', 'BILLIN-5c497ec173fd', '2026-04-07 03:55:51', '2025-12-30 23:19:36', 5043, '2026-04-30 23:32:50', '2025-10-11 20:25:38', '2025-06-25 13:56:09'),
  ('BILL-9f9bd84e2bfb', 'BILLIN-b11f4a551227', 'tenant-abuja-digital', 'BILL-3fb84d4f0ba1', '2025-01', 'basic', '2025-09-24 05:20:20', '2025-12-12 19:23:21', 'NGN', 3068079.61, 9878612.88, 139.08, 496767.92, 5707526.24, 33494930.17, 'completed', 'BILLIN-11e408fe22f0', '2025-09-12 21:46:36', '2025-04-19 16:20:28', 5171, '2025-07-21 10:23:44', '2025-06-29 10:37:34', '2025-04-11 02:59:55')
ON CONFLICT DO NOTHING;


-- ─── billingRateCardLines ───
INSERT INTO "billingRateCardLines" ("rateCardLineId", "rateCardId", "meterKey", "productKey", "chargeType", "unitPrice", "includedUnits", "tierStart", "tierEnd", "minimumCharge", "maximumCharge", "pricingFormula", "settlementLedgerCode", "createdAt", "updatedAt") VALUES
  ('RATE-9262a76df23d', 'RATE-614bfa20d65b', 'BILLIN-32e1d98bff5a', 'BILLIN-a7dbb795c351', 'full', 5004038.36, 333, 189, 242, 4909109.05, 2812120.93, '{"data": "seed"}'::jsonb, 'BILLIN-dc02cd0b2cb7', '2025-07-06 08:49:29', '2026-03-29 19:14:19'),
  ('RATE-4976ca277fa9', 'RATE-a27415191fef', 'BILLIN-517a2a779406', 'BILLIN-b93c95953b36', 'premium', 5336219.8, 971, 498, 987, 8445021.88, 9785190.75, '{"data": "seed"}'::jsonb, 'BILLIN-66f186fc5e6b', '2025-10-01 09:06:47', '2025-10-08 08:39:26'),
  ('RATE-a705664ba5dc', 'RATE-7aa0322068eb', 'BILLIN-efc8373c1198', 'BILLIN-72aab9398c3c', 'full', 3406932.91, 304, 488, 915, 4686503.78, 2687988.85, '{"data": "seed"}'::jsonb, 'BILLIN-f0b99784afa2', '2025-05-05 22:29:40', '2026-03-15 10:00:22'),
  ('RATE-5f17b7df77c7', 'RATE-a0213bdb4369', 'BILLIN-a583d2d3af01', 'BILLIN-acf0454fc5e4', 'premium', 4536361.49, 289, 842, 119, 7171487.64, 9412018.78, '{"data": "seed"}'::jsonb, 'BILLIN-71fd40d271bc', '2025-05-06 15:48:19', '2026-05-04 08:37:14'),
  ('RATE-0c7568954fff', 'RATE-b2b5d52aead8', 'BILLIN-129ea1de7ae2', 'BILLIN-8c112a8c0270', 'standard', 6962010.97, 421, 34, 707, 9225670.53, 2010562.28, '{"data": "seed"}'::jsonb, 'BILLIN-de529d6265fb', '2025-02-06 00:40:52', '2025-12-21 09:54:39'),
  ('RATE-0df119fd18d8', 'RATE-ef93fc4271cb', 'BILLIN-a7adb03caf6b', 'BILLIN-5817e31c59e7', 'standard', 1993868.44, 335, 513, 689, 3266800.33, 9923705.83, '{"data": "seed"}'::jsonb, 'BILLIN-591271bdfb11', '2025-10-25 08:36:06', '2026-04-13 05:43:23'),
  ('RATE-4b5f3f556281', 'RATE-483cb0d2aed3', 'BILLIN-5c5359a70023', 'BILLIN-54cc0c468f51', 'full', 9830703.4, 480, 974, 663, 3702623.04, 6772693.21, '{"data": "seed"}'::jsonb, 'BILLIN-59e8de0763f7', '2026-02-01 05:53:47', '2026-02-18 15:21:53'),
  ('RATE-a6c3e40af656', 'RATE-353beffc086a', 'BILLIN-39acc0feef1c', 'BILLIN-a2a27d1b76ef', 'basic', 8297735.55, 935, 359, 65, 9741326.22, 5034890.54, '{"data": "seed"}'::jsonb, 'BILLIN-633db6a38a90', '2025-01-27 01:20:47', '2025-12-21 18:10:39')
ON CONFLICT DO NOTHING;


-- ─── billingRatedEvents ───
INSERT INTO "billingRatedEvents" ("ratedEventId", "usageEventId", "rateCardId", "rateCardLineId", "billingPeriodKey", "quantityRated", "billableUnits", "amountAccrued", "currency", "ratingExplanation", "ratedAt") VALUES
  ('RATE-8455e13c88b0', 'USAG-be9903d82348', 'RATE-b1b717796aaf', 'RATE-cb39aa9f606c', '2025-10', 337, 867837.17, 8799134.22, 'EUR', '{"data": "seed"}'::jsonb, '2025-08-24 15:49:32'),
  ('RATE-d8d59c3a2b65', 'USAG-72097e517a0e', 'RATE-681e871942ad', 'RATE-d559e744cf1a', '2025-07', 148, 3327755.93, 2882018.68, 'NGN', '{"data": "seed"}'::jsonb, '2025-07-23 21:35:08'),
  ('RATE-03c6f256091e', 'USAG-540f5c4f3b87', 'RATE-7972d6eefe8f', 'RATE-eca0265baefb', '2025-03', 352, 8554169.5, 9343724.37, 'EUR', '{"data": "seed"}'::jsonb, '2025-12-28 21:06:42'),
  ('RATE-a1353c6a2507', 'USAG-b48a71a5a196', 'RATE-787bedfbad08', 'RATE-2bf6038dbe9a', '2025-05', 639, 5775609.37, 3079702.49, 'USD', '{"data": "seed"}'::jsonb, '2025-12-13 21:22:01'),
  ('RATE-7f5c436abfd8', 'USAG-d56da139b8ca', 'RATE-95199c1a98ce', 'RATE-6a3a346a02a9', '2025-03', 46, 4046173.35, 583000.05, 'NGN', '{"data": "seed"}'::jsonb, '2025-10-09 13:42:39'),
  ('RATE-d467618eda2f', 'USAG-675352969855', 'RATE-00b5f1b86593', 'RATE-88d5fc2b1a4e', '2025-07', 247, 4724191.12, 3347065.77, 'USD', '{"data": "seed"}'::jsonb, '2025-06-22 17:18:46'),
  ('RATE-a5537cc17e0e', 'USAG-a009ebf0e92d', 'RATE-a2da1b5b6ebb', 'RATE-937ffc7c599b', '2025-02', 45, 2471594.64, 6041135.63, 'EUR', '{"data": "seed"}'::jsonb, '2025-05-28 10:51:16'),
  ('RATE-fcabb1c91c37', 'USAG-2827427378f7', 'RATE-90cb0498b720', 'RATE-c1d7fb64411e', '2025-06', 192, 5586984.39, 6119651.96, 'EUR', '{"data": "seed"}'::jsonb, '2025-06-10 00:37:40')
ON CONFLICT DO NOTHING;


-- ─── billingRevenueShareRules ───
INSERT INTO "billingRevenueShareRules" ("revenueShareRuleId", "billingAccountId", "tenantId", "name", "target", "percentage", "beneficiaryName", "settlementLedgerCode", "effectiveFrom", "effectiveTo", "status", "createdBy", "createdAt", "updatedAt") VALUES
  ('REVE-2b931a3fc9e3', 'BILL-00c342b05a3c', 'tenant-lagos-main', 'Jumoke Nwosu', 'BILLIN-ae44d3cb0b59', 76.2296, 'Patience Jimoh', 'BILLIN-46b1775aad65', '2025-03-18 20:30:49', '2025-05-30 16:43:45', 'pending', 'BILLIN-131ce88e4e10', '2025-01-22 14:07:15', '2026-04-26 10:29:15'),
  ('REVE-f148b40dbf5c', 'BILL-4f4655571473', 'tenant-lagos-main', 'Titilayo Peterside', 'BILLIN-e892ba537ddf', 10.5352, 'Esther Hassan', 'BILLIN-f75cba64fc0e', '2025-05-09 00:04:11', '2025-01-24 04:15:17', 'processing', 'BILLIN-64b1083a8830', '2025-03-15 19:41:05', '2026-02-24 02:19:19'),
  ('REVE-8a8a14ca3ddb', 'BILL-bf27007e8961', 'tenant-abuja-digital', 'Fatima Taiwo', 'BILLIN-15ed64316ce8', 32.3911, 'Adaeze Sanusi', 'BILLIN-6475f3db64a7', '2025-05-25 15:41:00', '2025-04-04 06:51:19', 'approved', 'BILLIN-007685c06881', '2025-09-10 17:14:00', '2026-01-09 11:52:53'),
  ('REVE-8867e19b4810', 'BILL-24886be9487b', 'tenant-portharcourt', 'Ifeoma Sanusi', 'BILLIN-7c74f11b47b9', 8.6451, 'Sade Igwe', 'BILLIN-50fd96786cb5', '2026-04-07 02:58:08', '2025-10-16 23:05:25', 'active', 'BILLIN-10e6f1e4ae25', '2025-06-16 02:45:46', '2025-08-25 06:47:15'),
  ('REVE-ff96eedfb41a', 'BILL-aa8997f65d5d', 'tenant-whitelabel-zenith', 'Olumide Kalu', 'BILLIN-f2fe202459f9', 40.8386, 'Patience Okafor', 'BILLIN-61a0427e9a30', '2025-07-22 18:15:27', '2025-08-13 14:13:19', 'completed', 'BILLIN-f27dd4c97a83', '2026-01-24 23:17:24', '2025-09-18 00:28:21'),
  ('REVE-325cf123937c', 'BILL-248798429322', 'tenant-kano-north', 'Kunle Adeyemi', 'BILLIN-e7c34b48abfb', 5.9082, 'Chukwuemeka Nwosu', 'BILLIN-f2a93577e2b4', '2025-04-22 01:49:05', '2026-05-09 01:59:29', 'completed', 'BILLIN-0308346c23ac', '2025-05-02 08:40:09', '2025-01-14 08:40:05'),
  ('REVE-4799ddbd1133', 'BILL-10b22eb83e29', 'tenant-whitelabel-zenith', 'Grace Yakubu', 'BILLIN-1604dc495fda', 39.2898, 'Gbenga Nwosu', 'BILLIN-dbfda70abbb5', '2025-03-02 00:43:49', '2025-11-03 07:56:54', 'processing', 'BILLIN-7328e798a7ac', '2025-03-27 19:38:33', '2025-04-12 21:17:55'),
  ('REVE-6d8d2e017d00', 'BILL-880f90c63053', 'tenant-abuja-digital', 'Jide Nwosu', 'BILLIN-b5722f7c774e', 94.7429, 'Jide Dangote', 'BILLIN-83b4aed44d4b', '2025-10-07 18:21:42', '2025-05-17 09:17:03', 'processing', 'BILLIN-6052a534d9d1', '2026-03-23 15:06:25', '2025-01-12 09:02:18')
ON CONFLICT DO NOTHING;


-- ─── billingUsageEvents ───
INSERT INTO "billingUsageEvents" ("usageEventId", "idempotencyKey", "tenantId", "billingAccountId", "sourceService", "sourceEventType", "meterKey", "productKey", "quantity", "unitAmount", "currency", "eventTimestamp", "ingestedAt", "correlationId", "actorId", "resourceId", "payload", "status", "createdAt") VALUES
  ('USAG-3aefeaba074f', 'BILLIN-536d4e944206', 'tenant-kano-north', 'BILL-7a09109ba6e6', 'BILLIN-444b9ba72459', 'full', 'BILLIN-89d7403b9b96', 'BILLIN-3f844fd387bb', 927, 1199173.93, 'EUR', '2025-10-23 15:49:23', '2025-05-14 06:48:54', 'CORR-6beb0e853cbd', 'ACTO-442085ce913e', 'RESO-ca2306d45229', '{"data": "seed"}'::jsonb, 'pending', '2025-07-19 03:13:03'),
  ('USAG-7c0c91e4a02e', 'BILLIN-28281a2cba4e', 'tenant-portharcourt', 'BILL-afed697253fe', 'BILLIN-dabf587e7cdf', 'standard', 'BILLIN-419fef838da3', 'BILLIN-119013f58e72', 955, 8855246.12, 'USD', '2025-10-21 00:08:24', '2025-06-10 19:54:36', 'CORR-b071303de9be', 'ACTO-084150ef5ad1', 'RESO-3d5519103a08', '{"data": "seed"}'::jsonb, 'active', '2025-06-03 15:29:06'),
  ('USAG-c8fb2f4cd1c3', 'BILLIN-9bf4972cf4cb', 'tenant-lagos-main', 'BILL-942cccc2493f', 'BILLIN-94fd7d17cca2', 'full', 'BILLIN-3d7816033e7d', 'BILLIN-c978724e5bd7', 650, 9659803.83, 'GBP', '2025-03-10 13:36:57', '2026-01-30 10:06:13', 'CORR-8dc6df7d8194', 'ACTO-3e609916c7bb', 'RESO-119a7c6cb8d2', '{"data": "seed"}'::jsonb, 'pending', '2026-02-18 14:11:07'),
  ('USAG-1bd902872ad0', 'BILLIN-3380c548c7b4', 'tenant-abuja-digital', 'BILL-fe4155aff218', 'BILLIN-a168832061c8', 'standard', 'BILLIN-71df821c4355', 'BILLIN-570bebe50e0d', 84, 6430085.44, 'NGN', '2026-04-08 23:55:06', '2025-07-31 16:30:12', 'CORR-3da42fe234c2', 'ACTO-5f034a588295', 'RESO-a23016e05e82', '{"data": "seed"}'::jsonb, 'processing', '2025-11-29 08:43:25'),
  ('USAG-a59228cfb0fb', 'BILLIN-fe28fa5bfc5f', 'tenant-abuja-digital', 'BILL-cff23aad748d', 'BILLIN-9efa631d3228', 'standard', 'BILLIN-10762b57f0e3', 'BILLIN-392abaee6d3a', 968, 5206364.77, 'EUR', '2025-10-27 06:31:33', '2025-10-09 00:06:20', 'CORR-17c8ea3d4ced', 'ACTO-55ac15662931', 'RESO-481e17103e1f', '{"data": "seed"}'::jsonb, 'processing', '2025-08-14 07:38:44'),
  ('USAG-7128d1428572', 'BILLIN-8ed633355a12', 'tenant-lagos-main', 'BILL-22cf55d44eee', 'BILLIN-9c33a5e0c2d9', 'premium', 'BILLIN-b11c0fe6130c', 'BILLIN-bff39918142e', 875, 5091833.81, 'NGN', '2025-09-10 11:59:40', '2026-01-19 20:09:06', 'CORR-e998afd2702f', 'ACTO-1587f656c457', 'RESO-1024af0c5741', '{"data": "seed"}'::jsonb, 'active', '2025-05-31 20:02:47'),
  ('USAG-13fb01c1b02d', 'BILLIN-38504285ddc6', 'tenant-whitelabel-zenith', 'BILL-315e682ac39c', 'BILLIN-a2057c0a0353', 'premium', 'BILLIN-e6b3fd56edb2', 'BILLIN-9bd852be2051', 452, 1299900.64, 'USD', '2025-12-24 06:45:25', '2025-02-13 16:51:48', 'CORR-c10e80e5f9f6', 'ACTO-8cc0b91391ff', 'RESO-a04a756772f4', '{"data": "seed"}'::jsonb, 'processing', '2025-07-28 20:52:14'),
  ('USAG-a9b43691405b', 'BILLIN-e16de0d5b816', 'tenant-lagos-main', 'BILL-1dd2ed9f100d', 'BILLIN-6775c79a3f2c', 'full', 'BILLIN-e8e65c58c4d8', 'BILLIN-6305b61a2a2c', 203, 2715145.71, 'USD', '2025-12-01 20:31:49', '2026-02-21 14:40:08', 'CORR-ab3d130417cd', 'ACTO-6558f5ebaabd', 'RESO-1d28308b2eeb', '{"data": "seed"}'::jsonb, 'active', '2025-07-13 06:36:31')
ON CONFLICT DO NOTHING;


-- ─── bloom_filters ───
INSERT INTO "bloom_filters" ("name", "falsePositiveRate", "hashFunctions", "status", "createdAt") VALUES
  ('Ifeoma Mohammed', 'BLOOM_-30db85a3304e', 345, 'completed', '2025-06-30 00:20:46'),
  ('Titilayo Taiwo', 'BLOOM_-4f2ef99e2406', 154, 'approved', '2025-08-22 09:43:39'),
  ('Ibrahim Elumelu', 'BLOOM_-95fda4f5fba2', 348, 'pending', '2025-03-31 06:27:48'),
  ('Esther Chukwu', 'BLOOM_-d97a8402a257', 249, 'processing', '2025-10-15 23:23:00'),
  ('Patience Adeyemi', 'BLOOM_-6133ab7ea1f3', 320, 'active', '2026-01-25 00:42:54'),
  ('Nneka Chukwu', 'BLOOM_-d35dd170e1ab', 383, 'processing', '2025-05-05 23:36:19'),
  ('Oluchi Nwosu', 'BLOOM_-09bcd4303f4b', 8, 'processing', '2025-11-13 11:54:41'),
  ('Rasheed Balogun', 'BLOOM_-f0179f84b3da', 735, 'pending', '2025-04-03 23:55:27')
ON CONFLICT DO NOTHING;


-- ─── bnpl_orders ───
INSERT INTO "bnpl_orders" ("tenantId", "customerId", "merchantName", "product", "installments", "paidInstallments", "nextDueDate", "creditScore", "status", "createdAt") VALUES
  ('tenant-kano-north', 'CUST-b546d79a958c', 'Dominos Wuse', 'BNPL_O-9fc89f742416', 302, 798, '2025-10-01 16:43:13', 41, 'active', '2026-05-01 10:58:49'),
  ('tenant-lagos-main', 'CUST-763e7b10e922', 'Shoprite Ikeja', 'BNPL_O-debe9250a409', 431, 977, '2025-06-20 16:49:05', 26, 'completed', '2026-01-16 21:56:32'),
  ('tenant-whitelabel-zenith', 'CUST-fe703d6158c4', 'Dominos Wuse', 'BNPL_O-242bf71ce7e6', 247, 872, '2025-04-01 17:19:13', 2, 'pending', '2025-06-19 14:32:06'),
  ('tenant-kano-north', 'CUST-a009c81834d5', 'SPAR Lekki', 'BNPL_O-4ec05b19d1c0', 664, 634, '2025-02-20 20:02:58', 26, 'active', '2026-03-19 15:45:42'),
  ('tenant-kano-north', 'CUST-4a96d15f1c0a', 'SPAR Lekki', 'BNPL_O-26484d9f4119', 62, 396, '2025-12-20 17:32:18', 56, 'processing', '2025-01-02 21:17:59'),
  ('tenant-lagos-main', 'CUST-075c8c43f2ff', 'Chicken Republic', 'BNPL_O-e3e807305848', 328, 343, '2025-02-03 23:05:54', 16, 'completed', '2025-02-28 17:47:46'),
  ('tenant-kano-north', 'CUST-971e73749319', 'Total Station', 'BNPL_O-581ae1c07426', 253, 207, '2025-01-27 05:46:01', 11, 'approved', '2026-03-07 15:41:49'),
  ('tenant-kano-north', 'CUST-591094597de0', 'Shoprite Ikeja', 'BNPL_O-c9eea1cf7106', 214, 62, '2025-12-12 00:10:10', 13, 'processing', '2025-03-25 06:41:35')
ON CONFLICT DO NOTHING;


-- ─── body_limit_rules ───
INSERT INTO "body_limit_rules" ("path", "method", "contentTypes", "enforced", "violations24h", "blocked24h", "status", "createdAt") VALUES
  ('BODY_L-5adf0277946f', 'BODY_L-03b96eca4f56', '{"data": "seed"}'::jsonb, true, 206, 321, 'approved', '2025-03-08 21:23:03'),
  ('BODY_L-153abe7f8a05', 'BODY_L-f7edf0b0f6ff', '{"data": "seed"}'::jsonb, true, 195, 593, 'active', '2026-01-14 23:39:34'),
  ('BODY_L-bb42b2cf95ee', 'BODY_L-f07650058fac', '{"data": "seed"}'::jsonb, true, 669, 339, 'completed', '2025-01-29 22:49:58'),
  ('BODY_L-2db572520258', 'BODY_L-fac5819e35a9', '{"data": "seed"}'::jsonb, true, 151, 436, 'approved', '2026-03-28 20:40:49'),
  ('BODY_L-2a3260fcdf94', 'BODY_L-617483a242de', '{"data": "seed"}'::jsonb, true, 265, 150, 'pending', '2026-03-13 11:31:16'),
  ('BODY_L-76e1b24db028', 'BODY_L-6caa916c482f', '{"data": "seed"}'::jsonb, true, 499, 531, 'approved', '2025-06-11 07:23:34'),
  ('BODY_L-35b962240528', 'BODY_L-aa0148e2899c', '{"data": "seed"}'::jsonb, true, 859, 653, 'completed', '2026-02-22 16:03:24'),
  ('BODY_L-8992aee0c91e', 'BODY_L-e279465cc202', '{"data": "seed"}'::jsonb, true, 299, 582, 'completed', '2025-02-25 01:13:40')
ON CONFLICT DO NOTHING;


-- ─── bundle_split_configs ───
INSERT INTO "bundle_split_configs" ("chunk", "routes", "sizeKB", "loadTimeMs", "preloadHint", "status", "createdAt") VALUES
  ('BUNDLE-45cd8096d735', 292, 719, 680, 'BUNDLE-79ca72270581', 'processing', '2025-09-13 06:36:35'),
  ('BUNDLE-94d3f46bc6a6', 186, 958, 551, 'BUNDLE-d0aaffbc931b', 'approved', '2025-04-06 11:23:21'),
  ('BUNDLE-60507ad97c12', 593, 909, 55, 'BUNDLE-69e16dfe54b0', 'approved', '2025-07-07 18:00:19'),
  ('BUNDLE-e9be15f75bbc', 558, 849, 256, 'BUNDLE-7302cbee0758', 'active', '2025-06-09 22:47:17'),
  ('BUNDLE-a6c1014fc9cd', 409, 58, 45, 'BUNDLE-4b1329b6e74d', 'processing', '2025-06-07 18:53:23'),
  ('BUNDLE-27ef2cdf6f4b', 740, 672, 152, 'BUNDLE-57c434d790ca', 'completed', '2025-07-14 13:48:23'),
  ('BUNDLE-5a8ffbe32c7a', 998, 607, 940, 'BUNDLE-b341597e70b6', 'active', '2025-10-05 12:28:22'),
  ('BUNDLE-5162705a6545', 769, 559, 966, 'BUNDLE-7ee908b1aca5', 'completed', '2025-11-30 19:02:19')
ON CONFLICT DO NOTHING;


-- ─── bureau_checks ───
INSERT INTO "bureau_checks" ("customerId", "bureau", "creditScore", "riskGrade", "activeLoans", "defaultHistory", "checkedAt") VALUES
  ('CUST-7f046fa25002', 'BUREAU-8f9028741166', 9, 'critical', 459, 620, '2025-01-15 06:19:01'),
  ('CUST-dfe923345a8e', 'BUREAU-3daaf4f1205a', 70, 'critical', 548, 496, '2025-01-06 19:45:40'),
  ('CUST-cedc6b2348cc', 'BUREAU-ed92f1a76f44', 54, 'low', 854, 955, '2025-01-03 10:44:29'),
  ('CUST-9caa163c9bf1', 'BUREAU-2d9be5c68133', 27, 'high', 815, 177, '2026-01-19 15:09:04'),
  ('CUST-e487aff7bb2d', 'BUREAU-88580a3085a0', 98, 'critical', 128, 899, '2025-12-22 19:38:48'),
  ('CUST-abfe198e08d1', 'BUREAU-513e88838769', 43, 'critical', 76, 613, '2025-06-01 23:53:11'),
  ('CUST-db82ff28bc4b', 'BUREAU-64911d62e267', 55, 'low', 191, 466, '2025-08-15 04:19:27'),
  ('CUST-42d4896fc8e7', 'BUREAU-19576efcffc8', 70, 'high', 917, 311, '2026-03-16 01:07:42')
ON CONFLICT DO NOTHING;


-- ─── cache_invalidations ───
INSERT INTO "cache_invalidations" ("channel", "subscribers", "invalidations24h", "pattern", "status", "createdAt") VALUES
  ('branch', 582, 424, 'CACHE_-76c924ec6e0a', 'active', '2025-09-26 16:53:37'),
  ('voice', 230, 466, 'CACHE_-20c0a6cf456f', 'completed', '2025-07-26 00:53:52'),
  ('whatsapp', 961, 653, 'CACHE_-a27e916d63c5', 'active', '2025-12-09 05:59:19'),
  ('branch', 441, 940, 'CACHE_-4cc22d1ae458', 'pending', '2026-03-11 08:35:44'),
  ('voice', 733, 570, 'CACHE_-894ef2f507e3', 'approved', '2026-04-12 11:46:50'),
  ('pos', 959, 811, 'CACHE_-0d30222d43a7', 'active', '2026-01-30 04:44:15'),
  ('whatsapp', 893, 35, 'CACHE_-0c2b174b9309', 'approved', '2025-01-11 00:07:44'),
  ('whatsapp', 177, 510, 'CACHE_-0746dbff6073', 'completed', '2025-04-20 08:36:04')
ON CONFLICT DO NOTHING;


-- ─── card_batches ───
INSERT INTO "card_batches" ("batchId", "batchSize", "cardType", "generatedBy", "status", "cardsIssued", "cardsUsed", "cardsRevoked", "branchCode", "expiresAt", "createdAt") VALUES
  ('BATC-f941669aa8c5', 256, 'standard', 'CARD_B-e03da25e30f7', 'active', 321, 617, 162, 'CARD_B-4eda33a2caf2', '2025-01-21 02:55:40', '2025-02-04 05:08:39'),
  ('BATC-9efc8d472d12', 676, 'full', 'CARD_B-2edc9d6f1191', 'approved', 178, 383, 196, 'CARD_B-914dd13a23f9', '2026-04-04 17:01:17', '2025-01-04 09:25:35'),
  ('BATC-82b36a5dd3cc', 21, 'basic', 'CARD_B-061ed6145057', 'processing', 469, 674, 86, 'CARD_B-ef7da075701c', '2025-07-03 18:13:50', '2025-11-23 04:15:02'),
  ('BATC-68394a3a0b12', 903, 'full', 'CARD_B-a0b3f76b4c26', 'completed', 22, 757, 354, 'CARD_B-d3f0173a46dc', '2025-03-28 05:46:37', '2025-02-01 14:56:15'),
  ('BATC-566f68966e4c', 778, 'enhanced', 'CARD_B-4ff33fc2ce21', 'pending', 631, 801, 475, 'CARD_B-36af93952dba', '2025-09-05 18:37:14', '2025-12-16 06:19:19'),
  ('BATC-59603a17f337', 660, 'standard', 'CARD_B-11125826c53d', 'active', 955, 555, 824, 'CARD_B-b100df20453b', '2025-05-24 14:31:09', '2025-02-27 09:43:57'),
  ('BATC-b7767cd211c3', 817, 'enhanced', 'CARD_B-594d4ee44f0f', 'approved', 546, 290, 248, 'CARD_B-ddccc14cdcb8', '2025-05-13 00:04:18', '2025-10-04 22:54:06'),
  ('BATC-ace54e4ea4bb', 641, 'full', 'CARD_B-38d4cef2a7ed', 'pending', 415, 32, 732, 'CARD_B-f861e39d0cb5', '2025-07-04 03:05:34', '2025-09-01 08:02:52')
ON CONFLICT DO NOTHING;


-- ─── cbn_agri_returns ───
INSERT INTO "cbn_agri_returns" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-f2e41738b48e', 'Kunle Jimoh', 'finance', 'Kunle Jimoh - Lekki - Cbn Agri Returns', 'approved', 652706.58, 'Lagos', 'REF-97289F0533', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2026-04-07 08:43:04', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-62e622e7bbae', 'Nneka Yakubu', 'operations', 'Nneka Yakubu - Lekki - Cbn Agri Returns', 'approved', 1622850.8, 'Oyo', 'REF-D9A1D6C48C', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2025-10-30 22:41:34', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-66ccf6b82194', 'Babajide Kalu', 'risk', 'Babajide Kalu - Lekki - Cbn Agri Returns', 'active', 7554217.08, 'Ogun', 'REF-0CE81D96E2', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2025-01-24 21:29:51', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-b2a7d2c41d82', 'Esther Hassan', 'finance', 'Esther Hassan - Kano - Cbn Agri Returns', 'completed', 8801592.84, 'Abuja FCT', 'REF-9916D7DA3F', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2025-01-08 16:49:44', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-ba2eefe06017', 'Patience Hassan', 'lending', 'Patience Hassan - Garki - Cbn Agri Returns', 'active', 250322.24, 'Edo', 'REF-4576D49064', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2026-05-03 21:50:42', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-e6d627ee979b', 'Gbenga Okafor', 'technology', 'Gbenga Okafor - Maitama - Cbn Agri Returns', 'pending', 1343521.13, 'Osun', 'REF-BDF0836CB1', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2025-04-14 12:43:06', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-386e53cdd296', 'Kemi Hassan', 'technology', 'Kemi Hassan - Garki - Cbn Agri Returns', 'pending', 3824403.52, 'Osun', 'REF-AC3941C5D6', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2026-03-07 09:18:40', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f380e30f0412', 'Jide Otedola', 'risk', 'Jide Otedola - Ibadan - Cbn Agri Returns', 'approved', 7923177.94, 'Edo', 'REF-013C9E59A1', '{"source": "seed", "table": "cbn_agri_returns"}'::jsonb, '2026-01-16 03:56:38', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cbn_agsmeis ───
INSERT INTO "cbn_agsmeis" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-b5e167ec3c33', 'Segun Chukwu', 'compliance', 'Segun Chukwu - Zaria - Cbn Agsmeis', 'completed', 5181952.62, 'Borno', 'REF-AA249ECB21', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-12-23 16:53:25', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-5dc6121cab1b', 'Titilayo Adenuga', 'finance', 'Titilayo Adenuga - Wuse - Cbn Agsmeis', 'processing', 8350916.09, 'Ogun', 'REF-5A84B851D4', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-02-21 07:50:43', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-aeada75b6526', 'Hassan Nwosu', 'finance', 'Hassan Nwosu - Garki - Cbn Agsmeis', 'approved', 6217484.43, 'Imo', 'REF-DEF7EB3BDD', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-07-21 06:56:02', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-6138a1a1a4d8', 'Emeka Mohammed', 'risk', 'Emeka Mohammed - Garki - Cbn Agsmeis', 'active', 5370501.09, 'Enugu', 'REF-79179B40E7', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-02-16 09:46:34', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7fc3b201e44c', 'Uzo Usman', 'risk', 'Uzo Usman - Victoria Island - Cbn Agsmeis', 'completed', 5927191.9, 'Abuja FCT', 'REF-B01D041F66', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-04-06 23:48:50', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-0ea87ba3c5d0', 'Gbenga Fashola', 'compliance', 'Gbenga Fashola - Awka - Cbn Agsmeis', 'active', 6993694.62, 'Ogun', 'REF-4C588770B9', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2026-03-10 09:58:27', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-b9eb813d354a', 'Jumoke Yakubu', 'lending', 'Jumoke Yakubu - Lekki - Cbn Agsmeis', 'pending', 5906514.12, 'Imo', 'REF-29029C2B7F', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2025-03-16 19:55:05', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-04dedb199cf3', 'Nneka Chukwu', 'technology', 'Nneka Chukwu - Ibadan - Cbn Agsmeis', 'approved', 3298778.68, 'Kaduna', 'REF-02F854FACF', '{"source": "seed", "table": "cbn_agsmeis"}'::jsonb, '2026-02-25 06:23:12', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cbn_anchor_borrowers ───
INSERT INTO "cbn_anchor_borrowers" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-050e75fdf8a8', 'Patience Kalu', 'risk', 'Patience Kalu - Maitama - Cbn Anchor Borrowers', 'processing', 4191429.32, 'Edo', 'REF-A9E0E3712B', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-05-27 10:09:13', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2cae6e3c9726', 'Grace Igwe', 'finance', 'Grace Igwe - Zaria - Cbn Anchor Borrowers', 'pending', 7572939.84, 'Oyo', 'REF-F18861FAFE', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-05-02 06:54:59', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-c2606a6bea92', 'Lanre Hassan', 'compliance', 'Lanre Hassan - Kano - Cbn Anchor Borrowers', 'pending', 2687344.47, 'Rivers', 'REF-3AAE17618D', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-08-16 10:16:51', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-9f941214066e', 'Chidinma Chukwu', 'compliance', 'Chidinma Chukwu - Warri - Cbn Anchor Borrowers', 'pending', 4426787.75, 'Kaduna', 'REF-BD0ABF705B', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-01-05 00:02:03', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-78fd08ffc8e6', 'Tunde Okafor', 'compliance', 'Tunde Okafor - Kano - Cbn Anchor Borrowers', 'completed', 5845345.57, 'Kaduna', 'REF-AC9E00BBDC', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-05-25 06:31:13', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-1a1205722597', 'Grace Danladi', 'risk', 'Grace Danladi - Port Harcourt - Cbn Anchor Borrowers', 'pending', 6916225.24, 'Plateau', 'REF-F5298D734C', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2026-04-30 20:44:58', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-031dd5a9e51c', 'Grace Mohammed', 'lending', 'Grace Mohammed - Ibadan - Cbn Anchor Borrowers', 'completed', 5032087.3, 'Cross River', 'REF-3C8E41B777', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-08-03 08:09:32', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-79eccab7147c', 'Femi Igwe', 'compliance', 'Femi Igwe - Garki - Cbn Anchor Borrowers', 'pending', 6291027.63, 'Osun', 'REF-E85A11B17C', '{"source": "seed", "table": "cbn_anchor_borrowers"}'::jsonb, '2025-10-11 08:22:59', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cbn_compliance_checks ───
INSERT INTO "cbn_compliance_checks" ("circular", "title", "category", "totalControls", "passing", "failing", "lastAssessed", "nextAssessment", "status", "createdAt") VALUES
  ('CBN_CO-960b1dff024a', 'CBN_CO-a987ab954108', 'general', 602, 660, 344, '2025-01-14 16:00:40', '2025-03-09 20:59:55', 'approved', '2026-03-02 12:24:55'),
  ('CBN_CO-e2f9b55e4dcb', 'CBN_CO-b184d32bcb35', 'technology', 4741, 110, 596, '2025-04-16 00:01:03', '2025-04-29 23:43:54', 'approved', '2026-05-04 13:21:08'),
  ('CBN_CO-7a8b4ef262b0', 'CBN_CO-e83986c250a2', 'general', 8427, 210, 978, '2025-08-23 02:41:30', '2026-03-05 07:40:52', 'processing', '2025-06-12 20:10:29'),
  ('CBN_CO-767173b40956', 'CBN_CO-50daa04db9f6', 'compliance', 1110, 629, 877, '2025-12-24 20:33:13', '2025-05-14 15:29:57', 'completed', '2025-03-03 04:56:24'),
  ('CBN_CO-cfccd48e1488', 'CBN_CO-17f20fccd949', 'general', 9837, 307, 441, '2025-08-24 05:03:54', '2025-09-06 15:39:08', 'approved', '2025-09-10 16:06:28'),
  ('CBN_CO-0169eca8f2a8', 'CBN_CO-f99a1331ca51', 'compliance', 9759, 45, 516, '2025-04-22 05:10:14', '2025-07-02 05:28:23', 'pending', '2025-09-28 22:57:30'),
  ('CBN_CO-2a8b7edab693', 'CBN_CO-90e922dea8e9', 'technology', 7896, 742, 803, '2025-06-26 02:09:54', '2025-08-24 00:10:34', 'active', '2025-12-23 23:37:34'),
  ('CBN_CO-0a90efdeda57', 'CBN_CO-748c7d2e2cab', 'general', 8817, 757, 804, '2026-01-27 02:38:44', '2025-06-25 04:11:57', 'processing', '2025-03-06 20:33:18')
ON CONFLICT DO NOTHING;


-- ─── cdn_edge_configs ───
INSERT INTO "cdn_edge_configs" ("provider", "origin", "ttlStatic", "ttlApi", "brotliEnabled", "bandwidthSaved24h", "status", "createdAt") VALUES
  ('Prembly', 'CDN_ED-989614b21b5c', 643, 81, true, 'CDN_ED-d81e07af0622', 'active', '2025-11-09 03:24:11'),
  ('NIMC', 'CDN_ED-2ce11ef2be45', 863, 962, true, 'CDN_ED-ed66a7ce340f', 'active', '2026-04-17 06:55:46'),
  ('Youverify', 'CDN_ED-dcff419ea712', 819, 617, false, 'CDN_ED-94306412ce73', 'completed', '2025-05-23 05:56:08'),
  ('Youverify', 'CDN_ED-48c5ad0db305', 306, 839, true, 'CDN_ED-4d9ac23433cc', 'processing', '2025-11-22 08:09:10'),
  ('Prembly', 'CDN_ED-2c0657370713', 923, 392, true, 'CDN_ED-934790621aca', 'pending', '2025-07-29 12:31:33'),
  ('Smile Identity', 'CDN_ED-4ee04d3d39ce', 839, 556, true, 'CDN_ED-1239f4789420', 'active', '2026-03-16 17:29:41'),
  ('Dojah', 'CDN_ED-c97e16252ca0', 237, 724, true, 'CDN_ED-e79ee81823e9', 'approved', '2025-01-18 22:53:23'),
  ('NIMC', 'CDN_ED-f0212f95fafd', 628, 484, false, 'CDN_ED-905493bd7d4b', 'active', '2025-02-22 09:41:58')
ON CONFLICT DO NOTHING;


-- ─── certificates ───
INSERT INTO "certificates" ("certId", "commonName", "certType", "algorithm", "issuer", "serialNumber", "status", "validFrom", "validTo", "renewalDays", "lastRenewed", "revokedAt", "revocationReason", "createdAt") VALUES
  ('CERT-a9e28eed1611', 'CERTIF-40eaa55a16c8', 'standard', 'CERTIF-41b56be68e8b', 'CERTIF-a9dbb66156ce', 'CERTIF-0ca2000defa3', 'approved', '2026-02-15 12:06:34', '2025-10-29 15:06:36', 264, '2025-01-25 06:08:30', '2025-07-14 01:48:42', 'CERTIF-14016a5122df', '2025-06-13 15:34:05'),
  ('CERT-519131e5f62f', 'CERTIF-0a6e1641e413', 'basic', 'CERTIF-3a17955fb2e6', 'CERTIF-b869d441d69a', 'CERTIF-bc79102c85ba', 'active', '2025-12-09 16:57:35', '2025-12-31 17:17:31', 218, '2026-02-03 06:35:46', '2025-05-22 12:02:48', 'CERTIF-ec3c3ba9bd5f', '2025-11-08 04:12:49'),
  ('CERT-89fc81d83687', 'CERTIF-7048a4ca708c', 'basic', 'CERTIF-1c7078e5f579', 'CERTIF-889061aaf50b', 'CERTIF-0d4deb229792', 'processing', '2026-04-27 00:04:11', '2026-03-08 20:12:21', 354, '2025-11-03 19:54:58', '2026-04-29 11:21:10', 'CERTIF-a2f207bd1257', '2025-04-13 17:08:09'),
  ('CERT-f389d2cba07c', 'CERTIF-c5ffe81135de', 'basic', 'CERTIF-a106ed31cd9e', 'CERTIF-9f14976f043c', 'CERTIF-df08cefa092a', 'approved', '2025-12-10 05:12:04', '2025-02-08 07:53:42', 1, '2026-02-07 01:20:25', '2025-03-09 18:14:33', 'CERTIF-eff1c563a546', '2026-01-12 12:41:08'),
  ('CERT-214f4f8acbcf', 'CERTIF-c057b94c2874', 'full', 'CERTIF-c2a85039646f', 'CERTIF-1d38f276e489', 'CERTIF-ee613ef3fc68', 'processing', '2025-09-26 23:00:46', '2025-04-17 08:31:07', 207, '2025-11-15 10:13:36', '2025-04-20 00:27:44', 'CERTIF-3ef74fcadea9', '2026-02-01 19:05:42'),
  ('CERT-ba4f264cf93e', 'CERTIF-ab0430777966', 'standard', 'CERTIF-d51556f6267f', 'CERTIF-b80ecc950883', 'CERTIF-d89cc71a6416', 'completed', '2026-04-04 21:20:29', '2025-05-17 22:45:47', 26, '2025-08-03 04:04:59', '2025-01-10 14:27:35', 'CERTIF-c6dbc81946ad', '2025-07-16 06:48:33'),
  ('CERT-2c1e6b041ad3', 'CERTIF-2a89251c263e', 'basic', 'CERTIF-508b5fe5d374', 'CERTIF-c9f5214bf484', 'CERTIF-63a9e6f870bf', 'approved', '2026-01-13 17:06:05', '2025-12-21 03:48:03', 293, '2025-12-30 06:00:41', '2025-09-12 21:37:56', 'CERTIF-c31de2a52b66', '2025-11-03 16:11:08'),
  ('CERT-93f5cc6dc320', 'CERTIF-80e55c72fd8b', 'enhanced', 'CERTIF-eca63e8da447', 'CERTIF-b2877b42a342', 'CERTIF-c74bebfbbc44', 'approved', '2025-12-20 19:57:52', '2026-03-25 17:32:42', 156, '2025-11-28 05:56:04', '2025-05-10 15:21:38', 'CERTIF-1689d3e6a7f6', '2025-06-24 06:44:13')
ON CONFLICT DO NOTHING;


-- ─── chatbot_intents ───
INSERT INTO "chatbot_intents" ("tenantId", "intent", "category", "responses", "channel", "language", "status", "createdAt") VALUES
  ('tenant-abuja-digital', 'CHATBO-16cf8e15d657', 'compliance', 248, 'whatsapp', 'CHATBO-9791f02cbeb7', 'active', '2025-04-08 13:18:14'),
  ('tenant-kano-north', 'CHATBO-8f97f2bca4a2', 'finance', 540, 'branch', 'CHATBO-4717bfa355b4', 'pending', '2025-06-06 05:15:37'),
  ('tenant-portharcourt', 'CHATBO-a9baa20429b4', 'compliance', 6, 'mobile', 'CHATBO-6fbc597d8c37', 'approved', '2026-01-28 18:36:34'),
  ('tenant-abuja-digital', 'CHATBO-f7340bbe88d1', 'general', 611, 'voice', 'CHATBO-27a43d3f0c92', 'completed', '2025-11-29 22:48:05'),
  ('tenant-portharcourt', 'CHATBO-71a927b52caa', 'technology', 798, 'web', 'CHATBO-7be901c9b23e', 'approved', '2025-08-08 17:03:18'),
  ('tenant-portharcourt', 'CHATBO-c0c1ee47b956', 'technology', 590, 'pos', 'CHATBO-a0867d9bd7da', 'completed', '2026-05-04 02:39:59'),
  ('tenant-portharcourt', 'CHATBO-21f7ed47f704', 'finance', 925, 'mobile', 'CHATBO-5e73f560ee9e', 'pending', '2025-12-31 08:04:21'),
  ('tenant-portharcourt', 'CHATBO-c56631b4db2a', 'operations', 977, 'pos', 'CHATBO-e516ecb522c8', 'processing', '2025-03-30 09:37:10')
ON CONFLICT DO NOTHING;


-- ─── coalescing_rules ───
INSERT INTO "coalescing_rules" ("route", "windowMs", "savingsRatio", "status", "createdAt") VALUES
  ('COALES-15ee136299b0', 931, 'COALES-6bf5865df4db', 'active', '2025-10-30 04:56:42'),
  ('COALES-e2eefd6b3f73', 797, 'COALES-25b190d4800f', 'processing', '2026-04-18 14:24:57'),
  ('COALES-6777f6e7f2cf', 317, 'COALES-9e5b52557a22', 'pending', '2026-04-29 14:22:44'),
  ('COALES-a3fb0d483c14', 151, 'COALES-41fe415d9607', 'completed', '2026-04-11 22:00:27'),
  ('COALES-c06a9bfd2052', 105, 'COALES-c1698a5420ac', 'processing', '2025-12-12 00:13:42'),
  ('COALES-881d41a83e7b', 807, 'COALES-ed7032ffbd32', 'processing', '2025-04-30 10:10:58'),
  ('COALES-9fb247c290f5', 564, 'COALES-6cb1a6d7e3a9', 'processing', '2025-01-09 08:10:20'),
  ('COALES-8e278bb040a8', 38, 'COALES-2d3fe940883e', 'processing', '2025-03-30 04:35:37')
ON CONFLICT DO NOTHING;


-- ─── commodity_exchange ───
INSERT INTO "commodity_exchange" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-027d6450e2b1', 'Adaeze Adenuga', 'operations', 'Adaeze Adenuga - Kano - Commodity Exchange', 'pending', 600842.33, 'Kwara', 'REF-440841EB32', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2025-01-31 18:26:04', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-dbbc6650f52e', 'Jide Dangote', 'lending', 'Jide Dangote - Zaria - Commodity Exchange', 'processing', 2932022.85, 'Oyo', 'REF-EA8521272E', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2026-01-03 07:17:56', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-302a56b83789', 'Uche Okafor', 'payments', 'Uche Okafor - Warri - Commodity Exchange', 'processing', 6818081.19, 'Edo', 'REF-D0723E35FA', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2025-08-15 14:17:46', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f38cd02ca055', 'Hauwa Elumelu', 'technology', 'Hauwa Elumelu - Kano - Commodity Exchange', 'processing', 8716352.64, 'Cross River', 'REF-9F8DDD3920', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2026-04-25 22:04:57', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-bdf73ccc11ca', 'Nnamdi Chukwu', 'finance', 'Nnamdi Chukwu - Kano - Commodity Exchange', 'processing', 8098626.32, 'Lagos', 'REF-288D240B92', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2025-10-24 09:29:32', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-904c80da2e95', 'Fatima Mohammed', 'operations', 'Fatima Mohammed - Abeokuta - Commodity Exchange', 'active', 1310698.6, 'Plateau', 'REF-D5F5FA1160', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2025-03-10 13:56:42', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-153497e6bf1f', 'Kunle Eze', 'operations', 'Kunle Eze - Zaria - Commodity Exchange', 'processing', 441269.54, 'Plateau', 'REF-8B823B0560', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2026-01-28 23:42:44', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-b771c54554cf', 'Adewale Peterside', 'finance', 'Adewale Peterside - Lekki - Commodity Exchange', 'processing', 5496710.75, 'Akwa Ibom', 'REF-01F7E42D4B', '{"source": "seed", "table": "commodity_exchange"}'::jsonb, '2026-03-21 11:36:39', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── commodity_price_intelligence ───
INSERT INTO "commodity_price_intelligence" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-dc6ceeba9723', 'Pelumi Danladi', 'operations', 'Pelumi Danladi - Maitama - Commodity Price Intelligence', 'completed', 2176606.42, 'Kaduna', 'REF-2C8639628C', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2026-03-01 12:52:18', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-bb1f25dae067', 'Lanre Eze', 'payments', 'Lanre Eze - Abeokuta - Commodity Price Intelligence', 'active', 9692369.28, 'Osun', 'REF-344B118887', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-04-10 15:10:16', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-a9358aaf2d6b', 'Patience Sanusi', 'payments', 'Patience Sanusi - Victoria Island - Commodity Price Intelligence', 'pending', 9221335.62, 'Edo', 'REF-5EF811FA0F', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-10-13 20:05:21', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-8a2a39779190', 'Nneka Mohammed', 'finance', 'Nneka Mohammed - Ikeja - Commodity Price Intelligence', 'approved', 9939984.41, 'Akwa Ibom', 'REF-777258D6E1', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-04-28 22:08:45', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-62e3ee9f84e1', 'Jide Otedola', 'technology', 'Jide Otedola - Lekki - Commodity Price Intelligence', 'processing', 6990875.64, 'Lagos', 'REF-CDEF08E400', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-01-07 19:48:59', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-08f4ddd9e36d', 'Rahma Fashola', 'finance', 'Rahma Fashola - Awka - Commodity Price Intelligence', 'completed', 4645914.82, 'Plateau', 'REF-8B567AD137', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-10-16 16:25:49', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-e8b4006d6bf1', 'Adaeze Garba', 'finance', 'Adaeze Garba - Wuse - Commodity Price Intelligence', 'active', 7946360.15, 'Plateau', 'REF-92E1932B4F', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2025-03-14 09:13:34', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-44efba1c90b4', 'Kunle Chukwu', 'risk', 'Kunle Chukwu - Abeokuta - Commodity Price Intelligence', 'processing', 7155290.49, 'Imo', 'REF-CF487D12D9', '{"source": "seed", "table": "commodity_price_intelligence"}'::jsonb, '2026-02-26 11:42:35', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── compression_configs ───
INSERT INTO "compression_configs" ("algorithm", "level", "minBytes", "compressionRatio", "bandwidthSaved24h", "status", "createdAt") VALUES
  ('COMPRE-ce523da76472', 17, 602, 'COMPRE-b69867ec9981', 'COMPRE-df7a456a04be', 'approved', '2025-02-25 05:43:57'),
  ('COMPRE-43c59cb14b66', 847, 273, 'COMPRE-ae5612945f23', 'COMPRE-4077e09ab547', 'completed', '2026-02-02 22:40:41'),
  ('COMPRE-04a90e80688d', 528, 399, 'COMPRE-255e6ba4daa1', 'COMPRE-f2e4d559f19c', 'pending', '2026-01-05 10:23:56'),
  ('COMPRE-2a67c445f357', 60, 303, 'COMPRE-12141e03917e', 'COMPRE-c9f3822f9575', 'active', '2026-02-16 08:34:29'),
  ('COMPRE-fbb15daa66c2', 978, 134, 'COMPRE-565fd83b9efc', 'COMPRE-597876f6bcfd', 'pending', '2025-11-20 11:15:54'),
  ('COMPRE-04b19c1ac0ab', 789, 288, 'COMPRE-b5c8631537a9', 'COMPRE-0f640e7ea8ef', 'processing', '2025-11-24 13:28:38'),
  ('COMPRE-08db3cd7b49e', 778, 682, 'COMPRE-372bc6421c6e', 'COMPRE-ed37c462e104', 'pending', '2025-06-19 03:31:32'),
  ('COMPRE-489459f24f43', 328, 762, 'COMPRE-31ec91db413e', 'COMPRE-05ced31bae8a', 'pending', '2025-09-12 17:28:09')
ON CONFLICT DO NOTHING;


-- ─── cooperative_credit_scoring ───
INSERT INTO "cooperative_credit_scoring" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-369fd6b6ae72', 'Dorcas Adeyemi', 'operations', 'Dorcas Adeyemi - Victoria Island - Cooperative Credit Scoring', 'processing', 8296759.07, 'Cross River', 'REF-50BCBE2A79', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2026-03-05 19:54:32', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-41ba349f4acd', 'Uzo Garba', 'risk', 'Uzo Garba - Maitama - Cooperative Credit Scoring', 'pending', 1765999.21, 'Kano', 'REF-BC373E3D88', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-05-22 02:59:57', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-1e07a6d2a69e', 'Nneka Okafor', 'compliance', 'Nneka Okafor - Abeokuta - Cooperative Credit Scoring', 'processing', 4685355.48, 'Edo', 'REF-EFEFDB7017', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-03-03 15:41:29', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-ad1fab453576', 'Rasheed Adeyemi', 'compliance', 'Rasheed Adeyemi - Lekki - Cooperative Credit Scoring', 'processing', 9294726.84, 'Plateau', 'REF-E9E297F33B', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-11-24 09:26:09', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-dedc651896f2', 'Adewale Chukwu', 'operations', 'Adewale Chukwu - Maitama - Cooperative Credit Scoring', 'completed', 9575676.02, 'Enugu', 'REF-53D5DA1250', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-01-23 17:46:29', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9066a1b5c4e0', 'Kunle Eze', 'technology', 'Kunle Eze - Warri - Cooperative Credit Scoring', 'completed', 774741.97, 'Abuja FCT', 'REF-BEB69B04ED', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-01-31 17:42:23', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a5e7cb27716e', 'Ibrahim Mohammed', 'risk', 'Ibrahim Mohammed - Zaria - Cooperative Credit Scoring', 'approved', 3741507.0, 'Plateau', 'REF-A5C191D4A2', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-10-28 21:09:32', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-1655ac9dd2fd', 'Bukola Fashola', 'payments', 'Bukola Fashola - Zaria - Cooperative Credit Scoring', 'active', 5100866.13, 'Plateau', 'REF-2159B80833', '{"source": "seed", "table": "cooperative_credit_scoring"}'::jsonb, '2025-09-21 15:22:16', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cooperative_financials ───
INSERT INTO "cooperative_financials" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-37a34d7faf05', 'Nneka Yakubu', 'finance', 'Nneka Yakubu - Wuse - Cooperative Financials', 'completed', 9453991.87, 'Imo', 'REF-1CCB44E3CC', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-08-12 22:04:57', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-15d15751c674', 'Jumoke Eze', 'lending', 'Jumoke Eze - Enugu - Cooperative Financials', 'approved', 3375418.47, 'Kaduna', 'REF-8DF255FABD', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-12-10 15:58:24', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-2e1848045dd1', 'Jide Adenuga', 'compliance', 'Jide Adenuga - Lekki - Cooperative Financials', 'completed', 5591643.56, 'Ogun', 'REF-EE372BEB32', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-07-18 22:29:13', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-9bc3d99bbb0a', 'Nneka Taiwo', 'finance', 'Nneka Taiwo - Ibadan - Cooperative Financials', 'pending', 618389.02, 'Rivers', 'REF-F075334188', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-11-05 14:13:39', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-77ef9e56350b', 'Gbenga Yakubu', 'payments', 'Gbenga Yakubu - Port Harcourt - Cooperative Financials', 'processing', 1849098.14, 'Akwa Ibom', 'REF-92F94D468A', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-08-21 22:50:07', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-5f414f1fa35d', 'Jumoke Mohammed', 'payments', 'Jumoke Mohammed - Ibadan - Cooperative Financials', 'approved', 8514099.03, 'Abuja FCT', 'REF-5209C708A1', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2026-04-18 00:47:52', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-d4571b989bb2', 'Hassan Nwosu', 'technology', 'Hassan Nwosu - Ikeja - Cooperative Financials', 'pending', 2117115.56, 'Kano', 'REF-27D1EC701B', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-01-14 20:46:20', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f35ad017bdd6', 'Chidinma Balogun', 'operations', 'Chidinma Balogun - Asaba - Cooperative Financials', 'completed', 3114295.25, 'Delta', 'REF-4D5601995E', '{"source": "seed", "table": "cooperative_financials"}'::jsonb, '2025-07-11 15:42:23', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cooperative_management ───
INSERT INTO "cooperative_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-36ba5e583038', 'Pelumi Okafor', 'compliance', 'Pelumi Okafor - Abeokuta - Cooperative Management', 'processing', 4693043.61, 'Enugu', 'REF-FC71E9E43C', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-03-23 12:38:20', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-ab75fc114c66', 'Chidinma Nwosu', 'operations', 'Chidinma Nwosu - Ikeja - Cooperative Management', 'pending', 4806135.64, 'Akwa Ibom', 'REF-3D62E08D05', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-05-06 07:52:00', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-a458fbe706f2', 'Musa Nwosu', 'payments', 'Musa Nwosu - Warri - Cooperative Management', 'pending', 8371986.89, 'Akwa Ibom', 'REF-CD1527089E', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2026-03-16 20:57:38', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-cd5d2e7f9dd8', 'Patience Fashola', 'risk', 'Patience Fashola - Enugu - Cooperative Management', 'active', 2308266.28, 'Cross River', 'REF-06DB78AF46', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-06-22 04:54:49', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-e2aaf0891340', 'Tunde Elumelu', 'operations', 'Tunde Elumelu - Asaba - Cooperative Management', 'active', 6173534.93, 'Imo', 'REF-2D404881F2', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-04-08 19:43:16', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-b9f4ba0dbe19', 'Musa Nwosu', 'operations', 'Musa Nwosu - Asaba - Cooperative Management', 'completed', 9877879.76, 'Ogun', 'REF-C2365FF6A3', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-12-31 00:36:21', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-a807277bc76a', 'Ibrahim Danladi', 'payments', 'Ibrahim Danladi - Abeokuta - Cooperative Management', 'processing', 1285084.01, 'Ogun', 'REF-3D527416A5', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2025-10-18 01:03:55', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-11ac68835ff8', 'Nneka Garba', 'payments', 'Nneka Garba - Wuse - Cooperative Management', 'approved', 5447342.52, 'Lagos', 'REF-34F74376C4', '{"source": "seed", "table": "cooperative_management"}'::jsonb, '2026-02-09 22:50:16', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── cooperative_meetings ───
INSERT INTO "cooperative_meetings" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-18dfb48c500f', 'Rasheed Mohammed', 'operations', 'Rasheed Mohammed - Awka - Cooperative Meetings', 'active', 5478800.7, 'Oyo', 'REF-22E787B6C1', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-10-08 11:48:39', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-ff4c0ae8a914', 'Adaeze Lawal', 'technology', 'Adaeze Lawal - Ikeja - Cooperative Meetings', 'approved', 178022.32, 'Ogun', 'REF-942F557A80', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-08-11 08:25:31', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-64c83d8ee245', 'Kunle Chukwu', 'payments', 'Kunle Chukwu - Wuse - Cooperative Meetings', 'approved', 9435177.69, 'Imo', 'REF-10A8B233A6', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-06-02 01:25:41', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-7aa0fe1e5f83', 'Emeka Nwosu', 'technology', 'Emeka Nwosu - Port Harcourt - Cooperative Meetings', 'active', 3470118.0, 'Kaduna', 'REF-8C3CBFD9F5', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-01-30 06:00:18', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-49e6ae500de3', 'Ifeoma Lawal', 'compliance', 'Ifeoma Lawal - Maitama - Cooperative Meetings', 'processing', 7390000.66, 'Kaduna', 'REF-4B1D1A6462', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-06-13 04:19:41', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-32a49d2e9bc0', 'Hassan Peterside', 'finance', 'Hassan Peterside - Port Harcourt - Cooperative Meetings', 'approved', 1671741.52, 'Rivers', 'REF-05A7112D66', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-10-15 20:58:18', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-24fc55c61f52', 'Femi Fashola', 'lending', 'Femi Fashola - Port Harcourt - Cooperative Meetings', 'active', 8388156.92, 'Kaduna', 'REF-3B0B311E94', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-01-26 21:18:20', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-6e84f15fb147', 'Adaeze Nwosu', 'technology', 'Adaeze Nwosu - Benin City - Cooperative Meetings', 'pending', 8426142.25, 'Cross River', 'REF-3FAC318801', '{"source": "seed", "table": "cooperative_meetings"}'::jsonb, '2025-11-15 13:10:13', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── corporate_monitoring_events ───
INSERT INTO "corporate_monitoring_events" ("companyId", "eventType", "description", "riskImpact", "sourceSystem", "detectedAt", "acknowledgedAt") VALUES
  ('COMP-dad89dc8c3c5', 'basic', 'Patience Nwosu - Lekki, Enugu - corporate_monitoring_events record', 'low', 'CORPOR-84d2eabb96d5', '2025-02-25 17:54:44', '2025-01-09 07:57:55'),
  ('COMP-e8f9182d43fc', 'standard', 'Chukwuemeka Adeyemi - Ikeja, Kaduna - corporate_monitoring_events record', 'medium', 'CORPOR-0295ae5036ee', '2026-04-04 12:06:11', '2026-01-04 19:55:57'),
  ('COMP-5a796749bb57', 'standard', 'Dorcas Danladi - Warri, Enugu - corporate_monitoring_events record', 'low', 'CORPOR-7a7ece6b7de1', '2025-12-17 06:40:48', '2025-04-01 11:29:59'),
  ('COMP-3c653c917683', 'enhanced', 'Oluchi Adeyemi - Wuse, Kwara - corporate_monitoring_events record', 'low', 'CORPOR-a2f0739822db', '2026-04-13 01:48:50', '2025-03-14 22:59:34'),
  ('COMP-3829007859fa', 'enhanced', 'Grace Igwe - Wuse, Kano - corporate_monitoring_events record', 'critical', 'CORPOR-544176ba80a1', '2025-06-17 05:59:53', '2025-06-03 21:16:40'),
  ('COMP-a947b1a7adbd', 'full', 'Babajide Igwe - Asaba, Delta - corporate_monitoring_events record', 'high', 'CORPOR-9a2ca05bb2c7', '2025-08-15 13:37:44', '2025-08-13 00:18:33'),
  ('COMP-71c76a492030', 'full', 'Rahma Danladi - Ikeja, Borno - corporate_monitoring_events record', 'critical', 'CORPOR-70a685a9edb9', '2026-01-23 13:58:06', '2025-10-05 05:53:10'),
  ('COMP-b09c2a1cd362', 'basic', 'Kemi Fashola - Asaba, Kaduna - corporate_monitoring_events record', 'low', 'CORPOR-f52c819fc282', '2026-02-21 16:27:03', '2025-02-01 10:49:47')
ON CONFLICT DO NOTHING;


-- ─── correlation_rules ───
INSERT INTO "correlation_rules" ("name", "mitreIds", "killChainPhase", "triggerEvents", "correlationWindow", "triggered24h", "truePositives", "falsePositives", "status", "createdAt") VALUES
  ('Adewale Adenuga', '{"data": "seed"}'::jsonb, 'CORREL-25c65041489f', '{"data": "seed"}'::jsonb, 'CORREL-689635e0efae', 374, 89, 725, 'processing', '2026-04-08 19:38:53'),
  ('Grace Kalu', '{"data": "seed"}'::jsonb, 'CORREL-3f13919ac0de', '{"data": "seed"}'::jsonb, 'CORREL-81f7b09c531a', 734, 483, 741, 'completed', '2025-03-08 15:23:23'),
  ('Ifeoma Elumelu', '{"data": "seed"}'::jsonb, 'CORREL-d033029c3a4b', '{"data": "seed"}'::jsonb, 'CORREL-437c0199b572', 469, 861, 267, 'pending', '2025-05-18 14:13:49'),
  ('Musa Jimoh', '{"data": "seed"}'::jsonb, 'CORREL-1bbcb5efc654', '{"data": "seed"}'::jsonb, 'CORREL-8f06ff1244ca', 260, 682, 735, 'pending', '2026-05-07 10:36:02'),
  ('Chidinma Jimoh', '{"data": "seed"}'::jsonb, 'CORREL-9f7ed8dcc779', '{"data": "seed"}'::jsonb, 'CORREL-e79307babf20', 865, 179, 742, 'approved', '2026-04-25 14:25:57'),
  ('Segun Taiwo', '{"data": "seed"}'::jsonb, 'CORREL-1fcc2b9a054b', '{"data": "seed"}'::jsonb, 'CORREL-98579d77597d', 223, 495, 378, 'completed', '2025-04-06 06:07:16'),
  ('Jumoke Hassan', '{"data": "seed"}'::jsonb, 'CORREL-d48ebc66c777', '{"data": "seed"}'::jsonb, 'CORREL-4b89bac982f4', 101, 611, 811, 'processing', '2025-10-11 14:09:18'),
  ('Oluchi Nwosu', '{"data": "seed"}'::jsonb, 'CORREL-9669ea6ce70a', '{"data": "seed"}'::jsonb, 'CORREL-eadcd71f8677', 329, 636, 919, 'processing', '2025-08-06 08:06:03')
ON CONFLICT DO NOTHING;


-- ─── cropInsurancePolicies ───
INSERT INTO "cropInsurancePolicies" ("policyId", "tenantId", "farmerId", "policyType", "cropCovered", "coverageAreaHectares", "sumInsured", "premiumAmount", "premiumFrequency", "policyStart", "policyEnd", "weatherTrigger", "claims", "status", "underwriter", "createdAt", "updatedAt") VALUES
  ('POLI-14d824eca0de', 'tenant-lagos-main', 'FARM-7b5716264580', 'premium', 'CROPIN-928cc462f1c9', 237.2, 49160588.35, 6021597.14, 'CROPIN-fae91bfbce13', 'CROPIN-fc0b2c0dad28', 'CROPIN-63b18af242c2', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'processing', 'CROPIN-82604a374e37', '2025-11-01 16:14:32', '2026-03-22 02:56:11'),
  ('POLI-981ff548c455', 'tenant-whitelabel-zenith', 'FARM-052ed0920747', 'basic', 'CROPIN-d7ea55d569bd', 396.82, 14164230.45, 14846203.46, 'CROPIN-17f4ce048d9a', 'CROPIN-c1f86e72eb49', 'CROPIN-ce16244bebb5', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'approved', 'CROPIN-eea02a0a060e', '2026-01-12 17:09:13', '2026-03-29 13:57:33'),
  ('POLI-70cdc6d02eaf', 'tenant-whitelabel-zenith', 'FARM-ee331918b398', 'full', 'CROPIN-ef7e465bc85d', 222.14, 49287793.94, 29154785.35, 'CROPIN-06ed52f4239b', 'CROPIN-a2b95ce89517', 'CROPIN-c35ba208957a', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'processing', 'CROPIN-3d90f188fb60', '2025-09-18 23:50:45', '2025-10-27 12:08:28'),
  ('POLI-d6278dfc39e7', 'tenant-lagos-main', 'FARM-a029954b97a8', 'premium', 'CROPIN-16c823e027d5', 227.59, 3645662.28, 11199604.9, 'CROPIN-f6edd8a5ce9c', 'CROPIN-9b62f7ee55f5', 'CROPIN-771a0809e23b', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'pending', 'CROPIN-e3e75a88c5ba', '2025-09-06 00:46:46', '2025-06-25 03:04:24'),
  ('POLI-e9d859d14a26', 'tenant-kano-north', 'FARM-eaee9a6ae0f4', 'standard', 'CROPIN-7141ec880037', 304.54, 12627828.69, 27571206.39, 'CROPIN-9af6a15ab7c5', 'CROPIN-9c61ed1d8d60', 'CROPIN-d9628904a47a', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'pending', 'CROPIN-d20d42f26838', '2025-02-05 11:19:17', '2025-12-07 00:47:46'),
  ('POLI-485a2cafa8b0', 'tenant-kano-north', 'FARM-5e592c0eb2c7', 'standard', 'CROPIN-7308c0f273cb', 359.36, 14652746.13, 30014262.31, 'CROPIN-fce753561e8c', 'CROPIN-119ec297fc6b', 'CROPIN-ebe2cd678576', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'approved', 'CROPIN-6a602f9fad7b', '2025-08-19 12:55:43', '2025-01-15 23:10:29'),
  ('POLI-d062b3790792', 'tenant-whitelabel-zenith', 'FARM-9f697aefb851', 'full', 'CROPIN-766e7139ceba', 360.08, 48488858.82, 35336232.22, 'CROPIN-266271526cf3', 'CROPIN-99513bdc985a', 'CROPIN-e1e893652e36', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'pending', 'CROPIN-35510a58b835', '2025-11-06 02:33:34', '2025-06-18 03:05:42'),
  ('POLI-49556d62adf0', 'tenant-kano-north', 'FARM-657fe38f17ff', 'full', 'CROPIN-f4b7523741e6', 103.82, 6382224.96, 5454839.07, 'CROPIN-48f8439a9420', 'CROPIN-1750498eb783', 'CROPIN-e9c1f84ae1a6', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'completed', 'CROPIN-a64b6ef80479', '2026-04-14 12:11:00', '2025-06-16 15:28:08')
ON CONFLICT DO NOTHING;


-- ─── crop_yield_prediction ───
INSERT INTO "crop_yield_prediction" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-c6d2a4324605', 'Oluchi Usman', 'payments', 'Oluchi Usman - Zaria - Crop Yield Prediction', 'pending', 6148030.54, 'Plateau', 'REF-E3B4DC70C9', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2026-02-22 11:56:24', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-779ca1f457c8', 'Damilola Taiwo', 'technology', 'Damilola Taiwo - Enugu - Crop Yield Prediction', 'completed', 5849866.71, 'Enugu', 'REF-BF566E5EEB', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-04-24 03:51:26', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-c4a79a41bb65', 'Lilian Chukwu', 'compliance', 'Lilian Chukwu - Enugu - Crop Yield Prediction', 'completed', 7237827.87, 'Borno', 'REF-36C5A3A23B', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-08-29 18:12:49', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-778233a1d5df', 'Patience Taiwo', 'risk', 'Patience Taiwo - Abeokuta - Crop Yield Prediction', 'pending', 7828246.79, 'Anambra', 'REF-39EC1E04F0', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-04-29 12:58:19', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9e79b15d3b98', 'Lanre Lawal', 'finance', 'Lanre Lawal - Kano - Crop Yield Prediction', 'active', 8994902.82, 'Akwa Ibom', 'REF-CAF47E9B02', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-10-05 07:15:02', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-1a6dab4118a1', 'Uche Dangote', 'risk', 'Uche Dangote - Warri - Crop Yield Prediction', 'processing', 3059344.24, 'Anambra', 'REF-089D6C8A16', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-10-30 03:16:53', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-3552842833b0', 'Rasheed Taiwo', 'lending', 'Rasheed Taiwo - Warri - Crop Yield Prediction', 'processing', 6577743.08, 'Rivers', 'REF-EF0EEDB119', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2025-06-02 12:21:36', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-29ca70b77703', 'Jide Chukwu', 'lending', 'Jide Chukwu - Maitama - Crop Yield Prediction', 'completed', 1845231.84, 'Lagos', 'REF-F97C19050A', '{"source": "seed", "table": "crop_yield_prediction"}'::jsonb, '2026-02-28 09:52:45', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── crossborder_agri_trade ───
INSERT INTO "crossborder_agri_trade" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-40dcf95b19b0', 'Oluchi Adeyemi', 'technology', 'Oluchi Adeyemi - Awka - Crossborder Agri Trade', 'pending', 1403358.6, 'Kano', 'REF-F35D4156A0', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-02-08 18:40:48', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-718c3e0abe73', 'Dorcas Adeyemi', 'compliance', 'Dorcas Adeyemi - Port Harcourt - Crossborder Agri Trade', 'approved', 9260062.01, 'Lagos', 'REF-62FC263227', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-04-28 20:35:55', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-0e18c1716f53', 'Nneka Chukwu', 'technology', 'Nneka Chukwu - Kano - Crossborder Agri Trade', 'approved', 8590820.61, 'Rivers', 'REF-9ECF8EBFD7', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-09-01 07:22:07', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-a35764976f0d', 'Olumide Balogun', 'finance', 'Olumide Balogun - Ikeja - Crossborder Agri Trade', 'active', 2332957.15, 'Edo', 'REF-D8B5B5EA0D', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-06-25 03:50:09', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-4ce603af6d3a', 'Nneka Adeyemi', 'technology', 'Nneka Adeyemi - Victoria Island - Crossborder Agri Trade', 'pending', 3174140.36, 'Delta', 'REF-D80801DA6D', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-06-29 14:23:11', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-5285ebc91acb', 'Pelumi Eze', 'compliance', 'Pelumi Eze - Asaba - Crossborder Agri Trade', 'active', 7624146.51, 'Kwara', 'REF-7D4D2E6901', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2026-01-19 12:02:52', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-7a302661b8e6', 'Esther Kalu', 'operations', 'Esther Kalu - Lekki - Crossborder Agri Trade', 'completed', 1373328.69, 'Imo', 'REF-DCBB222C2E', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-08-08 14:47:52', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-8e78882916d4', 'Tunde Hassan', 'risk', 'Tunde Hassan - Maitama - Crossborder Agri Trade', 'pending', 257424.8, 'Ogun', 'REF-2CC3D3A2BE', '{"source": "seed", "table": "crossborder_agri_trade"}'::jsonb, '2025-07-15 17:14:23', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── crypto_keys ───
INSERT INTO "crypto_keys" ("keyId", "name", "keyType", "algorithm", "purpose", "status", "keySizeBits", "rotationPeriodDays", "hsmSlot", "custodian1", "custodian2", "lastUsedAt", "expiresAt", "rotatedAt", "createdAt") VALUES
  ('KEYI-8db5aa95e0f5', 'Lanre Peterside', 'premium', 'CRYPTO-d1af56c38ad1', 'CRYPTO-a03ded37b313', 'processing', 647, 110, 'CRYPTO-b2d4f7d33dcc', 'CRYPTO-725eed574506', 'CRYPTO-c802e4a9f8c5', '2025-07-07 08:23:46', '2025-08-17 17:37:32', '2025-07-05 09:32:23', '2025-05-08 00:05:38'),
  ('KEYI-b3728c4bc3a0', 'Esther Lawal', 'standard', 'CRYPTO-b31da402cda4', 'CRYPTO-89f67e8e368d', 'completed', 772, 218, 'CRYPTO-137c41ab749b', 'CRYPTO-29e15b5ce137', 'CRYPTO-0bb3422c4966', '2025-08-02 15:51:08', '2025-05-12 10:55:46', '2025-11-24 01:44:52', '2026-01-12 02:53:57'),
  ('KEYI-7a1dad60df02', 'Babajide Peterside', 'standard', 'CRYPTO-c4d07b8bc4d7', 'CRYPTO-0fac829ef7b2', 'active', 920, 249, 'CRYPTO-a0744d8d6909', 'CRYPTO-f0236d5574ba', 'CRYPTO-70f27d1ad496', '2025-06-15 14:43:21', '2026-01-23 13:52:25', '2025-11-05 17:23:03', '2025-03-22 06:51:03'),
  ('KEYI-ad812ae7fcc6', 'Babajide Hassan', 'full', 'CRYPTO-5488ff3b74c3', 'CRYPTO-e5e909b70600', 'completed', 657, 130, 'CRYPTO-1aec900c150a', 'CRYPTO-a6bacc4fe9c9', 'CRYPTO-ee532bcedc8f', '2026-04-07 05:23:41', '2026-02-22 18:52:55', '2025-09-19 06:01:04', '2025-11-14 13:14:15'),
  ('KEYI-266495fee27f', 'Nnamdi Taiwo', 'standard', 'CRYPTO-5dcc14b8d4c0', 'CRYPTO-132b089b4d32', 'completed', 942, 146, 'CRYPTO-ffb35ea79f27', 'CRYPTO-346c3327e0d9', 'CRYPTO-808f9460e2ad', '2025-12-01 14:05:53', '2026-01-18 19:13:57', '2026-01-12 12:22:50', '2025-04-10 13:45:20'),
  ('KEYI-01aaaec58838', 'Musa Taiwo', 'standard', 'CRYPTO-6d0682bb2ab3', 'CRYPTO-7ff5cae11a7f', 'processing', 713, 154, 'CRYPTO-2ff43bcff326', 'CRYPTO-523b0c47aaad', 'CRYPTO-d4d00303de71', '2026-04-24 16:53:52', '2025-02-13 16:58:28', '2025-06-05 04:30:21', '2025-10-10 15:59:28'),
  ('KEYI-98da01a7dace', 'Gbenga Dangote', 'standard', 'CRYPTO-5f813884278d', 'CRYPTO-da806dff41cf', 'processing', 490, 174, 'CRYPTO-0fa3b5bbbc53', 'CRYPTO-72220d795bec', 'CRYPTO-db51b9a3fc53', '2025-01-28 14:23:24', '2025-03-14 07:25:09', '2025-11-19 11:17:49', '2025-07-08 12:55:12'),
  ('KEYI-1b1e2d4d22cb', 'Rasheed Kalu', 'enhanced', 'CRYPTO-16155ed588e4', 'CRYPTO-5f38b1f3757b', 'approved', 586, 258, 'CRYPTO-3f364479e6c1', 'CRYPTO-f8b62f34229a', 'CRYPTO-db4a841a5069', '2025-03-21 01:52:36', '2025-04-18 23:34:48', '2025-04-25 23:29:22', '2025-03-12 18:32:43')
ON CONFLICT DO NOTHING;


-- ─── csp_policies ───
INSERT INTO "csp_policies" ("domain", "directives", "reportUri", "violations24h", "uniqueSources", "status", "createdAt") VALUES
  ('CSP_PO-9224b08e5b22', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/5dd63d51', 415, 812, 'pending', '2026-04-24 05:19:10'),
  ('CSP_PO-0540b357db2c', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/0029dac2', 176, 672, 'approved', '2025-05-18 13:08:07'),
  ('CSP_PO-602c3a12bd23', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/492a3b7a', 938, 840, 'processing', '2026-03-03 03:25:27'),
  ('CSP_PO-c850864a629a', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/b51a03a2', 629, 908, 'approved', '2026-02-25 07:56:52'),
  ('CSP_PO-14a6e63bf387', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/00d43953', 417, 953, 'completed', '2025-08-18 12:42:14'),
  ('CSP_PO-c8b80591f8af', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/25d22d3b', 884, 473, 'completed', '2025-04-04 02:52:47'),
  ('CSP_PO-023d928ba905', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/20f8728d', 86, 527, 'processing', '2025-12-20 17:04:58'),
  ('CSP_PO-18ca84032e8d', '{"data": "seed"}'::jsonb, 'https://cdn.54bank.ng/csp_policies/b74b141b', 185, 518, 'active', '2025-08-05 19:20:34')
ON CONFLICT DO NOTHING;


-- ─── ctr_reports_aml ───
INSERT INTO "ctr_reports_aml" ("customerId", "customerName", "transactionId", "currency", "transactionType", "nfiuReference", "autoFiled", "status", "createdAt") VALUES
  ('CUST-75ce6e279ff3', 'Tunde Adeyemi', 'TRAN-c0a447d58a61', 'NGN', 'premium', 'REF-22FAA7708029', true, 'active', '2026-04-02 16:56:22'),
  ('CUST-4b735bca62fd', 'Dorcas Nwosu', 'TRAN-6761b36e1d34', 'USD', 'premium', 'REF-AF5B0FCFA15B', true, 'pending', '2026-01-27 00:51:17'),
  ('CUST-5be54ca4c052', 'Chukwuemeka Otedola', 'TRAN-e8455b3c5011', 'NGN', 'enhanced', 'REF-1E7D6516802E', true, 'approved', '2025-05-22 02:12:45'),
  ('CUST-61cd2bcfbb6e', 'Nnamdi Fashola', 'TRAN-d213f650e7f0', 'NGN', 'basic', 'REF-FE5041393F1E', true, 'processing', '2026-04-12 00:09:32'),
  ('CUST-11d7c68f93dc', 'Maryam Usman', 'TRAN-1db98f95f7ea', 'USD', 'full', 'REF-90771C11C080', true, 'pending', '2026-03-09 17:07:03'),
  ('CUST-0a67133cf822', 'Esther Sanusi', 'TRAN-e2319737dad9', 'NGN', 'premium', 'REF-BEB6FD6683EE', true, 'completed', '2026-01-30 05:05:23'),
  ('CUST-cb41be38fefd', 'Lanre Okafor', 'TRAN-fea852978908', 'NGN', 'full', 'REF-0850E16AE8F0', false, 'processing', '2025-07-14 17:08:34'),
  ('CUST-6eac14cbcc2f', 'Femi Jimoh', 'TRAN-d778ab806e1c', 'NGN', 'enhanced', 'REF-F71BF8AFBB5F', true, 'processing', '2026-01-31 00:53:50')
ON CONFLICT DO NOTHING;


-- ─── customerApprovals ───
INSERT INTO "customerApprovals" ("approvalId", "customerId", "entityType", "entityId", "title", "detail", "route", "state", "requestedAt", "requestedByRole", "requestedById", "approvalRole", "resolvedAt", "resolutionNote") VALUES
  ('APPR-a457b98e34ce', 'CUST-b45f07157026', 'basic', 'ENTI-a88eafb2cfd6', 'CUSTOM-0fd0fed9281a', 'Jide Jimoh - Maitama, Borno - customerApprovals record', 'CUSTOM-63ae7239fb23', 'Imo', '2026-03-21 17:21:46', 'CUSTOM-9379ceb5dc91', 'REQU-938cc18afde9', 'CUSTOM-cd6e1a1eb22b', '2026-02-22 18:01:47', 'CUSTOM-2c6b005f7ac6'),
  ('APPR-50ce780fb8de', 'CUST-c2955a69cceb', 'full', 'ENTI-a0d02d5eb1d2', 'CUSTOM-6640ee438fb0', 'Hauwa Elumelu - Victoria Island, Abuja FCT - customerApprovals record', 'CUSTOM-488ccf7413ed', 'Delta', '2025-11-18 14:51:16', 'CUSTOM-d8f9d6045d24', 'REQU-583835f1c473', 'CUSTOM-4624cbd4f85f', '2025-11-07 17:43:03', 'CUSTOM-7c79e3c8dd42'),
  ('APPR-a81c01a7a1b7', 'CUST-55b363d69eaa', 'enhanced', 'ENTI-36922456fb8e', 'CUSTOM-561e6114d50e', 'Titilayo Usman - Maitama, Enugu - customerApprovals record', 'CUSTOM-6d4f82029fd8', 'Borno', '2026-01-04 22:58:02', 'CUSTOM-621e24fa2e2e', 'REQU-11b7b3d2d943', 'CUSTOM-0c93a6254614', '2025-06-01 02:44:55', 'CUSTOM-855e3b985996'),
  ('APPR-73f918f63a44', 'CUST-edb93866aac5', 'enhanced', 'ENTI-f2b074bc41d0', 'CUSTOM-8c3b069e280f', 'Nnamdi Jimoh - Ibadan, Kaduna - customerApprovals record', 'CUSTOM-e29539366f64', 'Osun', '2026-01-31 08:21:35', 'CUSTOM-c95f8f98424d', 'REQU-634f28339136', 'CUSTOM-20a313a35713', '2025-08-24 14:47:41', 'CUSTOM-6d3039aadb9a'),
  ('APPR-d6af31b13b5b', 'CUST-581c6251cf69', 'enhanced', 'ENTI-a737956e69dc', 'CUSTOM-9c1162467474', 'Kunle Yakubu - Ibadan, Edo - customerApprovals record', 'CUSTOM-6561c90b0b13', 'Akwa Ibom', '2025-04-15 11:58:25', 'CUSTOM-88f9796b289d', 'REQU-fdf9e174d97e', 'CUSTOM-b7155c82e5bc', '2025-05-21 05:38:21', 'CUSTOM-a9fb5c512797'),
  ('APPR-c149a0c483c8', 'CUST-57fae620ea9d', 'premium', 'ENTI-0e4ee87600a6', 'CUSTOM-0a3039725f38', 'Jide Yakubu - Abeokuta, Osun - customerApprovals record', 'CUSTOM-0b04f4a761cc', 'Imo', '2026-03-31 13:23:01', 'CUSTOM-8dca16e82b29', 'REQU-48f19e7248ef', 'CUSTOM-55f5c5499f0d', '2025-08-10 18:38:46', 'CUSTOM-6fcaaa889897'),
  ('APPR-b09e8ebf0e76', 'CUST-1143e3d6fe56', 'full', 'ENTI-f491edcc66e5', 'CUSTOM-61cce1477581', 'Adewale Usman - Port Harcourt, Lagos - customerApprovals record', 'CUSTOM-4d0d374781f7', 'Oyo', '2026-03-20 10:58:15', 'CUSTOM-a0ff3f5fa67a', 'REQU-58a850f0e829', 'CUSTOM-6be2a2fd10bd', '2025-09-08 16:14:21', 'CUSTOM-c0ede2c9635a'),
  ('APPR-a68455a4a9ca', 'CUST-5c3bf7599ead', 'basic', 'ENTI-b3190afbcd25', 'CUSTOM-6b8416399401', 'Segun Sanusi - Enugu, Rivers - customerApprovals record', 'CUSTOM-0a783c1d2b4c', 'Delta', '2025-07-06 09:17:22', 'CUSTOM-49477bc6c500', 'REQU-33e28ee04e6f', 'CUSTOM-6144ba36a099', '2025-04-08 20:33:21', 'CUSTOM-666ad50e3adc')
ON CONFLICT DO NOTHING;


-- ─── customerCardEvents ───
INSERT INTO "customerCardEvents" ("eventId", "cardId", "customerId", "title", "detail", "severity", "createdAt") VALUES
  ('EVEN-e5762715cb39', 'CARD-c223674bc6e4', 'CUST-95183e44f45d', 'CUSTOM-6475d72f8442', 'Titilayo Otedola - Warri, Kaduna - customerCardEvents record', 'CUSTOM-bbcb5602d1a9', '2026-03-16 17:47:06'),
  ('EVEN-690ee3ab434c', 'CARD-5068ae605b5d', 'CUST-ab7739580cce', 'CUSTOM-01ffc220e64a', 'Lilian Usman - Garki, Kaduna - customerCardEvents record', 'CUSTOM-c180a758d887', '2026-03-14 15:14:58'),
  ('EVEN-e4164f51c330', 'CARD-72a821f53b8d', 'CUST-b82c7d0bd3f5', 'CUSTOM-ddb13ebf0d46', 'Chukwuemeka Lawal - Ikeja, Lagos - customerCardEvents record', 'CUSTOM-632b9e4c5e81', '2025-06-20 02:38:18'),
  ('EVEN-a402b535bcf2', 'CARD-581c8146fa50', 'CUST-4878bcb67ecd', 'CUSTOM-34278021e4fe', 'Rahma Okafor - Awka, Lagos - customerCardEvents record', 'CUSTOM-84c5841ad5fa', '2025-12-11 18:30:14'),
  ('EVEN-4e0938c2f9ae', 'CARD-0f84077df6f4', 'CUST-98df7cefaa6c', 'CUSTOM-1732e4481018', 'Chidinma Lawal - Abeokuta, Kano - customerCardEvents record', 'CUSTOM-8de2304e494d', '2025-12-21 21:33:52'),
  ('EVEN-29bc6b33e37c', 'CARD-68e7d2662204', 'CUST-417df33cf926', 'CUSTOM-e8155be6d785', 'Oluchi Adenuga - Enugu, Plateau - customerCardEvents record', 'CUSTOM-8e57c23cf4c0', '2025-09-19 17:37:19'),
  ('EVEN-b2a496cf3a75', 'CARD-89e66c025f07', 'CUST-b3434dab8010', 'CUSTOM-12377c100d19', 'Kunle Chukwu - Asaba, Plateau - customerCardEvents record', 'CUSTOM-8373af88e4d5', '2026-03-04 10:35:36'),
  ('EVEN-f811d08a5f90', 'CARD-51695b20cfc5', 'CUST-9436df17aa13', 'CUSTOM-fb9eadd42b1e', 'Fatima Igwe - Kano, Oyo - customerCardEvents record', 'CUSTOM-6b43f47d3907', '2025-09-12 09:45:08')
ON CONFLICT DO NOTHING;


-- ─── customerSavedBillers ───
INSERT INTO "customerSavedBillers" ("billerRecordId", "customerId", "category", "provider", "billerId", "customerReference", "nickname", "lastAmount", "verifiedName", "lastPaidAt", "createdAt") VALUES
  ('BILL-77b5270b2d13', 'CUST-9cfc5fb22e2c', 'finance', 'Smile Identity', 'BILL-ceda7a13d74a', 'REF-7D49A172F764', 'CUSTOM-e56b6914a5ed', 8886514.93, 'CUSTOM-a023d266528f', '2025-07-03 23:18:16', '2026-01-01 23:15:58'),
  ('BILL-4c8be276e3de', 'CUST-1d97efd09c03', 'finance', 'NIBSS', 'BILL-b3de87cde2d3', 'REF-21E000F472DC', 'CUSTOM-44a9daf5e364', 7194227.91, 'CUSTOM-1fd8303d795a', '2026-04-01 20:28:52', '2025-04-14 00:43:23'),
  ('BILL-ee67f17a596b', 'CUST-d70856a0e464', 'compliance', 'Smile Identity', 'BILL-00ae42eaea66', 'REF-F36C9559E2C2', 'CUSTOM-15141b3580fd', 2579565.72, 'CUSTOM-08bf41bd2d81', '2025-06-10 18:51:01', '2026-04-04 09:21:53'),
  ('BILL-555a4b2ca719', 'CUST-0db7d601e57b', 'technology', 'Smile Identity', 'BILL-942c6907b382', 'REF-B1B58632BBA9', 'CUSTOM-c98867354395', 7476399.17, 'CUSTOM-3e1b972494e6', '2025-04-02 13:35:20', '2025-02-28 22:07:17'),
  ('BILL-a61f8481c775', 'CUST-19b1676b218c', 'finance', 'Youverify', 'BILL-8c491b0eb131', 'REF-9D1671BDC8A3', 'CUSTOM-355f3ec7a341', 6971036.23, 'CUSTOM-2ba06d02e36b', '2026-02-16 09:12:43', '2025-05-18 19:24:54'),
  ('BILL-8413a70e3ed4', 'CUST-9d5db9d10053', 'compliance', 'Prembly', 'BILL-bc4c7be0ddf8', 'REF-B8AEF3CEE701', 'CUSTOM-5bda02dfe05d', 6892650.97, 'CUSTOM-bb944ec772d7', '2025-05-24 03:24:09', '2025-12-24 16:27:35'),
  ('BILL-50dc2dc9ef35', 'CUST-bcdec17264d2', 'operations', 'Smile Identity', 'BILL-7e8e85eae5f8', 'REF-5D4F9FB88AE3', 'CUSTOM-2d6cfea6b73e', 6150566.24, 'CUSTOM-32f392ae5d63', '2025-11-09 17:19:33', '2025-01-26 10:34:41'),
  ('BILL-9a4302122316', 'CUST-1e785ee72a51', 'compliance', 'NIBSS', 'BILL-0880b59d4d37', 'REF-2D9744C78EEB', 'CUSTOM-e3a4747fc75e', 1641759.99, 'CUSTOM-b6ea790e02fc', '2026-03-16 11:32:01', '2025-04-23 20:20:33')
ON CONFLICT DO NOTHING;


-- ─── customerSessionPreferences ───
INSERT INTO "customerSessionPreferences" ("actorId", "actorRole", "tenantId", "activeCustomerId", "createdAt", "updatedAt") VALUES
  ('ACTO-9613f0257f1a', 'credit', 'tenant-abuja-digital', 'ACTI-b98a2e3f0019', '2025-09-15 03:27:03', '2026-02-08 02:04:48'),
  ('ACTO-9c19a051df0f', 'auditor', 'tenant-kano-north', 'ACTI-c304264dd502', '2025-02-08 09:04:35', '2025-02-12 05:23:03'),
  ('ACTO-b2ca06fbbf64', 'operator', 'tenant-whitelabel-zenith', 'ACTI-407c3cc95d16', '2026-04-13 18:22:02', '2025-03-31 07:29:33'),
  ('ACTO-49fe013ffbca', 'compliance', 'tenant-kano-north', 'ACTI-a074bc71dc62', '2025-05-08 22:32:01', '2025-01-10 02:29:17'),
  ('ACTO-2efc307d7fba', 'credit', 'tenant-portharcourt', 'ACTI-bae7273da774', '2026-02-25 23:15:24', '2025-07-22 03:55:22'),
  ('ACTO-fbd24735e093', 'credit', 'tenant-whitelabel-zenith', 'ACTI-9eda6303b050', '2025-01-12 06:57:29', '2026-03-02 20:24:35'),
  ('ACTO-80eb65c85d26', 'credit', 'tenant-kano-north', 'ACTI-5a3a3106d7b1', '2026-01-05 19:29:12', '2025-04-06 04:15:11'),
  ('ACTO-a9ce75945ce6', 'auditor', 'tenant-lagos-main', 'ACTI-c9b49c2b55c9', '2025-04-14 02:44:29', '2025-10-12 09:59:52')
ON CONFLICT DO NOTHING;


-- ─── customerStatementExports ───
INSERT INTO "customerStatementExports" ("exportRequestId", "customerId", "exportJobId", "format", "rowCount", "title", "createdAt") VALUES
  ('EXPO-bdf7f6862669', 'CUST-be5f4c064610', 'EXPO-85350f107f8e', 'CUSTOM-b8266afb0735', 1025, 'CUSTOM-7e31ef1618cf', '2025-05-16 04:01:25'),
  ('EXPO-d065ea9d8aaa', 'CUST-dbed246eb3bd', 'EXPO-a0119897b575', 'CUSTOM-e0bf29019879', 9215, 'CUSTOM-7a2f6ca5f047', '2026-02-27 11:25:56'),
  ('EXPO-d4deea157e1a', 'CUST-82d8be57ac6d', 'EXPO-09f1a84a2414', 'CUSTOM-e0577b174978', 1347, 'CUSTOM-b9fe3f955950', '2025-10-16 14:05:29'),
  ('EXPO-aba19f2007c8', 'CUST-cabb10d0f544', 'EXPO-79661c27b114', 'CUSTOM-773f2334ff33', 1671, 'CUSTOM-ddfda97afa54', '2025-05-14 06:16:39'),
  ('EXPO-67f252136797', 'CUST-aafea62295d5', 'EXPO-248fae08948a', 'CUSTOM-d21c64735bc4', 4618, 'CUSTOM-d013e9209a4f', '2025-01-21 07:39:00'),
  ('EXPO-951aba84532c', 'CUST-8b1c536f3587', 'EXPO-3451a9f0bd98', 'CUSTOM-50824557df18', 3258, 'CUSTOM-da0883732850', '2025-06-10 05:53:52'),
  ('EXPO-27af911a029d', 'CUST-1351e428c684', 'EXPO-85825982e4c3', 'CUSTOM-a8f8bdeef8b4', 3054, 'CUSTOM-69e20ab5f673', '2025-01-05 05:32:21'),
  ('EXPO-67f638e57ce3', 'CUST-ff1957065bf2', 'EXPO-def65630a101', 'CUSTOM-20f2dd940d68', 6372, 'CUSTOM-9cad23901c32', '2026-02-23 16:51:40')
ON CONFLICT DO NOTHING;


-- ─── ddos_rules ───
INSERT INTO "ddos_rules" ("name", "layer", "threshold", "action", "mitigated24h", "falsePositives", "status", "createdAt") VALUES
  ('Maryam Mohammed', 'DDOS_R-a047f4c2fcea', 'DDOS_R-49af47a3249f', 'DDOS_R-618abde3937e', 727, 170, 'completed', '2026-03-13 00:43:52'),
  ('Musa Nwosu', 'DDOS_R-3589036bb8af', 'DDOS_R-6ea967f0d9d5', 'DDOS_R-61a95e7218ab', 619, 553, 'pending', '2025-09-19 06:15:00'),
  ('Titilayo Adenuga', 'DDOS_R-b289e103134c', 'DDOS_R-904a39bc53e8', 'DDOS_R-ef199508af3b', 839, 507, 'approved', '2025-05-27 18:43:17'),
  ('Patience Danladi', 'DDOS_R-3b987defa187', 'DDOS_R-51cc04bd7ac3', 'DDOS_R-031e1a96477b', 32, 21, 'processing', '2025-07-12 13:00:01'),
  ('Lanre Adenuga', 'DDOS_R-0cd07ce64bff', 'DDOS_R-15c862949195', 'DDOS_R-5f1b104e4274', 369, 780, 'processing', '2025-05-21 05:46:33'),
  ('Adaeze Igwe', 'DDOS_R-8b460c1d9496', 'DDOS_R-67785a062a83', 'DDOS_R-2ef72cf83ef1', 808, 626, 'pending', '2025-11-26 22:08:21'),
  ('Lilian Eze', 'DDOS_R-1d1ec6763eff', 'DDOS_R-42efa4e02d10', 'DDOS_R-de0f78c4121c', 756, 889, 'approved', '2025-02-01 17:00:33'),
  ('Chidinma Otedola', 'DDOS_R-995cb5201b19', 'DDOS_R-893c86af5477', 'DDOS_R-a29507152fb9', 548, 648, 'processing', '2025-07-19 23:28:46')
ON CONFLICT DO NOTHING;


-- ─── device_profiles ───
INSERT INTO "device_profiles" ("fingerprintHash", "userId", "deviceType", "browser", "os", "screenRes", "timezone", "trustScore", "sessionsCount", "status", "createdAt") VALUES
  ('DEVICE-53d2e7f0b289', 'USER-2a72f7026bb6', 'premium', 'DEVICE-3e7c31c192e2', 'DEVICE-6b3c57f9b846', 'DEVICE-6700cf9a9064', 'DEVICE-93265385ad91', 92, 8941, 'approved', '2026-03-03 18:22:48'),
  ('DEVICE-2cd5bed35171', 'USER-4259e98668bc', 'full', 'DEVICE-ea7535c329df', 'DEVICE-dc997cdfb91c', 'DEVICE-f0dc1307aedb', 'DEVICE-c17f895ef6af', 78, 2356, 'completed', '2025-01-17 10:01:37'),
  ('DEVICE-79a0640e6d09', 'USER-f0e225c65e09', 'standard', 'DEVICE-3fabcd3f1484', 'DEVICE-54a09349cc23', 'DEVICE-760fa1f2a25e', 'DEVICE-1957f16b9f2e', 68, 54, 'pending', '2025-11-03 21:55:37'),
  ('DEVICE-f2b547f273ce', 'USER-1662880ae3d9', 'enhanced', 'DEVICE-01e9ccb1492e', 'DEVICE-c7a1670c0271', 'DEVICE-8718c29d4d71', 'DEVICE-f17b04e78ff3', 42, 6484, 'processing', '2026-04-26 04:49:44'),
  ('DEVICE-3559a49cf13e', 'USER-06cf2e46f0af', 'standard', 'DEVICE-e8b28405a0c2', 'DEVICE-a07fa23f3d18', 'DEVICE-8091e35d2362', 'DEVICE-228ec45ae53d', 7, 9646, 'active', '2025-03-08 11:09:28'),
  ('DEVICE-ace8f40fb7ab', 'USER-63ed26b6f804', 'full', 'DEVICE-6b577001525e', 'DEVICE-9833e6778eb4', 'DEVICE-db6223aa5c3d', 'DEVICE-18fedb36a2e1', 6, 6646, 'active', '2025-05-13 21:45:27'),
  ('DEVICE-e52475de167c', 'USER-225d796c355e', 'standard', 'DEVICE-6a8e15860b3e', 'DEVICE-0b74899886a8', 'DEVICE-d1765a8c0f69', 'DEVICE-e826f56bda56', 19, 4061, 'active', '2025-04-10 16:21:15'),
  ('DEVICE-17232c70cf7f', 'USER-91953130b0d3', 'enhanced', 'DEVICE-94af8fb211ce', 'DEVICE-d42d3a0aa499', 'DEVICE-9f2744ec5a9b', 'DEVICE-c490d23f90cb', 67, 2272, 'pending', '2026-01-18 01:35:33')
ON CONFLICT DO NOTHING;


-- ─── distroless_images ───
INSERT INTO "distroless_images" ("service", "baseImage", "reductionPct", "status", "createdAt") VALUES
  ('DISTRO-6f69d644251d', 'DISTRO-aafc1ceeeba7', 'DISTRO-a26ecdc70041', 'pending', '2026-04-22 14:59:55'),
  ('DISTRO-2630e82b0bd6', 'DISTRO-263c5353ab8e', 'DISTRO-56fe5882881a', 'processing', '2025-11-11 05:23:45'),
  ('DISTRO-1d00764cb98f', 'DISTRO-0aecc30d9e6d', 'DISTRO-d55c5dda84df', 'completed', '2025-08-19 05:18:03'),
  ('DISTRO-25030caacbbb', 'DISTRO-0886b3c7b006', 'DISTRO-d4c2106f3893', 'processing', '2026-04-18 22:41:10'),
  ('DISTRO-aac7913baba0', 'DISTRO-a0771faa8e4c', 'DISTRO-392195c57cea', 'processing', '2026-03-13 23:23:48'),
  ('DISTRO-73f6a1dedaba', 'DISTRO-762e183d6c93', 'DISTRO-87d90adf5b2f', 'approved', '2025-01-18 09:01:39'),
  ('DISTRO-a24675ea6596', 'DISTRO-9c3be903e96f', 'DISTRO-e665b0246b58', 'approved', '2025-08-31 08:38:33'),
  ('DISTRO-25d7a9979d5c', 'DISTRO-033145112a56', 'DISTRO-408086958c52', 'active', '2025-10-26 07:57:26')
ON CONFLICT DO NOTHING;


-- ─── docker_hardening_checks ───
INSERT INTO "docker_hardening_checks" ("checkName", "category", "cisBenchmark", "passingContainers", "failingContainers", "totalContainers", "severity", "status", "createdAt") VALUES
  ('DOCKER-bccaa7f913a4', 'finance', 'DOCKER-f13e327119f8', 632, 980, 9331, 'DOCKER-34ff7154a44d', 'completed', '2025-11-02 04:42:46'),
  ('DOCKER-3aeafde6e837', 'finance', 'DOCKER-a538e42fbda9', 211, 177, 4113, 'DOCKER-b1a04f1a95aa', 'pending', '2025-01-25 15:50:41'),
  ('DOCKER-5afabbd83af5', 'technology', 'DOCKER-c5dc608d18e2', 370, 282, 8402, 'DOCKER-2dd25b0cf1e9', 'active', '2026-01-03 11:51:20'),
  ('DOCKER-40f5a8828ce2', 'technology', 'DOCKER-ca7461fd9248', 678, 565, 1305, 'DOCKER-73a42ab9f615', 'completed', '2025-01-16 10:52:14'),
  ('DOCKER-a180439d934c', 'compliance', 'DOCKER-c6db119335bb', 522, 342, 4926, 'DOCKER-389f69a6a43f', 'approved', '2025-04-15 02:43:47'),
  ('DOCKER-22564cf719b3', 'general', 'DOCKER-2adbc8603067', 888, 353, 1964, 'DOCKER-11658b729699', 'pending', '2025-04-23 04:22:43'),
  ('DOCKER-926eaeba54f8', 'technology', 'DOCKER-f74a370b2050', 46, 465, 4213, 'DOCKER-2700af666272', 'processing', '2026-01-22 07:37:50'),
  ('DOCKER-266ea814f699', 'operations', 'DOCKER-bfd68c2eb2ce', 811, 628, 7201, 'DOCKER-33284edb9be1', 'completed', '2025-06-28 01:15:15')
ON CONFLICT DO NOTHING;


-- ─── educationLoans ───
INSERT INTO "educationLoans" ("loanId", "tenantId", "studentId", "studentName", "institutionName", "programName", "loanAmount", "interestRate", "tenorMonths", "graceMonths", "emi", "totalDisbursed", "totalRepaid", "outstandingBalance", "cosignerName", "cosignerType", "status", "createdAt", "updatedAt") VALUES
  ('LOAN-5f8a1e98dadd', 'tenant-kano-north', 'STUD-827891f2d1e0', 'EDUCAT-690e729327da', 'EDUCAT-558fc4b0d995', 'EDUCAT-4bd7c9fd33f8', 9529092.77, 83.8416, 989, 358, 8509811.26, 9409235.75, 9518367.21, 14262847.61, 'EDUCAT-30628bae9f28', 'premium', 'completed', '2026-04-29 04:47:20', '2025-11-14 20:43:03'),
  ('LOAN-281d43f0e324', 'tenant-whitelabel-zenith', 'STUD-47fe9ce86925', 'EDUCAT-69e0760c95cb', 'EDUCAT-9fb3b0d216f3', 'EDUCAT-7123bad7e074', 9624986.75, 38.7379, 71, 738, 1685792.19, 5991714.0, 1961070.75, 7601601.85, 'EDUCAT-351dfab99861', 'standard', 'processing', '2025-08-25 06:04:32', '2025-03-31 20:10:11'),
  ('LOAN-caafe3beb155', 'tenant-kano-north', 'STUD-b8eb3bc1664a', 'EDUCAT-2d098586eb13', 'EDUCAT-452a28b62ff7', 'EDUCAT-a5c775ea72f8', 3783730.9, 87.8147, 947, 609, 1142825.05, 9826048.13, 5004617.34, 19199356.07, 'EDUCAT-0cf0093906f4', 'premium', 'approved', '2025-04-05 03:18:10', '2025-04-17 16:55:21'),
  ('LOAN-06f3e81da042', 'tenant-lagos-main', 'STUD-84ab9b77815b', 'EDUCAT-5556401f4c50', 'EDUCAT-a87d00210ae4', 'EDUCAT-fe715470eb0e', 6486037.57, 65.5006, 714, 604, 6822710.6, 8612292.58, 454736.83, 20453403.61, 'EDUCAT-638d0604ed4b', 'premium', 'pending', '2025-04-20 00:49:36', '2025-02-10 04:15:25'),
  ('LOAN-71c11050a23f', 'tenant-portharcourt', 'STUD-63a092b55fd0', 'EDUCAT-c7ded904ed39', 'EDUCAT-47e2c65224ae', 'EDUCAT-e8938f0ae312', 4384734.87, 82.4705, 861, 162, 538268.5, 229755.34, 5767677.92, 13307397.31, 'EDUCAT-fb755b5ccda8', 'full', 'pending', '2026-01-05 02:13:28', '2025-11-10 05:16:12'),
  ('LOAN-81ef6f69e04b', 'tenant-whitelabel-zenith', 'STUD-4e19a1d44551', 'EDUCAT-73671ed9ad39', 'EDUCAT-3f356ebcceee', 'EDUCAT-bcc3abc031ae', 7050522.56, 35.7803, 221, 320, 7066281.79, 1077604.36, 7581486.6, 17501308.59, 'EDUCAT-5a3b931f3205', 'premium', 'approved', '2025-11-12 20:51:15', '2025-05-12 01:12:30'),
  ('LOAN-6ae23efa4d65', 'tenant-abuja-digital', 'STUD-1c1f8a27bfd6', 'EDUCAT-0061f64b767a', 'EDUCAT-b4d193ec3820', 'EDUCAT-678cd010d8c6', 332410.36, 32.18, 467, 27, 6841842.63, 1166639.32, 589831.63, 4072543.85, 'EDUCAT-1fe49307321d', 'basic', 'completed', '2025-08-21 14:47:39', '2025-10-30 02:42:49'),
  ('LOAN-e8eca638eeb2', 'tenant-kano-north', 'STUD-0654b45dcaa9', 'EDUCAT-77a236ce9191', 'EDUCAT-10eb0f90cd47', 'EDUCAT-17b125b688f5', 9020072.83, 49.116, 715, 691, 4166697.61, 4173769.06, 8727837.99, 42106875.84, 'EDUCAT-1a5130ef5f00', 'full', 'active', '2025-02-14 03:33:37', '2025-09-06 14:02:56')
ON CONFLICT DO NOTHING;


-- ─── efassMapping ───
INSERT INTO "efassMapping" ("glCodeStart", "glCodeEnd", "mbrForm", "mbrLine", "lineName", "reportCategory", "aggregationType", "signConvention", "cbnCode", "notes", "createdAt") VALUES
  ('EFASSM-2e5bb36cc08c', 'EFASSM-bd2ed7f33925', 'EFASSM-3e0f0df2ea36', 185, 'EFASSM-c5602de69526', 'EFASSM-f639dac5a5ef', 'premium', 'EFASSM-7a0b4e2e0384', 'EFASSM-ed498fbb03ca', 'Musa Danladi - Ikeja, Osun - efassMapping record', '2025-07-14 22:59:08'),
  ('EFASSM-70d519b08e47', 'EFASSM-b62d6faf8310', 'EFASSM-65a29aacf9da', 80, 'EFASSM-689428cb521d', 'EFASSM-aa4c7a94585f', 'enhanced', 'EFASSM-8f781e1ea9ce', 'EFASSM-53b0e701f7d4', 'Maryam Fashola - Benin City, Kaduna - efassMapping record', '2025-11-06 15:49:33'),
  ('EFASSM-5b0fa8eeecba', 'EFASSM-a139720da538', 'EFASSM-19df60fdb1ca', 999, 'EFASSM-84c093513b5f', 'EFASSM-0265e0878eaf', 'full', 'EFASSM-6fc41e084e9d', 'EFASSM-60878fbfcb5a', 'Fatima Sanusi - Kano, Kano - efassMapping record', '2025-05-16 00:33:28'),
  ('EFASSM-ef51a6253c65', 'EFASSM-da1c6bba8e43', 'EFASSM-c793eacc59fc', 681, 'EFASSM-b7ff0c01a07e', 'EFASSM-b77bce8aee89', 'basic', 'EFASSM-3a1440a8fd13', 'EFASSM-18184afa0a48', 'Tunde Eze - Garki, Delta - efassMapping record', '2025-02-25 20:19:24'),
  ('EFASSM-f5728c49d59a', 'EFASSM-ff39a9fb4f53', 'EFASSM-d2d35ab32071', 641, 'EFASSM-cb2ddacfe87e', 'EFASSM-4f8631731111', 'full', 'EFASSM-88f35975f0db', 'EFASSM-0607f657766f', 'Damilola Eze - Asaba, Edo - efassMapping record', '2025-01-14 10:53:46'),
  ('EFASSM-18cf4a20a64d', 'EFASSM-00e097070f4b', 'EFASSM-3a67bf123deb', 525, 'EFASSM-efce9f326e8a', 'EFASSM-a5939e4975f9', 'basic', 'EFASSM-c080808dcc26', 'EFASSM-b27b032a761c', 'Oluchi Yakubu - Enugu, Abuja FCT - efassMapping record', '2026-01-10 21:59:41'),
  ('EFASSM-1ffcdf07751b', 'EFASSM-3acbc80a3324', 'EFASSM-8165a1735ca6', 671, 'EFASSM-20dc27c3c67e', 'EFASSM-5bf5e0a35852', 'premium', 'EFASSM-caefff006844', 'EFASSM-bb283cdd565c', 'Ibrahim Taiwo - Lekki, Lagos - efassMapping record', '2026-04-16 19:34:17'),
  ('EFASSM-8fe9f79d1385', 'EFASSM-f32504e4ca2f', 'EFASSM-f505690d5fbe', 753, 'EFASSM-233a48106a2c', 'EFASSM-1fae1e449c53', 'basic', 'EFASSM-caf0844b309f', 'EFASSM-adaab241d2e1', 'Patience Usman - Wuse, Abuja FCT - efassMapping record', '2026-01-14 17:35:24')
ON CONFLICT DO NOTHING;


-- ─── efass_returns ───
INSERT INTO "efass_returns" ("period", "type", "tier1Count", "tier2Count", "tier3Count", "totalCustomers", "status", "submittedAt", "createdAt") VALUES
  ('2025-04', 'standard', 1703, 3489, 1271, 5510, 'approved', '2025-09-17 11:02:18', '2025-05-12 23:48:21'),
  ('2025-06', 'premium', 4868, 7226, 2779, 1056, 'approved', '2025-09-18 03:00:48', '2025-01-16 19:05:16'),
  ('2025-07', 'basic', 3939, 580, 6176, 6251, 'active', '2025-10-13 05:02:46', '2025-01-22 02:03:16'),
  ('2025-08', 'standard', 6783, 9624, 6165, 8235, 'active', '2025-03-09 08:20:40', '2026-01-26 05:04:50'),
  ('2025-05', 'full', 6784, 8510, 9204, 3706, 'active', '2025-11-02 15:33:05', '2025-03-16 22:01:07'),
  ('2025-10', 'standard', 5139, 3604, 5577, 2608, 'pending', '2026-03-17 12:27:50', '2026-04-13 22:34:02'),
  ('2025-10', 'full', 9455, 4482, 70, 5687, 'completed', '2025-10-23 14:28:00', '2026-04-19 01:22:41'),
  ('2025-10', 'enhanced', 7985, 8897, 8375, 4897, 'pending', '2025-04-06 15:49:31', '2025-08-05 12:32:05')
ON CONFLICT DO NOTHING;


-- ─── egress_policies ───
INSERT INTO "egress_policies" ("name", "domains", "ports", "protocol", "allowed", "blocked24h", "status", "createdAt") VALUES
  ('Lanre Lawal', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-b34c6ad82fe7', false, 555, 'approved', '2025-05-26 14:05:15'),
  ('Pelumi Kalu', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-5ca483fca7ec', true, 751, 'processing', '2026-01-06 13:51:49'),
  ('Emeka Elumelu', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-b6a4a06f2e47', false, 501, 'active', '2025-09-21 09:06:54'),
  ('Jide Usman', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-dba03f82439f', true, 756, 'approved', '2026-04-05 23:09:27'),
  ('Lilian Adenuga', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-f444439d4274', true, 856, 'completed', '2026-03-27 09:58:55'),
  ('Femi Sanusi', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-f8837e3e3698', true, 82, 'approved', '2026-05-08 14:22:16'),
  ('Femi Igwe', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-9cf0e68bcf6a', true, 347, 'active', '2026-02-26 21:07:02'),
  ('Jumoke Nwosu', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'EGRESS-4c3006b1fd14', true, 953, 'approved', '2025-09-14 21:25:52')
ON CONFLICT DO NOTHING;


-- ─── equipment_leasing ───
INSERT INTO "equipment_leasing" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-4994cfd5c744', 'Titilayo Dangote', 'operations', 'Titilayo Dangote - Wuse - Equipment Leasing', 'active', 514326.75, 'Anambra', 'REF-74BA2A2C54', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-10-21 11:00:50', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-56bda0abbed6', 'Rahma Hassan', 'technology', 'Rahma Hassan - Ibadan - Equipment Leasing', 'processing', 593023.81, 'Kaduna', 'REF-40CBECDE00', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-01-07 17:19:13', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-18bb86890d5f', 'Lanre Igwe', 'risk', 'Lanre Igwe - Warri - Equipment Leasing', 'completed', 5341756.6, 'Lagos', 'REF-1D85E5070B', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-08-26 15:25:11', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-35f4d110ba9d', 'Dorcas Usman', 'payments', 'Dorcas Usman - Maitama - Equipment Leasing', 'processing', 8857572.01, 'Ogun', 'REF-83C5ABDB9D', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-02-12 01:45:49', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7cabbbe2ab3e', 'Jumoke Chukwu', 'finance', 'Jumoke Chukwu - Victoria Island - Equipment Leasing', 'pending', 7826653.49, 'Ogun', 'REF-BAA7D1777E', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-03-15 09:06:24', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-5c3eed5cd9bf', 'Chukwuemeka Lawal', 'risk', 'Chukwuemeka Lawal - Awka - Equipment Leasing', 'approved', 9137062.06, 'Borno', 'REF-DE14CFC9C8', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-09-08 11:50:48', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-9468ecae805f', 'Adaeze Okafor', 'lending', 'Adaeze Okafor - Benin City - Equipment Leasing', 'processing', 7866692.95, 'Borno', 'REF-CB1C2FC35E', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2026-03-11 09:07:14', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-42bf38f51922', 'Uche Chukwu', 'technology', 'Uche Chukwu - Wuse - Equipment Leasing', 'active', 8687306.54, 'Edo', 'REF-151025EB4E', '{"source": "seed", "table": "equipment_leasing"}'::jsonb, '2025-02-03 02:17:31', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── erpnextSyncJobs ───
INSERT INTO "erpnextSyncJobs" ("jobId", "tenantId", "syncType", "direction", "status", "recordsProcessed", "recordsFailed", "recordsSkipped", "retryCount", "startedAt", "completedAt", "errorMessage", "createdAt", "updatedAt") VALUES
  ('JOBI-8b5696013f80', 'tenant-abuja-digital', 'basic', 'ERPNEX-ecfeb9668574', 'completed', 480, 464, 69, 7007, '2025-04-22 20:16:30', '2026-03-21 07:20:34', 'ERPNEX-dab9917137bf', '2026-04-29 15:53:51', '2026-04-27 17:50:41'),
  ('JOBI-61787283369a', 'tenant-whitelabel-zenith', 'standard', 'ERPNEX-aaa1d88e31fb', 'processing', 953, 2, 95, 9628, '2025-01-18 15:44:23', '2025-08-27 06:18:00', 'ERPNEX-d6a07c6a23bd', '2025-09-01 11:11:22', '2026-03-04 14:43:05'),
  ('JOBI-8e64eae943e6', 'tenant-portharcourt', 'full', 'ERPNEX-3b22347dce3c', 'pending', 916, 173, 97, 7742, '2026-03-31 06:49:43', '2026-04-14 17:53:36', 'ERPNEX-5d066a60ed78', '2026-02-08 20:12:03', '2025-09-12 00:37:12'),
  ('JOBI-790b964a92cd', 'tenant-lagos-main', 'standard', 'ERPNEX-9092964cc684', 'active', 107, 591, 392, 2511, '2025-02-05 13:57:43', '2025-06-07 05:11:23', 'ERPNEX-7106c0308a0d', '2026-04-04 22:29:24', '2025-11-20 22:33:32'),
  ('JOBI-6b7ec3e0a711', 'tenant-abuja-digital', 'full', 'ERPNEX-a9d77f48f349', 'approved', 578, 251, 304, 5930, '2025-03-08 20:04:27', '2025-02-14 16:05:12', 'ERPNEX-ca873f7c0b73', '2025-06-10 01:17:23', '2025-11-13 02:16:00'),
  ('JOBI-1b849c15d71d', 'tenant-kano-north', 'premium', 'ERPNEX-a1137b44757f', 'active', 815, 626, 944, 3419, '2026-01-03 14:35:37', '2025-09-18 00:59:22', 'ERPNEX-483d65321253', '2026-04-06 02:18:05', '2026-03-30 14:39:49'),
  ('JOBI-da7bef6f4bbc', 'tenant-whitelabel-zenith', 'basic', 'ERPNEX-41205f9f474b', 'processing', 833, 673, 383, 1005, '2026-03-12 22:52:07', '2025-03-08 09:42:03', 'ERPNEX-e9c322b4194d', '2025-09-17 07:24:16', '2025-02-02 23:12:14'),
  ('JOBI-b472b5ac004e', 'tenant-lagos-main', 'enhanced', 'ERPNEX-ab551c4ddfe9', 'pending', 460, 272, 44, 4214, '2025-11-29 00:35:22', '2025-12-29 13:17:43', 'ERPNEX-96cc6a0e5b9f', '2025-11-26 22:04:44', '2025-08-25 12:34:43')
ON CONFLICT DO NOTHING;


-- ─── escrow_audit_log ───
INSERT INTO "escrow_audit_log" ("auditId", "escrowId", "action", "actor", "details", "ipAddress", "kafkaTopic", "kafkaOffset", "createdAt") VALUES
  ('AUDI-a202d7f9707d', 'ESCR-2b8354f32602', 'ESCROW-aa91e35b8156', 'ESCROW-2e20de3b8493', 'Titilayo Usman - Awka, Imo - escrow_audit_log record', '10.0.208.66', 'ESCROW-a9bfb97902e6', 'ESCROW-1a98b9805e3a', '2026-01-24 02:53:12'),
  ('AUDI-0eff1df8f290', 'ESCR-4921d53c3406', 'ESCROW-a4c53a295770', 'ESCROW-06ab14042650', 'Titilayo Jimoh - Abeokuta, Anambra - escrow_audit_log record', '10.0.234.12', 'ESCROW-27dac8ecebf4', 'ESCROW-7a08b1da77e3', '2026-02-23 08:36:33'),
  ('AUDI-f3cc1f65675f', 'ESCR-b0be9133f4cb', 'ESCROW-4af409c2223d', 'ESCROW-e7dbb2f61256', 'Lilian Elumelu - Port Harcourt, Oyo - escrow_audit_log record', '10.0.245.119', 'ESCROW-004f10bf07f5', 'ESCROW-bfa39135d693', '2025-11-13 14:45:07'),
  ('AUDI-51e947dc0b34', 'ESCR-3e5d12d5c1e5', 'ESCROW-5e29b9caa805', 'ESCROW-e2249e4cbb85', 'Ibrahim Yakubu - Ikeja, Kwara - escrow_audit_log record', '10.0.24.181', 'ESCROW-c24fb9bcf78a', 'ESCROW-c11b5edfc390', '2025-12-21 20:38:35'),
  ('AUDI-6e68856392a8', 'ESCR-c6f449d6f05c', 'ESCROW-b576ca6c36cd', 'ESCROW-e3f5196bec6b', 'Esther Sanusi - Abeokuta, Enugu - escrow_audit_log record', '10.0.222.134', 'ESCROW-c06117dc2fa5', 'ESCROW-b269671fe8e0', '2025-09-21 05:19:20'),
  ('AUDI-c4d9aaede00c', 'ESCR-0d2f29d80fce', 'ESCROW-5d99f6d4126a', 'ESCROW-443aed9c543e', 'Hauwa Jimoh - Abeokuta, Ogun - escrow_audit_log record', '10.0.120.117', 'ESCROW-69b3444fb6b5', 'ESCROW-96d43dbb7afc', '2026-01-30 04:39:03'),
  ('AUDI-e30984ad9ea9', 'ESCR-0d7f64152337', 'ESCROW-5fa7880496d5', 'ESCROW-9f468005e912', 'Sade Adenuga - Ikeja, Akwa Ibom - escrow_audit_log record', '10.0.172.41', 'ESCROW-26125c9000e9', 'ESCROW-5dea5ed7896b', '2025-11-09 10:50:21'),
  ('AUDI-c7fcc79213f7', 'ESCR-55c572ccdd2b', 'ESCROW-74ea8869dd8a', 'ESCROW-c14a15e1e34f', 'Adewale Peterside - Garki, Enugu - escrow_audit_log record', '10.0.206.108', 'ESCROW-b9cc8b207692', 'ESCROW-c6f54e2f66f0', '2026-03-19 11:08:16')
ON CONFLICT DO NOTHING;


-- ─── escrow_disputes ───
INSERT INTO "escrow_disputes" ("disputeId", "escrowId", "raisedBy", "raisedByPartyId", "reason", "category", "status", "resolution", "arbitratorName", "arbitratorDecision", "resolvedAt", "createdAt") VALUES
  ('DISP-13dbd0cb7269', 'ESCR-4bf1278689b0', 'ESCROW-554f234bbf5b', 978, 'ESCROW-000464c57da8', 'finance', 'processing', 'ESCROW-1c352f0e9ad9', 'ESCROW-22ec44a9937a', 'ESCROW-e598206aa0f1', '2025-08-23 11:53:55', '2025-06-12 16:23:47'),
  ('DISP-64f13b52ae83', 'ESCR-0a35ac7a1931', 'ESCROW-ea6f05013591', 448, 'ESCROW-2bccfe4659f9', 'general', 'pending', 'ESCROW-a8e0f6d592df', 'ESCROW-e365bae2e472', 'ESCROW-fdf3b24ed056', '2025-12-19 12:47:22', '2026-05-01 07:15:04'),
  ('DISP-28d36ddf4572', 'ESCR-93fdaba9c42e', 'ESCROW-2ab132167afd', 163, 'ESCROW-1b76eea294ae', 'finance', 'approved', 'ESCROW-59075c8aadce', 'ESCROW-c0fee4692dd9', 'ESCROW-5193e8e3545c', '2026-01-25 16:28:20', '2025-03-31 12:16:22'),
  ('DISP-732dfe61024f', 'ESCR-b12444c0f053', 'ESCROW-2cd048dabbec', 823, 'ESCROW-2b7e716cf1f1', 'technology', 'approved', 'ESCROW-6e4018d9308b', 'ESCROW-ce0b74f67256', 'ESCROW-47a2cc160a05', '2025-07-23 16:01:33', '2025-12-17 18:26:01'),
  ('DISP-c47f3d9379cb', 'ESCR-8e9597ae7a63', 'ESCROW-4fa7a3dc038b', 510, 'ESCROW-0a38f979af2f', 'operations', 'pending', 'ESCROW-bfda05960a23', 'ESCROW-e08151cba24c', 'ESCROW-9eef9aaab108', '2025-07-03 18:18:39', '2026-01-08 02:33:20'),
  ('DISP-e4ff8c8bd9cd', 'ESCR-e34af06a2be8', 'ESCROW-d43cecb8527b', 425, 'ESCROW-c242c95497a2', 'compliance', 'approved', 'ESCROW-4c8bbe6344db', 'ESCROW-7bc60749f881', 'ESCROW-2bbf590ea656', '2025-07-16 02:36:37', '2025-01-25 13:38:06'),
  ('DISP-44d71ad06ea9', 'ESCR-3168c50e8ffd', 'ESCROW-bc4ff28d1a91', 268, 'ESCROW-45e739363d76', 'technology', 'completed', 'ESCROW-7dc8763b9b80', 'ESCROW-1d96ff2cf84a', 'ESCROW-b9168cf21541', '2025-09-17 11:56:11', '2026-03-31 07:12:46'),
  ('DISP-d4b8f167e9f3', 'ESCR-4b943369cd86', 'ESCROW-003c6f58f98e', 823, 'ESCROW-ffe388c4f404', 'general', 'pending', 'ESCROW-cca5a77256c3', 'ESCROW-0489d47cd915', 'ESCROW-706092ccc0b1', '2025-08-26 04:21:10', '2026-04-24 02:05:32')
ON CONFLICT DO NOTHING;


-- ─── escrow_documents ───
INSERT INTO "escrow_documents" ("documentId", "escrowId", "documentType", "fileName", "fileSize", "mimeType", "storageUrl", "uploadedBy", "verifiedBy", "verifiedAt", "status", "metadata", "createdAt") VALUES
  ('DOCU-2137888d4549', 'ESCR-2f251b659d91', 'premium', 'ESCROW-7a66d81562b0', 339, 'full', 'https://cdn.54bank.ng/escrow_documents/8d0151a5', 'ESCROW-cdf644a175e2', 'ESCROW-bbed5a02180e', '2025-05-13 03:08:04', 'processing', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-12-20 19:23:10'),
  ('DOCU-d47a65cf119b', 'ESCR-da3c73eb4687', 'standard', 'ESCROW-0da05d44064b', 560, 'premium', 'https://cdn.54bank.ng/escrow_documents/439064c9', 'ESCROW-481fbf97ade0', 'ESCROW-7e2d4233aae6', '2025-08-21 10:56:39', 'processing', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-05-18 08:12:30'),
  ('DOCU-1adec4a696a0', 'ESCR-a2d64dbe3ba8', 'basic', 'ESCROW-86b2244a0d08', 550, 'premium', 'https://cdn.54bank.ng/escrow_documents/d91c6cc0', 'ESCROW-b26be4767c09', 'ESCROW-6d7abdc95cfd', '2025-01-02 06:31:57', 'completed', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2026-01-25 05:18:41'),
  ('DOCU-6f624e42228e', 'ESCR-e1e81daf8411', 'standard', 'ESCROW-70f2e2427c6e', 333, 'standard', 'https://cdn.54bank.ng/escrow_documents/c4c91174', 'ESCROW-23d0eadbd3b8', 'ESCROW-e93ced7131c0', '2025-11-30 18:26:08', 'processing', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2026-03-26 18:01:07'),
  ('DOCU-042ef47b470e', 'ESCR-bbdc9d8f19cc', 'enhanced', 'ESCROW-07dc0857f4a3', 8, 'enhanced', 'https://cdn.54bank.ng/escrow_documents/d76b98b9', 'ESCROW-29156e6e56e7', 'ESCROW-e26331ff1083', '2025-09-07 06:02:04', 'active', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-08-24 09:21:10'),
  ('DOCU-326b38b34b12', 'ESCR-070ad20ab027', 'enhanced', 'ESCROW-6bd9441afeed', 999, 'premium', 'https://cdn.54bank.ng/escrow_documents/1b1e4263', 'ESCROW-828f68356b3d', 'ESCROW-2290412c3ac9', '2025-03-25 03:02:30', 'pending', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-05-02 17:53:02'),
  ('DOCU-1ff9274f44b9', 'ESCR-1a2371d6ca41', 'full', 'ESCROW-b4c7756e76e5', 609, 'basic', 'https://cdn.54bank.ng/escrow_documents/f28bfeaf', 'ESCROW-37264606a125', 'ESCROW-d02015713818', '2025-09-20 14:27:38', 'pending', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-04-09 01:34:35'),
  ('DOCU-563f3f0773c7', 'ESCR-8b043eeae9a4', 'full', 'ESCROW-b7335775192d', 284, 'premium', 'https://cdn.54bank.ng/escrow_documents/b95ee9c9', 'ESCROW-4f0daac59b43', 'ESCROW-bd8c745e0f19', '2025-03-31 21:28:23', 'approved', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-07-19 17:32:53')
ON CONFLICT DO NOTHING;


-- ─── escrow_fees ───
INSERT INTO "escrow_fees" ("feeId", "escrowId", "feeType", "amount", "currency", "chargedAt", "status", "ledgerRef", "narration") VALUES
  ('FEEI-eca1df240504', 'ESCR-69588a1971dd', 'premium', 12316011.7, 'NGN', '2025-10-16 04:35:54', 'processing', 'REF-DF6AF6864060', 'ESCROW-d27eb6a51afe'),
  ('FEEI-9111dc8c8ba9', 'ESCR-f9a1fe42ae89', 'premium', 43070128.09, 'USD', '2025-12-21 21:13:28', 'active', 'REF-56A02AD5809D', 'ESCROW-41e535fd4b57'),
  ('FEEI-327cba43bfab', 'ESCR-7ecab2c595ca', 'standard', 1965210.01, 'EUR', '2025-07-12 02:09:55', 'completed', 'REF-EE406EC567D1', 'ESCROW-1ec3fc0456f3'),
  ('FEEI-d2a0fb15f8f1', 'ESCR-9339293f946a', 'enhanced', 4064187.91, 'EUR', '2025-12-24 18:21:53', 'active', 'REF-D5E008C0CF5F', 'ESCROW-913e6d5fcb12'),
  ('FEEI-f1c7204ecd18', 'ESCR-86b3468ec419', 'full', 39972364.39, 'GBP', '2025-01-02 04:50:45', 'active', 'REF-F4C2A76D6F27', 'ESCROW-f46097974465'),
  ('FEEI-5c050c7e7cca', 'ESCR-14204471bc0b', 'enhanced', 20985090.11, 'NGN', '2025-10-06 20:28:01', 'processing', 'REF-FE5AD69E1E59', 'ESCROW-e2a9ca481c6f'),
  ('FEEI-92f71bdb7089', 'ESCR-f049bba3c576', 'premium', 31616415.13, 'NGN', '2026-03-12 02:19:34', 'pending', 'REF-012405A4CF31', 'ESCROW-123e7f8b83e7'),
  ('FEEI-0a97e7407244', 'ESCR-6117009df966', 'enhanced', 34890948.59, 'USD', '2025-09-18 18:53:41', 'completed', 'REF-E6648A524DF5', 'ESCROW-15404a08502f')
ON CONFLICT DO NOTHING;


-- ─── escrow_interest_accruals ───
INSERT INTO "escrow_interest_accruals" ("accrualId", "escrowId", "principalAmount", "rate", "accrualPeriodStart", "accrualPeriodEnd", "daysInPeriod", "interestAmount", "cumulativeInterest", "status", "ledgerRef", "createdAt") VALUES
  ('ACCR-95266de543ca', 'ESCR-4d79683d7e94', 42619575.79, 49.8129, '2025-12-16 02:37:05', '2025-08-12 05:20:21', 161, 494669.39, 8.600757, 'pending', 'REF-9CF827E9AD20', '2025-01-14 17:42:00'),
  ('ACCR-73bfdb4a4276', 'ESCR-3e213d4a7ab8', 29626764.45, 55.6874, '2025-07-14 13:30:55', '2026-04-28 18:41:43', 245, 270705.39, 9.64794, 'pending', 'REF-A59244188924', '2025-11-01 20:57:48'),
  ('ACCR-a605021b5ec2', 'ESCR-e1d77202216a', 21454983.48, 44.4528, '2025-11-21 03:09:46', '2025-03-13 14:28:30', 294, 6198522.3, 7.907302, 'active', 'REF-729EB3792057', '2025-12-03 09:52:11'),
  ('ACCR-4b97b54eaba4', 'ESCR-d111de75395f', 14926556.73, 97.9979, '2025-04-23 02:15:28', '2026-04-25 15:12:58', 113, 9036377.46, 6.077556, 'active', 'REF-2BF8DB306A22', '2025-06-02 22:24:21'),
  ('ACCR-c02409419f20', 'ESCR-5688eb21533f', 17975456.09, 49.6482, '2026-02-26 02:58:42', '2026-04-20 04:05:31', 353, 5708268.08, 7.472715, 'completed', 'REF-D8B0B1CA157E', '2025-10-31 09:56:43'),
  ('ACCR-089737aa75a6', 'ESCR-a7b25070d174', 11399770.17, 32.9621, '2025-07-05 03:39:59', '2025-12-03 04:19:41', 107, 635057.9, 12.896822, 'completed', 'REF-4A10D3AEFCB6', '2025-08-16 18:16:13'),
  ('ACCR-99e88f70ab79', 'ESCR-0ae9394db60d', 41661358.94, 49.3583, '2025-02-28 14:38:08', '2025-02-12 20:43:18', 64, 1146749.81, 12.006423, 'processing', 'REF-DFBECAA01934', '2025-10-07 10:55:30'),
  ('ACCR-f729a688cf87', 'ESCR-c84b1ad69711', 13922641.89, 93.0945, '2025-11-28 15:05:14', '2026-04-21 03:09:01', 329, 7480454.05, 10.497728, 'active', 'REF-14B3A28A02FA', '2025-06-30 21:53:22')
ON CONFLICT DO NOTHING;


-- ─── escrow_milestones ───
INSERT INTO "escrow_milestones" ("milestoneId", "escrowId", "description", "releaseAmount", "releasePercent", "dueDate", "status", "verifiedBy", "verifiedAt", "evidenceDocId", "sequenceOrder", "createdAt") VALUES
  ('MILE-5b3b64294ff3', 'ESCR-f4f0a943b9a4', 'Olumide Chukwu - Asaba, Osun - escrow_milestones record', 6858853.1, 2805185.06, '2025-11-27 01:44:44', 'processing', 'ESCROW-cfed8381ebcd', '2025-01-11 09:25:30', 'EVID-c2c641d4a80f', 63, '2026-02-20 02:47:50'),
  ('MILE-32b52e9bb758', 'ESCR-c45bfa739a4d', 'Rahma Peterside - Ikeja, Plateau - escrow_milestones record', 1452613.12, 5931274.3, '2025-03-08 11:59:11', 'active', 'ESCROW-5a55fee7a49a', '2025-05-22 09:31:59', 'EVID-abbe2a245a6f', 114, '2025-10-30 17:00:26'),
  ('MILE-6d66028ecbd1', 'ESCR-a7314e1487df', 'Babajide Eze - Garki, Rivers - escrow_milestones record', 6049324.0, 9695884.33, '2025-06-01 15:54:03', 'pending', 'ESCROW-470ccf12d402', '2025-02-20 11:45:35', 'EVID-5b7c729369c2', 242, '2025-05-02 03:44:28'),
  ('MILE-2b96db523e87', 'ESCR-7ab044dedbe1', 'Rahma Lawal - Ikeja, Lagos - escrow_milestones record', 6175914.63, 475011.43, '2025-05-08 11:44:06', 'processing', 'ESCROW-3c5dc0636521', '2026-01-07 11:02:50', 'EVID-0ae0aec34635', 326, '2025-02-05 03:34:26'),
  ('MILE-c33e5efcd35c', 'ESCR-d7140401b5ff', 'Oluchi Garba - Zaria, Anambra - escrow_milestones record', 7094766.1, 7363197.44, '2025-06-03 03:09:25', 'active', 'ESCROW-a66a81db2ed2', '2025-04-01 02:17:50', 'EVID-911e0652169a', 787, '2025-07-11 22:50:48'),
  ('MILE-866b4ff474e4', 'ESCR-131e88e4d1c0', 'Gbenga Adenuga - Abeokuta, Ogun - escrow_milestones record', 4458787.66, 5048606.22, '2025-04-07 09:51:57', 'completed', 'ESCROW-ae87f5ebe851', '2025-09-21 12:24:40', 'EVID-9a511ef3fb2a', 931, '2025-10-10 21:28:06'),
  ('MILE-822277157365', 'ESCR-af573a2224aa', 'Rahma Mohammed - Asaba, Kwara - escrow_milestones record', 8870897.96, 2611561.43, '2025-11-17 02:49:03', 'pending', 'ESCROW-412be6145a13', '2025-10-25 17:39:12', 'EVID-234ea13bda6a', 668, '2026-03-12 05:08:29'),
  ('MILE-7bcb9a09b2e2', 'ESCR-0aae71f1b8fb', 'Gbenga Danladi - Port Harcourt, Plateau - escrow_milestones record', 1133970.77, 1065022.29, '2026-01-25 15:31:47', 'completed', 'ESCROW-ea4840861a1a', '2025-09-07 05:15:02', 'EVID-9fef3cdca036', 353, '2025-01-24 21:25:54')
ON CONFLICT DO NOTHING;


-- ─── escrow_parties ───
INSERT INTO "escrow_parties" ("escrowId", "role", "name", "accountId", "email", "phone", "kycStatus", "kybStatus", "sharePercent", "signedAt", "metadata", "createdAt") VALUES
  ('ESCR-4ab24580d6e6', 'admin', 'Sade Peterside', 'ACCT-b00c8c1781ed', 'femi.yakubu@54bank.ng', '09033861336', 'ESCROW-ee8ed2c7ed7f', 'ESCROW-ddc0964898f5', 775698.51, '2025-10-30 11:28:41', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2025-02-22 04:20:14'),
  ('ESCR-4a6dca61c57a', 'compliance', 'Bukola Kalu', 'ACCT-2d63b99f5e91', 'gbenga.lawal@54bank.ng', '08055851818', 'ESCROW-0c96fc801976', 'ESCROW-9e62e2dc8cfc', 5773459.7, '2025-04-23 14:32:00', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-10-27 06:49:21'),
  ('ESCR-9cb11dd627a3', 'compliance', 'Jide Balogun', 'ACCT-20e52d2b9a5f', 'tunde.igwe@54bank.ng', '08104128536', 'ESCROW-fdbc09354428', 'ESCROW-007b06e2601c', 8647511.69, '2025-06-21 22:56:23', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-04-03 02:53:49'),
  ('ESCR-4ed372624435', 'operator', 'Adaeze Danladi', 'ACCT-3efda4ac5516', 'patience.yakubu@54bank.ng', '08056213543', 'ESCROW-f903d8d342c1', 'ESCROW-31da1d4807a3', 3191527.58, '2025-03-01 01:21:34', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2025-07-20 14:29:46'),
  ('ESCR-7796a7a37d26', 'admin', 'Jide Fashola', 'ACCT-4466b54262f0', 'sade.fashola@54bank.ng', '09064814957', 'ESCROW-7aff92f8c3e4', 'ESCROW-eb1d40718aab', 8469693.52, '2025-10-26 13:59:35', '{"source": "seed", "tenant": "tenant-kano-north"}'::jsonb, '2025-12-05 18:26:55'),
  ('ESCR-1532626bdf7a', 'auditor', 'Chukwuemeka Eze', 'ACCT-64f29cb266aa', 'grace.eze@54bank.ng', '08035518415', 'ESCROW-93c3f8ca1e82', 'ESCROW-af577136fa56', 9797745.41, '2025-03-29 04:43:06', '{"source": "seed", "tenant": "tenant-kano-north"}'::jsonb, '2025-11-01 23:44:47'),
  ('ESCR-3ad536f9f814', 'teller', 'Adewale Dangote', 'ACCT-1d690f358344', 'titilayo.eze@54bank.ng', '08065334312', 'ESCROW-d0f749d3a95f', 'ESCROW-0499de48fff0', 8708337.55, '2026-05-04 05:38:43', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2026-02-09 17:43:47'),
  ('ESCR-172bf5c73291', 'teller', 'Hassan Dangote', 'ACCT-081b99930af2', 'ibrahim.sanusi@54bank.ng', '08094064994', 'ESCROW-dffc09f567b1', 'ESCROW-90dc06a80152', 4841378.49, '2025-09-04 04:37:32', '{"source": "seed", "tenant": "tenant-whitelabel-zenith"}'::jsonb, '2025-12-11 00:25:58')
ON CONFLICT DO NOTHING;


-- ─── escrow_regulatory_reports ───
INSERT INTO "escrow_regulatory_reports" ("reportId", "reportType", "reportingPeriodStart", "reportingPeriodEnd", "totalEscrowAccounts", "totalHeldValue", "totalReleasedValue", "totalDisputedValue", "totalInterestAccrued", "filedAt", "filingReference", "status", "reportData", "createdAt") VALUES
  ('REPO-17530e08dca9', 'premium', '2025-02-19 06:02:12', '2026-02-06 10:07:51', 7654, 4125822.16, 2730913.88, 5743821.49, 9408622.18, '2025-02-07 07:55:31', 'REF-905DE1C7D138', 'completed', '{"data": "seed"}'::jsonb, '2025-08-27 05:51:01'),
  ('REPO-2127818a9b63', 'basic', '2025-12-11 18:30:11', '2025-10-13 14:35:15', 4127, 1004027.16, 5647307.67, 1316030.2, 894899.51, '2025-09-09 08:14:23', 'REF-5DFB83AE3A30', 'processing', '{"data": "seed"}'::jsonb, '2025-08-05 14:00:59'),
  ('REPO-c02cf7332774', 'basic', '2025-06-07 09:53:06', '2026-05-05 00:32:49', 7611, 9689694.41, 4711560.57, 9654223.91, 7478751.16, '2026-01-14 02:45:21', 'REF-2D5333B7D30D', 'active', '{"data": "seed"}'::jsonb, '2025-03-30 09:04:18'),
  ('REPO-1d53d68dd712', 'full', '2026-01-25 14:05:01', '2025-11-20 05:34:10', 3012, 9320198.39, 3940280.2, 8461512.1, 7924156.67, '2025-05-26 22:06:47', 'REF-2A438C55D0A5', 'active', '{"data": "seed"}'::jsonb, '2025-11-15 11:01:52'),
  ('REPO-fd885dc25c03', 'basic', '2026-03-30 07:31:49', '2025-07-12 10:41:21', 6762, 7303225.9, 1403263.71, 7821381.24, 1397693.18, '2025-09-17 21:04:33', 'REF-89D52B561F40', 'approved', '{"data": "seed"}'::jsonb, '2026-02-01 14:23:31'),
  ('REPO-08abbc4886b0', 'standard', '2025-11-02 17:13:01', '2025-03-10 17:54:00', 9065, 671278.85, 2060526.94, 5477609.1, 3322069.33, '2025-12-04 14:28:55', 'REF-0EAC13D01D91', 'approved', '{"data": "seed"}'::jsonb, '2026-03-22 03:34:38'),
  ('REPO-f717480cceb6', 'premium', '2025-06-27 21:38:49', '2026-02-06 15:53:50', 3371, 72578.7, 8932048.79, 4179231.45, 4582490.86, '2025-08-25 06:04:14', 'REF-185F8CD4AC25', 'approved', '{"data": "seed"}'::jsonb, '2025-04-09 00:43:38'),
  ('REPO-ef797a7629c0', 'full', '2025-01-15 15:51:13', '2026-04-14 04:37:21', 9479, 9706132.96, 6780766.32, 8394898.44, 5858049.67, '2025-07-29 21:01:34', 'REF-D223A0A35845', 'pending', '{"data": "seed"}'::jsonb, '2025-05-17 20:38:02')
ON CONFLICT DO NOTHING;


-- ─── escrow_transactions ───
INSERT INTO "escrow_transactions" ("txId", "escrowId", "type", "amount", "currency", "fromAccount", "toAccount", "status", "ledgerRef", "milestoneId", "narration", "fxRate", "fxSourceCurrency", "createdAt") VALUES
  ('TXID-3a185d559d8c', 'ESCR-3dc8dc0d980a', 'standard', 36407268.78, 'NGN', 'ESCROW-1f5322eed47f', 'ESCROW-3e0d173be9a7', 'completed', 'REF-7C008A3C8DD3', 'MILE-5e03eec538d4', 'ESCROW-973ba828a856', 7.2802, 'ESCROW-656f2e7130c8', '2025-10-09 05:41:28'),
  ('TXID-5b39c0ae6147', 'ESCR-670418e157ae', 'full', 14996858.57, 'GBP', 'ESCROW-35d3ff2a6b46', 'ESCROW-d00cca1415c0', 'pending', 'REF-C5D0308F96BD', 'MILE-cb238994991e', 'ESCROW-2b23b43b69aa', 82.0274, 'ESCROW-9136c7c6ff0a', '2025-12-14 16:46:45'),
  ('TXID-af7445556f4a', 'ESCR-447fe40f9d40', 'basic', 19525872.82, 'NGN', 'ESCROW-b1e4745baa37', 'ESCROW-77a7243d07d9', 'active', 'REF-AA125A6BA271', 'MILE-57ecbf0bee7d', 'ESCROW-5036c70d910b', 34.442, 'ESCROW-753fecca5d05', '2025-11-28 07:30:56'),
  ('TXID-b0d4d9a8b565', 'ESCR-dc305a79e292', 'premium', 20921043.59, 'NGN', 'ESCROW-18884a1a4cec', 'ESCROW-e4a8919e9e19', 'processing', 'REF-AF3C2A44F7B9', 'MILE-ada3d572d445', 'ESCROW-d45b0788f6a0', 77.0436, 'ESCROW-3d63173e9448', '2025-03-11 16:07:07'),
  ('TXID-9113fb59054d', 'ESCR-e3363ca7b4e9', 'full', 22237916.68, 'NGN', 'ESCROW-60a59e3eb029', 'ESCROW-b8128f916e09', 'processing', 'REF-B370C54E2296', 'MILE-253a5af5d761', 'ESCROW-4630bca69c16', 35.5223, 'ESCROW-a68c7f39ed4c', '2026-04-18 16:35:10'),
  ('TXID-cf51aeb670aa', 'ESCR-6f3c89009919', 'standard', 29077838.76, 'NGN', 'ESCROW-fd2ac3d32353', 'ESCROW-136557a43658', 'completed', 'REF-7973B8C55CA9', 'MILE-73afe3be3e11', 'ESCROW-21c1fc35de59', 56.0775, 'ESCROW-ebb2af408cfc', '2025-12-05 19:35:44'),
  ('TXID-64a586ddc29c', 'ESCR-429c48609fa6', 'enhanced', 16836969.0, 'NGN', 'ESCROW-0f65db101b9b', 'ESCROW-821b71d39d1c', 'completed', 'REF-79E16B039F98', 'MILE-ddb0e424554a', 'ESCROW-10adbb9a40e6', 63.2683, 'ESCROW-1a4aa63c0331', '2025-03-04 06:38:45'),
  ('TXID-8c316076c801', 'ESCR-7222ad12c98c', 'enhanced', 27583175.71, 'GBP', 'ESCROW-98c3e0adf937', 'ESCROW-f251cc4a68fd', 'active', 'REF-09C2AD32A866', 'MILE-78fd60c00ff9', 'ESCROW-f76235c52677', 88.7979, 'ESCROW-9358ce713eb4', '2025-12-15 12:18:36')
ON CONFLICT DO NOTHING;


-- ─── esusuGroups ───
INSERT INTO "esusuGroups" ("groupId", "tenantId", "name", "organiserId", "organiserName", "contributionAmount", "currency", "frequency", "maxMembers", "currentCycle", "totalCycles", "status", "startDate", "createdAt", "updatedAt") VALUES
  ('GROU-cedefe501734', 'tenant-abuja-digital', 'Jide Otedola', 'ORGA-81ae23aef327', 'ESUSUG-31e01f1eca35', 2797215.82, 'USD', 'ESUSUG-3ed1d1e8d67e', 329, 898, 8762, 'processing', '2025-01-09 21:11:48', '2025-02-04 10:18:59', '2025-02-24 05:26:59'),
  ('GROU-7bd59329eb95', 'tenant-portharcourt', 'Bukola Peterside', 'ORGA-23b672c1785c', 'ESUSUG-b31ab0a8dbc0', 8451040.93, 'NGN', 'ESUSUG-0e2fa177e9bf', 245, 219, 5230, 'completed', '2025-06-19 02:19:43', '2026-04-28 17:27:45', '2025-02-12 23:58:59'),
  ('GROU-2e50f17b1be6', 'tenant-lagos-main', 'Emeka Kalu', 'ORGA-c4c72e12f097', 'ESUSUG-f39d99f48797', 456033.89, 'NGN', 'ESUSUG-6f4993d6c293', 617, 610, 455, 'approved', '2025-02-24 03:45:31', '2025-09-30 18:51:16', '2025-12-10 20:31:07'),
  ('GROU-c05b984da052', 'tenant-lagos-main', 'Kunle Igwe', 'ORGA-865c83657c46', 'ESUSUG-6ed3b0529c1a', 4800598.28, 'USD', 'ESUSUG-a3f070cf632d', 199, 967, 2768, 'completed', '2025-04-07 15:55:30', '2025-04-05 06:42:07', '2026-04-18 17:11:19'),
  ('GROU-0df028a12784', 'tenant-whitelabel-zenith', 'Segun Danladi', 'ORGA-d7fc9a547bc7', 'ESUSUG-35ced870affe', 624786.03, 'NGN', 'ESUSUG-fb26a0498589', 642, 363, 9479, 'completed', '2025-02-23 02:08:21', '2025-02-21 16:45:35', '2026-01-26 13:25:13'),
  ('GROU-0e326e858be6', 'tenant-whitelabel-zenith', 'Gbenga Peterside', 'ORGA-7aaea5954733', 'ESUSUG-62f61a3cdd25', 6566328.88, 'USD', 'ESUSUG-54721f7aecac', 969, 541, 9096, 'approved', '2026-04-19 06:25:48', '2025-09-19 15:06:30', '2025-02-12 07:36:49'),
  ('GROU-83eaf56f7fbd', 'tenant-whitelabel-zenith', 'Hauwa Hassan', 'ORGA-c11b7dd9967a', 'ESUSUG-92ec9e7026e6', 9686427.71, 'NGN', 'ESUSUG-e3923e7bc074', 373, 372, 6696, 'processing', '2025-06-25 09:03:15', '2025-02-24 04:25:21', '2025-05-28 07:09:56'),
  ('GROU-ce649abacc00', 'tenant-kano-north', 'Kunle Eze', 'ORGA-19aa7f141f72', 'ESUSUG-2321d93e4fd9', 698942.4, 'USD', 'ESUSUG-c30e04879aa5', 636, 445, 1376, 'active', '2025-03-16 09:06:25', '2025-10-22 17:09:49', '2025-09-23 20:58:40')
ON CONFLICT DO NOTHING;


-- ─── event_dedup_configs ───
INSERT INTO "event_dedup_configs" ("topic", "windowMs", "strategy", "status", "createdAt") VALUES
  ('EVENT_-86c3fbfb0066', 590, 'EVENT_-f9cececafcb5', 'active', '2026-03-28 14:27:51'),
  ('EVENT_-68effd37468c', 888, 'EVENT_-3d9834c7b1b9', 'completed', '2026-04-14 22:29:48'),
  ('EVENT_-531b1871a44b', 541, 'EVENT_-82e463772635', 'pending', '2025-05-11 04:19:04'),
  ('EVENT_-a4ca7b9ac32c', 247, 'EVENT_-bf6e6f59a543', 'approved', '2025-10-30 07:11:04'),
  ('EVENT_-7de7bc4b603c', 223, 'EVENT_-23012e02df4c', 'active', '2025-12-11 15:46:13'),
  ('EVENT_-e174d02af906', 804, 'EVENT_-e0df204a68d7', 'approved', '2026-01-22 18:17:56'),
  ('EVENT_-8fd22348a08e', 770, 'EVENT_-5e95d0c56643', 'approved', '2025-03-24 14:47:13'),
  ('EVENT_-8c08df051975', 400, 'EVENT_-c78776b204c7', 'approved', '2025-12-12 12:22:39')
ON CONFLICT DO NOTHING;


-- ─── face_embeddings ───
INSERT INTO "face_embeddings" ("embeddingId", "customerId", "tenantId", "embedding", "model", "isEnrolled", "purpose", "createdAt", "updatedAt") VALUES
  ('EMBE-376d9f746e2a', 'CUST-46d9b8dc4a98', 'tenant-portharcourt', '{"data": "seed"}'::jsonb, 'FACE_E-4fa226e0f8f7', true, 'FACE_E-2660bb3041ac', '2025-07-03 01:07:46', '2025-03-28 08:28:47'),
  ('EMBE-0b8b589d2c49', 'CUST-aa8062c196d0', 'tenant-portharcourt', '{"data": "seed"}'::jsonb, 'FACE_E-bb5f20f4b162', true, 'FACE_E-503e612f4e69', '2025-05-16 21:17:47', '2026-05-08 04:52:57'),
  ('EMBE-261e4eb555de', 'CUST-c046976d3ce7', 'tenant-abuja-digital', '{"data": "seed"}'::jsonb, 'FACE_E-4b6e62d3bf16', false, 'FACE_E-a964259b8b19', '2025-06-13 03:01:55', '2025-06-23 21:40:52'),
  ('EMBE-6e8b6cb03f8c', 'CUST-940ea5db7797', 'tenant-abuja-digital', '{"data": "seed"}'::jsonb, 'FACE_E-a69646071589', true, 'FACE_E-eea7512c1f09', '2025-01-18 11:27:42', '2025-01-01 21:49:37'),
  ('EMBE-00f847e5973a', 'CUST-d5c99c35be0a', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'FACE_E-23d09094852e', true, 'FACE_E-d38b12b94b5d', '2026-04-09 16:44:31', '2025-08-23 07:45:04'),
  ('EMBE-641c7427b457', 'CUST-aa81cc064708', 'tenant-kano-north', '{"data": "seed"}'::jsonb, 'FACE_E-917deed13f9b', true, 'FACE_E-26992ca9ed6c', '2026-01-22 12:07:34', '2026-03-13 14:35:23'),
  ('EMBE-0753f7b29347', 'CUST-5d6695a7812f', 'tenant-kano-north', '{"data": "seed"}'::jsonb, 'FACE_E-dd570f66d0dc', true, 'FACE_E-1312184cd8b0', '2026-04-19 04:01:57', '2026-04-20 23:22:11'),
  ('EMBE-05598121c566', 'CUST-5e86da876f1c', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'FACE_E-5c2cdc9c82d6', true, 'FACE_E-b3ed234a0a7c', '2025-03-25 00:36:03', '2025-01-19 03:06:31')
ON CONFLICT DO NOTHING;


-- ─── face_matches ───
INSERT INTO "face_matches" ("matchId", "tenantId", "customerId", "matched", "ageEstimation", "genderEstimation", "glassesDetected", "maskDetected", "purpose", "createdAt") VALUES
  ('MATC-334b0347dd54', 'tenant-lagos-main', 'CUST-94b1c57418ee', true, 632, 'FACE_M-a2261bd2b435', true, true, 'FACE_M-31755d9a06ab', '2025-03-27 18:08:16'),
  ('MATC-0416b304d2be', 'tenant-portharcourt', 'CUST-70a3af284eb3', false, 112, 'FACE_M-cd24c935b02c', true, true, 'FACE_M-5645db55d311', '2025-10-05 03:30:42'),
  ('MATC-df72540c89f1', 'tenant-lagos-main', 'CUST-f1c8e2f5094c', false, 390, 'FACE_M-374511daea17', true, false, 'FACE_M-be2aefa55cf3', '2025-01-14 09:35:59'),
  ('MATC-c4dcdeb6bc0b', 'tenant-portharcourt', 'CUST-7891b704cbd5', true, 748, 'FACE_M-62de0cbc8beb', false, true, 'FACE_M-dddeef3b28c0', '2025-08-09 12:12:02'),
  ('MATC-a00d7f02f71a', 'tenant-lagos-main', 'CUST-7eb244c21c81', true, 356, 'FACE_M-8362297426b9', true, true, 'FACE_M-a92d5636bd6f', '2025-09-05 03:56:51'),
  ('MATC-8257cc91e0c5', 'tenant-kano-north', 'CUST-24c8df7df6c7', true, 686, 'FACE_M-51232abfed87', true, false, 'FACE_M-bae2beb753b3', '2025-08-25 14:29:04'),
  ('MATC-882467a665f5', 'tenant-portharcourt', 'CUST-10cfc45d6cb5', false, 907, 'FACE_M-9bc7941898ef', true, true, 'FACE_M-591704cdf56e', '2025-03-09 15:27:17'),
  ('MATC-730a27bd885c', 'tenant-abuja-digital', 'CUST-978db285f63e', true, 216, 'FACE_M-802f812ec882', true, true, 'FACE_M-283e153ebb83', '2026-02-19 01:03:18')
ON CONFLICT DO NOTHING;


-- ─── facial_landmarks ───
INSERT INTO "facial_landmarks" ("landmarkId", "customerId", "livenessCheckId", "landmarkCount", "landmarks", "headPose", "createdAt") VALUES
  ('LAND-85de9a3c09fd', 'CUST-71746e1f6ef0', 'LIVE-db3ff7e48779', 8400, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-11-02 03:28:27'),
  ('LAND-af0eec7c96b6', 'CUST-23dabfef074e', 'LIVE-08beb4f1b80b', 3233, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-11-23 05:19:26'),
  ('LAND-881635d3ea1f', 'CUST-9b7e760201fa', 'LIVE-a238bb86d976', 969, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2026-03-29 21:45:14'),
  ('LAND-524524bf389a', 'CUST-f1367459dd9d', 'LIVE-d4db89723921', 1664, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-02-23 21:50:55'),
  ('LAND-1034dcd97147', 'CUST-6b3bda548e77', 'LIVE-b75a2d866c09', 2499, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-08-21 06:47:01'),
  ('LAND-bbb3ca6c6ae5', 'CUST-c4d72513b2d5', 'LIVE-eb3927ac51d7', 1828, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-02-24 08:10:39'),
  ('LAND-929218c111a5', 'CUST-a8dd307895c4', 'LIVE-263deb39639d', 5937, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-11-28 08:43:56'),
  ('LAND-247087536ef6', 'CUST-bc2b51bf4d1e', 'LIVE-cccf7349f26d', 869, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '2025-10-05 05:28:09')
ON CONFLICT DO NOTHING;


-- ─── farm_boundary_mapping ───
INSERT INTO "farm_boundary_mapping" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-73bc9405a9a8', 'Femi Kalu', 'risk', 'Femi Kalu - Port Harcourt - Farm Boundary Mapping', 'processing', 9528050.87, 'Borno', 'REF-11ECE10BDA', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-05-15 13:09:36', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-6bd2a52a45cc', 'Lanre Balogun', 'operations', 'Lanre Balogun - Victoria Island - Farm Boundary Mapping', 'approved', 8772032.55, 'Imo', 'REF-A504218C99', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-08-07 12:31:28', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-d3fdee7c140a', 'Kemi Jimoh', 'technology', 'Kemi Jimoh - Maitama - Farm Boundary Mapping', 'approved', 7236998.66, 'Borno', 'REF-CF8152475C', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2026-05-08 14:22:55', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-a8c63c6daed6', 'Esther Adenuga', 'operations', 'Esther Adenuga - Ikeja - Farm Boundary Mapping', 'approved', 7416267.92, 'Kwara', 'REF-E4CF30F8B0', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-12-07 14:45:31', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-8068bdd1609e', 'Grace Mohammed', 'compliance', 'Grace Mohammed - Warri - Farm Boundary Mapping', 'processing', 7838707.56, 'Anambra', 'REF-B313C0D1A5', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-11-27 21:36:21', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-284083101466', 'Uche Taiwo', 'lending', 'Uche Taiwo - Garki - Farm Boundary Mapping', 'completed', 9426244.8, 'Abuja FCT', 'REF-4FEC3B850A', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-04-23 00:53:13', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2e35a8a2692d', 'Musa Lawal', 'finance', 'Musa Lawal - Victoria Island - Farm Boundary Mapping', 'active', 4471438.62, 'Akwa Ibom', 'REF-81B2C377FD', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-09-10 08:01:21', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c349bd0eb16c', 'Fatima Chukwu', 'operations', 'Fatima Chukwu - Lekki - Farm Boundary Mapping', 'approved', 6598970.24, 'Kwara', 'REF-68BF96771F', '{"source": "seed", "table": "farm_boundary_mapping"}'::jsonb, '2025-06-15 15:18:31', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── fast_json_schemas ───
INSERT INTO "fast_json_schemas" ("schemaName", "compiledSizeBytes", "serializationsPerSec", "avgSerializeNs", "speedup", "status", "createdAt") VALUES
  ('FAST_J-4244d9b91601', 877, 693, 528, 'FAST_J-82552f870b9a', 'processing', '2026-02-22 19:46:57'),
  ('FAST_J-3839d6db775e', 922, 330, 159, 'FAST_J-e78d5c9157db', 'active', '2026-04-09 08:45:14'),
  ('FAST_J-439d9a7dd863', 610, 474, 129, 'FAST_J-3647fcd15c4b', 'active', '2025-03-07 13:14:25'),
  ('FAST_J-fe2ce6dead5f', 396, 415, 474, 'FAST_J-3db0af634f95', 'approved', '2025-07-01 20:36:00'),
  ('FAST_J-e1cfa0b46a4f', 566, 653, 471, 'FAST_J-76ed18e0131b', 'active', '2025-05-29 23:40:35'),
  ('FAST_J-9093dc273afe', 367, 384, 690, 'FAST_J-2bd64eefc13a', 'approved', '2025-11-10 01:40:09'),
  ('FAST_J-2ce3e21222c4', 745, 547, 257, 'FAST_J-59f0987e50cc', 'pending', '2026-03-06 19:59:13'),
  ('FAST_J-2f42f4dd1f6a', 891, 152, 466, 'FAST_J-aed1478e61c9', 'pending', '2025-09-28 00:03:24')
ON CONFLICT DO NOTHING;


-- ─── fisheries_aquaculture ───
INSERT INTO "fisheries_aquaculture" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-2d78d0e15157', 'Titilayo Chukwu', 'risk', 'Titilayo Chukwu - Ikeja - Fisheries Aquaculture', 'active', 9539070.71, 'Borno', 'REF-43092F2192', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2025-07-31 04:29:52', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f519a94fde92', 'Hauwa Yakubu', 'risk', 'Hauwa Yakubu - Ikeja - Fisheries Aquaculture', 'pending', 2559674.96, 'Oyo', 'REF-97AAFD81AD', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2025-07-13 22:49:24', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-5d65d1549a8c', 'Titilayo Taiwo', 'finance', 'Titilayo Taiwo - Wuse - Fisheries Aquaculture', 'active', 694909.3, 'Cross River', 'REF-760A6E0538', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2025-04-18 00:59:16', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-937eecc45f04', 'Gbenga Eze', 'lending', 'Gbenga Eze - Asaba - Fisheries Aquaculture', 'processing', 94135.32, 'Edo', 'REF-CBD5DDB719', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2026-01-19 12:50:23', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-178892670f93', 'Uche Chukwu', 'lending', 'Uche Chukwu - Maitama - Fisheries Aquaculture', 'processing', 7534653.21, 'Lagos', 'REF-373D3DA387', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2025-03-10 04:21:39', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-90271d6e86b3', 'Grace Elumelu', 'lending', 'Grace Elumelu - Ibadan - Fisheries Aquaculture', 'completed', 7000356.09, 'Kwara', 'REF-ACF090B33D', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2026-03-02 17:23:53', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2eec8d2a7150', 'Grace Okafor', 'payments', 'Grace Okafor - Ikeja - Fisheries Aquaculture', 'approved', 7140762.56, 'Oyo', 'REF-B09AA61F7E', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2026-02-21 17:42:26', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-e84e13c82743', 'Lilian Elumelu', 'lending', 'Lilian Elumelu - Zaria - Fisheries Aquaculture', 'approved', 700343.5, 'Kaduna', 'REF-DF979F2527', '{"source": "seed", "table": "fisheries_aquaculture"}'::jsonb, '2025-06-09 07:59:18', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── fluvio_smart_modules ───
INSERT INTO "fluvio_smart_modules" ("name", "moduleType", "wasmSizeKB", "avgLatencyUs", "throughputEps", "status", "createdAt") VALUES
  ('Uche Eze', 'enhanced', 570, 605, 728, 'processing', '2025-02-18 13:17:04'),
  ('Segun Usman', 'premium', 22, 888, 1000, 'approved', '2025-08-27 23:17:00'),
  ('Kunle Taiwo', 'basic', 962, 342, 466, 'completed', '2026-02-10 06:47:44'),
  ('Fatima Mohammed', 'standard', 643, 722, 289, 'active', '2025-05-30 17:35:22'),
  ('Jumoke Otedola', 'enhanced', 172, 798, 971, 'pending', '2026-02-02 15:20:46'),
  ('Fatima Chukwu', 'basic', 147, 320, 887, 'active', '2025-12-02 18:32:42'),
  ('Titilayo Igwe', 'enhanced', 723, 347, 816, 'active', '2025-01-17 07:41:56'),
  ('Hauwa Usman', 'enhanced', 425, 586, 450, 'approved', '2026-05-04 23:23:10')
ON CONFLICT DO NOTHING;


-- ─── frame_policies ───
INSERT INTO "frame_policies" ("domain", "frameAncestors", "xFrameOptions", "frameDetection", "violations24h", "uniqueFramers", "status", "createdAt") VALUES
  ('FRAME_-ea57cdca0de1', 'FRAME_-ed1104d94fa7', 'FRAME_-a3d5a2842f4e', 'FRAME_-0f996de3ee3a', 84, 933, 'completed', '2025-08-30 13:18:47'),
  ('FRAME_-04d41b859e99', 'FRAME_-97a264774914', 'FRAME_-778d1f5aecde', 'FRAME_-51fe57de6208', 322, 881, 'completed', '2025-06-29 04:10:27'),
  ('FRAME_-1ae53742ddc1', 'FRAME_-4530479a3cb9', 'FRAME_-024a537784ae', 'FRAME_-524ad45efc84', 363, 597, 'pending', '2025-12-09 15:22:18'),
  ('FRAME_-0bdf67ed606c', 'FRAME_-c01e80930cfc', 'FRAME_-0a0b2ce17e2d', 'FRAME_-6c886cd54bec', 48, 653, 'pending', '2025-03-20 16:00:13'),
  ('FRAME_-eb978cb316ec', 'FRAME_-ef9785dbe10d', 'FRAME_-e13ab77478cc', 'FRAME_-78d239655fb5', 805, 217, 'processing', '2025-03-05 08:41:08'),
  ('FRAME_-ac25b7e7418b', 'FRAME_-d924a700405e', 'FRAME_-286131ffa6b9', 'FRAME_-90053106320d', 740, 392, 'pending', '2025-08-11 05:53:59'),
  ('FRAME_-4d0186471f23', 'FRAME_-29c405c22226', 'FRAME_-d296b528ca8b', 'FRAME_-97804a94bd80', 531, 136, 'completed', '2025-10-14 12:56:10'),
  ('FRAME_-5688505058b3', 'FRAME_-aa8d9e07bef2', 'FRAME_-a5efb289df80', 'FRAME_-a4ace3def048', 729, 380, 'approved', '2025-10-30 04:44:08')
ON CONFLICT DO NOTHING;


-- ─── glAccounts ───
INSERT INTO "glAccounts" ("glAccountCode", "tenantId", "name", "category", "subcategory", "parentCode", "currency", "balance", "status", "isControlAccount", "createdAt", "updatedAt") VALUES
  ('GLACCO-214f43e0011f', 'tenant-abuja-digital', 'Emeka Lawal', 'finance', 'GLACCO-4a527a2ab641', 'GLACCO-b674227ce0ae', 'NGN', 5757738.03, 'approved', 9556, '2025-06-12 08:15:02', '2025-11-29 13:23:40'),
  ('GLACCO-62c0b4602a6e', 'tenant-lagos-main', 'Hauwa Mohammed', 'operations', 'GLACCO-2eb4dd8571b2', 'GLACCO-b43c164a350e', 'GBP', 41462913.27, 'completed', 9444, '2025-03-02 02:57:45', '2025-08-24 23:40:14'),
  ('GLACCO-e572f4456d94', 'tenant-abuja-digital', 'Titilayo Usman', 'finance', 'GLACCO-07b7872c10e8', 'GLACCO-e39a32ca2ea3', 'NGN', 25481808.73, 'active', 4023, '2025-02-04 02:55:47', '2025-11-04 01:58:25'),
  ('GLACCO-324c2c72bdd6', 'tenant-abuja-digital', 'Sade Mohammed', 'compliance', 'GLACCO-aadc584e9e98', 'GLACCO-8a15414750da', 'EUR', 49714160.74, 'pending', 131, '2025-04-26 06:31:42', '2025-04-01 14:36:51'),
  ('GLACCO-ddf5e8ba91f0', 'tenant-kano-north', 'Fatima Usman', 'general', 'GLACCO-9981000d8f08', 'GLACCO-a3edb97e9c7a', 'EUR', 1170915.5, 'completed', 9566, '2025-02-15 10:16:58', '2025-11-14 09:23:36'),
  ('GLACCO-78014cc7eb0c', 'tenant-kano-north', 'Lanre Elumelu', 'general', 'GLACCO-a88694ef75b6', 'GLACCO-7e2fbe958825', 'NGN', 48141139.22, 'pending', 6247, '2026-02-23 20:39:10', '2025-04-20 19:16:03'),
  ('GLACCO-1e866bd0adc8', 'tenant-abuja-digital', 'Kemi Yakubu', 'general', 'GLACCO-f8922a244bb6', 'GLACCO-d89856b8775a', 'EUR', 38636103.78, 'completed', 6492, '2026-01-02 16:14:13', '2025-10-05 05:13:48'),
  ('GLACCO-7103f06da431', 'tenant-lagos-main', 'Jide Hassan', 'finance', 'GLACCO-93d69b38c746', 'GLACCO-b81f6437a782', 'EUR', 26793524.95, 'completed', 6207, '2025-02-11 19:19:20', '2025-02-28 13:03:18')
ON CONFLICT DO NOTHING;


-- ─── goaml_reports ───
INSERT INTO "goaml_reports" ("reportType", "subject", "nfiuAcknowledgement", "xmlValidated", "status", "createdAt") VALUES
  ('premium', 'GOAML_-a778a9968f34', 'GOAML_-afbf0c89042a', true, 'approved', '2025-06-08 16:11:13'),
  ('full', 'GOAML_-78f8ee9358f4', 'GOAML_-2b96264bf9c7', false, 'completed', '2025-06-28 17:37:04'),
  ('basic', 'GOAML_-b03090aa41bd', 'GOAML_-5144019f65dc', true, 'approved', '2026-05-03 00:11:44'),
  ('enhanced', 'GOAML_-4b458da945d0', 'GOAML_-e202143e58cb', false, 'pending', '2025-09-24 17:14:24'),
  ('basic', 'GOAML_-1e19d079b45f', 'GOAML_-0f57ee22acfa', true, 'completed', '2025-10-31 20:30:37'),
  ('enhanced', 'GOAML_-96695bb4ac70', 'GOAML_-a68de0f86739', false, 'approved', '2025-07-17 17:27:35'),
  ('basic', 'GOAML_-eeee297a1776', 'GOAML_-3fd389942781', true, 'pending', '2025-07-03 09:22:44'),
  ('premium', 'GOAML_-a11ae519355b', 'GOAML_-f359f192df69', true, 'completed', '2026-04-27 00:15:15')
ON CONFLICT DO NOTHING;


-- ─── grid_cards ───
INSERT INTO "grid_cards" ("gridCardId", "customerId", "cardSerial", "gridSize", "gridValuesEncrypted", "status", "usageCount", "branchCode", "issuedAt", "expiresAt", "lastUsedAt", "createdAt") VALUES
  ('GRID-24c55a10e1e4', 'CUST-dc6ee6b58635', 'GRID_C-c715791d29c7', 'GRID_C-ace86e2722a8', 'GRID_C-f1445f4102cc', 'approved', 1071, 'GRID_C-5c33b1f3f595', '2026-02-05 01:29:57', '2025-02-28 03:39:36', '2025-11-27 15:13:18', '2026-03-11 13:02:38'),
  ('GRID-cb62aff53851', 'CUST-80a119d6f8f9', 'GRID_C-8759f1d3e381', 'GRID_C-5f222d72e232', 'GRID_C-3caf3859fb00', 'active', 9498, 'GRID_C-0998ff353051', '2025-10-28 03:38:02', '2025-02-15 11:49:32', '2025-11-23 20:39:52', '2025-02-05 22:10:40'),
  ('GRID-77bee6fbac68', 'CUST-846db04bb461', 'GRID_C-6d64c12e802b', 'GRID_C-f9012ec6dc34', 'GRID_C-bef61caf7e59', 'completed', 6927, 'GRID_C-a162837d1d3a', '2025-12-21 11:35:37', '2025-04-23 03:18:15', '2025-06-05 15:40:25', '2025-09-17 10:58:42'),
  ('GRID-6582fb4f07a0', 'CUST-8eeffb10f205', 'GRID_C-091478885160', 'GRID_C-b8e2c233c7ec', 'GRID_C-745b82236565', 'completed', 5100, 'GRID_C-431c9095c59f', '2025-02-28 21:57:42', '2025-05-29 11:50:58', '2026-04-06 01:58:32', '2025-11-29 03:43:43'),
  ('GRID-471db237eb99', 'CUST-59da09eabeb1', 'GRID_C-761946b673ce', 'GRID_C-066278803f7b', 'GRID_C-4b4d579e069d', 'active', 3970, 'GRID_C-30fc4ef3132b', '2025-01-23 07:20:30', '2025-08-11 00:36:35', '2025-03-10 19:54:45', '2026-02-11 12:13:00'),
  ('GRID-40fbc9a16850', 'CUST-198543167e8c', 'GRID_C-d30bd49cdcb7', 'GRID_C-b0c58249b6fb', 'GRID_C-bc6ff550446c', 'pending', 4988, 'GRID_C-bc627f7e69c4', '2025-11-02 16:00:56', '2026-04-11 05:46:41', '2025-12-12 05:02:40', '2026-04-01 04:47:48'),
  ('GRID-0069d4170a5c', 'CUST-d4dfc01d0e6b', 'GRID_C-99b6e794ccbc', 'GRID_C-dfac8af4a425', 'GRID_C-912954935f58', 'completed', 7016, 'GRID_C-fc790de522b6', '2025-02-03 01:51:50', '2026-01-10 21:15:42', '2025-02-28 19:44:32', '2025-08-04 20:33:05'),
  ('GRID-75619b5425ec', 'CUST-d22ff8cf0cde', 'GRID_C-7785d4274cc0', 'GRID_C-7b868f0026cc', 'GRID_C-21a6cd300410', 'active', 1782, 'GRID_C-92e989a76b54', '2026-03-30 20:00:24', '2025-02-08 06:41:49', '2025-02-05 05:29:44', '2025-09-09 07:12:33')
ON CONFLICT DO NOTHING;


-- ─── grpc_services ───
INSERT INTO "grpc_services" ("service", "proto", "throughputRps", "compressionRatio", "status", "createdAt") VALUES
  ('GRPC_S-90e9649ce06f', 'GRPC_S-b8bd31ad410b', 930, 'GRPC_S-7abee34a00a0', 'pending', '2025-05-29 22:53:17'),
  ('GRPC_S-ce5b967db32f', 'GRPC_S-7c9ca58a2ae7', 105, 'GRPC_S-4fdfd1a83f29', 'approved', '2025-06-03 03:32:29'),
  ('GRPC_S-fd2bcf504219', 'GRPC_S-4a07133b1bbc', 207, 'GRPC_S-02296e13a6ce', 'approved', '2026-03-29 18:16:46'),
  ('GRPC_S-c265a14d0e22', 'GRPC_S-12b518ac5f83', 708, 'GRPC_S-2a38e7fffe94', 'active', '2026-01-25 15:39:05'),
  ('GRPC_S-59a1ca868486', 'GRPC_S-4b492c72318c', 260, 'GRPC_S-84eb2244fa2f', 'completed', '2026-04-06 07:44:22'),
  ('GRPC_S-6b0a0e4f3478', 'GRPC_S-9e222e51fcc2', 280, 'GRPC_S-e860339ab7d7', 'completed', '2025-04-24 17:23:43'),
  ('GRPC_S-ddb91a79605d', 'GRPC_S-4fb3af94cf74', 857, 'GRPC_S-546f0582a770', 'approved', '2026-02-07 20:12:30'),
  ('GRPC_S-320d78d70928', 'GRPC_S-ebd54db93add', 395, 'GRPC_S-71c6a6bec7fc', 'active', '2025-12-23 05:47:56')
ON CONFLICT DO NOTHING;


-- ─── hot_data_caches ───
INSERT INTO "hot_data_caches" ("service", "cacheType", "maxEntries", "currentEntries", "hitRate", "status", "createdAt") VALUES
  ('HOT_DA-61477fc493ce', 'enhanced', 814, 301, 'HOT_DA-547bf20495ec', 'pending', '2025-05-07 01:48:53'),
  ('HOT_DA-3f635b9b141d', 'full', 241, 480, 'HOT_DA-844da06f2835', 'pending', '2025-02-02 07:22:27'),
  ('HOT_DA-d56e0fde28b7', 'premium', 812, 689, 'HOT_DA-0a3d85014cb7', 'approved', '2025-07-28 12:29:05'),
  ('HOT_DA-f31a3c5ba324', 'full', 449, 171, 'HOT_DA-a5fc43d450a5', 'approved', '2025-12-25 03:06:17'),
  ('HOT_DA-c1cd2eab10d6', 'full', 312, 306, 'HOT_DA-cf9b7a5465cc', 'active', '2025-04-05 16:44:28'),
  ('HOT_DA-d73cdf8bd00e', 'premium', 120, 177, 'HOT_DA-e1ee69d9c55b', 'pending', '2026-03-26 01:36:49'),
  ('HOT_DA-eef092155cc4', 'full', 589, 557, 'HOT_DA-e3f2405c6758', 'processing', '2025-10-31 08:53:02'),
  ('HOT_DA-be6d32f42c31', 'premium', 335, 872, 'HOT_DA-e5fba11391e4', 'processing', '2025-06-29 04:03:12')
ON CONFLICT DO NOTHING;


-- ─── hpa_configs ───
INSERT INTO "hpa_configs" ("deployment", "minReplicas", "maxReplicas", "currentReplicas", "cpuTargetPct", "customMetric", "status", "createdAt") VALUES
  ('HPA_CO-8a53313ed2a6', 677, 284, 962, 200, 'HPA_CO-c1fb8eb19a8b', 'approved', '2026-01-16 10:01:24'),
  ('HPA_CO-780fcc091979', 215, 375, 504, 513, 'HPA_CO-1e12bff5e9e1', 'approved', '2025-07-23 13:47:13'),
  ('HPA_CO-ee47a5c166e6', 584, 998, 182, 229, 'HPA_CO-839dc5733982', 'approved', '2025-04-13 02:12:57'),
  ('HPA_CO-74054231e355', 546, 692, 169, 562, 'HPA_CO-fc0231b3f358', 'approved', '2026-01-31 19:20:17'),
  ('HPA_CO-09834defe3fe', 55, 28, 607, 529, 'HPA_CO-ed515a947d50', 'approved', '2025-05-27 09:07:24'),
  ('HPA_CO-2f474630eeed', 201, 109, 726, 172, 'HPA_CO-74f2a280a980', 'approved', '2025-12-10 02:11:33'),
  ('HPA_CO-ea534d4f64fc', 954, 235, 508, 12, 'HPA_CO-7b1c42fb6d64', 'processing', '2025-04-19 12:42:27'),
  ('HPA_CO-af81e6a344e0', 838, 138, 894, 880, 'HPA_CO-7b77d3da41a3', 'completed', '2025-02-27 13:40:25')
ON CONFLICT DO NOTHING;


-- ─── http2_connections ───
INSERT INTO "http2_connections" ("clientIp", "streams", "maxConcurrentStreams", "windowSize", "serverPushEnabled", "status", "createdAt") VALUES
  ('10.0.172.51', 472, 199, 'HTTP2_-3ea4f0a01a4b', true, 'approved', '2025-06-24 01:06:40'),
  ('10.0.120.124', 910, 323, 'HTTP2_-4e7d8b0f144b', true, 'completed', '2025-06-29 20:01:29'),
  ('10.0.129.17', 192, 650, 'HTTP2_-a4f7cc168345', false, 'completed', '2025-01-01 10:41:45'),
  ('10.0.64.164', 12, 897, 'HTTP2_-23ba4553c199', true, 'active', '2025-10-06 08:28:43'),
  ('10.0.45.38', 625, 434, 'HTTP2_-300b908a39ea', true, 'completed', '2025-09-24 06:24:59'),
  ('10.0.181.251', 569, 731, 'HTTP2_-e574addb6ec9', true, 'completed', '2025-09-28 04:22:22'),
  ('10.0.220.230', 812, 139, 'HTTP2_-1204adeecaec', true, 'processing', '2025-03-15 08:30:34'),
  ('10.0.237.246', 740, 3, 'HTTP2_-fba5df7a9558', true, 'approved', '2025-03-13 13:50:35')
ON CONFLICT DO NOTHING;


-- ─── ijaraContracts ───
INSERT INTO "ijaraContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "assetValue", "rentalAmount", "rentalFrequency", "currency", "leaseStart", "leaseEnd", "tenorMonths", "residualValue", "purchaseOption", "purchasePrice", "totalRentPaid", "status", "shariaCompliance", "maintenanceResponsibility", "createdAt", "updatedAt") VALUES
  ('CONT-b6730639a20c', 'tenant-abuja-digital', 'CUST-7697e792f977', 'Tunde Usman', '10.0.249.8', 'IJARAC-5cfe97a42db9', 211246.76, 4023722.71, 'IJARAC-0c554a6e3775', 'NGN', 'IJARAC-68b2a36a82de', 'IJARAC-7546c9698232', 172, 411851.75, 455, 3413089.55, 4532115.27, 'active', 'IJARAC-0a47c077d9f9', 'IJARAC-dee8a677a1f4', '2025-08-29 04:46:59', '2025-07-14 17:53:01'),
  ('CONT-eec94de1e15f', 'tenant-kano-north', 'CUST-ec032f4727ca', 'Damilola Yakubu', '10.0.3.45', 'IJARAC-b9dcaaff9a43', 669734.98, 6857711.88, 'IJARAC-5dd6e08428f6', 'EUR', 'IJARAC-b7e75b6aea20', 'IJARAC-c7ce3b592b4f', 218, 6226871.29, 763, 4374259.6, 8475057.59, 'active', 'IJARAC-a51104a93a60', 'IJARAC-0df3f5f5603f', '2025-03-05 04:38:20', '2026-03-07 08:54:06'),
  ('CONT-a93a2174af6e', 'tenant-kano-north', 'CUST-ee41a26626ec', 'Grace Balogun', '10.0.33.207', 'IJARAC-2b1fbcd6a0ac', 4978359.3, 3130007.42, 'IJARAC-6721aa099319', 'NGN', 'IJARAC-7d4e234ad9b7', 'IJARAC-b6cde4c6f695', 442, 7160107.4, 139, 13940.27, 9026104.86, 'processing', 'IJARAC-b5f7fc4fc9b7', 'IJARAC-10e36cd053b3', '2025-06-20 06:53:53', '2026-03-17 03:59:43'),
  ('CONT-fb95dce6a8a0', 'tenant-kano-north', 'CUST-038854bff120', 'Musa Adeyemi', '10.0.137.156', 'IJARAC-caefe4a515fb', 2625665.78, 9605059.53, 'IJARAC-94529f011ff4', 'USD', 'IJARAC-915a2dfc222b', 'IJARAC-5e00edde3e44', 416, 9351493.55, 356, 1492366.11, 6156307.2, 'pending', 'IJARAC-295f842b6089', 'IJARAC-7a053fbd50c3', '2026-03-25 06:57:20', '2026-04-23 10:39:15'),
  ('CONT-bb7eed56ac61', 'tenant-lagos-main', 'CUST-41730518c83e', 'Jide Lawal', '10.0.27.5', 'IJARAC-431e0a3d97a7', 7063168.25, 1302329.14, 'IJARAC-a2f030d8e630', 'NGN', 'IJARAC-c1fc1b1c9699', 'IJARAC-879cf1790b26', 85, 2609868.16, 247, 7668971.67, 6395379.04, 'processing', 'IJARAC-0c8feaf40e3d', 'IJARAC-790fd08c2217', '2025-07-02 06:53:08', '2025-01-01 09:32:40'),
  ('CONT-38a07b263cb0', 'tenant-portharcourt', 'CUST-7052f4d9b2b5', 'Lilian Hassan', '10.0.85.177', 'IJARAC-bab25da7280b', 7744148.19, 4164159.4, 'IJARAC-e1d4fca942f9', 'NGN', 'IJARAC-633a69bae6f8', 'IJARAC-5d2f5f171811', 869, 3526642.77, 969, 3364928.99, 6034107.1, 'completed', 'IJARAC-5b9f379dd939', 'IJARAC-9be4bc260686', '2026-01-30 16:36:41', '2025-10-04 10:32:37'),
  ('CONT-e8f3bbbdb63f', 'tenant-lagos-main', 'CUST-6493805e5bf0', 'Ifeoma Dangote', '10.0.240.51', 'IJARAC-12939b076fc1', 9318707.99, 8654774.02, 'IJARAC-5a2b8dbc3e3f', 'NGN', 'IJARAC-edeaa2ec5783', 'IJARAC-21f8ad1128ee', 423, 2553550.43, 41, 8617136.98, 6191272.22, 'processing', 'IJARAC-a352a781de34', 'IJARAC-90dc35cae861', '2025-08-28 06:27:29', '2026-03-13 04:33:18'),
  ('CONT-605be54bb69e', 'tenant-abuja-digital', 'CUST-4042ea4a9611', 'Bukola Taiwo', '10.0.96.250', 'IJARAC-484e27241518', 6316481.2, 3669991.89, 'IJARAC-c70323764e1c', 'GBP', 'IJARAC-3a71101294f3', 'IJARAC-e366440bad77', 198, 6103087.96, 824, 1321177.06, 5460700.8, 'completed', 'IJARAC-d8af06536248', 'IJARAC-37327169f590', '2025-02-17 19:52:39', '2025-09-29 02:59:29')
ON CONFLICT DO NOTHING;


-- ─── image_scans ───
INSERT INTO "image_scans" ("imageName", "registry", "baseImage", "totalVulns", "critical", "high", "medium", "low", "sbomArtifacts", "lastScanned", "status", "createdAt") VALUES
  ('IMAGE_-43d4a0699740', 'IMAGE_-f599f7e03f0c', 'IMAGE_-53798a51b392', 4940, 557, 438, 749, 108, 469, '2026-04-24 00:04:58', 'completed', '2026-03-31 03:14:46'),
  ('IMAGE_-ea250f83841c', 'IMAGE_-50554e41982b', 'IMAGE_-e2558f4fd1df', 2059, 35, 754, 431, 811, 899, '2025-10-01 15:40:23', 'active', '2025-04-11 10:57:33'),
  ('IMAGE_-299345a16f79', 'IMAGE_-79ca5d39e67e', 'IMAGE_-a6fdcec02e49', 7521, 619, 101, 164, 877, 491, '2025-06-19 15:32:24', 'approved', '2026-01-31 14:29:11'),
  ('IMAGE_-01c29616c7b8', 'IMAGE_-615558886c82', 'IMAGE_-30004f471cf3', 6962, 305, 927, 692, 685, 36, '2025-08-16 09:42:16', 'approved', '2025-04-01 15:55:52'),
  ('IMAGE_-0b7b3a81cac8', 'IMAGE_-224eb78a85df', 'IMAGE_-8449c40324cd', 4269, 91, 710, 357, 741, 637, '2026-02-05 16:18:29', 'completed', '2025-03-19 19:31:13'),
  ('IMAGE_-7fcb0acf40ad', 'IMAGE_-d2a0c712930c', 'IMAGE_-2e8d4507c7e3', 4278, 854, 805, 460, 311, 981, '2025-07-03 11:24:09', 'processing', '2025-12-29 20:03:15'),
  ('IMAGE_-23d037e07677', 'IMAGE_-5ddb4cef78a9', 'IMAGE_-95e197a776f1', 8505, 788, 788, 21, 678, 629, '2025-02-23 09:22:14', 'pending', '2025-08-18 13:40:31'),
  ('IMAGE_-41bb3ca19d26', 'IMAGE_-3fd258d5a381', 'IMAGE_-2d96e5a296d5', 1184, 260, 46, 115, 561, 902, '2025-10-09 10:29:42', 'active', '2025-09-21 10:09:58')
ON CONFLICT DO NOTHING;


-- ─── immutable_audit_blocks ───
INSERT INTO "immutable_audit_blocks" ("previousHash", "merkleRoot", "transactions", "validator", "anchoredToChain", "anchorTxHash", "verified", "status", "createdAt") VALUES
  ('IMMUTA-35c42a99e7b0', 'IMMUTA-cc2fe2eaea1c', 706, 'IMMUTA-14c484c51168', 'IMMUTA-3f9fc03fd379', 'IMMUTA-a158c6285557', true, 'active', '2025-06-25 10:50:13'),
  ('IMMUTA-abe512bd8a14', 'IMMUTA-33a5e888f82b', 97, 'IMMUTA-8e6aad186f12', 'IMMUTA-53afea1e78a7', 'IMMUTA-e349a3be027a', true, 'active', '2025-05-26 04:27:43'),
  ('IMMUTA-a31a306d0360', 'IMMUTA-86f01cb7ead1', 761, 'IMMUTA-1a62e4b3e825', 'IMMUTA-516d2705ed8c', 'IMMUTA-f385ed5d1035', true, 'processing', '2026-01-20 09:21:08'),
  ('IMMUTA-4270fc0305ee', 'IMMUTA-c4c82ae01f94', 305, 'IMMUTA-6babd71c2fef', 'IMMUTA-c33786c6f3fa', 'IMMUTA-62d0c767f9b3', true, 'active', '2025-04-03 02:50:35'),
  ('IMMUTA-cf3446fbeb3d', 'IMMUTA-f922b8aaab18', 138, 'IMMUTA-e29d9c293bdd', 'IMMUTA-ca3ff4295d8f', 'IMMUTA-138d865ad63a', true, 'active', '2025-10-15 07:24:11'),
  ('IMMUTA-28bf5236d420', 'IMMUTA-3cf916db5350', 203, 'IMMUTA-57e0217f81e7', 'IMMUTA-d87f37f4f1d0', 'IMMUTA-05158186a284', false, 'approved', '2025-06-28 10:48:19'),
  ('IMMUTA-bd9edcdd7cc7', 'IMMUTA-8a11e19a7cd8', 766, 'IMMUTA-47acedca0adc', 'IMMUTA-681439797c08', 'IMMUTA-596273eecd22', true, 'approved', '2026-03-09 18:29:54'),
  ('IMMUTA-a06a17f13742', 'IMMUTA-3ab251e4bdbb', 148, 'IMMUTA-694342ed229e', 'IMMUTA-5ec1e498bad1', 'IMMUTA-586b3efebb87', true, 'approved', '2025-09-26 02:55:02')
ON CONFLICT DO NOTHING;


-- ─── incidents ───
INSERT INTO "incidents" ("title", "severity", "category", "affectedSystems", "containmentActions", "escalationLevel", "assignee", "detectedAt", "containedAt", "ttdMinutes", "ttcMinutes", "status", "createdAt") VALUES
  ('INCIDE-83e48dc2195b', 'INCIDE-d167f58c26f2', 'general', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 880, 'INCIDE-1390e8fa6c01', '2026-03-15 14:15:32', '2026-03-19 22:35:27', 357, 74, 'approved', '2025-07-31 10:10:41'),
  ('INCIDE-d621d4a13d50', 'INCIDE-15ddcce6354c', 'general', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 548, 'INCIDE-ecfced4e9451', '2025-09-15 01:22:22', '2026-03-09 23:13:38', 78, 211, 'processing', '2025-05-24 07:40:23'),
  ('INCIDE-41cc71fd6683', 'INCIDE-25eb1dd420cd', 'technology', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 641, 'INCIDE-a3d98a098eb2', '2025-03-26 15:25:33', '2026-05-08 03:46:13', 699, 580, 'processing', '2025-01-26 02:46:19'),
  ('INCIDE-839f4e537764', 'INCIDE-ef6d34e68423', 'compliance', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 992, 'INCIDE-54a74d29a7de', '2025-04-02 16:01:35', '2025-04-02 17:47:23', 733, 898, 'active', '2025-09-04 07:30:25'),
  ('INCIDE-c8fb8b3d3d17', 'INCIDE-27c77d342f3d', 'operations', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 929, 'INCIDE-6815395d08be', '2025-04-23 18:39:16', '2026-02-19 11:57:07', 650, 54, 'completed', '2026-01-05 14:12:08'),
  ('INCIDE-1a85bc81f536', 'INCIDE-4ff304cb1e3a', 'general', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 96, 'INCIDE-f0d36ffe4fa4', '2025-02-15 14:39:20', '2025-02-12 18:20:24', 660, 61, 'completed', '2025-01-15 01:26:29'),
  ('INCIDE-fb06d99d0d0a', 'INCIDE-43c0d9b93c00', 'operations', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 7, 'INCIDE-62fe5d01c530', '2025-12-10 14:35:24', '2026-05-08 01:44:01', 963, 219, 'pending', '2025-07-06 18:36:00'),
  ('INCIDE-96abd29a143f', 'INCIDE-feb5aa88d75d', 'general', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 154, 'INCIDE-cccb95b22bdd', '2025-12-02 06:49:35', '2025-08-20 05:22:46', 188, 247, 'approved', '2025-06-24 20:31:41')
ON CONFLICT DO NOTHING;


-- ─── insurance_portfolio_analytics ───
INSERT INTO "insurance_portfolio_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-70574377b7bc', 'Emeka Fashola', 'risk', 'Emeka Fashola - Asaba - Insurance Portfolio Analytics', 'approved', 622884.44, 'Osun', 'REF-633926ABA3', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-09-09 08:21:34', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-67b591e1b9a7', 'Pelumi Adenuga', 'risk', 'Pelumi Adenuga - Enugu - Insurance Portfolio Analytics', 'active', 4040123.57, 'Anambra', 'REF-6CD0891BED', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-02-02 06:42:15', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-6f754f52eb93', 'Gbenga Hassan', 'operations', 'Gbenga Hassan - Asaba - Insurance Portfolio Analytics', 'completed', 6381523.08, 'Borno', 'REF-9E27982A9E', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-03-05 02:12:21', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-d7bb5dc8c7e3', 'Lanre Nwosu', 'compliance', 'Lanre Nwosu - Zaria - Insurance Portfolio Analytics', 'pending', 4496864.31, 'Lagos', 'REF-3130D94F67', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-10-10 04:11:22', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-132e2e14abb2', 'Ibrahim Adeyemi', 'operations', 'Ibrahim Adeyemi - Abeokuta - Insurance Portfolio Analytics', 'completed', 6208404.4, 'Delta', 'REF-DA91D222AB', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-02-17 12:33:49', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-2039343ab0b1', 'Femi Fashola', 'technology', 'Femi Fashola - Garki - Insurance Portfolio Analytics', 'pending', 4993148.47, 'Borno', 'REF-9F0DB8C663', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-06-11 03:33:26', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-dca473bac6ef', 'Segun Dangote', 'technology', 'Segun Dangote - Awka - Insurance Portfolio Analytics', 'completed', 1137437.39, 'Kano', 'REF-1B7C931DEE', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2025-04-21 05:55:41', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-4bf78ce339ad', 'Damilola Adeyemi', 'risk', 'Damilola Adeyemi - Kano - Insurance Portfolio Analytics', 'approved', 2686006.99, 'Rivers', 'REF-8F7EC37564', '{"source": "seed", "table": "insurance_portfolio_analytics"}'::jsonb, '2026-04-19 01:02:01', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── interactive_ussd_agri ───
INSERT INTO "interactive_ussd_agri" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-6983b5658af1', 'Dorcas Adenuga', 'operations', 'Dorcas Adenuga - Lekki - Interactive Ussd Agri', 'approved', 3594756.99, 'Imo', 'REF-33874F8502', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2026-01-21 22:47:32', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-888b26838ce7', 'Tunde Hassan', 'risk', 'Tunde Hassan - Awka - Interactive Ussd Agri', 'completed', 6257920.4, 'Ogun', 'REF-F226A70CB1', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2025-12-29 20:38:25', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-c1f5820744ef', 'Segun Adeyemi', 'operations', 'Segun Adeyemi - Awka - Interactive Ussd Agri', 'approved', 1833964.01, 'Imo', 'REF-266853EA6D', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2025-03-05 02:37:57', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-11b1a2527b9e', 'Titilayo Nwosu', 'lending', 'Titilayo Nwosu - Ikeja - Interactive Ussd Agri', 'active', 2706284.5, 'Plateau', 'REF-256CDABD09', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2026-01-14 20:51:05', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-243f6b283810', 'Bukola Lawal', 'risk', 'Bukola Lawal - Garki - Interactive Ussd Agri', 'completed', 4502864.53, 'Ogun', 'REF-4CBE25AC8C', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2026-01-26 21:23:02', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-ffd48c447cc2', 'Chidinma Okafor', 'finance', 'Chidinma Okafor - Lekki - Interactive Ussd Agri', 'approved', 2911909.45, 'Kano', 'REF-6838D6B31D', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2026-02-10 22:24:24', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-29e353595521', 'Hassan Chukwu', 'compliance', 'Hassan Chukwu - Warri - Interactive Ussd Agri', 'completed', 4849466.13, 'Abuja FCT', 'REF-5BF7E5E8B9', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2026-03-02 02:12:55', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-1c99d0aa11c7', 'Kunle Jimoh', 'payments', 'Kunle Jimoh - Abeokuta - Interactive Ussd Agri', 'active', 8922609.74, 'Edo', 'REF-4B3F1FE30A', '{"source": "seed", "table": "interactive_ussd_agri"}'::jsonb, '2025-02-17 04:12:00', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── investment_orders ───
INSERT INTO "investment_orders" ("tenantId", "customerId", "productType", "productName", "currency", "tenor", "maturityDate", "status", "createdAt") VALUES
  ('tenant-lagos-main', 'CUST-157027f1ba1c', 'enhanced', 'INVEST-3cb0f3e67822', 'NGN', 631, '2026-04-16 07:49:31', 'active', '2025-10-03 20:19:36'),
  ('tenant-portharcourt', 'CUST-2b2e6b5f5ea1', 'enhanced', 'INVEST-5490de60d83f', 'NGN', 404, '2025-12-23 02:51:54', 'processing', '2025-08-14 02:47:58'),
  ('tenant-abuja-digital', 'CUST-87b7d3014891', 'full', 'INVEST-221789a267f8', 'GBP', 845, '2026-04-08 02:39:54', 'pending', '2025-04-27 06:12:14'),
  ('tenant-kano-north', 'CUST-f266583e97d6', 'premium', 'INVEST-96864fdb55a5', 'USD', 411, '2025-04-03 08:23:44', 'pending', '2025-01-25 05:33:11'),
  ('tenant-lagos-main', 'CUST-31968ca5a6d1', 'standard', 'INVEST-2d1c97edab81', 'NGN', 24, '2026-02-22 18:02:57', 'pending', '2025-11-24 09:55:38'),
  ('tenant-abuja-digital', 'CUST-5794382ecd8b', 'enhanced', 'INVEST-a5e017e8c000', 'NGN', 205, '2025-10-08 09:52:44', 'approved', '2025-02-15 23:48:19'),
  ('tenant-whitelabel-zenith', 'CUST-6af9f94dc448', 'full', 'INVEST-bc2a8df6ebb2', 'USD', 772, '2025-08-06 12:56:36', 'processing', '2025-05-05 19:40:50'),
  ('tenant-lagos-main', 'CUST-2d63bc9e3c3c', 'full', 'INVEST-0f7223459b2b', 'NGN', 815, '2025-05-23 22:28:45', 'active', '2025-04-28 03:21:33')
ON CONFLICT DO NOTHING;


-- ─── ip_rules ───
INSERT INTO "ip_rules" ("name", "cidr", "ruleType", "appliesTo", "hits24h", "blocked24h", "geoCountry", "status", "createdAt") VALUES
  ('Dorcas Danladi', 'IP_RUL-3c70a6f51d76', 'enhanced', 'IP_RUL-c68d28a8dab9', 717, 146, 'IP_RUL-0e6b63547c5f', 'active', '2026-05-05 22:05:25'),
  ('Ibrahim Mohammed', 'IP_RUL-3892bb3cca95', 'premium', 'IP_RUL-fe1101fdf31e', 958, 724, 'IP_RUL-dd6015cebeb7', 'pending', '2025-06-27 21:06:08'),
  ('Hauwa Adeyemi', 'IP_RUL-0381366f2139', 'full', 'IP_RUL-2d82d2529ce7', 216, 853, 'IP_RUL-ab1fe6b10400', 'processing', '2026-01-17 13:14:56'),
  ('Grace Chukwu', 'IP_RUL-c110cda333f7', 'premium', 'IP_RUL-664619cad262', 424, 715, 'IP_RUL-6863ce2674d0', 'approved', '2025-01-13 06:59:22'),
  ('Babajide Fashola', 'IP_RUL-7b3be15aeb90', 'standard', 'IP_RUL-471394ec9177', 443, 860, 'IP_RUL-087ffef44fa5', 'processing', '2025-07-27 20:57:48'),
  ('Rahma Balogun', 'IP_RUL-00ec8036e77e', 'standard', 'IP_RUL-4ca5ec7f58d8', 91, 191, 'IP_RUL-90402c8dd8b8', 'pending', '2025-09-04 11:46:31'),
  ('Ibrahim Peterside', 'IP_RUL-10cf20e82176', 'full', 'IP_RUL-d34319ce20d5', 320, 946, 'IP_RUL-12ce1f248951', 'pending', '2026-02-24 19:28:43'),
  ('Adaeze Mohammed', 'IP_RUL-35f153052362', 'basic', 'IP_RUL-3fee78c13101', 110, 698, 'IP_RUL-3325fe9b4096', 'processing', '2025-02-23 06:00:54')
ON CONFLICT DO NOTHING;


-- ─── jwt_validations ───
INSERT INTO "jwt_validations" ("tokenType", "issuer", "audience", "algorithm", "rejections24h", "status", "createdAt") VALUES
  ('basic', 'JWT_VA-36492eff7a96', 'JWT_VA-c819328542a6', 'JWT_VA-d7ace68220b6', 346, 'completed', '2025-02-01 22:16:30'),
  ('full', 'JWT_VA-7d7df0619752', 'JWT_VA-b16af63d0a4d', 'JWT_VA-2cb5cd0a50ff', 114, 'pending', '2025-08-29 07:44:28'),
  ('standard', 'JWT_VA-f60451a01f81', 'JWT_VA-9c00aac289e5', 'JWT_VA-adefa1b90e14', 444, 'approved', '2026-02-25 03:06:07'),
  ('enhanced', 'JWT_VA-f20f5760b66e', 'JWT_VA-90aea8cb833d', 'JWT_VA-4bda27205d8e', 543, 'processing', '2026-01-02 22:52:00'),
  ('enhanced', 'JWT_VA-455b6d99bb23', 'JWT_VA-156cab2b1324', 'JWT_VA-1f5bd5b5dcb0', 539, 'completed', '2025-03-03 19:00:27'),
  ('basic', 'JWT_VA-ba86dde889a5', 'JWT_VA-b3b929bff95d', 'JWT_VA-0c710484da0a', 79, 'completed', '2025-11-27 03:03:08'),
  ('standard', 'JWT_VA-f90376489e58', 'JWT_VA-9bcf2aac5315', 'JWT_VA-e837fd432380', 59, 'completed', '2025-05-11 06:54:37'),
  ('full', 'JWT_VA-a9fdbb8a6b34', 'JWT_VA-2668d41bf2f8', 'JWT_VA-46e9bd5daf91', 684, 'active', '2025-06-30 02:28:51')
ON CONFLICT DO NOTHING;


-- ─── kafka_batch_producers ───
INSERT INTO "kafka_batch_producers" ("topic", "lingerMs", "batchSizeKB", "compressionType", "throughputMps", "status", "createdAt") VALUES
  ('KAFKA_-9a4ac4b6f0c5', 85, 166, 'premium', 834, 'approved', '2026-04-17 06:43:17'),
  ('KAFKA_-5d2f509b12aa', 855, 32, 'enhanced', 913, 'completed', '2025-03-02 01:16:59'),
  ('KAFKA_-96e1f59ae1bd', 206, 668, 'premium', 882, 'approved', '2025-10-05 04:07:23'),
  ('KAFKA_-1ead0281f2f9', 222, 446, 'premium', 663, 'active', '2025-09-04 00:03:51'),
  ('KAFKA_-1935a35524dc', 838, 578, 'enhanced', 145, 'completed', '2026-02-25 13:29:51'),
  ('KAFKA_-75064cd213f4', 761, 425, 'full', 723, 'pending', '2025-07-11 13:06:53'),
  ('KAFKA_-3b4d6cf3c539', 43, 933, 'premium', 277, 'approved', '2025-01-03 23:07:58'),
  ('KAFKA_-f3acd05452ec', 562, 270, 'enhanced', 247, 'active', '2025-03-16 06:34:07')
ON CONFLICT DO NOTHING;


-- ─── kafka_consumer_groups ───
INSERT INTO "kafka_consumer_groups" ("groupId", "topic", "partitions", "consumers", "throughputMps", "status", "createdAt") VALUES
  ('GROU-3338382bbb14', 'KAFKA_-2e9054b1437b', 643, 339, 578, 'completed', '2025-05-03 22:45:26'),
  ('GROU-cc7fd86ec8a4', 'KAFKA_-eef0138e3175', 989, 157, 515, 'processing', '2025-05-03 15:31:41'),
  ('GROU-c44e2d7aa7c3', 'KAFKA_-096655197a08', 575, 355, 973, 'active', '2026-04-13 05:30:31'),
  ('GROU-812659674f3f', 'KAFKA_-e5b53112c9e3', 748, 557, 588, 'approved', '2025-06-29 21:28:01'),
  ('GROU-f14fa6ec2537', 'KAFKA_-9bcc55febdfa', 778, 72, 497, 'processing', '2025-06-18 01:27:36'),
  ('GROU-5a298a180670', 'KAFKA_-11fe6b284f84', 119, 36, 60, 'approved', '2025-03-06 12:09:36'),
  ('GROU-099815ff1d45', 'KAFKA_-77498ff0a3dc', 131, 77, 571, 'approved', '2026-04-20 14:53:01'),
  ('GROU-60f5cee53275', 'KAFKA_-71c4c64afb48', 336, 602, 396, 'completed', '2026-01-02 02:19:00')
ON CONFLICT DO NOTHING;


-- ─── keda_scale_triggers ───
INSERT INTO "keda_scale_triggers" ("scaleObject", "trigger", "metric", "threshold", "currentReplicas", "status", "createdAt") VALUES
  ('KEDA_S-9d8501f8fb40', 'KEDA_S-9b7d5d4c58a0', 'KEDA_S-b92d2758d5ba', 527, 792, 'processing', '2025-06-27 17:50:56'),
  ('KEDA_S-5ddf49d2b29a', 'KEDA_S-e114a8e34ba6', 'KEDA_S-eff4c20393c6', 392, 878, 'approved', '2026-02-08 15:31:13'),
  ('KEDA_S-f160f71c0d50', 'KEDA_S-13606f2de784', 'KEDA_S-cc9f209711dc', 977, 165, 'pending', '2026-03-28 03:52:33'),
  ('KEDA_S-34cf76ecaee0', 'KEDA_S-56d631d76e77', 'KEDA_S-7f600e2addf7', 580, 262, 'processing', '2025-07-08 08:43:09'),
  ('KEDA_S-aa7836260f70', 'KEDA_S-929f57676afc', 'KEDA_S-284a806c41a4', 712, 342, 'pending', '2025-03-15 08:45:37'),
  ('KEDA_S-3ed72ebff54f', 'KEDA_S-19d92eb3315d', 'KEDA_S-1f918968f78b', 399, 702, 'pending', '2025-09-23 23:51:34'),
  ('KEDA_S-7edf80013224', 'KEDA_S-da293fdbcb2b', 'KEDA_S-9aa868a53edc', 71, 15, 'active', '2025-01-07 11:12:21'),
  ('KEDA_S-df18d8d6038c', 'KEDA_S-1bad1e5c791d', 'KEDA_S-86117b30544f', 400, 346, 'pending', '2026-01-20 17:59:29')
ON CONFLICT DO NOTHING;


-- ─── keepalive_configs ───
INSERT INTO "keepalive_configs" ("service", "keepAliveTimeout", "maxIdlePerHost", "activeConnections", "reuseRate", "status", "createdAt") VALUES
  ('KEEPAL-1281d8915598', 249, 738, 854, 'KEEPAL-84a12ff174a1', 'completed', '2025-06-01 07:37:08'),
  ('KEEPAL-d0a66650dbb8', 264, 65, 290, 'KEEPAL-6c7cf9911e2d', 'processing', '2025-04-12 22:05:29'),
  ('KEEPAL-340df93c00e3', 448, 705, 403, 'KEEPAL-b4650e437a8d', 'active', '2025-01-25 18:51:57'),
  ('KEEPAL-7149273c5434', 283, 707, 622, 'KEEPAL-ee844220ae76', 'active', '2025-08-01 17:29:52'),
  ('KEEPAL-27b9ee4d292e', 714, 715, 231, 'KEEPAL-853096c66bb2', 'processing', '2026-01-08 05:10:50'),
  ('KEEPAL-4f45ac8742f5', 911, 711, 362, 'KEEPAL-c48156bd286b', 'completed', '2025-06-12 00:53:58'),
  ('KEEPAL-9cf663673421', 45, 99, 97, 'KEEPAL-28f8807f15fb', 'processing', '2025-07-28 04:20:09'),
  ('KEEPAL-f56d49b99ef6', 43, 800, 880, 'KEEPAL-3d8e930b8656', 'active', '2025-10-29 20:35:19')
ON CONFLICT DO NOTHING;


-- ─── key_rotation_schedules ───
INSERT INTO "key_rotation_schedules" ("keyId", "algorithm", "rotationInterval", "gracePeriod", "activeVersion", "previousVersion", "nextRotation", "rotationsCompleted", "failedRotations", "status", "createdAt") VALUES
  ('KEYI-c20e3cc9adae', 'KEY_RO-e9a4506db33d', '22954059327', '2025-10', 4, 8, '2026-02-24 22:30:49', 214, 550, 'completed', '2025-08-04 00:27:19'),
  ('KEYI-40bce4692eb0', 'KEY_RO-3bd758988347', '22587848655', '2025-07', 4, 10, '2025-11-24 03:26:27', 353, 792, 'completed', '2026-03-19 15:55:48'),
  ('KEYI-3abfce33fa8c', 'KEY_RO-05bd2a985b8e', '22438276451', '2025-07', 4, 2, '2025-05-02 17:44:16', 843, 815, 'pending', '2025-08-19 09:25:52'),
  ('KEYI-e5696e724186', 'KEY_RO-cb770d9745c9', '22786917344', '2025-05', 2, 2, '2026-04-12 07:24:22', 129, 661, 'active', '2025-03-31 11:18:00'),
  ('KEYI-3876183eda73', 'KEY_RO-29d9bfa5e950', '22266424664', '2025-10', 4, 5, '2026-01-18 00:27:15', 552, 207, 'processing', '2025-09-29 06:17:32'),
  ('KEYI-b785920dc213', 'KEY_RO-3dfd0ccfdb86', '22846110602', '2025-10', 9, 8, '2025-08-28 17:52:49', 213, 855, 'approved', '2025-10-22 05:30:38'),
  ('KEYI-f98ad26a315c', 'KEY_RO-2b1cdf43f900', '22563541629', '2025-02', 9, 7, '2025-03-02 10:03:41', 143, 645, 'approved', '2026-03-10 17:58:36'),
  ('KEYI-49596b7c093b', 'KEY_RO-261c07572e26', '22479421938', '2025-03', 10, 2, '2025-03-23 03:35:09', 267, 326, 'completed', '2025-10-23 12:50:09')
ON CONFLICT DO NOTHING;


-- ─── kms_keys ───
INSERT INTO "kms_keys" ("provider", "keyId", "algorithm", "usage", "state", "rotationEnabled", "status", "createdAt") VALUES
  ('NIBSS', 'KEYI-504a2ee333db', 'KMS_KE-5712c1e020aa', 'KMS_KE-39cc03fb9c62', 'Kaduna', true, 'approved', '2025-02-27 03:15:25'),
  ('Prembly', 'KEYI-cbc16770edaf', 'KMS_KE-101bccf2dfec', 'KMS_KE-a1aea5b9ce1b', 'Kano', false, 'processing', '2025-12-08 20:30:27'),
  ('Smile Identity', 'KEYI-f5d2aff195f7', 'KMS_KE-1169903d0e03', 'KMS_KE-d4f4c472235b', 'Enugu', false, 'pending', '2026-01-31 12:05:46'),
  ('Smile Identity', 'KEYI-e6dd8aed9ac6', 'KMS_KE-f87a5a1b4568', 'KMS_KE-60c68d32e32d', 'Lagos', false, 'pending', '2025-06-03 18:45:59'),
  ('NIBSS', 'KEYI-0a96cc2eb714', 'KMS_KE-6bd756d3eed4', 'KMS_KE-b9fab7feb825', 'Ogun', true, 'pending', '2025-02-26 02:13:10'),
  ('Dojah', 'KEYI-910df3dcd679', 'KMS_KE-716f48c7becb', 'KMS_KE-295f44125504', 'Delta', true, 'completed', '2025-11-26 22:59:12'),
  ('NIMC', 'KEYI-287078fd2ae1', 'KMS_KE-8e015b562535', 'KMS_KE-dd0fc3d6c8d9', 'Kano', true, 'completed', '2025-01-21 15:27:15'),
  ('NIMC', 'KEYI-df9ef0f1a979', 'KMS_KE-d042e7ff6fd0', 'KMS_KE-82f7198e0138', 'Rivers', true, 'processing', '2025-01-12 00:23:04')
ON CONFLICT DO NOTHING;


-- ─── kpi_branches ───
INSERT INTO "kpi_branches" ("branchId", "name", "state", "lga", "latitude", "longitude", "transactionsDaily", "customers", "nplPct", "status", "createdAt", "updatedAt") VALUES
  ('BRAN-dacfc1bb5702', 'Dorcas Elumelu', 'Edo', 'Kano', 7.173603, 10.19064, 753, 918, 2725742.04, 'active', '2025-05-01 08:12:36', '2026-04-08 16:33:32'),
  ('BRAN-88b2ddf4f5cf', 'Lanre Dangote', 'Imo', 'Anambra', 8.87085, 10.772788, 772, 741, 9965816.83, 'approved', '2025-09-28 01:35:08', '2025-01-05 01:28:20'),
  ('BRAN-c24766cd3be2', 'Sade Taiwo', 'Enugu', 'Delta', 7.841876, 3.01303, 451, 612, 1350742.71, 'pending', '2025-02-21 17:24:06', '2026-04-28 03:03:20'),
  ('BRAN-dd35ba0dc8b8', 'Rahma Peterside', 'Abuja FCT', 'Plateau', 5.693606, 2.038824, 62, 285, 5505.36, 'processing', '2025-06-30 13:25:34', '2026-01-02 18:01:57'),
  ('BRAN-9610e07f7d55', 'Uche Peterside', 'Kano', 'Lagos', 6.631181, 12.535616, 939, 125, 305055.62, 'processing', '2026-04-14 20:56:02', '2025-12-16 20:14:39'),
  ('BRAN-46e52d500d42', 'Grace Chukwu', 'Rivers', 'Imo', 11.388063, 14.405804, 160, 19, 6299991.62, 'processing', '2026-03-03 01:30:53', '2026-01-11 20:59:13'),
  ('BRAN-260a02e97261', 'Olumide Nwosu', 'Kwara', 'Kaduna', 9.342787, 13.009507, 718, 366, 8605251.83, 'approved', '2025-04-04 19:15:00', '2025-11-05 05:38:21'),
  ('BRAN-2d063a35d5c7', 'Tunde Nwosu', 'Anambra', 'Rivers', 8.054667, 6.296097, 497, 102, 2505785.34, 'pending', '2026-04-17 21:36:49', '2025-06-27 03:44:53')
ON CONFLICT DO NOTHING;


-- ─── kpi_composite_scores ───
INSERT INTO "kpi_composite_scores" ("roleKey", "personnelId", "ownScore", "rollupScore", "compositeScore", "status", "cadence", "periodStart", "periodEnd", "variablePayMultiplier", "createdAt") VALUES
  ('KPI_CO-5c19af7e2bdd', 'PERS-66426947e04c', 97.5201, 30.3747, 58.4844, 'approved', 'KPI_CO-431616a75e64', '2026-02-02 14:34:35', '2026-03-27 20:28:44', 9765647.42, '2026-03-13 02:31:05'),
  ('KPI_CO-6a1eda9556b5', 'PERS-43b894a8bfb7', 18.7965, 86.82, 72.1282, 'active', 'KPI_CO-6c9016dc3311', '2025-09-02 15:19:48', '2026-04-13 22:19:59', 5182560.0, '2025-05-01 09:38:56'),
  ('KPI_CO-f3c46323d9c2', 'PERS-951412cce4e0', 61.086, 77.2458, 90.7277, 'active', 'KPI_CO-c2df3564750a', '2026-04-21 03:02:00', '2025-10-05 04:34:27', 8110452.27, '2025-01-06 23:41:03'),
  ('KPI_CO-7be484447c91', 'PERS-4580a90776b0', 44.0278, 76.5095, 6.4331, 'processing', 'KPI_CO-3219e3e78ccd', '2026-04-05 03:50:12', '2025-11-12 07:20:15', 5807135.7, '2025-05-07 20:36:49'),
  ('KPI_CO-e630d088ce80', 'PERS-762802f08f09', 58.6872, 11.9211, 30.2802, 'completed', 'KPI_CO-ce409b2c47fb', '2026-04-13 08:14:40', '2025-09-17 09:17:12', 6903438.18, '2025-05-17 10:36:22'),
  ('KPI_CO-36bd40565d3b', 'PERS-daeb8d4a8c45', 75.4266, 52.8103, 16.3693, 'approved', 'KPI_CO-d7a576f567e1', '2025-01-21 17:30:34', '2026-02-05 04:28:28', 7047231.43, '2025-09-10 05:13:35'),
  ('KPI_CO-78afce31e2f6', 'PERS-7000ef496cec', 52.4107, 66.1634, 91.1548, 'active', 'KPI_CO-bdd00c56916c', '2026-02-16 21:18:19', '2025-02-11 20:56:21', 7974926.76, '2026-05-09 01:53:21'),
  ('KPI_CO-c064d2cc0279', 'PERS-ab7ba94897b8', 7.0162, 75.5951, 11.1269, 'processing', 'KPI_CO-7a9e4070f2e6', '2026-01-20 23:38:56', '2026-04-14 04:01:02', 7378892.41, '2026-03-12 02:58:03')
ON CONFLICT DO NOTHING;


-- ─── kpi_hierarchy ───
INSERT INTO "kpi_hierarchy" ("parentRoleKey", "childRoleKey", "rollupWeight", "createdAt") VALUES
  ('KPI_HI-309b7d3720b8', 'KPI_HI-7116327d3e4c', 623209.22, '2025-03-30 22:57:01'),
  ('KPI_HI-4679e2e90f90', 'KPI_HI-6ae288f6b078', 2215409.28, '2025-12-27 03:36:31'),
  ('KPI_HI-4693f64b616a', 'KPI_HI-7692ae6800af', 3887259.6, '2026-02-11 14:57:43'),
  ('KPI_HI-cbae203fbd10', 'KPI_HI-e52e714353ce', 1876370.83, '2025-12-02 17:24:52'),
  ('KPI_HI-a44a0f7ffde3', 'KPI_HI-22febd83dc12', 6761937.76, '2026-04-16 15:33:43'),
  ('KPI_HI-b654c2acde06', 'KPI_HI-80fa3fd95e43', 7989769.55, '2025-09-08 02:24:35'),
  ('KPI_HI-f2f9a05fd999', 'KPI_HI-a701d6d7bfad', 8826408.55, '2025-01-17 16:35:11'),
  ('KPI_HI-0e4a29a58ed3', 'KPI_HI-acc26ffc77fa', 9331256.95, '2025-05-11 17:36:50')
ON CONFLICT DO NOTHING;


-- ─── kpi_metrics ───
INSERT INTO "kpi_metrics" ("metricKey", "roleKey", "name", "description", "category", "unit", "direction", "weight", "greenThreshold", "amberThreshold", "frequency", "dataSource", "sqlQuery", "createdAt") VALUES
  ('KPI_ME-66418642565c', 'KPI_ME-04df1e7f1c3c', 'Chidinma Elumelu', 'Jumoke Usman - Wuse, Edo - kpi_metrics record', 'finance', 'KPI_ME-d7d61995fdcd', 'KPI_ME-ccac5c5e68f9', 6155082.76, 3872291.43, 3245431.83, 'KPI_ME-b0ebe8ce669b', 'KPI_ME-7febbc38ce8f', 'KPI_ME-7856c8de9d62', '2026-03-13 13:22:05'),
  ('KPI_ME-633b1f20a881', 'KPI_ME-e047bcc17691', 'Adaeze Garba', 'Lanre Yakubu - Awka, Ogun - kpi_metrics record', 'finance', 'KPI_ME-a78b426d2744', 'KPI_ME-414f2b5c7f60', 5799787.51, 5650125.91, 6653028.43, 'KPI_ME-fe49d9bda522', 'KPI_ME-56231a8b07db', 'KPI_ME-752195420354', '2025-05-11 09:35:52'),
  ('KPI_ME-016b1b0073ec', 'KPI_ME-900f79d1d17b', 'Damilola Peterside', 'Tunde Balogun - Port Harcourt, Kwara - kpi_metrics record', 'compliance', 'KPI_ME-7d52eeb7395b', 'KPI_ME-91331b49f683', 6359814.17, 4848484.52, 2194795.57, 'KPI_ME-aec88af77917', 'KPI_ME-8c8468d0e584', 'KPI_ME-4369ecf39368', '2025-03-31 11:47:16'),
  ('KPI_ME-1925d720c33c', 'KPI_ME-89565a0395ad', 'Emeka Kalu', 'Hassan Eze - Enugu, Enugu - kpi_metrics record', 'operations', 'KPI_ME-18b09ad5fe2a', 'KPI_ME-97a642da565e', 506033.87, 6302280.63, 8841912.05, 'KPI_ME-1fb2f65add1e', 'KPI_ME-2ea77b5a4e73', 'KPI_ME-6d2ae39eb258', '2025-06-28 00:24:00'),
  ('KPI_ME-809b47f8940c', 'KPI_ME-056322fbb3cb', 'Dorcas Mohammed', 'Adewale Jimoh - Ikeja, Edo - kpi_metrics record', 'finance', 'KPI_ME-58b3aed430b1', 'KPI_ME-44e192caefac', 4328651.02, 909516.38, 6727977.8, 'KPI_ME-505c12f63d66', 'KPI_ME-fa332bfd433d', 'KPI_ME-54e7a50df5f7', '2025-04-08 03:21:43'),
  ('KPI_ME-cdc48d93ebcd', 'KPI_ME-1664edbb55e3', 'Babajide Sanusi', 'Adaeze Adenuga - Asaba, Lagos - kpi_metrics record', 'compliance', 'KPI_ME-0ff0653af9f2', 'KPI_ME-2bae44f70d78', 39566.86, 8787174.97, 8735703.1, 'KPI_ME-6f388d7f17c6', 'KPI_ME-022e881095f0', 'KPI_ME-5ccb89f2da76', '2026-03-26 03:26:17'),
  ('KPI_ME-adea0d32b27c', 'KPI_ME-b1166f0aeda6', 'Chidinma Fashola', 'Babajide Garba - Enugu, Rivers - kpi_metrics record', 'technology', 'KPI_ME-0ec94b9cbb56', 'KPI_ME-b2e593b68b5b', 4746835.8, 4007089.33, 2161983.3, 'KPI_ME-0fd035fa243a', 'KPI_ME-ed61e938c202', 'KPI_ME-fd140b9055af', '2025-05-23 11:52:37'),
  ('KPI_ME-81408553b9cb', 'KPI_ME-53cf408f5c2d', 'Lilian Okafor', 'Hauwa Adenuga - Zaria, Oyo - kpi_metrics record', 'general', 'KPI_ME-9d6a14889f85', 'KPI_ME-096bc5db9166', 7355964.41, 7723047.76, 444950.47, 'KPI_ME-a96a4c96e63c', 'KPI_ME-114f1c4f16aa', 'KPI_ME-99a37524b1c3', '2025-02-02 12:50:16')
ON CONFLICT DO NOTHING;


-- ─── kpi_notification_events ───
INSERT INTO "kpi_notification_events" ("ruleKey", "roleKey", "metricKey", "currentValue", "thresholdValue", "severity", "status", "message", "firedAt", "acknowledgedAt", "resolvedAt", "acknowledgedBy") VALUES
  ('KPI_NO-63c60fe9d623', 'KPI_NO-afe66adc3ed2', 'KPI_NO-f26eb0be050b', 1347468.46, 4712225.49, 'KPI_NO-b7aba6ab9873', 'pending', 'KPI_NO-3de131957ed0', '2025-02-26 08:00:11', '2025-07-03 08:45:44', '2025-09-27 00:30:55', 'KPI_NO-254f7b5bcbe9'),
  ('KPI_NO-4325a8151deb', 'KPI_NO-c1dc042bbf43', 'KPI_NO-a83c72d1708e', 3779582.71, 5419752.44, 'KPI_NO-403e4a332f3a', 'pending', 'KPI_NO-f77a0ff03113', '2025-02-10 06:57:18', '2025-04-17 08:25:20', '2026-02-17 07:05:48', 'KPI_NO-e030a0046718'),
  ('KPI_NO-7c94021d9207', 'KPI_NO-27df16a6cb42', 'KPI_NO-86ba59937929', 5470326.73, 7174581.56, 'KPI_NO-455a93d9ade1', 'completed', 'KPI_NO-9ed69ad3d6c2', '2025-03-25 03:31:42', '2025-03-17 23:54:48', '2026-03-18 22:58:29', 'KPI_NO-3d8dbfb50c91'),
  ('KPI_NO-acbfebc7e658', 'KPI_NO-fe35077413e3', 'KPI_NO-598382c21f4a', 8579761.41, 2776876.29, 'KPI_NO-fdd286f41ab9', 'completed', 'KPI_NO-a27cb08b9977', '2025-05-29 12:50:56', '2025-09-05 19:11:45', '2026-01-05 00:37:44', 'KPI_NO-cad75faa130f'),
  ('KPI_NO-f0dd86b96689', 'KPI_NO-5cfd282bff6c', 'KPI_NO-ac79f6c86415', 134343.58, 1480754.39, 'KPI_NO-006bae1f6f42', 'pending', 'KPI_NO-247c2276e088', '2026-02-06 20:17:00', '2026-02-19 13:03:01', '2025-07-14 21:15:08', 'KPI_NO-6b2cb1a4ca86'),
  ('KPI_NO-ee82ffdb6cdf', 'KPI_NO-2fb6822a1e03', 'KPI_NO-3fb83fbb1474', 9234166.09, 7231013.14, 'KPI_NO-0849f374734a', 'approved', 'KPI_NO-3bca53460fbe', '2025-04-18 13:04:14', '2025-02-28 13:20:21', '2025-04-01 20:17:44', 'KPI_NO-6b246afeaa00'),
  ('KPI_NO-e86e0f3a4d54', 'KPI_NO-458affbaa568', 'KPI_NO-95b43b6474dd', 7014520.0, 2895652.92, 'KPI_NO-db0d36f82ab6', 'processing', 'KPI_NO-a9e909482e09', '2025-04-06 11:11:11', '2025-10-24 20:41:43', '2025-11-30 07:27:27', 'KPI_NO-fb6ff8d7a6a2'),
  ('KPI_NO-5329b7ef6cbf', 'KPI_NO-0bb131e2fa7f', 'KPI_NO-9390956ea756', 3915420.38, 3258378.11, 'KPI_NO-8673171da551', 'approved', 'KPI_NO-514d9420c7e6', '2025-08-06 10:54:07', '2026-03-24 07:00:44', '2025-04-11 03:51:33', 'KPI_NO-6cad798df4a5')
ON CONFLICT DO NOTHING;


-- ─── kpi_notification_rules ───
INSERT INTO "kpi_notification_rules" ("ruleKey", "roleKey", "metricKey", "condition", "thresholdValue", "severity", "channels", "escalationChain", "cooldownMinutes", "enabled", "description", "createdAt") VALUES
  ('KPI_NO-a9c6c44ee588', 'KPI_NO-63cfd21ab3fc', 'KPI_NO-3cbfe769b473', 'KPI_NO-a2f3b90b6213', 8365445.3, 'KPI_NO-3ecd151012da', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 359, false, 'Emeka Fashola - Lekki, Borno - kpi_notification_rules record', '2026-03-24 09:24:47'),
  ('KPI_NO-e41b70bec230', 'KPI_NO-61d2c8dc7317', 'KPI_NO-1dcbc07c026b', 'KPI_NO-520f704e6de8', 7195394.08, 'KPI_NO-650087ea1247', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 560, false, 'Rahma Otedola - Victoria Island, Delta - kpi_notification_rules record', '2025-10-06 14:30:47'),
  ('KPI_NO-d01937d5d86b', 'KPI_NO-64ef353a6e84', 'KPI_NO-859e3407b767', 'KPI_NO-3fe6f73ca253', 2630770.12, 'KPI_NO-af743d276964', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 805, true, 'Uzo Taiwo - Awka, Delta - kpi_notification_rules record', '2025-06-01 08:56:19'),
  ('KPI_NO-cc3e81826121', 'KPI_NO-b66c3ea53893', 'KPI_NO-1d5605277e8a', 'KPI_NO-3997ef239f10', 6632703.68, 'KPI_NO-2e63c31d4114', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 967, false, 'Esther Kalu - Garki, Kwara - kpi_notification_rules record', '2025-10-09 13:53:45'),
  ('KPI_NO-33e12dd3dfb6', 'KPI_NO-d71eec210fc0', 'KPI_NO-4fe71e9ea01f', 'KPI_NO-9d4eef7a9a96', 7085163.12, 'KPI_NO-f59ff05b7528', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 905, true, 'Lilian Adeyemi - Kano, Abuja FCT - kpi_notification_rules record', '2025-10-17 01:43:26'),
  ('KPI_NO-98fa529e3913', 'KPI_NO-ca77bcddb698', 'KPI_NO-5f32b0b5b003', 'KPI_NO-c2c90477f9ad', 2652908.28, 'KPI_NO-de6b62b1a7d5', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 632, false, 'Rasheed Usman - Victoria Island, Edo - kpi_notification_rules record', '2025-01-21 13:27:33'),
  ('KPI_NO-e7c1918deb19', 'KPI_NO-40eeb3f0eaa0', 'KPI_NO-3981780ef8af', 'KPI_NO-fa8fda9fa597', 224635.22, 'KPI_NO-ebd3fd61df2b', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 645, true, 'Tunde Adeyemi - Awka, Abuja FCT - kpi_notification_rules record', '2025-06-29 03:25:50'),
  ('KPI_NO-dde6d5e13eed', 'KPI_NO-f8016d780a31', 'KPI_NO-1a7b4ca9613d', 'KPI_NO-323d7b8fdf91', 5963526.5, 'KPI_NO-0ebe24470809', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 527, false, 'Fatima Sanusi - Zaria, Enugu - kpi_notification_rules record', '2025-10-27 09:30:26')
ON CONFLICT DO NOTHING;


-- ─── kpi_roles ───
INSERT INTO "kpi_roles" ("roleKey", "title", "department", "level", "reportsTo", "fixedRatio", "variableRatio", "description", "createdAt") VALUES
  ('KPI_RO-b3f5b4d236d7', 'KPI_RO-71bb89de52bc', 'KPI_RO-0a628adb4ce3', 670, 'KPI_RO-7229c03745b9', 430, 732, 'Uzo Balogun - Lekki, Osun - kpi_roles record', '2025-10-20 08:06:13'),
  ('KPI_RO-4d6969f11267', 'KPI_RO-e32871a83faa', 'KPI_RO-66b9c9a27d3c', 405, 'KPI_RO-3098362e9191', 292, 632, 'Pelumi Jimoh - Wuse, Abuja FCT - kpi_roles record', '2025-03-04 18:40:56'),
  ('KPI_RO-3a41a7003f36', 'KPI_RO-506e61526e2c', 'KPI_RO-66e60ca8abb7', 400, 'KPI_RO-8a1c23d5494c', 795, 515, 'Pelumi Dangote - Ikeja, Delta - kpi_roles record', '2025-04-26 23:45:56'),
  ('KPI_RO-ca18fcda13e9', 'KPI_RO-2b0bc1261235', 'KPI_RO-29ec24d6dc69', 285, 'KPI_RO-d934db450bf3', 117, 953, 'Olumide Adeyemi - Port Harcourt, Anambra - kpi_roles record', '2025-12-04 17:34:19'),
  ('KPI_RO-17bc0a3e29d7', 'KPI_RO-3a2161b31903', 'KPI_RO-ebcde115d652', 517, 'KPI_RO-9888e567d0dd', 271, 89, 'Damilola Peterside - Ibadan, Edo - kpi_roles record', '2025-02-13 22:51:18'),
  ('KPI_RO-43f0cf3110ad', 'KPI_RO-e4e40161112f', 'KPI_RO-0de2e8f1037d', 452, 'KPI_RO-336577bc512f', 858, 273, 'Nnamdi Sanusi - Benin City, Abuja FCT - kpi_roles record', '2026-01-15 16:28:44'),
  ('KPI_RO-2e016d1c1d4f', 'KPI_RO-6e323d5ee159', 'KPI_RO-9df17f485394', 581, 'KPI_RO-fd9a17b71b82', 195, 111, 'Nneka Danladi - Enugu, Kwara - kpi_roles record', '2025-09-22 16:01:23'),
  ('KPI_RO-b6ec2b05bc2f', 'KPI_RO-ae3348359148', 'KPI_RO-313e6e4ce6e5', 833, 'KPI_RO-1705b361a073', 867, 795, 'Grace Chukwu - Warri, Enugu - kpi_roles record', '2025-08-22 03:17:24')
ON CONFLICT DO NOTHING;


-- ─── kpi_scores ───
INSERT INTO "kpi_scores" ("metricKey", "roleKey", "personnelId", "value", "normalizedScore", "status", "cadence", "periodStart", "periodEnd", "metadata", "createdAt") VALUES
  ('KPI_SC-a431d080cfbb', 'KPI_SC-1caad6267a80', 'PERS-83c251d242f6', 356313.71, 62.119, 'approved', 'KPI_SC-4426dc6ac5ea', '2025-07-18 13:42:56', '2025-06-22 10:11:59', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-05-31 18:54:58'),
  ('KPI_SC-4b747a203b23', 'KPI_SC-30d71ad02233', 'PERS-59ca93b979bb', 6654782.92, 29.1527, 'active', 'KPI_SC-b0d2fcbaeaf8', '2025-02-09 00:06:02', '2025-11-10 16:10:34', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2025-12-25 19:35:23'),
  ('KPI_SC-fad53ea4e00b', 'KPI_SC-573fe9416beb', 'PERS-86215e502a66', 7134126.26, 27.2461, 'approved', 'KPI_SC-b3b621240816', '2026-03-23 20:39:41', '2026-04-17 23:00:43', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2025-07-13 18:55:46'),
  ('KPI_SC-906844711d08', 'KPI_SC-e2ee77cedca9', 'PERS-d15b21653898', 9015048.43, 76.5033, 'processing', 'KPI_SC-95565b6eb861', '2025-07-09 05:16:29', '2025-09-03 15:14:51', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-06-01 00:44:10'),
  ('KPI_SC-86bd75c50b16', 'KPI_SC-5d2b83e5bb70', 'PERS-4e7d685604a6', 4894882.99, 31.7173, 'active', 'KPI_SC-e5ced8232040', '2026-03-11 10:38:16', '2025-02-19 14:35:57', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2025-12-19 20:52:36'),
  ('KPI_SC-6ab9163abae0', 'KPI_SC-013119ed9cf8', 'PERS-8238a3d00c1d', 1637813.06, 94.3284, 'pending', 'KPI_SC-c43707b38c08', '2026-02-06 09:44:08', '2025-05-09 03:58:39', '{"source": "seed", "tenant": "tenant-portharcourt"}'::jsonb, '2026-02-26 10:07:28'),
  ('KPI_SC-04cdc8a7cd9b', 'KPI_SC-fc25a7a06ce3', 'PERS-9650e7bf7176', 6159761.27, 20.2016, 'active', 'KPI_SC-f381260e1389', '2025-12-29 05:28:13', '2025-03-14 20:36:15', '{"source": "seed", "tenant": "tenant-whitelabel-zenith"}'::jsonb, '2026-04-06 03:58:27'),
  ('KPI_SC-b882dc27b22b', 'KPI_SC-f4189965f484', 'PERS-d89266959dff', 3898343.24, 27.4875, 'approved', 'KPI_SC-ee985b8f775d', '2026-04-10 19:31:27', '2026-03-10 03:46:47', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-01-04 16:04:54')
ON CONFLICT DO NOTHING;


-- ─── kyb_enforcement_verifications ───
INSERT INTO "kyb_enforcement_verifications" ("verificationId", "companyId", "rcNumber", "tenantId", "level", "status", "cacVerified", "tinVerified", "uboVerified", "directorScreened", "sanctionsCleared", "verifiedBy", "verifiedAt", "expiresAt", "createdAt", "updatedAt") VALUES
  ('VERI-661e2fd7a284', 'COMP-c670b1f7711f', 'KYB_EN-e08e6092b752', 'tenant-whitelabel-zenith', 'KYB_EN-82087bdf7b17', 'completed', true, true, true, true, true, 'KYB_EN-307b900704ae', '2026-02-24 19:12:54', '2025-07-14 21:31:04', '2025-07-22 12:05:16', '2025-12-24 00:07:30'),
  ('VERI-c48294b472bd', 'COMP-8c19edf74ab1', 'KYB_EN-9fe2239aa347', 'tenant-portharcourt', 'KYB_EN-69847746e322', 'processing', false, true, true, true, true, 'KYB_EN-5e8d80fdbff9', '2025-07-10 02:03:48', '2025-04-09 07:05:01', '2025-10-19 08:24:12', '2026-01-11 14:41:36'),
  ('VERI-5a2c19d80ea3', 'COMP-7e14c6bfadb4', 'KYB_EN-257c262e2988', 'tenant-whitelabel-zenith', 'KYB_EN-8c2d1859fb76', 'pending', false, true, true, false, true, 'KYB_EN-e0976df79376', '2025-11-16 03:01:13', '2025-07-21 03:46:58', '2025-09-17 04:06:59', '2026-03-11 06:05:35'),
  ('VERI-b5b91d6bf535', 'COMP-d28693afa0b7', 'KYB_EN-86f06ae8c95b', 'tenant-abuja-digital', 'KYB_EN-a3c8c30c1cea', 'active', true, false, true, false, true, 'KYB_EN-ff31fea2420a', '2025-06-19 20:47:27', '2026-01-05 03:53:35', '2025-12-16 12:11:46', '2025-11-28 08:47:47'),
  ('VERI-0853ad6e7b67', 'COMP-248f73f8f226', 'KYB_EN-cfed5172e006', 'tenant-kano-north', 'KYB_EN-b2094217b6e7', 'completed', false, false, true, true, true, 'KYB_EN-74868aad8b52', '2025-06-12 01:08:26', '2025-09-27 09:27:47', '2025-01-06 03:20:27', '2025-01-18 10:02:01'),
  ('VERI-568d86639ce0', 'COMP-910638d4d450', 'KYB_EN-d743a674a913', 'tenant-whitelabel-zenith', 'KYB_EN-80ee5c9aa3f2', 'pending', true, true, true, false, false, 'KYB_EN-f6f67e8d0486', '2025-07-08 02:51:57', '2025-06-12 03:15:04', '2025-03-04 16:11:14', '2025-06-27 19:33:59'),
  ('VERI-07ab1aa93570', 'COMP-022dcc69d9a6', 'KYB_EN-86284b96508c', 'tenant-lagos-main', 'KYB_EN-692ca03e3e02', 'approved', true, true, false, true, true, 'KYB_EN-52dc60711bbd', '2025-07-25 03:30:33', '2025-10-24 00:31:24', '2025-02-20 08:35:59', '2026-01-27 20:07:02'),
  ('VERI-33830d01e160', 'COMP-4993a9a98a7c', 'KYB_EN-d86d42041cb2', 'tenant-kano-north', 'KYB_EN-9e0ec36fd73f', 'active', true, true, true, false, true, 'KYB_EN-a2a354ef43a4', '2025-08-02 16:11:24', '2025-03-11 08:22:29', '2025-04-24 15:29:52', '2026-04-24 14:49:11')
ON CONFLICT DO NOTHING;


-- ─── kyc_data_quality_metrics ───
INSERT INTO "kyc_data_quality_metrics" ("totalCustomers", "kycComplete", "kycCompletePct", "expiredDocuments", "duplicateBVN", "missingNIN", "snapshotDate") VALUES
  (8324, 214, 8490829.6, 432, 72, 596, '2026-04-23 23:06:52'),
  (2843, 427, 3270605.77, 952, 237, 723, '2025-12-28 00:08:10'),
  (614, 874, 8192100.91, 419, 937, 210, '2025-05-15 18:38:31'),
  (3197, 268, 896142.42, 643, 752, 497, '2026-01-04 17:10:54'),
  (1004, 905, 502434.18, 94, 533, 243, '2026-05-05 17:48:23'),
  (2062, 427, 8081635.75, 275, 535, 641, '2025-06-18 17:46:46'),
  (3776, 478, 1113553.51, 57, 871, 107, '2025-01-19 12:52:49'),
  (2755, 472, 9015977.09, 667, 858, 163, '2025-03-03 08:17:10')
ON CONFLICT DO NOTHING;


-- ─── kyc_enforcement_log ───
INSERT INTO "kyc_enforcement_log" ("eventId", "serviceId", "path", "method", "customerId", "companyId", "decision", "reason", "kycLevel", "requiredLevel", "tenantId", "createdAt") VALUES
  ('EVEN-ac86207139f4', 'SERV-ca1782ec1b7a', 'KYC_EN-b1cc66757e6e', 'KYC_EN-2348f7461a60', 'CUST-3f8f9a132e3c', 'COMP-09effa9380f1', 'KYC_EN-337d5afe5582', 'KYC_EN-3377e19037c8', 'KYC_EN-99d08194145c', 'KYC_EN-90c4fde88f1a', 'tenant-lagos-main', '2025-03-20 12:37:52'),
  ('EVEN-0ee0412f7bd0', 'SERV-5c86161dc32c', 'KYC_EN-358540276fe0', 'KYC_EN-0ccbc48eb3c9', 'CUST-bb523b7e1746', 'COMP-dcbc5294cb92', 'KYC_EN-089947dcd4b0', 'KYC_EN-a94f541f83c9', 'KYC_EN-36fe17073349', 'KYC_EN-c47d9ecd8209', 'tenant-whitelabel-zenith', '2025-05-12 01:19:56'),
  ('EVEN-67c1f3232761', 'SERV-db15887e9913', 'KYC_EN-49e814194b74', 'KYC_EN-7a7810e6e2af', 'CUST-9994b732623f', 'COMP-0107c4a29f27', 'KYC_EN-d73fc4c2260e', 'KYC_EN-41b49f96f2a1', 'KYC_EN-222f58e795a9', 'KYC_EN-bba0f36555cd', 'tenant-whitelabel-zenith', '2025-09-08 12:05:22'),
  ('EVEN-924b1cd36eb6', 'SERV-f73bb5ae9901', 'KYC_EN-9379647db2ad', 'KYC_EN-123207edbb56', 'CUST-a7289de99a1e', 'COMP-958782f31de7', 'KYC_EN-7d335bf09abe', 'KYC_EN-dceacfbbf60e', 'KYC_EN-5979a299c813', 'KYC_EN-254fe8eb7f43', 'tenant-lagos-main', '2025-08-21 11:37:28'),
  ('EVEN-501c853cea10', 'SERV-86a96f97ea10', 'KYC_EN-852e9143b148', 'KYC_EN-9eca15394afd', 'CUST-9df3668477eb', 'COMP-e10ba8b4ee86', 'KYC_EN-0d8b59097072', 'KYC_EN-be25c7ce2be7', 'KYC_EN-8e31c10163b0', 'KYC_EN-8973f64fdd00', 'tenant-abuja-digital', '2025-04-07 12:05:53'),
  ('EVEN-2d6f4b6e4a79', 'SERV-91eb8443342c', 'KYC_EN-f2704c10eb0f', 'KYC_EN-bc380aa65749', 'CUST-647d173b859c', 'COMP-54242b7308ce', 'KYC_EN-36723a529429', 'KYC_EN-09a22a24f2ad', 'KYC_EN-4490322761d3', 'KYC_EN-478a8fd4d8b0', 'tenant-portharcourt', '2025-09-14 11:55:57'),
  ('EVEN-b865a8bde02a', 'SERV-7c8581d214f1', 'KYC_EN-87dddce71fcc', 'KYC_EN-4685e052625d', 'CUST-a4eb1a72a977', 'COMP-8f1e32ba6727', 'KYC_EN-88ee1b950412', 'KYC_EN-a85ac894c5c7', 'KYC_EN-8333dae41fa5', 'KYC_EN-b0ddf1ba93ea', 'tenant-lagos-main', '2025-06-05 12:58:41'),
  ('EVEN-f51505f7a7c0', 'SERV-dbe575e1bf39', 'KYC_EN-36db6b825f29', 'KYC_EN-a8f32d6bcd3c', 'CUST-4bbaeb8b43ad', 'COMP-791fb0e0449a', 'KYC_EN-4fb859475204', 'KYC_EN-87f2154e2130', 'KYC_EN-b2a249e8ee2d', 'KYC_EN-f3771769ccde', 'tenant-kano-north', '2026-02-21 07:30:59')
ON CONFLICT DO NOTHING;


-- ─── kyc_enforcement_verifications ───
INSERT INTO "kyc_enforcement_verifications" ("verificationId", "customerId", "tenantId", "level", "status", "bvnVerified", "ninVerified", "livenessVerified", "documentsVerified", "sanctionsCleared", "riskScore", "assignedTier", "verifiedBy", "verifiedAt", "expiresAt", "createdAt", "updatedAt") VALUES
  ('VERI-726fb55ec31f', 'CUST-9483116c9f8f', 'tenant-lagos-main', 'KYC_EN-816c3cd2ae67', 'processing', false, true, false, true, false, 5, 'KYC_EN-a3f7081664dc', 'KYC_EN-87093e01f346', '2025-08-20 00:04:13', '2026-01-27 11:08:20', '2025-05-06 15:18:08', '2026-04-28 00:58:28'),
  ('VERI-22dfbb7abcdf', 'CUST-4cafb09c71ba', 'tenant-whitelabel-zenith', 'KYC_EN-13389d7601ef', 'processing', true, false, true, true, false, 38, 'KYC_EN-5bdffff03b28', 'KYC_EN-893efb4947fe', '2025-07-19 06:21:04', '2025-12-27 12:25:32', '2025-04-10 21:26:34', '2025-05-22 20:19:43'),
  ('VERI-ef0cfd312784', 'CUST-570d8754fce1', 'tenant-lagos-main', 'KYC_EN-98628fadec77', 'completed', true, true, true, true, true, 54, 'KYC_EN-d86a8ef6372f', 'KYC_EN-ccdfa24b51b3', '2026-04-12 01:48:26', '2025-11-17 18:58:04', '2025-09-19 23:22:35', '2026-04-29 09:25:52'),
  ('VERI-59a254d572e9', 'CUST-b06ceb6bf4d6', 'tenant-portharcourt', 'KYC_EN-43f986e9a151', 'completed', true, true, true, true, true, 7, 'KYC_EN-80da1ee2912b', 'KYC_EN-3c0af66163f3', '2025-05-05 23:50:35', '2025-11-16 19:28:15', '2025-06-05 21:23:50', '2025-11-27 12:23:18'),
  ('VERI-144b3ccf24b9', 'CUST-ad56f9e46fd7', 'tenant-lagos-main', 'KYC_EN-7ab37269dd9d', 'completed', false, true, false, true, true, 18, 'KYC_EN-cd25e6a58c37', 'KYC_EN-1450d1db3da4', '2025-10-05 13:38:09', '2026-03-05 07:23:58', '2025-04-05 10:56:58', '2026-01-02 19:29:29'),
  ('VERI-4b11728fea7d', 'CUST-abd8aac0260c', 'tenant-portharcourt', 'KYC_EN-2ec53653b412', 'pending', false, true, true, true, true, 39, 'KYC_EN-a2efa361751a', 'KYC_EN-52b6934509c6', '2026-03-03 02:11:17', '2026-01-17 12:58:03', '2025-04-23 13:44:35', '2025-02-17 05:41:28'),
  ('VERI-64075ff22e39', 'CUST-6cae6984b145', 'tenant-kano-north', 'KYC_EN-7dea6c953b8c', 'completed', true, true, false, false, true, 53, 'KYC_EN-29d116ea80df', 'KYC_EN-a57b2196ad3b', '2025-04-13 00:44:21', '2025-08-07 23:02:27', '2026-04-20 16:20:43', '2025-05-31 03:55:30'),
  ('VERI-9932e15241c9', 'CUST-ae9c9be99d03', 'tenant-whitelabel-zenith', 'KYC_EN-5babc28a6c05', 'completed', true, true, true, true, false, 80, 'KYC_EN-922a625d1cc6', 'KYC_EN-d5544fc4e81c', '2025-04-09 17:38:52', '2025-11-19 23:25:16', '2026-04-24 19:56:42', '2025-10-14 14:41:50')
ON CONFLICT DO NOTHING;


-- ─── kyc_event_triggers ───
INSERT INTO "kyc_event_triggers" ("triggerId", "eventTopic", "eventName", "customerId", "companyId", "kycLevel", "kybRequired", "status", "triggerSource", "integratedServices", "eventData", "tenantId", "triggeredAt", "completedAt") VALUES
  ('TRIG-53d4906bfc39', 'KYC_EV-119565eeb426', 'KYC_EV-71eb5b038025', 'CUST-6e106e30e804', 'COMP-6a2a896eb80a', 'KYC_EV-272b9b18c774', true, 'pending', 'KYC_EV-f83b931891fa', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-lagos-main', '2025-02-24 07:00:35', '2026-01-10 09:48:46'),
  ('TRIG-32071b949524', 'KYC_EV-cf28aa4bc439', 'KYC_EV-50f78e68107b', 'CUST-6756341c1d8d', 'COMP-dc503fd758cf', 'KYC_EV-d5ac36085d10', true, 'processing', 'KYC_EV-4c7a17e15dbb', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-whitelabel-zenith', '2025-05-12 04:28:21', '2025-10-05 21:05:24'),
  ('TRIG-d85b247c640b', 'KYC_EV-7701ad94365c', 'KYC_EV-574b293ef771', 'CUST-b7e4d600d3ab', 'COMP-30e561aebf6b', 'KYC_EV-92f4a0e5c678', true, 'processing', 'KYC_EV-95deab55f614', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-abuja-digital', '2026-03-16 06:28:45', '2026-03-31 09:52:54'),
  ('TRIG-68285dcaf2ae', 'KYC_EV-35d45a1f9d2f', 'KYC_EV-6dfad8ec4bcd', 'CUST-ec522444f746', 'COMP-3b8e16e74ea8', 'KYC_EV-1ab8e3f36e88', false, 'active', 'KYC_EV-61345e121bab', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-whitelabel-zenith', '2025-09-12 15:26:04', '2026-04-26 10:45:25'),
  ('TRIG-3d083c1aaf35', 'KYC_EV-b3651b167708', 'KYC_EV-39d2b4d35462', 'CUST-815f65ffc887', 'COMP-19ec58cb7fe5', 'KYC_EV-7ec62e77f500', false, 'pending', 'KYC_EV-7840e8815573', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-whitelabel-zenith', '2025-03-25 02:33:55', '2025-02-19 23:25:36'),
  ('TRIG-63774c5202b5', 'KYC_EV-ffa45105c1e5', 'KYC_EV-9f40cf2627f4', 'CUST-42f19e8df041', 'COMP-6a3219dddf68', 'KYC_EV-d6ad742a44fd', true, 'approved', 'KYC_EV-1ce113f7c602', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-lagos-main', '2026-04-04 05:09:51', '2025-07-05 06:20:48'),
  ('TRIG-e70d7021b489', 'KYC_EV-0125aa985135', 'KYC_EV-aa1344d046d4', 'CUST-ec40d6038752', 'COMP-fa0181b7069e', 'KYC_EV-694795924c7f', false, 'pending', 'KYC_EV-30f8f981a322', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-portharcourt', '2026-04-02 10:40:58', '2025-12-12 07:46:32'),
  ('TRIG-421f459cb8bc', 'KYC_EV-23d95c95d552', 'KYC_EV-05aec26efd61', 'CUST-b5643a6ab10b', 'COMP-043e76cf017b', 'KYC_EV-68ad30d5b3f9', true, 'completed', 'KYC_EV-016010065985', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'tenant-whitelabel-zenith', '2025-04-19 07:39:30', '2025-11-02 03:23:53')
ON CONFLICT DO NOTHING;


-- ─── kyc_tier_history ───
INSERT INTO "kyc_tier_history" ("customerId", "previousTier", "newTier", "reason", "changedBy", "createdAt") VALUES
  ('CUST-445dffafec8d', 669, 259, 'KYC_TI-925f26d7d501', 'KYC_TI-096606dec185', '2025-07-13 18:16:50'),
  ('CUST-3b6f66c151d8', 50, 141, 'KYC_TI-00b918e8fcb3', 'KYC_TI-20fa3916b3cf', '2025-02-20 20:30:06'),
  ('CUST-1fa3c8ab496a', 772, 119, 'KYC_TI-66e1c5bdd1d0', 'KYC_TI-e194826e3f58', '2025-05-03 19:24:45'),
  ('CUST-e2bfae4bf5db', 111, 523, 'KYC_TI-506c5e25d202', 'KYC_TI-b24b52a05247', '2025-12-02 01:23:59'),
  ('CUST-290cb70e8221', 628, 409, 'KYC_TI-317875e55280', 'KYC_TI-73430a9e125d', '2025-01-05 06:01:32'),
  ('CUST-b47342f44475', 37, 784, 'KYC_TI-fd7e9b497533', 'KYC_TI-73a0586ff453', '2026-04-14 06:00:15'),
  ('CUST-ca632b87b3b7', 254, 50, 'KYC_TI-637d7cfac81c', 'KYC_TI-6892edae0479', '2025-07-20 16:04:13'),
  ('CUST-464d4d7f87a5', 265, 327, 'KYC_TI-f3e476e00c27', 'KYC_TI-fa96bf436715', '2026-02-24 12:40:36')
ON CONFLICT DO NOTHING;


-- ─── kyc_tiers ───
INSERT INTO "kyc_tiers" ("customerId", "customerName", "currentTier", "dailyLimitNGN", "dailyUsedNGN", "evaluationScore", "riskFlags", "status", "lastEvaluatedAt", "createdAt", "updatedAt") VALUES
  ('CUST-67a269d6ed69', 'Lanre Garba', 267, 1043627.43, 9539064.89, 88.7152, '{"data": "seed"}'::jsonb, 'completed', '2025-05-17 13:11:13', '2025-03-19 09:17:16', '2025-07-31 11:15:52'),
  ('CUST-46c1bbcc2708', 'Olumide Adenuga', 123, 5599950.89, 9416670.31, 93.6742, '{"data": "seed"}'::jsonb, 'pending', '2025-06-06 18:04:43', '2025-04-24 03:49:08', '2025-07-12 05:54:16'),
  ('CUST-a5274f47c1c9', 'Sade Otedola', 932, 2371331.95, 903842.42, 38.4494, '{"data": "seed"}'::jsonb, 'processing', '2025-08-26 22:32:35', '2025-03-18 20:58:59', '2025-08-08 12:25:51'),
  ('CUST-90bb41657e1b', 'Oluchi Danladi', 259, 8141999.66, 3626096.14, 47.2984, '{"data": "seed"}'::jsonb, 'pending', '2026-02-12 19:14:39', '2025-07-16 17:46:12', '2025-08-21 03:55:16'),
  ('CUST-6736b11b5ff7', 'Tunde Hassan', 304, 686693.39, 7863974.35, 83.2943, '{"data": "seed"}'::jsonb, 'active', '2025-03-18 08:16:15', '2025-02-21 16:19:07', '2025-11-11 00:01:28'),
  ('CUST-37034759ec1b', 'Femi Dangote', 769, 938814.95, 1596103.46, 12.1636, '{"data": "seed"}'::jsonb, 'completed', '2026-02-22 09:18:21', '2026-01-28 08:17:02', '2025-06-06 07:26:37'),
  ('CUST-a55ee16085c7', 'Hauwa Usman', 916, 9552765.97, 2745475.78, 7.7415, '{"data": "seed"}'::jsonb, 'completed', '2026-01-01 22:17:19', '2025-09-15 08:30:20', '2025-10-10 12:18:25'),
  ('CUST-8cdb783482d9', 'Rahma Lawal', 150, 1893266.02, 4440776.94, 99.168, '{"data": "seed"}'::jsonb, 'processing', '2026-04-12 07:17:47', '2026-04-13 17:24:52', '2025-06-06 11:28:26')
ON CONFLICT DO NOTHING;


-- ─── lendingGroups ───
INSERT INTO "lendingGroups" ("groupId", "tenantId", "name", "purpose", "groupLeaderId", "groupLeaderName", "maxMembers", "liabilityType", "status", "createdAt", "updatedAt") VALUES
  ('GROU-600ce0c0ca46', 'tenant-lagos-main', 'Patience Adeyemi', 'LENDIN-7c1c2ad174fa', 'GROU-0c4aea6c7060', 'LENDIN-7348c3d533f3', 460, 'full', 'pending', '2026-02-04 07:54:05', '2026-01-31 03:10:52'),
  ('GROU-8e1c2378d4ca', 'tenant-whitelabel-zenith', 'Sade Lawal', 'LENDIN-4cb050a76afb', 'GROU-4a3f8e2a42d8', 'LENDIN-965ebd1cd3a3', 14, 'basic', 'pending', '2025-04-19 00:12:20', '2026-04-26 07:14:31'),
  ('GROU-e29117060e2b', 'tenant-portharcourt', 'Jumoke Eze', 'LENDIN-970a65306a7d', 'GROU-0260997bca4d', 'LENDIN-4ee8dc28778e', 249, 'basic', 'completed', '2026-04-06 03:26:59', '2025-10-07 07:47:17'),
  ('GROU-3a930b552c09', 'tenant-portharcourt', 'Pelumi Mohammed', 'LENDIN-3f4b0e7ba4a2', 'GROU-d3b92a4a970c', 'LENDIN-d8be945b36f6', 974, 'basic', 'approved', '2026-02-04 15:54:25', '2026-01-10 04:18:54'),
  ('GROU-dc41c4485290', 'tenant-abuja-digital', 'Fatima Eze', 'LENDIN-37d6ef4bc191', 'GROU-e8a87708855c', 'LENDIN-30d00e3fcf60', 534, 'enhanced', 'completed', '2025-05-27 20:21:19', '2025-12-21 08:44:27'),
  ('GROU-fc1e7024e329', 'tenant-portharcourt', 'Dorcas Igwe', 'LENDIN-2cd52421d85c', 'GROU-7ce86dc56ad9', 'LENDIN-0aeaad0ba384', 657, 'enhanced', 'pending', '2025-09-15 10:25:23', '2025-12-30 08:41:16'),
  ('GROU-7b8e486897ba', 'tenant-whitelabel-zenith', 'Adaeze Kalu', 'LENDIN-c6528c2a677f', 'GROU-f700e8aab56d', 'LENDIN-613d3bfe4ae6', 588, 'standard', 'approved', '2025-03-05 14:50:45', '2025-12-29 20:50:25'),
  ('GROU-fa364f7b3a49', 'tenant-abuja-digital', 'Titilayo Danladi', 'LENDIN-aa13224a93b0', 'GROU-3b36feb2d031', 'LENDIN-eab830bbb6e9', 911, 'enhanced', 'pending', '2025-11-15 02:21:19', '2026-02-22 10:15:37')
ON CONFLICT DO NOTHING;


-- ─── lettersOfCredit ───
INSERT INTO "lettersOfCredit" ("lcId", "tenantId", "lcType", "applicantId", "applicantName", "beneficiaryName", "beneficiaryBank", "beneficiaryCountry", "issuingBank", "advisingBank", "amount", "currency", "commodity", "incoterm", "portOfLoading", "portOfDischarge", "latestShipDate", "expiryDate", "documentsRequired", "amendments", "status", "createdAt", "updatedAt") VALUES
  ('LCID-38c75ab1468e', 'tenant-kano-north', 'enhanced', 'APPL-f02f8c2a4d10', 'Adewale Dangote', 'Dorcas Danladi', 'LETTER-c3462bd9068f', 'LETTER-ab98aaa5b1b3', 'LETTER-5dd16f3c891b', 'LETTER-516600d636e2', 11922568.58, 'GBP', 'LETTER-ba16426957e1', 'LETTER-2bc1ef2ba284', 'LETTER-bf28dda1e9a9', 'LETTER-3421f400a829', '10.0.60.95', 'LETTER-74cac874ec21', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'pending', '2025-09-13 17:30:15', '2025-10-23 07:39:08'),
  ('LCID-6e3518ceb460', 'tenant-abuja-digital', 'premium', 'APPL-aa6687b79e49', 'Uche Adeyemi', 'Ifeoma Adenuga', 'LETTER-77c56e0d843c', 'LETTER-38751c713c1e', 'LETTER-2b14211b3182', 'LETTER-68de1e4290c7', 9633201.44, 'GBP', 'LETTER-265226598cf3', 'LETTER-db47fcc4f021', 'LETTER-251aa3bd5f5c', 'LETTER-d550332a9ce5', '10.0.251.170', 'LETTER-e565869b9ce0', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'completed', '2026-03-01 23:37:44', '2026-02-14 13:08:51'),
  ('LCID-59d585edca3f', 'tenant-abuja-digital', 'enhanced', 'APPL-676b459595be', 'Jide Sanusi', 'Patience Mohammed', 'LETTER-d755608f273b', 'LETTER-bc88023bc642', 'LETTER-aef9b1370bce', 'LETTER-8bd72baee18e', 34068615.13, 'NGN', 'LETTER-8bd1f4ff9214', 'LETTER-4a45e42d91b2', 'LETTER-613f4cfae59e', 'LETTER-8357d772c063', '10.0.194.107', 'LETTER-10546a5ae96b', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'completed', '2026-02-18 12:28:39', '2025-05-28 10:37:39'),
  ('LCID-8b730ba8d06d', 'tenant-portharcourt', 'basic', 'APPL-b2cebb44c592', 'Oluchi Okafor', 'Sade Garba', 'LETTER-f8267f3b6e47', 'LETTER-4e49183ebcd4', 'LETTER-c29de3473f80', 'LETTER-9fe471d4ce5b', 37448976.79, 'USD', 'LETTER-4f1986fc4dd0', 'LETTER-740bf1ba655a', 'LETTER-8ebdfc926895', 'LETTER-e0ed39ea8342', '10.0.75.229', 'LETTER-b6436cec6132', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'processing', '2026-02-17 10:34:29', '2025-02-18 02:14:34'),
  ('LCID-415aef3d5dc1', 'tenant-lagos-main', 'full', 'APPL-05e6edc52009', 'Adaeze Lawal', 'Pelumi Elumelu', 'LETTER-2141a2b1c02a', 'LETTER-791ad38a35fb', 'LETTER-96ba259062a6', 'LETTER-752927c0a1cf', 25552656.44, 'USD', 'LETTER-de05dd628272', 'LETTER-c260e79017b9', 'LETTER-77b2f98e78b6', 'LETTER-cf59396a3f79', '10.0.214.205', 'LETTER-c2d73417e1e2', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'completed', '2025-02-12 16:36:51', '2025-09-10 18:07:58'),
  ('LCID-3b291170cca4', 'tenant-lagos-main', 'premium', 'APPL-f08b98505feb', 'Oluchi Okafor', 'Rasheed Kalu', 'LETTER-3c76ebd19b72', 'LETTER-99fc95d90b77', 'LETTER-9824e62f8334', 'LETTER-c727e5c94a64', 1426132.24, 'NGN', 'LETTER-bd147fbd2374', 'LETTER-7afad6be490f', 'LETTER-69b17b68566c', 'LETTER-c8c0a2069b10', '10.0.116.175', 'LETTER-f64cca79aeff', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'processing', '2026-03-18 18:13:03', '2025-12-06 01:33:24'),
  ('LCID-e72168b8b649', 'tenant-lagos-main', 'basic', 'APPL-0558ee3c670a', 'Jumoke Adeyemi', 'Chidinma Nwosu', 'LETTER-ea0cd6dd6a6e', 'LETTER-fdd73edf77a0', 'LETTER-7fda089290c9', 'LETTER-d1171f505a6d', 34517578.71, 'NGN', 'LETTER-335c6915184f', 'LETTER-dea67968e699', 'LETTER-0c20a8fd0359', 'LETTER-eb23cdb9790a', '10.0.17.223', 'LETTER-439c4739ee17', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'active', '2025-07-17 00:35:09', '2025-01-10 03:24:15'),
  ('LCID-2007dec6bf7c', 'tenant-portharcourt', 'basic', 'APPL-1206e300bbe6', 'Tunde Kalu', 'Adaeze Chukwu', 'LETTER-5750024e5426', 'LETTER-e918f12bd39b', 'LETTER-43b9cfc900d7', 'LETTER-656a1e65600d', 24242535.63, 'GBP', 'LETTER-88395f391d41', 'LETTER-7cbe7b19f971', 'LETTER-2a4f3a58829b', 'LETTER-082a8243c382', '10.0.161.202', 'LETTER-051200085fdd', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 'processing', '2025-10-15 19:21:27', '2025-01-07 04:04:16')
ON CONFLICT DO NOTHING;


-- ─── liveness_checks ───
INSERT INTO "liveness_checks" ("checkId", "tenantId", "customerId", "sessionId", "mode", "isLive", "verdict", "methodScores", "faceDetected", "devicePlatform", "deviceModel", "ipAddress", "challengeType", "challengesPassed", "challengesTotal", "kafkaEventId", "createdAt", "completedAt") VALUES
  ('CHEC-6c30e76ec96d', 'tenant-abuja-digital', 'CUST-6d337bea5f71', 'SESS-ade677bb752e', 'LIVENE-6a7ea43a90a3', false, 'LIVENE-4c5b4cc42b97', '{"data": "seed"}'::jsonb, true, 'LIVENE-ab57caf64375', 'LIVENE-7aa80a230fc9', '10.0.24.125', 'enhanced', 997, 1494, 'KAFK-bf31baec5acb', '2025-05-23 22:32:40', '2026-04-25 00:58:03'),
  ('CHEC-0b9bd88f5294', 'tenant-kano-north', 'CUST-2368ad42832d', 'SESS-1adb26fc2134', 'LIVENE-52cf5ef22ece', false, 'LIVENE-10ac1cbe774c', '{"data": "seed"}'::jsonb, true, 'LIVENE-1099b7442fcb', 'LIVENE-dbb58e7cb3d0', '10.0.115.165', 'enhanced', 477, 7726, 'KAFK-207e078e932e', '2025-07-22 00:01:16', '2026-03-31 23:42:39'),
  ('CHEC-5534d5baa39e', 'tenant-kano-north', 'CUST-91038b9e7186', 'SESS-f0ccda9faac8', 'LIVENE-01a0d41cf764', true, 'LIVENE-bc1f068a9c10', '{"data": "seed"}'::jsonb, true, 'LIVENE-f23ab3429306', 'LIVENE-c55587ed573d', '10.0.151.133', 'standard', 922, 3361, 'KAFK-bfd46c3557fc', '2025-08-15 10:34:56', '2025-06-07 10:37:41'),
  ('CHEC-9c2620a046e9', 'tenant-abuja-digital', 'CUST-8d58c4ff5a88', 'SESS-eb3dbf6e4872', 'LIVENE-ea58f2baac4d', false, 'LIVENE-5f6afad65da0', '{"data": "seed"}'::jsonb, false, 'LIVENE-d8cd7857adc4', 'LIVENE-aff4d2ed29ec', '10.0.160.173', 'premium', 881, 8985, 'KAFK-65a7c7d1f68a', '2025-10-14 01:18:10', '2026-05-05 22:43:32'),
  ('CHEC-2df198047222', 'tenant-kano-north', 'CUST-8ddd60e4b2f7', 'SESS-0697257cb17d', 'LIVENE-a28cc4296bf1', true, 'LIVENE-9aa1cf47265b', '{"data": "seed"}'::jsonb, false, 'LIVENE-7606d1486874', 'LIVENE-0cf8f57ab4e5', '10.0.141.79', 'basic', 500, 2480, 'KAFK-073e12af23c2', '2025-09-06 15:01:16', '2025-01-19 23:36:06'),
  ('CHEC-a66e154bd40e', 'tenant-kano-north', 'CUST-87364a93ce45', 'SESS-570e52435270', 'LIVENE-76e8fbb29d91', false, 'LIVENE-c0b812c11960', '{"data": "seed"}'::jsonb, true, 'LIVENE-cbf53ff80333', 'LIVENE-1c14c41b2da1', '10.0.163.39', 'premium', 700, 9781, 'KAFK-95ec66889baf', '2025-05-16 14:40:21', '2025-11-20 18:10:22'),
  ('CHEC-a25c1bfaab47', 'tenant-kano-north', 'CUST-d82d7b0327a9', 'SESS-e5dae6c37102', 'LIVENE-9efa4f07e195', true, 'LIVENE-d04881c84d08', '{"data": "seed"}'::jsonb, true, 'LIVENE-2308f14e50a5', 'LIVENE-a8555d2bbf80', '10.0.131.171', 'basic', 546, 9272, 'KAFK-4fe3d05a646f', '2025-07-01 20:40:16', '2025-11-18 01:59:35'),
  ('CHEC-5849b7ad722d', 'tenant-lagos-main', 'CUST-27f1caff323a', 'SESS-302dfbdcede1', 'LIVENE-78d694a205e9', true, 'LIVENE-bc47eb698579', '{"data": "seed"}'::jsonb, true, 'LIVENE-461f234294b4', 'LIVENE-f4b6c24c56a0', '10.0.118.130', 'basic', 582, 3513, 'KAFK-f751811f8d87', '2025-02-09 23:32:37', '2025-06-20 21:52:36')
ON CONFLICT DO NOTHING;


-- ─── liveness_events ───
INSERT INTO "liveness_events" ("eventId", "eventType", "sessionId", "customerId", "tenantId", "payload", "kafkaTopic", "kafkaPartition", "publishedAt") VALUES
  ('EVEN-8da9ba8d8493', 'basic', 'SESS-db76fb6f826e', 'CUST-083eb1ab4f29', 'tenant-kano-north', '{"data": "seed"}'::jsonb, 'LIVENE-32bc53172ebf', 423, '2026-02-27 22:45:18'),
  ('EVEN-0ddb7cd6e8cd', 'enhanced', 'SESS-e1dd8d2be596', 'CUST-9d063eebf4da', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'LIVENE-19614a018b2e', 541, '2025-07-22 02:01:52'),
  ('EVEN-cda55a097382', 'premium', 'SESS-70777cf2d2db', 'CUST-9a544535ee13', 'tenant-lagos-main', '{"data": "seed"}'::jsonb, 'LIVENE-07e1bf2a5282', 783, '2025-02-27 02:22:05'),
  ('EVEN-47b38e71e619', 'full', 'SESS-ef7153547a57', 'CUST-e03aa0d4c037', 'tenant-abuja-digital', '{"data": "seed"}'::jsonb, 'LIVENE-70d7cbf21b23', 17, '2025-01-08 15:29:47'),
  ('EVEN-002118f596b8', 'standard', 'SESS-b33e6e2c154e', 'CUST-3214bfc6034e', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'LIVENE-b8a30da87522', 526, '2026-01-05 10:51:17'),
  ('EVEN-b7a38a43be66', 'full', 'SESS-553ff1c44f92', 'CUST-d03b8ccaeae4', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'LIVENE-b9de07c954c0', 854, '2025-12-07 16:06:09'),
  ('EVEN-199f25ce041a', 'full', 'SESS-110efbfa61a8', 'CUST-541448c2d9b3', 'tenant-lagos-main', '{"data": "seed"}'::jsonb, 'LIVENE-509f0f3f1ef6', 580, '2025-10-29 01:52:13'),
  ('EVEN-4c49dddf715d', 'enhanced', 'SESS-b3766b2f760b', 'CUST-f8cfa441c638', 'tenant-whitelabel-zenith', '{"data": "seed"}'::jsonb, 'LIVENE-de8689d77e00', 599, '2025-05-02 15:47:43')
ON CONFLICT DO NOTHING;


-- ─── livestock_finance ───
INSERT INTO "livestock_finance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-679a5dcce98a', 'Fatima Kalu', 'technology', 'Fatima Kalu - Awka - Livestock Finance', 'active', 3070473.89, 'Edo', 'REF-4208A50354', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2026-02-27 16:57:52', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-63517703a23f', 'Adaeze Adenuga', 'compliance', 'Adaeze Adenuga - Victoria Island - Livestock Finance', 'pending', 3060904.86, 'Borno', 'REF-19F5ADC127', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-12-23 16:46:26', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-237e6a0dd2d2', 'Ifeoma Lawal', 'payments', 'Ifeoma Lawal - Maitama - Livestock Finance', 'pending', 1878932.55, 'Delta', 'REF-ECD560E57E', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-07-24 01:14:39', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-aacd9a3bd86d', 'Babajide Sanusi', 'payments', 'Babajide Sanusi - Awka - Livestock Finance', 'active', 2447154.69, 'Anambra', 'REF-1E722E757E', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2026-02-08 16:20:59', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-b5ff055d32cb', 'Lilian Otedola', 'risk', 'Lilian Otedola - Maitama - Livestock Finance', 'active', 186723.38, 'Abuja FCT', 'REF-845C6C283F', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-06-04 04:32:11', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-dc27307ac7b8', 'Femi Garba', 'technology', 'Femi Garba - Asaba - Livestock Finance', 'pending', 5210073.88, 'Delta', 'REF-22D7AD4115', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-05-20 16:55:57', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-ccd8a79fa7de', 'Maryam Adeyemi', 'lending', 'Maryam Adeyemi - Port Harcourt - Livestock Finance', 'approved', 5433208.74, 'Enugu', 'REF-1E71164773', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-11-14 00:12:37', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-230f40c32b14', 'Chukwuemeka Jimoh', 'technology', 'Chukwuemeka Jimoh - Warri - Livestock Finance', 'pending', 7500277.59, 'Kano', 'REF-E73E6E1A31', '{"source": "seed", "table": "livestock_finance"}'::jsonb, '2025-03-10 15:41:28', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── livestock_insurance ───
INSERT INTO "livestock_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-9d78f60c296d', 'Esther Adenuga', 'lending', 'Esther Adenuga - Benin City - Livestock Insurance', 'approved', 7613801.38, 'Kaduna', 'REF-D84C3B6A44', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-07-01 07:39:27', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-d997370d8381', 'Nneka Garba', 'compliance', 'Nneka Garba - Warri - Livestock Insurance', 'approved', 499266.58, 'Kano', 'REF-B770137EA5', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-03-13 20:22:03', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-ccd46f79383b', 'Chidinma Garba', 'lending', 'Chidinma Garba - Victoria Island - Livestock Insurance', 'pending', 674340.79, 'Akwa Ibom', 'REF-5B34DD5787', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-08-01 08:52:44', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a1ead735b27b', 'Ifeoma Fashola', 'risk', 'Ifeoma Fashola - Warri - Livestock Insurance', 'approved', 4190592.72, 'Rivers', 'REF-966B2B11C7', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-07-19 13:30:38', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-eb423f3b78de', 'Jide Kalu', 'payments', 'Jide Kalu - Port Harcourt - Livestock Insurance', 'processing', 616438.29, 'Ogun', 'REF-819C0685CF', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-03-05 00:20:29', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-fee0baf67a30', 'Rahma Elumelu', 'payments', 'Rahma Elumelu - Awka - Livestock Insurance', 'approved', 3047108.48, 'Kaduna', 'REF-D798838D89', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-10-04 22:09:52', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-ef6e09111563', 'Kunle Eze', 'finance', 'Kunle Eze - Ibadan - Livestock Insurance', 'processing', 8864982.22, 'Rivers', 'REF-827B724875', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-05-29 03:06:51', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-95b4452e8761', 'Maryam Igwe', 'technology', 'Maryam Igwe - Benin City - Livestock Insurance', 'completed', 1386583.23, 'Osun', 'REF-E9A495431A', '{"source": "seed", "table": "livestock_insurance"}'::jsonb, '2025-02-02 00:05:00', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── livestock_management ───
INSERT INTO "livestock_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-7e5f06266967', 'Titilayo Nwosu', 'finance', 'Titilayo Nwosu - Awka - Livestock Management', 'processing', 313400.7, 'Delta', 'REF-937865E920', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2026-02-17 19:02:12', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-fafd87843f57', 'Sade Jimoh', 'payments', 'Sade Jimoh - Asaba - Livestock Management', 'approved', 462015.81, 'Imo', 'REF-DE320A3F62', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-02-09 01:30:41', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-4fc0e4f914f9', 'Nnamdi Fashola', 'finance', 'Nnamdi Fashola - Wuse - Livestock Management', 'active', 4669866.17, 'Delta', 'REF-95DB040134', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-05-16 20:29:33', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f976461e026a', 'Kemi Garba', 'risk', 'Kemi Garba - Zaria - Livestock Management', 'approved', 3311692.6, 'Rivers', 'REF-2919A13546', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2026-03-29 15:40:18', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-312329791fb5', 'Bukola Lawal', 'risk', 'Bukola Lawal - Zaria - Livestock Management', 'pending', 1314867.82, 'Kano', 'REF-C7BE32D908', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-05-28 15:33:57', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-2cd5df3ec57c', 'Jumoke Usman', 'payments', 'Jumoke Usman - Maitama - Livestock Management', 'completed', 9931441.83, 'Plateau', 'REF-A8421A9102', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-01-16 21:18:12', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-9ec8b398a129', 'Kunle Balogun', 'compliance', 'Kunle Balogun - Wuse - Livestock Management', 'completed', 4878713.24, 'Kwara', 'REF-0B518F74DC', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-03-05 13:33:13', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-7b144061233a', 'Gbenga Elumelu', 'compliance', 'Gbenga Elumelu - Ikeja - Livestock Management', 'active', 1863519.19, 'Kano', 'REF-D767C92529', '{"source": "seed", "table": "livestock_management"}'::jsonb, '2025-01-19 06:15:21', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── materialized_views_perf ───
INSERT INTO "materialized_views_perf" ("viewName", "refreshIntervalSec", "lastRefreshMs", "rowCount", "autoRefresh", "status", "createdAt") VALUES
  ('MATERI-86c67b2afeaa', 252, 682, 5577, true, 'processing', '2026-04-17 00:49:33'),
  ('MATERI-7a6016ff9e0a', 365, 424, 1307, true, 'processing', '2025-06-24 00:22:22'),
  ('MATERI-419ca47f7dd4', 335, 996, 4937, true, 'pending', '2026-03-08 23:14:40'),
  ('MATERI-65ee80ce6f5e', 868, 594, 170, true, 'processing', '2026-03-09 15:05:28'),
  ('MATERI-4c3e65e46fe9', 961, 590, 9364, true, 'pending', '2026-04-07 18:05:25'),
  ('MATERI-1982bb803091', 530, 347, 953, false, 'pending', '2025-11-16 20:56:27'),
  ('MATERI-d5e98f14ae08', 715, 106, 2215, false, 'approved', '2025-08-03 03:19:43'),
  ('MATERI-658e6fe1fadc', 0, 15, 6926, true, 'processing', '2025-08-12 21:31:00')
ON CONFLICT DO NOTHING;


-- ─── memoization_targets ───
INSERT INTO "memoization_targets" ("component", "rerendersPer60s", "estimatedSavingPct", "recommendation", "status", "createdAt") VALUES
  ('MEMOIZ-aae4675a4a84', 896, 'MEMOIZ-749f7a90a267', 'MEMOIZ-1d6d06dbf7cd', 'pending', '2025-09-15 22:39:58'),
  ('MEMOIZ-d099e85140ab', 404, 'MEMOIZ-cea686d2bde8', 'MEMOIZ-be0eea8597ee', 'approved', '2025-09-18 23:31:45'),
  ('MEMOIZ-7a9a7f45ab15', 145, 'MEMOIZ-0c3a1f220ff6', 'MEMOIZ-b1c5fb80fda3', 'processing', '2025-08-08 10:48:10'),
  ('MEMOIZ-970d0a2007bb', 244, 'MEMOIZ-8d3b46e0d972', 'MEMOIZ-4a1ed871ab95', 'pending', '2026-05-01 01:48:00'),
  ('MEMOIZ-b16100257495', 97, 'MEMOIZ-daad43eba124', 'MEMOIZ-8b68be6ae4a9', 'active', '2025-02-09 10:43:34'),
  ('MEMOIZ-f37421f20093', 641, 'MEMOIZ-1db9a1a09c3a', 'MEMOIZ-18e055493486', 'approved', '2025-01-19 10:24:13'),
  ('MEMOIZ-42205398f447', 600, 'MEMOIZ-2a232755fa8b', 'MEMOIZ-8b67c073ace3', 'approved', '2025-12-15 00:33:22'),
  ('MEMOIZ-f0bae53dd370', 158, 'MEMOIZ-4edb384df8f1', 'MEMOIZ-bfb5e19a294d', 'completed', '2025-09-29 01:16:27')
ON CONFLICT DO NOTHING;


-- ─── mfa_enrollments ───
INSERT INTO "mfa_enrollments" ("enrollmentId", "customerId", "methods", "primaryMethod", "backupMethod", "status", "riskLevel", "channel", "enrolledAt", "lastVerified") VALUES
  ('ENRO-82f5911a1afc', 'CUST-1ba43fc6a5f4', 'MFA_EN-3fd133f00cef', 'MFA_EN-9d3668fd1f5f', 'MFA_EN-826b105dee0a', 'processing', 'low', 'pos', '2025-03-30 14:43:49', '2026-01-30 18:10:51'),
  ('ENRO-7ac965d77d73', 'CUST-3926fb127c34', 'MFA_EN-ab68c93ca7ab', 'MFA_EN-cce29c82e8f0', 'MFA_EN-8329d0ae1053', 'pending', 'low', 'mobile', '2025-01-25 00:45:52', '2026-05-08 15:55:54'),
  ('ENRO-b825b89b6b47', 'CUST-7e58b2b94c56', 'MFA_EN-90adf5a24ff5', 'MFA_EN-7fd04ee450ef', 'MFA_EN-7effeb566fe6', 'pending', 'critical', 'pos', '2025-05-18 17:07:25', '2025-08-12 19:13:50'),
  ('ENRO-530a2cacaaf8', 'CUST-35386446bca5', 'MFA_EN-a6d3024bd2ac', 'MFA_EN-203849d341d7', 'MFA_EN-5b8edf5a5859', 'completed', 'critical', 'pos', '2026-04-09 09:12:45', '2025-04-08 06:36:01'),
  ('ENRO-bf26dcf16320', 'CUST-f443bcbacac7', 'MFA_EN-64491184e4a1', 'MFA_EN-56e8f6e24773', 'MFA_EN-ef123cb7acc9', 'active', 'low', 'ussd', '2025-03-16 05:22:55', '2026-01-11 15:58:56'),
  ('ENRO-271f913c92db', 'CUST-4d5cf0e19725', 'MFA_EN-27f4782ee110', 'MFA_EN-686c0d5b2a86', 'MFA_EN-7ef8eb656107', 'approved', 'high', 'branch', '2026-01-10 06:20:53', '2025-07-30 00:08:45'),
  ('ENRO-48ac088c6ab9', 'CUST-1a0dd4099e38', 'MFA_EN-56d4682d5465', 'MFA_EN-597b83864ea9', 'MFA_EN-ed5c0877dde2', 'approved', 'critical', 'ussd', '2026-01-19 05:22:58', '2025-03-31 18:08:48'),
  ('ENRO-c0425639ede7', 'CUST-8df9d8462535', 'MFA_EN-0e1e06f3bac5', 'MFA_EN-5c713828f2c3', 'MFA_EN-5b722e8fdbe2', 'pending', 'low', 'voice', '2025-08-03 01:32:59', '2026-01-26 05:59:48')
ON CONFLICT DO NOTHING;


-- ─── mfa_policies ───
INSERT INTO "mfa_policies" ("policyId", "name", "transactionType", "requiredFactors", "allowedMethods", "status", "createdAt") VALUES
  ('POLI-81652d980c97', 'Jumoke Igwe', 'basic', 805, 'MFA_PO-d62b425fd08d', 'processing', '2025-11-21 02:44:45'),
  ('POLI-554ccd1bbf19', 'Hauwa Lawal', 'premium', 944, 'MFA_PO-f52ee9c71254', 'active', '2025-06-15 21:46:38'),
  ('POLI-d3c65a34a202', 'Oluchi Jimoh', 'full', 486, 'MFA_PO-b455b225a2c8', 'active', '2025-12-03 16:15:10'),
  ('POLI-40f027fadcd5', 'Segun Okafor', 'enhanced', 614, 'MFA_PO-dd5f67df79ac', 'processing', '2025-12-11 16:49:04'),
  ('POLI-b912863e174d', 'Hauwa Fashola', 'standard', 434, 'MFA_PO-f99a469a7e8a', 'completed', '2025-09-09 14:28:46'),
  ('POLI-7b9b5dea774b', 'Dorcas Elumelu', 'full', 516, 'MFA_PO-373516a27a70', 'processing', '2026-04-04 00:11:34'),
  ('POLI-32b4f6078055', 'Uzo Okafor', 'premium', 19, 'MFA_PO-d43ac4e835f9', 'completed', '2025-09-22 18:58:12'),
  ('POLI-9fa1e52a0f92', 'Pelumi Dangote', 'standard', 926, 'MFA_PO-305d69eb95cf', 'processing', '2025-07-06 16:13:56')
ON CONFLICT DO NOTHING;


-- ─── mortgageApplications ───
INSERT INTO "mortgageApplications" ("mortgageId", "tenantId", "applicantId", "applicantName", "propertyValue", "loanAmount", "downPayment", "interestRatePct", "tenorMonths", "mortgageType", "emi", "ltvPct", "ltvGrade", "dtiRatio", "propertyAddress", "propertyType", "status", "disbursedAt", "createdAt", "updatedAt") VALUES
  ('MORT-184a8867cd70', 'tenant-kano-north', 'APPL-f90293850ddc', 'Lilian Eze', 1797556.3, 6582673.26, 7595644.22, 73.9435, 335, 'full', 251653.61, 1535487.08, 'MORTGA-769888c6d26a', 70.9677, 'MORTGA-08d34d0e87f6', 'standard', 'processing', '2025-10-28 05:35:30', '2025-06-08 18:56:22', '2025-06-04 16:51:53'),
  ('MORT-92271c38e9b9', 'tenant-abuja-digital', 'APPL-a55debf4e254', 'Titilayo Kalu', 4750690.81, 7926645.11, 6797572.18, 40.6483, 536, 'full', 1880799.69, 49262.42, 'MORTGA-62fb26b25f9e', 44.3957, 'MORTGA-d9cb2ad60fbc', 'standard', 'approved', '2025-01-30 00:52:21', '2025-03-17 16:24:52', '2025-04-21 23:46:39'),
  ('MORT-61d68d6808e5', 'tenant-kano-north', 'APPL-5828ff560d0c', 'Adewale Igwe', 4429167.71, 5234585.6, 2351580.93, 14.4751, 40, 'standard', 7615708.66, 2661262.0, 'MORTGA-973cabd9fb07', 43.0832, 'MORTGA-0315134012c1', 'basic', 'processing', '2025-05-30 16:30:49', '2025-10-06 00:10:52', '2025-06-10 03:40:14'),
  ('MORT-a576add8503f', 'tenant-whitelabel-zenith', 'APPL-7a5a26bb67f0', 'Nnamdi Peterside', 1646853.89, 8074180.25, 9867568.1, 16.6056, 208, 'enhanced', 2861812.11, 8449031.63, 'MORTGA-41fde7dbda7f', 85.721, 'MORTGA-acb88a1d3b05', 'premium', 'approved', '2025-02-02 03:27:20', '2025-08-29 01:16:19', '2025-11-09 04:19:50'),
  ('MORT-0620c0f3894c', 'tenant-lagos-main', 'APPL-48a3d87d683d', 'Jumoke Adenuga', 7348746.35, 5912150.07, 9536201.11, 46.2468, 178, 'enhanced', 9122752.06, 5129971.45, 'MORTGA-f4a9b9794289', 26.3907, 'MORTGA-ed63f460b668', 'full', 'pending', '2025-10-12 08:58:27', '2026-03-08 23:42:48', '2025-08-21 00:01:19'),
  ('MORT-21d3b7bd3150', 'tenant-kano-north', 'APPL-61cc9a3abb80', 'Ibrahim Peterside', 9835468.02, 4116264.69, 1948121.42, 70.4373, 459, 'premium', 5052016.8, 5926667.43, 'MORTGA-2f05c7bbc40e', 57.2086, 'MORTGA-7f5e700ab5c3', 'premium', 'pending', '2025-12-17 23:48:04', '2025-07-26 18:51:22', '2025-08-04 16:30:33'),
  ('MORT-f0191a2db698', 'tenant-kano-north', 'APPL-d65e0b286676', 'Musa Danladi', 5002618.76, 8927885.46, 1016242.41, 33.6561, 766, 'standard', 8472142.11, 2577191.49, 'MORTGA-d828b4393348', 84.2507, 'MORTGA-85efcc7730d4', 'standard', 'completed', '2025-03-11 11:50:25', '2026-02-07 19:24:55', '2025-12-12 00:15:14'),
  ('MORT-4b06ac4eac30', 'tenant-lagos-main', 'APPL-3eea919cf782', 'Olumide Mohammed', 2212503.87, 3925629.52, 3990492.66, 18.9542, 675, 'basic', 2246368.8, 4087349.81, 'MORTGA-f0212dd938b2', 67.2668, 'MORTGA-eb2862d4799b', 'enhanced', 'completed', '2025-05-01 13:08:41', '2025-07-30 13:29:45', '2026-03-30 21:35:53')
ON CONFLICT DO NOTHING;


-- ─── mtls_nodes ───
INSERT INTO "mtls_nodes" ("serviceName", "spiffeId", "certSerial", "certExpiry", "issuer", "peerConnections", "failedHandshakes", "status", "createdAt") VALUES
  ('MTLS_N-c05c55ad3143', 'SPIF-6db8efdd2334', 'MTLS_N-1e8f39e9b2b3', '2026-03-07 06:55:31', 'MTLS_N-c241f463aa79', 576, 883, 'processing', '2025-01-05 01:31:45'),
  ('MTLS_N-221f065f4907', 'SPIF-a7de95f2e9bf', 'MTLS_N-e78f1221dd5d', '2025-05-11 02:13:00', 'MTLS_N-d0bb20254de6', 642, 751, 'processing', '2026-03-16 01:01:26'),
  ('MTLS_N-99dc72af2f8c', 'SPIF-7b566b3602d7', 'MTLS_N-f7c2866fae5c', '2025-12-23 01:40:12', 'MTLS_N-a4fbda3d9918', 377, 223, 'processing', '2025-08-30 19:33:27'),
  ('MTLS_N-9e5014575819', 'SPIF-5d5102c2c58b', 'MTLS_N-47c08011cd95', '2025-12-11 20:53:14', 'MTLS_N-c724f9f02fbe', 275, 984, 'completed', '2025-07-05 22:56:23'),
  ('MTLS_N-5ef330309e47', 'SPIF-9af3adf062a0', 'MTLS_N-0ae3e5ba1b0b', '2025-12-02 23:05:24', 'MTLS_N-6959314df9db', 842, 354, 'processing', '2025-07-30 02:39:58'),
  ('MTLS_N-c0cd79932d6a', 'SPIF-4efa75d76e03', 'MTLS_N-1ca42ae76eb0', '2025-07-18 16:03:56', 'MTLS_N-76db3b9b6b4e', 980, 508, 'pending', '2025-07-30 09:14:55'),
  ('MTLS_N-52baf0fd66d5', 'SPIF-efda4af6c9c1', 'MTLS_N-4714e682070e', '2026-04-12 03:13:16', 'MTLS_N-951280ea9dc3', 648, 447, 'pending', '2025-10-07 17:39:12'),
  ('MTLS_N-6adb4c98b1ed', 'SPIF-ee5c7979dae4', 'MTLS_N-5ba78dba2b03', '2025-03-02 02:15:32', 'MTLS_N-872c9c685a7a', 211, 975, 'completed', '2025-09-23 12:54:51')
ON CONFLICT DO NOTHING;


-- ─── mudarabahContracts ───
INSERT INTO "mudarabahContracts" ("contractId", "tenantId", "investorId", "investorName", "fundManagerId", "investmentPurpose", "capitalAmount", "currency", "profitSharingRatioInvestor", "profitSharingRatioManager", "investmentPeriodMonths", "startDate", "maturityDate", "realizedProfit", "realizedLoss", "distributions", "status", "shariaCompliance", "riskCategory", "createdAt", "updatedAt") VALUES
  ('CONT-af9581d8d52d', 'tenant-portharcourt', 'INVE-fa58eb191b37', 'MUDARA-babee6b33b3f', 'FUND-fafb9e2b482a', 'MUDARA-0c47c999b584', 5065497.67, 'NGN', 49.0174, 48.3497, 305, 'MUDARA-e0c09ac99e48', 'https://cdn.54bank.ng/mudarabahContracts/56f418c1', 1434330.75, 4365821.67, '{"data": "seed"}'::jsonb, 'completed', 'MUDARA-2e2a1d2df3d6', 'medium', '2025-03-31 12:08:04', '2025-07-25 05:16:44'),
  ('CONT-71a6a9f2f55e', 'tenant-portharcourt', 'INVE-b1a6c8833e5a', 'MUDARA-1292f2a507e7', 'FUND-ae68ee47e27a', 'MUDARA-3154e0b53e1d', 888854.36, 'NGN', 55.6674, 72.9217, 696, 'MUDARA-501a2cef89fb', 'https://cdn.54bank.ng/mudarabahContracts/991df09c', 2029034.48, 364161.17, '{"data": "seed"}'::jsonb, 'pending', 'MUDARA-2d2b68b48604', 'high', '2026-01-02 05:23:06', '2025-07-04 23:06:00'),
  ('CONT-981e97e2d851', 'tenant-kano-north', 'INVE-0fd271597896', 'MUDARA-fea1c28ddd4c', 'FUND-fc30293b13c6', 'MUDARA-3c4a361bd20a', 8758056.81, 'NGN', 78.4015, 42.637, 736, 'MUDARA-9ddb448c9bc8', 'https://cdn.54bank.ng/mudarabahContracts/8e255949', 7453129.94, 7769636.04, '{"data": "seed"}'::jsonb, 'processing', 'MUDARA-ace04d69620a', 'critical', '2026-02-09 01:59:59', '2025-03-20 03:39:21'),
  ('CONT-240ccfebae39', 'tenant-portharcourt', 'INVE-3aee43674c76', 'MUDARA-b80c0425fb6d', 'FUND-07029f10e87d', 'MUDARA-9e8dc6f1ac32', 206964.25, 'NGN', 29.5264, 67.7094, 41, 'MUDARA-d253faf0f630', 'https://cdn.54bank.ng/mudarabahContracts/76377c01', 1599656.54, 6291435.72, '{"data": "seed"}'::jsonb, 'pending', 'MUDARA-d03a603d8cf5', 'medium', '2025-06-21 14:34:24', '2025-10-23 23:30:26'),
  ('CONT-f2586d183199', 'tenant-whitelabel-zenith', 'INVE-4f7c3eac482e', 'MUDARA-0fcb1bb5049a', 'FUND-eb58d5ec6213', 'MUDARA-f1b940475a18', 2908729.17, 'USD', 6.3072, 19.9635, 148, 'MUDARA-4b0fc4b4df4a', 'https://cdn.54bank.ng/mudarabahContracts/0c85df4c', 5226647.37, 4826224.22, '{"data": "seed"}'::jsonb, 'pending', 'MUDARA-0f9347928224', 'critical', '2025-12-02 11:31:57', '2025-11-11 19:42:02'),
  ('CONT-b8aeb9918ef2', 'tenant-lagos-main', 'INVE-9646ff521525', 'MUDARA-36dbf0d8a870', 'FUND-4b9bdd24b49b', 'MUDARA-755f9fe7df96', 7557238.64, 'NGN', 33.532, 80.58, 436, 'MUDARA-f5ef8ec36af6', 'https://cdn.54bank.ng/mudarabahContracts/88589f78', 4470927.69, 5444288.32, '{"data": "seed"}'::jsonb, 'processing', 'MUDARA-0e1972dc8a0f', 'critical', '2025-05-16 22:31:38', '2026-03-15 01:24:33'),
  ('CONT-dfbcd6f74bab', 'tenant-kano-north', 'INVE-bcd7414f7de0', 'MUDARA-7557d86baff0', 'FUND-554e0b1b35ec', 'MUDARA-465a6a368e9d', 5148969.97, 'NGN', 93.7893, 88.3519, 516, 'MUDARA-35a9b6d15f52', 'https://cdn.54bank.ng/mudarabahContracts/261d274e', 5502696.99, 7126098.35, '{"data": "seed"}'::jsonb, 'completed', 'MUDARA-9df78932e485', 'medium', '2025-12-27 23:13:16', '2025-09-14 13:20:07'),
  ('CONT-84215b8b5c1e', 'tenant-whitelabel-zenith', 'INVE-df03b80a3293', 'MUDARA-4a64fd2df66b', 'FUND-1fcfe77668f1', 'MUDARA-ba349c85aa26', 5431851.33, 'GBP', 65.6203, 32.5366, 35, 'MUDARA-94fb47cbc8ba', 'https://cdn.54bank.ng/mudarabahContracts/ef0bb7ec', 8262029.13, 7263240.67, '{"data": "seed"}'::jsonb, 'processing', 'MUDARA-d865035d5010', 'medium', '2026-03-19 08:40:57', '2026-04-21 14:28:27')
ON CONFLICT DO NOTHING;


-- ─── multi_peril_crop_insurance ───
INSERT INTO "multi_peril_crop_insurance" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-e56c2599c096', 'Rasheed Taiwo', 'technology', 'Rasheed Taiwo - Abeokuta - Multi Peril Crop Insurance', 'approved', 7708153.87, 'Kwara', 'REF-8F40B2B142', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-06-25 16:52:21', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-1e65325d1bd7', 'Sade Peterside', 'payments', 'Sade Peterside - Maitama - Multi Peril Crop Insurance', 'completed', 9135792.65, 'Ogun', 'REF-46D39A7E3C', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-04-02 10:46:59', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-cb4c6b19038b', 'Lanre Lawal', 'payments', 'Lanre Lawal - Ikeja - Multi Peril Crop Insurance', 'pending', 2732340.91, 'Ogun', 'REF-838906E6EA', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-11-27 14:29:18', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-e87688ba6b94', 'Musa Adenuga', 'lending', 'Musa Adenuga - Ibadan - Multi Peril Crop Insurance', 'active', 319705.42, 'Anambra', 'REF-FBD4859061', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-09-08 06:30:48', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-eef1b5b31941', 'Grace Adenuga', 'payments', 'Grace Adenuga - Ikeja - Multi Peril Crop Insurance', 'pending', 9091881.41, 'Osun', 'REF-2FDCA463E9', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-11-06 17:21:57', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-bd8cde6f395b', 'Damilola Usman', 'finance', 'Damilola Usman - Warri - Multi Peril Crop Insurance', 'pending', 1967225.8, 'Kaduna', 'REF-FE91B642F8', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-09-21 03:21:03', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-28bfb0dd98cf', 'Adewale Otedola', 'finance', 'Adewale Otedola - Warri - Multi Peril Crop Insurance', 'completed', 902804.48, 'Edo', 'REF-BADF64D7D8', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-03-03 03:26:12', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-0e0f687eeef2', 'Titilayo Eze', 'risk', 'Titilayo Eze - Victoria Island - Multi Peril Crop Insurance', 'approved', 426163.08, 'Ogun', 'REF-E1EA98B490', '{"source": "seed", "table": "multi_peril_crop_insurance"}'::jsonb, '2025-08-19 09:29:58', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── murabahaContracts ───
INSERT INTO "murabahaContracts" ("contractId", "tenantId", "customerId", "customerName", "assetDescription", "assetCategory", "costPrice", "profitMarginPct", "sellingPrice", "currency", "tenorMonths", "instalmentAmount", "totalPaid", "outstandingBalance", "disbursementDate", "maturityDate", "status", "shariaCompliance", "shariaBoardReference", "instalmentSchedule", "createdAt", "updatedAt") VALUES
  ('CONT-a358d01212bd', 'tenant-kano-north', 'CUST-4ae2502dbefc', 'Jide Balogun', '10.0.224.47', 'MURABA-96cd91bb4e22', 733791.92, 4624312.99, 3209485.27, 'NGN', 427, 212538.15, 7986922.22, 27685239.14, 'MURABA-7d41a25300e0', 'https://cdn.54bank.ng/murabahaContracts/d0362bd9', 'active', 'MURABA-6eb85878751f', 'REF-149DECDF28F8', '{"monthly": true}'::jsonb, '2025-12-17 03:52:55', '2025-06-25 18:56:56'),
  ('CONT-79ecc529ecf3', 'tenant-kano-north', 'CUST-b9f6b20cfffe', 'Dorcas Usman', '10.0.149.200', 'MURABA-3e74235eaffe', 6982337.75, 1449371.18, 3544475.08, 'GBP', 152, 6039116.97, 7577056.86, 35919044.35, 'MURABA-dcdc2f75d2a6', 'https://cdn.54bank.ng/murabahaContracts/518002a3', 'processing', 'MURABA-5cd6f7c61402', 'REF-5EF650DDE2CE', '{"monthly": true}'::jsonb, '2025-01-28 01:23:48', '2025-05-14 04:50:07'),
  ('CONT-1cae0f96407a', 'tenant-abuja-digital', 'CUST-cfa66921ada8', 'Adewale Taiwo', '10.0.213.184', 'MURABA-9b5aaf2a7da8', 9076392.48, 5699596.53, 7176029.2, 'NGN', 418, 5736451.93, 3313513.46, 46678785.81, 'MURABA-64d8ac655ef5', 'https://cdn.54bank.ng/murabahaContracts/db6a96c0', 'processing', 'MURABA-75a04f2b38b8', 'REF-BE38DFC6C83C', '{"monthly": true}'::jsonb, '2026-01-28 18:56:17', '2025-04-01 13:30:10'),
  ('CONT-dfa09a83e76c', 'tenant-abuja-digital', 'CUST-724544551112', 'Esther Chukwu', '10.0.147.112', 'MURABA-ce76ee383fa9', 858168.42, 6379241.22, 2052245.79, 'NGN', 346, 2065333.56, 6557628.83, 27501090.31, 'MURABA-453e961ac36a', 'https://cdn.54bank.ng/murabahaContracts/72f9068e', 'completed', 'MURABA-7a05c3bd6d80', 'REF-490CB9872010', '{"monthly": true}'::jsonb, '2025-04-30 23:11:31', '2025-02-27 04:28:51'),
  ('CONT-f46d6d4505f4', 'tenant-kano-north', 'CUST-1b0df8c0533c', 'Pelumi Garba', '10.0.129.5', 'MURABA-54fd3a4fa9ca', 3495055.69, 2015965.04, 5041464.0, 'NGN', 858, 6264759.66, 6762268.16, 11069799.69, 'MURABA-af2dd84726e5', 'https://cdn.54bank.ng/murabahaContracts/c88203f4', 'approved', 'MURABA-dd52f00d20e8', 'REF-1632CDF90F65', '{"monthly": true}'::jsonb, '2025-04-03 21:28:05', '2025-01-30 19:40:00'),
  ('CONT-cd1f04010cbf', 'tenant-lagos-main', 'CUST-d30a8ddf1779', 'Segun Igwe', '10.0.18.233', 'MURABA-0618c06d9a7d', 634090.09, 3499720.62, 6725588.2, 'EUR', 356, 4304866.71, 1325252.36, 1280301.04, 'MURABA-621ac738cd04', 'https://cdn.54bank.ng/murabahaContracts/12d444e7', 'pending', 'MURABA-1e2a3382b291', 'REF-6C6BA97A351A', '{"monthly": true}'::jsonb, '2025-08-31 22:24:19', '2025-10-05 06:18:30'),
  ('CONT-da04d71278c1', 'tenant-lagos-main', 'CUST-a1704c646c77', 'Chidinma Hassan', '10.0.240.211', 'MURABA-175cb8b672ae', 2680129.47, 6903193.16, 6600872.68, 'GBP', 415, 6118114.38, 7955899.68, 26240872.85, 'MURABA-faba7d6eb382', 'https://cdn.54bank.ng/murabahaContracts/cb7ba3c1', 'active', 'MURABA-f54555c771e7', 'REF-7DDE11AB20B7', '{"monthly": true}'::jsonb, '2026-01-03 16:48:41', '2025-08-18 02:21:18'),
  ('CONT-6729dda3bc44', 'tenant-kano-north', 'CUST-8c6e3cbbc2d9', 'Chukwuemeka Dangote', '10.0.65.44', 'MURABA-5e1b9c73eac6', 549183.31, 1127360.85, 5696000.47, 'EUR', 987, 4376127.86, 7682822.13, 6664356.19, 'MURABA-4903de146159', 'https://cdn.54bank.ng/murabahaContracts/4a5cc52b', 'pending', 'MURABA-77b7a2b05d6b', 'REF-6E75D4C354A2', '{"monthly": true}'::jsonb, '2025-04-11 21:13:09', '2026-05-03 14:52:37')
ON CONFLICT DO NOTHING;


-- ─── ndpr_records ───
INSERT INTO "ndpr_records" ("recordType", "subject", "requestType", "responseTimeDays", "slaDeadlineDays", "dataCategories", "dpo", "status", "createdAt") VALUES
  ('enhanced', 'NDPR_R-165857c57273', 'standard', 305, 171, '{"data": "seed"}'::jsonb, 'NDPR_R-1664406eaeb7', 'pending', '2025-08-27 22:07:28'),
  ('premium', 'NDPR_R-f106b835f308', 'standard', 163, 265, '{"data": "seed"}'::jsonb, 'NDPR_R-6d76d1433f22', 'pending', '2025-02-22 18:19:13'),
  ('premium', 'NDPR_R-d87e7fdf8c2d', 'standard', 296, 234, '{"data": "seed"}'::jsonb, 'NDPR_R-c1dd0a3059d0', 'active', '2026-04-09 01:27:48'),
  ('full', 'NDPR_R-ec0424f05136', 'basic', 266, 160, '{"data": "seed"}'::jsonb, 'NDPR_R-fa118f160ceb', 'pending', '2025-03-31 10:31:05'),
  ('standard', 'NDPR_R-6155aecdfd60', 'basic', 84, 30, '{"data": "seed"}'::jsonb, 'NDPR_R-d3f5936773d0', 'active', '2025-12-20 15:45:20'),
  ('full', 'NDPR_R-b70932a76e6c', 'enhanced', 114, 13, '{"data": "seed"}'::jsonb, 'NDPR_R-48803aaa203c', 'pending', '2025-11-18 03:55:47'),
  ('basic', 'NDPR_R-73b905b8dec6', 'full', 285, 224, '{"data": "seed"}'::jsonb, 'NDPR_R-915aeca30d92', 'active', '2026-03-01 18:43:35'),
  ('premium', 'NDPR_R-661e1e6ffe82', 'standard', 220, 108, '{"data": "seed"}'::jsonb, 'NDPR_R-455bf100dc70', 'approved', '2025-11-03 07:43:15')
ON CONFLICT DO NOTHING;


-- ─── network_policies ───
INSERT INTO "network_policies" ("name", "namespace", "podSelector", "ingressRules", "egressRules", "appliedPods", "deniedConnections24h", "status", "createdAt") VALUES
  ('Uzo Jimoh', 'NETWOR-27dd1209a6b5', 'NETWOR-9fd274ea13f9', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 85, 151, 'approved', '2026-05-07 05:24:56'),
  ('Nnamdi Elumelu', 'NETWOR-f18c78b5c8c5', 'NETWOR-968e76c51ca8', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 943, 897, 'active', '2026-02-23 08:29:15'),
  ('Chukwuemeka Otedola', 'NETWOR-dd40c2e43930', 'NETWOR-672a3c9d6513', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 333, 353, 'active', '2025-08-18 19:51:58'),
  ('Bukola Mohammed', 'NETWOR-42c5f7505f25', 'NETWOR-44cb848e89bc', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 428, 197, 'pending', '2026-02-12 18:48:19'),
  ('Olumide Peterside', 'NETWOR-3ab4c811f7f4', 'NETWOR-f3a47cfe997d', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 854, 617, 'processing', '2025-10-16 20:23:45'),
  ('Hassan Eze', 'NETWOR-822a5bd6f849', 'NETWOR-ad32f047c729', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 324, 849, 'completed', '2026-04-13 03:47:21'),
  ('Adewale Nwosu', 'NETWOR-7b1f8fa92a8b', 'NETWOR-a0738dd604eb', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 213, 266, 'processing', '2025-09-01 00:54:29'),
  ('Olumide Adenuga', 'NETWOR-b48d21f87abe', 'NETWOR-f771f17e1682', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, 511, 11, 'active', '2025-04-27 20:03:58')
ON CONFLICT DO NOTHING;


-- ─── nfiu_filings ───
INSERT INTO "nfiu_filings" ("reportType", "customerId", "customerName", "amountNGN", "transactionType", "status", "cbnReference", "slaDeadline", "filedAt", "createdAt") VALUES
  ('standard', 'CUST-2f99b917d09e', 'Gbenga Fashola', 5871604.43, 'premium', 'processing', 'REF-E9523BBC6AC3', '2025-05-15 09:28:34', '2025-10-11 09:23:13', '2025-11-22 19:24:23'),
  ('enhanced', 'CUST-7ee747a53a2f', 'Lilian Fashola', 8827859.72, 'premium', 'approved', 'REF-2F321691445D', '2025-02-07 21:34:29', '2026-04-10 23:53:40', '2025-06-08 00:16:00'),
  ('enhanced', 'CUST-7679ba429029', 'Oluchi Taiwo', 629440.26, 'premium', 'processing', 'REF-4AC702BDC884', '2025-05-23 12:59:28', '2026-03-03 03:15:14', '2025-05-22 09:11:21'),
  ('standard', 'CUST-04e095db2c04', 'Grace Adeyemi', 3161700.7, 'enhanced', 'approved', 'REF-130B557B243C', '2025-10-07 08:28:30', '2025-03-16 12:46:18', '2025-09-21 08:36:30'),
  ('full', 'CUST-57cd8f00239a', 'Jumoke Danladi', 9990098.7, 'standard', 'active', 'REF-F04026340E9E', '2026-03-09 17:05:08', '2025-10-05 06:16:18', '2025-09-08 17:30:39'),
  ('enhanced', 'CUST-05d1e2734b79', 'Ifeoma Usman', 9607673.58, 'premium', 'approved', 'REF-10401F201843', '2025-02-28 21:33:08', '2025-06-29 09:12:59', '2025-04-12 06:44:47'),
  ('premium', 'CUST-b270b953119c', 'Patience Kalu', 1474753.58, 'standard', 'processing', 'REF-A24BCCF92406', '2025-10-14 14:45:38', '2026-02-23 07:13:28', '2025-11-25 21:29:23'),
  ('premium', 'CUST-c632611a5334', 'Bukola Fashola', 7152261.82, 'premium', 'processing', 'REF-67B71F283F61', '2025-11-26 10:55:09', '2025-05-13 04:49:06', '2026-02-14 07:58:14')
ON CONFLICT DO NOTHING;


-- ─── nirsal_agro_geocoop ───
INSERT INTO "nirsal_agro_geocoop" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-cc9c55791448', 'Hauwa Hassan', 'payments', 'Hauwa Hassan - Zaria - Nirsal Agro Geocoop', 'active', 4298704.84, 'Kaduna', 'REF-BD22F8E23C', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-04-06 11:06:57', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-c81af1fa3f63', 'Ifeoma Dangote', 'lending', 'Ifeoma Dangote - Ikeja - Nirsal Agro Geocoop', 'completed', 7854551.04, 'Rivers', 'REF-193B81E76B', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-07-14 01:57:27', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c19cffd5fd45', 'Maryam Okafor', 'operations', 'Maryam Okafor - Wuse - Nirsal Agro Geocoop', 'approved', 7428941.62, 'Kwara', 'REF-2903B2E096', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-03-15 04:27:58', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-6d410410dcf1', 'Rahma Adeyemi', 'risk', 'Rahma Adeyemi - Maitama - Nirsal Agro Geocoop', 'completed', 2709694.19, 'Edo', 'REF-E15648DFAA', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2026-03-28 05:24:14', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-86da23c5c33e', 'Hassan Lawal', 'compliance', 'Hassan Lawal - Zaria - Nirsal Agro Geocoop', 'active', 5641940.09, 'Cross River', 'REF-D40E571DC4', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-11-04 03:51:46', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-92e9c4ef9b60', 'Musa Nwosu', 'operations', 'Musa Nwosu - Victoria Island - Nirsal Agro Geocoop', 'active', 1380330.23, 'Abuja FCT', 'REF-0D3FBFB8D5', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-09-23 09:50:59', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2c0a66698d55', 'Grace Adeyemi', 'compliance', 'Grace Adeyemi - Warri - Nirsal Agro Geocoop', 'pending', 1852932.75, 'Plateau', 'REF-A6AB4E307F', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-11-04 01:53:19', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-6a62c4aea8c4', 'Hauwa Chukwu', 'technology', 'Hauwa Chukwu - Benin City - Nirsal Agro Geocoop', 'completed', 1027885.98, 'Lagos', 'REF-7C44F44E2F', '{"source": "seed", "table": "nirsal_agro_geocoop"}'::jsonb, '2025-03-19 11:39:32', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── nirsal_credit_guarantee ───
INSERT INTO "nirsal_credit_guarantee" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-657917ef1370', 'Jumoke Kalu', 'payments', 'Jumoke Kalu - Kano - Nirsal Credit Guarantee', 'active', 3962587.39, 'Osun', 'REF-B77A3B781F', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-10-08 15:12:00', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-3b772c46a164', 'Hassan Jimoh', 'lending', 'Hassan Jimoh - Asaba - Nirsal Credit Guarantee', 'active', 5704580.73, 'Abuja FCT', 'REF-2A0E571C91', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-08-26 01:21:14', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-9f2d717ef4e7', 'Jide Elumelu', 'finance', 'Jide Elumelu - Victoria Island - Nirsal Credit Guarantee', 'completed', 3584302.8, 'Edo', 'REF-32E5D414E3', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2026-02-02 07:47:23', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-b464d11f62b4', 'Jumoke Adenuga', 'risk', 'Jumoke Adenuga - Maitama - Nirsal Credit Guarantee', 'active', 322581.37, 'Kano', 'REF-BA6FB2B7BA', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2026-01-30 07:33:54', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-46c01995e582', 'Babajide Sanusi', 'finance', 'Babajide Sanusi - Victoria Island - Nirsal Credit Guarantee', 'processing', 1146732.87, 'Borno', 'REF-89A851764F', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-04-15 21:31:23', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-352422423047', 'Adewale Igwe', 'payments', 'Adewale Igwe - Kano - Nirsal Credit Guarantee', 'processing', 1511125.37, 'Borno', 'REF-763DCEBFE2', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-10-07 13:38:14', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c84963305f12', 'Kunle Lawal', 'lending', 'Kunle Lawal - Garki - Nirsal Credit Guarantee', 'approved', 2590381.82, 'Lagos', 'REF-FCB0AFF9D2', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-10-02 04:00:00', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2e1799808a70', 'Sade Adeyemi', 'risk', 'Sade Adeyemi - Lekki - Nirsal Credit Guarantee', 'approved', 3930958.83, 'Osun', 'REF-EBFD31A3B3', '{"source": "seed", "table": "nirsal_credit_guarantee"}'::jsonb, '2025-06-19 12:18:27', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── opensearch_index_configs ───
INSERT INTO "opensearch_index_configs" ("indexName", "shards", "replicas", "resultCacheEnabled", "status", "createdAt") VALUES
  ('OPENSE-64b78f4bbb39', 821, 468, true, 'approved', '2025-03-12 19:50:30'),
  ('OPENSE-88002ae8c335', 355, 445, true, 'approved', '2025-10-11 09:00:15'),
  ('OPENSE-e3377e280e4e', 216, 589, false, 'completed', '2025-03-04 22:31:02'),
  ('OPENSE-848567387ba6', 464, 506, true, 'pending', '2025-05-02 18:57:38'),
  ('OPENSE-6a68f8ca0ec1', 824, 889, true, 'active', '2025-06-08 03:52:15'),
  ('OPENSE-b6054d866e6c', 117, 691, false, 'approved', '2025-12-28 06:30:53'),
  ('OPENSE-c2af641fa1e5', 665, 57, true, 'approved', '2025-01-16 11:44:55'),
  ('OPENSE-9ead27fcd854', 134, 128, false, 'approved', '2025-11-26 14:15:12')
ON CONFLICT DO NOTHING;


-- ─── optimistic_ui_configs ───
INSERT INTO "optimistic_ui_configs" ("action", "endpoint", "rollbackOnError", "successRate", "perceivedLatencyMs", "status", "createdAt") VALUES
  ('OPTIMI-ebaf8bb0c4bf', 'OPTIMI-6ec66d385cd6', false, 'OPTIMI-8b379da1b1a8', 898, 'approved', '2026-02-14 18:40:38'),
  ('OPTIMI-ca07c1f25ab9', 'OPTIMI-e5964333430a', true, 'OPTIMI-e3c41a9e8f37', 786, 'completed', '2025-07-07 20:55:32'),
  ('OPTIMI-4d186fd8c3fe', 'OPTIMI-8625f1ffaa79', true, 'OPTIMI-cbbcbc60ab58', 833, 'completed', '2025-09-20 11:16:42'),
  ('OPTIMI-04588feac37a', 'OPTIMI-ffc3626b0b46', false, 'OPTIMI-77887e405105', 598, 'pending', '2026-02-03 06:21:46'),
  ('OPTIMI-0c4231375063', 'OPTIMI-b1df43ab75c9', true, 'OPTIMI-5394779e51c8', 160, 'completed', '2025-08-11 03:45:52'),
  ('OPTIMI-9068561cfec3', 'OPTIMI-95f29adb938b', true, 'OPTIMI-cd658bd1c8a0', 73, 'processing', '2025-07-31 00:06:00'),
  ('OPTIMI-13e02bbe6594', 'OPTIMI-209a16cc602c', true, 'OPTIMI-9575c21a3bf3', 610, 'processing', '2025-06-07 05:49:05'),
  ('OPTIMI-f552234cb1fd', 'OPTIMI-2ec60511e636', false, 'OPTIMI-bf993942e224', 759, 'completed', '2025-09-27 04:18:36')
ON CONFLICT DO NOTHING;


-- ─── otp_records ───
INSERT INTO "otp_records" ("otpId", "policyId", "customerId", "channel", "purpose", "otpHash", "status", "attempts", "deliveredVia", "expiresAt", "verifiedAt", "createdAt") VALUES
  ('OTPI-86018b9688ec', 'POLI-22eed0de496d', 'CUST-7590ededb203', 'whatsapp', 'OTP_RE-469976ab54ca', 'OTP_RE-006a8ef9ad53', 'approved', 660, 'OTP_RE-219f837858bb', '2025-09-18 02:54:50', '2025-05-28 03:48:43', '2026-03-09 03:25:56'),
  ('OTPI-c97975af3b4b', 'POLI-46705b7874c8', 'CUST-6c2029a4b9d7', 'web', 'OTP_RE-8edf6e135b6d', 'OTP_RE-82aafe973f4f', 'processing', 629, 'OTP_RE-7ce0a99d1ed2', '2026-04-18 00:15:52', '2026-01-02 22:25:16', '2025-03-20 12:04:11'),
  ('OTPI-12b77c1cfa2d', 'POLI-2199529d2141', 'CUST-2e95a486e6e8', 'web', 'OTP_RE-4bc2e13079c3', 'OTP_RE-a3f2dbf891e7', 'active', 843, 'OTP_RE-5719b4fa6786', '2025-11-12 07:28:45', '2025-12-18 08:12:56', '2025-12-27 23:21:01'),
  ('OTPI-9da12ece5095', 'POLI-afa0384b1ebe', 'CUST-1600e142672f', 'pos', 'OTP_RE-c2adcc37d419', 'OTP_RE-4ca0f47a167e', 'completed', 32, 'OTP_RE-a1716fc38407', '2025-05-26 17:09:55', '2025-04-05 07:04:01', '2026-04-13 04:14:38'),
  ('OTPI-aa039786bead', 'POLI-06452781c07d', 'CUST-f11c4ad7070f', 'voice', 'OTP_RE-8e5e7f8cd657', 'OTP_RE-dc2d889c415a', 'completed', 207, 'OTP_RE-aa0567b9b8e6', '2025-07-08 06:07:29', '2025-06-04 16:21:58', '2026-02-23 16:32:50'),
  ('OTPI-790cb5a8beb1', 'POLI-3ab530579d48', 'CUST-a5d23b1996d2', 'ussd', 'OTP_RE-08a564fbd00b', 'OTP_RE-5fc94912bca0', 'active', 467, 'OTP_RE-214971e0e478', '2025-03-08 01:46:14', '2025-10-24 06:42:44', '2025-09-09 12:05:03'),
  ('OTPI-fb353d721079', 'POLI-81808a4009a2', 'CUST-5ad07dfac59c', 'mobile', 'OTP_RE-395eb2cd79fa', 'OTP_RE-3808ea187a8c', 'pending', 968, 'OTP_RE-e4c45892b2ce', '2026-03-09 14:39:45', '2025-10-23 13:45:37', '2025-04-16 08:34:51'),
  ('OTPI-dd90884522f1', 'POLI-ec838dd6d347', 'CUST-0ecb8ae165f7', 'voice', 'OTP_RE-2b9cd28d1f3d', 'OTP_RE-f2322728f10d', 'active', 126, 'OTP_RE-402775eba5d8', '2025-12-25 19:41:58', '2025-09-23 16:06:08', '2025-12-02 17:40:23')
ON CONFLICT DO NOTHING;


-- ─── output_encoding_rules ───
INSERT INTO "output_encoding_rules" ("context", "encoder", "charsEncoded", "xssBlocked", "status", "createdAt") VALUES
  ('OUTPUT-c3d031488c7e', 'OUTPUT-3616165afd90', '{"data": "seed"}'::jsonb, 600, 'active', '2025-08-08 10:52:38'),
  ('OUTPUT-d03717a130ba', 'OUTPUT-c65fb9614281', '{"data": "seed"}'::jsonb, 990, 'approved', '2026-04-04 00:53:01'),
  ('OUTPUT-69a8b3139b07', 'OUTPUT-e071b8f525f7', '{"data": "seed"}'::jsonb, 931, 'approved', '2025-03-24 08:52:11'),
  ('OUTPUT-0997beac2b49', 'OUTPUT-ecfc7ca22db1', '{"data": "seed"}'::jsonb, 966, 'processing', '2025-05-13 10:19:29'),
  ('OUTPUT-221b5a49f59c', 'OUTPUT-0dd18fd04cd7', '{"data": "seed"}'::jsonb, 346, 'active', '2025-10-21 15:59:56'),
  ('OUTPUT-0afd9dfceaf4', 'OUTPUT-e519df6dab63', '{"data": "seed"}'::jsonb, 997, 'active', '2026-02-06 11:14:52'),
  ('OUTPUT-e4aa67de2a1f', 'OUTPUT-9f1c974d527c', '{"data": "seed"}'::jsonb, 76, 'approved', '2025-03-09 19:25:29'),
  ('OUTPUT-5666c22ca5eb', 'OUTPUT-742251937558', '{"data": "seed"}'::jsonb, 925, 'completed', '2025-12-07 10:48:14')
ON CONFLICT DO NOTHING;


-- ─── parametric_insurance_iot ───
INSERT INTO "parametric_insurance_iot" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-c99bd40e155f', 'Rasheed Balogun', 'payments', 'Rasheed Balogun - Zaria - Parametric Insurance Iot', 'active', 6081821.75, 'Oyo', 'REF-A718C97180', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2026-03-07 12:29:22', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-c957bab5f8bf', 'Titilayo Eze', 'technology', 'Titilayo Eze - Garki - Parametric Insurance Iot', 'approved', 9110699.78, 'Imo', 'REF-1B215A523C', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-04-15 03:58:35', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-bda89bb6bf85', 'Bukola Okafor', 'technology', 'Bukola Okafor - Abeokuta - Parametric Insurance Iot', 'pending', 9663063.76, 'Kano', 'REF-FD4871981E', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-03-14 02:47:35', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-40ad44f7587b', 'Babajide Kalu', 'risk', 'Babajide Kalu - Abeokuta - Parametric Insurance Iot', 'completed', 2632547.86, 'Kano', 'REF-E37D0BA7D0', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-01-23 16:34:11', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-4a7569f67aa7', 'Adaeze Yakubu', 'finance', 'Adaeze Yakubu - Zaria - Parametric Insurance Iot', 'processing', 4966604.2, 'Ogun', 'REF-E477D4CD87', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-05-02 02:20:59', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a3dec6e1c31b', 'Grace Lawal', 'operations', 'Grace Lawal - Victoria Island - Parametric Insurance Iot', 'pending', 378313.56, 'Akwa Ibom', 'REF-C6322C3A89', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-03-02 06:42:29', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-eedd8ca073c8', 'Damilola Hassan', 'technology', 'Damilola Hassan - Ibadan - Parametric Insurance Iot', 'completed', 9807594.96, 'Edo', 'REF-DE8AFEC53D', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2025-12-15 14:53:26', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-0d21c98bc007', 'Babajide Elumelu', 'payments', 'Babajide Elumelu - Victoria Island - Parametric Insurance Iot', 'processing', 8667862.35, 'Enugu', 'REF-C58470289B', '{"source": "seed", "table": "parametric_insurance_iot"}'::jsonb, '2026-03-21 00:39:03', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── partnerApprovalRecords ───
INSERT INTO "partnerApprovalRecords" ("approvalId", "partnerId", "stage", "title", "detail", "state", "requiredRole", "requestedAt", "requestedById", "resolvedAt", "resolutionNote") VALUES
  ('APPR-d262267b18c9', 'PART-d8b9c61a1495', 'PARTNE-5cef791ee09d', 'PARTNE-93c0fcaf9797', 'Kemi Sanusi - Benin City, Edo - partnerApprovalRecords record', 'Akwa Ibom', 'PARTNE-4775a5626cda', '2026-03-23 02:28:34', 'REQU-9393eb44dcba', '2026-01-28 11:49:13', 'PARTNE-17e490ec9e59'),
  ('APPR-38ccd793e1bb', 'PART-982b757c53f0', 'PARTNE-435a0bc7969d', 'PARTNE-3e9fb05d9731', 'Dorcas Garba - Port Harcourt, Edo - partnerApprovalRecords record', 'Akwa Ibom', 'PARTNE-d11b7c35aba7', '2025-10-06 05:25:50', 'REQU-383a8451f52d', '2025-03-26 20:23:49', 'PARTNE-f56b5b764d2e'),
  ('APPR-851bd942a567', 'PART-a26e57cd590d', 'PARTNE-66c6f4a1f06f', 'PARTNE-1b9a8935ed46', 'Nnamdi Mohammed - Maitama, Oyo - partnerApprovalRecords record', 'Borno', 'PARTNE-95d15a0b3d58', '2026-03-08 21:27:33', 'REQU-7f856a91d63b', '2025-07-13 20:24:50', 'PARTNE-50bf9c8ab72d'),
  ('APPR-cc6006c05e58', 'PART-73aa929b0abf', 'PARTNE-2bb06c604530', 'PARTNE-7829f63c5d18', 'Kemi Danladi - Garki, Borno - partnerApprovalRecords record', 'Oyo', 'PARTNE-aa3f84061d2e', '2026-05-02 09:35:34', 'REQU-3b552d53ba4f', '2025-11-26 01:50:50', 'PARTNE-37baa46889f4'),
  ('APPR-0ccff7a59294', 'PART-c77e5a7a3393', 'PARTNE-5bd4902848b2', 'PARTNE-71fdf9854912', 'Lilian Mohammed - Zaria, Cross River - partnerApprovalRecords record', 'Cross River', 'PARTNE-4e8816d05fd5', '2026-02-22 18:06:53', 'REQU-8163a3689bec', '2026-04-11 06:40:43', 'PARTNE-0675432a1e69'),
  ('APPR-f09ffd8860a9', 'PART-a113e1a2f7ea', 'PARTNE-ef455421f104', 'PARTNE-ec0ddc6da24e', 'Adaeze Eze - Wuse, Delta - partnerApprovalRecords record', 'Kaduna', 'PARTNE-bfd27b8fda36', '2026-02-04 22:49:54', 'REQU-681644af3e68', '2026-04-03 14:46:52', 'PARTNE-03c67d130f05'),
  ('APPR-8c3c0db5e0aa', 'PART-3db531fae3c4', 'PARTNE-a69781b51453', 'PARTNE-ef5ea44ecd44', 'Femi Okafor - Warri, Anambra - partnerApprovalRecords record', 'Cross River', 'PARTNE-021682259216', '2025-10-28 00:33:34', 'REQU-d1475d8d2e18', '2026-03-06 17:39:26', 'PARTNE-ecc8529dfa90'),
  ('APPR-a87e0d06ccba', 'PART-2ea108ea114f', 'PARTNE-6f51a64fe8f8', 'PARTNE-c081e5cd6461', 'Musa Mohammed - Ikeja, Kaduna - partnerApprovalRecords record', 'Akwa Ibom', 'PARTNE-b7cafb7c161c', '2026-02-17 09:52:25', 'REQU-4ef6068e9f9a', '2025-02-26 10:03:40', 'PARTNE-cfd5abb0c92a')
ON CONFLICT DO NOTHING;


-- ─── partnerOnboardingRecords ───
INSERT INTO "partnerOnboardingRecords" ("partnerId", "tenantId", "partnerName", "legalEntity", "partnerType", "region", "stage", "requestedModules", "primaryContact", "operationsContact", "commercial", "compliance", "branding", "checklist", "completed", "blockers", "readinessScore", "createdAt", "updatedAt", "submittedAt", "launchedAt", "lastSubmittedBy") VALUES
  ('PART-1b440e19842c', 'tenant-whitelabel-zenith', 'PARTNE-128dec13da3b', 'PARTNE-2e63434a39b3', 'full', 'Imo', 'PARTNE-c743ee4526e0', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, false, '{"data": "seed"}'::jsonb, 14, '2025-09-05 19:40:25', '2025-04-21 09:52:55', '2026-04-06 17:11:46', '2026-04-25 22:51:51', 'PARTNE-77dc47aa9bac'),
  ('PART-242585dc2c46', 'tenant-whitelabel-zenith', 'PARTNE-1f181cdaa3c9', 'PARTNE-f6cc074d28dc', 'basic', 'Oyo', 'PARTNE-dc9aeaf1a796', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, true, '{"data": "seed"}'::jsonb, 95, '2025-05-12 03:46:04', '2025-10-11 15:01:07', '2025-12-17 22:26:25', '2025-02-26 18:42:27', 'PARTNE-d10d118809e8'),
  ('PART-d7b0f073828f', 'tenant-kano-north', 'PARTNE-18137390490f', 'PARTNE-feda6763bc13', 'basic', 'Enugu', 'PARTNE-31289d2b3c04', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, false, '{"data": "seed"}'::jsonb, 71, '2025-09-11 18:26:47', '2025-10-05 14:58:57', '2025-06-27 11:47:25', '2025-09-11 10:27:32', 'PARTNE-e5e81ea205cf'),
  ('PART-bab1dd201462', 'tenant-whitelabel-zenith', 'PARTNE-e8ce0fb46e39', 'PARTNE-06870820c1dc', 'enhanced', 'Kaduna', 'PARTNE-8ea63622b59e', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, true, '{"data": "seed"}'::jsonb, 54, '2025-07-17 17:35:59', '2025-07-01 15:11:25', '2025-08-04 07:01:56', '2025-07-24 15:04:58', 'PARTNE-4d524326d891'),
  ('PART-bcdcd78a4c4b', 'tenant-abuja-digital', 'PARTNE-b843b0fe9130', 'PARTNE-aa9a49f1b05d', 'enhanced', 'Lagos', 'PARTNE-ae3495a411a2', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, true, '{"data": "seed"}'::jsonb, 47, '2025-04-18 07:43:51', '2025-08-15 14:18:49', '2025-11-09 11:35:44', '2025-05-20 02:21:31', 'PARTNE-c04b4e5a0a41'),
  ('PART-e2212d988d67', 'tenant-abuja-digital', 'PARTNE-234ddc6a2e6b', 'PARTNE-0288da417845', 'standard', 'Oyo', 'PARTNE-273af5c5ef88', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, true, '{"data": "seed"}'::jsonb, 29, '2025-03-07 18:39:02', '2025-01-04 22:40:37', '2025-10-26 12:03:31', '2026-02-10 20:23:50', 'PARTNE-571727589454'),
  ('PART-e4c00e16bd07', 'tenant-portharcourt', 'PARTNE-5a9ed97e1f88', 'PARTNE-2b9bea0216e6', 'full', 'Abuja FCT', 'PARTNE-e7a05181509f', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, true, '{"data": "seed"}'::jsonb, 50, '2025-08-31 16:44:54', '2025-12-16 06:44:33', '2025-03-25 04:50:41', '2025-01-30 12:58:29', 'PARTNE-7cfc4388b560'),
  ('PART-445f8cff26a4', 'tenant-abuja-digital', 'PARTNE-3f1b87a83946', 'PARTNE-818211cc785c', 'premium', 'Plateau', 'PARTNE-d49ca8ab05bb', '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, '{"data": "seed"}'::jsonb, false, '{"data": "seed"}'::jsonb, 54, '2026-01-14 10:31:39', '2025-06-08 18:15:00', '2025-03-18 10:32:29', '2025-09-02 12:42:14', 'PARTNE-1db5fc2d6e6d')
ON CONFLICT DO NOTHING;


-- ─── path_validation_rules ───
INSERT INTO "path_validation_rules" ("pattern", "regex", "blocked24h", "commonViolations", "status", "createdAt") VALUES
  ('PATH_V-fb1f87d1f8fe', 'PATH_V-0c61c282bd8e', 566, '{"data": "seed"}'::jsonb, 'processing', '2025-10-20 20:59:00'),
  ('PATH_V-6e088606c888', 'PATH_V-94023d8f5829', 605, '{"data": "seed"}'::jsonb, 'processing', '2025-03-06 15:52:39'),
  ('PATH_V-f9da845abde1', 'PATH_V-6679f4c9aca4', 28, '{"data": "seed"}'::jsonb, 'processing', '2025-11-03 04:27:55'),
  ('PATH_V-9822f3494b60', 'PATH_V-c83d0a8c9845', 269, '{"data": "seed"}'::jsonb, 'pending', '2025-12-02 11:12:21'),
  ('PATH_V-d532968c0082', 'PATH_V-054fc2e14b4a', 385, '{"data": "seed"}'::jsonb, 'active', '2025-08-19 11:14:31'),
  ('PATH_V-9ed402515b1b', 'PATH_V-a3ed231b6fae', 22, '{"data": "seed"}'::jsonb, 'approved', '2026-02-12 10:09:06'),
  ('PATH_V-11fcb8b558ac', 'PATH_V-efe4790c309f', 763, '{"data": "seed"}'::jsonb, 'pending', '2025-07-17 07:32:45'),
  ('PATH_V-be0f06946b7c', 'PATH_V-e879b190c634', 782, '{"data": "seed"}'::jsonb, 'completed', '2026-04-04 18:05:09')
ON CONFLICT DO NOTHING;


-- ─── pci_scans ───
INSERT INTO "pci_scans" ("requirement", "totalControls", "passing", "failing", "findings", "lastScan", "scanDuration", "status", "createdAt") VALUES
  ('PCI_SC-1d472b49937a', 6157, 584, 192, '{"data": "seed"}'::jsonb, '2026-04-23 09:55:56', 'PCI_SC-d4886ea5bfbd', 'completed', '2026-03-23 05:32:57'),
  ('PCI_SC-f1ef41c6e5b3', 3182, 81, 823, '{"data": "seed"}'::jsonb, '2025-06-20 04:18:15', 'PCI_SC-d0e3063b4013', 'processing', '2026-03-26 16:08:14'),
  ('PCI_SC-ec5ff73ea4ff', 9831, 594, 280, '{"data": "seed"}'::jsonb, '2025-10-14 14:25:55', 'PCI_SC-73323b7ce9ae', 'pending', '2025-12-03 19:41:32'),
  ('PCI_SC-e5b57fc6d3e9', 9441, 281, 338, '{"data": "seed"}'::jsonb, '2026-04-22 05:02:49', 'PCI_SC-3328ce3045f2', 'pending', '2025-03-29 07:06:37'),
  ('PCI_SC-1a3c03f1ecb2', 1230, 18, 385, '{"data": "seed"}'::jsonb, '2025-02-28 04:09:51', 'PCI_SC-d16ab276ca56', 'pending', '2025-03-16 02:46:52'),
  ('PCI_SC-a5357cadf601', 4261, 352, 943, '{"data": "seed"}'::jsonb, '2025-07-26 19:06:39', 'PCI_SC-945ea1112965', 'approved', '2025-09-02 13:06:15'),
  ('PCI_SC-fd83ce6410ba', 20, 778, 825, '{"data": "seed"}'::jsonb, '2025-05-15 03:28:52', 'PCI_SC-d5fd3db90a11', 'approved', '2025-08-16 12:52:17'),
  ('PCI_SC-9f1206d34236', 6919, 780, 408, '{"data": "seed"}'::jsonb, '2025-12-12 00:43:22', 'PCI_SC-cbd6c7b099a6', 'approved', '2025-07-13 16:54:43')
ON CONFLICT DO NOTHING;


-- ─── pentest_scans ───
INSERT INTO "pentest_scans" ("name", "scope", "scanType", "target", "totalFindings", "critical", "high", "medium", "low", "remediated", "vendor", "status", "createdAt") VALUES
  ('Tunde Otedola', 'PENTES-4d7f58825588', 'full', 'PENTES-c1aae6dee833', 1748, 915, 797, 139, 31, 181, 'PENTES-7f1a3a24de43', 'approved', '2025-05-22 03:58:07'),
  ('Emeka Hassan', 'PENTES-33b141e947b0', 'basic', 'PENTES-a240873079cc', 5910, 32, 105, 186, 149, 430, 'PENTES-32a6314c8b33', 'completed', '2025-11-04 19:49:52'),
  ('Lanre Danladi', 'PENTES-95c3b3826f3e', 'full', 'PENTES-bc3426746660', 5903, 662, 242, 191, 854, 344, 'PENTES-de6d7334e972', 'completed', '2025-11-03 19:18:09'),
  ('Ibrahim Danladi', 'PENTES-80d5141e419b', 'enhanced', 'PENTES-a5ba126d8f57', 5074, 511, 391, 84, 62, 587, 'PENTES-922b2a27b4e4', 'approved', '2025-12-01 02:33:47'),
  ('Damilola Garba', 'PENTES-3f8675ea4e56', 'standard', 'PENTES-d46907771911', 7643, 655, 633, 452, 345, 939, 'PENTES-846cdd3ce901', 'approved', '2025-10-24 17:24:11'),
  ('Titilayo Peterside', 'PENTES-546c4c066eb8', 'full', 'PENTES-ea56ffb17f85', 193, 651, 746, 447, 674, 303, 'PENTES-8ebc6c67c40b', 'completed', '2025-03-26 00:20:22'),
  ('Lanre Taiwo', 'PENTES-9fd67e55e17d', 'standard', 'PENTES-d25108a97f6d', 4601, 931, 810, 52, 203, 439, 'PENTES-c4dc8040fc53', 'active', '2025-12-25 19:33:32'),
  ('Chukwuemeka Yakubu', 'PENTES-5634d4e45950', 'basic', 'PENTES-fbb2127944ae', 5175, 944, 138, 238, 670, 891, 'PENTES-e79fc82d1d3d', 'approved', '2025-04-09 19:21:48')
ON CONFLICT DO NOTHING;


-- ─── pgbouncer_pools ───
INSERT INTO "pgbouncer_pools" ("database", "poolMode", "activeConnections", "idleConnections", "maxClientConn", "status", "createdAt") VALUES
  ('PGBOUN-48af23e908dc', 'PGBOUN-a70fd3364040', 491, 787, 950, 'completed', '2025-04-17 10:34:52'),
  ('PGBOUN-ca53d8bbe805', 'PGBOUN-ffdf5ee2796a', 244, 941, 372, 'active', '2025-05-02 07:19:04'),
  ('PGBOUN-693308da137c', 'PGBOUN-7b759f5506a9', 105, 348, 23, 'approved', '2025-06-28 02:19:43'),
  ('PGBOUN-83ef22b65dc7', 'PGBOUN-239814e24587', 234, 457, 338, 'approved', '2025-04-25 20:23:23'),
  ('PGBOUN-9dd39e55b94d', 'PGBOUN-0252fb432481', 730, 180, 643, 'processing', '2025-07-01 05:17:51'),
  ('PGBOUN-4ae17d66b1c0', 'PGBOUN-ffb5c03a00fb', 963, 336, 440, 'approved', '2026-05-02 20:06:29'),
  ('PGBOUN-648171c505fb', 'PGBOUN-579db2578d61', 24, 563, 360, 'pending', '2026-04-25 17:36:40'),
  ('PGBOUN-6e7d548e85d6', 'PGBOUN-d7f3ea5ffaa4', 42, 626, 587, 'completed', '2025-08-27 19:38:45')
ON CONFLICT DO NOTHING;


-- ─── pin_hashes ───
INSERT INTO "pin_hashes" ("algorithm", "memoryCost", "timeCost", "parallelism", "saltLength", "hashLength", "migratedFromBcrypt", "status", "createdAt") VALUES
  ('PIN_HA-9b775d383284', 491, 269, 76, 224, 852, 38, 'approved', '2025-10-07 22:21:41'),
  ('PIN_HA-01a5ab373be5', 873, 847, 674, 161, 421, 760, 'processing', '2026-02-06 22:20:55'),
  ('PIN_HA-9a05032f34e5', 469, 412, 388, 448, 57, 698, 'approved', '2025-08-25 18:26:30'),
  ('PIN_HA-0be46b6380c9', 764, 670, 734, 372, 669, 686, 'processing', '2025-02-14 21:12:12'),
  ('PIN_HA-53f8c3ca7b1e', 373, 350, 275, 892, 435, 637, 'pending', '2025-06-26 04:35:55'),
  ('PIN_HA-ca58757ed0eb', 17, 274, 949, 150, 165, 75, 'completed', '2025-12-22 23:13:10'),
  ('PIN_HA-fdc1fcfc91bf', 931, 383, 932, 217, 784, 895, 'completed', '2025-08-29 04:57:01'),
  ('PIN_HA-48101a476bca', 184, 671, 954, 100, 796, 439, 'approved', '2025-01-01 06:44:08')
ON CONFLICT DO NOTHING;


-- ─── pin_verifications ───
INSERT INTO "pin_verifications" ("verificationId", "cardId", "serialNumber", "customerId", "transactionId", "channel", "result", "ipAddress", "deviceId", "timestamp") VALUES
  ('VERI-2a76e5e76f8d', 'CARD-dfe8f860ec6d', 'PIN_VE-fd5c0024e1ec', 'CUST-853974a4d3bf', 'TRAN-398e7efd6b41', 'pos', 'PIN_VE-172ad04897e9', '10.0.74.45', 'DEVI-801e4d9a1651', '2025-09-15 07:59:49'),
  ('VERI-0d8a1dacead7', 'CARD-680ae15518d4', 'PIN_VE-92b8c6fef90a', 'CUST-03c32172ade8', 'TRAN-06f29241566a', 'branch', 'PIN_VE-1ae4a7389511', '10.0.192.99', 'DEVI-92e5af32a92c', '2026-03-04 13:33:22'),
  ('VERI-4cee662824fd', 'CARD-a593a63541b2', 'PIN_VE-83cc5e28533c', 'CUST-1d22fafd0511', 'TRAN-06e77dd33793', 'mobile', 'PIN_VE-9a04104c1cca', '10.0.246.98', 'DEVI-d805780babf9', '2026-03-02 08:09:02'),
  ('VERI-e52ea13b0ee0', 'CARD-afd595e9c6c4', 'PIN_VE-f69439f468db', 'CUST-6c809fee5763', 'TRAN-e63fc18cf17b', 'pos', 'PIN_VE-c1cb06692c45', '10.0.160.101', 'DEVI-b2a23571fbb4', '2025-01-31 18:16:21'),
  ('VERI-10e198be3624', 'CARD-f5a6cf928cf1', 'PIN_VE-f196f13ba20e', 'CUST-2e3a127d9547', 'TRAN-65e99331c4a5', 'ussd', 'PIN_VE-2a39f0cdfa3a', '10.0.70.226', 'DEVI-0f4fc45043cd', '2025-11-16 12:14:18'),
  ('VERI-114d8b19a1f7', 'CARD-b776a213a705', 'PIN_VE-82a9ea3805df', 'CUST-e3649054037d', 'TRAN-ced5232aad52', 'atm', 'PIN_VE-f21f1ad3d4e7', '10.0.82.216', 'DEVI-487fad3e93bd', '2025-12-28 07:44:41'),
  ('VERI-99efec51d681', 'CARD-72020b9353ef', 'PIN_VE-72e361fc9ecb', 'CUST-474f2b61d8fc', 'TRAN-4fa0b0638dff', 'pos', 'PIN_VE-c6c4db707595', '10.0.218.60', 'DEVI-792a8dfd9ee5', '2026-01-22 00:59:25'),
  ('VERI-71f8c52be463', 'CARD-8875a8126e7f', 'PIN_VE-4ce35bc052df', 'CUST-9835e3775b2a', 'TRAN-34ba36cc60fb', 'web', 'PIN_VE-0f0efed75713', '10.0.17.6', 'DEVI-9bab5981e43f', '2026-01-20 07:21:37')
ON CONFLICT DO NOTHING;


-- ─── pkce_flows ───
INSERT INTO "pkce_flows" ("clientId", "grantType", "codeChallengeMethod", "redirectUri", "scopes", "tokenLifetime", "refreshLifetime", "status", "createdAt") VALUES
  ('CLIE-07ff9ee9c37f', 'enhanced', 'PKCE_F-d505ed9fb830', 'https://cdn.54bank.ng/pkce_flows/0b956558', '{"data": "seed"}'::jsonb, 615, 434, 'completed', '2025-12-18 20:18:25'),
  ('CLIE-d5a2f1b07f09', 'premium', 'PKCE_F-fddabe6d91d9', 'https://cdn.54bank.ng/pkce_flows/0b26e4de', '{"data": "seed"}'::jsonb, 511, 17, 'completed', '2025-09-07 16:42:51'),
  ('CLIE-6e3ebd2548b6', 'premium', 'PKCE_F-324aba9aafe9', 'https://cdn.54bank.ng/pkce_flows/9b64e06a', '{"data": "seed"}'::jsonb, 761, 351, 'completed', '2025-04-01 22:11:23'),
  ('CLIE-9d12d2da1f1f', 'premium', 'PKCE_F-8e5d49407490', 'https://cdn.54bank.ng/pkce_flows/87f55216', '{"data": "seed"}'::jsonb, 446, 870, 'processing', '2025-12-28 15:10:52'),
  ('CLIE-074f3f470922', 'full', 'PKCE_F-c76b00c68227', 'https://cdn.54bank.ng/pkce_flows/91570f5c', '{"data": "seed"}'::jsonb, 106, 91, 'pending', '2025-12-01 01:38:22'),
  ('CLIE-1edb5e282d5b', 'full', 'PKCE_F-e72bf6c1125c', 'https://cdn.54bank.ng/pkce_flows/ca811528', '{"data": "seed"}'::jsonb, 182, 326, 'completed', '2025-04-21 04:00:47'),
  ('CLIE-065f98411651', 'premium', 'PKCE_F-8eacde113077', 'https://cdn.54bank.ng/pkce_flows/1138ef8a', '{"data": "seed"}'::jsonb, 106, 613, 'approved', '2026-03-03 15:19:49'),
  ('CLIE-54297d0e72b3', 'enhanced', 'PKCE_F-a75605750502', 'https://cdn.54bank.ng/pkce_flows/97875b55', '{"data": "seed"}'::jsonb, 135, 297, 'pending', '2025-08-23 12:06:46')
ON CONFLICT DO NOTHING;


-- ─── post_harvest_loss_tracker ───
INSERT INTO "post_harvest_loss_tracker" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-96e76b5f2fca', 'Titilayo Yakubu', 'finance', 'Titilayo Yakubu - Warri - Post Harvest Loss Tracker', 'active', 2773509.41, 'Ogun', 'REF-8DF324F0E3', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2026-03-18 04:02:55', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-4bd32b1be0c4', 'Adaeze Adeyemi', 'operations', 'Adaeze Adeyemi - Zaria - Post Harvest Loss Tracker', 'processing', 7950077.08, 'Abuja FCT', 'REF-EB43490E4D', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-02-02 16:33:46', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-3b68a4912075', 'Esther Fashola', 'lending', 'Esther Fashola - Wuse - Post Harvest Loss Tracker', 'active', 260891.04, 'Enugu', 'REF-81BB2AF151', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-05-29 04:50:51', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-91ce8597d758', 'Segun Danladi', 'compliance', 'Segun Danladi - Zaria - Post Harvest Loss Tracker', 'active', 5874482.93, 'Cross River', 'REF-7A4C167778', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-07-23 07:39:21', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-5b4c82855097', 'Adewale Elumelu', 'payments', 'Adewale Elumelu - Zaria - Post Harvest Loss Tracker', 'active', 5184780.82, 'Anambra', 'REF-A8CB7A8D61', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-12-26 19:44:46', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-01e222c3c01f', 'Ibrahim Eze', 'operations', 'Ibrahim Eze - Lekki - Post Harvest Loss Tracker', 'approved', 9298367.63, 'Kano', 'REF-EB19171950', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-08-11 23:40:33', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-d70ca3e46e94', 'Kunle Okafor', 'risk', 'Kunle Okafor - Enugu - Post Harvest Loss Tracker', 'completed', 1345017.17, 'Delta', 'REF-C261DB99CB', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-02-18 06:21:22', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-cc34faf8360b', 'Hauwa Chukwu', 'finance', 'Hauwa Chukwu - Kano - Post Harvest Loss Tracker', 'completed', 933061.85, 'Kwara', 'REF-0F94F9A7C4', '{"source": "seed", "table": "post_harvest_loss_tracker"}'::jsonb, '2025-04-20 05:09:42', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── prepared_statements ───
INSERT INTO "prepared_statements" ("queryPattern", "planCacheHits", "paramTypes", "status", "createdAt") VALUES
  ('PREPAR-8387bad45680', 'PREPAR-7c1f56aec567', 'PREPAR-f727373b8173', 'completed', '2026-02-16 07:05:46'),
  ('PREPAR-60580e3ca0a3', 'PREPAR-a90810bce95c', 'PREPAR-f6a1d8d6a772', 'pending', '2025-12-17 05:38:55'),
  ('PREPAR-004d969a644d', 'PREPAR-0b8ebfff3605', 'PREPAR-fa63efcbc4ed', 'processing', '2026-01-30 23:17:31'),
  ('PREPAR-941d931fcd17', 'PREPAR-92af63fb5dae', 'PREPAR-18d3289fc7da', 'approved', '2025-03-31 18:35:04'),
  ('PREPAR-f8149294465b', 'PREPAR-55e915a0a290', 'PREPAR-d6539abaf26c', 'processing', '2025-03-15 22:00:42'),
  ('PREPAR-d70538987c1d', 'PREPAR-8ec31b76abc8', 'PREPAR-ca9b257f643c', 'completed', '2025-03-17 05:49:12'),
  ('PREPAR-f10785998534', 'PREPAR-c7a64c1a8f19', 'PREPAR-d0d43c26596d', 'pending', '2026-03-14 16:59:39'),
  ('PREPAR-543e3c3125b2', 'PREPAR-6051653380ed', 'PREPAR-4f434c370633', 'pending', '2025-12-30 01:58:35')
ON CONFLICT DO NOTHING;


-- ─── prometheus_dashboards ───
INSERT INTO "prometheus_dashboards" ("dashboard", "panels", "refreshInterval", "alertRules", "dataSourceRetention", "status", "createdAt") VALUES
  ('PROMET-28d3f0675502', 903, 'REF-6502CCDD71CB', 630, 'PROMET-5e2d312e727e', 'processing', '2025-05-18 21:49:48'),
  ('PROMET-9f8851247190', 816, 'REF-70A926D43E72', 825, 'PROMET-9c3db6ff0af0', 'completed', '2026-01-04 05:42:10'),
  ('PROMET-b1a4faec551f', 639, 'REF-E943A346387E', 989, 'PROMET-b0af70b9386d', 'approved', '2025-01-15 00:45:14'),
  ('PROMET-c9e926b40cc5', 373, 'REF-3986FD19115C', 26, 'PROMET-2b7c74a8533c', 'processing', '2025-10-01 05:32:07'),
  ('PROMET-4520c52ddd86', 784, 'REF-7669F1276BF7', 524, 'PROMET-dc0e5095cf5e', 'completed', '2026-04-08 23:08:39'),
  ('PROMET-b91ee24cc49e', 435, 'REF-31DD2F20F932', 97, 'PROMET-790e9fc2dc5e', 'processing', '2025-12-02 13:18:06'),
  ('PROMET-7abd7eb4a3ab', 950, 'REF-CA2A41566C9F', 685, 'PROMET-38a3d3f594f9', 'approved', '2026-03-27 00:38:53'),
  ('PROMET-788f60a81460', 387, 'REF-41BECC4DB440', 344, 'PROMET-a948825eee6b', 'active', '2025-06-26 14:57:24')
ON CONFLICT DO NOTHING;


-- ─── qr_payment_transactions ───
INSERT INTO "qr_payment_transactions" ("tenantId", "merchantName", "merchantId", "qrType", "channel", "customerAccount", "settlementTime", "status", "createdAt") VALUES
  ('tenant-whitelabel-zenith', 'Dominos Wuse', 'MERC-3b80394039de', 'standard', 'mobile', 'QR_PAY-3694e1593030', 'QR_PAY-5daaf5535724', 'processing', '2026-04-03 20:29:49'),
  ('tenant-abuja-digital', 'Shoprite Ikeja', 'MERC-11b62dc49815', 'full', 'mobile', 'QR_PAY-95d30ebcafaa', 'QR_PAY-54466d682c25', 'approved', '2025-11-10 01:37:07'),
  ('tenant-kano-north', 'Total Station', 'MERC-6e9bf67d1611', 'full', 'atm', 'QR_PAY-3e608ddf7313', 'QR_PAY-8fa834ca513d', 'approved', '2025-02-14 09:37:08'),
  ('tenant-whitelabel-zenith', 'Chicken Republic', 'MERC-af728a863fc0', 'standard', 'atm', 'QR_PAY-b4ec439825f8', 'QR_PAY-8337c3f043c0', 'completed', '2026-03-20 03:41:43'),
  ('tenant-portharcourt', 'Total Station', 'MERC-82e78e5d4f11', 'enhanced', 'voice', 'QR_PAY-79a9d35f2e94', 'QR_PAY-38c2b8b544ab', 'approved', '2025-11-20 15:42:12'),
  ('tenant-lagos-main', 'Total Station', 'MERC-b7fabaf63b1d', 'basic', 'web', 'QR_PAY-ec1bd3f932c6', 'QR_PAY-f10c0abb6f7e', 'approved', '2026-01-18 14:50:14'),
  ('tenant-abuja-digital', 'Shoprite Ikeja', 'MERC-5dfe7dee2777', 'premium', 'branch', 'QR_PAY-4b756033761a', 'QR_PAY-a15ba319298d', 'active', '2025-06-03 23:32:17'),
  ('tenant-lagos-main', 'Total Station', 'MERC-6f9aef947264', 'full', 'mobile', 'QR_PAY-d4c8bcad5851', 'QR_PAY-192f1c63b59c', 'active', '2025-07-17 01:59:43')
ON CONFLICT DO NOTHING;


-- ─── quality_certification ───
INSERT INTO "quality_certification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-ef659a633c89', 'Adewale Danladi', 'operations', 'Adewale Danladi - Zaria - Quality Certification', 'active', 606610.89, 'Enugu', 'REF-2FA36E2874', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-05-06 16:54:54', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-07fa6835c44c', 'Chidinma Fashola', 'operations', 'Chidinma Fashola - Wuse - Quality Certification', 'pending', 3467701.59, 'Enugu', 'REF-2833C8C238', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-08-27 12:11:28', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-53d64d88ad34', 'Emeka Dangote', 'compliance', 'Emeka Dangote - Maitama - Quality Certification', 'approved', 1548485.67, 'Delta', 'REF-3023F6F188', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-04-13 00:58:37', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-61c629a8bce4', 'Rasheed Eze', 'risk', 'Rasheed Eze - Awka - Quality Certification', 'completed', 2629595.24, 'Rivers', 'REF-25C8177E73', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-10-31 13:10:08', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-4e78af6aeb34', 'Tunde Otedola', 'risk', 'Tunde Otedola - Warri - Quality Certification', 'approved', 6597128.96, 'Edo', 'REF-23C8760F07', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2026-01-01 04:24:22', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-df847c8fc731', 'Hassan Kalu', 'finance', 'Hassan Kalu - Awka - Quality Certification', 'completed', 6131757.37, 'Kwara', 'REF-B0F7DDAB43', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-04-09 04:53:32', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9f6b568ca659', 'Babajide Fashola', 'compliance', 'Babajide Fashola - Ikeja - Quality Certification', 'active', 4281300.48, 'Cross River', 'REF-F8DAF0682D', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2025-11-05 00:33:35', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-ff9491a1c782', 'Rasheed Dangote', 'technology', 'Rasheed Dangote - Abeokuta - Quality Certification', 'approved', 3338118.42, 'Enugu', 'REF-CE3130E789', '{"source": "seed", "table": "quality_certification"}'::jsonb, '2026-03-21 20:30:30', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── query_cache_entries ───
INSERT INTO "query_cache_entries" ("queryHash", "tableName", "resultCount", "ttlSeconds", "hitRate", "status", "createdAt") VALUES
  ('QUERY_-1f8dbc5039ee', 'QUERY_-8ed2626b47a4', 754, 268, 'QUERY_-9f1c58256a1e', 'processing', '2026-01-25 09:37:19'),
  ('QUERY_-c2ebbd7fe87b', 'QUERY_-ba43edbc2e3b', 4689, 798, 'QUERY_-be4dfec39d96', 'processing', '2026-05-01 10:57:25'),
  ('QUERY_-6927f67d4822', 'QUERY_-b468fabe3a17', 6285, 765, 'QUERY_-10c90f467725', 'pending', '2026-03-05 19:51:07'),
  ('QUERY_-6322818e5b19', 'QUERY_-e1a6092fa044', 9602, 430, 'QUERY_-67a52f9a2fed', 'active', '2026-03-09 12:43:07'),
  ('QUERY_-53e008646c73', 'QUERY_-8058465d315b', 7376, 702, 'QUERY_-cc643e633d8e', 'processing', '2026-01-07 14:27:36'),
  ('QUERY_-e348a22a8184', 'QUERY_-14c00c55ab63', 6427, 625, 'QUERY_-515c98dd3895', 'approved', '2025-02-19 07:43:13'),
  ('QUERY_-0ebb4dda1702', 'QUERY_-0ef58e739b81', 7903, 361, 'QUERY_-591f54d66458', 'completed', '2025-12-23 11:38:52'),
  ('QUERY_-0ebf971dc627', 'QUERY_-5228b67213c7', 3933, 516, 'QUERY_-15d07e5dbed6', 'processing', '2025-10-22 16:04:51')
ON CONFLICT DO NOTHING;


-- ─── read_replica_configs ───
INSERT INTO "read_replica_configs" ("replicaHost", "lagMs", "loadPct", "status", "createdAt") VALUES
  ('READ_R-6f4f5496ae51', 618, 578, 'completed', '2025-02-10 12:20:30'),
  ('READ_R-c61fbca0c2c9', 933, 584, 'pending', '2025-03-16 08:53:28'),
  ('READ_R-f1bee6580824', 231, 967, 'approved', '2026-03-25 05:09:15'),
  ('READ_R-d14a4c11ca00', 527, 663, 'pending', '2026-01-21 06:13:21'),
  ('READ_R-adbe667b1a93', 109, 217, 'active', '2025-02-09 08:59:57'),
  ('READ_R-c09017ff3c96', 167, 965, 'processing', '2025-01-31 03:08:16'),
  ('READ_R-51bc666152ca', 857, 485, 'pending', '2025-09-17 15:20:25'),
  ('READ_R-b1e6615b9739', 573, 537, 'completed', '2025-11-06 10:47:25')
ON CONFLICT DO NOTHING;


-- ─── reconciliationRuns ───
INSERT INTO "reconciliationRuns" ("runId", "tenantId", "runType", "scope", "status", "totalEntriesChecked", "matches", "discrepancies", "autoRepaired", "manualTriage", "durationMs", "startTime", "endTime", "createdAt") VALUES
  ('RUNI-6183912e35df', 'tenant-portharcourt', 'premium', 'RECONC-4cd7f4a8921b', 'pending', 1377, 490, 617, 905, 353, 565, '2025-06-25 07:33:53', '2026-03-20 01:55:24', '2026-01-04 14:45:53'),
  ('RUNI-c8e24f0fe985', 'tenant-kano-north', 'basic', 'RECONC-ce62bfe2564f', 'approved', 7419, 828, 52, 670, 426, 40, '2025-04-24 20:07:56', '2025-06-14 01:28:41', '2026-01-24 07:50:37'),
  ('RUNI-27026e37aa30', 'tenant-kano-north', 'premium', 'RECONC-52efbf266427', 'processing', 3828, 944, 107, 369, 569, 806, '2025-10-18 10:20:52', '2025-01-02 09:05:34', '2025-04-14 21:22:12'),
  ('RUNI-509855135082', 'tenant-abuja-digital', 'standard', 'RECONC-25a14fcb3860', 'pending', 236, 414, 357, 899, 777, 618, '2025-12-01 20:09:16', '2025-04-05 20:15:35', '2025-10-16 20:53:05'),
  ('RUNI-b6812dc508a3', 'tenant-abuja-digital', 'enhanced', 'RECONC-5d0565452b78', 'pending', 4361, 832, 83, 121, 63, 330, '2025-01-21 10:59:32', '2026-05-09 02:37:13', '2025-08-31 12:35:27'),
  ('RUNI-8aed8c39bc3a', 'tenant-lagos-main', 'basic', 'RECONC-237910c94d27', 'completed', 9061, 185, 42, 244, 834, 640, '2026-03-27 13:44:22', '2025-03-23 09:10:20', '2025-11-27 04:39:59'),
  ('RUNI-c442e9926080', 'tenant-kano-north', 'full', 'RECONC-10383c29f1df', 'processing', 5572, 933, 336, 463, 35, 355, '2025-11-24 14:49:16', '2025-02-23 06:51:03', '2025-05-19 13:55:10'),
  ('RUNI-c70944b9a41d', 'tenant-portharcourt', 'full', 'RECONC-7b4afe1f769d', 'processing', 8014, 762, 68, 138, 140, 953, '2026-04-26 08:16:50', '2025-02-06 21:35:55', '2025-05-27 07:17:34')
ON CONFLICT DO NOTHING;


-- ─── redis_cache_entries ───
INSERT INTO "redis_cache_entries" ("route", "ttlSeconds", "missCount", "hitRate", "status", "createdAt") VALUES
  ('REDIS_-879f0569f8f0', 69, 4253, 'REDIS_-b7da111009bf', 'active', '2025-12-02 21:35:40'),
  ('REDIS_-aa35fda490a4', 462, 2079, 'REDIS_-e32cd3c1184c', 'pending', '2025-12-21 19:12:16'),
  ('REDIS_-6b32e4df92d0', 840, 4188, 'REDIS_-c1660987acd4', 'completed', '2025-02-19 02:32:08'),
  ('REDIS_-433a2b719f52', 512, 8754, 'REDIS_-dcdb6e479c10', 'pending', '2026-01-09 23:56:37'),
  ('REDIS_-99790aff4598', 750, 7359, 'REDIS_-608584b92446', 'processing', '2025-02-12 00:52:14'),
  ('REDIS_-2ed4d83c653a', 639, 6076, 'REDIS_-69a6e8ea9774', 'completed', '2025-08-02 01:45:09'),
  ('REDIS_-18967fe5c237', 145, 3833, 'REDIS_-9bddfd25467c', 'approved', '2025-09-05 08:35:02'),
  ('REDIS_-328f85fef955', 317, 320, 'REDIS_-274b492dfa79', 'active', '2025-01-19 15:06:05')
ON CONFLICT DO NOTHING;


-- ─── redis_sessions ───
INSERT INTO "redis_sessions" ("sessionId", "userId", "deviceType", "ipAddress", "expiresIn", "slidingTTL", "status", "createdAt") VALUES
  ('SESS-09c37af4ebf7', 'USER-e1164fccc040', 'premium', '10.0.36.151', 'REDIS_-c08c1f6b5155', true, 'processing', '2025-10-05 23:20:49'),
  ('SESS-23f0a98c05cf', 'USER-9b749bd21907', 'enhanced', '10.0.159.199', 'REDIS_-b7e209e46215', true, 'active', '2025-07-04 20:51:46'),
  ('SESS-e2dcf7fecb7e', 'USER-d78fed4af379', 'basic', '10.0.187.69', 'REDIS_-1b8780465bec', true, 'completed', '2025-12-16 15:27:43'),
  ('SESS-895c0dc73e51', 'USER-be4774b650ab', 'full', '10.0.188.64', 'REDIS_-472b89f313aa', true, 'approved', '2025-12-17 04:16:38'),
  ('SESS-7191669c98ba', 'USER-2a5690f3fc8a', 'standard', '10.0.179.62', 'REDIS_-0365ff21581f', false, 'processing', '2025-06-17 15:35:24'),
  ('SESS-6e1774848430', 'USER-84dc8d2e874a', 'standard', '10.0.140.62', 'REDIS_-54c94637a42a', true, 'completed', '2025-10-08 20:57:09'),
  ('SESS-f685c03a1830', 'USER-2d8ace8686f0', 'enhanced', '10.0.229.168', 'REDIS_-19ba71929a46', true, 'completed', '2025-06-04 16:58:16'),
  ('SESS-d1d77a837f1e', 'USER-efa760f1beed', 'basic', '10.0.25.24', 'REDIS_-29f0c12d500f', true, 'pending', '2026-01-13 03:06:40')
ON CONFLICT DO NOTHING;


-- ─── regulatory_reports_aml ───
INSERT INTO "regulatory_reports_aml" ("reportType", "period", "submittedTo", "filedDate", "status", "createdAt") VALUES
  ('standard', '2025-05', 'REGULA-15e24da56705', 'REGULA-7525dd190bb5', 'active', '2025-02-01 00:53:08'),
  ('enhanced', '2025-01', 'REGULA-dccdac199561', 'REGULA-09362311f253', 'processing', '2025-06-13 08:20:08'),
  ('premium', '2025-12', 'REGULA-6fbe65f6b7cb', 'REGULA-3af5d38ecb93', 'approved', '2026-01-19 03:13:53'),
  ('standard', '2025-01', 'REGULA-d8cfe95594c7', 'REGULA-963c0e7db22a', 'active', '2025-12-03 23:41:35'),
  ('basic', '2025-09', 'REGULA-6195d5b1a03a', 'REGULA-1209a783241f', 'approved', '2026-03-12 22:09:02'),
  ('basic', '2025-03', 'REGULA-f143d9d9c927', 'REGULA-0d983cfde1c0', 'processing', '2025-09-01 20:35:26'),
  ('full', '2025-12', 'REGULA-7734f61163fe', 'REGULA-60660f2862d6', 'active', '2025-03-15 06:33:31'),
  ('enhanced', '2025-05', 'REGULA-f1e8caac02e5', 'REGULA-2d13640c46d2', 'completed', '2025-07-11 00:46:20')
ON CONFLICT DO NOTHING;


-- ─── remittance_transactions ───
INSERT INTO "remittance_transactions" ("tenantId", "corridor", "senderName", "senderCountry", "receiverName", "receiverCountry", "sendCurrency", "receiveCurrency", "partner", "status", "createdAt") VALUES
  ('tenant-abuja-digital', 'REMITT-7efc50791ace', 'REMITT-8491a7975a2d', 'REMITT-c808b1373ea2', 'REMITT-45d816557bfd', 'REMITT-8ae3e1bc03aa', 'REMITT-b2a50055713c', 'REMITT-6effeb8f787f', 'REMITT-fcdf2b29a989', 'pending', '2026-02-27 21:32:00'),
  ('tenant-whitelabel-zenith', 'REMITT-38f9099890d6', 'REMITT-c3e51d4f5f8d', 'REMITT-562bdb43d2f2', 'REMITT-b93f641ed538', 'REMITT-e8e11ce260f5', 'REMITT-7c04ac2c75f2', 'REMITT-b7e283bc4087', 'REMITT-d3d6d49af602', 'completed', '2026-01-19 02:47:45'),
  ('tenant-lagos-main', 'REMITT-7a50e7f795e4', 'REMITT-a7282c98bb28', 'REMITT-ca924b13f337', 'REMITT-b68499a82c07', 'REMITT-8ebd853e7962', 'REMITT-c4e0232350f6', 'REMITT-25043098cfa6', 'REMITT-cd0e70aab92e', 'processing', '2026-03-18 01:49:30'),
  ('tenant-lagos-main', 'REMITT-347e67be1ec4', 'REMITT-a5bee581f67c', 'REMITT-ffcd85a6ebdc', 'REMITT-f15d2501bdc7', 'REMITT-09d9c5d1d44c', 'REMITT-b137c1b7f8c3', 'REMITT-2b3e9ff9dca1', 'REMITT-868b7dcdc29b', 'approved', '2026-03-30 01:15:32'),
  ('tenant-abuja-digital', 'REMITT-cf7c6ff666ac', 'REMITT-c115b24df3f5', 'REMITT-dc38539787f1', 'REMITT-d57368103bd0', 'REMITT-1572e514b986', 'REMITT-464cabfdf313', 'REMITT-a4ff4e618285', 'REMITT-b936f8e5cd81', 'active', '2026-05-08 01:56:54'),
  ('tenant-lagos-main', 'REMITT-feefca8d71cc', 'REMITT-2261b60f718e', 'REMITT-35b5e0477f1b', 'REMITT-1c0a2133c2a4', 'REMITT-4404af380e38', 'REMITT-dec8dd7b9583', 'REMITT-9b01ccc9be70', 'REMITT-9bd9754c1adb', 'processing', '2025-09-16 11:57:21'),
  ('tenant-lagos-main', 'REMITT-a47a3814d942', 'REMITT-7e42b69c3221', 'REMITT-4a6612bb462c', 'REMITT-ddc307649f64', 'REMITT-6781f1e379ba', 'REMITT-8847ae918337', 'REMITT-74dbd4972c38', 'REMITT-ca74f4b61641', 'processing', '2025-04-27 20:31:06'),
  ('tenant-portharcourt', 'REMITT-01539791cbdf', 'REMITT-a50531c2288c', 'REMITT-f76aa0fa383b', 'REMITT-0d5a6e9fa314', 'REMITT-f2b5e7cc9415', 'REMITT-e91230aeb7de', 'REMITT-d1f450cdc1b9', 'REMITT-0abe94076d01', 'processing', '2025-01-05 11:18:17')
ON CONFLICT DO NOTHING;


-- ─── rewards_accounts ───
INSERT INTO "rewards_accounts" ("tenantId", "customerId", "tier", "totalPoints", "availablePoints", "lifetimePoints", "currentStreak", "longestStreak", "badges", "status", "createdAt") VALUES
  ('tenant-portharcourt', 'CUST-5df049b0e637', 'REWARD-5751555bb876', 4433, 116, 658, 615, 225, 'REWARD-784b66633259', 'approved', '2025-11-13 19:39:47'),
  ('tenant-whitelabel-zenith', 'CUST-2539f6f6cf9d', 'REWARD-febb94fbf7c1', 3551, 12, 466, 419, 315, 'REWARD-23a985be32c4', 'processing', '2025-07-19 20:45:41'),
  ('tenant-lagos-main', 'CUST-092479f71f59', 'REWARD-81d2ffda20f4', 5344, 385, 242, 324, 566, 'REWARD-95d5928f84bc', 'pending', '2025-02-05 08:53:26'),
  ('tenant-whitelabel-zenith', 'CUST-237d3840ffc7', 'REWARD-98fd91c189d8', 8470, 283, 43, 713, 784, 'REWARD-158630e4eb16', 'processing', '2025-03-20 11:39:47'),
  ('tenant-kano-north', 'CUST-d2fb9b7444cf', 'REWARD-b9216f478ea1', 5422, 976, 942, 20, 772, 'REWARD-3ded080c0d5c', 'pending', '2025-12-24 13:22:53'),
  ('tenant-abuja-digital', 'CUST-9251c06e4451', 'REWARD-fdf44e8e0610', 8846, 658, 953, 979, 541, 'REWARD-3073e7215d06', 'active', '2025-12-31 00:53:07'),
  ('tenant-lagos-main', 'CUST-40470ab8daff', 'REWARD-fbf9d54dba8f', 2876, 175, 213, 262, 574, 'REWARD-6039a24054ff', 'processing', '2025-09-02 13:48:37'),
  ('tenant-abuja-digital', 'CUST-c12be6835da8', 'REWARD-38fc835e7cfc', 2826, 379, 631, 272, 145, 'REWARD-89ba3125aca2', 'completed', '2025-07-15 22:59:27')
ON CONFLICT DO NOTHING;


-- ─── risk_scores ───
INSERT INTO "risk_scores" ("customerId", "staticScore", "dynamicScore", "totalScore", "riskTier", "factors", "lastCalculatedAt", "createdAt", "updatedAt") VALUES
  ('CUST-2da4e82673bc', 44.4207, 35.4423, 18.3214, 'medium', '{"data": "seed"}'::jsonb, '2026-05-03 02:30:50', '2025-02-13 21:48:53', '2025-06-03 14:34:16'),
  ('CUST-73ae3ce63559', 24.3745, 56.9629, 83.6419, 'medium', '{"data": "seed"}'::jsonb, '2026-02-19 10:16:21', '2025-06-29 17:09:47', '2025-10-18 13:33:18'),
  ('CUST-b633a46871e1', 61.4664, 92.2533, 7.2694, 'medium', '{"data": "seed"}'::jsonb, '2025-12-17 04:43:18', '2025-01-29 13:47:55', '2026-01-02 08:36:55'),
  ('CUST-cabd18de9c9d', 20.6565, 32.3832, 4.2223, 'high', '{"data": "seed"}'::jsonb, '2026-03-29 13:24:42', '2025-05-29 06:48:12', '2026-03-10 16:23:04'),
  ('CUST-665a9f3f32a5', 17.0074, 84.0752, 13.0391, 'low', '{"data": "seed"}'::jsonb, '2026-04-03 06:16:05', '2026-04-16 13:41:10', '2025-03-29 17:54:39'),
  ('CUST-a0154e5fb3ea', 20.8966, 84.8802, 91.3421, 'high', '{"data": "seed"}'::jsonb, '2025-05-18 00:52:59', '2026-03-02 11:47:18', '2025-12-08 03:27:57'),
  ('CUST-5a9f550913f5', 19.0147, 72.442, 66.1705, 'low', '{"data": "seed"}'::jsonb, '2025-09-21 09:28:20', '2025-01-18 07:32:46', '2025-10-05 18:25:45'),
  ('CUST-7acced7aca1e', 30.4941, 55.1514, 4.987, 'low', '{"data": "seed"}'::jsonb, '2026-04-12 15:47:03', '2025-07-15 10:44:03', '2026-05-04 12:37:15')
ON CONFLICT DO NOTHING;


-- ─── route_schemas ───
INSERT INTO "route_schemas" ("path", "method", "schemaName", "validationCount", "failedRequests", "status", "createdAt") VALUES
  ('ROUTE_-7fbbd7766c05', 'ROUTE_-82bb0e7a7675', 'ROUTE_-187fe7c0dd06', 938, 84, 'completed', '2025-10-25 22:58:48'),
  ('ROUTE_-e855db03948b', 'ROUTE_-c8090b9b9167', 'ROUTE_-9ac8e48f7dbf', 5119, 469, 'pending', '2025-04-01 17:16:10'),
  ('ROUTE_-7935dbde2d7f', 'ROUTE_-ac9897c73151', 'ROUTE_-8743344686a2', 8946, 894, 'completed', '2026-03-24 20:12:02'),
  ('ROUTE_-dc978430a4f0', 'ROUTE_-8b14521dcf1a', 'ROUTE_-cbfe9b2499c7', 8475, 211, 'approved', '2026-03-21 14:31:33'),
  ('ROUTE_-c005fb13a45b', 'ROUTE_-99e652806301', 'ROUTE_-636c2f1a02de', 956, 982, 'completed', '2025-03-25 00:26:48'),
  ('ROUTE_-3f936783212c', 'ROUTE_-e7bfeec07aca', 'ROUTE_-ab471fa57e12', 5890, 670, 'processing', '2025-06-02 21:35:09'),
  ('ROUTE_-4764da60f46a', 'ROUTE_-a3f21a468f16', 'ROUTE_-4c7c42f054f3', 3628, 674, 'pending', '2025-09-13 13:09:46'),
  ('ROUTE_-52f4deeaee4e', 'ROUTE_-7f27292d4ec5', 'ROUTE_-a9abc7dd7971', 8502, 113, 'approved', '2026-03-17 09:40:17')
ON CONFLICT DO NOTHING;


-- ─── route_trie_stats ───
INSERT INTO "route_trie_stats" ("routePrefix", "totalRoutes", "trieDepth", "avgLookupNs", "cacheHitRate", "status", "createdAt") VALUES
  ('REF-A919F064956D', 5479, 762, 556, 'ROUTE_-e557518935c7', 'pending', '2025-03-11 11:26:54'),
  ('REF-8652DEC64574', 829, 393, 18, 'ROUTE_-5854bd045868', 'active', '2025-11-25 10:33:30'),
  ('REF-6AA441856170', 2693, 916, 999, 'ROUTE_-1a36b88037e9', 'pending', '2025-05-16 12:46:51'),
  ('REF-26B86EECC5C7', 3478, 197, 327, 'ROUTE_-c038bd91ceb5', 'completed', '2025-03-15 05:01:53'),
  ('REF-4454729CA734', 4491, 693, 523, 'ROUTE_-834d40fca1ad', 'pending', '2026-05-08 12:21:02'),
  ('REF-5529641831D4', 2802, 280, 577, 'ROUTE_-4078db7dcb62', 'completed', '2026-04-07 05:25:14'),
  ('REF-2213F2C44D1B', 5089, 511, 183, 'ROUTE_-067bb8423b15', 'active', '2025-02-16 14:31:53'),
  ('REF-254B5BB29304', 6977, 403, 717, 'ROUTE_-140ffd606084', 'approved', '2025-07-07 01:43:00')
ON CONFLICT DO NOTHING;


-- ─── sanctions_batch_runs ───
INSERT INTO "sanctions_batch_runs" ("triggerType", "customersScreened", "newMatches", "processingTimeMin", "status", "createdAt") VALUES
  ('standard', 386, 726, 938, 'processing', '2025-05-01 03:13:14'),
  ('full', 762, 737, 32, 'completed', '2026-04-28 16:14:56'),
  ('basic', 811, 271, 619, 'processing', '2025-12-09 14:22:55'),
  ('standard', 134, 892, 710, 'pending', '2025-02-01 12:08:19'),
  ('standard', 123, 95, 468, 'processing', '2025-01-20 21:53:36'),
  ('full', 782, 270, 937, 'pending', '2025-05-31 13:28:46'),
  ('premium', 332, 443, 219, 'active', '2025-03-03 21:04:38'),
  ('standard', 743, 861, 194, 'completed', '2025-02-03 07:57:07')
ON CONFLICT DO NOTHING;


-- ─── sanctions_screenings ───
INSERT INTO "sanctions_screenings" ("entityName", "entityType", "listsChecked", "matchFound", "highestScore", "matchDetails", "status", "screenedBy", "createdAt") VALUES
  ('Kunle Nwosu', 'premium', '{"data": "seed"}'::jsonb, 851, 30.6696, '{"data": "seed"}'::jsonb, 'processing', 'SANCTI-b6d5d30870a8', '2026-03-13 06:19:48'),
  ('Bukola Adeyemi', 'basic', '{"data": "seed"}'::jsonb, 56, 10.1782, '{"data": "seed"}'::jsonb, 'processing', 'SANCTI-68825e290b42', '2026-03-24 03:14:03'),
  ('Chukwuemeka Mohammed', 'premium', '{"data": "seed"}'::jsonb, 49, 43.6852, '{"data": "seed"}'::jsonb, 'processing', 'SANCTI-9d85cfce0ce1', '2025-01-10 01:04:06'),
  ('Sade Lawal', 'full', '{"data": "seed"}'::jsonb, 186, 49.3638, '{"data": "seed"}'::jsonb, 'approved', 'SANCTI-a2cf337500b4', '2025-06-13 09:57:57'),
  ('Emeka Taiwo', 'standard', '{"data": "seed"}'::jsonb, 669, 54.3221, '{"data": "seed"}'::jsonb, 'active', 'SANCTI-d245d5bcf6b0', '2025-09-15 10:29:58'),
  ('Chidinma Okafor', 'basic', '{"data": "seed"}'::jsonb, 819, 83.6131, '{"data": "seed"}'::jsonb, 'pending', 'SANCTI-ae151fad0c1f', '2026-05-01 16:40:06'),
  ('Chukwuemeka Yakubu', 'basic', '{"data": "seed"}'::jsonb, 620, 78.2526, '{"data": "seed"}'::jsonb, 'pending', 'SANCTI-b47586ec2c5c', '2025-05-22 00:09:47'),
  ('Lilian Taiwo', 'basic', '{"data": "seed"}'::jsonb, 140, 1.9722, '{"data": "seed"}'::jsonb, 'active', 'SANCTI-d45d0f331f1f', '2025-06-05 11:24:06')
ON CONFLICT DO NOTHING;


-- ─── sar_reports_aml ───
INSERT INTO "sar_reports_aml" ("customerId", "customerName", "reportType", "reason", "currency", "nfiuReference", "priority", "status", "createdAt") VALUES
  ('CUST-d6108477775e', 'Rasheed Otedola', 'standard', 'SAR_RE-298249b134f5', 'USD', 'REF-33C2F9123A91', 'SAR_RE-d91e9d448cf3', 'completed', '2026-03-13 01:57:36'),
  ('CUST-8e1cb815fa12', 'Pelumi Eze', 'enhanced', 'SAR_RE-8ff618bc1645', 'NGN', 'REF-3C374712B0BB', 'SAR_RE-032c217919fc', 'pending', '2025-10-06 20:11:48'),
  ('CUST-51dc6cb9037b', 'Fatima Otedola', 'full', 'SAR_RE-dbbb68dae6cd', 'NGN', 'REF-393E0664C306', 'SAR_RE-2b159e47a585', 'active', '2025-06-13 08:57:03'),
  ('CUST-24306e53b316', 'Hassan Usman', 'full', 'SAR_RE-bbcbcccd8b85', 'USD', 'REF-C934E3536ABF', 'SAR_RE-c1bf102100ef', 'completed', '2025-02-19 16:18:38'),
  ('CUST-7f87e098652a', 'Gbenga Adenuga', 'basic', 'SAR_RE-a652d3f5d21d', 'NGN', 'REF-2C63D0968B18', 'SAR_RE-d31d7a531ca5', 'processing', '2026-04-14 11:57:45'),
  ('CUST-3092990107e3', 'Pelumi Fashola', 'standard', 'SAR_RE-a6426e47c618', 'NGN', 'REF-2DFAB17F2BED', 'SAR_RE-bf62606cca1a', 'active', '2025-02-28 03:28:02'),
  ('CUST-5e73033ed495', 'Hauwa Balogun', 'basic', 'SAR_RE-43d9949e34d2', 'NGN', 'REF-9456E7549A2B', 'SAR_RE-e9436013e08a', 'processing', '2025-11-20 17:05:44'),
  ('CUST-605956633c91', 'Grace Kalu', 'standard', 'SAR_RE-492449e613b4', 'USD', 'REF-0C8C5A4AC9D5', 'SAR_RE-cba985bf844a', 'active', '2025-08-14 05:18:17')
ON CONFLICT DO NOTHING;


-- ─── satellite_crop_monitor ───
INSERT INTO "satellite_crop_monitor" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-bc216c5b6e7d', 'Kunle Sanusi', 'payments', 'Kunle Sanusi - Garki - Satellite Crop Monitor', 'completed', 2222184.83, 'Osun', 'REF-F1247A856F', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2026-05-04 04:52:30', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-8375c7afeb44', 'Rahma Mohammed', 'finance', 'Rahma Mohammed - Port Harcourt - Satellite Crop Monitor', 'processing', 8434236.17, 'Kano', 'REF-35A8461994', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-06-03 20:55:32', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-7cfce3ca82cf', 'Kunle Jimoh', 'lending', 'Kunle Jimoh - Kano - Satellite Crop Monitor', 'processing', 6587872.67, 'Kwara', 'REF-CD68E61438', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-10-11 07:34:32', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-9d1e1dbfde6b', 'Olumide Nwosu', 'compliance', 'Olumide Nwosu - Benin City - Satellite Crop Monitor', 'approved', 2707555.6, 'Kano', 'REF-129D581093', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-03-03 08:03:36', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-d8afc1a29009', 'Emeka Adenuga', 'risk', 'Emeka Adenuga - Enugu - Satellite Crop Monitor', 'processing', 997864.25, 'Enugu', 'REF-28902638BE', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-10-14 23:44:58', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-275109b7cedb', 'Pelumi Nwosu', 'finance', 'Pelumi Nwosu - Garki - Satellite Crop Monitor', 'active', 7904388.13, 'Kwara', 'REF-F6717A03D7', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-01-15 17:16:14', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-31cc2f1eb74c', 'Jumoke Otedola', 'technology', 'Jumoke Otedola - Wuse - Satellite Crop Monitor', 'completed', 6564466.1, 'Enugu', 'REF-378B0FC8C7', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-07-05 07:10:27', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-eacb35c71772', 'Patience Hassan', 'lending', 'Patience Hassan - Warri - Satellite Crop Monitor', 'active', 9335125.34, 'Lagos', 'REF-3A23571061', '{"source": "seed", "table": "satellite_crop_monitor"}'::jsonb, '2025-11-03 22:15:46', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── scratch_cards ───
INSERT INTO "scratch_cards" ("cardId", "batchId", "serialNumber", "cardType", "pinHash", "pinLength", "status", "maxAttempts", "usedAttempts", "currency", "issuedTo", "customerId", "branchCode", "expiresAt", "activatedAt", "usedAt", "revokedAt", "revokeReason", "tamperDetected", "createdAt") VALUES
  ('CARD-231e76a0311c', 'BATC-1c943e225c56', 'SCRATC-bc2de89aeb1e', 'basic', 'SCRATC-85cbcf632811', 626, 'approved', 162, 937, 'GBP', 'SCRATC-00fffb906ad8', 'CUST-57e6071c0191', 'SCRATC-5debd019a969', '2025-02-19 17:23:18', '2025-05-03 22:08:27', '2026-04-06 21:47:14', '2025-07-15 15:25:13', 'SCRATC-7703c84f4893', false, '2026-04-11 18:27:04'),
  ('CARD-cdf5cc3ba0c2', 'BATC-7882a4d58f7b', 'SCRATC-2711c0252ab6', 'basic', 'SCRATC-9503e68f65dd', 845, 'processing', 821, 664, 'NGN', 'SCRATC-c0cb25b0734d', 'CUST-1cead6e2610a', 'SCRATC-07382ad66f54', '2025-03-17 15:12:26', '2025-03-30 00:24:39', '2025-08-11 15:49:17', '2025-08-19 18:43:26', 'SCRATC-d74fbbada94c', true, '2025-12-27 22:46:43'),
  ('CARD-cbb710aeb1ea', 'BATC-cb248eb700b2', 'SCRATC-dab00466fdb5', 'enhanced', 'SCRATC-350e359803e7', 885, 'processing', 556, 592, 'USD', 'SCRATC-f03fea2fa39c', 'CUST-50faf174f913', 'SCRATC-c3f2381c3e1f', '2025-05-14 05:20:43', '2025-06-14 03:30:07', '2025-12-17 23:35:58', '2026-03-09 02:41:49', 'SCRATC-5be9d5cdc817', true, '2025-06-29 07:13:58'),
  ('CARD-a8a3ad97d097', 'BATC-e9ce87aff676', 'SCRATC-b4c7e54786dc', 'basic', 'SCRATC-49430ac008d1', 229, 'approved', 570, 564, 'NGN', 'SCRATC-aa243bd59557', 'CUST-30259a718f21', 'SCRATC-7d1b43be4b51', '2026-01-09 04:38:57', '2025-07-05 18:26:36', '2025-12-02 19:05:18', '2025-04-06 10:16:18', 'SCRATC-4b9259c3446b', true, '2025-06-23 05:52:42'),
  ('CARD-99c198d2bca6', 'BATC-ed196d05fe3f', 'SCRATC-95972af2ea6d', 'premium', 'SCRATC-3a94aa94c6c6', 380, 'active', 782, 442, 'USD', 'SCRATC-4093941a0346', 'CUST-afad369d8e82', 'SCRATC-48e96b7ac4cb', '2025-01-24 15:08:44', '2025-12-04 10:32:50', '2025-07-22 19:26:34', '2025-01-18 23:32:44', 'SCRATC-be0785c837b1', true, '2026-04-24 17:33:58'),
  ('CARD-05e10b1140c1', 'BATC-ef4426a817b4', 'SCRATC-935ed457a999', 'premium', 'SCRATC-2561f2ef1d0f', 537, 'active', 326, 131, 'NGN', 'SCRATC-0422e21c5cb4', 'CUST-9f25d297ca66', 'SCRATC-667c060e999d', '2025-03-06 02:18:28', '2025-09-14 19:48:39', '2025-12-15 20:22:06', '2025-06-22 10:34:43', 'SCRATC-9e48ab80cb87', true, '2025-08-15 15:28:35'),
  ('CARD-b3c3a0b77c90', 'BATC-9d3f52abe10b', 'SCRATC-08d3c4c79b83', 'premium', 'SCRATC-dedd95fcd9b5', 222, 'completed', 719, 539, 'NGN', 'SCRATC-541ce5d5fd5b', 'CUST-36f703783d0c', 'SCRATC-762a5407b375', '2025-01-10 19:44:38', '2025-12-11 12:40:11', '2025-03-21 16:00:59', '2025-03-14 23:22:14', 'SCRATC-4f1b5e5700f3', false, '2025-05-29 00:51:08'),
  ('CARD-9c60d91f0170', 'BATC-ddf877f4c898', 'SCRATC-8bd5c4cbe32b', 'enhanced', 'SCRATC-200792331c8a', 991, 'processing', 783, 404, 'GBP', 'SCRATC-e2eb0efa50ff', 'CUST-444f788d5685', 'SCRATC-dcfce34e381c', '2025-06-30 16:52:12', '2025-11-08 22:46:52', '2025-02-02 17:48:20', '2025-10-06 04:07:52', 'SCRATC-6ce1d3cc313d', true, '2025-07-01 09:39:51')
ON CONFLICT DO NOTHING;


-- ─── security_events ───
INSERT INTO "security_events" ("eventId", "eventType", "subType", "actor", "channel", "ipAddress", "geoLocation", "details", "severity", "hashChain", "timestamp") VALUES
  ('EVEN-3791aa39b55c', 'full', 'basic', 'SECURI-cc11af87893d', 'mobile', '10.0.71.58', 'SECURI-ce1cb2ee505e', 'Femi Peterside - Enugu, Osun - security_events record', 'SECURI-23d24b0138e9', 'SECURI-e68d5145c9ca', '2025-03-11 20:06:03'),
  ('EVEN-469715729d77', 'full', 'enhanced', 'SECURI-c0ba9a82ff51', 'branch', '10.0.0.175', 'SECURI-aee8d54e53ac', 'Ifeoma Hassan - Benin City, Osun - security_events record', 'SECURI-c6ea7aa2331e', 'SECURI-65b6b1128957', '2025-01-05 14:13:42'),
  ('EVEN-1667f4cf5312', 'basic', 'standard', 'SECURI-28ce3f9702ca', 'web', '10.0.176.94', 'SECURI-371309991cf8', 'Fatima Kalu - Zaria, Akwa Ibom - security_events record', 'SECURI-f19a4d28bd53', 'SECURI-8ea30956eb35', '2026-03-13 08:50:45'),
  ('EVEN-179ec5506125', 'premium', 'basic', 'SECURI-346de19c132b', 'web', '10.0.48.231', 'SECURI-9f4a96558cba', 'Ifeoma Igwe - Maitama, Imo - security_events record', 'SECURI-e5eb4ea598a7', 'SECURI-91f5b6d55b6e', '2026-02-16 20:00:24'),
  ('EVEN-86b60e1557ca', 'full', 'premium', 'SECURI-a4d48721b2f4', 'web', '10.0.63.213', 'SECURI-52f426f9bd3c', 'Pelumi Hassan - Port Harcourt, Enugu - security_events record', 'SECURI-9a8e7dd4bbfd', 'SECURI-92305cfca905', '2026-04-05 02:14:09'),
  ('EVEN-a3f591e870b6', 'standard', 'basic', 'SECURI-7a36b133268c', 'branch', '10.0.17.65', 'SECURI-747ba0ac1717', 'Adewale Elumelu - Asaba, Akwa Ibom - security_events record', 'SECURI-35044ef57885', 'SECURI-807a4d712fac', '2025-07-30 22:43:39'),
  ('EVEN-062276af20db', 'enhanced', 'full', 'SECURI-55b9af4b0213', 'voice', '10.0.184.63', 'SECURI-2db75c376751', 'Nneka Hassan - Ibadan, Lagos - security_events record', 'SECURI-c5c275917dff', 'SECURI-71b02e6d2893', '2025-09-05 21:53:42'),
  ('EVEN-bf06f3f3dc02', 'premium', 'enhanced', 'SECURI-9275f38c30ae', 'web', '10.0.139.6', 'SECURI-6c7d8eda75f8', 'Chukwuemeka Balogun - Maitama, Ogun - security_events record', 'SECURI-69f6c35cb8c5', 'SECURI-d99379b1d64c', '2025-04-23 08:47:09')
ON CONFLICT DO NOTHING;


-- ─── session_records ───
INSERT INTO "session_records" ("sessionId", "customerId", "channel", "deviceFingerprint", "ipAddress", "geoLocation", "status", "mfaLevel", "lastActivity", "expiresAt", "terminatedReason", "createdAt") VALUES
  ('SESS-4a69d914c18d', 'CUST-592f411f60d2', 'ussd', 'SESSIO-379b47d2480f', '10.0.33.149', 'SESSIO-62b1110c9d01', 'processing', 'SESSIO-86a8018a45ae', '2025-09-28 00:58:29', '2025-02-19 18:19:44', 'SESSIO-540998889055', '2025-05-06 21:06:52'),
  ('SESS-6024fd29f3e2', 'CUST-cd71a83412ff', 'pos', 'SESSIO-73e5627a998e', '10.0.7.104', 'SESSIO-9a157b325171', 'active', 'SESSIO-16b50c4cf9c1', '2025-11-09 16:46:03', '2026-03-06 14:17:55', 'SESSIO-b2430d008baf', '2025-02-25 01:26:13'),
  ('SESS-440eb0501067', 'CUST-6a4cd64815cb', 'branch', 'SESSIO-070925c315a3', '10.0.155.152', 'SESSIO-c689e4166a73', 'approved', 'SESSIO-dbec53fe0a3d', '2026-01-06 08:56:28', '2025-01-01 21:46:22', 'SESSIO-c516c16e49a9', '2026-05-02 21:07:33'),
  ('SESS-ca9c0048cf39', 'CUST-93aecef46439', 'pos', 'SESSIO-4803cf9425fc', '10.0.2.229', 'SESSIO-219471429812', 'active', 'SESSIO-1206a3f8b028', '2025-10-26 00:34:11', '2026-03-24 05:18:33', 'SESSIO-e204c49e4f39', '2025-01-30 12:14:31'),
  ('SESS-6a7839d6dd3a', 'CUST-dfb37c448606', 'web', 'SESSIO-1c418fbc91ce', '10.0.63.38', 'SESSIO-a67b03bff54d', 'active', 'SESSIO-2f75dc7cee2e', '2025-05-28 23:05:00', '2026-01-29 13:11:50', 'SESSIO-823b0c9937cf', '2025-07-14 18:40:50'),
  ('SESS-9d72ef8340bb', 'CUST-7e6f377dbe60', 'ussd', 'SESSIO-7dff4e9931da', '10.0.212.104', 'SESSIO-18facd7f1047', 'active', 'SESSIO-1d0105362541', '2025-04-10 23:48:51', '2026-04-05 10:08:03', 'SESSIO-1d5a92974f6e', '2025-07-16 15:43:11'),
  ('SESS-19c713aa0084', 'CUST-a28153a115c6', 'voice', 'SESSIO-619d5672bfa4', '10.0.123.61', 'SESSIO-3996643d2d0e', 'active', 'SESSIO-80bbaa9bd39f', '2025-03-22 05:12:47', '2025-08-15 06:41:58', 'SESSIO-ee4608ee2b39', '2026-03-14 00:38:26'),
  ('SESS-2ebe97b57fe1', 'CUST-aaac046f36b9', 'atm', 'SESSIO-04a265e48162', '10.0.26.26', 'SESSIO-d43e1503af38', 'completed', 'SESSIO-2d517c0852c2', '2025-12-26 18:38:18', '2026-04-06 05:14:04', 'SESSIO-56c2f0701bdb', '2025-06-26 00:01:05')
ON CONFLICT DO NOTHING;


-- ─── siem_pipelines ───
INSERT INTO "siem_pipelines" ("name", "format", "destination", "batchSize", "status", "createdAt") VALUES
  ('Rahma Jimoh', 'SIEM_P-a128ea2683ea', 'SIEM_P-c728a788c4e8', 143, 'active', '2025-03-05 12:18:20'),
  ('Chidinma Peterside', 'SIEM_P-c85b48fb7680', 'SIEM_P-d859397756a5', 529, 'processing', '2025-05-03 20:18:07'),
  ('Esther Igwe', 'SIEM_P-d48fbf9793b5', 'SIEM_P-6f1cd4ef1e32', 554, 'processing', '2025-08-15 19:09:09'),
  ('Uzo Yakubu', 'SIEM_P-1082f6a858f4', 'SIEM_P-ece04d6844b2', 520, 'completed', '2025-06-03 16:45:21'),
  ('Esther Igwe', 'SIEM_P-bfd564705cfe', 'SIEM_P-39e0cf5dc517', 989, 'active', '2026-05-04 15:42:26'),
  ('Ibrahim Nwosu', 'SIEM_P-a02ef56c359b', 'SIEM_P-880612ee5ebf', 342, 'approved', '2025-01-05 05:33:06'),
  ('Oluchi Balogun', 'SIEM_P-b4de4378f7ca', 'SIEM_P-3f8c657cdcd7', 179, 'active', '2025-03-21 05:38:21'),
  ('Lanre Chukwu', 'SIEM_P-66ac78cfdf15', 'SIEM_P-b8d9743ff4d2', 20, 'processing', '2025-07-23 19:35:25')
ON CONFLICT DO NOTHING;


-- ─── smart_savings_goals ───
INSERT INTO "smart_savings_goals" ("tenantId", "customerId", "goalName", "goalType", "currency", "frequency", "startDate", "targetDate", "status", "createdAt") VALUES
  ('tenant-whitelabel-zenith', 'CUST-5ec7ff1dbcbd', 'SMART_-b7533ce4096c', 'basic', 'NGN', 'SMART_-5e45e931eee6', '2025-12-06 13:54:44', '2026-05-01 11:24:27', 'approved', '2025-12-29 23:38:51'),
  ('tenant-abuja-digital', 'CUST-5640c01d3dc7', 'SMART_-9260054f4f3e', 'premium', 'NGN', 'SMART_-741333ff6777', '2025-10-19 23:32:35', '2025-01-11 18:22:21', 'processing', '2026-01-21 16:32:06'),
  ('tenant-lagos-main', 'CUST-cce7e071813a', 'SMART_-829cf9e9ef30', 'basic', 'NGN', 'SMART_-0a2a3f0086e3', '2026-01-02 11:27:16', '2026-03-05 09:52:41', 'active', '2025-06-15 11:51:19'),
  ('tenant-whitelabel-zenith', 'CUST-84967a2a8422', 'SMART_-897f77c49edd', 'full', 'NGN', 'SMART_-29e1ef90a790', '2025-04-01 23:10:25', '2025-06-09 08:37:51', 'processing', '2026-01-06 06:18:03'),
  ('tenant-portharcourt', 'CUST-d26f5c2ff9a5', 'SMART_-a095574ffbac', 'basic', 'GBP', 'SMART_-39fc8d718691', '2026-03-27 06:28:31', '2025-09-10 19:50:19', 'processing', '2025-01-21 17:04:44'),
  ('tenant-abuja-digital', 'CUST-c9ccdb19cddf', 'SMART_-aada43f12a48', 'basic', 'NGN', 'SMART_-fe9db96ff4b6', '2025-07-18 09:33:12', '2026-03-15 17:29:58', 'approved', '2025-11-29 12:09:28'),
  ('tenant-abuja-digital', 'CUST-1fdbdb7906fe', 'SMART_-316cb0746252', 'full', 'GBP', 'SMART_-bb2ff7cafb23', '2025-08-30 23:33:18', '2025-04-29 17:08:37', 'completed', '2025-02-22 19:46:07'),
  ('tenant-whitelabel-zenith', 'CUST-c2309944b3a7', 'SMART_-f090d855b31c', 'enhanced', 'NGN', 'SMART_-ba34e9f5ebd9', '2025-06-24 09:37:21', '2025-06-04 04:26:17', 'approved', '2025-06-26 12:00:41')
ON CONFLICT DO NOTHING;


-- ─── sms_alert_notification ───
INSERT INTO "sms_alert_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-90c0604c2376', 'Segun Jimoh', 'compliance', 'Segun Jimoh - Abeokuta - Sms Alert Notification', 'completed', 5559311.19, 'Edo', 'REF-12543B4A0B', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-10-18 07:12:04', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-0321a4f7293e', 'Kemi Nwosu', 'finance', 'Kemi Nwosu - Port Harcourt - Sms Alert Notification', 'pending', 117896.04, 'Rivers', 'REF-54B6B1B5EB', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-08-10 08:13:18', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-520810e13bf9', 'Grace Okafor', 'finance', 'Grace Okafor - Port Harcourt - Sms Alert Notification', 'active', 3327261.71, 'Kwara', 'REF-268D255080', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2026-05-09 00:20:37', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-76e55db37179', 'Patience Adenuga', 'payments', 'Patience Adenuga - Maitama - Sms Alert Notification', 'approved', 3247053.48, 'Anambra', 'REF-44BFACA46E', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-05-27 16:06:43', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-434ea67984a4', 'Olumide Okafor', 'risk', 'Olumide Okafor - Abeokuta - Sms Alert Notification', 'pending', 9956713.52, 'Kano', 'REF-19F9422474', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-10-26 02:06:14', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-0dad97e50139', 'Oluchi Adeyemi', 'risk', 'Oluchi Adeyemi - Ikeja - Sms Alert Notification', 'active', 5388698.79, 'Borno', 'REF-A41BE33D26', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2026-03-25 04:13:15', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-4342e46da887', 'Uzo Peterside', 'operations', 'Uzo Peterside - Abeokuta - Sms Alert Notification', 'processing', 5931207.93, 'Borno', 'REF-5CB4EBFEB3', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-08-28 03:08:09', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-feb55485a20a', 'Kemi Lawal', 'lending', 'Kemi Lawal - Zaria - Sms Alert Notification', 'pending', 2039805.68, 'Kaduna', 'REF-2A3A718BCC', '{"source": "seed", "table": "sms_alert_notification"}'::jsonb, '2025-07-10 14:24:50', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── sms_banking_gateway ───
INSERT INTO "sms_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-8b4aeb91af1d', 'Rahma Taiwo', 'lending', 'Rahma Taiwo - Enugu - Sms Banking Gateway', 'pending', 130567.79, 'Abuja FCT', 'REF-B21EA1EC67', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2025-06-12 22:42:18', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-1ab098841665', 'Uzo Nwosu', 'compliance', 'Uzo Nwosu - Wuse - Sms Banking Gateway', 'pending', 1071307.87, 'Delta', 'REF-D4419F0582', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2026-01-10 07:49:08', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-a234d9ea02eb', 'Adewale Sanusi', 'risk', 'Adewale Sanusi - Maitama - Sms Banking Gateway', 'active', 2245089.72, 'Plateau', 'REF-489B89C532', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2025-11-13 19:12:07', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-6bab04d6615b', 'Sade Otedola', 'finance', 'Sade Otedola - Warri - Sms Banking Gateway', 'processing', 7371638.59, 'Lagos', 'REF-3DE05A376F', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2026-03-09 20:24:33', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-501e9fb2fd7c', 'Rahma Adeyemi', 'lending', 'Rahma Adeyemi - Zaria - Sms Banking Gateway', 'processing', 5394155.2, 'Osun', 'REF-855634949E', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2026-03-31 14:37:13', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-5a004de8e2ec', 'Nneka Sanusi', 'compliance', 'Nneka Sanusi - Benin City - Sms Banking Gateway', 'processing', 709057.05, 'Abuja FCT', 'REF-CE23CA4DBC', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2025-12-19 18:41:52', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-8f8a260eedd5', 'Ibrahim Sanusi', 'risk', 'Ibrahim Sanusi - Benin City - Sms Banking Gateway', 'active', 3978291.44, 'Kaduna', 'REF-93449439F4', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2025-06-01 07:32:32', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-0064479f8490', 'Kemi Sanusi', 'technology', 'Kemi Sanusi - Kano - Sms Banking Gateway', 'pending', 503514.54, 'Edo', 'REF-A0413B0F73', '{"source": "seed", "table": "sms_banking_gateway"}'::jsonb, '2025-09-08 11:07:30', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── sms_otp_service ───
INSERT INTO "sms_otp_service" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-cd8cf2355285', 'Dorcas Fashola', 'payments', 'Dorcas Fashola - Ibadan - Sms Otp Service', 'approved', 2986108.25, 'Kaduna', 'REF-4D448523DB', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-01-01 12:45:02', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-1d82ca2214df', 'Adaeze Danladi', 'finance', 'Adaeze Danladi - Port Harcourt - Sms Otp Service', 'processing', 9060384.34, 'Akwa Ibom', 'REF-EEFBA2CA98', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-10-19 07:13:05', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-e386ea05d790', 'Rasheed Chukwu', 'payments', 'Rasheed Chukwu - Garki - Sms Otp Service', 'processing', 536378.5, 'Akwa Ibom', 'REF-CE319B30DB', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2026-04-13 17:58:52', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-057f2ee2ceab', 'Emeka Eze', 'payments', 'Emeka Eze - Garki - Sms Otp Service', 'active', 8886046.46, 'Kano', 'REF-45444903B8', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-11-12 16:20:39', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-2fa8d101e38f', 'Damilola Adenuga', 'compliance', 'Damilola Adenuga - Warri - Sms Otp Service', 'active', 2965244.28, 'Lagos', 'REF-833ED29C97', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-03-06 02:48:41', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-d79e03c564c8', 'Jumoke Lawal', 'lending', 'Jumoke Lawal - Abeokuta - Sms Otp Service', 'active', 1510942.11, 'Borno', 'REF-7F572FAEB7', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2026-02-09 10:04:32', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-20a89d03ed3f', 'Babajide Adenuga', 'risk', 'Babajide Adenuga - Warri - Sms Otp Service', 'processing', 7110119.84, 'Kaduna', 'REF-C3388FF3EE', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-08-24 15:32:04', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-e48b0efd9b72', 'Adewale Lawal', 'risk', 'Adewale Lawal - Kano - Sms Otp Service', 'active', 9613709.04, 'Enugu', 'REF-8746E54500', '{"source": "seed", "table": "sms_otp_service"}'::jsonb, '2025-07-01 16:25:13', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── soc2_evidence ───
INSERT INTO "soc2_evidence" ("controlId", "category", "title", "evidenceType", "result", "period", "artifacts", "auditor", "status", "createdAt") VALUES
  ('CONT-9ab5565aa71f', 'technology', 'SOC2_E-d3dd3c7f1108', 'standard', 'SOC2_E-df921a448457', '2025-08', '{"data": "seed"}'::jsonb, 'SOC2_E-5c778eda068c', 'pending', '2025-01-22 09:22:51'),
  ('CONT-ff3bcff811bc', 'operations', 'SOC2_E-3776fbb8f528', 'enhanced', 'SOC2_E-570eed672905', '2025-10', '{"data": "seed"}'::jsonb, 'SOC2_E-0416f9514848', 'completed', '2026-03-26 00:54:54'),
  ('CONT-7f3550568662', 'compliance', 'SOC2_E-29e5e4edff8a', 'premium', 'SOC2_E-7ec7ca4c7980', '2025-02', '{"data": "seed"}'::jsonb, 'SOC2_E-c84051553d1a', 'pending', '2025-04-23 16:51:49'),
  ('CONT-bb955f04770e', 'compliance', 'SOC2_E-a3f0c3583840', 'standard', 'SOC2_E-4580e66a6003', '2025-11', '{"data": "seed"}'::jsonb, 'SOC2_E-481080ffb59a', 'active', '2025-06-12 17:42:53'),
  ('CONT-8470015b67ca', 'finance', 'SOC2_E-2772767d3b6d', 'enhanced', 'SOC2_E-865c3431216e', '2025-11', '{"data": "seed"}'::jsonb, 'SOC2_E-a9f0d19ae4ab', 'processing', '2025-12-13 18:11:09'),
  ('CONT-99782c0363bc', 'technology', 'SOC2_E-b0433b5b9da3', 'full', 'SOC2_E-d5df7dad1204', '2025-12', '{"data": "seed"}'::jsonb, 'SOC2_E-f49c615e08bb', 'completed', '2025-05-23 07:34:03'),
  ('CONT-1e42c828a100', 'compliance', 'SOC2_E-7eda8cc2bf4d', 'premium', 'SOC2_E-2c9ca17239d7', '2025-07', '{"data": "seed"}'::jsonb, 'SOC2_E-6d0167aae523', 'pending', '2025-05-27 04:26:12'),
  ('CONT-3ba8b867663f', 'general', 'SOC2_E-d5646cf00102', 'enhanced', 'SOC2_E-3beac8107790', '2025-01', '{"data": "seed"}'::jsonb, 'SOC2_E-a041eb804ea3', 'approved', '2025-02-24 02:14:28')
ON CONFLICT DO NOTHING;


-- ─── soil_analysis ───
INSERT INTO "soil_analysis" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-56c6eadc94b3', 'Kunle Dangote', 'payments', 'Kunle Dangote - Zaria - Soil Analysis', 'processing', 1899724.1, 'Anambra', 'REF-4C1DD76E13', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2026-01-18 03:23:22', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-5f17815da727', 'Segun Adeyemi', 'compliance', 'Segun Adeyemi - Asaba - Soil Analysis', 'pending', 526556.22, 'Kaduna', 'REF-8BDB2ADDB4', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2026-05-06 02:27:38', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-c33937a14205', 'Lanre Danladi', 'risk', 'Lanre Danladi - Ibadan - Soil Analysis', 'completed', 3706964.68, 'Kano', 'REF-61A63D9E58', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2026-01-17 04:23:24', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-e7a1b9e35a7d', 'Jumoke Lawal', 'risk', 'Jumoke Lawal - Benin City - Soil Analysis', 'processing', 560899.3, 'Cross River', 'REF-7DE0D0F98B', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2025-03-21 23:53:06', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-48e49b9b524e', 'Uzo Eze', 'payments', 'Uzo Eze - Enugu - Soil Analysis', 'processing', 6007333.43, 'Borno', 'REF-3C8B6D9BBF', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2026-04-06 06:41:30', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-038190cce8e1', 'Nneka Okafor', 'compliance', 'Nneka Okafor - Ibadan - Soil Analysis', 'processing', 8530677.76, 'Kwara', 'REF-73D2806DE8', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2025-12-09 04:20:29', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-e978fd5995f6', 'Babajide Lawal', 'lending', 'Babajide Lawal - Enugu - Soil Analysis', 'approved', 7267574.1, 'Lagos', 'REF-8BADD32543', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2025-07-30 07:55:57', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-be531c01dcc3', 'Kunle Chukwu', 'finance', 'Kunle Chukwu - Garki - Soil Analysis', 'approved', 266860.85, 'Imo', 'REF-34EFC9016B', '{"source": "seed", "table": "soil_analysis"}'::jsonb, '2025-05-29 12:23:24', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── sorted_set_rankings ───
INSERT INTO "sorted_set_rankings" ("name", "members", "updateFrequency", "status", "createdAt") VALUES
  ('Musa Fashola', 843, 'SORTED-6b6d14a82da4', 'completed', '2025-08-09 00:57:00'),
  ('Sade Okafor', 392, 'SORTED-8ec8dbeac915', 'active', '2026-03-23 08:13:16'),
  ('Chukwuemeka Taiwo', 300, 'SORTED-e2034e13e457', 'approved', '2026-03-22 12:21:47'),
  ('Hassan Igwe', 483, 'SORTED-eea730e9ab7b', 'processing', '2025-12-06 07:25:23'),
  ('Rasheed Lawal', 28, 'SORTED-96e1bb9dd431', 'completed', '2025-01-09 19:59:53'),
  ('Nneka Okafor', 285, 'SORTED-9ed2e9812196', 'pending', '2025-04-04 15:48:40'),
  ('Bukola Elumelu', 182, 'SORTED-ce927471692d', 'approved', '2026-02-13 16:00:21'),
  ('Musa Taiwo', 109, 'SORTED-cd5e047f7f0a', 'processing', '2025-10-08 13:00:34')
ON CONFLICT DO NOTHING;


-- ─── sql_queries ───
INSERT INTO "sql_queries" ("originalQuery", "parameterized", "parameterCount", "injectionAttempts", "blocked", "status", "createdAt") VALUES
  ('SQL_QU-bfd91a0e2c5a', true, 5433, 162, 853, 'completed', '2025-08-24 02:21:01'),
  ('SQL_QU-dca6cb1a5d9d', false, 8448, 266, 332, 'processing', '2025-05-28 01:32:13'),
  ('SQL_QU-04453d64d43c', true, 812, 660, 460, 'pending', '2025-06-05 23:31:38'),
  ('SQL_QU-8dc23a816624', true, 1820, 488, 281, 'approved', '2025-12-24 22:41:06'),
  ('SQL_QU-29dc2f1a9f49', true, 5308, 619, 180, 'completed', '2025-03-25 03:22:59'),
  ('SQL_QU-39d70636d980', false, 8457, 500, 818, 'completed', '2026-04-28 00:59:16'),
  ('SQL_QU-3f967b2ffbe8', true, 8983, 426, 378, 'active', '2025-07-14 12:51:04'),
  ('SQL_QU-fafb4344d087', true, 4943, 953, 283, 'processing', '2025-02-20 15:16:07')
ON CONFLICT DO NOTHING;


-- ─── sri_hashes ───
INSERT INTO "sri_hashes" ("resource", "algorithm", "hash", "lastVerified", "violations", "cdnProvider", "status", "createdAt") VALUES
  ('SRI_HA-baa7f398c88e', 'SRI_HA-061bb549ec57', 'SRI_HA-13b679f9a132', '2025-09-01 00:57:52', 884, 'SRI_HA-8f32c405bc6c', 'completed', '2026-05-07 00:06:07'),
  ('SRI_HA-d6769cac6046', 'SRI_HA-867e970b2487', 'SRI_HA-6f86a74b444e', '2025-03-21 06:50:09', 737, 'SRI_HA-17e2c78b2539', 'approved', '2026-01-03 18:59:52'),
  ('SRI_HA-0b974203582f', 'SRI_HA-796154f10520', 'SRI_HA-b4275d1b9413', '2025-02-03 03:26:19', 312, 'SRI_HA-1df14e28f84e', 'pending', '2026-02-14 01:54:30'),
  ('SRI_HA-a482bd0fc3ac', 'SRI_HA-22be91c35e53', 'SRI_HA-96bb5d7e9fa1', '2025-05-11 05:36:08', 822, 'SRI_HA-4ebcec324b09', 'approved', '2025-11-24 07:15:22'),
  ('SRI_HA-3c0e7d403927', 'SRI_HA-b5423e9ceb2a', 'SRI_HA-b713acf97c15', '2025-03-18 14:33:15', 839, 'SRI_HA-b46b7d32701e', 'completed', '2025-01-04 03:50:36'),
  ('SRI_HA-a7118fa2087b', 'SRI_HA-3c806586037d', 'SRI_HA-2da25bed6883', '2025-05-26 05:28:16', 511, 'SRI_HA-3d24159e5d97', 'approved', '2025-01-22 17:24:11'),
  ('SRI_HA-6002ae917064', 'SRI_HA-d8bbfcb53f2d', 'SRI_HA-5a42afedd312', '2025-09-03 09:04:45', 169, 'SRI_HA-235635175369', 'completed', '2025-04-24 12:44:54'),
  ('SRI_HA-75e4d2627f3d', 'SRI_HA-c481f3580b22', 'SRI_HA-e7441df1d506', '2025-08-11 07:14:17', 670, 'SRI_HA-fd7474657b96', 'completed', '2026-02-18 02:00:54')
ON CONFLICT DO NOTHING;


-- ─── stream_response_configs ───
INSERT INTO "stream_response_configs" ("endpoint", "thresholdBytes", "chunksizeKB", "bytesStreamed24h", "memoryReductionPct", "status", "createdAt") VALUES
  ('STREAM-f923c55ad34f', 369, 640, 'STREAM-e74a8bb52442', 'STREAM-2eda5fce084a', 'active', '2026-02-07 20:22:51'),
  ('STREAM-a6b116492750', 102, 859, 'STREAM-f3ffdcbcb704', 'STREAM-8f38a6c38aee', 'approved', '2026-03-13 22:38:19'),
  ('STREAM-c7672ab81844', 193, 384, 'STREAM-711aa22cfbe8', 'STREAM-38b09ef32da6', 'processing', '2025-04-30 04:13:29'),
  ('STREAM-c2bfeebc123a', 864, 515, 'STREAM-06e533e6ffc3', 'STREAM-f517947b9e48', 'completed', '2025-10-19 14:07:27'),
  ('STREAM-1716e046b17e', 892, 305, 'STREAM-2725cc97a65e', 'STREAM-1162e83ec860', 'processing', '2025-05-03 21:39:23'),
  ('STREAM-dd874b8e4921', 330, 261, 'STREAM-8b726ae5e055', 'STREAM-7eceacb216fe', 'approved', '2026-05-05 09:53:44'),
  ('STREAM-98fc49ea0657', 291, 485, 'STREAM-46a59ebaf3a5', 'STREAM-19fb04e5b519', 'approved', '2025-09-28 05:44:22'),
  ('STREAM-40a0b3d27d86', 900, 730, 'STREAM-c355455fbed5', 'STREAM-e441812dc967', 'approved', '2025-06-29 21:35:56')
ON CONFLICT DO NOTHING;


-- ─── sw_cache_strategies ───
INSERT INTO "sw_cache_strategies" ("pattern", "strategy", "maxAge", "cacheHitRate", "offlineCapable", "status", "createdAt") VALUES
  ('SW_CAC-6cd93b851a05', 'SW_CAC-331f6111a2bb', 637, 'SW_CAC-2a7b315eb624', true, 'active', '2025-02-09 15:17:36'),
  ('SW_CAC-2d48d071cfa3', 'SW_CAC-d829103d60e3', 132, 'SW_CAC-a7030215e660', true, 'completed', '2026-03-03 20:38:27'),
  ('SW_CAC-aa223f9d56cf', 'SW_CAC-ff25bcb2dbf2', 862, 'SW_CAC-88069fd81e47', true, 'completed', '2025-01-04 08:15:53'),
  ('SW_CAC-8b26377df760', 'SW_CAC-8615fa5a6385', 527, 'SW_CAC-fabd54ac5624', true, 'processing', '2026-03-15 05:33:57'),
  ('SW_CAC-5c4b79da6df2', 'SW_CAC-7ac173d5fb80', 375, 'SW_CAC-c1270d40f791', false, 'processing', '2026-02-28 13:20:40'),
  ('SW_CAC-c1ec187a2426', 'SW_CAC-a125461109f0', 314, 'SW_CAC-62c52e4d5d03', false, 'pending', '2025-08-10 18:03:58'),
  ('SW_CAC-6e3a6daca6a2', 'SW_CAC-7f6dd13131f8', 711, 'SW_CAC-b4798b4a00fa', true, 'processing', '2026-02-22 17:31:25'),
  ('SW_CAC-b9ad1d26e600', 'SW_CAC-80a9715a5843', 343, 'SW_CAC-93c48314fdd7', true, 'active', '2026-01-12 20:11:10')
ON CONFLICT DO NOTHING;


-- ─── table_partitions ───
INSERT INTO "table_partitions" ("tableName", "partitionKey", "partitionType", "activePartitions", "rowsPerPartition", "status", "createdAt") VALUES
  ('TABLE_-da3e97f0eb74', 'TABLE_-2088003d388d', 'full', 125, 'TABLE_-79e4849d8a94', 'approved', '2026-03-26 15:52:01'),
  ('TABLE_-de1fe02896d1', 'TABLE_-0ca3a9b36a77', 'premium', 831, 'TABLE_-395c78ed40ae', 'completed', '2025-07-14 05:02:01'),
  ('TABLE_-d0f305f35845', 'TABLE_-9461de28be0c', 'premium', 360, 'TABLE_-ad7ad74fefcf', 'pending', '2025-11-04 16:43:07'),
  ('TABLE_-44385d818e2d', 'TABLE_-7b29d33a1e1d', 'premium', 417, 'TABLE_-51acd7085cff', 'pending', '2025-10-24 14:03:15'),
  ('TABLE_-3f6799462cf7', 'TABLE_-99fe9934917e', 'basic', 468, 'TABLE_-67078c915797', 'completed', '2025-01-16 13:14:02'),
  ('TABLE_-d39a2f5cb360', 'TABLE_-eb353ed71e1b', 'enhanced', 867, 'TABLE_-16c9e92058e8', 'approved', '2025-10-04 10:21:26'),
  ('TABLE_-470b26cd32a2', 'TABLE_-f1d52a119632', 'standard', 295, 'TABLE_-d63bca315779', 'approved', '2026-02-17 15:19:49'),
  ('TABLE_-5ea821f6928d', 'TABLE_-85d33c99eae0', 'standard', 296, 'TABLE_-0ba29b901ef5', 'active', '2025-10-25 02:06:59')
ON CONFLICT DO NOTHING;


-- ─── tb_batch_configs ───
INSERT INTO "tb_batch_configs" ("batchSize", "throughputTps", "status", "createdAt") VALUES
  (858, 284, 'processing', '2026-01-13 15:25:57'),
  (820, 746, 'approved', '2025-12-23 07:36:06'),
  (573, 620, 'active', '2025-03-15 05:40:52'),
  (457, 380, 'approved', '2026-02-22 01:44:02'),
  (256, 589, 'pending', '2026-02-05 14:22:00'),
  (766, 321, 'active', '2025-08-01 10:00:25'),
  (502, 804, 'processing', '2025-02-11 20:56:45'),
  (968, 938, 'completed', '2026-03-29 06:52:31')
ON CONFLICT DO NOTHING;


-- ─── telegram_banking_commands ───
INSERT INTO "telegram_banking_commands" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-62a883d2907b', 'Maryam Hassan', 'finance', 'Maryam Hassan - Wuse - Telegram Banking Commands', 'completed', 6592088.86, 'Edo', 'REF-1F6555FC89', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-01-29 08:41:42', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-a7f8699bb5fc', 'Esther Fashola', 'operations', 'Esther Fashola - Abeokuta - Telegram Banking Commands', 'pending', 9309950.79, 'Imo', 'REF-4C68B1A1FF', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-04-30 03:24:20', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-a8278e9a7af9', 'Ifeoma Sanusi', 'technology', 'Ifeoma Sanusi - Garki - Telegram Banking Commands', 'approved', 7040043.6, 'Ogun', 'REF-CAE6F4BD04', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-08-23 13:30:11', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-b1ae0c36143c', 'Hassan Adenuga', 'risk', 'Hassan Adenuga - Benin City - Telegram Banking Commands', 'approved', 7511230.44, 'Rivers', 'REF-3FA2C27A03', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-01-11 12:25:01', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-030431d4dc99', 'Kemi Nwosu', 'operations', 'Kemi Nwosu - Benin City - Telegram Banking Commands', 'completed', 3229740.92, 'Lagos', 'REF-4AD54EE1E6', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-04-02 14:44:17', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-d87a8a4585e5', 'Esther Okafor', 'operations', 'Esther Okafor - Awka - Telegram Banking Commands', 'processing', 3686195.59, 'Osun', 'REF-29857E1109', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-12-03 04:18:08', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-00b0adf5aac1', 'Rahma Nwosu', 'payments', 'Rahma Nwosu - Garki - Telegram Banking Commands', 'active', 8918330.46, 'Borno', 'REF-DE9809CB08', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2025-05-03 02:11:32', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-e8c0c2115d59', 'Oluchi Jimoh', 'operations', 'Oluchi Jimoh - Garki - Telegram Banking Commands', 'completed', 9202574.52, 'Plateau', 'REF-DAE1708EB2', '{"source": "seed", "table": "telegram_banking_commands"}'::jsonb, '2026-03-06 02:24:51', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── telegram_bot_gateway ───
INSERT INTO "telegram_bot_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-e8fab334fa8a', 'Kemi Sanusi', 'risk', 'Kemi Sanusi - Zaria - Telegram Bot Gateway', 'pending', 8069253.07, 'Lagos', 'REF-1C5B3149FB', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2026-03-15 20:05:26', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-aad19f538782', 'Tunde Okafor', 'finance', 'Tunde Okafor - Maitama - Telegram Bot Gateway', 'approved', 9590535.42, 'Abuja FCT', 'REF-426042F0F5', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2026-04-06 07:58:07', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-84d86268b8ba', 'Sade Danladi', 'compliance', 'Sade Danladi - Ibadan - Telegram Bot Gateway', 'approved', 7333336.74, 'Akwa Ibom', 'REF-5E6C32A39E', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2025-04-23 05:03:22', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-31dfd475c5ba', 'Nnamdi Sanusi', 'technology', 'Nnamdi Sanusi - Lekki - Telegram Bot Gateway', 'approved', 9885051.57, 'Imo', 'REF-8F2115CA8B', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2025-01-16 03:17:32', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-851140bc9e57', 'Jumoke Adeyemi', 'payments', 'Jumoke Adeyemi - Kano - Telegram Bot Gateway', 'processing', 2447921.5, 'Imo', 'REF-9A442346E5', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2025-02-03 10:24:28', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-ea1d6a411861', 'Damilola Hassan', 'compliance', 'Damilola Hassan - Lekki - Telegram Bot Gateway', 'active', 6309002.15, 'Borno', 'REF-926B52B98A', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2025-04-03 06:02:34', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f6da45ddda03', 'Adaeze Jimoh', 'payments', 'Adaeze Jimoh - Ikeja - Telegram Bot Gateway', 'completed', 1778621.56, 'Cross River', 'REF-2B15B3AC0B', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2026-03-09 04:55:39', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9b4c46ba7038', 'Damilola Balogun', 'lending', 'Damilola Balogun - Garki - Telegram Bot Gateway', 'active', 2371144.03, 'Imo', 'REF-7D3C2AEA96', '{"source": "seed", "table": "telegram_bot_gateway"}'::jsonb, '2025-08-08 02:35:07', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── telegram_kyc_bot ───
INSERT INTO "telegram_kyc_bot" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-bc479b05d4d7', 'Oluchi Adeyemi', 'lending', 'Oluchi Adeyemi - Ibadan - Telegram Kyc Bot', 'pending', 2229479.75, 'Osun', 'REF-37E3D47AB1', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-04-14 09:49:43', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-9f7860c69a74', 'Babajide Eze', 'finance', 'Babajide Eze - Kano - Telegram Kyc Bot', 'completed', 333880.09, 'Kaduna', 'REF-C63EBA7703', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-04-20 17:16:29', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-82f24fe6eb88', 'Grace Okafor', 'finance', 'Grace Okafor - Benin City - Telegram Kyc Bot', 'approved', 6360173.07, 'Lagos', 'REF-22D8A31347', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-01-31 15:58:31', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-5fd9add37577', 'Jumoke Jimoh', 'finance', 'Jumoke Jimoh - Victoria Island - Telegram Kyc Bot', 'approved', 3335198.57, 'Akwa Ibom', 'REF-5711895178', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-01-25 11:36:58', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-0ef116ed89b5', 'Pelumi Eze', 'operations', 'Pelumi Eze - Asaba - Telegram Kyc Bot', 'active', 2363908.35, 'Enugu', 'REF-047878B2EB', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-05-13 03:18:12', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-789eb52fa4dd', 'Tunde Taiwo', 'finance', 'Tunde Taiwo - Victoria Island - Telegram Kyc Bot', 'pending', 3584747.94, 'Osun', 'REF-39EE521D8F', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-05-18 20:12:48', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-2b72465ae52b', 'Bukola Adeyemi', 'technology', 'Bukola Adeyemi - Warri - Telegram Kyc Bot', 'processing', 1110241.31, 'Oyo', 'REF-A1312DF642', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-08-16 14:28:54', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-ee051f87aa6d', 'Tunde Kalu', 'technology', 'Tunde Kalu - Enugu - Telegram Kyc Bot', 'active', 8689678.33, 'Osun', 'REF-3E27EAB45D', '{"source": "seed", "table": "telegram_kyc_bot"}'::jsonb, '2025-10-18 16:53:36', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── telegram_mini_app ───
INSERT INTO "telegram_mini_app" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-965c99a3f749', 'Femi Igwe', 'payments', 'Femi Igwe - Lekki - Telegram Mini App', 'active', 9433454.58, 'Plateau', 'REF-60FD6643E3', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-08-16 02:20:44', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7891c047c6d4', 'Adewale Lawal', 'lending', 'Adewale Lawal - Abeokuta - Telegram Mini App', 'approved', 2275333.69, 'Abuja FCT', 'REF-B22486881C', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2026-01-04 03:12:46', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-5ca63b46d6d5', 'Bukola Okafor', 'finance', 'Bukola Okafor - Benin City - Telegram Mini App', 'pending', 7735789.36, 'Akwa Ibom', 'REF-038BE119BB', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-10-07 11:54:38', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f8254a7cf134', 'Musa Otedola', 'lending', 'Musa Otedola - Port Harcourt - Telegram Mini App', 'completed', 3255557.31, 'Anambra', 'REF-B4CE23DDDF', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-04-10 22:45:46', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-a49a386b7613', 'Ibrahim Yakubu', 'operations', 'Ibrahim Yakubu - Zaria - Telegram Mini App', 'completed', 2524559.89, 'Edo', 'REF-3A5B465DEE', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-08-09 09:01:55', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-df869505ad91', 'Chidinma Danladi', 'compliance', 'Chidinma Danladi - Garki - Telegram Mini App', 'active', 6750058.54, 'Lagos', 'REF-F55D98B066', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-09-21 23:07:27', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-cbd66086c292', 'Rasheed Usman', 'payments', 'Rasheed Usman - Ibadan - Telegram Mini App', 'completed', 2195490.3, 'Edo', 'REF-454E2D6EBA', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-05-26 01:20:26', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-78792530672f', 'Emeka Mohammed', 'risk', 'Emeka Mohammed - Enugu - Telegram Mini App', 'active', 200433.64, 'Borno', 'REF-64C10B5901', '{"source": "seed", "table": "telegram_mini_app"}'::jsonb, '2025-07-22 08:21:32', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── telegram_notification ───
INSERT INTO "telegram_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-090cb5a8062e', 'Damilola Balogun', 'payments', 'Damilola Balogun - Asaba - Telegram Notification', 'active', 162088.88, 'Kaduna', 'REF-B0CF21BD73', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-01-10 20:08:22', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-69a9f93c6e8f', 'Uche Kalu', 'operations', 'Uche Kalu - Kano - Telegram Notification', 'approved', 9098194.86, 'Ogun', 'REF-C8BA1549C8', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2026-01-19 13:32:13', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-7d89cde15c00', 'Uzo Kalu', 'technology', 'Uzo Kalu - Benin City - Telegram Notification', 'approved', 5055224.21, 'Anambra', 'REF-70F92883DD', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-07-17 13:57:23', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-ec4b8ff9ee5c', 'Segun Adenuga', 'compliance', 'Segun Adenuga - Warri - Telegram Notification', 'approved', 2175554.23, 'Imo', 'REF-02CB730643', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-11-21 13:43:00', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-328e588691cd', 'Pelumi Adenuga', 'operations', 'Pelumi Adenuga - Kano - Telegram Notification', 'active', 8155542.53, 'Anambra', 'REF-A902D74F93', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-09-09 10:00:59', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-993ccde10b4c', 'Bukola Fashola', 'operations', 'Bukola Fashola - Lekki - Telegram Notification', 'pending', 4264101.72, 'Imo', 'REF-340BA933D2', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-04-08 05:49:02', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-abd989d31c1b', 'Pelumi Taiwo', 'finance', 'Pelumi Taiwo - Port Harcourt - Telegram Notification', 'pending', 2659811.6, 'Plateau', 'REF-39AF01F82E', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2025-03-17 03:56:10', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-46edb2214255', 'Fatima Balogun', 'payments', 'Fatima Balogun - Awka - Telegram Notification', 'completed', 8628238.0, 'Oyo', 'REF-62E02B60DF', '{"source": "seed", "table": "telegram_notification"}'::jsonb, '2026-01-08 08:39:48', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── tellerSessions ───
INSERT INTO "tellerSessions" ("sessionId", "tenantId", "tellerId", "tellerName", "branchCode", "branchName", "windowNumber", "status", "openedAt", "closedAt", "openingBalance", "currentBalance", "transactionCount", "cashDrawer", "createdAt", "updatedAt") VALUES
  ('SESS-e84bb95193ff', 'tenant-lagos-main', 'TELL-f0516c4c7df2', 'TELLER-fe9d9f9deb51', 'TELLER-0435687a974d', 'TELLER-7d165968fb6d', 993, 'processing', 'TELLER-37d721d6c795', 'TELLER-71904c0d45f6', 4635827.58, 7773990.58, 493, '{"data": "seed"}'::jsonb, '2025-03-11 07:51:10', '2025-06-17 10:14:04'),
  ('SESS-93b7604d64d2', 'tenant-lagos-main', 'TELL-24f3deed71f3', 'TELLER-9578baf44c7b', 'TELLER-3801d77ba0b1', 'TELLER-faaa41a1d834', 264, 'active', 'TELLER-7c305bb3c449', 'TELLER-a14d3d49ffe4', 8853515.52, 270906.96, 916, '{"data": "seed"}'::jsonb, '2025-07-02 17:56:34', '2025-03-29 20:24:25'),
  ('SESS-5c2e0d54a106', 'tenant-abuja-digital', 'TELL-2377d9027b45', 'TELLER-7bde03f93f3a', 'TELLER-cb180832c695', 'TELLER-65a0ea293fed', 296, 'approved', 'TELLER-4d05dc76740f', 'TELLER-80171adb9d7e', 4954242.19, 9739583.83, 66, '{"data": "seed"}'::jsonb, '2026-03-14 06:12:00', '2025-10-08 12:28:07'),
  ('SESS-5ac524b9df26', 'tenant-kano-north', 'TELL-a5d92fea3324', 'TELLER-501667b61f9a', 'TELLER-ae73252c36cb', 'TELLER-6292eab2c1f9', 915, 'active', 'TELLER-eb7262875a46', 'TELLER-9fccd13e95f0', 5293540.79, 318559.66, 5809, '{"data": "seed"}'::jsonb, '2025-04-20 10:58:02', '2025-03-21 15:18:51'),
  ('SESS-ce8982f790b8', 'tenant-lagos-main', 'TELL-dcef56a787ef', 'TELLER-4fee46fd4699', 'TELLER-1629af50ea54', 'TELLER-17159c1b87f9', 71, 'completed', 'TELLER-a5c7ed7e7028', 'TELLER-7baffa126126', 3821904.41, 1713930.39, 9061, '{"data": "seed"}'::jsonb, '2025-03-23 21:52:01', '2025-04-17 20:11:15'),
  ('SESS-ae4fb81e9421', 'tenant-portharcourt', 'TELL-97cdc3f2900d', 'TELLER-95a5290ff0cb', 'TELLER-5e2e281dc61a', 'TELLER-f964f596a4dd', 504, 'pending', 'TELLER-620607ecf74d', 'TELLER-8f1a0d56b0ef', 4390455.82, 2230653.57, 923, '{"data": "seed"}'::jsonb, '2025-12-25 00:25:56', '2025-05-19 00:37:49'),
  ('SESS-45d895c6ebd9', 'tenant-whitelabel-zenith', 'TELL-e14fb602d216', 'TELLER-2a7b410a7212', 'TELLER-e79d38102a2d', 'TELLER-6ae86d0cd7fd', 104, 'completed', 'TELLER-e793c1ad9b94', 'TELLER-e1cb827c4ab9', 5801455.03, 8219732.13, 8452, '{"data": "seed"}'::jsonb, '2026-01-14 02:24:39', '2025-11-15 04:56:55'),
  ('SESS-90fb59bf69ba', 'tenant-kano-north', 'TELL-26dd80a04b7c', 'TELLER-72213f80c0f8', 'TELLER-3fb66f55b8d5', 'TELLER-0858d402e740', 580, 'completed', 'TELLER-8bc5d39a9e1e', 'TELLER-706016c2f4d5', 9546157.51, 7642366.45, 598, '{"data": "seed"}'::jsonb, '2025-09-06 01:00:43', '2025-07-11 22:10:47')
ON CONFLICT DO NOTHING;


-- ─── tellerTransactions ───
INSERT INTO "tellerTransactions" ("txnId", "sessionId", "tenantId", "txnType", "customerId", "amount", "currency", "reference", "status", "processedAt", "createdAt") VALUES
  ('TXNI-90923422c3c5', 'SESS-7e3d26186ebc', 'tenant-kano-north', 'enhanced', 'CUST-583186a04b5b', 34048986.88, 'USD', 'REF-0DF5D076E9DC', 'pending', 'TELLER-216adc72a1a1', '2025-06-11 23:32:35'),
  ('TXNI-2958904121b1', 'SESS-473096323dd1', 'tenant-portharcourt', 'full', 'CUST-64dd51a30acb', 18376637.89, 'EUR', 'REF-1AA729D34E99', 'completed', 'TELLER-309111b2ac25', '2025-02-22 13:15:46'),
  ('TXNI-c655439bbf63', 'SESS-718ba728a1ff', 'tenant-lagos-main', 'basic', 'CUST-7b9fae688139', 25183627.4, 'GBP', 'REF-FA429D816EB3', 'approved', 'TELLER-1379ec31c3ca', '2025-10-17 21:10:03'),
  ('TXNI-66a75871fa75', 'SESS-fc4f45f492fd', 'tenant-whitelabel-zenith', 'standard', 'CUST-c018bb2b4356', 41922882.75, 'GBP', 'REF-B331DC2E4517', 'approved', 'TELLER-cc94d775a75a', '2025-01-10 20:57:29'),
  ('TXNI-7735a89d5ba1', 'SESS-d543c351c169', 'tenant-lagos-main', 'premium', 'CUST-0fef22b05e1c', 22612462.73, 'USD', 'REF-5F088EE08481', 'approved', 'TELLER-3135a274db18', '2025-04-04 00:20:01'),
  ('TXNI-d27cd0b44a92', 'SESS-71da9461421b', 'tenant-whitelabel-zenith', 'enhanced', 'CUST-4071de32deae', 34621259.35, 'NGN', 'REF-3C91FF1F3E5A', 'approved', 'TELLER-66e2378011a9', '2026-02-13 19:22:28'),
  ('TXNI-9f700b48c14a', 'SESS-c86723cb7282', 'tenant-portharcourt', 'premium', 'CUST-9af7d195f3f1', 36591337.71, 'GBP', 'REF-69F70B5AA411', 'active', 'TELLER-28c1e09e9700', '2025-04-04 06:23:56'),
  ('TXNI-e3d5f6c4ec16', 'SESS-e3d9f6115551', 'tenant-lagos-main', 'premium', 'CUST-4d52c24c73b5', 3619610.9, 'NGN', 'REF-E205454C4C01', 'completed', 'TELLER-46c2bde1800a', '2025-08-28 00:37:07')
ON CONFLICT DO NOTHING;


-- ─── temporal_memoized_activities ───
INSERT INTO "temporal_memoized_activities" ("workflow", "activity", "replaySpeedup", "cacheTTL", "cacheHitRate", "status", "createdAt") VALUES
  ('TEMPOR-cd0807cdf7d2', 'TEMPOR-4311d5d5565e', 'TEMPOR-350233e6e521', 'TEMPOR-bb8de91975e2', 'TEMPOR-d5545c6469d4', 'pending', '2026-04-15 23:31:45'),
  ('TEMPOR-3f34d2eaa576', 'TEMPOR-9089e4e5d33e', 'TEMPOR-70d53d0faa62', 'TEMPOR-e3b99ef7451a', 'TEMPOR-a710a1a3e727', 'active', '2025-05-15 05:36:31'),
  ('TEMPOR-afe3f37e8d99', 'TEMPOR-195d6ba6bc1c', 'TEMPOR-45ecdc54649a', 'TEMPOR-9d97723272bf', 'TEMPOR-c5363a617b9b', 'processing', '2025-01-13 17:16:40'),
  ('TEMPOR-980931111e4a', 'TEMPOR-286bc23e554a', 'TEMPOR-25771f6176f0', 'TEMPOR-4aa898ab868b', 'TEMPOR-5c4abd5c6aec', 'completed', '2025-12-08 12:46:17'),
  ('TEMPOR-0ef99524271c', 'TEMPOR-2add1e512b71', 'TEMPOR-e64022762839', 'TEMPOR-6c8ac29dbeab', 'TEMPOR-790afd0d7cf3', 'processing', '2025-08-07 18:08:20'),
  ('TEMPOR-e6d3ffa5d028', 'TEMPOR-9a3cbb082a53', 'TEMPOR-a68ba8f096a6', 'TEMPOR-a4f9a6b042c1', 'TEMPOR-c4a55252b24b', 'completed', '2026-05-08 12:47:58'),
  ('TEMPOR-850fc300c7ed', 'TEMPOR-231e3f585879', 'TEMPOR-723ac6fa5d7d', 'TEMPOR-674421ed8c13', 'TEMPOR-7f625f7f130f', 'approved', '2025-03-17 08:01:24'),
  ('TEMPOR-992b2edd0110', 'TEMPOR-2ba1c2d54b33', 'TEMPOR-acb61088da15', 'TEMPOR-ab53e0770772', 'TEMPOR-2d78da2354cb', 'active', '2026-02-08 08:02:20')
ON CONFLICT DO NOTHING;


-- ─── tls_configs ───
INSERT INTO "tls_configs" ("domain", "protocol", "cipherSuites", "certExpiry", "ocspStapling", "hstsPreload", "status", "createdAt") VALUES
  ('TLS_CO-1f960f8c7512', 'TLS_CO-bc117678406f', '{"data": "seed"}'::jsonb, '2025-04-13 00:42:57', true, true, 'completed', '2026-01-09 06:11:17'),
  ('TLS_CO-eb89118b0769', 'TLS_CO-05e047805444', '{"data": "seed"}'::jsonb, '2025-03-30 11:52:00', false, true, 'approved', '2025-01-24 06:36:20'),
  ('TLS_CO-efd70c976cdb', 'TLS_CO-c3488197744d', '{"data": "seed"}'::jsonb, '2025-02-08 16:32:18', true, true, 'active', '2026-03-25 10:49:40'),
  ('TLS_CO-ba6159aab555', 'TLS_CO-4bd6e47994fe', '{"data": "seed"}'::jsonb, '2025-09-26 15:06:57', true, true, 'active', '2026-03-03 22:22:07'),
  ('TLS_CO-096706693a8b', 'TLS_CO-fe4473380ff6', '{"data": "seed"}'::jsonb, '2025-08-13 15:07:34', true, false, 'pending', '2025-12-27 02:00:27'),
  ('TLS_CO-414b21a5e99f', 'TLS_CO-b44dd535d15c', '{"data": "seed"}'::jsonb, '2025-05-29 14:22:12', true, true, 'approved', '2026-05-02 04:57:55'),
  ('TLS_CO-1d514860d076', 'TLS_CO-7c133d704963', '{"data": "seed"}'::jsonb, '2025-06-20 19:05:22', false, true, 'approved', '2025-12-22 18:33:44'),
  ('TLS_CO-3444f159f7fc', 'TLS_CO-db7f29388211', '{"data": "seed"}'::jsonb, '2025-02-14 06:25:15', true, false, 'processing', '2025-02-27 04:39:24')
ON CONFLICT DO NOTHING;


-- ─── token_families ───
INSERT INTO "token_families" ("familyId", "userId", "clientId", "generation", "maxGenerations", "replayDetected", "revokedDescendants", "status", "createdAt") VALUES
  ('FAMI-6e24f790994c', 'USER-e4f007c51c31', 'CLIE-3def32af90f0', 437, 648, true, 332, 'approved', '2025-09-14 11:03:37'),
  ('FAMI-de2bda966e73', 'USER-3dcc83f33ebd', 'CLIE-534b0fba908d', 212, 470, true, 216, 'processing', '2025-06-20 22:59:48'),
  ('FAMI-fc320eab18f3', 'USER-b12deafa90ed', 'CLIE-3a826a6202ed', 171, 38, true, 259, 'pending', '2025-08-17 02:03:26'),
  ('FAMI-96c2dd7ca9be', 'USER-f36f9999227e', 'CLIE-f1fce03f5e39', 511, 400, false, 70, 'pending', '2025-11-04 01:13:42'),
  ('FAMI-0396be4e03e0', 'USER-2c6db52dd354', 'CLIE-397ec69aeab1', 925, 987, false, 29, 'pending', '2025-10-19 08:46:25'),
  ('FAMI-e139aac17d68', 'USER-a05486ff4c57', 'CLIE-2ca695d93871', 89, 188, true, 927, 'approved', '2025-06-02 14:42:58'),
  ('FAMI-d1a7293c8eb9', 'USER-9b65ffe549b9', 'CLIE-abf65b8fdc49', 495, 645, true, 677, 'processing', '2025-10-29 05:26:29'),
  ('FAMI-92a2ee680c5c', 'USER-0d1eed9de214', 'CLIE-e7309d1eb1b9', 715, 827, true, 438, 'approved', '2025-04-02 06:13:35')
ON CONFLICT DO NOTHING;


-- ─── transaction_alerts ───
INSERT INTO "transaction_alerts" ("ruleId", "customerId", "alertType", "severity", "amountNGN", "description", "status", "assignedTo", "resolvedAt", "createdAt") VALUES
  (594, 'CUST-91cfef6c36ab', 'enhanced', 'TRANSA-beb60508b1e8', 4338910.54, 'Chukwuemeka Fashola - Awka, Abuja FCT - transaction_alerts record', 'active', 'TRANSA-7c8da353d5d2', '2025-09-30 07:19:24', '2025-08-19 10:53:31'),
  (470, 'CUST-2e4848e5b3e4', 'full', 'TRANSA-2f462ecc4ff6', 8627251.42, 'Esther Kalu - Zaria, Edo - transaction_alerts record', 'completed', 'TRANSA-299bb3a515a7', '2026-03-15 08:50:55', '2025-10-09 03:08:08'),
  (59, 'CUST-e90a698ef9a7', 'standard', 'TRANSA-d0e71eb3fa5d', 9312332.55, 'Pelumi Usman - Benin City, Enugu - transaction_alerts record', 'processing', 'TRANSA-bca3e18d1451', '2026-04-10 12:26:44', '2025-05-22 08:46:18'),
  (537, 'CUST-aa5efeffc77e', 'enhanced', 'TRANSA-fb8718e8650d', 6780542.87, 'Ifeoma Okafor - Abeokuta, Enugu - transaction_alerts record', 'active', 'TRANSA-7e46e6430876', '2025-04-18 02:57:41', '2025-05-28 21:42:31'),
  (449, 'CUST-7af3574f0071', 'premium', 'TRANSA-268edd379b74', 370995.8, 'Kunle Sanusi - Warri, Oyo - transaction_alerts record', 'processing', 'TRANSA-398ad20c5873', '2026-01-20 02:42:11', '2025-03-05 10:23:31'),
  (309, 'CUST-ca1355319261', 'enhanced', 'TRANSA-dfb863467ea2', 1256053.71, 'Patience Danladi - Garki, Lagos - transaction_alerts record', 'processing', 'TRANSA-6114e1774d68', '2025-07-17 02:41:18', '2025-08-14 19:16:19'),
  (31, 'CUST-20e144997e62', 'enhanced', 'TRANSA-5061f0d0dde7', 8569256.66, 'Hassan Adeyemi - Kano, Plateau - transaction_alerts record', 'pending', 'TRANSA-34ca3ec5b210', '2025-02-24 04:06:15', '2025-09-13 08:36:12'),
  (726, 'CUST-1f194b99391d', 'full', 'TRANSA-aaf19aa7552c', 4129761.38, 'Emeka Jimoh - Victoria Island, Enugu - transaction_alerts record', 'active', 'TRANSA-9d8a7c8ee876', '2026-01-31 04:46:44', '2025-06-25 05:44:11')
ON CONFLICT DO NOTHING;


-- ─── transaction_monitoring_rules ───
INSERT INTO "transaction_monitoring_rules" ("name", "category", "scenarioCode", "description", "riskScoreImpact", "enabled", "cbnPrescribed", "thresholdConfig", "createdAt", "updatedAt") VALUES
  ('Adaeze Nwosu', 'compliance', 'TRANSA-5c0d0d613b6c', 'Sade Mohammed - Port Harcourt, Plateau - transaction_monitoring_rules record', 9, 674, 640, '{"enabled": true, "version": 1}'::jsonb, '2025-10-28 09:43:11', '2026-02-01 04:20:25'),
  ('Titilayo Igwe', 'general', 'TRANSA-e27791655bd6', 'Hauwa Otedola - Zaria, Cross River - transaction_monitoring_rules record', 7, 272, 157, '{"enabled": true, "version": 1}'::jsonb, '2026-04-30 00:34:20', '2025-07-31 19:58:42'),
  ('Femi Peterside', 'operations', 'TRANSA-d57cbffa1bc4', 'Ifeoma Adeyemi - Ikeja, Oyo - transaction_monitoring_rules record', 28, 43, 910, '{"enabled": true, "version": 1}'::jsonb, '2025-04-29 16:56:21', '2025-05-30 16:51:12'),
  ('Lanre Lawal', 'compliance', 'TRANSA-632089a283d3', 'Rasheed Otedola - Awka, Akwa Ibom - transaction_monitoring_rules record', 27, 19, 53, '{"enabled": true, "version": 1}'::jsonb, '2025-08-03 10:59:59', '2025-05-07 16:01:00'),
  ('Adewale Chukwu', 'operations', 'TRANSA-63e8672313f3', 'Musa Chukwu - Enugu, Enugu - transaction_monitoring_rules record', 81, 271, 114, '{"enabled": true, "version": 1}'::jsonb, '2025-01-09 01:22:36', '2026-04-09 05:22:26'),
  ('Hassan Usman', 'operations', 'TRANSA-03865dbf6223', 'Kunle Adeyemi - Zaria, Cross River - transaction_monitoring_rules record', 22, 34, 212, '{"enabled": true, "version": 1}'::jsonb, '2025-09-05 21:40:51', '2026-04-13 09:06:36'),
  ('Olumide Sanusi', 'operations', 'TRANSA-6e3102d37d56', 'Hauwa Otedola - Garki, Akwa Ibom - transaction_monitoring_rules record', 89, 332, 736, '{"enabled": true, "version": 1}'::jsonb, '2025-02-08 18:11:59', '2025-10-08 08:32:43'),
  ('Hauwa Danladi', 'compliance', 'TRANSA-87842de01f56', 'Adaeze Nwosu - Asaba, Lagos - transaction_monitoring_rules record', 61, 639, 910, '{"enabled": true, "version": 1}'::jsonb, '2025-01-17 12:31:28', '2025-09-17 06:08:59')
ON CONFLICT DO NOTHING;


-- ─── txn_pattern_analyses ───
INSERT INTO "txn_pattern_analyses" ("customerId", "customerName", "baselineDeviation", "recommendation", "status", "createdAt") VALUES
  ('CUST-aed5282c24b3', 'Rahma Adenuga', 'TXN_PA-60b939494ace', 'TXN_PA-c31a93d9eae6', 'active', '2025-06-26 15:27:18'),
  ('CUST-4bcff443e96d', 'Jide Yakubu', 'TXN_PA-d5bb0bcb6fb9', 'TXN_PA-88a150afe069', 'processing', '2025-04-01 19:14:34'),
  ('CUST-e5287a4cd7e3', 'Bukola Hassan', 'TXN_PA-d757866b9726', 'TXN_PA-b3ebd0908379', 'active', '2025-10-18 05:16:27'),
  ('CUST-c8c9dec706d0', 'Rasheed Garba', 'TXN_PA-972d16461977', 'TXN_PA-38aaf42b0ca3', 'pending', '2025-04-15 07:35:46'),
  ('CUST-4cd096b9221a', 'Jide Hassan', 'TXN_PA-d4f9a8ca73d8', 'TXN_PA-ef814397c3ae', 'pending', '2026-02-23 23:20:12'),
  ('CUST-43cd59a0b665', 'Segun Balogun', 'TXN_PA-14f21e124e98', 'TXN_PA-8259fbb83184', 'processing', '2025-07-26 04:42:19'),
  ('CUST-9fe4dec652a8', 'Ibrahim Otedola', 'TXN_PA-8e102eee263e', 'TXN_PA-636580beb40f', 'processing', '2025-10-18 22:06:37'),
  ('CUST-d2e9619edb2d', 'Jide Sanusi', 'TXN_PA-3a456314df60', 'TXN_PA-c692404511c6', 'pending', '2025-02-25 01:16:12')
ON CONFLICT DO NOTHING;


-- ─── typology_matches ───
INSERT INTO "typology_matches" ("typologyCode", "typologyName", "riskLevel", "customersTriggered", "autoSARGeneration", "status", "createdAt") VALUES
  ('TYPOLO-854b718b8fd0', 'TYPOLO-e6296448e03b', 'low', 622, false, 'processing', '2025-12-23 01:18:36'),
  ('TYPOLO-6da14c6f40be', 'TYPOLO-64098b9a84e2', 'high', 39, true, 'active', '2025-12-03 15:05:06'),
  ('TYPOLO-e6eafdd3210d', 'TYPOLO-882e467d3286', 'low', 899, true, 'pending', '2025-06-08 01:32:42'),
  ('TYPOLO-3223ee148964', 'TYPOLO-09ecbe57c00e', 'low', 212, true, 'completed', '2026-02-23 21:17:15'),
  ('TYPOLO-62f82eaa66d3', 'TYPOLO-b2da3bf08ecb', 'critical', 338, true, 'completed', '2025-02-13 08:33:44'),
  ('TYPOLO-3e00d2d4d548', 'TYPOLO-1f9fe5eeab43', 'low', 859, true, 'completed', '2025-11-10 09:16:10'),
  ('TYPOLO-837dee2699c3', 'TYPOLO-5e7c783cca6a', 'low', 353, true, 'completed', '2026-01-01 14:59:40'),
  ('TYPOLO-80326e8f87dd', 'TYPOLO-b288345d0d61', 'low', 985, false, 'active', '2026-01-31 08:37:23')
ON CONFLICT DO NOTHING;


-- ─── ubo_graph_edges ───
INSERT INTO "ubo_graph_edges" ("sourceId", "targetId", "relationship", "ownershipPct", "createdAt") VALUES
  (874, 980, '10.0.60.179', 2959607.98, '2025-02-11 03:26:45'),
  (460, 889, '10.0.78.229', 4892150.05, '2025-02-16 02:07:10'),
  (646, 834, '10.0.130.70', 4845589.5, '2025-12-16 09:01:22'),
  (283, 502, '10.0.155.202', 1614349.44, '2026-02-07 21:04:55'),
  (21, 571, '10.0.43.240', 7679655.43, '2025-03-11 09:15:55'),
  (156, 704, '10.0.23.174', 4740929.92, '2026-04-06 12:03:41'),
  (318, 38, '10.0.29.109', 2479817.9, '2025-05-24 08:16:12'),
  (776, 534, '10.0.8.71', 4125616.45, '2025-01-17 14:48:43')
ON CONFLICT DO NOTHING;


-- ─── ubo_graph_nodes ───
INSERT INTO "ubo_graph_nodes" ("entityName", "entityType", "nationality", "riskLevel", "metadata", "createdAt") VALUES
  ('Dorcas Taiwo', 'premium', 'UBO_GR-1b41ec7b0ca0', 'high', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-07-08 02:45:09'),
  ('Segun Otedola', 'premium', 'UBO_GR-c475701e8fe7', 'low', '{"source": "seed", "tenant": "tenant-abuja-digital"}'::jsonb, '2026-03-10 19:44:21'),
  ('Maryam Sanusi', 'full', 'UBO_GR-f465258d0981', 'low', '{"source": "seed", "tenant": "tenant-whitelabel-zenith"}'::jsonb, '2026-04-04 07:03:13'),
  ('Maryam Igwe', 'basic', 'UBO_GR-e8cc3957ea94', 'low', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2025-08-17 21:56:17'),
  ('Sade Balogun', 'premium', 'UBO_GR-5b9c97a18b12', 'low', '{"source": "seed", "tenant": "tenant-kano-north"}'::jsonb, '2025-01-27 00:01:10'),
  ('Oluchi Fashola', 'basic', 'UBO_GR-0cd5652d6543', 'high', '{"source": "seed", "tenant": "tenant-whitelabel-zenith"}'::jsonb, '2025-10-16 11:07:25'),
  ('Maryam Elumelu', 'standard', 'UBO_GR-2a625b77f60f', 'low', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2026-01-20 05:05:35'),
  ('Pelumi Taiwo', 'standard', 'UBO_GR-ebc23b2ad573', 'high', '{"source": "seed", "tenant": "tenant-lagos-main"}'::jsonb, '2026-02-28 03:38:35')
ON CONFLICT DO NOTHING;


-- ─── ussd_banking_gateway ───
INSERT INTO "ussd_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-45d2126d2c9e', 'Segun Kalu', 'risk', 'Segun Kalu - Warri - Ussd Banking Gateway', 'completed', 2761367.82, 'Imo', 'REF-6FB11E6AB1', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-06-19 16:43:09', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-fb2f8573b835', 'Kemi Kalu', 'operations', 'Kemi Kalu - Ibadan - Ussd Banking Gateway', 'active', 8981059.64, 'Plateau', 'REF-06010D8E33', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-12-25 13:20:52', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-49c8dd56434f', 'Nnamdi Eze', 'risk', 'Nnamdi Eze - Awka - Ussd Banking Gateway', 'active', 8628061.54, 'Rivers', 'REF-61C419C967', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-01-08 18:44:06', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-88a3fe679769', 'Pelumi Kalu', 'payments', 'Pelumi Kalu - Maitama - Ussd Banking Gateway', 'pending', 6908846.72, 'Rivers', 'REF-D3E5F617AB', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-02-26 16:54:15', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-94a7b82db1e7', 'Gbenga Mohammed', 'compliance', 'Gbenga Mohammed - Kano - Ussd Banking Gateway', 'approved', 4242136.66, 'Delta', 'REF-748482DD9D', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-11-09 18:38:00', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-58de7e3be1a7', 'Patience Balogun', 'risk', 'Patience Balogun - Garki - Ussd Banking Gateway', 'processing', 5959017.31, 'Lagos', 'REF-2E7AE75BB3', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-12-21 04:18:53', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-db48213035c4', 'Femi Nwosu', 'payments', 'Femi Nwosu - Asaba - Ussd Banking Gateway', 'approved', 154091.84, 'Abuja FCT', 'REF-4F5FE39CEC', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2025-09-01 23:59:13', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-bf1578c96d0e', 'Titilayo Peterside', 'compliance', 'Titilayo Peterside - Port Harcourt - Ussd Banking Gateway', 'active', 5340393.0, 'Oyo', 'REF-3E3060E7E7', '{"source": "seed", "table": "ussd_banking_gateway"}'::jsonb, '2026-04-23 14:04:12', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── ussd_multilingual ───
INSERT INTO "ussd_multilingual" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-d0b549a18dfe', 'Uzo Elumelu', 'lending', 'Uzo Elumelu - Port Harcourt - Ussd Multilingual', 'active', 7908943.43, 'Oyo', 'REF-FBA4CBFEC3', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2026-02-04 04:50:31', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-229479b63a3c', 'Patience Peterside', 'operations', 'Patience Peterside - Garki - Ussd Multilingual', 'pending', 8944515.46, 'Rivers', 'REF-22214B2415', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-09-08 21:42:59', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-6ba8dcfabc2a', 'Damilola Peterside', 'finance', 'Damilola Peterside - Abeokuta - Ussd Multilingual', 'active', 331626.13, 'Anambra', 'REF-317DA1DF7F', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-05-02 12:13:28', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-26fd4d6069c5', 'Femi Jimoh', 'finance', 'Femi Jimoh - Port Harcourt - Ussd Multilingual', 'pending', 8689359.6, 'Lagos', 'REF-0AF50F30A0', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2026-04-16 15:13:37', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-f37ca27a9098', 'Gbenga Lawal', 'operations', 'Gbenga Lawal - Ikeja - Ussd Multilingual', 'processing', 7665621.73, 'Imo', 'REF-76396235DD', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-02-01 23:36:09', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-750c04928902', 'Adaeze Sanusi', 'operations', 'Adaeze Sanusi - Wuse - Ussd Multilingual', 'pending', 2057239.77, 'Abuja FCT', 'REF-30BEB8C029', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-04-29 22:34:39', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-389e5a1bff39', 'Maryam Danladi', 'risk', 'Maryam Danladi - Lekki - Ussd Multilingual', 'completed', 9053317.05, 'Imo', 'REF-FDF78175AB', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-09-15 08:14:01', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-bf3c721d698a', 'Jide Hassan', 'finance', 'Jide Hassan - Awka - Ussd Multilingual', 'pending', 4210464.26, 'Akwa Ibom', 'REF-DF796CC426', '{"source": "seed", "table": "ussd_multilingual"}'::jsonb, '2025-01-04 22:58:59', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── ussd_sim_toolkit ───
INSERT INTO "ussd_sim_toolkit" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-0830ca377ba8', 'Esther Eze', 'finance', 'Esther Eze - Lekki - Ussd Sim Toolkit', 'processing', 1877036.89, 'Oyo', 'REF-C72DC3F1A3', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2025-05-31 22:33:06', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-74689864314a', 'Olumide Mohammed', 'operations', 'Olumide Mohammed - Garki - Ussd Sim Toolkit', 'pending', 2407596.66, 'Delta', 'REF-D5F6E22142', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2025-06-20 19:42:06', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-069d0789cc9a', 'Emeka Dangote', 'finance', 'Emeka Dangote - Port Harcourt - Ussd Sim Toolkit', 'approved', 8386008.94, 'Ogun', 'REF-42D55B8349', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2025-03-23 23:51:10', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-2090d49ba2f8', 'Rasheed Adeyemi', 'lending', 'Rasheed Adeyemi - Enugu - Ussd Sim Toolkit', 'processing', 4859594.85, 'Abuja FCT', 'REF-9EF53B8356', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2025-11-07 10:56:23', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-db8425e7c625', 'Chukwuemeka Dangote', 'payments', 'Chukwuemeka Dangote - Enugu - Ussd Sim Toolkit', 'approved', 7593255.88, 'Osun', 'REF-FFF225051B', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2026-03-01 08:56:35', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c6b6a36cd7fc', 'Chidinma Nwosu', 'operations', 'Chidinma Nwosu - Ibadan - Ussd Sim Toolkit', 'active', 6765713.35, 'Enugu', 'REF-65A4AD19AF', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2025-05-11 11:58:28', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-8c80d1cac990', 'Kemi Elumelu', 'compliance', 'Kemi Elumelu - Zaria - Ussd Sim Toolkit', 'approved', 1083532.31, 'Borno', 'REF-16D0DFB0C5', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2026-03-17 08:38:44', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-98095274db7c', 'Kunle Adenuga', 'lending', 'Kunle Adenuga - Garki - Ussd Sim Toolkit', 'pending', 2189424.99, 'Enugu', 'REF-80E0DA7A9B', '{"source": "seed", "table": "ussd_sim_toolkit"}'::jsonb, '2026-04-01 07:08:42', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── ussd_transaction_engine ───
INSERT INTO "ussd_transaction_engine" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-f5692e28c0e7', 'Damilola Nwosu', 'finance', 'Damilola Nwosu - Abeokuta - Ussd Transaction Engine', 'processing', 8142433.62, 'Plateau', 'REF-1ACDA08090', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2026-03-17 08:15:32', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-b395711764a6', 'Dorcas Adenuga', 'lending', 'Dorcas Adenuga - Kano - Ussd Transaction Engine', 'pending', 4966951.79, 'Lagos', 'REF-F3856ADB82', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-04-03 17:05:47', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-9cc69d62e263', 'Grace Danladi', 'payments', 'Grace Danladi - Ikeja - Ussd Transaction Engine', 'approved', 4100188.43, 'Lagos', 'REF-EA2524D44C', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-10-12 18:44:54', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-efdbdc54549e', 'Rasheed Jimoh', 'risk', 'Rasheed Jimoh - Kano - Ussd Transaction Engine', 'pending', 3836067.09, 'Cross River', 'REF-FDB9C306D2', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-09-01 09:32:14', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-38e05d6bcda0', 'Fatima Lawal', 'lending', 'Fatima Lawal - Benin City - Ussd Transaction Engine', 'pending', 6411815.25, 'Edo', 'REF-8E5C8B3249', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2026-04-28 12:33:03', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-c8caa702bcde', 'Jumoke Dangote', 'payments', 'Jumoke Dangote - Victoria Island - Ussd Transaction Engine', 'pending', 6895983.53, 'Ogun', 'REF-57CBA5EE97', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-09-07 16:55:04', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-09dbdac0c5a5', 'Jide Sanusi', 'lending', 'Jide Sanusi - Enugu - Ussd Transaction Engine', 'approved', 9154868.54, 'Rivers', 'REF-C7BFB6E3CA', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-12-16 01:17:03', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-53ff247ad483', 'Rahma Nwosu', 'operations', 'Rahma Nwosu - Kano - Ussd Transaction Engine', 'processing', 1182167.18, 'Akwa Ibom', 'REF-10B6251A6F', '{"source": "seed", "table": "ussd_transaction_engine"}'::jsonb, '2025-01-09 19:02:58', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── valueChainContracts ───
INSERT INTO "valueChainContracts" ("contractId", "tenantId", "contractType", "buyerName", "buyerId", "sellerFarmerId", "commodity", "quantityTonnes", "pricePerTonne", "totalValue", "currency", "deliveryLocation", "deliveryDeadline", "warehouseReceiptId", "qualityGrade", "milestones", "status", "createdAt", "updatedAt") VALUES
  ('CONT-e233feefed68', 'tenant-kano-north', 'premium', 'VALUEC-dd07c2af28e7', 'BUYE-e45cf53a8ff9', 'SELL-f417a9500ddd', 'VALUEC-21e369f67710', 4459386.93, 5311535.73, 8527056.59, 'USD', 'VALUEC-69ab7e23fcda', 'VALUEC-e0554c061dd7', 'WARE-6f2d717fe346', 'VALUEC-0e79e5fda87d', '{"data": "seed"}'::jsonb, 'approved', '2025-03-26 00:57:14', '2026-03-11 02:23:09'),
  ('CONT-606d1ad84b87', 'tenant-abuja-digital', 'full', 'VALUEC-eae1ee8f382d', 'BUYE-6bd756c96d6d', 'SELL-e9af4645ff6e', 'VALUEC-23fd3672e0c9', 7085699.69, 4651991.46, 7491224.63, 'USD', 'VALUEC-5999fab693e8', 'VALUEC-d65123f2ec07', 'WARE-9622237b801c', 'VALUEC-25c57e21d2dd', '{"data": "seed"}'::jsonb, 'completed', '2026-04-07 21:22:56', '2025-09-10 06:33:53'),
  ('CONT-859c46a276d2', 'tenant-kano-north', 'basic', 'VALUEC-799ae2f58e2b', 'BUYE-7a53d25f18a0', 'SELL-809b68e362f4', 'VALUEC-d4aef5903c9c', 556758.93, 4897060.52, 4016782.73, 'NGN', 'VALUEC-fb100ea6e40b', 'VALUEC-765216354c12', 'WARE-79744a2280dc', 'VALUEC-3608e88c7262', '{"data": "seed"}'::jsonb, 'completed', '2026-02-22 06:05:53', '2026-03-11 22:51:24'),
  ('CONT-8361ae7302a5', 'tenant-kano-north', 'premium', 'VALUEC-d42c7b157750', 'BUYE-96b2c03bf5f6', 'SELL-81222561f540', 'VALUEC-7b8b91c33bb6', 5581079.7, 6224882.54, 9999574.64, 'NGN', 'VALUEC-308c6e1326cd', 'VALUEC-507253a91eed', 'WARE-de0b98795fc6', 'VALUEC-fb82ec06cedd', '{"data": "seed"}'::jsonb, 'completed', '2025-03-26 11:30:53', '2026-04-30 04:13:32'),
  ('CONT-8408422d3217', 'tenant-abuja-digital', 'standard', 'VALUEC-28ad61cda8ec', 'BUYE-2965ca9901c3', 'SELL-87da74f675a3', 'VALUEC-a353f10dcb9a', 993331.23, 5875882.02, 3892993.8, 'NGN', 'VALUEC-2b26a1d6170f', 'VALUEC-f33e44ec21b0', 'WARE-5a2cf21c0499', 'VALUEC-d27f6ace930b', '{"data": "seed"}'::jsonb, 'processing', '2025-07-30 11:46:06', '2026-01-26 04:43:15'),
  ('CONT-fde1fe04bc8a', 'tenant-lagos-main', 'premium', 'VALUEC-a1646e66eae1', 'BUYE-04a7a2d59e7d', 'SELL-5bf1178a4cdd', 'VALUEC-f8647f32042f', 441339.62, 5539270.98, 2677303.1, 'GBP', 'VALUEC-39c9456d32d7', 'VALUEC-e89f460a5a2e', 'WARE-e28a7cab76be', 'VALUEC-b2709e161554', '{"data": "seed"}'::jsonb, 'processing', '2025-06-06 20:39:16', '2025-09-03 17:51:12'),
  ('CONT-28ef6cf264e3', 'tenant-lagos-main', 'standard', 'VALUEC-36e1b0ebcf48', 'BUYE-bdd3b584e865', 'SELL-b52075b9e47e', 'VALUEC-9f37d57e54d1', 2034283.53, 2298793.85, 7089503.4, 'USD', 'VALUEC-5d8a5fc741f6', 'VALUEC-6297d99e0fb1', 'WARE-edfa4bf62cee', 'VALUEC-939b09b966de', '{"data": "seed"}'::jsonb, 'active', '2025-01-16 23:40:40', '2026-04-23 03:18:29'),
  ('CONT-ebd1aacc7734', 'tenant-whitelabel-zenith', 'full', 'VALUEC-b219d779aeac', 'BUYE-91710d300b05', 'SELL-23ca8f9e582a', 'VALUEC-57b6dcfe3937', 3057074.31, 9661927.84, 5706745.77, 'EUR', 'VALUEC-4bcc2950bae6', 'VALUEC-d2d7626e3c8a', 'WARE-c61898229cb0', 'VALUEC-404e57f47868', '{"data": "seed"}'::jsonb, 'processing', '2025-07-19 05:49:21', '2025-04-08 03:03:52')
ON CONFLICT DO NOTHING;


-- ─── vaultOperations ───
INSERT INTO "vaultOperations" ("operationId", "tenantId", "operationType", "fromLocation", "toLocation", "amount", "currency", "authorizedBy", "dualControlBy", "status", "reason", "createdAt") VALUES
  ('OPER-2869c95a820b', 'tenant-lagos-main', 'full', 'VAULTO-cc9f37f75485', 'VAULTO-320ea019c94c', 47811689.62, 'USD', 'VAULTO-6c6acb66e68c', 'VAULTO-0aca6387c81c', 'completed', 'VAULTO-f0bc4d33258b', '2025-05-28 23:41:01'),
  ('OPER-885024c4b417', 'tenant-lagos-main', 'full', 'VAULTO-cfc6a40bf3e4', 'VAULTO-c9658f0321cb', 4358738.08, 'USD', 'VAULTO-5c1c531ca7f4', 'VAULTO-65f377391b06', 'pending', 'VAULTO-c75977a501a5', '2026-01-12 04:51:39'),
  ('OPER-73fcd258040e', 'tenant-kano-north', 'basic', 'VAULTO-08bc0bdd7e14', 'VAULTO-1d57a8b11935', 33849472.84, 'EUR', 'VAULTO-3da67955adcd', 'VAULTO-f39a3f9963cb', 'active', 'VAULTO-5cd8b2632b9f', '2025-03-09 04:00:27'),
  ('OPER-a6e26565f4e0', 'tenant-kano-north', 'full', 'VAULTO-9d8f9e1300f3', 'VAULTO-fa2a941bfcb3', 14965572.51, 'EUR', 'VAULTO-83b7e6823abd', 'VAULTO-82cdf0101af8', 'active', 'VAULTO-4cd37c495a02', '2025-05-24 13:07:49'),
  ('OPER-3c0a8af2de96', 'tenant-kano-north', 'enhanced', 'VAULTO-9daf2b807904', 'VAULTO-b211c6435f5b', 30953407.75, 'EUR', 'VAULTO-cb563d83bc50', 'VAULTO-95144f965473', 'active', 'VAULTO-144597ce9d88', '2025-09-20 18:55:14'),
  ('OPER-cfdc6b657ad1', 'tenant-whitelabel-zenith', 'enhanced', 'VAULTO-e76039fb6b86', 'VAULTO-3d104243734f', 22415297.22, 'GBP', 'VAULTO-270216edc1e9', 'VAULTO-b4e5c05253ba', 'approved', 'VAULTO-1d639b5eacff', '2025-10-23 01:59:25'),
  ('OPER-f3972e960ae7', 'tenant-portharcourt', 'standard', 'VAULTO-732cd735ca39', 'VAULTO-c23d6e2d783b', 9037842.27, 'EUR', 'VAULTO-4554f06e8de1', 'VAULTO-37058b8bd25e', 'approved', 'VAULTO-72203806cd8f', '2025-04-14 10:01:51'),
  ('OPER-c4903a429576', 'tenant-abuja-digital', 'standard', 'VAULTO-94651df4fb6c', 'VAULTO-b89121f754a0', 25588753.68, 'NGN', 'VAULTO-8565156c909b', 'VAULTO-0d247cf5bd8f', 'processing', 'VAULTO-c7c8086403f1', '2025-11-03 14:06:09')
ON CONFLICT DO NOTHING;


-- ─── vault_engines ───
INSERT INTO "vault_engines" ("path", "engineType", "description", "leases", "maxTTL", "defaultTTL", "rotationsCompleted", "status", "createdAt") VALUES
  ('VAULT_-0463084748f9', 'premium', 'Babajide Hassan - Awka, Imo - vault_engines record', 604, 'VAULT_-ff912e198fe2', 'VAULT_-5d0046639cad', 915, 'completed', '2025-09-18 07:53:42'),
  ('VAULT_-a58816c7e0f1', 'enhanced', 'Babajide Dangote - Victoria Island, Rivers - vault_engines record', 136, 'VAULT_-c576da987034', 'VAULT_-e49114f3fb04', 908, 'completed', '2025-07-02 03:28:31'),
  ('VAULT_-cb3b29abdf8c', 'basic', 'Grace Nwosu - Warri, Ogun - vault_engines record', 440, 'VAULT_-86696cfab158', 'VAULT_-81c83c945a6e', 439, 'approved', '2025-04-10 23:18:17'),
  ('VAULT_-8ec34957d790', 'full', 'Uche Adeyemi - Enugu, Kano - vault_engines record', 474, 'VAULT_-37a634fd90dc', 'VAULT_-75e803def330', 338, 'active', '2026-01-16 05:40:27'),
  ('VAULT_-316f1383c544', 'full', 'Uche Yakubu - Lekki, Rivers - vault_engines record', 571, 'VAULT_-3cd3cd8b063e', 'VAULT_-18cae7435876', 327, 'pending', '2026-01-12 03:38:37'),
  ('VAULT_-f85222fbf990', 'full', 'Jumoke Jimoh - Wuse, Akwa Ibom - vault_engines record', 949, 'VAULT_-731c039d10de', 'VAULT_-aedecae7c7c3', 172, 'approved', '2025-06-14 14:16:27'),
  ('VAULT_-8ba1567108e9', 'standard', 'Ifeoma Balogun - Asaba, Akwa Ibom - vault_engines record', 495, 'VAULT_-a7898037352c', 'VAULT_-02829ed4ee11', 825, 'pending', '2025-09-17 18:06:17'),
  ('VAULT_-7efc858f6dc6', 'premium', 'Kunle Sanusi - Maitama, Akwa Ibom - vault_engines record', 395, 'VAULT_-7d9863a225c9', 'VAULT_-4e1fb8b49afe', 699, 'completed', '2025-07-14 03:54:31')
ON CONFLICT DO NOTHING;


-- ─── vault_secrets ───
INSERT INTO "vault_secrets" ("path", "engine", "version", "rotationDays", "lastRotated", "nextRotation", "status", "createdAt") VALUES
  ('VAULT_-eda6c698e33e', 'VAULT_-0b2b24954461', 4, 254, '2026-03-23 15:59:37', '2025-02-25 15:40:00', 'approved', '2026-05-04 04:18:21'),
  ('VAULT_-ca4ad58f4203', 'VAULT_-7f0a9c0be2d9', 7, 204, '2026-03-09 22:01:00', '2025-08-11 11:20:13', 'processing', '2025-07-05 06:03:55'),
  ('VAULT_-fb6513192b1e', 'VAULT_-bf37ce493579', 4, 166, '2025-05-01 06:36:48', '2026-03-25 21:40:15', 'completed', '2025-06-28 15:11:58'),
  ('VAULT_-81bb44358142', 'VAULT_-21e91fe487b5', 9, 60, '2026-03-11 06:22:10', '2025-10-27 01:55:21', 'approved', '2025-08-05 11:16:41'),
  ('VAULT_-7b88d4faf130', 'VAULT_-6373761a7ccf', 6, 169, '2025-05-19 15:07:44', '2025-03-07 06:20:20', 'active', '2026-04-13 21:58:58'),
  ('VAULT_-607e8ffec7f0', 'VAULT_-d689f546d333', 5, 326, '2025-07-28 01:14:32', '2025-05-11 15:09:30', 'active', '2026-02-13 21:27:50'),
  ('VAULT_-3eafb4e849fb', 'VAULT_-a4a1554ca6f2', 9, 118, '2025-08-29 14:08:33', '2025-12-05 15:46:58', 'processing', '2026-04-11 05:39:39'),
  ('VAULT_-7f576f00df10', 'VAULT_-3252f6542668', 9, 218, '2025-05-03 12:11:44', '2025-04-29 20:31:34', 'processing', '2025-04-22 14:41:18')
ON CONFLICT DO NOTHING;


-- ─── virtualAccounts ───
INSERT INTO "virtualAccounts" ("accountId", "tenantId", "van", "parentAccountId", "ownerId", "ownerName", "ownerType", "purpose", "currency", "balance", "availableBalance", "holdAmount", "dailyLimit", "monthlyLimit", "status", "expiryDate", "createdAt", "updatedAt") VALUES
  ('ACCT-ed5896164626', 'tenant-abuja-digital', 'VIRTUA-6a58c4fe071f', 'PARE-dcfbd1a42eef', 'OWNE-baadc0ee4a27', 'VIRTUA-03d81d2e35da', 'premium', 'VIRTUA-f5b6ad7b22b0', 'EUR', 1011771.81, 6242351.09, 6555439.26, 7293630.46, 6825862.88, 'pending', '2026-02-23 18:29:08', '2026-02-27 07:02:02', '2025-12-08 02:53:44'),
  ('ACCT-44438ac2f8fd', 'tenant-abuja-digital', 'VIRTUA-43ff17303a11', 'PARE-0782b6e232a0', 'OWNE-1d0aa765df14', 'VIRTUA-af65558d5f2f', 'enhanced', 'VIRTUA-485e89d252f5', 'NGN', 8951662.03, 3018064.72, 5839259.7, 3441420.04, 4797766.03, 'active', '2026-02-26 21:57:42', '2025-06-27 21:09:34', '2025-11-19 16:01:00'),
  ('ACCT-6dcb0f04a60f', 'tenant-lagos-main', 'VIRTUA-c3d635df3486', 'PARE-91f20a01b2a6', 'OWNE-a6af8421bb1c', 'VIRTUA-d5ac7662ee7c', 'basic', 'VIRTUA-581c286d1c59', 'GBP', 3658691.32, 9119634.94, 4809508.83, 1920502.91, 7375982.64, 'processing', '2025-07-26 14:00:39', '2026-04-15 10:48:59', '2025-04-03 04:38:01'),
  ('ACCT-bbc877545f48', 'tenant-kano-north', 'VIRTUA-2e7496ceff9c', 'PARE-6ca367b27771', 'OWNE-4a2bbfcbacc1', 'VIRTUA-a4f88a871f5d', 'standard', 'VIRTUA-b286d7e91cc4', 'NGN', 2160894.91, 8937548.05, 5260815.79, 5832637.81, 7160664.72, 'pending', '2025-01-07 13:33:51', '2025-11-16 01:34:57', '2025-10-01 13:44:03'),
  ('ACCT-b63cea06cdd9', 'tenant-portharcourt', 'VIRTUA-d6bddf73a350', 'PARE-ac39ba40f360', 'OWNE-17c3482fb13c', 'VIRTUA-815d7e4083e7', 'premium', 'VIRTUA-9f6c99d623ab', 'NGN', 11004949.42, 940789.46, 1749585.28, 2594560.78, 1909447.47, 'completed', '2025-02-18 21:55:38', '2026-01-25 20:53:52', '2025-08-08 12:28:16'),
  ('ACCT-9dea5c1c0003', 'tenant-kano-north', 'VIRTUA-c99737f699a9', 'PARE-a9f24d9627c3', 'OWNE-f7a52dde1edd', 'VIRTUA-1182a11e8807', 'enhanced', 'VIRTUA-65ea77009301', 'USD', 10829548.89, 7430687.1, 8438872.04, 6919289.82, 8496871.37, 'approved', '2025-05-04 11:05:30', '2025-10-18 04:34:49', '2025-05-04 13:19:21'),
  ('ACCT-6855c10fd9b6', 'tenant-portharcourt', 'VIRTUA-16e1aa3554bd', 'PARE-5189df0061f7', 'OWNE-0c6fe526ce30', 'VIRTUA-878c3ae9eded', 'premium', 'VIRTUA-1ce399b5d84e', 'NGN', 22822216.08, 7156235.47, 4816920.17, 9224811.06, 3812482.18, 'completed', '2025-05-15 19:43:06', '2025-04-19 01:30:59', '2025-07-10 13:29:08'),
  ('ACCT-3748af3859d2', 'tenant-abuja-digital', 'VIRTUA-9f1b740d7768', 'PARE-e245e2c615d1', 'OWNE-b8f33b235de2', 'VIRTUA-83031dcf5bb1', 'standard', 'VIRTUA-f21c4d0da9fb', 'NGN', 12783411.31, 220537.95, 3491971.62, 3716219.79, 3302052.31, 'active', '2025-07-16 02:52:00', '2025-07-11 10:17:08', '2026-02-11 12:20:48')
ON CONFLICT DO NOTHING;


-- ─── virtual_cards ───
INSERT INTO "virtual_cards" ("tenantId", "customerId", "cardType", "cardScheme", "maskedPan", "expiryDate", "currency", "isFrozen", "status", "createdAt") VALUES
  ('tenant-abuja-digital', 'CUST-7851b8a111c5', 'basic', 'VIRTUA-fb4974e08fa2', 'VIRTUA-c86c8ad477fc', 'VIRTUA-8089394ed30d', 'NGN', false, 'completed', '2025-12-17 12:32:36'),
  ('tenant-whitelabel-zenith', 'CUST-b0dda9b684bc', 'full', 'VIRTUA-b21d6dd2d67a', 'VIRTUA-2e1859fcf8c5', 'VIRTUA-c60e8c265326', 'NGN', true, 'completed', '2025-01-14 04:24:33'),
  ('tenant-whitelabel-zenith', 'CUST-b6c30af8dee2', 'standard', 'VIRTUA-a4e5e646dc6c', 'VIRTUA-9b8c58808f78', 'VIRTUA-b8ddc8186efd', 'NGN', true, 'active', '2026-04-12 09:45:30'),
  ('tenant-kano-north', 'CUST-8719d7b64d6a', 'enhanced', 'VIRTUA-2995b2fffb0e', 'VIRTUA-e6e0f6606b68', 'VIRTUA-f1c60e6cc26c', 'NGN', true, 'processing', '2026-02-05 10:08:05'),
  ('tenant-lagos-main', 'CUST-3a9ef8307fd4', 'full', 'VIRTUA-6744746c7bfc', 'VIRTUA-b76b32d8e3d8', 'VIRTUA-d1900ba93885', 'NGN', true, 'active', '2025-07-30 10:34:57'),
  ('tenant-lagos-main', 'CUST-d9a39ef3eca8', 'premium', 'VIRTUA-9238ad9a2124', 'VIRTUA-7a12c3864d98', 'VIRTUA-7f4c7b48ea98', 'GBP', false, 'approved', '2026-02-13 05:32:06'),
  ('tenant-lagos-main', 'CUST-60a25efbaeda', 'enhanced', 'VIRTUA-35be92cf262d', 'VIRTUA-aa1a3baeba60', 'VIRTUA-3a1c0d6b73d3', 'GBP', false, 'pending', '2025-02-18 06:10:46'),
  ('tenant-kano-north', 'CUST-6ff2ddb7b7e4', 'basic', 'VIRTUA-54c01322b1bc', 'VIRTUA-9e9461a8362e', 'VIRTUA-6fa6c0562de2', 'GBP', true, 'approved', '2026-02-19 09:56:23')
ON CONFLICT DO NOTHING;


-- ─── virtual_scroll_configs ───
INSERT INTO "virtual_scroll_configs" ("tableName", "viewportRows", "scrollFps", "status", "createdAt") VALUES
  ('VIRTUA-a4bccfcb9165', 5053, 361, 'pending', '2025-06-10 23:30:54'),
  ('VIRTUA-073bbbad1f08', 8355, 877, 'approved', '2026-04-15 10:34:48'),
  ('VIRTUA-3582099a49f1', 4568, 120, 'pending', '2025-09-16 17:38:59'),
  ('VIRTUA-c91bf3d32235', 3633, 617, 'active', '2025-07-02 20:12:42'),
  ('VIRTUA-8c1f7256ccd3', 8480, 651, 'active', '2025-06-30 14:55:53'),
  ('VIRTUA-796193eaef9b', 9751, 23, 'active', '2025-11-12 00:35:36'),
  ('VIRTUA-c4c092d7fb67', 4424, 925, 'pending', '2025-06-06 01:09:02'),
  ('VIRTUA-ff62174287da', 6952, 296, 'pending', '2025-03-25 08:53:27')
ON CONFLICT DO NOTHING;


-- ─── voice_agent_escalation ───
INSERT INTO "voice_agent_escalation" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-30d9307ceecd', 'Gbenga Danladi', 'payments', 'Gbenga Danladi - Awka - Voice Agent Escalation', 'approved', 1991990.75, 'Osun', 'REF-9B93622F2D', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-05-22 12:27:58', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-3c944d505535', 'Babajide Garba', 'operations', 'Babajide Garba - Victoria Island - Voice Agent Escalation', 'pending', 7180857.22, 'Delta', 'REF-57DC083E56', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-10-31 23:41:08', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-d1d73256ca28', 'Uzo Garba', 'risk', 'Uzo Garba - Ibadan - Voice Agent Escalation', 'pending', 819924.57, 'Rivers', 'REF-7149300E10', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-11-11 07:55:36', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-6fca3097efc1', 'Rahma Peterside', 'risk', 'Rahma Peterside - Maitama - Voice Agent Escalation', 'pending', 4661740.25, 'Plateau', 'REF-3A6635214B', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-10-24 08:47:06', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-15ba23f1ffd5', 'Grace Jimoh', 'finance', 'Grace Jimoh - Asaba - Voice Agent Escalation', 'completed', 725414.57, 'Ogun', 'REF-B0242E20B8', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-06-18 17:17:40', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-e28e1ac59d28', 'Uche Dangote', 'payments', 'Uche Dangote - Port Harcourt - Voice Agent Escalation', 'processing', 6119697.22, 'Edo', 'REF-261B80C319', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2026-03-23 10:45:16', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-af4e7c2f7b72', 'Damilola Kalu', 'payments', 'Damilola Kalu - Garki - Voice Agent Escalation', 'processing', 2346450.94, 'Oyo', 'REF-A04AF62DBB', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2026-02-10 06:50:45', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-152238e152a3', 'Grace Chukwu', 'finance', 'Grace Chukwu - Ibadan - Voice Agent Escalation', 'pending', 7154935.02, 'Kwara', 'REF-23B99A0718', '{"source": "seed", "table": "voice_agent_escalation"}'::jsonb, '2025-03-23 00:44:05', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_asr_nigerian ───
INSERT INTO "voice_asr_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-1e14d298669e', 'Jumoke Okafor', 'risk', 'Jumoke Okafor - Port Harcourt - Voice Asr Nigerian', 'pending', 8240867.29, 'Oyo', 'REF-7BE8B3800F', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-10-10 12:29:31', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-ec93bf04176f', 'Gbenga Yakubu', 'compliance', 'Gbenga Yakubu - Lekki - Voice Asr Nigerian', 'approved', 7361517.39, 'Akwa Ibom', 'REF-EA48689C33', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2026-01-01 00:23:32', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-ae6053c446d6', 'Dorcas Garba', 'finance', 'Dorcas Garba - Victoria Island - Voice Asr Nigerian', 'pending', 7879994.59, 'Lagos', 'REF-805088F1DC', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-02-23 02:58:04', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-68de1c3cb3a5', 'Kemi Balogun', 'finance', 'Kemi Balogun - Abeokuta - Voice Asr Nigerian', 'approved', 4176493.34, 'Borno', 'REF-DFF432FB4C', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-03-28 05:37:37', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-881b6531b9f5', 'Esther Lawal', 'risk', 'Esther Lawal - Ikeja - Voice Asr Nigerian', 'approved', 9813026.12, 'Edo', 'REF-0F6616FEE8', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-04-27 19:45:24', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-9e34e08fe456', 'Ibrahim Usman', 'risk', 'Ibrahim Usman - Victoria Island - Voice Asr Nigerian', 'active', 5396216.21, 'Osun', 'REF-6D389F69D9', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-10-20 15:24:33', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-4910f29534ba', 'Musa Kalu', 'operations', 'Musa Kalu - Asaba - Voice Asr Nigerian', 'pending', 6544657.01, 'Imo', 'REF-2941DCB673', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2025-08-28 05:12:29', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-59a9b3a1cd5c', 'Pelumi Elumelu', 'technology', 'Pelumi Elumelu - Abeokuta - Voice Asr Nigerian', 'processing', 5869925.8, 'Lagos', 'REF-347685F06B', '{"source": "seed", "table": "voice_asr_nigerian"}'::jsonb, '2026-01-07 23:58:34', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_banking_gateway ───
INSERT INTO "voice_banking_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-lagos-main', 'REC-dcd171d22224', 'Oluchi Lawal', 'risk', 'Oluchi Lawal - Lekki - Voice Banking Gateway', 'active', 7619764.03, 'Lagos', 'REF-5DE766C25D', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-03-07 23:32:08', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-ed884cff2e79', 'Patience Sanusi', 'payments', 'Patience Sanusi - Zaria - Voice Banking Gateway', 'completed', 7890507.76, 'Kwara', 'REF-F8548517C3', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-09-16 15:31:21', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-c082090eda79', 'Maryam Balogun', 'lending', 'Maryam Balogun - Enugu - Voice Banking Gateway', 'processing', 1458483.06, 'Oyo', 'REF-340E3B29AB', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-06-16 07:03:54', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-af0474a9f252', 'Ifeoma Mohammed', 'lending', 'Ifeoma Mohammed - Ikeja - Voice Banking Gateway', 'processing', 3434526.47, 'Osun', 'REF-A09B426B34', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-04-28 21:10:21', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-574c40bc48a3', 'Patience Lawal', 'payments', 'Patience Lawal - Warri - Voice Banking Gateway', 'processing', 2752280.37, 'Edo', 'REF-AF7BD82969', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-12-07 10:55:44', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-de550b4118bb', 'Dorcas Okafor', 'operations', 'Dorcas Okafor - Zaria - Voice Banking Gateway', 'active', 6972405.93, 'Edo', 'REF-3201585EC6', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-08-01 00:06:58', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-3809bded1b96', 'Grace Sanusi', 'technology', 'Grace Sanusi - Asaba - Voice Banking Gateway', 'completed', 9035057.55, 'Edo', 'REF-2F9F087CA4', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-02-27 23:33:25', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7aee319f300a', 'Damilola Elumelu', 'compliance', 'Damilola Elumelu - Asaba - Voice Banking Gateway', 'approved', 9196463.49, 'Kwara', 'REF-695453A193', '{"source": "seed", "table": "voice_banking_gateway"}'::jsonb, '2025-08-16 18:48:25', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_biometric_auth ───
INSERT INTO "voice_biometric_auth" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-3d576d89b08a', 'Rahma Hassan', 'lending', 'Rahma Hassan - Kano - Voice Biometric Auth', 'processing', 6954170.74, 'Rivers', 'REF-2E3D2F814B', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2026-04-08 03:05:18', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-d432596bba0a', 'Hassan Usman', 'risk', 'Hassan Usman - Ibadan - Voice Biometric Auth', 'processing', 4032840.82, 'Kano', 'REF-D4D67C7EA3', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2025-03-06 04:36:22', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-67e1df609746', 'Jumoke Usman', 'payments', 'Jumoke Usman - Kano - Voice Biometric Auth', 'pending', 7242338.76, 'Cross River', 'REF-E854106D86', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2025-03-04 15:39:24', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-c14486754df4', 'Lanre Okafor', 'compliance', 'Lanre Okafor - Maitama - Voice Biometric Auth', 'approved', 5485051.84, 'Kaduna', 'REF-00265BB431', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2025-01-09 07:15:37', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-9e14f9fcb0b0', 'Tunde Dangote', 'risk', 'Tunde Dangote - Ikeja - Voice Biometric Auth', 'processing', 2510033.72, 'Kano', 'REF-187E70DB96', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2026-02-09 07:58:32', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-c3f464914cb9', 'Rasheed Okafor', 'operations', 'Rasheed Okafor - Lekki - Voice Biometric Auth', 'processing', 8536505.4, 'Lagos', 'REF-96DF255829', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2026-03-25 22:59:14', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-3524e96c8e83', 'Patience Otedola', 'finance', 'Patience Otedola - Ikeja - Voice Biometric Auth', 'active', 2275126.12, 'Akwa Ibom', 'REF-4B4EE9B3BF', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2025-02-16 06:50:23', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-8ff4f480da9e', 'Oluchi Eze', 'finance', 'Oluchi Eze - Warri - Voice Biometric Auth', 'completed', 3647965.78, 'Osun', 'REF-96B7C46F1D', '{"source": "seed", "table": "voice_biometric_auth"}'::jsonb, '2025-04-26 05:24:29', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_call_analytics ───
INSERT INTO "voice_call_analytics" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-9eb3017cde34', 'Fatima Dangote', 'lending', 'Fatima Dangote - Zaria - Voice Call Analytics', 'approved', 7747034.54, 'Cross River', 'REF-15EC50AF85', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-09-14 19:23:19', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-b9d12b828f82', 'Grace Sanusi', 'technology', 'Grace Sanusi - Benin City - Voice Call Analytics', 'completed', 6606951.01, 'Lagos', 'REF-88B07043C6', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2026-01-11 21:42:39', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-e35b9201d57a', 'Babajide Jimoh', 'finance', 'Babajide Jimoh - Zaria - Voice Call Analytics', 'completed', 7131561.5, 'Cross River', 'REF-49BA92C7D8', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-06-04 06:01:32', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-b35a8d2dfe86', 'Kunle Kalu', 'finance', 'Kunle Kalu - Awka - Voice Call Analytics', 'approved', 7157972.68, 'Osun', 'REF-97EB43626D', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-01-24 03:44:10', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-883be15a7c3e', 'Hassan Peterside', 'compliance', 'Hassan Peterside - Garki - Voice Call Analytics', 'processing', 7434551.61, 'Borno', 'REF-66F53439A0', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-02-09 21:22:34', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-69bf921681c3', 'Damilola Fashola', 'finance', 'Damilola Fashola - Zaria - Voice Call Analytics', 'approved', 2178011.68, 'Edo', 'REF-AB6021D1E9', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-12-03 05:46:13', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-b1d4219be8c3', 'Adewale Adenuga', 'finance', 'Adewale Adenuga - Ikeja - Voice Call Analytics', 'active', 5502718.44, 'Anambra', 'REF-0B514F625C', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-07-23 17:01:16', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f253baceecf4', 'Fatima Hassan', 'risk', 'Fatima Hassan - Kano - Voice Call Analytics', 'pending', 7760379.16, 'Kano', 'REF-CC986F3A95', '{"source": "seed", "table": "voice_call_analytics"}'::jsonb, '2025-05-31 20:34:08', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_ivr_menu ───
INSERT INTO "voice_ivr_menu" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-4ddc104529fa', 'Chidinma Kalu', 'payments', 'Chidinma Kalu - Ikeja - Voice Ivr Menu', 'approved', 2458256.28, 'Osun', 'REF-68503E47DB', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-05-31 03:37:00', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-3ef0dc9b2cef', 'Tunde Balogun', 'finance', 'Tunde Balogun - Port Harcourt - Voice Ivr Menu', 'completed', 3397259.85, 'Plateau', 'REF-D1060B54F2', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-06-16 18:19:25', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-bef336b06dcc', 'Jide Igwe', 'operations', 'Jide Igwe - Maitama - Voice Ivr Menu', 'pending', 6836722.32, 'Abuja FCT', 'REF-A85CC1DE3D', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-06-28 23:45:26', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-78e950c4032f', 'Lilian Kalu', 'lending', 'Lilian Kalu - Port Harcourt - Voice Ivr Menu', 'active', 897293.93, 'Imo', 'REF-F80DE1CE37', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-03-12 12:48:35', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-5146ddc0ede4', 'Emeka Adeyemi', 'technology', 'Emeka Adeyemi - Benin City - Voice Ivr Menu', 'active', 3005683.24, 'Plateau', 'REF-1A2EDAEB20', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-02-06 13:27:54', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-df3dd0eb4893', 'Nneka Usman', 'technology', 'Nneka Usman - Benin City - Voice Ivr Menu', 'active', 9393059.41, 'Edo', 'REF-048F5D0297', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-09-02 02:38:50', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-e1eb10675e9e', 'Hassan Jimoh', 'risk', 'Hassan Jimoh - Asaba - Voice Ivr Menu', 'completed', 2989669.57, 'Lagos', 'REF-B0F64B9523', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-06-09 12:03:11', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-b1a2a7f0ece9', 'Bukola Okafor', 'operations', 'Bukola Okafor - Enugu - Voice Ivr Menu', 'pending', 3955784.5, 'Ogun', 'REF-88BF17D80C', '{"source": "seed", "table": "voice_ivr_menu"}'::jsonb, '2025-05-02 22:47:31', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_nlu_banking ───
INSERT INTO "voice_nlu_banking" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-abuja-digital', 'REC-6fd57cf58e32', 'Hassan Adeyemi', 'payments', 'Hassan Adeyemi - Benin City - Voice Nlu Banking', 'approved', 5169299.05, 'Kaduna', 'REF-F72A9C75A2', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-12-01 22:57:17', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-832d793ed15a', 'Chidinma Dangote', 'compliance', 'Chidinma Dangote - Garki - Voice Nlu Banking', 'processing', 1456751.38, 'Oyo', 'REF-6A0F077BEC', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-09-13 19:29:31', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-8518b8d8042b', 'Uzo Balogun', 'payments', 'Uzo Balogun - Warri - Voice Nlu Banking', 'approved', 4504934.12, 'Imo', 'REF-C0ECA7F2FF', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2026-01-21 07:38:17', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-aad8b1fdd8f4', 'Uzo Hassan', 'technology', 'Uzo Hassan - Awka - Voice Nlu Banking', 'approved', 8084434.8, 'Imo', 'REF-C510041AFC', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2026-02-09 16:34:57', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-454df3d4b35c', 'Emeka Balogun', 'payments', 'Emeka Balogun - Benin City - Voice Nlu Banking', 'active', 8054602.55, 'Plateau', 'REF-FCABC33522', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-05-22 01:07:21', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-9650071b5558', 'Lanre Sanusi', 'lending', 'Lanre Sanusi - Victoria Island - Voice Nlu Banking', 'pending', 765454.16, 'Rivers', 'REF-3F918E7CE7', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-07-15 02:54:42', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-67c398b5389d', 'Uche Fashola', 'payments', 'Uche Fashola - Port Harcourt - Voice Nlu Banking', 'approved', 9638662.12, 'Edo', 'REF-9E2F3695F3', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-06-01 03:36:15', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-3044349071fa', 'Lanre Sanusi', 'technology', 'Lanre Sanusi - Kano - Voice Nlu Banking', 'completed', 8483755.39, 'Delta', 'REF-434BE834C3', '{"source": "seed", "table": "voice_nlu_banking"}'::jsonb, '2025-02-27 04:25:10', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── voice_tts_nigerian ───
INSERT INTO "voice_tts_nigerian" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-9b53ddb2a38d', 'Jumoke Fashola', 'payments', 'Jumoke Fashola - Zaria - Voice Tts Nigerian', 'completed', 4071822.82, 'Abuja FCT', 'REF-E9BB86F1AF', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-06-19 00:49:25', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-48267eefc68f', 'Gbenga Lawal', 'risk', 'Gbenga Lawal - Garki - Voice Tts Nigerian', 'pending', 3512369.8, 'Osun', 'REF-8EDD5A6870', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-05-11 02:20:20', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-fda16839f0d0', 'Hauwa Balogun', 'lending', 'Hauwa Balogun - Abeokuta - Voice Tts Nigerian', 'processing', 5653950.59, 'Cross River', 'REF-29077F3F17', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-05-20 21:26:42', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-6ef5e29d4ae9', 'Fatima Mohammed', 'operations', 'Fatima Mohammed - Kano - Voice Tts Nigerian', 'approved', 1502361.93, 'Akwa Ibom', 'REF-D2B3DC84FD', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-05-05 16:31:21', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-d47ed8fad482', 'Adaeze Sanusi', 'payments', 'Adaeze Sanusi - Port Harcourt - Voice Tts Nigerian', 'processing', 6211459.8, 'Akwa Ibom', 'REF-50E81FA866', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-12-12 23:16:16', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-6f40de56d4e9', 'Dorcas Jimoh', 'risk', 'Dorcas Jimoh - Asaba - Voice Tts Nigerian', 'pending', 4022306.23, 'Delta', 'REF-28F863465F', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2026-01-17 06:44:01', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-345f51cffc94', 'Hassan Nwosu', 'compliance', 'Hassan Nwosu - Kano - Voice Tts Nigerian', 'completed', 6639237.55, 'Imo', 'REF-1D0CB08235', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-05-27 19:29:03', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-690d1404af3b', 'Uche Okafor', 'technology', 'Uche Okafor - Garki - Voice Tts Nigerian', 'active', 8669236.48, 'Anambra', 'REF-E607CE096F', '{"source": "seed", "table": "voice_tts_nigerian"}'::jsonb, '2025-11-01 22:40:56', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── waf_rules ───
INSERT INTO "waf_rules" ("ruleId", "name", "category", "severity", "paranoia", "matched24h", "blocked24h", "falsePositives", "status", "createdAt") VALUES
  ('RULE-21917b1870ad', 'Maryam Mohammed', 'operations', 'WAF_RU-54d933afc510', 336, 173, 556, 168, 'active', '2025-02-25 13:40:10'),
  ('RULE-b06746dbca51', 'Lilian Jimoh', 'finance', 'WAF_RU-14ef1cd624e6', 473, 51, 786, 909, 'active', '2025-05-24 07:35:34'),
  ('RULE-d50c2ceafaf9', 'Segun Taiwo', 'technology', 'WAF_RU-cf9816d62a5e', 751, 209, 471, 286, 'approved', '2025-09-06 12:37:45'),
  ('RULE-dd03e47d7ef0', 'Ibrahim Okafor', 'finance', 'WAF_RU-0371e1dc9ba3', 1, 965, 759, 56, 'approved', '2025-03-28 13:51:32'),
  ('RULE-823d44d782eb', 'Uche Igwe', 'operations', 'WAF_RU-a85f228629d4', 477, 289, 457, 765, 'processing', '2025-03-26 17:56:54'),
  ('RULE-01b3599f98a6', 'Tunde Yakubu', 'compliance', 'WAF_RU-fe22673a5c44', 178, 248, 74, 469, 'processing', '2025-08-15 09:21:58'),
  ('RULE-17e45b06071d', 'Grace Yakubu', 'operations', 'WAF_RU-6b29c9f3038c', 919, 12, 454, 842, 'pending', '2025-12-09 10:48:48'),
  ('RULE-255ec140c0ec', 'Gbenga Mohammed', 'compliance', 'WAF_RU-5f5ce2304b3b', 682, 110, 635, 666, 'approved', '2025-02-08 12:24:32')
ON CONFLICT DO NOTHING;


-- ─── warehouseReceipts ───
INSERT INTO "warehouseReceipts" ("receiptId", "tenantId", "depositorId", "depositorName", "warehouseId", "warehouseName", "location", "commodity", "quantity", "quantityUnit", "qualityGrade", "storageStartDate", "expiryDate", "marketValue", "currency", "pledgedAsCollateral", "collateralLoanId", "insurancePolicyId", "status", "createdAt", "updatedAt") VALUES
  ('RECE-4b7b411bf791', 'tenant-kano-north', 'DEPO-e1cdf4f59986', 'WAREHO-338eab8b78d0', 'WARE-d7552cc7201a', 'WAREHO-b5ad44ca0852', 'Awka', 'WAREHO-63a6932d4f4e', 7968182.46, 'WAREHO-804918ed68eb', 'WAREHO-73ca86d80575', 'WAREHO-0d89800625d2', 'WAREHO-cc3a98caaf97', 5139944.64, 'USD', 929, 'COLL-862631f3e3af', 'INSU-15aeb102ce49', 'pending', '2025-07-04 11:43:37', '2025-08-15 22:52:22'),
  ('RECE-ba4110cc9905', 'tenant-whitelabel-zenith', 'DEPO-f27e5f876c41', 'WAREHO-d946212f0e10', 'WARE-db1247afa53e', 'WAREHO-c4d58b3988ef', 'Garki', 'WAREHO-454e4d549d7b', 5998826.99, 'WAREHO-55e03acf357d', 'WAREHO-0802a2f57958', 'WAREHO-5be8918f221b', 'WAREHO-452361028e0d', 5685641.94, 'USD', 628, 'COLL-e6b0ea90b349', 'INSU-001de86f2b18', 'processing', '2026-01-20 06:00:13', '2026-05-03 18:06:35'),
  ('RECE-32323de0261e', 'tenant-lagos-main', 'DEPO-c24637f2c1e5', 'WAREHO-98bf09b4caf5', 'WARE-e9c9d8c860a1', 'WAREHO-e6873474b968', 'Victoria Island', 'WAREHO-472881eafd5f', 6923963.64, 'WAREHO-8c4bb11b7090', 'WAREHO-8e08438976a9', 'WAREHO-a40cdf203775', 'WAREHO-96fd66305fef', 49895.49, 'NGN', 684, 'COLL-6672bafb05a4', 'INSU-e4b94aa34338', 'processing', '2025-11-24 23:46:44', '2025-05-26 08:50:36'),
  ('RECE-ded5244ab8f9', 'tenant-portharcourt', 'DEPO-7883459f0260', 'WAREHO-a34b652508ff', 'WARE-c7c6ea2056d2', 'WAREHO-60d1bbbf97af', 'Maitama', 'WAREHO-55403e7c60fd', 972169.04, 'WAREHO-64f5d64b02a8', 'WAREHO-00f85617324c', 'WAREHO-8c9a08d8d219', 'WAREHO-d874a052c9bd', 1749983.84, 'EUR', 816, 'COLL-1635c3dad514', 'INSU-628bfe168cb9', 'completed', '2025-09-30 20:02:46', '2025-12-26 04:02:54'),
  ('RECE-f29aacd2d889', 'tenant-kano-north', 'DEPO-268206593c05', 'WAREHO-4523ca170a98', 'WARE-da865679d727', 'WAREHO-5329b7c18bb3', 'Ikeja', 'WAREHO-c30c152f3450', 7604294.95, 'WAREHO-72f80b1a4310', 'WAREHO-76b757fcc343', 'WAREHO-6d81d42fc32f', 'WAREHO-9c99b210622e', 4823131.22, 'USD', 526, 'COLL-e9f3e451118b', 'INSU-b07c1fad95ec', 'approved', '2025-09-07 07:30:38', '2025-12-07 20:59:06'),
  ('RECE-c1734742643e', 'tenant-lagos-main', 'DEPO-8ec7c8f23a1e', 'WAREHO-b94539578155', 'WARE-942770861550', 'WAREHO-49c0d3053793', 'Garki', 'WAREHO-4d4dc4a85947', 5188236.77, 'WAREHO-7c4ff3c3b8e6', 'WAREHO-e398243ba2cb', 'WAREHO-3b0f97768448', 'WAREHO-a723a9484b68', 158218.66, 'NGN', 41, 'COLL-d9468064fb94', 'INSU-ac4dc864c0f6', 'active', '2026-02-14 18:56:39', '2025-04-26 17:46:59'),
  ('RECE-32e778dc9dd8', 'tenant-abuja-digital', 'DEPO-dcb2fd89bb67', 'WAREHO-814ba148afdc', 'WARE-68f8552465f6', 'WAREHO-0100382e96fa', 'Abeokuta', 'WAREHO-669e5803a986', 8338356.63, 'WAREHO-c419974e9157', 'WAREHO-e7b91d46a1cc', 'WAREHO-19a5183441e4', 'WAREHO-bdad2bc01811', 3828871.06, 'NGN', 682, 'COLL-7e832c24fe86', 'INSU-60addc7bdbe3', 'processing', '2026-01-04 12:29:08', '2025-01-06 07:31:04'),
  ('RECE-26a85c6299c5', 'tenant-lagos-main', 'DEPO-cb11e4a9c0cd', 'WAREHO-e97eae6a717f', 'WARE-52f70d125626', 'WAREHO-60792da2d52f', 'Ibadan', 'WAREHO-cb363aa95658', 9968817.82, 'WAREHO-2a14b7e2102f', 'WAREHO-645f37ec2a70', 'WAREHO-8b78e4a49b1f', 'WAREHO-d277ac0497ab', 2146278.39, 'GBP', 634, 'COLL-39a14babfa27', 'INSU-02c22525d01d', 'approved', '2026-03-18 19:56:17', '2025-09-27 15:42:14')
ON CONFLICT DO NOTHING;


-- ─── warehouse_management ───
INSERT INTO "warehouse_management" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-be70e710498e', 'Bukola Usman', 'payments', 'Bukola Usman - Ibadan - Warehouse Management', 'processing', 8155547.79, 'Cross River', 'REF-9F80B61698', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-11-02 04:33:53', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-77ea77faded0', 'Uzo Peterside', 'lending', 'Uzo Peterside - Asaba - Warehouse Management', 'active', 8748088.28, 'Anambra', 'REF-6AABD8F207', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2026-01-25 09:02:28', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-4646342b207f', 'Oluchi Jimoh', 'payments', 'Oluchi Jimoh - Garki - Warehouse Management', 'active', 3956590.62, 'Imo', 'REF-EEE74A7F41', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-04-30 21:22:56', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-31312ffa167d', 'Chukwuemeka Lawal', 'payments', 'Chukwuemeka Lawal - Victoria Island - Warehouse Management', 'completed', 3272557.11, 'Anambra', 'REF-D8EE35DFFD', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-01-13 14:48:53', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-9bcb4cf6e340', 'Ifeoma Yakubu', 'operations', 'Ifeoma Yakubu - Zaria - Warehouse Management', 'active', 5695107.98, 'Osun', 'REF-D414E381E0', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-09-28 02:19:02', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-b39b20904914', 'Rasheed Adenuga', 'lending', 'Rasheed Adenuga - Zaria - Warehouse Management', 'completed', 3414987.37, 'Rivers', 'REF-E24DC9949F', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-04-28 16:25:43', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-b56473281901', 'Oluchi Fashola', 'technology', 'Oluchi Fashola - Benin City - Warehouse Management', 'completed', 5629898.06, 'Imo', 'REF-0E88A1A5C8', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-05-30 08:18:03', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-99f397ae1084', 'Rahma Dangote', 'lending', 'Rahma Dangote - Kano - Warehouse Management', 'approved', 9332186.2, 'Enugu', 'REF-E73F52BBF6', '{"source": "seed", "table": "warehouse_management"}'::jsonb, '2025-01-23 03:53:24', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── watchlist_sources ───
INSERT INTO "watchlist_sources" ("name", "source", "url", "format", "entries", "syncFrequency", "autoSync", "status", "createdAt") VALUES
  ('Femi Kalu', 'WATCHL-d5a9369e24b7', 'https://cdn.54bank.ng/watchlist_sources/c9132ec0', 'WATCHL-141721c4b049', 416, 'WATCHL-35eec1060381', true, 'active', '2025-12-28 15:22:37'),
  ('Babajide Usman', 'WATCHL-b99df2ef5205', 'https://cdn.54bank.ng/watchlist_sources/d8582a0b', 'WATCHL-46ffafcf6e4d', 934, 'WATCHL-7aabdcf21e5d', true, 'pending', '2026-04-27 11:39:46'),
  ('Hassan Igwe', 'WATCHL-dd5a00982b82', 'https://cdn.54bank.ng/watchlist_sources/2251f695', 'WATCHL-6763b3948b69', 249, 'WATCHL-fd5b54eaf036', true, 'processing', '2025-08-20 11:17:01'),
  ('Sade Peterside', 'WATCHL-25a2222d14c2', 'https://cdn.54bank.ng/watchlist_sources/708aca23', 'WATCHL-07d4c8f0fc75', 363, 'WATCHL-33add2bd3ec5', true, 'completed', '2025-01-14 16:56:56'),
  ('Ifeoma Elumelu', 'WATCHL-1956844fd3a2', 'https://cdn.54bank.ng/watchlist_sources/303575b4', 'WATCHL-da53880d26c7', 659, 'WATCHL-315766c1f21e', true, 'active', '2025-12-12 19:27:14'),
  ('Bukola Mohammed', 'WATCHL-98d8eae2ca3e', 'https://cdn.54bank.ng/watchlist_sources/335935a1', 'WATCHL-05a3ae1d2f13', 595, 'WATCHL-e1849cb03a83', true, 'pending', '2026-03-30 05:22:36'),
  ('Olumide Kalu', 'WATCHL-5c83a392d2cd', 'https://cdn.54bank.ng/watchlist_sources/d8461f05', 'WATCHL-b90dd71babfe', 562, 'WATCHL-2fb758b771e4', true, 'completed', '2025-06-10 16:07:18'),
  ('Maryam Adenuga', 'WATCHL-3dd44c8db74c', 'https://cdn.54bank.ng/watchlist_sources/5a954fa3', 'WATCHL-c01b0b1f16d3', 500, 'WATCHL-c43340b3125a', true, 'pending', '2025-10-12 18:04:14')
ON CONFLICT DO NOTHING;


-- ─── whatsapp_banking_flows ───
INSERT INTO "whatsapp_banking_flows" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-whitelabel-zenith', 'REC-07c709f50ebc', 'Jide Taiwo', 'lending', 'Jide Taiwo - Maitama - Whatsapp Banking Flows', 'pending', 4142991.49, 'Kano', 'REF-554C16C79B', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-07-09 20:24:49', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-f981216ab4f5', 'Femi Kalu', 'lending', 'Femi Kalu - Lekki - Whatsapp Banking Flows', 'approved', 3173834.56, 'Anambra', 'REF-150440B6CC', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-09-17 00:37:20', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-474d662d0157', 'Adaeze Otedola', 'compliance', 'Adaeze Otedola - Garki - Whatsapp Banking Flows', 'active', 7437981.05, 'Kaduna', 'REF-92F570CE6E', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2026-01-30 16:46:50', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-418687a78955', 'Patience Elumelu', 'finance', 'Patience Elumelu - Benin City - Whatsapp Banking Flows', 'active', 403009.01, 'Osun', 'REF-A261C9440B', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-12-21 01:57:13', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-3b8401ebcf9c', 'Adaeze Sanusi', 'finance', 'Adaeze Sanusi - Warri - Whatsapp Banking Flows', 'active', 6058733.69, 'Oyo', 'REF-2F61ECAE75', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-03-13 17:07:50', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-acc5644201c6', 'Dorcas Nwosu', 'finance', 'Dorcas Nwosu - Abeokuta - Whatsapp Banking Flows', 'completed', 2006387.26, 'Abuja FCT', 'REF-D99A6F219E', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2026-04-17 15:24:13', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-5a83382838dd', 'Rahma Taiwo', 'risk', 'Rahma Taiwo - Ikeja - Whatsapp Banking Flows', 'approved', 3062580.88, 'Rivers', 'REF-356BC9FF19', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-04-30 20:57:19', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-bfc58388469f', 'Ifeoma Fashola', 'lending', 'Ifeoma Fashola - Garki - Whatsapp Banking Flows', 'pending', 7840907.71, 'Enugu', 'REF-15DFE69A25', '{"source": "seed", "table": "whatsapp_banking_flows"}'::jsonb, '2025-06-15 03:07:26', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── whatsapp_business_gateway ───
INSERT INTO "whatsapp_business_gateway" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-kano-north', 'REC-166a3feb7ecd', 'Nnamdi Chukwu', 'lending', 'Nnamdi Chukwu - Awka - Whatsapp Business Gateway', 'active', 9152746.08, 'Lagos', 'REF-05C8905E65', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-02-12 10:16:25', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-5d9b8055e22f', 'Tunde Adenuga', 'risk', 'Tunde Adenuga - Enugu - Whatsapp Business Gateway', 'approved', 7752284.09, 'Abuja FCT', 'REF-7A3F486381', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2026-02-07 01:03:48', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-3e4451c3c88c', 'Maryam Yakubu', 'finance', 'Maryam Yakubu - Benin City - Whatsapp Business Gateway', 'active', 3476406.97, 'Ogun', 'REF-0A1D9789B2', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2026-01-17 14:42:40', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-e40cb86083b1', 'Uzo Jimoh', 'operations', 'Uzo Jimoh - Garki - Whatsapp Business Gateway', 'completed', 7285344.44, 'Enugu', 'REF-1AE509086C', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-07-14 04:52:46', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-dab1cbe34385', 'Pelumi Hassan', 'lending', 'Pelumi Hassan - Awka - Whatsapp Business Gateway', 'pending', 9501762.89, 'Enugu', 'REF-6906918374', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-08-29 21:42:21', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-63303d5e486e', 'Patience Otedola', 'technology', 'Patience Otedola - Lekki - Whatsapp Business Gateway', 'processing', 9468235.47, 'Akwa Ibom', 'REF-C563D3CFA5', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-08-03 02:07:26', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-74b52ae7ee65', 'Olumide Eze', 'compliance', 'Olumide Eze - Zaria - Whatsapp Business Gateway', 'approved', 113705.79, 'Borno', 'REF-21AE169001', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-11-26 16:42:26', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-3a18577da729', 'Nneka Chukwu', 'lending', 'Nneka Chukwu - Ikeja - Whatsapp Business Gateway', 'approved', 779111.55, 'Rivers', 'REF-F96C2DDCB4', '{"source": "seed", "table": "whatsapp_business_gateway"}'::jsonb, '2025-12-31 15:37:15', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── whatsapp_document_service ───
INSERT INTO "whatsapp_document_service" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-ff1d3da1b8a1', 'Ifeoma Dangote', 'technology', 'Ifeoma Dangote - Port Harcourt - Whatsapp Document Service', 'active', 4904015.8, 'Kaduna', 'REF-00C629E4CF', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-04-16 22:29:17', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-2ff0a12367fb', 'Uzo Kalu', 'risk', 'Uzo Kalu - Ikeja - Whatsapp Document Service', 'pending', 4122265.9, 'Akwa Ibom', 'REF-59D4D87D82', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-07-06 07:01:52', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-9c5b748f2868', 'Gbenga Adenuga', 'operations', 'Gbenga Adenuga - Wuse - Whatsapp Document Service', 'approved', 3615278.02, 'Edo', 'REF-F8D4B4FF03', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-09-14 21:25:04', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-6fa80b8c8cf3', 'Fatima Adenuga', 'finance', 'Fatima Adenuga - Kano - Whatsapp Document Service', 'approved', 4079953.64, 'Plateau', 'REF-C97396F800', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-04-03 13:18:05', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-c1f38a88d1bf', 'Ifeoma Chukwu', 'lending', 'Ifeoma Chukwu - Ikeja - Whatsapp Document Service', 'completed', 251387.08, 'Rivers', 'REF-3CF70D26FF', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2026-02-18 05:30:16', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-7d890a83a9b8', 'Ifeoma Lawal', 'technology', 'Ifeoma Lawal - Port Harcourt - Whatsapp Document Service', 'approved', 8249514.04, 'Kaduna', 'REF-C9E3A0B30C', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-01-24 00:29:45', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-e8b425851ae9', 'Sade Danladi', 'lending', 'Sade Danladi - Port Harcourt - Whatsapp Document Service', 'active', 2971292.53, 'Imo', 'REF-F7A00AE614', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-12-06 17:11:29', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-449b02eecf81', 'Dorcas Fashola', 'lending', 'Dorcas Fashola - Lekki - Whatsapp Document Service', 'processing', 5276495.98, 'Lagos', 'REF-EAE4747290', '{"source": "seed", "table": "whatsapp_document_service"}'::jsonb, '2025-04-10 12:57:53', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── whatsapp_notification ───
INSERT INTO "whatsapp_notification" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-e7676c8f19d7', 'Jumoke Elumelu', 'payments', 'Jumoke Elumelu - Kano - Whatsapp Notification', 'approved', 6563418.83, 'Edo', 'REF-BB270C32BC', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-12-29 04:54:28', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-cd423441c538', 'Oluchi Chukwu', 'compliance', 'Oluchi Chukwu - Wuse - Whatsapp Notification', 'processing', 3616975.34, 'Enugu', 'REF-BC1F95B209', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-12-20 05:02:29', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-817830da0a20', 'Titilayo Lawal', 'lending', 'Titilayo Lawal - Benin City - Whatsapp Notification', 'approved', 4445750.97, 'Cross River', 'REF-206A1BFDC4', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-04-21 04:13:33', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-f8b51bbf690d', 'Uzo Jimoh', 'payments', 'Uzo Jimoh - Awka - Whatsapp Notification', 'approved', 6235085.75, 'Imo', 'REF-C52D7F9E73', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2026-01-04 14:41:09', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-7eefdbb7c50a', 'Ifeoma Eze', 'finance', 'Ifeoma Eze - Wuse - Whatsapp Notification', 'processing', 57155.89, 'Akwa Ibom', 'REF-D29B4C18D3', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2026-03-12 03:18:39', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-1e8dd445d5f0', 'Uzo Taiwo', 'finance', 'Uzo Taiwo - Benin City - Whatsapp Notification', 'completed', 4410119.23, 'Delta', 'REF-B2F9D2910D', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-08-10 21:43:17', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-d4add2ff309d', 'Uzo Lawal', 'lending', 'Uzo Lawal - Enugu - Whatsapp Notification', 'pending', 5720887.87, 'Ogun', 'REF-435664A5E7', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-10-10 11:18:34', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-65a711163ac4', 'Kunle Fashola', 'compliance', 'Kunle Fashola - Victoria Island - Whatsapp Notification', 'pending', 6980200.1, 'Anambra', 'REF-DBE6FA37FF', '{"source": "seed", "table": "whatsapp_notification"}'::jsonb, '2025-01-07 11:45:50', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── whatsapp_payment_integration ───
INSERT INTO "whatsapp_payment_integration" ("tenant_id", "record_id", "name", "category", "description", "status", "amount", "region", "reference", "metadata", "created_at", "updated_at") VALUES
  ('tenant-portharcourt', 'REC-a14e0165b273', 'Kunle Hassan', 'compliance', 'Kunle Hassan - Kano - Whatsapp Payment Integration', 'approved', 4059465.1, 'Osun', 'REF-C826F9384F', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-01-23 04:36:32', '2026-05-09 12:00:00'),
  ('tenant-abuja-digital', 'REC-0ff49825b01d', 'Adewale Peterside', 'technology', 'Adewale Peterside - Zaria - Whatsapp Payment Integration', 'active', 7533718.03, 'Akwa Ibom', 'REF-5DFE05ED0E', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-06-11 09:11:19', '2026-05-09 12:00:00'),
  ('tenant-whitelabel-zenith', 'REC-d6093269d01f', 'Ibrahim Mohammed', 'lending', 'Ibrahim Mohammed - Asaba - Whatsapp Payment Integration', 'approved', 2555638.95, 'Akwa Ibom', 'REF-17176A155A', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-06-01 01:30:04', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-a6474e96dd8b', 'Bukola Mohammed', 'technology', 'Bukola Mohammed - Wuse - Whatsapp Payment Integration', 'processing', 2413982.92, 'Oyo', 'REF-76DC1010B2', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-04-19 02:24:09', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-621c2b1162ba', 'Uche Taiwo', 'finance', 'Uche Taiwo - Ibadan - Whatsapp Payment Integration', 'processing', 9232877.27, 'Abuja FCT', 'REF-0BFB7BC7CE', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-05-21 19:42:40', '2026-05-09 12:00:00'),
  ('tenant-kano-north', 'REC-8dcf22f95c0a', 'Nnamdi Otedola', 'compliance', 'Nnamdi Otedola - Asaba - Whatsapp Payment Integration', 'pending', 8454689.81, 'Anambra', 'REF-3F36109214', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-10-20 13:01:38', '2026-05-09 12:00:00'),
  ('tenant-lagos-main', 'REC-aac431eb82a8', 'Uzo Adenuga', 'compliance', 'Uzo Adenuga - Zaria - Whatsapp Payment Integration', 'pending', 2535778.87, 'Kwara', 'REF-68AD24322D', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-09-07 22:47:57', '2026-05-09 12:00:00'),
  ('tenant-portharcourt', 'REC-4468b994c020', 'Grace Usman', 'finance', 'Grace Usman - Wuse - Whatsapp Payment Integration', 'active', 8668540.41, 'Kaduna', 'REF-2E3A8AA663', '{"source": "seed", "table": "whatsapp_payment_integration"}'::jsonb, '2025-01-07 04:05:20', '2026-05-09 12:00:00')
ON CONFLICT DO NOTHING;


-- ─── wire_transfer_monitor ───
INSERT INTO "wire_transfer_monitor" ("originatorName", "beneficiaryName", "currency", "travelRuleCompliant", "status", "createdAt") VALUES
  ('WIRE_T-3a896878bcdc', 'Oluchi Hassan', 'NGN', false, 'processing', '2025-12-02 16:04:57'),
  ('WIRE_T-84a13ad5d36c', 'Kemi Hassan', 'NGN', true, 'pending', '2025-10-10 20:04:54'),
  ('WIRE_T-b62cf8cfb79e', 'Nneka Lawal', 'NGN', false, 'processing', '2025-07-13 20:44:53'),
  ('WIRE_T-3550a01bd6bd', 'Uche Elumelu', 'EUR', false, 'processing', '2025-01-11 04:13:19'),
  ('WIRE_T-82af4185f770', 'Lilian Yakubu', 'USD', true, 'processing', '2025-03-19 04:05:53'),
  ('WIRE_T-c073dfcd2039', 'Hauwa Elumelu', 'EUR', true, 'active', '2025-11-02 04:14:35'),
  ('WIRE_T-6575bf13e421', 'Lilian Peterside', 'GBP', true, 'approved', '2026-03-25 10:19:05'),
  ('WIRE_T-cf5bac2eb216', 'Musa Jimoh', 'USD', true, 'pending', '2025-11-25 05:07:02')
ON CONFLICT DO NOTHING;

COMMIT;

-- Generic service tables: 65
-- Custom schema tables:   191
-- Total tables seeded:    256
-- Total rows:             ~2048