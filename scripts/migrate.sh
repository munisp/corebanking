#!/usr/bin/env bash
# 54Bank Database Migration Runner
# Usage: ./scripts/migrate.sh [up|down|status|generate]
set -euo pipefail

MIGRATION_DIR="drizzle/migrations"
DB_URL="${DATABASE_URL:?DATABASE_URL not set}"

case "${1:-up}" in
  up)
    echo "[migrate] Applying pending migrations..."
    for sql in $(ls "$MIGRATION_DIR"/*.sql | sort); do
      version=$(basename "$sql" | cut -d'_' -f1)
      name=$(basename "$sql" .sql)
      existing=$(psql "$DB_URL" -tAc "SELECT version FROM _migrations WHERE version='$version' AND rolled_back=FALSE" 2>/dev/null || echo "")
      if [ -z "$existing" ]; then
        echo "  Applying: $name"
        start_ms=$(date +%s%3N)
        psql "$DB_URL" -f "$sql"
        end_ms=$(date +%s%3N)
        elapsed=$((end_ms - start_ms))
        checksum=$(sha256sum "$sql" | cut -d' ' -f1)
        psql "$DB_URL" -c "INSERT INTO _migrations (version, name, checksum, execution_time_ms) VALUES ('$version', '$name', '$checksum', $elapsed)"
        echo "  Applied in ${elapsed}ms"
      fi
    done
    echo "[migrate] All migrations applied."
    ;;
  down)
    echo "[migrate] Rolling back last migration..."
    last=$(psql "$DB_URL" -tAc "SELECT version, name FROM _migrations WHERE rolled_back=FALSE ORDER BY version DESC LIMIT 1")
    if [ -n "$last" ]; then
      version=$(echo "$last" | cut -d'|' -f1)
      name=$(echo "$last" | cut -d'|' -f2)
      rollback_file="$MIGRATION_DIR/${name}.down.sql"
      if [ -f "$rollback_file" ]; then
        psql "$DB_URL" -f "$rollback_file"
      fi
      psql "$DB_URL" -c "UPDATE _migrations SET rolled_back=TRUE, rolled_back_at=NOW() WHERE version='$version'"
      echo "  Rolled back: $name"
    else
      echo "  No migrations to roll back."
    fi
    ;;
  status)
    echo "[migrate] Migration status:"
    psql "$DB_URL" -c "SELECT version, name, applied_at, execution_time_ms, rolled_back FROM _migrations ORDER BY version"
    ;;
  generate)
    ts=$(date +%Y%m%d%H%M%S)
    name="${2:-unnamed}"
    touch "$MIGRATION_DIR/${ts}_${name}.sql"
    touch "$MIGRATION_DIR/${ts}_${name}.down.sql"
    echo "Created: $MIGRATION_DIR/${ts}_${name}.sql"
    echo "Created: $MIGRATION_DIR/${ts}_${name}.down.sql"
    ;;
  *)
    echo "Usage: $0 [up|down|status|generate <name>]"
    exit 1
    ;;
esac
