import logging

from fastapi import FastAPI

from database import Base, engine
from api.v1 import account_router, health_router, system_router, bank_router, statements_router, opening_router, closure_router, safe_deposit_router, billing_router, lifecycle_router
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

# PL-04 (F14-2): import-time DESTRUCTIVE DDL removed. The previous block ran
# `ALTER TABLE account DROP COLUMN IF EXISTS balance` at every app boot with no
# backfill — silently zeroing balances on any DB created before alembic was
# wired. Destructive schema changes now live exclusively in the alembic chain
# (alembic/versions/001_baseline.py -> 002_kobo_balance_rls_idempotency.py,
# which backfills balance_kobo BEFORE dropping balance). Run migrations with:
#   DATABASE_URL=... alembic upgrade head
# The statements below are EXPAND-ONLY and idempotent (ADD COLUMN IF NOT
# EXISTS / CREATE TABLE IF NOT EXISTS / ADD VALUE IF NOT EXISTS): they are the
# migration path for pre-alembic DBs for columns/tables introduced by
# MN-01..MN-05 and are safe to run at every boot.
with engine.begin() as _conn:
    # MN-01/MN-03/MN-04: expand-only column migrations.
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS guardian_id VARCHAR"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS daily_limit_kobo BIGINT"))
    _conn.execute(text("ALTER TABLE account ADD COLUMN IF NOT EXISTS mandate VARCHAR NOT NULL DEFAULT 'single'"))
    # MN-01/MN-02/MN-05: new status enum values (expand-only; idempotent).
    for _status in ("dormant", "closed", "deceased"):
        _conn.execute(text(f"ALTER TYPE accountstatus ADD VALUE IF NOT EXISTS '{_status}'"))
    # MN-03: signatories table.
    _conn.execute(text("""CREATE TABLE IF NOT EXISTS account_signatories (
        id VARCHAR PRIMARY KEY,
        account_id VARCHAR NOT NULL,
        signatory_keycloak_id VARCHAR NOT NULL,
        name VARCHAR NOT NULL,
        role VARCHAR NOT NULL DEFAULT 'signatory',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        tenant_id VARCHAR NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_signatory UNIQUE (account_id, signatory_keycloak_id)
    )"""))
    # MN-04: minor-account fields on opening applications.
    _conn.execute(text("ALTER TABLE account_opening_applications ADD COLUMN IF NOT EXISTS guardian_id VARCHAR"))
    _conn.execute(text("ALTER TABLE account_opening_applications ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT FALSE"))
    _conn.execute(text("ALTER TABLE account_opening_applications ADD COLUMN IF NOT EXISTS daily_limit_kobo BIGINT"))

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(account_router, prefix="/account", tags=["account"])
app.include_router(bank_router, prefix="/bank", tags=["bank"])
app.include_router(system_router, prefix="/system", tags=["system"])
app.include_router(statements_router, prefix="/statements", tags=["statements"])
app.include_router(opening_router, prefix="/account-opening", tags=["account-opening"])
app.include_router(closure_router, prefix="/account-closure", tags=["account-closure"])
app.include_router(safe_deposit_router, prefix="/safe-deposit", tags=["safe-deposit"])
app.include_router(billing_router, prefix="/billing", tags=["billing"])
# MN-03/MN-05: signatories/mandate + deceased/estate payout.
app.include_router(lifecycle_router, prefix="/account", tags=["account-lifecycle"])

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Account Service is running..")
