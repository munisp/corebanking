import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, responses, Header
from sqlalchemy.orm import Session
from schemas.v1 import CreateAuth, SetupPassword, Context
from database import get_session
from utils import create_logger, get_config, UserRole
from services import AuthService
from utils.errors import raise_http_exception_handler

config = get_config()

logger = create_logger(__name__)

system_router = APIRouter()

DEFAULT_TENANT_ID = "54link"
DEFAULT_KEYCLOAK_REALM = config.DEFAULT_KEYCLOAK_REALM
DEFAULT_KEYCLOAK_PUBLIC_KEY = config.DEFAULT_KEYCLOAK_PUBLIC_KEY
DEFAULT_SUPER_ADMIN_NAME = config.DEFAULT_SUPER_ADMIN_NAME
DEFAULT_SUPER_ADMIN_EMAIL = config.DEFAULT_SUPER_ADMIN_EMAIL
DEFAULT_SUPER_ADMIN_PASSWORD = config.DEFAULT_SUPER_ADMIN_PASSWORD

def _bootstrap_guard(bootstrap_admin_token: str) -> None:
    """Fail-closed guard for the admin bootstrap endpoint.

    Seeding a SUPERADMIN is only allowed:
      - outside production (ENVIRONMENT/FLASK_ENV != "production"), AND
      - when the BOOTSTRAP_ADMIN_TOKEN env var is configured AND the caller
        presents a matching x-bootstrap-admin-token header.
    Otherwise the endpoint is indistinguishable from non-existent (404) or
    forbidden (403 on token mismatch).
    """
    environment = os.getenv("ENVIRONMENT", os.getenv("FLASK_ENV", "development")).lower()
    expected_token = os.getenv("BOOTSTRAP_ADMIN_TOKEN", "")
    if environment == "production" or not expected_token:
        raise HTTPException(status_code=404, detail="Not found")
    if not bootstrap_admin_token or not hmac.compare_digest(
        bootstrap_admin_token, expected_token
    ):
        raise HTTPException(status_code=403, detail="Forbidden")


@system_router.post("/seed/admin")
def seed_default_admin(
    db: Session = Depends(get_session),
    bootstrap_admin_token: str = Header(None, alias="x-bootstrap-admin-token"),
):
    """Seed default admin route handler (bootstrap-gated, non-production only)."""

    _bootstrap_guard(bootstrap_admin_token)

    if not DEFAULT_SUPER_ADMIN_PASSWORD:
        logger.error("DEFAULT_SUPER_ADMIN_PASSWORD is not configured; refusing to seed admin")
        raise_http_exception_handler(
            status_code=500,
            message="Admin bootstrap is not configured on this service.",
            code="AUTH-SYSTEM-CONFIG-5000",
        )

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=DEFAULT_TENANT_ID,
            keycloak_realm=DEFAULT_KEYCLOAK_REALM,
            keycloak_pub_key=DEFAULT_KEYCLOAK_PUBLIC_KEY,
        )

        create_auth_payload = CreateAuth(
            name=DEFAULT_SUPER_ADMIN_NAME,
            email=DEFAULT_SUPER_ADMIN_EMAIL,
            user_role=UserRole.SUPERADMIN,
        )

        auth = auth_service.create_auth(create_auth_payload, context)

        setup_password_payload = SetupPassword(
            keycloak_id=auth.keycloak_id,
            password=DEFAULT_SUPER_ADMIN_PASSWORD,
            confirm_password=DEFAULT_SUPER_ADMIN_PASSWORD,
        )

        auth_service.setup_password(setup_password_payload, context)

        auth_data = auth.to_dict()
        # The stored api_secret is a salted hash — never expose it.
        auth_data.pop("api_secret", None)

        return responses.JSONResponse(
            content={"message": "success", "auth": auth_data}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during create_auth: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Create auth failed.",
            code="AUTH-AUTH-INT-5000",
        )
