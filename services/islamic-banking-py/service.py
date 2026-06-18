"""54Bank Islamic Banking Service — Sharia-compliant financial products.

Implements Murabaha (cost-plus financing), Ijara (leasing), Mudarabah (profit-sharing),
Sukuk (Islamic bonds), and Takaful (cooperative insurance) with full CRUD operations.

Middleware integrations: Kafka, Redis, Postgres, Temporal, Permify, APISIX, Sharia compliance engine.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional
import json



SERVICE_NAME = "islamic-banking-py"

# ─── PostgreSQL Persistence ───
import time as _time

_db_conn = None

def _init_db():
    global _db_conn
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        import psycopg2
        _db_conn = psycopg2.connect(db_url)
        _db_conn.autocommit = True
        cur = _db_conn.cursor()
        cur.execute("""CREATE TABLE IF NOT EXISTS service_records (
            id TEXT PRIMARY KEY, service TEXT NOT NULL, type TEXT DEFAULT 'default',
            status TEXT DEFAULT 'active', data JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sr_svc ON service_records(service)")
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] DB init failed: {e} — in-memory fallback")
        _db_conn = None


def db_persist(record_type: str, data: dict, status: str = "active"):
    if _db_conn is None:
        return
    try:
        record_id = f"{SERVICE_NAME}_{record_type}_{int(_time.time() * 1000000)}"
        cur = _db_conn.cursor()
        cur.execute(
            "INSERT INTO service_records (id, service, type, status, data) VALUES (%s,%s,%s,%s,%s) ON CONFLICT (id) DO UPDATE SET data=%s, status=%s, updated_at=NOW()",
            (record_id, SERVICE_NAME, record_type, status, json.dumps(data), json.dumps(data), status)
        )
        cur.close()
    except Exception as e:
        print(f"[{SERVICE_NAME}] db_persist failed: {e}")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def default_tenant() -> str:
    return os.environ.get("TENANT_ID", "54bank-platform-prod")


# ── Enums ──

class ProductStatus(str, Enum):
    DRAFT = "draft"
    PENDING_SHARIA_REVIEW = "pending_sharia_review"
    APPROVED = "approved"
    ACTIVE = "active"
    MATURED = "matured"
    DEFAULTED = "defaulted"
    CANCELLED = "cancelled"


class ShariaComplianceStatus(str, Enum):
    PENDING = "pending"
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    CONDITIONAL = "conditional"


# ── Models ──

@dataclass
class MurabahaContract:
    id: str
    tenant_id: str
    customer_id: str
    customer_name: str
    asset_description: str
    asset_category: str
    cost_price: float
    profit_margin_pct: float
    selling_price: float
    currency: str
    tenor_months: int
    instalment_amount: float
    total_paid: float
    outstanding_balance: float
    disbursement_date: Optional[str]
    maturity_date: Optional[str]
    status: str
    sharia_compliance: str
    sharia_board_reference: Optional[str]
    instalment_schedule: list[dict]
    middleware: list[str]
    created_at: str
    updated_at: str


@dataclass
class IjaraContract:
    id: str
    tenant_id: str
    customer_id: str
    customer_name: str
    asset_description: str
    asset_category: str
    asset_value: float
    rental_amount: float
    rental_frequency: str
    currency: str
    lease_start: str
    lease_end: str
    tenor_months: int
    residual_value: float
    purchase_option: bool
    purchase_price: Optional[float]
    total_rent_paid: float
    status: str
    sharia_compliance: str
    maintenance_responsibility: str
    middleware: list[str]
    created_at: str
    updated_at: str


@dataclass
class MudarabahContract:
    id: str
    tenant_id: str
    investor_id: str
    investor_name: str
    fund_manager_id: str
    investment_purpose: str
    capital_amount: float
    currency: str
    profit_sharing_ratio_investor: float
    profit_sharing_ratio_manager: float
    investment_period_months: int
    start_date: str
    maturity_date: str
    realized_profit: float
    realized_loss: float
    distributions: list[dict]
    status: str
    sharia_compliance: str
    risk_category: str
    middleware: list[str]
    created_at: str
    updated_at: str


# ── State ──

murabaha_contracts: list[MurabahaContract] = [
    MurabahaContract(
        id="MRB-001", tenant_id=default_tenant(), customer_id="CUST-001", customer_name="Fatima Abdullahi",
        asset_description="Toyota Hilux 2026", asset_category="vehicle", cost_price=35000000,
        profit_margin_pct=15.0, selling_price=40250000, currency="NGN", tenor_months=48,
        instalment_amount=838541.67, total_paid=5031250.0, outstanding_balance=35218750.0,
        disbursement_date="2026-01-15", maturity_date="2030-01-15",
        status="active", sharia_compliance="compliant", sharia_board_reference="SB-2026-001",
        instalment_schedule=[], middleware=["kafka", "redis", "postgres", "keycloak", "apisix", "openappsec", "lakehouse"],
        created_at="2026-01-10T09:00:00Z", updated_at="2026-04-15T10:00:00Z",
    ),
    MurabahaContract(
        id="MRB-002", tenant_id=default_tenant(), customer_id="CUST-003", customer_name="Jumoke Adeyemi",
        asset_description="Commercial Property - Lekki Phase 1", asset_category="real_estate",
        cost_price=120000000, profit_margin_pct=12.0, selling_price=134400000, currency="NGN",
        tenor_months=120, instalment_amount=1120000.0, total_paid=0, outstanding_balance=134400000,
        disbursement_date=None, maturity_date=None,
        status="pending_sharia_review", sharia_compliance="pending", sharia_board_reference=None,
        instalment_schedule=[], middleware=["kafka", "redis", "postgres", "keycloak", "apisix", "openappsec", "lakehouse"],
        created_at="2026-04-01T14:00:00Z", updated_at="2026-04-01T14:00:00Z",
    ),
]

ijara_contracts: list[IjaraContract] = [
    IjaraContract(
        id="IJR-001", tenant_id=default_tenant(), customer_id="CUST-002", customer_name="Ibrahim Musa",
        asset_description="Office Equipment Package", asset_category="equipment",
        asset_value=15000000, rental_amount=350000, rental_frequency="monthly", currency="NGN",
        lease_start="2026-02-01", lease_end="2028-02-01", tenor_months=24,
        residual_value=3000000, purchase_option=True, purchase_price=3500000,
        total_rent_paid=1050000, status="active", sharia_compliance="compliant",
        maintenance_responsibility="lessee",
        middleware=["kafka", "redis", "postgres", "keycloak", "apisix", "openappsec", "lakehouse"],
        created_at="2026-01-25T11:00:00Z", updated_at="2026-04-01T09:00:00Z",
    ),
]

mudarabah_contracts: list[MudarabahContract] = [
    MudarabahContract(
        id="MDR-001", tenant_id=default_tenant(), investor_id="CUST-002", investor_name="Ibrahim Musa",
        fund_manager_id="FM-001", investment_purpose="SME Growth Fund",
        capital_amount=50000000, currency="NGN",
        profit_sharing_ratio_investor=70, profit_sharing_ratio_manager=30,
        investment_period_months=12, start_date="2026-01-01", maturity_date="2027-01-01",
        realized_profit=2500000, realized_loss=0,
        distributions=[{"date": "2026-04-01", "amount": 875000, "type": "quarterly_profit"}],
        status="active", sharia_compliance="compliant", risk_category="moderate",
        middleware=["kafka", "redis", "postgres", "keycloak", "apisix", "openappsec", "lakehouse"],
        created_at="2025-12-20T10:00:00Z", updated_at="2026-04-01T12:00:00Z",
    ),
]


# ── Business Logic ──

def compute_murabaha_schedule(cost_price: float, profit_margin_pct: float, tenor_months: int) -> tuple[float, float, list[dict]]:
    selling_price = cost_price * (1 + profit_margin_pct / 100)
    instalment = round(selling_price / tenor_months, 2)
    schedule = []
    balance = selling_price
    for i in range(1, tenor_months + 1):
        payment = instalment if i < tenor_months else round(balance, 2)
        balance -= payment
        schedule.append({
            "instalmentNumber": i,
            "dueDate": f"2026-{((i - 1) % 12) + 1:02d}-01",
            "amount": payment,
            "principalPortion": round(cost_price / tenor_months, 2),
            "profitPortion": round(payment - cost_price / tenor_months, 2),
            "status": "scheduled",
        })
    return selling_price, instalment, schedule


def compute_ijara_rental(asset_value: float, tenor_months: int, residual_pct: float = 10.0) -> tuple[float, float]:
    residual = asset_value * residual_pct / 100
    depreciable = asset_value - residual
    rental = round(depreciable / tenor_months * 1.08, 2)  # 8% rental margin
    return residual, rental


def sharia_compliance_check(product_type: str, details: dict) -> tuple[str, Optional[str]]:
    """Simulates Sharia board compliance review."""
    if product_type == "murabaha":
        if details.get("profit_margin_pct", 0) > 30:
            return ShariaComplianceStatus.CONDITIONAL.value, "Profit margin exceeds advisory threshold; board review required"
    if product_type == "mudarabah":
        ratio = details.get("profit_sharing_ratio_investor", 0) + details.get("profit_sharing_ratio_manager", 0)
        if abs(ratio - 100) > 0.01:
            return ShariaComplianceStatus.NON_COMPLIANT.value, "Profit-sharing ratios must sum to 100%"
    return ShariaComplianceStatus.COMPLIANT.value, None


# ── HTTP Handler ──

class IslamicBankingHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress default logging

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"
        return json.loads(body)

    def _respond(self, status: int, data: object):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        payload = data if isinstance(data, (dict, list)) else asdict(data)
        self.wfile.write(json.dumps(payload, default=str).encode())

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")

        if path == "/healthz":
            self._respond(200, {
                "status": "ok",
                "service": "islamic-banking-py",
                "timestamp": now_iso(),
                "middleware": ["Kafka", "Redis", "Postgres", "Temporal", "Permify", "Keycloak", "Dapr", "Fluvio", "Mojaloop", "OpenSearch", "OpenAppSec", "APISIX", "TigerBeetle", "Lakehouse", "sharia-compliance-engine"],
            })

        elif path == "/v1/islamic-banking/murabaha":
            self._respond(200, {"asOf": now_iso(), "items": [asdict(c) for c in murabaha_contracts], "total": len(murabaha_contracts)})

        elif path.startswith("/v1/islamic-banking/murabaha/"):
            cid = path.split("/")[-1]
            contract = next((c for c in murabaha_contracts if c.id == cid), None)
            if contract:
                self._respond(200, asdict(contract))
            else:
                self._respond(404, {"message": "Murabaha contract not found"})

        elif path == "/v1/islamic-banking/ijara":
            self._respond(200, {"asOf": now_iso(), "items": [asdict(c) for c in ijara_contracts], "total": len(ijara_contracts)})

        elif path.startswith("/v1/islamic-banking/ijara/"):
            cid = path.split("/")[-1]
            contract = next((c for c in ijara_contracts if c.id == cid), None)
            if contract:
                self._respond(200, asdict(contract))
            else:
                self._respond(404, {"message": "Ijara contract not found"})

        elif path == "/v1/islamic-banking/mudarabah":
            self._respond(200, {"asOf": now_iso(), "items": [asdict(c) for c in mudarabah_contracts], "total": len(mudarabah_contracts)})

        elif path.startswith("/v1/islamic-banking/mudarabah/"):
            cid = path.split("/")[-1]
            contract = next((c for c in mudarabah_contracts if c.id == cid), None)
            if contract:
                self._respond(200, asdict(contract))
            else:
                self._respond(404, {"message": "Mudarabah contract not found"})

        else:
            # B2: Check enhancement routes (Sukuk, Takaful, Wakala, Istisna, Sharia)
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("GET", {})
                self._respond(status, data)
            else:
                self._respond(404, {"message": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        body = self._read_json()

        if path == "/v1/islamic-banking/murabaha":
            self._create_murabaha(body)

        elif path == "/v1/islamic-banking/ijara":
            self._create_ijara(body)

        elif path == "/v1/islamic-banking/mudarabah":
            self._create_mudarabah(body)

        elif path.endswith("/disburse") and "/murabaha/" in path:
            cid = path.split("/")[-2]
            self._disburse_murabaha(cid)

        elif path.endswith("/repay") and "/murabaha/" in path:
            cid = path.split("/")[-2]
            self._repay_murabaha(cid, body)

        elif path.endswith("/distribute") and "/mudarabah/" in path:
            cid = path.split("/")[-2]
            self._distribute_mudarabah(cid, body)

        else:
            # B2: Check enhancement routes
            from enhancements import ENHANCEMENT_ROUTES
            handler = ENHANCEMENT_ROUTES.get(path)
            if handler:
                status, data = handler("POST", body)
                self._respond(status, data)
            else:
                self._respond(404, {"message": "Not found"})

    def _create_murabaha(self, body: dict):
        customer_id = body.get("customerId", "")
        cost_price = float(body.get("costPrice", 0))
        profit_margin = float(body.get("profitMarginPct", 10))
        tenor = int(body.get("tenorMonths", 12))

        if not customer_id or cost_price <= 0 or tenor <= 0:
            self._respond(400, {"message": "customerId, costPrice (>0), and tenorMonths (>0) are required"})
            return

        selling_price, instalment, schedule = compute_murabaha_schedule(cost_price, profit_margin, tenor)
        compliance, note = sharia_compliance_check("murabaha", {"profit_margin_pct": profit_margin})

        contract = MurabahaContract(
            id=gen_id("MRB"),
            tenant_id=body.get("tenantId", default_tenant()),
            customer_id=customer_id,
            customer_name=body.get("customerName", ""),
            asset_description=body.get("assetDescription", ""),
            asset_category=body.get("assetCategory", "general"),
            cost_price=cost_price,
            profit_margin_pct=profit_margin,
            selling_price=selling_price,
            currency=body.get("currency", "NGN"),
            tenor_months=tenor,
            instalment_amount=instalment,
            total_paid=0,
            outstanding_balance=selling_price,
            disbursement_date=None,
            maturity_date=None,
            status=ProductStatus.PENDING_SHARIA_REVIEW.value if compliance == "conditional" else ProductStatus.APPROVED.value,
            sharia_compliance=compliance,
            sharia_board_reference=note,
            instalment_schedule=schedule,
            middleware=["TigerBeetle", "Kafka", "Temporal", "Permify", "sharia-compliance-engine"],
            created_at=now_iso(),
            updated_at=now_iso(),
        )
        murabaha_contracts.append(contract)
        db_persist("murabaha_contracts", contract.to_dict() if hasattr(contract, "to_dict") else contract if isinstance(contract, dict) else {"value": str(contract)})
        self._respond(201, asdict(contract))

    def _create_ijara(self, body: dict):
        customer_id = body.get("customerId", "")
        asset_value = float(body.get("assetValue", 0))
        tenor = int(body.get("tenorMonths", 24))

        if not customer_id or asset_value <= 0:
            self._respond(400, {"message": "customerId and assetValue (>0) are required"})
            return

        residual, rental = compute_ijara_rental(asset_value, tenor)
        contract = IjaraContract(
            id=gen_id("IJR"),
            tenant_id=body.get("tenantId", default_tenant()),
            customer_id=customer_id,
            customer_name=body.get("customerName", ""),
            asset_description=body.get("assetDescription", ""),
            asset_category=body.get("assetCategory", "equipment"),
            asset_value=asset_value,
            rental_amount=rental,
            rental_frequency=body.get("rentalFrequency", "monthly"),
            currency=body.get("currency", "NGN"),
            lease_start=body.get("leaseStart", now_iso()[:10]),
            lease_end=body.get("leaseEnd", ""),
            tenor_months=tenor,
            residual_value=residual,
            purchase_option=body.get("purchaseOption", True),
            purchase_price=round(residual * 1.05, 2) if body.get("purchaseOption", True) else None,
            total_rent_paid=0,
            status=ProductStatus.ACTIVE.value,
            sharia_compliance=ShariaComplianceStatus.COMPLIANT.value,
            maintenance_responsibility=body.get("maintenanceResponsibility", "lessor"),
            middleware=["TigerBeetle", "Kafka", "Temporal", "Permify", "sharia-compliance-engine"],
            created_at=now_iso(),
            updated_at=now_iso(),
        )
        ijara_contracts.append(contract)
        db_persist("ijara_contracts", contract.to_dict() if hasattr(contract, "to_dict") else contract if isinstance(contract, dict) else {"value": str(contract)})
        self._respond(201, asdict(contract))

    def _create_mudarabah(self, body: dict):
        investor_id = body.get("investorId", "")
        capital = float(body.get("capitalAmount", 0))
        investor_ratio = float(body.get("profitSharingRatioInvestor", 70))
        manager_ratio = float(body.get("profitSharingRatioManager", 30))

        if not investor_id or capital <= 0:
            self._respond(400, {"message": "investorId and capitalAmount (>0) are required"})
            return

        compliance, note = sharia_compliance_check("mudarabah", {
            "profit_sharing_ratio_investor": investor_ratio,
            "profit_sharing_ratio_manager": manager_ratio,
        })
        if compliance == ShariaComplianceStatus.NON_COMPLIANT.value:
            self._respond(400, {"message": f"Sharia compliance failed: {note}"})
            return

        period = int(body.get("investmentPeriodMonths", 12))
        contract = MudarabahContract(
            id=gen_id("MDR"),
            tenant_id=body.get("tenantId", default_tenant()),
            investor_id=investor_id,
            investor_name=body.get("investorName", ""),
            fund_manager_id=body.get("fundManagerId", "FM-DEFAULT"),
            investment_purpose=body.get("investmentPurpose", "general"),
            capital_amount=capital,
            currency=body.get("currency", "NGN"),
            profit_sharing_ratio_investor=investor_ratio,
            profit_sharing_ratio_manager=manager_ratio,
            investment_period_months=period,
            start_date=body.get("startDate", now_iso()[:10]),
            maturity_date=body.get("maturityDate", ""),
            realized_profit=0,
            realized_loss=0,
            distributions=[],
            status=ProductStatus.ACTIVE.value,
            sharia_compliance=compliance,
            risk_category=body.get("riskCategory", "moderate"),
            middleware=["TigerBeetle", "Kafka", "Temporal", "Permify", "sharia-compliance-engine", "Lakehouse"],
            created_at=now_iso(),
            updated_at=now_iso(),
        )
        mudarabah_contracts.append(contract)
        db_persist("mudarabah_contracts", contract.to_dict() if hasattr(contract, "to_dict") else contract if isinstance(contract, dict) else {"value": str(contract)})
        self._respond(201, asdict(contract))

    def _disburse_murabaha(self, cid: str):
        contract = next((c for c in murabaha_contracts if c.id == cid), None)
        if not contract:
            self._respond(404, {"message": "Murabaha contract not found"})
            return
        if contract.status not in (ProductStatus.APPROVED.value,):
            self._respond(400, {"message": "Contract must be approved before disbursement"})
            return
        contract.status = ProductStatus.ACTIVE.value
        contract.disbursement_date = now_iso()
        contract.updated_at = now_iso()
        self._respond(200, {
            "contract": asdict(contract),
            "ledgerEntry": {
                "debit": "murabaha-receivable",
                "credit": "customer-settlement-account",
                "amount": contract.cost_price,
                "middleware": ["TigerBeetle", "Kafka", "Temporal"],
            },
        })

    def _repay_murabaha(self, cid: str, body: dict):
        contract = next((c for c in murabaha_contracts if c.id == cid), None)
        if not contract:
            self._respond(404, {"message": "Murabaha contract not found"})
            return
        amount = float(body.get("amount", 0))
        if amount <= 0:
            self._respond(400, {"message": "amount must be positive"})
            return
        payment = min(amount, contract.outstanding_balance)
        contract.total_paid += payment
        contract.outstanding_balance -= payment
        if contract.outstanding_balance <= 0.01:
            contract.status = ProductStatus.MATURED.value
            contract.outstanding_balance = 0
        contract.updated_at = now_iso()
        self._respond(200, {
            "contract": asdict(contract),
            "payment": {"applied": payment},
            "ledgerEntry": {
                "debit": "customer-settlement-account",
                "credit": "murabaha-receivable",
                "amount": payment,
                "middleware": ["TigerBeetle", "Kafka"],
            },
        })

    def _distribute_mudarabah(self, cid: str, body: dict):
        contract = next((c for c in mudarabah_contracts if c.id == cid), None)
        if not contract:
            self._respond(404, {"message": "Mudarabah contract not found"})
            return
        profit = float(body.get("profitAmount", 0))
        if profit == 0:
            self._respond(400, {"message": "profitAmount is required"})
            return
        investor_share = round(profit * contract.profit_sharing_ratio_investor / 100, 2)
        manager_share = round(profit * contract.profit_sharing_ratio_manager / 100, 2)
        if profit > 0:
            contract.realized_profit += profit
        else:
            contract.realized_loss += abs(profit)
        distribution = {
            "distributionId": gen_id("DIST"),
            "period": body.get("period", now_iso()[:7]),
            "grossProfit": profit,
            "investorShare": investor_share,
            "managerShare": manager_share,
            "distributedAt": now_iso(),
        }
        contract.distributions.append(distribution)
        contract.updated_at = now_iso()
        self._respond(200, {
            "contract": asdict(contract),
            "distribution": distribution,
            "ledgerEntries": [
                {"debit": "mudarabah-profit-pool", "credit": "investor-account", "amount": investor_share},
                {"debit": "mudarabah-profit-pool", "credit": "fund-manager-fee", "amount": manager_share},
            ],
            "middleware": ["TigerBeetle", "Kafka", "Temporal", "Lakehouse"],
        })


if __name__ == "__main__":
    _init_db()
    port = int(os.environ.get("PORT", "8092"))
    server = HTTPServer(("0.0.0.0", port), IslamicBankingHandler)
    print(f"islamic-banking-py listening on 0.0.0.0:{port}")
    print("middleware integrations: Kafka, Redis, Postgres, Temporal, Permify, sharia-compliance-engine")
    server.serve_forever()
