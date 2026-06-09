"""Unit tests for carbon-esg-tracker-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_circuit_breaker_lifecycle(self):
        from main import _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, reset_after=1)
        self.assertTrue(cb.allow())
        cb.record_failure()
        cb.record_failure()
        self.assertFalse(cb.allow())
        cb.record_success()
        self.assertTrue(cb.allow())

class TestRateLimiter(unittest.TestCase):
    def test_rate_limiter_burst(self):
        from main import _RateLimiter
        rl = _RateLimiter(rate=100, burst=5)
        results = [rl.allow("test") for _ in range(5)]
        self.assertTrue(all(results))

if __name__ == '__main__':
    unittest.main()
