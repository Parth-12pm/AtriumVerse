"""some changes

Revision ID: efed589eb984
Revises: 7ced522a51c3
Create Date: 2026-03-12 20:45:51.664353

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efed589eb984'
down_revision: Union[str, Sequence[str], None] = '7ced522a51c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
