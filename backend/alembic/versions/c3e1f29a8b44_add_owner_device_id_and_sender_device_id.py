"""add_owner_device_id_and_sender_device_id

Revision ID: c3e1f29a8b44
Revises: a283527ab996
Create Date: 2026-03-10 16:52:00.000000

Adds two missing columns that are in the models but were not included in earlier migrations:

  1. channel_device_keys.owner_device_id (FK -> devices, SET NULL)
     Used by GET /channel-keys/{id}/my-key and /entitled-epochs to return the
     owner_device_public_key, which the frontend needs for the ECDH step in the
     epoch key reconstruction chain.

  2. direct_messages.sender_device_id (FK -> devices, SET NULL, nullable)
     Used by GET /DM/messages/{user_id} to return the sender's public key for
     decryption. SET NULL so that soft-deleted devices don't destroy the message
     metadata.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e1f29a8b44'
down_revision: Union[str, Sequence[str], None] = 'a283527ab996'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add owner_device_id to channel_device_keys
    op.add_column(
        'channel_device_keys',
        sa.Column('owner_device_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_channel_device_keys_owner_device_id',
        'channel_device_keys', 'devices',
        ['owner_device_id'], ['id'],
        ondelete='SET NULL'
    )

    # 2. Add sender_device_id to direct_messages
    op.add_column(
        'direct_messages',
        sa.Column('sender_device_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_direct_messages_sender_device_id',
        'direct_messages', 'devices',
        ['sender_device_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_direct_messages_sender_device_id', 'direct_messages', type_='foreignkey')
    op.drop_column('direct_messages', 'sender_device_id')

    op.drop_constraint('fk_channel_device_keys_owner_device_id', 'channel_device_keys', type_='foreignkey')
    op.drop_column('channel_device_keys', 'owner_device_id')
