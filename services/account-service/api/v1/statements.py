"""Account statement generation endpoints.

MN-12 (S12/F14-4): the fabricated `_TRANSACTIONS` fixture is deleted.
Statements are now served from real sources only:
  * transactions — transaction-ledger service
    (`GET {TRANSACTION_LEDGER_URL}/txn/account-number/{account_number}`), the
    system of record for posted journals;
  * opening/closing balances — TigerBeetle account totals
    (credits_posted - debits_posted; HISTORY flag is set at account creation).

Both sources fail CLOSED: if either is unavailable the endpoint returns 503 —
a statement may never be assembled from invented data.
All endpoints require the standard tenant/auth headers enforced by
RequiredHeadersMiddleware plus an explicit x-tenant-id dependency.
"""
import json
import time
import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, responses
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import Base, get_session
from repositories import AccountRepository
from utils import create_logger, get_config
from utils.external_api_client import ExternalAPIClient
from sqlalchemy import String, Text, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
import datetime

logger = create_logger(__name__)
config = get_config()

statements_router = APIRouter()


class StatementJob(Base):
    """W12-A4-P0-D: persisted statement-generation jobs (table also created
    expand-only in main.py). Backs tenant_admin statement list/status/download
    calls — every row is produced by POST /statements/generate, never invented."""

    __tablename__ = "statement_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    account_id: Mapped[str] = mapped_column(String, nullable=False)
    account_number: Mapped[str] = mapped_column(String, nullable=False)
    period_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    period_to: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="completed")
    payload: Mapped[str] = mapped_column(Text, nullable=False)  # full statement JSON
    created_at: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP, default=datetime.datetime.utcnow
    )

    def to_dict(self) -> dict:
        stmt = json.loads(self.payload)
        return {
            "id": self.id,
            "jobId": self.id,
            "accountId": self.account_id,
            "accountNumber": self.account_number,
            "period": {"from": self.period_from, "to": self.period_to},
            "openingBalance": stmt.get("openingBalance"),
            "closingBalance": stmt.get("closingBalance"),
            "currency": stmt.get("currency", "NGN"),
            "transactionCount": stmt.get("transactionCount"),
            "status": self.status,
            "generatedAt": stmt.get("generatedAt"),
            "format": "json",
            "downloadUrl": f"/account/statements/jobs/{self.id}/download",
        }


def _ledger_client() -> ExternalAPIClient:
    base_url = str(getattr(config, "TRANSACTION_LEDGER_URL", "") or "").strip()
    if not base_url:
        # Fail-closed: without the ledger of record there is no statement.
        raise HTTPException(
            status_code=503,
            detail="Statement service unavailable: TRANSACTION_LEDGER_URL not configured",
        )
    return ExternalAPIClient(
        base_url=base_url, headers={"Content-Type": "application/json"}
    )


def _fetch_ledger_transactions(
    account_number: str, tenant_id: str, max_pages: int = 50
) -> list[dict]:
    """Fetch ALL ledger transactions for an account number (paginated)."""
    client = _ledger_client()
    items: list[dict] = []
    for page in range(1, max_pages + 1):
        try:
            resp = client._get(
                f"/txn/account-number/{account_number}?page={page}&limit=100",
                headers={"x-tenant-id": tenant_id},
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.error(
                "Ledger fetch failed for statement account=%s error=%s",
                account_number,
                exc,
            )
            raise HTTPException(
                status_code=503,
                detail="Statement source (transaction ledger) unavailable",
            ) from exc
        batch = (resp or {}).get("transactions") or []
        if not batch:
            break
        items.extend(batch)
        if len(batch) < 100:
            break
    return items


def _closing_balance_kobo(account, tenant_id: str) -> int:
    """Closing balance from TigerBeetle posted totals (fail-closed)."""
    from adapters import TigerBeetleAdapter

    try:
        tb_account = TigerBeetleAdapter().get_account(int(account.id))
    except Exception as exc:
        logger.error("TB balance lookup failed account=%s error=%s", account.id, exc)
        raise HTTPException(
            status_code=503, detail="Balance source (TigerBeetle) unavailable"
        ) from exc
    if tb_account is None:
        raise HTTPException(status_code=404, detail="ledger account not found")
    return int(tb_account.credits_posted) - int(tb_account.debits_posted)


def _to_statement_rows(
    account_number: str, txns: list[dict], start: Optional[str], end: Optional[str]
) -> list[dict]:
    """Map ledger rows to statement lines with debit/credit split by direction."""
    rows = []
    for t in txns:
        amount_naira = Decimal(str(t.get("amount") or "0"))
        amount_kobo = int((amount_naira * 100).quantize(Decimal("1")))
        is_credit = str(t.get("payee_account_number") or "") == account_number
        is_debit = str(t.get("payer_account_number") or "") == account_number
        date = str(t.get("created_at") or "")[:10]
        rows.append(
            {
                "id": t.get("transaction_id"),
                "accountNumber": account_number,
                "date": date,
                "description": t.get("note") or t.get("tag") or "Ledger transaction",
                "reference": t.get("transaction_id"),
                "debit": amount_kobo if is_debit else 0,
                "credit": amount_kobo if is_credit else 0,
                "status": str(t.get("status") or ""),
                "counterparty": (
                    t.get("payer_name") if is_credit else t.get("payee_name")
                ),
            }
        )
    rows.sort(key=lambda r: (r["date"], r["id"] or ""))
    if start:
        rows = [r for r in rows if r["date"] >= start]
    if end:
        rows = [r for r in rows if r["date"] <= end]
    return rows


@statements_router.get("/accounts")
def list_accounts(
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    repo = AccountRepository(db)
    accounts, _ = repo.get_accounts(tenant_id)
    items = [a.to_dict() for a in accounts]
    return {"items": items, "total": len(items)}


class GenerateRequest(BaseModel):
    accountNumber: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None


@statements_router.post("/generate")
def generate_statement(
    req: GenerateRequest,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    repo = AccountRepository(db)
    account = repo.get_by_account_number(req.accountNumber, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")
    acct = account.to_dict()
    acct["accountNumber"] = account.account_number

    txns = _fetch_ledger_transactions(account.account_number, tenant_id)
    rows = _to_statement_rows(account.account_number, txns, req.startDate, req.endDate)

    closing_kobo = _closing_balance_kobo(account, tenant_id)
    period_net_kobo = sum(r["credit"] - r["debit"] for r in rows)
    opening_kobo = closing_kobo - period_net_kobo

    total_debit = sum(r["debit"] for r in rows)
    total_credit = sum(r["credit"] for r in rows)

    # Running balance per row (kobo integers).
    running = opening_kobo
    for r in rows:
        running += r["credit"] - r["debit"]
        r["balance"] = running

    statement = {
        "account": acct,
        "period": {"from": req.startDate, "to": req.endDate},
        "currency": "NGN",
        "units": "kobo",
        "openingBalance": opening_kobo,
        "closingBalance": closing_kobo,
        "totalDebit": total_debit,
        "totalCredit": total_credit,
        "transactionCount": len(rows),
        "transactions": rows,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "transaction-ledger+tigerbeetle",
    }

    # W12-A4-P0-D: persist the generated statement as a job row so tenant_admin
    # list/status/download calls serve real data.
    job = StatementJob(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        account_id=str(account.id),
        account_number=account.account_number,
        period_from=req.startDate,
        period_to=req.endDate,
        status="completed",
        payload=json.dumps(statement),
    )
    db.add(job)
    db.commit()
    statement["jobId"] = job.id
    statement["status"] = "completed"
    statement["downloadUrl"] = f"/account/statements/jobs/{job.id}/download"
    return statement


@statements_router.get("/jobs")
def list_statement_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    accountId: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """W12-A4-P0-D: list persisted statement-generation jobs."""
    q = db.query(StatementJob).filter(StatementJob.tenant_id == tenant_id)
    if accountId:
        q = q.filter(StatementJob.account_id == str(accountId))
    total = q.count()
    items = (
        q.order_by(StatementJob.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {"items": [j.to_dict() for j in items], "total": total, "page": page, "limit": limit}


@statements_router.get("/jobs/{job_id}")
def get_statement_job(
    job_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """W12-A4-P0-D: statement job status/result."""
    job = db.query(StatementJob).filter(
        StatementJob.id == job_id, StatementJob.tenant_id == tenant_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Statement job not found")
    return job.to_dict()


@statements_router.get("/jobs/{job_id}/download")
def download_statement_job(
    job_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """W12-A4-P0-D: download the full generated statement as JSON attachment."""
    job = db.query(StatementJob).filter(
        StatementJob.id == job_id, StatementJob.tenant_id == tenant_id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Statement job not found")
    return responses.JSONResponse(
        content=json.loads(job.payload),
        headers={
            "Content-Disposition": f'attachment; filename="statement-{job.id}.json"'
        },
    )


@statements_router.get("/transactions")
def list_transactions(
    accountNumber: str,
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """MN-12: previously unauthenticated and served fabricated rows; now
    authenticated (tenant header enforced) and ledger-backed."""
    txns = _fetch_ledger_transactions(accountNumber, tenant_id)
    rows = _to_statement_rows(accountNumber, txns, None, None)
    return {"items": rows, "total": len(rows)}


@statements_router.get("/summary")
def get_summary(
    accountNumber: str,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    txns = _fetch_ledger_transactions(accountNumber, tenant_id)
    rows = _to_statement_rows(accountNumber, txns, startDate, endDate)
    total_debit = sum(r["debit"] for r in rows)
    total_credit = sum(r["credit"] for r in rows)
    return {
        "accountNumber": accountNumber,
        "period": {"from": startDate, "to": endDate},
        "units": "kobo",
        "totalDebit": total_debit,
        "totalCredit": total_credit,
        "netMovement": total_credit - total_debit,
        "transactionCount": len(rows),
    }


class BalanceTrendRequest(BaseModel):
    accountNumber: str


@statements_router.post("/balance-trend")
def get_balance_trend(
    req: BalanceTrendRequest,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    repo = AccountRepository(db)
    account = repo.get_by_account_number(req.accountNumber, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")

    txns = _fetch_ledger_transactions(account.account_number, tenant_id)
    rows = _to_statement_rows(account.account_number, txns, None, None)
    closing_kobo = _closing_balance_kobo(account, tenant_id)
    net = sum(r["credit"] - r["debit"] for r in rows)
    running = closing_kobo - net
    trend = []
    for r in rows:
        running += r["credit"] - r["debit"]
        trend.append({"date": r["date"], "balance": running})
    return {
        "accountNumber": req.accountNumber,
        "units": "kobo",
        "dataPoints": trend,
        "count": len(trend),
    }


# ---------------------------------------------------------------------------
# W12-A4-P0-D: account-id-addressed statement/summary + single-transaction
# fetch/reversal. Created for tenant_admin (was the unserved /account/v1/*
# namespace); all data comes from PG, the transaction ledger and TigerBeetle —
# fail-closed, never fabricated.
# ---------------------------------------------------------------------------


@statements_router.get("/accounts/{account_id}/statement")
def get_statement_for_account(
    account_id: str,
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Statement for an account addressed by account id (tenant_admin
    getForAccount). Same assembly as POST /statements/generate."""
    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")

    txns = _fetch_ledger_transactions(account.account_number, tenant_id)
    rows = _to_statement_rows(account.account_number, txns, startDate, endDate)
    closing_kobo = _closing_balance_kobo(account, tenant_id)
    period_net_kobo = sum(r["credit"] - r["debit"] for r in rows)
    opening_kobo = closing_kobo - period_net_kobo
    running = opening_kobo
    for r in rows:
        running += r["credit"] - r["debit"]
        r["balance"] = running

    return {
        "account": account.to_dict(),
        "period": {"from": startDate, "to": endDate},
        "currency": "NGN",
        "units": "kobo",
        "openingBalance": opening_kobo,
        "closingBalance": closing_kobo,
        "transactionCount": len(rows),
        "transactions": rows,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "transaction-ledger+tigerbeetle",
    }


@statements_router.get("/accounts/{account_id}/summary")
def get_account_summary(
    account_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Account summary (balance/status/type) addressed by account id."""
    repo = AccountRepository(db)
    account = repo.get_by_account_id(account_id, tenant_id)
    if not account:
        raise HTTPException(status_code=404, detail="account not found")
    balance_kobo = _closing_balance_kobo(account, tenant_id)
    status = getattr(account.status, "value", account.status)
    acct_type = getattr(account.account_type, "value", account.account_type)
    currency = getattr(account.account_currency, "value", account.account_currency)
    return {
        "accountId": str(account.id),
        "accountNumber": account.account_number,
        "accountName": account.name,
        "balance": balance_kobo,
        "units": "kobo",
        "currency": currency,
        "status": status,
        "accountType": acct_type,
    }


@statements_router.get("/transactions/{transaction_id}")
def get_transaction_by_id(
    transaction_id: str,
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    """Single transaction, proxied from the transaction ledger (system of
    record). Fail-closed when the ledger is unavailable."""
    client = _ledger_client()
    try:
        resp = client._get(
            f"/txn/{transaction_id}", headers={"x-tenant-id": tenant_id}
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Ledger fetch failed txn=%s error=%s", transaction_id, exc)
        raise HTTPException(
            status_code=503, detail="Transaction source (transaction ledger) unavailable"
        ) from exc
    if not resp:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return resp


class ReverseTransactionRequest(BaseModel):
    reason: Optional[str] = None


@statements_router.post("/transactions/{transaction_id}/reverse")
def reverse_transaction(
    transaction_id: str,
    req: Optional[ReverseTransactionRequest] = None,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
    keycloak_id: str = Header(..., alias="x-keycloak-id"),
):
    """Reverse a posted transaction by posting a balanced inverse journal via
    journal-posting-go (same pattern as closure residual sweep / estate
    payout). Idempotency relies on the ledger rejecting a duplicate
    transactionRef (reversal:{transaction_id}). Fail-closed: any failure
    leaves the ledger untouched and returns 5xx."""
    client = _ledger_client()
    try:
        txn = client._get(f"/txn/{transaction_id}", headers={"x-tenant-id": tenant_id})
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Ledger fetch failed txn=%s error=%s", transaction_id, exc)
        raise HTTPException(
            status_code=503, detail="Transaction source (transaction ledger) unavailable"
        ) from exc
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    payer_number = str(txn.get("payer_account_number") or "")
    payee_number = str(txn.get("payee_account_number") or "")
    amount_naira = Decimal(str(txn.get("amount") or "0"))
    amount_kobo = int((amount_naira * 100).quantize(Decimal("1")))
    if not payer_number or not payee_number or amount_kobo <= 0:
        raise HTTPException(
            status_code=422, detail="Transaction is not reversible (missing legs)"
        )

    repo = AccountRepository(db)
    payer = repo.get_by_account_number(payer_number, tenant_id)
    payee = repo.get_by_account_number(payee_number, tenant_id)
    if not payer or not payee:
        raise HTTPException(
            status_code=404, detail="Payer/payee account not found for reversal"
        )

    journal_url = str(getattr(config, "JOURNAL_POSTING_URL", "") or "")
    token = str(getattr(config, "INTERNAL_SERVICE_TOKEN", "") or "")
    headers = {"Content-Type": "application/json", "x-tenant-id": tenant_id}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    journal_client = ExternalAPIClient(base_url=journal_url, headers=headers)
    reason = (req.reason if req else None) or "tenant_admin reversal"
    try:
        journal_client._post(
            "/v1/journals",
            data={
                "tenantId": tenant_id,
                "transactionRef": f"reversal:{transaction_id}",
                "narration": f"Reversal of transaction {transaction_id}: {reason}",
                "currency": "NGN",
                "legs": [
                    {"accountId": int(payee.id), "type": "debit", "amount": amount_kobo},
                    {"accountId": int(payer.id), "type": "credit", "amount": amount_kobo},
                ],
            },
        )
    except Exception as exc:
        logger.error("Reversal journal failed txn=%s error=%s", transaction_id, exc)
        raise HTTPException(
            status_code=503, detail="Reversal failed; ledger unchanged"
        ) from exc

    logger.info(
        "Transaction %s reversed by %s (amount_kobo=%d)",
        transaction_id, keycloak_id, amount_kobo,
    )
    return {
        "success": True,
        "message": "Transaction reversed",
        "transactionRef": f"reversal:{transaction_id}",
    }
