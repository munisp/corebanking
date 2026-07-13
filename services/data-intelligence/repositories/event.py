from models import Event
from sqlalchemy.orm import Session

class EventRepository:
    def __init__(self, db: Session):
        self.__db = db

    def get_event_by_id(self, event_id, tenant_id: str):
        return self.__db.query(Event).filter(Event.id == event_id, Event.tenant_id == tenant_id).first()

    def create_event(self, topic: str = "default", raw: dict = {}, tenant_id: str = ""):
        new_event = Event(
            topic=topic,
            raw=raw,
            tenant_id=tenant_id
        )
        self.__db.add(new_event)
        self.__db.commit()
        return new_event

    def update_event(self, event_id, update_data, tenant_id: str):
        event = self.get_event_by_id(event_id, tenant_id)
        if event:
            for key, value in update_data.items():
                setattr(event, key, value)
            self.__db.commit()
        return event

    def delete_event(self, event_id, tenant_id: str):
        event = self.get_event_by_id(event_id, tenant_id)
        if event:
            self.__db.delete(event)
            self.__db.commit()
        return event
    