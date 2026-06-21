"""
54Bank Dormant Account Monitor — Python
Domain: Security / Insider Threat
Monitors dormant/inactive accounts for suspicious reactivation by insiders.
Insiders may activate dormant accounts to use them as mule accounts for
money laundering, embezzlement, or fraud.
Middleware: Kafka, Postgres, Redis
"""

import hashlib
import json
import os
import signal
import sys
import threading
import time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "dormant-account-monitor-py"
PORT = int(os.environ.get("PORT", "8080"))

# ─── Domain Types ────────────────────────────────────────────────────────────

DORMANCY_THRESHOLD_DAYS = 180  # CBN regulation: 6 months without activity
SUSPICIOUS_REACTIVATION_RULES = [
    {"name": "high_value_first_txn", "description": "First transaction after dormancy > ₦500,000", "threshold_kobo": 50_000_000},
    {"name": "rapid_multiple_txns", "description": "Multiple transactions within 1 hour of reactivation", "threshold_count": 3},
    {"name": "off_hours_reactivation", "description": "Account reactivated outside business hours (before 8am or after 6pm)", "blocked_hours": [0,1,2,3,4,5,6,7,20,21,22,23]},
    {"name": "same_employee_pattern", "description": "Same employee reactivates 3+ dormant accounts in 7 days", "threshold_count": 3},
]

class DormantAccount:
    def __init__(self, account_id, nuban, customer_name, last_activity, balance_kobo, tier):
        self.account_id = account_id
        self.nuban = nuban
        self.customer_name = customer_name
        self.last_activity = last_activity
        self.balance_kobo = balance_kobo
        self.tier = tier
        self.status = "dormant"
        self.reactivated_by = None
        self.reactivation_time = None
        self.alerts = []

    def days_dormant(self):
        last = datetime.fromisoformat(self.last_activity)
        return (datetime.utcnow() - last).days

    def to_dict(self):
        return {
            "account_id": self.account_id, "nuban": self.nuban,
            "customer_name": self.customer_name, "last_activity": self.last_activity,
            "balance_kobo": self.balance_kobo, "tier": self.tier,
            "status": self.status, "days_dormant": self.days_dormant(),
            "reactivated_by": self.reactivated_by,
            "reactivation_time": self.reactivation_time,
            "alert_count": len(self.alerts),
        }

class ReactivationAlert:
    def __init__(self, account_id, employee_id, rule_name, severity, details):
        self.id = f"DRM-{hashlib.sha256(f'{account_id}{time.time()}'.encode()).hexdigest()[:8]}"
        self.account_id = account_id
        self.employee_id = employee_id
        self.rule_name = rule_name
        self.severity = severity
        self.details = details
        self.timestamp = datetime.utcnow().isoformat()
        self.blocked = severity in ("critical", "high")

    def to_dict(self):
        return {
            "id": self.id, "account_id": self.account_id,
            "employee_id": self.employee_id, "rule_name": self.rule_name,
            "severity": self.severity, "details": self.details,
            "timestamp": self.timestamp, "blocked": self.blocked,
        }

# ─── In-Memory State ────────────────────────────────────────────────────────

lock = threading.Lock()
dormant_accounts = {}
reactivation_alerts = []
employee_reactivation_counts = {}  # employee_id → [(timestamp, account_id)]
event_bus_events = []

def emit_event(event_type, payload):
    event_bus_events.append({
        "event_type": event_type, "source": "dormant-account-monitor",
        "topic": "security.insider-threat",
        "timestamp": datetime.utcnow().isoformat(), "payload": payload,
    })

# Seed dormant accounts
_seed_data = [
    ("ACCT-D001", "0012345601", "Adebayo Okonkwo", (datetime.utcnow() - timedelta(days=400)).isoformat(), 15000000, "tier-1"),
    ("ACCT-D002", "0012345602", "Fatima Ibrahim", (datetime.utcnow() - timedelta(days=250)).isoformat(), 350000, "tier-2"),
    ("ACCT-D003", "0012345603", "Chukwuma Nwosu", (datetime.utcnow() - timedelta(days=720)).isoformat(), 8500000, "tier-3"),
    ("ACCT-D004", "0012345604", "Aisha Mohammed", (datetime.utcnow() - timedelta(days=190)).isoformat(), 22000, "tier-1"),
    ("ACCT-D005", "0012345605", "Oluwaseun Akintola", (datetime.utcnow() - timedelta(days=550)).isoformat(), 4200000, "tier-2"),
]

for acct_id, nuban, name, last, bal, tier in _seed_data:
    dormant_accounts[acct_id] = DormantAccount(acct_id, nuban, name, last, bal, tier)


def check_reactivation(account_id, employee_id, txn_amount_kobo=0, txn_count=1):
    """Check if a dormant account reactivation is suspicious."""
    alerts_triggered = []
    account = dormant_accounts.get(account_id)
    if not account:
        return [], False

    if account.status != "dormant":
        return [], True  # already reactivated

    now = datetime.utcnow()

    # Rule 1: High-value first transaction
    if txn_amount_kobo > 50_000_000:
        alerts_triggered.append(ReactivationAlert(
            account_id, employee_id, "high_value_first_txn", "critical",
            f"First transaction after {account.days_dormant()} days dormancy is ₦{txn_amount_kobo/100:,.2f}"
        ))

    # Rule 2: Off-hours reactivation
    if now.hour in [0,1,2,3,4,5,6,7,20,21,22,23]:
        alerts_triggered.append(ReactivationAlert(
            account_id, employee_id, "off_hours_reactivation", "high",
            f"Dormant account reactivated at {now.strftime('%H:%M')} (outside business hours)"
        ))

    # Rule 3: Same employee reactivating multiple dormant accounts
    emp_history = employee_reactivation_counts.get(employee_id, [])
    recent = [t for t, _ in emp_history if (now - datetime.fromisoformat(t)).days < 7]
    if len(recent) >= 2:  # this would be the 3rd
        alerts_triggered.append(ReactivationAlert(
            account_id, employee_id, "same_employee_pattern", "critical",
            f"Employee {employee_id} has reactivated {len(recent)+1} dormant accounts in 7 days"
        ))

    # Record the reactivation
    if employee_id not in employee_reactivation_counts:
        employee_reactivation_counts[employee_id] = []
    employee_reactivation_counts[employee_id].append((now.isoformat(), account_id))

    blocked = any(a.blocked for a in alerts_triggered)

    if not blocked:
        account.status = "reactivated"
        account.reactivated_by = employee_id
        account.reactivation_time = now.isoformat()

    for alert in alerts_triggered:
        reactivation_alerts.append(alert)
        account.alerts.append(alert.to_dict())
        emit_event("dormant.suspicious_reactivation", alert.to_dict())

    return alerts_triggered, not blocked


# ─── HTTP Server ─────────────────────────────────────────────────────────────

class DormantHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

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
        elif self.path == "/api/v1/dormant/accounts":
            with lock:
                self._json_response(200, [a.to_dict() for a in dormant_accounts.values()])
        elif self.path == "/api/v1/dormant/alerts":
            with lock:
                self._json_response(200, [a.to_dict() for a in reactivation_alerts])
        elif self.path == "/api/v1/dormant/rules":
            self._json_response(200, SUSPICIOUS_REACTIVATION_RULES)
        elif self.path == "/api/v1/dormant/stats":
            with lock:
                total_dormant = sum(1 for a in dormant_accounts.values() if a.status == "dormant")
                self._json_response(200, {
                    "total_accounts": len(dormant_accounts),
                    "dormant": total_dormant,
                    "reactivated": len(dormant_accounts) - total_dormant,
                    "alerts": len(reactivation_alerts),
                    "critical_alerts": sum(1 for a in reactivation_alerts if a.severity == "critical"),
                    "service": SERVICE_NAME,
                })
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/dormant/check-reactivation":
            with lock:
                alerts_triggered, allowed = check_reactivation(
                    body.get("account_id", ""),
                    body.get("employee_id", ""),
                    body.get("txn_amount_kobo", 0),
                    body.get("txn_count", 1),
                )
            status = 200 if allowed else 403
            self._json_response(status, {
                "allowed": allowed,
                "alerts": [a.to_dict() for a in alerts_triggered],
                "blocked": not allowed,
            })

        elif self.path == "/api/v1/dormant/register":
            with lock:
                acct = DormantAccount(
                    body.get("account_id"), body.get("nuban"),
                    body.get("customer_name"), body.get("last_activity"),
                    body.get("balance_kobo", 0), body.get("tier", "tier-1"),
                )
                dormant_accounts[acct.account_id] = acct
            self._json_response(201, acct.to_dict())
        else:
            self._json_response(404, {"error": "not found"})


# ─── Watchdog ────────────────────────────────────────────────────────────────

_last_activity = time.time()
_healthy = True

def _watchdog_loop():
    global _healthy
    while True:
        time.sleep(15)
        _healthy = (time.time() - _last_activity) <= 60

def watchdog_healthy():
    return _healthy


def main():
    watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True)
    watchdog_thread.start()

    server = HTTPServer(("0.0.0.0", PORT), DormantHandler)
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
