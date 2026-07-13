"""Business domain models."""
from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Boolean, JSON, ForeignKey, UniqueConstraint, Index, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base, TimestampMixin, SoftDeleteMixin


class _CaseInsensitiveEnumType(TypeDecorator):
    """Stores enum values as lowercase VARCHAR; normalises uppercase legacy data on read."""
    impl = String
    cache_ok = True

    def __init__(self, enum_class):
        self._enum_class = enum_class
        super().__init__(50)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        v = value.value if isinstance(value, self._enum_class) else str(value)
        return v.lower()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return self._enum_class(value)
        except ValueError:
            return self._enum_class(value.lower())


class BusinessType(str, Enum):
    """Business type enumeration."""
    SOLE_PROPRIETOR = "sole_proprietor"
    PARTNERSHIP = "partnership"
    LIMITED_COMPANY = "limited_company"
    NGO = "ngo"
    GOVERNMENT = "government"
    OTHER = "other"


class VerificationStatus(str, Enum):
    """Verification status enumeration."""
    UNVERIFIED = "unverified"
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class ComplianceStatus(str, Enum):
    """Compliance status enumeration."""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING_REVIEW = "pending_review"
    SUSPENDED = "suspended"


class Business(Base, TimestampMixin, SoftDeleteMixin):
    """Business entity model."""
    __tablename__ = "businesses"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    keycloak_id: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # Business Information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    business_type: Mapped[BusinessType] = mapped_column(
        _CaseInsensitiveEnumType(BusinessType),
        nullable=False,
        default=BusinessType.LIMITED_COMPANY,
    )

    # Verification & Compliance
    verification_status: Mapped[VerificationStatus] = mapped_column(
        _CaseInsensitiveEnumType(VerificationStatus),
        nullable=False,
        default=VerificationStatus.UNVERIFIED,
        index=True,
    )
    compliance_status: Mapped[ComplianceStatus] = mapped_column(
        _CaseInsensitiveEnumType(ComplianceStatus),
        nullable=False,
        default=ComplianceStatus.PENDING_REVIEW,
        index=True,
    )
    
    # Classification
    industry_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    # Contact Information
    headquarters_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    headquarters_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    
    # Lifecycle
    registration_date: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    business_logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Flexible Data
    business_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    profiles: Mapped[list["BusinessProfile"]] = relationship(
        "BusinessProfile",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    users: Mapped[list["BusinessUser"]] = relationship(
        "BusinessUser",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    accounts: Mapped[list["BusinessAccount"]] = relationship(
        "BusinessAccount",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[list["BusinessAuditLog"]] = relationship(
        "BusinessAuditLog",
        back_populates="business",
        cascade="all, delete-orphan",
    )
    
    __table_args__ = (
        UniqueConstraint("tenant_id", "registration_number", name="uq_tenant_registration"),
        Index("idx_business_tenant_status", "tenant_id", "verification_status"),
        Index("idx_business_tenant_compliance", "tenant_id", "compliance_status"),
    )

    def to_dict(self, include_sensitive=False):
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "registration_number": self.registration_number,
            "business_type": self.business_type.value if self.business_type else None,
            "verification_status": self.verification_status.value if self.verification_status else None,
            "compliance_status": self.compliance_status.value if self.compliance_status else None,
            "industry_code": self.industry_code,
            "headquarters_address": self.headquarters_address,
            "headquarters_location": self.headquarters_location,
            "website_url": self.website_url,
            "phone_number": self.phone_number,
            "email_address": self.email_address,
            "registration_date": self.registration_date.isoformat() if self.registration_date else None,
            "business_logo_url": self.business_logo_url,
            "metadata": self.business_metadata,
            "settings": self.settings,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class BusinessProfile(Base, TimestampMixin, SoftDeleteMixin):
    """Extended business profile information."""
    __tablename__ = "business_profiles"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    business_id: Mapped[str] = mapped_column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    
    # Extended Information
    tin: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Tax ID
    business_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    annual_revenue: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    employee_count: Mapped[Optional[int]] = mapped_column(nullable=True)
    
    # Approval Information
    approved_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    
    # Verification Documents
    verified_documents: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Array of doc references
    
    business: Mapped["Business"] = relationship("Business", back_populates="profiles")

    def to_dict(self):
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "business_id": self.business_id,
            "tin": self.tin,
            "business_description": self.business_description,
            "annual_revenue": self.annual_revenue,
            "employee_count": self.employee_count,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "verified_documents": self.verified_documents,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class BusinessUserRole(str, Enum):
    """Business user role enumeration."""
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"
    AUDITOR = "auditor"


class BusinessUser(Base, TimestampMixin, SoftDeleteMixin):
    """Association between Business and Users."""
    __tablename__ = "business_users"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    business_id: Mapped[str] = mapped_column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    keycloak_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    
    # Role & Permissions
    role: Mapped[BusinessUserRole] = mapped_column(
        _CaseInsensitiveEnumType(BusinessUserRole),
        nullable=False,
        default=BusinessUserRole.STAFF,
    )
    permissions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Specific permissions
    
    business: Mapped["Business"] = relationship("Business", back_populates="users")
    
    __table_args__ = (
        UniqueConstraint("business_id", "keycloak_id", name="uq_business_user"),
        Index("idx_business_user_role", "business_id", "role"),
    )

    def to_dict(self):
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "business_id": self.business_id,
            "keycloak_id": self.keycloak_id,
            "role": self.role.value if self.role else None,
            "permissions": self.permissions,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class BusinessAccount(Base, TimestampMixin, SoftDeleteMixin):
    """Association between Business and Accounts."""
    __tablename__ = "business_accounts"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    business_id: Mapped[str] = mapped_column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Account Purpose
    account_purpose: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    
    business: Mapped["Business"] = relationship("Business", back_populates="accounts")
    
    __table_args__ = (
        UniqueConstraint("business_id", "account_id", name="uq_business_account"),
        Index("idx_business_account_primary", "business_id", "is_primary"),
    )

    def to_dict(self):
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "business_id": self.business_id,
            "account_id": self.account_id,
            "account_purpose": self.account_purpose,
            "is_primary": self.is_primary,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class BusinessAction(str, Enum):
    """Business audit action enumeration."""
    CREATED = "created"
    VERIFIED = "verified"
    SUSPENDED = "suspended"
    ACTIVATED = "activated"
    CLOSED = "closed"
    PROFILE_UPDATED = "profile_updated"
    SETTINGS_UPDATED = "settings_updated"
    USER_ADDED = "user_added"
    USER_REMOVED = "user_removed"
    ACCOUNT_ASSOCIATED = "account_associated"
    ACCOUNT_DISASSOCIATED = "account_disassociated"


class BusinessAuditLog(Base, TimestampMixin):
    """Compliance audit log for business operations."""
    __tablename__ = "business_audit_logs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    business_id: Mapped[str] = mapped_column(String(50), ForeignKey("businesses.id"), nullable=False, index=True)
    
    action: Mapped[BusinessAction] = mapped_column(
        _CaseInsensitiveEnumType(BusinessAction),
        nullable=False,
        index=True,
    )
    performed_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Change Tracking
    previous_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    business: Mapped["Business"] = relationship("Business", back_populates="audit_logs")
    
    __table_args__ = (
        Index("idx_audit_business_action", "business_id", "action"),
        Index("idx_audit_created_at", "created_at"),
    )

    def to_dict(self):
        """Convert to dictionary representation."""
        return {
            "id": self.id,
            "business_id": self.business_id,
            "action": self.action.value if self.action else None,
            "performed_by": self.performed_by,
            "reason": self.reason,
            "previous_state": self.previous_state,
            "new_state": self.new_state,
            "created_at": self.created_at.isoformat(),
        }
