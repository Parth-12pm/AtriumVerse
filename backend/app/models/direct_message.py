import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class DirectMessage(Base):
    """
    Direct messages between two users (1-on-1 chat).
    Persisted in database.
    """

    __tablename__ = "direct_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    content = Column(
        Text, nullable=False
    )  # stays NOT NULL — encrypted DMs write "[encrypted]" here

    # E2EE columns (additive — all nullable so existing rows are unaffected)
    ciphertext = Column(Text, nullable=True)  # base64(IV + AES-256-GCM ciphertext)
    epoch = Column(Integer, nullable=True)  # per-conversation epoch at time of send
    is_encrypted = Column(Boolean, default=False)  # False for all pre-E2EE messages
    sender_device_id = Column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True
    )

    # Editing
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)

    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    receiver = relationship(
        "User", foreign_keys=[receiver_id], backref="received_messages"
    )

    # Index for efficient conversation queries
    __table_args__ = (
        Index("idx_dm_conversation", "sender_id", "receiver_id"),
        Index("idx_dm_receiver_unread", "receiver_id", "is_read"),
    )
