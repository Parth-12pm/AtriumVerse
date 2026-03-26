from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DirectMessageCreate(BaseModel):
    receiver_id: UUID
    content: str
    is_encrypted: bool = False
    sender_device_id: UUID | None = None


class DeviceCiphertextItem(BaseModel):
    device_id: UUID
    encrypted_ciphertext: str


class DeviceCiphertextSubmission(BaseModel):
    device_ciphertexts: list[DeviceCiphertextItem]


class DirectMessageResponse(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    content: str
    edited_at: datetime | None
    is_deleted: bool
    is_read: bool
    read_at: datetime | None
    created_at: datetime

    # E2EE fields
    is_encrypted: bool = False
    epoch: int = 0
    sender_device_id: UUID | None = None
    encrypted_ciphertext: str | None = None
    device_key_status: str | None = None

    # Populated from join
    sender_username: str | None = None
    receiver_username: str | None = None

    class Config:
        from_attributes = True


class DirectMessageUpdate(BaseModel):
    content: str


class ConversationResponse(BaseModel):
    """Summary of a DM conversation with a user"""

    user_id: UUID
    username: str
    last_message: str | None = None
    last_message_at: datetime | None = None
    unread_count: int = 0
