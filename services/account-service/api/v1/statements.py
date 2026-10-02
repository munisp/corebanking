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
import time
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_session
from repositories import AccountRepository
from utils import create_logger, get_config
from utils.external_api_client import ExternalAPIClient

logger = create_logger(__name__)
config = get_config()

statements_router = APIRouter()


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

    return {
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
