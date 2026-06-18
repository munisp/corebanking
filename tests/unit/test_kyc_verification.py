"""Unit tests for KYC verification domain logic."""
import pytest
import importlib.util
import os

def _load_module(name, service_dir):
    spec = importlib.util.spec_from_file_location(name, os.path.join(
        os.path.dirname(__file__), '../../services', service_dir, 'main.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_kyc = _load_module('kyc_engine_main', 'kyc-engine-py')

def test_bvn_validation():
    """BVN must be 11 digits."""
    assert _kyc.validate_bvn("12345678901")["valid"] == True
    assert _kyc.validate_bvn("1234")["valid"] == False
    assert _kyc.validate_bvn("")["valid"] == False
    assert _kyc.validate_bvn("abcdefghijk")["valid"] == False

def test_nin_validation():
    """NIN must be 11 digits."""
    assert _kyc.validate_nin("12345678901")["valid"] == True
    assert _kyc.validate_nin("short")["valid"] == False

def test_kyc_tier_determination():
    """KYC tier based on documents provided."""
    result_basic = _kyc.determine_tier({"bvn": "12345678901", "docs_submitted": []})
    tier_basic = result_basic["tier"]
    assert tier_basic in ("tier1", "tier2", "tier3"), f"Unexpected tier: {tier_basic}"

    result_full = _kyc.determine_tier({"bvn": "12345678901", "nin": "12345678901",
                                       "docs_submitted": ["utility_bill", "bank_statement", "passport"],
                                       "liveness_passed": True})
    tier_full = result_full["tier"]
    tier_levels = {"tier1": 1, "tier2": 2, "tier3": 3}
    assert tier_levels[tier_full] >= tier_levels[tier_basic], \
        f"Full KYC tier ({tier_full}) should be >= basic ({tier_basic})"
