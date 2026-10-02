from utils import ExternalAPIClient, get_config, create_logger
from schemas import Context

logger = create_logger(__name__)
config = get_config()


class FraudEngineAdapter(ExternalAPIClient):
    """Fraud engine service adapter.

    PL-07 (F15-15): targets the real fraud-service endpoint
    POST /api/v1/fraud/check (services/fraud-service/main.py:511) and maps
    its response (action/fraud_score) onto the decision/score contract the
    payment service enforces.
    """

    def __init__(self):
        ExternalAPIClient.__init__(
            self,
            base_url=config.FRAUD_ENGINE_SVC_URL,
            headers={
                "Content-Type": "application/json",
            },
        )

    def score_transaction(self, payload: dict, context: Context):
        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": context.keycloak_id,
            "x-ledger-id": context.ledger_id,
        }
        # fraud-service requires tenant_id/customer_id in the body.
        body = dict(payload)
        body.setdefault("tenant_id", str(context.tenant_id))
        if not body.get("customer_id"):
            body["customer_id"] = body.get("agent_id") or str(context.keycloak_id)
        response = self._post(endpoint="/api/v1/fraud/check", data=body, headers=headers)
        return self._normalize_response(response)

    @staticmethod
    def _normalize_response(response) -> dict:
        """Map fraud-service {action, fraud_score, risk_level} onto
        {decision, score}. challenge -> review (manual review gate)."""
        data = response if isinstance(response, dict) else {}
        action = str(
            data.get("decision")
            or data.get("action")
            or data.get("recommended_action")
            or ""
        ).lower()
        decision_map = {
            "block": "block",
            "challenge": "review",
            "review": "review",
            "allow": "allow",
        }
        decision = decision_map.get(action, action or "review")
        raw_score = data.get("score", data.get("fraud_score", 0))
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            score = 0.0
        if score > 1.0:
            score = score / 100.0
        return {**data, "decision": decision, "score": score}
