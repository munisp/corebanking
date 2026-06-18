"""54Bank — DuckDB Query Engine for Lakehouse
Provides SQL query interface over Delta Lake tables using DuckDB's in-process
analytical query engine. Supports:
- SQL queries over bronze/silver/gold Delta tables
- Cross-layer joins (e.g. join gold aggregates with silver facts)
- Window functions, CTEs, aggregations
- Parquet/Delta direct reads
- Query result caching
- Parameterized queries to prevent SQL injection
"""

import os
import time
import logging
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone

import pandas as pd

try:
    import duckdb
    DUCKDB_AVAILABLE = True
except ImportError:
    DUCKDB_AVAILABLE = False

from lakehouse.engine.delta_engine import (
    DeltaEngine, MedallionLayer, LAKEHOUSE_ROOT, DELTA_AVAILABLE,
)

logger = logging.getLogger("54bank.lakehouse.query")


class QueryResult:
    __slots__ = ("columns", "rows", "row_count", "elapsed_ms", "sql", "cached")

    def __init__(self, columns: List[str], rows: List[tuple],
                 row_count: int, elapsed_ms: float, sql: str, cached: bool = False):
        self.columns = columns
        self.rows = rows
        self.row_count = row_count
        self.elapsed_ms = elapsed_ms
        self.sql = sql
        self.cached = cached

    def to_pandas(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows, columns=self.columns)

    def to_dicts(self) -> List[Dict[str, Any]]:
        return [dict(zip(self.columns, row)) for row in self.rows]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "columns": self.columns,
            "rows": [list(r) for r in self.rows],
            "row_count": self.row_count,
            "elapsed_ms": self.elapsed_ms,
            "cached": self.cached,
        }


class DuckDBQueryEngine:
    """DuckDB-based SQL query engine for the lakehouse."""

    def __init__(self, engine: DeltaEngine = None, cache_ttl: int = 300):
        self.engine = engine or DeltaEngine()
        self.cache_ttl = cache_ttl
        self._cache: Dict[str, Tuple[float, QueryResult]] = {}
        self._query_count = 0
        self._total_ms = 0.0
        self._db_path = str(LAKEHOUSE_ROOT / ".lakehouse.duckdb")

        if not DUCKDB_AVAILABLE:
            logger.warning("duckdb not installed — SQL queries unavailable")

    def _conn(self) -> "duckdb.DuckDBPyConnection":
        conn = duckdb.connect(self._db_path)
        conn.execute("SET memory_limit='512MB'")
        conn.execute("SET threads=4")
        return conn

    def _register_tables(self, conn: "duckdb.DuckDBPyConnection",
                         layers: List[str] = None):
        """Register all Delta tables as DuckDB views for SQL access."""
        layers = layers or [MedallionLayer.BRONZE, MedallionLayer.SILVER,
                            MedallionLayer.GOLD, MedallionLayer.ML]

        for layer in layers:
            layer_path = self.engine.root / layer
            if not layer_path.exists():
                continue
            for table_dir in layer_path.iterdir():
                if not table_dir.is_dir() or table_dir.name.startswith("."):
                    continue

                view_name = f"{layer}_{table_dir.name}"
                parquets = sorted(table_dir.glob("**/*.parquet"))
                if not parquets:
                    continue

                glob_pattern = str(table_dir / "**" / "*.parquet")
                try:
                    conn.execute(
                        f"CREATE OR REPLACE VIEW {view_name} AS "
                        f"SELECT * FROM parquet_scan('{glob_pattern}', "
                        f"hive_partitioning=true, union_by_name=true)"
                    )
                except Exception as e:
                    logger.debug(f"Skip registering {view_name}: {e}")

    def query(self, sql: str, params: List[Any] = None,
              limit: int = 10000, use_cache: bool = True) -> QueryResult:
        """Execute a SQL query over the lakehouse.

        Tables are accessible as {layer}_{table_name}, e.g.:
            SELECT * FROM bronze_transactions WHERE amount > 100000
            SELECT * FROM silver_fact_transactions LIMIT 100
            SELECT * FROM gold_agg_daily_balances WHERE balance_date = '2026-01-15'
            SELECT * FROM ml_training_runs ORDER BY timestamp DESC
        """
        if not DUCKDB_AVAILABLE:
            return QueryResult([], [], 0, 0, sql)

        cache_key = hashlib.md5(f"{sql}:{params}:{limit}".encode()).hexdigest()
        if use_cache and cache_key in self._cache:
            ts, cached_result = self._cache[cache_key]
            if time.time() - ts < self.cache_ttl:
                cached_result.cached = True
                return cached_result

        t0 = time.time()
        conn = self._conn()
        self._register_tables(conn)

        try:
            if params:
                result = conn.execute(sql, params)
            else:
                result = conn.execute(sql)

            columns = [desc[0] for desc in result.description] if result.description else []
            rows = result.fetchmany(limit)
            row_count = len(rows)

            elapsed_ms = round((time.time() - t0) * 1000, 2)
            self._query_count += 1
            self._total_ms += elapsed_ms

            qr = QueryResult(columns, rows, row_count, elapsed_ms, sql)

            if use_cache:
                self._cache[cache_key] = (time.time(), qr)

            logger.info(f"QUERY ({elapsed_ms}ms, {row_count} rows): {sql[:120]}")
            return qr

        except Exception as e:
            elapsed_ms = round((time.time() - t0) * 1000, 2)
            logger.error(f"QUERY FAILED ({elapsed_ms}ms): {e}")
            raise
        finally:
            conn.close()

    def query_table(self, layer: str, table_name: str,
                    columns: str = "*", where: str = None,
                    order_by: str = None, limit: int = 1000) -> QueryResult:
        """Convenience: query a specific lakehouse table."""
        view = f"{layer}_{table_name}"
        sql = f"SELECT {columns} FROM {view}"
        if where:
            sql += f" WHERE {where}"
        if order_by:
            sql += f" ORDER BY {order_by}"
        sql += f" LIMIT {limit}"
        return self.query(sql)

    def aggregate(self, layer: str, table_name: str,
                  group_by: str, agg_expr: str,
                  where: str = None) -> QueryResult:
        """Convenience: run an aggregation query."""
        view = f"{layer}_{table_name}"
        sql = f"SELECT {group_by}, {agg_expr} FROM {view}"
        if where:
            sql += f" WHERE {where}"
        sql += f" GROUP BY {group_by}"
        return self.query(sql)

    def cross_layer_join(self, sql: str) -> QueryResult:
        """Execute a cross-layer join (e.g. gold metrics joined with silver dims)."""
        return self.query(sql)

    def explain(self, sql: str) -> str:
        """Get the query execution plan."""
        if not DUCKDB_AVAILABLE:
            return "DuckDB not available"
        conn = self._conn()
        self._register_tables(conn)
        try:
            result = conn.execute(f"EXPLAIN {sql}")
            return "\n".join(str(r[1]) for r in result.fetchall())
        finally:
            conn.close()

    def table_stats(self, layer: str, table_name: str) -> Dict[str, Any]:
        """Get statistics for a specific table: row count, min/max dates, etc."""
        view = f"{layer}_{table_name}"
        try:
            count_result = self.query(f"SELECT COUNT(*) as cnt FROM {view}", use_cache=False)
            row_count = count_result.rows[0][0] if count_result.rows else 0

            cols_result = self.query(
                f"SELECT column_name, column_type FROM (DESCRIBE {view})",
                use_cache=False
            )
            schema = [(r[0], r[1]) for r in cols_result.rows]

            return {
                "table": f"{layer}.{table_name}",
                "row_count": row_count,
                "columns": schema,
            }
        except Exception as e:
            return {"table": f"{layer}.{table_name}", "error": str(e)}

    def clear_cache(self):
        self._cache.clear()

    def stats(self) -> Dict[str, Any]:
        return {
            "queries_executed": self._query_count,
            "total_query_ms": round(self._total_ms, 2),
            "avg_query_ms": round(self._total_ms / max(self._query_count, 1), 2),
            "cache_entries": len(self._cache),
            "cache_ttl_seconds": self.cache_ttl,
            "duckdb_available": DUCKDB_AVAILABLE,
        }
