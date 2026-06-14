import unittest
import importlib
main = importlib.import_module("main")

class TestPushNotification(unittest.TestCase):
    def test_event_bus_exists(self):
        self.assertIsNotNone(main._event_bus)

    def test_watchdog_healthy(self):
        self.assertTrue(main.watchdog_healthy())

    def test_sanitize(self):
        self.assertEqual(main._sanitize("<script>alert(1)</script>"), "&lt;script&gt;alert(1)&lt;/script&gt;")

    def test_circuit_breaker_initial_state(self):
        cb = main.CircuitBreaker()
        self.assertTrue(cb.allow())

if __name__ == "__main__":
    unittest.main()
