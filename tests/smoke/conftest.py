import os
import re
import pytest
try:
    import psycopg as psycopg2  # psycopg v3
except ImportError:
    psycopg2 = None

_DB_URL = os.getenv("DATABASE_URL")
_conn = None


def _get_conn():
    global _conn
    if _conn is None or _conn.closed:
        if not _DB_URL:
            return None
        _conn = psycopg2.connect(_DB_URL)
        _conn.autocommit = True
        with _conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS smoke_test (
                    id           SERIAL PRIMARY KEY,
                    service_name VARCHAR(255) NOT NULL,
                    status       VARCHAR(50)  NOT NULL,
                    error_detail TEXT,
                    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
                )
            """)
    return _conn


def _service_name(nodeid: str) -> str:
    # tests/smoke/test_account_service_smoke.py::test_account_service_reachable
    # → account-service
    filename = nodeid.split("::")[0].split("/")[-1]
    name = re.sub(r"^test_|_smoke\.py$", "", filename).replace("_", "-")
    return name


def _write(service_name: str, status: str, error_detail: str | None):
    conn = _get_conn()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO smoke_test (service_name, status, error_detail) VALUES (%s, %s, %s)",
                (service_name, status, error_detail or None),
            )
    except Exception:
        pass


def pytest_runtest_logreport(report):
    if report.when != "call":
        # Only record the actual test call, not setup/teardown
        # For skips that happen in setup, handle separately
        if report.when == "setup" and report.skipped:
            _write(_service_name(report.nodeid), "skipped", None)
        return

    service = _service_name(report.nodeid)

    if report.passed:
        _write(service, "passed", None)
    elif report.failed:
        error = str(report.longrepr)[:2000] if report.longrepr else None
        _write(service, "failed", error)
    elif report.skipped:
        _write(service, "skipped", None)
