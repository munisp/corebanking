"""Unit tests for AML/transaction pattern analysis domain logic."""
import pytest
import importlib.util
import os

def _load_module(name, service_dir):
    spec = importlib.util.spec_from_file_location(name, os.path.join(
        os.path.dirname(__file__), '../../services', service_dir, 'main.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_txn = _load_module('txn_pattern_main', 'txn-pattern-analyzer-py')

def test_pattern_risk_score_range():
    """Pattern analysis risk score must be 0-100."""
    result = _txn.analyze_patterns([
        {"amount": 5000000, "type": "transfer"},
        {"amount": 200000, "type": "deposit"},
    ])
    assert 0 <= result["risk_score"] <= 100, f"Risk score {result['risk_score']} out of range"
    assert result["transactions_analyzed"] == 2

def test_structuring_detection():
    """Multiple just-under-threshold transactions should be flagged as structuring."""
    result = _txn.analyze_patterns([
        {"amount": 900000, "type": "cash_deposit"},
        {"amount": 950000, "type": "cash_deposit"},
        {"amount": 920000, "type": "cash_deposit"},
    ])
    pattern_types = [p["type"] for p in result["patterns"]]
    assert "structuring" in pattern_types, "Should detect structuring pattern"
    assert result["risk_score"] > 0, "Structuring should increase risk score"

def test_no_patterns_clean():
    """Normal transactions should have zero risk."""
    result = _txn.analyze_patterns([
        {"amount": 50000, "type": "transfer"},
        {"amount": 75000, "type": "deposit"},
    ])
    assert result["risk_score"] == 0, "Clean transactions should have zero risk"
    assert len(result["patterns"]) == 0
