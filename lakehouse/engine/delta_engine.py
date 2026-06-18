"""54Bank — Delta Lake Engine
Core engine for all Delta Lake operations: read, write, merge, time-travel,
schema evolution, compaction, and vacuum.

Storage layout:
    {LAKEHOUSE_ROOT}/
    ├── bronze/           # Raw ingested data (append-only)
    │   ├── transactions/
    │   ├── accounts/
    │   ├── customers/
    │   ├── loans/
    │   ├── payments/
    │   ├── kyc_events/
    │   ├── aml_alerts/
    │   └── audit_log/
    ├── silver/           # Cleaned, deduplicated, typed
    │   ├── fact_transactions/
    │   ├── fact_loans/
    │   ├── fact_payments/
    │   ├── dim_customers/
    │   ├── dim_accounts/
    │   ├── dim_branches/
    │   └── dim_products/
    ├── gold/             # Business-ready aggregates
    │   ├── agg_daily_balances/
    │   ├── agg_corridor_metrics/
    │   ├── agg_risk_scores/
    │   ├── agg_regulatory_reports/
    │   ├── agg_kpi_metrics/
    │   └── agg_revenue/
    └── ml/               # ML pipeline tables (existing)
        ├── training_runs/
        ├── model_registry/
        └── feature_store/
"""

import os
import json
import logging
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

try:
    from deltalake import DeltaTable, write_deltalake
    DELTA_AVAILABLE = True
except ImportError:
    DELTA_AVAILABLE = False

logger = logging.getLogger("54bank.lakehouse.engine")

LAKEHOUSE_ROOT = Path(os.getenv(
    "LAKEHOUSE_ROOT",
    str(Path(__file__).parent.parent.parent / "lakehouse_data")
))

S3_ENDPOINT = os.getenv("LAKEHOUSE_S3_ENDPOINT", "")
S3_BUCKET = os.getenv("LAKEHOUSE_S3_BUCKET", "54bank-lakehouse")
S3_ACCESS_KEY = os.getenv("LAKEHOUSE_S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.getenv("LAKEHOUSE_S3_SECRET_KEY", "")


class MedallionLayer:
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    ML = "ml"


MEDALLION_TABLES = {
    MedallionLayer.BRONZE: [
        "transactions", "accounts", "customers", "loans", "payments",
        "kyc_events", "aml_alerts", "audit_log", "gl_entries",
        "fx_rates", "cards", "transfers", "disputes",
    ],
    MedallionLayer.SILVER: [
        "fact_transactions", "fact_loans", "fact_payments", "fact_gl_entries",
        "fact_transfers", "fact_cards",
        "dim_customers", "dim_accounts", "dim_branches", "dim_products",
        "dim_gl_codes",
    ],
    MedallionLayer.GOLD: [
        "agg_daily_balances", "agg_corridor_metrics", "agg_risk_scores",
        "agg_regulatory_reports", "agg_kpi_metrics", "agg_revenue",
        "agg_customer_360", "agg_branch_performance",
    ],
}


def _storage_options() -> Dict[str, str]:
    if S3_ENDPOINT and S3_ACCESS_KEY:
        return {
            "AWS_ENDPOINT_URL": S3_ENDPOINT,
            "AWS_ACCESS_KEY_ID": S3_ACCESS_KEY,
            "AWS_SECRET_ACCESS_KEY": S3_SECRET_KEY,
            "AWS_REGION": "us-east-1",
            "AWS_ALLOW_HTTP": "true",
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
        }
    return {}


def _table_path(layer: str, table_name: str) -> str:
    if S3_ENDPOINT and S3_ACCESS_KEY:
        return f"s3://{S3_BUCKET}/{layer}/{table_name}"
    return str(LAKEHOUSE_ROOT / layer / table_name)


class DeltaEngine:
    """Core Delta Lake engine for the 54Bank lakehouse."""

    def __init__(self, root: str = None):
        self.root = Path(root) if root else LAKEHOUSE_ROOT
        self.root.mkdir(parents=True, exist_ok=True)
        self._storage_opts = _storage_options()
        self._write_count = 0
        self._read_count = 0

        for layer in [MedallionLayer.BRONZE, MedallionLayer.SILVER,
                      MedallionLayer.GOLD, MedallionLayer.ML]:
            (self.root / layer).mkdir(parents=True, exist_ok=True)

        if not DELTA_AVAILABLE:
            logger.warning("deltalake not installed — all ops will use Parquet fallback")

    def table_path(self, layer: str, table_name: str) -> str:
        return _table_path(layer, table_name)

    # ── Write Operations ─────────────────────────────────────────────────

    def write(self, layer: str, table_name: str, df: pd.DataFrame,
              mode: str = "append", partition_by: List[str] = None,
              schema_mode: str = "merge") -> Dict[str, Any]:
        """Write a DataFrame to a Delta table.

        Args:
            layer: bronze/silver/gold/ml
            mode: append, overwrite, or merge
            partition_by: columns to partition by (e.g. ["date_partition"])
            schema_mode: merge (add new columns) or overwrite (replace schema)
        """
        path = self.table_path(layer, table_name)
        t0 = time.time()

        if not DELTA_AVAILABLE:
            return self._parquet_fallback_write(path, df, mode)

        kwargs = {"mode": mode}
        if self._storage_opts:
            kwargs["storage_options"] = self._storage_opts
        if partition_by:
            kwargs["partition_by"] = partition_by

        try:
            if self._table_exists(path):
                kwargs["schema_mode"] = schema_mode
            write_deltalake(path, df, **kwargs)
        except Exception as e:
            if "No such file" in str(e) or "not found" in str(e).lower():
                kwargs.pop("schema_mode", None)
                write_deltalake(path, df, mode="overwrite",
                                **{k: v for k, v in kwargs.items() if k != "mode"})
            else:
                raise

        elapsed = time.time() - t0
        self._write_count += 1
        result = {
            "layer": layer, "table": table_name, "rows": len(df),
            "columns": len(df.columns), "mode": mode,
            "elapsed_seconds": round(elapsed, 3),
        }

        if self._table_exists(path):
            dt = DeltaTable(path, storage_options=self._storage_opts or None)
            result["version"] = dt.version()
            result["files"] = len(dt.file_uris())

        logger.info(f"WRITE {layer}.{table_name}: {len(df)} rows in {elapsed:.3f}s")
        return result

    def upsert(self, layer: str, table_name: str, df: pd.DataFrame,
               merge_key: str, update_columns: List[str] = None) -> Dict[str, Any]:
        """Upsert (merge) into a Delta table — update matching rows, insert new ones."""
        path = self.table_path(layer, table_name)

        if not DELTA_AVAILABLE or not self._table_exists(path):
            return self.write(layer, table_name, df, mode="overwrite")

        t0 = time.time()
        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        source_arrow = pa.Table.from_pandas(df)

        if update_columns:
            updates = {col: f"s.{col}" for col in update_columns}
        else:
            updates = {col: f"s.{col}" for col in df.columns if col != merge_key}

        inserts = {col: f"s.{col}" for col in df.columns}

        merge_result = (
            dt.merge(
                source=source_arrow,
                predicate=f"t.{merge_key} = s.{merge_key}",
                source_alias="s",
                target_alias="t",
            )
            .when_matched_update(updates=updates)
            .when_not_matched_insert(updates=inserts)
            .execute()
        )

        elapsed = time.time() - t0
        logger.info(f"UPSERT {layer}.{table_name}: {len(df)} source rows in {elapsed:.3f}s")
        return {
            "layer": layer, "table": table_name,
            "source_rows": len(df), "elapsed_seconds": round(elapsed, 3),
            "merge_metrics": str(merge_result) if merge_result else "ok",
        }

    # ── Read Operations ──────────────────────────────────────────────────

    def read(self, layer: str, table_name: str,
             columns: List[str] = None,
             filters: List[tuple] = None,
             version: int = None) -> pd.DataFrame:
        """Read a Delta table, optionally at a specific version (time-travel).

        Args:
            filters: list of (column, op, value) tuples for predicate pushdown
                     e.g. [("status", "=", "completed"), ("amount", ">", 10000)]
            version: specific Delta version to read (time-travel)
        """
        path = self.table_path(layer, table_name)
        t0 = time.time()

        if not DELTA_AVAILABLE:
            return self._parquet_fallback_read(path, columns)

        if not self._table_exists(path):
            logger.warning(f"Table {layer}.{table_name} not found")
            return pd.DataFrame()

        kwargs = {}
        if self._storage_opts:
            kwargs["storage_options"] = self._storage_opts
        if version is not None:
            kwargs["version"] = version

        dt = DeltaTable(path, **kwargs)

        if columns:
            df = dt.to_pandas(columns=columns)
        else:
            df = dt.to_pandas()

        if filters:
            for col, op, val in filters:
                if col not in df.columns:
                    continue
                if op == "=":
                    df = df[df[col] == val]
                elif op == "!=":
                    df = df[df[col] != val]
                elif op == ">":
                    df = df[df[col] > val]
                elif op == ">=":
                    df = df[df[col] >= val]
                elif op == "<":
                    df = df[df[col] < val]
                elif op == "<=":
                    df = df[df[col] <= val]
                elif op == "in":
                    df = df[df[col].isin(val)]

        self._read_count += 1
        elapsed = time.time() - t0
        logger.info(f"READ {layer}.{table_name}: {len(df)} rows in {elapsed:.3f}s"
                     + (f" (v{version})" if version is not None else ""))
        return df

    # ── Time-Travel ──────────────────────────────────────────────────────

    def history(self, layer: str, table_name: str) -> List[Dict[str, Any]]:
        """Get the full version history of a Delta table."""
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return []
        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        return dt.history()

    def version(self, layer: str, table_name: str) -> int:
        """Get current version of a Delta table."""
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return -1
        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        return dt.version()

    def read_at_version(self, layer: str, table_name: str,
                        version: int) -> pd.DataFrame:
        """Time-travel: read a table at a specific version."""
        return self.read(layer, table_name, version=version)

    # ── Schema Evolution ─────────────────────────────────────────────────

    def schema(self, layer: str, table_name: str) -> Optional[pa.Schema]:
        """Get the Arrow schema of a Delta table."""
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return None
        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        return dt.schema().to_arrow()

    def add_columns(self, layer: str, table_name: str,
                    new_columns: Dict[str, Any], default_value=None) -> bool:
        """Add new columns to an existing Delta table via schema evolution.
        Reads existing data, adds columns with default values, overwrites.
        """
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return False

        df = self.read(layer, table_name)
        for col, dtype in new_columns.items():
            if col not in df.columns:
                dtype_lower = str(dtype).lower()
                if dtype_lower in ("str", "string", "object", "varchar", "text"):
                    df[col] = "" if default_value is None else str(default_value)
                elif dtype_lower in ("float", "float64", "double", "decimal"):
                    df[col] = 0.0 if default_value is None else float(default_value)
                elif dtype_lower in ("int", "int64", "integer", "bigint"):
                    df[col] = 0 if default_value is None else int(default_value)
                elif dtype_lower in ("bool", "boolean"):
                    df[col] = False if default_value is None else bool(default_value)
                else:
                    df[col] = "" if default_value is None else default_value
        self.write(layer, table_name, df, mode="overwrite")
        logger.info(f"SCHEMA EVOLVE {layer}.{table_name}: added {list(new_columns.keys())}")
        return True

    # ── Maintenance ──────────────────────────────────────────────────────

    def compact(self, layer: str, table_name: str,
                target_size: int = 128 * 1024 * 1024) -> Dict[str, Any]:
        """Compact small files in a Delta table (Z-order / bin-packing)."""
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return {"error": "table not found"}

        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        files_before = len(dt.file_uris())

        try:
            result = dt.optimize.compact()
            dt.create_checkpoint()
        except Exception as e:
            logger.warning(f"Compact {layer}.{table_name} failed: {e}")
            return {"error": str(e)}

        files_after = len(dt.file_uris())
        logger.info(f"COMPACT {layer}.{table_name}: {files_before} → {files_after} files")
        return {
            "table": f"{layer}.{table_name}",
            "files_before": files_before, "files_after": files_after,
            "result": str(result),
        }

    def vacuum(self, layer: str, table_name: str,
               retention_hours: int = 168) -> Dict[str, Any]:
        """Remove old files no longer referenced by the Delta log.
        Default retention: 7 days (168 hours).
        """
        path = self.table_path(layer, table_name)
        if not DELTA_AVAILABLE or not self._table_exists(path):
            return {"error": "table not found"}

        dt = DeltaTable(path, storage_options=self._storage_opts or None)
        try:
            removed = dt.vacuum(retention_hours=retention_hours, enforce_retention_duration=False, dry_run=False)
        except Exception as e:
            logger.warning(f"Vacuum {layer}.{table_name} failed: {e}")
            return {"error": str(e)}

        logger.info(f"VACUUM {layer}.{table_name}: removed {len(removed)} files")
        return {"table": f"{layer}.{table_name}", "removed_files": len(removed)}

    # ── Table Management ─────────────────────────────────────────────────

    def list_tables(self, layer: str = None) -> Dict[str, List[Dict]]:
        """List all tables in the lakehouse, grouped by layer."""
        result = {}
        layers = [layer] if layer else [MedallionLayer.BRONZE, MedallionLayer.SILVER,
                                         MedallionLayer.GOLD, MedallionLayer.ML]

        for lyr in layers:
            layer_path = self.root / lyr
            if not layer_path.exists():
                result[lyr] = []
                continue

            tables = []
            for d in sorted(layer_path.iterdir()):
                if d.is_dir() and not d.name.startswith("."):
                    info = self._table_info(lyr, d.name)
                    tables.append(info)
            result[lyr] = tables

        return result

    def table_exists(self, layer: str, table_name: str) -> bool:
        path = self.table_path(layer, table_name)
        return self._table_exists(path)

    def drop_table(self, layer: str, table_name: str) -> bool:
        """Drop a Delta table (remove all files)."""
        import shutil
        path = Path(self.table_path(layer, table_name))
        if path.exists():
            shutil.rmtree(path)
            logger.info(f"DROPPED {layer}.{table_name}")
            return True
        return False

    # ── Stats ────────────────────────────────────────────────────────────

    def stats(self) -> Dict[str, Any]:
        all_tables = self.list_tables()
        total_tables = sum(len(v) for v in all_tables.values())
        total_rows = sum(t.get("rows", 0) for tbls in all_tables.values() for t in tbls)
        total_size = sum(t.get("size_bytes", 0) for tbls in all_tables.values() for t in tbls)
        return {
            "total_tables": total_tables,
            "total_rows": total_rows,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "writes": self._write_count,
            "reads": self._read_count,
            "delta_available": DELTA_AVAILABLE,
            "storage": "s3" if self._storage_opts else "local",
            "root": str(self.root),
            "layers": {k: len(v) for k, v in all_tables.items()},
        }

    # ── Private ──────────────────────────────────────────────────────────

    def _table_exists(self, path: str) -> bool:
        local = Path(path)
        if local.exists():
            return (local / "_delta_log").exists() or any(local.glob("*.parquet"))
        return False

    def _table_info(self, layer: str, table_name: str) -> Dict[str, Any]:
        path = self.table_path(layer, table_name)
        info = {"name": table_name, "layer": layer, "path": path}

        if DELTA_AVAILABLE and self._table_exists(path):
            try:
                dt = DeltaTable(path, storage_options=self._storage_opts or None)
                info["version"] = dt.version()
                info["files"] = len(dt.file_uris())
                info["schema"] = [f.name for f in dt.schema().to_arrow()]
                total = 0
                for uri in dt.file_uris():
                    fpath = Path(uri.replace("file://", "")) if uri.startswith("file://") else Path(path) / uri
                    if fpath.exists():
                        total += fpath.stat().st_size
                info["size_bytes"] = total
                info["rows"] = len(dt.to_pandas())
            except Exception:
                info["version"] = -1
                info["error"] = "unreadable"
        else:
            p = Path(path)
            if p.exists():
                parquets = list(p.glob("**/*.parquet"))
                info["files"] = len(parquets)
                info["size_bytes"] = sum(f.stat().st_size for f in parquets)

        return info

    def _parquet_fallback_write(self, path: str, df: pd.DataFrame,
                                 mode: str) -> Dict[str, Any]:
        p = Path(path)
        p.mkdir(parents=True, exist_ok=True)
        ts = int(time.time() * 1000)
        out = p / f"part-{ts}.snappy.parquet"
        if mode == "overwrite":
            for f in p.glob("*.parquet"):
                f.unlink()
        df.to_parquet(out, index=False, engine="pyarrow", compression="snappy")
        return {"layer": "unknown", "table": p.name, "rows": len(df),
                "fallback": "parquet", "file": str(out)}

    def _parquet_fallback_read(self, path: str,
                                columns: List[str] = None) -> pd.DataFrame:
        p = Path(path)
        if not p.exists():
            return pd.DataFrame()
        parquets = sorted(p.glob("**/*.parquet"))
        if not parquets:
            return pd.DataFrame()
        dfs = [pd.read_parquet(f, columns=columns) for f in parquets]
        return pd.concat(dfs, ignore_index=True)
