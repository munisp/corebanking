//! Manual client-span helpers for call sites without auto-instrumentation
//! (SPEC §2.5).
//!
//! These return plain [`tracing::Span`]s; enter them (or `.instrument()` a
//! future) around the operation:
//!
//! ```ignore
//! let _span = otelkit::pg_span("UPDATE payments SET status=$1").entered();
//! // ... run the query ...
//! ```
//!
//! Tenant attribution: `tenant.id` is set once on the ingress span by the
//! middleware; these client spans correlate through the shared trace context
//! and deliberately do not restate the tenant (SPEC §2.3).

/// Maximum length of the recorded `db.statement` (bounded for cardinality and
/// to avoid shipping large payloads; statements here are static SQL with
/// `$n` placeholders, never interpolated values).
const MAX_STATEMENT_LEN: usize = 256;

fn truncate_statement(query: &str) -> &str {
    match query.char_indices().nth(MAX_STATEMENT_LEN) {
        Some((idx, _)) => &query[..idx],
        None => query,
    }
}

/// Normalize a SQL statement to its leading verb (`SELECT`, `UPDATE`, ...).
fn sql_operation(query: &str) -> &str {
    query.split_whitespace().next().unwrap_or("query")
}

/// Client span for a Postgres call (sqlx, tokio-postgres, or postgres-rs).
pub fn pg_span(query: &str) -> tracing::Span {
    tracing::info_span!(
        "db.query",
        otel.kind = "client",
        db.system = "postgresql",
        db.operation = sql_operation(query),
        db.statement = truncate_statement(query),
    )
}

/// Client span for a TigerBeetle operation (`create_accounts`,
/// `create_transfers`, `lookup_accounts`, ...).
pub fn tigerbeetle_span(op: &str) -> tracing::Span {
    tracing::info_span!(
        "tigerbeetle.op",
        otel.kind = "client",
        db.system = "tigerbeetle",
        db.operation = op,
    )
}
