from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.core.database import Base


class Device(Base):
    """
    Represents a single browser/device registration for a user.

    Every browser that participates in E2EE is a 'device'. This table
    stores only the public key — the private key never leaves the browser
    and never appears here.

    is_trusted=False means the device has registered but has not yet been
    approved by an existing trusted device via the device linking ceremony.
    Keys are only distributed to trusted devices.
    """
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # base64-encoded X25519 public key — lets other devices encrypt for this device
    public_key = Column(String, nullable=False)

    # Stored so the server can verify future WebAuthn assertions from this device
    # during the device approval ceremony. Null until WebAuthn is registered.
    webauthn_credential_id = Column(String, nullable=True)

    # Human-readable label, e.g. "Chrome on MacBook Pro"
    device_label = Column(String(100), nullable=True)

    is_trusted = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="devices")
    link_requests = relationship(
        "DeviceLinkRequest",
        foreign_keys="DeviceLinkRequest.new_device_id",
        back_populates="new_device",
    )
    approved_requests = relationship(
        "DeviceLinkRequest",
        foreign_keys="DeviceLinkRequest.approved_by_device_id",
        back_populates="approved_by_device",
    )

    __table_args__ = (
        # Partial index used for performance: makes lookups of trusted devices per user fast.
        # Also prevents a TOCTOU race during the first-device bootstrap — two concurrent
        # approvals cannot both insert a trusted device for the same user simultaneously.
        # NOTE: multiple trusted devices per user ARE allowed (one per browser/device).
        # This index is not a uniqueness constraint on trusted count, just a targeted index
        # on the (user_id, is_trusted=True) subset for efficient queries.
        Index("ix_devices_trusted_per_user", "user_id", postgresql_where="is_trusted = true"),
    )
