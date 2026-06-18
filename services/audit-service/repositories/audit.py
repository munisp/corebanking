from sqlalchemy.orm import Session
from schemas import AuditEventSchema, Pagination
from models import Audit


class AuditRepository:
    """Audit repository."""

    def __init__(self, db: Session):
        self.__db = db

    def create_audit(self, payload: AuditEventSchema):
        audit = Audit(
            actor_id=payload.actor_id,
            tenant_id=payload.tenant_id,
            event_type=payload.event_type,
            event_data=payload.event_data,
            timestamp=payload.timestamp,
        )

        self.__db.add(audit)
        self.__db.commit()

        return audit

    def fetch_tenant_audits(self, tenant_id: str, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        query = self.__db.query(Audit).filter(Audit.tenant_id == tenant_id)
        total = query.count()
        data = (
            query
            .order_by(Audit.timestamp.desc())
            .offset(offset)
            .limit(pagination.limit)
            .all()
        )
        return {"data": data, "total": total, "page": pagination.page, "limit": pagination.limit}

    def fetch_all_audits(self, pagination: Pagination):
        offset = (pagination.page - 1) * pagination.limit
        query = self.__db.query(Audit)
        total = query.count()
        data = (
            query
            .order_by(Audit.timestamp.desc())
            .offset(offset)
            .limit(pagination.limit)
            .all()
        )
        return {"data": data, "total": total, "page": pagination.page, "limit": pagination.limit}
