"""54Bank — Medallion Architecture ETL Pipelines
Transforms data through three layers:
  Bronze: Raw ingested data (append-only, no transformation)
  Silver: Cleaned, deduplicated, typed, SCD Type 2 dims
  Gold:   Business-ready aggregates for dashboards & reporting

Each pipeline is idempotent and can be re-run safely.
"""

import logging
import hashlib
import time
from datetime import datetime, timezone, timedelta, date
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd

from lakehouse.engine.delta_engine import DeltaEngine, MedallionLayer

logger = logging.getLogger("54bank.lakehouse.etl")


class BronzeIngestor:
    """Ingest raw data into the bronze layer (append-only)."""

    def __init__(self, engine: DeltaEngine):
        self.engine = engine

    def ingest_transactions(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        df["_source"] = "postgres"
        if "created_at" in df.columns:
            df["_date_partition"] = pd.to_datetime(df["created_at"]).dt.strftime("%Y-%m-%d")
        return self.engine.write(MedallionLayer.BRONZE, "transactions", df,
                                 mode="append", partition_by=["_date_partition"]
                                 if "_date_partition" in df.columns else None)

    def ingest_accounts(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        df["_source"] = "postgres"
        return self.engine.write(MedallionLayer.BRONZE, "accounts", df, mode="append")

    def ingest_customers(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        df["_source"] = "postgres"
        return self.engine.write(MedallionLayer.BRONZE, "customers", df, mode="append")

    def ingest_loans(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "loans", df, mode="append")

    def ingest_gl_entries(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "gl_entries", df, mode="append")

    def ingest_kyc_events(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "kyc_events", df, mode="append")

    def ingest_aml_alerts(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "aml_alerts", df, mode="append")

    def ingest_payments(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "payments", df, mode="append")

    def ingest_audit_log(self, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, "audit_log", df, mode="append")

    def ingest_generic(self, table_name: str, df: pd.DataFrame) -> Dict[str, Any]:
        df = df.copy()
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.BRONZE, table_name, df, mode="append")


class SilverTransformer:
    """Transform bronze → silver: clean, deduplicate, type, build star schema."""

    def __init__(self, engine: DeltaEngine):
        self.engine = engine

    def transform_fact_transactions(self) -> Dict[str, Any]:
        """Bronze transactions → Silver fact_transactions.
        Dedup by transaction_id, parse dates, compute derived columns.
        """
        df = self.engine.read(MedallionLayer.BRONZE, "transactions")
        if df.empty:
            return {"status": "no_data", "table": "fact_transactions"}

        # Deduplicate
        id_col = _pick_id(df, ["transaction_id", "id"])
        if id_col:
            df = df.drop_duplicates(subset=[id_col], keep="last")

        # Type coercion
        for col in ["amount", "fee_amount", "balance_before", "balance_after"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        if "created_at" in df.columns:
            df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
            df["transaction_date"] = df["created_at"].dt.date.astype(str)
            df["transaction_hour"] = df["created_at"].dt.hour
            df["transaction_dow"] = df["created_at"].dt.dayofweek

        # Derived
        if "amount" in df.columns:
            df["is_large"] = df["amount"] > 1_000_000  # CBN reporting threshold ₦1M
            df["amount_band"] = pd.cut(
                df["amount"],
                bins=[0, 10_000, 100_000, 1_000_000, 10_000_000, float("inf")],
                labels=["micro", "small", "medium", "large", "jumbo"],
            )

        # Drop internal columns
        df = df.drop(columns=[c for c in df.columns if c.startswith("_")], errors="ignore")

        result = self.engine.write(MedallionLayer.SILVER, "fact_transactions",
                                   df, mode="overwrite",
                                   partition_by=["transaction_date"] if "transaction_date" in df.columns else None)
        result["deduplicated_rows"] = len(df)
        return result

    def transform_fact_loans(self) -> Dict[str, Any]:
        """Bronze loans → Silver fact_loans."""
        df = self.engine.read(MedallionLayer.BRONZE, "loans")
        if df.empty:
            return {"status": "no_data", "table": "fact_loans"}

        id_col = _pick_id(df, ["loan_id", "id"])
        if id_col:
            df = df.drop_duplicates(subset=[id_col], keep="last")

        for col in ["principal", "interest_rate", "outstanding_balance", "monthly_payment"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        if "disbursement_date" in df.columns:
            df["disbursement_date"] = pd.to_datetime(df["disbursement_date"], errors="coerce")

        df = df.drop(columns=[c for c in df.columns if c.startswith("_")], errors="ignore")
        return self.engine.write(MedallionLayer.SILVER, "fact_loans", df, mode="overwrite")

    def transform_fact_gl_entries(self) -> Dict[str, Any]:
        """Bronze gl_entries → Silver fact_gl_entries."""
        df = self.engine.read(MedallionLayer.BRONZE, "gl_entries")
        if df.empty:
            return {"status": "no_data", "table": "fact_gl_entries"}

        for col in ["debit", "credit"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        df = df.drop(columns=[c for c in df.columns if c.startswith("_")], errors="ignore")
        return self.engine.write(MedallionLayer.SILVER, "fact_gl_entries", df, mode="overwrite")

    def transform_dim_customers(self) -> Dict[str, Any]:
        """Bronze customers → Silver dim_customers (SCD Type 2)."""
        df = self.engine.read(MedallionLayer.BRONZE, "customers")
        if df.empty:
            return {"status": "no_data", "table": "dim_customers"}

        id_col = _pick_id(df, ["customer_id", "id", "bvn"])
        if id_col:
            df = df.drop_duplicates(subset=[id_col], keep="last")

        # SCD Type 2 columns
        df["_scd_valid_from"] = datetime.now(timezone.utc).isoformat()
        df["_scd_valid_to"] = "9999-12-31T23:59:59Z"
        df["_scd_is_current"] = True

        if "state" in df.columns:
            df["region"] = df["state"].map(_nigerian_regions()).fillna("Unknown")

        df = df.drop(columns=[c for c in df.columns
                               if c.startswith("_") and c not in
                               ["_scd_valid_from", "_scd_valid_to", "_scd_is_current"]],
                      errors="ignore")
        return self.engine.write(MedallionLayer.SILVER, "dim_customers", df, mode="overwrite")

    def transform_dim_accounts(self) -> Dict[str, Any]:
        """Bronze accounts → Silver dim_accounts."""
        df = self.engine.read(MedallionLayer.BRONZE, "accounts")
        if df.empty:
            return {"status": "no_data", "table": "dim_accounts"}

        id_col = _pick_id(df, ["account_id", "account_number", "id"])
        if id_col:
            df = df.drop_duplicates(subset=[id_col], keep="last")

        for col in ["balance", "available_balance"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        df = df.drop(columns=[c for c in df.columns if c.startswith("_")], errors="ignore")
        return self.engine.write(MedallionLayer.SILVER, "dim_accounts", df, mode="overwrite")

    def run_all(self) -> Dict[str, Any]:
        """Run all silver transformations."""
        results = {}
        for method_name in dir(self):
            if method_name.startswith("transform_"):
                try:
                    results[method_name] = getattr(self, method_name)()
                except Exception as e:
                    results[method_name] = {"error": str(e)}
                    logger.error(f"Silver {method_name} failed: {e}")
        return results


class GoldAggregator:
    """Transform silver → gold: business-ready aggregates."""

    def __init__(self, engine: DeltaEngine):
        self.engine = engine

    def aggregate_daily_balances(self) -> Dict[str, Any]:
        """Silver dim_accounts → Gold agg_daily_balances.
        Daily snapshot of account balances by account type, branch, segment.
        """
        df = self.engine.read(MedallionLayer.SILVER, "dim_accounts")
        if df.empty:
            return {"status": "no_data"}

        today = date.today().isoformat()
        agg_cols = {}

        group_cols = []
        for c in ["account_type", "product_type", "branch_code", "currency"]:
            if c in df.columns:
                group_cols.append(c)

        if not group_cols:
            group_cols = [df.columns[0]]

        if "balance" in df.columns:
            agg = df.groupby(group_cols, dropna=False).agg(
                total_balance=("balance", "sum"),
                avg_balance=("balance", "mean"),
                account_count=("balance", "count"),
                min_balance=("balance", "min"),
                max_balance=("balance", "max"),
            ).reset_index()
        else:
            agg = df.groupby(group_cols, dropna=False).size().reset_index(name="account_count")
            agg["total_balance"] = 0
            agg["avg_balance"] = 0

        agg["balance_date"] = today
        agg["computed_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.GOLD, "agg_daily_balances", agg, mode="append")

    def aggregate_corridor_metrics(self) -> Dict[str, Any]:
        """Silver fact_transactions → Gold agg_corridor_metrics.
        Volume, count, avg by corridor (sender_country → recipient_country).
        """
        df = self.engine.read(MedallionLayer.SILVER, "fact_transactions")
        if df.empty:
            return {"status": "no_data"}

        group_cols = []
        for c in ["currency", "transaction_type", "channel", "status"]:
            if c in df.columns:
                group_cols.append(c)

        if not group_cols:
            return {"status": "no_groupable_columns"}

        if "amount" in df.columns:
            agg = df.groupby(group_cols, dropna=False).agg(
                transaction_count=("amount", "count"),
                total_volume=("amount", "sum"),
                avg_amount=("amount", "mean"),
                max_amount=("amount", "max"),
            ).reset_index()
        else:
            agg = df.groupby(group_cols, dropna=False).size().reset_index(name="transaction_count")

        agg["computed_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.GOLD, "agg_corridor_metrics", agg, mode="append")

    def aggregate_risk_scores(self) -> Dict[str, Any]:
        """Bronze aml_alerts → Gold agg_risk_scores.
        Risk distribution: count by risk_level, alert_type.
        """
        df = self.engine.read(MedallionLayer.BRONZE, "aml_alerts")
        if df.empty:
            return {"status": "no_data"}

        group_cols = []
        for c in ["risk_level", "alert_type", "status"]:
            if c in df.columns:
                group_cols.append(c)

        if not group_cols:
            return {"status": "no_groupable_columns"}

        agg = df.groupby(group_cols, dropna=False).size().reset_index(name="alert_count")
        agg["computed_at"] = datetime.now(timezone.utc).isoformat()
        return self.engine.write(MedallionLayer.GOLD, "agg_risk_scores", agg, mode="append")

    def aggregate_kpi_metrics(self) -> Dict[str, Any]:
        """Compute KPI metrics from silver layer for dashboard consumption."""
        results = []
        today = date.today().isoformat()

        # Transaction KPIs
        txn = self.engine.read(MedallionLayer.SILVER, "fact_transactions")
        if not txn.empty and "amount" in txn.columns:
            results.append({"kpi": "total_transaction_volume", "value": float(txn["amount"].sum()),
                            "unit": "NGN", "date": today})
            results.append({"kpi": "total_transaction_count", "value": len(txn),
                            "unit": "count", "date": today})
            results.append({"kpi": "avg_transaction_amount", "value": float(txn["amount"].mean()),
                            "unit": "NGN", "date": today})

        # Loan KPIs
        loans = self.engine.read(MedallionLayer.SILVER, "fact_loans")
        if not loans.empty:
            if "principal" in loans.columns:
                results.append({"kpi": "total_loan_book", "value": float(loans["principal"].sum()),
                                "unit": "NGN", "date": today})
            if "status" in loans.columns:
                npl = loans[loans["status"].isin(["default", "npl", "written_off"])]
                total = len(loans)
                results.append({"kpi": "npl_ratio", "value": len(npl) / max(total, 1),
                                "unit": "ratio", "date": today})

        # Customer KPIs
        cust = self.engine.read(MedallionLayer.SILVER, "dim_customers")
        if not cust.empty:
            results.append({"kpi": "total_customers", "value": len(cust),
                            "unit": "count", "date": today})

        if results:
            agg = pd.DataFrame(results)
            agg["computed_at"] = datetime.now(timezone.utc).isoformat()
            return self.engine.write(MedallionLayer.GOLD, "agg_kpi_metrics", agg, mode="append")
        return {"status": "no_data"}

    def aggregate_regulatory_reports(self) -> Dict[str, Any]:
        """Generate regulatory report data (CBN, NDIC) from silver layer."""
        txn = self.engine.read(MedallionLayer.SILVER, "fact_transactions")
        if txn.empty:
            return {"status": "no_data"}

        reports = []
        today = date.today().isoformat()

        # CBN large transaction report (> ₦1M)
        if "amount" in txn.columns:
            large = txn[txn["amount"] > 1_000_000]
            reports.append({
                "report_type": "CBN_LARGE_TRANSACTION",
                "report_date": today,
                "record_count": len(large),
                "total_amount": float(large["amount"].sum()) if not large.empty else 0,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            })

        # Suspicious transaction summary
        if "is_large" in txn.columns:
            suspicious = txn[txn["is_large"] == True]
            reports.append({
                "report_type": "SUSPICIOUS_SUMMARY",
                "report_date": today,
                "record_count": len(suspicious),
                "total_amount": float(suspicious["amount"].sum()) if not suspicious.empty else 0,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            })

        if reports:
            df = pd.DataFrame(reports)
            return self.engine.write(MedallionLayer.GOLD, "agg_regulatory_reports", df, mode="append")
        return {"status": "no_reports"}

    def run_all(self) -> Dict[str, Any]:
        """Run all gold aggregations."""
        results = {}
        for method_name in dir(self):
            if method_name.startswith("aggregate_"):
                try:
                    results[method_name] = getattr(self, method_name)()
                except Exception as e:
                    results[method_name] = {"error": str(e)}
                    logger.error(f"Gold {method_name} failed: {e}")
        return results


class MedallionPipeline:
    """Orchestrates the full Bronze → Silver → Gold pipeline."""

    def __init__(self, engine: DeltaEngine = None):
        self.engine = engine or DeltaEngine()
        self.bronze = BronzeIngestor(self.engine)
        self.silver = SilverTransformer(self.engine)
        self.gold = GoldAggregator(self.engine)

    def run_full_pipeline(self) -> Dict[str, Any]:
        """Run the complete medallion pipeline: silver transforms + gold aggregates."""
        t0 = time.time()
        results = {
            "silver": self.silver.run_all(),
            "gold": self.gold.run_all(),
            "elapsed_seconds": 0,
        }
        results["elapsed_seconds"] = round(time.time() - t0, 3)
        logger.info(f"Full medallion pipeline completed in {results['elapsed_seconds']}s")
        return results


# ── Helpers ──────────────────────────────────────────────────────────────────

def _pick_id(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    return None

def _nigerian_regions() -> Dict[str, str]:
    return {
        "Lagos": "South-West", "Ogun": "South-West", "Oyo": "South-West",
        "Osun": "South-West", "Ekiti": "South-West", "Ondo": "South-West",
        "Abuja": "North-Central", "FCT": "North-Central", "Niger": "North-Central",
        "Kwara": "North-Central", "Kogi": "North-Central", "Nassarawa": "North-Central",
        "Benue": "North-Central", "Plateau": "North-Central",
        "Kano": "North-West", "Kaduna": "North-West", "Sokoto": "North-West",
        "Zamfara": "North-West", "Kebbi": "North-West", "Katsina": "North-West",
        "Jigawa": "North-West",
        "Borno": "North-East", "Yobe": "North-East", "Adamawa": "North-East",
        "Bauchi": "North-East", "Gombe": "North-East", "Taraba": "North-East",
        "Rivers": "South-South", "Bayelsa": "South-South", "Delta": "South-South",
        "Edo": "South-South", "Akwa Ibom": "South-South", "Cross River": "South-South",
        "Anambra": "South-East", "Enugu": "South-East", "Imo": "South-East",
        "Abia": "South-East", "Ebonyi": "South-East",
    }
