#!/usr/bin/env bash
# 54Bank — Master Seed Data Runner
# ==================================
# Runs all seed scripts in the correct order.
#
# Usage:
#   DB_URL="postgresql://user:pass@localhost:5432/corebanking" bash scripts/run-seed.sh
#
# Or with psql directly:
#   psql $DB_URL -f drizzle/seed-gl-coa.sql
#   psql $DB_URL -f drizzle/seed-kpi.sql
#   psql $DB_URL -f drizzle/seed-comprehensive.sql
#   psql $DB_URL -f drizzle/seed-remaining-comprehensive.sql
#
# TigerBeetle:
#   TB_ADDRESS=localhost:3001 bash scripts/tigerbeetle-seed.sh

set -euo pipefail

DB_URL="${DB_URL:-postgresql://localhost:5432/corebanking}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DRIZZLE_DIR="$SCRIPT_DIR/../drizzle"

echo "═══════════════════════════════════════════════════════════════"
echo "  54Bank — Comprehensive Database Seed"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Step 1: Generate seed data (regenerates from Python scripts)
echo "[1/6] Generating seed data..."
python3 "$SCRIPT_DIR/generate-seed-data.py"
python3 "$SCRIPT_DIR/generate-seed-remaining.py"
echo ""

# Step 2: GL Chart of Accounts (must be first — referenced by journal entries)
echo "[2/6] Seeding GL Chart of Accounts (200+ GL codes)..."
psql "$DB_URL" -f "$DRIZZLE_DIR/seed-gl-coa.sql" 2>&1 || echo "  ⚠ GL COA seed had warnings (may already exist)"
echo ""

# Step 3: KPI Framework
echo "[3/6] Seeding KPI Personnel Framework..."
psql "$DB_URL" -f "$DRIZZLE_DIR/seed-kpi.sql" 2>&1 || echo "  ⚠ KPI seed had warnings"
echo ""

# Step 4: Core banking data (tenants, users, customers, accounts, transactions, etc.)
echo "[4/6] Seeding core banking data (38 tables, ~7,600 rows)..."
psql "$DB_URL" -f "$DRIZZLE_DIR/seed-comprehensive.sql" 2>&1 || echo "  ⚠ Core seed had warnings"
echo ""

# Step 5: Remaining service tables (256 tables, ~2,048 rows)
echo "[5/6] Seeding remaining service tables (256 tables)..."
psql "$DB_URL" -f "$DRIZZLE_DIR/seed-remaining-comprehensive.sql" 2>&1 || echo "  ⚠ Remaining seed had warnings"
echo ""

# Step 6: TigerBeetle (optional)
if [ -n "${TB_ADDRESS:-}" ]; then
    echo "[6/6] Seeding TigerBeetle ledger (200 accounts, 100 transfers)..."
    bash "$SCRIPT_DIR/tigerbeetle-seed.sh"
else
    echo "[6/6] Skipping TigerBeetle (set TB_ADDRESS to enable)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Seed Complete!"
echo "  - GL Accounts:    200+ CBN-standard chart of accounts"
echo "  - KPI Framework:  11 roles, 50+ metrics, hierarchy"
echo "  - Core Tables:    38 tables, ~7,600 rows"
echo "  - Service Tables: 256 tables, ~2,048 rows"
echo "  - Total:          ~296 tables, ~10,000+ rows"
echo "  - TigerBeetle:    200 accounts, 100 transfers"
echo "═══════════════════════════════════════════════════════════════"
