/**
 * Database Performance Layer — Query optimization, read replica routing,
 * prepared statements, connection health monitoring.
 */
import type { Express, Request, Response, NextFunction } from "express";
import pg from "pg";
import { logger } from "./logger";

// ── Read Replica Pool ────────────────────────────────────

let _readPool: pg.Pool | null = null;

function getReadPool(): pg.Pool | null {
  if (_readPool) return _readPool;

  const replicaUrl = process.env.DATABASE_REPLICA_URL;
  if (!replicaUrl) return null;

  _readPool = new pg.Pool({
    connectionString: replicaUrl,
    max: 15,
    min: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "54bank-read-replica",
  } as any);

  _readPool.on("error", (err) => {
    logger.warn("Read replica pool error, falling back to primary", { error: String(err) });
    _readPool = null;
  });

  return _readPool;
}

// ── Prepared Statement Cache ─────────────────────────────

interface PreparedQuery {
  name: string;
  text: string;
  lastUsed: number;
  executionCount: number;
  avgTimeMs: number;
}

const preparedStatements = new Map<string, PreparedQuery>();
const PREPARED_STMT_TTL = 600_000; // 10 minutes

function getPreparedName(sql: string): string {
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    const chr = sql.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `ps_${Math.abs(hash).toString(36)}`;
}

// ── Query Router (read/write splitting) ──────────────────

function isReadQuery(sql: string): boolean {
  const upper = sql.trim().toUpperCase();
  return upper.startsWith("SELECT") && !upper.includes("FOR UPDATE") && !upper.includes("FOR SHARE");
}

export async function executeQuery(
  pool: pg.Pool,
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult> {
  const readPool = getReadPool();
  const targetPool = readPool && isReadQuery(sql) ? readPool : pool;

  const stmtName = getPreparedName(sql);
  let stmt = preparedStatements.get(stmtName);

  if (!stmt) {
    stmt = {
      name: stmtName,
      text: sql,
      lastUsed: Date.now(),
      executionCount: 0,
      avgTimeMs: 0,
    };
    preparedStatements.set(stmtName, stmt);
  }

  const startTime = performance.now();

  try {
    const result = await targetPool.query({
      name: stmtName,
      text: sql,
      values: params,
    });

    const elapsed = performance.now() - startTime;
    stmt.executionCount++;
    stmt.avgTimeMs = (stmt.avgTimeMs * (stmt.executionCount - 1) + elapsed) / stmt.executionCount;
    stmt.lastUsed = Date.now();

    // Log slow queries (> 100ms)
    if (elapsed > 100) {
      logger.warn("Slow query detected", {
        query: sql.substring(0, 200),
        timeMs: Math.round(elapsed),
        rows: result.rowCount,
        source: targetPool === readPool ? "replica" : "primary",
      });
    }

    return result;
  } catch (err) {
    // If replica fails, retry on primary
    if (targetPool === readPool) {
      logger.warn("Read replica query failed, retrying on primary", { error: String(err) });
      return pool.query({ name: `${stmtName}_primary`, text: sql, values: params });
    }
    throw err;
  }
}

// ── Prepared Statement Cleanup ───────────────────────────

function cleanupPreparedStatements(): void {
  const now = Date.now();
  preparedStatements.forEach((stmt, key) => {
    if (now - stmt.lastUsed > PREPARED_STMT_TTL) {
      preparedStatements.delete(key);
    }
  });
}

setInterval(cleanupPreparedStatements, 60_000);

// ── Connection Health Monitor ────────────────────────────

interface PoolHealth {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  activeCount: number;
  maxConnections: number;
  utilizationPct: number;
  status: "healthy" | "saturated" | "degraded" | "down";
}

function getPoolHealth(pool: pg.Pool): PoolHealth {
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const waiting = pool.waitingCount;
  const active = total - idle;
  const max = (pool as any).options?.max ?? 20;
  const utilization = max > 0 ? (active / max) * 100 : 0;

  let status: PoolHealth["status"] = "healthy";
  if (waiting > 0) status = "saturated";
  if (utilization > 90) status = "degraded";
  if (total === 0) status = "down";

  return {
    totalCount: total,
    idleCount: idle,
    waitingCount: waiting,
    activeCount: active,
    maxConnections: max,
    utilizationPct: Math.round(utilization * 10) / 10,
    status,
  };
}

// ── Batch Query Helper ───────────────────────────────────

export async function executeBatch(
  pool: pg.Pool,
  queries: Array<{ sql: string; params?: unknown[] }>
): Promise<pg.QueryResult[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const results: pg.QueryResult[] = [];
    for (const q of queries) {
      results.push(await client.query(q.sql, q.params));
    }
    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ── Performance Endpoints ────────────────────────────────

export function registerDbPerformanceEndpoints(app: Express, pool: pg.Pool): void {

  // Pool health status
  app.get("/api/db/health", (_req: Request, res: Response) => {
    const primary = getPoolHealth(pool);
    const readPool = getReadPool();
    const replica = readPool ? getPoolHealth(readPool) : null;

    const stmtStats = Array.from(preparedStatements.values())
      .sort((a, b) => b.executionCount - a.executionCount)
      .slice(0, 20)
      .map((s) => ({
        name: s.name,
        query: s.text.substring(0, 100),
        executions: s.executionCount,
        avgMs: Math.round(s.avgTimeMs * 100) / 100,
      }));

    res.json({
      primary,
      replica,
      preparedStatements: {
        total: preparedStatements.size,
        topQueries: stmtStats,
      },
      readReplicaEnabled: !!readPool,
    });
  });

  // Query explain plan
  app.get("/api/db/explain", async (req: Request, res: Response) => {
    const query = req.query.q as string;
    if (!query) {
      res.status(400).json({ error: "Missing ?q= parameter" });
      return;
    }

    try {
      const result = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
      res.json({
        plan: result.rows[0]["QUERY PLAN"],
        source: "primary",
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Slow query log
  app.get("/api/db/slow-queries", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT query, calls, mean_exec_time, total_exec_time, rows,
               shared_blks_hit, shared_blks_read,
               ROUND(shared_blks_hit::numeric / NULLIF(shared_blks_hit + shared_blks_read, 0) * 100, 2) AS hit_ratio
        FROM pg_stat_statements
        WHERE mean_exec_time > 10
        ORDER BY mean_exec_time DESC
        LIMIT 25
      `);
      res.json({ slowQueries: result.rows });
    } catch (err) {
      // pg_stat_statements may not be enabled
      res.json({ slowQueries: [], note: "pg_stat_statements not available" });
    }
  });

  // Table statistics
  app.get("/api/db/table-stats", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT schemaname, relname AS table_name,
               n_live_tup AS row_count,
               n_dead_tup AS dead_rows,
               ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_pct,
               last_vacuum, last_autovacuum, last_analyze, last_autoanalyze,
               seq_scan, seq_tup_read, idx_scan, idx_tup_fetch
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 50
      `);
      res.json({ tables: result.rows });
    } catch (err) {
      res.json({ tables: [], error: String(err) });
    }
  });

  // Index usage
  app.get("/api/db/index-stats", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT schemaname, relname AS table_name, indexrelname AS index_name,
               idx_scan AS scans, idx_tup_read AS tuples_read,
               idx_tup_fetch AS tuples_fetched,
               pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
        FROM pg_stat_user_indexes
        ORDER BY idx_scan DESC
        LIMIT 50
      `);
      res.json({ indexes: result.rows });
    } catch (err) {
      res.json({ indexes: [], error: String(err) });
    }
  });

  // Cache hit ratio
  app.get("/api/db/cache-stats", async (_req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          SUM(heap_blks_read) AS heap_read,
          SUM(heap_blks_hit) AS heap_hit,
          ROUND(SUM(heap_blks_hit)::numeric / NULLIF(SUM(heap_blks_hit) + SUM(heap_blks_read), 0) * 100, 2) AS cache_hit_ratio
        FROM pg_statio_user_tables
      `);
      res.json({
        cacheHitRatio: result.rows[0]?.cache_hit_ratio ?? 0,
        heapRead: result.rows[0]?.heap_read ?? 0,
        heapHit: result.rows[0]?.heap_hit ?? 0,
        recommendation: parseFloat(result.rows[0]?.cache_hit_ratio ?? "0") < 99
          ? "Cache hit ratio below 99% — consider increasing shared_buffers"
          : "Cache hit ratio healthy",
      });
    } catch (err) {
      res.json({ cacheHitRatio: 0, error: String(err) });
    }
  });
}
