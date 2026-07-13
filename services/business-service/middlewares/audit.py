"""Middleware for audit logging."""
import logging
import time
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("audit")


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware for audit logging."""

    async def dispatch(self, request: Request, call_next):
        """Log all requests."""
        start_time = time.time()
        
        # Log request
        logger.info(
            json.dumps({
                "type": "request",
                "method": request.method,
                "path": request.url.path,
                "tenant_id": request.headers.get("x-tenant-id", "unknown"),
                "keycloak_id": request.headers.get("x-keycloak-id", "unknown"),
            })
        )
        
        response = await call_next(request)
        
        # Log response
        duration = time.time() - start_time
        logger.info(
            json.dumps({
                "type": "response",
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": int(duration * 1000),
                "tenant_id": request.headers.get("x-tenant-id", "unknown"),
            })
        )
        
        return response
