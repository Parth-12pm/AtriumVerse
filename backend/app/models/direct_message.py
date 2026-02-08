from sqlalchemy import Column, ForeignKey, DateTime, Text, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
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
    
    content = Column(Text, nullable=False)
    
    # Editing
    edited_at = Column(DateTime, nullable=True)
    is_deleted = Column(Boolean, default=False)
    
    # Read status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="received_messages")
    
    # Index for efficient conversation queries
    __table_args__ = (
        Index('idx_dm_conversation', 'sender_id', 'receiver_id'),
        Index('idx_dm_receiver_unread', 'receiver_id', 'is_read'),
    )