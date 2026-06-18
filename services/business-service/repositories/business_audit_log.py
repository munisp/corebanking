"""Repository layer for business audit logs."""
from typing import List
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models import BusinessAuditLog, BusinessAction


class BusinessAuditLogRepository:
    """Repository for BusinessAuditLog entity operations."""

    @staticmethod
    def create(
        db: Session,
        business_id: str,
        action: BusinessAction,
        performed_by: str,
        reason: str = None,
        previous_state: dict = None,
        new_state: dict = None,
    ) -> BusinessAuditLog:
        """Create an audit log entry."""
        audit_log = BusinessAuditLog(
            id=str(uuid4()),
            business_id=business_id,
            action=action,
            performed_by=performed_by,
            reason=reason,
            previous_state=previous_state,
            new_state=new_state,
        )
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log

    @staticmethod
    def list_by_business(
        db: Session,
        business_id: str,
        skip: int = 0,
        limit: int = 50,
        action: BusinessAction = None,
    ) -> List[BusinessAuditLog]:
        """List audit logs for a business."""
        query = db.query(BusinessAuditLog).filter(
            BusinessAuditLog.business_id == business_id
        )
        
        if action:
            query = query.filter(BusinessAuditLog.action == action)
        
        return query.order_by(desc(BusinessAuditLog.created_at)).offset(skip).limit(limit).all()

    @staticmethod
    def get_by_id(db: Session, audit_log_id: str) -> BusinessAuditLog:
        """Get audit log by ID."""
        return db.query(BusinessAuditLog).filter(
            BusinessAuditLog.id == audit_log_id
        ).first()
