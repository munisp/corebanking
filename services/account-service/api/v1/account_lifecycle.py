"""MN-03/MN-05: account lifecycle endpoints — signatories/mandates and
deceased-account handling (death notification + maker-checker-gated estate
payout)."""
import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, get_session
from repositories import AccountRepository
from utils import create_logger, get_config
from utils.enums import AccountStatus
from utils.external_api_client import ExternalAPIClient
from sqlalchemy import Boolean, String, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

logger = create_logger(__name__)
config = get_config()

lifecycle_router = APIRouter()


class AccountSignatory(Base):
    """MN-03: account signatories (table also created expand-only in main.py)."""

    __tablename__ = "account_signatories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    account_id: Mapped[str] = mapped_column(String, nullable=False)
    signatory_keycloak_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="signatory")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP, default=datetime.datetime.utcnow
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "accountId": self.account_id,
            "signatoryKeycloakId": self.signatory_keycloak_id,
            "name": self.name,
            "role": self.role,
            "active": self.active,
        }


class AddSignatoryPayload(BaseModel):
    signatoryKeycloakId: str
    name: str
    role: Optional[str] = "signatory"


class SetMandatePayload(BaseModel):
    mandate: str  # 'single' | 'all'


@lifecycle_router.post("/{account_id}/signatories")
def add_signatory(
    account_id: str,
    payload: AddSignatoryPayload,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    repo = AccountRepository(db)
    if not repo.get_by_account_id(account_id, tenant_id):
        raise HTTPException(status_code=404, detail="Account not found")
    existing = (
        db.query(AccountSignatory)
        .filter(
            AccountSignatory.account_id == account_id,
            AccountSignatory.signatory_keycloak_id == payload.signatoryKeycloakId,
            AccountSignatory.tenant_id == tenant_id,
        )
        .first()
    )
    if existing:
        return {"message": "already a signatory", "data": existing.to_dict()}
    row = AccountSignatory(
        id=str(uuid.uuid4()),
        account_id=account_id,
        signatory_keycloak_id=payload.signatoryKeycloakId,
        name=payload.name,
        role=payload.role or "signatory",
        tenant_id=tenant_id,
    )
    db.add(row)
    db.commit()
    return {"message": "success", "data": row.to_dict()}


@lifecycle_router.get("/{account_id}/signatories")
def list_signatories(
    account_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    rows = (
        db.query(AccountSignatory)
        .filter(
            AccountSignatory.account_id == account_id,
            AccountSignatory.tenant_id == tenant_id,
            AccountSignatory.active.is_(True),
        )
        .all()
    )
    return {"items": [r.to_dict() for r in rows], "total": len(rows)}


@lifecycle_router.post("/{account_id}/mandate")
def set_mandate(
    account_id: str,
    payload: SetMandatePayload,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    if payload.mandate not in ("single", "all"):
        raise HTTPException(status_code=422, detail="mandate must be 'single' or 'all'")
    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if payload.mandate == "all":
        count = (
            db.query(AccountSignatory)
            .filter(
                AccountSignatory.account_id == account_id,
                AccountSignatory.tenant_id == tenant_id,
                AccountSignatory.active.is_(True),
            )
            .count()
        )
        if count < 2:
            raise HTTPException(
                status_code=422,
                detail="Mandate 'all' requires at least two active signatories",
            )
    account.mandate = payload.mandate
    db.commit()
    return {"message": "success", "mandate": account.mandate}


@lifecycle_router.post("/{account_id}/mark-dormant")
def mark_dormant(
    account_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    service_token: str = Header("", alias="x-service-token"),
):
    """MN-01: internal service endpoint used by dormant-account-monitor-py.
    Token-authenticated (INTERNAL_SERVICE_TOKEN); ACTIVE -> DORMANT only."""
    expected = str(getattr(config, "INTERNAL_SERVICE_TOKEN", "") or "")
    if not expected or service_token != expected:
        raise HTTPException(status_code=403, detail="service token required")
    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status == AccountStatus.DORMANT:
        return {"message": "already dormant"}
    if account.status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=409,
            detail=f"Only ACTIVE accounts can go dormant (current: {account.status.value})",
        )
    account.status = AccountStatus.DORMANT
    db.commit()
    logger.info("Account %s marked DORMANT by dormancy sweep", account_id)
    return {"message": "success", "status": "dormant"}


class DeathNotificationPayload(BaseModel):
    deceasedOn: Optional[str] = None
    certificateReference: Optional[str] = None
    notifiedBy: Optional[str] = None


@lifecycle_router.post("/{account_id}/death-notification")
def death_notification(
    account_id: str,
    payload: DeathNotificationPayload,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """MN-05: mark the account DECEASED — blocks all debits immediately
    (check_account and the payment-processing debit gate reject non-ACTIVE)."""
    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status == AccountStatus.DECEASED:
        return {"message": "already recorded", "status": "deceased"}
    if account.status == AccountStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Account is closed")
    account.status = AccountStatus.DECEASED
    db.commit()
    logger.info(
        "Account %s marked DECEASED by %s (certificate=%s)",
        account_id, keycloak_id, payload.certificateReference,
    )
    return {"message": "success", "status": "deceased"}


class EstatePayoutPayload(BaseModel):
    destinationAccount: str  # TB account id of the estate/beneficiary account
    approvalId: str  # MN-05: maker-checker approval id (required, recorded)


@lifecycle_router.post("/{account_id}/estate-payout")
def estate_payout(
    account_id: str,
    payload: EstatePayoutPayload,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """MN-05: estate payout gated by maker-checker — the approval id is
    required and recorded in the journal reference; the payout posts a balanced
    journal via journal-posting-go (Dr deceased account / Cr estate account).
    Fail-closed: any failure leaves the account untouched."""
    if not payload.approvalId:
        raise HTTPException(status_code=422, detail="approvalId (maker-checker) is required")

    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status != AccountStatus.DECEASED:
        raise HTTPException(
            status_code=409,
            detail="Estate payout requires a death notification first (status DECEASED)",
        )

    from adapters import TigerBeetleAdapter

    try:
        tb_account = TigerBeetleAdapter().get_account(int(account.id))
    except Exception as exc:
        raise HTTPException(
            status_code=503, detail="Balance source unavailable; payout refused"
        ) from exc
    balance_kobo = (
        int(tb_account.credits_posted) - int(tb_account.debits_posted)
        if tb_account is not None
        else 0
    )
    if balance_kobo <= 0:
        return {"message": "no residual balance", "amount_kobo": 0}

    journal_url = str(getattr(config, "JOURNAL_POSTING_URL", "") or "")
    token = str(getattr(config, "INTERNAL_SERVICE_TOKEN", "") or "")
    headers = {"Content-Type": "application/json", "x-tenant-id": tenant_id}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    client = ExternalAPIClient(base_url=journal_url, headers=headers)
    try:
        client._post(
            "/v1/journals",
            data={
                "tenantId": tenant_id,
                "transactionRef": f"estate:{account_id}:{payload.approvalId}",
                "narration": (
                    f"Estate payout for deceased account {account_id} "
                    f"(maker-checker approval {payload.approvalId})"
                ),
                "currency": "NGN",
                "legs": [
                    {"accountId": int(account.id), "type": "debit", "amount": balance_kobo},
                    {"accountId": int(payload.destinationAccount), "type": "credit", "amount": balance_kobo},
                ],
            },
        )
    except Exception as exc:
        logger.error("Estate payout journal failed account=%s error=%s", account_id, exc)
        raise HTTPException(
            status_code=503, detail="Estate payout failed; account unchanged"
        ) from exc

    account.status = AccountStatus.CLOSED
    db.commit()
    logger.info(
        "Estate payout completed account=%s amount_kobo=%d approval=%s",
        account_id, balance_kobo, payload.approvalId,
    )
    return {"message": "success", "amount_kobo": balance_kobo, "approvalId": payload.approvalId}
