"""
Chart of Accounts Client for Savings Service

Add this to utils/coa_client.py or import from payment-processing-service
"""

import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import httpx

logger = logging.getLogger(__name__)


class CoAClient:
    """Client for Chart of Accounts service"""
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.getenv("COA_SERVICE_URL", "http://chart-of-accounts-service:8080")
        self.timeout = 30.0
    
    def _get_headers(self, tenant_id: str, user_id: str, user_role: str) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-Tenant-ID": tenant_id,
            "x-keycloak-id": user_id,
            "X-User-Role": user_role,
        }
    
    async def record_savings_deposit(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        account_id: str,
        amount: int,  # Amount in kobo
        customer_account: str,
    ) -> Dict[str, Any]:
        """
        Record savings deposit
        
        Debit: Savings Deposits (2200)
        Credit: Customer source account
        """
        entry_data = {
            "date": datetime.utcnow().isoformat(),
            "description": f"Savings deposit to account {account_id}",
            "posted_by": user_id,
            "reference": account_id,
            "lines": [
                {
                    "account_id": "2200",  # Savings Deposits liability
                    "description": f"Deposit to savings account {account_id}",
                    "debit_amount": amount,
                    "credit_amount": 0,
                },
                {
                    "account_id": customer_account,
                    "description": "Transfer from customer account",
                    "debit_amount": 0,
                    "credit_amount": amount,
                },
            ],
            "metadata": {
                "account_id": account_id,
                "source": "savings-service",
                "event_type": "deposit",
            },
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/journal-entries",
                    json=entry_data,
                    headers=self._get_headers(tenant_id, user_id, user_role),
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Failed to record savings deposit: {e}")
                raise
    
    async def record_savings_withdrawal(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        account_id: str,
        amount: int,
        customer_account: str,
    ) -> Dict[str, Any]:
        """
        Record savings withdrawal
        
        Debit: Customer destination account
        Credit: Savings Deposits (2200)
        """
        entry_data = {
            "date": datetime.utcnow().isoformat(),
            "description": f"Savings withdrawal from account {account_id}",
            "posted_by": user_id,
            "reference": account_id,
            "lines": [
                {
                    "account_id": customer_account,
                    "description": "Withdrawal to customer account",
                    "debit_amount": amount,
                    "credit_amount": 0,
                },
                {
                    "account_id": "2200",  # Savings Deposits
                    "description": f"Withdrawal from savings account {account_id}",
                    "debit_amount": 0,
                    "credit_amount": amount,
                },
            ],
            "metadata": {
                "account_id": account_id,
                "source": "savings-service",
                "event_type": "withdrawal",
            },
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/journal-entries",
                    json=entry_data,
                    headers=self._get_headers(tenant_id, user_id, user_role),
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Failed to record savings withdrawal: {e}")
                raise
    
    async def record_interest_accrual(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        account_id: str,
        interest_amount: int,
    ) -> Dict[str, Any]:
        """
        Record interest accrual on savings
        
        Debit: Interest Expense (5200)
        Credit: Savings Deposits (2200)
        """
        entry_data = {
            "date": datetime.utcnow().isoformat(),
            "description": f"Interest accrual for savings account {account_id}",
            "posted_by": user_id,
            "reference": account_id,
            "lines": [
                {
                    "account_id": "5200",  # Interest Expense
                    "description": "Interest expense on savings",
                    "debit_amount": interest_amount,
                    "credit_amount": 0,
                },
                {
                    "account_id": "2200",  # Savings Deposits
                    "description": f"Interest credited to account {account_id}",
                    "debit_amount": 0,
                    "credit_amount": interest_amount,
                },
            ],
            "metadata": {
                "account_id": account_id,
                "source": "savings-service",
                "event_type": "interest_accrual",
            },
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/v1/journal-entries",
                    json=entry_data,
                    headers=self._get_headers(tenant_id, user_id, user_role),
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                logger.error(f"Failed to record interest accrual: {e}")
                raise


# Integration example in savings service
"""
from utils.coa_client import CoAClient

class SavingsService:
    def __init__(self):
        self.coa_client = CoAClient()
    
    async def process_deposit(self, account_id, amount, customer_account, context):
        # Record in Chart of Accounts (fail-fast)
        try:
            await self.coa_client.record_savings_deposit(
                tenant_id=context.tenant_id,
                user_id=context.user_id,
                user_role="bank_admin",
                account_id=account_id,
                amount=amount,  # in kobo
                customer_account=customer_account,
            )
        except Exception as e:
            logger.error(f"Failed to record journal entry for deposit: {e}")
            raise Exception("Failed to record accounting entry. Deposit not processed.")
        # ... process the deposit in your system ...
    
    async def process_withdrawal(self, account_id, amount, customer_account, context):
        # Record in Chart of Accounts (fail-fast)
        try:
            await self.coa_client.record_savings_withdrawal(
                tenant_id=context.tenant_id,
                user_id=context.user_id,
                user_role="bank_admin",
                account_id=account_id,
                amount=amount,
                customer_account=customer_account,
            )
        except Exception as e:
            logger.error(f"Failed to record journal entry for withdrawal: {e}")
            raise Exception("Failed to record accounting entry. Withdrawal not processed.")
        # ... process the withdrawal in your system ...
"""
