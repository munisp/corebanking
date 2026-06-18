"""Shared configuration for integration tests."""
import os
import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "requires_services: requires running services")


@pytest.fixture(scope="session")
def mock_mode():
    """Whether to run in mock mode (services not required)."""
    return os.environ.get("MOCK_SERVICES", "1") == "1"


@pytest.fixture(scope="session")
def service_urls():
    """Service URL registry."""
    return {
        "account_opening": os.environ.get("ACCOUNT_OPENING_URL", "http://localhost:8101"),
        "loan_origination": os.environ.get("LOAN_ORIGINATION_URL", "http://localhost:8102"),
        "payments_hub": os.environ.get("PAYMENTS_HUB_URL", "http://localhost:8103"),
        "core_banking": os.environ.get("CORE_BANKING_URL", "http://localhost:8100"),
        "kyc_orchestration": os.environ.get("KYC_SERVICE_URL", "http://localhost:8201"),
        "credit_scoring": os.environ.get("CREDIT_SCORING_URL", "http://localhost:8203"),
        "aml_engine": os.environ.get("AML_ENGINE_URL", "http://localhost:8120"),
        "fraud_detection": os.environ.get("FRAUD_DETECTION_URL", "http://localhost:8122"),
        "sanctions_screening": os.environ.get("SANCTIONS_URL", "http://localhost:8127"),
        "liveness_inference": os.environ.get("LIVENESS_INFERENCE_URL", "http://localhost:8230"),
        "liveness_orchestrator": os.environ.get("LIVENESS_ORCHESTRATOR_URL", "http://localhost:8231"),
        "document_intel": os.environ.get("DOCUMENT_INTEL_URL", "http://localhost:8210"),
        "fx_rates": os.environ.get("FX_RATES_URL", "http://localhost:8166"),
        "gl_engine": os.environ.get("GL_ENGINE_URL", "http://localhost:8136"),
    }
