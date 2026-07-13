import logging

from fastapi import FastAPI
from sqlalchemy import text

from database import Base, engine
from api.v1 import account_router, health_router, system_router, bank_router, statements_router, opening_router, closure_router, safe_deposit_router, billing_router
from utils import get_config
from utils.coa_client import CoAClient
from database import get_session
from middlewares import RequiredHeadersMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup config
config = get_config()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(
    title="Account service",
    description="54link account management service.",
    version="0.0.1"
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-ledger-id",
    ],
    exclude_prefixes=["/health", "/dapr"],
)

Base.metadata.create_all(bind=engine)

# Idempotent column migrations — handles DBs created before alembic was wired up.
with engine.begin() as _conn:
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS balance_kobo BIGINT NOT NULL DEFAULT 0"))
    _conn.execute(text("ALTER TABLE account DROP COLUMN IF EXISTS balance"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS tier VARCHAR DEFAULT 'tier1'"))

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(account_router, prefix="/account", tags=["account"])
app.include_router(bank_router, prefix="/bank", tags=["bank"])
app.include_router(system_router, prefix="/system", tags=["system"])
app.include_router(statements_router, prefix="/statements", tags=["statements"])
app.include_router(opening_router, prefix="/account-opening", tags=["account-opening"])
app.include_router(closure_router, prefix="/account-closure", tags=["account-closure"])
app.include_router(safe_deposit_router, prefix="/safe-deposit", tags=["safe-deposit"])
app.include_router(billing_router, prefix="/billing", tags=["billing"])

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Account Service is running..")
