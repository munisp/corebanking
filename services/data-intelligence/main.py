import logging

from fastapi import FastAPI
from utils import get_config
from dapr.ext.fastapi import DaprApp  # type: ignore

from database import Base, engine
from events.subscribers.v1 import subscribe
from api.v1 import health_router, event_router
from middlewares import RequiredHeadersMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup config
config = get_config()

app = FastAPI(
    title="Data Intelligence Service",
    description="54link data intelligence service.",
    version="0.0.0"
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
    ],
    exclude_prefixes=["/health", "/dapr", "/events"],
)

Base.metadata.create_all(bind=engine)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(event_router, prefix="/api/v1/raw", tags=["event"])

dapr_app = DaprApp(app)

subscribe(dapr_app)

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Data Intelligence Service is running..")
