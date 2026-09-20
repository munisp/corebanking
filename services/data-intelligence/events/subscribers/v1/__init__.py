from fastapi import Body
from utils import get_config, PubsubTopics, create_logger
from repositories import EventRepository
from database import get_session

logger = create_logger(__name__)
config = get_config()

def subscribe(dapr_app):
    @dapr_app.subscribe(
        pubsub=config.DAPR_PUBSUB_NAME,
        topic=PubsubTopics.TRANSACTION_INITIATED,
    )
    def transaction_initiated(event: dict = Body(...)):
        session = next(get_session())
        logger.info("Received TRANSACTION_INITIATED event: %s", event)
        try:
            event_repo = EventRepository(session)
            event_repo.create_event(
                topic=PubsubTopics.TRANSACTION_INITIATED.value,
                raw=event
            )
        finally:
            session.close()

    # OR-15: consume core-banking.events (event core.posting.posted) so every
    # core posting event is persisted for analytics/recon instead of going
    # unread. Producer publishes raw Kafka (not CloudEvent-wrapped) via
    # sarama; the kafka-backed Dapr pubsub component delivers the same topic.
    @dapr_app.subscribe(
        pubsub=config.DAPR_PUBSUB_NAME,
        topic=PubsubTopics.CORE_BANKING_EVENTS.value,
    )
    def core_banking_events(event: dict = Body(...)):
        session = next(get_session())
        logger.info("Received CORE_BANKING_EVENTS event: %s", event)
        try:
            event_repo = EventRepository(session)
            event_repo.create_event(
                topic=PubsubTopics.CORE_BANKING_EVENTS.value,
                raw=event,
                tenant_id=str(event.get("tenantID", "")) if isinstance(event, dict) else "",
            )
        finally:
            session.close()