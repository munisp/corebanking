#!/usr/bin/env python3
"""54Bank — ML Model Performance Monitoring Service
Serves a REST API for monitoring model performance, drift detection,
and continuous training status.

Endpoints:
    GET  /monitoring/healthz              — Health check
    GET  /monitoring/status               — All model statuses
    GET  /monitoring/models/{name}/drift   — Latest drift report
    GET  /monitoring/models/{name}/history — Training history
    GET  /monitoring/models/{name}/metrics — Current metrics
    POST /monitoring/trigger/{name}        — Trigger retraining
    GET  /monitoring/dashboard             — HTML dashboard
    GET  /monitoring/prometheus            — Prometheus metrics
"""
import json
import logging
import time
import threading
from pathlib import Path
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

logger = logging.getLogger("54bank.ml.monitoring")

WEIGHTS_DIR = Path(__file__).parent.parent / "weights"
DELTA_DIR = Path(__file__).parent.parent / "data" / "datasets" / "delta"


class MonitoringState:
    """Thread-safe state for ML monitoring."""

    def __init__(self):
        self.lock = threading.Lock()
        self.model_metrics = {}
        self.drift_reports = {}
        self.alerts = []
        self.last_check = {}
        self._load_initial_state()

    def _load_initial_state(self):
        """Load metrics from disk."""
        metrics_path = WEIGHTS_DIR / "training_metrics.json"
        if metrics_path.exists():
            with open(metrics_path) as f:
                data = json.load(f)
            self.model_metrics = data.get("models", {})

        # Load latest drift reports
        for report_file in sorted(WEIGHTS_DIR.glob("drift_report_*.json"), reverse=True):
            try:
                with open(report_file) as f:
                    report = json.load(f)
                model_name = report.get("model_name")
                if model_name and model_name not in self.drift_reports:
                    self.drift_reports[model_name] = report
            except Exception:
                pass

    def update_metrics(self, model_name: str, metrics: dict):
        with self.lock:
            self.model_metrics[model_name] = metrics

    def add_alert(self, model_name: str, alert_type: str, message: str,
                   severity: str = "warning"):
        with self.lock:
            alert = {
                "model_name": model_name,
                "type": alert_type,
                "message": message,
                "severity": severity,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "acknowledged": False,
            }
            self.alerts.append(alert)
            # Keep last 100 alerts
            if len(self.alerts) > 100:
                self.alerts = self.alerts[-100:]

    def get_status(self) -> dict:
        """Get comprehensive status of all models."""
        with self.lock:
            models = {}
            for name in ["fraud_detector", "credit_scorer", "anomaly_vae",
                          "churn_predictor", "gnn_fraud_ring", "aml_scorer"]:
                prod_path = WEIGHTS_DIR / f"{name}.pt"
                staging_path = WEIGHTS_DIR / f"{name}_staging.pt"
                canary_path = WEIGHTS_DIR / f"{name}_canary.pt"

                metrics = self.model_metrics.get(name, {})
                drift = self.drift_reports.get(name, {})

                models[name] = {
                    "production": prod_path.exists(),
                    "staging": staging_path.exists(),
                    "canary": canary_path.exists(),
                    "weight_size_kb": round(prod_path.stat().st_size / 1024, 1) if prod_path.exists() else 0,
                    "val_auc_roc": metrics.get("val_auc_roc"),
                    "val_f1": metrics.get("val_f1"),
                    "epochs_trained": metrics.get("epochs_trained"),
                    "parameters": metrics.get("parameters"),
                    "drift_detected": drift.get("overall_drift_detected", False),
                    "drift_features": drift.get("features_drifted", 0),
                    "last_drift_check": drift.get("timestamp"),
                }

            return {
                "models": models,
                "active_alerts": [a for a in self.alerts if not a["acknowledged"]],
                "total_alerts": len(self.alerts),
                "last_updated": datetime.now(timezone.utc).isoformat(),
            }


# Global state
_state = MonitoringState()


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>54Bank ML Monitoring</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0e1a;color:#e0e0e0;padding:20px}
h1{color:#4fc3f7;margin-bottom:20px;font-size:24px}
h2{color:#81d4fa;margin:20px 0 10px;font-size:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px;margin-bottom:20px}
.card{background:#1a1e2e;border-radius:12px;padding:20px;border:1px solid #2a2e3e}
.card h3{color:#4fc3f7;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.metric{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a2e3e}
.metric:last-child{border-bottom:none}
.metric .label{color:#90a4ae}
.metric .value{font-weight:600}
.good{color:#66bb6a}.warn{color:#ffa726}.bad{color:#ef5350}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
.badge.prod{background:#1b5e20;color:#66bb6a}
.badge.staging{background:#e65100;color:#ffa726}
.badge.canary{background:#4a148c;color:#ce93d8}
.badge.drift{background:#b71c1c;color:#ef5350}
.alert{background:#1a1e2e;border-left:4px solid;padding:12px;margin:8px 0;border-radius:0 8px 8px 0}
.alert.warning{border-color:#ffa726}.alert.critical{border-color:#ef5350}.alert.info{border-color:#4fc3f7}
.timestamp{color:#546e7a;font-size:12px}
.btn{background:#1565c0;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px}
.btn:hover{background:#1976d2}
</style>
</head>
<body>
<h1>54Bank ML Model Monitoring</h1>
<div id="status">Loading...</div>
<script>
async function load(){
 try{
  const r=await fetch('/monitoring/status');
  const d=await r.json();
  let h='<h2>Models</h2><div class="grid">';
  for(const[n,m]of Object.entries(d.models)){
   const auc=m.val_auc_roc?m.val_auc_roc.toFixed(4):'N/A';
   const aucClass=m.val_auc_roc>0.95?'good':m.val_auc_roc>0.85?'warn':'bad';
   h+=`<div class="card"><h3>${n} ${m.production?'<span class="badge prod">PROD</span>':''}${m.staging?'<span class="badge staging">STAGING</span>':''}${m.canary?'<span class="badge canary">CANARY</span>':''}${m.drift_detected?'<span class="badge drift">DRIFT</span>':''}</h3>`;
   h+=`<div class="metric"><span class="label">AUC-ROC</span><span class="value ${aucClass}">${auc}</span></div>`;
   h+=`<div class="metric"><span class="label">F1</span><span class="value">${m.val_f1?m.val_f1.toFixed(4):'N/A'}</span></div>`;
   h+=`<div class="metric"><span class="label">Parameters</span><span class="value">${m.parameters?m.parameters.toLocaleString():'N/A'}</span></div>`;
   h+=`<div class="metric"><span class="label">Weight Size</span><span class="value">${m.weight_size_kb} KB</span></div>`;
   h+=`<div class="metric"><span class="label">Epochs</span><span class="value">${m.epochs_trained||'N/A'}</span></div>`;
   if(m.drift_features>0)h+=`<div class="metric"><span class="label">Drifted Features</span><span class="value bad">${m.drift_features}</span></div>`;
   h+=`</div>`;
  }
  h+='</div>';
  if(d.active_alerts.length>0){
   h+='<h2>Active Alerts</h2>';
   for(const a of d.active_alerts){
    h+=`<div class="alert ${a.severity}"><strong>${a.model_name}</strong>: ${a.message}<div class="timestamp">${a.timestamp}</div></div>`;
   }
  }
  document.getElementById('status').innerHTML=h;
 }catch(e){document.getElementById('status').innerHTML='<p class="bad">Failed to load: '+e+'</p>'}
}
load();setInterval(load,30000);
</script>
</body>
</html>"""


class MonitoringHandler(BaseHTTPRequestHandler):
    """HTTP handler for monitoring endpoints."""

    def log_message(self, format, *args):
        pass

    def _send_json(self, data: dict, status: int = 200):
        body = json.dumps(data, indent=2, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html: str, status: int = 200):
        body = html.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, text: str, status: int = 200):
        body = text.encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.rstrip("/")

        if path == "/monitoring/healthz":
            self._send_json({"status": "healthy"})

        elif path == "/monitoring/status":
            self._send_json(_state.get_status())

        elif path == "/monitoring/dashboard":
            self._send_html(DASHBOARD_HTML)

        elif path == "/monitoring/prometheus":
            self._send_prometheus_metrics()

        elif path.startswith("/monitoring/models/"):
            parts = path.split("/")
            if len(parts) >= 5:
                model_name = parts[3]
                action = parts[4]

                if action == "drift":
                    report = _state.drift_reports.get(model_name, {})
                    self._send_json(report if report else {"message": "No drift report"})
                elif action == "history":
                    self._send_model_history(model_name)
                elif action == "metrics":
                    metrics = _state.model_metrics.get(model_name, {})
                    self._send_json(metrics if metrics else {"message": "No metrics"})
                else:
                    self._send_json({"error": f"Unknown action: {action}"}, 404)
            else:
                self._send_json({"error": "Invalid path"}, 400)

        else:
            self._send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = self.path.rstrip("/")

        if path.startswith("/monitoring/trigger/"):
            model_name = path.split("/")[-1]
            self._trigger_retraining(model_name)
        else:
            self._send_json({"error": "Not found"}, 404)

    def _send_prometheus_metrics(self):
        """Prometheus-compatible metrics output."""
        lines = []
        lines.append("# HELP ml_model_auc_roc Model AUC-ROC score")
        lines.append("# TYPE ml_model_auc_roc gauge")
        for name, metrics in _state.model_metrics.items():
            auc = metrics.get("val_auc_roc")
            if auc is not None:
                lines.append(f'ml_model_auc_roc{{model="{name}"}} {auc}')

        lines.append("# HELP ml_model_f1 Model F1 score")
        lines.append("# TYPE ml_model_f1 gauge")
        for name, metrics in _state.model_metrics.items():
            f1 = metrics.get("val_f1")
            if f1 is not None:
                lines.append(f'ml_model_f1{{model="{name}"}} {f1}')

        lines.append("# HELP ml_model_parameters Model parameter count")
        lines.append("# TYPE ml_model_parameters gauge")
        for name, metrics in _state.model_metrics.items():
            params = metrics.get("parameters")
            if params is not None:
                lines.append(f'ml_model_parameters{{model="{name}"}} {params}')

        lines.append("# HELP ml_model_drift_detected Whether drift was detected")
        lines.append("# TYPE ml_model_drift_detected gauge")
        for name, report in _state.drift_reports.items():
            drifted = 1 if report.get("overall_drift_detected") else 0
            lines.append(f'ml_model_drift_detected{{model="{name}"}} {drifted}')

        lines.append("# HELP ml_model_weight_exists Whether production weight file exists")
        lines.append("# TYPE ml_model_weight_exists gauge")
        for name in ["fraud_detector", "credit_scorer", "anomaly_vae",
                      "churn_predictor", "gnn_fraud_ring", "aml_scorer"]:
            exists = 1 if (WEIGHTS_DIR / f"{name}.pt").exists() else 0
            lines.append(f'ml_model_weight_exists{{model="{name}"}} {exists}')

        lines.append("# HELP ml_alerts_active Number of active alerts")
        lines.append("# TYPE ml_alerts_active gauge")
        active = len([a for a in _state.alerts if not a["acknowledged"]])
        lines.append(f"ml_alerts_active {active}")

        self._send_text("\n".join(lines))

    def _send_model_history(self, model_name: str):
        """Get training history from Delta Lake or files."""
        try:
            from ml.training.lakehouse import LakehouseManager
            manager = LakehouseManager()
            history = manager.get_training_history(model_name)
            if not history.empty:
                self._send_json(history.to_dict(orient="records"))
                return
        except Exception:
            pass

        # Fallback to pipeline result files
        results = []
        for f in sorted(WEIGHTS_DIR.glob("ct_pipeline_*.json"), reverse=True)[:10]:
            try:
                with open(f) as fp:
                    data = json.load(fp)
                if model_name in data:
                    results.append(data[model_name])
            except Exception:
                pass

        self._send_json(results if results else {"message": "No history available"})

    def _trigger_retraining(self, model_name: str):
        """Trigger manual retraining."""
        valid_models = ["fraud_detector", "credit_scorer", "anomaly_vae",
                         "churn_predictor", "gnn_fraud_ring", "aml_scorer"]
        if model_name not in valid_models:
            self._send_json({"error": f"Unknown model: {model_name}"}, 400)
            return

        _state.add_alert(model_name, "manual_retrain",
                          f"Manual retraining triggered for {model_name}", "info")

        # Run in background thread
        def retrain():
            try:
                from ml.continuous_training.orchestrator import ContinuousTrainingOrchestrator
                orch = ContinuousTrainingOrchestrator()
                result = orch.run_retraining(model_name)
                if result.get("success"):
                    _state.add_alert(model_name, "retrain_complete",
                                      f"Retraining complete: AUC={result['metrics'].get('val_auc_roc', 'N/A')}",
                                      "info")
                else:
                    _state.add_alert(model_name, "retrain_failed",
                                      f"Retraining failed: {result.get('reason')}", "warning")
            except Exception as e:
                _state.add_alert(model_name, "retrain_error", str(e), "critical")

        t = threading.Thread(target=retrain, daemon=True)
        t.start()

        self._send_json({
            "status": "triggered",
            "model_name": model_name,
            "message": f"Retraining started in background for {model_name}",
        })


def start_monitoring_server(port: int = None):
    """Start the monitoring HTTP server."""
    port = port or int(os.environ.get("MONITORING_PORT", 8501))
    server = HTTPServer(("0.0.0.0", port), MonitoringHandler)
    logger.info(f"ML Monitoring server starting on :{port}")
    print(f"ML Monitoring dashboard: http://localhost:{port}/monitoring/dashboard")
    print(f"Prometheus metrics:      http://localhost:{port}/monitoring/prometheus")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


import os

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    start_monitoring_server()
