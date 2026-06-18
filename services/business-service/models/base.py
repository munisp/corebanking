"""Database models and base model definitions."""
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, func, String
from sqlalchemy.orm import declarative_base, Mapped, mapped_column

Base = declarative_base()


class TimestampMixin:
    """Mixin for adding timestamp columns."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    def soft_delete(self):
        """Mark as deleted without removing from database."""
        self.deleted_at = datetime.utcnow()

    def restore(self):
        """Restore a soft-deleted record."""
        self.deleted_at = None
