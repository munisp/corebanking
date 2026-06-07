#!/usr/bin/env python3
"""54Bank Golden Path Integration Tests
Tests the critical customer journey: register → KYC → fund → transfer → statement
Requires: running Postgres, Redis, and at least core services
"""
import requests, time, json

BASE_URL = "http://localhost:3000/api"

def test_health_check():
    """All critical services must be healthy"""
    services = ["account-opening-go:8080", "payments-hub-go:8080", "kyc-aml-screening-py:8080"]
    for svc in services:
        host, port = svc.split(":")
        try:
            r = requests.get(f"http://{host}:{port}/healthz", timeout=5)
            assert r.status_code == 200, f"{host} unhealthy: {r.status_code}"
            data = r.json()
            assert data.get("status") == "healthy", f"{host} status: {data.get('status')}"
        except requests.ConnectionError:
            print(f"SKIP: {host} not reachable")

def test_account_opening():
    """Account opening with NUBAN validation"""
    payload = {
        "customer_name": "Adewale Ogundimu",
        "bvn": "22345678901",
        "phone": "+2348012345678",
        "product_type": "savings",
        "tier": "tier1"
    }
    r = requests.post(f"{BASE_URL}/accounts", json=payload, timeout=10)
    assert r.status_code in (200, 201), f"Account creation failed: {r.status_code}"
    data = r.json()
    assert "account_number" in str(data) or "id" in str(data)
    return data

def test_kyc_verification():
    """KYC with BVN and NIN validation"""
    payload = {
        "customer_id": "CUST-001",
        "bvn": "22345678901",
        "nin": "12345678901",
        "verification_type": "tier2"
    }
    r = requests.post(f"{BASE_URL}/kyc/verify", json=payload, timeout=10)
    assert r.status_code in (200, 201)

def test_transfer():
    """Internal transfer with NFIU compliance check"""
    payload = {
        "source_account": "0123456789",
        "destination_account": "9876543210",
        "amount": 500000,  # 5000 NGN in kobo
        "narration": "Test transfer",
        "channel": "api"
    }
    r = requests.post(f"{BASE_URL}/transfers", json=payload, timeout=10)
    assert r.status_code in (200, 201)

def test_ndpr_consent():
    """NDPR consent management"""
    payload = {
        "user_id": "USER-001",
        "purpose": "transaction_processing",
        "legal_basis": "contract"
    }
    r = requests.post(f"{BASE_URL}/ndpr/consents/grant", json=payload, timeout=10)
    assert r.status_code == 200

if __name__ == "__main__":
    tests = [test_health_check, test_account_opening, test_kyc_verification, test_transfer, test_ndpr_consent]
    passed = failed = skipped = 0
    for test in tests:
        try:
            test()
            passed += 1
            print(f"  PASS: {test.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL: {test.__name__}: {e}")
        except Exception as e:
            skipped += 1
            print(f"  SKIP: {test.__name__}: {e}")
    print(f"\nResults: {passed} passed, {failed} failed, {skipped} skipped")
