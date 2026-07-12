import os
from utils import ExternalAPIClient
from schemas import Context

class PaymentServiceAdapter(ExternalAPIClient):
    """Payment service adapter."""

    def __init__(self):
        ExternalAPIClient.__init__(
            self,
            base_url=os.getenv("PAYMENT_URL", ""),
            headers={
                "Content-Type": "application/json",
            },
        )

    def process_payment(self, recipient: str, amount: float, note: str, context: Context) -> dict:
        """Process a payment through the payment service."""

        try:
            payload = {
                "recipient": recipient,
                "amount": amount,
                "note": note
            }

            headers = {
                "x-tenant-id": context.tenant_id,
                "x-keycloak-id": context.keycloak_id,
                "x-mint-account-id": context.mint_account_id,
                "x-ledger-id": context.ledger_id
            }

            return self._post(
                endpoint="",
                data=payload,
                headers=headers
            )
        except:
            return {
                "message": "Failed",
            }
