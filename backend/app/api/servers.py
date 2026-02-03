from fastapi import APIRouter, Depends , HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List 
from uuid import UUID
from app.core.database import get_db
from app.models.server import Server
from app.models.user import User
from app.models.zone import Zone
from app.schemas.server import ServerCreate , ServerResponse
from app.schemas.zone import ZoneResponse
from app.api.deps import get_current_user
from app.utils.map_parser import parse_map_zones
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONTEND_DIR = os.path.join(BASE_DIR, "../frontend")
router = APIRouter()

@router.get("/", response_model=List[ServerResponse])
async def get_servers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Server))
    servers = result.scalars().all()
    return servers

@router.post("/create-server", response_model=ServerResponse)
async def create_server(
    server_in: ServerCreate,
    db : AsyncSession = Depends(get_db),
    current_user : User = Depends(get_current_user)
):  

    new_server = Server(
        name = server_in.name,
        owner_id = current_user.id,
        map_config={"map_file": server_in.map_path}
    )

    db.add(new_server)
    await db.flush()

    try: 

        full_path = os.path.join(FRONTEND_DIR, "public", server_in.map_path)

        zones_data, spawn_points = parse_map_zones(full_path)

        new_server.map_config = {
            "map_file": server_in.map_path,
            "spawn_points": spawn_points  # [{ name, x, y }, ...]
        }

        for z in zones_data:
            new_zone = Zone(
                name= z["name"],
                type = z["type"],
                bounds = z["bounds"],
                server_id= new_server.id
            )
            db.add(new_zone)

    except Exception as e:
        print(f"Map Error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid Map: {e}")


    await db.commit()
    await db.refresh(new_server)

    return new_server


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: UUID, 
    db : AsyncSession =  Depends(get_db),
    current_user: User = Depends(get_current_user)
): 
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalars().first()

    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return server



@router.get("/{server_id}/zones", response_model=List[ZoneResponse])
async def get_zones(
    server_id : UUID,
    db : AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Zone).where(Zone.server_id == server_id))
    zones = result.scalars().all()

    return zones