import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_session
from models.account_closure import AccountClosureRequest

closure_router = APIRouter()


class CreateClosurePayload(BaseModel):
    accountId: str
    accountName: Optional[str] = None
    closureType: str
    reason: str
    requestedBy: Optional[str] = None


@closure_router.get("/list")
def list_closures(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    q = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.tenant_id == tenant_id
    )
    if status:
        q = q.filter(AccountClosureRequest.status == status)
    total = q.count()
    items = q.order_by(AccountClosureRequest.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"items": [r.to_dict() for r in items], "total": total, "page": page, "limit": limit}


@closure_router.get("/stats")
def get_stats(
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    q = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.tenant_id == tenant_id
    )
    total = q.count()
    by_status = {}
    for row in q.all():
        by_status[row.status] = by_status.get(row.status, 0) + 1
    return {"total": total, **by_status}


@closure_router.get("/{closure_id}")
def get_closure(
    closure_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    req = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.id == closure_id,
        AccountClosureRequest.tenant_id == tenant_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Closure request not found")
    return req.to_dict()


@closure_router.post("")
def create_closure(
    payload: CreateClosurePayload,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    record = AccountClosureRequest(
        id=str(uuid.uuid4()),
        account_id=payload.accountId,
        account_name=payload.accountName,
        closure_type=payload.closureType,
        reason=payload.reason,
        requested_by=payload.requestedBy or keycloak_id,
        status="pending",
        tenant_id=tenant_id,
        keycloak_id=keycloak_id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"message": "success", "data": record.to_dict()}


@closure_router.patch("/{closure_id}/approve")
def approve_closure(
    closure_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    req = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.id == closure_id,
        AccountClosureRequest.tenant_id == tenant_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Closure request not found")
    if req.status not in ("pending", "in_review"):
        raise HTTPException(status_code=400, detail=f"Cannot approve a request with status '{req.status}'")
    req.status = "approved"
    db.commit()
    db.refresh(req)
    return {"message": "success", "data": req.to_dict()}


# ---------------------------------------------------------------------------
# MN-02 (S2): real closure — balance check, residual sweep, lien/dispute
# refusal, terminal CLOSED status. Previously a pure status flip that left
# residual funds stranded and the account spendable.
# ---------------------------------------------------------------------------

from repositories import AccountRepository
from utils import create_logger, get_config
from utils.enums import AccountStatus
from utils.external_api_client import ExternalAPIClient

logger = create_logger(__name__)
config = get_config()


class CompleteClosurePayload(BaseModel):
    destinationAccount: Optional[str] = None  # TB account id receiving residual


def _service_headers(tenant_id: str, keycloak_id: str) -> dict:
    headers = {
        "Content-Type": "application/json",
        "x-tenant-id": tenant_id,
        "x-keycloak-id": keycloak_id,
    }
    token = str(getattr(config, "INTERNAL_SERVICE_TOKEN", "") or "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _refuse_if_active_liens(account_id: int, tenant_id: str, keycloak_id: str) -> None:
    lien_url = str(getattr(config, "LIEN_SVC_URL", "") or "")
    client = ExternalAPIClient(base_url=lien_url, headers=_service_headers(tenant_id, keycloak_id))
    try:
        resp = client._get(f"/api/v1/lien/account?account_id={account_id}")
    except Exception as exc:
        # Fail-closed: cannot prove no court-ordered freeze exists.
        raise HTTPException(
            status_code=503, detail="Lien service unavailable; closure refused"
        ) from exc
    if int((resp or {}).get("total_active_kobo", 0)) > 0:
        raise HTTPException(
            status_code=409,
            detail="Account has active liens/holds; closure refused",
        )


def _refuse_if_open_disputes(account, tenant_id: str, keycloak_id: str) -> None:
    dispute_url = str(getattr(config, "DISPUTE_SVC_URL", "") or "").strip()
    if not dispute_url:
        logger.warning("DISPUTE_SVC_URL not configured; skipping dispute check for closure")
        return
    client = ExternalAPIClient(base_url=dispute_url, headers=_service_headers(tenant_id, keycloak_id))
    try:
        disputes = client._get("/api/v1/disputes") or []
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="Dispute service unavailable; closure refused"
        ) from exc
    open_disputes = [
        d for d in disputes
        if str(d.get("status") or "").lower() not in ("resolved", "closed", "rejected")
    ]
    if open_disputes:
        raise HTTPException(
            status_code=409,
            detail=f"Customer has {len(open_disputes)} open dispute(s); closure refused",
        )


def _sweep_residual(
    *, account_id: int, destination: str, balance_kobo: int, closure_ref: str,
    tenant_id: str, keycloak_id: str,
) -> None:
    """Sweep the residual balance via journal-posting-go (balanced Dr source /
    Cr destination, posted to TigerBeetle). Idempotent via transactionRef
    closure:{request_id}. Failure -> 503, closure NOT completed (saga: the
    status flip only happens after the sweep is confirmed)."""
    journal_url = str(getattr(config, "JOURNAL_POSTING_URL", "") or "")
    client = ExternalAPIClient(base_url=journal_url, headers=_service_headers(tenant_id, keycloak_id))
    payload = {
        "tenantId": tenant_id,
        "transactionRef": f"closure:{closure_ref}",
        "narration": f"Account closure residual sweep {closure_ref}",
        "currency": "NGN",
        "legs": [
            {"accountId": int(account_id), "type": "debit", "amount": int(balance_kobo)},
            {"accountId": int(destination), "type": "credit", "amount": int(balance_kobo)},
        ],
    }
    try:
        client._post("/v1/journals", data=payload)
    except Exception as exc:
        logger.error("Closure residual sweep failed ref=%s error=%s", closure_ref, exc)
        raise HTTPException(
            status_code=503,
            detail="Residual sweep failed; closure NOT completed (safe to retry)",
        ) from exc


@closure_router.patch("/{closure_id}/complete")
def complete_closure(
    closure_id: str,
    payload: Optional[CompleteClosurePayload] = None,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    import datetime
    req = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.id == closure_id,
        AccountClosureRequest.tenant_id == tenant_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Closure request not found")
    if req.status == "completed":
        return {"message": "already completed", "data": req.to_dict()}
    if req.status != "approved":
        raise HTTPException(status_code=400, detail="Request must be approved before completing")

    repo = AccountRepository(db)
    account = repo.get_by_account_id(str(req.account_id), tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status == AccountStatus.CLOSED:
        req.status = "completed"
        req.closed_at = req.closed_at or datetime.datetime.utcnow()
        db.commit()
        return {"message": "already completed", "data": req.to_dict()}

    # Refuse with active liens or open disputes (fail-closed).
    _refuse_if_active_liens(int(account.id), tenant_id, keycloak_id)
    _refuse_if_open_disputes(account, tenant_id, str(account.keycloak_id))

    # TB balance check + residual sweep BEFORE the status flip.
    from adapters import TigerBeetleAdapter

    try:
        tb_account = TigerBeetleAdapter().get_account(int(account.id))
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="Balance source unavailable; closure refused"
        ) from exc
    balance_kobo = 0
    if tb_account is not None:
        balance_kobo = int(tb_account.credits_posted) - int(tb_account.debits_posted)

    if balance_kobo < 0:
        raise HTTPException(
            status_code=409,
            detail="Account has a negative balance; settle before closure",
        )
    if balance_kobo > 0:
        destination = (payload.destinationAccount if payload else None) or getattr(
            req, "destination_account", None
        )
        if not destination:
            raise HTTPException(
                status_code=422,
                detail=f"Account has residual balance of {balance_kobo} kobo; provide destinationAccount",
            )
        _sweep_residual(
            account_id=int(account.id),
            destination=str(destination),
            balance_kobo=balance_kobo,
            closure_ref=str(req.id),
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
        )

    # Terminal status: check_account blocks all post-closure debits.
    account.status = AccountStatus.CLOSED
    req.status = "completed"
    req.closed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(req)
    return {"message": "success", "data": req.to_dict()}


@closure_router.patch("/{closure_id}/reject")
def reject_closure(
    closure_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    req = db.query(AccountClosureRequest).filter(
        AccountClosureRequest.id == closure_id,
        AccountClosureRequest.tenant_id == tenant_id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Closure request not found")
    if req.status in ("completed", "rejected"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a request with status '{req.status}'")
    req.status = "rejected"
    db.commit()
    db.refresh(req)
    return {"message": "success", "data": req.to_dict()}
