from __future__ import annotations

import json
import os
import subprocess
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

import requests


BASE_DIR = Path(__file__).resolve().parent
RUST_RISK_EVALUATOR_DIR = BASE_DIR / "rust-risk-evaluator"
RUST_RISK_EVALUATOR_URL = os.getenv("RUST_RISK_EVALUATOR_URL", "http://localhost:8092")
RUST_RISK_EVALUATOR_TIMEOUT = float(os.getenv("RUST_RISK_EVALUATOR_TIMEOUT", "2.5"))


def to_minor_units(amount: Decimal) -> int:
    return int((amount * Decimal("100")).quantize(Decimal("1")))


def build_risk_input(
    *,
    transaction_id: str,
    tenant_id: str,
    customer_id: str,
    amount: Decimal,
    velocity_last_hour: int,
    unknown_device: bool,
    blocked_ip: bool,
    geo_distance_km: float,
    account_age_days: int,
    chargeback_ratio: float,
    merchant_risk: float,
    hour_of_day: Optional[int] = None,
    event_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    timestamp = event_time or datetime.now(timezone.utc)
    return {
        "transaction_id": transaction_id,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "amount_minor": to_minor_units(amount),
        "velocity_last_hour": velocity_last_hour,
        "unknown_device": unknown_device,
        "blocked_ip": blocked_ip,
        "geo_distance_km": geo_distance_km,
        "account_age_days": account_age_days,
        "chargeback_ratio": chargeback_ratio,
        "merchant_risk": merchant_risk,
        "hour_of_day": hour_of_day,
        "event_time": timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _service_request(payload: Dict[str, Any]) -> Dict[str, Any]:
    response = requests.post(
        f"{RUST_RISK_EVALUATOR_URL}/evaluate",
        json=payload,
        timeout=RUST_RISK_EVALUATOR_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def _run_cli(payload: Dict[str, Any]) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(payload, handle)
        handle.write("\n")
        input_path = handle.name

    try:
        result = subprocess.run(
            ["cargo", "run", "--quiet", "--", "--input", input_path],
            cwd=str(RUST_RISK_EVALUATOR_DIR),
            capture_output=True,
            text=True,
            check=True,
            env=os.environ.copy(),
        )
        return json.loads(result.stdout)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise RuntimeError(f"risk evaluator execution failed: {stderr or exc}") from exc
    finally:
        try:
            os.remove(input_path)
        except FileNotFoundError:
            pass


def evaluate_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return _service_request(payload)
    except Exception:
        return _run_cli(payload)
