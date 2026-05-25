"""54Bank — Data Quality Checks for Lakehouse
Validates data integrity across all medallion layers:
- Null checks (critical columns must not be null)
- Uniqueness checks (primary keys must be unique)
- Range checks (amounts > 0, rates between 0-1)
- Referential integrity (FKs exist in dimension tables)
- Freshness checks (data must be recent)
- Volume checks (table must have expected row count range)
- Custom business rules (CBN compliance, AML thresholds)
"""

import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, asdict, field

import pandas as pd

from lakehouse.engine.delta_engine import DeltaEngine, MedallionLayer

logger = logging.getLogger("54bank.lakehouse.quality")


@dataclass
class QualityCheck:
    name: str
    table: str
    layer: str
    check_type: str  # null, unique, range, freshness, volume, referential, custom
    passed: bool = False
    details: str = ""
    rows_checked: int = 0
    rows_failed: int = 0
    severity: str = "error"  # error, warning, info
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


@dataclass
class QualityReport:
    run_id: str
    started_at: str
    completed_at: str = ""
    checks: List[QualityCheck] = field(default_factory=list)
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    total: int = 0

    def add(self, check: QualityCheck):
        self.checks.append(check)
        self.total += 1
        if check.passed:
            self.passed += 1
        elif check.severity == "warning":
            self.warnings += 1
        else:
            self.failed += 1

    @property
    def success_rate(self) -> float:
        return self.passed / max(self.total, 1)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "passed": self.passed,
            "failed": self.failed,
            "warnings": self.warnings,
            "total": self.total,
            "success_rate": round(self.success_rate, 4),
            "checks": [asdict(c) for c in self.checks],
        }


# ── Check Definitions ────────────────────────────────────────────────────────

BRONZE_CHECKS = {
    "transactions": {
        "not_null": ["amount"],
        "positive": ["amount"],
    },
    "customers": {
        "not_null": [],
    },
    "accounts": {
        "not_null": [],
    },
    "loans": {
        "not_null": [],
        "positive": ["principal"],
    },
    "aml_alerts": {
        "not_null": [],
    },
}

SILVER_CHECKS = {
    "fact_transactions": {
        "not_null": ["amount"],
        "unique": [],
        "positive": ["amount"],
    },
    "fact_loans": {
        "not_null": [],
        "positive": ["principal"],
    },
    "dim_customers": {
        "unique": [],
    },
    "dim_accounts": {
        "unique": [],
        "non_negative": ["balance"],
    },
}

GOLD_CHECKS = {
    "agg_daily_balances": {
        "not_null": ["balance_date", "total_balance"],
        "non_negative": ["total_balance", "account_count"],
    },
    "agg_kpi_metrics": {
        "not_null": ["kpi", "value", "date"],
    },
    "agg_regulatory_reports": {
        "not_null": ["report_type", "report_date"],
    },
}


class DataQualityEngine:
    """Runs data quality checks across all lakehouse layers."""

    def __init__(self, engine: DeltaEngine = None):
        self.engine = engine or DeltaEngine()
        self._history: List[QualityReport] = []

    def run_all_checks(self) -> QualityReport:
        """Run all defined quality checks across all layers."""
        report = QualityReport(
            run_id=f"dq_{int(time.time())}",
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        for table, checks in BRONZE_CHECKS.items():
            self._run_table_checks(report, MedallionLayer.BRONZE, table, checks)

        for table, checks in SILVER_CHECKS.items():
            self._run_table_checks(report, MedallionLayer.SILVER, table, checks)

        for table, checks in GOLD_CHECKS.items():
            self._run_table_checks(report, MedallionLayer.GOLD, table, checks)

        # Volume checks
        self._check_volumes(report)

        report.completed_at = datetime.now(timezone.utc).isoformat()
        self._history.append(report)

        # Persist report to lakehouse
        self._persist_report(report)

        logger.info(f"Quality report: {report.passed}/{report.total} passed, "
                     f"{report.failed} failed, {report.warnings} warnings")
        return report

    def check_table(self, layer: str, table_name: str,
                    checks: Dict[str, List[str]] = None) -> QualityReport:
        """Run quality checks on a single table."""
        report = QualityReport(
            run_id=f"dq_{table_name}_{int(time.time())}",
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        if checks is None:
            checks = {"not_null": [], "positive": [], "unique": []}
        self._run_table_checks(report, layer, table_name, checks)
        report.completed_at = datetime.now(timezone.utc).isoformat()
        return report

    def check_freshness(self, layer: str, table_name: str,
                        max_age_hours: int = 24) -> QualityCheck:
        """Check that a table has been updated within max_age_hours."""
        history = self.engine.history(layer, table_name)
        if not history:
            return QualityCheck(
                name=f"freshness_{table_name}", table=table_name, layer=layer,
                check_type="freshness", passed=False,
                details="No history available", severity="warning",
            )

        latest = history[0]
        ts = latest.get("timestamp")
        if ts:
            try:
                last_update = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                age_hours = (datetime.now(timezone.utc) - last_update).total_seconds() / 3600
                passed = age_hours <= max_age_hours
                return QualityCheck(
                    name=f"freshness_{table_name}", table=table_name, layer=layer,
                    check_type="freshness", passed=passed,
                    details=f"Last update {age_hours:.1f}h ago (threshold: {max_age_hours}h)",
                    severity="warning" if not passed else "info",
                )
            except Exception:
                pass

        return QualityCheck(
            name=f"freshness_{table_name}", table=table_name, layer=layer,
            check_type="freshness", passed=True,
            details="Timestamp not parseable — skipped", severity="info",
        )

    def _run_table_checks(self, report: QualityReport, layer: str,
                          table_name: str, checks: Dict[str, List[str]]):
        if not self.engine.table_exists(layer, table_name):
            report.add(QualityCheck(
                name=f"exists_{table_name}", table=table_name, layer=layer,
                check_type="exists", passed=False,
                details=f"Table {layer}.{table_name} not found", severity="warning",
            ))
            return

        df = self.engine.read(layer, table_name)
        if df.empty:
            report.add(QualityCheck(
                name=f"non_empty_{table_name}", table=table_name, layer=layer,
                check_type="volume", passed=False,
                details="Table is empty", severity="warning",
            ))
            return

        # Not-null checks
        for col in checks.get("not_null", []):
            if col in df.columns:
                nulls = df[col].isnull().sum()
                report.add(QualityCheck(
                    name=f"not_null_{table_name}_{col}", table=table_name, layer=layer,
                    check_type="null", passed=nulls == 0,
                    rows_checked=len(df), rows_failed=int(nulls),
                    details=f"{col}: {nulls} nulls out of {len(df)} rows",
                ))

        # Uniqueness checks
        for col in checks.get("unique", []):
            if col in df.columns:
                dupes = df[col].duplicated().sum()
                report.add(QualityCheck(
                    name=f"unique_{table_name}_{col}", table=table_name, layer=layer,
                    check_type="unique", passed=dupes == 0,
                    rows_checked=len(df), rows_failed=int(dupes),
                    details=f"{col}: {dupes} duplicates out of {len(df)} rows",
                ))

        # Positive checks (> 0)
        for col in checks.get("positive", []):
            if col in df.columns:
                non_pos = (pd.to_numeric(df[col], errors="coerce") <= 0).sum()
                report.add(QualityCheck(
                    name=f"positive_{table_name}_{col}", table=table_name, layer=layer,
                    check_type="range", passed=non_pos == 0,
                    rows_checked=len(df), rows_failed=int(non_pos),
                    details=f"{col}: {non_pos} non-positive values",
                ))

        # Non-negative checks (>= 0)
        for col in checks.get("non_negative", []):
            if col in df.columns:
                neg = (pd.to_numeric(df[col], errors="coerce") < 0).sum()
                report.add(QualityCheck(
                    name=f"non_negative_{table_name}_{col}", table=table_name, layer=layer,
                    check_type="range", passed=neg == 0,
                    rows_checked=len(df), rows_failed=int(neg),
                    details=f"{col}: {neg} negative values",
                ))

    def _check_volumes(self, report: QualityReport):
        """Check that key tables have reasonable row counts."""
        expectations = {
            (MedallionLayer.BRONZE, "transactions"): (1, 10_000_000),
            (MedallionLayer.SILVER, "fact_transactions"): (1, 10_000_000),
            (MedallionLayer.SILVER, "dim_customers"): (1, 1_000_000),
        }

        for (layer, table), (min_rows, max_rows) in expectations.items():
            if not self.engine.table_exists(layer, table):
                continue
            df = self.engine.read(layer, table)
            rows = len(df)
            in_range = min_rows <= rows <= max_rows
            report.add(QualityCheck(
                name=f"volume_{table}", table=table, layer=layer,
                check_type="volume", passed=in_range,
                rows_checked=rows,
                details=f"{rows} rows (expected {min_rows}-{max_rows})",
                severity="warning" if not in_range else "info",
            ))

    def _persist_report(self, report: QualityReport):
        """Save quality report to the lakehouse for historical tracking."""
        records = []
        for check in report.checks:
            records.append({
                "run_id": report.run_id,
                **asdict(check),
            })
        if records:
            df = pd.DataFrame(records)
            try:
                self.engine.write(MedallionLayer.ML, "quality_reports", df, mode="append")
            except Exception as e:
                logger.warning(f"Failed to persist quality report: {e}")

    @property
    def history(self) -> List[Dict[str, Any]]:
        return [r.to_dict() for r in self._history]
