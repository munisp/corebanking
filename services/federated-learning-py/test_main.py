"""Unit tests for federated-learning-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_initial_state_allows(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, timeout=1)
        self.assertTrue(cb.allow())

    def test_opens_after_threshold(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, timeout=1)
        for _ in range(3):
            cb.record_failure()
        self.assertFalse(cb.allow())

    def test_success_resets(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, timeout=1)
        cb.record_failure()
        cb.record_success()
        self.assertTrue(cb.allow())

class TestRateLimiter(unittest.TestCase):
    def test_allows_initial_requests(self):
        from main import _RateLimiter
        rl = _RateLimiter(rate=100, burst=10)
        self.assertTrue(rl.allow("test-key"))

class TestRetryWithBackoff(unittest.TestCase):
    def test_succeeds_on_first_try(self):
        from main import retry_with_backoff
        result = retry_with_backoff(lambda: "ok", max_retries=3)
        self.assertEqual(result, "ok")

if __name__ == '__main__':
    unittest.main()
