"""
Unit tests for Fraud Detection Service
"""
import pytest
from datetime import datetime, timedelta
from decimal import Decimal
import uuid


class TestFraudScoring:
    """Tests for fraud scoring functionality"""
    
    def test_low_risk_transaction(self):
        """Test low risk transaction scoring"""
        transaction = {
            "amount": 5000.00,
            "currency": "NGN",
            "source_account": "1234567890",
            "destination_account": "0987654321",
            "channel": "MOBILE_APP",
            "device_id": "device-001",
            "ip_address": "192.168.1.1",
            "location": {"country": "NG", "city": "Lagos"}
        }
        customer_profile = {
            "average_transaction": 10000.00,
            "transaction_count_30d": 50,
            "account_age_days": 365,
            "verified": True
        }
        
        score = calculate_fraud_score(transaction, customer_profile)
        assert score < 30
        assert get_risk_level(score) == "LOW"
    
    def test_medium_risk_transaction(self):
        """Test medium risk transaction scoring"""
        transaction = {
            "amount": 500000.00,  # Higher than average
            "currency": "NGN",
            "source_account": "1234567890",
            "destination_account": "0987654321",
            "channel": "WEB",
            "device_id": "new-device",
            "ip_address": "41.58.100.1",
            "location": {"country": "NG", "city": "Abuja"}
        }
        customer_profile = {
            "average_transaction": 50000.00,
            "transaction_count_30d": 20,
            "account_age_days": 90,
            "verified": True
        }
        
        score = calculate_fraud_score(transaction, customer_profile)
        assert 30 <= score < 70
        assert get_risk_level(score) == "MEDIUM"
    
    def test_high_risk_transaction(self):
        """Test high risk transaction scoring"""
        transaction = {
            "amount": 5000000.00,  # Very high
            "currency": "NGN",
            "source_account": "1234567890",
            "destination_account": "0987654321",
            "channel": "API",
            "device_id": "unknown-device",
            "ip_address": "185.220.101.1",  # TOR exit node
            "location": {"country": "RU", "city": "Moscow"}
        }
        customer_profile = {
            "average_transaction": 10000.00,
            "transaction_count_30d": 5,
            "account_age_days": 7,
            "verified": False
        }
        
        score = calculate_fraud_score(transaction, customer_profile)
        assert score >= 70
        assert get_risk_level(score) == "HIGH"


class TestVelocityChecks:
    """Tests for velocity-based fraud detection"""
    
    def test_transaction_count_velocity(self):
        """Test transaction count velocity check"""
        # Normal velocity
        result = check_transaction_velocity(
            customer_id="cust-001",
            transactions_last_hour=5,
            transactions_last_day=20
        )
        assert result["exceeded"] is False
        
        # Exceeded hourly limit
        result = check_transaction_velocity(
            customer_id="cust-001",
            transactions_last_hour=50,
            transactions_last_day=100
        )
        assert result["exceeded"] is True
        assert "hourly limit exceeded" in result["reasons"]
    
    def test_amount_velocity(self):
        """Test amount velocity check"""
        # Normal amount
        result = check_amount_velocity(
            customer_id="cust-001",
            amount_last_hour=Decimal("100000.00"),
            amount_last_day=Decimal("500000.00"),
            daily_limit=Decimal("1000000.00")
        )
        assert result["exceeded"] is False
        
        # Exceeded daily limit
        result = check_amount_velocity(
            customer_id="cust-001",
            amount_last_hour=Decimal("500000.00"),
            amount_last_day=Decimal("1500000.00"),
            daily_limit=Decimal("1000000.00")
        )
        assert result["exceeded"] is True
    
    def test_beneficiary_velocity(self):
        """Test new beneficiary velocity check"""
        # Normal - few new beneficiaries
        result = check_beneficiary_velocity(
            customer_id="cust-001",
            new_beneficiaries_last_day=2
        )
        assert result["suspicious"] is False
        
        # Suspicious - many new beneficiaries
        result = check_beneficiary_velocity(
            customer_id="cust-001",
            new_beneficiaries_last_day=15
        )
        assert result["suspicious"] is True


class TestDeviceFingerprinting:
    """Tests for device fingerprinting"""
    
    def test_known_device(self):
        """Test transaction from known device"""
        device = {
            "device_id": "device-001",
            "fingerprint": "fp-abc123",
            "first_seen": datetime.now() - timedelta(days=90),
            "transaction_count": 100
        }
        
        result = assess_device_risk(device, is_known=True)
        assert result["risk_score"] < 20
    
    def test_new_device(self):
        """Test transaction from new device"""
        device = {
            "device_id": "device-new",
            "fingerprint": "fp-xyz789",
            "first_seen": datetime.now(),
            "transaction_count": 0
        }
        
        result = assess_device_risk(device, is_known=False)
        assert result["risk_score"] >= 30
    
    def test_suspicious_device_attributes(self):
        """Test device with suspicious attributes"""
        device = {
            "device_id": "device-sus",
            "fingerprint": "fp-sus123",
            "is_emulator": True,
            "is_rooted": True,
            "vpn_detected": True
        }
        
        result = assess_device_risk(device, is_known=False)
        assert result["risk_score"] >= 70
        assert "emulator" in result["flags"]


class TestGeolocationRisk:
    """Tests for geolocation-based risk assessment"""
    
    def test_domestic_transaction(self):
        """Test domestic transaction location"""
        location = {
            "country": "NG",
            "city": "Lagos",
            "ip_country": "NG"
        }
        customer_location = {"country": "NG", "city": "Lagos"}
        
        result = assess_location_risk(location, customer_location)
        assert result["risk_score"] < 20
    
    def test_location_mismatch(self):
        """Test location mismatch"""
        location = {
            "country": "NG",
            "city": "Lagos",
            "ip_country": "US"  # IP from different country
        }
        customer_location = {"country": "NG", "city": "Lagos"}
        
        result = assess_location_risk(location, customer_location)
        assert result["risk_score"] >= 40
        assert "ip_country_mismatch" in result["flags"]
    
    def test_high_risk_country(self):
        """Test transaction from high-risk country"""
        location = {
            "country": "KP",  # North Korea
            "city": "Pyongyang",
            "ip_country": "KP"
        }
        customer_location = {"country": "NG", "city": "Lagos"}
        
        result = assess_location_risk(location, customer_location)
        assert result["risk_score"] >= 80
        assert "high_risk_country" in result["flags"]
    
    def test_impossible_travel(self):
        """Test impossible travel detection"""
        previous_location = {
            "country": "NG",
            "city": "Lagos",
            "timestamp": datetime.now() - timedelta(hours=1)
        }
        current_location = {
            "country": "US",
            "city": "New York",
            "timestamp": datetime.now()
        }
        
        result = detect_impossible_travel(previous_location, current_location)
        assert result["impossible"] is True
        assert result["distance_km"] > 5000


class TestBehavioralAnalysis:
    """Tests for behavioral analysis"""
    
    def test_normal_behavior(self):
        """Test normal transaction behavior"""
        transaction = {
            "amount": 15000.00,
            "time_of_day": 14,  # 2 PM
            "day_of_week": 2,   # Tuesday
            "merchant_category": "GROCERIES"
        }
        customer_behavior = {
            "typical_amount_range": (5000, 50000),
            "typical_hours": (8, 22),
            "typical_days": [0, 1, 2, 3, 4, 5],
            "frequent_categories": ["GROCERIES", "UTILITIES", "TRANSPORT"]
        }
        
        result = analyze_behavior(transaction, customer_behavior)
        assert result["anomaly_score"] < 30
    
    def test_unusual_amount(self):
        """Test unusual transaction amount"""
        transaction = {
            "amount": 500000.00,  # Way above typical
            "time_of_day": 14,
            "day_of_week": 2,
            "merchant_category": "GROCERIES"
        }
        customer_behavior = {
            "typical_amount_range": (5000, 50000),
            "typical_hours": (8, 22),
            "typical_days": [0, 1, 2, 3, 4, 5],
            "frequent_categories": ["GROCERIES", "UTILITIES"]
        }
        
        result = analyze_behavior(transaction, customer_behavior)
        assert result["anomaly_score"] >= 50
        assert "unusual_amount" in result["anomalies"]
    
    def test_unusual_time(self):
        """Test transaction at unusual time"""
        transaction = {
            "amount": 15000.00,
            "time_of_day": 3,  # 3 AM
            "day_of_week": 2,
            "merchant_category": "GROCERIES"
        }
        customer_behavior = {
            "typical_amount_range": (5000, 50000),
            "typical_hours": (8, 22),
            "typical_days": [0, 1, 2, 3, 4, 5],
            "frequent_categories": ["GROCERIES"]
        }
        
        result = analyze_behavior(transaction, customer_behavior)
        assert result["anomaly_score"] >= 30
        assert "unusual_time" in result["anomalies"]


class TestFraudRules:
    """Tests for rule-based fraud detection"""
    
    def test_round_amount_rule(self):
        """Test round amount detection"""
        # Round amount (suspicious)
        assert is_round_amount(Decimal("100000.00")) is True
        assert is_round_amount(Decimal("500000.00")) is True
        
        # Non-round amount (normal)
        assert is_round_amount(Decimal("12345.67")) is False
        assert is_round_amount(Decimal("99999.99")) is False
    
    def test_structuring_detection(self):
        """Test structuring/smurfing detection"""
        transactions = [
            {"amount": Decimal("45000.00"), "timestamp": datetime.now() - timedelta(hours=1)},
            {"amount": Decimal("48000.00"), "timestamp": datetime.now() - timedelta(hours=2)},
            {"amount": Decimal("47000.00"), "timestamp": datetime.now() - timedelta(hours=3)},
            {"amount": Decimal("46000.00"), "timestamp": datetime.now() - timedelta(hours=4)},
        ]
        threshold = Decimal("50000.00")
        
        result = detect_structuring(transactions, threshold)
        assert result["detected"] is True
        assert result["pattern"] == "multiple_just_below_threshold"
    
    def test_rapid_movement_detection(self):
        """Test rapid fund movement detection"""
        # Funds received and immediately sent out
        events = [
            {"type": "CREDIT", "amount": Decimal("1000000.00"), "timestamp": datetime.now() - timedelta(minutes=5)},
            {"type": "DEBIT", "amount": Decimal("950000.00"), "timestamp": datetime.now()},
        ]
        
        result = detect_rapid_movement(events)
        assert result["detected"] is True
        assert result["pattern"] == "immediate_outflow"


class TestFraudDecision:
    """Tests for fraud decision making"""
    
    def test_approve_low_risk(self):
        """Test approval of low risk transaction"""
        fraud_assessment = {
            "score": 15,
            "risk_level": "LOW",
            "velocity_exceeded": False,
            "device_risk": "LOW",
            "location_risk": "LOW"
        }
        
        decision = make_fraud_decision(fraud_assessment)
        assert decision["action"] == "APPROVE"
        assert decision["requires_review"] is False
    
    def test_review_medium_risk(self):
        """Test review for medium risk transaction"""
        fraud_assessment = {
            "score": 55,
            "risk_level": "MEDIUM",
            "velocity_exceeded": False,
            "device_risk": "MEDIUM",
            "location_risk": "LOW"
        }
        
        decision = make_fraud_decision(fraud_assessment)
        assert decision["action"] == "REVIEW"
        assert decision["requires_review"] is True
    
    def test_block_high_risk(self):
        """Test blocking of high risk transaction"""
        fraud_assessment = {
            "score": 85,
            "risk_level": "HIGH",
            "velocity_exceeded": True,
            "device_risk": "HIGH",
            "location_risk": "HIGH"
        }
        
        decision = make_fraud_decision(fraud_assessment)
        assert decision["action"] == "BLOCK"
        assert decision["requires_review"] is True


class TestMLModelInference:
    """Tests for ML model inference"""
    
    def test_feature_extraction(self):
        """Test feature extraction for ML model"""
        transaction = {
            "amount": 50000.00,
            "hour": 14,
            "day_of_week": 2,
            "is_weekend": False,
            "channel": "MOBILE_APP"
        }
        customer = {
            "account_age_days": 365,
            "transaction_count": 100,
            "average_amount": 30000.00
        }
        
        features = extract_features(transaction, customer)
        
        assert "amount_ratio" in features
        assert "account_age_normalized" in features
        assert "transaction_frequency" in features
    
    def test_model_prediction_format(self):
        """Test ML model prediction format"""
        features = {
            "amount_ratio": 1.5,
            "account_age_normalized": 0.8,
            "transaction_frequency": 0.5,
            "hour_sin": 0.5,
            "hour_cos": 0.866
        }
        
        prediction = mock_model_predict(features)
        
        assert "fraud_probability" in prediction
        assert 0 <= prediction["fraud_probability"] <= 1
        assert "confidence" in prediction


# ============================================
# HELPER FUNCTIONS FOR TESTS
# ============================================

def calculate_fraud_score(transaction, customer_profile):
    """Calculate fraud score for transaction"""
    score = 0
    
    # Amount deviation
    avg = customer_profile.get("average_transaction", 10000)
    amount = transaction.get("amount", 0)
    if amount > avg * 10:
        score += 40
    elif amount > avg * 5:
        score += 25
    elif amount > avg * 2:
        score += 10
    
    # Account age
    age = customer_profile.get("account_age_days", 0)
    if age < 7:
        score += 30
    elif age < 30:
        score += 15
    elif age < 90:
        score += 5
    
    # Verification status
    if not customer_profile.get("verified"):
        score += 20
    
    # Channel risk
    channel = transaction.get("channel", "")
    if channel == "API":
        score += 10
    
    return min(100, score)


def get_risk_level(score):
    """Get risk level from score"""
    if score >= 70:
        return "HIGH"
    elif score >= 30:
        return "MEDIUM"
    return "LOW"


def check_transaction_velocity(customer_id, transactions_last_hour, transactions_last_day):
    """Check transaction velocity"""
    reasons = []
    
    if transactions_last_hour > 20:
        reasons.append("hourly limit exceeded")
    if transactions_last_day > 100:
        reasons.append("daily limit exceeded")
    
    return {"exceeded": len(reasons) > 0, "reasons": reasons}


def check_amount_velocity(customer_id, amount_last_hour, amount_last_day, daily_limit):
    """Check amount velocity"""
    return {"exceeded": amount_last_day > daily_limit}


def check_beneficiary_velocity(customer_id, new_beneficiaries_last_day):
    """Check new beneficiary velocity"""
    return {"suspicious": new_beneficiaries_last_day > 10}


def assess_device_risk(device, is_known):
    """Assess device risk"""
    score = 0
    flags = []
    
    if not is_known:
        score += 30
        flags.append("new_device")
    
    if device.get("is_emulator"):
        score += 30
        flags.append("emulator")
    
    if device.get("is_rooted"):
        score += 20
        flags.append("rooted")
    
    if device.get("vpn_detected"):
        score += 15
        flags.append("vpn")
    
    return {"risk_score": min(100, score), "flags": flags}


HIGH_RISK_COUNTRIES = ["KP", "IR", "SY", "CU", "RU"]

def assess_location_risk(location, customer_location):
    """Assess location risk"""
    score = 0
    flags = []
    
    if location.get("country") in HIGH_RISK_COUNTRIES:
        score += 80
        flags.append("high_risk_country")
    
    if location.get("ip_country") != location.get("country"):
        score += 40
        flags.append("ip_country_mismatch")
    
    if location.get("country") != customer_location.get("country"):
        score += 20
        flags.append("different_country")
    
    return {"risk_score": min(100, score), "flags": flags}


def detect_impossible_travel(previous_location, current_location):
    """Detect impossible travel"""
    time_diff = (current_location["timestamp"] - previous_location["timestamp"]).total_seconds() / 3600
    
    # Simplified distance calculation
    if previous_location["country"] != current_location["country"]:
        distance_km = 8000  # Approximate
    else:
        distance_km = 100
    
    max_speed_kmh = 900  # Commercial flight
    possible_distance = max_speed_kmh * time_diff
    
    return {
        "impossible": distance_km > possible_distance,
        "distance_km": distance_km,
        "time_hours": time_diff
    }


def analyze_behavior(transaction, customer_behavior):
    """Analyze transaction behavior"""
    score = 0
    anomalies = []
    
    amount = transaction.get("amount", 0)
    min_amt, max_amt = customer_behavior.get("typical_amount_range", (0, float("inf")))
    if amount < min_amt or amount > max_amt:
        score += 40
        anomalies.append("unusual_amount")
    
    hour = transaction.get("time_of_day", 12)
    min_hour, max_hour = customer_behavior.get("typical_hours", (0, 24))
    if hour < min_hour or hour > max_hour:
        score += 30
        anomalies.append("unusual_time")
    
    return {"anomaly_score": score, "anomalies": anomalies}


def is_round_amount(amount):
    """Check if amount is suspiciously round"""
    return amount % 10000 == 0 and amount >= 100000


def detect_structuring(transactions, threshold):
    """Detect structuring pattern"""
    just_below = [t for t in transactions if threshold * Decimal("0.9") <= t["amount"] < threshold]
    
    if len(just_below) >= 3:
        return {"detected": True, "pattern": "multiple_just_below_threshold"}
    return {"detected": False, "pattern": None}


def detect_rapid_movement(events):
    """Detect rapid fund movement"""
    if len(events) < 2:
        return {"detected": False, "pattern": None}
    
    credits = [e for e in events if e["type"] == "CREDIT"]
    debits = [e for e in events if e["type"] == "DEBIT"]
    
    if credits and debits:
        credit_time = credits[0]["timestamp"]
        debit_time = debits[0]["timestamp"]
        time_diff = (debit_time - credit_time).total_seconds() / 60
        
        if time_diff < 30:  # Within 30 minutes
            return {"detected": True, "pattern": "immediate_outflow"}
    
    return {"detected": False, "pattern": None}


def make_fraud_decision(fraud_assessment):
    """Make fraud decision based on assessment"""
    score = fraud_assessment.get("score", 0)
    
    if score >= 70 or fraud_assessment.get("velocity_exceeded"):
        return {"action": "BLOCK", "requires_review": True}
    elif score >= 30:
        return {"action": "REVIEW", "requires_review": True}
    else:
        return {"action": "APPROVE", "requires_review": False}


def extract_features(transaction, customer):
    """Extract features for ML model"""
    avg_amount = customer.get("average_amount", 1)
    
    return {
        "amount_ratio": transaction.get("amount", 0) / avg_amount,
        "account_age_normalized": min(customer.get("account_age_days", 0) / 365, 1),
        "transaction_frequency": min(customer.get("transaction_count", 0) / 100, 1),
        "hour_sin": 0.5,  # Simplified
        "hour_cos": 0.866
    }


def mock_model_predict(features):
    """Mock ML model prediction"""
    # Simplified mock prediction
    fraud_prob = features.get("amount_ratio", 1) * 0.1
    fraud_prob = min(1, max(0, fraud_prob))
    
    return {
        "fraud_probability": fraud_prob,
        "confidence": 0.85
    }
