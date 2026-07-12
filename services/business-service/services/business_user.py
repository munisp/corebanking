"""Business user service - manages business user associations."""
import logging
from typing import List, Optional
from sqlalchemy.orm import Session

from models import BusinessUserRole, BusinessAction
from repositories import BusinessUserRepository, BusinessAuditLogRepository
from utils import BusinessNotFoundError

logger = logging.getLogger(__name__)


class BusinessUserService:
    """Service for managing business users."""

    @staticmethod
    def add_user_to_business(
        db: Session,
        business_id: str,
        keycloak_id: str,
        role: str = BusinessUserRole.STAFF,
        permissions: Optional[dict] = None,
    ):
        """Add a user to a business."""
        logger.info(f"Adding user {keycloak_id} to business {business_id} with role {role}")
        
        # Create association
        business_user = BusinessUserRepository.create(
            db=db,
            business_id=business_id,
            keycloak_id=keycloak_id,
            role=role,
            permissions=permissions,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business_id,
            action=BusinessAction.USER_ADDED,
            performed_by=keycloak_id,
            new_state=business_user.to_dict(),
        )
        
        logger.info(f"User added to business: {business_user.id}")
        return business_user

    @staticmethod
    def update_user_role(
        db: Session,
        user_id: str,
        business_id: str,
        role: str,
        permissions: Optional[dict] = None,
        updated_by: Optional[str] = None,
    ):
        """Update a business user's role."""
        logger.info(f"Updating user {user_id} role to {role}")
        
        # Get previous state
        previous_user = BusinessUserRepository.get_by_id(db, user_id)
        if not previous_user:
            raise BusinessNotFoundError(f"User {user_id} not found")
        previous_state = previous_user.to_dict()
        
        # Update
        business_user = BusinessUserRepository.update_role(
            db=db,
            user_id=user_id,
            role=role,
            permissions=permissions,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business_id,
            action=BusinessAction.USER_ADDED,  # Reusing for role updates
            performed_by=updated_by,
            previous_state=previous_state,
            new_state=business_user.to_dict(),
        )
        
        logger.info(f"User role updated: {user_id}")
        return business_user

    @staticmethod
    def remove_user_from_business(
        db: Session,
        user_id: str,
        business_id: str,
        removed_by: Optional[str] = None,
    ):
        """Remove a user from a business."""
        logger.info(f"Removing user {user_id} from business {business_id}")
        
        # Get previous state
        previous_user = BusinessUserRepository.get_by_id(db, user_id)
        if not previous_user:
            raise BusinessNotFoundError(f"User {user_id} not found")
        previous_state = previous_user.to_dict()
        
        # Delete
        business_user = BusinessUserRepository.soft_delete(db, user_id)
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business_id,
            action=BusinessAction.USER_REMOVED,
            performed_by=removed_by,
            previous_state=previous_state,
        )
        
        logger.info(f"User removed from business: {user_id}")
        return business_user

    @staticmethod
    def list_business_users(
        db: Session,
        business_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> List:
        """List users for a business."""
        return BusinessUserRepository.list_by_business(
            db=db,
            business_id=business_id,
            skip=skip,
            limit=limit,
        )

    @staticmethod
    def get_user_in_business(
        db: Session,
        business_id: str,
        keycloak_id: str,
    ):
        """Get a specific user in a business."""
        return BusinessUserRepository.get_by_business_and_keycloak_id(
            db=db,
            business_id=business_id,
            keycloak_id=keycloak_id,
        )
