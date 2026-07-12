"""Business account service - manages business account associations."""
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models import BusinessAction
from repositories import BusinessAccountRepository, BusinessAuditLogRepository
from utils import BusinessNotFoundError

logger = logging.getLogger(__name__)


class BusinessAccountService:
    """Service for managing business accounts."""

    @staticmethod
    def associate_account(
        db: Session,
        business_id: str,
        account_id: str,
        account_purpose: Optional[str] = None,
        is_primary: bool = False,
        associated_by: Optional[str] = None,
    ):
        """Associate an account with a business."""
        logger.info(f"Associating account {account_id} with business {business_id}")
        
        # Create association
        business_account = BusinessAccountRepository.create(
            db=db,
            business_id=business_id,
            account_id=account_id,
            account_purpose=account_purpose,
            is_primary=is_primary,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business_id,
            action=BusinessAction.ACCOUNT_ASSOCIATED,
            performed_by=associated_by,
            new_state=business_account.to_dict(),
        )
        
        logger.info(f"Account associated: {business_account.id}")
        return business_account

    @staticmethod
    def disassociate_account(
        db: Session,
        business_id: str,
        account_id: str,
        disassociated_by: Optional[str] = None,
    ):
        """Disassociate an account from a business."""
        logger.info(f"Disassociating account {account_id} from business {business_id}")
        
        # Get the association
        business_account = BusinessAccountRepository.get_by_business_and_account(
            db=db,
            business_id=business_id,
            account_id=account_id,
        )
        
        if not business_account:
            raise BusinessNotFoundError(f"Account {account_id} not associated with business")
        
        previous_state = business_account.to_dict()
        
        # Delete
        business_account = BusinessAccountRepository.soft_delete(db, business_account.id)
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business_id,
            action=BusinessAction.ACCOUNT_DISASSOCIATED,
            performed_by=disassociated_by,
            previous_state=previous_state,
        )
        
        logger.info(f"Account disassociated: {account_id}")
        return business_account

    @staticmethod
    def list_business_accounts(
        db: Session,
        business_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> List:
        """List accounts for a business."""
        return BusinessAccountRepository.list_by_business(
            db=db,
            business_id=business_id,
            skip=skip,
            limit=limit,
        )

    @staticmethod
    def get_primary_account(db: Session, business_id: str):
        """Get primary account for a business."""
        return BusinessAccountRepository.get_primary_account(db, business_id)

    @staticmethod
    def set_primary_account(
        db: Session,
        business_id: str,
        account_id: str,
        set_by: Optional[str] = None,
    ) -> bool:
        """Set an account as primary for a business."""
        logger.info(f"Setting account {account_id} as primary for business {business_id}")
        
        success = BusinessAccountRepository.set_primary_account(
            db=db,
            business_id=business_id,
            account_id=account_id,
        )
        
        if success:
            # Log
            BusinessAuditLogRepository.create(
                db=db,
                business_id=business_id,
                action=BusinessAction.ACCOUNT_ASSOCIATED,
                performed_by=set_by,
                reason=f"Account {account_id} set as primary",
            )
            logger.info(f"Primary account set: {account_id}")
        
        return success
