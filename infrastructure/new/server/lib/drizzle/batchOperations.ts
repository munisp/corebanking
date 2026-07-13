/**
 * Batch Operations — 54Bank Platform
 *
 * High-throughput batch database operations using Drizzle ORM.
 * Handles chunking, error isolation, and progress reporting for
 * bulk data processing (EOD batch jobs, data migrations, bulk imports).
 *
 * Features:
 *   - Automatic chunking to stay within PostgreSQL parameter limits (65535)
 *   - Parallel chunk execution with configurable concurrency
 *   - Per-chunk error isolation (failed chunks don't abort successful ones)
 *   - Progress callbacks for long-running operations
 *   - Idempotent upserts with conflict resolution
 *
 * Usage:
 *   const result = await batchInsert(transactions, txData, {
 *     chunkSize: 500,
 *     concurrency: 3,
 *     onProgress: (done, total) => logger.info(`${done}/${total}`),
 *   });
 */
import { type PgTable, type TableConfig } from "drizzle-orm/pg-core";
import { type PgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { logger } from "./logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchOptions {
  /** Number of rows per INSERT statement. Default: 500 */
  chunkSize?: number;
  /** Max concurrent chunk operations. Default: 3 */
  concurrency?: number;
  /** Called after each chunk completes */
  onProgress?: (completed: number, total: number) => void;
  /** If true, errors in individual chunks are collected instead of thrown */
  continueOnError?: boolean;
}

export interface BatchResult {
  inserted: number;
  failed: number;
  errors: Array<{ chunkIndex: number; error: string }>;
  durationMs: number;
}

// ── Batch Insert ──────────────────────────────────────────────────────────────

/**
 * Inserts a large array of records in chunks.
 * Uses onConflictDoNothing() by default (idempotent).
 */
export async function batchInsert<
  TTable extends PgTable<TableConfig>,
  TInsert extends Record<string, unknown>,
>(
  table: TTable,
  records: TInsert[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const start = Date.now();
  const chunkSize = options.chunkSize ?? 500;
  const concurrency = options.concurrency ?? 3;
  const continueOnError = options.continueOnError ?? false;

  const db = await getDb();
  if (!db) throw new Error("[BatchOps] Database not available");

  if (records.length === 0) {
    return { inserted: 0, failed: 0, errors: [], durationMs: 0 };
  }

  // Split into chunks
  const chunks: TInsert[][] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  let inserted = 0;
  let failed = 0;
  const errors: BatchResult["errors"] = [];

  // Process chunks with limited concurrency
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (chunk, batchIdx) => {
        const chunkIdx = i + batchIdx;
        try {
          await db
            .insert(table as any)
            .values(chunk as any)
            .onConflictDoNothing();
          return chunk.length;
        } catch (error) {
          const msg = String(error);
          logger.error(`[BatchOps] Chunk ${chunkIdx} failed`, { error: msg });
          if (!continueOnError) throw error;
          errors.push({ chunkIndex: chunkIdx, error: msg });
          return 0;
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        inserted += result.value;
      } else {
        failed += chunkSize;
        if (!continueOnError) throw result.reason;
      }
    }

    options.onProgress?.(Math.min(i + concurrency, chunks.length) * chunkSize, records.length);
  }

  const durationMs = Date.now() - start;
  logger.info(`[BatchOps] Batch insert complete`, {
    total: records.length,
    inserted,
    failed,
    durationMs,
  });

  return { inserted, failed, errors, durationMs };
}

// ── Batch Upsert ──────────────────────────────────────────────────────────────

/**
 * Upserts a large array of records in chunks.
 * Conflict resolution: update all non-key columns.
 */
export async function batchUpsert<
  TTable extends PgTable<TableConfig>,
  TInsert extends Record<string, unknown>,
>(
  table: TTable,
  records: TInsert[],
  conflictColumns: PgColumn[],
  updateColumns: (keyof TInsert)[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const start = Date.now();
  const chunkSize = options.chunkSize ?? 500;
  const concurrency = options.concurrency ?? 3;

  const db = await getDb();
  if (!db) throw new Error("[BatchOps] Database not available");

  if (records.length === 0) {
    return { inserted: 0, failed: 0, errors: [], durationMs: 0 };
  }

  const chunks: TInsert[][] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  let inserted = 0;
  let failed = 0;
  const errors: BatchResult["errors"] = [];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (chunk, batchIdx) => {
        const chunkIdx = i + batchIdx;
        try {
          // Build update set from the first record's keys
          const updateSet: Record<string, unknown> = {};
          for (const col of updateColumns) {
            updateSet[col as string] = sql.raw(`EXCLUDED."${col as string}"`);
          }
          updateSet["updatedAt"] = sql`NOW()`;

          await db
            .insert(table as any)
            .values(chunk as any)
            .onConflictDoUpdate({
              target: conflictColumns,
              set: updateSet as any,
            });
          return chunk.length;
        } catch (error) {
          const msg = String(error);
          logger.error(`[BatchOps] Upsert chunk ${chunkIdx} failed`, { error: msg });
          errors.push({ chunkIndex: chunkIdx, error: msg });
          return 0;
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        inserted += result.value;
      } else {
        failed += chunkSize;
      }
    }

    options.onProgress?.(Math.min(i + concurrency, chunks.length) * chunkSize, records.length);
  }

  const durationMs = Date.now() - start;
  logger.info(`[BatchOps] Batch upsert complete`, {
    total: records.length,
    inserted,
    failed,
    durationMs,
  });

  return { inserted, failed, errors, durationMs };
}

// ── Batch Delete ──────────────────────────────────────────────────────────────

/**
 * Deletes records by IDs in chunks.
 */
export async function batchDelete<TTable extends PgTable<TableConfig>>(
  table: TTable,
  idColumn: PgColumn,
  ids: (string | number)[],
  options: BatchOptions = {}
): Promise<BatchResult> {
  const start = Date.now();
  const chunkSize = options.chunkSize ?? 1000;
  const db = await getDb();
  if (!db) throw new Error("[BatchOps] Database not available");

  if (ids.length === 0) {
    return { inserted: 0, failed: 0, errors: [], durationMs: 0 };
  }

  const { inArray } = await import("drizzle-orm");
  let deleted = 0;
  const errors: BatchResult["errors"] = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const result = await db
        .delete(table as any)
        .where(inArray(idColumn, chunk))
        .returning();
      deleted += result.length;
    } catch (error) {
      const msg = String(error);
      errors.push({ chunkIndex: Math.floor(i / chunkSize), error: msg });
    }
    options.onProgress?.(Math.min(i + chunkSize, ids.length), ids.length);
  }

  return { inserted: deleted, failed: errors.length * chunkSize, errors, durationMs: Date.now() - start };
}

// ── Streaming Query ───────────────────────────────────────────────────────────

/**
 * Processes a large table in pages without loading everything into memory.
 * Uses cursor-based pagination for O(1) performance at any offset.
 */
export async function* streamQuery<TTable extends PgTable<TableConfig>>(
  table: TTable,
  idColumn: PgColumn,
  pageSize = 1000
): AsyncGenerator<unknown[]> {
  const { gt, asc } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return;

  let cursor: string | number | null = null;

  while (true) {
    const conditions = cursor != null ? gt(idColumn, cursor) : undefined;

    const rows = await db
      .select()
      .from(table as any)
      .where(conditions)
      .orderBy(asc(idColumn))
      .limit(pageSize);

    if (rows.length === 0) break;

    yield rows;

    if (rows.length < pageSize) break;
    cursor = (rows[rows.length - 1] as any)[idColumn.name];
  }
}
