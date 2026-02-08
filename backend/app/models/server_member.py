from sqlalchemy import Column , String , ForeignKey , DateTime , Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum

class MemberRole(str,enum.Enum):
    OWNER = "owner"
    MEMBER = "member"
    GUEST = "guest"

class MemberStatus(str,enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    BANNED = "banned"


class ServerMember(Base):
    __tablename__ = "server_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)

    role = Column(String, default=MemberRole.MEMBER)
    status = Column(String, default=MemberStatus.ACCEPTED)


    last_position_x = Column(Integer,nullable=True)
    last_position_y = Column(Integer, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    joined_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    server = relationship("Server", back_populates="members")