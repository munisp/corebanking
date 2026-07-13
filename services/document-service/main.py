import logging

from fastapi import FastAPI

from database import Base, engine
from api.v1 import health_router, document_router
from utils import get_config
from middlewares import RequiredHeadersMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup config
config = get_config()

app = FastAPI(
    title="Document service",
    description="54link document service.",
    version="0.0.0"
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
    ],
    exclude_prefixes=["/health", "/dapr"],
)

Base.metadata.create_all(bind=engine)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(document_router, prefix="", tags=["document"])

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Document Service is running..")
