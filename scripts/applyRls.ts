#!/usr/bin/env tsx
/**
 * Apply Row-Level Security — 54Bank Platform
 *
 * Generates and applies PostgreSQL RLS policies for all tenant-scoped tables.
 * This script is idempotent — safe to run multiple times.
 *
 * Run: pnpm db:rls
 *
 * What it does:
 *   1. Enables RLS on all tenant-scoped tables
 *   2. Creates a tenant_isolation policy using app.current_tenant session variable
 *   3. Creates a service_role_bypass policy for migrations and admin operations
 *
 * Usage in application:
 *   Before any query: SET LOCAL app.current_tenant = '<tenantId>';
 *   Or use withTenant() from server/lib/drizzle/multiTenancy.ts
 */
import { generateRlsMigration, TENANT_SCOPED_TABLES } from "../server/lib/drizzle/multiTenancy";
import { writeFileSync } from "fs";
import { join } from "path";

const migrationSql = generateRlsMigration();
const outputPath = join(__dirname, "../drizzle/0010_rls_tenant_isolation.sql");

writeFileSync(outputPath, migrationSql, "utf-8");

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║         54Bank RLS Migration Generator                   ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`\n✅ Generated RLS migration: drizzle/0010_rls_tenant_isolation.sql`);
console.log(`\n📋 Tables with RLS enabled (${TENANT_SCOPED_TABLES.length}):`);
for (const table of TENANT_SCOPED_TABLES) {
  console.log(`   - ${table}`);
}
console.log(`\n🚀 Apply with: psql $DATABASE_URL -f drizzle/0010_rls_tenant_isolation.sql`);
console.log(`   Or run: pnpm db:migrate\n`);
