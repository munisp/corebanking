"""
54link-dev Fraud Detection Model
Real-time fraud detection using ensemble machine learning

Features:
- Transaction velocity analysis
- Geolocation anomaly detection
- Device fingerprinting
- Behavioral pattern analysis
- Network graph analysis for money laundering
"""

import numpy as np
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import hashlib
import math
import logging
import os
import json

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(row.get(self.key, "")), row.get(self.tenant_key),
                          json.dumps(row, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


# W12-C3P2B5 stores: per-user behavioral state + fraud blacklists.
_W12_STATE_STORE = _W12Store("fraud_user_state")
_W12_BL_STORE = _W12Store("fraud_blacklists")

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Transaction:
    transaction_id: str
    user_id: str
    amount: float
    currency: str
    merchant_category: str
    merchant_id: str
    device_id: str
    ip_address: str
    latitude: Optional[float]
    longitude: Optional[float]
    timestamp: datetime
    channel: str  # mobile, web, pos, atm
    recipient_id: Optional[str] = None
    is_international: bool = False


@dataclass
class FraudScore:
    score: float  # 0-100, higher = more likely fraud
    risk_level: RiskLevel
    reasons: List[str]
    recommended_action: str
    confidence: float


class FraudDetectionModel:
    """
    Ensemble fraud detection model combining multiple signals:
    1. Rule-based checks (velocity, amount limits)
    2. Statistical anomaly detection (Isolation Forest-like)
    3. Behavioral analysis (user patterns)
    4. Network analysis (suspicious connections)
    """

    def __init__(self):
        # Thresholds (configurable per tenant)
        self.velocity_window_minutes = 60
        self.max_transactions_per_hour = 20
        self.max_amount_per_hour = 500000  # NGN
        self.max_single_transaction = 1000000  # NGN
        self.suspicious_hours = [0, 1, 2, 3, 4, 5]  # 12am - 6am
        
        # W12-C3P2B5: user behavior (fraud_user_state) and blacklists
        # (fraud_blacklists) are PG-backed. The structures below are short-TTL
        # read-through caches ONLY; Postgres is authoritative.
        self._state_cache: Dict[str, Tuple[float, list, dict]] = {}
        self._state_cache_lock = _w12_threading.Lock()
        self._blacklist_cache: Dict[str, object] = {"ts": 0.0, "data": {"ip": set(), "device": set(), "merchant": set()}}
        
        # Model weights for ensemble
        self.weights = {
            'velocity': 0.20,
            'amount': 0.15,
            'location': 0.20,
            'device': 0.15,
            'behavior': 0.20,
            'network': 0.10,
        }

    # --- W12-C3P2B5: PG-backed fraud state (fraud_user_state, fraud_blacklists) ---
    _STATE_TTL = 10.0   # read-through cache seconds; PG is authoritative
    _BL_TTL = 60.0

    def _user_state_row(self, user_id: str) -> Tuple[list, dict]:
        """Load (history, profile) from PG fraud_user_state.

        W12-DEGRADED fallback: on PG read failure scoring continues with empty
        state (logged) — fraud checks degrade to rule-only rather than 5xx."""
        now = datetime.utcnow().timestamp()
        with self._state_cache_lock:
            hit = self._state_cache.get(user_id)
            if hit and now - hit[0] < self._STATE_TTL:
                return hit[1], hit[2]
        try:
            _W12_STATE_STORE.ensure()
            row = _w12_run("SELECT payload FROM fraud_user_state WHERE record_id = %s",
                           (user_id,), fetch="one")
        except Exception as e:
            logger.warning("W12-DEGRADED fraud_user_state read failed for %s: %s", user_id, e)
            return [], {}
        hist, prof = [], {}
        if row:
            p = row["payload"]
            for d in p.get("history", []):
                try:
                    dd = dict(d)
                    dd["timestamp"] = datetime.fromisoformat(dd["timestamp"])
                    hist.append(Transaction(**dd))
                except Exception:
                    continue
            prof = p.get("profile", {})
            for k in ("known_devices", "common_merchant_categories", "common_channels"):
                prof[k] = set(prof.get(k, []))
        with self._state_cache_lock:
            self._state_cache[user_id] = (now, hist, prof)
        return hist, prof

    def _user_history(self, user_id: str) -> list:
        return self._user_state_row(user_id)[0]

    def _user_profile(self, user_id: str) -> dict:
        return self._user_state_row(user_id)[1]

    def _blacklist(self, kind: str) -> set:
        """Read-through set from PG fraud_blacklists (60s TTL cache; PG authoritative)."""
        now = datetime.utcnow().timestamp()
        if now - float(self._blacklist_cache["ts"]) < self._BL_TTL:
            return self._blacklist_cache["data"][kind]
        try:
            _W12_BL_STORE.ensure()
            rows = _w12_run("SELECT record_id FROM fraud_blacklists")
            data = {"ip": set(), "device": set(), "merchant": set()}
            for r in rows:
                k, _, v = r["record_id"].partition(":")
                if k in data:
                    data[k].add(v)
            self._blacklist_cache = {"ts": now, "data": data}
        except Exception as e:
            logger.warning("W12-DEGRADED fraud_blacklists read failed: %s", e)
        return self._blacklist_cache["data"][kind]

    def _blacklist_add(self, kind: str, value: str):
        """Idempotent add (ON CONFLICT DO UPDATE) + cache invalidation."""
        try:
            _W12_BL_STORE.put(f"{kind}:{value}", {"kind": kind, "value": value})
        except Exception as e:
            logger.warning("W12-DEGRADED fraud_blacklists write failed: %s", e)
        self._blacklist_cache["ts"] = 0.0
        self._blacklist_cache["data"].setdefault(kind, set()).add(value)

    def predict(self, transaction: Transaction) -> FraudScore:
        """
        Main prediction method - returns fraud score and risk assessment
        """
        scores = {}
        reasons = []
        
        # 1. Velocity Analysis
        velocity_score, velocity_reasons = self._check_velocity(transaction)
        scores['velocity'] = velocity_score
        reasons.extend(velocity_reasons)
        
        # 2. Amount Analysis
        amount_score, amount_reasons = self._check_amount(transaction)
        scores['amount'] = amount_score
        reasons.extend(amount_reasons)
        
        # 3. Location Analysis
        location_score, location_reasons = self._check_location(transaction)
        scores['location'] = location_score
        reasons.extend(location_reasons)
        
        # 4. Device Analysis
        device_score, device_reasons = self._check_device(transaction)
        scores['device'] = device_score
        reasons.extend(device_reasons)
        
        # 5. Behavioral Analysis
        behavior_score, behavior_reasons = self._check_behavior(transaction)
        scores['behavior'] = behavior_score
        reasons.extend(behavior_reasons)
        
        # 6. Network Analysis
        network_score, network_reasons = self._check_network(transaction)
        scores['network'] = network_score
        reasons.extend(network_reasons)
        
        # Calculate weighted ensemble score
        final_score = sum(
            scores[key] * self.weights[key] 
            for key in scores
        )
        
        # Determine risk level
        risk_level = self._get_risk_level(final_score)
        
        # Determine recommended action
        action = self._get_recommended_action(risk_level, reasons)
        
        # Calculate confidence based on data availability
        confidence = self._calculate_confidence(transaction)
        
        # Update user history
        self._update_user_history(transaction)
        
        return FraudScore(
            score=round(final_score, 2),
            risk_level=risk_level,
            reasons=reasons,
            recommended_action=action,
            confidence=confidence
        )

    def _check_velocity(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check transaction velocity (frequency and volume)"""
        score = 0.0
        reasons = []
        
        user_txns = self._user_history(txn.user_id)
        recent_txns = [
            t for t in user_txns
            if (txn.timestamp - t.timestamp) < timedelta(minutes=self.velocity_window_minutes)
        ]
        
        # Check transaction count
        if len(recent_txns) >= self.max_transactions_per_hour:
            score += 50
            reasons.append(f"High transaction frequency: {len(recent_txns)} in last hour")
        elif len(recent_txns) >= self.max_transactions_per_hour * 0.7:
            score += 25
            reasons.append(f"Elevated transaction frequency: {len(recent_txns)} in last hour")
        
        # Check total amount
        total_amount = sum(t.amount for t in recent_txns) + txn.amount
        if total_amount >= self.max_amount_per_hour:
            score += 50
            reasons.append(f"High transaction volume: {total_amount:,.2f} NGN in last hour")
        elif total_amount >= self.max_amount_per_hour * 0.7:
            score += 25
            reasons.append(f"Elevated transaction volume: {total_amount:,.2f} NGN in last hour")
        
        return min(score, 100), reasons

    def _check_amount(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check transaction amount anomalies"""
        score = 0.0
        reasons = []
        
        # Check against absolute limits
        if txn.amount >= self.max_single_transaction:
            score += 40
            reasons.append(f"Large transaction amount: {txn.amount:,.2f} NGN")
        
        # Check against user's typical amounts
        user_profile = self._user_profile(txn.user_id)
        avg_amount = user_profile.get('avg_transaction_amount', txn.amount)
        std_amount = user_profile.get('std_transaction_amount', txn.amount * 0.5)
        
        if std_amount > 0:
            z_score = (txn.amount - avg_amount) / std_amount
            if z_score > 3:
                score += 40
                reasons.append(f"Amount significantly higher than usual (z-score: {z_score:.2f})")
            elif z_score > 2:
                score += 20
                reasons.append(f"Amount higher than usual (z-score: {z_score:.2f})")
        
        # Round number check (common in fraud)
        if txn.amount >= 10000 and txn.amount % 10000 == 0:
            score += 10
            reasons.append("Suspiciously round amount")
        
        return min(score, 100), reasons

    def _check_location(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check location anomalies"""
        score = 0.0
        reasons = []
        
        if txn.latitude is None or txn.longitude is None:
            return 20, ["Location data unavailable"]
        
        user_txns = self._user_history(txn.user_id)
        if not user_txns:
            return 0, []
        
        # Get last transaction with location
        last_txn_with_loc = None
        for t in reversed(user_txns):
            if t.latitude is not None and t.longitude is not None:
                last_txn_with_loc = t
                break
        
        if last_txn_with_loc:
            # Calculate distance
            distance_km = self._haversine_distance(
                txn.latitude, txn.longitude,
                last_txn_with_loc.latitude, last_txn_with_loc.longitude
            )
            
            # Calculate time difference
            time_diff_hours = (txn.timestamp - last_txn_with_loc.timestamp).total_seconds() / 3600
            
            if time_diff_hours > 0:
                # Check if travel is physically possible (max 900 km/h for flights)
                max_possible_distance = time_diff_hours * 900
                
                if distance_km > max_possible_distance:
                    score += 80
                    reasons.append(f"Impossible travel: {distance_km:.0f}km in {time_diff_hours:.1f}h")
                elif distance_km > 500 and time_diff_hours < 2:
                    score += 40
                    reasons.append(f"Suspicious travel: {distance_km:.0f}km in {time_diff_hours:.1f}h")
        
        # Check if international
        if txn.is_international:
            user_profile = self._user_profile(txn.user_id)
            if not user_profile.get('has_international_history', False):
                score += 30
                reasons.append("First international transaction")
        
        return min(score, 100), reasons

    def _check_device(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check device and IP anomalies"""
        score = 0.0
        reasons = []
        
        # Check blacklists
        if txn.device_id in self._blacklist("device"):
            score += 90
            reasons.append("Device on blacklist")
        
        if txn.ip_address in self._blacklist("ip"):
            score += 90
            reasons.append("IP address on blacklist")
        
        # Check for new device
        user_profile = self._user_profile(txn.user_id)
        known_devices = user_profile.get('known_devices', set())
        
        if txn.device_id not in known_devices:
            score += 30
            reasons.append("New device detected")
        
        # Check for VPN/proxy indicators (simplified)
        if self._is_suspicious_ip(txn.ip_address):
            score += 40
            reasons.append("Suspicious IP (possible VPN/proxy)")
        
        return min(score, 100), reasons

    def _check_behavior(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check behavioral anomalies"""
        score = 0.0
        reasons = []
        
        # Check time of day
        hour = txn.timestamp.hour
        if hour in self.suspicious_hours:
            score += 20
            reasons.append(f"Unusual transaction time: {hour}:00")
        
        # Check merchant category
        user_profile = self._user_profile(txn.user_id)
        common_categories = user_profile.get('common_merchant_categories', set())
        
        if common_categories and txn.merchant_category not in common_categories:
            score += 15
            reasons.append(f"Unusual merchant category: {txn.merchant_category}")
        
        # Check channel
        common_channels = user_profile.get('common_channels', set())
        if common_channels and txn.channel not in common_channels:
            score += 15
            reasons.append(f"Unusual channel: {txn.channel}")
        
        # Check for suspicious merchant
        if txn.merchant_id in self._blacklist("merchant"):
            score += 50
            reasons.append("Merchant flagged as suspicious")
        
        return min(score, 100), reasons

    def _check_network(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check network/graph-based anomalies (money laundering patterns)"""
        score = 0.0
        reasons = []
        
        if not txn.recipient_id:
            return 0, []
        
        # Check for circular transactions (simplified)
        user_txns = self._user_history(txn.user_id)
        
        # Check if recipient has sent money back recently
        for t in user_txns:
            if t.recipient_id == txn.user_id:
                time_diff = (txn.timestamp - t.timestamp).total_seconds() / 3600
                if time_diff < 24:
                    score += 40
                    reasons.append("Circular transaction pattern detected")
                    break
        
        # Check for rapid fund movement (layering)
        recent_recipients = set()
        for t in user_txns[-10:]:
            if t.recipient_id:
                recent_recipients.add(t.recipient_id)
        
        if len(recent_recipients) >= 5:
            score += 30
            reasons.append(f"Multiple recipients in short time: {len(recent_recipients)}")
        
        return min(score, 100), reasons

    def _get_risk_level(self, score: float) -> RiskLevel:
        """Convert score to risk level"""
        if score >= 80:
            return RiskLevel.CRITICAL
        elif score >= 60:
            return RiskLevel.HIGH
        elif score >= 40:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _get_recommended_action(self, risk_level: RiskLevel, reasons: List[str]) -> str:
        """Get recommended action based on risk level"""
        if risk_level == RiskLevel.CRITICAL:
            return "BLOCK - Manual review required"
        elif risk_level == RiskLevel.HIGH:
            return "CHALLENGE - Request additional authentication"
        elif risk_level == RiskLevel.MEDIUM:
            return "MONITOR - Flag for review"
        else:
            return "ALLOW - Normal processing"

    def _calculate_confidence(self, txn: Transaction) -> float:
        """Calculate confidence in the prediction"""
        confidence = 0.5  # Base confidence
        
        # More history = higher confidence
        user_txns = self._user_history(txn.user_id)
        if len(user_txns) >= 100:
            confidence += 0.3
        elif len(user_txns) >= 50:
            confidence += 0.2
        elif len(user_txns) >= 10:
            confidence += 0.1
        
        # Location data available
        if txn.latitude is not None:
            confidence += 0.1
        
        # Device known
        user_profile = self._user_profile(txn.user_id)
        if txn.device_id in user_profile.get('known_devices', set()):
            confidence += 0.1
        
        return min(confidence, 1.0)

    def _update_user_history(self, txn: Transaction):
        """Update user transaction history + profile in PG (fraud_user_state).

        Read-modify-write of the user's row then a single upsert (one
        transaction). W12-DEGRADED: if the read failed (empty state from the
        degraded fallback AND PG still down) the write is skipped rather than
        clobbering stored history with a truncated list."""
        hist, profile = self._user_state_row(txn.user_id)
        hist.append(txn)
        # Keep only last 1000 transactions per user
        if len(hist) > 1000:
            hist = hist[-1000:]
        profile = self._update_user_profile(txn, profile)
        payload = {
            "history": [
                {**{f: getattr(t, f) for f in Transaction.__dataclass_fields__ if f != "timestamp"},
                 "timestamp": t.timestamp.isoformat()}
                for t in hist
            ],
            "profile": {k: (sorted(v) if isinstance(v, set) else v) for k, v in profile.items()},
        }
        try:
            _W12_STATE_STORE.put(txn.user_id, payload)
        except Exception as e:
            logger.warning("W12-DEGRADED fraud_user_state write failed for %s: %s", txn.user_id, e)
        with self._state_cache_lock:
            self._state_cache[txn.user_id] = (datetime.utcnow().timestamp(), hist, profile)

    def _update_user_profile(self, txn: Transaction, profile: dict = None) -> dict:
        """Update user profile with new transaction data (pure; caller persists)."""
        if not profile:
            profile = {
                'known_devices': set(),
                'common_merchant_categories': set(),
                'common_channels': set(),
                'avg_transaction_amount': 0,
                'std_transaction_amount': 0,
                'transaction_count': 0,
                'has_international_history': False,
            }

        profile['known_devices'].add(txn.device_id)
        profile['common_merchant_categories'].add(txn.merchant_category)
        profile['common_channels'].add(txn.channel)

        if txn.is_international:
            profile['has_international_history'] = True

        # Update running average and std
        n = profile['transaction_count']
        old_avg = profile['avg_transaction_amount']

        profile['transaction_count'] = n + 1
        profile['avg_transaction_amount'] = old_avg + (txn.amount - old_avg) / (n + 1)

        if n > 0:
            # Welford's algorithm for running std
            profile['std_transaction_amount'] = math.sqrt(
                ((n - 1) * profile['std_transaction_amount'] ** 2 +
                 (txn.amount - old_avg) * (txn.amount - profile['avg_transaction_amount'])) / n
            )
        return profile

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km"""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    def _is_suspicious_ip(self, ip: str) -> bool:
        """Check if IP is suspicious (simplified check)"""
        # In production, use IP reputation services
        suspicious_ranges = [
            '10.',  # Private
            '192.168.',  # Private
            '172.16.',  # Private
        ]
        return any(ip.startswith(r) for r in suspicious_ranges)

    def add_to_blacklist(self, item_type: str, value: str):
        """Add item to blacklist (PG fraud_blacklists; idempotent)."""
        if item_type in ("ip", "device", "merchant"):
            self._blacklist_add(item_type, value)

    def train_on_historical_data(self, transactions: List[Transaction], labels: List[bool]):
        """
        Train model on historical data
        In production, this would train actual ML models
        """
        # Update user profiles from historical data
        for txn in transactions:
            self._update_user_history(txn)
        
        # Calculate fraud patterns from labeled data
        fraud_txns = [t for t, is_fraud in zip(transactions, labels) if is_fraud]
        
        # Update suspicious merchants
        merchant_fraud_counts: Dict[str, int] = {}
        for txn in fraud_txns:
            merchant_fraud_counts[txn.merchant_id] = merchant_fraud_counts.get(txn.merchant_id, 0) + 1
        
        for merchant_id, count in merchant_fraud_counts.items():
            if count >= 5:  # Threshold for suspicious
                self._blacklist_add("merchant", merchant_id)
        
        logger.info(f"Trained on {len(transactions)} transactions, {len(fraud_txns)} fraud cases")


# Singleton instance
_fraud_model: Optional[FraudDetectionModel] = None


def get_fraud_model() -> FraudDetectionModel:
    """Get singleton fraud detection model"""
    global _fraud_model
    if _fraud_model is None:
        _fraud_model = FraudDetectionModel()
    return _fraud_model
