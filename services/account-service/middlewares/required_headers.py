import hashlib
import hmac
import os

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import base64, json as _json, time as _t

    def _b64url_decode(s):
        s += "=" * (-len(s) % 4)
        return base64.urlsafe_b64decode(s.encode())

    parts = token.split(".")
    if len(parts) != 3:
        return None, "Invalid token format"
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or secret.startswith("${"):
        return None, "auth_not_configured"
    try:
        header = _json.loads(_b64url_decode(parts[0]))
        payload = _json.loads(_b64url_decode(parts[1]))
        signature = _b64url_decode(parts[2])
    except Exception:
        return None, "Invalid token encoding"
    if header.get("alg") != "HS256":
        return None, "Unsupported token algorithm"
    expected = hmac.new(secret.encode(), (parts[0] + "." + parts[1]).encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        return None, "Invalid token signature"
    exp = payload.get("exp")
    if exp is None:
        return None, "Token missing exp claim"
    try:
        if _t.time() >= float(exp):
            return None, "Token expired"
    except (TypeError, ValueError):
        return None, "Invalid token expiry"
    issuer = os.environ.get("JWT_ISSUER", "")
    if issuer and payload.get("iss") != issuer:
        return None, "Invalid token issuer"
    return payload, None


def _set_scope_header(scope, name: str, value: str) -> None:
    """Overwrite a request header in the ASGI scope so downstream handlers
    see the identity derived from verified token claims, not the raw
    caller-supplied value."""
    encoded = name.lower().encode("latin-1")
    headers = [(k, v) for k, v in scope.get("headers", []) if k != encoded]
    headers.append((encoded, value.encode("latin-1")))
    scope["headers"] = headers


class RequiredHeadersMiddleware(BaseHTTPMiddleware):
    """Requires identity headers AND authenticates them (fail-closed).

    Identity (x-keycloak-id, x-tenant-id) is derived from verified Bearer JWT
    claims; caller-supplied values for those headers are overwritten with the
    claim values so downstream code cannot be spoofed.

    Fallback: requests without a JWT are only accepted when they carry an
    `x-gateway-secret` header matching the TRUSTED_GATEWAY_SECRET env var —
    i.e. they arrive via the trusted gateway (APISIX 54link-access-plugin),
    which has already authenticated the caller and vouches for the identity
    headers. If neither a valid JWT nor the gateway secret is present, the
    request is rejected with 401.
    """

    def __init__(
        self,
        app,
        required_headers: list[str],
        exclude_paths: list[str] | None = None,
        exclude_prefixes: list[str] | None = None,
    ):
        super().__init__(app)
        self.required_headers = [h.lower() for h in required_headers]
        self.exclude_paths = exclude_paths or []
        self.exclude_prefixes = exclude_prefixes or []

    def _is_trusted_gateway(self, request: Request) -> bool:
        expected = os.environ.get("TRUSTED_GATEWAY_SECRET", "")
        if not expected:
            return False
        presented = request.headers.get("x-gateway-secret", "")
        return bool(presented) and hmac.compare_digest(presented, expected)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if path in self.exclude_paths:
            return await call_next(request)

        for prefix in self.exclude_prefixes:
            if path.startswith(prefix):
                return await call_next(request)

        missing_headers = [
            header for header in self.required_headers
            if header not in request.headers
        ]

        claims, jwt_err = validate_jwt(request.headers)

        if claims is not None:
            # Authenticated directly by JWT: derive identity from verified
            # claims, ignoring any caller-supplied identity headers.
            keycloak_id = claims.get("sub") or claims.get("keycloak_id")
            tenant_id = claims.get("tenant_id") or claims.get("tenant")
            if not keycloak_id or not tenant_id:
                return JSONResponse(
                    status_code=401,
                    content={"error": "Token missing required identity claims"},
                )
            _set_scope_header(request.scope, "x-keycloak-id", str(keycloak_id))
            _set_scope_header(request.scope, "x-tenant-id", str(tenant_id))
            missing_headers = [
                h for h in missing_headers if h not in ("x-keycloak-id", "x-tenant-id")
            ]
        elif not self._is_trusted_gateway(request):
            # Not JWT-authenticated and not from the trusted gateway:
            # self-asserted identity headers are not accepted.
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": jwt_err},
            )

        if missing_headers:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Missing required headers",
                    "missing": missing_headers,
                },
            )

        return await call_next(request)
