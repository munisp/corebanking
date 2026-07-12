# DEPRECATED: payment-processing-service is superseded by payments-hub-go (platform canonical).
# Do not add new payment flows here. Migrate to payments-hub-go.
import logging as _logging
_logging.warning("DEPRECATED: payment-processing-service — migrate to payments-hub-go")

from fastapi import FastAPI

from database import Base, engine
from api import (
    health_router,
    payment_router,
    qr_router,
    system_router,
    charges_router,
    transfers_router,
)
from utils import get_config
from utils.coa_client import CoAClient
from middlewares import RequiredHeadersMiddleware

# Setup config
config = get_config()

# Initialize CoA Client
coa_client = CoAClient()

app = FastAPI(
    title="Payment processing service",
    description="54Link payment processing service.",
    version="0.0.1",
)

app.add_middleware(
    RequiredHeadersMiddleware,
    required_headers=[
        "x-tenant-id",
        "x-keycloak-id",
        "x-ledger-id",
        "x-mint-account-id",
    ],
    exclude_prefixes=["/health", "/dapr", "/charges", "/transfers"],
)

Base.metadata.create_all(bind=engine)

app.include_router(health_router, prefix="", tags=["health"])
app.include_router(charges_router, prefix="/charges", tags=["charges"])
app.include_router(transfers_router, prefix="/transfers", tags=["transfers"])
app.include_router(payment_router, prefix="/payment", tags=["payment"])
app.include_router(qr_router, prefix="/qr", tags=["qr"])
app.include_router(system_router, prefix="/system", tags=["system"])
