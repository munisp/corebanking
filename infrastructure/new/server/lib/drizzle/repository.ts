/**
 * Type-Safe Drizzle Repository Pattern
 *
 * Generic repository factory that provides fully typed CRUD operations,
 * cursor-based pagination, batch operations, and transaction support.
 *
 * Usage:
 *   const customerRepo = createTypedRepository(customers, customers.customerId);
 *   const result = await customerRepo.findMany({ tenantId: 'tenant-1' }, { cursor: lastId, limit: 25 });
 */
import {
  type PgTable,
  type PgColumn,
  type TableConfig,
} from "drizzle-orm/pg-core";
import {
  eq,
  and,
  or,
  gt,
  lt,
  gte,
  lte,
  like,
  ilike,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  desc,
  asc,
  count,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "../../db";
import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | number | null;
  hasMore: boolean;
  total?: number;
}

export interface OffsetPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CursorPaginationOptions {
  cursor?: string | number | null;
  limit?: number;
  direction?: "asc" | "desc";
}

export interface OffsetPaginationOptions {
  page?: number;
  limit?: number;
}

export interface FilterOptions {
  [key: string]: unknown;
}

export interface SortOptions {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  filters?: FilterOptions;
  sort?: SortOptions;
  includeDeleted?: boolean;
}

// ── Repository Factory ────────────────────────────────────────────────────────

export function createTypedRepository<
  TTable extends PgTable<TableConfig>,
  TSelect extends Record<string, unknown>,
  TInsert extends Record<string, unknown>,
>(
  table: TTable,
  idColumn: PgColumn,
  options: {
    tableName: string;
    tenantColumn?: PgColumn;
    softDeleteColumn?: PgColumn;
    versionColumn?: PgColumn;
    updatedAtColumn?: PgColumn;
  }
) {
  const {
    tableName,
    tenantColumn,
    softDeleteColumn,
    versionColumn,
    updatedAtColumn,
  } = options;

  function buildBaseWhere(
    tenantId?: string,
    includeDeleted = false
  ): SQL | undefined {
    const conditions: SQL[] = [];
    if (tenantId && tenantColumn) {
      conditions.push(eq(tenantColumn, tenantId));
    }
    if (!includeDeleted && softDeleteColumn) {
      conditions.push(isNull(softDeleteColumn));
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  return {
    // ── Cursor-based pagination (O(1) at any offset) ──────────────────────────
    async findPage(
      tenantId: string | undefined,
      opts: CursorPaginationOptions = {}
    ): Promise<CursorPage<TSelect>> {
      const db = await getDb();
      if (!db) return { items: [], nextCursor: null, hasMore: false };

      const limit = Math.min(opts.limit ?? 25, 200);
      const direction = opts.direction ?? "asc";
      const baseWhere = buildBaseWhere(tenantId);

      let whereClause: SQL | undefined = baseWhere;
      if (opts.cursor != null) {
        const cursorCondition =
          direction === "asc"
            ? gt(idColumn, opts.cursor)
            : lt(idColumn, opts.cursor);
        whereClause = baseWhere
          ? and(baseWhere, cursorCondition)
          : cursorCondition;
      }

      try {
        const items = await db
          .select()
          .from(table as any)
          .where(whereClause)
          .orderBy(direction === "asc" ? asc(idColumn) : desc(idColumn))
          .limit(limit + 1); // fetch one extra to detect hasMore

        const hasMore = items.length > limit;
        const pageItems = hasMore ? items.slice(0, limit) : items;
        const nextCursor = hasMore
          ? (pageItems[pageItems.length - 1] as any)[idColumn.name] ?? null
          : null;

        return {
          items: pageItems as TSelect[],
          nextCursor,
          hasMore,
        };
      } catch (error) {
        logger.error(`[${tableName}] findPage failed`, { error: String(error) });
        return { items: [], nextCursor: null, hasMore: false };
      }
    },

    // ── Offset pagination ─────────────────────────────────────────────────────
    async findOffset(
      tenantId: string | undefined,
      opts: OffsetPaginationOptions = {}
    ): Promise<OffsetPage<TSelect>> {
      const db = await getDb();
      if (!db)
        return { items: [], total: 0, page: 1, limit: 25, totalPages: 0 };

      const page = Math.max(opts.page ?? 1, 1);
      const limit = Math.min(opts.limit ?? 25, 200);
      const offset = (page - 1) * limit;
      const whereClause = buildBaseWhere(tenantId);

      try {
        const [items, totalResult] = await Promise.all([
          db
            .select()
            .from(table as any)
            .where(whereClause)
            .orderBy(desc(idColumn))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: count() })
            .from(table as any)
            .where(whereClause),
        ]);

        const total = Number(totalResult[0]?.count ?? 0);
        return {
          items: items as TSelect[],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        logger.error(`[${tableName}] findOffset failed`, {
          error: String(error),
        });
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
    },

    // ── Find by primary key ───────────────────────────────────────────────────
    async findById(
      id: string | number,
      tenantId?: string
    ): Promise<TSelect | null> {
      const db = await getDb();
      if (!db) return null;

      const conditions: SQL[] = [eq(idColumn, id)];
      if (tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, tenantId));
      }
      if (softDeleteColumn) {
        conditions.push(isNull(softDeleteColumn));
      }

      try {
        const result = await db
          .select()
          .from(table as any)
          .where(and(...conditions))
          .limit(1);
        return (result[0] as TSelect) ?? null;
      } catch (error) {
        logger.error(`[${tableName}] findById failed`, {
          id,
          error: String(error),
        });
        return null;
      }
    },

    // ── Find by arbitrary column ──────────────────────────────────────────────
    async findBy(
      column: PgColumn,
      value: unknown,
      tenantId?: string
    ): Promise<TSelect[]> {
      const db = await getDb();
      if (!db) return [];

      const conditions: SQL[] = [eq(column, value)];
      if (tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, tenantId));
      }
      if (softDeleteColumn) {
        conditions.push(isNull(softDeleteColumn));
      }

      try {
        const result = await db
          .select()
          .from(table as any)
          .where(and(...conditions));
        return result as TSelect[];
      } catch (error) {
        logger.error(`[${tableName}] findBy failed`, { error: String(error) });
        return [];
      }
    },

    // ── Find many by IDs ──────────────────────────────────────────────────────
    async findByIds(
      ids: (string | number)[],
      tenantId?: string
    ): Promise<TSelect[]> {
      if (ids.length === 0) return [];
      const db = await getDb();
      if (!db) return [];

      const conditions: SQL[] = [inArray(idColumn, ids)];
      if (tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, tenantId));
      }

      try {
        const result = await db
          .select()
          .from(table as any)
          .where(and(...conditions));
        return result as TSelect[];
      } catch (error) {
        logger.error(`[${tableName}] findByIds failed`, {
          error: String(error),
        });
        return [];
      }
    },

    // ── Create ────────────────────────────────────────────────────────────────
    async create(data: TInsert): Promise<TSelect> {
      const db = await getDb();
      if (!db) throw new Error(`[${tableName}] Database not available`);

      try {
        const result = (await db
          .insert(table as any)
          .values(data as any)
          .returning()) as TSelect[];
        logger.info(`[${tableName}] Record created`, {
          id: (result[0] as any)?.[idColumn.name],
        });
        return result[0];
      } catch (error) {
        logger.error(`[${tableName}] create failed`, { error: String(error) });
        throw error;
      }
    },

    // ── Batch create ──────────────────────────────────────────────────────────
    async createMany(data: TInsert[]): Promise<TSelect[]> {
      if (data.length === 0) return [];
      const db = await getDb();
      if (!db) throw new Error(`[${tableName}] Database not available`);

      // Chunk into batches of 500 to avoid parameter limits
      const BATCH_SIZE = 500;
      const results: TSelect[] = [];

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        try {
          const batch = (await db
            .insert(table as any)
            .values(chunk as any)
            .returning()) as TSelect[];
          results.push(...batch);
        } catch (error) {
          logger.error(`[${tableName}] createMany batch failed`, {
            batchStart: i,
            error: String(error),
          });
          throw error;
        }
      }

      logger.info(`[${tableName}] Batch created ${results.length} records`);
      return results;
    },

    // ── Upsert ────────────────────────────────────────────────────────────────
    async upsert(
      data: TInsert,
      conflictTarget: PgColumn[],
      updateSet?: Partial<TInsert>
    ): Promise<TSelect> {
      const db = await getDb();
      if (!db) throw new Error(`[${tableName}] Database not available`);

      const set = updateSet ?? (data as Partial<TInsert>);
      try {
        const result = (await db
          .insert(table as any)
          .values(data as any)
          .onConflictDoUpdate({ target: conflictTarget, set: set as any })
          .returning()) as TSelect[];
        return result[0];
      } catch (error) {
        logger.error(`[${tableName}] upsert failed`, { error: String(error) });
        throw error;
      }
    },

    // ── Update with optimistic locking ────────────────────────────────────────
    async update(
      id: string | number,
      data: Partial<TInsert>,
      opts: { tenantId?: string; expectedVersion?: number } = {}
    ): Promise<TSelect | null> {
      const db = await getDb();
      if (!db) return null;

      const conditions: SQL[] = [eq(idColumn, id)];
      if (opts.tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, opts.tenantId));
      }
      if (opts.expectedVersion != null && versionColumn) {
        conditions.push(eq(versionColumn, opts.expectedVersion));
      }
      if (softDeleteColumn) {
        conditions.push(isNull(softDeleteColumn));
      }

      const updateData: Record<string, unknown> = { ...data };
      if (versionColumn) {
        updateData[versionColumn.name] = sql`${versionColumn} + 1`;
      }
      if (updatedAtColumn) {
        updateData[updatedAtColumn.name] = new Date();
      }

      try {
        const result = (await db
          .update(table as any)
          .set(updateData as any)
          .where(and(...conditions))
          .returning()) as TSelect[];

        if (result.length === 0 && opts.expectedVersion != null) {
          throw new Error(
            `[${tableName}] Optimistic lock conflict: version mismatch for id=${id}`
          );
        }

        logger.info(`[${tableName}] Record updated`, { id });
        return result[0] ?? null;
      } catch (error) {
        logger.error(`[${tableName}] update failed`, {
          id,
          error: String(error),
        });
        throw error;
      }
    },

    // ── Soft delete ───────────────────────────────────────────────────────────
    async softDelete(
      id: string | number,
      tenantId?: string
    ): Promise<boolean> {
      if (!softDeleteColumn) {
        throw new Error(
          `[${tableName}] softDelete called but no softDeleteColumn configured`
        );
      }
      const db = await getDb();
      if (!db) return false;

      const conditions: SQL[] = [eq(idColumn, id)];
      if (tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, tenantId));
      }

      const updateData: Record<string, unknown> = {
        [softDeleteColumn.name]: new Date(),
      };
      if (updatedAtColumn) {
        updateData[updatedAtColumn.name] = new Date();
      }

      try {
        const result = (await db
          .update(table as any)
          .set(updateData as any)
          .where(and(...conditions))
          .returning()) as TSelect[];
        logger.info(`[${tableName}] Record soft-deleted`, { id });
        return result.length > 0;
      } catch (error) {
        logger.error(`[${tableName}] softDelete failed`, {
          id,
          error: String(error),
        });
        throw error;
      }
    },

    // ── Hard delete ───────────────────────────────────────────────────────────
    async hardDelete(
      id: string | number,
      tenantId?: string
    ): Promise<boolean> {
      const db = await getDb();
      if (!db) return false;

      const conditions: SQL[] = [eq(idColumn, id)];
      if (tenantId && tenantColumn) {
        conditions.push(eq(tenantColumn, tenantId));
      }

      try {
        const result = (await db
          .delete(table as any)
          .where(and(...conditions))
          .returning()) as TSelect[];
        logger.info(`[${tableName}] Record hard-deleted`, { id });
        return result.length > 0;
      } catch (error) {
        logger.error(`[${tableName}] hardDelete failed`, {
          id,
          error: String(error),
        });
        throw error;
      }
    },

    // ── Count ─────────────────────────────────────────────────────────────────
    async count(tenantId?: string, includeDeleted = false): Promise<number> {
      const db = await getDb();
      if (!db) return 0;
      const whereClause = buildBaseWhere(tenantId, includeDeleted);
      try {
        const result = await db
          .select({ count: count() })
          .from(table as any)
          .where(whereClause);
        return Number(result[0]?.count ?? 0);
      } catch (error) {
        logger.error(`[${tableName}] count failed`, { error: String(error) });
        return 0;
      }
    },

    // ── Exists ────────────────────────────────────────────────────────────────
    async exists(id: string | number, tenantId?: string): Promise<boolean> {
      const item = await this.findById(id, tenantId);
      return item !== null;
    },

    // ── Typed transaction wrapper ─────────────────────────────────────────────
    async withTransaction<T>(
      fn: (tx: Awaited<ReturnType<typeof getDb>>) => Promise<T>
    ): Promise<T> {
      const db = await getDb();
      if (!db) throw new Error(`[${tableName}] Database not available`);
      return (db as any).transaction(fn);
    },

    // ── Raw SQL escape hatch ──────────────────────────────────────────────────
    async rawQuery<T = unknown>(
      query: SQL,
    ): Promise<T[]> {
      const db = await getDb();
      if (!db) return [];
      try {
        const result = await db.execute(query);
        return result.rows as T[];
      } catch (error) {
        logger.error(`[${tableName}] rawQuery failed`, {
          error: String(error),
        });
        return [];
      }
    },
  };
}
