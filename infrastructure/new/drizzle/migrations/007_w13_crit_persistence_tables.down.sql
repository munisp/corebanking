-- 007 down: drop W13-FIX-CRIT persistence tables
DROP TABLE IF EXISTS wire_transfer_monitor_records;
DROP TABLE IF EXISTS watchlist_entries;
DROP TABLE IF EXISTS telegram_messages;
DROP TABLE IF EXISTS pin_hashes;
DROP TABLE IF EXISTS kpi_alerts;
DROP TABLE IF EXISTS kpi_thresholds;
DROP TABLE IF EXISTS chatbot_training_jobs;
DROP TABLE IF EXISTS chatbot_handoffs;
DROP TABLE IF EXISTS chatbot_messages;
DROP TABLE IF EXISTS chatbot_sessions;
DROP TABLE IF EXISTS chatbot_intents;
