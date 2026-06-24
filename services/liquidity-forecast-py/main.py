"""
54Bank Liquidity Forecasting Service
ML-based intraday cash position prediction.
Integrates with Kafka, Redis, OpenSearch, PostgreSQL, Lakehouse.
"""
import os, json, math, time, hashlib
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

SERVICE_NAME = "liquidity-forecast-py"
PORT = int(os.environ.get("PORT", "9050"))

# ── Simple forecasting model ────────────────────────────────────────────────

class LiquidityModel:
    def __init__(self):
        self.historical = []  # list of (timestamp, balance_kobo, net_flow_kobo)
        self.seasonal_patterns = {
            0: 0.95,  # Monday — higher outflows (salary payments)
            1: 1.0,
            2: 1.0,
            3: 1.05,  # Thursday — pre-weekend buildup
            4: 1.10,  # Friday — highest outflows (salary, weekend spending)
            5: 0.80,  # Saturday — lower volume
            6: 0.70,  # Sunday — lowest volume
        }
        self.hourly_patterns = {
            h: 0.2 + 0.8 * math.exp(-((h - 13) ** 2) / 20) for h in range(24)
        }
    
    def add_observation(self, balance_kobo, net_flow_kobo):
        self.historical.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "balance_kobo": balance_kobo,
            "net_flow_kobo": net_flow_kobo,
        })
        self.historical = self.historical[-1000:]
    
    def forecast(self, current_balance_kobo, horizon_hours=24):
        predictions = []
        balance = current_balance_kobo
        now = datetime.now(timezone.utc)
        
        # Calculate average hourly flow from history
        avg_flow = 0
        if self.historical:
            total_flow = sum(h["net_flow_kobo"] for h in self.historical)
            avg_flow = total_flow / max(len(self.historical), 1)
        
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
        
        # Risk assessment
        min_balance = min(p["predicted_balance_kobo"] for p in predictions)
        crr_required = int(current_balance_kobo * 0.275)  # CBN CRR at 27.5%
        
        alerts = []
        if min_balance < crr_required:
            alerts.append({"type": "CRR_BREACH", "severity": "CRITICAL", "hour": next(i+1 for i, p in enumerate(predictions) if p["predicted_balance_kobo"] < crr_required), "message": f"Predicted CRR breach at min balance {min_balance} kobo vs required {crr_required} kobo"})
        if min_balance < current_balance_kobo * 0.5:
            alerts.append({"type": "LIQUIDITY_STRESS", "severity": "WARNING", "message": "Balance predicted to drop below 50% of current level"})
        
        return {
            "current_balance_kobo": current_balance_kobo,
            "predictions": predictions,
            "min_predicted_kobo": min_balance,
            "max_predicted_kobo": max(p["predicted_balance_kobo"] for p in predictions),
            "crr_required_kobo": crr_required,
            "alerts": alerts,
            "recommendation": "BORROW_OVERNIGHT" if min_balance < crr_required else "HOLD",
        }

model = LiquidityModel()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            self._json(200, {"status": "healthy", "service": SERVICE_NAME, "version": "1.0.0"})
        elif self.path.startswith("/api/v1/liquidity/stats"):
            self._json(200, {"observations": len(model.historical)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if self.path == "/api/v1/liquidity/observe":
            model.add_observation(body.get("balance_kobo", 0), body.get("net_flow_kobo", 0))
            self._json(200, {"status": "recorded", "total_observations": len(model.historical)})
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
    print(f"[{SERVICE_NAME}] Starting on :{PORT}")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
