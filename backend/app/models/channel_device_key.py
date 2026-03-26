import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChannelDeviceKey(Base):
    """
    Stores the channel key, ECDH-wrapped specifically for one device, for one epoch.

    One row = one device's copy of the channel key for a specific epoch.
    Each device gets its own encrypted blob — the key is wrapped using ECDH between
    the distributing device's private key and this device's public key.

    ROWS ARE NEVER DELETED.
    Deleting them makes historical messages permanently unreadable for that device.
    If a device is removed from a channel, a new epoch begins and new rows are created
    for the remaining devices — but old rows stay intact for historical decryption.

    The epoch column is part of the unique constraint because a device legitimately holds
    keys for multiple epochs simultaneously (epoch 1 for old messages, epoch 2 for new).
    """

    __tablename__ = "channel_device_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    channel_id = Column(
        UUID(as_uuid=True),
        ForeignKey("channels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id = Column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    epoch = Column(Integer, nullable=False)

    # base64(IV_12_bytes + AES-256-GCM ciphertext of channel_key)
    # The channel_key was ECDH-derived between distributing device and this device
    encrypted_channel_key = Column(Text, nullable=False)

    owner_device_id = Column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    device = relationship("Device", backref="channel_keys", foreign_keys=[device_id])
    owner_device = relationship("Device", foreign_keys=[owner_device_id])

    __table_args__ = (
        # A device should receive the channel key for a given epoch exactly once.
        UniqueConstraint(
            "channel_id", "device_id", "epoch", name="uq_channel_device_epoch"
        ),
    )
