from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ServerCreate(BaseModel):
    name: str
    map_path: str = "phaser_assets/maps/final_map.json"
    access_type: str = "public"


class ServerUpdate(BaseModel):
    name: Optional[str] = None


class ServerResponse(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    owner_username: Optional[str] = None
    created_at: datetime
    access_type: str
    member_count: Optional[int] = None

    class Config:
        from_attributes = True
