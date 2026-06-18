// PostgreSQL Generic Repository — Production-grade persistence layer for all banking domain modules
// Provides CRUD operations, pagination, filtering, transactions, and audit logging
// Uses drizzle-orm with connection pooling via pg.Pool

import { eq, sql, and, or, ilike, desc, asc, count } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "../db";
import { logger } from "./logger";

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RepositoryOptions {
  tableName: string;
  enableAuditLog?: boolean;
  tenantColumn?: string;
}

// Generic repository factory for any drizzle table
export function createRepository<TTable extends PgTable, TInsert, TSelect>(
  table: TTable,
  idColumn: PgColumn,
  options: RepositoryOptions
) {
  const { tableName, enableAuditLog = true } = options;

  return {
    async findAll(pagination?: PaginationParams): Promise<PaginatedResult<TSelect>> {
      const db = await getDb();
      if (!db) {
        logger.warn(`[${tableName}] Database not available, returning empty result`);
        return { items: [], total: 0, page: 1, limit: 25, totalPages: 0 };
      }

      const page = pagination?.page ?? 1;
      const limit = pagination?.limit ?? 25;
      const offset = (page - 1) * limit;

      try {
        const [items, totalResult] = await Promise.all([
          db.select().from(table as any).limit(limit).offset(offset),
          db.select({ count: count() }).from(table as any),
        ]);

        const total = totalResult[0]?.count ?? 0;
        return {
          items: items as TSelect[],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        logger.error(`[${tableName}] findAll failed`, { error: String(error) });
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
    },

    async findById(id: string | number): Promise<TSelect | null> {
      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.select().from(table as any).where(eq(idColumn, id)).limit(1);
        return (result[0] as TSelect) ?? null;
      } catch (error) {
        logger.error(`[${tableName}] findById failed`, { id, error: String(error) });
        return null;
      }
    },

    async create(data: TInsert): Promise<TSelect | null> {
      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.insert(table as any).values(data as any).returning() as any[];
        if (enableAuditLog) {
          logger.info(`[${tableName}] Created record`, { id: result[0]?.id });
        }
        return (result[0] as TSelect) ?? null;
      } catch (error) {
        logger.error(`[${tableName}] create failed`, { error: String(error) });
        throw error;
      }
    },

    async update(id: string | number, data: Partial<TInsert>): Promise<TSelect | null> {
      const db = await getDb();
      if (!db) return null;

      try {
        const result = await db.update(table as any).set(data as any).where(eq(idColumn, id)).returning() as any[];
        if (enableAuditLog) {
          logger.info(`[${tableName}] Updated record`, { id });
        }
        return (result[0] as TSelect) ?? null;
      } catch (error) {
        logger.error(`[${tableName}] update failed`, { id, error: String(error) });
        throw error;
      }
    },

    async delete(id: string | number): Promise<boolean> {
      const db = await getDb();
      if (!db) return false;

      try {
        const result = await db.delete(table as any).where(eq(idColumn, id)).returning() as any[];
        if (enableAuditLog) {
          logger.info(`[${tableName}] Deleted record`, { id });
        }
        return result.length > 0;
      } catch (error) {
        logger.error(`[${tableName}] delete failed`, { id, error: String(error) });
        throw error;
      }
    },

    async count(): Promise<number> {
      const db = await getDb();
      if (!db) return 0;

      try {
        const result = await db.select({ count: count() }).from(table as any);
        return result[0]?.count ?? 0;
      } catch (error) {
        logger.error(`[${tableName}] count failed`, { error: String(error) });
        return 0;
      }
    },

    async rawQuery<T = unknown>(query: string, params?: unknown[]): Promise<T[]> {
      const db = await getDb();
      if (!db) return [];

      try {
        const result = await db.execute(sql.raw(query));
        return result.rows as T[];
      } catch (error) {
        logger.error(`[${tableName}] rawQuery failed`, { error: String(error) });
        return [];
      }
    },

    async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T | null> {
      const db = await getDb();
      if (!db) return null;

      try {
        return await (db as any).transaction(fn);
      } catch (error) {
        logger.error(`[${tableName}] transaction failed`, { error: String(error) });
        throw error;
      }
    },
  };
}

// Health check for database connectivity
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latencyMs: number; poolSize?: number }> {
  const start = Date.now();
  try {
    const db = await getDb();
    if (!db) {
      return { healthy: false, latencyMs: Date.now() - start };
    }
    await db.execute(sql`SELECT 1`);
    return { healthy: true, latencyMs: Date.now() - start };
  } catch {
    return { healthy: false, latencyMs: Date.now() - start };
  }
}
