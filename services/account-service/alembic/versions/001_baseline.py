"""baseline: account table (pre-002 shape with legacy String balance)

Revision ID: 001
Revises:
Create Date: 2026-06-11

PL-04: restores the missing chain root. Revision 002 referenced
down_revision="001" but no 001 file existed, breaking `alembic upgrade head`
from a fresh database. This baseline creates the account table exactly as it
existed BEFORE the 002 kobo migration (legacy `balance` String column, no
balance_kobo/version columns) so 002's expand-migrate-contract can run.
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("keycloak_id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("ledger_id", sa.String(), nullable=False),
        sa.Column("account_number", sa.String(), nullable=False, unique=True),
        # Legacy unreliable string balance — migrated to balance_kobo in 002.
        sa.Column("balance", sa.String(), nullable=False, server_default="0"),
        sa.Column("pin", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="ACTIVE"),
        sa.Column("account_type", sa.String(), nullable=False, server_default="PRIMARY"),
        sa.Column("account_currency", sa.String(), nullable=False, server_default="NGN"),
        sa.Column("created_at", sa.TIMESTAMP(), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("account")
