"""
54Bank Liquidity Forecasting Service
ML-based intraday cash position prediction.
Persists observations to PostgreSQL.
"""
import os, json, math
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
import os
import json

SERVICE_NAME = "liquidity-forecast-py"
PORT = int(os.environ.get("PORT", "9050"))
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
            CREATE TABLE IF NOT EXISTS liquidity_observations (
                id SERIAL PRIMARY KEY,
                balance_kobo BIGINT NOT NULL,
                net_flow_kobo BIGINT NOT NULL,
                observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS liquidity_forecasts (
                id SERIAL PRIMARY KEY,
                current_balance_kobo BIGINT NOT NULL,
                horizon_hours INTEGER NOT NULL DEFAULT 24,
                min_predicted_kobo BIGINT NOT NULL,
                max_predicted_kobo BIGINT NOT NULL,
                crr_required_kobo BIGINT NOT NULL,
                recommendation TEXT NOT NULL DEFAULT 'HOLD',
                alert_count INTEGER NOT NULL DEFAULT 0,
                forecast_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.close()
        print(f"[{SERVICE_NAME}] PostgreSQL initialized")
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e}")
        db_conn = None


class LiquidityModel:
    def __init__(self):
        self.seasonal_patterns = {
            0: 0.95, 1: 1.0, 2: 1.0, 3: 1.05, 4: 1.10, 5: 0.80, 6: 0.70,
        }
        self.hourly_patterns = {
            h: 0.2 + 0.8 * math.exp(-((h - 13) ** 2) / 20) for h in range(24)
        }

    def _load_historical(self):
        if not db_conn:
            return []
        try:
            cur = db_conn.cursor()
            cur.execute("SELECT balance_kobo, net_flow_kobo, observed_at FROM liquidity_observations ORDER BY observed_at DESC LIMIT 1000")
            rows = cur.fetchall()
            cur.close()
            return [{"balance_kobo": r[0], "net_flow_kobo": r[1], "timestamp": r[2].isoformat() if hasattr(r[2], 'isoformat') else str(r[2])} for r in rows]
        except Exception as e:
            print(f"[{SERVICE_NAME}] DB load error: {e}")
            return []

    def _observation_count(self) -> int:
        if not db_conn:
            return 0
        try:
            cur = db_conn.cursor()
            cur.execute("SELECT COUNT(*) FROM liquidity_observations")
            count = cur.fetchone()[0]
            cur.close()
            return count
        except Exception:
            return 0

    def add_observation(self, balance_kobo, net_flow_kobo):
        if db_conn:
            try:
                cur = db_conn.cursor()
                cur.execute(
                    "INSERT INTO liquidity_observations (balance_kobo, net_flow_kobo) VALUES (%s, %s)",
                    (balance_kobo, net_flow_kobo),
                )
                cur.close()
            except Exception as e:
                print(f"[{SERVICE_NAME}] DB insert error: {e}")

    def forecast(self, current_balance_kobo, horizon_hours=24):
        historical = self._load_historical()
        predictions = []
        balance = current_balance_kobo
        now = datetime.now(timezone.utc)

        avg_flow = 0
        if historical:
            total_flow = sum(h["net_flow_kobo"] for h in historical)
            avg_flow = total_flow / max(len(historical), 1)

        for h in range(1, horizon_hours + 1):
            future = now + timedelta(hours=h)
            day_factor = self.seasonal_patterns.get(future.weekday(), 1.0)
            hour_factor = self.hourly_patterns.get(future.hour, 0.5)

            predicted_flow = int(avg_flow * day_factor * hour_factor)
            balance += predicted_flow

            predictions.append({
                "hour": h,
                "timestamp": future.isoformat(),
                "predicted_balance_kobo": balance,
                "predicted_net_flow_kobo": predicted_flow,
                "confidence": max(0.5, 0.95 - h * 0.015),
            })

        min_balance = min(p["predicted_balance_kobo"] for p in predictions)
        crr_required = int(current_balance_kobo * 0.275)

        alerts = []
        if min_balance < crr_required:
            alerts.append({"type": "CRR_BREACH", "severity": "CRITICAL", "hour": next(i+1 for i, p in enumerate(predictions) if p["predicted_balance_kobo"] < crr_required), "message": f"Predicted CRR breach at min balance {min_balance} kobo vs required {crr_required} kobo"})
        if min_balance < current_balance_kobo * 0.5:
            alerts.append({"type": "LIQUIDITY_STRESS", "severity": "WARNING", "message": "Balance predicted to drop below 50% of current level"})

        result = {
            "current_balance_kobo": current_balance_kobo,
            "predictions": predictions,
            "min_predicted_kobo": min_balance,
            "max_predicted_kobo": max(p["predicted_balance_kobo"] for p in predictions),
            "crr_required_kobo": crr_required,
            "alerts": alerts,
            "recommendation": "BORROW_OVERNIGHT" if min_balance < crr_required else "HOLD",
        }

        if db_conn:
            try:
                cur = db_conn.cursor()
                cur.execute(
                    "INSERT INTO liquidity_forecasts (current_balance_kobo, horizon_hours, min_predicted_kobo, max_predicted_kobo, crr_required_kobo, recommendation, alert_count) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (current_balance_kobo, horizon_hours, result["min_predicted_kobo"], result["max_predicted_kobo"], crr_required, result["recommendation"], len(alerts)),
                )
                cur.close()
            except Exception as e:
                print(f"[{SERVICE_NAME}] DB forecast save error: {e}")

        return result

model = LiquidityModel()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "healthy", "service": SERVICE_NAME, "version": "1.0.0",
                "database": "connected" if db_conn else "disconnected"})
        elif self.path.startswith("/api/v1/liquidity/stats"):
            self._json(200, {"observations": model._observation_count(), "source": "postgresql" if db_conn else "no_database"})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if self.path == "/api/v1/liquidity/observe":
            model.add_observation(body.get("balance_kobo", 0), body.get("net_flow_kobo", 0))
            self._json(200, {"status": "recorded", "total_observations": model._observation_count()})
        elif self.path == "/api/v1/liquidity/forecast":
            result = model.forecast(body.get("current_balance_kobo", 0), body.get("horizon_hours", 24))
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
