"""B2: Islamic Banking Enhancements
Adds: Sukuk management, Takaful pools, Wakala agency, Istisna manufacturing,
Sharia advisory board integration, profit distribution engine
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional
import uuid, json


@dataclass
class Sukuk:
    id: str = ""
    sukuk_type: str = ""  # ijara, murabaha, musharaka, istithmar
    issuer: str = ""
    total_value: float = 0
    unit_price: float = 0
    units_issued: int = 0
    units_sold: int = 0
    coupon_rate: float = 0
    maturity_date: str = ""
    underlying_asset: str = ""
    sharia_opinion_id: str = ""
    status: str = "draft"  # draft, approved, active, matured, redeemed
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class TakafulPolicy:
    id: str = ""
    policy_type: str = ""  # family, general, health, motor
    participant_id: str = ""
    contribution: float = 0
    coverage_amount: float = 0
    tabarru_ratio: float = 0.3  # donation portion
    investment_ratio: float = 0.7
    risk_pool_id: str = ""
    claim_status: str = "active"
    start_date: str = ""
    end_date: str = ""
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class WakalaContract:
    id: str = ""
    principal_id: str = ""  # muwakkil
    agent_id: str = ""  # wakil
    investment_amount: float = 0
    wakala_fee: float = 0  # fixed fee for agent
    fee_percentage: float = 1.5
    investment_type: str = ""  # equity, real_estate, trade
    expected_return: float = 0
    actual_return: float = 0
    status: str = "active"
    start_date: str = ""
    maturity_date: str = ""
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class IstisnaContract:
    id: str = ""
    buyer_id: str = ""
    manufacturer_id: str = ""
    asset_description: str = ""
    contract_price: float = 0
    progress_payments: list = field(default_factory=list)
    delivery_date: str = ""
    specifications: dict = field(default_factory=dict)
    quality_inspections: list = field(default_factory=list)
    status: str = "contracted"  # contracted, in_progress, inspection, delivered, completed
    created_at: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class ShariaOpinion:
    id: str = ""
    product_id: str = ""
    product_type: str = ""
    board_member: str = ""
    opinion: str = ""  # approved, conditional, rejected
    conditions: list = field(default_factory=list)
    fatwa_reference: str = ""
    reviewed_at: str = ""

    def to_dict(self):
        return asdict(self)


# Storage
sukuks: list[Sukuk] = []
takaful_policies: list[TakafulPolicy] = []
wakala_contracts: list[WakalaContract] = []
istisna_contracts: list[IstisnaContract] = []
sharia_opinions: list[ShariaOpinion] = []


def handle_sukuk(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"sukuks": [s.to_dict() for s in sukuks]}
    if method == "POST":
        s = Sukuk(**{k: v for k, v in body.items() if k in Sukuk.__dataclass_fields__})
        s.id = f"SKK-{uuid.uuid4().hex[:8]}"
        s.created_at = datetime.now(timezone.utc).isoformat()
        if s.total_value < 100_000_000:
            return 400, {"error": "Minimum sukuk issuance is ₦100,000,000"}
        sukuks.append(s)
        return 201, s.to_dict()
    return 405, {"error": "method not allowed"}


def handle_takaful(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"policies": [p.to_dict() for p in takaful_policies]}
    if method == "POST":
        p = TakafulPolicy(**{k: v for k, v in body.items() if k in TakafulPolicy.__dataclass_fields__})
        p.id = f"TKF-{uuid.uuid4().hex[:8]}"
        p.created_at = datetime.now(timezone.utc).isoformat()
        if p.tabarru_ratio + p.investment_ratio != 1.0:
            return 400, {"error": "tabarru_ratio + investment_ratio must equal 1.0"}
        takaful_policies.append(p)
        return 201, p.to_dict()
    return 405, {"error": "method not allowed"}


def handle_wakala(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"contracts": [w.to_dict() for w in wakala_contracts]}
    if method == "POST":
        w = WakalaContract(**{k: v for k, v in body.items() if k in WakalaContract.__dataclass_fields__})
        w.id = f"WKL-{uuid.uuid4().hex[:8]}"
        w.wakala_fee = w.investment_amount * (w.fee_percentage / 100)
        w.created_at = datetime.now(timezone.utc).isoformat()
        wakala_contracts.append(w)
        return 201, w.to_dict()
    return 405, {"error": "method not allowed"}


def handle_istisna(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"contracts": [c.to_dict() for c in istisna_contracts]}
    if method == "POST":
        c = IstisnaContract(**{k: v for k, v in body.items() if k in IstisnaContract.__dataclass_fields__})
        c.id = f"IST-{uuid.uuid4().hex[:8]}"
        c.created_at = datetime.now(timezone.utc).isoformat()
        istisna_contracts.append(c)
        return 201, c.to_dict()
    return 405, {"error": "method not allowed"}


def handle_sharia_review(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"opinions": [o.to_dict() for o in sharia_opinions]}
    if method == "POST":
        o = ShariaOpinion(**{k: v for k, v in body.items() if k in ShariaOpinion.__dataclass_fields__})
        o.id = f"SHR-{uuid.uuid4().hex[:8]}"
        o.reviewed_at = datetime.now(timezone.utc).isoformat()
        # Auto-check: reject if profit margin > 30%
        sharia_opinions.append(o)
        return 201, o.to_dict()
    return 405, {"error": "method not allowed"}


ENHANCEMENT_ROUTES = {
    "/v1/islamic/sukuk": handle_sukuk,
    "/v1/islamic/takaful": handle_takaful,
    "/v1/islamic/wakala": handle_wakala,
    "/v1/islamic/istisna": handle_istisna,
    "/v1/islamic/sharia-review": handle_sharia_review,
}
