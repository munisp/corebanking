from fastapi import APIRouter, Depends, HTTPException, responses, Header, Query
from sqlalchemy.orm import Session
from database import get_session
from utils import create_logger
from services import InvestigationService
from schemas import Context, Pagination

investigation_router = APIRouter()
logger = create_logger(__name__)


@investigation_router.get("/")
def list_investigations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    context = Context(tenant_id=tenant_id)
    pagination = Pagination(limit=limit, page=page)
    try:
        svc = InvestigationService(db)
        investigations = svc.list_investigations(context, pagination)
        total = svc.count_investigations(context)
        return responses.JSONResponse(
            content={
                "message": "success",
                "investigations": [i.to_dict() for i in investigations],
                "total": total,
                "page": page,
                "limit": limit,
            },
            status_code=200,
        )
    except Exception as e:
        logger.error(f"list_investigations error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch investigations.")


@investigation_router.get("/{investigation_id}")
def get_investigation(
    investigation_id: str,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    context = Context(tenant_id=tenant_id)
    try:
        inv = InvestigationService(db).get_investigation(investigation_id, context)
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found.")
        return responses.JSONResponse(
            content={"message": "success", "investigation": inv.to_dict()},
            status_code=200,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_investigation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch investigation.")


@investigation_router.post("/")
def create_investigation(
    body: dict,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    context = Context(tenant_id=tenant_id)
    try:
        inv = InvestigationService(db).create_investigation(body, context)
        return responses.JSONResponse(
            content={"message": "success", "investigation": inv.to_dict()},
            status_code=201,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"create_investigation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create investigation.")


@investigation_router.put("/{investigation_id}")
def update_investigation(
    investigation_id: str,
    body: dict,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id"),
):
    context = Context(tenant_id=tenant_id)
    try:
        inv = InvestigationService(db).update_investigation(investigation_id, body, context)
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found.")
        return responses.JSONResponse(
            content={"message": "success", "investigation": inv.to_dict()},
            status_code=200,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"update_investigation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update investigation.")
