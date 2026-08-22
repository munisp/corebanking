from fastapi import Body, HTTPException
from pydantic import ValidationError
from utils import get_config, PubsubTopics
from .handlers import transaction_initiated_handler, transaction_failed_handler, transaction_success_handler
from schemas import TransactionEventSchema
from utils import create_logger


config = get_config()
logger = create_logger(__name__)


def _parse_event(event: dict, topic: str) -> TransactionEventSchema:
    """Validate the event payload at the Dapr consumer boundary.

    Schema validation (including strict amount rules: decimal, >0, <=2dp,
    bounded) rejects malformed/fraudulent events with 422 so Dapr does not
    redeliver them forever and they never reach the GL.
    """
    try:
        return TransactionEventSchema(**event["data"])
    except ValidationError:
        logger.warning("Rejected invalid %s event payload", topic)
        raise HTTPException(status_code=422, detail="Invalid transaction event payload")
    except (KeyError, TypeError):
        logger.warning("Rejected malformed %s event envelope", topic)
        raise HTTPException(status_code=422, detail="Invalid transaction event payload")


def subscribe(dapr_app):
    @dapr_app.subscribe(
        pubsub=config.DAPR_PUBSUB_NAME,
        topic=PubsubTopics.TRANSACTION_INITIATED.value,
    )
    async def transaction_initiated(event: dict = Body(...)):
        logger.info(f"Received transaction initiated event: {event}")
        await transaction_initiated_handler(_parse_event(event, "transaction_initiated"))

    @dapr_app.subscribe(
        pubsub=config.DAPR_PUBSUB_NAME,
        topic=PubsubTopics.TRANSACTION_SUCCESS.value,
    )
    async def transaction_success(event: dict = Body(...)):
        logger.info(f"Received transaction success event: {event}")
        await transaction_success_handler(_parse_event(event, "transaction_success"))

    @dapr_app.subscribe(
        pubsub=config.DAPR_PUBSUB_NAME,
        topic=PubsubTopics.TRANSACTION_FAILED.value,
    )
    async def transaction_failed(event: dict = Body(...)):
        logger.info(f"Received transaction failed event: {event}")
        await transaction_failed_handler(_parse_event(event, "transaction_failed"))
