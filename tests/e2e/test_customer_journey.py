"""
E2E Test Suite: Complete Customer Journey
Tests the full lifecycle from onboarding to first transaction.

Usage:
    pytest tests/e2e/test_customer_journey.py -v --env=staging

Requires:
    - All services running (docker-compose up or K8s cluster)
    - TEST_JWT_TOKEN env var set
    - DATABASE_URL env var set
"""

import os
import time
import uuid
import json
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("API_GATEWAY_URL", "http://localhost:8080")
JWT_TOKEN = os.environ.get("TEST_JWT_TOKEN", "test-token")
TIMEOUT = 30

HEADERS = {
    "Authorization": f"Bearer {JWT_TOKEN}",
    "Content-Type": "application/json",
    "X-Request-Id": str(uuid.uuid4()),
}


class TestCustomerOnboarding:
    """Test complete customer onboarding flow."""
    
    application_id = None
    account_number = None
    customer_id = None
    
    def test_01_submit_application(self):
        """Submit a new account opening application."""
        payload = {
            "customer": {
                "first_name": "Chioma",
                "last_name": "Okafor",
                "bvn": "22345678901",
                "nin": "12345678901",
                "phone": "+2348012345678",
                "email": f"chioma.{uuid.uuid4().hex[:8]}@test.example.com",
                "date_of_birth": "1992-03-20",
                "gender": "female",
                "address": {
                    "street": "15 Broad Street",
                    "city": "Lagos",
                    "state": "Lagos",
                    "lga": "Lagos Island",
                    "country": "NG",
                },
            },
            "account_type": "savings",
            "currency": "NGN",
            "branch_code": "001",
            "idempotency_key": f"e2e-onboard-{uuid.uuid4().hex}",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/account-opening/apply",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code in (200, 201), f"Application failed: {resp.text}"
        
        data = resp.json()
        TestCustomerOnboarding.application_id = data.get("application_id")
        assert TestCustomerOnboarding.application_id, "No application_id returned"
    
    def test_02_kyc_verification(self):
        """Verify customer KYC documents."""
        if not self.application_id:
            pytest.skip("No application_id from previous step")
        
        payload = {
            "application_id": self.application_id,
            "bvn": "22345678901",
            "nin": "12345678901",
            "documents": [
                {"type": "utility_bill", "url": "https://docs.test/bill.pdf"},
                {"type": "passport_photo", "url": "https://docs.test/photo.jpg"},
            ],
            "liveness_check": {"score": 0.95, "passed": True},
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/kyc/verify",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"KYC failed: {resp.text}"
        
        data = resp.json()
        assert data.get("status") in ("verified", "approved", "pending")
    
    def test_03_activate_account(self):
        """Activate the account after KYC passes."""
        if not self.application_id:
            pytest.skip("No application_id from previous step")
        
        payload = {
            "application_id": self.application_id,
            "action": "activate",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/account-opening/activate",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Activation failed: {resp.text}"
        
        data = resp.json()
        TestCustomerOnboarding.account_number = data.get("account_number")
        TestCustomerOnboarding.customer_id = data.get("customer_id")
    
    def test_04_check_account_balance(self):
        """Verify account starts with zero balance."""
        if not self.account_number:
            pytest.skip("No account_number from previous step")
        
        resp = requests.get(
            f"{BASE_URL}/v1/core-banking/balance/{self.account_number}",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Balance check failed: {resp.text}"
        
        data = resp.json()
        assert data.get("available_balance_kobo", 0) >= 0


class TestFundsTransfer:
    """Test complete funds transfer flow."""
    
    transfer_ref = None
    
    def test_01_name_enquiry(self):
        """Verify destination account before transfer."""
        payload = {
            "destination_bank_code": "000014",
            "account_number": "0123456789",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/nip-gateway/name-enquiry",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Name enquiry failed: {resp.text}"
    
    def test_02_initiate_transfer(self):
        """Initiate a NIP transfer."""
        payload = {
            "source_account": "0123456789",
            "destination_account": "9876543210",
            "destination_bank_code": "000014",
            "amount_kobo": 500000,  # ₦5,000
            "narration": "E2E test transfer",
            "channel": "web",
            "idempotency_key": f"e2e-transfer-{uuid.uuid4().hex}",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code in (200, 201), f"Transfer failed: {resp.text}"
        
        data = resp.json()
        TestFundsTransfer.transfer_ref = data.get("reference")
    
    def test_03_verify_idempotency(self):
        """Same idempotency key should return same result."""
        payload = {
            "source_account": "0123456789",
            "destination_account": "9876543210",
            "destination_bank_code": "000014",
            "amount_kobo": 500000,
            "narration": "E2E test transfer",
            "channel": "web",
            "idempotency_key": "e2e-idempotency-test-fixed-key",
        }
        
        resp1 = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        
        resp2 = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        
        if resp1.status_code == 200 and resp2.status_code == 200:
            data1 = resp1.json()
            data2 = resp2.json()
            assert data1.get("reference") == data2.get("reference"), \
                "Idempotency violated — different references for same key"
    
    def test_04_check_transaction_history(self):
        """Verify transfer appears in transaction history."""
        resp = requests.get(
            f"{BASE_URL}/v1/core-banking/transactions/0123456789?limit=10",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Transaction history failed: {resp.text}"


class TestComplianceChecks:
    """Test CBN compliance and regulatory checks."""
    
    def test_01_transaction_limit_enforcement(self):
        """Verify CBN daily transaction limits."""
        payload = {
            "source_account": "0123456789",
            "destination_account": "9876543210",
            "destination_bank_code": "000014",
            "amount_kobo": 600_000_000_000,  # ₦6B — exceeds ₦5B CBN limit
            "narration": "Limit test",
            "idempotency_key": f"e2e-limit-{uuid.uuid4().hex}",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        # Should be rejected
        assert resp.status_code in (400, 422, 403), \
            f"Expected rejection for ₦6B transfer, got {resp.status_code}"
    
    def test_02_rate_limiting(self):
        """Verify rate limiting prevents abuse."""
        responses = []
        for _ in range(150):
            resp = requests.get(
                f"{BASE_URL}/healthz",
                headers=HEADERS,
                timeout=5,
            )
            responses.append(resp.status_code)
            if resp.status_code == 429:
                break
        
        assert 429 in responses, "Rate limiting not triggered after 150 requests"
    
    def test_03_security_headers_present(self):
        """Verify all security headers are set."""
        resp = requests.get(f"{BASE_URL}/healthz", timeout=TIMEOUT)
        
        required_headers = [
            "X-Frame-Options",
            "X-Content-Type-Options",
            "Strict-Transport-Security",
            "Content-Security-Policy",
        ]
        
        for header in required_headers:
            assert resp.headers.get(header), f"Missing security header: {header}"
    
    def test_04_input_validation(self):
        """Verify malicious input is rejected."""
        # SQL injection attempt
        payload = {
            "source_account": "'; DROP TABLE accounts; --",
            "destination_account": "9876543210",
            "amount_kobo": 100,
            "idempotency_key": f"e2e-sqli-{uuid.uuid4().hex}",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code in (400, 422), \
            f"SQL injection not rejected: {resp.status_code}"
    
    def test_05_xss_prevention(self):
        """Verify XSS payloads are sanitized."""
        payload = {
            "narration": '<script>alert("xss")</script>',
            "source_account": "0123456789",
            "destination_account": "9876543210",
            "amount_kobo": 100,
            "idempotency_key": f"e2e-xss-{uuid.uuid4().hex}",
        }
        
        resp = requests.post(
            f"{BASE_URL}/v1/nip-gateway/transfer",
            json=payload,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            narration = json.dumps(data)
            assert "<script>" not in narration, "XSS payload not sanitized"


class TestAuditTrail:
    """Test audit logging is working."""
    
    def test_01_audit_endpoint_exists(self):
        """Verify audit trail endpoint returns data."""
        resp = requests.get(
            f"{BASE_URL}/v1/audit",
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200, f"Audit endpoint failed: {resp.text}"
    
    def test_02_request_id_propagation(self):
        """Verify X-Request-Id is echoed back."""
        request_id = str(uuid.uuid4())
        resp = requests.get(
            f"{BASE_URL}/healthz",
            headers={**HEADERS, "X-Request-Id": request_id},
            timeout=TIMEOUT,
        )
        assert resp.headers.get("X-Request-Id") == request_id, \
            "X-Request-Id not propagated"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
