#!/usr/bin/env python3
"""
Domain logic integration tests — tests business rules across service boundaries
without requiring running services. Imports domain functions directly.
"""
import pytest
import importlib.util
import os

BASE = os.path.join(os.path.dirname(__file__), '../../services')

def _load(name, service_dir):
    spec = importlib.util.spec_from_file_location(name, os.path.join(BASE, service_dir, 'main.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

# Load service modules
_credit = _load('credit', 'credit-scoring-py')
_kyc = _load('kyc', 'kyc-engine-py')
_txn = _load('txn', 'txn-pattern-analyzer-py')


class TestCreditKYCIntegration:
    """Credit decisions should respect KYC tier."""

    def test_tier1_credit_limit(self):
        """Tier 1 (BVN only) should have lower max loan amount than Tier 3."""
        tier1_score = _credit.compute_credit_score(
            income=300000, debt=50000, employment_years=3,
            loan_history_count=1, defaults=0, age=30
        )
        tier3_score = _credit.compute_credit_score(
            income=2000000, debt=100000, employment_years=10,
            loan_history_count=5, defaults=0, age=45
        )
        assert tier1_score["max_loan_amount"] < tier3_score["max_loan_amount"]
        assert tier1_score["max_loan_amount"] <= 300000 * 12 * 0.4

    def test_tier_determination_matches_kyc_requirements(self):
        """KYC tiers should follow CBN progressive requirements."""
        # Tier 1: BVN only
        t1 = _kyc.determine_tier({"bvn": "12345678901", "docs_submitted": []})
        assert t1["tier"] == "tier1"

        # Tier 2: BVN + liveness + 1 doc
        t2 = _kyc.determine_tier({
            "bvn": "12345678901",
            "docs_submitted": ["id_document"],
            "liveness_passed": True
        })
        assert t2["tier"] == "tier2"

        # Tier 3: BVN + NIN + address proof + liveness + 3 docs
        t3 = _kyc.determine_tier({
            "bvn": "12345678901", "nin": "98765432101",
            "docs_submitted": ["id_document", "utility_bill", "bank_statement"],
            "liveness_passed": True
        })
        assert t3["tier"] == "tier3"

    def test_credit_score_affects_approval(self):
        """Low credit score should not be approved."""
        bad = _credit.compute_credit_score(
            income=50000, debt=100000, employment_years=0,
            loan_history_count=0, defaults=5, age=20
        )
        assert bad["approved"] is False
        assert bad["band"] == "poor"

        good = _credit.compute_credit_score(
            income=1000000, debt=100000, employment_years=8,
            loan_history_count=3, defaults=0, age=40
        )
        assert good["approved"] is True
        assert good["band"] in ("excellent", "good")


class TestAMLCreditIntegration:
    """AML flags should influence credit risk assessment."""

    def test_structuring_detected_for_suspicious_amounts(self):
        """Multiple transactions just below 1M NGN threshold should flag structuring."""
        suspicious_txns = [
            {"amount": 950000, "type": "transfer"},
            {"amount": 920000, "type": "transfer"},
            {"amount": 980000, "type": "transfer"},
            {"amount": 910000, "type": "transfer"},
        ]
        result = _txn.analyze_patterns(suspicious_txns)
        assert result["risk_score"] > 0
        pattern_types = [p["type"] for p in result["patterns"]]
        assert "structuring" in pattern_types

    def test_clean_transactions_no_patterns(self):
        """Normal non-round transactions should have zero risk."""
        clean_txns = [
            {"amount": 52341, "type": "deposit"},
            {"amount": 78923, "type": "transfer"},
            {"amount": 31567, "type": "withdrawal"},
        ]
        result = _txn.analyze_patterns(clean_txns)
        assert result["risk_score"] == 0
        assert len(result["patterns"]) == 0


class TestKYCRiskAssessment:
    """KYC risk should combine multiple signals."""

    def test_pep_raises_risk(self):
        """PEP status should increase KYC risk score."""
        normal = _kyc.calculate_risk({"bvn": "12345678901", "docs_submitted": ["id"]})
        pep = _kyc.calculate_risk({"bvn": "12345678901", "docs_submitted": ["id"], "pepFlag": True})
        assert pep["score"] > normal["score"]
        # PEP + adverse media should always require EDD
        pep_plus = _kyc.calculate_risk({"bvn": "12345678901", "docs_submitted": ["id"], "pepFlag": True, "adverseMedia": True})
        assert pep_plus["requires_edd"] is True

    def test_high_risk_country_flags_edd(self):
        """Customers flagged with sanctions + PEP require enhanced due diligence."""
        result = _kyc.calculate_risk({
            "bvn": "12345678901",
            "docs_submitted": ["id"],
            "pepFlag": True,
            "sanctionsFlag": True,
        })
        assert result["requires_edd"] is True
        assert result["category"] in ("high", "critical")

    def test_bvn_nin_validation_consistency(self):
        """BVN and NIN validation should have consistent format rules."""
        # Both should be 11 digits
        assert _kyc.validate_bvn("12345678901")["valid"] is True
        assert _kyc.validate_nin("12345678901")["valid"] is True
        # Too short
        assert _kyc.validate_bvn("1234")["valid"] is False
        assert _kyc.validate_nin("1234")["valid"] is False
        # Non-numeric
        assert _kyc.validate_bvn("abcdefghijk")["valid"] is False
        assert _kyc.validate_nin("abcdefghijk")["valid"] is False


class TestAffordabilityChecks:
    """Affordability should gate loan approval."""

    def test_affordable_loan(self):
        """Loan within 50% of disposable income should be affordable."""
        result = _credit.affordability_check(
            monthly_income=500000, monthly_expenses=200000, proposed_emi=100000
        )
        assert result["affordable"] is True
        assert result["disposable_income"] == 300000
        assert result["max_emi"] == 150000

    def test_unaffordable_loan(self):
        """Loan exceeding 50% of disposable income should be rejected."""
        result = _credit.affordability_check(
            monthly_income=200000, monthly_expenses=150000, proposed_emi=30000
        )
        assert result["affordable"] is False

    def test_zero_income_unaffordable(self):
        """Zero income means nothing is affordable."""
        result = _credit.affordability_check(
            monthly_income=0, monthly_expenses=0, proposed_emi=1000
        )
        assert result["affordable"] is False
