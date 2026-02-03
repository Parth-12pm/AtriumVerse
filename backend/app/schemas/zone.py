from pydantic import BaseModel
from uuid import UUID
from typing import Dict , Any 

class ZoneResponse(BaseModel):
    id : UUID
    server_id : UUID
    name : str 
    type : str
    bounds : Dict[str, Any]

    class Config:
        from_attributes= True
