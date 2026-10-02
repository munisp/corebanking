"""
Failed Login Attempt Tracking and Account Suspension Service

Redis-backed, distributed failed-attempt tracking (c3-0883).
The previous implementation kept the attempt counter in an in-process dict,
so counters were lost on restart and were per-replica (a brute-force attacker
could multiply MAX_ATTEMPTS by the replica count).

Counter semantics: redis INCR on `failed_login:{tenant}:{email}` with
EXPIRE set on the first increment of the window (TTL 900s).
DEVIATION: the in-memory window was LOCKOUT_DURATION_MINUTES=30; the redis
window is 900s (15 min) per remediation register c3-0883.

Failure policy: fail-CLOSED. If redis is unavailable, record_failed_attempt()
and get_remaining_attempts() raise LoginTrackerUnavailable rather than
silently losing count state. reset_attempts() logs-only (a lost reset only
extends a lockout, never weakens one).
"""

import os
from datetime import datetime, timedelta
from typing import Optional, Dict

import redis as redis_lib
from sqlalchemy.orm import Session

from utils.helpers import create_logger
from utils.external_api_client import ExternalAPIClient
from utils.config import get_config

logger = create_logger(__name__)
config = get_config()

_REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
# Sync ConnectionPool: the tracker API is synchronous (matches
# utils/otp_service.py redis usage, redis==5.2.1).
_redis_pool: Optional[redis_lib.ConnectionPool] = None


class LoginTrackerUnavailable(Exception):
    """Raised when the redis-backed failed-login tracker cannot be reached.

    Fail-closed signal: callers must treat this as 'attempt state unknown'
    and refuse the login attempt rather than bypassing the counter.
    """


def _get_redis() -> redis_lib.Redis:
    """Lazy sync redis client backed by a shared ConnectionPool."""
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = redis_lib.ConnectionPool.from_url(
            _REDIS_URL, decode_responses=True, max_connections=20
        )
    return redis_lib.Redis(connection_pool=_redis_pool)


class FailedLoginTracker:
    """Tracks failed login attempts and triggers account suspension after threshold"""

    MAX_ATTEMPTS = 6
    LOCKOUT_DURATION_MINUTES = 30  # legacy in-memory window (superseded)
    WINDOW_SECONDS = 900  # redis counter window (c3-0883); see module docstring

    _KEY = "failed_login:{tenant_id}:{email}"

    def __init__(self, db: Session, redis_client: Optional[redis_lib.Redis] = None):
        self.db = db
        self._redis = redis_client  # None -> lazy module-level pooled client

    def _client(self) -> redis_lib.Redis:
        return self._redis if self._redis is not None else _get_redis()

    def record_failed_attempt(
        self, email: str, tenant_id: str, keycloak_id: Optional[str] = None
    ) -> Dict:
        """
        Record a failed login attempt.

        Args:
            email: User's email
            tenant_id: Tenant ID
            keycloak_id: Keycloak ID (if available)

        Returns:
            Dict with attempt info: {
                'attempts': int,
                'remaining': int,
                'suspended': bool,
                'lockout_until': datetime (if suspended)
            }

        Raises:
            LoginTrackerUnavailable: if the redis counter store is unreachable
                (fail-closed; the attempt is NOT silently dropped).
        """
        key = self._KEY.format(tenant_id=tenant_id, email=email)

        try:
            r = self._client()
            attempts = r.incr(key)
            if attempts == 1:
                # First failure of the window: arm the sliding-window TTL.
                r.expire(key, self.WINDOW_SECONDS)
        except redis_lib.RedisError as e:
            logger.critical(
                f"Failed-login tracker unavailable (redis) for {email} "
                f"(tenant: {tenant_id}): {e}"
            )
            raise LoginTrackerUnavailable(
                "failed-login counter store unavailable"
            ) from e

        remaining = max(0, self.MAX_ATTEMPTS - attempts)

        logger.warning(
            f"Failed login attempt {attempts}/{self.MAX_ATTEMPTS} for {email} (tenant: {tenant_id})"
        )

        result = {
            "attempts": attempts,
            "remaining": remaining,
            "suspended": False,
            "lockout_until": None,
        }

        # Trigger suspension if max attempts reached
        if attempts >= self.MAX_ATTEMPTS:
            logger.critical(
                f"Max failed login attempts reached for {email}. Triggering account suspension."
            )

            # Suspend the account
            if keycloak_id:
                suspension_result = self._suspend_account(
                    keycloak_id=keycloak_id, tenant_id=tenant_id, email=email
                )
                result["suspended"] = suspension_result
            else:
                logger.error(
                    f"Cannot suspend account for {email} - keycloak_id not available"
                )

            result["lockout_until"] = datetime.utcnow() + timedelta(
                seconds=self.WINDOW_SECONDS
            )

        return result

    def reset_attempts(self, email: str, tenant_id: str):
        """Reset failed attempts counter (e.g., after successful login).

        Failure policy: logs-only. A lost reset only extends an existing
        lockout window; it never weakens the counter, so this never raises.
        """
        key = self._KEY.format(tenant_id=tenant_id, email=email)
        try:
            deleted = self._client().delete(key)
            if deleted:
                logger.info(f"Resetting failed login attempts for {email}")
        except redis_lib.RedisError as e:
            logger.error(
                f"Could not reset failed-login counter for {email} "
                f"(tenant: {tenant_id}); counter window will expire via TTL: {e}"
            )

    def get_remaining_attempts(self, email: str, tenant_id: str) -> int:
        """Get remaining login attempts before suspension.

        Raises:
            LoginTrackerUnavailable: if the redis counter store is unreachable
                (fail-closed).
        """
        key = self._KEY.format(tenant_id=tenant_id, email=email)
        try:
            raw = self._client().get(key)
        except redis_lib.RedisError as e:
            logger.critical(
                f"Failed-login tracker unavailable (redis) for {email} "
                f"(tenant: {tenant_id}): {e}"
            )
            raise LoginTrackerUnavailable(
                "failed-login counter store unavailable"
            ) from e

        if raw is None:
            return self.MAX_ATTEMPTS
        return max(0, self.MAX_ATTEMPTS - int(raw))

    def _suspend_account(
        self, keycloak_id: str, tenant_id: str, email: str
    ) -> bool:
        """
        Suspend user or admin account via external API.

        Args:
            keycloak_id: Keycloak ID
            tenant_id: Tenant ID
            email: User email

        Returns:
            bool: True if suspension successful, False otherwise
        """
        try:
            # First, get user/admin details to get their ID
            user_details = self._get_user_or_admin_details(
                keycloak_id=keycloak_id, tenant_id=tenant_id
            )

            if not user_details:
                logger.error(
                    f"Failed to get user/admin details for keycloak_id: {keycloak_id}"
                )
                return False

            account_type = user_details["type"]  # 'user' or 'admin'
            account_id = user_details["id"]

            # Suspend the account
            suspension_success = self._call_suspension_api(
                account_type=account_type, account_id=account_id, tenant_id=tenant_id
            )

            if suspension_success:
                logger.info(
                    f"Successfully suspended {account_type} account: {email} (ID: {account_id})"
                )
            else:
                logger.error(
                    f"Failed to suspend {account_type} account: {email} (ID: {account_id})"
                )

            return suspension_success

        except Exception as e:
            logger.error(f"Error suspending account for {email}: {e}")
            return False

    def _get_user_or_admin_details(
        self, keycloak_id: str, tenant_id: str
    ) -> Optional[Dict]:
        """
        Get user or admin details from external APIs.
        
        IMPORTANT: 
        - GET endpoints use keycloak_id to fetch the account
        - Returns the account's 'id' field (UUID for users, int for admins)
        - This 'id' is then used for the suspension endpoint

        Returns:
            Dict with 'type' ('user' or 'admin') and 'id', or None if not found
        """
        base_url = "https://54link-dev.upi.dev"

        # Try to get as user first
        # GET /user/user?keycloak_id={keycloak_id}
        try:
            user_client = ExternalAPIClient(
                base_url=base_url,
                headers={
                    "x-tenant-id": tenant_id,
                    "Content-Type": "application/json",
                },
            )

            user_response = user_client._get(
                endpoint=f"/user/user", params={"keycloak_id": keycloak_id}
            )

            if user_response and user_response.get("user"):
                user_data = user_response["user"]
                logger.info(f"Found user account with keycloak_id: {keycloak_id}")
                # Extract the user's UUID id (not keycloak_id) for suspension endpoint
                return {"type": "user", "id": user_data["id"], "data": user_data}

        except Exception as e:
            logger.info(
                f"Not a user account (keycloak_id: {keycloak_id}): {e}. Trying admin..."
            )

        # Try to get as admin
        # GET /admin/admin/keycloak/{keycloak_id}
        try:
            admin_client = ExternalAPIClient(
                base_url=base_url,
                headers={
                    "x-tenant-id": tenant_id,
                    "Content-Type": "application/json",
                },
            )

            admin_response = admin_client._get(
                endpoint=f"/admin/admin/keycloak/{keycloak_id}"
            )

            if admin_response and admin_response.get("admin"):
                admin_data = admin_response["admin"]
                logger.info(f"Found admin account with keycloak_id: {keycloak_id}")
                # Extract the admin's integer id (not keycloak_id) for suspension endpoint
                return {"type": "admin", "id": admin_data["id"], "data": admin_data}

        except Exception as e:
            logger.error(
                f"Not an admin account (keycloak_id: {keycloak_id}): {e}"
            )

        logger.error(
            f"Could not find user or admin account with keycloak_id: {keycloak_id}"
        )
        return None

    def _call_suspension_api(
        self, account_type: str, account_id: str, tenant_id: str
    ) -> bool:
        """
        Call the appropriate suspension API endpoint.
        
        IMPORTANT:
        - Suspension endpoints use the account's 'id' (NOT keycloak_id)
        - User: PUT /user/user/{user_uuid}/suspend
        - Admin: PATCH /admin/admin/{admin_int_id}/suspend

        Args:
            account_type: 'user' or 'admin'
            account_id: User UUID or Admin integer ID (NOT keycloak_id)
            tenant_id: Tenant ID

        Returns:
            bool: True if successful, False otherwise
        """
        base_url = "https://54link-dev.upi.dev"

        try:
            client = ExternalAPIClient(
                base_url=base_url,
                headers={
                    "x-tenant-id": tenant_id,
                    "Content-Type": "application/json",
                },
            )

            if account_type == "user":
                # PUT /user/user/{id}/suspend (id is user UUID from user.id)
                endpoint = f"/user/user/{account_id}/suspend"
                response = client._put(endpoint=endpoint, get_response=False)
            else:  # admin
                # PATCH /admin/admin/{id}/suspend (id is admin integer from admin.id)
                endpoint = f"/admin/admin/{account_id}/suspend"
                response = client._patch(endpoint=endpoint, get_response=False)

            status_code = response.get("status_code", 0)

            if status_code == 200:
                logger.info(
                    f"Successfully suspended {account_type} ID: {account_id}"
                )
                return True
            else:
                logger.error(
                    f"Failed to suspend {account_type} ID: {account_id}. Status: {status_code}"
                )
                return False

        except Exception as e:
            logger.error(
                f"Error calling suspension API for {account_type} ID {account_id}: {e}"
            )
            return False


# Singleton instance
_failed_login_tracker_instance = None


def get_failed_login_tracker(db: Session) -> FailedLoginTracker:
    """Get or create FailedLoginTracker instance"""
    global _failed_login_tracker_instance
    if _failed_login_tracker_instance is None:
        _failed_login_tracker_instance = FailedLoginTracker(db)
    return _failed_login_tracker_instance
