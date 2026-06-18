"""Pydantic schemas for API requests and responses."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class CreateBusinessRequest(BaseModel):
    """Request to create a new business."""
    name: str = Field(..., min_length=1, max_length=255, description="Business name")
    registration_number: str = Field(..., min_length=1, max_length=100, description="Business registration number")
    business_type: str = Field(..., description="Type of business")
    industry_code: Optional[str] = Field(None, description="Industry classification code")
    headquarters_address: Optional[str] = Field(None, description="Business address")
    headquarters_location: Optional[str] = Field(None, description="Business location (city/state/country)")
    website_url: Optional[str] = Field(None, description="Business website")
    phone_number: Optional[str] = Field(None, description="Business phone number")
    email_address: Optional[EmailStr] = Field(None, description="Business email")
    registration_date: Optional[datetime] = Field(None, description="Business registration date")
    metadata: Optional[dict] = Field(None, description="Additional metadata")
    settings: Optional[dict] = Field(None, description="Business settings")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Acme Corporation",
                "registration_number": "RC123456",
                "business_type": "limited_company",
                "industry_code": "6201",
                "headquarters_address": "123 Business Street",
                "headquarters_location": "Lagos, Nigeria",
                "website_url": "https://acme.com",
                "phone_number": "+234801234567",
                "email_address": "info@acme.com",
            }
        }


class UpdateBusinessRequest(BaseModel):
    """Request to update a business."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry_code: Optional[str] = None
    headquarters_address: Optional[str] = None
    headquarters_location: Optional[str] = None
    website_url: Optional[str] = None
    phone_number: Optional[str] = None
    email_address: Optional[EmailStr] = None
    metadata: Optional[dict] = None
    settings: Optional[dict] = None


class BusinessResponse(BaseModel):
    """Business response model."""
    id: str
    tenant_id: str
    name: str
    registration_number: str
    business_type: str
    verification_status: str
    compliance_status: str
    industry_code: Optional[str]
    headquarters_address: Optional[str]
    headquarters_location: Optional[str]
    website_url: Optional[str]
    phone_number: Optional[str]
    email_address: Optional[str]
    registration_date: Optional[datetime]
    business_logo_url: Optional[str]
    metadata: Optional[dict]
    settings: Optional[dict]
    created_at: datetime
    updated_at: datetime


class BusinessListResponse(BaseModel):
    """Paginated business list response."""
    total: int
    skip: int
    limit: int
    businesses: List[BusinessResponse]


class CreateBusinessProfileRequest(BaseModel):
    """Request to create a business profile."""
    tin: Optional[str] = Field(None, description="Tax Identification Number")
    business_description: Optional[str] = Field(None, description="Business description")
    annual_revenue: Optional[str] = Field(None, description="Annual revenue")
    employee_count: Optional[int] = Field(None, ge=0, description="Number of employees")
    verified_documents: Optional[List[str]] = Field(None, description="Document references")


class BusinessProfileResponse(BaseModel):
    """Business profile response model."""
    id: str
    business_id: str
    tin: Optional[str]
    business_description: Optional[str]
    annual_revenue: Optional[str]
    employee_count: Optional[int]
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    verified_documents: Optional[List[str]]
    created_at: datetime
    updated_at: datetime


class AddBusinessUserRequest(BaseModel):
    """Request to add a user to a business."""
    keycloak_id: str = Field(..., description="Keycloak user ID")
    role: str = Field(..., description="User role in business")
    permissions: Optional[dict] = Field(None, description="User permissions")


class BusinessUserResponse(BaseModel):
    """Business user response model."""
    id: str
    business_id: str
    keycloak_id: str
    role: str
    permissions: Optional[dict]
    created_at: datetime
    updated_at: datetime


class BusinessUsersListResponse(BaseModel):
    """Paginated business users list response."""
    business_id: str
    total: int
    users: List[BusinessUserResponse]


class AssociateAccountRequest(BaseModel):
    """Request to associate an account with a business."""
    account_id: str = Field(..., description="Account ID")
    account_purpose: Optional[str] = Field(None, description="Purpose of the account")
    is_primary: bool = Field(False, description="Is this the primary account")


class BusinessAccountResponse(BaseModel):
    """Business account response model."""
    id: str
    business_id: str
    account_id: str
    account_purpose: Optional[str]
    is_primary: bool
    created_at: datetime
    updated_at: datetime


class BusinessAccountsListResponse(BaseModel):
    """Paginated business accounts list response."""
    business_id: str
    total: int
    accounts: List[BusinessAccountResponse]


class VerifyBusinessRequest(BaseModel):
    """Request to verify a business."""
    reason: Optional[str] = Field(None, description="Verification reason")


class ApproveVerificationRequest(BaseModel):
    """Request to approve business verification."""
    approved_by: str = Field(..., description="Admin user ID")
    reason: Optional[str] = Field(None, description="Approval reason")


class RejectVerificationRequest(BaseModel):
    """Request to reject business verification."""
    reason: str = Field(..., description="Rejection reason")


class BusinessAuditLogResponse(BaseModel):
    """Business audit log response model."""
    id: str
    business_id: str
    action: str
    performed_by: Optional[str]
    reason: Optional[str]
    previous_state: Optional[dict]
    new_state: Optional[dict]
    created_at: datetime


class BusinessAuditLogsListResponse(BaseModel):
    """Paginated audit logs list response."""
    business_id: str
    total: int
    logs: List[BusinessAuditLogResponse]


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str = "healthy"
    service: str = "business-service"
    version: str


class ErrorResponse(BaseModel):
    """Error response model."""
    message: str
    code: str
    status_code: int
    details: Optional[dict] = None
