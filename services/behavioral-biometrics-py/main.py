"""
54Bank Behavioral Biometrics Service
Continuous authentication via keystroke dynamics, touch pressure, swipe patterns.
Integrates with Kafka (events), Redis (session state), PostgreSQL (profiles).
"""
import os, json, time, hashlib, math, statistics
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "behavioral-biometrics-py"
PORT = int(os.environ.get("PORT", "9047"))

# ── Behavioral Profiles ─────────────────────────────────────────────────────

profiles = {}  # user_id -> BehavioralProfile

class BehavioralProfile:
    def __init__(self, user_id):
        self.user_id = user_id
        self.keystroke_timings = []    # inter-key intervals in ms
        self.touch_pressures = []      # pressure values 0-1
        self.swipe_velocities = []     # pixels/ms
        self.typing_speed_wpm = []     # words per minute
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
        
        # Keystroke timing comparison
        if baseline["keystroke_mean_ms"] and "keystroke_timings" in probe_data:
            probe_mean = statistics.mean(probe_data["keystroke_timings"]) if probe_data["keystroke_timings"] else 0
            if baseline["keystroke_std_ms"] and baseline["keystroke_std_ms"] > 0:
                z_score = abs(probe_mean - baseline["keystroke_mean_ms"]) / baseline["keystroke_std_ms"]
                if z_score > 3.0:
                    anomalies.append(f"KEYSTROKE_ANOMALY: z-score={z_score:.2f} (mean={probe_mean:.1f}ms vs baseline={baseline['keystroke_mean_ms']:.1f}ms)")
                    risk_score += min(int(z_score * 10), 40)
        
        # Touch pressure comparison
        if baseline["touch_pressure_mean"] and "touch_pressures" in probe_data:
            probe_pressure = statistics.mean(probe_data["touch_pressures"]) if probe_data["touch_pressures"] else 0
            pressure_diff = abs(probe_pressure - baseline["touch_pressure_mean"])
            if pressure_diff > 0.3:
                anomalies.append(f"PRESSURE_ANOMALY: diff={pressure_diff:.2f}")
                risk_score += 25
        
        # Swipe velocity comparison
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

# ── HTTP Handler ─────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "healthy", "service": SERVICE_NAME, "version": "1.0.0",
                "modalities": ["keystroke_dynamics", "touch_pressure", "swipe_patterns"]})
        elif self.path.startswith("/api/v1/behavioral/profile"):
            uid = self.path.split("user_id=")[-1] if "user_id=" in self.path else ""
            if uid in profiles:
                p = profiles[uid]
                self._json(200, {"user_id": uid, "baseline": p.get_baseline(), "sessions": p.session_count})
            else:
                self._json(404, {"error": "profile not found"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        
        if self.path == "/api/v1/behavioral/enroll":
            uid = body.get("user_id", "")
            if uid not in profiles:
                profiles[uid] = BehavioralProfile(uid)
            p = profiles[uid]
            if "keystroke_timings" in body: p.add_keystroke_sample(body["keystroke_timings"])
            if "touch_pressures" in body: p.add_touch_sample(body["touch_pressures"])
            if "swipe_velocities" in body: p.add_swipe_sample(body["swipe_velocities"])
            p.session_count += 1
            p.last_updated = datetime.now(timezone.utc).isoformat()
            self._json(200, {"status": "enrolled", "sessions": p.session_count, "baseline": p.get_baseline()})
        
        elif self.path == "/api/v1/behavioral/verify":
            uid = body.get("user_id", "")
            if uid not in profiles:
                self._json(404, {"error": "no behavioral profile — enroll first"})
                return
            result = profiles[uid].compare(body)
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
    print(f"[{SERVICE_NAME}] Starting on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
