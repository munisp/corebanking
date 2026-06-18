import json
import logging
from confluent_kafka import Producer
from datetime import datetime
import uuid
import os

logger = logging.getLogger(__name__)

class LpoKafkaTopics:
    LPO_LIFECYCLE = "lpo.lifecycle"
    LPO_APPLICATION = "lpo.application"

class LpoKafkaEventTypes:
    LPO_CREATED = "lpo.created"
    LPO_SUBMITTED = "lpo.submitted"
    LPO_UNDER_REVIEW = "lpo.under_review"
    LPO_APPROVED = "lpo.approved"
    LPO_REJECTED = "lpo.rejected"
    LPO_DISBURSED = "lpo.disbursed"

class LpoKafkaClient:
    def __init__(self, config=None):
        if config is None:
            config = {
                "bootstrap.servers": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"),
            }
        self.producer = Producer(config)
        logger.info(f"LPO Kafka client initialized with brokers: {config.get('bootstrap.servers')}")

    def publish_event(self, topic, event, key=None):
        if "correlation_id" not in event:
            event["correlation_id"] = f"corr-{uuid.uuid4()}"
        if "timestamp" not in event:
            event["timestamp"] = datetime.utcnow().isoformat()
        payload = json.dumps(event, default=str)
        try:
            self.producer.produce(
                topic,
                key=key.encode("utf-8") if key else None,
                value=payload.encode("utf-8"),
                callback=self.delivery_report,
            )
            self.producer.poll(0)
            logger.info(f"Published event to {topic}: {event.get('type', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish event to {topic}: {e}")
            return False

    def delivery_report(self, err, msg):
        if err is not None:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.debug(f"Message delivered to {msg.topic()} [{msg.partition()}]")
