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
from utils import create_logger, UserRole, get_client_ip
from utils.errors import raise_http_exception_handler
from utils.auth_middleware import get_current_user

logger = create_logger(__name__)

auth_router = APIRouter()


@auth_router.post("")
def create_auth(
    request: Request,
    payload: CreateAuth,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Create auth route handler (self-registration).

    Fail-closed on privilege (OB-13): body-supplied privileged roles
    (platform_role / tenant_role / non-default user_role) are honored ONLY when
    the caller is (a) an authenticated service account — JWTAuthMiddleware sets
    request.state.is_service_caller for HS256 service JWTs carrying
    role='service' — or (b) an existing super_admin (Keycloak realm role present
    in the verified JWT claims). Anonymous or ordinary self-registration always
    gets the lowest default role; privileged roles are otherwise assignable only
    via admin-authenticated endpoints.
    """

    try:
        claims = getattr(request.state, "jwt_claims", None) or {}
        is_service_caller = bool(getattr(request.state, "is_service_caller", False))
        realm_roles = (claims.get("realm_access") or {}).get("roles") or []
        is_super_admin = "super_admin" in realm_roles
        if not (is_service_caller or is_super_admin):
            payload.user_role = UserRole.USER
            payload.platform_role = None
            payload.tenant_role = None
        elif payload.user_role is None:
            payload.user_role = UserRole.USER

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


@auth_router.delete("/{keycloak_id}")
def delete_auth(
    keycloak_id: str,
    request: Request,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
):
    """Delete an auth profile + its Keycloak identities (R1A saga-compensation
    contract, invoked by orchestrator workflow compensation).

    Service-token callers ONLY: JWTAuthMiddleware sets
    request.state.is_service_caller exclusively for HS256 service JWTs carrying
    role='service' (sub='orchestrator-service'); every other caller gets 403.
    Best-effort compensation — 404 when the profile is already absent is a
    valid terminal outcome for the compensating saga.
    """
    if not getattr(request.state, "is_service_caller", False):
        raise HTTPException(
            status_code=403,
            detail="Service token required (role='service').",
        )

    try:
        auth_service = AuthService(db)
        deleted = auth_service.delete_auth(keycloak_id, tenant_id, keycloak_realm)
        if not deleted:
            raise HTTPException(status_code=404, detail="Auth profile not found.")
        return responses.JSONResponse(content={"message": "success"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during delete_auth: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Delete auth failed.",
            code="AUTH-AUTH-INT-5002",
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
            # M-44: direct peer IP; XFF honored only from trusted proxies.
            "ip_address": get_client_ip(request),
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
