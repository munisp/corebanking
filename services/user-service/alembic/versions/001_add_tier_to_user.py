"""Add tier column to user table

Revision ID: 001
Revises:
Create Date: 2026-05-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user",
        sa.Column("tier", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_check_constraint("ck_user_tier", "user", "tier IN (1, 2, 3)")


def downgrade() -> None:
    op.drop_constraint("ck_user_tier", "user", type_="check")
    op.drop_column("user", "tier")
