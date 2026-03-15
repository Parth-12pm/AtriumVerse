from typing import Any
from uuid import UUID

from pydantic import BaseModel


class ZoneResponse(BaseModel):
    id: UUID
    server_id: UUID
    name: str
    type: str
    bounds: dict[str, Any]

    class Config:
        from_attributes = True
