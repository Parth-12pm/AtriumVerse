"""rename device_label

Revision ID: 7ced522a51c3
Revises: 9d2b4ec6e7a1
Create Date: 2026-03-12 19:46:20.517547

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ced522a51c3'
down_revision: Union[str, Sequence[str], None] = '9d2b4ec6e7a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('device_link_requests', 'device_label',
                    new_column_name='new_device_label')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('device_link_requests', 'new_device_label',
                    new_column_name='device_label')
