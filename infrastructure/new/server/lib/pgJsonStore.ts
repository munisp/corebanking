/**
 * W12-C3-P0: Shared Postgres persistence helper for monolith lib modules.
 *
 * Replaces module-level in-memory arrays/Maps with Postgres-authoritative
 * storage served through the server's existing drizzle pool (../db). Mirrors
 * the raw-sql-via-drizzle pattern of lib/glPipeline.ts (no second ORM).
 *
 * Two flavors:
 *  - ensureTables(): memoized CREATE TABLE IF NOT EXISTS at first use
 *    (fleet inline-migration pattern).
 *  - store*(): generic minimal-schema store
 *    (id TEXT PK, tenant_id TEXT, payload JSONB, created_at, updated_at)
 *    per the C3 register's minimal-column policy where the full domain
 *    schema is unknowable. Payload always round-trips the full domain object.
 *
 * All queries are parameterized via drizzle's sql template tag; the ONLY
 * interpolated values are validated table identifiers ([a-z0-9_]+).
 */
import { sql, SQL } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

const IDENT = /^[a-z][a-z0-9_]*$/;

function tableIdent(name: string): string {
  if (!IDENT.test(name)) {
    throw new Error(`pg-store: invalid table identifier '${name}'`);
  }
  return name;
}

/** Execute a parameterized query and return its rows. Fail-closed when no DB. */
export async function exec<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("pg-store: database unavailable (DATABASE_URL unset or pool not initialized)");
  }
  const result = await db.execute(query);
  return ((result as unknown as { rows?: T[] }).rows ?? []) as T[];
}

/**
 * Run statements inside ONE real database transaction (single pooled client).
 * Use for multi-statement writes (e.g. GL header + lines with a deferred
 * constraint trigger) — separate exec() calls may use different clients.
 */
export async function withTx(fn: (run: <T = Record<string, unknown>>(q: SQL) => Promise<T[]>) => Promise<void>): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("pg-store: database unavailable (DATABASE_URL unset or pool not initialized)");
  }
  await (db as unknown as { transaction: (cb: (tx: unknown) => Promise<void>) => Promise<void> }).transaction(async (tx) => {
    const run = async <T = Record<string, unknown>,>(q: SQL): Promise<T[]> => {
      const r = await (tx as { execute: (query: SQL) => Promise<unknown> }).execute(q);
      return ((r as { rows?: T[] }).rows ?? []) as T[];
    };
    await fn(run);
  });
}

// ─── Memoized inline migrations ─────────────────────────────────────────────

const ensured = new Map<string, Promise<void>>();

/**
 * Run DDL statements exactly once per process (per key). On failure the
 * memo is cleared so the next call retries — a transient DB outage must not
 * permanently disable table creation.
 */
export function ensureTables(key: string, ddl: string[]): Promise<void> {
  let p = ensured.get(key);
  if (!p) {
    p = (async () => {
      const db = await getDb();
      if (!db) {
        throw new Error("pg-store: database unavailable — cannot run inline migration");
      }
      for (const stmt of ddl) {
        await db.execute(sql.raw(stmt));
      }
    })();
    p.catch((err) => {
      ensured.delete(key);
      logger.error("pg-store: inline migration failed", { key, error: String(err) });
    });
    ensured.set(key, p);
  }
  return p;
}

// ─── Generic minimal-schema store ───────────────────────────────────────────

/** DDL for the register's minimal store schema. */
export function storeDDL(table: string): string[] {
  const t = tableIdent(table);
  return [
    `CREATE TABLE IF NOT EXISTS ${t} (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_${t}_tenant ON ${t}(tenant_id)`,
  ];
}

/** One-time seed: insert rows that do not exist yet (id conflict = skip). */
export async function storeSeed<T extends { id: string }>(
  table: string,
  items: T[],
  tenantOf: (item: T) => string,
): Promise<void> {
  const t = tableIdent(table);
  for (const item of items) {
    await exec(
      sql`INSERT INTO ${sql.raw(t)} (id, tenant_id, payload)
          VALUES (${item.id}, ${tenantOf(item)}, ${JSON.stringify(item)}::jsonb)
          ON CONFLICT (id) DO NOTHING`,
    );
  }
}

/** List all payloads (ascending creation order — matches array semantics). */
export async function storeList<T>(table: string): Promise<T[]> {
  const t = tableIdent(table);
  const rows = await exec<{ payload: T }>(
    sql`SELECT payload FROM ${sql.raw(t)} ORDER BY created_at ASC, id ASC`,
  );
  return rows.map((r) => r.payload);
}

export async function storeGet<T>(table: string, id: string): Promise<T | null> {
  const t = tableIdent(table);
  const rows = await exec<{ payload: T }>(
    sql`SELECT payload FROM ${sql.raw(t)} WHERE id = ${id}`,
  );
  return rows.length > 0 ? rows[0].payload : null;
}

export async function storeInsert<T extends { id: string }>(
  table: string,
  tenantId: string,
  item: T,
): Promise<void> {
  const t = tableIdent(table);
  await exec(
    sql`INSERT INTO ${sql.raw(t)} (id, tenant_id, payload)
        VALUES (${item.id}, ${tenantId}, ${JSON.stringify(item)}::jsonb)`,
  );
}

/** Replace the whole payload (read-modify-write semantics, updated_at bumped). */
export async function storeReplace<T>(table: string, id: string, item: T): Promise<void> {
  const t = tableIdent(table);
  await exec(
    sql`UPDATE ${sql.raw(t)} SET payload = ${JSON.stringify(item)}::jsonb, updated_at = NOW()
        WHERE id = ${id}`,
  );
}

export async function storeDelete(table: string, id: string): Promise<void> {
  const t = tableIdent(table);
  await exec(sql`DELETE FROM ${sql.raw(t)} WHERE id = ${id}`);
}
