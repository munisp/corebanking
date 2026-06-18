"""Middleware for required headers validation."""
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from utils import UnauthorizedError

logger = logging.getLogger(__name__)

REQUIRED_HEADERS = [
    "x-tenant-id",
    "x-keycloak-id",
    "x-keycloak-realm",
]

EXCLUDED_PATHS = [
    "/health",
    "/healthz",
    "/ready",
    "/dapr",
    "/api/v1/health",
    "/business/kyb/complete",  # internal service-to-service call from orchestrator
]


class RequiredHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to validate required headers."""

    async def dispatch(self, request: Request, call_next):
        """Validate required headers."""
        # Skip validation for excluded paths
        if any(request.url.path.startswith(path) for path in EXCLUDED_PATHS):
            return await call_next(request)
        
        # Check required headers
        missing_headers = []
        for header in REQUIRED_HEADERS:
            if header not in request.headers:
                missing_headers.append(header)
        
        if missing_headers:
            logger.warning(f"Missing required headers: {missing_headers}")
            return JSONResponse(
                status_code=400,
                content={
                    "message": f"Missing required headers: {', '.join(missing_headers)}",
                    "code": "BUSINESS-SVC-VAL-4001",
                    "status_code": 400,
                },
            )
        
        # Add headers to request state for easy access
        request.state.tenant_id = request.headers.get("x-tenant-id")
        request.state.keycloak_id = request.headers.get("x-keycloak-id")
        request.state.keycloak_realm = request.headers.get("x-keycloak-realm")
        
        return await call_next(request)
