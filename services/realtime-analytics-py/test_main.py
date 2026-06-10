"""Unit tests for realtime-analytics-py."""
import unittest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

class TestHealthEndpoint(unittest.TestCase):
    def test_health_handler_exists(self):
        from main import Handler
        self.assertTrue(hasattr(Handler, 'do_GET'))

class TestCircuitBreaker(unittest.TestCase):
    def test_allows_when_closed(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=5, timeout=30)
        self.assertTrue(cb.allow())

    def test_blocks_when_open(self):
        from main import CircuitBreaker as _CircuitBreaker
        cb = _CircuitBreaker(threshold=2, timeout=60)
        cb.record_failure()
        cb.record_failure()
        self.assertFalse(cb.allow())

if __name__ == '__main__':
    unittest.main()
