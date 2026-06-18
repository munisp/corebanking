"""
Role Mapping Utility — v2.perm

This module provides helpers to work with the v2.perm Permify schema which
defines two entities:

  - `platform`  (54link platform-level admins)
      roles: super_admin, tenant_manager, operations_manager, risk_manager,
             internal_auditor, it_admin, relationship_manager,
             compliance_officer, support_agent

  - `tenants`   (bank/tenant-level staff)
      roles: super_admin, branch_manager, operations_manager, risk_manager,
             internal_auditor, it_admin, relationship_manager,
             trade_finance_admin, vault_manager, treasury_manager,
             loan_officer, compliance_officer, support_agent,
             teller, fraud_analyst

Usage model (industry-standard RBAC):
  - The caller supplies the actual role name (e.g. "branch_manager") directly.
  - No numeric access-level codes. No legacy mapping needed.
  - UserRole (SUPERADMIN, ADMIN, USER, GUEST) is only for Keycloak auth-level;
    authorization is fully handled by Permify role tuples.
"""

import logging
from typing import Optional, Tuple
from utils.enums import UserRole, PermifyPlatformRole, PermifyTenantRole

logger = logging.getLogger(__name__)


class RoleMapper:
    """Utility class for validating and describing v2.perm Permify roles."""

    # Human-readable labels for platform roles (used by UI / audit logs)
    PLATFORM_ROLE_LABELS = {
        PermifyPlatformRole.SUPER_ADMIN.value: "Super Admin — full platform access",
        PermifyPlatformRole.TENANT_MANAGER.value: "Tenant Manager — manage tenants",
        PermifyPlatformRole.OPERATIONS_MANAGER.value: "Operations Manager — platform operations",
        PermifyPlatformRole.RISK_MANAGER.value: "Risk Manager — risk & limits oversight",
        PermifyPlatformRole.INTERNAL_AUDITOR.value: "Internal Auditor — view all data & audit",
        PermifyPlatformRole.IT_ADMIN.value: "IT Admin — system & feature management",
        PermifyPlatformRole.RELATIONSHIP_MANAGER.value: "Relationship Manager — tenant relations",
        PermifyPlatformRole.COMPLIANCE_OFFICER.value: "Compliance Officer — compliance & KYC",
        PermifyPlatformRole.SUPPORT_AGENT.value: "Support Agent — customer support",
    }

    # Human-readable labels for tenant roles
    TENANT_ROLE_LABELS = {
        PermifyTenantRole.SUPER_ADMIN.value: "Super Admin — full tenant access",
        PermifyTenantRole.BRANCH_MANAGER.value: "Branch Manager — manage branch operations",
        PermifyTenantRole.OPERATIONS_MANAGER.value: "Operations Manager — transactions & tellers",
        PermifyTenantRole.RISK_MANAGER.value: "Risk Manager — risk, limits & compliance",
        PermifyTenantRole.INTERNAL_AUDITOR.value: "Internal Auditor — view all data & audit",
        PermifyTenantRole.IT_ADMIN.value: "IT Admin — system & ERP management",
        PermifyTenantRole.RELATIONSHIP_MANAGER.value: "Relationship Manager — customer relations",
        PermifyTenantRole.TRADE_FINANCE_ADMIN.value: "Trade Finance Admin — LPO & trade finance",
        PermifyTenantRole.VAULT_MANAGER.value: "Vault Manager — vault & cash management",
        PermifyTenantRole.TREASURY_MANAGER.value: "Treasury Manager — treasury & billing",
        PermifyTenantRole.LOAN_OFFICER.value: "Loan Officer — loan applications",
        PermifyTenantRole.COMPLIANCE_OFFICER.value: "Compliance Officer — KYC & sanctions",
        PermifyTenantRole.SUPPORT_AGENT.value: "Support Agent — customer support",
        PermifyTenantRole.TELLER.value: "Teller — counter deposits, withdrawals & transactions",
        PermifyTenantRole.FRAUD_ANALYST.value: "Fraud Analyst — fraud monitoring & case management",
    }

    @staticmethod
    def validate_platform_role(role: str) -> bool:
        """Return True if the role is a valid v2.perm `platform` relation."""
        return role in RoleMapper.PLATFORM_ROLE_LABELS

    @staticmethod
    def validate_tenant_role(role: str) -> bool:
        """Return True if the role is a valid v2.perm `tenants` relation."""
        return role in RoleMapper.TENANT_ROLE_LABELS

    @staticmethod
    def get_platform_role_label(role: str) -> str:
        """Return a human-readable label for a platform role."""
        return RoleMapper.PLATFORM_ROLE_LABELS.get(
            role, f"Unknown platform role: {role}"
        )

    @staticmethod
    def get_tenant_role_label(role: str) -> str:
        """Return a human-readable label for a tenant role."""
        return RoleMapper.TENANT_ROLE_LABELS.get(role, f"Unknown tenant role: {role}")

    @staticmethod
    def get_default_roles_for_user_role(
        user_role: UserRole,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Return (platform_role, tenant_role) defaults based on Keycloak UserRole.

        Used when neither platform_role nor tenant_role is explicitly provided
        at creation time. Both roles are assigned so the user has access at
        both the 54link platform level and the tenant level from day one.

          SUPERADMIN → platform:super_admin  + tenants:super_admin   (full access everywhere)
          ADMIN      → platform:operations_manager + tenants:operations_manager
          USER/GUEST → (None, None) — assign explicitly via /permissions API
        """
        mapping = {
            UserRole.SUPERADMIN: (
                PermifyPlatformRole.SUPER_ADMIN.value,
                PermifyTenantRole.SUPER_ADMIN.value,
            ),
            UserRole.ADMIN: (
                PermifyPlatformRole.OPERATIONS_MANAGER.value,
                PermifyTenantRole.OPERATIONS_MANAGER.value,
            ),
            UserRole.USER: (None, None),
            UserRole.GUEST: (None, None),
        }
        return mapping.get(user_role, (None, None))

    @staticmethod
    def get_default_platform_role_for_user_role(user_role: UserRole) -> Optional[str]:
        """Kept for backwards compatibility — prefer get_default_roles_for_user_role."""
        platform_role, _ = RoleMapper.get_default_roles_for_user_role(user_role)
        return platform_role

    @staticmethod
    def get_all_platform_roles() -> dict:
        """Return all valid platform roles with their descriptions."""
        return dict(RoleMapper.PLATFORM_ROLE_LABELS)

    @staticmethod
    def get_all_tenant_roles() -> dict:
        """Return all valid tenant roles with their descriptions."""
        return dict(RoleMapper.TENANT_ROLE_LABELS)
