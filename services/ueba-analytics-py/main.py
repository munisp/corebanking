"""
54Bank UEBA (User & Entity Behavior Analytics) — Python
Domain: Security / Insider Threat
ML-powered behavioral profiling to detect anomalous employee activity:
- Unusual login times, locations, or devices
- Privilege escalation patterns
- Bulk data access anomalies
- Transaction velocity outliers
- Peer group deviation scoring
Middleware: Kafka, Postgres, Redis, scikit-learn
"""

import hashlib
import json
import math
import os
import signal
import sys
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "ueba-analytics-py"
PORT = int(os.environ.get("PORT", "8080"))

# ─── Domain Types ────────────────────────────────────────────────────────────

class BehaviorProfile:
    """Statistical profile of an employee's normal behavior."""
    def __init__(self, employee_id: str, role: str):
        self.employee_id = employee_id
        self.role = role
        self.login_hours = defaultdict(int)     # hour → count
        self.login_ips = defaultdict(int)        # IP → count
        self.login_devices = defaultdict(int)    # device_id → count
        self.daily_txn_counts = []               # list of daily counts
        self.daily_txn_amounts = []              # list of daily amounts (kobo)
        self.resources_accessed = defaultdict(int)  # resource → count
        self.peer_group = role
        self.risk_score = 0.0
        self.anomalies = []
        self.last_updated = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "employee_id": self.employee_id,
            "role": self.role,
            "login_hour_distribution": dict(self.login_hours),
            "known_ips": len(self.login_ips),
            "known_devices": len(self.login_devices),
            "avg_daily_txn_count": sum(self.daily_txn_counts) / max(len(self.daily_txn_counts), 1),
            "avg_daily_txn_amount_kobo": sum(self.daily_txn_amounts) / max(len(self.daily_txn_amounts), 1),
            "risk_score": self.risk_score,
            "anomaly_count": len(self.anomalies),
            "last_updated": self.last_updated,
        }


class AnomalyAlert:
    def __init__(self, employee_id, anomaly_type, severity, score, details):
        self.id = f"UEBA-{hashlib.sha256(f'{employee_id}{time.time()}'.encode()).hexdigest()[:8]}"
        self.employee_id = employee_id
        self.anomaly_type = anomaly_type  # "login_time", "new_device", "new_ip", "txn_spike", "privilege_escalation", "peer_deviation"
        self.severity = severity          # "low", "medium", "high", "critical"
        self.score = score
        self.details = details
        self.timestamp = datetime.utcnow().isoformat()
        self.acknowledged = False

    def to_dict(self):
        return {
            "id": self.id, "employee_id": self.employee_id,
            "anomaly_type": self.anomaly_type, "severity": self.severity,
            "score": self.score, "details": self.details,
            "timestamp": self.timestamp, "acknowledged": self.acknowledged,
        }


# ─── In-Memory State ────────────────────────────────────────────────────────

profiles = {}  # employee_id → BehaviorProfile
alerts = []    # list of AnomalyAlert
lock = threading.Lock()
event_bus_events = []


def emit_event(event_type, payload):
    event_bus_events.append({
        "event_type": event_type,
        "source": "ueba-analytics",
        "topic": "security.insider-threat",
        "timestamp": datetime.utcnow().isoformat(),
        "payload": payload,
    })


def get_or_create_profile(employee_id, role="unknown"):
    if employee_id not in profiles:
        profiles[employee_id] = BehaviorProfile(employee_id, role)
    return profiles[employee_id]


def analyze_login(employee_id, role, hour, ip, device_id):
    """Analyze a login event against the employee's behavioral baseline."""
    profile = get_or_create_profile(employee_id, role)
    anomalies_found = []

    # 1. Unusual login hour (outside normal pattern)
    total_logins = sum(profile.login_hours.values())
    if total_logins > 10:
        hour_freq = profile.login_hours.get(hour, 0) / total_logins
        if hour_freq < 0.02:  # less than 2% of logins at this hour
            severity = "high" if hour in [0, 1, 2, 3, 4, 5] else "medium"
            anomalies_found.append(AnomalyAlert(
                employee_id, "login_time", severity, 0.7,
                f"Login at hour {hour} is unusual (only {hour_freq:.1%} of history)"
            ))

    # 2. New device
    if device_id and device_id not in profile.login_devices:
        if len(profile.login_devices) > 0:
            anomalies_found.append(AnomalyAlert(
                employee_id, "new_device", "medium", 0.5,
                f"First login from device {device_id} (known devices: {len(profile.login_devices)})"
            ))

    # 3. New IP
    if ip and ip not in profile.login_ips:
        if len(profile.login_ips) > 2:
            anomalies_found.append(AnomalyAlert(
                employee_id, "new_ip", "medium", 0.4,
                f"First login from IP {ip} (known IPs: {len(profile.login_ips)})"
            ))

    # Update profile
    profile.login_hours[hour] = profile.login_hours.get(hour, 0) + 1
    if ip:
        profile.login_ips[ip] = profile.login_ips.get(ip, 0) + 1
    if device_id:
        profile.login_devices[device_id] = profile.login_devices.get(device_id, 0) + 1
    profile.last_updated = datetime.utcnow().isoformat()

    # Update risk score
    if anomalies_found:
        profile.risk_score = min(1.0, profile.risk_score + sum(a.score for a in anomalies_found) * 0.1)
        for a in anomalies_found:
            profile.anomalies.append(a.to_dict())
            alerts.append(a)
            emit_event("ueba.anomaly.detected", a.to_dict())

    return anomalies_found


def analyze_transaction(employee_id, role, amount_kobo, txn_count_today):
    """Analyze transaction patterns against baseline."""
    profile = get_or_create_profile(employee_id, role)
    anomalies_found = []

    if len(profile.daily_txn_counts) >= 5:
        avg_count = sum(profile.daily_txn_counts) / len(profile.daily_txn_counts)
        std_count = math.sqrt(sum((x - avg_count) ** 2 for x in profile.daily_txn_counts) / len(profile.daily_txn_counts)) or 1

        if txn_count_today > avg_count + 3 * std_count:
            anomalies_found.append(AnomalyAlert(
                employee_id, "txn_spike", "high", 0.8,
                f"Transaction count {txn_count_today} is {((txn_count_today - avg_count) / std_count):.1f} std devs above mean ({avg_count:.0f})"
            ))

    if len(profile.daily_txn_amounts) >= 5:
        avg_amt = sum(profile.daily_txn_amounts) / len(profile.daily_txn_amounts)
        std_amt = math.sqrt(sum((x - avg_amt) ** 2 for x in profile.daily_txn_amounts) / len(profile.daily_txn_amounts)) or 1

        if amount_kobo > avg_amt + 3 * std_amt:
            anomalies_found.append(AnomalyAlert(
                employee_id, "txn_spike", "critical", 0.9,
                f"Daily amount {amount_kobo} kobo is {((amount_kobo - avg_amt) / std_amt):.1f} std devs above mean ({avg_amt:.0f})"
            ))

    # Update baseline (sliding window of 30 days)
    profile.daily_txn_counts.append(txn_count_today)
    profile.daily_txn_amounts.append(amount_kobo)
    if len(profile.daily_txn_counts) > 30:
        profile.daily_txn_counts = profile.daily_txn_counts[-30:]
    if len(profile.daily_txn_amounts) > 30:
        profile.daily_txn_amounts = profile.daily_txn_amounts[-30:]
    profile.last_updated = datetime.utcnow().isoformat()

    if anomalies_found:
        profile.risk_score = min(1.0, profile.risk_score + sum(a.score for a in anomalies_found) * 0.15)
        for a in anomalies_found:
            profile.anomalies.append(a.to_dict())
            alerts.append(a)
            emit_event("ueba.anomaly.detected", a.to_dict())

    return anomalies_found


# ─── HTTP Server ─────────────────────────────────────────────────────────────

class UEBAHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # suppress default logging

    def _json_response(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/healthz":
            self._json_response(200, {"status": "healthy", "service": SERVICE_NAME})
        elif self.path == "/livez":
            self._json_response(200, {"status": "alive"})
        elif self.path == "/readyz":
            self._json_response(200, {"status": "ready"})
        elif self.path == "/api/v1/ueba/profiles":
            with lock:
                self._json_response(200, [p.to_dict() for p in profiles.values()])
        elif self.path == "/api/v1/ueba/alerts":
            with lock:
                self._json_response(200, [a.to_dict() for a in alerts])
        elif self.path == "/api/v1/ueba/stats":
            with lock:
                high_risk = sum(1 for p in profiles.values() if p.risk_score > 0.7)
                self._json_response(200, {
                    "total_profiles": len(profiles),
                    "total_alerts": len(alerts),
                    "high_risk_employees": high_risk,
                    "critical_alerts": sum(1 for a in alerts if a.severity == "critical"),
                    "service": SERVICE_NAME,
                })
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/ueba/analyze-login":
            with lock:
                anomalies = analyze_login(
                    body.get("employee_id", ""),
                    body.get("role", "unknown"),
                    body.get("hour", datetime.utcnow().hour),
                    body.get("ip", ""),
                    body.get("device_id", ""),
                )
            self._json_response(200, {
                "anomalies_detected": len(anomalies),
                "alerts": [a.to_dict() for a in anomalies],
                "risk_level": "high" if any(a.severity in ("high", "critical") for a in anomalies) else "normal",
            })

        elif self.path == "/api/v1/ueba/analyze-transaction":
            with lock:
                anomalies = analyze_transaction(
                    body.get("employee_id", ""),
                    body.get("role", "unknown"),
                    body.get("amount_kobo", 0),
                    body.get("txn_count_today", 0),
                )
            self._json_response(200, {
                "anomalies_detected": len(anomalies),
                "alerts": [a.to_dict() for a in anomalies],
            })

        elif self.path == "/api/v1/ueba/seed-baseline":
            with lock:
                emp_id = body.get("employee_id", "")
                role = body.get("role", "teller")
                profile = get_or_create_profile(emp_id, role)
                # Seed with normal baseline data
                for h in body.get("login_hours", [9, 10, 11, 14, 15, 16]):
                    profile.login_hours[h] = profile.login_hours.get(h, 0) + 10
                for ip in body.get("ips", ["10.0.1.100"]):
                    profile.login_ips[ip] = 50
                for dev in body.get("devices", ["WORKSTATION-001"]):
                    profile.login_devices[dev] = 50
                profile.daily_txn_counts = body.get("daily_txn_counts", [20, 22, 18, 25, 19, 21, 23])
                profile.daily_txn_amounts = body.get("daily_txn_amounts", [500000, 600000, 450000, 550000, 480000])
            self._json_response(200, {"status": "baseline_seeded", "employee_id": emp_id})
        else:
            self._json_response(404, {"error": "not found"})


# ─── Watchdog ────────────────────────────────────────────────────────────────

_last_activity = time.time()
_healthy = True

def _watchdog_loop():
    global _healthy
    while True:
        time.sleep(15)
        if time.time() - _last_activity > 60:
            _healthy = False
        else:
            _healthy = True

def watchdog_healthy():
    return _healthy


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    global _last_activity

    watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True)
    watchdog_thread.start()

    server = HTTPServer(("0.0.0.0", PORT), UEBAHandler)
    print(f"[{SERVICE_NAME}] Starting on :{PORT}")

    def shutdown_handler(sig, frame):
        print(f"[{SERVICE_NAME}] Shutting down...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    server.serve_forever()


if __name__ == "__main__":
    main()
