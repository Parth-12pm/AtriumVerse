from sqlalchemy import Column , String , ForeignKey , DateTime
from sqlalchemy.dialects.postgresql import UUID , JSONB
import uuid
import enum
from datetime import datetime
from sqlalchemy.orm import relationship
from app.core.database import Base

class ServerAccessType(str , enum.Enum):
    PUBLIC = "public"
    PRIVATE = "private"

class Server(Base):
    __tablename__ = "servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    map_config = Column(JSONB)
    created_at = Column(DateTime,default=datetime.utcnow)
    access_type = Column(String, default=ServerAccessType.PUBLIC)

    owner = relationship("User", back_populates="owned_servers")
    zones = relationship("Zone", back_populates="server")
    members = relationship("ServerMember", back_populates="server")
    
    # NEW: Permanent channels
    channels = relationship("Channel", back_populates="server", cascade="all, delete-orphan")