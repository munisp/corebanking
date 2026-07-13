"""
Lakehouse Client for Docling Service
Publishes document processing events to Kafka for lakehouse ingestion
"""

import json
import asyncio
from typing import Dict, Any
from datetime import datetime
from kafka import KafkaProducer
from kafka.errors import KafkaError
import structlog

logger = structlog.get_logger()

class LakehouseClient:
    def __init__(self):
        self.producer = KafkaProducer(
            bootstrap_servers=['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            key_serializer=lambda k: k.encode('utf-8') if k else None,
            acks='all',  # Wait for all replicas
            retries=3,
            max_in_flight_requests_per_connection=1  # Ensure ordering
        )
        
    async def ingest_document(self, result: Dict[str, Any], tenant_id: str):
        """
        Publish document processing result to Kafka
        
        Args:
            result: DocumentResult dict from Docling service
            tenant_id: Bank/tenant identifier for multi-tenancy
        """
        try:
            # Construct event payload
            event = {
                "event_type": "document.processed",
                "event_id": f"doc-{result['document_id']}-{int(datetime.utcnow().timestamp())}",
                "timestamp": datetime.utcnow().isoformat(),
                "tenant_id": tenant_id,
                "document": {
                    "document_id": result['document_id'],
                    "document_type": result['document_type'],
                    "confidence": result['confidence'],
                    "processing_time_ms": result['processing_time_ms'],
                    "text": result['text'],
                    "parsed_fields": result['parsed_fields'],
                    "tables": result['tables'],
                    "images": result['images'],
                    "metadata": result['metadata']
                }
            }
            
            # Publish to Kafka topic (partitioned by tenant_id for ordering)
            future = self.producer.send(
                topic='documents.processed',
                key=tenant_id,  # Ensures all events for a tenant go to same partition
                value=event
            )
            
            # Wait for acknowledgment
            record_metadata = future.get(timeout=10)
            
            logger.info(
                "Document event published to Kafka",
                document_id=result['document_id'],
                tenant_id=tenant_id,
                topic=record_metadata.topic,
                partition=record_metadata.partition,
                offset=record_metadata.offset
            )
            
            return {
                "status": "published",
                "topic": record_metadata.topic,
                "partition": record_metadata.partition,
                "offset": record_metadata.offset
            }
            
        except KafkaError as e:
            logger.error(f"Failed to publish document event: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error publishing document event: {str(e)}")
            raise
    
    def close(self):
        """Close Kafka producer connection"""
        self.producer.close()
