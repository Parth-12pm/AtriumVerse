from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class MessageCreate(BaseModel):
    content: str
    reply_to_id: Optional[UUID] = None


class MessageResponse(BaseModel):
    id: UUID
    channel_id: UUID
    user_id: UUID
    content: str
    reply_to_id: Optional[UUID]
    edited_at: Optional[datetime]
    is_deleted: bool
    created_at: datetime
    
    # Populated from join
    username: Optional[str] = None
    
    class Config:
        from_attributes = True


class MessageUpdate(BaseModel):
    content: str