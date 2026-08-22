import os
import threading
import time

import jwt
import requests
import base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
from sqlalchemy.orm import Session
from schemas.v1 import GenerateToken, Context
from adapters import KeycloakAdapter
from utils import ApiError, get_config, create_logger
from services import AuthService
from utils.errors import raise_http_exception_handler

config = get_config()
logger = create_logger(__name__)

# ── JWKS cache (H-34): module-level, TTL-bound, single-flight, with timeouts ──
_JWKS_CACHE_TTL_SECONDS = int(os.getenv("JWKS_CACHE_TTL_SECONDS", "300"))
_JWKS_FETCH_TIMEOUT_SECONDS = float(os.getenv("JWKS_FETCH_TIMEOUT_SECONDS", "5"))

# {jwks_url: {"fetched_at": float, "keys": {kid: jwk}}}
_jwks_cache = {}
_jwks_cache_lock = threading.Lock()
# Single-flight: at most one blocking refresh per jwks_url at a time.
_jwks_refresh_locks = {}

# iss/aud validation (M-41, folded into H-34): fail closed in production when
# not configured; loud-warn and skip in non-production so dev keeps working.
_EXPECTED_AUDIENCE = os.getenv("EXPECTED_AUDIENCE", "")
_KEYCLOAK_ISSUER_OVERRIDE = os.getenv("KEYCLOAK_ISSUER", "")
_IS_PRODUCTION = not getattr(config, "DEBUG", True)

if _IS_PRODUCTION and not _EXPECTED_AUDIENCE:
    logger.critical(
        "EXPECTED_AUDIENCE is not set in production; token audience validation "
        "will FAIL CLOSED (all token validations rejected) until configured."
    )
if not _EXPECTED_AUDIENCE and not _IS_PRODUCTION:
    logger.warning(
        "EXPECTED_AUDIENCE is not set; skipping JWT audience validation "
        "(non-production only — this must be configured in production)."
    )



class TokenService:
    """Token service."""

    def __init__(self):
        pass

    def generate_token(self, payload: GenerateToken, db: Session, context: Context):
        auth_service = AuthService(db)

        auth = auth_service.get_auth_by_api_key(payload.key, payload.secret, context)

        if not auth:
            raise_http_exception_handler(
                status_code=401,
                message="Invalid credentials.",
                code="AUTH-AUTH-INT-4002",
            )

        keycloak_adapter = KeycloakAdapter(realm=context.keycloak_realm)

        keycloak_user = keycloak_adapter.get_user(auth.api_key)

        if keycloak_user is None:
            raise ApiError(
                message="Invalid user.",
                status_code=500,
                code="AUTH-AUTH-INT-5001",
            )

        return keycloak_adapter.request_user_token(payload.key, payload.secret)

    def jwk_to_pem(self, jwk):
        n = int.from_bytes(base64.urlsafe_b64decode(jwk["n"] + "=="), "big")
        e = int.from_bytes(base64.urlsafe_b64decode(jwk["e"] + "=="), "big")
        pub_key = rsa.RSAPublicNumbers(e, n).public_key(default_backend())
        return pub_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

    def _expected_issuer(self, context: Context) -> str:
        """Issuer we require on tokens for this realm.

        Defaults to the issuer implied by the (server-side) Keycloak realm
        base URL; KEYCLOAK_ISSUER overrides when the IdP advertises a
        different issuer (e.g. external hostname)."""
        if _KEYCLOAK_ISSUER_OVERRIDE:
            return _KEYCLOAK_ISSUER_OVERRIDE
        return f"https://keycloak.servers.upi.dev/realms/{context.keycloak_realm}"

    def _get_jwks_keys(self, jwks_url: str, force_refresh: bool = False) -> dict:
        """Return {kid: jwk} for the realm, using a TTL cache with
        single-flight refresh and a hard network timeout. Serves the stale
        cache if a refresh fails; raises only when no keys are available."""
        now = time.time()
        with _jwks_cache_lock:
            entry = _jwks_cache.get(jwks_url)
            refresh_lock = _jwks_refresh_locks.setdefault(jwks_url, threading.Lock())
            if (
                not force_refresh
                and entry
                and now - entry["fetched_at"] < _JWKS_CACHE_TTL_SECONDS
            ):
                return entry["keys"]

        # Single-flight: concurrent callers queue on the per-URL lock; the
        # loser re-checks the cache instead of re-fetching.
        with refresh_lock:
            with _jwks_cache_lock:
                entry = _jwks_cache.get(jwks_url)
                now = time.time()
                if (
                    not force_refresh
                    and entry
                    and now - entry["fetched_at"] < _JWKS_CACHE_TTL_SECONDS
                ):
                    return entry["keys"]

            try:
                resp = requests.get(
                    jwks_url, timeout=_JWKS_FETCH_TIMEOUT_SECONDS
                )
                resp.raise_for_status()
                keys = {
                    k["kid"]: k
                    for k in resp.json().get("keys", [])
                    if k.get("kid")
                }
                if not keys:
                    raise ValueError("JWKS document contained no usable keys")
                with _jwks_cache_lock:
                    _jwks_cache[jwks_url] = {"fetched_at": time.time(), "keys": keys}
                return keys
            except Exception as e:
                logger.error(f"JWKS fetch failed for {jwks_url}: {e}")
                if entry:
                    logger.warning(
                        "Serving stale JWKS cache after refresh failure."
                    )
                    return entry["keys"]
                raise ApiError(
                    message="Token validation unavailable.",
                    status_code=503,
                    code="AUTH-TOKEN-INT-5005",
                )

    def validate_token(self, token: str, context: Context):
        jwks_url = f"https://keycloak.servers.upi.dev/realms/{context.keycloak_realm}/protocol/openid-connect/certs"

        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        if not kid:
            raise ApiError(
                message="Token header missing key id.",
                status_code=401,
                code="AUTH-TOKEN-INT-5006",
            )

        keys = self._get_jwks_keys(jwks_url)
        key_data = keys.get(kid)
        if key_data is None:
            # Unknown kid: force a single cache refresh (key rotation), then fail.
            keys = self._get_jwks_keys(jwks_url, force_refresh=True)
            key_data = keys.get(kid)
        if key_data is None:
            raise ApiError(
                message="Unknown token signing key.",
                status_code=401,
                code="AUTH-TOKEN-INT-5007",
            )
        pem_key = self.jwk_to_pem(key_data)

        decode_options = {"verify_exp": True, "verify_signature": True}
        decode_kwargs = {}
        # iss is always validated against the configured/derived realm issuer.
        decode_kwargs["issuer"] = self._expected_issuer(context)
        decode_options["verify_iss"] = True
        if _EXPECTED_AUDIENCE:
            decode_kwargs["audience"] = _EXPECTED_AUDIENCE
            decode_options["verify_aud"] = True
        elif _IS_PRODUCTION:
            # Fail closed: audience must be pinned in production.
            raise ApiError(
                message="Token validation is not configured.",
                status_code=500,
                code="AUTH-TOKEN-INT-5008",
            )
        else:
            decode_options["verify_aud"] = False

        decoded_token = jwt.decode(
            token, key=pem_key, algorithms=["RS256"], options=decode_options, **decode_kwargs
        )
        return decoded_token

    def refresh_token(self, token: str, context: Context) -> dict:
        return KeycloakAdapter(realm=context.keycloak_realm).refresh_user_token(
            refresh_token=token
        )


token_service = TokenService()
