"""Unit tests for the Chatbot AI Service."""
import json
import unittest
from http.server import HTTPServer
from threading import Thread
from urllib.request import urlopen, Request

# Import the service module
import importlib.util
spec = importlib.util.spec_from_file_location("service", "service.py")
svc = importlib.util.module_from_spec(spec)

class TestChatbotService(unittest.TestCase):
    """Test chatbot NLP routing and response generation."""

    def test_intent_balance(self):
        """'balance' should route to check_balance with high confidence."""
        from service import classify_intent
        intent, confidence = classify_intent("What is my balance?")
        self.assertEqual(intent, "check_balance")
        self.assertGreaterEqual(confidence, 0.8)

    def test_intent_transfer(self):
        """'transfer' should route to fund_transfer."""
        from service import classify_intent
        intent, confidence = classify_intent("I want to transfer money")
        self.assertEqual(intent, "fund_transfer")
        self.assertGreaterEqual(confidence, 0.8)

    def test_intent_unknown(self):
        """Unrelated text should route to unknown with 0 confidence."""
        from service import classify_intent
        intent, confidence = classify_intent("What is the weather?")
        self.assertEqual(intent, "unknown")
        self.assertEqual(confidence, 0.0)

    def test_intent_card_block(self):
        """'stolen card' should route to card_block."""
        from service import classify_intent
        intent, confidence = classify_intent("My card was stolen")
        self.assertEqual(intent, "card_block")
        self.assertGreaterEqual(confidence, 0.9)

    def test_seeded_conversations(self):
        """Should have at least 4 seeded conversations."""
        from service import CONVERSATIONS
        self.assertGreaterEqual(len(CONVERSATIONS), 4)

    def test_conversation_has_messages(self):
        """Each conversation should have messages."""
        from service import CONVERSATIONS
        for conv in CONVERSATIONS:
            self.assertIn("messages", conv)
            self.assertGreater(len(conv["messages"]), 0)


if __name__ == "__main__":
    unittest.main()
