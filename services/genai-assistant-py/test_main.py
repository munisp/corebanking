"""Unit tests for genai-assistant-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_circuit_breaker(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=3, timeout=1)
        self.assertTrue(cb.allow())
        for _ in range(3): cb.record_failure()
        self.assertFalse(cb.allow())
        cb.record_success()
        self.assertTrue(cb.allow())

class TestRetry(unittest.TestCase):
    def test_retry_immediate_success(self):
        from main import retry_with_backoff
        result = retry_with_backoff(lambda: "done", max_retries=3)
        self.assertEqual(result, "done")

if __name__ == '__main__':
    unittest.main()
