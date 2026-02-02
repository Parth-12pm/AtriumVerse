from sqlalchemy import Column , String , ForeignKey , DateTime
from sqlalchemy.dialects.postgresql import UUID , JSONB
import uuid
from datetime import datetime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Server(Base):
    __tablename__ = "servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    map_config = Column(JSONB)
    created_at = Column(DateTime,default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_servers")
    zones = relationship("Zone", back_populates="server")