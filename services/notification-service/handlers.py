"""
Notification Service Handlers
Implements tenant-scoped support ticket management, notifications, and chatbot workflows.
"""

from datetime import datetime
import json
import os
import sys
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../shared/python'))

try:
    from services.common.lakehouse.lakehouse_publisher import LakehousePublisher
except ImportError:
    LakehousePublisher = None

from database import (
    ChatMessage,
    ChatSession,
    Notification,
    NotificationDeliveryAttempt,
    NotificationStatus,
    NotificationTemplate,
    NotificationType,
    SupportTicket,
    TicketMessage,
    TicketPriority,
    TicketStatus,
    get_db,
)

router = APIRouter()
notification_lakehouse = LakehousePublisher(service_name="notification-service", table_name="bronze.notification_service_events") if LakehousePublisher else None


def publish_lakehouse_event(event_type: str, tenant_id: str, entity_id: str, payload: dict[str, Any], user_id: Optional[str] = None, entity_type: str = "notification") -> None:
    if not notification_lakehouse:
        return
    notification_lakehouse.publish_event(
        event_type=event_type,
        payload=payload,
        tenant_id=tenant_id,
        user_id=user_id,
        entity_id=entity_id,
        entity_type=entity_type,
    )


class TicketCreate(BaseModel):
    tenant_id: str
    user_id: str
    subject: str
    description: str
    category: Optional[str] = None
    priority: TicketPriority = TicketPriority.MEDIUM
    tags: Optional[List[str]] = None


class TicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None
    assigned_to: Optional[str] = None
    resolution: Optional[str] = None


class MessageCreate(BaseModel):
    ticket_id: int
    sender_id: str
    sender_type: str
    message: str
    is_internal: bool = False


class NotificationCreate(BaseModel):
    tenant_id: str
    user_id: str
    type: NotificationType
    recipient: str
    subject: Optional[str] = None
    message: str
    template_id: Optional[str] = None
    template_data: Optional[dict] = None


class ChatSessionCreate(BaseModel):
    tenant_id: str
    user_id: str


class ChatMessageCreate(BaseModel):
    tenant_id: str
    session_id: str
    sender_id: str
    sender_type: str
    message: str


class TemplateCreate(BaseModel):
    tenant_id: str = "global"
    template_id: str = Field(min_length=3, max_length=100)
    name: str
    type: NotificationType
    subject_template: Optional[str] = None
    body_template: str
    variables: List[str] = Field(default_factory=list)


async def require_tenant(x_tenant_id: str = Header(...)) -> str:
    return x_tenant_id


def require_same_tenant(expected: str, header_value: str) -> None:
    if expected != header_value:
        raise HTTPException(status_code=403, detail="tenant mismatch")


def render_template(template_text: Optional[str], template_data: Optional[dict]) -> Optional[str]:
    if template_text is None:
        return None
    payload = template_data or {}
    rendered = template_text
    for key, value in payload.items():
        rendered = rendered.replace("{{" + key + "}}", str(value))
    return rendered


@router.get("/ready")
def readiness_probe(db: Session = Depends(get_db)):
    db.execute("SELECT 1")
    return {"status": "ready", "service": "notification-service", "checked_at": datetime.utcnow()}


@router.post("/bootstrap")
def bootstrap_notification_data(tenant_id: str, user_id: str = "seed-user", db: Session = Depends(get_db)):
    existing = db.query(SupportTicket).filter(SupportTicket.user_id == user_id, SupportTicket.tenant_id == tenant_id).count()
    created = []
    if existing == 0:
        seed_ticket = SupportTicket(
            ticket_number=f"TKT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}",
            tenant_id=tenant_id,
            user_id=user_id,
            subject="Welcome to 54link-dev support",
            description=json.dumps({"body": "Initial support workflow seeded", "tenant_id": tenant_id, "seed": True}),
            category="onboarding",
            priority=TicketPriority.LOW,
            status=TicketStatus.OPEN,
        )
        db.add(seed_ticket)
        created.append(seed_ticket.ticket_number)
    default_template = db.query(NotificationTemplate).filter(NotificationTemplate.template_id == "ticket-created", NotificationTemplate.tenant_id == tenant_id).first()
    if not default_template:
        db.add(
            NotificationTemplate(
                template_id="ticket-created",
                tenant_id=tenant_id,
                name="Ticket Created",
                type=NotificationType.EMAIL,
                subject_template="Support Ticket {{ticket_number}} Created",
                body_template="Hello {{user_id}}, your ticket {{ticket_number}} has been logged successfully.",
                variables=["ticket_number", "user_id"],
                is_active=True,
            )
        )
    db.commit()
    return {"status": "bootstrapped", "tenant_id": tenant_id, "created_tickets": created}


@router.post("/tickets", status_code=201)
def create_ticket(ticket: TicketCreate, background_tasks: BackgroundTasks, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(ticket.tenant_id, x_tenant_id)
    ticket_number = f"TKT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    payload = {"tenant_id": ticket.tenant_id, "tags": ticket.tags or []}
    db_ticket = SupportTicket(
        ticket_number=ticket_number,
        tenant_id=ticket.tenant_id,
        user_id=ticket.user_id,
        subject=ticket.subject,
        description=json.dumps({"body": ticket.description, **payload}),
        category=ticket.category,
        priority=ticket.priority,
        status=TicketStatus.OPEN,
        record_metadata=payload,
    )
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)

    background_tasks.add_task(
        queue_notification,
        NotificationCreate(
            tenant_id=ticket.tenant_id,
            user_id=ticket.user_id,
            type=NotificationType.EMAIL,
            recipient=os.getenv("DEFAULT_NOTIFICATION_RECIPIENT", "user@example.com"),
            subject=f"Support Ticket Created: {ticket_number}",
            message=f"Your support ticket has been created. Ticket Number: {ticket_number}",
        ),
    )
    background_tasks.add_task(publish_event, "ticket.created", {"ticket_id": db_ticket.id, "ticket_number": ticket_number, "user_id": ticket.user_id, "tenant_id": ticket.tenant_id})
    publish_lakehouse_event(
        "SUPPORT_TICKET_CREATED",
        ticket.tenant_id,
        ticket_number,
        {
            "ticket_id": db_ticket.id,
            "subject": ticket.subject,
            "category": ticket.category,
            "priority": ticket.priority.value,
            "status": db_ticket.status.value,
            "tags": ticket.tags or [],
        },
        user_id=ticket.user_id,
        entity_type="support_ticket",
    )

    return {"id": db_ticket.id, "ticket_number": db_ticket.ticket_number, "status": db_ticket.status, "created_at": db_ticket.created_at}


@router.get("/tickets")
def list_tickets(
    tenant_id: str,
    user_id: Optional[str] = None,
    status: Optional[TicketStatus] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = Query(50, ge=1, le=200),
    x_tenant_id: str = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    require_same_tenant(tenant_id, x_tenant_id)
    query = db.query(SupportTicket).filter(SupportTicket.tenant_id == tenant_id)
    if user_id:
        query = query.filter(SupportTicket.user_id == user_id)
    if status:
        query = query.filter(SupportTicket.status == status)
    if assigned_to:
        query = query.filter(SupportTicket.assigned_to == assigned_to)
    if search:
        like_value = f"%{search}%"
        query = query.filter((SupportTicket.subject.ilike(like_value)) | (SupportTicket.ticket_number.ilike(like_value)))

    total = query.count()
    tickets = query.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "tenant_id": tenant_id,
        "tickets": [{"id": t.id, "ticket_number": t.ticket_number, "user_id": t.user_id, "subject": t.subject, "priority": t.priority, "status": t.status, "assigned_to": t.assigned_to, "created_at": t.created_at, "updated_at": t.updated_at} for t in tickets],
        "total": total,
    }


@router.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: int, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id, SupportTicket.tenant_id == x_tenant_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "tenant_id": ticket.tenant_id,
        "user_id": ticket.user_id,
        "subject": ticket.subject,
        "description": ticket.description,
        "category": ticket.category,
        "priority": ticket.priority,
        "status": ticket.status,
        "assigned_to": ticket.assigned_to,
        "resolution": ticket.resolution,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "resolved_at": ticket.resolved_at,
        "messages": [{"id": m.id, "sender_id": m.sender_id, "sender_type": m.sender_type, "message": m.message, "is_internal": m.is_internal, "created_at": m.created_at} for m in ticket.messages],
    }


@router.put("/tickets/{ticket_id}")
def update_ticket(ticket_id: int, update: TicketUpdate, background_tasks: BackgroundTasks, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id, SupportTicket.tenant_id == x_tenant_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if update.status:
        ticket.status = update.status
        if update.status == TicketStatus.RESOLVED:
            ticket.resolved_at = datetime.utcnow()
        elif update.status == TicketStatus.CLOSED:
            ticket.closed_at = datetime.utcnow()
    if update.priority:
        ticket.priority = update.priority
    if update.assigned_to:
        ticket.assigned_to = update.assigned_to
    if update.resolution:
        ticket.resolution = update.resolution
    db.commit()
    db.refresh(ticket)
    if update.status:
        background_tasks.add_task(
            queue_notification,
            NotificationCreate(
                tenant_id=ticket.tenant_id,
                user_id=ticket.user_id,
                type=NotificationType.EMAIL,
                recipient=os.getenv("DEFAULT_NOTIFICATION_RECIPIENT", "user@example.com"),
                subject=f"Ticket {ticket.ticket_number} Status Updated",
                message=f"Your ticket status has been updated to: {update.status.value}",
            ),
        )
    publish_lakehouse_event(
        "SUPPORT_TICKET_UPDATED",
        ticket.tenant_id,
        ticket.ticket_number,
        {
            "ticket_id": ticket.id,
            "status": ticket.status.value,
            "priority": ticket.priority.value,
            "assigned_to": ticket.assigned_to,
            "resolution": ticket.resolution,
        },
        user_id=ticket.user_id,
        entity_type="support_ticket",
    )
    return {"status": "updated", "ticket_id": ticket.id}


@router.post("/tickets/{ticket_id}/messages")
def add_message(ticket_id: int, message: MessageCreate, background_tasks: BackgroundTasks, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id, SupportTicket.tenant_id == x_tenant_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db_message = TicketMessage(ticket_id=ticket_id, sender_id=message.sender_id, sender_type=message.sender_type, message=message.message, is_internal=message.is_internal)
    db.add(db_message)
    if message.sender_type == "customer" and ticket.status == TicketStatus.WAITING_FOR_CUSTOMER:
        ticket.status = TicketStatus.IN_PROGRESS
    db.commit()
    db.refresh(db_message)

    if not message.is_internal:
        recipient_user = ticket.assigned_to if message.sender_type == "customer" and ticket.assigned_to else ticket.user_id
        background_tasks.add_task(
            queue_notification,
            NotificationCreate(
                tenant_id=ticket.tenant_id,
                user_id=recipient_user,
                type=NotificationType.EMAIL,
                recipient=os.getenv("DEFAULT_NOTIFICATION_RECIPIENT", "user@example.com"),
                subject=f"New message on ticket {ticket.ticket_number}",
                message=message.message[:200],
            ),
        )
    publish_lakehouse_event(
        "SUPPORT_TICKET_MESSAGE_ADDED",
        ticket.tenant_id,
        ticket.ticket_number,
        {
            "ticket_id": ticket.id,
            "message_id": db_message.id,
            "sender_id": message.sender_id,
            "sender_type": message.sender_type,
            "is_internal": message.is_internal,
        },
        user_id=message.sender_id,
        entity_type="support_ticket",
    )
    return {"message_id": db_message.id, "created_at": db_message.created_at}


@router.post("/notifications")
def create_notification(notification: NotificationCreate, background_tasks: BackgroundTasks, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(notification.tenant_id, x_tenant_id)
    notification_id = f"NTF-{uuid.uuid4().hex[:18].upper()}"
    template = None
    rendered_subject = notification.subject
    rendered_body = notification.message
    if notification.template_id:
        template = db.query(NotificationTemplate).filter(NotificationTemplate.template_id == notification.template_id, NotificationTemplate.tenant_id.in_([notification.tenant_id, "global"]), NotificationTemplate.is_active == True).order_by(NotificationTemplate.tenant_id.desc()).first()
        if template:
            rendered_subject = render_template(template.subject_template, notification.template_data) or rendered_subject
            rendered_body = render_template(template.body_template, notification.template_data) or rendered_body
    db_notification = Notification(
        notification_id=notification_id,
        tenant_id=notification.tenant_id,
        user_id=notification.user_id,
        type=notification.type,
        channel=notification.type.value,
        recipient=notification.recipient,
        subject=rendered_subject,
        message=rendered_body,
        template_id=notification.template_id,
        template_data=notification.template_data,
        status=NotificationStatus.PENDING,
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    publish_lakehouse_event(
        "NOTIFICATION_QUEUED",
        notification.tenant_id,
        db_notification.notification_id,
        {
            "type": notification.type.value,
            "channel": db_notification.channel,
            "recipient": notification.recipient,
            "template_id": notification.template_id,
            "status": db_notification.status.value,
        },
        user_id=notification.user_id,
        entity_type="notification",
    )
    background_tasks.add_task(process_notification, db_notification.id)
    return {"notification_id": db_notification.notification_id, "status": "queued", "tenant_id": notification.tenant_id}


@router.get("/notifications/{user_id}")
def get_user_notifications(user_id: str, tenant_id: str, skip: int = 0, limit: int = 50, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(tenant_id, x_tenant_id)
    notifications = db.query(Notification).filter(Notification.user_id == user_id, Notification.tenant_id == tenant_id).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    return {"tenant_id": tenant_id, "notifications": [{"id": n.notification_id, "type": n.type, "subject": n.subject, "message": n.message, "status": n.status, "sent_at": n.sent_at, "created_at": n.created_at} for n in notifications]}


@router.post("/templates", status_code=201)
def create_template(payload: TemplateCreate, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    if payload.tenant_id != "global":
        require_same_tenant(payload.tenant_id, x_tenant_id)
    existing = db.query(NotificationTemplate).filter(NotificationTemplate.template_id == payload.template_id, NotificationTemplate.tenant_id == payload.tenant_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Template already exists")
    template = NotificationTemplate(
        template_id=payload.template_id,
        tenant_id=payload.tenant_id,
        name=payload.name,
        type=payload.type,
        subject_template=payload.subject_template,
        body_template=payload.body_template,
        variables=payload.variables,
        is_active=True,
    )
    db.add(template)
    db.commit()
    return {"status": "created", "template_id": payload.template_id, "tenant_id": payload.tenant_id}


@router.get("/templates")
def list_templates(tenant_id: str, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(tenant_id, x_tenant_id)
    templates = db.query(NotificationTemplate).filter(NotificationTemplate.tenant_id.in_([tenant_id, "global"]), NotificationTemplate.is_active == True).order_by(NotificationTemplate.tenant_id.desc(), NotificationTemplate.updated_at.desc()).all()
    return {"tenant_id": tenant_id, "templates": [{"template_id": t.template_id, "scope": t.tenant_id, "name": t.name, "type": t.type, "variables": t.variables} for t in templates]}


@router.post("/chat/sessions")
def create_chat_session(payload: ChatSessionCreate, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(payload.tenant_id, x_tenant_id)
    session_id = f"CHAT-{uuid.uuid4().hex[:16].upper()}"
    db_session = ChatSession(session_id=session_id, tenant_id=payload.tenant_id, user_id=payload.user_id, is_active=True, bot_handled=True)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    publish_lakehouse_event(
        "CHAT_SESSION_STARTED",
        payload.tenant_id,
        session_id,
        {
            "user_id": payload.user_id,
            "is_active": db_session.is_active,
            "bot_handled": db_session.bot_handled,
        },
        user_id=payload.user_id,
        entity_type="chat_session",
    )
    return {"session_id": session_id, "tenant_id": payload.tenant_id, "started_at": db_session.started_at}


@router.post("/chat/messages")
def send_chat_message(message: ChatMessageCreate, background_tasks: BackgroundTasks, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(message.tenant_id, x_tenant_id)
    session = db.query(ChatSession).filter(ChatSession.session_id == message.session_id, ChatSession.tenant_id == message.tenant_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    db_message = ChatMessage(session_id=session.id, sender_id=message.sender_id, sender_type=message.sender_type, message=message.message)
    db.add(db_message)
    db.commit()
    bot_response = generate_bot_response(message.message)
    bot_message = ChatMessage(session_id=session.id, sender_id="bot", sender_type="bot", message=bot_response["message"], intent=bot_response.get("intent"), confidence=bot_response.get("confidence"))
    db.add(bot_message)
    db.commit()

    if bot_response.get("escalate", False):
        session.escalated_to_agent = True
        session.escalated_at = datetime.utcnow()
        db.commit()
        background_tasks.add_task(create_ticket_from_chat, session.id)

    publish_lakehouse_event(
        "CHAT_MESSAGE_PROCESSED",
        message.tenant_id,
        message.session_id,
        {
            "user_message_id": db_message.id,
            "bot_message_id": bot_message.id,
            "intent": bot_response.get("intent"),
            "confidence": bot_response.get("confidence"),
            "escalated": bot_response.get("escalate", False),
        },
        user_id=message.sender_id,
        entity_type="chat_session",
    )
    return {"user_message_id": db_message.id, "bot_response": bot_response["message"], "escalated": bot_response.get("escalate", False)}


@router.get("/chat/sessions/{session_id}")
def get_chat_history(session_id: str, tenant_id: str, x_tenant_id: str = Depends(require_tenant), db: Session = Depends(get_db)):
    require_same_tenant(tenant_id, x_tenant_id)
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id, ChatSession.tenant_id == tenant_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return {"session_id": session.session_id, "tenant_id": session.tenant_id, "user_id": session.user_id, "started_at": session.started_at, "is_active": session.is_active, "escalated": session.escalated_to_agent, "messages": [{"sender_type": m.sender_type, "message": m.message, "created_at": m.created_at} for m in session.messages]}


def queue_notification(notification: NotificationCreate):
    from database import SessionLocal

    db = SessionLocal()
    try:
        notification_id = f"NTF-{uuid.uuid4().hex[:18].upper()}"
        db_notification = Notification(
            notification_id=notification_id,
            tenant_id=notification.tenant_id,
            user_id=notification.user_id,
            type=notification.type,
            channel=notification.type.value,
            recipient=notification.recipient,
            subject=notification.subject,
            message=notification.message,
            status=NotificationStatus.PENDING,
        )
        db.add(db_notification)
        db.commit()
        process_notification(db_notification.id)
    finally:
        db.close()


def process_notification(notification_row_id: int):
    from database import SessionLocal

    db = SessionLocal()
    try:
        notification = db.query(Notification).filter(Notification.id == notification_row_id).first()
        if not notification:
            return
        try:
            if notification.type == NotificationType.EMAIL:
                send_email(notification.recipient, notification.subject or "54link-dev notification", notification.message)
            elif notification.type == NotificationType.SMS:
                send_sms(notification.recipient, notification.message)
            notification.status = NotificationStatus.SENT
            notification.sent_at = datetime.utcnow()
            db.add(NotificationDeliveryAttempt(notification_id=notification.id, channel=notification.channel, status="sent", provider_response={"provider": notification.channel}))
            publish_lakehouse_event(
                "NOTIFICATION_SENT",
                notification.tenant_id,
                notification.notification_id,
                {
                    "channel": notification.channel,
                    "recipient": notification.recipient,
                    "status": notification.status.value,
                },
                user_id=notification.user_id,
                entity_type="notification",
            )
        except Exception as exc:
            notification.status = NotificationStatus.FAILED
            notification.failed_reason = str(exc)
            notification.retry_count += 1
            db.add(NotificationDeliveryAttempt(notification_id=notification.id, channel=notification.channel, status="failed", provider_response={"error": str(exc)}))
            publish_lakehouse_event(
                "NOTIFICATION_FAILED",
                notification.tenant_id,
                notification.notification_id,
                {
                    "channel": notification.channel,
                    "recipient": notification.recipient,
                    "status": notification.status.value,
                    "error": str(exc),
                    "retry_count": notification.retry_count,
                },
                user_id=notification.user_id,
                entity_type="notification",
            )
        db.commit()
    finally:
        db.close()


def send_email(recipient: str, subject: str, body: str):
    smtp_user = os.getenv("SMTP_USER", "noreply@54link-dev.example")
    msg = MIMEMultipart()
    msg["From"] = smtp_user
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    print(f"Email queued for {recipient}: {subject}")


def send_sms(phone: str, message: str):
    print(f"SMS queued for {phone}: {message}")


def publish_event(event_type: str, data: dict):
    print(f"Event published: {event_type} - {data}")


def generate_bot_response(message: str) -> dict:
    message_lower = message.lower()
    if "balance" in message_lower or "account" in message_lower:
        return {"message": "I can help you check your account balance. Please provide your account number.", "intent": "check_balance", "confidence": 85}
    if "transfer" in message_lower or "send money" in message_lower:
        return {"message": "I can help you transfer money. How much would you like to send?", "intent": "transfer_money", "confidence": 90}
    if "loan" in message_lower:
        return {"message": "I can help you apply for a loan. What type of loan are you interested in?", "intent": "loan_application", "confidence": 88}
    if "help" in message_lower or "support" in message_lower or "agent" in message_lower or "complaint" in message_lower:
        return {"message": "I'm connecting you with a human agent. Please wait a moment.", "intent": "escalate", "confidence": 95, "escalate": True}
    return {"message": "I'm here to help. You can ask about balances, transfers, loans, cards, or request an agent.", "intent": "general_help", "confidence": 70}


def create_ticket_from_chat(session_row_id: int):
    from database import SessionLocal

    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_row_id).first()
        if not session:
            return
        messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_row_id).all()
        chat_transcript = "\n".join([f"{m.sender_type}: {m.message}" for m in messages])
        ticket_number = f"TKT-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        ticket = SupportTicket(
            ticket_number=ticket_number,
            tenant_id=session.tenant_id,
            user_id=session.user_id,
            subject="Escalated from chat",
            description=json.dumps({"body": f"Chat transcript:\n\n{chat_transcript}", "source": "chat_escalation"}),
            category="chat_escalation",
            priority=TicketPriority.HIGH,
            status=TicketStatus.OPEN,
        )
        db.add(ticket)
        db.commit()
        publish_lakehouse_event(
            "CHAT_ESCALATED_TO_TICKET",
            session.tenant_id,
            ticket_number,
            {
                "session_id": session.session_id,
                "user_id": session.user_id,
                "priority": TicketPriority.HIGH.value,
                "source": "chat_escalation",
            },
            user_id=session.user_id,
            entity_type="support_ticket",
        )
    finally:
        db.close()
