#!/usr/bin/env python3
"""54Bank — Continuous Training Scheduler
Automated scheduling for model retraining, drift checks, and maintenance.

Scheduling modes:
1. Cron-based: daily/weekly/monthly retraining per model config
2. Event-driven: triggered by drift detection thresholds
3. Manual: CLI or API trigger

Usage:
    # Start scheduler daemon
    python -m ml.continuous_training.scheduler

    # Or via environment
    CT_SCHEDULE_MODE=cron CT_CHECK_INTERVAL=3600 python -m ml.continuous_training.scheduler
"""
import os
import json
import time
import signal
import logging
import threading
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger("54bank.continuous_training.scheduler")

WEIGHTS_DIR = Path(__file__).parent.parent / "weights"


class ScheduleEntry:
    """A scheduled task for a model."""

    SCHEDULE_INTERVALS = {
        "hourly": timedelta(hours=1),
        "daily": timedelta(days=1),
        "weekly": timedelta(weeks=1),
        "monthly": timedelta(days=30),
    }

    def __init__(self, model_name: str, schedule: str,
                 task_type: str = "full_pipeline"):
        self.model_name = model_name
        self.schedule = schedule
        self.task_type = task_type
        self.interval = self.SCHEDULE_INTERVALS.get(schedule, timedelta(days=1))
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.consecutive_failures = 0
        self.last_result: Optional[dict] = None
        self._compute_next_run()

    def _compute_next_run(self):
        """Compute next run time."""
        now = datetime.now(timezone.utc)
        if self.last_run is None:
            # First run: schedule after a short delay
            self.next_run = now + timedelta(minutes=1)
        else:
            self.next_run = self.last_run + self.interval

            # Backoff on consecutive failures
            if self.consecutive_failures > 0:
                backoff = min(self.consecutive_failures * 2, 24)  # max 24 hour backoff
                self.next_run = now + timedelta(hours=backoff)

    def is_due(self) -> bool:
        """Check if this task is due to run."""
        return datetime.now(timezone.utc) >= self.next_run

    def record_success(self, result: dict):
        self.last_run = datetime.now(timezone.utc)
        self.last_result = result
        self.consecutive_failures = 0
        self._compute_next_run()

    def record_failure(self, error: str):
        self.last_run = datetime.now(timezone.utc)
        self.last_result = {"error": error}
        self.consecutive_failures += 1
        self._compute_next_run()

    def to_dict(self) -> dict:
        return {
            "model_name": self.model_name,
            "schedule": self.schedule,
            "task_type": self.task_type,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "consecutive_failures": self.consecutive_failures,
        }


class ContinuousTrainingScheduler:
    """Manages scheduled retraining tasks.

    Default schedule (from RetrainingConfig):
        fraud_detector:  daily
        credit_scorer:   weekly
        anomaly_vae:     weekly
        churn_predictor: monthly
        gnn_fraud_ring:  weekly
        aml_scorer:      daily

    Drift checks run at 2x frequency of retraining schedule.
    """

    def __init__(self, check_interval: int = None):
        self.check_interval = check_interval or int(
            os.environ.get("CT_CHECK_INTERVAL", 3600))  # default 1 hour
        self.entries: dict[str, ScheduleEntry] = {}
        self.running = False
        self._shutdown_event = threading.Event()
        self._state_file = WEIGHTS_DIR / "scheduler_state.json"
        self._init_schedule()
        self._load_state()

    def _init_schedule(self):
        """Initialize schedule from model configs."""
        from ml.continuous_training.orchestrator import RetrainingConfig

        for model_name, config in RetrainingConfig.CONFIGS.items():
            schedule = config.get("schedule", "weekly")
            self.entries[model_name] = ScheduleEntry(
                model_name=model_name,
                schedule=schedule,
                task_type="full_pipeline",
            )

    def _load_state(self):
        """Load scheduler state from disk."""
        if not self._state_file.exists():
            return

        try:
            with open(self._state_file) as f:
                state = json.load(f)

            for entry_data in state.get("entries", []):
                name = entry_data.get("model_name")
                if name in self.entries:
                    if entry_data.get("last_run"):
                        self.entries[name].last_run = datetime.fromisoformat(
                            entry_data["last_run"])
                    self.entries[name].consecutive_failures = entry_data.get(
                        "consecutive_failures", 0)
                    self.entries[name]._compute_next_run()

        except Exception as e:
            logger.warning(f"Failed to load scheduler state: {e}")

    def _save_state(self):
        """Persist scheduler state."""
        state = {
            "entries": [e.to_dict() for e in self.entries.values()],
            "last_saved": datetime.now(timezone.utc).isoformat(),
        }

        try:
            with open(self._state_file, "w") as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save scheduler state: {e}")

    def _run_task(self, entry: ScheduleEntry):
        """Execute a scheduled task."""
        logger.info(f"Running scheduled task: {entry.model_name} ({entry.task_type})")

        try:
            from ml.continuous_training.orchestrator import ContinuousTrainingOrchestrator
            orchestrator = ContinuousTrainingOrchestrator()

            if entry.task_type == "full_pipeline":
                result = orchestrator.run_full_pipeline([entry.model_name])
                model_result = result.get(entry.model_name, {})
            elif entry.task_type == "drift_check":
                model_result = orchestrator.run_drift_check(entry.model_name)
            elif entry.task_type == "retrain":
                model_result = orchestrator.run_retraining(entry.model_name)
            else:
                model_result = {"error": f"Unknown task type: {entry.task_type}"}

            entry.record_success(model_result)
            logger.info(f"Task completed: {entry.model_name} — "
                         f"retrained={model_result.get('retrained', 'N/A')}")

        except Exception as e:
            entry.record_failure(str(e))
            logger.error(f"Task failed: {entry.model_name} — {e}")

    def tick(self):
        """Check all entries and run due tasks."""
        for entry in self.entries.values():
            if entry.is_due():
                self._run_task(entry)
                self._save_state()

    def start(self):
        """Start the scheduler loop."""
        self.running = True
        logger.info(f"Scheduler started. Check interval: {self.check_interval}s")
        logger.info("Schedule:")
        for name, entry in self.entries.items():
            logger.info(f"  {name}: {entry.schedule} "
                         f"(next: {entry.next_run.strftime('%Y-%m-%d %H:%M') if entry.next_run else 'now'})")

        while self.running:
            try:
                self.tick()
            except Exception as e:
                logger.error(f"Scheduler tick error: {e}")

            # Wait for check_interval or shutdown signal
            if self._shutdown_event.wait(timeout=self.check_interval):
                break

        logger.info("Scheduler stopped.")

    def stop(self):
        """Stop the scheduler."""
        self.running = False
        self._shutdown_event.set()
        self._save_state()

    def get_schedule(self) -> list:
        """Get current schedule as list of dicts."""
        return [e.to_dict() for e in self.entries.values()]

    def trigger_now(self, model_name: str) -> dict:
        """Trigger immediate execution for a model."""
        entry = self.entries.get(model_name)
        if not entry:
            return {"error": f"Unknown model: {model_name}"}

        self._run_task(entry)
        self._save_state()
        return entry.last_result or {"status": "completed"}


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    scheduler = ContinuousTrainingScheduler()

    # Handle graceful shutdown
    def shutdown_handler(signum, frame):
        logger.info("Shutdown signal received")
        scheduler.stop()

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    scheduler.start()


if __name__ == "__main__":
    main()
