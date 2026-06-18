"""Unit tests for the Insurance/Bancassurance Service."""
import json
import unittest

class TestInsuranceService(unittest.TestCase):
    """Test insurance policy management."""

    def test_seeded_policies(self):
        """Should have 5 seeded insurance policies."""
        from service import POLICIES
        self.assertEqual(len(POLICIES), 5)

    def test_expired_policy(self):
        """INS-005 should be expired."""
        from service import POLICIES
        expired = [p for p in POLICIES if p["id"] == "INS-005"]
        self.assertEqual(len(expired), 1)
        self.assertEqual(expired[0]["status"], "expired")

    def test_policy_types(self):
        """Should have multiple policy types."""
        from service import POLICIES
        types = set(p["policyType"] for p in POLICIES)
        self.assertGreater(len(types), 1)

    def test_middleware_config(self):
        """Should have middleware configuration."""
        from service import MIDDLEWARE_CONFIG
        required = ["kafka", "redis", "postgres", "opensearch", "keycloak",
                     "permify", "dapr", "fluvio", "temporal", "mojaloop",
                     "tigerbeetle", "lakehouse", "apisix", "openappsec"]
        for mw in required:
            self.assertIn(mw, MIDDLEWARE_CONFIG, f"Missing middleware: {mw}")

    def test_premium_calculation(self):
        """Active policies should have positive premium amounts."""
        from service import POLICIES
        active = [p for p in POLICIES if p["status"] == "active"]
        for p in active:
            self.assertGreater(p["premiumAmount"], 0, f"Policy {p['id']} has zero premium")

if __name__ == "__main__":
    unittest.main()
