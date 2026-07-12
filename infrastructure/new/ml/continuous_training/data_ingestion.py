#!/usr/bin/env python3
"""54Bank — Production Data Ingestion for Continuous Training
Ingests labeled production data from:
1. PostgreSQL (transaction outcomes, loan defaults, KYC decisions)
2. Kafka topics (real-time events with eventual labels)
3. Manual labels (compliance officer annotations)

Transforms raw production data into training-ready DataFrames,
versions datasets in Delta Lake, and tracks data lineage.
"""
import os
import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("54bank.continuous_training.ingestion")

DATA_DIR = Path(__file__).parent.parent / "data" / "datasets"
DELTA_DIR = DATA_DIR / "delta"


class ProductionDataIngestion:
    """Ingests production data for model retraining.

    Supports three data sources:
    1. Direct DB queries (PostgreSQL via connection string)
    2. Kafka consumer (streaming events with labels)
    3. File-based ingestion (CSV/Parquet exports from data warehouse)

    Each ingestion run is versioned and tracked in Delta Lake.
    """

    FRAUD_QUERY = """
    SELECT
        t.id as transaction_id,
        t.amount,
        EXTRACT(HOUR FROM t.created_at) as hour,
        EXTRACT(DOW FROM t.created_at) as day_of_week,
        t.channel,
        t.merchant_category,
        t.card_type,
        a.state,
        -- Velocity features (computed from window)
        (SELECT COUNT(*) FROM transactions t2
         WHERE t2.account_id = t.account_id
         AND t2.created_at > t.created_at - INTERVAL '1 hour'
         AND t2.id != t.id) as velocity_1h,
        (SELECT COUNT(*) FROM transactions t2
         WHERE t2.account_id = t.account_id
         AND t2.created_at > t.created_at - INTERVAL '24 hours'
         AND t2.id != t.id) as velocity_24h,
        -- Amount vs average
        t.amount / NULLIF(
            (SELECT AVG(t2.amount) FROM transactions t2
             WHERE t2.account_id = t.account_id
             AND t2.created_at < t.created_at), 0) as amount_vs_avg,
        -- Geo distance (simplified)
        0.0 as geo_distance_km,
        -- Device age
        COALESCE(EXTRACT(DAY FROM t.created_at - d.first_seen), 365) as device_age_days,
        CASE WHEN t.beneficiary_first_seen = t.created_at THEN 1 ELSE 0 END as is_new_beneficiary,
        CASE WHEN t.currency != 'NGN' THEN 1 ELSE 0 END as is_international,
        EXTRACT(DAY FROM t.created_at - a.opened_at) as account_age_days,
        t.amount / NULLIF(a.balance, 0) as balance_ratio,
        -- Label: fraud confirmed by investigation
        CASE
            WHEN f.resolution = 'confirmed_fraud' THEN 1
            WHEN f.resolution = 'false_positive' THEN 0
            WHEN t.reversal_reason = 'fraud' THEN 1
            ELSE 0
        END as is_fraud
    FROM transactions t
    JOIN accounts a ON t.account_id = a.id
    LEFT JOIN devices d ON t.device_id = d.id
    LEFT JOIN fraud_investigations f ON t.id = f.transaction_id
    WHERE t.created_at >= %(start_date)s
      AND t.created_at < %(end_date)s
      AND t.tenant_id = %(tenant_id)s
    """

    CREDIT_QUERY = """
    SELECT
        l.id as application_id,
        c.bvn as customer_bvn,
        EXTRACT(YEAR FROM AGE(c.date_of_birth)) as age,
        c.monthly_income,
        c.total_outstanding_debt as total_debt,
        c.total_outstanding_debt / NULLIF(c.monthly_income, 0) as dti_ratio,
        c.employment_years,
        (SELECT COUNT(*) FROM loans l2 WHERE l2.customer_id = c.id AND l2.id != l.id) as num_prior_loans,
        (SELECT COUNT(*) FROM loans l2 WHERE l2.customer_id = c.id
         AND l2.status = 'default' AND l2.id != l.id) as num_defaults,
        c.sector,
        l.amount as loan_amount_requested,
        l.tenure_months as loan_tenure_months,
        COALESCE(l.collateral_value, 0) as collateral_value,
        CASE WHEN l.guarantor_id IS NOT NULL THEN 1 ELSE 0 END as has_guarantor,
        EXTRACT(MONTH FROM AGE(l.created_at, a.opened_at)) as account_age_months,
        a.average_balance as avg_monthly_balance,
        c.num_dependents,
        c.state,
        -- Label: actual default outcome
        CASE
            WHEN l.status = 'default' THEN 1
            WHEN l.status IN ('closed', 'paid_off') THEN 0
            WHEN l.days_past_due >= 90 THEN 1
            ELSE NULL  -- still active, exclude
        END as will_default
    FROM loans l
    JOIN customers c ON l.customer_id = c.id
    JOIN accounts a ON l.account_id = a.id
    WHERE l.created_at >= %(start_date)s
      AND l.created_at < %(end_date)s
      AND l.tenant_id = %(tenant_id)s
      AND l.status != 'active'  -- only include resolved loans
    """

    AML_QUERY = """
    SELECT
        c.id as profile_id,
        -- 30-day aggregates
        COUNT(t.id) as transaction_count_30d,
        COUNT(DISTINCT t.counterparty_id) as unique_counterparties_30d,
        SUM(CASE WHEN t.channel = 'cash' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(t.id), 0) as cash_ratio,
        SUM(CASE WHEN t.currency != 'NGN' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(t.id), 0) as international_ratio,
        AVG(t.amount) as avg_transaction_amount,
        MAX(t.amount) as max_transaction_amount,
        SUM(CASE WHEN t.amount % 1000 = 0 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(t.id), 0) as round_amount_ratio,
        SUM(CASE WHEN EXTRACT(HOUR FROM t.created_at) BETWEEN 0 AND 5 THEN 1 ELSE 0 END)::float / NULLIF(COUNT(t.id), 0) as night_ratio,
        0.0 as structuring_score,  -- computed by feature engineering
        c.pep_flag::int as pep_flag,
        CASE WHEN c.country_risk = 'high' THEN 1 ELSE 0 END as high_risk_country,
        a.account_type,
        c.kyc_level,
        EXTRACT(DAY FROM NOW() - c.last_kyc_update) as days_since_last_kyc_update,
        -- Label: STR filed
        CASE
            WHEN s.id IS NOT NULL THEN 1
            ELSE 0
        END as is_suspicious
    FROM customers c
    JOIN accounts a ON a.customer_id = c.id
    LEFT JOIN transactions t ON t.account_id = a.id
        AND t.created_at >= %(start_date)s
        AND t.created_at < %(end_date)s
    LEFT JOIN suspicious_transaction_reports s ON s.customer_id = c.id
        AND s.created_at >= %(start_date)s
        AND s.created_at < %(end_date)s
    WHERE c.tenant_id = %(tenant_id)s
    GROUP BY c.id, a.account_type, c.kyc_level, c.pep_flag, c.country_risk,
             c.last_kyc_update, s.id
    """

    CHURN_QUERY = """
    WITH monthly_activity AS (
        SELECT
            c.id as customer_id,
            DATE_TRUNC('month', t.created_at) as month,
            COUNT(t.id) as transaction_count,
            COALESCE(SUM(t.amount), 0) as total_amount,
            AVG(a.balance) as avg_balance,
            COUNT(DISTINCT p.id) as product_count,
            COUNT(DISTINCT comp.id) as complaint_count,
            COUNT(DISTINCT s.id) as login_count,
            COUNT(DISTINCT t.channel)::float / 7.0 as channel_diversity,
            COALESCE(MAX(n.score), 5) as nps_score
        FROM customers c
        JOIN accounts a ON a.customer_id = c.id
        LEFT JOIN transactions t ON t.account_id = a.id
            AND t.created_at >= %(start_date)s - INTERVAL '12 months'
            AND t.created_at < %(end_date)s
        LEFT JOIN products p ON p.customer_id = c.id AND p.status = 'active'
        LEFT JOIN complaints comp ON comp.customer_id = c.id
            AND comp.created_at >= DATE_TRUNC('month', t.created_at)
            AND comp.created_at < DATE_TRUNC('month', t.created_at) + INTERVAL '1 month'
        LEFT JOIN sessions s ON s.customer_id = c.id
            AND s.created_at >= DATE_TRUNC('month', t.created_at)
            AND s.created_at < DATE_TRUNC('month', t.created_at) + INTERVAL '1 month'
        LEFT JOIN nps_surveys n ON n.customer_id = c.id
            AND n.created_at >= DATE_TRUNC('month', t.created_at)
            AND n.created_at < DATE_TRUNC('month', t.created_at) + INTERVAL '1 month'
        WHERE c.tenant_id = %(tenant_id)s
        GROUP BY c.id, DATE_TRUNC('month', t.created_at)
    )
    SELECT
        customer_id,
        month,
        transaction_count,
        total_amount,
        avg_balance,
        product_count,
        complaint_count,
        login_count,
        channel_diversity,
        nps_score
    FROM monthly_activity
    ORDER BY customer_id, month
    """

    def __init__(self, db_url: str = None, kafka_brokers: str = None):
        self.db_url = db_url or os.environ.get("DATABASE_URL")
        self.kafka_brokers = kafka_brokers or os.environ.get("KAFKA_BROKERS")
        self._db_conn = None

    def _get_db_connection(self):
        """Get or create database connection."""
        if self._db_conn is not None:
            return self._db_conn
        if not self.db_url:
            return None
        try:
            import psycopg2
            self._db_conn = psycopg2.connect(self.db_url)
            return self._db_conn
        except ImportError:
            logger.warning("psycopg2 not installed. Using file-based ingestion.")
            return None
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return None

    def ingest_from_db(self, model_name: str, tenant_id: str,
                       start_date: datetime, end_date: datetime) -> Optional[pd.DataFrame]:
        """Ingest labeled data from PostgreSQL for a specific model."""
        conn = self._get_db_connection()
        if conn is None:
            logger.info(f"No DB connection. Falling back to file-based ingestion for {model_name}")
            return self.ingest_from_files(model_name)

        queries = {
            "fraud_detector": self.FRAUD_QUERY,
            "credit_scorer": self.CREDIT_QUERY,
            "aml_scorer": self.AML_QUERY,
            "churn_predictor": self.CHURN_QUERY,
        }

        query = queries.get(model_name)
        if not query:
            logger.warning(f"No ingestion query for model: {model_name}")
            return None

        params = {
            "start_date": start_date,
            "end_date": end_date,
            "tenant_id": tenant_id,
        }

        try:
            df = pd.read_sql(query, conn, params=params)
            logger.info(f"Ingested {len(df)} rows for {model_name} from DB "
                        f"({start_date.date()} to {end_date.date()})")
            return df
        except Exception as e:
            logger.error(f"DB ingestion failed for {model_name}: {e}")
            return None

    def ingest_from_kafka(self, model_name: str, topic: str,
                          timeout_seconds: int = 60) -> Optional[pd.DataFrame]:
        """Consume labeled events from Kafka topic."""
        if not self.kafka_brokers:
            logger.info("No Kafka brokers configured. Skipping Kafka ingestion.")
            return None

        try:
            from kafka import KafkaConsumer
        except ImportError:
            logger.warning("kafka-python not installed. Skipping Kafka ingestion.")
            return None

        topic_map = {
            "fraud_detector": "transaction.fraud.labeled",
            "credit_scorer": "loan.outcome.labeled",
            "aml_scorer": "aml.investigation.labeled",
            "churn_predictor": "customer.churn.labeled",
        }

        actual_topic = topic or topic_map.get(model_name, f"{model_name}.labeled")

        try:
            consumer = KafkaConsumer(
                actual_topic,
                bootstrap_servers=self.kafka_brokers.split(","),
                auto_offset_reset="earliest",
                enable_auto_commit=False,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                consumer_timeout_ms=timeout_seconds * 1000,
                group_id=f"ml-continuous-training-{model_name}",
            )

            records = []
            for message in consumer:
                records.append(message.value)

            consumer.commit()
            consumer.close()

            if records:
                df = pd.DataFrame(records)
                logger.info(f"Consumed {len(df)} records from Kafka topic {actual_topic}")
                return df
            return None

        except Exception as e:
            logger.error(f"Kafka ingestion failed: {e}")
            return None

    def ingest_from_files(self, model_name: str,
                          data_dir: Path = None) -> Optional[pd.DataFrame]:
        """Ingest from exported Parquet/CSV files (fallback/batch mode)."""
        search_dir = data_dir or DATA_DIR

        # Look for production export files
        patterns = [
            f"{model_name}_production_*.parquet",
            f"{model_name}_export_*.parquet",
            f"{model_name}_labeled_*.parquet",
            f"{model_name}_production_*.csv",
        ]

        for pattern in patterns:
            files = sorted(search_dir.glob(pattern))
            if files:
                dfs = [pd.read_parquet(f) if f.suffix == ".parquet"
                       else pd.read_csv(f) for f in files]
                df = pd.concat(dfs, ignore_index=True)
                logger.info(f"Loaded {len(df)} rows from {len(files)} files for {model_name}")
                return df

        # Fall back to existing training data
        training_file = search_dir / f"{model_name.replace('_detector', '_detection').replace('_scorer', '_scoring').replace('_predictor', '_prediction')}.parquet"
        fallbacks = {
            "fraud_detector": search_dir / "fraud_detection.parquet",
            "credit_scorer": search_dir / "credit_scoring.parquet",
            "aml_scorer": search_dir / "aml_risk.parquet",
            "anomaly_vae": search_dir / "anomaly_detection.parquet",
        }

        fallback = fallbacks.get(model_name)
        if fallback and fallback.exists():
            df = pd.read_parquet(fallback)
            logger.info(f"Using existing training data for {model_name}: {len(df)} rows")
            return df

        logger.warning(f"No data found for {model_name}")
        return None

    def version_dataset(self, model_name: str, df: pd.DataFrame,
                        metadata: dict = None) -> str:
        """Version a dataset in Delta Lake with metadata."""
        try:
            from deltalake import write_deltalake
        except ImportError:
            logger.warning("deltalake not installed. Saving as parquet.")
            version_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            out_path = DATA_DIR / f"{model_name}_v{version_id}.parquet"
            df.to_parquet(out_path, index=False)
            return version_id

        version_id = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        table_path = str(DELTA_DIR / f"{model_name}_versions")

        # Add metadata columns
        df = df.copy()
        df["_version_id"] = version_id
        df["_ingested_at"] = datetime.now(timezone.utc).isoformat()
        df["_row_count"] = len(df)

        if metadata:
            df["_metadata"] = json.dumps(metadata)

        try:
            write_deltalake(table_path, df, mode="append")
        except Exception:
            write_deltalake(table_path, df, mode="overwrite")

        logger.info(f"Versioned dataset {model_name} v{version_id}: {len(df)} rows")
        return version_id

    def compute_structuring_score(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute AML structuring score from transaction patterns.
        Structuring = splitting large transactions to avoid ₦1M CBN reporting threshold.
        """
        if "avg_transaction_amount" not in df.columns:
            return df

        df = df.copy()
        CBN_THRESHOLD = 1_000_000  # ₦1M

        # Score based on how close average is to threshold
        proximity = 1.0 - abs(df["avg_transaction_amount"] - CBN_THRESHOLD * 0.95) / CBN_THRESHOLD
        proximity = proximity.clip(0, 1)

        # Combine with round amount ratio
        if "round_amount_ratio" in df.columns:
            df["structuring_score"] = (proximity * 0.6 + df["round_amount_ratio"] * 0.4).clip(0, 1)
        else:
            df["structuring_score"] = proximity

        return df

    def close(self):
        if self._db_conn:
            self._db_conn.close()
            self._db_conn = None
