from pydantic import BaseModel
from typing import Optional
from utils import UserRole


class CreateAuth(BaseModel):
    name: Optional[str] = None
    email: str
    user_role: Optional[UserRole] = None
    # v2.perm Permify roles — use one or both depending on the user scope:
    # platform_role → assigned on the `platform` entity (54link-level admins)
    # tenant_role   → assigned on the `tenants` entity (bank/tenant-level staff)
    platform_role: Optional[str] = (
        None  # e.g. "super_admin", "it_admin", "compliance_officer"
    )
    tenant_role: Optional[str] = (
        None  # e.g. "branch_manager", "loan_officer", "vault_manager"
    )


class Login(BaseModel):
    email: str
    password: str
    type: Optional[UserRole] = None


class SetupPassword(BaseModel):
    keycloak_id: str
    password: str
    confirm_password: str


class ForgotPassword(BaseModel):
    email: str


class ResetPassword(BaseModel):
    keycloak_id: str
    otp_code: str
    new_password: str
    confirm_password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class VerifyOTP(BaseModel):
    # W12-A4A: keycloak_id is optional — the UI resolves it from the
    # x-keycloak-id header (set by the mobile/web API clients); the OTP
    # itself is accepted as otp_code, otp, or token depending on the client.
    keycloak_id: Optional[str] = None
    otp_code: Optional[str] = None
    otp: Optional[str] = None
    token: Optional[str] = None

    def resolved_otp(self) -> Optional[str]:
        return self.otp_code or self.otp or self.token


class VerifyEmail(BaseModel):
    """Email verification via the emailed OTP token."""
    token: str
    keycloak_id: Optional[str] = None


class ResendOTP(BaseModel):
    keycloak_id: Optional[str] = None


class ResendVerification(BaseModel):
    keycloak_id: Optional[str] = None
    email: Optional[str] = None


class CreatePin(BaseModel):
    current_pin: Optional[str] = None
    new_pin: str


class UpdateUser(BaseModel):
    """Profile fields the UI sends on PUT /auth/user. Auth-service persists
    the auth-owned field (email); name/phone attributes are forwarded to the
    Keycloak identity."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
