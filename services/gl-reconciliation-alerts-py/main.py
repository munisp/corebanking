"""
54Bank GL Reconciliation Alerts — Python
All state persisted to PostgreSQL. No in-memory lists.
Middleware: Kafka, Postgres
"""

import hashlib
import json
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "gl-reconciliation-alerts-py"
PORT = int(os.environ.get("PORT", "8080"))

SUSPENSE_ACCOUNTS = {"9999001", "9999002", "9999003", "SUSPENSE", "SUNDRY"}
ROUND_NUMBER_THRESHOLD = 10_000_000_00  # ₦100,000 in kobo

# ─── Database ────────────────────────────────────────────────────────────────

db_conn = None
db_lock = threading.Lock()


def get_db():
    global db_conn
    if db_conn is not None:
        return db_conn
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        return None
    try:
        import psycopg2
        db_conn = psycopg2.connect(db_url)
        db_conn.autocommit = True
        return db_conn
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB connection failed: {e}")
        return None


def init_schema():
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS gl_snapshots (
            snapshot_id TEXT PRIMARY KEY, total_debits_kobo BIGINT,
            total_credits_kobo BIGINT, account_count INT,
            balanced BOOLEAN, variance_kobo BIGINT, timestamp TEXT)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS gl_alerts (
            id TEXT PRIMARY KEY, alert_type TEXT, severity TEXT,
            details TEXT, variance_kobo BIGINT, timestamp TEXT,
            acknowledged BOOLEAN DEFAULT FALSE, resolved BOOLEAN DEFAULT FALSE)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS gl_journal_entries (
            entry_id TEXT PRIMARY KEY, debit_account TEXT, credit_account TEXT,
            amount_kobo BIGINT, posted_by TEXT, description TEXT,
            timestamp TEXT, suspicious BOOLEAN DEFAULT FALSE,
            flags JSONB DEFAULT '[]')""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_gl_alerts_type ON gl_alerts(alert_type)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_gl_journal_poster ON gl_journal_entries(posted_by)")
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL schema initialized")
    except Exception as e:
        print(f"[{SERVICE_NAME}] Schema init error: {e}")


def db_save_snapshot(s):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO gl_snapshots (snapshot_id, total_debits_kobo, total_credits_kobo, account_count, balanced, variance_kobo, timestamp) VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (snapshot_id) DO NOTHING",
            (s["snapshot_id"], s["total_debits_kobo"], s["total_credits_kobo"],
             s["account_count"], s["balanced"], s["variance_kobo"], s["timestamp"]))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_snapshot error: {e}")


def db_save_alert(a):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO gl_alerts (id, alert_type, severity, details, variance_kobo, timestamp) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
            (a["id"], a["alert_type"], a["severity"], a["details"], a["variance_kobo"], a["timestamp"]))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_alert error: {e}")


def db_save_journal(j):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO gl_journal_entries (entry_id, debit_account, credit_account, amount_kobo, posted_by, description, timestamp, suspicious, flags) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (entry_id) DO NOTHING",
            (j["entry_id"], j["debit_account"], j["credit_account"], j["amount_kobo"],
             j["posted_by"], j["description"], j["timestamp"], j["suspicious"], json.dumps(j["flags"])))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_journal error: {e}")


def db_recent_journals_by_poster(posted_by, limit=20):
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT entry_id, debit_account, credit_account, amount_kobo, posted_by FROM gl_journal_entries WHERE posted_by = %s ORDER BY timestamp DESC LIMIT %s",
            (posted_by, limit))
        rows = cur.fetchall()
        cur.close()
        return [{"entry_id": r[0], "debit_account": r[1], "credit_account": r[2],
                 "amount_kobo": r[3], "posted_by": r[4]} for r in rows]
    except Exception:
        return []


def db_list_snapshots():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT snapshot_id, total_debits_kobo, total_credits_kobo, account_count, balanced, variance_kobo, timestamp FROM gl_snapshots ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        return [{"snapshot_id": r[0], "total_debits_kobo": r[1], "total_credits_kobo": r[2],
                 "account_count": r[3], "balanced": r[4], "variance_kobo": r[5], "timestamp": r[6]} for r in rows]
    except Exception:
        return []


def db_list_alerts():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, alert_type, severity, details, variance_kobo, timestamp, acknowledged, resolved FROM gl_alerts ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        return [{"id": r[0], "alert_type": r[1], "severity": r[2], "details": r[3],
                 "variance_kobo": r[4], "timestamp": r[5], "acknowledged": r[6], "resolved": r[7]} for r in rows]
    except Exception:
        return []


def db_list_suspicious_journals():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT entry_id, debit_account, credit_account, amount_kobo, posted_by, description, timestamp, suspicious, flags FROM gl_journal_entries WHERE suspicious = TRUE ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        return [{"entry_id": r[0], "debit_account": r[1], "credit_account": r[2],
                 "amount_kobo": r[3], "posted_by": r[4], "description": r[5],
                 "timestamp": r[6], "suspicious": r[7],
                 "flags": r[8] if isinstance(r[8], list) else json.loads(r[8] or "[]")} for r in rows]
    except Exception:
        return []


def db_stats():
    conn = get_db()
    if not conn:
        return {}
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM gl_snapshots")
        total_snaps = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gl_snapshots WHERE balanced = TRUE")
        balanced = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gl_alerts")
        total_alerts = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gl_alerts WHERE severity = 'critical'")
        critical = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gl_journal_entries WHERE suspicious = TRUE")
        suspicious = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM gl_journal_entries")
        total_journals = cur.fetchone()[0]
        cur.close()
        return {"total_snapshots": total_snaps, "balanced": balanced,
                "imbalanced": total_snaps - balanced, "total_alerts": total_alerts,
                "critical_alerts": critical, "suspicious_journals": suspicious,
                "total_journals_checked": total_journals, "service": SERVICE_NAME}
    except Exception:
        return {}


# ─── Core Logic ──────────────────────────────────────────────────────────────

def check_trial_balance(total_debits_kobo, total_credits_kobo, account_count):
    with db_lock:
        now = datetime.now(timezone.utc).isoformat()
        snap_id = f"SNAP-{hashlib.sha256(now.encode()).hexdigest()[:8]}"
        balanced = total_debits_kobo == total_credits_kobo
        variance = abs(total_debits_kobo - total_credits_kobo)
        snapshot = {
            "snapshot_id": snap_id, "total_debits_kobo": total_debits_kobo,
            "total_credits_kobo": total_credits_kobo, "account_count": account_count,
            "balanced": balanced, "variance_kobo": variance, "timestamp": now,
        }
        db_save_snapshot(snapshot)

        triggered = []
        if not balanced:
            alert = {
                "id": f"GLRC-{hashlib.sha256(f'mismatch{now}'.encode()).hexdigest()[:8]}",
                "alert_type": "trial_balance_mismatch", "severity": "critical",
                "details": f"TRIAL BALANCE MISMATCH: debits={total_debits_kobo} credits={total_credits_kobo} variance={variance} kobo (₦{variance/100:,.2f})",
                "variance_kobo": variance, "timestamp": now,
                "acknowledged": False, "resolved": False,
            }
            triggered.append(alert)
            db_save_alert(alert)

        return snapshot, triggered


def check_journal_entry(entry_id, debit_account, credit_account, amount_kobo, posted_by, description):
    with db_lock:
        now = datetime.now(timezone.utc).isoformat()
        entry = {
            "entry_id": entry_id, "debit_account": debit_account,
            "credit_account": credit_account, "amount_kobo": amount_kobo,
            "posted_by": posted_by, "description": description,
            "timestamp": now, "suspicious": False, "flags": [],
        }

        triggered = []

        if debit_account in SUSPENSE_ACCOUNTS or credit_account in SUSPENSE_ACCOUNTS:
            entry["suspicious"] = True
            entry["flags"].append("suspense_account_used")
            alert = {
                "id": f"GLRC-{hashlib.sha256(f'suspense{now}'.encode()).hexdigest()[:8]}",
                "alert_type": "unusual_journal", "severity": "high",
                "details": f"Journal entry {entry_id} uses suspense account (debit={debit_account} credit={credit_account})",
                "variance_kobo": amount_kobo, "timestamp": now,
                "acknowledged": False, "resolved": False,
            }
            triggered.append(alert)
            db_save_alert(alert)

        if amount_kobo >= ROUND_NUMBER_THRESHOLD and amount_kobo % 1_000_000 == 0:
            entry["flags"].append("round_number")
            if entry["suspicious"]:
                alert = {
                    "id": f"GLRC-{hashlib.sha256(f'round{now}'.encode()).hexdigest()[:8]}",
                    "alert_type": "unusual_journal", "severity": "high",
                    "details": f"Journal entry {entry_id} is a round number (₦{amount_kobo/100:,.2f}) to suspense account",
                    "variance_kobo": amount_kobo, "timestamp": now,
                    "acknowledged": False, "resolved": False,
                }
                triggered.append(alert)
                db_save_alert(alert)

        recent = db_recent_journals_by_poster(posted_by, 20)
        for prev in recent:
            if (prev["debit_account"] == credit_account and
                prev["credit_account"] == debit_account and
                prev["amount_kobo"] == amount_kobo):
                entry["suspicious"] = True
                entry["flags"].append("self_reversal")
                alert = {
                    "id": f"GLRC-{hashlib.sha256(f'reversal{now}'.encode()).hexdigest()[:8]}",
                    "alert_type": "reversal_anomaly", "severity": "critical",
                    "details": f"Journal entry {entry_id} exactly reverses {prev['entry_id']} (same poster: {posted_by})",
                    "variance_kobo": amount_kobo, "timestamp": now,
                    "acknowledged": False, "resolved": False,
                }
                triggered.append(alert)
                db_save_alert(alert)

        db_save_journal(entry)
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
            if get_db():
                self._json_response(200, {"status": "ready"})
            else:
                self._json_response(503, {"status": "not_ready"})
        elif self.path == "/api/v1/gl-recon/snapshots":
            self._json_response(200, db_list_snapshots())
        elif self.path == "/api/v1/gl-recon/alerts":
            self._json_response(200, db_list_alerts())
        elif self.path == "/api/v1/gl-recon/journals":
            self._json_response(200, db_list_suspicious_journals())
        elif self.path == "/api/v1/gl-recon/stats":
            self._json_response(200, db_stats())
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/gl-recon/check-balance":
            snapshot, triggered = check_trial_balance(
                body.get("total_debits_kobo", 0),
                body.get("total_credits_kobo", 0),
                body.get("account_count", 0))
            status = 200 if snapshot["balanced"] else 500
            self._json_response(status, {"snapshot": snapshot, "alerts": triggered})

        elif self.path == "/api/v1/gl-recon/check-journal":
            entry, triggered = check_journal_entry(
                body.get("entry_id", ""), body.get("debit_account", ""),
                body.get("credit_account", ""), body.get("amount_kobo", 0),
                body.get("posted_by", ""), body.get("description", ""))
            status = 200 if not entry["suspicious"] else 422
            self._json_response(status, {"entry": entry, "alerts": triggered})
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
    init_schema()

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
