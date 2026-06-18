import unittest
import importlib
main = importlib.import_module("main")

class TestSMSGateway(unittest.TestCase):
    def test_event_bus_exists(self):
        self.assertIsNotNone(main._event_bus)

    def test_detect_telco_mtn(self):
        self.assertEqual(main._detect_telco("08031234567"), "MTN")

    def test_detect_telco_airtel(self):
        self.assertEqual(main._detect_telco("08021234567"), "Airtel")

    def test_mask_phone(self):
        self.assertEqual(main._mask_phone("08031234567"), "0803****567")

    def test_watchdog_healthy(self):
        self.assertTrue(main.watchdog_healthy())

if __name__ == "__main__":
    unittest.main()
