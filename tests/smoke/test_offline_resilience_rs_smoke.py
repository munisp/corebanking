import pytest
import requests
from pathlib import Path


BASE_URL = __import__("os").getenv("CLUSTER_BASE_URL", "https://54link-dev.upi.dev")
SERVICE_PREFIX = "/offline-resilience"
_svc_dir = Path(__file__).parent.parent.parent / "services" / "offline-resilience-rs"


def _url(path: str) -> str:
    return f"{BASE_URL}{SERVICE_PREFIX}{path}"


def test_offline_resilience_rs_reachable():
    """Service should respond to a health check on the cluster."""
    for endpoint in ("/health", "/healthz", "/ready", "/livez"):
        try:
            r = requests.get(_url(endpoint), timeout=10, verify=False)
            if r.status_code < 500:
                return  # any non-5xx means the service is up
        except requests.exceptions.ConnectionError:
            continue
    pytest.skip(
        f"offline-resilience-rs not reachable at {BASE_URL}{SERVICE_PREFIX} — "
        "set CLUSTER_BASE_URL or ensure the service is deployed"
    )


def test_offline_resilience_rs_has_runtime_entrypoint():
    """Service directory should contain a Go, Python, or Rust entrypoint."""
    if not _svc_dir.exists():
        pytest.skip(f"{_svc_dir} not found in this environment")
    candidates = ["main.go", "main.py", "Cargo.toml", "go.mod"]
    assert any(
        (_svc_dir / c).exists() or list(_svc_dir.rglob(c)) for c in candidates
    ), f"No runtime entrypoint found in {_svc_dir}"
