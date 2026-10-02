-- Rollback for 006_platform_template_tables.sql
--
-- WARNING: drops the three platform template tables and ALL data in them.
-- These tables are written by 300+ services (outbox event queue, service
-- record stores, config stores) — rolling back in production is a data-loss
-- operation and should only run in throwaway environments. The down file
-- exists for migrate.sh down-parity (001/003/004 pattern), not for routine
-- use. Keep this file free of BEGIN/COMMIT (mirrors the up migration).
DROP TABLE IF EXISTS service_configs;
DROP TABLE IF EXISTS service_records;
DROP TABLE IF EXISTS outbox;
