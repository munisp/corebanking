-- 008 (W14-A1): deprecate 16 dead tables surfaced by the wave-13
-- table-no-writer register (236 PRELIMINARY findings triaged).
--
-- Each table below was grep-verified across the full tree
-- (.ts/.go/.py/.rs/.sql, excluding node_modules/vendor): no INSERT/UPDATE/
-- DELETE writer, no drizzle/knex/TypeORM/SQLAlchemy/sqlc writer, and no live
-- reader of the table shape. Kept (not dropped) for safety; marked
-- DEPRECATED. Do not write new code against them. Full evidence:
-- work/w14/a1/triage.json. Follows the 006_w13_deprecate_account_balances.sql
-- idiom.

-- migrations/001_initial_schema.sql:101; zero code references. DLQ handling
-- uses Dapr pub/sub state, not this PG table.
COMMENT ON TABLE dlq_messages IS
    'DEPRECATED (W14-A1): dead table — no writer and no reader in the tree. '
    'DLQ handling is Dapr-based. Kept for backward compatibility only.';

-- migrations/001_initial_schema.sql:70; only declarative partition-config
-- metadata in server/lib/performanceEnhancements.ts:31 (no executable
-- consumer — same precedent as W13-RISK-3 account_balances).
COMMENT ON TABLE event_store IS
    'DEPRECATED (W14-A1): dead table — no writer and no live reader; only a '
    'declarative partition-config mention (performanceEnhancements.ts:31). '
    'Kept for backward compatibility only.';

-- migrations/001_initial_schema.sql:87; only declarative RLS config at
-- server/lib/databasePersistence.ts:50. tenant-management TypeORM persists
-- flags to tenant_feature_flag (TenantFeatureFlagEntity.ts:5), not here.
COMMENT ON TABLE feature_flags IS
    'DEPRECATED (W14-A1): dead table — no writer and no live reader of this '
    'shape. Live feature flags live in tenant_feature_flag (TypeORM, '
    'tenant-management). Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1724; zero code references.
COMMENT ON TABLE fluvio_consumer_groups IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1692; zero code references.
COMMENT ON TABLE fluvio_event_log IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1708; zero code references.
-- Live outbox relays use service-local outbox tables.
COMMENT ON TABLE fluvio_event_outbox IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- migrations/002_business_logic_fixes.sql:47; payment idempotency uses the
-- Dapr state store (services/payment-processing-service/api/payment.py:62-92).
COMMENT ON TABLE idempotency_store IS
    'DEPRECATED (W14-A1): dead table — no writer and no reader; idempotency '
    'is served by the Dapr state store. Kept for backward compatibility only.';

-- migrations/001_initial_schema.sql:37; zero code references.
COMMENT ON TABLE ndpr_consents IS
    'DEPRECATED (W14-A1): dead table — no writer and no reader in the tree. '
    'Kept for backward compatibility only.';

-- migrations/001_initial_schema.sql:55; zero code references.
COMMENT ON TABLE ndpr_dsar IS
    'DEPRECATED (W14-A1): dead table — no writer and no reader in the tree. '
    'Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1785; zero code references.
COMMENT ON TABLE openappsec_learning_data IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1769; zero code references
-- (openappsecWaf.ts writes waf_rules only, line 329).
COMMENT ON TABLE openappsec_waf_events IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1756; zero code references;
-- rate limiting is Redis-native.
COMMENT ON TABLE redis_rate_limit_log IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1653; zero code references.
COMMENT ON TABLE temporal_activity_log IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1666; zero code references.
COMMENT ON TABLE temporal_saga_compensations IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- drizzle/0008_comprehensive_platform_schema.sql:1636; zero code references;
-- Temporal workflow state lives in the Temporal server itself.
COMMENT ON TABLE temporal_workflow_executions IS
    'DEPRECATED (W14-A1): dead table — generated-schema orphan, no writer, '
    'no reader. Kept for backward compatibility only.';

-- migrations/002_business_logic_fixes.sql:61. No writer anywhere. Two
-- services read this never-written table
-- (services/platform-operations-engine-py/service.py:140,
-- services/operations-control-gl-rs/src/main.rs:55). The monolith
-- maker-checker engine is authoritative on approval_requests via pgJsonStore
-- (infrastructure/new/server/lib/makerCheckerEngine.ts:104-169) — a different
-- shape, so wiring is ambiguous; deprecated per the account_balances
-- precedent. Follow-up: repoint the two readers at approval_requests.
COMMENT ON TABLE maker_checker_requests IS
    'DEPRECATED (W14-A1): dead table — never written; approval authority is '
    'the approval_requests store (makerCheckerEngine.ts). Readers '
    'platform-operations-engine-py and operations-control-gl-rs query an '
    'empty table and must be repointed. Kept for backward compatibility only.';
