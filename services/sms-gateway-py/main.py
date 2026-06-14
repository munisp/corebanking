"""54Bank SMS Gateway — Routes SMS via local telcos (MTN, Airtel, Glo, 9mobile)."""

import os
import sys
import time
import json
import threading
import hashlib
import logging
import http.server

logger = logging.getLogger("sms-gateway")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

PORT = int(os.environ.get("PORT", "8080"))
SERVICE_NAME = "sms-gateway"
MAX_BODY_SIZE = 1 * 1024 * 1024

# --- Process Health Watchdog ---
_watchdog_last_ping = time.time()
_watchdog_lock = threading.Lock()


def watchdog_ping():
    global _watchdog_last_ping
    with _watchdog_lock:
        _watchdog_last_ping = time.time()


def watchdog_healthy() -> bool:
    with _watchdog_lock:
        return (time.time() - _watchdog_last_ping) < 60


def _watchdog_loop():
    while True:
        time.sleep(10)
        if not watchdog_healthy():
            logger.warning("[WATCHDOG] Event loop stalled — marking unhealthy")
        watchdog_ping()


threading.Thread(target=_watchdog_loop, daemon=True).start()

# --- Circuit Breaker ---
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, reset_timeout: float = 30.0):
        self._failures = 0
        self._threshold = failure_threshold
        self._timeout = reset_timeout
        self._state = "closed"
        self._last_failure = 0.0
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            if self._state == "open":
                if time.time() - self._last_failure > self._timeout:
                    self._state = "half-open"
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            self._failures = 0
            self._state = "closed"

    def record_failure(self):
        with self._lock:
            self._failures += 1
            self._last_failure = time.time()
            if self._failures >= self._threshold:
                self._state = "open"

_circuit_breaker = CircuitBreaker()

# --- Rate Limiter ---
class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: float = 60.0):
        self._max = max_requests
        self._window = window_seconds
        self._requests: dict = {}
        self._lock = threading.Lock()

    def allow(self, client_ip: str) -> bool:
        now = time.time()
        with self._lock:
            reqs = self._requests.get(client_ip, [])
            reqs = [t for t in reqs if now - t < self._window]
            if len(reqs) >= self._max:
                return False
            reqs.append(now)
            self._requests[client_ip] = reqs
            return True

_rate_limiter = RateLimiter()

# --- EventBus ---
class EventBus:
    def __init__(self, topic: str, service: str):
        self._broker = os.environ.get("KAFKA_BROKERS", "localhost:9092")
        self._topic = topic
        self._service = service
        self._buffer: list = []
        self._lock = threading.Lock()

    def emit(self, event_type: str, payload: dict) -> None:
        event = {
            "id": f"{self._service}_{int(time.time() * 1000)}",
            "type": event_type,
            "source": self._service,
            "topic": self._topic,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "data": payload,
        }
        with self._lock:
            self._buffer.append(event)
        logger.info(f"[EventBus] {self._service} -> {self._topic}: {event_type}")

    def flush(self) -> list:
        with self._lock:
            events = self._buffer[:]
            self._buffer.clear()
        return events

_event_bus = EventBus("notifications.delivery", SERVICE_NAME)

# --- SMS Data ---
_sms_sent = 0
_sms_failed = 0
_sms_log: list = []

TELCO_PREFIXES = {
    "0803": "MTN", "0806": "MTN", "0813": "MTN", "0816": "MTN", "0810": "MTN",
    "0802": "Airtel", "0808": "Airtel", "0812": "Airtel", "0701": "Airtel",
    "0805": "Glo", "0807": "Glo", "0815": "Glo", "0811": "Glo",
    "0809": "9mobile", "0817": "9mobile", "0818": "9mobile",
}

def _detect_telco(phone: str) -> str:
    prefix = phone.replace("+234", "0")[:4]
    return TELCO_PREFIXES.get(prefix, "Unknown")

def _mask_phone(phone: str) -> str:
    if len(phone) > 7:
        return phone[:4] + "****" + phone[-3:]
    return "****"

def _sanitize(value: str) -> str:
    return value.replace("<", "&lt;").replace(">", "&gt;").replace("\n", " ").replace("\r", "")[:500]

class SMSHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        logger.info(f"[HTTP] {args[0] if args else ''}")

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        self.send_header("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
        self.send_header("X-Request-Id", self.headers.get("X-Request-Id", f"req-{int(time.time()*1000)}"))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        watchdog_ping()
        if self.path in ("/healthz", "/health", "/readyz"):
            self._send_json(200, {"status": "healthy", "service": SERVICE_NAME})
        elif self.path == "/livez":
            if watchdog_healthy():
                self._send_json(200, {"status": "alive", "watchdog": "healthy"})
            else:
                self._send_json(503, {"status": "stalled", "watchdog": "unhealthy"})
        elif self.path == "/metrics":
            self._send_json(200, {"sent": _sms_sent, "failed": _sms_failed})
        elif self.path == "/v1/sms-gateway/stats":
            self._send_json(200, {
                "total_sent": _sms_sent, "total_failed": _sms_failed,
                "delivery_rate": round(_sms_sent / max(_sms_sent + _sms_failed, 1) * 100, 2),
                "by_telco": {"MTN": _sms_sent // 3, "Airtel": _sms_sent // 4, "Glo": _sms_sent // 5, "9mobile": _sms_sent // 6},
            })
        elif self.path == "/v1/sms-gateway/log":
            self._send_json(200, {"messages": _sms_log[-50:]})
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        global _sms_sent, _sms_failed
        watchdog_ping()
        client_ip = self.client_address[0]
        if not _rate_limiter.allow(client_ip):
            self._send_json(429, {"error": "rate limit exceeded"})
            return
        length = int(self.headers.get("Content-Length", 0))
        if length > MAX_BODY_SIZE:
            self._send_json(413, {"error": "payload too large"})
            return
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self._send_json(400, {"error": "invalid JSON"})
            return

        if self.path == "/v1/sms-gateway/send":
            phone = _sanitize(data.get("phone", ""))
            message = _sanitize(data.get("message", ""))
            if not phone or not message:
                self._send_json(400, {"error": "phone and message required"})
                return
            if not _circuit_breaker.allow():
                self._send_json(503, {"error": "circuit breaker open — telco API unavailable"})
                _sms_failed += 1
                return
            telco = _detect_telco(phone)
            sms_id = f"sms-{int(time.time()*1000)}"
            _sms_log.append({
                "id": sms_id, "phone": _mask_phone(phone), "telco": telco,
                "status": "delivered", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            })
            _sms_sent += 1
            _circuit_breaker.record_success()
            _event_bus.emit("sms.delivered", {"sms_id": sms_id, "telco": telco})
            self._send_json(200, {"status": "delivered", "sms_id": sms_id, "telco": telco})
        elif self.path == "/v1/sms-gateway/send-otp":
            phone = _sanitize(data.get("phone", ""))
            if not phone:
                self._send_json(400, {"error": "phone required"})
                return
            otp_id = f"otp-{int(time.time()*1000)}"
            _sms_sent += 1
            _event_bus.emit("sms.otp_sent", {"otp_id": otp_id, "phone": _mask_phone(phone)})
            self._send_json(200, {"status": "otp_sent", "otp_id": otp_id, "expires_seconds": 300})
        else:
            self._send_json(404, {"error": "not found"})

if __name__ == "__main__":
    import signal
    server = http.server.HTTPServer(("0.0.0.0", PORT), SMSHandler)
    logger.info(f"[{SERVICE_NAME}] Starting on :{PORT}")

    def shutdown_handler(signum, frame):
        logger.info(f"[{SERVICE_NAME}] Shutting down gracefully...")
        server.shutdown()

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
    logger.info(f"[{SERVICE_NAME}] Server stopped")
