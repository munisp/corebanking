"""biometric-service — API handlers."""
import json
from http.server import BaseHTTPRequestHandler

_FACE_MATCHES = [
    {"id": "FM-001", "sessionId": "SES-A001", "customerId": "CUST-001", "customerName": "Fatima Abdullahi", "similarityScore": 0.942, "threshold": 0.65, "matched": True, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.96, "glassesDetected": False, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 145, "createdAt": "2026-05-09T10:30:00Z"},
    {"id": "FM-002", "sessionId": "SES-A002", "customerId": "CUST-002", "customerName": "Ibrahim Musa", "similarityScore": 0.871, "threshold": 0.65, "matched": True, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.91, "glassesDetected": True, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 158, "createdAt": "2026-05-09T11:00:00Z"},
    {"id": "FM-003", "sessionId": "SES-A003", "customerId": "CUST-003", "customerName": "Grace Okafor", "similarityScore": 0.412, "threshold": 0.65, "matched": False, "model": "arcface-r100", "embeddingDim": 512, "faceQualityScore": 0.78, "glassesDetected": False, "maskDetected": False, "landmarksDetected": 68, "processingTimeMs": 142, "createdAt": "2026-05-09T12:00:00Z"},
]

_LIVENESS_CHECKS = [
    {"id": "LIV-001", "sessionId": "SES-L001", "customerId": "CUST-001", "method": "challenge_response", "overallScore": 0.96, "passed": True, "challengeType": "blink_left_eye", "challengeResponseCorrect": True, "deepfakeProbability": 0.02, "spoofTypeDetected": None, "processingTimeMs": 2145, "createdAt": "2026-05-09T10:29:00Z"},
    {"id": "LIV-002", "sessionId": "SES-L002", "customerId": "CUST-003", "method": "passive_3d", "overallScore": 0.28, "passed": False, "challengeType": "smile", "challengeResponseCorrect": False, "deepfakeProbability": 0.0, "spoofTypeDetected": "printed_photo", "processingTimeMs": 512, "createdAt": "2026-05-09T12:05:00Z"},
]

_LIVENESS_METHODS = [
    {"name": "passive_3d", "weight": 0.25, "latencyMs": 45, "description": "Single-frame micro-texture and monocular depth analysis."},
    {"name": "texture_analysis", "weight": 0.20, "latencyMs": 35, "description": "Fourier transform + wavelet decomposition to detect Moiré patterns."},
    {"name": "depth_estimation", "weight": 0.15, "latencyMs": 55, "description": "MiDaS-based monocular depth estimation."},
    {"name": "challenge_response", "weight": 0.20, "latencyMs": 2000, "description": "Interactive prompts — blink, smile, head turn, nod."},
    {"name": "deepfake_detection", "weight": 0.20, "latencyMs": 65, "description": "GAN artifact detection, face-swap boundary detection."},
]


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/healthz":
            self._send_json(200, {"status": "ok", "service": "biometric-service", "capabilities": ["face-match", "liveness-detection"]})

        elif path == "/v1/face/matches":
            self._send_json(200, {"items": _FACE_MATCHES, "total": len(_FACE_MATCHES)})

        elif path.startswith("/v1/face/matches/"):
            mid = path[len("/v1/face/matches/"):]
            item = next((m for m in _FACE_MATCHES if m["id"] == mid), None)
            if item:
                self._send_json(200, item)
            else:
                self._send_json(404, {"error": "not found"})

        elif path == "/v1/face/stats":
            total = len(_FACE_MATCHES)
            matched = sum(1 for m in _FACE_MATCHES if m["matched"])
            avg_sim = sum(m["similarityScore"] for m in _FACE_MATCHES) / total if total else 0
            self._send_json(200, {
                "totalComparisons": total, "matched": matched, "mismatched": total - matched,
                "matchRatePct": round(matched / total * 100, 1) if total else 0,
                "avgSimilarityScore": round(avg_sim, 3),
                "model": "arcface-r100", "threshold": 0.65,
            })

        elif path == "/v1/liveness/checks":
            self._send_json(200, {"items": _LIVENESS_CHECKS, "total": len(_LIVENESS_CHECKS)})

        elif path.startswith("/v1/liveness/checks/"):
            cid = path[len("/v1/liveness/checks/"):]
            item = next((c for c in _LIVENESS_CHECKS if c["id"] == cid), None)
            if item:
                self._send_json(200, item)
            else:
                self._send_json(404, {"error": "not found"})

        elif path == "/v1/liveness/methods":
            self._send_json(200, {"methods": _LIVENESS_METHODS, "ensembleThreshold": 0.85, "ibetaCompliance": "Level 2"})

        elif path == "/v1/liveness/stats":
            total = len(_LIVENESS_CHECKS)
            passed = sum(1 for c in _LIVENESS_CHECKS if c["passed"])
            avg_score = sum(c["overallScore"] for c in _LIVENESS_CHECKS) / total if total else 0
            avg_deepfake = sum(c["deepfakeProbability"] for c in _LIVENESS_CHECKS) / total if total else 0
            self._send_json(200, {
                "totalChecks": total, "passed": passed, "failed": total - passed,
                "passRatePct": round(passed / total * 100, 1) if total else 0,
                "avgLivenessScore": round(avg_score, 3),
                "avgDeepfakeProbability": round(avg_deepfake, 3),
            })

        else:
            self._send_json(404, {"error": "not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def log_message(self, fmt, *args):
        pass
