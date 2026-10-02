"""
Transaction PIN Service (W12-A4A)
Redis-backed, salted-hash PIN management.

PINs are stored exclusively as '<salt>$<sha256>' hashes (same construction
as API secrets — utils.helpers.hash_api_secret). Plaintext PINs are NEVER
written to the database or to log output.
"""

import os
from typing import Optional

import redis as redis_lib

from utils.helpers import create_logger, hash_api_secret, verify_api_secret

logger = create_logger(__name__)

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
_redis_client: Optional[redis_lib.Redis] = None


def _get_redis() -> redis_lib.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(_REDIS_URL, decode_responses=True)
    return _redis_client


class PinService:
    """Manages per-user transaction PINs — hashes backed by Redis."""

    MIN_PIN_LENGTH = 4
    MAX_PIN_LENGTH = 6

    _PIN_KEY = "54b:pin:{tenant_id}:{keycloak_id}"

    def has_pin(self, keycloak_id: str, tenant_id: str) -> bool:
        r = _get_redis()
        return bool(
            r.exists(self._PIN_KEY.format(tenant_id=tenant_id, keycloak_id=keycloak_id))
        )

    def create_pin(
        self,
        keycloak_id: str,
        tenant_id: str,
        new_pin: str,
        current_pin: Optional[str] = None,
    ) -> dict:
        """Create or rotate a PIN.

        First-time creation stores the salted hash directly. Rotation (a PIN
        already exists) requires the current PIN to verify first — constant
        time, fail-closed."""
        if not new_pin or not new_pin.isdigit():
            return {
                "success": False,
                "message": "PIN must contain digits only.",
            }
        if not (self.MIN_PIN_LENGTH <= len(new_pin) <= self.MAX_PIN_LENGTH):
            return {
                "success": False,
                "message": f"PIN must be {self.MIN_PIN_LENGTH}-{self.MAX_PIN_LENGTH} digits.",
            }

        r = _get_redis()
        pin_key = self._PIN_KEY.format(tenant_id=tenant_id, keycloak_id=keycloak_id)
        stored = r.get(pin_key)

        if stored:
            # Rotation path — current PIN must verify before overwrite.
            if not current_pin or not verify_api_secret(current_pin, stored):
                logger.warning(
                    "PIN rotation rejected — bad current PIN keycloak_id=%s tenant=%s",
                    keycloak_id, tenant_id,
                )
                return {
                    "success": False,
                    "message": "Current PIN is incorrect.",
                }

        r.set(pin_key, hash_api_secret(new_pin))
        logger.info(
            "PIN %s keycloak_id=%s tenant=%s",
            "rotated" if stored else "created",
            keycloak_id,
            tenant_id,
        )
        return {"success": True, "message": "PIN created successfully."}

    def verify_pin(self, keycloak_id: str, tenant_id: str, pin: str) -> bool:
        """Constant-time verification of a presented PIN. Fail-closed."""
        r = _get_redis()
        stored = r.get(self._PIN_KEY.format(tenant_id=tenant_id, keycloak_id=keycloak_id))
        return verify_api_secret(pin, stored or "")

    def delete_pin(self, keycloak_id: str, tenant_id: str) -> None:
        r = _get_redis()
        r.delete(self._PIN_KEY.format(tenant_id=tenant_id, keycloak_id=keycloak_id))
        logger.info("PIN deleted keycloak_id=%s tenant=%s", keycloak_id, tenant_id)


_pin_service_instance: Optional[PinService] = None


def get_pin_service() -> PinService:
    global _pin_service_instance
    if _pin_service_instance is None:
        _pin_service_instance = PinService()
    return _pin_service_instance
