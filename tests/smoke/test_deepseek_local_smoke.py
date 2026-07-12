import pytest
import json
from pathlib import Path


def test_deepseek_local_seed_exists():
    seed_path = Path(__file__).parent.parent.parent / "services/deepseek-local/seed_data.json"
    if not seed_path.exists():
        pytest.skip(f"{seed_path} not found — run in CI or seed first")
    payload = json.loads(seed_path.read_text())
    assert payload["service"] == "deepseek-local"
    assert len(payload["records"]) >= 2


def test_deepseek_local_service_has_runtime_entrypoint():
    service_dir = Path(__file__).parent.parent.parent / "services/deepseek-local"
    if not service_dir.exists():
        pytest.skip(f"{service_dir} not found in this environment")
    candidates = ["main.go", "main.py", "Cargo.toml"]
    assert any((service_dir / candidate).exists() or list(service_dir.rglob(candidate)) for candidate in candidates), "service should expose at least one runtime entrypoint"
