"""store PRF verification material

Revision ID: 9d2b4ec6e7a1
Revises: 215e2cfe7ce1
Create Date: 2026-03-11 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9d2b4ec6e7a1"
down_revision: str | Sequence[str] | None = "215e2cfe7ce1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "key_backups",
        sa.Column("prf_credential_public_key", sa.String(), nullable=True),
    )
    op.add_column(
        "key_backups", sa.Column("prf_sign_count", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("key_backups", "prf_sign_count")
    op.drop_column("key_backups", "prf_credential_public_key")
