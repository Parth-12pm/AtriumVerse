from sqlalchemy import Column , String , ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid 
from datetime import datetime
from sqlalchemy.orm import relationship
from app.core.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    #foreingkey 
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    #relation 
    host = relationship("User", backref="rooms")