import unittest
import importlib
main = importlib.import_module("main")

class TestMonitoringDashboard(unittest.TestCase):
    def test_event_bus_exists(self):
        self.assertIsNotNone(main._event_bus)

    def test_platform_status(self):
        self.assertEqual(main._platform_status["services_total"], 515)

    def test_watchdog_healthy(self):
        self.assertTrue(main.watchdog_healthy())

if __name__ == "__main__":
    unittest.main()
