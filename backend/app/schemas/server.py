from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ServerCreate(BaseModel):
    name: str
    map_path: str = "phaser_assets/maps/final_map.json"
    access_type: str = "public"


class ServerUpdate(BaseModel):
    name: str | None = None


class ServerResponse(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    owner_username: str | None = None
    created_at: datetime
    access_type: str
    member_count: int | None = None
    # Exposes { map_file, spawn_points } so clients know which Phaser map to load
    map_config: dict | None = None

    class Config:
        from_attributes = True
