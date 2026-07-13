"""Business API routes."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_session
from schemas import (
    CreateBusinessRequest,
    UpdateBusinessRequest,
    BusinessResponse,
    BusinessListResponse,
    VerifyBusinessRequest,
    ApproveVerificationRequest,
    RejectVerificationRequest,
    ErrorResponse,
)
from services import BusinessService
from utils import (
    BusinessServiceException,
    BusinessNotFoundError,
    ValidationError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/businesses", tags=["business"])


@router.get("", response_model=BusinessListResponse)
def list_businesses(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: Session = Depends(get_session),
):
    """List businesses for a tenant."""
    try:
        tenant_id = request.state.tenant_id
        
        businesses, total = BusinessService.list_businesses(
            db=db,
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
        )
        
        return {
            "total": total,
            "skip": skip,
            "limit": limit,
            "businesses": [b.to_dict() for b in businesses],
        }
    
    except Exception as e:
        logger.error(f"Error listing businesses: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("", response_model=BusinessResponse, status_code=201)
def create_business(
    request: Request,
    payload: CreateBusinessRequest,
    db: Session = Depends(get_session),
):
    """Create a new business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        # Create business
        business = BusinessService.create_business(
            db=db,
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            name=payload.name,
            registration_number=payload.registration_number,
            business_type=payload.business_type,
            industry_code=payload.industry_code,
            headquarters_address=payload.headquarters_address,
            headquarters_location=payload.headquarters_location,
            website_url=payload.website_url,
            phone_number=payload.phone_number,
            email_address=payload.email_address,
            registration_date=payload.registration_date,
            business_metadata=payload.metadata,
            settings=payload.settings,
        )
        
        return business.to_dict()
    
    except BusinessServiceException as e:
        logger.error(f"Business service error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error creating business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{business_id}", response_model=BusinessResponse)
def get_business(
    request: Request,
    business_id: str,
    db: Session = Depends(get_session),
):
    """Get a business by ID."""
    try:
        tenant_id = request.state.tenant_id
        
        business = BusinessService.get_business(db, business_id, tenant_id)
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error retrieving business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")





@router.put("/{business_id}", response_model=BusinessResponse)
def update_business(
    request: Request,
    business_id: str,
    payload: UpdateBusinessRequest,
    db: Session = Depends(get_session),
):
    """Update a business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        # Build update dict from payload
        update_data = payload.dict(exclude_unset=True)
        
        business = BusinessService.update_business(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            **update_data,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error updating business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{business_id}", response_model=BusinessResponse)
def delete_business(
    request: Request,
    business_id: str,
    db: Session = Depends(get_session),
):
    """Soft delete a business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.delete_business(db, business_id, tenant_id, keycloak_id)
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error deleting business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{business_id}/verify", response_model=BusinessResponse)
def initiate_verification(
    request: Request,
    business_id: str,
    payload: VerifyBusinessRequest,
    db: Session = Depends(get_session),
):
    """Initiate verification for a business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.initiate_verification(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            reason=payload.reason,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error initiating verification: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{business_id}/approve-verification", response_model=BusinessResponse)
def approve_verification(
    request: Request,
    business_id: str,
    payload: ApproveVerificationRequest,
    db: Session = Depends(get_session),
):
    """Approve business verification."""
    try:
        tenant_id = request.state.tenant_id
        
        business = BusinessService.approve_verification(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            approved_by=payload.approved_by,
            reason=payload.reason,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error approving verification: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{business_id}/reject-verification", response_model=BusinessResponse)
def reject_verification(
    request: Request,
    business_id: str,
    payload: RejectVerificationRequest,
    db: Session = Depends(get_session),
):
    """Reject business verification."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.reject_verification(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            rejected_by=keycloak_id,
            reason=payload.reason,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error rejecting verification: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{business_id}/suspend", response_model=BusinessResponse)
def suspend_business(
    request: Request,
    business_id: str,
    reason: str,
    db: Session = Depends(get_session),
):
    """Suspend a business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.suspend_business(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            suspended_by=keycloak_id,
            reason=reason,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error suspending business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{business_id}/activate", response_model=BusinessResponse)
def activate_business(
    request: Request,
    business_id: str,
    db: Session = Depends(get_session),
):
    """Activate a suspended business."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.activate_business(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            activated_by=keycloak_id,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error activating business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{business_id}/settings")
def update_settings(
    request: Request,
    business_id: str,
    settings: dict,
    db: Session = Depends(get_session),
):
    """Update business settings."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.update_settings(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            settings=settings,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error updating settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{business_id}/metadata")
def update_metadata(
    request: Request,
    business_id: str,
    metadata: dict,
    db: Session = Depends(get_session),
):
    """Update business metadata."""
    try:
        tenant_id = request.state.tenant_id
        keycloak_id = request.state.keycloak_id
        
        business = BusinessService.update_metadata(
            db=db,
            business_id=business_id,
            tenant_id=tenant_id,
            keycloak_id=keycloak_id,
            metadata=metadata,
        )
        
        return business.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error updating metadata: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
