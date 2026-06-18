"""PostgreSQL persistence adapter for Python microservices.

Provides STORAGE_MODE=memory|postgres switching. Each service gets its own schema.
Uses psycopg2 connection pooling with automatic table creation.
"""

import json
import os
import threading
import time
from typing import Any, Optional

STORAGE_MODE = os.environ.get("STORAGE_MODE", "memory")
POSTGRES_URL = os.environ.get("DATABASE_URL",
    os.environ.get("POSTGRES_URL",
    "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"))


class PgStore:
    """Unified storage with PostgreSQL persistence and in-memory fallback."""

    def __init__(self, schema: str):
        self.schema = schema
        self._lock = threading.RLock()
        self._tables: dict[str, list[dict]] = {}
        self._db = None
        self._pool_size = int(os.environ.get("DB_POOL_SIZE", "10"))

    def connect(self) -> bool:
        if STORAGE_MODE == "memory":
            print(f"[PgStore:{self.schema}] Running in memory-only mode")
            return True
        try:
            import psycopg2
            from psycopg2 import pool as pg_pool
            self._db = pg_pool.ThreadedConnectionPool(
                2, self._pool_size, POSTGRES_URL
            )
            conn = self._db.getconn()
            with conn.cursor() as cur:
                cur.execute(f"CREATE SCHEMA IF NOT EXISTS {self.schema}")
                conn.commit()
            self._db.putconn(conn)
            print(f"[PgStore:{self.schema}] Connected to PostgreSQL")
            return True
        except Exception as e:
            print(f"[PgStore:{self.schema}] Falling back to memory: {e}")
            self._db = None
            return True

    def ensure_table(self, table: str):
        if self._db is None:
            return
        try:
            conn = self._db.getconn()
            with conn.cursor() as cur:
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {self.schema}.{table}_store (
                        id TEXT PRIMARY KEY,
                        data JSONB NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS idx_{self.schema}_{table}_created
                    ON {self.schema}.{table}_store (created_at DESC)
                """)
                conn.commit()
            self._db.putconn(conn)
        except Exception as e:
            print(f"[PgStore:{self.schema}] Table creation error: {e}")

    def insert(self, table: str, record: dict) -> dict:
        with self._lock:
            key = f"{self.schema}.{table}"
            record["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            record["updated_at"] = record["created_at"]
            self._tables.setdefault(key, []).append(record)

            if self._db is not None:
                try:
                    conn = self._db.getconn()
                    with conn.cursor() as cur:
                        cur.execute(
                            f"INSERT INTO {self.schema}.{table}_store (id, data) "
                            f"VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET data = %s, updated_at = NOW()",
                            (record.get("id", ""), json.dumps(record), json.dumps(record))
                        )
                        conn.commit()
                    self._db.putconn(conn)
                except Exception as e:
                    print(f"[PgStore:{self.schema}] Insert fallback: {e}")
            return record

    def update(self, table: str, record_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            key = f"{self.schema}.{table}"
            for rec in self._tables.get(key, []):
                if rec.get("id") == record_id:
                    rec.update(updates)
                    rec["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                    if self._db is not None:
                        try:
                            conn = self._db.getconn()
                            with conn.cursor() as cur:
                                cur.execute(
                                    f"UPDATE {self.schema}.{table}_store SET data = %s, updated_at = NOW() WHERE id = %s",
                                    (json.dumps(rec), record_id)
                                )
                                conn.commit()
                            self._db.putconn(conn)
                        except Exception:
                            pass
                    return rec
            return None

    def delete(self, table: str, record_id: str) -> bool:
        with self._lock:
            key = f"{self.schema}.{table}"
            items = self._tables.get(key, [])
            for i, rec in enumerate(items):
                if rec.get("id") == record_id:
                    items.pop(i)
                    if self._db is not None:
                        try:
                            conn = self._db.getconn()
                            with conn.cursor() as cur:
                                cur.execute(f"DELETE FROM {self.schema}.{table}_store WHERE id = %s", (record_id,))
                                conn.commit()
                            self._db.putconn(conn)
                        except Exception:
                            pass
                    return True
            return False

    def find_by_id(self, table: str, record_id: str) -> Optional[dict]:
        with self._lock:
            key = f"{self.schema}.{table}"
            for rec in self._tables.get(key, []):
                if rec.get("id") == record_id:
                    return rec
            return None

    def find_all(self, table: str, page: int = 1, limit: int = 25,
                 sort_by: str = "id", sort_dir: str = "asc",
                 filters: Optional[dict] = None) -> tuple[list[dict], int]:
        with self._lock:
            key = f"{self.schema}.{table}"
            items = list(self._tables.get(key, []))

            # Apply filters
            if filters:
                for field, value in filters.items():
                    if value:
                        items = [i for i in items if str(i.get(field, "")).lower() == str(value).lower()]

            total = len(items)

            # Sort
            reverse = sort_dir.lower() == "desc"
            items.sort(key=lambda x: str(x.get(sort_by, "")), reverse=reverse)

            # Paginate
            start = (page - 1) * limit
            return items[start:start + limit], total

    def count(self, table: str) -> int:
        with self._lock:
            key = f"{self.schema}.{table}"
            return len(self._tables.get(key, []))

    def seed(self, table: str, records: list[dict]):
        """Bulk seed data into a table."""
        for rec in records:
            self.insert(table, rec)

    def close(self):
        if self._db is not None:
            self._db.closeall()
