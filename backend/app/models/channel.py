from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ChannelType(str, enum.Enum):
    TEXT = "text"
    ANNOUNCEMENTS = "announcements"
    VOICE = "voice"  # For future


class Channel(Base):
    """
    Permanent channels within a server.
    These persist across sessions - messages are stored.
    """
    __tablename__ = "channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    
    name = Column(String, nullable=False)
    type = Column(String, default=ChannelType.TEXT)
    description = Column(String, nullable=True)
    
    # Ordering
    position = Column(Integer, default=0)
    
    # Permissions (future: can be more granular)
    is_public = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    server = relationship("Server", back_populates="channels")
    messages = relationship("Message", back_populates="channel", cascade="all, delete-orphan")