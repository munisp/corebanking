import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends

from database import Base, engine
from api import health_router, transaction_router, investigation_router
from utils import get_config
from utils.coa_client import CoAClient
from middlewares import swagger_keycloak_id_auth, get_request_auth_headers
from dapr.ext.fastapi import DaprApp  # type: ignore
from events import subscribe

logger = logging.getLogger(__name__)

# Setup config
config = get_config()

# Initialize CoA Client
coa_client = CoAClient()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified")
    except Exception as exc:
        logger.error("Failed to run create_all: %s", exc)
    yield


app = FastAPI(
    title="Transaction ledger",
    description="54Link transaction ledger.",
    version="0.0.0",
    lifespan=lifespan,
)

dapr_app = DaprApp(app)

app.middleware("http")(get_request_auth_headers)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(transaction_router, prefix="/txn", tags=["transactions"])
app.include_router(investigation_router, prefix="/v1/investigations", tags=["investigations"])

subscribe(dapr_app)
