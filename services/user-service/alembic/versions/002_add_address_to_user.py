"""add address columns to user

Revision ID: 002
Revises: 001
Create Date: 2026-05-21
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user", sa.Column("address", sa.String(), nullable=True))
    op.add_column("user", sa.Column("city", sa.String(), nullable=True))
    op.add_column("user", sa.Column("state", sa.String(), nullable=True))
    op.add_column("user", sa.Column("postal_code", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("user", "postal_code")
    op.drop_column("user", "state")
    op.drop_column("user", "city")
    op.drop_column("user", "address")
