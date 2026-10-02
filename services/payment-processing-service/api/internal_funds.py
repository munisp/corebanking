"""MN-07: internal funds reservation API.

Replaces the log-only "soft reserve" stubs in payment-hub
(CoreBankingApiClient.ts) with real TigerBeetle pending transfers:
  POST /internal/funds/reserve  -> TransferFlags.PENDING hold (id deterministic
                                   from `reserve:{transaction_id}`)
  POST /internal/funds/release  -> VOID_PENDING_TRANSFER (idempotent)

Internal-only routes: they are mounted without the public /payment prefix and
are intended for service-to-service calls (payment-hub resolve/retry sweeper).
"""

from fastapi import APIRouter, HTTPException, Header, Body

from schemas.context import Context
from services.payment import PaymentService
from utils import create_logger

logger = create_logger(__name__)

internal_funds_router = APIRouter()


@internal_funds_router.post("/funds/reserve")
def reserve_funds(
    body: dict = Body(...),
    tenant_id: str = Header("system", alias="x-tenant-id"),
    keycloak_id: str = Header("payment-hub", alias="x-keycloak-id"),
    ledger_id: str = Header("1", alias="x-ledger-id"),
):
    try:
        account_id = body.get("account_id")
        amount_minor = body.get("amount_minor")
        transaction_id = str(body.get("transaction_id") or "").strip()
        if account_id is None or amount_minor is None or not transaction_id:
            raise HTTPException(
                status_code=422,
                detail="account_id, amount_minor and transaction_id are required",
            )
        context = Context(
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            ledger_id=str(ledger_id),
            mint_account_id="0",
        )
        result = PaymentService().reserve_funds(
            account_id=int(account_id),
            amount_minor=int(amount_minor),
            ledger_id=int(ledger_id),
            transaction_id=transaction_id,
            context=context,
        )
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("reserve_funds failed: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e) or "Reserve failed.")


@internal_funds_router.post("/funds/release")
def release_funds(
    body: dict = Body(...),
    tenant_id: str = Header("system", alias="x-tenant-id"),
    keycloak_id: str = Header("payment-hub", alias="x-keycloak-id"),
    ledger_id: str = Header("1", alias="x-ledger-id"),
):
    try:
        transaction_id = str(body.get("transaction_id") or "").strip()
        if not transaction_id:
            raise HTTPException(status_code=422, detail="transaction_id is required")
        result = PaymentService().release_funds(
            transaction_id=transaction_id,
            ledger_id=int(ledger_id),
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("release_funds failed: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e) or "Release failed.")
