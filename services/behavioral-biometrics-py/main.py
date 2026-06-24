"""
54Bank Behavioral Biometrics Service
Continuous authentication via keystroke dynamics, touch pressure, swipe patterns.
Persists all profiles to PostgreSQL.
"""
import os, json, time, hashlib, math, statistics
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "behavioral-biometrics-py"
PORT = int(os.environ.get("PORT", "9047"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")

db_conn = None

def init_db():
    global db_conn
    if not DATABASE_URL:
        print(f"[{SERVICE_NAME}] WARNING: DATABASE_URL not set — running without persistence")
        return
    try:
        import psycopg2
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
        cur = db_conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS behavioral_profiles (
                user_id TEXT PRIMARY KEY,
                keystroke_timings TEXT NOT NULL DEFAULT '[]',
                touch_pressures TEXT NOT NULL DEFAULT '[]',
                swipe_velocities TEXT NOT NULL DEFAULT '[]',
                typing_speed_wpm TEXT NOT NULL DEFAULT '[]',
                session_count INTEGER NOT NULL DEFAULT 0,
                last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS behavioral_verifications (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                is_authentic BOOLEAN NOT NULL,
                risk_score INTEGER NOT NULL DEFAULT 0,
                anomalies TEXT NOT NULL DEFAULT '[]',
                recommendation TEXT NOT NULL DEFAULT 'ALLOW',
                verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL initialized")
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e}")
        db_conn = None


class BehavioralProfile:
    def __init__(self, user_id):
        self.user_id = user_id
        self.keystroke_timings = []
        self.touch_pressures = []
        self.swipe_velocities = []
        self.typing_speed_wpm = []
        self.session_count = 0
        self.last_updated = datetime.now(timezone.utc).isoformat()

    def add_keystroke_sample(self, timings):
        self.keystroke_timings.extend(timings[-50:])
        self.keystroke_timings = self.keystroke_timings[-500:]

    def add_touch_sample(self, pressures):
        self.touch_pressures.extend(pressures[-20:])
        self.touch_pressures = self.touch_pressures[-200:]

    def add_swipe_sample(self, velocities):
        self.swipe_velocities.extend(velocities[-10:])
        self.swipe_velocities = self.swipe_velocities[-100:]

    def get_baseline(self):
        return {
            "keystroke_mean_ms": statistics.mean(self.keystroke_timings) if len(self.keystroke_timings) >= 10 else None,
            "keystroke_std_ms": statistics.stdev(self.keystroke_timings) if len(self.keystroke_timings) >= 10 else None,
            "touch_pressure_mean": statistics.mean(self.touch_pressures) if len(self.touch_pressures) >= 5 else None,
            "swipe_velocity_mean": statistics.mean(self.swipe_velocities) if len(self.swipe_velocities) >= 5 else None,
            "samples": self.session_count,
        }

    def compare(self, probe_data):
        baseline = self.get_baseline()
        anomalies = []
        risk_score = 0

        if baseline["keystroke_mean_ms"] and "keystroke_timings" in probe_data:
            probe_mean = statistics.mean(probe_data["keystroke_timings"]) if probe_data["keystroke_timings"] else 0
            if baseline["keystroke_std_ms"] and baseline["keystroke_std_ms"] > 0:
                z_score = abs(probe_mean - baseline["keystroke_mean_ms"]) / baseline["keystroke_std_ms"]
                if z_score > 3.0:
                    anomalies.append(f"KEYSTROKE_ANOMALY: z-score={z_score:.2f} (mean={probe_mean:.1f}ms vs baseline={baseline['keystroke_mean_ms']:.1f}ms)")
                    risk_score += min(int(z_score * 10), 40)

        if baseline["touch_pressure_mean"] and "touch_pressures" in probe_data:
            probe_pressure = statistics.mean(probe_data["touch_pressures"]) if probe_data["touch_pressures"] else 0
            pressure_diff = abs(probe_pressure - baseline["touch_pressure_mean"])
            if pressure_diff > 0.3:
                anomalies.append(f"PRESSURE_ANOMALY: diff={pressure_diff:.2f}")
                risk_score += 25

        if baseline["swipe_velocity_mean"] and "swipe_velocities" in probe_data:
            probe_vel = statistics.mean(probe_data["swipe_velocities"]) if probe_data["swipe_velocities"] else 0
            vel_ratio = probe_vel / baseline["swipe_velocity_mean"] if baseline["swipe_velocity_mean"] > 0 else 1.0
            if vel_ratio < 0.4 or vel_ratio > 2.5:
                anomalies.append(f"SWIPE_ANOMALY: ratio={vel_ratio:.2f}")
                risk_score += 20

        is_authentic = risk_score < 40
        return {
            "is_authentic": is_authentic,
            "risk_score": min(risk_score, 100),
            "anomalies": anomalies,
            "recommendation": "ALLOW" if risk_score < 30 else ("STEP_UP_AUTH" if risk_score < 60 else "BLOCK_SESSION"),
        }


# ── Database Helpers ─────────────────────────────────────────────────────────

def db_load_profile(user_id: str):
    if not db_conn:
        return None
    try:
        cur = db_conn.cursor()
        cur.execute("SELECT keystroke_timings, touch_pressures, swipe_velocities, typing_speed_wpm, session_count, last_updated FROM behavioral_profiles WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        cur.close()
        if not row:
            return None
        p = BehavioralProfile(user_id)
        p.keystroke_timings = json.loads(row[0])
        p.touch_pressures = json.loads(row[1])
        p.swipe_velocities = json.loads(row[2])
        p.typing_speed_wpm = json.loads(row[3])
        p.session_count = row[4]
        p.last_updated = row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5])
        return p
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB load error: {e}")
        return None

def db_save_profile(p: BehavioralProfile):
    if not db_conn:
        return
    try:
        cur = db_conn.cursor()
        cur.execute(
            """INSERT INTO behavioral_profiles (user_id, keystroke_timings, touch_pressures, swipe_velocities, typing_speed_wpm, session_count, last_updated)
               VALUES (%s, %s, %s, %s, %s, %s, NOW())
               ON CONFLICT (user_id) DO UPDATE SET
                   keystroke_timings = EXCLUDED.keystroke_timings,
                   touch_pressures = EXCLUDED.touch_pressures,
                   swipe_velocities = EXCLUDED.swipe_velocities,
                   typing_speed_wpm = EXCLUDED.typing_speed_wpm,
                   session_count = EXCLUDED.session_count,
                   last_updated = NOW()""",
            (p.user_id, json.dumps(p.keystroke_timings), json.dumps(p.touch_pressures),
             json.dumps(p.swipe_velocities), json.dumps(p.typing_speed_wpm), p.session_count),
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB save error: {e}")

def db_save_verification(user_id: str, result: dict):
    if not db_conn:
        return
    try:
        cur = db_conn.cursor()
        cur.execute(
            "INSERT INTO behavioral_verifications (user_id, is_authentic, risk_score, anomalies, recommendation) VALUES (%s, %s, %s, %s, %s)",
            (user_id, result["is_authentic"], result["risk_score"], json.dumps(result["anomalies"]), result["recommendation"]),
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB verification save error: {e}")

def db_get_profile_count() -> int:
    if not db_conn:
        return 0
    try:
        cur = db_conn.cursor()
        cur.execute("SELECT COUNT(*) FROM behavioral_profiles")
        count = cur.fetchone()[0]
        cur.close()
        return count
    except Exception:
        return 0


# ── HTTP Handler ─────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "healthy", "service": SERVICE_NAME, "version": "1.0.0",
                "database": "connected" if db_conn else "disconnected",
                "modalities": ["keystroke_dynamics", "touch_pressure", "swipe_patterns"]})
        elif self.path.startswith("/api/v1/behavioral/profile"):
            uid = self.path.split("user_id=")[-1] if "user_id=" in self.path else ""
            p = db_load_profile(uid)
            if p:
                self._json(200, {"user_id": uid, "baseline": p.get_baseline(), "sessions": p.session_count, "source": "postgresql"})
            else:
                self._json(404, {"error": "profile not found"})
        elif self.path == "/api/v1/behavioral/stats":
            self._json(200, {"total_profiles": db_get_profile_count(), "source": "postgresql" if db_conn else "no_database"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))

        if self.path == "/api/v1/behavioral/enroll":
            uid = body.get("user_id", "")
            p = db_load_profile(uid)
            if not p:
                p = BehavioralProfile(uid)
            if "keystroke_timings" in body: p.add_keystroke_sample(body["keystroke_timings"])
            if "touch_pressures" in body: p.add_touch_sample(body["touch_pressures"])
            if "swipe_velocities" in body: p.add_swipe_sample(body["swipe_velocities"])
            p.session_count += 1
            p.last_updated = datetime.now(timezone.utc).isoformat()
            db_save_profile(p)
            self._json(200, {"status": "enrolled", "sessions": p.session_count, "baseline": p.get_baseline()})

        elif self.path == "/api/v1/behavioral/verify":
            uid = body.get("user_id", "")
            p = db_load_profile(uid)
            if not p:
                self._json(404, {"error": "no behavioral profile — enroll first"})
                return
            result = p.compare(body)
            db_save_verification(uid, result)
            self._json(200, result)

        else:
            self._json(404, {"error": "not found"})

    def _json(self, code, data):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    def log_message(self, fmt, *args): pass

if __name__ == "__main__":
    init_db()
    print(f"[{SERVICE_NAME}] Starting on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
