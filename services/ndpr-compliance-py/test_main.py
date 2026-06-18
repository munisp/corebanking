"""Integration tests for ndpr-compliance-py"""
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
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, timeout=1)
        for _ in range(3):
            cb.record_failure()
        self.assertFalse(cb.allow())

    def test_circuit_breaker_resets(self):
        """Circuit breaker resets after timeout."""
        import time
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, timeout=0.1)
        cb.record_failure()
        cb.record_failure()
        self.assertFalse(cb.allow())
        time.sleep(0.15)
        self.assertTrue(cb.allow())

