from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ChannelCreate(BaseModel):
    name: str
    type: str = "text"
    description: Optional[str] = None
    position: int = 0


class ChannelResponse(BaseModel):
    id: UUID
    server_id: UUID
    name: str
    type: str
    description: Optional[str]
    position: int
    is_public: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    position: Optional[int] = None
    type: Optional[str] = None