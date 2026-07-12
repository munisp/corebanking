"""
Notification Service Database Schema
Handles support tickets, notifications, chat sessions, templates, and delivery audit trails.
"""

from datetime import datetime
import enum
import os

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class TicketStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    WAITING_FOR_CUSTOMER = "waiting_for_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


class TicketPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationType(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    DELIVERED = "delivered"


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(String(50), unique=True, index=True, nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False)
    user_id = Column(String(100), index=True, nullable=False)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), index=True)
    priority = Column(Enum(TicketPriority), default=TicketPriority.MEDIUM, nullable=False)
    status = Column(Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False, index=True)
    assigned_to = Column(String(100), index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)
    resolution = Column(Text)
    record_metadata = Column("metadata", JSON)

    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")
    attachments = relationship("TicketAttachment", back_populates="ticket", cascade="all, delete-orphan")


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False, index=True)
    sender_id = Column(String(100), nullable=False)
    sender_type = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship("SupportTicket", back_populates="messages")


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer)
    mime_type = Column(String(100))
    uploaded_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship("SupportTicket", back_populates="attachments")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(String(100), unique=True, index=True, nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False)
    user_id = Column(String(100), index=True, nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    channel = Column(String(50), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255))
    message = Column(Text, nullable=False)
    template_id = Column(String(100))
    template_data = Column(JSON)
    status = Column(Enum(NotificationStatus), default=NotificationStatus.PENDING, nullable=False, index=True)
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    failed_reason = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    record_metadata = Column("metadata", JSON)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    delivery_attempts = relationship("NotificationDeliveryAttempt", back_populates="notification", cascade="all, delete-orphan")


class NotificationDeliveryAttempt(Base):
    __tablename__ = "notification_delivery_attempts"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False, index=True)
    channel = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    provider_response = Column(JSON)
    attempted_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    notification = relationship("Notification", back_populates="delivery_attempts")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True, nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False)
    user_id = Column(String(100), index=True, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime)
    is_active = Column(Boolean, default=True, index=True)
    bot_handled = Column(Boolean, default=True)
    escalated_to_agent = Column(Boolean, default=False)
    agent_id = Column(String(100))
    escalated_at = Column(DateTime)
    record_metadata = Column("metadata", JSON)

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    sender_id = Column(String(100), nullable=False)
    sender_type = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    intent = Column(String(100))
    confidence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(String(100), unique=True, index=True, nullable=False)
    tenant_id = Column(String(100), index=True, nullable=False, default="global")
    name = Column(String(255), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    subject_template = Column(String(255))
    body_template = Column(Text, nullable=False)
    variables = Column(JSON)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}"
    f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'notification_db')}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
