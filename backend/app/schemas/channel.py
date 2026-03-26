from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ChannelCreate(BaseModel):
    name: str
    type: str = "text"
    description: str | None = None
    position: int = 0


class ChannelResponse(BaseModel):
    id: UUID
    server_id: UUID
    name: str
    type: str
    description: str | None
    position: int
    is_public: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ChannelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    position: int | None = None
    type: str | None = None
