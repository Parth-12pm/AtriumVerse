from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from jose import jwt , JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select 
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.user import User
from app.core.livekit_manager import (
    create_user_token,
    create_guest_token,
    get_livekit_url,
    audio_room_name,
    video_room_name
)
import os 

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.username==username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user



@router.get("/token")
async def get_livekit_token(
    room_name: str = Query(..., description="Room to join, e.g. audio_server123"),
    current_user: User = Depends(get_current_user),
):

    token = create_user_token(
        room_name=room_name,
        user_id=str(current_user.id),
        username=current_user.username,
    )
    return {
        "token":token,
        "livekit_url": get_livekit_url(),
        "room_name": room_name,
        "identity": str(current_user.id),
    }

class InviteRequest(BaseModel):
    room_name: str
    guest_label: str = "Guest"


@router.post("/invite")
async def create_invite_link(
    body: InviteRequest,
    current_user: User = Depends(get_current_user),
):


    guest_token = create_guest_token(
        room_name=body.room_name,
        guest_label=body.guest_label,
    )
    frontend_url = os.getenv("NEXT_PUBLIC_URL","http://localhost:3000")
    invite_url = f"{frontend_url}/join/{guest_token}"

    return {
        "invite_url": invite_url,
        "guest_token": guest_token,
        "room_name": body.room_name,
        "created_by": current_user.username,
    }



@router.get("/room-name")
async def get_room_name(
    room_type: str = Query(..., description="'audio' or 'video'"),
    id: str = Query(..., description="server_id for audio, zone_id for video"),
    current_user: User = Depends(get_current_user),
):
    if room_type == "audio":
        return {"room_name": audio_room_name(id)}
    elif room_type == "video":
        return {"room_name": video_room_name(id)}
    else:
        raise HTTPException(status_code=400, detail="room_type must be 'audio' or 'video'")