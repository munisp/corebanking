"""add is_verified to user

Revision ID: 003
Revises: 002
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("user", "is_verified")
