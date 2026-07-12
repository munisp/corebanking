"""Business users API routes."""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_session
from schemas import (
    AddBusinessUserRequest,
    BusinessUserResponse,
    BusinessUsersListResponse,
)
from services import BusinessUserService
from utils import BusinessServiceException, BusinessNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/business/{business_id}/users", tags=["business-users"])


@router.post("", response_model=BusinessUserResponse, status_code=201)
def add_user_to_business(
    request: Request,
    business_id: str,
    payload: AddBusinessUserRequest,
    db: Session = Depends(get_session),
):
    """Add a user to a business."""
    try:
        business_user = BusinessUserService.add_user_to_business(
            db=db,
            business_id=business_id,
            keycloak_id=payload.keycloak_id,
            role=payload.role,
            permissions=payload.permissions,
        )
        
        return business_user.to_dict()
    
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error adding user to business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=BusinessUsersListResponse)
def list_business_users(
    request: Request,
    business_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_session),
):
    """List users for a business."""
    try:
        users = BusinessUserService.list_business_users(
            db=db,
            business_id=business_id,
            skip=skip,
            limit=limit,
        )
        
        return {
            "business_id": business_id,
            "total": len(users),
            "users": [u.to_dict() for u in users],
        }
    
    except Exception as e:
        logger.error(f"Error listing business users: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/{user_id}", response_model=BusinessUserResponse)
def update_user_role(
    request: Request,
    business_id: str,
    user_id: str,
    role: str,
    permissions: dict = None,
    db: Session = Depends(get_session),
):
    """Update a business user's role."""
    try:
        keycloak_id = request.state.keycloak_id
        
        business_user = BusinessUserService.update_user_role(
            db=db,
            user_id=user_id,
            business_id=business_id,
            role=role,
            permissions=permissions,
            updated_by=keycloak_id,
        )
        
        return business_user.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error updating user role: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{user_id}", response_model=BusinessUserResponse)
def remove_user_from_business(
    request: Request,
    business_id: str,
    user_id: str,
    db: Session = Depends(get_session),
):
    """Remove a user from a business."""
    try:
        keycloak_id = request.state.keycloak_id
        
        business_user = BusinessUserService.remove_user_from_business(
            db=db,
            user_id=user_id,
            business_id=business_id,
            removed_by=keycloak_id,
        )
        
        return business_user.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error removing user from business: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
