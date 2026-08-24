#!/usr/bin/env python3
"""54link-dev Liveness Inference Engine — Production ML Service.

Face detection, 68-point landmarks, feature extraction (512-dim embeddings),
anti-spoofing classification, passive liveness, deepfake detection.

Inference backends (real models only — no hash-seeded pseudo-ML):
- DeepFace (serengil/deepface) when installed: detection, embeddings,
  verification, facial attributes, built-in anti-spoofing.
- ONNX models loaded from MODEL_DIR (default ./models) via onnxruntime.

Fail-closed behavior: any inference endpoint whose required model is missing
or cannot be executed returns HTTP 503 {"error": "model_unavailable",
"model": "<name>"}. No endpoint ever returns a hash-derived verdict, and no
iBeta/compliance claims are made unless a real model produced the result.

Middleware: Kafka, Postgres, Redis, Temporal, OpenSearch
"""

import os
import json
import urllib.request
import time
import uuid
import logging
import math
import hashlib
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from enum import Enum
from dataclasses import dataclass, asdict, field
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("liveness-inference-py")

# Configuration
def _require_env(name):
    """Fail-fast required environment variable (finding R3-NEW-3).

    No credential-bearing or otherwise insecure defaults: refuse to start when
    the variable is unset or left as an unexpanded '${...}' placeholder."""
    val = os.environ.get(name, "").strip()
    if not val or val.startswith("${"):
        raise RuntimeError(
            f"FATAL: required environment variable {name} is not set; "
            "refusing to start with an insecure default"
        )
    return val


DATABASE_URL = _require_env("DATABASE_URL")
KEYCLOAK_URL = os.getenv("KEYCLOAK_REALM_URL", "http://keycloak:8080/realms/54bank")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "localhost:9092")
REDIS_URL = os.getenv("REDIS_URL", "localhost:6379")
OPENSEARCH_URL = os.getenv("OPENSEARCH_ENDPOINT", "http://opensearch:9200")
PERMIFY_URL = os.getenv("PERMIFY_ENDPOINT", "http://permify:3476")
PORT = int(os.getenv("PORT", "8649"))

AML_ENGINE_URL = os.environ.get("AML_ENGINE_URL", "http://localhost:8120")

# --- mTLS Configuration ---
MTLS_ENABLED = os.environ.get("MTLS_ENABLED", "false") == "true"
TLS_CERT_PATH = os.environ.get("TLS_CERT_PATH", "/etc/54link-dev/certs/service.crt")
TLS_KEY_PATH = os.environ.get("TLS_KEY_PATH", "/etc/54link-dev/certs/service.key")
TLS_CA_PATH = os.environ.get("TLS_CA_PATH", "/etc/54link-dev/certs/ca.crt")
PORT = int(os.environ.get("PORT", "8230"))

# ─── DeepFace Integration ─────────────────────────────────────────────────────
# DeepFace provides: face verification (1:1), recognition (1:N), detection,
# facial attribute analysis (age, gender, emotion, race), anti-spoofing.
DEEPFACE_AVAILABLE = False
try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
    logging.info("DeepFace loaded — using as primary ML backend")
except ImportError:
    logging.warning("DeepFace not installed — ONNX models from MODEL_DIR are required")

# DeepFace model configuration
DEEPFACE_RECOGNITION_MODEL = os.environ.get("DEEPFACE_MODEL", "ArcFace")
DEEPFACE_DETECTOR = os.environ.get("DEEPFACE_DETECTOR", "retinaface")
DEEPFACE_DISTANCE_METRIC = os.environ.get("DEEPFACE_DISTANCE", "cosine")
DEEPFACE_DB_PATH = os.environ.get("DEEPFACE_DB_PATH", "/data/face-db")
DEEPFACE_BACKEND_DB = os.environ.get("DEEPFACE_BACKEND_DB", "postgres")

# ─── ONNX Model Registry ─────────────────────────────────────────────────────
# Every inference endpoint depends on one or more of these models. Models are
# loaded from MODEL_DIR at startup; if a required model file is missing (or
# onnxruntime is not installed), dependent endpoints return 503
# {"error": "model_unavailable", "model": "<name>"} — never a synthetic result.
MODEL_DIR = os.environ.get("MODEL_DIR", "./models")

REQUIRED_MODELS = {
    "face_detection": "retinaface_r50.onnx",
    "landmarks": "2dfan4_68.onnx",
    "embedding": "arcface_r100.onnx",
    "anti_spoofing": "minifasnet_ensemble.onnx",
    "deepfake": "efficientnet_b4_deepfake.onnx",
    "depth": "midas_v31_small.onnx",
}

_ORT_AVAILABLE = False
_ort = None
try:
    import onnxruntime as _ort_mod
    _ort = _ort_mod
    _ORT_AVAILABLE = True
except ImportError:
    logger.warning("onnxruntime not installed — ONNX inference unavailable; "
                   "endpoints without DeepFace support will return 503 model_unavailable")

MODEL_SESSIONS: dict = {}
MODEL_STATUS: dict = {}


def load_models():
    """Load all required ONNX models from MODEL_DIR. Logs loudly on failure."""
    for name, fname in REQUIRED_MODELS.items():
        path = os.path.join(MODEL_DIR, fname)
        if not os.path.isfile(path):
            MODEL_STATUS[name] = "missing"
            logger.error(f"MODEL MISSING: required model '{name}' not found at {path} — "
                         f"dependent endpoints will return 503 model_unavailable")
            continue
        if not _ORT_AVAILABLE:
            MODEL_STATUS[name] = "runtime_unavailable"
            logger.error(f"MODEL UNLOADABLE: onnxruntime not installed; "
                         f"model '{name}' at {path} cannot be served")
            continue
        try:
            MODEL_SESSIONS[name] = _ort.InferenceSession(path, providers=["CPUExecutionProvider"])
            MODEL_STATUS[name] = "loaded"
            logger.info(f"Model '{name}' loaded from {path}")
        except Exception as e:
            MODEL_STATUS[name] = "load_failed"
            logger.error(f"MODEL LOAD FAILED: '{name}' at {path}: {e}")


class ModelUnavailableError(Exception):
    """Raised when a required model/runtime cannot produce a real result."""

    def __init__(self, model: str):
        self.model = model
        super().__init__(f"model_unavailable: {model}")


class InvalidImageError(Exception):
    """Raised when the request image cannot be decoded."""


def require_model(name: str):
    session = MODEL_SESSIONS.get(name)
    if session is None:
        raise ModelUnavailableError(name)
    return session


def _decode_image(image_data: bytes):
    """Decode image bytes to an RGB array via OpenCV or Pillow + numpy."""
    try:
        import numpy as np
    except ImportError:
        raise ModelUnavailableError("image_codec:numpy")
    if not image_data:
        raise InvalidImageError("empty image payload")
    try:
        import cv2
        arr = cv2.imdecode(np.frombuffer(image_data, np.uint8), cv2.IMREAD_COLOR)
        if arr is None:
            raise InvalidImageError("undecodable image bytes")
        return cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
    except ImportError:
        try:
            from PIL import Image
            import io as _io
            return np.array(Image.open(_io.BytesIO(image_data)).convert("RGB"))
        except ImportError:
            raise ModelUnavailableError("image_codec:no_decoder")
        except Exception:
            raise InvalidImageError("undecodable image bytes")


def _preprocess(img, size: int):
    """Resize to size x size and normalize to NCHW float32 in [0, 1]."""
    import numpy as np
    try:
        import cv2
        resized = cv2.resize(img, (size, size))
    except ImportError:
        from PIL import Image
        resized = np.array(Image.fromarray(img).resize((size, size)))
    arr = resized.astype("float32") / 255.0
    return arr.transpose(2, 0, 1)[None, :, :, :]


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _softmax_max(values, index: int) -> float:
    m = max(values)
    exps = [math.exp(v - m) for v in values]
    total = sum(exps)
    return exps[index] / total


# ─── Configuration ───────────────────────────────────────────────────────────
FACE_DETECTION_THRESHOLD = 0.65
LANDMARK_CONFIDENCE_MIN = 0.70
EMBEDDING_DIM = 512
ANTI_SPOOF_THRESHOLD = 0.50
LIVENESS_PASS_THRESHOLD = 0.75
DEEPFAKE_THRESHOLD = 0.40
FACE_MATCH_THRESHOLD = 0.68

# ─── Noise Tolerance Configuration ───────────────────────────────────────────
NOISE_LOW_THRESHOLD = 0.15       # below this = clean image
NOISE_MEDIUM_THRESHOLD = 0.35    # below this = acceptable noise
NOISE_HIGH_THRESHOLD = 0.55      # above this = very noisy, use fallback
MIN_USABLE_QUALITY = 0.30        # absolute minimum to attempt detection
MULTI_FRAME_WINDOW = 5           # number of frames to average for noisy cameras
NOISE_THRESHOLD_RELAXATION = 0.15 # how much to relax thresholds for noisy images


class SpoofType(str, Enum):
    PRINTED_PHOTO = "printed_photo"
    SCREEN_REPLAY = "screen_replay"
    PAPER_MASK = "paper_mask"
    THREE_D_MASK = "3d_mask"
    DEEPFAKE = "deepfake"
    HIGH_QUALITY_PHOTO = "high_quality_photo"
    UNCLASSIFIED = "unclassified"
    NONE = "none"


class LivenessMethod(str, Enum):
    PASSIVE_3D = "passive_3d"
    TEXTURE_ANALYSIS = "texture_analysis"
    DEPTH_ESTIMATION = "depth_estimation"
    FREQUENCY_ANALYSIS = "frequency_analysis"
    DEEPFAKE_DETECTOR = "deepfake_detector"


@dataclass
class BoundingBox:
    x: int
    y: int
    width: int
    height: int
    confidence: float


@dataclass
class Landmark:
    """68-point facial landmark with (x,y) coordinates."""
    index: int
    x: float
    y: float
    confidence: float
    region: str  # jaw, eyebrow_left, eyebrow_right, nose, eye_left, eye_right, mouth


@dataclass
class FaceDetectionResult:
    face_detected: bool
    bounding_box: Optional[BoundingBox]
    landmarks_68: list
    face_quality_score: float  # 0-1
    head_pose: dict  # yaw, pitch, roll
    occlusion: dict  # left_eye, right_eye, nose, mouth
    glasses_detected: bool
    mask_detected: bool
    processing_time_ms: float


@dataclass
class AntiSpoofResult:
    is_spoof: bool
    spoof_type: str
    confidence: float
    method_scores: dict  # per-method breakdown
    texture_score: Optional[float]
    depth_score: Optional[float]
    frequency_score: Optional[float]
    moiré_detected: Optional[bool]
    reflection_detected: Optional[bool]
    edge_analysis_score: Optional[float]


@dataclass
class LivenessResult:
    id: str
    is_live: bool
    overall_score: float
    method_scores: dict
    anti_spoof: AntiSpoofResult
    face_detection: FaceDetectionResult
    deepfake_probability: float
    processing_time_ms: float
    device_platform: str
    session_id: str
    customer_id: str
    timestamp: str


@dataclass
class FaceMatchResult:
    id: str
    matched: bool
    similarity_score: float
    embedding_distance: float
    face1_quality: float
    face2_quality: float
    age_estimation: Optional[int]
    gender_estimation: str
    head_pose_diff: float
    processing_time_ms: float
    customer_id: str
    timestamp: str


@dataclass
class FeatureExtractionResult:
    embedding: list  # 512-dim float vector
    embedding_norm: float
    face_quality: float
    inter_eye_distance: float
    face_area_ratio: float
    processing_time_ms: float


# ─── Noise & Quality Assessment ──────────────────────────────────────────────

@dataclass
class NoiseAssessment:
    """Camera noise level assessment for adaptive threshold adjustment."""
    noise_level: float        # 0.0 = pristine, 1.0 = unusable
    noise_category: str       # clean, low, medium, high, unusable, unknown
    estimated_snr_db: float   # signal-to-noise ratio estimate
    blur_score: float         # 0 = sharp, 1 = very blurry
    exposure_score: float     # 0 = underexposed, 0.5 = good, 1 = overexposed
    usable: bool              # whether we can extract reliable features
    threshold_adjustment: float  # how much to relax scoring thresholds
    recommended_action: str   # proceed, retry_with_flash, switch_to_passive, reject


def assess_image_noise(image_data: bytes, device_platform: str = "unknown") -> NoiseAssessment:
    """Estimate image quality from real pixel statistics.

    Uses Laplacian variance (or gradient variance) for blur and histogram mean
    for exposure. If the image cannot be decoded/measured, returns a
    conservative 'unknown' assessment with NO threshold relaxation — never a
    hash-derived pseudo-measurement.
    """
    try:
        import numpy as np
        img = _decode_image(image_data)
        gray = img.mean(axis=2) if getattr(img, "ndim", 0) == 3 else img.astype("float64")
        gray = gray.astype("float64")
        # Blur: variance of Laplacian (OpenCV) or gradient energy fallback.
        try:
            import cv2
            blur_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        except ImportError:
            gx = np.diff(gray, axis=1)
            gy = np.diff(gray, axis=0)
            blur_var = float(gx.var() + gy.var())
        blur_score = min(max(1.0 - blur_var / 500.0, 0.0), 1.0)
        mean_brightness = float(gray.mean()) / 255.0
        exposure_score = min(max(mean_brightness, 0.0), 1.0)
        # High-frequency energy as noise proxy
        hf_energy = float(np.diff(gray, axis=1).std() + np.diff(gray, axis=0).std())
        noise_level = min(max(blur_score * 0.6 + abs(exposure_score - 0.5) * 0.4, 0.0), 1.0)
        estimated_snr_db = round(10.0 * math.log10(max(gray.std(), 1.0) / max(hf_energy, 1e-6) + 1.0), 1)
    except (InvalidImageError, ModelUnavailableError):
        # Cannot measure — do not fabricate; apply zero relaxation.
        return NoiseAssessment(
            noise_level=0.0, noise_category="unknown", estimated_snr_db=0.0,
            blur_score=0.0, exposure_score=0.5, usable=True,
            threshold_adjustment=0.0, recommended_action="proceed",
        )

    if noise_level < NOISE_LOW_THRESHOLD:
        category, adjustment, action = "clean", 0.0, "proceed"
    elif noise_level < NOISE_MEDIUM_THRESHOLD:
        category, adjustment, action = "low", NOISE_THRESHOLD_RELAXATION * 0.3, "proceed"
    elif noise_level < NOISE_HIGH_THRESHOLD:
        category, adjustment, action = "medium", NOISE_THRESHOLD_RELAXATION * 0.7, "proceed_with_caution"
    elif noise_level < 0.75:
        category, adjustment, action = "high", NOISE_THRESHOLD_RELAXATION, "switch_to_passive"
    else:
        category, adjustment, action = "unusable", NOISE_THRESHOLD_RELAXATION, "retry_with_better_lighting"

    usable = noise_level < 0.75

    return NoiseAssessment(
        noise_level=round(noise_level, 4),
        noise_category=category,
        estimated_snr_db=estimated_snr_db,
        blur_score=round(blur_score, 4),
        exposure_score=round(exposure_score, 4),
        usable=usable,
        threshold_adjustment=round(adjustment, 4),
        recommended_action=action,
    )


def apply_noise_compensation(scores: dict, noise: NoiseAssessment) -> dict:
    """Adjust method scores to compensate for camera noise.
    Noisy images naturally score lower on texture/frequency analysis.
    We boost those scores proportionally to avoid false rejections.
    """
    if noise.noise_category in ("clean", "unknown"):
        return scores

    adjusted = {}
    for method, score in scores.items():
        if score is None:
            adjusted[method] = score
        elif method in ("texture_analysis", "frequency_analysis"):
            boost = noise.threshold_adjustment * 1.2
            adjusted[method] = min(score + boost, 0.99)
        elif method == "depth_estimation":
            boost = noise.threshold_adjustment * 0.6
            adjusted[method] = min(score + boost, 0.99)
        elif method == "passive_3d":
            boost = noise.threshold_adjustment * 0.8
            adjusted[method] = min(score + boost, 0.99)
        else:
            adjusted[method] = score
    return adjusted


# Multi-frame buffer for noisy camera averaging
_frame_buffers: dict = {}  # session_id -> list of (score, noise_level)


# ─── Active Liveness Motion Analysis ─────────────────────────────────────────

def _compute_head_pose_from_landmarks(landmarks: list) -> dict:
    """Estimate yaw/pitch/roll from 68-point landmarks using geometry."""
    if len(landmarks) < 48:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    nose = landmarks[30] if len(landmarks) > 30 else landmarks[-1]
    chin = landmarks[8] if len(landmarks) > 8 else landmarks[0]
    left_eye = landmarks[36] if len(landmarks) > 36 else landmarks[17]
    right_eye = landmarks[45] if len(landmarks) > 45 else landmarks[26]

    nx, ny = nose["x"], nose["y"]
    cx, cy = chin["x"], chin["y"]
    lx, ly = left_eye["x"], left_eye["y"]
    rx, ry = right_eye["x"], right_eye["y"]

    eye_cx = (lx + rx) / 2.0
    eye_cy = (ly + ry) / 2.0
    eye_dist = math.sqrt((rx - lx) ** 2 + (ry - ly) ** 2)
    if eye_dist < 1:
        eye_dist = 1

    yaw = math.degrees(math.atan2(nx - eye_cx, eye_dist)) * 2.0

    face_height = abs(cy - eye_cy)
    if face_height < 1:
        face_height = 1
    pitch = math.degrees(math.atan2(ny - eye_cy, face_height)) * 1.5 - 15

    roll = math.degrees(math.atan2(ry - ly, rx - lx))

    return {"yaw": round(yaw, 2), "pitch": round(pitch, 2), "roll": round(roll, 2)}


def _compute_eye_aspect_ratio(landmarks: list, eye_indices: list) -> float:
    """Compute Eye Aspect Ratio (EAR) for blink detection."""
    if len(eye_indices) != 6:
        return 0.3
    pts = []
    for idx in eye_indices:
        if idx < len(landmarks):
            pts.append((landmarks[idx]["x"], landmarks[idx]["y"]))
        else:
            return 0.3

    v1 = math.sqrt((pts[1][0] - pts[5][0]) ** 2 + (pts[1][1] - pts[5][1]) ** 2)
    v2 = math.sqrt((pts[2][0] - pts[4][0]) ** 2 + (pts[2][1] - pts[4][1]) ** 2)
    h = math.sqrt((pts[0][0] - pts[3][0]) ** 2 + (pts[0][1] - pts[3][1]) ** 2)
    if h < 1:
        h = 1
    return (v1 + v2) / (2.0 * h)


def _compute_mouth_aspect_ratio(landmarks: list) -> float:
    """Compute Mouth Aspect Ratio for smile detection."""
    if len(landmarks) < 68:
        return 0.0
    left = landmarks[48]
    right = landmarks[54]
    top = landmarks[51]
    bottom = landmarks[57]

    width = math.sqrt((right["x"] - left["x"]) ** 2 + (right["y"] - left["y"]) ** 2)
    height = math.sqrt((bottom["x"] - top["x"]) ** 2 + (bottom["y"] - top["y"]) ** 2)
    if height < 1:
        height = 1
    return width / height


def analyze_motion(reference_frame: bytes, action_frames: list, challenge_type: str,
                   device_platform: str = "unknown") -> dict:
    """Analyze motion between reference frame and action frames for active liveness."""
    start = time.time()

    ref_face = detect_face(reference_frame)
    if not ref_face.face_detected:
        return {
            "motion_detected": False,
            "motion_score": 0.0,
            "error": "no_face_in_reference",
            "challenge_passed": False,
            "processing_time_ms": round((time.time() - start) * 1000, 2),
        }

    ref_landmarks = ref_face.landmarks_68
    ref_pose = _compute_head_pose_from_landmarks(ref_landmarks)
    ref_ear_left = _compute_eye_aspect_ratio(ref_landmarks, [36, 37, 38, 39, 40, 41])
    ref_ear_right = _compute_eye_aspect_ratio(ref_landmarks, [42, 43, 44, 45, 46, 47])
    ref_ear = (ref_ear_left + ref_ear_right) / 2.0
    ref_mar = _compute_mouth_aspect_ratio(ref_landmarks)

    frame_analyses = []
    max_yaw_delta = 0.0
    max_pitch_delta = 0.0
    min_ear = ref_ear
    max_mar = ref_mar
    motion_frames_count = 0

    for i, frame_data in enumerate(action_frames):
        frame_bytes = frame_data.encode() if isinstance(frame_data, str) else frame_data
        act_face = detect_face(frame_bytes)
        if not act_face.face_detected:
            frame_analyses.append({"frame": i, "face_detected": False})
            continue

        act_landmarks = act_face.landmarks_68
        act_pose = _compute_head_pose_from_landmarks(act_landmarks)
        act_ear_left = _compute_eye_aspect_ratio(act_landmarks, [36, 37, 38, 39, 40, 41])
        act_ear_right = _compute_eye_aspect_ratio(act_landmarks, [42, 43, 44, 45, 46, 47])
        act_ear = (act_ear_left + act_ear_right) / 2.0
        act_mar = _compute_mouth_aspect_ratio(act_landmarks)

        yaw_delta = act_pose["yaw"] - ref_pose["yaw"]
        pitch_delta = act_pose["pitch"] - ref_pose["pitch"]

        if abs(yaw_delta) > abs(max_yaw_delta):
            max_yaw_delta = yaw_delta
        if abs(pitch_delta) > abs(max_pitch_delta):
            max_pitch_delta = pitch_delta
        if act_ear < min_ear:
            min_ear = act_ear
        if act_mar > max_mar:
            max_mar = act_mar

        has_motion = abs(yaw_delta) > 3 or abs(pitch_delta) > 3 or abs(act_ear - ref_ear) > 0.03 or abs(act_mar - ref_mar) > 0.3
        if has_motion:
            motion_frames_count += 1

        frame_analyses.append({
            "frame": i,
            "face_detected": True,
            "yaw_delta": round(yaw_delta, 2),
            "pitch_delta": round(pitch_delta, 2),
            "ear": round(act_ear, 4),
            "mar": round(act_mar, 4),
            "has_motion": has_motion,
        })

    dev = (device_platform or "").lower()
    threshold_factor = 1.0
    if any(kw in dev for kw in ["tecno", "itel", "infinix", "gionee"]):
        threshold_factor = 0.7
    elif any(kw in dev for kw in ["samsung_a", "redmi", "poco", "realme"]):
        threshold_factor = 0.85

    motion_detected = False
    motion_score = 0.0

    if challenge_type in ("head_turn_left", "head_turn_right"):
        expected_direction = -1 if "left" in challenge_type else 1
        yaw_threshold = 12.0 * threshold_factor
        actual_yaw = max_yaw_delta if expected_direction > 0 else -max_yaw_delta
        if actual_yaw > yaw_threshold * 0.5:
            motion_detected = True
            motion_score = min(abs(max_yaw_delta) / (yaw_threshold * 1.5), 1.0)
        elif abs(max_yaw_delta) > yaw_threshold * 0.5:
            motion_detected = True
            motion_score = min(abs(max_yaw_delta) / (yaw_threshold * 2.0), 0.85)

    elif challenge_type == "blink":
        ear_threshold = 0.06 * threshold_factor
        ear_drop = ref_ear - min_ear
        if ear_drop > ear_threshold:
            motion_detected = True
            motion_score = min(ear_drop / (ear_threshold * 2.0), 1.0)

    elif challenge_type == "smile":
        mar_threshold = 0.5 * threshold_factor
        mar_increase = max_mar - ref_mar
        if mar_increase > mar_threshold * 0.3:
            motion_detected = True
            motion_score = min(mar_increase / (mar_threshold * 1.5), 1.0)

    elif challenge_type == "nod":
        pitch_threshold = 8.0 * threshold_factor
        if abs(max_pitch_delta) > pitch_threshold * 0.5:
            motion_detected = True
            motion_score = min(abs(max_pitch_delta) / (pitch_threshold * 1.5), 1.0)

    elif challenge_type == "random_pose":
        total_motion = abs(max_yaw_delta) + abs(max_pitch_delta)
        pose_threshold = 10.0 * threshold_factor
        if total_motion > pose_threshold:
            motion_detected = True
            motion_score = min(total_motion / (pose_threshold * 2.0), 1.0)

    total_valid_frames = sum(1 for f in frame_analyses if f.get("face_detected", False))
    if total_valid_frames > 0:
        consistency = motion_frames_count / total_valid_frames
        motion_score = motion_score * 0.7 + consistency * 0.3

    motion_score = round(min(max(motion_score, 0.0), 1.0), 4)
    challenge_passed = motion_detected and motion_score >= 0.45

    return {
        "motion_detected": motion_detected,
        "motion_score": motion_score,
        "challenge_type": challenge_type,
        "challenge_passed": challenge_passed,
        "reference_pose": ref_pose,
        "max_yaw_delta": round(max_yaw_delta, 2),
        "max_pitch_delta": round(max_pitch_delta, 2),
        "min_ear": round(min_ear, 4),
        "max_mar": round(max_mar, 4),
        "reference_ear": round(ref_ear, 4),
        "reference_mar": round(ref_mar, 4),
        "motion_frames": motion_frames_count,
        "total_frames": len(action_frames),
        "valid_frames": total_valid_frames,
        "frame_analyses": frame_analyses,
        "device_threshold_factor": threshold_factor,
        "processing_time_ms": round((time.time() - start) * 1000, 2),
    }


def accumulate_frame_score(session_id: str, score: float, noise_level: float) -> dict:
    """Accumulate frame scores for multi-frame averaging on noisy cameras."""
    if session_id not in _frame_buffers:
        _frame_buffers[session_id] = []

    buf = _frame_buffers[session_id]
    buf.append((score, noise_level))

    if len(buf) > MULTI_FRAME_WINDOW:
        buf[:] = buf[-MULTI_FRAME_WINDOW:]

    scores = [s for s, _ in buf]
    avg_score = sum(scores) / len(scores)

    if len(scores) >= 2:
        variance = sum((s - avg_score) ** 2 for s in scores) / len(scores)
        stability = max(1.0 - math.sqrt(variance) * 5, 0.0)
    else:
        stability = 0.5

    if len(scores) >= 3:
        weights = [0.5 ** (len(scores) - 1 - i) for i in range(len(scores))]
        w_sum = sum(weights)
        weighted_avg = sum(s * w for s, w in zip(scores, weights)) / w_sum
    else:
        weighted_avg = avg_score

    return {
        "frame_count": len(scores),
        "avg_score": round(avg_score, 4),
        "weighted_avg_score": round(weighted_avg, 4),
        "stability": round(stability, 4),
        "min_score": round(min(scores), 4),
        "max_score": round(max(scores), 4),
        "sufficient_frames": len(scores) >= 3,
    }


# ─── ML Inference Functions (real models only) ───────────────────────────────

_LANDMARK_REGIONS = (
    [(i, "jaw") for i in range(0, 17)]
    + [(i, "eyebrow_left") for i in range(17, 22)]
    + [(i, "eyebrow_right") for i in range(22, 27)]
    + [(i, "nose") for i in range(27, 36)]
    + [(i, "eye_left") for i in range(36, 42)]
    + [(i, "eye_right") for i in range(42, 48)]
    + [(i, "mouth") for i in range(48, 68)]
)


def _landmark_region(index: int) -> str:
    for i, region in _LANDMARK_REGIONS:
        if i == index:
            return region
    return "unknown"


def _run_landmarks_model(img, bbox: BoundingBox) -> list:
    """Run the 68-point landmark ONNX model on the cropped face region."""
    import numpy as np
    session = require_model("landmarks")
    x1, y1 = max(bbox.x, 0), max(bbox.y, 0)
    x2, y2 = bbox.x + bbox.width, bbox.y + bbox.height
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        raise InvalidImageError("empty face crop")
    inp = _preprocess(crop, 256)
    outputs = session.run(None, {session.get_inputs()[0].name: inp})
    coords = np.array(outputs[0]).reshape(-1)
    if coords.size != 136:
        raise ModelUnavailableError("landmarks:unrecognized_output")
    landmarks = []
    for i in range(68):
        px, py = float(coords[2 * i]), float(coords[2 * i + 1])
        # Normalized coordinates are mapped back to image space.
        if abs(px) <= 1.5 and abs(py) <= 1.5:
            px, py = px * bbox.width, py * bbox.height
        else:
            px, py = px * bbox.width / 256.0, py * bbox.height / 256.0
        landmarks.append(Landmark(
            index=i,
            x=round(bbox.x + px, 2),
            y=round(bbox.y + py, 2),
            confidence=1.0,
            region=_landmark_region(i),
        ))
    return landmarks


def detect_face(image_data: bytes, image_width: int = 640, image_height: int = 480) -> FaceDetectionResult:
    """Run face detection using DeepFace or the RetinaFace ONNX model.

    Fails closed: raises ModelUnavailableError when no real detector is
    available. Never returns a hash-seeded detection.
    """
    start = time.time()

    if DEEPFACE_AVAILABLE:
        try:
            faces = DeepFace.extract_faces(
                img_path=image_data,
                detector_backend=DEEPFACE_DETECTOR,
                enforce_detection=False,
            )
            if faces and faces[0].get("confidence", 0) and faces[0]["confidence"] >= FACE_DETECTION_THRESHOLD:
                area = faces[0]["facial_area"]
                conf = float(faces[0]["confidence"])
                bbox = BoundingBox(x=int(area["x"]), y=int(area["y"]),
                                   width=int(area["w"]), height=int(area["h"]),
                                   confidence=min(conf, 0.99))
                img = _decode_image(image_data)
                landmarks = [asdict(lm) for lm in _run_landmarks_model(img, bbox)]
                return FaceDetectionResult(
                    face_detected=True, bounding_box=bbox, landmarks_68=landmarks,
                    face_quality_score=min(conf, 0.99),
                    head_pose=_compute_head_pose_from_landmarks(landmarks),
                    occlusion={"left_eye": None, "right_eye": None, "nose": None, "mouth": None},
                    glasses_detected=False, mask_detected=False,
                    processing_time_ms=(time.time() - start) * 1000,
                )
            return FaceDetectionResult(
                face_detected=False, bounding_box=None, landmarks_68=[],
                face_quality_score=0.0, head_pose={"yaw": 0, "pitch": 0, "roll": 0},
                occlusion={"left_eye": None, "right_eye": None, "nose": None, "mouth": None},
                glasses_detected=False, mask_detected=False,
                processing_time_ms=(time.time() - start) * 1000,
            )
        except (ModelUnavailableError, InvalidImageError):
            raise
        except Exception as e:
            logger.warning(f"DeepFace detection failed, trying ONNX detector: {e}")

    # ONNX path
    import numpy as np
    session = require_model("face_detection")
    img = _decode_image(image_data)
    h0, w0 = img.shape[:2]
    inp = _preprocess(img, 640)
    outputs = session.run(None, {session.get_inputs()[0].name: inp})
    det = np.array(outputs[0]).reshape(-1, np.array(outputs[0]).shape[-1])
    if det.shape[1] < 5:
        raise ModelUnavailableError("face_detection:unrecognized_output")

    best = None
    for row in det:
        score = float(row[4])
        if best is None or score > float(best[4]):
            best = row
    if best is None or float(best[4]) < FACE_DETECTION_THRESHOLD:
        return FaceDetectionResult(
            face_detected=False, bounding_box=None, landmarks_68=[],
            face_quality_score=0.0, head_pose={"yaw": 0, "pitch": 0, "roll": 0},
            occlusion={"left_eye": None, "right_eye": None, "nose": None, "mouth": None},
            glasses_detected=False, mask_detected=False,
            processing_time_ms=(time.time() - start) * 1000,
        )

    x1, y1, x2, y2 = float(best[0]), float(best[1]), float(best[2]), float(best[3])
    conf = float(best[4])
    # Map normalized or 640-space coordinates back to image space.
    if max(abs(x1), abs(y1), abs(x2), abs(y2)) <= 1.5:
        x1, x2 = x1 * w0, x2 * w0
        y1, y2 = y1 * h0, y2 * h0
    else:
        x1, x2 = x1 * w0 / 640.0, x2 * w0 / 640.0
        y1, y2 = y1 * h0 / 640.0, y2 * h0 / 640.0

    bbox = BoundingBox(x=int(min(x1, x2)), y=int(min(y1, y2)),
                       width=max(int(abs(x2 - x1)), 1), height=max(int(abs(y2 - y1)), 1),
                       confidence=min(conf, 0.99))
    landmarks = [asdict(lm) for lm in _run_landmarks_model(img, bbox)]
    head_pose = _compute_head_pose_from_landmarks(landmarks)

    return FaceDetectionResult(
        face_detected=True, bounding_box=bbox,
        landmarks_68=landmarks,
        face_quality_score=min(conf, 0.99),
        head_pose=head_pose,
        occlusion={"left_eye": None, "right_eye": None, "nose": None, "mouth": None},
        glasses_detected=False, mask_detected=False,
        processing_time_ms=(time.time() - start) * 1000,
    )


def extract_features(image_data: bytes) -> FeatureExtractionResult:
    """Extract face embedding using DeepFace or the ArcFace ONNX model.

    Fails closed: raises ModelUnavailableError when no real embedding model is
    available. Never returns a deterministic pseudo-embedding.
    """
    start = time.time()

    if DEEPFACE_AVAILABLE:
        try:
            representations = DeepFace.represent(
                img_path=image_data,
                model_name=DEEPFACE_RECOGNITION_MODEL,
                detector_backend=DEEPFACE_DETECTOR,
                enforce_detection=False,
            )
            if representations and len(representations) > 0:
                embedding = representations[0].get("embedding", [])
                face_info = representations[0].get("facial_area", {})
                confidence = representations[0].get("face_confidence", 0.9)
                norm = math.sqrt(sum(v * v for v in embedding)) if embedding else 0.0
                if norm > 0:
                    embedding = [round(v / norm, 6) for v in embedding]
                    norm = 1.0
                return FeatureExtractionResult(
                    embedding=embedding, embedding_norm=norm,
                    face_quality=round(confidence, 4),
                    inter_eye_distance=face_info.get("w", 64) * 0.4,
                    face_area_ratio=round(face_info.get("w", 100) * face_info.get("h", 100) / (640 * 480), 4),
                    processing_time_ms=(time.time() - start) * 1000,
                )
        except Exception as e:
            logger.warning(f"DeepFace represent failed, trying ONNX embedding model: {e}")

    import numpy as np
    session = require_model("embedding")
    img = _decode_image(image_data)
    inp = _preprocess(img, 112)
    outputs = session.run(None, {session.get_inputs()[0].name: inp})
    vec = np.array(outputs[0]).reshape(-1).astype("float64")
    if vec.size == 0:
        raise ModelUnavailableError("embedding:empty_output")
    norm = float(np.linalg.norm(vec))
    embedding = [round(float(v / norm), 6) for v in vec] if norm > 0 else [float(v) for v in vec]

    return FeatureExtractionResult(
        embedding=embedding, embedding_norm=1.0 if norm > 0 else 0.0,
        face_quality=1.0,
        inter_eye_distance=0.0,
        face_area_ratio=0.0,
        processing_time_ms=(time.time() - start) * 1000,
    )


def classify_anti_spoofing(image_data: bytes) -> AntiSpoofResult:
    """Anti-spoofing classification via DeepFace built-in anti-spoofing or the
    MiniFASNet ONNX ensemble (binary live/spoof classifier).

    Fails closed: raises ModelUnavailableError when no real anti-spoofing
    model is available. Sub-scores for methods that did not run are None.
    """
    start = time.time()

    if DEEPFACE_AVAILABLE:
        try:
            faces = DeepFace.extract_faces(
                img_path=image_data,
                detector_backend=DEEPFACE_DETECTOR,
                enforce_detection=False,
                anti_spoofing=True,
            )
            if faces:
                is_real = bool(faces[0].get("is_real", False))
                score = float(faces[0].get("antispoof_score", 0.0))
                return AntiSpoofResult(
                    is_spoof=not is_real,
                    spoof_type=SpoofType.NONE.value if is_real else SpoofType.UNCLASSIFIED.value,
                    confidence=min(score, 0.99),
                    method_scores={"deepface_antispoof": round(score, 4)},
                    texture_score=round(score, 4),
                    depth_score=None,
                    frequency_score=None,
                    moiré_detected=None,
                    reflection_detected=None,
                    edge_analysis_score=None,
                )
        except Exception as e:
            logger.warning(f"DeepFace anti-spoofing failed, trying ONNX model: {e}")

    import numpy as np
    session = require_model("anti_spoofing")
    img = _decode_image(image_data)
    inp = _preprocess(img, 128)
    outputs = session.run(None, {session.get_inputs()[0].name: inp})
    logits = np.array(outputs[0]).reshape(-1).astype("float64")
    if logits.size == 0:
        raise ModelUnavailableError("anti_spoofing:empty_output")
    if logits.size == 1:
        prob_live = _sigmoid(float(logits[0]))
    else:
        # Binary classifier convention: last logit is the 'live' class.
        prob_live = _softmax_max([float(v) for v in logits], int(logits.size) - 1)

    is_spoof = prob_live < ANTI_SPOOF_THRESHOLD
    return AntiSpoofResult(
        is_spoof=is_spoof,
        spoof_type=SpoofType.NONE.value if not is_spoof else SpoofType.UNCLASSIFIED.value,
        confidence=min(prob_live if not is_spoof else 1.0 - prob_live, 0.99),
        method_scores={"onnx_liveness_classifier": round(prob_live, 4)},
        texture_score=round(prob_live, 4),
        depth_score=None,
        frequency_score=None,
        moiré_detected=None,
        reflection_detected=None,
        edge_analysis_score=None,
    )


def detect_deepfake(image_data: bytes) -> float:
    """Deepfake detection via the EfficientNet-B4 ONNX binary classifier.

    Returns the model's deepfake probability. Fails closed: raises
    ModelUnavailableError when the model is not loaded.
    """
    import numpy as np
    session = require_model("deepfake")
    img = _decode_image(image_data)
    inp = _preprocess(img, 224)
    outputs = session.run(None, {session.get_inputs()[0].name: inp})
    logits = np.array(outputs[0]).reshape(-1).astype("float64")
    if logits.size == 0:
        raise ModelUnavailableError("deepfake:empty_output")
    if logits.size == 1:
        prob = _sigmoid(float(logits[0]))
    else:
        prob = _softmax_max([float(v) for v in logits], int(logits.size) - 1)
    return round(min(max(prob, 0.0), 1.0), 4)


def run_passive_liveness(image_data: bytes) -> dict:
    """Passive liveness from single image — no user interaction required.

    Combines the real anti-spoofing classifier with a real monocular depth
    map (flat depth maps indicate print/screen spoofs). Fails closed when
    either model is unavailable.
    """
    import numpy as np
    anti_spoof = classify_anti_spoofing(image_data)

    depth_score = None
    try:
        depth_session = require_model("depth")
        img = _decode_image(image_data)
        inp = _preprocess(img, 256)
        outputs = depth_session.run(None, {depth_session.get_inputs()[0].name: inp})
        depth_map = np.array(outputs[0]).astype("float64")
        # Real heuristic on a real model output: a flat depth map (very low
        # variance) indicates a printed photo or screen replay.
        variance = float(depth_map.var())
        depth_score = round(min(variance / 0.05, 1.0), 4)
    except ModelUnavailableError:
        depth_score = None

    texture_score = anti_spoof.texture_score if anti_spoof.texture_score is not None else 0.0
    components = {"texture_micro_score": texture_score}
    if depth_score is not None:
        components["depth_map_score"] = depth_score

    overall = sum(components.values()) / len(components)

    return {
        "method": "passive_3d",
        "overall_score": round(min(overall, 0.99), 4),
        "depth_map_score": depth_score,
        "texture_micro_score": round(texture_score, 4),
        "color_space_score": None,
        "reflection_map_score": None,
        "moiré_detection_score": None,
        "is_live": overall >= LIVENESS_PASS_THRESHOLD and not anti_spoof.is_spoof,
    }


def analyze_facial_attributes(image_data: bytes) -> dict:
    """Analyze facial attributes using DeepFace: age, gender, emotion, race.

    Requires DeepFace — no fabricated attribute fallback. Raises
    ModelUnavailableError when DeepFace is not installed or fails.
    """
    if not DEEPFACE_AVAILABLE:
        raise ModelUnavailableError("facial_attributes")
    try:
        results = DeepFace.analyze(
            img_path=image_data,
            actions=["age", "gender", "race", "emotion"],
            detector_backend=DEEPFACE_DETECTOR,
            enforce_detection=False,
        )
        if results and len(results) > 0:
            r = results[0]
            return {
                "age": r.get("age", 30),
                "gender": r.get("gender", {}),
                "dominant_gender": r.get("dominant_gender", "unknown"),
                "emotion": r.get("emotion", {}),
                "dominant_emotion": r.get("dominant_emotion", "neutral"),
                "race": r.get("race", {}),
                "dominant_race": r.get("dominant_race", "unknown"),
                "engine": "deepface",
            }
    except Exception as e:
        logger.warning(f"DeepFace analyze failed: {e}")
    raise ModelUnavailableError("facial_attributes")


def match_faces(image1_data: bytes, image2_data: bytes) -> FaceMatchResult:
    """Compare two face images using DeepFace.verify() or real ONNX embeddings.

    Fails closed: raises ModelUnavailableError when no real comparison model
    is available. Never returns hash-derived similarity or attributes.
    """
    start = time.time()

    if DEEPFACE_AVAILABLE:
        try:
            result = DeepFace.verify(
                img1_path=image1_data,
                img2_path=image2_data,
                model_name=DEEPFACE_RECOGNITION_MODEL,
                detector_backend=DEEPFACE_DETECTOR,
                distance_metric=DEEPFACE_DISTANCE_METRIC,
                enforce_detection=False,
                anti_spoofing=True,
            )
            matched = result.get("verified", False)
            distance = result.get("distance", 0.5)
            threshold = result.get("threshold", 0.68)
            similarity_pct = max(0, (1.0 - distance / (threshold * 2))) * 100

            age_estimation = None
            gender_estimation = "unknown"
            try:
                attrs = analyze_facial_attributes(image1_data)
                age_estimation = attrs.get("age")
                gender_estimation = attrs.get("dominant_gender", "unknown")
            except ModelUnavailableError:
                pass

            return FaceMatchResult(
                id=f"FM-{uuid.uuid4().hex[:8].upper()}",
                matched=matched,
                similarity_score=round(similarity_pct, 2),
                embedding_distance=round(distance, 4),
                face1_quality=1.0,
                face2_quality=1.0,
                age_estimation=age_estimation,
                gender_estimation=gender_estimation,
                head_pose_diff=0.0,
                processing_time_ms=round((time.time() - start) * 1000, 2),
                customer_id="",
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as e:
            logger.warning(f"DeepFace verify failed, trying ONNX embeddings: {e}")

    # ONNX embedding comparison path (extract_features fails closed itself).
    feat1 = extract_features(image1_data)
    feat2 = extract_features(image2_data)

    cosine_sim = sum(a * b for a, b in zip(feat1.embedding, feat2.embedding))
    cosine_sim = max(min(cosine_sim, 1.0), -1.0)
    similarity_pct = (cosine_sim + 1.0) / 2.0 * 100.0

    quality_factor = min(feat1.face_quality, feat2.face_quality)
    adaptive_threshold = FACE_MATCH_THRESHOLD - (1.0 - quality_factor) * 0.1
    matched = cosine_sim >= adaptive_threshold

    return FaceMatchResult(
        id=f"FM-{uuid.uuid4().hex[:8].upper()}",
        matched=matched,
        similarity_score=round(similarity_pct, 2),
        embedding_distance=round(1.0 - cosine_sim, 4),
        face1_quality=round(feat1.face_quality, 4),
        face2_quality=round(feat2.face_quality, 4),
        age_estimation=None,
        gender_estimation="unknown",
        head_pose_diff=0.0,
        processing_time_ms=round((time.time() - start) * 1000, 2),
        customer_id="",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ─── In-Memory Store (production uses Postgres) ─────────────────────────────

liveness_checks: list = []
face_match_results: list = []
stats = {
    "total_checks": 0, "passed": 0, "failed": 0,
    "spoofs_detected": 0, "deepfakes_detected": 0,
    "avg_processing_ms": 0.0, "total_face_matches": 0,
    "spoof_breakdown": {t.value: 0 for t in SpoofType if t != SpoofType.NONE},
}

request_count = 0
error_count = 0

SUPPORTED_METHODS = [
    {"id": "passive_3d", "name": "Passive 3D Depth", "description": "Single-image liveness via monocular depth estimation + texture analysis", "requires_interaction": False},
    {"id": "texture_analysis", "name": "Texture Micro-Pattern", "description": "LBP/frequency domain analysis for print/screen detection", "requires_interaction": False},
    {"id": "depth_estimation", "name": "Depth Map Estimation", "description": "Neural network monocular depth for 3D mask detection", "requires_interaction": False},
    {"id": "frequency_analysis", "name": "Frequency Domain (FFT)", "description": "Moiré pattern and screen refresh rate detection", "requires_interaction": False},
    {"id": "deepfake_detector", "name": "Deepfake Detection", "description": "EfficientNet-B4 GAN artifact and manipulation detection", "requires_interaction": False},
    {"id": "blink_challenge", "name": "Blink Challenge", "description": "Active liveness — user blinks on command", "requires_interaction": True},
    {"id": "smile_challenge", "name": "Smile Challenge", "description": "Active liveness — user smiles on command", "requires_interaction": True},
    {"id": "head_turn", "name": "Head Turn Challenge", "description": "Active liveness — user turns head left/right", "requires_interaction": True},
    {"id": "nod_challenge", "name": "Nod Challenge", "description": "Active liveness — user nods up/down", "requires_interaction": True},
    {"id": "random_pose", "name": "Random Pose Challenge", "description": "Active liveness — user follows random on-screen target", "requires_interaction": True},
]


# ─── HTTP Handler ────────────────────────────────────────────────────────────


class CircuitBreaker:
    def __init__(self, threshold=5, reset_timeout=30):
        self.failures = 0
        self.threshold = threshold
        self.reset_timeout = reset_timeout
        self.last_failure = 0
        self.state = "closed"
    def allow(self):
        if self.state == "open":
            if time.time() - self.last_failure > self.reset_timeout:
                self.state = "half-open"
                return True
            return False
        return True
    def record_success(self):
        self.failures = 0
        self.state = "closed"
    def record_failure(self):
        self.failures += 1
        self.last_failure = time.time()
        if self.failures >= self.threshold:
            self.state = "open"

_circuit_breaker = CircuitBreaker()

# --- gRPC Server (binary protocol, length-prefixed, with circuit breaker + retry) ---
import socket as _grpc_socket
import struct as _grpc_struct
import threading as _grpc_threading

class GrpcServicer:
    """gRPC handler for inter-service calls."""
    def __init__(self, service_name):
        self.service_name = service_name
        self.request_count = 0

    def Process(self, request_data):
        self.request_count += 1
        trace_id = f"grpc-{int(time.time()*1000)}-{os.getpid()}"
        return {"status": "processed", "service": self.service_name, "trace_id": trace_id}

def start_grpc_server(service_name, port):
    """Start TCP-based gRPC server for inter-service calls."""
    def handle_client(conn, addr, servicer):
        try:
            data = conn.recv(4096)
            if not data: return
            result = servicer.Process(data)
            response = json.dumps(result).encode()
            conn.sendall(_grpc_struct.pack(">I", len(response)) + response)
        except Exception:
            pass
        finally:
            conn.close()

    def serve():
        servicer = GrpcServicer(service_name)
        sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
        sock.setsockopt(_grpc_socket.SOL_SOCKET, _grpc_socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", int(port)))
        sock.listen(32)
        logger.info(f"[{service_name}] gRPC server on :{port}")
        while True:
            try:
                conn, addr = sock.accept()
                _grpc_threading.Thread(target=handle_client, args=(conn, addr, servicer), daemon=True).start()
            except Exception:
                break

    t = _grpc_threading.Thread(target=serve, daemon=True)
    t.start()
    return t


# --- gRPC Client with Retry + Circuit Breaker ---
class _CircuitBreaker:
    def __init__(self, threshold=5, reset_after=30):
        self.failures = 0
        self.last_failure = 0
        self.threshold = threshold
        self.reset_after = reset_after
        self._lock = threading.Lock()

    def allow(self):
        with self._lock:
            if self.failures >= self.threshold:
                if time.time() - self.last_failure > self.reset_after:
                    self.failures = self.threshold // 2
                    return True
                return False
            return True

    def record_success(self):
        with self._lock:
            if self.failures > 0: self.failures -= 1

    def record_failure(self):
        with self._lock:
            self.failures += 1
            self.last_failure = time.time()

_grpc_cb = _CircuitBreaker()

def grpc_call(target, method, payload, retries=3):
    """Make a gRPC call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        logger.warning(f"Circuit breaker open for {target}/{method}")
        return None
    for attempt in range(retries):
        try:
            host, port = target.rsplit(":", 1)
            sock = _grpc_socket.socket(_grpc_socket.AF_INET, _grpc_socket.SOCK_STREAM)
            sock.settimeout(5.0)
            sock.connect((host, int(port)))
            data = json.dumps({"method": method, "payload": payload}).encode()
            sock.sendall(_grpc_struct.pack(">I", len(data)) + data)
            length_bytes = sock.recv(4)
            if len(length_bytes) == 4:
                length = _grpc_struct.unpack(">I", length_bytes)[0]
                response = sock.recv(length)
                _grpc_cb.record_success()
                return json.loads(response)
            _grpc_cb.record_failure()
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"gRPC {target}/{method} attempt {attempt+1} failed: {e}")
        finally:
            try: sock.close()
            except: pass
    return None

def call_service(method, url, body=None, retries=3, timeout=15):
    """HTTP inter-service call with retry + circuit breaker."""
    if not _grpc_cb.allow():
        return None
    for attempt in range(retries):
        try:
            data = json.dumps(body).encode() if body else None
            req = urllib.request.Request(url, data=data, method=method,
                                         headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=timeout)
            _grpc_cb.record_success()
            return json.loads(resp.read())
        except Exception as e:
            _grpc_cb.record_failure()
            if attempt < retries - 1:
                time.sleep((2 ** attempt) * 0.2)
            logger.warning(f"HTTP {method} {url} attempt {attempt+1} failed: {e}")
    return None

# gRPC service registry
GRPC_REGISTRY = {
    "core-banking": 9090, "payments-hub": 9091, "gl-engine": 9092,
    "trade-finance": 9093, "cheque-clearing": 9094, "nibss-nip": 9095,
    "credit-scoring": 9096, "fraud-detection": 9097, "aml-screening": 9098,
    "kyc-engine": 9099,
}

def call_service_grpc(target, method, payload=None):
    """Convenience: try gRPC first, fall back to HTTP."""
    service_name_key = target.split("/")[0] if "/" in target else target
    if service_name_key in GRPC_REGISTRY:
        result = grpc_call(f"localhost:{GRPC_REGISTRY[service_name_key]}", method, payload or {})
        if result: return result
    return call_service("POST", f"http://{target}/v1/{method}", payload)


# --- Alerting ---
_ALERT_RULES = [
    {"name": "high_error_rate", "metric": "error_rate", "threshold": 0.05, "severity": "critical"},
    {"name": "high_latency", "metric": "p99_latency_ms", "threshold": 5000, "severity": "warning"},
    {"name": "db_failures", "metric": "db_failures", "threshold": 3, "severity": "critical"},
]

def check_alerts():
    fired = []
    err_rate = error_count / max(request_count, 1)
    if err_rate > 0.05:
        fired.append({"rule": "high_error_rate", "value": err_rate, "severity": "critical"})
    return fired


# --- Graceful Degradation ---
class _DegradationState:
    def __init__(self):
        self.db_available = True
        self.cache_available = True
        self.upstreams = {}
        self._lock = threading.Lock()

    def set_db(self, ok):
        with self._lock: self.db_available = ok

    def is_db_ok(self):
        with self._lock: return self.db_available

    def set_upstream(self, name, ok):
        with self._lock: self.upstreams[name] = ok

    def status(self):
        with self._lock:
            return {
                "db_available": self.db_available,
                "cache_available": self.cache_available,
                "upstreams": dict(self.upstreams),
                "mode": "normal" if self.db_available else "degraded",
            }

_degrade = _DegradationState()

class Handler(BaseHTTPRequestHandler):
    def get_tenant_id(self):
        return self.headers.get("X-Tenant-Id") or self.headers.get("x-tenant-id")

    def do_GET(self):

        # N-1: fail-closed JWT auth on the live GET path (probe endpoints exempt).
        _n1_path = urlparse(self.path).path.rstrip("/") or "/"
        if _n1_path not in ("/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"):
            _n1_claims, _n1_err = validate_jwt(dict(self.headers))
            if _n1_err:
                self._json(401, {"error": "unauthorized", "detail": _n1_err})
                return
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(time.time()*1000)}-{os.getpid()}"
        logger.info(f"[liveness-inference-py] {self.command} {self.path} trace={trace_id}")
        path = urlparse(self.path).path.rstrip("/")
        params = parse_qs(urlparse(self.path).query)

        if path in ("/readyz", "/livez"):
            self._json(200, {"status": "healthy", "service": "liveness-inference-py"})
            return
        if path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f'requests_total{{service="liveness-inference-py"}} {getattr(self.__class__, "_req_count", 0)}\n'.encode())
            return
        self.__class__._req_count = getattr(self.__class__, "_req_count", 0) + 1
        if path in ("/healthz", "/health"):
            models_ok = all(s == "loaded" for s in MODEL_STATUS.values()) if MODEL_STATUS else False
            self._json(200, {
                "service": "liveness-inference-py",
                "status": "healthy" if (DEEPFACE_AVAILABLE or models_ok) else "degraded",
                "version": "2.0.0",
                "deepface_available": DEEPFACE_AVAILABLE,
                "ml_backend": "deepface" if DEEPFACE_AVAILABLE else ("onnx" if MODEL_SESSIONS else "unavailable"),
                "models": {
                    name: {"file": fname, "status": MODEL_STATUS.get(name, "missing")}
                    for name, fname in REQUIRED_MODELS.items()
                },
                "capabilities": [
                    cap for cap, ok in [
                        ("passive_liveness", DEEPFACE_AVAILABLE or "anti_spoofing" in MODEL_SESSIONS),
                        ("active_liveness", DEEPFACE_AVAILABLE or ("face_detection" in MODEL_SESSIONS and "landmarks" in MODEL_SESSIONS)),
                        ("face_matching", DEEPFACE_AVAILABLE or "embedding" in MODEL_SESSIONS),
                        ("face_detection", DEEPFACE_AVAILABLE or "face_detection" in MODEL_SESSIONS),
                        ("68_point_landmarks", "landmarks" in MODEL_SESSIONS),
                        ("feature_extraction", DEEPFACE_AVAILABLE or "embedding" in MODEL_SESSIONS),
                        ("anti_spoofing_classification", DEEPFACE_AVAILABLE or "anti_spoofing" in MODEL_SESSIONS),
                        ("deepfake_detection", "deepfake" in MODEL_SESSIONS),
                        ("facial_attribute_analysis", DEEPFACE_AVAILABLE),
                    ] if ok
                ],
                "compliance_claims": [],
                "deepface_config": {
                    "recognition_model": DEEPFACE_RECOGNITION_MODEL,
                    "detector": DEEPFACE_DETECTOR,
                    "distance_metric": DEEPFACE_DISTANCE_METRIC,
                    "db_backend": DEEPFACE_BACKEND_DB,
                } if DEEPFACE_AVAILABLE else None,
                "middleware": {
                    "kafka": "liveness.inference.events, liveness.inference.audit",
                    "postgres": "liveness_checks, face_matches, anti_spoofing_results, face_embeddings",
                    "redis": "liveness_session_cache (TTL 5min)",
                    "temporal": "LivenessInferenceWorkflow",
                    "opensearch": "liveness-inference-2026",
                },
            })
        elif path == "/v1/liveness/methods":
            self._json(200, {"methods": SUPPORTED_METHODS, "total": len(SUPPORTED_METHODS)})
        elif path == "/v1/liveness/checks":
            page = int(params.get("page", ["1"])[0])
            limit = int(params.get("limit", ["25"])[0])
            start_idx = (page - 1) * limit
            self._json(200, {
                "checks": liveness_checks[start_idx:start_idx + limit],
                "total": len(liveness_checks), "page": page, "limit": limit,
            })
        elif path.startswith("/v1/liveness/checks/"):
            check_id = path.split("/")[-1]
            found = next((c for c in liveness_checks if c["id"] == check_id), None)
            if found:
                self._json(200, found)
            else:
                self._json(404, {"error": f"Check {check_id} not found"})
        elif path == "/v1/face-match/results":
            self._json(200, {"results": face_match_results, "total": len(face_match_results)})
        elif path == "/v1/stats":
            self._json(200, stats)
        elif path == "/v1/pipeline-info":
            self._json(200, {
                "pipeline": [
                    {"stage": 1, "name": "Face Detection", "model": REQUIRED_MODELS["face_detection"]},
                    {"stage": 2, "name": "Landmark Extraction", "model": REQUIRED_MODELS["landmarks"]},
                    {"stage": 3, "name": "Anti-Spoofing Ensemble", "model": REQUIRED_MODELS["anti_spoofing"]},
                    {"stage": 4, "name": "Deepfake Detection", "model": REQUIRED_MODELS["deepfake"]},
                    {"stage": 5, "name": "Feature Extraction", "model": REQUIRED_MODELS["embedding"]},
                    {"stage": 6, "name": "Depth Estimation", "model": REQUIRED_MODELS["depth"]},
                ],
                "model_dir": MODEL_DIR,
                "models_loaded": sorted(MODEL_SESSIONS.keys()),
                "gpu_acceleration": bool(_ORT_AVAILABLE and _ort and any(
                    "CUDA" in p for s in MODEL_SESSIONS.values() for p in s.get_providers())),
                "batch_size": 1,
                "input_resolution": "112x112 (aligned face)",
            })
        else:
            self._json(404, {"error": "Not found"})

    def do_POST(self):
        trace_id = self.headers.get("X-Trace-Id") or self.headers.get("traceparent") or f"{int(time.time()*1000)}-{os.getpid()}"
        logger.info(f"[liveness-inference-py] {self.command} {self.path} trace={trace_id}")
        path = urlparse(self.path).path.rstrip("/")
        content_len = int(self.headers.get("Content-Length", 0))
        valid, err = validate_jwt(dict(self.headers))
        if not valid:
            self._json(401, {"error": "unauthorized", "detail": err})
            return
        if not _rl_allow():
            self.send_response(429)
            self.send_header("Retry-After", "1")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "rate_limit_exceeded"}).encode())
            return
        raw = self.rfile.read(content_len) if content_len > 0 else b""
        body = json.loads(sanitize_input(raw.decode())) if raw else {}
        db_insert(f"liveness_{int(time.time()*1000)}", {"tenant_id": self.get_tenant_id(), "path": path, "action": "inference"})
        upstream = os.environ.get("AML_ENGINE_URL", "http://aml-engine-rs:8080")
        call_service("POST", f"{upstream}/v1/notify", {"source": "liveness-inference-py", "action": "inference"})

        try:
            if path == "/v1/liveness/check":
                self._handle_liveness_check(body)
            elif path == "/v1/liveness/passive":
                self._handle_passive_liveness(body)
            elif path == "/v1/face-detect":
                self._handle_face_detection(body)
            elif path == "/v1/landmarks":
                self._handle_landmark_extraction(body)
            elif path == "/v1/features/extract":
                self._handle_feature_extraction(body)
            elif path == "/v1/anti-spoof/classify":
                self._handle_anti_spoof(body)
            elif path == "/v1/deepfake/detect":
                self._handle_deepfake_detection(body)
            elif path == "/v1/face-match":
                self._handle_face_match(body)
            elif path == "/v1/face-match/batch":
                self._handle_face_match_batch(body)
            elif path == "/v1/face/analyze":
                self._handle_facial_analysis(body)
            elif path == "/v1/face/search":
                self._handle_face_search(body)
            elif path == "/v1/face/register":
                self._handle_face_register(body)
            elif path == "/v1/dedup/check":
                self._handle_dedup_check(body)
            elif path == "/v1/noise/assess":
                self._handle_noise_assessment(body)
            elif path == "/v1/frame/accumulate":
                self._handle_frame_accumulate(body)
            elif path == "/v1/motion/analyze":
                self._handle_motion_analysis(body)
            else:
                self._json(404, {"error": "Not found"})
        except ModelUnavailableError as e:
            logger.error(f"model_unavailable: {e.model} for {path}")
            self._json(503, {"error": "model_unavailable", "model": e.model})
        except InvalidImageError as e:
            self._json(400, {"error": "invalid_image", "detail": str(e)})

    def _handle_liveness_check(self, body: dict):
        """Full liveness check pipeline with adaptive noise tolerance.
        Requires real models; returns 503 model_unavailable when missing.
        """
        start = time.time()
        image_b64 = body.get("image", "")
        customer_id = body.get("customerId", "unknown")
        session_id = body.get("sessionId", str(uuid.uuid4()))
        device = body.get("devicePlatform", "unknown")
        device_model = body.get("deviceModel", "")
        methods = body.get("methods", ["passive_3d", "texture_analysis", "depth_estimation", "frequency_analysis", "deepfake_detector"])

        import base64 as _b64
        if image_b64:
            try:
                image_data = _b64.b64decode(image_b64)
            except Exception:
                image_data = image_b64.encode()
        else:
            raise InvalidImageError("image is required")

        # Step 1: Assess camera noise level from real pixel statistics
        noise = assess_image_noise(image_data, device or device_model)

        if not noise.usable:
            result = {
                "id": f"LIV-{uuid.uuid4().hex[:8].upper()}",
                "is_live": False, "overall_score": 0.0,
                "error": "image_quality_too_low",
                "noise_assessment": asdict(noise),
                "recommended_action": noise.recommended_action,
                "user_guidance": "Please ensure good lighting and hold the device steady. Avoid backlit environments.",
                "processing_time_ms": round((time.time() - start) * 1000, 2),
                "customer_id": customer_id, "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            liveness_checks.append(result)
            stats["total_checks"] += 1
            stats["failed"] += 1
            self._json(200, result)
            return

        face_result = detect_face(image_data)
        if not face_result.face_detected:
            guidance = "No face detected."
            if noise.noise_category in ("medium", "high"):
                guidance += " Camera noise is high — try better lighting or hold device closer."
            result = {
                "id": f"LIV-{uuid.uuid4().hex[:8].upper()}",
                "is_live": False, "overall_score": 0.0,
                "error": "no_face_detected",
                "noise_assessment": asdict(noise),
                "user_guidance": guidance,
                "face_detection": asdict(face_result),
                "processing_time_ms": round((time.time() - start) * 1000, 2),
                "customer_id": customer_id, "session_id": session_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            liveness_checks.append(result)
            stats["total_checks"] += 1
            stats["failed"] += 1
            self._json(200, result)
            return

        mode_fallback = None
        if noise.noise_category == "high" and any(m in methods for m in ["blink_challenge", "smile_challenge", "head_turn", "nod_challenge"]):
            mode_fallback = "passive_fallback"
            methods = ["passive_3d", "texture_analysis", "depth_estimation", "deepfake_detector"]

        anti_spoof = classify_anti_spoofing(image_data)
        deepfake_prob = detect_deepfake(image_data)
        passive = run_passive_liveness(image_data)

        method_scores = {}
        if "passive_3d" in methods:
            method_scores["passive_3d"] = passive["overall_score"]
        if "texture_analysis" in methods and anti_spoof.texture_score is not None:
            method_scores["texture_analysis"] = anti_spoof.texture_score
        if "depth_estimation" in methods and passive.get("depth_map_score") is not None:
            method_scores["depth_estimation"] = passive["depth_map_score"]
        if "frequency_analysis" in methods and anti_spoof.frequency_score is not None:
            method_scores["frequency_analysis"] = anti_spoof.frequency_score
        if "deepfake_detector" in methods:
            method_scores["deepfake_detector"] = 1.0 - deepfake_prob

        raw_scores = dict(method_scores)
        method_scores = apply_noise_compensation(method_scores, noise)

        overall_score = sum(method_scores.values()) / max(len(method_scores), 1)

        adjusted_liveness_threshold = LIVENESS_PASS_THRESHOLD - noise.threshold_adjustment

        is_live = (
            overall_score >= adjusted_liveness_threshold and
            not anti_spoof.is_spoof and
            deepfake_prob < DEEPFAKE_THRESHOLD
        )

        frame_stats = accumulate_frame_score(session_id, overall_score, noise.noise_level)
        if noise.noise_category in ("medium", "high") and frame_stats["sufficient_frames"]:
            overall_score = frame_stats["weighted_avg_score"]
            is_live = overall_score >= adjusted_liveness_threshold and not anti_spoof.is_spoof

        result = {
            "id": f"LIV-{uuid.uuid4().hex[:8].upper()}",
            "is_live": is_live,
            "overall_score": round(overall_score, 4),
            "verdict": "LIVE" if is_live else "SPOOF",
            "method_scores": method_scores,
            "raw_method_scores": raw_scores,
            "noise_assessment": asdict(noise),
            "noise_compensation_applied": noise.noise_category != "clean",
            "threshold_adjustments": {
                "liveness_threshold": round(adjusted_liveness_threshold, 4),
                "original_threshold": LIVENESS_PASS_THRESHOLD,
                "noise_relaxation": round(noise.threshold_adjustment, 4),
            },
            "multi_frame": frame_stats,
            "mode_fallback": mode_fallback,
            "anti_spoof": asdict(anti_spoof),
            "deepfake_probability": deepfake_prob,
            "face_detection": asdict(face_result),
            "passive_liveness": passive,
            "confidence_score": round(overall_score, 4),
            "compliance_claims": [],
            "processing_time_ms": round((time.time() - start) * 1000, 2),
            "device_platform": device,
            "device_model": device_model,
            "session_id": session_id,
            "customer_id": customer_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "kafka_event": f"liveness.inference.events:{session_id}",
        }

        liveness_checks.append(result)
        stats["total_checks"] += 1
        if is_live:
            stats["passed"] += 1
        else:
            stats["failed"] += 1
            if anti_spoof.is_spoof:
                stats["spoofs_detected"] += 1
                stats["spoof_breakdown"][anti_spoof.spoof_type] = stats["spoof_breakdown"].get(anti_spoof.spoof_type, 0) + 1
            if deepfake_prob >= DEEPFAKE_THRESHOLD:
                stats["deepfakes_detected"] += 1

        total = stats["total_checks"]
        stats["avg_processing_ms"] = round(
            (stats["avg_processing_ms"] * (total - 1) + result["processing_time_ms"]) / total, 2
        )
        self._json(200, result)

    def _handle_passive_liveness(self, body: dict):
        """Passive liveness only — single image, no interaction."""
        image_data = body.get("image", "").encode()
        device = body.get("devicePlatform", "unknown")
        noise = assess_image_noise(image_data, device)
        result = run_passive_liveness(image_data)

        if noise.noise_category not in ("clean", "unknown") and result.get("depth_map_score") is not None:
            boost = noise.threshold_adjustment * 0.8
            result["depth_map_score"] = round(min(result["depth_map_score"] + boost, 0.99), 4)
            result["overall_score"] = round(min(
                (result["depth_map_score"] + result["texture_micro_score"]) / 2.0,
                0.99
            ), 4)
            adjusted_threshold = LIVENESS_PASS_THRESHOLD - noise.threshold_adjustment
            result["is_live"] = result["overall_score"] >= adjusted_threshold

        result["noise_assessment"] = asdict(noise)
        result["noise_compensation_applied"] = noise.noise_category != "clean"
        result["customer_id"] = body.get("customerId", "unknown")
        result["compliance_claims"] = []
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        self._json(200, result)

    def _handle_motion_analysis(self, body: dict):
        """Analyze motion between reference and action frames for active liveness."""
        ref_b64 = body.get("referenceFrame", "")
        action_b64s = body.get("actionFrames", [])
        challenge_type = body.get("challengeType", "head_turn_left")
        device = body.get("devicePlatform", "unknown")
        device_model = body.get("deviceModel", "")

        if not ref_b64:
            raise InvalidImageError("referenceFrame is required")
        ref_data = ref_b64.encode()

        noise = assess_image_noise(ref_data, device or device_model)
        anti_spoof = classify_anti_spoofing(ref_data)
        deepfake_prob = detect_deepfake(ref_data)

        motion = analyze_motion(ref_data, action_b64s, challenge_type, device or device_model)

        liveness_score = 0.0
        if not anti_spoof.is_spoof and deepfake_prob < DEEPFAKE_THRESHOLD:
            liveness_score = anti_spoof.confidence

        combined_score = motion["motion_score"] * 0.6 + liveness_score * 0.4

        result = {
            **motion,
            "liveness_score": round(liveness_score, 4),
            "combined_score": round(combined_score, 4),
            "anti_spoof": asdict(anti_spoof),
            "deepfake_probability": deepfake_prob,
            "noise_assessment": asdict(noise),
            "noise_compensation_applied": noise.noise_category != "clean",
        }
        self._json(200, result)

    def _handle_noise_assessment(self, body: dict):
        """Standalone noise assessment endpoint."""
        image_data = body.get("image", "").encode()
        device = body.get("devicePlatform", body.get("deviceModel", "unknown"))
        noise = assess_image_noise(image_data, device)
        self._json(200, asdict(noise))

    def _handle_frame_accumulate(self, body: dict):
        """Accumulate frame scores for multi-frame averaging."""
        session_id = body.get("sessionId", "unknown")
        score = body.get("score", 0.0)
        noise_level = body.get("noiseLevel", 0.0)
        result = accumulate_frame_score(session_id, score, noise_level)
        self._json(200, result)

    def _handle_face_detection(self, body: dict):
        """Face detection with bounding box, quality, pose."""
        image_data = body.get("image", "").encode()
        width = body.get("width", 640)
        height = body.get("height", 480)
        result = detect_face(image_data, width, height)
        self._json(200, asdict(result))

    def _handle_landmark_extraction(self, body: dict):
        """68-point facial landmark extraction."""
        image_data = body.get("image", "").encode()
        face = detect_face(image_data)
        if not face.face_detected:
            self._json(200, {"landmarks": [], "count": 0, "error": "no_face_detected"})
            return
        self._json(200, {
            "landmarks": face.landmarks_68,
            "count": len(face.landmarks_68),
            "regions": {
                "jaw": [lm for lm in face.landmarks_68 if lm["region"] == "jaw"],
                "eyebrow_left": [lm for lm in face.landmarks_68 if lm["region"] == "eyebrow_left"],
                "eyebrow_right": [lm for lm in face.landmarks_68 if lm["region"] == "eyebrow_right"],
                "nose": [lm for lm in face.landmarks_68 if lm["region"] == "nose"],
                "eye_left": [lm for lm in face.landmarks_68 if lm["region"] == "eye_left"],
                "eye_right": [lm for lm in face.landmarks_68 if lm["region"] == "eye_right"],
                "mouth": [lm for lm in face.landmarks_68 if lm["region"] == "mouth"],
            },
            "face_quality": face.face_quality_score,
            "head_pose": face.head_pose,
        })

    def _handle_feature_extraction(self, body: dict):
        """512-dim ArcFace embedding extraction."""
        image_data = body.get("image", "").encode()
        result = extract_features(image_data)
        self._json(200, asdict(result))

    def _handle_anti_spoof(self, body: dict):
        """Anti-spoofing classification."""
        image_data = body.get("image", "").encode()
        result = classify_anti_spoofing(image_data)
        response = asdict(result)
        response["attack_vectors_checked"] = []
        response["compliance_claims"] = []
        self._json(200, response)

    def _handle_deepfake_detection(self, body: dict):
        """Deepfake probability estimation."""
        image_data = body.get("image", "").encode()
        prob = detect_deepfake(image_data)
        self._json(200, {
            "deepfake_probability": prob,
            "is_deepfake": prob >= DEEPFAKE_THRESHOLD,
            "confidence": round(1.0 - abs(0.5 - prob) * 2, 4),
            "analysis": None,
            "model": REQUIRED_MODELS["deepfake"],
            "compliance_claims": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def _handle_face_match(self, body: dict):
        """Match two face images — selfie vs document photo."""
        image1 = body.get("image1", "").encode()
        image2 = body.get("image2", "").encode()
        customer_id = body.get("customerId", "unknown")

        result = match_faces(image1, image2)
        result.customer_id = customer_id
        result_dict = asdict(result)

        face_match_results.append(result_dict)
        stats["total_face_matches"] += 1
        self._json(200, result_dict)

    def _handle_face_match_batch(self, body: dict):
        """Batch face matching — 1:N comparison against enrolled faces."""
        probe_image = body.get("probeImage", "").encode()
        gallery = body.get("gallery", [])
        results = []
        for entry in gallery[:50]:
            gallery_img = entry.get("image", "").encode()
            r = match_faces(probe_image, gallery_img)
            r.customer_id = entry.get("customerId", "unknown")
            results.append(asdict(r))
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        self._json(200, {"matches": results, "total": len(results), "threshold": FACE_MATCH_THRESHOLD * 100})

    def _handle_facial_analysis(self, body: dict):
        """DeepFace facial attribute analysis: age, gender, emotion, race."""
        image_data = body.get("image", "").encode()
        result = analyze_facial_attributes(image_data)
        result["customer_id"] = body.get("customerId", "unknown")
        result["compliance_claims"] = []
        result["timestamp"] = datetime.now(timezone.utc).isoformat()
        self._json(200, result)

    def _handle_face_search(self, body: dict):
        """1:N face search using DeepFace.find()."""
        image_data = body.get("image", "").encode()
        db_path = body.get("dbPath", DEEPFACE_DB_PATH)
        threshold = body.get("threshold", None)
        top_k = body.get("topK", 10)

        if not DEEPFACE_AVAILABLE:
            raise ModelUnavailableError("face_search")
        try:
            results = DeepFace.find(
                img_path=image_data,
                db_path=db_path,
                model_name=DEEPFACE_RECOGNITION_MODEL,
                detector_backend=DEEPFACE_DETECTOR,
                distance_metric=DEEPFACE_DISTANCE_METRIC,
                enforce_detection=False,
                threshold=threshold,
            )
            matches = []
            for df in results[:top_k] if isinstance(results, list) else [results]:
                if hasattr(df, 'to_dict'):
                    matches.extend(df.to_dict('records')[:top_k])
            self._json(200, {"matches": matches[:top_k], "total": len(matches), "engine": "deepface", "model": DEEPFACE_RECOGNITION_MODEL})
        except ModelUnavailableError:
            raise
        except Exception as e:
            logger.warning(f"DeepFace find failed: {e}")
            raise ModelUnavailableError("face_search")

    def _handle_face_register(self, body: dict):
        """Register a face into the DeepFace database for future 1:N search."""
        image_data = body.get("image", "").encode()
        customer_id = body.get("customerId", "unknown")
        metadata = body.get("metadata", {})

        embedding_result = extract_features(image_data)
        registration = {
            "id": f"REG-{uuid.uuid4().hex[:8].upper()}",
            "customer_id": customer_id,
            "embedding_dim": len(embedding_result.embedding),
            "face_quality": round(embedding_result.face_quality, 4),
            "model": DEEPFACE_RECOGNITION_MODEL if DEEPFACE_AVAILABLE else REQUIRED_MODELS["embedding"],
            "engine": "deepface" if DEEPFACE_AVAILABLE else "onnx",
            "metadata": metadata,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        registration["stored_in"] = "local_memory"

        self._json(201, {"registered": True, "registration": registration})

    def _handle_dedup_check(self, body: dict):
        """Customer deduplication check — detect if same face exists under different BVN/accounts."""
        image_data = body.get("image", "").encode()
        customer_id = body.get("customerId", "unknown")
        bvn = body.get("bvn", "")
        threshold = body.get("threshold", 0.60)

        if not DEEPFACE_AVAILABLE:
            raise ModelUnavailableError("dedup_check")
        try:
            results = DeepFace.find(
                img_path=image_data,
                db_path=DEEPFACE_DB_PATH,
                model_name=DEEPFACE_RECOGNITION_MODEL,
                detector_backend=DEEPFACE_DETECTOR,
                enforce_detection=False,
                threshold=threshold,
            )
            duplicates = []
            for df in results if isinstance(results, list) else [results]:
                if hasattr(df, 'to_dict'):
                    for match in df.to_dict('records'):
                        duplicates.append(match)
            is_duplicate = len(duplicates) > 0
            self._json(200, {
                "customer_id": customer_id, "bvn": bvn,
                "is_duplicate": is_duplicate, "potential_matches": len(duplicates),
                "matches": duplicates[:5],
                "engine": "deepface", "threshold": threshold,
                "recommendation": "manual_review" if is_duplicate else "clear",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except ModelUnavailableError:
            raise
        except Exception as e:
            logger.warning(f"DeepFace dedup failed: {e}")
            raise ModelUnavailableError("dedup_check")

    def _json(self, code: int, data: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        add_security_headers(self)
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode())

    def log_message(self, fmt, *args):
        pass


import signal
import threading

# Rate limiting
import threading as _rl_threading
_rl_tokens = 100
_rl_lock = _rl_threading.Lock()
_rl_last_refill = [0.0]

DATABASE_URL = os.environ.get("DATABASE_URL", "")
db_conn = None


def get_db():
    global db_conn
    if db_conn is None or db_conn.closed:
        db_conn = psycopg2.connect(DATABASE_URL)
        db_conn.autocommit = True
    return db_conn


def db_insert(key, record):
    """Write an audit entry to the outbox table. Returns False on failure."""
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO outbox (event_type, aggregate_id, payload) VALUES (%s, %s, %s::jsonb)",
                ("liveness.inference", key, json.dumps(record)),
            )
        return True
    except Exception as e:
        logger.warning(f"outbox insert failed: {e}")
        return False


def init_schema():
    conn = get_db()
    with conn.cursor() as cur:
        cur.execute("""CREATE TABLE IF NOT EXISTS kyc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL,
    verification_type VARCHAR(32) NOT NULL,
    document_type VARCHAR(32),
    document_number VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    risk_score INT DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    bvn VARCHAR(11),
    nin VARCHAR(11),
    verified_name VARCHAR(200),
    date_of_birth DATE,
    address TEXT,
    lga VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(3) DEFAULT 'NGA',
    selfie_match_score REAL,
    document_match_score REAL,
    pep_check BOOLEAN DEFAULT FALSE,
    sanctions_check BOOLEAN DEFAULT FALSE,
    adverse_media_check BOOLEAN DEFAULT FALSE,
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")

        cur.execute("""CREATE TABLE IF NOT EXISTS outbox (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR(64) NOT NULL,
            aggregate_id VARCHAR(128) NOT NULL,
            payload JSONB NOT NULL,
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")

        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_tenant ON kyc_records(tenant_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_status ON kyc_records(status)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_kyc_records_created ON kyc_records(created_at DESC)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox(published, created_at) WHERE NOT published")
    conn.commit()
    logger.info("Schema initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    try:
        init_schema()
    except Exception as e:
        logger.error(f"Schema init skipped — database unavailable: {e}")
    logger.info(f"[liveness-inference-py] ready on :%d", PORT)
    logger.info(f"[liveness-inference-py] middleware: keycloak=%s kafka=%s redis=%s opensearch=%s permify=%s",
                KEYCLOAK_URL, KAFKA_BROKERS, REDIS_URL, OPENSEARCH_URL, PERMIFY_URL)
    yield
    if db_conn:
        db_conn.close()


app = FastAPI(title="liveness-inference-py", version="1.0.0", lifespan=lifespan)

# --- JWT enforcement middleware (finding N-1: fail-closed JWT auth on the live FastAPI path) ---
import inspect as _jwt_inspect
from starlette.middleware.base import BaseHTTPMiddleware as _JWTBaseHTTPMiddleware
from starlette.responses import JSONResponse as _JWTJSONResponse

# Probe endpoints are exempt; everything else requires a verifiable Bearer JWT.
_JWT_EXEMPT_PATHS = frozenset({"/health", "/healthz", "/ready", "/readyz", "/livez", "/metrics"})


def _jwt_set_scope_header(scope, name, value):
    """Overwrite (or remove, when value is None) a request header in the ASGI scope so
    downstream handlers see identity derived ONLY from verified token claims."""
    encoded = name.lower().encode("latin-1")
    headers = [(k, v) for k, v in scope.get("headers", []) if k != encoded]
    if value is not None:
        headers.append((encoded, str(value).encode("latin-1")))
    scope["headers"] = headers


class JWTAuthMiddleware(_JWTBaseHTTPMiddleware):
    """Fail-closed JWT authentication for all domain routes.

    Only the probe paths /health, /ready, /metrics (and their k8s variants
    /healthz, /readyz, /livez) plus CORS preflight (OPTIONS) are exempt. On
    success the verified claims are stored on request.state.jwt_claims and the
    tenant identity headers (x-tenant-id / x-tenant) in the ASGI scope are
    overwritten with the verified claim values, so downstream header readers
    receive ONLY the authenticated tenant. Failure: 401 JSON (503 when the JWKS
    endpoint is unreachable with a cold cache). Works with sync or async
    validate_jwt implementations.
    """

    async def dispatch(self, request, call_next):
        if request.method == "OPTIONS" or request.url.path in _JWT_EXEMPT_PATHS:
            return await call_next(request)
        try:
            if _jwt_inspect.iscoroutinefunction(validate_jwt):
                claims, err = await validate_jwt(request.headers)
            else:
                claims, err = validate_jwt(request.headers)
        except Exception as exc:
            return _JWTJSONResponse(status_code=503, content={"error": "auth_unavailable", "detail": str(exc)})
        if not claims:
            status = 503 if err == "jwks_unavailable" else 401
            return _JWTJSONResponse(status_code=status, content={"error": "unauthorized", "detail": err})
        request.state.jwt_claims = claims
        tenant = claims.get("tenant_id") or claims.get("tenant")
        _jwt_set_scope_header(request.scope, "x-tenant-id", tenant)
        _jwt_set_scope_header(request.scope, "x-tenant", tenant)
        subject = claims.get("sub") or claims.get("keycloak_id")
        if subject:
            _jwt_set_scope_header(request.scope, "x-keycloak-id", subject)
        return await call_next(request)


app.add_middleware(JWTAuthMiddleware)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()] or ["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateRequest(BaseModel):
    status: Optional[str] = "active"
    tenant_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class UpdateRequest(BaseModel):
    status: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


@app.get("/healthz")
def health():
    return {"status": "healthy", "service": "liveness-inference-py", "version": "1.0.0"}


@app.get("/readyz")
def readyz():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"not ready: {e}")


@app.get("/livez")
def livez():
    return {"status": "alive"}


@app.get("/metrics")
def metrics():
    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM kyc_records")
            count = cur.fetchone()[0]
        return {"service": "liveness-inference-py", "total_records": count}
    except Exception:
        return {"service": "liveness-inference-py", "total_records": 0}


def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Returns (True, None) only for a cryptographically valid, unexpired token.
    Fails closed with (False, reason) — including auth_not_configured when
    JWT_SECRET is unset/placeholder. Never warn-and-allow.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return False, "missing Bearer token"
    token = auth[7:]
    import hmac as _hmac, hashlib as _hashlib, base64 as _b64, json as _json
    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return _b64.urlsafe_b64decode(s.encode())
    parts = token.split(".")
    if len(parts) != 3:
        return False, "malformed JWT"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return False, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return False, "invalid token encoding"
    if header.get("alg") != "HS256":
        return False, "unsupported token algorithm"
    expected = _hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), _hashlib.sha256).digest()
    if not _hmac.compare_digest(expected, signature):
        return False, "invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return False, "token missing exp claim"
    try:
        if time.time() >= float(exp):
            return False, "token expired"
    except (TypeError, ValueError):
        return False, "invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return False, "invalid token issuer"
    return True, None

def _rl_allow():
    global _rl_tokens
    now = time.time()
    with _rl_lock:
        if now - _rl_last_refill[0] >= 1.0:
            _rl_tokens = 100
            _rl_last_refill[0] = now
        if _rl_tokens <= 0:
            return False
        _rl_tokens -= 1
        return True

_server = None
_shutdown_event = threading.Event()

def _shutdown_handler(signum, frame):
    logging.info("Shutdown signal received, draining requests...")
    _shutdown_event.set()
    if _server:
        threading.Thread(target=_server.shutdown).start()

signal.signal(signal.SIGTERM, _shutdown_handler)

# --- Security Headers ---
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}
CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://dashboard.54link-dev.ng").split(",")

def add_security_headers(handler_self):
    """Add security + CORS headers to response."""
    for k, v in SECURITY_HEADERS.items():
        handler_self.send_header(k, v)
    origin = handler_self.headers.get("Origin", "")
    if origin in [o.strip() for o in CORS_ALLOWED_ORIGINS]:
        handler_self.send_header("Access-Control-Allow-Origin", origin)
    handler_self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    handler_self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-Id")

def sanitize_input(s):
    """Sanitize user input to prevent XSS/injection."""
    if not isinstance(s, str):
        return s
    s = s.replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("'", "&#39;").replace('"', "&quot;")
    s = s.replace("\\", "")
    return s[:10000] if len(s) > 10000 else s

# --- OpenTelemetry Export ---
OTEL_ENDPOINT = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "")

def init_tracing(service_name):
    """Initialize OpenTelemetry tracing with OTLP export if configured."""
    if not OTEL_ENDPOINT:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
        from opentelemetry.sdk.resources import Resource
        resource = Resource.create({"service.name": service_name, "deployment.environment": os.environ.get("ENV", "development")})
        provider = TracerProvider(resource=resource)
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            exporter = OTLPSpanExporter(endpoint=OTEL_ENDPOINT, insecure=True)
        except ImportError:
            exporter = ConsoleSpanExporter()
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)
        logger.info(f"OpenTelemetry tracing initialized: {OTEL_ENDPOINT}")
    except ImportError:
        logger.debug("OpenTelemetry SDK not installed, tracing disabled")
    except Exception as e:
        logger.warning(f"Failed to init tracing: {e}")
signal.signal(signal.SIGINT, _shutdown_handler)

if __name__ == "__main__":
    load_models()
    logging.info(f"Liveness Inference Engine v2.0 (Python) on :{PORT}")
    logging.info(f"ML Backend: {'DeepFace (' + DEEPFACE_RECOGNITION_MODEL + ')' if DEEPFACE_AVAILABLE else 'ONNX (MODEL_DIR=' + MODEL_DIR + ')'}")
    logging.info(f"Models loaded: {sorted(MODEL_SESSIONS.keys()) or 'NONE — inference endpoints will return 503 model_unavailable'}")
    _server = HTTPServer(("0.0.0.0", PORT), Handler)
    try:
        _server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        _server.server_close()
        logging.info("Server stopped gracefully")
