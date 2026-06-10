"""Unit tests for islamic-banking-engine-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_initial_allows(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, timeout=1)
        self.assertTrue(cb.allow())

    def test_opens_on_failures(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, timeout=60)
        cb.record_failure()
        cb.record_failure()
        self.assertFalse(cb.allow())

class TestRetry(unittest.TestCase):
    def test_retry_success(self):
        from main import retry_with_backoff
        result = retry_with_backoff(lambda: 42, max_retries=3)
        self.assertEqual(result, 42)

if __name__ == '__main__':
    unittest.main()
