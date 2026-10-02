#!/usr/bin/env bash
# =============================================================================
# apply_w11_template_indexes.sh — W11 template composite indexes (DI-06/DI-11)
# =============================================================================
# Renders infrastructure/new/scripts/w11_template_composite_indexes.sql for
# each service-owned table and applies it with CREATE INDEX CONCURRENTLY.
#
# WHY PER-SERVICE-DB: each of the ~140 generated Go services creates its own
# snake_case tables in its OWN Postgres database at boot. Identical table
# names (accounts, service_configs, ...) live in different databases, so the
# index must be applied once per service database that has the table.
#
# CONCURRENTLY SAFETY: CREATE INDEX CONCURRENTLY cannot run inside a
# transaction block. This script applies each rendered statement with a
# separate `psql -c` call in autocommit mode — no BEGIN/COMMIT anywhere.
#
# USAGE:
#   # 1) Dry-run: discover candidate tables from the repo and print the SQL
#   ./apply_w11_template_indexes.sh --discover
#
#   # 2) Apply to ONE service database for the discovered/given tables:
#   DATABASE_URL=postgres://... ./apply_w11_template_indexes.sh --apply [table ...]
#
#   # 3) Apply from an explicit table list file (one table per line):
#   DATABASE_URL=postgres://... ./apply_w11_template_indexes.sh --apply -f tables.txt
#
# Typical fleet rollout: loop over your per-service DATABASE_URLs and run
# step 2 for each, off-peak. Tables that do not exist in a given DB cause
# that one statement to fail with "does not exist" without affecting others
# (each statement is independent; psql errors are logged, not fatal).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/w11_template_composite_indexes.sql"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

render() {
  # Render the template for one table: substitute __TABLE__ (quoted identifier,
  # snake_case by template convention — do not pass camelCase names).
  local table="$1"
  sed "s/__TABLE__/${table}/g" "$TEMPLATE"
}

discover_tables() {
  # Candidate tables = every table that gets the template boot-time index trio
  # (idx_<t>_tenant ON <t>(tenant_id)) in service main.go schema blocks.
  grep -rhoE 'CREATE INDEX IF NOT EXISTS idx_[a-z_]+_tenant ON [a-z_]+\(tenant_id\)' \
      "${REPO_ROOT}/services" 2>/dev/null \
    | sed -E 's/.*ON ([a-z_]+)\(tenant_id\)/\1/' \
    | sort -u
}

mode="${1:---discover}"
shift || true

case "$mode" in
  --discover)
    echo "# Candidate service-owned tables (idx_<t>_tenant boot pattern):"
    discover_tables | tee /dev/stderr | while read -r t; do
      render "$t" | grep -E '^CREATE INDEX'
    done
    echo "# Review the list, then run --apply per service database."
    ;;
  --apply)
    : "${DATABASE_URL:?set DATABASE_URL to the target SERVICE database}"
    tables=()
    if [ "${1:-}" = "-f" ]; then
      mapfile -t tables < <(grep -vE '^\s*(#|$)' "$2")
    elif [ $# -gt 0 ]; then
      tables=("$@")
    else
      mapfile -t tables < <(discover_tables)
    fi
    for t in "${tables[@]}"; do
      # Identifier hygiene: template tables are snake_case only.
      if ! [[ "$t" =~ ^[a-z][a-z0-9_]*$ ]]; then
        echo "[skip] '$t' is not a snake_case identifier" >&2; continue
      fi
      echo "[apply] idx_${t}_tenant_created ON ${t}(tenant_id, created_at DESC)"
      # One psql -c per statement: autocommit, no surrounding transaction.
      render "$t" | grep -E '^CREATE INDEX' \
        | psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -c "$(cat)" \
        || echo "[warn] ${t}: failed (table may not exist in this DB)" >&2
    done
    echo "[done] ${#tables[@]} table(s) processed for this database."
    ;;
  *)
    echo "Usage: $0 [--discover | --apply [table ...] | --apply -f tables.txt]" >&2
    exit 2
    ;;
esac
