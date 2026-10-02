// Package otelkit is the shared OpenTelemetry kit for corebanking Go services.
//
// It implements the Wave-9 SPEC (work/w9/SPEC.md) §2.5 Go contract:
//
//   - Init: OTLP gRPC trace + metric exporters, resource attributes
//     (service.name, service.namespace="corebanking", deployment.environment),
//     parent-based trace-id-ratio sampler (OTEL_TRACES_SAMPLER_ARG, default 1.0),
//     W3C tracecontext+baggage propagation, graceful shutdown.
//   - HTTPMiddleware / GinMiddleware: server spans plus tenant.id attribution.
//   - WrapSQLDB: database/sql tracing via otelsql.
//   - KafkaProducerInterceptor / KafkaConsumerInterceptor: segmentio/kafka-go
//     wrappers with W3C header injection/extraction.
//   - RedisHook: go-redis/v9 tracing hook (in-kit tracing hook).
//   - TemporalInterceptors: go.temporal.io/sdk contrib opentelemetry interceptors.
//   - TigerBeetleSpan: client span helper for TigerBeetle operations.
//   - IncCounter: synchronous counter helper for domain metrics
//     (e.g. eod_run_failures_total, audit_ship_failures_total).
//
// Environment (SPEC §2.1):
//
//	OTEL_EXPORTER_OTLP_ENDPOINT  OTLP gRPC endpoint (default http://otel-collector:4317)
//	OTEL_SERVICE_NAME            service name (falls back to SERVICE_NAME, then the
//	                             name passed to Init)
//	OTEL_TRACES_SAMPLER_ARG      trace-id ratio in [0,1] (default 1.0)
//	OTEL_SDK_DISABLED            "true"/"1"/"yes" disables the SDK (all kit
//	                             functions become no-ops)
//	DEPLOY_ENV                   deployment.environment resource attr (default dev)
//
// Tenant attribution (SPEC §2.3): the attribute key is "tenant.id". It is sourced
// from the x-tenant-id header first, then from the (unverified, attribution-only)
// JWT tenant_id claim. A span processor copies the tenant from the request
// context onto every span started under it, so downstream spans (DB, Kafka,
// Redis, Temporal, TigerBeetle) inherit tenant.id automatically.
package otelkit
