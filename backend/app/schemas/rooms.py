from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.schemas.user import UserResponse


class RoomBase(BaseModel):
    name : str

class RoomCreate(RoomBase):
    pass


class RoomResponse(RoomBase):
    id: UUID
    host_id: UUID
    created_at: datetime

    host: UserResponse

    class Config: 
        from_attributes = True