from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from app.core.database import get_db
from app.models.server import Server
from app.models.user import User
from app.models.zone import Zone
from app.models.server_member import ServerMember, MemberRole, MemberStatus
from app.schemas.server import ServerCreate, ServerUpdate, ServerResponse
from app.schemas.zone import ZoneResponse
from app.api.deps import get_current_user
from app.utils.map_parser import parse_map_zones
import os


# Robust directory resolution
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Allow overriding FRONTEND_DIR via env var (useful for Docker/Prod)
FRONTEND_DIR = os.getenv("FRONTEND_DIR", os.path.join(BASE_DIR, "../frontend"))
router = APIRouter()

@router.get("/", response_model=List[ServerResponse])
async def get_servers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Server).options(selectinload(Server.owner))
    )
    servers = result.scalars().all()
    out = []
    for s in servers:
        d = ServerResponse(
            id=s.id,
            name=s.name,
            owner_id=s.owner_id,
            owner_username=s.owner.username if s.owner else None,
            created_at=s.created_at,
            access_type=s.access_type,
        )
        out.append(d)
    return out

@router.post("/create-server", response_model=ServerResponse)
async def create_server(
    server_in: ServerCreate,
    db : AsyncSession = Depends(get_db),
    current_user : User = Depends(get_current_user)
):  

    new_server = Server(
        name = server_in.name,
        owner_id = current_user.id,
        map_config={"map_file": server_in.map_path},
        access_type=server_in.access_type
    )

    db.add(new_server)
    await db.flush()
    await db.refresh(new_server)

    owner_member = ServerMember(
        user_id = current_user.id,
        server_id = new_server.id,
        role = MemberRole.OWNER,
        status = MemberStatus.ACCEPTED
    )
    db.add(owner_member)
    
    try: 

        # Try multiple paths to find the map file
        possible_paths = [
            os.path.join(FRONTEND_DIR, "public", server_in.map_path),
            os.path.join(BASE_DIR, "public", server_in.map_path), # Fallback if public is copied to backend
            os.path.abspath(server_in.map_path), # If absolute path provided
        ]

        full_path = None
        for p in possible_paths:
            if os.path.exists(p):
                full_path = p
                print(f"Found map at: {full_path}")
                break
        
        if not full_path:
             # List contents of FRONTEND_DIR to help debugging
            try:
                print(f"FRONTEND_DIR ({FRONTEND_DIR}) contents: {os.listdir(FRONTEND_DIR)}")
                public_dir = os.path.join(FRONTEND_DIR, "public")
                if os.path.exists(public_dir):
                     print(f"public dir contents: {os.listdir(public_dir)}")
            except Exception as e:
                print(f"Error listing dirs: {e}")
            raise FileNotFoundError(f"Map file not found in searched paths: {possible_paths}")

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Server)
        .where(Server.id == server_id)
        .options(selectinload(Server.owner))
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    return ServerResponse(
        id=server.id,
        name=server.name,
        owner_id=server.owner_id,
        owner_username=server.owner.username if server.owner else None,
        created_at=server.created_at,
        access_type=server.access_type,
    )


@router.patch("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: UUID,
    payload: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rename a server (owner only)."""
    result = await db.execute(
        select(Server)
        .where(Server.id == server_id)
        .options(selectinload(Server.owner))
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can rename this server")
    if payload.name:
        server.name = payload.name
    await db.commit()
    await db.refresh(server)
    return ServerResponse(
        id=server.id,
        name=server.name,
        owner_id=server.owner_id,
        owner_username=server.owner.username if server.owner else None,
        created_at=server.created_at,
        access_type=server.access_type,
    )


@router.post("/{server_id}/join")
async def join_server(
    server_id: UUID,
    db : AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    
    result = await db.execute(select(ServerMember).where(ServerMember.server_id == server_id,
    ServerMember.user_id == current_user.id))
    existing_member = result.scalars().first()

    if existing_member:
        return {"message": "Already a member", "status":existing_member.status}
    
    if server.access_type == "private":
        new_status = MemberStatus.PENDING
        msg = "Request sent to owner"
    else:
        new_status = MemberStatus.ACCEPTED
        msg = "Joined successfully"
    

    new_member = ServerMember(
        user_id = current_user.id,
        server_id = server_id,
        role= MemberRole.MEMBER,
        status = new_status
    )

    db.add(new_member)
    await db.commit()

    return {"message": msg, "status": new_status}




@router.get("/{server_id}/zones", response_model=List[ZoneResponse])
async def get_zones(
    server_id : UUID,
    db : AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Zone).where(Zone.server_id == server_id))
    zones = result.scalars().all()

    return zones



@router.get("/{server_id}/members")
async def list_members(
    server_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    result = await db.execute(select(Server).where(Server.id == server_id))
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Allow any member to view member list (not just owner)
    member_result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == MemberStatus.ACCEPTED
        )
    )
    if not member_result.scalars().first():
        raise HTTPException(403, detail="Only members can view member list")

    result = await db.execute(
        select(ServerMember)
        .where(ServerMember.server_id == server_id)
        .options(selectinload(ServerMember.user))
    )
    members = result.scalars().all()

    return [{
        "user_id": m.user_id,
        "username": m.user.username,
        "role": m.role,
        "status": m.status
    } for m in members]



@router.post("/{server_id}/members/{user_id}/approve")
async def approve_member(
    server_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
     # 1. Verify Owner (Security Check)
    server_res = await db.execute(select(Server).where(Server.id == server_id))
    server = server_res.scalars().first()
    if not server or server.owner_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    # 2. Find the Pending Member
    mem_res = await db.execute(select(ServerMember).where(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ))
    member = mem_res.scalars().first()
    
    if not member:
        raise HTTPException(404, detail="Member request not found")

    # 3. Approve
    member.status = MemberStatus.ACCEPTED
    await db.commit()
    return {"message": "User approved"}


@router.post("/{server_id}/members/{user_id}/reject")
async def reject_member(
    server_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check Owner
    server_res = await db.execute(select(Server).where(Server.id == server_id))
    server = server_res.scalars().first()
    if not server or server.owner_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")

    # 2. Get Member
    result = await db.execute(select(ServerMember).where(
        ServerMember.server_id == server_id, ServerMember.user_id == user_id
    ))
    member = result.scalars().first()
    if not member:
        raise HTTPException(404, detail="Member not found")

    # 3. Delete (Reject/Kick)
    await db.delete(member)
    await db.commit()
    return {"message": "Member rejected/removed"}