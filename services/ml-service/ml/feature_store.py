"""
54link-dev ML Feature Store
Redis-backed feature store for ML models with shared user profiles and transaction aggregates

Features:
- Shared user profiles across all ML service pods
- Rolling window aggregates (1h, 24h, 7d, 30d)
- Feature versioning for training/serving consistency
- TTL-based expiration for old data
"""

import os
import json
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import asyncio

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

# Prometheus metrics
feature_store_ops = Counter(
    'feature_store_operations_total',
    'Total feature store operations',
    ['operation', 'status']
)

feature_store_latency = Histogram(
    'feature_store_latency_seconds',
    'Feature store operation latency',
    ['operation'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5]
)


class FeatureWindow(Enum):
    """Time windows for aggregated features"""
    HOUR_1 = "1h"
    HOUR_24 = "24h"
    DAY_7 = "7d"
    DAY_30 = "30d"


@dataclass
class UserProfile:
    """User profile with behavioral features for ML models"""
    user_id: str
    
    # Account info
    account_age_days: int = 0
    account_tier: str = "standard"
    kyc_level: int = 1
    
    # Transaction statistics (rolling)
    total_transactions: int = 0
    avg_transaction_amount: float = 0.0
    std_transaction_amount: float = 0.0
    max_transaction_amount: float = 0.0
    
    # Velocity features (per window)
    txn_count_1h: int = 0
    txn_count_24h: int = 0
    txn_count_7d: int = 0
    txn_count_30d: int = 0
    
    txn_amount_1h: float = 0.0
    txn_amount_24h: float = 0.0
    txn_amount_7d: float = 0.0
    txn_amount_30d: float = 0.0
    
    # Device/location features
    known_devices: List[str] = None
    known_ips: List[str] = None
    primary_location_lat: Optional[float] = None
    primary_location_lon: Optional[float] = None
    
    # Behavioral features
    common_merchant_categories: List[str] = None
    common_channels: List[str] = None
    typical_transaction_hours: List[int] = None
    has_international_history: bool = False
    
    # Risk indicators
    fraud_flags_30d: int = 0
    chargebacks_30d: int = 0
    failed_auth_attempts_7d: int = 0
    
    # Timestamps
    first_transaction_at: Optional[str] = None
    last_transaction_at: Optional[str] = None
    profile_updated_at: Optional[str] = None
    
    def __post_init__(self):
        if self.known_devices is None:
            self.known_devices = []
        if self.known_ips is None:
            self.known_ips = []
        if self.common_merchant_categories is None:
            self.common_merchant_categories = []
        if self.common_channels is None:
            self.common_channels = []
        if self.typical_transaction_hours is None:
            self.typical_transaction_hours = []


@dataclass
class TransactionFeatures:
    """Extracted features from a single transaction for ML scoring"""
    # Transaction attributes
    amount: float
    currency: str
    channel: str
    merchant_category: str
    is_international: bool
    
    # Time features
    hour_of_day: int
    day_of_week: int
    is_weekend: bool
    is_night: bool  # 12am-6am
    
    # Amount features (relative to user profile)
    amount_zscore: float
    amount_to_avg_ratio: float
    is_round_amount: bool
    
    # Velocity features (from user profile)
    txn_count_1h: int
    txn_count_24h: int
    amount_1h: float
    amount_24h: float
    velocity_1h_ratio: float  # current amount / avg hourly
    
    # Device/location features
    is_new_device: bool
    is_new_ip: bool
    distance_from_primary_km: Optional[float]
    is_impossible_travel: bool
    
    # Behavioral features
    is_unusual_category: bool
    is_unusual_channel: bool
    is_unusual_hour: bool
    
    # User profile features
    account_age_days: int
    total_transactions: int
    has_fraud_history: bool
    
    def to_vector(self) -> List[float]:
        """Convert to feature vector for ML model"""
        return [
            self.amount,
            self.hour_of_day,
            self.day_of_week,
            1.0 if self.is_weekend else 0.0,
            1.0 if self.is_night else 0.0,
            1.0 if self.is_international else 0.0,
            self.amount_zscore,
            self.amount_to_avg_ratio,
            1.0 if self.is_round_amount else 0.0,
            float(self.txn_count_1h),
            float(self.txn_count_24h),
            self.amount_1h,
            self.amount_24h,
            self.velocity_1h_ratio,
            1.0 if self.is_new_device else 0.0,
            1.0 if self.is_new_ip else 0.0,
            self.distance_from_primary_km or 0.0,
            1.0 if self.is_impossible_travel else 0.0,
            1.0 if self.is_unusual_category else 0.0,
            1.0 if self.is_unusual_channel else 0.0,
            1.0 if self.is_unusual_hour else 0.0,
            float(self.account_age_days),
            float(self.total_transactions),
            1.0 if self.has_fraud_history else 0.0,
        ]
    
    @staticmethod
    def feature_names() -> List[str]:
        """Get feature names for model interpretation"""
        return [
            "amount",
            "hour_of_day",
            "day_of_week",
            "is_weekend",
            "is_night",
            "is_international",
            "amount_zscore",
            "amount_to_avg_ratio",
            "is_round_amount",
            "txn_count_1h",
            "txn_count_24h",
            "amount_1h",
            "amount_24h",
            "velocity_1h_ratio",
            "is_new_device",
            "is_new_ip",
            "distance_from_primary_km",
            "is_impossible_travel",
            "is_unusual_category",
            "is_unusual_channel",
            "is_unusual_hour",
            "account_age_days",
            "total_transactions",
            "has_fraud_history",
        ]


class FeatureStore:
    """
    Redis-backed feature store for ML models
    
    Provides:
    - Shared user profiles across pods
    - Rolling window aggregates
    - Feature extraction for training and serving
    """
    
    _instance: Optional['FeatureStore'] = None
    
    def __init__(self):
        self.redis_url = os.getenv("REDIS_URL", "redis://redis-master:6379/0")
        self.prefix = os.getenv("FEATURE_STORE_PREFIX", "54link-dev:ml:features")
        self._client = None
        self._connected = False
        
        # TTLs for different data types
        self.profile_ttl = 86400 * 30  # 30 days
        self.aggregate_ttl = {
            FeatureWindow.HOUR_1: 3600,
            FeatureWindow.HOUR_24: 86400,
            FeatureWindow.DAY_7: 86400 * 7,
            FeatureWindow.DAY_30: 86400 * 30,
        }
        
        # Feature version for training/serving consistency
        self.feature_version = os.getenv("FEATURE_VERSION", "v1")
    
    @classmethod
    async def get_instance(cls) -> 'FeatureStore':
        """Get singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance.connect()
        return cls._instance
    
    async def connect(self) -> bool:
        """Connect to Redis"""
        if aioredis is None:
            logger.warning("redis.asyncio not available, feature store disabled")
            return False
        
        try:
            self._client = aioredis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            await self._client.ping()
            self._connected = True
            logger.info(f"Feature store connected to Redis: {self.redis_url}")
            return True
        except Exception as e:
            logger.error(f"Feature store connection failed: {e}")
            self._connected = False
            return False
    
    async def close(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._connected = False
    
    def _key(self, *parts: str) -> str:
        """Build Redis key"""
        return f"{self.prefix}:{':'.join(parts)}"
    
    async def get_user_profile(self, user_id: str) -> Optional[UserProfile]:
        """Get user profile from feature store"""
        if not self._connected:
            return None
        
        try:
            key = self._key("profile", user_id)
            data = await self._client.get(key)
            
            if data:
                profile_dict = json.loads(data)
                feature_store_ops.labels(operation="get_profile", status="hit").inc()
                return UserProfile(**profile_dict)
            
            feature_store_ops.labels(operation="get_profile", status="miss").inc()
            return None
            
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            feature_store_ops.labels(operation="get_profile", status="error").inc()
            return None
    
    async def save_user_profile(self, profile: UserProfile) -> bool:
        """Save user profile to feature store"""
        if not self._connected:
            return False
        
        try:
            profile.profile_updated_at = datetime.utcnow().isoformat()
            key = self._key("profile", profile.user_id)
            
            # Convert to dict, handling lists properly
            profile_dict = asdict(profile)
            
            await self._client.setex(
                key,
                self.profile_ttl,
                json.dumps(profile_dict)
            )
            
            feature_store_ops.labels(operation="save_profile", status="success").inc()
            return True
            
        except Exception as e:
            logger.error(f"Error saving user profile: {e}")
            feature_store_ops.labels(operation="save_profile", status="error").inc()
            return False
    
    async def update_user_profile_from_transaction(
        self,
        user_id: str,
        amount: float,
        device_id: str,
        ip_address: str,
        merchant_category: str,
        channel: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        is_international: bool = False,
        timestamp: Optional[datetime] = None
    ) -> UserProfile:
        """Update user profile with new transaction data"""
        timestamp = timestamp or datetime.utcnow()
        
        # Get existing profile or create new
        profile = await self.get_user_profile(user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id)
            profile.first_transaction_at = timestamp.isoformat()
        
        # Update transaction statistics using Welford's algorithm
        n = profile.total_transactions
        old_avg = profile.avg_transaction_amount
        
        profile.total_transactions = n + 1
        profile.avg_transaction_amount = old_avg + (amount - old_avg) / (n + 1)
        
        if n > 0:
            # Running standard deviation
            old_std = profile.std_transaction_amount
            profile.std_transaction_amount = (
                ((n - 1) * old_std ** 2 + (amount - old_avg) * (amount - profile.avg_transaction_amount)) / n
            ) ** 0.5
        
        profile.max_transaction_amount = max(profile.max_transaction_amount, amount)
        
        # Update known devices (keep last 10)
        if device_id and device_id not in profile.known_devices:
            profile.known_devices.append(device_id)
            profile.known_devices = profile.known_devices[-10:]
        
        # Update known IPs (keep last 20)
        if ip_address and ip_address not in profile.known_ips:
            profile.known_ips.append(ip_address)
            profile.known_ips = profile.known_ips[-20:]
        
        # Update common merchant categories (keep top 10)
        if merchant_category and merchant_category not in profile.common_merchant_categories:
            profile.common_merchant_categories.append(merchant_category)
            profile.common_merchant_categories = profile.common_merchant_categories[-10:]
        
        # Update common channels
        if channel and channel not in profile.common_channels:
            profile.common_channels.append(channel)
            profile.common_channels = profile.common_channels[-5:]
        
        # Update typical hours
        hour = timestamp.hour
        if hour not in profile.typical_transaction_hours:
            profile.typical_transaction_hours.append(hour)
            profile.typical_transaction_hours = profile.typical_transaction_hours[-12:]
        
        # Update location
        if latitude is not None and longitude is not None:
            if profile.primary_location_lat is None:
                profile.primary_location_lat = latitude
                profile.primary_location_lon = longitude
        
        # Update international history
        if is_international:
            profile.has_international_history = True
        
        profile.last_transaction_at = timestamp.isoformat()
        
        # Update velocity aggregates
        await self._update_velocity_aggregates(user_id, amount, timestamp)
        
        # Load velocity into profile
        profile = await self._load_velocity_into_profile(profile)
        
        # Save updated profile
        await self.save_user_profile(profile)
        
        return profile
    
    async def _update_velocity_aggregates(
        self,
        user_id: str,
        amount: float,
        timestamp: datetime
    ):
        """Update rolling window aggregates"""
        if not self._connected:
            return
        
        try:
            # Use Redis sorted sets for time-windowed aggregates
            # Score = timestamp, member = amount:txn_id
            
            ts = timestamp.timestamp()
            member = f"{amount}:{ts}"
            
            # Add to sorted set
            key = self._key("velocity", user_id)
            await self._client.zadd(key, {member: ts})
            
            # Set TTL (30 days max)
            await self._client.expire(key, 86400 * 30)
            
            # Clean up old entries (older than 30 days)
            cutoff = ts - (86400 * 30)
            await self._client.zremrangebyscore(key, "-inf", cutoff)
            
        except Exception as e:
            logger.error(f"Error updating velocity aggregates: {e}")
    
    async def _load_velocity_into_profile(self, profile: UserProfile) -> UserProfile:
        """Load velocity aggregates from Redis into profile"""
        if not self._connected:
            return profile
        
        try:
            key = self._key("velocity", profile.user_id)
            now = datetime.utcnow().timestamp()
            
            # Get counts and sums for each window
            windows = {
                "1h": 3600,
                "24h": 86400,
                "7d": 86400 * 7,
                "30d": 86400 * 30,
            }
            
            for window_name, seconds in windows.items():
                cutoff = now - seconds
                
                # Get all transactions in window
                members = await self._client.zrangebyscore(key, cutoff, now)
                
                count = len(members)
                total_amount = sum(float(m.split(":")[0]) for m in members)
                
                if window_name == "1h":
                    profile.txn_count_1h = count
                    profile.txn_amount_1h = total_amount
                elif window_name == "24h":
                    profile.txn_count_24h = count
                    profile.txn_amount_24h = total_amount
                elif window_name == "7d":
                    profile.txn_count_7d = count
                    profile.txn_amount_7d = total_amount
                elif window_name == "30d":
                    profile.txn_count_30d = count
                    profile.txn_amount_30d = total_amount
            
            return profile
            
        except Exception as e:
            logger.error(f"Error loading velocity aggregates: {e}")
            return profile
    
    async def extract_features(
        self,
        user_id: str,
        amount: float,
        currency: str,
        channel: str,
        merchant_category: str,
        device_id: str,
        ip_address: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        is_international: bool = False,
        timestamp: Optional[datetime] = None
    ) -> TransactionFeatures:
        """
        Extract features for a transaction
        
        This is the SINGLE source of truth for feature engineering.
        Used by both training pipeline and serving.
        """
        timestamp = timestamp or datetime.utcnow()
        
        # Get user profile
        profile = await self.get_user_profile(user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id)
        
        # Load latest velocity
        profile = await self._load_velocity_into_profile(profile)
        
        # Time features
        hour_of_day = timestamp.hour
        day_of_week = timestamp.weekday()
        is_weekend = day_of_week >= 5
        is_night = hour_of_day in [0, 1, 2, 3, 4, 5]
        
        # Amount features
        if profile.std_transaction_amount > 0:
            amount_zscore = (amount - profile.avg_transaction_amount) / profile.std_transaction_amount
        else:
            amount_zscore = 0.0
        
        if profile.avg_transaction_amount > 0:
            amount_to_avg_ratio = amount / profile.avg_transaction_amount
        else:
            amount_to_avg_ratio = 1.0
        
        is_round_amount = amount >= 10000 and amount % 10000 == 0
        
        # Velocity features
        if profile.txn_count_30d > 0:
            avg_hourly = profile.txn_amount_30d / (30 * 24)
            velocity_1h_ratio = profile.txn_amount_1h / max(avg_hourly, 1)
        else:
            velocity_1h_ratio = 1.0
        
        # Device/location features
        is_new_device = device_id not in profile.known_devices if device_id else True
        is_new_ip = ip_address not in profile.known_ips if ip_address else True
        
        # Distance calculation
        distance_from_primary_km = None
        is_impossible_travel = False
        
        if latitude and longitude and profile.primary_location_lat and profile.primary_location_lon:
            distance_from_primary_km = self._haversine_distance(
                latitude, longitude,
                profile.primary_location_lat, profile.primary_location_lon
            )
            
            # Check for impossible travel (if we have last transaction time)
            if profile.last_transaction_at:
                try:
                    last_ts = datetime.fromisoformat(profile.last_transaction_at)
                    hours_diff = (timestamp - last_ts).total_seconds() / 3600
                    if hours_diff > 0:
                        max_possible_km = hours_diff * 900  # Max flight speed
                        is_impossible_travel = distance_from_primary_km > max_possible_km
                except:
                    pass
        
        # Behavioral features
        is_unusual_category = merchant_category not in profile.common_merchant_categories if merchant_category else False
        is_unusual_channel = channel not in profile.common_channels if channel else False
        is_unusual_hour = hour_of_day not in profile.typical_transaction_hours
        
        # User profile features
        account_age_days = profile.account_age_days
        if profile.first_transaction_at:
            try:
                first_ts = datetime.fromisoformat(profile.first_transaction_at)
                account_age_days = (timestamp - first_ts).days
            except:
                pass
        
        has_fraud_history = profile.fraud_flags_30d > 0 or profile.chargebacks_30d > 0
        
        return TransactionFeatures(
            amount=amount,
            currency=currency,
            channel=channel,
            merchant_category=merchant_category,
            is_international=is_international,
            hour_of_day=hour_of_day,
            day_of_week=day_of_week,
            is_weekend=is_weekend,
            is_night=is_night,
            amount_zscore=amount_zscore,
            amount_to_avg_ratio=amount_to_avg_ratio,
            is_round_amount=is_round_amount,
            txn_count_1h=profile.txn_count_1h,
            txn_count_24h=profile.txn_count_24h,
            amount_1h=profile.txn_amount_1h,
            amount_24h=profile.txn_amount_24h,
            velocity_1h_ratio=velocity_1h_ratio,
            is_new_device=is_new_device,
            is_new_ip=is_new_ip,
            distance_from_primary_km=distance_from_primary_km,
            is_impossible_travel=is_impossible_travel,
            is_unusual_category=is_unusual_category,
            is_unusual_channel=is_unusual_channel,
            is_unusual_hour=is_unusual_hour,
            account_age_days=account_age_days,
            total_transactions=profile.total_transactions,
            has_fraud_history=has_fraud_history,
        )
    
    def _haversine_distance(
        self,
        lat1: float, lon1: float,
        lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points in km"""
        import math
        
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    async def record_fraud_flag(self, user_id: str):
        """Record a fraud flag for a user"""
        profile = await self.get_user_profile(user_id)
        if profile:
            profile.fraud_flags_30d += 1
            await self.save_user_profile(profile)
    
    async def record_chargeback(self, user_id: str):
        """Record a chargeback for a user"""
        profile = await self.get_user_profile(user_id)
        if profile:
            profile.chargebacks_30d += 1
            await self.save_user_profile(profile)
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for feature store"""
        if not self._connected:
            return {"healthy": False, "error": "Not connected"}
        
        try:
            await self._client.ping()
            return {
                "healthy": True,
                "connected": True,
                "feature_version": self.feature_version
            }
        except Exception as e:
            return {"healthy": False, "error": str(e)}


# Singleton accessor
async def get_feature_store() -> FeatureStore:
    """Get feature store instance"""
    return await FeatureStore.get_instance()
