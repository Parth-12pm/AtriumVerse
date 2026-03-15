from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MessageCreate(BaseModel):
    content: str
    reply_to_id: UUID | None = None
    is_encrypted: bool = False
    epoch: int | None = None


class MessageResponse(BaseModel):
    id: UUID
    channel_id: UUID
    user_id: UUID
    content: str
    reply_to_id: UUID | None
    edited_at: datetime | None
    is_deleted: bool
    created_at: datetime

    # Populated from join
    username: str | None = None
    is_encrypted: bool = False
    epoch: int | None = None

    class Config:
        from_attributes = True


class MessageUpdate(BaseModel):
    content: str
