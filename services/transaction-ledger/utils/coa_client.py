"""
Chart of Accounts (CoA) Service Client — Production Implementation

Handles all communication with the chart-of-accounts-service for
double-entry journal entry posting. Implements:
  - Retry with exponential back-off (configurable)
  - Circuit-breaker semantics via timeout
  - Structured error propagation
  - Request ID propagation for distributed tracing
"""

from __future__ import annotations

import os
import uuid
import logging
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

COA_SERVICE_URL = os.getenv("COA_SERVICE_URL", "http://chart-of-accounts-service:8080")
COA_TIMEOUT_SECONDS = float(os.getenv("COA_TIMEOUT_SECONDS", "15"))
COA_MAX_RETRIES = int(os.getenv("COA_MAX_RETRIES", "3"))
COA_RETRY_BASE_DELAY = float(os.getenv("COA_RETRY_BASE_DELAY", "0.5"))


class CoAError(Exception):
    """Raised when the CoA service returns an error or is unreachable."""

    def __init__(self, message: str, status_code: Optional[int] = None, body: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class CoAClient:
    """Client for Chart of Accounts service.

    All monetary amounts in journal entry lines must be integers
    representing the smallest currency unit (kobo for NGN).
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
    ):
        self.base_url = (base_url or COA_SERVICE_URL).rstrip("/")
        self.timeout = timeout or COA_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else COA_MAX_RETRIES

    # ------------------------------------------------------------------
    # Journal Entry
    # ------------------------------------------------------------------

    async def create_journal_entry(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        description: str,
        lines: List[Dict[str, Any]],
        reference: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Post a balanced journal entry to the Chart of Accounts service.

        The CoA service enforces that total debits == total credits.
        This client raises CoAError if that constraint is violated or
        if the service is unreachable after all retries.

        Args:
            tenant_id: Tenant identifier (multi-tenant isolation).
            user_id: Identity of the initiating system/user.
            user_role: Role of the initiating system/user.
            description: Human-readable description of the entry.
            lines: List of line dicts — each must have:
                   account_id (str), description (str),
                   debit_amount (int, kobo), credit_amount (int, kobo).
            reference: External reference (e.g. transaction_id).
            metadata: Arbitrary key-value pairs stored with the entry.

        Returns:
            The created journal entry dict from the CoA service.

        Raises:
            CoAError: On service error or unrecoverable failure.
            ValueError: If lines are empty or imbalanced.
        """
        self._validate_lines(lines)

        request_id = str(uuid.uuid4())
        payload: Dict[str, Any] = {
            "date": datetime.utcnow().isoformat() + "Z",
            "description": description,
            "posted_by": user_id,
            "lines": lines,
        }
        if reference:
            payload["reference"] = reference
        if metadata:
            payload["metadata"] = metadata

        headers = {
            "Content-Type": "application/json",
            "X-Tenant-ID": tenant_id,
            "x-keycloak-id": user_id,
            "X-User-Role": user_role,
            "X-Request-ID": request_id,
        }

        return await self._post_with_retry(
            endpoint="/api/v1/journal-entries",
            payload=payload,
            headers=headers,
            request_id=request_id,
        )

    # ------------------------------------------------------------------
    # Account helpers
    # ------------------------------------------------------------------

    async def create_account(
        self,
        tenant_id: str,
        user_id: str,
        user_role: str,
        code: str,
        name: str,
        account_type: str,
        currency: str = "NGN",
        parent_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a new GL account in the Chart of Accounts."""
        payload: Dict[str, Any] = {
            "code": code,
            "name": name,
            "type": account_type,
            "currency": currency,
            "is_active": True,
            "is_system_account": True,
        }
        if parent_id:
            payload["parent_id"] = parent_id
        if description:
            payload["description"] = description

        request_id = str(uuid.uuid4())
        return await self._post_with_retry(
            endpoint="/api/v1/accounts",
            payload=payload,
            headers={
                "Content-Type": "application/json",
                "X-Tenant-ID": tenant_id,
                "x-keycloak-id": user_id,
                "X-User-Role": user_role,
                "X-Request-ID": request_id,
            },
            request_id=request_id,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_lines(lines: List[Dict[str, Any]]) -> None:
        if not lines or len(lines) < 2:
            raise ValueError("A journal entry must have at least 2 lines.")
        total_debit = sum(int(line.get("debit_amount", 0)) for line in lines)
        total_credit = sum(int(line.get("credit_amount", 0)) for line in lines)
        if total_debit != total_credit:
            raise ValueError(
                f"Journal entry is not balanced: "
                f"debits={total_debit} credits={total_credit}"
            )
        if total_debit == 0:
            raise ValueError("Journal entry amount cannot be zero.")

    async def _post_with_retry(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        headers: Dict[str, str],
        request_id: str,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        last_exc: Optional[Exception] = None

        for attempt in range(1, self.max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(url, json=payload, headers=headers)

                if response.status_code in (200, 201):
                    logger.info(
                        "CoA POST success url=%s request_id=%s attempt=%d status=%d",
                        url, request_id, attempt, response.status_code,
                    )
                    return response.json()

                # 4xx errors are non-retryable (bad request, constraint violation)
                if 400 <= response.status_code < 500:
                    body = response.text
                    logger.error(
                        "CoA POST client error url=%s request_id=%s status=%d body=%s",
                        url, request_id, response.status_code, body[:500],
                    )
                    raise CoAError(
                        f"CoA service rejected journal entry: HTTP {response.status_code}",
                        status_code=response.status_code,
                        body=body,
                    )

                # 5xx: retryable
                body = response.text
                logger.warning(
                    "CoA POST server error url=%s request_id=%s status=%d attempt=%d body=%s",
                    url, request_id, response.status_code, attempt, body[:200],
                )
                last_exc = CoAError(
                    f"CoA service error: HTTP {response.status_code}",
                    status_code=response.status_code,
                    body=body,
                )

            except httpx.TimeoutException as exc:
                logger.warning(
                    "CoA POST timeout url=%s request_id=%s attempt=%d",
                    url, request_id, attempt,
                )
                last_exc = CoAError(f"CoA service timeout after {self.timeout}s")

            except httpx.RequestError as exc:
                logger.warning(
                    "CoA POST network error url=%s request_id=%s attempt=%d error=%s",
                    url, request_id, attempt, exc,
                )
                last_exc = CoAError(f"CoA service unreachable: {exc}")

            except CoAError:
                raise  # non-retryable 4xx

            if attempt < self.max_retries:
                delay = COA_RETRY_BASE_DELAY * (2 ** (attempt - 1))
                logger.info(
                    "CoA POST retry in %.2fs request_id=%s attempt=%d/%d",
                    delay, request_id, attempt, self.max_retries,
                )
                await asyncio.sleep(delay)

        raise CoAError(
            f"CoA service failed after {self.max_retries} attempts"
        ) from last_exc
