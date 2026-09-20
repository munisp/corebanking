import enum

class TransactionStatus(enum.Enum):
    PENDING = "pending"
    FAILED = "failed"
    SUCCESS = "success"
    REVERSED = "reversed"
    FRAUD = "fraud"

class CurrencyEnum(enum.Enum):
    NGN = "NGN"

class PubsubTopics(enum.Enum):
    TRANSACTION_INITIATED = "transaction_initiated"
    TRANSACTION_FAILED = "transaction_failed"
    TRANSACTION_SUCCESS = "transaction_success"
    # OR-15: core-banking-go publishes domain events (e.g. core.posting.posted)
    # to this raw-Kafka topic (services/core-banking-go/middleware_events.go:275).
    CORE_BANKING_EVENTS = "core-banking.events"
    