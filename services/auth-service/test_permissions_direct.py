#!/usr/bin/env python3
"""
Permission tests for the v2.perm schema — assertion-based.

H-40 remediation: the previous version printed checkmarks for every outcome
(including "Yes (ERROR!)" when a permission was wrongly granted) and always
exited 0. Every expectation is now a hard `assert`, so a wrongly-granted
permission actually fails the test.

Requires a live Permify (PERMIFY_URL); failures are loud.
"""

import logging
import time

from utils.permissions import PermissionManager
from utils.enums import PermifyPlatformRole, PermifyTenantRole

pm = PermissionManager()
TENANT_ID = "54link"


def _cleanup():
    """Remove any leftover test roles so each run starts from a clean slate."""
    logging.getLogger("adapters.permify").setLevel(logging.CRITICAL)
    user_ids = [
        "h40-user-super", "h40-user-support", "h40-user-auditor",
        "h40-user-branch-mgr", "h40-user-loan-officer", "h40-user-to-revoke",
    ]
    for user_id in user_ids:
        for role in [r.value for r in PermifyPlatformRole]:
            pm.revoke_role(user_id, TENANT_ID, role, "platform", "default")
        for role in [r.value for r in PermifyTenantRole]:
            pm.revoke_role(user_id, TENANT_ID, role, "tenants", TENANT_ID)
    logging.getLogger("adapters.permify").setLevel(logging.INFO)
    time.sleep(0.5)  # let Permify consistency settle


def test_platform_role_assignment_grants_mapped_permissions():
    _cleanup()
    cases = [
        ("h40-user-super", PermifyPlatformRole.SUPER_ADMIN.value, "manage_tenants"),
        ("h40-user-support", PermifyPlatformRole.SUPPORT_AGENT.value, "provide_support"),
        ("h40-user-auditor", PermifyPlatformRole.INTERNAL_AUDITOR.value, "view_audit_logs"),
    ]
    for user_id, role, permission in cases:
        ok = pm.assign_platform_role(
            user_id=user_id, tenant_id=TENANT_ID, role=role, platform_id="default"
        )
        assert ok is True, f"assign_platform_role({role}) failed for {user_id}"
        has_perm = pm.check_user_permission(
            user_id=user_id, tenant_id=TENANT_ID,
            permission=permission, entity_type="platform", entity_id="default",
        )
        assert has_perm is True, f"{role} must grant {permission}"


def test_tenant_role_assignment_grants_mapped_permissions():
    cases = [
        ("h40-user-branch-mgr", PermifyTenantRole.BRANCH_MANAGER.value, "manage_employees"),
        ("h40-user-loan-officer", PermifyTenantRole.LOAN_OFFICER.value, "process_loans"),
    ]
    for user_id, role, permission in cases:
        ok = pm.assign_tenant_role(
            user_id=user_id, tenant_id=TENANT_ID, role=role, tenant_entity_id=TENANT_ID
        )
        assert ok is True, f"assign_tenant_role({role}) failed for {user_id}"
        has_perm = pm.check_user_permission(
            user_id=user_id, tenant_id=TENANT_ID,
            permission=permission, entity_type="tenants", entity_id=TENANT_ID,
        )
        assert has_perm is True, f"{role} must grant {permission}"


def test_permissions_not_granted_outside_role():
    """Least privilege: roles must NOT grant permissions outside their mapping."""
    has_perm = pm.check_user_permission(
        user_id="h40-user-support", tenant_id=TENANT_ID,
        permission="manage_tenants", entity_type="platform", entity_id="default",
    )
    assert has_perm is False, "support_agent must NOT manage_tenants"

    has_perm = pm.check_user_permission(
        user_id="h40-user-loan-officer", tenant_id=TENANT_ID,
        permission="manage_employees", entity_type="tenants", entity_id=TENANT_ID,
    )
    assert has_perm is False, "loan_officer must NOT manage_employees"


def test_role_revocation_removes_permission():
    user_id = "h40-user-to-revoke"
    role = PermifyPlatformRole.OPERATIONS_MANAGER.value
    pm.assign_platform_role(user_id=user_id, tenant_id=TENANT_ID, role=role, platform_id="default")

    ok = pm.revoke_role(
        user_id=user_id, tenant_id=TENANT_ID, role=role,
        entity_type="platform", entity_id="default",
    )
    assert ok is True, "revoke_role must succeed"

    has_perm = pm.check_user_permission(
        user_id=user_id, tenant_id=TENANT_ID,
        permission="provide_support", entity_type="platform", entity_id="default",
    )
    assert has_perm is False, "revoked role must no longer grant permissions"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
