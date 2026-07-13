"""Repository layer for business users."""
from typing import Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session

from models import BusinessUser, BusinessUserRole
from utils import BusinessNotFoundError


class BusinessUserRepository:
    """Repository for BusinessUser entity CRUD operations."""

    @staticmethod
    def create(
        db: Session,
        business_id: str,
        keycloak_id: str,
        role: BusinessUserRole = BusinessUserRole.STAFF,
        permissions: Optional[dict] = None,
    ) -> BusinessUser:
        """Add a user to a business."""
        business_user = BusinessUser(
            id=str(uuid4()),
            business_id=business_id,
            keycloak_id=keycloak_id,
            role=role,
            permissions=permissions,
        )
        
        db.add(business_user)
        db.commit()
        db.refresh(business_user)
        return business_user

    @staticmethod
    def get_by_id(db: Session, user_id: str) -> Optional[BusinessUser]:
        """Get business user by ID."""
        return db.query(BusinessUser).filter(
            BusinessUser.id == user_id,
            BusinessUser.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_by_business_and_keycloak_id(
        db: Session,
        business_id: str,
        keycloak_id: str,
    ) -> Optional[BusinessUser]:
        """Get business user by business_id and keycloak_id."""
        return db.query(BusinessUser).filter(
            BusinessUser.business_id == business_id,
            BusinessUser.keycloak_id == keycloak_id,
            BusinessUser.deleted_at.is_(None),
        ).first()

    @staticmethod
    def list_by_business(
        db: Session,
        business_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> List[BusinessUser]:
        """List users for a business."""
        return db.query(BusinessUser).filter(
            BusinessUser.business_id == business_id,
            BusinessUser.deleted_at.is_(None),
        ).offset(skip).limit(limit).all()

    @staticmethod
    def update_role(
        db: Session,
        user_id: str,
        role: BusinessUserRole,
        permissions: Optional[dict] = None,
    ) -> Optional[BusinessUser]:
        """Update a business user's role and permissions."""
        business_user = BusinessUserRepository.get_by_id(db, user_id)
        if not business_user:
            return None
        
        business_user.role = role
        if permissions is not None:
            business_user.permissions = permissions
        
        db.commit()
        db.refresh(business_user)
        return business_user

    @staticmethod
    def soft_delete(db: Session, user_id: str) -> Optional[BusinessUser]:
        """Soft delete a business user."""
        business_user = BusinessUserRepository.get_by_id(db, user_id)
        if not business_user:
            return None
        
        business_user.soft_delete()
        db.commit()
        db.refresh(business_user)
        return business_user
