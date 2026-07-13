"""Business repository - data access layer."""
from typing import Optional, List, Tuple
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from models import Business, VerificationStatus, ComplianceStatus
from utils import BusinessNotFoundError, BusinessAlreadyExistsError


class BusinessRepository:
    """Repository for Business entity CRUD operations."""

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        name: str,
        registration_number: str,
        business_type: str,
        **kwargs,
    ) -> Business:
        """Create a new business."""
        # Check if business already exists
        existing = db.query(Business).filter(
            Business.registration_number == registration_number,
            Business.tenant_id == tenant_id,
        ).first()
        
        if existing:
            raise BusinessAlreadyExistsError(registration_number)
        
        business = Business(
            id=str(uuid4()),
            tenant_id=tenant_id,
            name=name,
            registration_number=registration_number,
            business_type=business_type,
            **kwargs,
        )
        
        db.add(business)
        db.commit()
        db.refresh(business)
        return business

    @staticmethod
    def get_by_id(db: Session, business_id: str, tenant_id: str) -> Optional[Business]:
        """Get business by ID."""
        return db.query(Business).filter(
            Business.id == business_id,
            Business.tenant_id == tenant_id,
            Business.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_by_registration_number(
        db: Session,
        registration_number: str,
        tenant_id: str,
    ) -> Optional[Business]:
        """Get business by registration number."""
        return db.query(Business).filter(
            Business.registration_number == registration_number,
            Business.tenant_id == tenant_id,
            Business.deleted_at.is_(None),
        ).first()

    @staticmethod
    def list_by_tenant(
        db: Session,
        tenant_id: str,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> Tuple[List[Business], int]:
        """List businesses for a tenant with pagination."""
        query = db.query(Business).filter(
            Business.tenant_id == tenant_id,
            Business.deleted_at.is_(None),
        )
        
        if status:
            query = query.filter(Business.verification_status == status)
        
        total = query.count()
        businesses = query.order_by(desc(Business.created_at)).offset(skip).limit(limit).all()
        
        return businesses, total

    @staticmethod
    def update(db: Session, business_id: str, tenant_id: str, **kwargs) -> Optional[Business]:
        """Update a business."""
        business = BusinessRepository.get_by_id(db, business_id, tenant_id)
        if not business:
            raise BusinessNotFoundError(business_id)
        
        for key, value in kwargs.items():
            if hasattr(business, key) and value is not None:
                setattr(business, key, value)
        
        db.commit()
        db.refresh(business)
        return business

    @staticmethod
    def soft_delete(db: Session, business_id: str, tenant_id: str) -> Business:
        """Soft delete a business."""
        business = BusinessRepository.get_by_id(db, business_id, tenant_id)
        if not business:
            raise BusinessNotFoundError(business_id)
        
        business.soft_delete()
        db.commit()
        db.refresh(business)
        return business

    @staticmethod
    def restore(db: Session, business_id: str, tenant_id: str) -> Business:
        """Restore a soft-deleted business."""
        business = db.query(Business).filter(
            Business.id == business_id,
            Business.tenant_id == tenant_id,
            Business.deleted_at.isnot(None),
        ).first()
        
        if not business:
            raise BusinessNotFoundError(business_id)
        
        business.restore()
        db.commit()
        db.refresh(business)
        return business

    @staticmethod
    def get_by_keycloak_id(db: Session, keycloak_id: str, tenant_id: str) -> Optional[Business]:
        """Get business by keycloak_id and tenant_id."""
        return db.query(Business).filter(
            Business.keycloak_id == keycloak_id,
            Business.tenant_id == tenant_id,
            Business.deleted_at.is_(None),
        ).first()

    @staticmethod
    def count_by_verification_status(
        db: Session,
        tenant_id: str,
        status: VerificationStatus,
    ) -> int:
        """Count businesses by verification status."""
        return db.query(Business).filter(
            Business.tenant_id == tenant_id,
            Business.verification_status == status,
            Business.deleted_at.is_(None),
        ).count()

    @staticmethod
    def count_by_compliance_status(
        db: Session,
        tenant_id: str,
        status: ComplianceStatus,
    ) -> int:
        """Count businesses by compliance status."""
        return db.query(Business).filter(
            Business.tenant_id == tenant_id,
            Business.compliance_status == status,
            Business.deleted_at.is_(None),
        ).count()
