from app.core.database import Base
from sqlalchemy import Column , String , ForeignKey
from sqlalchemy.dialects.postgresql import JSONB , UUID
import uuid
from sqlalchemy.orm import relationship


class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False, default="PUBLIC")
    bounds = Column(JSONB)

    server = relationship("Server",back_populates="zones")

