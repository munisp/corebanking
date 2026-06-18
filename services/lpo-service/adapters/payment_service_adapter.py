import os
from utils import ExternalAPIClient

class PaymentServiceAdapter(ExternalAPIClient):
    """Payment service adapter."""

    def __init__(self, addHeader: dict = None):
        ExternalAPIClient.__init__(
            self,
            base_url=os.getenv("PAYMENT_URL", ""),
            headers={
                "Content-Type": "application/json",
                "x-tenant-id": addHeader.get("x-tenant-id", "") if addHeader else "",
                "x-keycloak-id": addHeader.get("x-keycloak-id", "") if addHeader else "",
                "x-mint-account-id": addHeader.get("x-mint-account-id", "") if addHeader else "",
                "x-ledger-id": addHeader.get("x-ledger-id", "") if addHeader else "",   
                
            },
        )

    def process_payment(self, recipient: str, amount: float, note: str) -> dict:
        """Process a payment through the payment service."""

        try:
            payload = {
                "recipient": recipient,
                "amount": amount,
                "note": note
            }

            return self._post(
                endpoint="",
                data=payload,
            )
        except:
            return {
                "message": "Failed",
            }
