"""Business service - core business logic."""
import logging
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from models import (
    Business,
    VerificationStatus,
    ComplianceStatus,
    BusinessUserRole,
    BusinessAction,
)
from repositories import (
    BusinessRepository,
    BusinessProfileRepository,
    BusinessUserRepository,
    BusinessAccountRepository,
    BusinessAuditLogRepository,
)
from utils import (
    ValidationError,
    BusinessNotFoundError,
    InvalidStateTransitionError,
    PermissionDeniedError,
)

logger = logging.getLogger(__name__)


class BusinessService:
    """Service for managing business operations."""

    # Valid state transitions for verification
    VERIFICATION_TRANSITIONS = {
        VerificationStatus.UNVERIFIED: [VerificationStatus.PENDING_VERIFICATION],
        VerificationStatus.PENDING_VERIFICATION: [
            VerificationStatus.VERIFIED,
            VerificationStatus.REJECTED,
            VerificationStatus.UNVERIFIED,
        ],
        VerificationStatus.VERIFIED: [VerificationStatus.SUSPENDED],
        VerificationStatus.REJECTED: [VerificationStatus.PENDING_VERIFICATION],
        VerificationStatus.SUSPENDED: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED],
    }

    # Valid state transitions for compliance
    COMPLIANCE_TRANSITIONS = {
        ComplianceStatus.PENDING_REVIEW: [
            ComplianceStatus.COMPLIANT,
            ComplianceStatus.NON_COMPLIANT,
        ],
        ComplianceStatus.COMPLIANT: [ComplianceStatus.NON_COMPLIANT, ComplianceStatus.SUSPENDED],
        ComplianceStatus.NON_COMPLIANT: [ComplianceStatus.COMPLIANT, ComplianceStatus.SUSPENDED],
        ComplianceStatus.SUSPENDED: [ComplianceStatus.COMPLIANT, ComplianceStatus.NON_COMPLIANT],
    }

    @staticmethod
    def create_business(
        db: Session,
        tenant_id: str,
        keycloak_id: str,
        name: str,
        registration_number: str,
        business_type: str,
        **kwargs,
    ) -> Business:
        """Create a new business."""
        logger.info(f"Creating business: {registration_number} for tenant {tenant_id}")
        
        # Create business
        business = BusinessRepository.create(
            db=db,
            tenant_id=tenant_id,
            name=name,
            registration_number=registration_number,
            business_type=business_type,
            keycloak_id=keycloak_id,
            **kwargs,
        )
        
        # Log the action
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.CREATED,
            performed_by=keycloak_id,
            new_state=business.to_dict(),
        )
        
        logger.info(f"Business created: {business.id}")
        return business

    @staticmethod
    def get_business(db: Session, business_id: str, tenant_id: str) -> Business:
        """Retrieve a business by ID."""
        business = BusinessRepository.get_by_id(db, business_id, tenant_id)
        if not business:
            raise BusinessNotFoundError(business_id)
        return business

    @staticmethod
    def list_businesses(
        db: Session,
        tenant_id: str,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> Tuple[List[Business], int]:
        """List businesses for a tenant."""
        return BusinessRepository.list_by_tenant(
            db=db,
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
        )

    @staticmethod
    def update_business(
        db: Session,
        business_id: str,
        tenant_id: str,
        keycloak_id: str,
        **kwargs,
    ) -> Business:
        """Update a business."""
        logger.info(f"Updating business: {business_id}")
        
        # Get original state
        previous_state = BusinessRepository.get_by_id(db, business_id, tenant_id).to_dict()
        
        # Update
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            **kwargs,
        )
        
        # Log the change
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.PROFILE_UPDATED,
            performed_by=keycloak_id,
            previous_state=previous_state,
            new_state=business.to_dict(),
        )
        
        logger.info(f"Business updated: {business_id}")
        return business

    @staticmethod
    def delete_business(db: Session, business_id: str, tenant_id: str, keycloak_id: str) -> Business:
        """Soft delete a business."""
        logger.info(f"Deleting business: {business_id}")
        
        # Get original state
        business = BusinessRepository.get_by_id(db, business_id, tenant_id)
        previous_state = business.to_dict()
        
        # Delete
        business = BusinessRepository.soft_delete(db, business_id, tenant_id)
        
        # Log the action
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.CLOSED,
            performed_by=keycloak_id,
            reason="Business soft deleted",
            previous_state=previous_state,
        )
        
        logger.info(f"Business deleted: {business_id}")
        return business

    @staticmethod
    def initiate_verification(
        db: Session,
        business_id: str,
        tenant_id: str,
        keycloak_id: str,
        reason: Optional[str] = None,
    ) -> Business:
        """Initiate verification for a business."""
        logger.info(f"Initiating verification for business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        
        # Check valid transition
        if business.verification_status not in BusinessService.VERIFICATION_TRANSITIONS:
            raise InvalidStateTransitionError(
                business.verification_status.value,
                VerificationStatus.PENDING_VERIFICATION.value,
            )
        
        allowed_next_states = BusinessService.VERIFICATION_TRANSITIONS[business.verification_status]
        if VerificationStatus.PENDING_VERIFICATION not in allowed_next_states:
            raise InvalidStateTransitionError(
                business.verification_status.value,
                VerificationStatus.PENDING_VERIFICATION.value,
            )
        
        # Update status
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.PENDING_VERIFICATION,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.VERIFIED,
            performed_by=keycloak_id,
            reason=reason or "Verification initiated",
        )
        
        logger.info(f"Verification initiated for business: {business_id}")
        return business

    @staticmethod
    def approve_verification(
        db: Session,
        business_id: str,
        tenant_id: str,
        approved_by: str,
        reason: Optional[str] = None,
    ) -> Business:
        """Approve business verification."""
        logger.info(f"Approving verification for business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        
        # Check current status
        if business.verification_status != VerificationStatus.PENDING_VERIFICATION:
            raise InvalidStateTransitionError(
                business.verification_status.value,
                VerificationStatus.VERIFIED.value,
            )
        
        # Update
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.VERIFIED,
        )
        
        # Also update compliance status if pending
        if business.compliance_status == ComplianceStatus.PENDING_REVIEW:
            business = BusinessRepository.update(
                db=db,
                business_id=business_id,
                tenant_id=tenant_id,
                compliance_status=ComplianceStatus.COMPLIANT,
            )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.VERIFIED,
            performed_by=approved_by,
            reason=reason or "Verification approved",
        )
        
        logger.info(f"Verification approved for business: {business_id}")
        return business

    @staticmethod
    def reject_verification(
        db: Session,
        business_id: str,
        tenant_id: str,
        rejected_by: str,
        reason: str,
    ) -> Business:
        """Reject business verification."""
        logger.info(f"Rejecting verification for business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        
        # Check current status
        if business.verification_status != VerificationStatus.PENDING_VERIFICATION:
            raise InvalidStateTransitionError(
                business.verification_status.value,
                VerificationStatus.REJECTED.value,
            )
        
        # Update
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.REJECTED,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.VERIFIED,
            performed_by=rejected_by,
            reason=reason or "Verification rejected",
        )
        
        logger.info(f"Verification rejected for business: {business_id}")
        return business

    @staticmethod
    def suspend_business(
        db: Session,
        business_id: str,
        tenant_id: str,
        suspended_by: str,
        reason: str,
    ) -> Business:
        """Suspend a business."""
        logger.info(f"Suspending business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        
        # Update statuses
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.SUSPENDED,
            compliance_status=ComplianceStatus.SUSPENDED,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.SUSPENDED,
            performed_by=suspended_by,
            reason=reason or "Business suspended",
        )
        
        logger.info(f"Business suspended: {business_id}")
        return business

    @staticmethod
    def activate_business(
        db: Session,
        business_id: str,
        tenant_id: str,
        activated_by: str,
    ) -> Business:
        """Activate a suspended business."""
        logger.info(f"Activating business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        
        # Check if suspended
        if business.verification_status != VerificationStatus.SUSPENDED:
            raise InvalidStateTransitionError(
                business.verification_status.value,
                VerificationStatus.VERIFIED.value,
            )
        
        # Update statuses back to verified/compliant
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.VERIFIED,
            compliance_status=ComplianceStatus.COMPLIANT,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.ACTIVATED,
            performed_by=activated_by,
            reason="Business reactivated",
        )
        
        logger.info(f"Business activated: {business_id}")
        return business

    @staticmethod
    def update_settings(
        db: Session,
        business_id: str,
        tenant_id: str,
        keycloak_id: str,
        settings: dict,
    ) -> Business:
        """Update business settings."""
        logger.info(f"Updating settings for business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        previous_settings = business.settings or {}
        
        # Merge settings
        merged_settings = {**(previous_settings or {}), **settings}
        
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            settings=merged_settings,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.SETTINGS_UPDATED,
            performed_by=keycloak_id,
            previous_state={"settings": previous_settings},
            new_state={"settings": merged_settings},
        )
        
        logger.info(f"Settings updated for business: {business_id}")
        return business

    @staticmethod
    def mark_kyb_complete(db: Session, tenant_id: str, keycloak_id: str) -> Business:
        """Mark a business as KYB-verified, called by the orchestrator after successful verification."""
        logger.info(f"[mark_kyb_complete] tenant_id={tenant_id} keycloak_id={keycloak_id}")

        business = BusinessRepository.get_by_keycloak_id(db, keycloak_id, tenant_id)
        if not business:
            raise BusinessNotFoundError(f"keycloak_id={keycloak_id}")

        # Force status to VERIFIED regardless of current state (trusted internal call)
        business = BusinessRepository.update(
            db=db,
            business_id=business.id,
            tenant_id=tenant_id,
            verification_status=VerificationStatus.VERIFIED,
        )

        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.VERIFIED,
            performed_by="kyb-callback",
            reason="KYB verification completed automatically",
        )

        logger.info(f"[mark_kyb_complete] business {business.id} set to VERIFIED")
        return business

    @staticmethod
    def update_metadata(
        db: Session,
        business_id: str,
        tenant_id: str,
        keycloak_id: str,
        metadata: dict,
    ) -> Business:
        """Update business metadata."""
        logger.info(f"Updating metadata for business: {business_id}")
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        previous_metadata = business.business_metadata or {}
        
        # Merge metadata
        merged_metadata = {**(previous_metadata or {}), **metadata}
        
        business = BusinessRepository.update(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            business_metadata=merged_metadata,
        )
        
        # Log
        BusinessAuditLogRepository.create(
            db=db,
            business_id=business.id,
            action=BusinessAction.PROFILE_UPDATED,
            performed_by=keycloak_id,
            previous_state={"metadata": previous_metadata},
            new_state={"metadata": merged_metadata},
        )
        
        logger.info(f"Metadata updated for business: {business_id}")
        return business
