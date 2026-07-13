from fastapi import APIRouter, Header, Depends
from sqlalchemy.orm import Session
from database import get_session
from services import EventService

event_router = APIRouter()

@event_router.post("")
def post_event(
    payload: dict,
    db: Session = Depends(get_session),
    tenant_id: str = Header(..., alias="x-tenant-id")
):
    """Post event route handler."""
    event_service = EventService(db)
    event = event_service.create_event(topic=payload.get("topic", "default"), raw=payload, tenant_id=tenant_id)
    return {"event_id": event.id, "topic": event.topic, "raw": event.raw}
