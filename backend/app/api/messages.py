from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models.message import Message
from app.models.channel import Channel
from app.models.server_member import ServerMember, MemberStatus
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse, MessageUpdate
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/channels/{channel_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    channel_id: UUID,
    limit: int = Query(50, le=100),
    before: UUID = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get messages from a channel (paginated).
    Returns most recent messages first.
    """
    # Get channel and verify access
    channel_result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = channel_result.scalars().first()
    
    if not channel:
        raise HTTPException(404, detail="Channel not found")
    
    # Verify membership
    member_check = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == channel.server_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == MemberStatus.ACCEPTED
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(403, detail="Not a member of this server")
    
    # Build query
    query = (
        select(Message, User.username)
        .join(User, Message.user_id == User.id)
        .where(
            Message.channel_id == channel_id,
            not Message.is_deleted 
        )
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    
    # Pagination
    if before:
        before_msg_result = await db.execute(
            select(Message).where(Message.id == before)
        )
        before_msg = before_msg_result.scalars().first()
        if before_msg:
            query = query.where(Message.created_at < before_msg.created_at)
    
    result = await db.execute(query)
    rows = result.all()
    
    # Build response
    messages = []
    for msg, username in rows:
        msg_dict = {
            "id": msg.id,
            "channel_id": msg.channel_id,
            "user_id": msg.user_id,
            "content": msg.content,
            "reply_to_id": msg.reply_to_id,
            "edited_at": msg.edited_at,
            "is_deleted": msg.is_deleted,
            "created_at": msg.created_at,
            "username": username
        }
        messages.append(MessageResponse(**msg_dict))
    
    return messages


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse)
async def create_message(
    channel_id: UUID,
    message_in: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a message to a channel.
    """
    # Get channel and verify access
    channel_result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = channel_result.scalars().first()
    
    if not channel:
        raise HTTPException(404, detail="Channel not found")
    
    # Verify membership
    member_check = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == channel.server_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == MemberStatus.ACCEPTED
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(403, detail="Not a member of this server")
    
    # Validate content
    if not message_in.content or len(message_in.content) > 2000:
        raise HTTPException(400, detail="Message must be 1-2000 characters")
    
    # Create message
    new_message = Message(
        channel_id=channel_id,
        user_id=current_user.id,
        content=message_in.content,
        reply_to_id=message_in.reply_to_id
    )
    
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    
    # Build response with username
    response = MessageResponse(
        id=new_message.id,
        channel_id=new_message.channel_id,
        user_id=new_message.user_id,
        content=new_message.content,
        reply_to_id=new_message.reply_to_id,
        edited_at=new_message.edited_at,
        is_deleted=new_message.is_deleted,
        created_at=new_message.created_at,
        username=current_user.username
    )
    
    return response


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: UUID,
    message_update: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Edit a message.
    Only the author can edit their messages.
    """
    result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = result.scalars().first()
    
    if not message:
        raise HTTPException(404, detail="Message not found")
    
    if message.user_id != current_user.id:
        raise HTTPException(403, detail="Can only edit your own messages")
    
    if message.is_deleted:
        raise HTTPException(400, detail="Cannot edit deleted messages")
    
    # Validate content
    if not message_update.content or len(message_update.content) > 2000:
        raise HTTPException(400, detail="Message must be 1-2000 characters")
    
    message.content = message_update.content
    message.edited_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(message)
    
    # Build response
    response = MessageResponse(
        id=message.id,
        channel_id=message.channel_id,
        user_id=message.user_id,
        content=message.content,
        reply_to_id=message.reply_to_id,
        edited_at=message.edited_at,
        is_deleted=message.is_deleted,
        created_at=message.created_at,
        username=current_user.username
    )
    
    return response


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a message (soft delete).
    Author or server owner can delete.
    """
    result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = result.scalars().first()
    
    if not message:
        raise HTTPException(404, detail="Message not found")
    
    # Get channel to check server ownership
    channel_result = await db.execute(
        select(Channel).where(Channel.id == message.channel_id)
    )
    channel = channel_result.scalars().first()
    
    # Check if user is author or server owner
    from app.models.server import Server
    server_result = await db.execute(
        select(Server).where(Server.id == channel.server_id)
    )
    server = server_result.scalars().first()
    
    is_author = message.user_id == current_user.id
    is_owner = server.owner_id == current_user.id
    
    if not (is_author or is_owner):
        raise HTTPException(403, detail="Can only delete your own messages")
    
    # Soft delete
    message.is_deleted = True
    message.content = "[deleted]"
    
    await db.commit()
    
    return {"message": "Message deleted successfully"}