import uuid
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models.investigation import Investigation, InvestigationStatus, InvestigationPriority, InvestigationType
from schemas import Context, Pagination


def _generate_case_number() -> str:
    ts = datetime.datetime.utcnow().strftime("%Y%m%d")
    return f"INV-{ts}-{uuid.uuid4().hex[:6].upper()}"


class InvestigationService:
    def __init__(self, db: Session):
        self._db = db

    def list_investigations(self, context: Context, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        return (
            self._db.query(Investigation)
            .filter(Investigation.tenant_id == context.tenant_id)
            .order_by(Investigation.created_at.desc())
            .offset(offset)
            .limit(pagination.limit or 20)
            .all()
        )

    def get_investigation(self, investigation_id: str, context: Context):
        return (
            self._db.query(Investigation)
            .filter(
                Investigation.id == investigation_id,
                Investigation.tenant_id == context.tenant_id,
            )
            .first()
        )

    def create_investigation(self, data: dict, context: Context) -> Investigation:
        inv = Investigation(
            case_number=_generate_case_number(),
            transaction_id=data.get("transaction_id"),
            status=InvestigationStatus.OPEN,
            type=InvestigationType(data.get("type", InvestigationType.OTHER)),
            priority=InvestigationPriority(data.get("priority", InvestigationPriority.MEDIUM)),
            description=data.get("description"),
            assigned_to=data.get("assigned_to"),
            reported_by=data.get("reported_by"),
            tenant_id=context.tenant_id,
        )
        self._db.add(inv)
        self._db.commit()
        self._db.refresh(inv)
        return inv

    def update_investigation(self, investigation_id: str, data: dict, context: Context):
        inv = self.get_investigation(investigation_id, context)
        if not inv:
            return None
        if "status" in data:
            inv.status = InvestigationStatus(data["status"])
        if "priority" in data:
            inv.priority = InvestigationPriority(data["priority"])
        if "assigned_to" in data:
            inv.assigned_to = data["assigned_to"]
        if "resolution_notes" in data:
            inv.resolution_notes = data["resolution_notes"]
            if inv.status == InvestigationStatus.OPEN:
                inv.status = InvestigationStatus.IN_PROGRESS
        self._db.commit()
        self._db.refresh(inv)
        return inv

    def count_investigations(self, context: Context) -> int:
        return (
            self._db.query(Investigation)
            .filter(Investigation.tenant_id == context.tenant_id)
            .count()
        )
