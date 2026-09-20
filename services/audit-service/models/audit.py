import uuid
import datetime
from database import Base
from .mixins import TimestampMixin, SoftDeleteMixin

from sqlalchemy import String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.orm import Mapped, mapped_column

class Audit(Base, SerializerMixin, TimestampMixin, SoftDeleteMixin):
    """Audit Model Definition"""

    __tablename__ = "audit"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    actor_id: Mapped[str] = mapped_column(String, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    event_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    timestamp: Mapped[datetime.datetime] = mapped_column(TIMESTAMP, nullable=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)

    # AU-03: tamper-evidence hash chain. entry_hash =
    # sha256((prev_hash or "") + canonical(entry)); the chain is scoped per
    # tenant and ordered by (created_at, id). Genesis rows carry prev_hash NULL.
    # Nullable so the migration is expand-only; database/migrations.py backfills
    # historical rows.
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entry_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    # PL-10: derived "YYYY-MM" retention bucket (set at insert, backfilled by
    # database/migrations.py) used by the archival job and indexed per tenant.
    created_month: Mapped[str | None] = mapped_column(
        String(7), nullable=True, index=True
    )

    def __repr__(self):
        return f"<Audit(id={self.id}), actor={self.actor_id}, type={self.event_type})>"
    