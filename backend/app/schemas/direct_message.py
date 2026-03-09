from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


from typing import Optional, List


class DirectMessageCreate(BaseModel):
    receiver_id: UUID
    content: str
    is_encrypted: bool = False
    sender_device_id: Optional[UUID] = None


class DeviceCiphertextItem(BaseModel):
    device_id: UUID
    encrypted_ciphertext: str


class DeviceCiphertextSubmission(BaseModel):
    device_ciphertexts: List[DeviceCiphertextItem]


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
    
    # E2EE fields
    is_encrypted: bool = False
    epoch: int = 0
    sender_device_id: Optional[UUID] = None
    encrypted_ciphertext: Optional[str] = None
    device_key_status: Optional[str] = None
    
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