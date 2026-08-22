"""Business Service - Main FastAPI application."""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from fastapi import Depends

from utils import config, BusinessServiceException, BusinessNotFoundError
from database import init_db, get_session
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from services import BusinessService
from api.v1 import business, business_user, business_account, health

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger(__name__)

settings = config.get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Starting Business Service...")
    init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down Business Service...")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Business Service for 54link Core Banking Platform",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(AuditMiddleware)
app.add_middleware(RequiredHeadersMiddleware)


# Exception handlers
@app.exception_handler(BusinessServiceException)
async def business_exception_handler(request: Request, exc: BusinessServiceException):
    """Handle BusinessServiceException."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "message": exc.message,
            "code": exc.code,
            "status_code": exc.status_code,
            "details": exc.details,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    return JSONResponse(
        status_code=422,
        content={
            "message": "Validation error",
            "code": "BUSINESS-SVC-VAL-4001",
            "status_code": 422,
            "details": exc.errors(),
        },
    )


# Include routers
app.include_router(
    health.router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    business.router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    business_user.router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    business_account.router,
    prefix=settings.API_V1_PREFIX,
)


@app.post("/business/kyb/complete")
def complete_kyb(request: Request, db: Session = Depends(get_session)):
    """Internal: called by orchestrator after KYB verification passes."""
    tenant_id  = request.headers.get("x-tenant-id")
    keycloak_id = request.headers.get("x-keycloak-id")

    if not tenant_id or not keycloak_id:
        return JSONResponse(
            status_code=400,
            content={"message": "x-tenant-id and x-keycloak-id headers are required"},
        )

    try:
        BusinessService.mark_kyb_complete(db, tenant_id, keycloak_id)
        return {"isSuccessful": True, "message": "KYB marked complete"}
    except BusinessNotFoundError as e:
        logger.warning(f"[kyb/complete] business not found — {e}")
        return JSONResponse(status_code=404, content={"message": str(e)})
    except Exception as e:
        logger.error(f"[kyb/complete] unexpected error — {e}")
        return JSONResponse(status_code=500, content={"message": "Internal server error"})


@app.get("/health")
def health():
    """Root level health check endpoint - no auth required."""
    return {"status": "healthy"}


@app.get("/ready")
def ready():
    """Root level readiness check endpoint - no auth required."""
    return {"status": "ready"}


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
