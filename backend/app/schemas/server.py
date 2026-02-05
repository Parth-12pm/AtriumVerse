from pydantic import BaseModel
from typing import Optional , List
from uuid import UUID
from datetime import datetime



class ServerCreate(BaseModel):
    name: str 
    map_path: str = "phaser_assets/maps/final_map.json"
    access_type: str = "public"


class ServerResponse(BaseModel):
    id: UUID
    name: str
    owner_id: UUID
    created_at: datetime
    access_type: str
    
    class Config: 
        from_attributes = True
