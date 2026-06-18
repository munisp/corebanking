"""54Bank — PostgreSQL Extractor for Bronze Layer
Extracts data from the platform's PostgreSQL database and loads into
bronze Delta Lake tables. Supports:
- Full table extraction
- Incremental extraction (WHERE updated_at > last_watermark)
- Configurable parallelism
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import pandas as pd

from lakehouse.engine.delta_engine import DeltaEngine, MedallionLayer
from lakehouse.etl.medallion import BronzeIngestor

logger = logging.getLogger("54bank.lakehouse.extractor")

DB_URL = os.getenv("DATABASE_URL", os.getenv("DB_URL", ""))

PG_TABLE_MAP = {
    "transactions": {"pk": "id", "incremental_col": "created_at"},
    "accounts": {"pk": "id", "incremental_col": "updated_at"},
    "customers": {"pk": "id", "incremental_col": "updated_at"},
    "loans": {"pk": "id", "incremental_col": "updated_at"},
    "gl_journal_entries": {"pk": "id", "incremental_col": "created_at", "bronze_name": "gl_entries"},
    "kyc_verifications": {"pk": "id", "incremental_col": "created_at", "bronze_name": "kyc_events"},
    "aml_alerts": {"pk": "id", "incremental_col": "created_at"},
    "payments": {"pk": "id", "incremental_col": "created_at"},
    "cards": {"pk": "id", "incremental_col": "created_at"},
    "transfers": {"pk": "id", "incremental_col": "created_at"},
    "disputes": {"pk": "id", "incremental_col": "created_at"},
    "audit_logs": {"pk": "id", "incremental_col": "created_at", "bronze_name": "audit_log"},
}


class PostgresExtractor:
    """Extracts data from PostgreSQL into the lakehouse bronze layer."""

    def __init__(self, engine: DeltaEngine = None, db_url: str = None):
        self.engine = engine or DeltaEngine()
        self.bronze = BronzeIngestor(self.engine)
        self.db_url = db_url or DB_URL
        self._watermarks: Dict[str, str] = {}
        self._pg_available = False
        self._check_pg()

    def _check_pg(self):
        if not self.db_url:
            logger.warning("DATABASE_URL not set — PostgreSQL extraction unavailable")
            return
        try:
            import psycopg2
            self._pg_available = True
        except ImportError:
            try:
                import asyncpg
                self._pg_available = True
            except ImportError:
                logger.warning("No PostgreSQL driver (psycopg2/asyncpg) installed")

    def extract_table(self, pg_table: str, limit: int = None,
                      incremental: bool = True) -> Dict[str, Any]:
        """Extract a PostgreSQL table into bronze Delta Lake."""
        config = PG_TABLE_MAP.get(pg_table, {"pk": "id"})
        bronze_name = config.get("bronze_name", pg_table)

        if not self._pg_available or not self.db_url:
            return self._synthetic_extract(bronze_name, limit or 1000)

        t0 = time.time()
        try:
            import psycopg2
            conn = psycopg2.connect(self.db_url)

            sql = f"SELECT * FROM {pg_table}"
            conditions = []

            if incremental and config.get("incremental_col"):
                watermark = self._watermarks.get(pg_table)
                if watermark:
                    conditions.append(f"{config['incremental_col']} > '{watermark}'")

            if conditions:
                sql += " WHERE " + " AND ".join(conditions)
            if limit:
                sql += f" LIMIT {limit}"

            df = pd.read_sql(sql, conn)
            conn.close()

            if not df.empty and config.get("incremental_col") in df.columns:
                self._watermarks[pg_table] = str(df[config["incremental_col"]].max())

            result = self.bronze.ingest_generic(bronze_name, df)
            result["source"] = "postgresql"
            result["pg_table"] = pg_table
            result["elapsed_seconds"] = round(time.time() - t0, 3)
            return result

        except Exception as e:
            logger.warning(f"PG extract {pg_table} failed: {e} — using synthetic")
            return self._synthetic_extract(bronze_name, limit or 1000)

    def extract_all(self, limit_per_table: int = None,
                    incremental: bool = True) -> Dict[str, Any]:
        """Extract all configured PostgreSQL tables."""
        results = {}
        for pg_table in PG_TABLE_MAP:
            results[pg_table] = self.extract_table(pg_table, limit_per_table, incremental)
        return results

    def _synthetic_extract(self, bronze_name: str, n: int) -> Dict[str, Any]:
        """Generate synthetic data when PostgreSQL is unavailable.
        This ensures the lakehouse pipeline can run end-to-end without a DB.
        """
        import numpy as np
        from datetime import timedelta

        rng = np.random.RandomState(hash(bronze_name) % (2**31))
        now = datetime.now(timezone.utc)

        if bronze_name == "transactions":
            df = _synth_transactions(rng, n, now)
        elif bronze_name == "accounts":
            df = _synth_accounts(rng, min(n, 500), now)
        elif bronze_name == "customers":
            df = _synth_customers(rng, min(n, 300), now)
        elif bronze_name == "loans":
            df = _synth_loans(rng, min(n, 200), now)
        elif bronze_name == "gl_entries":
            df = _synth_gl_entries(rng, min(n, 1000), now)
        elif bronze_name == "kyc_events":
            df = _synth_kyc_events(rng, min(n, 300), now)
        elif bronze_name == "aml_alerts":
            df = _synth_aml_alerts(rng, min(n, 100), now)
        elif bronze_name == "payments":
            df = _synth_payments(rng, min(n, 500), now)
        else:
            df = pd.DataFrame({"id": [f"{bronze_name}-{i}" for i in range(min(n, 100))],
                                "created_at": [now.isoformat()] * min(n, 100)})

        result = self.bronze.ingest_generic(bronze_name, df)
        result["source"] = "synthetic"
        return result


# ── Synthetic Data Generators ────────────────────────────────────────────────

def _synth_transactions(rng, n, now):
    import numpy as np
    from datetime import timedelta
    nigerian_banks = ["054", "058", "011", "033", "044", "050", "032", "030", "070", "076"]
    types = ["transfer", "deposit", "withdrawal", "payment", "salary", "airtime", "utility"]
    statuses = ["completed", "completed", "completed", "pending", "failed"]
    channels = ["mobile", "ussd", "web", "pos", "atm", "branch"]

    dates = [now - timedelta(days=rng.randint(0, 365)) for _ in range(n)]
    amounts = np.round(rng.lognormal(mean=10, sigma=2, size=n), 2).clip(50, 50_000_000)

    return pd.DataFrame({
        "transaction_id": [f"TXN-{i:08d}" for i in range(n)],
        "account_id": [f"ACC-{rng.randint(1, 500):05d}" for _ in range(n)],
        "customer_id": [f"CUST-{rng.randint(1, 300):05d}" for _ in range(n)],
        "transaction_type": rng.choice(types, n),
        "amount": amounts,
        "currency": ["NGN"] * n,
        "status": rng.choice(statuses, n),
        "channel": rng.choice(channels, n),
        "narration": [f"TXN via {rng.choice(channels)}" for _ in range(n)],
        "bank_code": rng.choice(nigerian_banks, n),
        "created_at": [d.isoformat() for d in dates],
        "fee_amount": np.round(amounts * 0.001, 2).clip(0, 5000),
    })


def _synth_accounts(rng, n, now):
    import numpy as np
    types = ["savings", "current", "domiciliary", "fixed_deposit", "corporate"]
    tiers = ["tier1", "tier2", "tier3"]
    statuses = ["active", "active", "active", "dormant", "closed"]

    return pd.DataFrame({
        "account_id": [f"ACC-{i:05d}" for i in range(n)],
        "customer_id": [f"CUST-{rng.randint(1, 300):05d}" for _ in range(n)],
        "account_number": [f"00{rng.randint(10000000, 99999999)}" for _ in range(n)],
        "account_type": rng.choice(types, n),
        "tier": rng.choice(tiers, n),
        "balance": np.round(rng.lognormal(mean=12, sigma=2, size=n), 2),
        "currency": ["NGN"] * n,
        "status": rng.choice(statuses, n),
        "branch_code": [f"BR-{rng.randint(1, 50):03d}" for _ in range(n)],
        "opened_at": [(now - pd.Timedelta(days=rng.randint(1, 1000))).isoformat() for _ in range(n)],
        "updated_at": [now.isoformat()] * n,
    })


def _synth_customers(rng, n, now):
    first_names = ["Chukwuemeka", "Oluwaseun", "Aisha", "Fatima", "Adewale", "Ngozi",
                   "Yusuf", "Amaka", "Tunde", "Halima", "Emeka", "Chioma", "Musa",
                   "Blessing", "Ibrahim", "Grace", "Uche", "Funke", "Abdullahi", "Joy"]
    last_names = ["Okonkwo", "Adeyemi", "Mohammed", "Ibrahim", "Oladipo", "Eze",
                  "Balogun", "Nwosu", "Abdullahi", "Chukwu", "Fashola", "Abubakar",
                  "Okafor", "Ogundimu", "Suleiman", "Nnamdi", "Ogundele", "Yakubu"]
    states = ["Lagos", "Abuja", "Kano", "Rivers", "Oyo", "Kaduna", "Enugu",
              "Delta", "Ogun", "Anambra"]

    return pd.DataFrame({
        "customer_id": [f"CUST-{i:05d}" for i in range(n)],
        "first_name": rng.choice(first_names, n),
        "last_name": rng.choice(last_names, n),
        "bvn": [f"22{rng.randint(100000000, 999999999)}" for _ in range(n)],
        "phone": [f"+234{rng.choice(['80','81','90','70'])}{rng.randint(10000000, 99999999)}" for _ in range(n)],
        "email": [f"user{i}@example.ng" for i in range(n)],
        "state": rng.choice(states, n),
        "kyc_tier": rng.choice(["tier1", "tier2", "tier3"], n, p=[0.3, 0.5, 0.2]),
        "risk_rating": rng.choice(["low", "medium", "high"], n, p=[0.7, 0.2, 0.1]),
        "created_at": [(now - pd.Timedelta(days=rng.randint(1, 1000))).isoformat() for _ in range(n)],
        "updated_at": [now.isoformat()] * n,
    })


def _synth_loans(rng, n, now):
    import numpy as np
    types = ["personal", "sme", "mortgage", "auto", "agricultural", "overdraft"]
    statuses = ["active", "active", "repaid", "default", "restructured"]

    return pd.DataFrame({
        "loan_id": [f"LOAN-{i:06d}" for i in range(n)],
        "customer_id": [f"CUST-{rng.randint(1, 300):05d}" for _ in range(n)],
        "loan_type": rng.choice(types, n),
        "principal": np.round(rng.lognormal(mean=14, sigma=1.5, size=n), 2),
        "interest_rate": np.round(rng.uniform(0.12, 0.32, size=n), 4),
        "tenor_months": rng.choice([6, 12, 24, 36, 60, 120, 240], n),
        "status": rng.choice(statuses, n),
        "disbursement_date": [(now - pd.Timedelta(days=rng.randint(1, 365))).isoformat() for _ in range(n)],
        "outstanding_balance": np.round(rng.lognormal(mean=13, sigma=1.5, size=n), 2),
        "ifrs9_stage": rng.choice(["stage1", "stage1", "stage2", "stage3"], n),
    })


def _synth_gl_entries(rng, n, now):
    import numpy as np
    gl_codes = ["1001", "1100", "2001", "2100", "3001", "4001", "4100", "5001", "5100"]

    return pd.DataFrame({
        "entry_id": [f"GL-{i:07d}" for i in range(n)],
        "gl_code": rng.choice(gl_codes, n),
        "debit": np.round(rng.lognormal(mean=10, sigma=2, size=n), 2) * rng.choice([0, 1], n),
        "credit": np.round(rng.lognormal(mean=10, sigma=2, size=n), 2) * rng.choice([0, 1], n),
        "narration": [f"GL entry {i}" for i in range(n)],
        "branch_code": [f"BR-{rng.randint(1, 50):03d}" for _ in range(n)],
        "currency": ["NGN"] * n,
        "created_at": [(now - pd.Timedelta(days=rng.randint(0, 30))).isoformat() for _ in range(n)],
    })


def _synth_kyc_events(rng, n, now):
    types = ["bvn_check", "nin_check", "liveness", "address", "document", "sanctions"]
    statuses = ["verified", "verified", "verified", "pending", "failed"]
    providers = ["NIBSS", "NIMC", "Smile_Identity", "Youverify", "Internal"]

    return pd.DataFrame({
        "event_id": [f"KYC-{i:06d}" for i in range(n)],
        "customer_id": [f"CUST-{rng.randint(1, 300):05d}" for _ in range(n)],
        "check_type": rng.choice(types, n),
        "status": rng.choice(statuses, n),
        "provider": rng.choice(providers, n),
        "risk_score": rng.randint(0, 100, n),
        "created_at": [(now - pd.Timedelta(days=rng.randint(0, 90))).isoformat() for _ in range(n)],
    })


def _synth_aml_alerts(rng, n, now):
    types = ["structuring", "large_cash", "unusual_pattern", "pep_transaction",
             "sanctions_hit", "high_risk_jurisdiction"]
    statuses = ["open", "investigating", "resolved", "escalated", "sar_filed"]
    levels = ["low", "medium", "high", "critical"]

    return pd.DataFrame({
        "alert_id": [f"AML-{i:06d}" for i in range(n)],
        "customer_id": [f"CUST-{rng.randint(1, 300):05d}" for _ in range(n)],
        "alert_type": rng.choice(types, n),
        "risk_level": rng.choice(levels, n),
        "status": rng.choice(statuses, n),
        "amount": rng.lognormal(mean=14, sigma=2, size=n).round(2),
        "description": [f"Suspicious activity detected" for _ in range(n)],
        "created_at": [(now - pd.Timedelta(days=rng.randint(0, 90))).isoformat() for _ in range(n)],
    })


def _synth_payments(rng, n, now):
    import numpy as np
    types = ["nip", "neft", "rtgs", "internal", "mobile_money"]
    statuses = ["completed", "completed", "completed", "pending", "failed"]

    return pd.DataFrame({
        "payment_id": [f"PAY-{i:07d}" for i in range(n)],
        "sender_account": [f"ACC-{rng.randint(1, 500):05d}" for _ in range(n)],
        "receiver_account": [f"ACC-{rng.randint(1, 500):05d}" for _ in range(n)],
        "payment_type": rng.choice(types, n),
        "amount": np.round(rng.lognormal(mean=10, sigma=2, size=n), 2),
        "currency": ["NGN"] * n,
        "status": rng.choice(statuses, n),
        "created_at": [(now - pd.Timedelta(days=rng.randint(0, 90))).isoformat() for _ in range(n)],
    })
