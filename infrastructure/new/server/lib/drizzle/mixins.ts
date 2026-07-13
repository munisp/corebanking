/**
 * Drizzle Schema Mixins — 54Bank Platform
 *
 * Reusable column groups that can be spread into any pgTable definition.
 * These enforce consistent patterns across all 308 tables.
 *
 * Usage:
 *   export const myTable = pgTable("my_table", {
 *     id: serial("id").primaryKey(),
 *     ...timestampMixin,
 *     ...softDeleteMixin,
 *     ...auditMixin,
 *     ...optimisticLockMixin,
 *     ...tenantMixin,
 *   });
 */
import {
  timestamp,
  varchar,
  integer,
  text,
  boolean,
} from "drizzle-orm/pg-core";

// ── Timestamp Mixin ───────────────────────────────────────────────────────────
// Standard createdAt / updatedAt columns for all tables.

export const timestampMixin = {
  createdAt: timestamp("createdAt", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
} as const;

// ── Soft Delete Mixin ─────────────────────────────────────────────────────────
// Adds deletedAt column. Records with a non-null deletedAt are considered deleted.
// Always filter with `isNull(table.deletedAt)` in queries.

export const softDeleteMixin = {
  deletedAt: timestamp("deletedAt", { withTimezone: true }),
} as const;

// ── Optimistic Locking Mixin ──────────────────────────────────────────────────
// Adds a version counter. Increment on every UPDATE.
// Concurrent updates to the same version will conflict (one will fail).
// Usage: WHERE id = $id AND version = $expectedVersion

export const optimisticLockMixin = {
  version: integer("version").default(1).notNull(),
} as const;

// ── Audit Mixin ───────────────────────────────────────────────────────────────
// Tracks who created and last modified a record.

export const auditMixin = {
  createdBy: varchar("createdBy", { length: 128 }),
  updatedBy: varchar("updatedBy", { length: 128 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
} as const;

// ── Tenant Mixin ──────────────────────────────────────────────────────────────
// Standard tenantId column for multi-tenant tables.

export const tenantMixin = {
  tenantId: varchar("tenantId", { length: 64 }).notNull(),
} as const;

// ── Combined Mixins ───────────────────────────────────────────────────────────

/** Full audit trail: timestamps + soft delete + optimistic lock + audit fields */
export const fullAuditMixin = {
  ...timestampMixin,
  ...softDeleteMixin,
  ...optimisticLockMixin,
  ...auditMixin,
} as const;

/** Standard entity mixin: timestamps + soft delete + optimistic lock */
export const entityMixin = {
  ...timestampMixin,
  ...softDeleteMixin,
  ...optimisticLockMixin,
} as const;

/** Tenant entity mixin: tenant + timestamps + soft delete + optimistic lock */
export const tenantEntityMixin = {
  ...tenantMixin,
  ...timestampMixin,
  ...softDeleteMixin,
  ...optimisticLockMixin,
} as const;

// ── Type Helpers ──────────────────────────────────────────────────────────────

/** Extracts the TypeScript type of a mixin for use in Insert/Select types */
export type TimestampMixin = typeof timestampMixin;
export type SoftDeleteMixin = typeof softDeleteMixin;
export type OptimisticLockMixin = typeof optimisticLockMixin;
export type AuditMixin = typeof auditMixin;
export type TenantMixin = typeof tenantMixin;
export type FullAuditMixin = typeof fullAuditMixin;
export type EntityMixin = typeof entityMixin;
export type TenantEntityMixin = typeof tenantEntityMixin;
