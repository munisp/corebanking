"""Kafka adapter for event publishing."""
import logging
import json
from typing import Optional, Any
from confluent_kafka import Producer
from confluent_kafka.error import KafkaError

from utils import config

logger = logging.getLogger(__name__)


class KafkaAdapter:
    """Kafka client for publishing events."""

    _instance: Optional["KafkaAdapter"] = None

    def __init__(self):
        """Initialize Kafka producer."""
        settings = config.get_settings()
        
        self.producer = Producer(
            {
                "bootstrap.servers": settings.KAFKA_BROKERS,
                "client.id": "business-service",
            }
        )
        logger.info(f"Kafka producer initialized with brokers: {settings.KAFKA_BROKERS}")

    @classmethod
    def get_instance(cls) -> "KafkaAdapter":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = KafkaAdapter()
        return cls._instance

    def publish_event(
        self,
        topic: str,
        message: dict,
        key: Optional[str] = None,
    ) -> bool:
        """Publish an event to Kafka."""
        try:
            def delivery_report(err, msg):
                if err is not None:
                    logger.error(f"Message delivery failed: {err}")
                else:
                    logger.info(f"Message delivered to {msg.topic()} [{msg.partition()}]")

            self.producer.produce(
                topic=topic,
                key=key.encode("utf-8") if key else None,
                value=json.dumps(message).encode("utf-8"),
                callback=delivery_report,
            )

            # Wait for any outstanding messages to be delivered
            self.producer.flush()
            return True

        except KafkaError as e:
            logger.error(f"Error publishing event to Kafka: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error publishing to Kafka: {e}")
            return False

    def publish_business_created(self, business_id: str, business_data: dict) -> bool:
        """Publish business created event."""
        return self.publish_event(
            topic="business.created",
            message={
                "event_type": "business.created",
                "business_id": business_id,
                "data": business_data,
            },
            key=business_id,
        )

    def publish_business_verified(self, business_id: str, verified_by: str) -> bool:
        """Publish business verified event."""
        return self.publish_event(
            topic="business.verified",
            message={
                "event_type": "business.verified",
                "business_id": business_id,
                "verified_by": verified_by,
            },
            key=business_id,
        )

    def publish_business_suspended(self, business_id: str, reason: str) -> bool:
        """Publish business suspended event."""
        return self.publish_event(
            topic="business.suspended",
            message={
                "event_type": "business.suspended",
                "business_id": business_id,
                "reason": reason,
            },
            key=business_id,
        )

    def close(self):
        """Close producer."""
        self.producer.flush()
