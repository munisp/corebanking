"""Unit tests for data-lineage-catalog-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_lifecycle(self):
        from main import _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, reset_after=1)
        self.assertTrue(cb.allow())
        for _ in range(3): cb.record_failure()
        self.assertFalse(cb.allow())

class TestRateLimiter(unittest.TestCase):
    def test_allows_burst(self):
        from main import _RateLimiter
        rl = _RateLimiter(rate=100, burst=10)
        self.assertTrue(rl.allow("key"))

if __name__ == '__main__':
    unittest.main()
