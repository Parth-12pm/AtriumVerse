from sqlalchemy import Column, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class ChannelEncryption(Base):
    """
    Tracks per-channel encryption state and the current epoch number.

    One row per channel, but only created when encryption is enabled on that
    channel. Channels without a row here are completely unencrypted and
    untouched by the E2EE system — zero pollution of existing plaintext channels.

    Epoch:
      The epoch number increments each time channel membership changes (a member
      is removed). The new epoch gets a fresh channel_key. Removed members hold
      no key for the new epoch — they can still decrypt old messages (their epoch
      key still exists) but cannot decrypt new ones.
    """
    __tablename__ = "channel_encryption"

    # channel_id is both PK and FK — one row per channel, max.
    channel_id = Column(
        UUID(as_uuid=True),
        ForeignKey("channels.id", ondelete="CASCADE"),
        primary_key=True,
    )

    is_enabled = Column(Boolean, default=False, nullable=False)
    current_epoch = Column(Integer, default=1, nullable=False)
    epoch_rotated_at = Column(DateTime, default=datetime.utcnow)

    # Relationship back to Channel
    channel = relationship("Channel", backref="encryption_state")
