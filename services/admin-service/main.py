import logging
import atexit
from fastapi import FastAPI
from sqlalchemy import text

from database import Base, engine
from api.v1 import health_router, admin_router
from utils import get_config
from middlewares import RequiredHeadersMiddleware, AuditMiddleware
from utils.kafka_instance import KafkaClientInstance

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup config
config = get_config()

app = FastAPI(
    title="Admin service", description="54link admin service.", version="0.0.1"
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
    ],
    exclude_prefixes=["/health", "/dapr", "/metrics", "/metrics/kafka"],
)
app.add_middleware(AuditMiddleware)


# Register shutdown handler
@atexit.register
def shutdown_kafka():
    KafkaClientInstance.close()


try:
    Base.metadata.create_all(bind=engine)
except Exception as _e:
    logger.warning(f"create_all deferred (DB not ready yet): {_e}")

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])


# Kafka metrics endpoint
@app.get("/metrics/kafka")
def get_kafka_metrics():
    """Get Kafka publishing metrics"""
    return {
        "status": "connected" if KafkaClientInstance.is_connected() else "disconnected",
        "metrics": KafkaClientInstance.get_metrics(),
    }


def run_migrations():
    """
    Idempotent schema migrations — safe to run on every startup.
    """
    try:
        with engine.connect() as conn:
            # Migrate access_level from legacy enum to VARCHAR
            result = conn.execute(
                text(
                    "SELECT data_type FROM information_schema.columns "
                    "WHERE table_name='admin' AND column_name='access_level'"
                )
            )
            row = result.fetchone()
            if row and row[0].lower() != "character varying":
                conn.execute(
                    text(
                        "ALTER TABLE admin ALTER COLUMN access_level TYPE VARCHAR(100) "
                        "USING access_level::text"
                    )
                )
                conn.execute(text("DROP TYPE IF EXISTS accesslevel"))
                conn.commit()
                logger.info("✅ Migrated admin.access_level to VARCHAR(100)")

            # Add branch_id column if it doesn't exist
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='admin' AND column_name='branch_id'"
                )
            )
            if not result.fetchone():
                conn.execute(text("ALTER TABLE admin ADD COLUMN branch_id VARCHAR"))
                conn.commit()
                logger.info("✅ Added admin.branch_id column")

            # Add is_verified column if it doesn't exist
            result = conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name='admin' AND column_name='is_verified'"
                )
            )
            if not result.fetchone():
                conn.execute(text("ALTER TABLE admin ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT FALSE"))
                conn.commit()
                logger.info("✅ Added admin.is_verified column")
    except Exception as e:
        logger.warning(f"Migration check skipped or already applied: {e}")


@app.on_event("startup")
async def startup_event():
    # Retry create_all in case the DB wasn't ready at import time
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"create_all on startup failed: {e}")
    run_migrations()
    logger.info("🚀 Admin Service is running..")
