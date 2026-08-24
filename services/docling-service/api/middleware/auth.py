"""Authentication middleware for docling-service.

Fail-closed: requests without a verifiable Bearer JWT are rejected with 401.
Tenant identity is derived from verified token claims, never from
caller-supplied headers alone.
"""

import os

from fastapi import Header, HTTPException


def validate_jwt(headers):
    """Validate Bearer JWT with real HS256 signature verification (stdlib).

    Fails closed: returns (None, reason) whenever the token cannot be
    cryptographically verified, is expired, is missing exp, or JWT_SECRET is
    not configured. Never warn-and-allow.
    Canonical implementation: services/shared/auth/jwt_validation.py.
    """
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None, "Missing Bearer token"
    token = auth[7:]
    import hmac, hashlib, base64, json as _json, time as _t

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


async def get_current_claims(authorization: str = Header(None)) -> dict:
    """Require a valid Bearer JWT and return its verified claims."""
    claims, err = validate_jwt({"Authorization": authorization or ""})
    if err is not None:
        raise HTTPException(status_code=401, detail=f"Unauthorized: {err}")
    return claims


async def get_current_tenant(authorization: str = Header(None)) -> str:
    """Extract tenant ID from verified JWT claims (fail-closed)."""
    claims = await get_current_claims(authorization)
    tenant_id = claims.get("tenant_id") or claims.get("tenant")
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Token missing tenant claim")
    return tenant_id
