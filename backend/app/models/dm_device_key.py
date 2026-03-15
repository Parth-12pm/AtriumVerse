import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class DmDeviceKey(Base):
    """
    Per-device ciphertext for a single direct message.

    For each DM sent, one row is created per device that should be able to read it:
      - All trusted devices of the recipient
      - All trusted devices of the sender (so they can read their own sent messages
        on their other devices)

    WHY device_id IS SET NULL (NOT CASCADE) ON DEVICE DELETE:
    ─────────────────────────────────────────────────────────
    If CASCADE were used, deleting a device would silently destroy all its ciphertext
    rows. The frontend would then see device_id=NULL and have no way to distinguish:

      Situation A: device_id IS NULL + deleted_device_id IS NOT NULL
        → "This message was encrypted for a device that was later deleted."
        → UI: "Message was encrypted for a device you removed."

      Situation B: device_id IS NULL + deleted_device_id IS NULL
        → "This message was sent before this device existed — no row was ever created."
        → UI: "This message predates this device."

    These situations require entirely different UI messages. CASCADE permanently
    collapses both into identical nulls, destroying the information forever.

    When a device is deleted, a cleanup job must:
      UPDATE dm_device_keys
      SET device_id = NULL, deleted_device_id = <deleted device's id>
      WHERE device_id = <deleted device's id>
    """

    __tablename__ = "dm_device_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    dm_id = Column(
        UUID(as_uuid=True),
        ForeignKey("direct_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # SET NULL — see docstring above. This FK intentionally does not cascade.
    device_id = Column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Populated by a cleanup job when device_id is set to NULL after device deletion.
    # Allows frontend to distinguish Situation A from Situation B (see docstring).
    deleted_device_id = Column(UUID(as_uuid=True), nullable=True)

    # base64(IV + AES-256-GCM ciphertext) — encrypted specifically for this device
    encrypted_ciphertext = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    device = relationship("Device", backref="dm_keys")

    __table_args__ = (
        # Partial unique index: a device should have at most one ciphertext row per DM.
        # WHERE device_id IS NOT NULL — partial because device_id can be null (deleted device),
        # and we allow multiple NULL rows (one per deleted device that had access).
        Index(
            "uq_dm_device_key_active",
            "dm_id",
            "device_id",
            unique=True,
            postgresql_where="device_id IS NOT NULL",
        ),
    )
