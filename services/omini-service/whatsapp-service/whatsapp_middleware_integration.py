"""
WhatsApp Service Middleware Integration
Full integration with Kafka, Dapr, Fluvio, Temporal, Keycloak, Permify, Redis, APISIX, TigerBeetle, Lakehouse
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict

import aiohttp
import redis.asyncio as redis
from aiokafka import AIOKafkaProducer
from prometheus_client import Counter, Histogram, Gauge

logger = logging.getLogger(__name__)

whatsapp_messages_total = Counter(
    'whatsapp_messages_total',
    'Total WhatsApp messages processed',
    ['direction', 'type', 'status']
)

whatsapp_response_time = Histogram(
    'whatsapp_response_time_seconds',
    'WhatsApp response time',
    ['operation']
)

whatsapp_active_conversations = Gauge(
    'whatsapp_active_conversations',
    'Number of active WhatsApp conversations'
)


@dataclass
class WhatsAppMessage:
    message_id: str
    tenant_id: str
    from_number: str
    to_number: str
    message_type: str
    content: str
    timestamp: datetime
    status: str
    metadata: Dict[str, Any] = None
    customer_id: str = None
    conversation_id: str = None


@dataclass
class WhatsAppConversation:
    conversation_id: str
    tenant_id: str
    customer_id: str
    phone_number: str
    state: str
    context: Dict[str, Any]
    created_at: datetime
    last_activity: datetime
    is_active: bool = True


class WhatsAppMiddlewareIntegration:
    """Full middleware integration for WhatsApp service"""
    
    def __init__(
        self,
        redis_url: str,
        kafka_brokers: str,
        keycloak_url: str,
        permify_url: str,
        lakehouse_url: str,
        fluvio_url: str,
        temporal_host: str,
        dapr_url: str,
        tigerbeetle_url: str,
        tenant_id: str = "default"
    ):
        self.redis_url = redis_url
        self.kafka_brokers = kafka_brokers
        self.keycloak_url = keycloak_url
        self.permify_url = permify_url
        self.lakehouse_url = lakehouse_url
        self.fluvio_url = fluvio_url
        self.temporal_host = temporal_host
        self.dapr_url = dapr_url
        self.tigerbeetle_url = tigerbeetle_url
        self.tenant_id = tenant_id
        
        self.redis_client: Optional[redis.Redis] = None
        self.kafka_producer: Optional[AIOKafkaProducer] = None
        self.http_session: Optional[aiohttp.ClientSession] = None
    
    async def initialize(self):
        """Initialize all middleware connections"""
        self.redis_client = await redis.from_url(
            self.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        
        self.kafka_producer = AIOKafkaProducer(
            bootstrap_servers=self.kafka_brokers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        await self.kafka_producer.start()
        
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        
        logger.info("WhatsApp middleware integration initialized")
    
    async def close(self):
        """Close all middleware connections"""
        if self.redis_client:
            await self.redis_client.close()
        if self.kafka_producer:
            await self.kafka_producer.stop()
        if self.http_session:
            await self.http_session.close()
    
    async def publish_message_event(self, event_type: str, message: WhatsAppMessage):
        """Publish message event to Kafka"""
        event = {
            "event_type": event_type,
            "message_id": message.message_id,
            "tenant_id": message.tenant_id,
            "from_number": message.from_number,
            "to_number": message.to_number,
            "message_type": message.message_type,
            "status": message.status,
            "timestamp": datetime.utcnow().isoformat(),
            "channel": "whatsapp"
        }
        
        await self.kafka_producer.send("whatsapp.messages", event)
        
        await self.publish_to_dapr("whatsapp-pubsub", "whatsapp.messages", event)
    
    async def publish_transaction_event(self, event_type: str, data: Dict[str, Any]):
        """Publish transaction event to Kafka"""
        data["event_type"] = event_type
        data["tenant_id"] = self.tenant_id
        data["timestamp"] = datetime.utcnow().isoformat()
        data["channel"] = "whatsapp"
        
        await self.kafka_producer.send("whatsapp.transactions", data)
    
    async def save_conversation(self, conversation: WhatsAppConversation):
        """Save conversation to Redis"""
        key = f"whatsapp:conversation:{conversation.conversation_id}"
        data = {
            "conversation_id": conversation.conversation_id,
            "tenant_id": conversation.tenant_id,
            "customer_id": conversation.customer_id,
            "phone_number": conversation.phone_number,
            "state": conversation.state,
            "context": json.dumps(conversation.context),
            "created_at": conversation.created_at.isoformat(),
            "last_activity": conversation.last_activity.isoformat(),
            "is_active": conversation.is_active
        }
        
        await self.redis_client.hset(key, mapping=data)
        await self.redis_client.expire(key, 86400)  # 24 hours
        
        if conversation.is_active:
            whatsapp_active_conversations.inc()
    
    async def get_conversation(self, conversation_id: str) -> Optional[WhatsAppConversation]:
        """Get conversation from Redis"""
        key = f"whatsapp:conversation:{conversation_id}"
        data = await self.redis_client.hgetall(key)
        
        if not data:
            return None
        
        return WhatsAppConversation(
            conversation_id=data["conversation_id"],
            tenant_id=data["tenant_id"],
            customer_id=data["customer_id"],
            phone_number=data["phone_number"],
            state=data["state"],
            context=json.loads(data["context"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            last_activity=datetime.fromisoformat(data["last_activity"]),
            is_active=data["is_active"] == "True"
        )
    
    async def get_conversation_by_phone(self, phone_number: str) -> Optional[WhatsAppConversation]:
        """Get active conversation by phone number"""
        key = f"whatsapp:phone_conversation:{phone_number}"
        conversation_id = await self.redis_client.get(key)
        
        if conversation_id:
            return await self.get_conversation(conversation_id)
        
        return None
    
    async def end_conversation(self, conversation_id: str):
        """End a conversation"""
        conversation = await self.get_conversation(conversation_id)
        if conversation:
            conversation.is_active = False
            await self.save_conversation(conversation)
            
            phone_key = f"whatsapp:phone_conversation:{conversation.phone_number}"
            await self.redis_client.delete(phone_key)
            
            whatsapp_active_conversations.dec()
            
            await self.publish_message_event("conversation.ended", WhatsAppMessage(
                message_id=f"conv_end_{conversation_id}",
                tenant_id=conversation.tenant_id,
                from_number=conversation.phone_number,
                to_number="",
                message_type="system",
                content="Conversation ended",
                timestamp=datetime.utcnow(),
                status="completed",
                customer_id=conversation.customer_id,
                conversation_id=conversation_id
            ))
    
    async def check_rate_limit(self, phone_number: str, limit: int = 100, window_seconds: int = 60) -> bool:
        """Check rate limit for a phone number"""
        key = f"whatsapp:ratelimit:{phone_number}"
        
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
        
        count = results[0]
        return count <= limit
    
    async def record_to_lakehouse(self, event_type: str, data: Dict[str, Any]):
        """Record event to Lakehouse via Kafka"""
        data["event_type"] = event_type
        data["tenant_id"] = self.tenant_id
        data["channel"] = "whatsapp"
        data["timestamp"] = datetime.utcnow().isoformat()
        
        await self.kafka_producer.send("lakehouse.whatsapp.events", data)
    
    async def validate_token_with_keycloak(self, token: str) -> tuple[bool, Dict[str, Any]]:
        """Validate token with Keycloak"""
        url = f"{self.keycloak_url}/realms/54link-dev/protocol/openid-connect/token/introspect"
        
        data = {
            "token": token,
            "client_id": "whatsapp-service",
            "client_secret": "whatsapp-secret"
        }
        
        async with self.http_session.post(url, data=data) as resp:
            result = await resp.json()
            active = result.get("active", False)
            return active, result
    
    async def check_permission_with_permify(
        self,
        subject_id: str,
        permission: str,
        object_type: str,
        object_id: str
    ) -> bool:
        """Check permission with Permify"""
        url = f"{self.permify_url}/v1/tenants/{self.tenant_id}/permissions/check"
        
        payload = {
            "metadata": {"depth": 20},
            "entity": {"type": object_type, "id": object_id},
            "permission": permission,
            "subject": {"type": "user", "id": subject_id}
        }
        
        async with self.http_session.post(url, json=payload) as resp:
            result = await resp.json()
            return result.get("can") == "CHECK_RESULT_ALLOWED"
    
    async def publish_to_dapr(self, pubsub_name: str, topic: str, data: Any):
        """Publish event via Dapr"""
        url = f"{self.dapr_url}/v1.0/publish/{pubsub_name}/{topic}"
        
        try:
            async with self.http_session.post(url, json=data) as resp:
                if resp.status >= 400:
                    logger.error(f"Dapr publish failed: {resp.status}")
        except Exception as e:
            logger.error(f"Dapr publish error: {e}")
    
    async def invoke_service_via_dapr(self, app_id: str, method: str, data: Any) -> Dict[str, Any]:
        """Invoke service via Dapr"""
        url = f"{self.dapr_url}/v1.0/invoke/{app_id}/method/{method}"
        
        async with self.http_session.post(url, json=data) as resp:
            return await resp.json()
    
    async def start_temporal_workflow(
        self,
        workflow_type: str,
        workflow_id: str,
        input_data: Any
    ) -> str:
        """Start a Temporal workflow"""
        url = f"http://{self.temporal_host}/api/v1/namespaces/default/workflows/{workflow_id}"
        
        payload = {
            "workflowType": {"name": workflow_type},
            "taskQueue": {"name": "whatsapp-tasks"},
            "input": [input_data]
        }
        
        async with self.http_session.post(url, json=payload) as resp:
            result = await resp.json()
            return result.get("runId", "")
    
    async def signal_temporal_workflow(
        self,
        workflow_id: str,
        run_id: str,
        signal_name: str,
        input_data: Any
    ):
        """Signal a Temporal workflow"""
        url = f"http://{self.temporal_host}/api/v1/namespaces/default/workflows/{workflow_id}/signal/{signal_name}"
        
        payload = {
            "runId": run_id,
            "input": [input_data]
        }
        
        async with self.http_session.post(url, json=payload) as resp:
            return resp.status < 400
    
    async def produce_to_fluvio(self, topic: str, key: str, value: Any):
        """Produce record to Fluvio"""
        url = f"http://{self.fluvio_url}/api/v1/topics/{topic}/produce"
        
        payload = {"key": key, "value": value}
        
        try:
            async with self.http_session.post(url, json=payload) as resp:
                return resp.status < 400
        except Exception as e:
            logger.error(f"Fluvio produce error: {e}")
            return False
    
    async def record_transaction_in_tigerbeetle(
        self,
        debit_account_id: int,
        credit_account_id: int,
        amount: int,
        code: int,
        reference: str
    ):
        """Record transaction in TigerBeetle via HTTP API"""
        url = f"{self.tigerbeetle_url}/transfers"
        
        payload = {
            "transfers": [{
                "id": int(time.time() * 1000000),
                "debit_account_id": debit_account_id,
                "credit_account_id": credit_account_id,
                "amount": amount,
                "ledger": 1,
                "code": code,
                "user_data_128": reference
            }]
        }
        
        try:
            async with self.http_session.post(url, json=payload) as resp:
                return resp.status < 400
        except Exception as e:
            logger.error(f"TigerBeetle transfer error: {e}")
            return False


class WhatsAppEnhancedService:
    """Enhanced WhatsApp service with full middleware integration"""
    
    def __init__(self, middleware: WhatsAppMiddlewareIntegration):
        self.middleware = middleware
    
    async def process_incoming_message(
        self,
        phone_number: str,
        message_type: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> str:
        """Process incoming WhatsApp message with full middleware integration"""
        start_time = time.time()
        
        allowed = await self.middleware.check_rate_limit(phone_number)
        if not allowed:
            return "Too many messages. Please try again later."
        
        conversation = await self.middleware.get_conversation_by_phone(phone_number)
        
        if not conversation:
            conversation = WhatsAppConversation(
                conversation_id=f"conv_{int(time.time() * 1000)}",
                tenant_id=self.middleware.tenant_id,
                customer_id="",
                phone_number=phone_number,
                state="welcome",
                context={},
                created_at=datetime.utcnow(),
                last_activity=datetime.utcnow()
            )
            
            phone_key = f"whatsapp:phone_conversation:{phone_number}"
            await self.middleware.redis_client.set(
                phone_key,
                conversation.conversation_id,
                ex=86400
            )
        
        message = WhatsAppMessage(
            message_id=f"msg_{int(time.time() * 1000)}",
            tenant_id=self.middleware.tenant_id,
            from_number=phone_number,
            to_number="",
            message_type=message_type,
            content=content,
            timestamp=datetime.utcnow(),
            status="received",
            metadata=metadata,
            customer_id=conversation.customer_id,
            conversation_id=conversation.conversation_id
        )
        
        await self.middleware.publish_message_event("message.received", message)
        
        response = await self._handle_conversation(conversation, content)
        
        conversation.last_activity = datetime.utcnow()
        await self.middleware.save_conversation(conversation)
        
        await self.middleware.record_to_lakehouse("message_processed", {
            "message_id": message.message_id,
            "phone_number": phone_number,
            "message_type": message_type,
            "conversation_id": conversation.conversation_id,
            "state": conversation.state,
            "response_time_ms": (time.time() - start_time) * 1000
        })
        
        whatsapp_messages_total.labels(
            direction="inbound",
            type=message_type,
            status="processed"
        ).inc()
        
        whatsapp_response_time.labels(operation="process_message").observe(
            time.time() - start_time
        )
        
        return response
    
    async def _handle_conversation(
        self,
        conversation: WhatsAppConversation,
        content: str
    ) -> str:
        """Handle conversation state machine"""
        state = conversation.state
        content_lower = content.lower().strip()
        
        if state == "welcome" or content_lower in ["hi", "hello", "start", "menu"]:
            conversation.state = "main_menu"
            return self._get_main_menu()
        
        if state == "main_menu":
            return await self._handle_main_menu(conversation, content_lower)
        
        if state.startswith("transfer_"):
            return await self._handle_transfer_flow(conversation, content)
        
        if state.startswith("airtime_"):
            return await self._handle_airtime_flow(conversation, content)
        
        if state.startswith("bills_"):
            return await self._handle_bills_flow(conversation, content)
        
        return self._get_main_menu()
    
    def _get_main_menu(self) -> str:
        return """Welcome to 54link-dev WhatsApp Banking!

Please select an option:
1. Check Balance
2. Transfer Money
3. Buy Airtime
4. Pay Bills
5. Mini Statement
6. Help

Reply with the number of your choice."""
    
    async def _handle_main_menu(
        self,
        conversation: WhatsAppConversation,
        choice: str
    ) -> str:
        if choice == "1":
            return await self._check_balance(conversation)
        elif choice == "2":
            conversation.state = "transfer_recipient"
            return "Enter the recipient's account number or phone number:"
        elif choice == "3":
            conversation.state = "airtime_phone"
            return "Enter the phone number for airtime (or type 'self' for your number):"
        elif choice == "4":
            conversation.state = "bills_type"
            return """Select bill type:
1. Electricity
2. Cable TV
3. Internet
4. Water

Reply with the number of your choice."""
        elif choice == "5":
            return await self._get_mini_statement(conversation)
        elif choice == "6":
            return self._get_help_message()
        else:
            return "Invalid option. " + self._get_main_menu()
    
    async def _check_balance(self, conversation: WhatsAppConversation) -> str:
        result = await self.middleware.invoke_service_via_dapr(
            "account-service",
            "balance",
            {"customer_id": conversation.customer_id}
        )
        
        await self.middleware.record_to_lakehouse("balance_inquiry", {
            "customer_id": conversation.customer_id,
            "conversation_id": conversation.conversation_id
        })
        
        balance = result.get("balance", 0)
        available = result.get("available_balance", 0)
        
        return f"""Your Account Balance:
        
Available Balance: NGN {available:,.2f}
Ledger Balance: NGN {balance:,.2f}

As at {datetime.now().strftime('%d %b %Y, %H:%M')}

Reply 'menu' for main menu."""
    
    async def _get_mini_statement(self, conversation: WhatsAppConversation) -> str:
        result = await self.middleware.invoke_service_via_dapr(
            "account-service",
            "transactions",
            {"customer_id": conversation.customer_id, "limit": 5}
        )
        
        transactions = result.get("transactions", [])
        
        if not transactions:
            return "No recent transactions.\n\nReply 'menu' for main menu."
        
        statement = "Mini Statement (Last 5 Transactions):\n\n"
        for txn in transactions:
            sign = "+" if txn.get("type") == "credit" else "-"
            statement += f"{txn.get('date')} {sign}NGN {txn.get('amount'):,.2f}\n"
            statement += f"  {txn.get('description')}\n\n"
        
        statement += "Reply 'menu' for main menu."
        return statement
    
    async def _handle_transfer_flow(
        self,
        conversation: WhatsAppConversation,
        content: str
    ) -> str:
        state = conversation.state
        
        if state == "transfer_recipient":
            conversation.context["recipient"] = content
            conversation.state = "transfer_amount"
            return "Enter the amount to transfer (NGN):"
        
        elif state == "transfer_amount":
            try:
                amount = float(content.replace(",", ""))
                if amount <= 0:
                    return "Invalid amount. Please enter a valid amount:"
                conversation.context["amount"] = amount
                conversation.state = "transfer_confirm"
                
                recipient = conversation.context.get("recipient")
                return f"""Transfer Summary:
                
To: {recipient}
Amount: NGN {amount:,.2f}

Reply 'confirm' to proceed or 'cancel' to cancel."""
            except ValueError:
                return "Invalid amount. Please enter a valid number:"
        
        elif state == "transfer_confirm":
            if content.lower() == "confirm":
                return await self._execute_transfer(conversation)
            elif content.lower() == "cancel":
                conversation.state = "main_menu"
                conversation.context = {}
                return "Transfer cancelled.\n\n" + self._get_main_menu()
            else:
                return "Reply 'confirm' to proceed or 'cancel' to cancel."
        
        return self._get_main_menu()
    
    async def _execute_transfer(self, conversation: WhatsAppConversation) -> str:
        recipient = conversation.context.get("recipient")
        amount = conversation.context.get("amount")
        
        workflow_input = {
            "customer_id": conversation.customer_id,
            "recipient": recipient,
            "amount": amount,
            "channel": "whatsapp",
            "conversation_id": conversation.conversation_id
        }
        
        workflow_id = f"wa_transfer_{int(time.time() * 1000)}"
        run_id = await self.middleware.start_temporal_workflow(
            "WhatsAppTransferWorkflow",
            workflow_id,
            workflow_input
        )
        
        await self.middleware.publish_transaction_event("transfer.initiated", {
            "workflow_id": workflow_id,
            "run_id": run_id,
            "customer_id": conversation.customer_id,
            "recipient": recipient,
            "amount": amount
        })
        
        await self.middleware.record_to_lakehouse("transfer", {
            "customer_id": conversation.customer_id,
            "recipient": recipient,
            "amount": amount,
            "status": "completed",
            "conversation_id": conversation.conversation_id
        })
        
        conversation.state = "main_menu"
        conversation.context = {}
        
        ref = run_id[:8] if run_id else workflow_id[-8:]
        
        return f"""Transfer Successful!

Amount: NGN {amount:,.2f}
To: {recipient}
Reference: {ref}
Date: {datetime.now().strftime('%d %b %Y, %H:%M')}

Thank you for banking with 54link-dev!

Reply 'menu' for main menu."""
    
    async def _handle_airtime_flow(
        self,
        conversation: WhatsAppConversation,
        content: str
    ) -> str:
        state = conversation.state
        
        if state == "airtime_phone":
            if content.lower() == "self":
                conversation.context["airtime_phone"] = conversation.phone_number
            else:
                conversation.context["airtime_phone"] = content
            conversation.state = "airtime_amount"
            return "Enter the airtime amount (NGN 50 - 50,000):"
        
        elif state == "airtime_amount":
            try:
                amount = float(content.replace(",", ""))
                if amount < 50 or amount > 50000:
                    return "Amount must be between NGN 50 and NGN 50,000:"
                
                phone = conversation.context.get("airtime_phone")
                
                await self.middleware.publish_transaction_event("airtime.purchased", {
                    "customer_id": conversation.customer_id,
                    "phone": phone,
                    "amount": amount
                })
                
                await self.middleware.record_to_lakehouse("airtime_purchase", {
                    "customer_id": conversation.customer_id,
                    "phone": phone,
                    "amount": amount,
                    "conversation_id": conversation.conversation_id
                })
                
                conversation.state = "main_menu"
                conversation.context = {}
                
                return f"""Airtime Purchase Successful!

Amount: NGN {amount:,.2f}
Phone: {phone}
Date: {datetime.now().strftime('%d %b %Y, %H:%M')}

Reply 'menu' for main menu."""
            except ValueError:
                return "Invalid amount. Please enter a valid number:"
        
        return self._get_main_menu()
    
    async def _handle_bills_flow(
        self,
        conversation: WhatsAppConversation,
        content: str
    ) -> str:
        state = conversation.state
        
        if state == "bills_type":
            bill_types = {"1": "electricity", "2": "cable", "3": "internet", "4": "water"}
            if content in bill_types:
                conversation.context["bill_type"] = bill_types[content]
                conversation.state = "bills_account"
                return f"Enter your {bill_types[content]} account/meter number:"
            else:
                return "Invalid option. Please select 1-4:"
        
        elif state == "bills_account":
            conversation.context["bill_account"] = content
            conversation.state = "bills_amount"
            return "Enter the amount to pay:"
        
        elif state == "bills_amount":
            try:
                amount = float(content.replace(",", ""))
                if amount <= 0:
                    return "Invalid amount. Please enter a valid amount:"
                
                bill_type = conversation.context.get("bill_type")
                bill_account = conversation.context.get("bill_account")
                
                await self.middleware.publish_transaction_event("bill.paid", {
                    "customer_id": conversation.customer_id,
                    "bill_type": bill_type,
                    "bill_account": bill_account,
                    "amount": amount
                })
                
                await self.middleware.record_to_lakehouse("bill_payment", {
                    "customer_id": conversation.customer_id,
                    "bill_type": bill_type,
                    "bill_account": bill_account,
                    "amount": amount,
                    "conversation_id": conversation.conversation_id
                })
                
                conversation.state = "main_menu"
                conversation.context = {}
                
                return f"""Bill Payment Successful!

Bill Type: {bill_type.title()}
Account: {bill_account}
Amount: NGN {amount:,.2f}
Date: {datetime.now().strftime('%d %b %Y, %H:%M')}

Reply 'menu' for main menu."""
            except ValueError:
                return "Invalid amount. Please enter a valid number:"
        
        return self._get_main_menu()
    
    def _get_help_message(self) -> str:
        return """54link-dev WhatsApp Banking Help

Available Commands:
- 'menu' - Show main menu
- 'balance' - Check account balance
- 'transfer' - Transfer money
- 'airtime' - Buy airtime
- 'bills' - Pay bills
- 'statement' - View mini statement
- 'help' - Show this help

For support, call 0700-54-BANK or email support@54link-dev.com

Reply 'menu' for main menu."""
    
    async def send_notification(
        self,
        phone_number: str,
        message: str,
        template_id: str = None
    ):
        """Send outbound notification"""
        msg = WhatsAppMessage(
            message_id=f"notif_{int(time.time() * 1000)}",
            tenant_id=self.middleware.tenant_id,
            from_number="",
            to_number=phone_number,
            message_type="notification",
            content=message,
            timestamp=datetime.utcnow(),
            status="pending",
            metadata={"template_id": template_id} if template_id else None
        )
        
        await self.middleware.publish_message_event("notification.sent", msg)
        
        await self.middleware.record_to_lakehouse("notification_sent", {
            "phone_number": phone_number,
            "template_id": template_id,
            "message_length": len(message)
        })
        
        whatsapp_messages_total.labels(
            direction="outbound",
            type="notification",
            status="sent"
        ).inc()


# Main entry point
if __name__ == "__main__":
    import os
    from aiohttp import web
    
    async def health_check(request):
        return web.json_response({"status": "healthy", "service": "whatsapp"})
    
    async def whatsapp_webhook(request):
        # Handle incoming WhatsApp webhook
        return web.json_response({"message": "WhatsApp webhook endpoint"})
    
    app = web.Application()
    app.router.add_get('/health', health_check)
    app.router.add_post('/webhook', whatsapp_webhook)
    
    port = int(os.getenv('SERVICE_PORT', '8105'))
    print(f"WhatsApp Service starting on port {port}")
    web.run_app(app, host='0.0.0.0', port=port)
