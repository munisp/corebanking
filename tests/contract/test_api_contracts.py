"""
Contract Tests: Verify API response schemas match expected contracts.
Ensures backward compatibility across service versions.

Usage:
    pytest tests/contract/test_api_contracts.py -v
"""

import os
import pytest
import requests
import json
from typing import Dict, Any, List, Optional

BASE_URL = os.environ.get("API_GATEWAY_URL", "http://localhost:8080")
JWT_TOKEN = os.environ.get("TEST_JWT_TOKEN", "test-token")
TIMEOUT = 10

HEADERS = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json",
}


def validate_schema(data: Dict[str, Any], required_fields: List[str],
                    optional_fields: Optional[List[str]] = None) -> List[str]:
    """Validate response against expected schema."""
    errors = []
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    return errors


class TestHealthContract:
    """All services must return a consistent health check response."""

    REQUIRED_FIELDS = ["status", "service"]
    OPTIONAL_FIELDS = ["version", "uptime_secs", "checks", "capabilities"]

    SERVICES = [
        ("account-opening-go", 8080),
        ("core-banking-go", 8080),
        ("nip-gateway-go", 8080),
        ("bill-payment-go", 8080),
        ("kyc-verification-go", 8080),
    ]

    @pytest.mark.parametrize("service,port", SERVICES)
    def test_healthz_contract(self, service, port):
        url = f"http://{service}:{port}/healthz"
        try:
            resp = requests.get(url, timeout=TIMEOUT)
        except requests.ConnectionError:
            pytest.skip(f"{service} not reachable")
            return

        assert resp.status_code == 200
        data = resp.json()
        errors = validate_schema(data, self.REQUIRED_FIELDS)
        assert not errors, f"Schema violations: {errors}"
        assert data["status"] in ("healthy", "degraded", "unhealthy")


class TestTransferContract:
    """NIP transfer API must follow this contract."""

    TRANSFER_REQUEST_FIELDS = [
        "source_account", "destination_account",
        "destination_bank_code", "amount_kobo", "narration",
    ]
    TRANSFER_RESPONSE_FIELDS = ["reference", "status"]
    TRANSFER_ERROR_FIELDS = ["error"]

    def test_transfer_success_schema(self):
        """Successful transfer response must include reference and status."""
        payload = {
            "source_account": "0123456789",
            "destination_account": "9876543210",
            "destination_bank_code": "000014",
            "amount_kobo": 500000,
            "narration": "Contract test",
            "channel": "api",
            "idempotency_key": "contract-test-transfer-001",
        }

        try:
            resp = requests.post(
                f"{BASE_URL}/v1/nip-gateway/transfer",
                json=payload, headers=HEADERS, timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("NIP gateway not reachable")
            return

        data = resp.json()
        if resp.status_code in (200, 201):
            errors = validate_schema(data, self.TRANSFER_RESPONSE_FIELDS)
            assert not errors, f"Success schema violations: {errors}"
            assert isinstance(data["reference"], str)
            assert data["status"] in ("pending", "processing", "completed", "approved")
        elif resp.status_code in (400, 422):
            errors = validate_schema(data, self.TRANSFER_ERROR_FIELDS)
            assert not errors, f"Error schema violations: {errors}"

    def test_transfer_validation_errors(self):
        """Invalid transfer must return structured error."""
        payload = {
            "source_account": "",  # Invalid
            "amount_kobo": -100,   # Invalid
        }

        try:
            resp = requests.post(
                f"{BASE_URL}/v1/nip-gateway/transfer",
                json=payload, headers=HEADERS, timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("NIP gateway not reachable")
            return

        assert resp.status_code in (400, 422, 401)
        data = resp.json()
        assert "error" in data


class TestPaginationContract:
    """List endpoints must follow consistent pagination."""

    PAGINATION_FIELDS = ["records", "total"]
    
    ENDPOINTS = [
        "/v1/core-banking/list",
        "/v1/account-opening/list",
        "/v1/fee-management/list",
    ]

    @pytest.mark.parametrize("endpoint", ENDPOINTS)
    def test_list_pagination(self, endpoint):
        try:
            resp = requests.get(
                f"{BASE_URL}{endpoint}?page=1&limit=10",
                headers=HEADERS, timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip(f"Service not reachable for {endpoint}")
            return

        if resp.status_code == 200:
            data = resp.json()
            errors = validate_schema(data, self.PAGINATION_FIELDS)
            assert not errors, f"Pagination schema violations: {errors}"
            assert isinstance(data["records"], list)
            assert isinstance(data["total"], (int, float))


class TestSecurityContract:
    """All responses must include required security headers."""

    REQUIRED_HEADERS = [
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "X-Request-Id",
    ]

    def test_security_headers(self):
        try:
            resp = requests.get(f"{BASE_URL}/healthz", timeout=TIMEOUT)
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        for header in self.REQUIRED_HEADERS:
            assert resp.headers.get(header), \
                f"Missing required security header: {header}"

    def test_cors_headers(self):
        try:
            resp = requests.options(
                f"{BASE_URL}/healthz",
                headers={"Origin": "https://app.54bank.ng"},
                timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        # Should either allow the origin or deny — but not crash
        assert resp.status_code in (200, 204, 403, 405)

    def test_no_server_info_leak(self):
        """Server must not leak version or technology stack."""
        try:
            resp = requests.get(f"{BASE_URL}/healthz", timeout=TIMEOUT)
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        server = resp.headers.get("Server", "")
        assert "nginx" not in server.lower(), "Server header leaks technology"
        assert "apache" not in server.lower(), "Server header leaks technology"


class TestErrorContract:
    """All errors must follow a consistent format."""

    def test_404_format(self):
        try:
            resp = requests.get(
                f"{BASE_URL}/nonexistent-endpoint",
                headers=HEADERS, timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        assert resp.status_code == 404
        data = resp.json()
        assert "error" in data

    def test_401_format(self):
        try:
            resp = requests.get(
                f"{BASE_URL}/v1/core-banking/list",
                headers={"Content-Type": "application/json"},
                timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        if resp.status_code == 401:
            data = resp.json()
            assert "error" in data

    def test_413_large_body(self):
        """Body exceeding 1MB must be rejected."""
        large_payload = "x" * (1024 * 1024 + 1)  # >1MB
        try:
            resp = requests.post(
                f"{BASE_URL}/v1/core-banking/list",
                data=large_payload,
                headers=HEADERS,
                timeout=TIMEOUT,
            )
        except requests.ConnectionError:
            pytest.skip("Service not reachable")
            return

        assert resp.status_code in (413, 400)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
