"""B9: Dispute Management Enhancements
Adds: Chargeback workflow, arbitration, SLA tracking, evidence management,
regulatory escalation, dispute analytics
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
import uuid


@dataclass
class ChargebackCase:
    id: str = ""
    dispute_id: str = ""
    original_txn_id: str = ""
    merchant_id: str = ""
    amount: float = 0
    reason_code: str = ""  # CB001=fraud, CB002=goods_not_received, CB003=defective
    network: str = ""  # visa, mastercard, verve
    representment_deadline: str = ""
    status: str = "initiated"  # initiated, merchant_notified, representment, pre_arbitration, arbitration, resolved
    resolution: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class ArbitrationCase:
    id: str = ""
    dispute_id: str = ""
    arbitrator: str = ""
    bank_position: str = ""
    merchant_position: str = ""
    evidence_ids: list = field(default_factory=list)
    ruling: str = ""
    ruling_amount: float = 0
    status: str = "pending"

    def to_dict(self):
        return asdict(self)


@dataclass
class SLATracker:
    id: str = ""
    dispute_id: str = ""
    sla_type: str = ""  # acknowledgment, resolution, escalation
    deadline: str = ""
    met: bool = False
    breached: bool = False
    actual_date: str = ""

    def to_dict(self):
        return asdict(self)


@dataclass
class Evidence:
    id: str = ""
    dispute_id: str = ""
    evidence_type: str = ""  # transaction_receipt, correspondence, screenshot, cctv, signed_document
    description: str = ""
    file_ref: str = ""
    uploaded_by: str = ""
    uploaded_at: str = ""

    def to_dict(self):
        return asdict(self)


chargebacks: list[ChargebackCase] = []
arbitrations: list[ArbitrationCase] = []
sla_trackers: list[SLATracker] = []
evidences: list[Evidence] = []


def handle_chargebacks(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"chargebacks": [c.to_dict() for c in chargebacks]}
    if method == "POST":
        cb = ChargebackCase(**{k: v for k, v in body.items() if k in ChargebackCase.__dataclass_fields__})
        cb.id = f"CB-{uuid.uuid4().hex[:8]}"
        # Set representment deadline: 30 days from now
        deadline = datetime.now(timezone.utc) + timedelta(days=30)
        cb.representment_deadline = deadline.isoformat()
        if cb.reason_code not in ("CB001", "CB002", "CB003", "CB004", "CB005"):
            return 400, {"error": "Invalid reason_code. Use CB001-CB005"}
        chargebacks.append(cb)
        return 201, cb.to_dict()
    return 405, {"error": "method not allowed"}


def handle_arbitration(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"arbitrations": [a.to_dict() for a in arbitrations]}
    if method == "POST":
        arb = ArbitrationCase(**{k: v for k, v in body.items() if k in ArbitrationCase.__dataclass_fields__})
        arb.id = f"ARB-{uuid.uuid4().hex[:8]}"
        arbitrations.append(arb)
        return 201, arb.to_dict()
    return 405, {"error": "method not allowed"}


def handle_sla(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"trackers": [s.to_dict() for s in sla_trackers]}
    if method == "POST":
        sla = SLATracker(**{k: v for k, v in body.items() if k in SLATracker.__dataclass_fields__})
        sla.id = f"SLA-{uuid.uuid4().hex[:8]}"
        # Set deadline based on type
        sla_days = {"acknowledgment": 2, "resolution": 14, "escalation": 7}
        days = sla_days.get(sla.sla_type, 14)
        sla.deadline = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        sla_trackers.append(sla)
        return 201, sla.to_dict()
    return 405, {"error": "method not allowed"}


def handle_evidence(method: str, body: dict) -> tuple[int, dict]:
    if method == "GET":
        return 200, {"evidences": [e.to_dict() for e in evidences]}
    if method == "POST":
        ev = Evidence(**{k: v for k, v in body.items() if k in Evidence.__dataclass_fields__})
        ev.id = f"EV-{uuid.uuid4().hex[:8]}"
        ev.uploaded_at = datetime.now(timezone.utc).isoformat()
        evidences.append(ev)
        return 201, ev.to_dict()
    return 405, {"error": "method not allowed"}


ENHANCEMENT_ROUTES = {
    "/v1/disputes/chargebacks": handle_chargebacks,
    "/v1/disputes/arbitration": handle_arbitration,
    "/v1/disputes/sla": handle_sla,
    "/v1/disputes/evidence": handle_evidence,
}
