from database import Base
from .mixins import TimestampMixin, SoftDeleteMixin

from sqlalchemy import Integer, String
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

class Event(Base, SerializerMixin, TimestampMixin, SoftDeleteMixin):
    """Event Model Definition"""

    __tablename__ = "platform_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    raw: Mapped[dict] = mapped_column(JSONB, nullable=False)

    def __repr__(self):
        return f"<Topic: {self.topic}, Raw: {self.raw}>"
    