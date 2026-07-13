# Kafka Event Publishing Usage Guide

## Overview

The user-service implements a comprehensive Kafka event publishing system with:

- **Event buffering** for improved performance
- **Async publishing** for non-blocking operations
- **Built-in metrics** for monitoring
- **Auto-flushing** background worker
- **Graceful shutdown** handling
- **Correlation IDs** for event tracing
- **Structured events** with metadata support

## Architecture

```
┌─────────────────┐
│  API Endpoints  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  KafkaClient    │─────▶│  Event Buffer    │
│  - publish      │      │  (100 events)    │
│  - async        │      └──────────────────┘
│  - batch        │              │
└────────┬────────┘              │
         │                       │
         ▼                       ▼
┌─────────────────┐      ┌──────────────────┐
│ Kafka Producer  │◀─────│ Background       │
│ (confluent)     │      │ Flusher (5s)     │
└─────────────────┘      └──────────────────┘
```

## Topics

The service publishes to the following Kafka topics:

| Topic             | Description             | Events                                          |
| ----------------- | ----------------------- | ----------------------------------------------- |
| `users.lifecycle` | User lifecycle events   | created, updated, deleted, activated, suspended |
| `users.kyc`       | KYC verification events | started, saved, completed, verified, failed     |
| `users.auth`      | Authentication events   | signup, login, logout                           |
| `users.profile`   | Profile events          | updated, viewed                                 |
| `users.audit`     | Audit trail events      | any user action                                 |

## Event Types

All event types are defined in `UserEventTypes`:

```python
from utils import UserEventTypes

# Lifecycle
UserEventTypes.USER_CREATED
UserEventTypes.USER_UPDATED
UserEventTypes.USER_ACTIVATED
UserEventTypes.USER_SUSPENDED

# KYC
UserEventTypes.KYC_STARTED
UserEventTypes.KYC_SAVED
UserEventTypes.KYC_COMPLETED
UserEventTypes.KYC_VERIFIED

# Auth
UserEventTypes.USER_SIGNUP
UserEventTypes.USER_LOGIN
UserEventTypes.USER_LOGOUT
```

## Usage Examples

### 1. Basic Event Publishing

```python
from main import KafkaClientInstance
from utils import UserEventTypes, UserTopics

# Publish a simple event
KafkaClientInstance.publish_event(
    topic=UserTopics.USERS,
    event={
        "type": UserEventTypes.USER_CREATED,
        "user_id": "user_123",
        "tenant_id": "tenant_456",
        "timestamp": datetime.utcnow().isoformat()
    }
)
```

### 2. Using Helper Methods (Recommended)

```python
# Publish user lifecycle event
KafkaClientInstance.publish_user_event(
    event_type=UserEventTypes.USER_CREATED,
    user_id=user.id,
    tenant_id=tenant_id,
    status=user.status.value,
    metadata={
        "email": user.email,
        "name": user.name,
        "role": user.user_role.value
    }
)

# Publish KYC event
KafkaClientInstance.publish_kyc_event(
    event_type=UserEventTypes.KYC_COMPLETED,
    user_id=user.id,
    tenant_id=tenant_id,
    kyc_status="VERIFIED",
    metadata={
        "verification_url": kyc_url
    }
)

# Publish audit event
KafkaClientInstance.publish_audit_event(
    user_id=user.id,
    tenant_id=tenant_id,
    action="status_changed",
    actor=current_user_id,
    details={
        "old_status": "PENDING",
        "new_status": "ACTIVE"
    }
)
```

### 3. Async Publishing (Non-blocking)

```python
# For non-critical events that don't need immediate confirmation
KafkaClientInstance.publish_event_async(
    topic=UserTopics.AUDIT,
    event={
        "type": "user.profile.viewed",
        "user_id": user.id,
        "tenant_id": tenant_id
    }
)
```

### 4. Batch Publishing

```python
events = [
    {"type": UserEventTypes.USER_LOGIN, "user_id": "user_1", ...},
    {"type": UserEventTypes.USER_LOGIN, "user_id": "user_2", ...},
    {"type": UserEventTypes.USER_LOGIN, "user_id": "user_3", ...}
]

success_count = KafkaClientInstance.publish_batch(
    topic=UserTopics.AUTH,
    events=events
)
print(f"Published {success_count}/{len(events)} events")
```

### 5. Event Buffering

```python
# Add to buffer for later publishing (useful for high-throughput scenarios)
KafkaClientInstance.buffer_event(
    topic=UserTopics.AUDIT,
    event={"type": "user.action", ...}
)

# Events are auto-flushed every 5 seconds or when buffer reaches 100 events
# You can also manually flush:
KafkaClientInstance.flush()
```

## Event Schema

All events follow this structure:

```python
{
    "type": "user.created",              # Event type
    "user_id": "uuid-here",              # User identifier
    "tenant_id": "tenant-uuid",          # Tenant identifier
    "status": "ACTIVE",                  # Optional: user status
    "timestamp": "2026-01-27T10:30:00",  # Auto-generated if not provided
    "correlation_id": "corr-uuid",       # Auto-generated for tracing
    "causation_id": "event-uuid",        # Optional: ID of causing event
    "metadata": {                        # Optional: additional context
        "email": "user@example.com",
        "action": "signup",
        "actor": "admin_user_id"
    }
}
```

## Integration in Endpoints

Here's how events are published in the user creation endpoint:

```python
@user_router.post("")
def create_user(payload: CreateUserSchema, db: Session = Depends(get_session), ...):
    # Create user in database
    user = User(...)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Publish event to Kafka
    KafkaClientInstance.publish_user_event(
        event_type=UserEventTypes.USER_CREATED,
        user_id=user.id,
        tenant_id=tenant_id,
        status=user.status.value,
        metadata={
            "email": user.email,
            "name": user.name,
            "keycloak_id": user.keycloak_id
        }
    )

    return {"message": "success", "user": user.to_dict()}
```

## Metrics

Check Kafka metrics via the endpoint:

```bash
GET /metrics/kafka
```

Response:

```json
{
  "status": "connected",
  "metrics": {
    "messages_published": {
      "users.lifecycle": {
        "success": 150,
        "error": 2
      },
      "users.kyc": {
        "success": 45,
        "error": 0
      }
    },
    "latencies": {
      "users.lifecycle": {
        "avg": 0.0025,
        "min": 0.001,
        "max": 0.015,
        "count": 150
      }
    }
  }
}
```

## Configuration

Kafka client is configured in `main.py` with the following settings:

```python
kafka_config = {
    'bootstrap.servers': config.KAFKA_BOOTSTRAP_SERVERS,
    'security.protocol': config.KAFKA_SECURITY_PROTOCOL,
    'sasl.mechanism': config.KAFKA_SASL_MECHANISM,
    'sasl.username': config.KAFKA_SASL_USERNAME,
    'sasl.password': config.KAFKA_SASL_PASSWORD,
}

KafkaClientInstance = KafkaClient(
    kafka_config,
    buffer_size=100,      # Max events to buffer
    flush_interval=5.0    # Auto-flush every 5 seconds
)
```

## Best Practices

1. **Use helper methods** - They ensure consistent event structure
2. **Add meaningful metadata** - Include context that helps debugging
3. **Use async for non-critical events** - Improves response times
4. **Batch when possible** - More efficient for multiple events
5. **Monitor metrics** - Watch for errors and latency spikes
6. **Correlation IDs** - Auto-added for distributed tracing

## Error Handling

The client includes automatic error handling:

- Failed publishes are logged with details
- Metrics track success/error counts
- Delivery reports confirm or report failures
- Graceful shutdown ensures no message loss

## Testing

To test event publishing:

```python
# In your test
from main import KafkaClientInstance

def test_user_creation():
    # Create user
    response = client.post("/user", json={...})

    # Check metrics (events should be published)
    metrics = KafkaClientInstance.get_metrics()
    assert metrics["messages_published"]["users.lifecycle"]["success"] > 0
```

## Shutdown

The client automatically flushes all pending messages on application shutdown:

```python
# Registered in main.py
@atexit.register
def shutdown_kafka():
    KafkaClientInstance.close()
```

This ensures no events are lost during graceful shutdown.
