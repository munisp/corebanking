"""balance_kobo, RLS, version, idempotency, audit

Revision ID: 002
Revises: 001
Create Date: 2026-06-11

Migrates:
  - account.balance (String) → balance_kobo (BIGINT kobo)
  - Adds version column for optimistic locking
  - Adds RLS policy on tenant_id
  - Creates account_idempotency table
  - Creates account_audit table
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add balance_kobo (BIGINT) — backfill from existing balance string.
    #    Old balance column was unreliable (String, "Not trust-worthy") so default=0 is safe.
    op.add_column("account", sa.Column("balance_kobo", sa.BigInteger(), nullable=False, server_default="0"))

    # 2. Drop the old string balance column — it was never trustworthy.
    op.drop_column("account", "balance")

    # 3. Optimistic locking version column.
    op.add_column("account", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))

    # 4. soft-delete column (if not already present via SoftDeleteMixin).
    op.execute("""
        ALTER TABLE account ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
    """)

    # 5. Enable RLS and create tenant isolation policy.
    op.execute("ALTER TABLE account ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE account FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY account_tenant_isolation ON account
            USING (tenant_id = current_setting('app.tenant_id', true));
    """)

    # 6. Idempotency table — deduplicates requests within 24h TTL.
    op.execute("""
        CREATE TABLE IF NOT EXISTS account_idempotency (
            idempotency_key TEXT        NOT NULL,
            tenant_id       TEXT        NOT NULL,
            response_body   JSONB       NOT NULL DEFAULT '{}',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
            PRIMARY KEY (tenant_id, idempotency_key)
        );
    """)
    op.execute("ALTER TABLE account_idempotency ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY account_idempotency_tenant ON account_idempotency
            USING (tenant_id = current_setting('app.tenant_id', true));
    """)

    # 7. Audit table — append-only ledger of every account mutation.
    op.execute("""
        CREATE TABLE IF NOT EXISTS account_audit (
            id              BIGSERIAL   PRIMARY KEY,
            account_id      INTEGER     NOT NULL,
            tenant_id       TEXT        NOT NULL,
            action          TEXT        NOT NULL,          -- create, update, close, reopen
            old_balance_kobo BIGINT,
            new_balance_kobo BIGINT,
            changed_by      TEXT,
            changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            metadata        JSONB       NOT NULL DEFAULT '{}'
        );
    """)
    op.execute("ALTER TABLE account_audit ENABLE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY account_audit_tenant ON account_audit
            USING (tenant_id = current_setting('app.tenant_id', true));
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_account_audit_account ON account_audit(account_id, changed_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_account_audit_tenant  ON account_audit(tenant_id, changed_at DESC);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS account_audit;")
    op.execute("DROP TABLE IF EXISTS account_idempotency;")
    op.execute("DROP POLICY IF EXISTS account_tenant_isolation ON account;")
    op.execute("ALTER TABLE account DISABLE ROW LEVEL SECURITY;")
    op.drop_column("account", "version")
    op.add_column("account", sa.Column("balance", sa.String(), nullable=False, server_default="0"))
    op.drop_column("account", "balance_kobo")
