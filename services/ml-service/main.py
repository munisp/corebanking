from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from api.main import app as api_app

SERVICE_NAME = "ml-service"
SEED_PATH = Path(os.getenv("SEED_FILE", Path(__file__).with_name("seed_data.json")))
DEFAULT_MODEL_REGISTRY_URL = os.getenv("MODEL_REGISTRY_URL", "http://model-registry.default.svc.cluster.local:8080")
DEFAULT_FEATURE_STORE_URL = os.getenv("FEATURE_STORE_URL", "http://feature-store.default.svc.cluster.local:8080")
DEFAULT_FRAUD_THRESHOLD = float(os.getenv("FRAUD_THRESHOLD", "0.72"))
DEFAULT_CREDIT_MODEL_VERSION = os.getenv("CREDIT_MODEL_VERSION", "credit-score-v1")
DEFAULT_FRAUD_MODEL_VERSION = os.getenv("FRAUD_MODEL_VERSION", "fraud-v1")

app = FastAPI(
    title="54link-dev ML Service Runtime",
    description="Root runtime wrapper for the existing ML API surface with readiness and bootstrap metadata.",
    version="1.0.0",
)
app.mount("/api", api_app)


def _load_seed() -> dict[str, Any]:
    if not SEED_PATH.exists():
        return {"service": SERVICE_NAME, "records": []}
    return json.loads(SEED_PATH.read_text())


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "healthy",
        "service": SERVICE_NAME,
        "api_mounted": True,
    }


@app.get("/ready")
def ready() -> dict[str, Any]:
    return {
        "status": "ready",
        "service": SERVICE_NAME,
        "defaults": {
            "model_registry_url": DEFAULT_MODEL_REGISTRY_URL,
            "feature_store_url": DEFAULT_FEATURE_STORE_URL,
            "fraud_threshold": DEFAULT_FRAUD_THRESHOLD,
            "credit_model_version": DEFAULT_CREDIT_MODEL_VERSION,
            "fraud_model_version": DEFAULT_FRAUD_MODEL_VERSION,
        },
        "seed_present": SEED_PATH.exists(),
    }


@app.post("/bootstrap")
def bootstrap() -> JSONResponse:
    seed = _load_seed()
    return JSONResponse(
        {
            "status": "bootstrap-ready",
            "service": SERVICE_NAME,
            "seed_file": str(SEED_PATH),
            "record_count": len(seed.get("records", [])),
            "defaults": {
                "model_registry_url": DEFAULT_MODEL_REGISTRY_URL,
                "feature_store_url": DEFAULT_FEATURE_STORE_URL,
                "fraud_threshold": DEFAULT_FRAUD_THRESHOLD,
                "credit_model_version": DEFAULT_CREDIT_MODEL_VERSION,
                "fraud_model_version": DEFAULT_FRAUD_MODEL_VERSION,
            },
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8061")))
