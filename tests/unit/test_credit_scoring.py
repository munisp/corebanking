"""Unit tests for credit scoring domain logic."""
import pytest
import importlib.util
import os

def _load_module(name, service_dir):
    spec = importlib.util.spec_from_file_location(name, os.path.join(
        os.path.dirname(__file__), '../../services', service_dir, 'main.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_credit = _load_module('credit_scoring_main', 'credit-scoring-py')

def test_credit_score_range():
    """Credit score must be 300-850."""
    result = _credit.compute_credit_score(
        income=500000, debt=200000, employment_years=5,
        loan_history_count=1, defaults=0, age=35
    )
    assert 300 <= result["score"] <= 850, f"Score {result['score']} out of range"
    assert result["band"] in ("excellent", "good", "fair", "poor")

def test_credit_score_good_vs_bad():
    """Good profile should score higher than bad profile."""
    good = _credit.compute_credit_score(
        income=500000, debt=50000, employment_years=10,
        loan_history_count=3, defaults=0, age=40
    )
    bad = _credit.compute_credit_score(
        income=100000, debt=90000, employment_years=1,
        loan_history_count=5, defaults=3, age=22
    )
    assert good["score"] > bad["score"], f"Good ({good['score']}) should score higher than bad ({bad['score']})"

def test_affordability_check():
    """Affordability check should compute disposable income and max EMI."""
    result = _credit.affordability_check(monthly_income=500000, monthly_expenses=200000, proposed_emi=100000)
    assert result["disposable_income"] == 300000
    assert result["affordable"] == True
    assert result["max_emi"] == 150000

def test_affordability_check_unaffordable():
    """Proposed EMI exceeding 50% of disposable income should be unaffordable."""
    result = _credit.affordability_check(monthly_income=200000, monthly_expenses=150000, proposed_emi=30000)
    assert result["affordable"] == False
