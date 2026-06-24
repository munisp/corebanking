"""
54Bank UEBA (User & Entity Behavior Analytics) — Python
All state persisted to PostgreSQL. No in-memory dicts.
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
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "ueba-analytics-py"
PORT = int(os.environ.get("PORT", "8080"))

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
        cur.execute("""CREATE TABLE IF NOT EXISTS ueba_profiles (
            employee_id TEXT PRIMARY KEY, role TEXT,
            login_hours JSONB DEFAULT '{}', login_ips JSONB DEFAULT '{}',
            login_devices JSONB DEFAULT '{}',
            daily_txn_counts JSONB DEFAULT '[]', daily_txn_amounts JSONB DEFAULT '[]',
            resources_accessed JSONB DEFAULT '{}', peer_group TEXT,
            risk_score FLOAT DEFAULT 0, anomalies JSONB DEFAULT '[]',
            last_updated TEXT)""")
        cur.execute("""CREATE TABLE IF NOT EXISTS ueba_alerts (
            id TEXT PRIMARY KEY, employee_id TEXT NOT NULL,
            anomaly_type TEXT, severity TEXT, score FLOAT,
            details TEXT, timestamp TEXT, acknowledged BOOLEAN DEFAULT FALSE)""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ueba_risk ON ueba_profiles(risk_score)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_ueba_alerts_emp ON ueba_alerts(employee_id)")
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL schema initialized")
    except Exception as e:
        print(f"[{SERVICE_NAME}] Schema init error: {e}")


def db_get_profile(employee_id):
    conn = get_db()
    if not conn:
        return None
    try:
        cur = conn.cursor()
        cur.execute("SELECT employee_id, role, login_hours, login_ips, login_devices, daily_txn_counts, daily_txn_amounts, resources_accessed, peer_group, risk_score, anomalies, last_updated FROM ueba_profiles WHERE employee_id = %s", (employee_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return None
        return {
            "employee_id": row[0], "role": row[1],
            "login_hours": row[2] if isinstance(row[2], dict) else json.loads(row[2] or "{}"),
            "login_ips": row[3] if isinstance(row[3], dict) else json.loads(row[3] or "{}"),
            "login_devices": row[4] if isinstance(row[4], dict) else json.loads(row[4] or "{}"),
            "daily_txn_counts": row[5] if isinstance(row[5], list) else json.loads(row[5] or "[]"),
            "daily_txn_amounts": row[6] if isinstance(row[6], list) else json.loads(row[6] or "[]"),
            "resources_accessed": row[7] if isinstance(row[7], dict) else json.loads(row[7] or "{}"),
            "peer_group": row[8], "risk_score": row[9],
            "anomalies": row[10] if isinstance(row[10], list) else json.loads(row[10] or "[]"),
            "last_updated": row[11],
        }
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB get_profile error: {e}")
        return None


def db_save_profile(p):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""INSERT INTO ueba_profiles (employee_id, role, login_hours, login_ips, login_devices, daily_txn_counts, daily_txn_amounts, resources_accessed, peer_group, risk_score, anomalies, last_updated)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (employee_id) DO UPDATE SET role=EXCLUDED.role, login_hours=EXCLUDED.login_hours, login_ips=EXCLUDED.login_ips, login_devices=EXCLUDED.login_devices, daily_txn_counts=EXCLUDED.daily_txn_counts, daily_txn_amounts=EXCLUDED.daily_txn_amounts, resources_accessed=EXCLUDED.resources_accessed, risk_score=EXCLUDED.risk_score, anomalies=EXCLUDED.anomalies, last_updated=EXCLUDED.last_updated""",
            (p["employee_id"], p["role"],
             json.dumps(p["login_hours"]), json.dumps(p["login_ips"]), json.dumps(p["login_devices"]),
             json.dumps(p["daily_txn_counts"]), json.dumps(p["daily_txn_amounts"]),
             json.dumps(p["resources_accessed"]), p.get("peer_group", p["role"]),
             p["risk_score"], json.dumps(p["anomalies"]), p["last_updated"]))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_profile error: {e}")


def db_save_alert(alert):
    conn = get_db()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO ueba_alerts (id, employee_id, anomaly_type, severity, score, details, timestamp) VALUES (%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING",
            (alert["id"], alert["employee_id"], alert["anomaly_type"], alert["severity"],
             alert["score"], alert["details"], alert["timestamp"]))
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save_alert error: {e}")


def db_list_profiles():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT employee_id, role, risk_score, anomalies, last_updated FROM ueba_profiles ORDER BY risk_score DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        result = []
        for r in rows:
            anomalies = r[3] if isinstance(r[3], list) else json.loads(r[3] or "[]")
            result.append({
                "employee_id": r[0], "role": r[1], "risk_score": r[2],
                "anomaly_count": len(anomalies), "last_updated": r[4],
            })
        return result
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB list_profiles error: {e}")
        return []


def db_list_alerts():
    conn = get_db()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, employee_id, anomaly_type, severity, score, details, timestamp, acknowledged FROM ueba_alerts ORDER BY timestamp DESC LIMIT 1000")
        rows = cur.fetchall()
        cur.close()
        return [{"id": r[0], "employee_id": r[1], "anomaly_type": r[2], "severity": r[3],
                 "score": r[4], "details": r[5], "timestamp": r[6], "acknowledged": r[7]} for r in rows]
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB list_alerts error: {e}")
        return []


def db_stats():
    conn = get_db()
    if not conn:
        return {}
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM ueba_profiles")
        total_profiles = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ueba_profiles WHERE risk_score > 0.7")
        high_risk = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ueba_alerts")
        total_alerts = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM ueba_alerts WHERE severity = 'critical'")
        critical = cur.fetchone()[0]
        cur.close()
        return {"total_profiles": total_profiles, "total_alerts": total_alerts,
                "high_risk_employees": high_risk, "critical_alerts": critical, "service": SERVICE_NAME}
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB stats error: {e}")
        return {}


# ─── Core Logic ──────────────────────────────────────────────────────────────

def get_or_create_profile(employee_id, role="unknown"):
    p = db_get_profile(employee_id)
    if p is None:
        p = {
            "employee_id": employee_id, "role": role,
            "login_hours": {}, "login_ips": {}, "login_devices": {},
            "daily_txn_counts": [], "daily_txn_amounts": [],
            "resources_accessed": {}, "peer_group": role,
            "risk_score": 0.0, "anomalies": [],
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        db_save_profile(p)
    return p


def analyze_login(employee_id, role, hour, ip, device_id):
    with db_lock:
        profile = get_or_create_profile(employee_id, role)
        anomalies_found = []
        login_hours = profile["login_hours"]
        total_logins = sum(int(v) for v in login_hours.values())

        if total_logins > 10:
            hour_freq = int(login_hours.get(str(hour), 0)) / total_logins
            if hour_freq < 0.02:
                severity = "high" if hour in [0, 1, 2, 3, 4, 5] else "medium"
                alert = make_alert(employee_id, "login_time", severity, 0.7,
                    f"Login at hour {hour} is unusual (only {hour_freq:.1%} of history)")
                anomalies_found.append(alert)

        if device_id and device_id not in profile["login_devices"]:
            if len(profile["login_devices"]) > 0:
                alert = make_alert(employee_id, "new_device", "medium", 0.5,
                    f"First login from device {device_id} (known devices: {len(profile['login_devices'])})")
                anomalies_found.append(alert)

        if ip and ip not in profile["login_ips"]:
            if len(profile["login_ips"]) > 2:
                alert = make_alert(employee_id, "new_ip", "medium", 0.4,
                    f"First login from IP {ip} (known IPs: {len(profile['login_ips'])})")
                anomalies_found.append(alert)

        login_hours[str(hour)] = int(login_hours.get(str(hour), 0)) + 1
        if ip:
            profile["login_ips"][ip] = int(profile["login_ips"].get(ip, 0)) + 1
        if device_id:
            profile["login_devices"][device_id] = int(profile["login_devices"].get(device_id, 0)) + 1
        profile["last_updated"] = datetime.now(timezone.utc).isoformat()
        profile["login_hours"] = login_hours

        if anomalies_found:
            profile["risk_score"] = min(1.0, profile["risk_score"] + sum(a["score"] for a in anomalies_found) * 0.1)
            for a in anomalies_found:
                profile["anomalies"].append(a)
                db_save_alert(a)

        db_save_profile(profile)
        return anomalies_found


def analyze_transaction(employee_id, role, amount_kobo, txn_count_today):
    with db_lock:
        profile = get_or_create_profile(employee_id, role)
        anomalies_found = []
        counts = profile["daily_txn_counts"]
        amounts = profile["daily_txn_amounts"]

        if len(counts) >= 5:
            avg_count = sum(counts) / len(counts)
            std_count = math.sqrt(sum((x - avg_count) ** 2 for x in counts) / len(counts)) or 1
            if txn_count_today > avg_count + 3 * std_count:
                alert = make_alert(employee_id, "txn_spike", "high", 0.8,
                    f"Transaction count {txn_count_today} is {((txn_count_today - avg_count) / std_count):.1f} std devs above mean ({avg_count:.0f})")
                anomalies_found.append(alert)

        if len(amounts) >= 5:
            avg_amt = sum(amounts) / len(amounts)
            std_amt = math.sqrt(sum((x - avg_amt) ** 2 for x in amounts) / len(amounts)) or 1
            if amount_kobo > avg_amt + 3 * std_amt:
                alert = make_alert(employee_id, "txn_spike", "critical", 0.9,
                    f"Daily amount {amount_kobo} kobo is {((amount_kobo - avg_amt) / std_amt):.1f} std devs above mean ({avg_amt:.0f})")
                anomalies_found.append(alert)

        counts.append(txn_count_today)
        amounts.append(amount_kobo)
        if len(counts) > 30:
            counts = counts[-30:]
        if len(amounts) > 30:
            amounts = amounts[-30:]
        profile["daily_txn_counts"] = counts
        profile["daily_txn_amounts"] = amounts
        profile["last_updated"] = datetime.now(timezone.utc).isoformat()

        if anomalies_found:
            profile["risk_score"] = min(1.0, profile["risk_score"] + sum(a["score"] for a in anomalies_found) * 0.15)
            for a in anomalies_found:
                profile["anomalies"].append(a)
                db_save_alert(a)

        db_save_profile(profile)
        return anomalies_found


def make_alert(employee_id, anomaly_type, severity, score, details):
    return {
        "id": f"UEBA-{hashlib.sha256(f'{employee_id}{time.time()}'.encode()).hexdigest()[:8]}",
        "employee_id": employee_id, "anomaly_type": anomaly_type,
        "severity": severity, "score": score, "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(), "acknowledged": False,
    }


# ─── HTTP Server ─────────────────────────────────────────────────────────────

class UEBAHandler(BaseHTTPRequestHandler):
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
            ready = get_db() is not None
            if ready:
                self._json_response(200, {"status": "ready"})
            else:
                self._json_response(503, {"status": "not_ready", "reason": "database not connected"})
        elif self.path == "/api/v1/ueba/profiles":
            self._json_response(200, db_list_profiles())
        elif self.path == "/api/v1/ueba/alerts":
            self._json_response(200, db_list_alerts())
        elif self.path == "/api/v1/ueba/stats":
            self._json_response(200, db_stats())
        else:
            self._json_response(404, {"error": "not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        if self.path == "/api/v1/ueba/analyze-login":
            anomalies = analyze_login(
                body.get("employee_id", ""), body.get("role", "unknown"),
                body.get("hour", datetime.now(timezone.utc).hour),
                body.get("ip", ""), body.get("device_id", ""))
            self._json_response(200, {
                "anomalies_detected": len(anomalies),
                "alerts": anomalies,
                "risk_level": "high" if any(a["severity"] in ("high", "critical") for a in anomalies) else "normal",
            })
        elif self.path == "/api/v1/ueba/analyze-transaction":
            anomalies = analyze_transaction(
                body.get("employee_id", ""), body.get("role", "unknown"),
                body.get("amount_kobo", 0), body.get("txn_count_today", 0))
            self._json_response(200, {
                "anomalies_detected": len(anomalies), "alerts": anomalies,
            })
        elif self.path == "/api/v1/ueba/seed-baseline":
            with db_lock:
                emp_id = body.get("employee_id", "")
                role = body.get("role", "teller")
                profile = get_or_create_profile(emp_id, role)
                for h in body.get("login_hours", [9, 10, 11, 14, 15, 16]):
                    profile["login_hours"][str(h)] = int(profile["login_hours"].get(str(h), 0)) + 10
                for ip in body.get("ips", ["10.0.1.100"]):
                    profile["login_ips"][ip] = 50
                for dev in body.get("devices", ["WORKSTATION-001"]):
                    profile["login_devices"][dev] = 50
                profile["daily_txn_counts"] = body.get("daily_txn_counts", [20, 22, 18, 25, 19, 21, 23])
                profile["daily_txn_amounts"] = body.get("daily_txn_amounts", [500000, 600000, 450000, 550000, 480000])
                db_save_profile(profile)
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


def main():
    global _last_activity
    init_schema()

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
