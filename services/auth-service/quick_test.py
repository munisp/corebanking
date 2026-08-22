#!/usr/bin/env python3
"""
Permify integration smoke test — assertion-based.

H-40 remediation: every test previously returned True/False and only printed
a checkmark; under pytest a returned False does NOT fail the test, so the
whole module could report green while every check failed. All checks are now
hard `assert`s. These tests require a live Permify at PERMIFY_URL and fail
loudly when it is unreachable.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

if not os.getenv("PERMIFY_URL"):
    os.environ["PERMIFY_URL"] = "http://localhost:3476"


def test_imports():
    """The Permify adapter and permission manager must be importable and complete."""
    import importlib

    permify = importlib.import_module("adapters.permify")
    for fn in ("load_schema", "check_permission", "assign_role"):
        assert callable(getattr(permify, fn)), f"adapters.permify.{fn} missing"

    permissions = importlib.import_module("utils.permissions")
    assert callable(getattr(permissions, "PermissionManager")), "PermissionManager missing"


def test_schema_load():
    """Schema load must complete without raising."""
    from adapters.permify import load_schema
    load_schema()


def test_permission_denied_before_role_assignment():
    """A fresh user must NOT hold a privileged permission (fail-closed default)."""
    from adapters.permify import check_permission
    result = check_permission(
        user_id="h40-fresh-user",
        tenant_id="54link",
        permission="view_all_data",
        entity_type="platform",
        entity_id="default",
    )
    assert result is False, f"fresh user must be denied view_all_data, got {result}"


def test_role_assignment_grants_permission():
    """Assigning a role must grant its permissions, and only those."""
    from adapters.permify import assign_role, check_permission
    ok = assign_role(
        user_id="h40-test-user",
        tenant_id="54link",
        role="super",
        entity_type="platform",
        entity_id="default",
    )
    assert ok is True, "assign_role(super) must succeed against a live Permify"

    has = check_permission(
        user_id="h40-test-user",
        tenant_id="54link",
        permission="view_all_data",
        entity_type="platform",
        entity_id="default",
    )
    assert has is True, "assigned super role must grant view_all_data"


def test_permission_manager_roundtrip():
    """PermissionManager must grant the mapped permission after role assignment."""
    from utils.permissions import PermissionManager
    pm = PermissionManager()

    ok = pm.assign_platform_role(
        user_id="h40-pm-user", tenant_id="54link", role="analyst", platform_id="default"
    )
    assert ok is True, "assign_platform_role(analyst) must succeed"

    has_perm = pm.check_user_permission(
        user_id="h40-pm-user",
        tenant_id="54link",
        permission="view_analytics",
        entity_type="platform",
        entity_id="default",
    )
    assert has_perm is True, "analyst role must grant view_analytics"

    denied = pm.check_user_permission(
        user_id="h40-pm-user",
        tenant_id="54link",
        permission="manage_tenants",
        entity_type="platform",
        entity_id="default",
    )
    assert denied is False, "analyst role must NOT grant manage_tenants"


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(tests)} tests passed")
