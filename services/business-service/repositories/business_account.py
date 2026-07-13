"""Repository layer for business accounts."""
from typing import Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session

from models import BusinessAccount


class BusinessAccountRepository:
    """Repository for BusinessAccount entity CRUD operations."""

    @staticmethod
    def create(
        db: Session,
        business_id: str,
        account_id: str,
        account_purpose: Optional[str] = None,
        is_primary: bool = False,
    ) -> BusinessAccount:
        """Associate an account with a business."""
        business_account = BusinessAccount(
            id=str(uuid4()),
            business_id=business_id,
            account_id=account_id,
            account_purpose=account_purpose,
            is_primary=is_primary,
        )
        
        db.add(business_account)
        db.commit()
        db.refresh(business_account)
        return business_account

    @staticmethod
    def get_by_id(db: Session, business_account_id: str) -> Optional[BusinessAccount]:
        """Get business account by ID."""
        return db.query(BusinessAccount).filter(
            BusinessAccount.id == business_account_id,
            BusinessAccount.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_by_business_and_account(
        db: Session,
        business_id: str,
        account_id: str,
    ) -> Optional[BusinessAccount]:
        """Get business account association."""
        return db.query(BusinessAccount).filter(
            BusinessAccount.business_id == business_id,
            BusinessAccount.account_id == account_id,
            BusinessAccount.deleted_at.is_(None),
        ).first()

    @staticmethod
    def list_by_business(
        db: Session,
        business_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> List[BusinessAccount]:
        """List accounts for a business."""
        return db.query(BusinessAccount).filter(
            BusinessAccount.business_id == business_id,
            BusinessAccount.deleted_at.is_(None),
        ).offset(skip).limit(limit).all()

    @staticmethod
    def get_primary_account(db: Session, business_id: str) -> Optional[BusinessAccount]:
        """Get primary account for a business."""
        return db.query(BusinessAccount).filter(
            BusinessAccount.business_id == business_id,
            BusinessAccount.is_primary.is_(True),
            BusinessAccount.deleted_at.is_(None),
        ).first()

    @staticmethod
    def set_primary_account(
        db: Session,
        business_id: str,
        account_id: str,
    ) -> bool:
        """Set an account as primary for a business."""
        # Clear previous primary
        previous_primary = BusinessAccountRepository.get_primary_account(db, business_id)
        if previous_primary:
            previous_primary.is_primary = False
        
        # Set new primary
        business_account = BusinessAccountRepository.get_by_business_and_account(
            db, business_id, account_id
        )
        if business_account:
            business_account.is_primary = True
            db.commit()
            return True
        
        return False

    @staticmethod
    def soft_delete(db: Session, business_account_id: str) -> Optional[BusinessAccount]:
        """Soft delete a business account association."""
        business_account = BusinessAccountRepository.get_by_id(db, business_account_id)
        if not business_account:
            return None
        
        business_account.soft_delete()
        db.commit()
        db.refresh(business_account)
        return business_account
