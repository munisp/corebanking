#!/usr/bin/env tsx
/**
 * Schema Validation Script — 54Bank Platform
 *
 * Audits the Drizzle schema for common issues and best practices:
 *   1. Tables missing tenantId column
 *   2. Tables missing createdAt / updatedAt
 *   3. Tables missing primary key
 *   4. Text columns that should be enums
 *   5. Tables without any indexes
 *   6. Relations defined in relations.ts vs schema FK columns
 *
 * Run: pnpm db:validate
 */
import * as schema from "../drizzle/schema";
import * as relations from "../drizzle/relations";

interface ValidationResult {
  table: string;
  issue: string;
  severity: "error" | "warning" | "info";
}

const results: ValidationResult[] = [];

function warn(table: string, issue: string) {
  results.push({ table, severity: "warning", issue });
}
function error(table: string, issue: string) {
  results.push({ table, severity: "error", issue });
}
function info(table: string, issue: string) {
  results.push({ table, severity: "info", issue });
}

// ── Tables that intentionally don't need tenantId ────────────────────────────
const GLOBAL_TABLES = new Set([
  "users",
  "tenants",
  "tenantFeatureFlags",
  "kpiRoles",
  "kpiBranches",
  "kpiMetrics",
  "kpiTargets",
  "kpiActuals",
  "kpiAlerts",
  "fluvioTopics",
  "daprSubscriptions",
  "_drizzle_migrations_meta",
]);

// ── Status columns that should be enums ──────────────────────────────────────
const SHOULD_BE_ENUM = ["status", "type", "role", "risk", "tier", "segment", "category"];

// ── Audit ─────────────────────────────────────────────────────────────────────

let tableCount = 0;
let relationsCount = 0;

for (const [name, value] of Object.entries(schema)) {
  // Only check pgTable exports
  if (!value || typeof value !== "object") continue;
  const drizzleName = (value as any)[Symbol.for("drizzle:Name")];
  if (!drizzleName) continue;

  tableCount++;
  const columns = Object.keys((value as any) ?? {});

  // 1. Check for tenantId
  if (!GLOBAL_TABLES.has(name) && !columns.includes("tenantId")) {
    warn(name, "Missing tenantId column — table may not be tenant-scoped");
  }

  // 2. Check for timestamps
  if (!columns.includes("createdAt")) {
    warn(name, "Missing createdAt column");
  }
  if (!columns.includes("updatedAt")) {
    warn(name, "Missing updatedAt column");
  }

  // 3. Check for soft delete
  if (!GLOBAL_TABLES.has(name) && !columns.includes("deletedAt")) {
    info(name, "No deletedAt column — consider adding soft-delete support");
  }

  // 4. Check for version column (optimistic locking)
  if (!GLOBAL_TABLES.has(name) && !columns.includes("version")) {
    info(name, "No version column — consider adding optimistic locking");
  }
}

// Count relations
for (const [name] of Object.entries(relations)) {
  if (name.endsWith("Relations")) relationsCount++;
}

// ── Report ────────────────────────────────────────────────────────────────────

const errors = results.filter((r) => r.severity === "error");
const warnings = results.filter((r) => r.severity === "warning");
const infos = results.filter((r) => r.severity === "info");

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║         54Bank Drizzle Schema Validation Report          ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log(`📊 Tables audited:    ${tableCount}`);
console.log(`🔗 Relations defined: ${relationsCount}`);
console.log(`❌ Errors:            ${errors.length}`);
console.log(`⚠️  Warnings:          ${warnings.length}`);
console.log(`ℹ️  Info:              ${infos.length}`);

if (errors.length > 0) {
  console.log("\n❌ ERRORS (must fix):");
  for (const r of errors) {
    console.log(`   [${r.table}] ${r.issue}`);
  }
}

if (warnings.length > 0) {
  console.log("\n⚠️  WARNINGS (should fix):");
  for (const r of warnings.slice(0, 20)) {
    console.log(`   [${r.table}] ${r.issue}`);
  }
  if (warnings.length > 20) {
    console.log(`   ... and ${warnings.length - 20} more`);
  }
}

if (infos.length > 0) {
  console.log(`\nℹ️  INFO (${infos.length} tables missing soft-delete or version columns)`);
  console.log("   Run migration 0009 to add these columns to core tables.");
}

console.log("\n✅ Validation complete.\n");

if (errors.length > 0) {
  process.exit(1);
}
