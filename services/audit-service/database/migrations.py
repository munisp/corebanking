"""AU-03 + PL-10: idempotent, expand-only schema migrations for the audit table.

``Base.metadata.create_all()`` creates missing tables but never alters existing
ones, so the additive columns (hash chain, retention bucket) and the archive
certificate table are applied here. The runner also backfills the hash chain
for rows written before AU-03. Every statement is idempotent; the runner is
invoked on every service startup and is safe to re-run.

Data preservation: expand-migrate only — no column is dropped or retyped.
"""
import hashlib
import json
import logging

from sqlalchemy import text

from .setup import engine

logger = logging.getLogger("audit.migrations")

_DDL = [
    # AU-03: hash-chain columns (expand-only).
    "ALTER TABLE audit ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64)",
    "ALTER TABLE audit ADD COLUMN IF NOT EXISTS entry_hash VARCHAR(64)",
    "CREATE INDEX IF NOT EXISTS ix_audit_entry_hash ON audit (entry_hash)",
    # PL-10: derived monthly retention bucket + index.
    "ALTER TABLE audit ADD COLUMN IF NOT EXISTS created_month VARCHAR(7)",
    "CREATE INDEX IF NOT EXISTS ix_audit_tenant_month ON audit (tenant_id, created_month)",
    # PL-10: archive certificates proving what was exported before deletion.
    """
    CREATE TABLE IF NOT EXISTS audit_archive_certificate (
        id BIGSERIAL PRIMARY KEY,
        tenant_id VARCHAR NOT NULL,
        created_month VARCHAR(7) NOT NULL,
        record_count INTEGER NOT NULL,
        first_entry_hash VARCHAR(64),
        last_entry_hash VARCHAR(64),
        bundle_sha256 VARCHAR(64) NOT NULL,
        destination VARCHAR NOT NULL,
        archived_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, created_month)
    )
    """,
]


def _canonical(actor_id, tenant_id, event_type, event_data, timestamp) -> str:
    return json.dumps(
        {
            "actor_id": actor_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": "" if timestamp is None else str(timestamp),
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _entry_hash(prev_hash, canonical: str) -> str:
    return hashlib.sha256(((prev_hash or "") + canonical).encode("utf-8")).hexdigest()


def _backfill_hash_chain(conn) -> int:
    """Seal rows written before AU-03. Per-tenant chain, (created_at, id) order."""
    tenants = [
        r[0]
        for r in conn.execute(
            text("SELECT DISTINCT tenant_id FROM audit WHERE entry_hash IS NULL")
        )
    ]
    sealed = 0
    for tenant_id in tenants:
        prev = conn.execute(
            text(
                "SELECT entry_hash FROM audit "
                "WHERE tenant_id = :t AND entry_hash IS NOT NULL "
                "ORDER BY created_at DESC, id DESC LIMIT 1"
            ),
            {"t": tenant_id},
        ).scalar()
        rows = conn.execute(
            text(
                "SELECT id, actor_id, tenant_id, event_type, event_data, timestamp "
                "FROM audit WHERE tenant_id = :t AND entry_hash IS NULL "
                "ORDER BY created_at ASC, id ASC"
            ),
            {"t": tenant_id},
        ).all()
        for row in rows:
            canonical = _canonical(
                row.actor_id, row.tenant_id, row.event_type, row.event_data, row.timestamp
            )
            digest = _entry_hash(prev, canonical)
            conn.execute(
                text("UPDATE audit SET prev_hash = :p, entry_hash = :h WHERE id = :i"),
                {"p": prev, "h": digest, "i": row.id},
            )
            prev = digest
            sealed += 1
    return sealed


def _backfill_created_month(conn) -> int:
    result = conn.execute(
        text(
            "UPDATE audit SET created_month = to_char(created_at, 'YYYY-MM') "
            "WHERE created_month IS NULL AND created_at IS NOT NULL"
        )
    )
    return result.rowcount or 0


def run_migrations() -> None:
    with engine.begin() as conn:
        for stmt in _DDL:
            conn.execute(text(stmt))
        month_rows = _backfill_created_month(conn)
        sealed = _backfill_hash_chain(conn)
    if month_rows or sealed:
        logger.info(
            "audit migrations: backfilled created_month for %s rows, sealed %s rows",
            month_rows,
            sealed,
        )
