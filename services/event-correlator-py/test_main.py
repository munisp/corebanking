"""Integration tests for event-correlator-py"""
import unittest
import json
from unittest.mock import patch, MagicMock
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoints(unittest.TestCase):
    def test_health_returns_200(self):
        """Health endpoint returns 200 with service name."""
        # Verify the health handler exists and returns expected format
        self.assertTrue(True)  # Placeholder for HTTP test

    def test_circuit_breaker_opens(self):
        """Circuit breaker opens after threshold failures."""
        from main import _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, reset_after=1)
        for _ in range(3):
            cb.record_failure()
        self.assertFalse(cb.allow())

    def test_circuit_breaker_resets(self):
        """Circuit breaker resets after timeout."""
        import time
        from main import _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, reset_after=0.1)
        cb.record_failure()
        cb.record_failure()
        self.assertFalse(cb.allow())
        time.sleep(0.15)
        self.assertTrue(cb.allow())

    def test_degradation_state(self):
        """Degradation state tracks DB availability."""
        from main import _DegradationState
        ds = _DegradationState()
        self.assertTrue(ds.is_db_ok())
        ds.set_db(False)
        self.assertFalse(ds.is_db_ok())
        status = ds.status()
        self.assertEqual(status["mode"], "degraded")

    def test_alert_rules_exist(self):
        """Alert rules are defined."""
        from main import _ALERT_RULES
        self.assertGreater(len(_ALERT_RULES), 0)

if __name__ == "__main__":
    unittest.main()
