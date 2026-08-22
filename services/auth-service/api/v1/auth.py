from fastapi import APIRouter, Depends, HTTPException, responses, Header, Request
from sqlalchemy.orm import Session

from schemas.v1 import (
    CreateAuth,
    Login,
    SetupPassword,
    ForgotPassword,
    ResetPassword,
    ChangePassword,
    Context,
)
from database import get_session
from services import AuthService
from utils import create_logger, UserRole
from utils.errors import raise_http_exception_handler
from utils.auth_middleware import get_current_user

logger = create_logger(__name__)

auth_router = APIRouter()


@auth_router.post("")
def create_auth(
    payload: CreateAuth,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Create auth route handler (self-registration).

    Fail-closed on privilege: body-supplied privileged roles are ignored.
    Self-registered identities always get the lowest default role; privileged
    roles are only assignable via admin-authenticated endpoints.
    """

    try:
        payload.user_role = UserRole.USER
        payload.platform_role = None
        payload.tenant_role = None

        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        auth = auth_service.create_auth(payload, context)

        auth_data = auth.to_dict()
        # The stored api_secret is a salted hash — never expose it. The
        # plaintext secret is returned exactly once, at creation time only.
        auth_data.pop("api_secret", None)
        plaintext_api_secret = getattr(auth, "_plaintext_api_secret", None)
        if plaintext_api_secret is not None:
            auth_data["api_secret"] = plaintext_api_secret

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


@auth_router.post("/login")
def login(
    request: Request,
    payload: Login,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Login route handler."""

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        device_info = {
            "user_agent": request.headers.get("user-agent", ""),
            "ip_address": request.client.host if request.client else None,
            "device_fingerprint": request.headers.get("x-device-fingerprint", ""),
        }

        token = auth_service.login(payload, context, device_info)

        return responses.JSONResponse(
            content={"message": "success", **token}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during login: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Login failed.",
            code="AUTH-AUTH-INT-5001",
        )


@auth_router.post("/setup-password")
def setup_password(
    payload: SetupPassword,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Setup password route handler."""

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        auth_service.setup_password(payload, context)

        return responses.JSONResponse(content={"message": "success"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during setup_password: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Setup password failed.",
            code="AUTH-AUTH-INT-5002",
        )


@auth_router.post("/forgot-password")
def forgot_password(
    payload: ForgotPassword,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Forgot password route handler."""

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        result = auth_service.forgot_password(payload, context)

        return responses.JSONResponse(
            content={"message": "success", **result}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during forgot_password: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Forgot password failed.",
            code="AUTH-AUTH-INT-5003",
        )


@auth_router.post("/reset-password")
def reset_password(
    payload: ResetPassword,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Reset password route handler."""

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        auth_service.reset_password(payload, context)

        return responses.JSONResponse(content={"message": "success"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during reset_password: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Reset password failed.",
            code="AUTH-AUTH-INT-5004",
        )


@auth_router.post("/change-password")
def change_password(
    payload: ChangePassword,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    current_user: dict = Depends(get_current_user),
):
    """Change password route handler (requires authentication)."""

    try:
        auth_service = AuthService(db)

        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        auth_service.change_password(payload, context, current_user["keycloak_id"])

        return responses.JSONResponse(content={"message": "success"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during change_password: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Change password failed.",
            code="AUTH-AUTH-INT-5005",
        )
