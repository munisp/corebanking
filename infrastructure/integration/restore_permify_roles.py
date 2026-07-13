#!/usr/bin/env python3
"""
Permify role restore script.

Reads all admin users from the auth DB and re-assigns their Permify roles.

Role mapping:
  SUPERADMIN → platform:super_admin  on platform:{tenant_id}
              + tenants:super_admin   on tenants:{tenant_id}
  ADMIN      → tenants:operations_manager on tenants:{tenant_id}
  USER/GUEST → no Permify role (customers, not staff)

Usage:
  # Ensure port-forward is running first:
  kubectl port-forward -n permify svc/permify 3476:3476 &

  # Then run:
  python3 restore_permify_roles.py

  # Dry-run (shows what would be written, makes no changes):
  python3 restore_permify_roles.py --dry-run

  # Restore a single specific user:
  python3 restore_permify_roles.py --user-id <keycloak_id> --role super_admin --tenant-id bpmgd
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────
DB_URI = (
    "postgresql://doadmin:AVNS_MSy6CW3EGXnA8wJgkLv"
    "@db-postgresql-nyc1-18193-do-user-10555812-0.e.db.ondigitalocean.com"
    ":25060/link_core_banking"
)
PERMIFY_URL = "http://localhost:3476"
WRITE_ATTEMPTS = 3  # Postgres-backed Permify only needs 1, but retry for safety

# Load schema content once at startup
_SCHEMA_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../../services/auth-service/schemas/permify/v2.perm",
)
try:
    with open(_SCHEMA_PATH) as _f:
        SCHEMA_CONTENT = _f.read()
except FileNotFoundError:
    SCHEMA_CONTENT = None
    print(f"WARNING: schema file not found at {_SCHEMA_PATH}", file=sys.stderr)

# ── Helpers ───────────────────────────────────────────────────────────────────

def permify_request(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{PERMIFY_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise RuntimeError(f"Permify {path} → HTTP {e.code}: {body}")


def ensure_tenant_and_schema(tenant_id: str, dry_run: bool) -> bool:
    """Create tenant (if missing) and deploy schema to it."""
    if dry_run:
        return True

    # 1. Create tenant — ignore unique-constraint error (already exists)
    try:
        permify_request("/v1/tenants/create", {"id": tenant_id, "name": tenant_id.upper()})
    except RuntimeError as e:
        if "UNIQUE_CONSTRAINT" not in str(e) and "already exists" not in str(e).lower():
            print(f"  ⚠ tenant create warning for {tenant_id}: {e}", file=sys.stderr)

    # 2. Deploy schema
    if not SCHEMA_CONTENT:
        print(f"  ✗ cannot deploy schema to {tenant_id}: schema file not loaded", file=sys.stderr)
        return False
    try:
        permify_request(
            f"/v1/tenants/{tenant_id}/schemas/write",
            {"schema": SCHEMA_CONTENT},
        )
        return True
    except RuntimeError as e:
        print(f"  ✗ schema write failed for {tenant_id}: {e}", file=sys.stderr)
        return False


def write_relationship(tenant_id: str, entity_type: str, entity_id: str,
                       relation: str, user_id: str, dry_run: bool) -> bool:
    payload = {
        "metadata": {"schema_version": ""},
        "tuples": [{
            "entity": {"type": entity_type, "id": entity_id},
            "relation": relation,
            "subject": {"type": "user", "id": user_id},
        }],
    }
    tag = f"{entity_type}:{entity_id}#{relation}@user:{user_id}"
    if dry_run:
        print(f"  [dry-run] would write → {tag}")
        return True
    for attempt in range(1, WRITE_ATTEMPTS + 1):
        try:
            permify_request(f"/v1/tenants/{tenant_id}/relationships/write", payload)
            print(f"  ✓ wrote → {tag}")
            return True
        except Exception as err:
            if attempt == WRITE_ATTEMPTS:
                print(f"  ✗ failed ({attempt} attempts) → {tag}: {err}", file=sys.stderr)
                return False
    return False


# Valid Permify v2.perm tenant roles
VALID_TENANT_ROLES = {
    "super_admin", "branch_manager", "operations_manager", "risk_manager",
    "internal_auditor", "it_admin", "relationship_manager", "trade_finance_admin",
    "vault_manager", "treasury_manager", "loan_officer", "compliance_officer",
    "support_agent",
}

# Legacy numeric access_level → Permify role mapping
# 0 = lowest staff (operations), 3 = mid-level, 7 = regular admin, 8 = high admin
NUMERIC_LEVEL_MAP = {
    "0": "operations_manager",
    "3": "operations_manager",
    "7": "operations_manager",
    "8": "super_admin",
}


def map_access_level(access_level) -> str | None:
    """Map an admin.access_level value to a Permify role name, or None to skip."""
    if not access_level:
        return None
    val = str(access_level).strip()
    if val in VALID_TENANT_ROLES:
        return val
    if val in NUMERIC_LEVEL_MAP:
        return NUMERIC_LEVEL_MAP[val]
    return None


def get_users_from_db():
    """
    Query the admin table: returns rows of (keycloak_id, access_level, tenant_id).
    Falls back to auth table if admin table is unavailable.
    Tries psycopg2 first, then pg8000 (pure Python).
    """
    # admin table has accurate per-user Permify role in access_level column
    query = (
        "SELECT keycloak_id, access_level, tenant_id "
        "FROM admin "
        "WHERE deleted_at IS NULL AND keycloak_id IS NOT NULL "
        "ORDER BY tenant_id, access_level"
    )

    def _run(conn, cur=None):
        if cur:
            cur.execute(query)
            return cur.fetchall()
        return conn.run(query)

    # Try psycopg2
    try:
        import psycopg2
        conn = psycopg2.connect(DB_URI + "?sslmode=require")
        cur = conn.cursor()
        rows = _run(conn, cur)
        conn.close()
        return rows
    except ImportError:
        pass

    # Try pg8000 (pure Python)
    try:
        import pg8000.native as pg
        import re
        m = re.match(r"postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", DB_URI)
        if not m:
            raise ValueError("Cannot parse DB_URI")
        user, password, host, port, database = m.groups()
        conn = pg.Connection(user, host=host, port=int(port),
                             password=password, database=database, ssl_context=True)
        rows = _run(conn)
        conn.close()
        return rows
    except ImportError:
        pass

    raise RuntimeError(
        "No PostgreSQL driver found. Install one:\n"
        "  pip3 install psycopg2-binary   # or: pip3 install pg8000"
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def restore(dry_run: bool):
    print("Fetching users from auth DB…")
    rows = get_users_from_db()
    print(f"Found {len(rows)} user(s)\n")

    # Ensure every tenant has a schema before writing any relationships
    unique_tenants = sorted({tenant_id for _, _, tenant_id in rows})
    print(f"Provisioning {len(unique_tenants)} tenant(s): {', '.join(unique_tenants)}\n")
    for tid in unique_tenants:
        if not dry_run:
            ensure_tenant_and_schema(tid, dry_run=False)

    ok = err = skip = 0
    numeric_warnings = []

    for keycloak_id, raw_access_level, tenant_id in rows:
        raw = str(raw_access_level).strip() if raw_access_level else ""
        permify_role = map_access_level(raw)
        print(f"User {keycloak_id} | access_level={raw!r} → role={permify_role} | tenant={tenant_id}")

        if permify_role is None:
            print(f"  — skipped (access_level={raw!r} has no mapping)")
            skip += 1
            continue

        if raw not in VALID_TENANT_ROLES and raw:
            numeric_warnings.append((keycloak_id, raw, permify_role, tenant_id))

        if permify_role == "super_admin":
            # super_admin gets roles on both platform and tenants entities
            for entity_type, entity_id in [("platform", tenant_id), ("tenants", tenant_id)]:
                if write_relationship(tenant_id, entity_type, entity_id,
                                      permify_role, keycloak_id, dry_run):
                    ok += 1
                else:
                    err += 1
        else:
            if write_relationship(tenant_id, "tenants", tenant_id,
                                  permify_role, keycloak_id, dry_run):
                ok += 1
            else:
                err += 1

    print(f"\n{'[DRY RUN] ' if dry_run else ''}Done: {ok} written, {err} failed, {skip} skipped")

    if numeric_warnings:
        print(f"\n⚠ {len(numeric_warnings)} user(s) had legacy numeric access_level — mapped to defaults:")
        print("  Review and manually re-assign if their actual role differs:")
        for uid, raw, role, tid in numeric_warnings:
            print(f"    {uid} | was={raw!r} → assigned={role} | tenant={tid}")


def restore_single(user_id: str, role: str, tenant_id: str, dry_run: bool):
    entity_type = "platform" if role in (
        "super_admin", "tenant_manager", "operations_manager", "risk_manager",
        "internal_auditor", "it_admin", "relationship_manager",
        "compliance_officer", "support_agent",
    ) else "tenants"

    # For super_admin write to both entities
    if role == "super_admin":
        for et, eid in [("platform", tenant_id), ("tenants", tenant_id)]:
            write_relationship(tenant_id, et, eid, role, user_id, dry_run)
    else:
        write_relationship(tenant_id, entity_type, tenant_id, role, user_id, dry_run)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restore Permify roles from auth DB")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be written without making changes")
    parser.add_argument("--user-id", help="Restore a single specific user")
    parser.add_argument("--role", help="Role to assign (used with --user-id)")
    parser.add_argument("--tenant-id", default="bpmgd",
                        help="Tenant ID (default: bpmgd)")
    args = parser.parse_args()

    # Verify Permify is reachable
    try:
        resp = permify_request("/healthz", {})
    except Exception:
        try:
            req = urllib.request.Request(f"{PERMIFY_URL}/healthz", method="GET")
            with urllib.request.urlopen(req, timeout=5) as r:
                resp = json.loads(r.read())
        except Exception as e:
            print(f"ERROR: Cannot reach Permify at {PERMIFY_URL}: {e}", file=sys.stderr)
            print("Run: kubectl port-forward -n permify svc/permify 3476:3476 &", file=sys.stderr)
            sys.exit(1)

    if args.user_id:
        if not args.role:
            print("--role is required with --user-id", file=sys.stderr)
            sys.exit(1)
        restore_single(args.user_id, args.role, args.tenant_id, args.dry_run)
    else:
        restore(args.dry_run)
