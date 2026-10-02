"""CP-01 cross-mission wiring (R3 contract): repoint high-value transaction
reporting from the phantom `cbn-compliance-comprehensive` host to the REAL CTR
intake — the nfiu-ctr-str-filing-py filer, which subscribes to the Dapr pubsub
topic `transactions.high-value` (component `pubsub`) at
/api/intake/transaction-event.

Payload contract (R3-report.md §CP-01):
{tenantId, amountKobo, reference|transactionId, customerId, customerName?,
 customerType?, currency?}
CBN thresholds (₦5M individual / ₦10M corporate) are enforced at the filer;
we publish every event with amount >= ₦5M.

Failures are NO LONGER silently swallowed: every publish failure logs ERROR and
increments `nfiu_ctr_publish_errors_total` (fraud_precheck-style alerting
contract).
"""

from dapr.clients import DaprClient
import json

from utils import get_config, create_logger

logger = create_logger(__name__)
config = get_config()

try:
    from otelkit import inc_counter
except Exception:  # pragma: no cover - otelkit absent in isolated tests
    def inc_counter(name, attrs=None):
        return None

CTR_THRESHOLD_NGN = 5_000_000.0

HIGH_VALUE_TOPIC = "transactions.high-value"


class ComplianceServiceAdapter:
    """Publishes high-value transaction events to the NFIU CTR/STR filer."""

    def _publish_high_value_event(self, payload: dict) -> None:
        try:
            with DaprClient() as d:
                d.publish_event(
                    pubsub_name=config.DAPR_PUBSUB_NAME or "pubsub",
                    topic_name=HIGH_VALUE_TOPIC,
                    data=json.dumps(payload),
                    data_content_type="application/json",
                )
            logger.info(
                "High-value CTR event published reference=%s amountKobo=%s",
                payload.get("reference"),
                payload.get("amountKobo"),
            )
        except Exception as exc:
            # CP-01: no silent swallow — ERROR log + metric.
            inc_counter(
                "nfiu_ctr_publish_errors_total",
                {
                    "service": "payment-processing-service",
                    "tenant_id": str(payload.get("tenantId") or "unknown"),
                },
            )
            logger.error(
                "Failed to publish high-value CTR event reference=%s error=%s",
                payload.get("reference"),
                exc,
            )

    def notify_transaction(
        self,
        *,
        transaction_id: str,
        transaction_type: str,
        amount_ngn: float,
        currency: str = "NGN",
        agent_id: str,
        customer_name: str = "",
        customer_bvn: str | None = None,
        customer_account: str = "",
        transaction_date: str,
        tenant_id: str = "",
        customer_type: str | None = None,
    ) -> None:
        """
        Called after every successful transaction. Publishes a
        transactions.high-value event for the NFIU filer when the amount
        crosses the CBN individual CTR floor (₦5M); corporate ₦10M threshold
        is applied at the filer.
        """
        if amount_ngn >= CTR_THRESHOLD_NGN and currency.upper() == "NGN":
            self._publish_high_value_event(
                {
                    "tenantId": tenant_id or "unknown",
                    "amountKobo": int(round(amount_ngn * 100)),
                    "reference": transaction_id,
                    "transactionId": transaction_id,
                    "customerId": customer_account or agent_id,
                    "customerName": customer_name or None,
                    "customerType": customer_type,
                    "currency": currency.upper(),
                    "transactionType": transaction_type,
                    "transactionDate": transaction_date,
                }
            )

    def notify_fraud(
        self,
        *,
        fraud_type: str,
        amount_attempted: float,
        channel: str,
        incident_date: str,
        victim_account: str = "",
        perpetrator_info: str = "",
    ) -> None:
        """Called by fraud pre-check when a transaction is blocked. The
        cbn-compliance fraud-ingest endpoint is phantom; fraud blocks are
        surfaced via logs/metrics instead of a dead HTTP call."""
        logger.error(
            "FRAUD BLOCK fraud_type=%s amount_attempted=%.2f channel=%s "
            "incident_date=%s victim=%s perpetrator=%s",
            fraud_type,
            amount_attempted,
            channel,
            incident_date,
            victim_account,
            perpetrator_info,
        )
        inc_counter(
            "fraud_blocks_total",
            {"service": "payment-processing-service", "fraud_type": fraud_type},
        )
