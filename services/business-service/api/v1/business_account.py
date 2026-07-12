"""Business accounts API routes."""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from database import get_session
from schemas import (
    AssociateAccountRequest,
    BusinessAccountResponse,
    BusinessAccountsListResponse,
)
from services import BusinessAccountService
from utils import BusinessServiceException, BusinessNotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/business/{business_id}/accounts", tags=["business-accounts"])


@router.post("", response_model=BusinessAccountResponse, status_code=201)
def associate_account(
    request: Request,
    business_id: str,
    payload: AssociateAccountRequest,
    db: Session = Depends(get_session),
):
    """Associate an account with a business."""
    try:
        keycloak_id = request.state.keycloak_id
        
        business_account = BusinessAccountService.associate_account(
            db=db,
            business_id=business_id,
            account_id=payload.account_id,
            account_purpose=payload.account_purpose,
            is_primary=payload.is_primary,
            associated_by=keycloak_id,
        )
        
        return business_account.to_dict()
    
    except BusinessServiceException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Error associating account: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("", response_model=BusinessAccountsListResponse)
def list_business_accounts(
    request: Request,
    business_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_session),
):
    """List accounts for a business."""
    try:
        accounts = BusinessAccountService.list_business_accounts(
            db=db,
            business_id=business_id,
            skip=skip,
            limit=limit,
        )
        
        return {
            "business_id": business_id,
            "total": len(accounts),
            "accounts": [a.to_dict() for a in accounts],
        }
    
    except Exception as e:
        logger.error(f"Error listing business accounts: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/{account_id}", response_model=BusinessAccountResponse)
def disassociate_account(
    request: Request,
    business_id: str,
    account_id: str,
    db: Session = Depends(get_session),
):
    """Disassociate an account from a business."""
    try:
        keycloak_id = request.state.keycloak_id
        
        business_account = BusinessAccountService.disassociate_account(
            db=db,
            business_id=business_id,
            account_id=account_id,
            disassociated_by=keycloak_id,
        )
        
        return business_account.to_dict()
    
    except BusinessNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error disassociating account: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/{account_id}/primary")
def set_primary_account(
    request: Request,
    business_id: str,
    account_id: str,
    db: Session = Depends(get_session),
):
    """Set an account as primary for a business."""
    try:
        keycloak_id = request.state.keycloak_id
        
        success = BusinessAccountService.set_primary_account(
            db=db,
            business_id=business_id,
            account_id=account_id,
            set_by=keycloak_id,
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Account not found")
        
        return {"message": "Account set as primary", "account_id": account_id}
    
    except Exception as e:
        logger.error(f"Error setting primary account: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
