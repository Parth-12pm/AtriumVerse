from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, and_, func
from typing import List
from uuid import UUID
from datetime import datetime

from app.core.database import get_db
from app.models.direct_message import DirectMessage
from app.models.user import User
from app.schemas.direct_message import (
    DirectMessageCreate, 
    DirectMessageResponse, 
    DirectMessageUpdate,
    ConversationResponse
)
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all DM conversations for current user.
    Returns users they've chatted with, last message, and unread count.
    """
    # Get all unique users the current user has chatted with
    # This is a complex query - we need to find all users where:
    # - current_user sent them a message OR
    # - they sent current_user a message
    
    # Subquery for users current_user has sent messages to
    sent_to = select(DirectMessage.receiver_id).where(
        DirectMessage.sender_id == current_user.id
    ).distinct()
    
    # Subquery for users who sent messages to current_user
    received_from = select(DirectMessage.sender_id).where(
        DirectMessage.receiver_id == current_user.id
    ).distinct()
    
    # Union of both
    conversation_user_ids = sent_to.union(received_from)
    
    # Get user details
    users_result = await db.execute(
        select(User).where(User.id.in_(conversation_user_ids))
    )
    conversation_users = users_result.scalars().all()
    
    conversations = []
    
    for user in conversation_users:
        # Get last message in conversation
        last_msg_result = await db.execute(
            select(DirectMessage)
            .where(
                or_(
                    and_(
                        DirectMessage.sender_id == current_user.id,
                        DirectMessage.receiver_id == user.id
                    ),
                    and_(
                        DirectMessage.sender_id == user.id,
                        DirectMessage.receiver_id == current_user.id
                    )
                )
            )
            .order_by(desc(DirectMessage.created_at))
            .limit(1)
        )
        last_msg = last_msg_result.scalars().first()
        
        # Count unread messages from this user
        unread_result = await db.execute(
            select(func.count(DirectMessage.id))
            .where(
                DirectMessage.sender_id == user.id,
                DirectMessage.receiver_id == current_user.id,
                DirectMessage.is_read == False
            )
        )
        unread_count = unread_result.scalar() or 0
        
        conversations.append(ConversationResponse(
            user_id=user.id,
            username=user.username,
            last_message=last_msg.content if last_msg else None,
            last_message_at=last_msg.created_at if last_msg else None,
            unread_count=unread_count
        ))
    
    # Sort by last message time (most recent first)
    conversations.sort(
        key=lambda c: c.last_message_at or datetime.min, 
        reverse=True
    )
    
    return conversations


@router.get("/messages/{user_id}", response_model=List[DirectMessageResponse])
async def get_conversation_messages(
    user_id: UUID,
    limit: int = Query(50, le=100),
    before: UUID = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get messages in a conversation with a specific user.
    Marks messages as read.
    """
    # Build query for messages between current_user and target user
    query = (
        select(DirectMessage, User.username.label("sender_username"))
        .join(User, DirectMessage.sender_id == User.id)
        .where(
            or_(
                and_(
                    DirectMessage.sender_id == current_user.id,
                    DirectMessage.receiver_id == user_id
                ),
                and_(
                    DirectMessage.sender_id == user_id,
                    DirectMessage.receiver_id == current_user.id
                )
            ),
            DirectMessage.is_deleted == False
        )
        .order_by(desc(DirectMessage.created_at))
        .limit(limit)
    )
    
    # Pagination
    if before:
        before_msg_result = await db.execute(
            select(DirectMessage).where(DirectMessage.id == before)
        )
        before_msg = before_msg_result.scalars().first()
        if before_msg:
            query = query.where(DirectMessage.created_at < before_msg.created_at)
    
    result = await db.execute(query)
    rows = result.all()
    
    # Mark received messages as read
    await db.execute(
        select(DirectMessage)
        .where(
            DirectMessage.sender_id == user_id,
            DirectMessage.receiver_id == current_user.id,
            DirectMessage.is_read == False
        )
    )
    
    unread_messages = (await db.execute(
        select(DirectMessage)
        .where(
            DirectMessage.sender_id == user_id,
            DirectMessage.receiver_id == current_user.id,
            DirectMessage.is_read == False
        )
    )).scalars().all()
    
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = datetime.utcnow()
    
    await db.commit()
    
    # Build response
    messages = []
    for msg, sender_username in rows:
        # Get receiver username
        receiver_result = await db.execute(
            select(User.username).where(User.id == msg.receiver_id)
        )
        receiver_username = receiver_result.scalar()
        
        msg_dict = {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "receiver_id": msg.receiver_id,
            "content": msg.content,
            "edited_at": msg.edited_at,
            "is_deleted": msg.is_deleted,
            "is_read": msg.is_read,
            "read_at": msg.read_at,
            "created_at": msg.created_at,
            "sender_username": sender_username,
            "receiver_username": receiver_username
        }
        messages.append(DirectMessageResponse(**msg_dict))
    
    return messages


@router.post("/messages", response_model=DirectMessageResponse)
async def send_direct_message(
    message_in: DirectMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a direct message to a user.
    """
    # Validate receiver exists
    receiver_result = await db.execute(
        select(User).where(User.id == message_in.receiver_id)
    )
    receiver = receiver_result.scalars().first()
    
    if not receiver:
        raise HTTPException(404, detail="Receiver not found")
    
    # Can't send to yourself
    if receiver.id == current_user.id:
        raise HTTPException(400, detail="Cannot send message to yourself")
    
    # Validate content
    if not message_in.content or len(message_in.content) > 2000:
        raise HTTPException(400, detail="Message must be 1-2000 characters")
    
    # Create message
    new_message = DirectMessage(
        sender_id=current_user.id,
        receiver_id=message_in.receiver_id,
        content=message_in.content
    )
    
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)
    
    # Build response
    response = DirectMessageResponse(
        id=new_message.id,
        sender_id=new_message.sender_id,
        receiver_id=new_message.receiver_id,
        content=new_message.content,
        edited_at=new_message.edited_at,
        is_deleted=new_message.is_deleted,
        is_read=new_message.is_read,
        read_at=new_message.read_at,
        created_at=new_message.created_at,
        sender_username=current_user.username,
        receiver_username=receiver.username
    )
    
    return response


@router.patch("/messages/{message_id}", response_model=DirectMessageResponse)
async def update_direct_message(
    message_id: UUID,
    message_update: DirectMessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Edit a direct message.
    Only the sender can edit.
    """
    result = await db.execute(
        select(DirectMessage).where(DirectMessage.id == message_id)
    )
    message = result.scalars().first()
    
    if not message:
        raise HTTPException(404, detail="Message not found")
    
    if message.sender_id != current_user.id:
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
    
    # Get usernames
    sender_result = await db.execute(
        select(User.username).where(User.id == message.sender_id)
    )
    sender_username = sender_result.scalar()
    
    receiver_result = await db.execute(
        select(User.username).where(User.id == message.receiver_id)
    )
    receiver_username = receiver_result.scalar()
    
    response = DirectMessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        receiver_id=message.receiver_id,
        content=message.content,
        edited_at=message.edited_at,
        is_deleted=message.is_deleted,
        is_read=message.is_read,
        read_at=message.read_at,
        created_at=message.created_at,
        sender_username=sender_username,
        receiver_username=receiver_username
    )
    
    return response


@router.delete("/messages/{message_id}")
async def delete_direct_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a direct message (soft delete).
    Only sender can delete.
    """
    result = await db.execute(
        select(DirectMessage).where(DirectMessage.id == message_id)
    )
    message = result.scalars().first()
    
    if not message:
        raise HTTPException(404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(403, detail="Can only delete your own messages")
    
    # Soft delete
    message.is_deleted = True
    message.content = "[deleted]"
    
    await db.commit()
    
    return {"message": "Message deleted successfully"}