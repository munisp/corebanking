"""Billing and invoice management endpoints."""
import uuid
import time
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import json

# --- W12-C3P2B5: PostgreSQL persistence (replaces in-memory singleton stores) ---
# Pattern: pooled psycopg2 (fleet ref: services/inventory-py/main.py:63-116).
# PG is authoritative: create/update/delete hit Postgres transactionally
# (autocommit => each statement is its own transaction); on PG failure the
# handler returns 503. There is NO in-memory shadow that could silently
# diverge from PG (cf. failed_login_tracker anti-pattern).
import threading as _w12_threading
import psycopg2 as _w12_pg
import psycopg2.pool as _w12_pgpool
import psycopg2.extras as _w12_pgextras

_w12_pool = None
_w12_pool_lock = _w12_threading.Lock()


def _w12_get_pool():
    global _w12_pool
    if _w12_pool is None or _w12_pool.closed:
        with _w12_pool_lock:
            if _w12_pool is None or _w12_pool.closed:
                _w12_pool = _w12_pgpool.ThreadedConnectionPool(1, 10, os.environ["DATABASE_URL"])
    return _w12_pool


def _w12_run(sql, params=(), fetch="all"):
    """Run one statement on a pooled connection (autocommit = per-statement transaction)."""
    conn = _w12_get_pool().getconn()
    try:
        conn.autocommit = True
        with conn.cursor(cursor_factory=_w12_pgextras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "all":
                return cur.fetchall()
            if fetch == "one":
                return cur.fetchone()
            return cur.rowcount
    finally:
        _w12_get_pool().putconn(conn)


class _W12Store:
    """Per-domain PG table (jsonb payload pattern):
    id uuid pk default gen_random_uuid(), record_id text UNIQUE (natural key;
    upsert makes retry-able creates idempotent), tenant_id text, payload jsonb,
    created_at/updated_at timestamptz default now()."""
    _ensured = set()
    _ensured_lock = _w12_threading.Lock()

    def __init__(self, table, key="id", seed=(), tenant_key="tenant_id"):
        self.table = table
        self.key = key
        self.seed = list(seed)
        self.tenant_key = tenant_key

    def ensure(self):
        with _W12Store._ensured_lock:
            if self.table in _W12Store._ensured:
                return
            _w12_run(f"""CREATE TABLE IF NOT EXISTS {self.table} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL UNIQUE,
    tenant_id TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)""", fetch=None)
            for row in self.seed:
                _rid = row.get("_rid", row.get(self.key, ""))
                _payload = {k: v for k, v in row.items() if k != "_rid"}
                _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb) ON CONFLICT (record_id) DO NOTHING""",
                         (str(_rid), row.get(self.tenant_key),
                          json.dumps(_payload, default=str)), fetch=None)
            _W12Store._ensured.add(self.table)

    def all(self, limit=100000):
        self.ensure()
        return [r["payload"] for r in _w12_run(
            f"SELECT payload FROM {self.table} ORDER BY created_at, record_id LIMIT %s", (limit,))]

    def get(self, record_id):
        self.ensure()
        row = _w12_run(f"SELECT payload FROM {self.table} WHERE record_id = %s",
                       (str(record_id),), fetch="one")
        return row["payload"] if row else None

    def put(self, record_id, payload, tenant_id=None):
        self.ensure()
        _w12_run(f"""INSERT INTO {self.table} (record_id, tenant_id, payload)
VALUES (%s, %s, %s::jsonb)
ON CONFLICT (record_id) DO UPDATE
SET payload = EXCLUDED.payload, tenant_id = EXCLUDED.tenant_id, updated_at = NOW()""",
                 (str(record_id),
                  tenant_id if tenant_id is not None else payload.get(self.tenant_key),
                  json.dumps(payload, default=str)), fetch=None)

    def delete(self, record_id):
        self.ensure()
        return _w12_run(f"DELETE FROM {self.table} WHERE record_id = %s",
                        (str(record_id),), fetch=None)


def _w12_get_by(store, field, value):
    """First row whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    row = _w12_run(f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s LIMIT 1",
                   (field, value), fetch="one")
    return row["payload"] if row else None


def _w12_all_by(store, field, value, limit=100000):
    """All rows whose payload field matches (jsonb ->> lookup)."""
    store.ensure()
    rows = _w12_run(
        f"SELECT payload FROM {store.table} WHERE payload ->> %s = %s ORDER BY created_at, record_id LIMIT %s",
        (field, value, limit))
    return [r["payload"] for r in rows]

billing_router = APIRouter()

_INVOICE_SEED = [
    {
        "id": "INV-2026-001", "tenantId": "tenant-001", "accountNumber": "0012345678",
        "customerName": "Fatima Abdullahi", "invoiceType": "service_charge",
        "description": "Monthly account maintenance fee - April 2026",
        "amount": 1000.00, "currency": "NGN", "status": "paid",
        "dueDate": "2026-04-30", "paidDate": "2026-04-28", "paidAmount": 1000.00,
        "items": [{"description": "Account maintenance fee", "quantity": 1, "unitPrice": 1000.00, "total": 1000.00}],
        "createdAt": "2026-04-01T00:00:00Z", "updatedAt": "2026-04-28T10:00:00Z",
    },
    {
        "id": "INV-2026-002", "tenantId": "tenant-001", "accountNumber": "3034567890",
        "customerName": "Ibrahim Musa", "invoiceType": "transaction_fee",
        "description": "Wire transfer fees - April 2026",
        "amount": 5250.00, "currency": "NGN", "status": "pending",
        "dueDate": "2026-05-15", "paidDate": None, "paidAmount": 0.00,
        "items": [
            {"description": "International wire transfer (3 transactions)", "quantity": 3, "unitPrice": 1500.00, "total": 4500.00},
            {"description": "SWIFT messaging fee", "quantity": 3, "unitPrice": 250.00, "total": 750.00},
        ],
        "createdAt": "2026-05-01T00:00:00Z", "updatedAt": "2026-05-01T00:00:00Z",
    },
    {
        "id": "INV-2026-003", "tenantId": "tenant-001", "accountNumber": "2098765432",
        "customerName": "Chioma Okafor", "invoiceType": "loan_repayment",
        "description": "Personal loan installment - May 2026",
        "amount": 125000.00, "currency": "NGN", "status": "overdue",
        "dueDate": "2026-05-10", "paidDate": None, "paidAmount": 0.00,
        "items": [
            {"description": "Loan principal", "quantity": 1, "unitPrice": 100000.00, "total": 100000.00},
            {"description": "Interest", "quantity": 1, "unitPrice": 25000.00, "total": 25000.00},
        ],
        "createdAt": "2026-05-01T00:00:00Z", "updatedAt": "2026-05-11T00:00:00Z",
    },
]


class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unitPrice: float
    total: float


class CreateInvoiceRequest(BaseModel):
    accountNumber: str
    customerName: str
    invoiceType: str  # service_charge | transaction_fee | loan_repayment | penalty | custom
    description: str
    currency: str = "NGN"
    dueDate: str
    items: List[InvoiceItem]


class PayInvoiceRequest(BaseModel):
    paymentReference: Optional[str] = None
    paymentChannel: str = "account_debit"


# W12-C3P2B5: invoices persisted in PG (idempotent seed; natural key = invoice id).
INVOICE_STORE = _W12Store("invoices", seed=_INVOICE_SEED)


def _inv_all():
    try:
        return INVOICE_STORE.all()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"persistence_unavailable: {e}")


def _inv_get(invoice_id):
    try:
        return INVOICE_STORE.get(invoice_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"persistence_unavailable: {e}")


def _inv_put(invoice_id, inv):
    try:
        INVOICE_STORE.put(invoice_id, inv)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"persistence_unavailable: {e}")


_BILLING_PLAN = {
    "billing_info": {
        "plan": "premium",
        "billingCycle": "monthly",
        "nextBillingDate": "2026-06-01",
        "status": "active",
    }
}

_TRENDS = [
    {"month": "Jan", "amount": 850000}, {"month": "Feb", "amount": 920000},
    {"month": "Mar", "amount": 780000}, {"month": "Apr", "amount": 1050000},
    {"month": "May", "amount": 1130250},
]


class UpdatePlanRequest(BaseModel):
    plan: str


@billing_router.get("/v1/billing/me")
def get_billing_me():
    return _BILLING_PLAN


@billing_router.put("/v1/billing/plan")
def update_billing_plan(req: UpdatePlanRequest):
    _BILLING_PLAN["billing_info"]["plan"] = req.plan
    return {"status": "updated", "plan": req.plan}


@billing_router.get("/v1/billing/invoices")
def list_billing_invoices(status: Optional[str] = None, page: int = 1, pageSize: int = 20):
    results = _inv_all()
    if status:
        results = [i for i in results if i["status"] == status]
    total = len(results)
    start = (page - 1) * pageSize
    return {"items": results[start: start + pageSize], "total": total, "page": page, "pageSize": pageSize}


@billing_router.get("/v1/stats")
def get_billing_stats():
    _INVOICES = _inv_all()
    paid = sum(i["paidAmount"] for i in _INVOICES)
    outstanding = sum(i["amount"] - i["paidAmount"] for i in _INVOICES if i["status"] != "paid")
    return {
        "totalCollected": round(paid, 2),
        "totalOutstanding": round(outstanding, 2),
        "invoiceCount": len(_INVOICES),
        "overdueCount": sum(1 for i in _INVOICES if i["status"] == "overdue"),
        "currency": "NGN",
    }


@billing_router.get("/v1/billing/trends")
def get_billing_trends():
    return {"trends": _TRENDS, "currency": "NGN"}


@billing_router.get("/v1/invoices")
def list_invoices_v1(
    status: Optional[str] = None,
    invoiceType: Optional[str] = None,
    accountNumber: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
):
    return list_invoices(status=status, invoiceType=invoiceType, accountNumber=accountNumber, page=page, pageSize=pageSize)


@billing_router.get("/invoices")
def list_invoices(
    status: Optional[str] = None,
    invoiceType: Optional[str] = None,
    accountNumber: Optional[str] = None,
    page: int = 1,
    pageSize: int = 20,
):
    results = _inv_all()
    if status:
        results = [i for i in results if i["status"] == status]
    if invoiceType:
        results = [i for i in results if i["invoiceType"] == invoiceType]
    if accountNumber:
        results = [i for i in results if i["accountNumber"] == accountNumber]
    total = len(results)
    start = (page - 1) * pageSize
    return {"items": results[start: start + pageSize], "total": total, "page": page, "pageSize": pageSize}


@billing_router.get("/invoices/summary")
def invoice_summary():
    _INVOICES = _inv_all()
    total = len(_INVOICES)
    paid = sum(1 for i in _INVOICES if i["status"] == "paid")
    pending = sum(1 for i in _INVOICES if i["status"] == "pending")
    overdue = sum(1 for i in _INVOICES if i["status"] == "overdue")
    total_outstanding = sum(i["amount"] - i["paidAmount"] for i in _INVOICES if i["status"] != "paid")
    total_collected = sum(i["paidAmount"] for i in _INVOICES)
    return {
        "total": total, "paid": paid, "pending": pending, "overdue": overdue,
        "totalOutstanding": round(total_outstanding, 2),
        "totalCollected": round(total_collected, 2),
    }


@billing_router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str):
    inv = _inv_get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="invoice not found")
    return inv


@billing_router.post("/invoices")
def create_invoice(req: CreateInvoiceRequest):
    total_amount = sum(item.total for item in req.items)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    inv = {
        "id": f"INV-{uuid.uuid4().hex[:8].upper()}",
        "tenantId": "",
        "accountNumber": req.accountNumber,
        "customerName": req.customerName,
        "invoiceType": req.invoiceType,
        "description": req.description,
        "amount": round(total_amount, 2),
        "currency": req.currency,
        "status": "pending",
        "dueDate": req.dueDate,
        "paidDate": None,
        "paidAmount": 0.00,
        "items": [item.dict() for item in req.items],
        "createdAt": now,
        "updatedAt": now,
    }
    _inv_put(inv["id"], inv)
    return inv


@billing_router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str, req: PayInvoiceRequest):
    inv = _inv_get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="invoice not found")
    if inv["status"] == "paid":
        raise HTTPException(status_code=400, detail="invoice already paid")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    inv["status"] = "paid"
    inv["paidDate"] = now
    inv["paidAmount"] = inv["amount"]
    inv["updatedAt"] = now
    if req.paymentReference:
        inv["paymentReference"] = req.paymentReference
    inv["paymentChannel"] = req.paymentChannel
    _inv_put(invoice_id, inv)
    return {"status": "paid", "invoiceId": invoice_id, "amountPaid": inv["amount"], "paidAt": now}


@billing_router.post("/invoices/{invoice_id}/cancel")
def cancel_invoice(invoice_id: str):
    inv = _inv_get(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="invoice not found")
    if inv["status"] == "paid":
        raise HTTPException(status_code=400, detail="cannot cancel a paid invoice")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    inv["status"] = "cancelled"
    inv["updatedAt"] = now
    _inv_put(invoice_id, inv)
    return {"status": "cancelled", "invoiceId": invoice_id}
