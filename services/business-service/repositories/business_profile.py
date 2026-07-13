"""Repository layer for business profiles."""
from typing import Optional
from uuid import uuid4
from sqlalchemy.orm import Session

from models import BusinessProfile


class BusinessProfileRepository:
    """Repository for BusinessProfile entity CRUD operations."""

    @staticmethod
    def create(
        db: Session,
        business_id: str,
        **kwargs,
    ) -> BusinessProfile:
        """Create a business profile."""
        profile = BusinessProfile(
            id=str(uuid4()),
            business_id=business_id,
            **kwargs,
        )
        
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def get_by_business_id(db: Session, business_id: str) -> Optional[BusinessProfile]:
        """Get profile for a business."""
        return db.query(BusinessProfile).filter(
            BusinessProfile.business_id == business_id,
            BusinessProfile.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_by_id(db: Session, profile_id: str) -> Optional[BusinessProfile]:
        """Get profile by ID."""
        return db.query(BusinessProfile).filter(
            BusinessProfile.id == profile_id,
            BusinessProfile.deleted_at.is_(None),
        ).first()

    @staticmethod
    def update(
        db: Session,
        profile_id: str,
        **kwargs,
    ) -> Optional[BusinessProfile]:
        """Update a business profile."""
        profile = BusinessProfileRepository.get_by_id(db, profile_id)
        if not profile:
            return None
        
        for key, value in kwargs.items():
            if hasattr(profile, key) and value is not None:
                setattr(profile, key, value)
        
        db.commit()
        db.refresh(profile)
        return profile

    @staticmethod
    def soft_delete(db: Session, profile_id: str) -> Optional[BusinessProfile]:
        """Soft delete a business profile."""
        profile = BusinessProfileRepository.get_by_id(db, profile_id)
        if not profile:
            return None
        
        profile.soft_delete()
        db.commit()
        db.refresh(profile)
        return profile
