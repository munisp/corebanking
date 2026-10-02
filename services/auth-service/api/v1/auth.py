from fastapi import APIRouter, Depends, HTTPException, responses, Header, Request
from sqlalchemy.orm import Session

from schemas.v1 import (
    CreateAuth,
    Login,
    SetupPassword,
    ForgotPassword,
    ResetPassword,
    ChangePassword,
    VerifyOTP,
    VerifyEmail,
    ResendOTP,
    ResendVerification,
    CreatePin,
    UpdateUser,
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


# ────────────────────────────────────────────────────────────────────────────
# W12-A4A: session-family endpoints called by the mobile/web2 UIs. Created to
# close 8 UI-called paths that previously 404'd (verify-otp, verify-email,
# resend-otp, resend-verification, logout, me, create-pin, PUT user).
# Convention: gateway /auth/* strips the first segment, so the UI reaches
# these as /auth/auth/<path>.
# ────────────────────────────────────────────────────────────────────────────


def _resolve_keycloak_id(body_keycloak_id, header_keycloak_id) -> str:
    """OTP flows are unauthenticated (login), so the UI supplies the identity
    either in the body or via the x-keycloak-id header the API clients attach."""
    keycloak_id = body_keycloak_id or header_keycloak_id
    if not keycloak_id:
        raise_http_exception_handler(
            status_code=400,
            message="keycloak_id is required (body or x-keycloak-id header).",
            code="AUTH-AUTH-OTP-4001",
        )
    return keycloak_id


@auth_router.post("/verify-otp")
def verify_otp(
    payload: VerifyOTP,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    x_keycloak_id: str = Header(None, alias="x-keycloak-id"),
):
    """Verify a login OTP (mobile/web2 verify-otp)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        keycloak_id = _resolve_keycloak_id(payload.keycloak_id, x_keycloak_id)
        otp_code = payload.resolved_otp()
        if not otp_code:
            raise_http_exception_handler(
                status_code=400,
                message="OTP code is required.",
                code="AUTH-AUTH-OTP-4002",
            )

        result = auth_service.verify_otp(keycloak_id, otp_code, context)

        return responses.JSONResponse(
            content={"message": "success", "success": True, **result},
            status_code=200,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during verify_otp: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="OTP verification failed.",
            code="AUTH-AUTH-INT-5010",
        )


@auth_router.post("/verify-email")
def verify_email(
    payload: VerifyEmail,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    x_keycloak_id: str = Header(None, alias="x-keycloak-id"),
):
    """Verify the emailed verification token (mobile/web2 verify-email)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        keycloak_id = _resolve_keycloak_id(payload.keycloak_id, x_keycloak_id)
        result = auth_service.verify_email(keycloak_id, payload.token, context)

        return responses.JSONResponse(
            content={"message": "success", "success": True, **result},
            status_code=200,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during verify_email: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Email verification failed.",
            code="AUTH-AUTH-INT-5011",
        )


@auth_router.post("/resend-otp")
def resend_otp(
    payload: ResendOTP,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    x_keycloak_id: str = Header(None, alias="x-keycloak-id"),
):
    """Regenerate a login OTP (mobile/web2 resend-otp)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        keycloak_id = _resolve_keycloak_id(payload.keycloak_id, x_keycloak_id)
        result = auth_service.resend_otp(keycloak_id, context)

        return responses.JSONResponse(
            content={"message": "success", "success": True, **result},
            status_code=200,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during resend_otp: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Resend OTP failed.",
            code="AUTH-AUTH-INT-5012",
        )


@auth_router.post("/resend-verification")
def resend_verification(
    payload: ResendVerification,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    x_keycloak_id: str = Header(None, alias="x-keycloak-id"),
):
    """Resend the email-verification OTP (mobile/web2 resend-verification)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        keycloak_id = _resolve_keycloak_id(payload.keycloak_id, x_keycloak_id)
        result = auth_service.resend_verification(keycloak_id, context)

        return responses.JSONResponse(
            content={"message": "success", "success": True, **result},
            status_code=200,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during resend_verification: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Resend verification failed.",
            code="AUTH-AUTH-INT-5013",
        )


@auth_router.post("/logout")
def logout(
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    current_user: dict = Depends(get_current_user),
):
    """Logout (requires authentication): revoke Keycloak sessions + OTP state."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        auth_service.logout(current_user["keycloak_id"], context)

        return responses.JSONResponse(content={"message": "success"}, status_code=200)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during logout: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Logout failed.",
            code="AUTH-AUTH-INT-5014",
        )


@auth_router.get("/me")
def get_me(
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    current_user: dict = Depends(get_current_user),
):
    """Return the authenticated user's auth profile (web2 getCurrentUser)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        profile = auth_service.get_me(current_user["keycloak_id"], context)

        return responses.JSONResponse(
            content={"message": "success", "data": profile}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during get_me: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Failed to fetch current user.",
            code="AUTH-AUTH-INT-5015",
        )


@auth_router.post("/create-pin")
def create_pin(
    payload: CreatePin,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    current_user: dict = Depends(get_current_user),
):
    """Create/rotate the transaction PIN (requires authentication)."""

    try:
        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        result = auth_service.create_pin(
            current_user["keycloak_id"],
            payload.new_pin,
            payload.current_pin,
            context,
        )

        return responses.JSONResponse(
            content={"message": "success", **result}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during create_pin: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Create PIN failed.",
            code="AUTH-AUTH-INT-5016",
        )


@auth_router.put("/user")
def update_user(
    payload: UpdateUser,
    keycloak_id: str = None,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_realm: str = Header(..., alias="x-keycloak-realm"),
    keycloak_pub_key: str = Header(..., alias="x-keycloak-pub-key"),
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile (mobile PUT /auth/user).

    Ownership is enforced: the optional ?keycloak_id= query param the mobile
    client sends must match the token subject."""

    try:
        token_keycloak_id = current_user["keycloak_id"]
        if keycloak_id and keycloak_id != token_keycloak_id:
            raise_http_exception_handler(
                status_code=403,
                message="Cannot update another user's profile.",
                code="AUTH-AUTH-USER-4031",
            )

        auth_service = AuthService(db)
        context = Context(
            tenant_id=tenant_id,
            keycloak_realm=keycloak_realm,
            keycloak_pub_key=keycloak_pub_key,
        )

        profile = auth_service.update_user(token_keycloak_id, payload, context)

        return responses.JSONResponse(
            content={"message": "success", "user": profile}, status_code=200
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error during update_user: {str(e)}")
        raise_http_exception_handler(
            status_code=500,
            message="Update user failed.",
            code="AUTH-AUTH-INT-5017",
        )
