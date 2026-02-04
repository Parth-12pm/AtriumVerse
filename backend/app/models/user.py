from sqlalchemy import Column, String , DateTime,Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID 
import uuid
from datetime import datetime
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True),primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True,nullable=False)
    email = Column(String, unique=True,index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owned_servers = relationship("Server", back_populates="owner")
    memberships = relationship("ServerMember", back_populates="user")