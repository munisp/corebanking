"""54Bank — ETL Scheduler
Cron-style scheduler for periodic lakehouse ETL jobs:
- Bronze ingestion from PostgreSQL
- Silver transformations (hourly)
- Gold aggregations (hourly)
- Data quality checks (after each pipeline run)
- Table maintenance: compact + vacuum (daily)
"""

import logging
import threading
import time
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

from lakehouse.engine.delta_engine import DeltaEngine
from lakehouse.etl.medallion import MedallionPipeline, BronzeIngestor
from lakehouse.quality.checks import DataQualityEngine

logger = logging.getLogger("54bank.lakehouse.scheduler")


@dataclass
class ScheduleEntry:
    name: str
    interval_seconds: int
    last_run: float = 0
    run_count: int = 0
    last_status: str = "pending"
    last_error: str = ""
    enabled: bool = True


class ETLScheduler:
    """Schedules and runs periodic ETL jobs for the lakehouse."""

    def __init__(self, engine: DeltaEngine = None):
        self.engine = engine or DeltaEngine()
        self.pipeline = MedallionPipeline(self.engine)
        self.quality = DataQualityEngine(self.engine)
        self._running = False
        self._thread: Optional[threading.Thread] = None

        self.schedules: Dict[str, ScheduleEntry] = {
            "silver_transforms": ScheduleEntry(
                name="silver_transforms", interval_seconds=3600,  # hourly
            ),
            "gold_aggregations": ScheduleEntry(
                name="gold_aggregations", interval_seconds=3600,  # hourly
            ),
            "quality_checks": ScheduleEntry(
                name="quality_checks", interval_seconds=7200,  # every 2h
            ),
            "compact_tables": ScheduleEntry(
                name="compact_tables", interval_seconds=86400,  # daily
            ),
            "vacuum_tables": ScheduleEntry(
                name="vacuum_tables", interval_seconds=86400,  # daily
            ),
        }

    def run_once(self, job_name: str = None) -> Dict[str, Any]:
        """Run a specific job or all jobs once (non-scheduled)."""
        if job_name:
            return self._run_job(job_name)

        results = {}
        for name in self.schedules:
            results[name] = self._run_job(name)
        return results

    def start(self, check_interval: int = 60):
        """Start the scheduler loop in a background thread."""
        self._running = True

        def _loop():
            logger.info("ETL Scheduler started")
            while self._running:
                now = time.time()
                for name, entry in self.schedules.items():
                    if not entry.enabled:
                        continue
                    if now - entry.last_run >= entry.interval_seconds:
                        try:
                            self._run_job(name)
                        except Exception as e:
                            logger.error(f"Scheduler job {name} failed: {e}")
                time.sleep(check_interval)
            logger.info("ETL Scheduler stopped")

        self._thread = threading.Thread(target=_loop, daemon=True, name="etl-scheduler")
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)

    def _run_job(self, name: str) -> Dict[str, Any]:
        entry = self.schedules.get(name)
        if not entry:
            return {"error": f"Unknown job: {name}"}

        t0 = time.time()
        logger.info(f"Running ETL job: {name}")

        try:
            if name == "silver_transforms":
                result = self.pipeline.silver.run_all()
            elif name == "gold_aggregations":
                result = self.pipeline.gold.run_all()
            elif name == "quality_checks":
                report = self.quality.run_all_checks()
                result = report.to_dict()
            elif name == "compact_tables":
                result = self._compact_all()
            elif name == "vacuum_tables":
                result = self._vacuum_all()
            else:
                result = {"error": f"No handler for {name}"}

            entry.last_run = time.time()
            entry.run_count += 1
            entry.last_status = "success"
            entry.last_error = ""

            elapsed = time.time() - t0
            logger.info(f"ETL job {name} completed in {elapsed:.1f}s")
            return {"job": name, "status": "success", "elapsed_seconds": round(elapsed, 3),
                    "result": result}

        except Exception as e:
            entry.last_run = time.time()
            entry.run_count += 1
            entry.last_status = "error"
            entry.last_error = str(e)
            logger.error(f"ETL job {name} failed: {e}")
            return {"job": name, "status": "error", "error": str(e)}

    def _compact_all(self) -> Dict[str, Any]:
        results = {}
        all_tables = self.engine.list_tables()
        for layer, tables in all_tables.items():
            for t in tables:
                name = t["name"]
                if t.get("files", 0) > 5:
                    results[f"{layer}.{name}"] = self.engine.compact(layer, name)
        return results

    def _vacuum_all(self) -> Dict[str, Any]:
        results = {}
        all_tables = self.engine.list_tables()
        for layer, tables in all_tables.items():
            for t in tables:
                results[f"{layer}.{t['name']}"] = self.engine.vacuum(layer, t["name"])
        return results

    @property
    def status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "jobs": {k: asdict(v) for k, v in self.schedules.items()},
        }
