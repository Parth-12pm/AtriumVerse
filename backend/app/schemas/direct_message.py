from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class DirectMessageCreate(BaseModel):
    receiver_id: UUID
    content: str


class DirectMessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    edited_at: Optional[datetime]
    is_deleted: bool
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime
    
    # Populated from join
    sender_username: Optional[str] = None
    receiver_username: Optional[str] = None
    
    class Config:
        from_attributes = True


class DirectMessageUpdate(BaseModel):
    content: str


class ConversationResponse(BaseModel):
    """Summary of a DM conversation with a user"""
    user_id: UUID
    username: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0