"""Health and system API routes."""
import logging
from fastapi import APIRouter
from utils import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])

settings = get_settings()


@router.get("/health")
def health_check():
    """Health check endpoint (API v1)."""
    return {
        "status": "healthy",
        "service": "business-service",
        "version": settings.APP_VERSION,
    }


@router.get("/ready")
def readiness_check():
    """Readiness check endpoint (API v1)."""
    return {
        "status": "ready",
        "service": "business-service",
        "environment": settings.ENVIRONMENT,
    }


# Root level health endpoints - no auth required, no headers needed
@router.get("/../../health", include_in_schema=False)
def root_health_check():
    """Root level health check endpoint."""
    return {"status": "healthy"}


@router.get("/../../ready", include_in_schema=False)
def root_readiness_check():
    """Root level readiness check endpoint."""
    return {"status": "ready"}


@router.get("/system/info")
def system_info():
    """Get system information."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
    }


@router.get("/dapr/config")
def dapr_config():
    """Dapr configuration endpoint."""
    return {}


@router.get("/dapr/subscribe")
def dapr_subscribe():
    """Dapr subscription endpoint."""
    return []
