"""
Shared service framework for all 54Bank Python microservices.
Eliminates boilerplate duplication: circuit breaker, retry, rate limiting, JWT auth,
health probes, metrics, alerting, graceful shutdown.
"""
import time
import threading
import json
import os
import functools
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Callable, Any, Optional, Dict, List


# --- Circuit Breaker ---

class CircuitState:
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Thread-safe circuit breaker with configurable threshold and reset."""

    def __init__(self, threshold: int = 5, reset_after_seconds: float = 30.0):
        self.threshold = threshold
        self.reset_after = reset_after_seconds
        self._failures = 0
        self._state = CircuitState.CLOSED
        self._last_failure = 0.0
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            if self._state == CircuitState.OPEN:
                if time.time() - self._last_failure > self.reset_after:
                    self._state = CircuitState.HALF_OPEN
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            self._failures = 0
            self._state = CircuitState.CLOSED

    def record_failure(self):
        with self._lock:
            self._failures += 1
            self._last_failure = time.time()
            if self._failures >= self.threshold:
                self._state = CircuitState.OPEN

    @property
    def state(self) -> str:
        with self._lock:
            return self._state


# --- Retry with Exponential Backoff ---

def retry(max_attempts: int = 3, initial_wait: float = 0.2,
          max_wait: float = 5.0, multiplier: float = 2.0):
    """Decorator for retrying functions with exponential backoff."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            wait = initial_wait
            last_err = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_err = e
                    if attempt < max_attempts - 1:
                        time.sleep(wait)
                        wait = min(wait * multiplier, max_wait)
            raise last_err
        return wrapper
    return decorator


# --- Token Bucket Rate Limiter ---

class RateLimiter:
    """Thread-safe token bucket rate limiter."""

    def __init__(self, max_tokens: float = 100.0, refill_rate: float = 10.0):
        self.max_tokens = max_tokens
        self.refill_rate = refill_rate
        self._tokens = max_tokens
        self._last_time = time.time()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        with self._lock:
            now = time.time()
            elapsed = now - self._last_time
            self._tokens += elapsed * self.refill_rate
            if self._tokens > self.max_tokens:
                self._tokens = self.max_tokens
            self._last_time = now
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return True
            return False


# --- JWT Auth ---

class JWTAuth:
    """JWT authentication middleware for BaseHTTPRequestHandler."""

    def __init__(self, skip_paths: Optional[List[str]] = None):
        self.skip_paths = set(skip_paths or ["/healthz", "/readyz", "/livez", "/metrics"])

    def authenticate(self, path: str, headers: Dict[str, str]) -> Optional[str]:
        """Returns None if auth passes, or error message if it fails."""
        if path in self.skip_paths:
            return None
        auth = headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return "Missing or invalid Authorization header"
        # In production: decode and validate JWT claims, signature, expiry
        return None


# --- Health Check ---

class HealthChecker:
    """Kubernetes-compatible health, readiness, and liveness probes."""

    def __init__(self, service_name: str, version: str = "1.0.0"):
        self.service_name = service_name
        self.version = version
        self.start_time = time.time()
        self._checks: Dict[str, Callable[[], bool]] = {}
        self._lock = threading.RLock()

    def register_check(self, name: str, fn: Callable[[], bool]):
        with self._lock:
            self._checks[name] = fn

    def health_status(self) -> dict:
        with self._lock:
            checks = {}
            all_ok = True
            for name, fn in self._checks.items():
                try:
                    ok = fn()
                except Exception:
                    ok = False
                checks[name] = "ok" if ok else "unhealthy"
                if not ok:
                    all_ok = False
        return {
            "service": self.service_name,
            "status": "healthy" if all_ok else "degraded",
            "version": self.version,
            "uptime_seconds": round(time.time() - self.start_time, 1),
            "checks": checks,
        }

    def readiness(self) -> dict:
        return {"ready": True, "service": self.service_name}

    def liveness(self) -> dict:
        return {"alive": True, "service": self.service_name}


# --- Metrics ---

class Metrics:
    """Thread-safe Prometheus-compatible metrics."""

    def __init__(self, service_name: str):
        self.service_name = service_name
        self._request_count = 0
        self._error_count = 0
        self._lock = threading.Lock()
        self.start_time = time.time()

    def incr_request(self):
        with self._lock:
            self._request_count += 1

    def incr_error(self):
        with self._lock:
            self._error_count += 1

    def prometheus_output(self) -> str:
        with self._lock:
            uptime = int(time.time() - self.start_time)
            return (
                f'# TYPE requests_total counter\nrequests_total{{service="{self.service_name}"}} {self._request_count}\n'
                f'# TYPE errors_total counter\nerrors_total{{service="{self.service_name}"}} {self._error_count}\n'
                f'# TYPE uptime_seconds gauge\nuptime_seconds{{service="{self.service_name}"}} {uptime}\n'
            )


# --- Alert Manager ---

class AlertRule:
    def __init__(self, name: str, condition: Callable[[], bool], severity: str = "warning", cooldown: float = 60.0):
        self.name = name
        self.condition = condition
        self.severity = severity
        self.cooldown = cooldown
        self._last_fired = 0.0


class AlertManager:
    """Rule-based alert engine with cooldown."""

    def __init__(self):
        self._rules: List[AlertRule] = []

    def add_rule(self, rule: AlertRule):
        self._rules.append(rule)

    def check(self) -> List[dict]:
        fired = []
        now = time.time()
        for rule in self._rules:
            if now - rule._last_fired > rule.cooldown:
                try:
                    if rule.condition():
                        rule._last_fired = now
                        fired.append({"rule": rule.name, "severity": rule.severity, "fired_at": now})
                except Exception:
                    pass
        return fired


# --- Security Headers ---

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


# --- Service Bootstrap ---

def create_service(name: str, version: str = "1.0.0", port: int = None):
    """Create a fully-configured service with health, metrics, and middleware."""
    port = port or int(os.environ.get("PORT", "8080"))
    health = HealthChecker(name, version)
    metrics = Metrics(name)
    rate_limiter = RateLimiter(100, 10)
    circuit_breaker = CircuitBreaker(5, 30)
    jwt_auth = JWTAuth()
    alerts = AlertManager()

    return {
        "name": name,
        "version": version,
        "port": port,
        "health": health,
        "metrics": metrics,
        "rate_limiter": rate_limiter,
        "circuit_breaker": circuit_breaker,
        "jwt_auth": jwt_auth,
        "alerts": alerts,
    }
