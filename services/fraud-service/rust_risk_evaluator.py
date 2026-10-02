from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import tempfile
import threading
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


BASE_DIR = Path(__file__).resolve().parent
RUST_RISK_EVALUATOR_DIR = BASE_DIR / "rust-risk-evaluator"
RUST_RISK_EVALUATOR_URL = os.getenv("RUST_RISK_EVALUATOR_URL", "http://localhost:8092")
RUST_RISK_EVALUATOR_TIMEOUT = float(os.getenv("RUST_RISK_EVALUATOR_TIMEOUT", "2.5"))

# W11 PY-003: the CLI fallback previously ran `cargo run` on EVERY request
# (a full cargo compile check + process spawn on the hot path). The release
# binary is now located once at startup; if absent it is built ONCE (in a
# thread, off the event loop); if that build fails the CLI fallback is
# honestly marked unavailable and raises — no mock scores are ever returned.
_CLI_BINARY_PATH = (
    RUST_RISK_EVALUATOR_DIR / "target" / "release" / "rust-risk-evaluator"
)
_CLI_BUILD_TIMEOUT = float(os.getenv("RUST_RISK_EVALUATOR_BUILD_TIMEOUT", "600"))
_CLI_RUN_TIMEOUT = float(os.getenv("RUST_RISK_EVALUATOR_CLI_TIMEOUT", "5.0"))

# Process-wide availability cache: {"checked": bool, "binary": Optional[str]}
_cli_lock = threading.Lock()
_cli_state: Dict[str, Any] = {"checked": False, "binary": None}


def _resolve_cli_binary() -> Optional[str]:
    """Locate the prebuilt release binary, building it ONCE if absent.

    The result is cached process-wide (availability cache). Returns None if
    no binary exists and the one-time build fails.
    """
    with _cli_lock:
        if _cli_state["checked"]:
            return _cli_state["binary"]

        binary: Optional[str] = None
        if _CLI_BINARY_PATH.is_file() and os.access(_CLI_BINARY_PATH, os.X_OK):
            binary = str(_CLI_BINARY_PATH)
            logger.info("rust risk evaluator CLI binary found at %s", binary)
        else:
            logger.info(
                "rust risk evaluator CLI binary missing — running one-time "
                "`cargo build --release` (timeout=%ss)",
                _CLI_BUILD_TIMEOUT,
            )
            try:
                subprocess.run(
                    ["cargo", "build", "--release"],
                    cwd=str(RUST_RISK_EVALUATOR_DIR),
                    capture_output=True,
                    text=True,
                    check=True,
                    timeout=_CLI_BUILD_TIMEOUT,
                    env=os.environ.copy(),
                )
                if _CLI_BINARY_PATH.is_file():
                    binary = str(_CLI_BINARY_PATH)
                    logger.info(
                        "rust risk evaluator CLI built at %s", binary
                    )
            except Exception as exc:
                logger.error(
                    "rust risk evaluator CLI UNAVAILABLE — one-time build "
                    "failed: %s",
                    exc,
                )
                binary = None

        _cli_state["checked"] = True
        _cli_state["binary"] = binary
        return binary


def initialize_cli() -> None:
    """Resolve (and if needed build) the CLI binary once at startup.

    Blocking (a cargo build may run) — call from a thread, e.g. during app
    startup: ``await asyncio.to_thread(initialize_cli)``. Safe to omit;
    the first CLI use resolves lazily under the same cache.
    """
    _resolve_cli_binary()


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


def _write_payload_file(payload: Dict[str, Any]) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump(payload, handle)
        handle.write("\n")
        return handle.name


def _remove_quietly(path: str) -> None:
    try:
        os.remove(path)
    except (FileNotFoundError, OSError):
        pass


def _run_cli(payload: Dict[str, Any]) -> Dict[str, Any]:
    binary = _resolve_cli_binary()
    if binary is None:
        # Honest failure: no binary and the one-time build failed.
        raise RuntimeError(
            "rust risk evaluator CLI unavailable: no prebuilt release binary "
            f"at {_CLI_BINARY_PATH} and the one-time cargo build failed"
        )

    input_path = _write_payload_file(payload)
    try:
        result = subprocess.run(
            [binary, "--input", input_path],
            cwd=str(RUST_RISK_EVALUATOR_DIR),
            capture_output=True,
            text=True,
            check=True,
            timeout=_CLI_RUN_TIMEOUT,
            env=os.environ.copy(),
        )
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(
            f"risk evaluator execution timed out after {_CLI_RUN_TIMEOUT}s"
        ) from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        raise RuntimeError(f"risk evaluator execution failed: {stderr or exc}") from exc
    finally:
        _remove_quietly(input_path)


async def _run_cli_async(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Async CLI fallback: non-blocking subprocess with a hard timeout."""
    binary = await asyncio.to_thread(_resolve_cli_binary)
    if binary is None:
        raise RuntimeError(
            "rust risk evaluator CLI unavailable: no prebuilt release binary "
            f"at {_CLI_BINARY_PATH} and the one-time cargo build failed"
        )

    input_path = await asyncio.to_thread(_write_payload_file, payload)
    proc = None
    try:
        proc = await asyncio.create_subprocess_exec(
            binary,
            "--input",
            input_path,
            cwd=str(RUST_RISK_EVALUATOR_DIR),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=os.environ.copy(),
        )
        try:
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(), timeout=_CLI_RUN_TIMEOUT
            )
        except asyncio.TimeoutError as exc:
            proc.kill()
            await proc.wait()
            raise RuntimeError(
                f"risk evaluator execution timed out after {_CLI_RUN_TIMEOUT}s"
            ) from exc
        if proc.returncode != 0:
            err = (stderr or b"").decode(errors="replace").strip()
            raise RuntimeError(
                f"risk evaluator execution failed: {err or proc.returncode}"
            )
        return json.loads(stdout.decode())
    finally:
        await asyncio.to_thread(_remove_quietly, input_path)


def evaluate_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Sync entrypoint — call from a thread (asyncio.to_thread) in async
    handlers; the HTTP service call and CLI fallback both block."""
    try:
        return _service_request(payload)
    except Exception:
        return _run_cli(payload)


async def async_evaluate_risk(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Async entrypoint: HTTP service via thread, CLI via non-blocking
    subprocess with timeout."""
    try:
        return await asyncio.to_thread(_service_request, payload)
    except Exception:
        return await _run_cli_async(payload)
