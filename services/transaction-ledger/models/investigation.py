import uuid
import enum
from database import Base
from .mixins import TimestampMixin, SoftDeleteMixin

from sqlalchemy import String, Enum, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy_serializer import SerializerMixin
from sqlalchemy.orm import Mapped, mapped_column


class InvestigationStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class InvestigationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class InvestigationType(str, enum.Enum):
    DISPUTE = "dispute"
    FRAUD = "fraud"
    COMPLIANCE = "compliance"
    AML = "aml"
    OTHER = "other"


class Investigation(Base, SerializerMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "payment_investigation"

    __table_args__ = (
        Index("ix_investigation_tenant_status", "tenant_id", "status"),
        Index("ix_investigation_transaction", "transaction_id", "tenant_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    transaction_id: Mapped[str] = mapped_column(String(128), nullable=True)
    status: Mapped[InvestigationStatus] = mapped_column(
        Enum(InvestigationStatus), nullable=False, default=InvestigationStatus.OPEN
    )
    type: Mapped[InvestigationType] = mapped_column(
        Enum(InvestigationType), nullable=False, default=InvestigationType.OTHER
    )
    priority: Mapped[InvestigationPriority] = mapped_column(
        Enum(InvestigationPriority), nullable=False, default=InvestigationPriority.MEDIUM
    )
    description: Mapped[str] = mapped_column(Text, nullable=True)
    resolution_notes: Mapped[str] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[str] = mapped_column(String(256), nullable=True)
    reported_by: Mapped[str] = mapped_column(String(256), nullable=True)
    tenant_id: Mapped[str] = mapped_column(String(128), nullable=False)
