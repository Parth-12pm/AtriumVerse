from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.models.channel import Channel
from app.models.server import Server
from app.models.server_member import ServerMember, MemberStatus
from app.schemas.channel import ChannelCreate, ChannelResponse, ChannelUpdate
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/{server_id}/channels", response_model=List[ChannelResponse])
async def list_channels(
    server_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all channels in a server.
    User must be a member of the server.
    """
    # Verify membership
    member_check = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == MemberStatus.ACCEPTED
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(403, detail="Not a member of this server")
    
    # Get channels
    result = await db.execute(
        select(Channel)
        .where(Channel.server_id == server_id)
        .order_by(Channel.position, Channel.created_at)
    )
    channels = result.scalars().all()
    
    return channels


@router.post("/{server_id}/channels", response_model=ChannelResponse)
async def create_channel(
    server_id: UUID,
    channel_in: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new channel in a server.
    Only the server owner can create channels.
    """
    # Verify ownership
    server_result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = server_result.scalars().first()
    
    if not server:
        raise HTTPException(404, detail="Server not found")
    
    if server.owner_id != current_user.id:
        raise HTTPException(403, detail="Only server owner can create channels")
    
    # Create channel
    new_channel = Channel(
        server_id=server_id,
        name=channel_in.name,
        type=channel_in.type,
        description=channel_in.description,
        position=channel_in.position
    )
    
    db.add(new_channel)
    await db.commit()
    await db.refresh(new_channel)
    
    return new_channel


@router.patch("/channels/{channel_id}", response_model=ChannelResponse)
async def update_channel(
    channel_id: UUID,
    channel_update: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a channel.
    Only the server owner can update channels.
    """
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalars().first()
    
    if not channel:
        raise HTTPException(404, detail="Channel not found")
    
    # Check ownership
    server_result = await db.execute(
        select(Server).where(Server.id == channel.server_id)
    )
    server = server_result.scalars().first()
    
    if server.owner_id != current_user.id:
        raise HTTPException(403, detail="Only server owner can update channels")
    
    # Update fields
    if channel_update.name is not None:
        channel.name = channel_update.name
    if channel_update.description is not None:
        channel.description = channel_update.description
    if channel_update.position is not None:
        channel.position = channel_update.position
    
    await db.commit()
    await db.refresh(channel)
    
    return channel


@router.delete("/channels/{channel_id}")
async def delete_channel(
    channel_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a channel.
    Only the server owner can delete channels.
    """
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalars().first()
    
    if not channel:
        raise HTTPException(404, detail="Channel not found")
    
    # Check ownership
    server_result = await db.execute(
        select(Server).where(Server.id == channel.server_id)
    )
    server = server_result.scalars().first()
    
    if server.owner_id != current_user.id:
        raise HTTPException(403, detail="Only server owner can delete channels")
    
    await db.delete(channel)
    await db.commit()
    
    return {"message": "Channel deleted successfully"}