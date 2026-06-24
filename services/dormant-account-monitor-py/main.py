"""
54Bank Dormant Account Monitor — Python
All state persisted to PostgreSQL. No in-memory dicts.
Middleware: Kafka, Postgres, Redis
"""

import hashlib
import json
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "dormant-account-monitor-py"
PORT = int(os.environ.get("PORT", "8080"))

DORMANCY_THRESHOLD_DAYS = 180
SUSPICIOUS_REACTIVATION_RULES = [
    {"name": "high_value_first_txn", "description": "First transaction after dormancy > ₦500,000", "threshold_kobo": 50_000_000},
    {"name": "rapid_multiple_txns", "description": "Multiple transactions within 1 hour of reactivation", "threshold_count": 3},
    {"name": "off_hours_reactivation", "description": "Account reactivated outside business hours", "blocked_hours": [0,1,2,3,4,5,6,7,20,21,22,23]},
    {"name": "same_employee_pattern", "description": "Same employee reactivates 3+ dormant accounts in 7 days", "threshold_count": 3},
]

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
        cur.execute("""CREATE TABLE IF NOT EXISTS dormant_accounts (
            account_id TEXT PRIMARY KEY, nuban TEXT, customer_name TEXT,
            last_activity TEXT, balance_kobo BIGINT DEFAULT 0, tier TEXT,
            status TEXT DEFAULT 'dormant', reactivated_by TEXT,
            reactivation_time TEXT, alerts JSONB DEFAULT '[]')""")
        cur.execute("""CREATE TABLE IF NOT EXISTS reactivation_alerts (
            id TEXT PRIMARY KEY, account_id TEXT NOT NULL, employee_id TEXT,
            rule_name TEXT, severity TEXT, details TEXT,
            timestamp TEXT, blocked BOOLEAN DEFAULT FALSE)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS employee_reactivation_log (
            id SERIAL PRIMARY KEY, employee_id TEXT NOT NULL,
            account_id TEXT NOT NULL, timestamp TEXT NOT NULL)""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dormant_status ON dormant_accounts(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_react_emp ON employee_reactivation_log(employee_id)")

        # Seed dormant accounts
        seeds = [
            ("ACCT-D001", "0012345601", "Adebayo Okonkwo", (datetime.now(timezone.utc) - timedelta(days=400)).isoformat(), 15000000, "tier-1"),
            ("ACCT-D002", "0012345602", "Fatima Ibrahim", (datetime.now(timezone.utc) - timedelta(days=250)).isoformat(), 350000, "tier-2"),
            ("ACCT-D003", "0012345603", "Chukwuma Nwosu", (datetime.now(timezone.utc) - timedelta(days=720)).isoformat(), 8500000, "tier-3"),
            ("ACCT-D004", "0012345604", "Aisha Mohammed", (datetime.now(timezone.utc) - timedelta(days=190)).isoformat(), 22000, "tier-1"),
            ("ACCT-D005", "0012345605", "Oluwaseun Akintola", (datetime.now(timezone.utc) - timedelta(days=550)).isoformat(), 4200000, "tier-2"),
        ]
        for acct_id, nuban, name, last, bal, tier in seeds:
            cur.execute("INSERT INTO dormant_accounts (account_id, nuban, customer_name, last_activity, balance_kobo, tier) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (account_id) DO NOTHING",
                (acct_id, nuban, name, last, bal, tier))
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL schema initialized with seed data")
    except Exception as e:
        print(f"[{SERVICE_NAME}] Schema init error: {e}")


def db_get_account(account_id):
    conn = get_db()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute("SELECT account_id, nuban, customer_name, last_activity, balance_kobo, tier, status, reactivated_by, reactivation_time, alerts FROM dormant_accounts WHERE account_id = %s", (account_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return None
        return {
            "account_id": row[0], "nuban": row[1], "customer_name": row[2],
            "last_activity": row[3], "balance_kobo": row[4], "tier": row[5],
            "status": row[6], "reactivated_by": row[7], "reactivation_time": row[8],
            "alerts": row[9] if isinstance(row[9], list) else json.loads(row[9] or "[]"),
        }
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB get_account error: {e}")
        return None


def db_save_account(a):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""INSERT INTO dormant_accounts (account_id, nuban, customer_name, last_activity, balance_kobo, tier, status, reactivated_by, reactivation_time, alerts)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (account_id) DO UPDATE SET status=EXCLUDED.status, reactivated_by=EXCLUDED.reactivated_by, reactivation_time=EXCLUDED.reactivation_time, alerts=EXCLUDED.alerts""",
            (a["account_id"], a["nuban"], a["customer_name"], a["last_activity"],
             a["balance_kobo"], a["tier"], a["status"], a.get("reactivated_by"),
             a.get("reactivation_time"), json.dumps(a.get("alerts", []))))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_account error: {e}")


def db_save_alert(alert):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO reactivation_alerts (id, account_id, employee_id, rule_name, severity, details, timestamp, blocked) VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
            (alert["id"], alert["account_id"], alert["employee_id"], alert["rule_name"],
             alert["severity"], alert["details"], alert["timestamp"], alert["blocked"]))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_alert error: {e}")


def db_log_reactivation(employee_id, account_id):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO employee_reactivation_log (employee_id, account_id, timestamp) VALUES (%s,%s,%s)",
            (employee_id, account_id, datetime.now(timezone.utc).isoformat()))
        cur.close()
    except Exception:
        pass


def db_recent_reactivations(employee_id, days=7):
    conn = get_db()
    if not conn:
        return 0
    try:
        cur = conn.cursor()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        cur.execute("SELECT COUNT(*) FROM employee_reactivation_log WHERE employee_id = %s AND timestamp > %s", (employee_id, cutoff))
        count = cur.fetchone()[0]
        cur.close()
        return count
    except Exception:
        return 0


def db_list_accounts():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT account_id, nuban, customer_name, last_activity, balance_kobo, tier, status, reactivated_by, reactivation_time, alerts FROM dormant_accounts ORDER BY last_activity")
        rows = cur.fetchall()
        cur.close()
        result = []
        for r in rows:
            last = datetime.fromisoformat(r[3]) if r[3] else datetime.now(timezone.utc)
            days = (datetime.now(timezone.utc) - last.replace(tzinfo=timezone.utc if last.tzinfo is None else last.tzinfo)).days
            alerts = r[9] if isinstance(r[9], list) else json.loads(r[9] or "[]")
            result.append({
                "account_id": r[0], "nuban": r[1], "customer_name": r[2],
                "last_activity": r[3], "balance_kobo": r[4], "tier": r[5],
                "status": r[6], "days_dormant": days, "reactivated_by": r[7],
                "reactivation_time": r[8], "alert_count": len(alerts),
            })
        return result
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB list error: {e}")
        return []


def db_list_alerts():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, account_id, employee_id, rule_name, severity, details, timestamp, blocked FROM reactivation_alerts ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        return [{"id": r[0], "account_id": r[1], "employee_id": r[2], "rule_name": r[3],
                 "severity": r[4], "details": r[5], "timestamp": r[6], "blocked": r[7]} for r in rows]
    except Exception:
        return []


def db_stats():
    conn = get_db()
    if not conn:
        return {}
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM dormant_accounts")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM dormant_accounts WHERE status = 'dormant'")
        dormant = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM reactivation_alerts")
        alerts = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM reactivation_alerts WHERE severity = 'critical'")
        critical = cur.fetchone()[0]
        cur.close()
        return {"total_accounts": total, "dormant": dormant, "reactivated": total - dormant,
                "alerts": alerts, "critical_alerts": critical, "service": SERVICE_NAME}
    except Exception:
        return {}


# ─── Core Logic ──────────────────────────────────────────────────────────────

def check_reactivation(account_id, employee_id, txn_amount_kobo=0, txn_count=1):
    with db_lock:
        account = db_get_account(account_id)
        if not account:
            return [], False

        if account["status"] != "dormant":
            return [], True

        alerts_triggered = []
        now = datetime.now(timezone.utc)

        last = datetime.fromisoformat(account["last_activity"])
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        days_dormant = (now - last).days

        if txn_amount_kobo > 50_000_000:
            alert = make_alert(account_id, employee_id, "high_value_first_txn", "critical",
                f"First transaction after {days_dormant} days dormancy is ₦{txn_amount_kobo/100:,.2f}")
            alerts_triggered.append(alert)

        if now.hour in [0,1,2,3,4,5,6,7,20,21,22,23]:
            alert = make_alert(account_id, employee_id, "off_hours_reactivation", "high",
                f"Dormant account reactivated at {now.strftime('%H:%M')} (outside business hours)")
            alerts_triggered.append(alert)

        recent_count = db_recent_reactivations(employee_id, 7)
        if recent_count >= 2:
            alert = make_alert(account_id, employee_id, "same_employee_pattern", "critical",
                f"Employee {employee_id} has reactivated {recent_count+1} dormant accounts in 7 days")
            alerts_triggered.append(alert)

        db_log_reactivation(employee_id, account_id)

        blocked = any(a["blocked"] for a in alerts_triggered)

        if not blocked:
            account["status"] = "reactivated"
            account["reactivated_by"] = employee_id
            account["reactivation_time"] = now.isoformat()

        for alert in alerts_triggered:
            account["alerts"].append(alert)
            db_save_alert(alert)

        db_save_account(account)
        return alerts_triggered, not blocked


def make_alert(account_id, employee_id, rule_name, severity, details):
    blocked = severity in ("critical", "high")
    return {
        "id": f"DRM-{hashlib.sha256(f'{account_id}{time.time()}'.encode()).hexdigest()[:8]}",
        "account_id": account_id, "employee_id": employee_id,
        "rule_name": rule_name, "severity": severity, "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(), "blocked": blocked,
    }


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
            if get_db():
                self._json_response(200, {"status": "ready"})
            else:
                self._json_response(503, {"status": "not_ready"})
        elif self.path == "/api/v1/dormant/accounts":
            self._json_response(200, db_list_accounts())
        elif self.path == "/api/v1/dormant/alerts":
            self._json_response(200, db_list_alerts())
        elif self.path == "/api/v1/dormant/rules":
            self._json_response(200, SUSPICIOUS_REACTIVATION_RULES)
        elif self.path == "/api/v1/dormant/stats":
            self._json_response(200, db_stats())
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/dormant/check-reactivation":
            alerts_triggered, allowed = check_reactivation(
                body.get("account_id", ""), body.get("employee_id", ""),
                body.get("txn_amount_kobo", 0), body.get("txn_count", 1))
            status = 200 if allowed else 403
            self._json_response(status, {
                "allowed": allowed, "alerts": alerts_triggered, "blocked": not allowed,
            })
        elif self.path == "/api/v1/dormant/register":
            with db_lock:
                acct = {
                    "account_id": body.get("account_id"), "nuban": body.get("nuban"),
                    "customer_name": body.get("customer_name"),
                    "last_activity": body.get("last_activity"),
                    "balance_kobo": body.get("balance_kobo", 0),
                    "tier": body.get("tier", "tier-1"),
                    "status": "dormant", "reactivated_by": None,
                    "reactivation_time": None, "alerts": [],
                }
                db_save_account(acct)
            self._json_response(201, acct)
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
