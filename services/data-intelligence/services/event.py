from repositories import EventRepository
from sqlalchemy.orm import Session


class EventService:
    def __init__(self, db: Session):
        self._event_repo = EventRepository(db)

    def get_event_by_id(self, event_id, tenant_id: str):
        return self._event_repo.get_event_by_id(event_id, tenant_id)

    def create_event(self, topic: str = "default", raw: dict = {}):
        return self._event_repo.create_event(topic=topic, raw=raw)

    def update_event(self, event_id, update_data, tenant_id: str):
        return self._event_repo.update_event(event_id, update_data, tenant_id)

    def delete_event(self, event_id, tenant_id: str):
        return self._event_repo.delete_event(event_id, tenant_id)
