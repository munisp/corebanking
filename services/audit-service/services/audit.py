from sqlalchemy.orm import Session
from repositories import AuditRepository
from schemas import Context, Pagination

class AuditService:
    def __init__(self, db: Session):
        self.__audit_repository = AuditRepository(db)

    def create_audit(self, payload):
        return self.__audit_repository.create_audit(payload)

    def fetch_tenant_audits(self, tenant_id: str, pagination: Pagination):
        return self.__audit_repository.fetch_tenant_audits(tenant_id, pagination)

    def fetch_all_audits(self, pagination: Pagination):
        return self.__audit_repository.fetch_all_audits(pagination)

    # AU-03: hash-chain verification (tamper evidence).
    def verify_chain(self, tenant_id=None, from_ts=None, to_ts=None):
        return self.__audit_repository.verify_chain(tenant_id, from_ts, to_ts)

    # CP-07: ordered slice for the regulator export bundle.
    def fetch_slice(self, tenant_id: str, from_ts=None, to_ts=None):
        return self.__audit_repository.fetch_slice(tenant_id, from_ts, to_ts)
