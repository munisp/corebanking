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