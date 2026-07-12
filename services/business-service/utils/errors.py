"""Custom exception classes for the Business Service."""
from typing import Optional, Any, Dict


class BusinessServiceException(Exception):
    """Base exception for Business Service."""

    def __init__(
        self,
        message: str,
        code: str = "BUSINESS-SVC-INT-5000",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(BusinessServiceException):
    """Raised when validation fails."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="BUSINESS-SVC-VAL-4001",
            status_code=400,
            details=details,
        )


class BusinessNotFoundError(BusinessServiceException):
    """Raised when a business is not found."""

    def __init__(self, business_id: str):
        super().__init__(
            message=f"Business not found: {business_id}",
            code="BUSINESS-SVC-NOT-4004",
            status_code=404,
        )


class BusinessAlreadyExistsError(BusinessServiceException):
    """Raised when trying to create a duplicate business."""

    def __init__(self, registration_number: str):
        super().__init__(
            message=f"Business already exists with registration number: {registration_number}",
            code="BUSINESS-SVC-CONF-4009",
            status_code=409,
        )


class UnauthorizedError(BusinessServiceException):
    """Raised when user is not authorized."""

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(
            message=message,
            code="BUSINESS-SVC-AUTH-4001",
            status_code=401,
        )


class PermissionDeniedError(BusinessServiceException):
    """Raised when user lacks required permissions."""

    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            message=message,
            code="BUSINESS-SVC-AUTH-4003",
            status_code=403,
        )


class InvalidStateTransitionError(BusinessServiceException):
    """Raised when an invalid business state transition is attempted."""

    def __init__(self, current_state: str, requested_state: str):
        super().__init__(
            message=f"Invalid state transition from {current_state} to {requested_state}",
            code="BUSINESS-SVC-STATE-4001",
            status_code=400,
        )


class ExternalServiceError(BusinessServiceException):
    """Raised when an external service call fails."""

    def __init__(self, service_name: str, message: str):
        super().__init__(
            message=f"{service_name} service error: {message}",
            code="BUSINESS-SVC-EXT-5001",
            status_code=503,
        )


class IdempotencyError(BusinessServiceException):
    """Raised when idempotency check fails."""

    def __init__(self, message: str = "Idempotency check failed"):
        super().__init__(
            message=message,
            code="BUSINESS-SVC-IDEM-4001",
            status_code=400,
        )
