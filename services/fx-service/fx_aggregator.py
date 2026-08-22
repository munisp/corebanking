"""
Multi-Provider FX Rate Aggregator
Production-ready implementation with failover, caching, and rate aggregation
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
import asyncio
import aiohttp
import uvicorn
import asyncpg
import redis.asyncio as redis
import os
import json
import logging
import hashlib
import hmac
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="54link-dev FX Aggregator Service", version="2.0.0")

# --- Canonical JWT validation (ported from services/shared/auth/jwt_validation.py; stdlib-only) ---
# RS256 via Keycloak JWKS (fetched with a 5s timeout + TTL cache) when KEYCLOAK_JWKS_URL
# is set; HS256 via JWT_SECRET otherwise; iss/aud checked when JWT_ISSUER / JWT_AUDIENCE
# are configured. Fail-closed: missing/malformed/expired/unknown-kid tokens are rejected;
# a JWKS outage with a cold cache yields "jwks_unavailable" (surfaced as HTTP 503).
import os as _jwt_os
import base64 as _jwt_b64
import hashlib as _jwt_hash
import hmac as _jwt_hmac
import json as _jwt_json
import time as _jwt_time
import urllib.request as _jwt_urlreq

_JWT_JWKS_URL = _jwt_os.environ.get("KEYCLOAK_JWKS_URL", "")
_JWT_SECRET = _jwt_os.environ.get("JWT_SECRET", "")
_JWT_ISSUER = _jwt_os.environ.get("JWT_ISSUER", "")
_JWT_AUDIENCE = _jwt_os.environ.get("JWT_AUDIENCE", "")
try:
    _JWT_JWKS_TTL = int(_jwt_os.environ.get("JWKS_CACHE_TTL_SECONDS", "300"))
except ValueError:
    _JWT_JWKS_TTL = 300
_jwks_cache = {"fetched_at": 0.0, "keys": {}}


def _jwt_b64url_decode(segment):
    segment += "=" * (-len(segment) % 4)
    return _jwt_b64.urlsafe_b64decode(segment.encode())


def _jwt_fetch_jwks():
    now = _jwt_time.time()
    if _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWT_JWKS_TTL:
        return _jwks_cache["keys"], None
    try:
        with _jwt_urlreq.urlopen(_JWT_JWKS_URL, timeout=5) as resp:
            data = _jwt_json.loads(resp.read())
        keys = {k.get("kid"): k for k in data.get("keys", []) if k.get("kid")}
    except Exception:
        if _jwks_cache["keys"]:
            return _jwks_cache["keys"], None  # stale cache: signatures are still really verified
        return None, "jwks_unavailable"
    _jwks_cache["keys"] = keys
    _jwks_cache["fetched_at"] = now
    return keys, None


def _jwt_verify_rs256(signing_input, signature, jwk):
    """Pure-stdlib RS256 (PKCS#1 v1.5 + SHA-256) verification against a JWK."""
    try:
        n = int.from_bytes(_jwt_b64url_decode(jwk["n"]), "big")
        e = int.from_bytes(_jwt_b64url_decode(jwk["e"]), "big")
    except Exception:
        return False
    k = (n.bit_length() + 7) // 8
    if len(signature) != k:
        return False
    em = pow(int.from_bytes(signature, "big"), e, n).to_bytes(k, "big")
    digest_info = bytes.fromhex("3031300d060960864801650304020105000420") + _jwt_hash.sha256(signing_input).digest()
    if k < len(digest_info) + 11:
        return False
    expected = b"\x00\x01" + b"\xff" * (k - len(digest_info) - 3) + b"\x00" + digest_info
    return _jwt_hmac.compare_digest(em, expected)


def _jwt_check_claims(payload):
    exp = payload.get("exp")
    if exp is None:
        return "Token missing exp claim"
    try:
        if _jwt_time.time() >= float(exp):
            return "Token expired"
    except (TypeError, ValueError):
        return "Invalid token expiry"
    if _JWT_ISSUER and payload.get("iss") != _JWT_ISSUER:
        return "Invalid token issuer"
    if _JWT_AUDIENCE:
        aud = payload.get("aud")
        if isinstance(aud, str):
            aud = [aud]
        if not isinstance(aud, list) or _JWT_AUDIENCE not in aud:
            return "Invalid token audience"
    return None


def validate_jwt(headers):
    """Validate a Bearer JWT from a headers mapping.

    Returns (claims, None) on success or (None, reason) on failure. Fails closed:
    any token that cannot be cryptographically verified is rejected, and when
    neither KEYCLOAK_JWKS_URL nor JWT_SECRET is configured the result is
    (None, "auth_not_configured").
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    try:
        header = _jwt_json.loads(_jwt_b64url_decode(parts[0]))
        payload = _jwt_json.loads(_jwt_b64url_decode(parts[1]))
        signature = _jwt_b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    alg = header.get("alg")
    signing_input = (parts[0] + "." + parts[1]).encode()
    if alg == "RS256":
        if not _JWT_JWKS_URL:
            return None, "auth_not_configured"
        keys, ferr = _jwt_fetch_jwks()
        if ferr:
            return None, ferr
        jwk = keys.get(header.get("kid"))
        if jwk is None:
            _jwks_cache["fetched_at"] = 0.0  # one forced refresh for an unknown kid
            keys, ferr = _jwt_fetch_jwks()
            if ferr:
                return None, ferr
            jwk = keys.get(header.get("kid"))
            if jwk is None:
                return None, "Unknown token key id"
        if not _jwt_verify_rs256(signing_input, signature, jwk):
            return None, "Invalid token signature"
    elif alg == "HS256":
        if not _JWT_SECRET or _JWT_SECRET.startswith("${"):
            return None, "auth_not_configured"
        expected = _jwt_hmac.new(_JWT_SECRET.encode(), signing_input, _jwt_hash.sha256).digest()
        if not _jwt_hmac.compare_digest(expected, signature):
            return None, "Invalid token signature"
    else:
        return None, "Unsupported token algorithm"
    err = _jwt_check_claims(payload)
    if err:
        return None, err
    return payload, None

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


_CORS_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db_pool = None
redis_client = None

class AggregationStrategy(str, Enum):
    BEST_RATE = "best_rate"
    AVERAGE = "average"
    MEDIAN = "median"
    WEIGHTED = "weighted"

class ProviderStatus(str, Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    DOWN = "down"

class FXProvider(ABC):
    """Abstract base class for FX rate providers"""
    
    def __init__(self, name: str, priority: int = 1, weight: float = 1.0):
        self.name = name
        self.priority = priority
        self.weight = weight
        self.status = ProviderStatus.ACTIVE
        self.last_success = None
        self.failure_count = 0
        self.circuit_open = False
        self.circuit_open_time = None
    
    @abstractmethod
    async def get_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        pass
    
    @abstractmethod
    async def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        pass
    
    def record_success(self):
        self.failure_count = 0
        self.last_success = datetime.now()
        self.status = ProviderStatus.ACTIVE
        self.circuit_open = False
    
    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= 3:
            self.status = ProviderStatus.DOWN
            self.circuit_open = True
            self.circuit_open_time = datetime.now()
        elif self.failure_count >= 1:
            self.status = ProviderStatus.DEGRADED
    
    def is_available(self) -> bool:
        if self.circuit_open:
            if datetime.now() - self.circuit_open_time > timedelta(minutes=5):
                self.circuit_open = False
                self.failure_count = 0
                return True
            return False
        return True

class OpenExchangeRatesProvider(FXProvider):
    """Open Exchange Rates API provider"""
    
    def __init__(self, api_key: str):
        super().__init__("openexchangerates", priority=1, weight=1.0)
        self.api_key = api_key
        self.base_url = "https://openexchangerates.org/api"
    
    async def get_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        if not self.is_available():
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/latest.json?app_id={self.api_key}&base=USD"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        rates = data.get("rates", {})
                        
                        if from_currency == "USD":
                            rate = Decimal(str(rates.get(to_currency, 0)))
                        elif to_currency == "USD":
                            rate = Decimal(1) / Decimal(str(rates.get(from_currency, 1)))
                        else:
                            from_usd = Decimal(str(rates.get(from_currency, 1)))
                            to_usd = Decimal(str(rates.get(to_currency, 1)))
                            rate = to_usd / from_usd
                        
                        self.record_success()
                        return rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    else:
                        self.record_failure()
                        return None
        except Exception as e:
            logger.error(f"OpenExchangeRates error: {e}")
            self.record_failure()
            return None
    
    async def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        if not self.is_available():
            return {}
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/latest.json?app_id={self.api_key}&base=USD"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        rates = data.get("rates", {})
                        
                        result = {}
                        base_rate = Decimal(str(rates.get(base_currency, 1)))
                        
                        for currency, rate in rates.items():
                            converted = Decimal(str(rate)) / base_rate
                            result[currency] = converted.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                        
                        self.record_success()
                        return result
                    else:
                        self.record_failure()
                        return {}
        except Exception as e:
            logger.error(f"OpenExchangeRates error: {e}")
            self.record_failure()
            return {}

class ExchangeRateAPIProvider(FXProvider):
    """ExchangeRate-API provider"""
    
    def __init__(self, api_key: str):
        super().__init__("exchangerateapi", priority=2, weight=0.8)
        self.api_key = api_key
        self.base_url = "https://v6.exchangerate-api.com/v6"
    
    async def get_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        if not self.is_available():
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/{self.api_key}/pair/{from_currency}/{to_currency}"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("result") == "success":
                            rate = Decimal(str(data.get("conversion_rate", 0)))
                            self.record_success()
                            return rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    self.record_failure()
                    return None
        except Exception as e:
            logger.error(f"ExchangeRateAPI error: {e}")
            self.record_failure()
            return None
    
    async def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        if not self.is_available():
            return {}
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/{self.api_key}/latest/{base_currency}"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("result") == "success":
                            rates = data.get("conversion_rates", {})
                            result = {
                                k: Decimal(str(v)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                                for k, v in rates.items()
                            }
                            self.record_success()
                            return result
                    self.record_failure()
                    return {}
        except Exception as e:
            logger.error(f"ExchangeRateAPI error: {e}")
            self.record_failure()
            return {}

class CurrencyLayerProvider(FXProvider):
    """CurrencyLayer API provider"""
    
    def __init__(self, api_key: str):
        super().__init__("currencylayer", priority=3, weight=0.7)
        self.api_key = api_key
        self.base_url = "http://api.currencylayer.com"
    
    async def get_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        if not self.is_available():
            return None
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/live?access_key={self.api_key}&currencies={to_currency}&source={from_currency}"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("success"):
                            quotes = data.get("quotes", {})
                            key = f"{from_currency}{to_currency}"
                            rate = Decimal(str(quotes.get(key, 0)))
                            self.record_success()
                            return rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                    self.record_failure()
                    return None
        except Exception as e:
            logger.error(f"CurrencyLayer error: {e}")
            self.record_failure()
            return None
    
    async def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        if not self.is_available():
            return {}
        
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/live?access_key={self.api_key}&source={base_currency}"
                async with session.get(url, timeout=10) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("success"):
                            quotes = data.get("quotes", {})
                            result = {}
                            for key, value in quotes.items():
                                currency = key[3:]  # Remove base currency prefix
                                result[currency] = Decimal(str(value)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
                            self.record_success()
                            return result
                    self.record_failure()
                    return {}
        except Exception as e:
            logger.error(f"CurrencyLayer error: {e}")
            self.record_failure()
            return {}

class FallbackProvider(FXProvider):
    """Fallback provider with static rates for CBN-regulated currencies"""
    
    # CBN indicative rates (updated periodically)
    STATIC_RATES = {
        ("NGN", "USD"): Decimal("0.00065"),
        ("USD", "NGN"): Decimal("1550.00"),
        ("NGN", "GBP"): Decimal("0.00052"),
        ("GBP", "NGN"): Decimal("1950.00"),
        ("NGN", "EUR"): Decimal("0.00060"),
        ("EUR", "NGN"): Decimal("1680.00"),
        ("USD", "EUR"): Decimal("0.92"),
        ("EUR", "USD"): Decimal("1.09"),
        ("USD", "GBP"): Decimal("0.79"),
        ("GBP", "USD"): Decimal("1.27"),
    }
    
    def __init__(self):
        super().__init__("fallback", priority=99, weight=0.5)
    
    async def get_rate(self, from_currency: str, to_currency: str) -> Optional[Decimal]:
        key = (from_currency, to_currency)
        if key in self.STATIC_RATES:
            self.record_success()
            return self.STATIC_RATES[key]
        
        # Try reverse
        reverse_key = (to_currency, from_currency)
        if reverse_key in self.STATIC_RATES:
            rate = Decimal(1) / self.STATIC_RATES[reverse_key]
            self.record_success()
            return rate.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        
        return None
    
    async def get_all_rates(self, base_currency: str) -> Dict[str, Decimal]:
        result = {}
        for (from_curr, to_curr), rate in self.STATIC_RATES.items():
            if from_curr == base_currency:
                result[to_curr] = rate
        return result

class FXRateAggregator:
    """Aggregates rates from multiple providers"""
    
    def __init__(self, providers: List[FXProvider], strategy: AggregationStrategy = AggregationStrategy.BEST_RATE):
        self.providers = sorted(providers, key=lambda p: p.priority)
        self.strategy = strategy
        self.cache_ttl = 300  # 5 minutes
    
    async def get_aggregated_rate(
        self,
        from_currency: str,
        to_currency: str,
        redis_client: Optional[redis.Redis] = None
    ) -> Dict[str, Any]:
        cache_key = f"fx_rate:{from_currency}:{to_currency}"
        
        # Check cache
        if redis_client:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        
        # Fetch from all available providers concurrently
        tasks = []
        for provider in self.providers:
            if provider.is_available():
                tasks.append(self._fetch_rate(provider, from_currency, to_currency))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Collect successful results
        rates = []
        provider_rates = {}
        for provider, result in zip([p for p in self.providers if p.is_available()], results):
            if isinstance(result, Decimal) and result > 0:
                rates.append((provider, result))
                provider_rates[provider.name] = {
                    "rate": float(result),
                    "status": provider.status.value,
                    "weight": provider.weight
                }
        
        if not rates:
            # Use fallback
            fallback = FallbackProvider()
            rate = await fallback.get_rate(from_currency, to_currency)
            if rate:
                return {
                    "from_currency": from_currency,
                    "to_currency": to_currency,
                    "rate": float(rate),
                    "source": "fallback",
                    "strategy": "fallback",
                    "timestamp": datetime.now().isoformat(),
                    "providers": {"fallback": {"rate": float(rate), "status": "active"}}
                }
            raise HTTPException(status_code=503, detail="No FX rates available")
        
        # Apply aggregation strategy
        aggregated_rate = self._aggregate(rates)
        
        result = {
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": float(aggregated_rate),
            "source": "aggregated",
            "strategy": self.strategy.value,
            "timestamp": datetime.now().isoformat(),
            "providers": provider_rates
        }
        
        # Cache result
        if redis_client:
            await redis_client.setex(cache_key, self.cache_ttl, json.dumps(result))
        
        return result
    
    async def _fetch_rate(self, provider: FXProvider, from_currency: str, to_currency: str) -> Optional[Decimal]:
        try:
            return await provider.get_rate(from_currency, to_currency)
        except Exception as e:
            logger.error(f"Error fetching rate from {provider.name}: {e}")
            provider.record_failure()
            return None
    
    def _aggregate(self, rates: List[tuple]) -> Decimal:
        if self.strategy == AggregationStrategy.BEST_RATE:
            # Return the best (highest) rate for selling, lowest for buying
            return max(r[1] for r in rates)
        
        elif self.strategy == AggregationStrategy.AVERAGE:
            total = sum(r[1] for r in rates)
            return (total / len(rates)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        
        elif self.strategy == AggregationStrategy.MEDIAN:
            sorted_rates = sorted(r[1] for r in rates)
            mid = len(sorted_rates) // 2
            if len(sorted_rates) % 2 == 0:
                return ((sorted_rates[mid - 1] + sorted_rates[mid]) / 2).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            return sorted_rates[mid]
        
        elif self.strategy == AggregationStrategy.WEIGHTED:
            total_weight = sum(r[0].weight for r in rates)
            weighted_sum = sum(r[1] * Decimal(str(r[0].weight)) for r in rates)
            return (weighted_sum / Decimal(str(total_weight))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        
        return rates[0][1]  # Default to first provider
    
    def get_provider_status(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": p.name,
                "status": p.status.value,
                "priority": p.priority,
                "weight": p.weight,
                "last_success": p.last_success.isoformat() if p.last_success else None,
                "failure_count": p.failure_count,
                "circuit_open": p.circuit_open
            }
            for p in self.providers
        ]

# Initialize aggregator with providers
def create_aggregator() -> FXRateAggregator:
    providers = []
    
    # Add providers based on available API keys
    if os.getenv("OPENEXCHANGERATES_API_KEY"):
        providers.append(OpenExchangeRatesProvider(os.getenv("OPENEXCHANGERATES_API_KEY")))
    
    if os.getenv("EXCHANGERATEAPI_KEY"):
        providers.append(ExchangeRateAPIProvider(os.getenv("EXCHANGERATEAPI_KEY")))
    
    if os.getenv("CURRENCYLAYER_API_KEY"):
        providers.append(CurrencyLayerProvider(os.getenv("CURRENCYLAYER_API_KEY")))
    
    # Always add fallback
    providers.append(FallbackProvider())
    
    strategy = AggregationStrategy(os.getenv("FX_AGGREGATION_STRATEGY", "best_rate"))
    return FXRateAggregator(providers, strategy)

aggregator = create_aggregator()

@app.on_event("startup")
async def startup():
    global db_pool, redis_client
    
    db_pool = await asyncpg.create_pool(
        host=os.getenv("DB_HOST", "postgres"),
        port=os.getenv("DB_PORT", "5432"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        database=os.getenv("DB_NAME", "fx_db"),
        min_size=5, max_size=20
    )
    
    redis_url = os.getenv("REDIS_URL", "redis://redis-master:6379/0")
    redis_client = redis.from_url(redis_url, decode_responses=True)
    
    async with db_pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS fx_rates (
                id SERIAL PRIMARY KEY,
                from_currency VARCHAR(3) NOT NULL,
                to_currency VARCHAR(3) NOT NULL,
                rate DECIMAL(15,6) NOT NULL,
                source VARCHAR(50) NOT NULL,
                strategy VARCHAR(20) NOT NULL,
                provider_rates JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(from_currency, to_currency, created_at)
            );
            
            CREATE INDEX IF NOT EXISTS idx_fx_rates_currencies ON fx_rates(from_currency, to_currency);
            CREATE INDEX IF NOT EXISTS idx_fx_rates_created ON fx_rates(created_at DESC);
            
            CREATE TABLE IF NOT EXISTS fx_transactions (
                id SERIAL PRIMARY KEY,
                transaction_id VARCHAR(50) UNIQUE NOT NULL,
                tenant_id VARCHAR(50) NOT NULL,
                customer_id VARCHAR(50) NOT NULL,
                from_currency VARCHAR(3) NOT NULL,
                to_currency VARCHAR(3) NOT NULL,
                from_amount DECIMAL(15,2) NOT NULL,
                to_amount DECIMAL(15,2) NOT NULL,
                exchange_rate DECIMAL(15,6) NOT NULL,
                rate_source VARCHAR(50) NOT NULL,
                margin_applied DECIMAL(5,4) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'completed',
                idempotency_key VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_fx_txns_tenant ON fx_transactions(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_fx_txns_customer ON fx_transactions(customer_id);
            CREATE INDEX IF NOT EXISTS idx_fx_txns_created ON fx_transactions(created_at DESC);
        """)
    
    logger.info("FX Aggregator service started successfully")

@app.on_event("shutdown")
async def shutdown():
    global db_pool, redis_client
    if db_pool:
        await db_pool.close()
    if redis_client:
        await redis_client.close()

@app.get("/health")
async def health_check():
    provider_status = aggregator.get_provider_status()
    active_providers = sum(1 for p in provider_status if p["status"] == "active")
    
    return {
        "status": "healthy" if active_providers > 0 else "degraded",
        "service": "fx-aggregator-service",
        "active_providers": active_providers,
        "total_providers": len(provider_status)
    }

@app.get("/api/v1/fx/rates")
async def get_fx_rate(
    from_currency: str,
    to_currency: str,
    strategy: Optional[AggregationStrategy] = None
):
    """Get aggregated FX rate from multiple providers"""
    if strategy:
        aggregator.strategy = strategy
    
    return await aggregator.get_aggregated_rate(from_currency.upper(), to_currency.upper(), redis_client)

@app.get("/api/v1/fx/rates/all")
async def get_all_rates(base_currency: str = "NGN"):
    """Get all available rates for a base currency"""
    cache_key = f"fx_all_rates:{base_currency}"
    
    if redis_client:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    
    # Get rates from first available provider
    for provider in aggregator.providers:
        if provider.is_available():
            rates = await provider.get_all_rates(base_currency.upper())
            if rates:
                result = {
                    "base_currency": base_currency.upper(),
                    "rates": {k: float(v) for k, v in rates.items()},
                    "source": provider.name,
                    "timestamp": datetime.now().isoformat()
                }
                
                if redis_client:
                    await redis_client.setex(cache_key, 300, json.dumps(result))
                
                return result
    
    raise HTTPException(status_code=503, detail="No FX rates available")

@app.get("/api/v1/fx/providers")
async def get_provider_status():
    """Get status of all FX rate providers"""
    return {
        "providers": aggregator.get_provider_status(),
        "strategy": aggregator.strategy.value
    }

class ExchangeRequest(BaseModel):
    tenant_id: str
    customer_id: str
    from_currency: str
    to_currency: str
    from_amount: Decimal
    idempotency_key: Optional[str] = None
    margin_percent: Optional[Decimal] = Decimal("0")

@app.post("/api/v1/fx/exchange")
async def exchange_currency(req: ExchangeRequest, db=Depends(lambda: db_pool)):
    """Execute currency exchange with aggregated rate"""
    
    # Check idempotency
    if req.idempotency_key:
        async with db.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT * FROM fx_transactions WHERE idempotency_key = $1",
                req.idempotency_key
            )
            if existing:
                return {
                    "status": "already_processed",
                    "transaction_id": existing["transaction_id"],
                    "from_amount": float(existing["from_amount"]),
                    "to_amount": float(existing["to_amount"]),
                    "exchange_rate": float(existing["exchange_rate"])
                }
    
    # Get aggregated rate
    rate_info = await aggregator.get_aggregated_rate(
        req.from_currency.upper(),
        req.to_currency.upper(),
        redis_client
    )
    
    base_rate = Decimal(str(rate_info["rate"]))
    
    # Apply margin
    margin_multiplier = Decimal("1") - (req.margin_percent / Decimal("100"))
    final_rate = base_rate * margin_multiplier
    
    to_amount = (req.from_amount * final_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    transaction_id = f"FX{int(datetime.now().timestamp() * 1000)}"
    
    async with db.acquire() as conn:
        await conn.execute("""
            INSERT INTO fx_transactions (
                transaction_id, tenant_id, customer_id, from_currency, to_currency,
                from_amount, to_amount, exchange_rate, rate_source, margin_applied, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """, transaction_id, req.tenant_id, req.customer_id, req.from_currency.upper(),
            req.to_currency.upper(), req.from_amount, to_amount, final_rate,
            rate_info["source"], req.margin_percent, req.idempotency_key)
        
        # Store rate snapshot
        await conn.execute("""
            INSERT INTO fx_rates (from_currency, to_currency, rate, source, strategy, provider_rates)
            VALUES ($1, $2, $3, $4, $5, $6)
        """, req.from_currency.upper(), req.to_currency.upper(), base_rate,
            rate_info["source"], rate_info["strategy"], json.dumps(rate_info.get("providers", {})))
    
    return {
        "status": "completed",
        "transaction_id": transaction_id,
        "from_currency": req.from_currency.upper(),
        "to_currency": req.to_currency.upper(),
        "from_amount": float(req.from_amount),
        "to_amount": float(to_amount),
        "exchange_rate": float(final_rate),
        "base_rate": float(base_rate),
        "margin_applied": float(req.margin_percent),
        "rate_source": rate_info["source"],
        "providers_used": list(rate_info.get("providers", {}).keys()),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/v1/fx/history")
async def get_rate_history(
    from_currency: str,
    to_currency: str,
    days: int = 7,
    db=Depends(lambda: db_pool)
):
    """Get historical FX rates"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT rate, source, strategy, created_at
            FROM fx_rates
            WHERE from_currency = $1 AND to_currency = $2
                AND created_at >= NOW() - INTERVAL '%s days'
            ORDER BY created_at DESC
            LIMIT 1000
        """ % days, from_currency.upper(), to_currency.upper())
        
        return {
            "from_currency": from_currency.upper(),
            "to_currency": to_currency.upper(),
            "period_days": days,
            "rates": [
                {
                    "rate": float(row["rate"]),
                    "source": row["source"],
                    "strategy": row["strategy"],
                    "timestamp": row["created_at"].isoformat()
                }
                for row in rows
            ]
        }

@app.get("/api/v1/fx/transactions/{tenant_id}")
async def list_fx_transactions(
    tenant_id: str,
    skip: int = 0,
    limit: int = 20,
    db=Depends(lambda: db_pool)
):
    """List FX transactions for a tenant"""
    async with db.acquire() as conn:
        rows = await conn.fetch("""
            SELECT * FROM fx_transactions
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """, tenant_id, limit, skip)
        
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM fx_transactions WHERE tenant_id = $1",
            tenant_id
        )
        
        return {
            "tenant_id": tenant_id,
            "transactions": [dict(row) for row in rows],
            "total": total,
            "skip": skip,
            "limit": limit
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8007")))
