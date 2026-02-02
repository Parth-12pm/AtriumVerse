from pydantic import BaseModel
from typing import Optional , List
from uuid import UUID
from datetime import datetime



class ServerCreate(BaseModel):
    name: str 
    map_path: str = "phaser_assets/maps/final_map.json"


class ServerResponse(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime

    class Config: 
        from_attributes = True
