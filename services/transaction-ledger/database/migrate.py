"""Flyway-style migration runner (W7-C-18).

Applies the SQL scripts in database/migrations/V*.sql in version order and
records each applied version in the schema_migrations table, so re-runs are
no-ops (idempotent). The scripts control their own transactions (V002 wraps
itself in BEGIN/COMMIT; V003's statements are individually atomic), so the
runner executes them on an autocommit psycopg2 connection.

A failed migration raises: a partially applied schema is a startup-fatal
condition on the production path, never something to serve traffic against.
"""

import logging
import os
import re

import psycopg2

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
_MIGRATION_FILE = re.compile(r"^V(\d+)__.*\.sql$")


def _discover_migrations():
    """Return [(version, path), ...] for every V<nnn>__*.sql script, sorted."""
    migrations = []
    if not os.path.isdir(MIGRATIONS_DIR):
        return migrations
    for name in os.listdir(MIGRATIONS_DIR):
        match = _MIGRATION_FILE.match(name)
        if match:
            migrations.append((int(match.group(1)), os.path.join(MIGRATIONS_DIR, name)))
    migrations.sort(key=lambda item: item[0])
    return migrations


def run_migrations(database_uri):
    """Apply all pending migrations. Raises on any failure."""
    migrations = _discover_migrations()
    if not migrations:
        logger.info("No migrations found in %s", MIGRATIONS_DIR)
        return

    conn = psycopg2.connect(database_uri)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version     INTEGER PRIMARY KEY,
                    script      TEXT NOT NULL,
                    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute("SELECT version FROM schema_migrations")
            applied = {row[0] for row in cur.fetchall()}

            for version, path in migrations:
                if version in applied:
                    continue
                script_name = os.path.basename(path)
                logger.info("Applying migration %s", script_name)
                with open(path, "r", encoding="utf-8") as fh:
                    script = fh.read()
                cur.execute(script)
                cur.execute(
                    "INSERT INTO schema_migrations (version, script) VALUES (%s, %s)",
                    (version, script_name),
                )
                logger.info("Migration V%03d applied successfully", version)
    finally:
        conn.close()
