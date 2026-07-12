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
        
        # User behavior cache (in production, use Redis)
        self.user_history: Dict[str, List[Transaction]] = {}
        self.user_profiles: Dict[str, Dict] = {}
        
        # Known fraud patterns
        self.blacklisted_ips: set = set()
        self.blacklisted_devices: set = set()
        self.suspicious_merchants: set = set()
        
        # Model weights for ensemble
        self.weights = {
            'velocity': 0.20,
            'amount': 0.15,
            'location': 0.20,
            'device': 0.15,
            'behavior': 0.20,
            'network': 0.10,
        }

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
        
        user_txns = self.user_history.get(txn.user_id, [])
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
        user_profile = self.user_profiles.get(txn.user_id, {})
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
        
        user_txns = self.user_history.get(txn.user_id, [])
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
            user_profile = self.user_profiles.get(txn.user_id, {})
            if not user_profile.get('has_international_history', False):
                score += 30
                reasons.append("First international transaction")
        
        return min(score, 100), reasons

    def _check_device(self, txn: Transaction) -> Tuple[float, List[str]]:
        """Check device and IP anomalies"""
        score = 0.0
        reasons = []
        
        # Check blacklists
        if txn.device_id in self.blacklisted_devices:
            score += 90
            reasons.append("Device on blacklist")
        
        if txn.ip_address in self.blacklisted_ips:
            score += 90
            reasons.append("IP address on blacklist")
        
        # Check for new device
        user_profile = self.user_profiles.get(txn.user_id, {})
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
        user_profile = self.user_profiles.get(txn.user_id, {})
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
        if txn.merchant_id in self.suspicious_merchants:
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
        user_txns = self.user_history.get(txn.user_id, [])
        
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
        user_txns = self.user_history.get(txn.user_id, [])
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
        user_profile = self.user_profiles.get(txn.user_id, {})
        if txn.device_id in user_profile.get('known_devices', set()):
            confidence += 0.1
        
        return min(confidence, 1.0)

    def _update_user_history(self, txn: Transaction):
        """Update user transaction history"""
        if txn.user_id not in self.user_history:
            self.user_history[txn.user_id] = []
        
        self.user_history[txn.user_id].append(txn)
        
        # Keep only last 1000 transactions per user
        if len(self.user_history[txn.user_id]) > 1000:
            self.user_history[txn.user_id] = self.user_history[txn.user_id][-1000:]
        
        # Update user profile
        self._update_user_profile(txn)

    def _update_user_profile(self, txn: Transaction):
        """Update user profile with new transaction data"""
        if txn.user_id not in self.user_profiles:
            self.user_profiles[txn.user_id] = {
                'known_devices': set(),
                'common_merchant_categories': set(),
                'common_channels': set(),
                'avg_transaction_amount': 0,
                'std_transaction_amount': 0,
                'transaction_count': 0,
                'has_international_history': False,
            }
        
        profile = self.user_profiles[txn.user_id]
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
        """Add item to blacklist"""
        if item_type == 'ip':
            self.blacklisted_ips.add(value)
        elif item_type == 'device':
            self.blacklisted_devices.add(value)
        elif item_type == 'merchant':
            self.suspicious_merchants.add(value)

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
                self.suspicious_merchants.add(merchant_id)
        
        logger.info(f"Trained on {len(transactions)} transactions, {len(fraud_txns)} fraud cases")


# Singleton instance
_fraud_model: Optional[FraudDetectionModel] = None


def get_fraud_model() -> FraudDetectionModel:
    """Get singleton fraud detection model"""
    global _fraud_model
    if _fraud_model is None:
        _fraud_model = FraudDetectionModel()
    return _fraud_model
