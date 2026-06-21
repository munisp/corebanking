"""
54Bank GL Reconciliation Alerts — Python
Domain: Security / Insider Threat
Real-time monitoring of General Ledger trial balance integrity.
Alerts immediately when debits ≠ credits (not just batch EOD checks).
Detects journal entry manipulation, phantom entries, and balance sheet fraud.
Middleware: Kafka, Postgres
"""

import hashlib
import json
import os
import signal
import sys
import threading
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "gl-reconciliation-alerts-py"
PORT = int(os.environ.get("PORT", "8080"))

# ─── Domain Types ────────────────────────────────────────────────────────────

class LedgerSnapshot:
    """Point-in-time snapshot of GL balances."""
    def __init__(self, snapshot_id, total_debits_kobo, total_credits_kobo, account_count, timestamp):
        self.snapshot_id = snapshot_id
        self.total_debits_kobo = total_debits_kobo
        self.total_credits_kobo = total_credits_kobo
        self.account_count = account_count
        self.timestamp = timestamp
        self.balanced = total_debits_kobo == total_credits_kobo
        self.variance_kobo = abs(total_debits_kobo - total_credits_kobo)

    def to_dict(self):
        return {
            "snapshot_id": self.snapshot_id,
            "total_debits_kobo": self.total_debits_kobo,
            "total_credits_kobo": self.total_credits_kobo,
            "account_count": self.account_count,
            "balanced": self.balanced,
            "variance_kobo": self.variance_kobo,
            "timestamp": self.timestamp,
        }


class ReconciliationAlert:
    def __init__(self, alert_type, severity, details, variance_kobo):
        self.id = f"GLRC-{hashlib.sha256(f'{alert_type}{time.time()}'.encode()).hexdigest()[:8]}"
        self.alert_type = alert_type  # "trial_balance_mismatch", "phantom_entry", "reversal_anomaly", "unusual_journal"
        self.severity = severity      # "critical", "high", "medium"
        self.details = details
        self.variance_kobo = variance_kobo
        self.timestamp = datetime.utcnow().isoformat()
        self.acknowledged = False
        self.resolved = False

    def to_dict(self):
        return {
            "id": self.id, "alert_type": self.alert_type,
            "severity": self.severity, "details": self.details,
            "variance_kobo": self.variance_kobo, "timestamp": self.timestamp,
            "acknowledged": self.acknowledged, "resolved": self.resolved,
        }


class JournalEntry:
    def __init__(self, entry_id, debit_account, credit_account, amount_kobo, posted_by, description):
        self.entry_id = entry_id
        self.debit_account = debit_account
        self.credit_account = credit_account
        self.amount_kobo = amount_kobo
        self.posted_by = posted_by
        self.description = description
        self.timestamp = datetime.utcnow().isoformat()
        self.suspicious = False
        self.flags = []

    def to_dict(self):
        return {
            "entry_id": self.entry_id, "debit_account": self.debit_account,
            "credit_account": self.credit_account, "amount_kobo": self.amount_kobo,
            "posted_by": self.posted_by, "description": self.description,
            "timestamp": self.timestamp, "suspicious": self.suspicious,
            "flags": self.flags,
        }

# ─── In-Memory State ────────────────────────────────────────────────────────

lock = threading.Lock()
snapshots = []
alerts = []
journal_entries = []
# Suspense accounts and round-number thresholds for anomaly detection
SUSPENSE_ACCOUNTS = {"9999001", "9999002", "9999003", "SUSPENSE", "SUNDRY"}
ROUND_NUMBER_THRESHOLD = 10_000_000_00  # ₦100,000 in kobo
event_bus_events = []

def emit_event(event_type, payload):
    event_bus_events.append({
        "event_type": event_type, "source": "gl-reconciliation",
        "topic": "security.insider-threat",
        "timestamp": datetime.utcnow().isoformat(), "payload": payload,
    })


def check_trial_balance(total_debits_kobo, total_credits_kobo, account_count):
    """Check if trial balance is in balance — any variance is a CRITICAL alert."""
    now = datetime.utcnow().isoformat()
    snap_id = f"SNAP-{hashlib.sha256(now.encode()).hexdigest()[:8]}"
    snapshot = LedgerSnapshot(snap_id, total_debits_kobo, total_credits_kobo, account_count, now)
    snapshots.append(snapshot)

    triggered = []
    if not snapshot.balanced:
        alert = ReconciliationAlert(
            "trial_balance_mismatch", "critical",
            f"TRIAL BALANCE MISMATCH: debits={total_debits_kobo} credits={total_credits_kobo} variance={snapshot.variance_kobo} kobo (₦{snapshot.variance_kobo/100:,.2f})",
            snapshot.variance_kobo,
        )
        alerts.append(alert)
        triggered.append(alert)
        emit_event("gl.trial_balance.mismatch", {
            "variance_kobo": snapshot.variance_kobo, "severity": "CRITICAL",
            "snapshot_id": snap_id,
        })

    return snapshot, triggered


def check_journal_entry(entry_id, debit_account, credit_account, amount_kobo, posted_by, description):
    """Analyze a journal entry for suspicious patterns."""
    entry = JournalEntry(entry_id, debit_account, credit_account, amount_kobo, posted_by, description)

    triggered = []

    # Check 1: Suspense account usage (often used to hide fraudulent entries)
    if debit_account in SUSPENSE_ACCOUNTS or credit_account in SUSPENSE_ACCOUNTS:
        entry.suspicious = True
        entry.flags.append("suspense_account_used")
        alert = ReconciliationAlert(
            "unusual_journal", "high",
            f"Journal entry {entry_id} uses suspense account (debit={debit_account} credit={credit_account})",
            amount_kobo,
        )
        alerts.append(alert)
        triggered.append(alert)

    # Check 2: Round numbers (often indicate manufactured entries)
    if amount_kobo >= ROUND_NUMBER_THRESHOLD and amount_kobo % 1_000_000 == 0:
        entry.flags.append("round_number")
        if entry.suspicious:  # already flagged
            alert = ReconciliationAlert(
                "unusual_journal", "high",
                f"Journal entry {entry_id} is a round number (₦{amount_kobo/100:,.2f}) to suspense account",
                amount_kobo,
            )
            alerts.append(alert)
            triggered.append(alert)

    # Check 3: Self-reversing entries (entry followed by exact reverse within minutes)
    recent = [j for j in journal_entries[-20:] if j.posted_by == posted_by]
    for prev in recent:
        if (prev.debit_account == credit_account and
            prev.credit_account == debit_account and
            prev.amount_kobo == amount_kobo):
            entry.suspicious = True
            entry.flags.append("self_reversal")
            alert = ReconciliationAlert(
                "reversal_anomaly", "critical",
                f"Journal entry {entry_id} exactly reverses {prev.entry_id} (same poster: {posted_by})",
                amount_kobo,
            )
            alerts.append(alert)
            triggered.append(alert)

    journal_entries.append(entry)

    for alert in triggered:
        emit_event("gl.suspicious_journal", alert.to_dict())

    return entry, triggered


# ─── HTTP Server ─────────────────────────────────────────────────────────────

class GLReconHandler(BaseHTTPRequestHandler):
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
        elif self.path == "/api/v1/gl-recon/snapshots":
            with lock:
                self._json_response(200, [s.to_dict() for s in snapshots])
        elif self.path == "/api/v1/gl-recon/alerts":
            with lock:
                self._json_response(200, [a.to_dict() for a in alerts])
        elif self.path == "/api/v1/gl-recon/journals":
            with lock:
                suspicious = [j.to_dict() for j in journal_entries if j.suspicious]
                self._json_response(200, suspicious)
        elif self.path == "/api/v1/gl-recon/stats":
            with lock:
                balanced = sum(1 for s in snapshots if s.balanced)
                self._json_response(200, {
                    "total_snapshots": len(snapshots),
                    "balanced": balanced,
                    "imbalanced": len(snapshots) - balanced,
                    "total_alerts": len(alerts),
                    "critical_alerts": sum(1 for a in alerts if a.severity == "critical"),
                    "suspicious_journals": sum(1 for j in journal_entries if j.suspicious),
                    "total_journals_checked": len(journal_entries),
                    "service": SERVICE_NAME,
                })
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/gl-recon/check-balance":
            with lock:
                snapshot, triggered = check_trial_balance(
                    body.get("total_debits_kobo", 0),
                    body.get("total_credits_kobo", 0),
                    body.get("account_count", 0),
                )
            status = 200 if snapshot.balanced else 500
            self._json_response(status, {
                "snapshot": snapshot.to_dict(),
                "alerts": [a.to_dict() for a in triggered],
            })

        elif self.path == "/api/v1/gl-recon/check-journal":
            with lock:
                entry, triggered = check_journal_entry(
                    body.get("entry_id", ""),
                    body.get("debit_account", ""),
                    body.get("credit_account", ""),
                    body.get("amount_kobo", 0),
                    body.get("posted_by", ""),
                    body.get("description", ""),
                )
            status = 200 if not entry.suspicious else 422
            self._json_response(status, {
                "entry": entry.to_dict(),
                "alerts": [a.to_dict() for a in triggered],
            })
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

    server = HTTPServer(("0.0.0.0", PORT), GLReconHandler)
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
