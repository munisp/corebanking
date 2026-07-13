import os
from utils import ExternalAPIClient, create_logger
from schemas import Context

logger = create_logger(__name__)


class PaymentHubAdapter(ExternalAPIClient):
    """Payment hub adapter."""

    def __init__(self):
        ExternalAPIClient.__init__(
            self,
            base_url=os.getenv("PAYMENT_HUB_SVC_URL", ""),
            headers={
                "Content-Type": "application/json",
            },
        )

    def create_account(self, name: str, context: Context) -> dict:
        """Create account."""

        payload = {
            "name": name,
            "account_type": "savings"
        }

        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": context.keycloak_id,
            "x-ledger-id": context.ledger_id,
            "x-switch-name": "mojaloop",
            "x-tenant-name": context.tenant_id,
            "x-ams-name": "core_banking"
        }

        return self._post(
            endpoint="/account",
            data=payload,
            headers=headers
        )

    def get_account(self, account_id: str, context: Context) -> dict:
        """Get account details."""

        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": context.keycloak_id,
            "x-ledger-id": context.ledger_id
        }

        return self._get(
            endpoint=f"/account/{account_id}?verbose=false",
            headers=headers
        )

    def transfer(
        self,
        amount: float,
        saving_id: str,
        customer_account: str,
        pin: str,
        context: Context,
        currency: str = "NGN",
        switch_name: str = "mojaloop",
    ) -> dict:
        """Transfer funds."""

        payload = {
            "amount": f"{amount:.2f}",
            "currency": currency,
            "destination": context.tenant_id,
            "from": {
                "idType": "ACCOUNT_ID",
                "idValue": str(customer_account),
                "displayName": "Sender",
            },
            "to": {
                "idType": "ACCOUNT_ID",
                "idValue": str(saving_id),
                "displayName": "Recipient",
            },
            "note": "Transfer",
            "pin": str(pin),
            "switch_name": switch_name,
        }

        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": context.keycloak_id,
            "x-ledger-id": context.ledger_id,
            "x-switch-name": "mojaloop",
            "x-tenant-name": context.tenant_id,
            "x-ams-name": "core_banking"
        }

        return self._post(
            endpoint="/api/v1/transfers/initiate",
            data=payload,
            headers=headers,
        )
    def get_account_by_account_number(self, account_number: str, context: Context):
        """Retrieve account by account ID."""

        headers = {
            "x-tenant-id": context.tenant_id,
            "x-keycloak-id": context.keycloak_id,
            "x-ledger-id": context.ledger_id,
        }

        return self._get(
            endpoint=f"/account/account-number/{account_number}", headers=headers
        )