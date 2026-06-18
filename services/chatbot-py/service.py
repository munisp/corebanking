import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "8179"))
MW = {
    "kafka": {"broker": os.environ.get("KAFKA_BROKER", "localhost:9092"), "topics": ["chatbot.conversations", "chatbot.intents", "chatbot.escalations"]},
    "redis": {"url": os.environ.get("REDIS_URL", "redis://localhost:6379"), "cache_keys": ["chatbot:sessions", "chatbot:faqs", "chatbot:context"]},
    "postgres": {"url": os.environ.get("DATABASE_URL", "postgresql://ndsep_user:ndsep_secure_2026@localhost:5432/ndsep_db"), "tables": ["chatbot_conversations", "chatbot_intents", "chatbot_training", "escalation_log"]},
    "opensearch": {"url": os.environ.get("OPENSEARCH_URL", "http://localhost:9200"), "indices": ["chatbot-conversations", "chatbot-analytics"]},
    "keycloak": {"url": os.environ.get("KEYCLOAK_URL", "http://localhost:8080"), "realm": "54bank", "client": "chatbot"},
    "permify": {"url": os.environ.get("PERMIFY_URL", "http://localhost:3476"), "resources": ["chatbot_session"]},
    "dapr": {"url": os.environ.get("DAPR_URL", "http://localhost:3500"), "app_id": "chatbot", "pubsub": "chatbot-pubsub"},
    "fluvio": {"url": os.environ.get("FLUVIO_URL", "localhost:9003"), "topics": ["chatbot-event-stream"]},
    "temporal": {"url": os.environ.get("TEMPORAL_URL", "localhost:7233"), "workflows": ["ConversationWorkflow", "EscalationWorkflow"]},
    "mojaloop": {"url": os.environ.get("MOJALOOP_URL", "http://localhost:3002"), "usage": "chatbot-initiated payments"},
    "tigerbeetle": {"url": os.environ.get("TIGERBEETLE_URL", "localhost:3000"), "ledgers": ["chatbot_transactions"]},
    "lakehouse": {"url": os.environ.get("LAKEHOUSE_URL", "http://localhost:8181"), "tables": ["chatbot_analytics_history"]},
    "apisix": {"url": os.environ.get("APISIX_URL", "http://localhost:9080"), "routes": ["/v1/chatbot/*"]},
    "openappsec": {"url": os.environ.get("OPENAPPSEC_URL", "http://localhost:4000"), "policy": "chatbot-waf"},
}

INTENTS = [
    {"id": "INT-001", "intent": "check_balance", "category": "account_inquiry", "confidence_threshold": 0.85, "sample_utterances": ["What is my balance?", "How much do I have?", "Check my account"], "responses": 4500, "avg_confidence": 0.94, "escalation_rate": 0.02, "status": "active"},
    {"id": "INT-002", "intent": "transfer_funds", "category": "payments", "confidence_threshold": 0.90, "sample_utterances": ["Send money to", "Transfer to account", "Pay someone"], "responses": 3200, "avg_confidence": 0.91, "escalation_rate": 0.08, "status": "active"},
    {"id": "INT-003", "intent": "loan_inquiry", "category": "lending", "confidence_threshold": 0.80, "sample_utterances": ["I need a loan", "Loan options", "Interest rates for loans"], "responses": 1800, "avg_confidence": 0.87, "escalation_rate": 0.15, "status": "active"},
    {"id": "INT-004", "intent": "card_block", "category": "card_services", "confidence_threshold": 0.95, "sample_utterances": ["Block my card", "Card stolen", "Freeze card"], "responses": 800, "avg_confidence": 0.97, "escalation_rate": 0.05, "status": "active"},
    {"id": "INT-005", "intent": "branch_locator", "category": "general", "confidence_threshold": 0.80, "sample_utterances": ["Nearest branch", "Where is the closest ATM", "Branch hours"], "responses": 2100, "avg_confidence": 0.92, "escalation_rate": 0.01, "status": "active"},
    {"id": "INT-006", "intent": "complaint", "category": "service_recovery", "confidence_threshold": 0.75, "sample_utterances": ["I want to complain", "Bad service", "Report an issue"], "responses": 950, "avg_confidence": 0.83, "escalation_rate": 0.45, "status": "active"},
    {"id": "INT-007", "intent": "fx_rate_inquiry", "category": "treasury", "confidence_threshold": 0.85, "sample_utterances": ["Dollar rate today", "Exchange rate", "Convert naira to dollar"], "responses": 2800, "avg_confidence": 0.93, "escalation_rate": 0.03, "status": "active"},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"service": "chatbot-py", "status": "healthy", "version": "1.0.0", "middleware": MW})
        elif self.path.startswith("/v1/chatbot/intents"):
            self._json(200, {"items": INTENTS, "total": len(INTENTS)})
        elif self.path.startswith("/v1/chatbot/stats"):
            total_resp = sum(i["responses"] for i in INTENTS)
            avg_conf = sum(i["avg_confidence"] for i in INTENTS) / len(INTENTS)
            avg_esc = sum(i["escalation_rate"] for i in INTENTS) / len(INTENTS)
            self._json(200, {"total_intents": len(INTENTS), "total_responses": total_resp, "avg_confidence": round(avg_conf, 3), "avg_escalation_rate": round(avg_esc, 3)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path.startswith("/v1/chatbot/message"):
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length > 0 else {}
            message = body.get("message", "").lower()
            if "balance" in message:
                intent, confidence = "check_balance", 0.95
            elif "transfer" in message or "send" in message:
                intent, confidence = "transfer_funds", 0.92
            elif "loan" in message:
                intent, confidence = "loan_inquiry", 0.88
            elif "card" in message and ("block" in message or "stolen" in message):
                intent, confidence = "card_block", 0.97
            elif "branch" in message or "atm" in message:
                intent, confidence = "branch_locator", 0.90
            elif "complain" in message or "issue" in message:
                intent, confidence = "complaint", 0.85
            elif "rate" in message or "dollar" in message or "exchange" in message:
                intent, confidence = "fx_rate_inquiry", 0.93
            else:
                intent, confidence = "unknown", 0.0
            self._json(200, {"intent": intent, "confidence": confidence, "response": f"I understand you're asking about {intent.replace('_', ' ')}. Let me help you with that.", "session_id": body.get("session_id", "new")})
        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    print(f"Chatbot Service running on port {PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
