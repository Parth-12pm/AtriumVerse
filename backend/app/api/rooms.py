from fastapi import APIRouter , Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.room import Room
from app.models.user import User
from app.schemas.rooms import RoomCreate, RoomResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=RoomResponse)
async def create_room(
    room: RoomCreate,
    db : AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
     
    new_room = Room(
        name = room.name,
        host_id=current_user.id
    )

    db.add(new_room)
    await db.commit()
    await db.refresh(new_room)

    return new_room
