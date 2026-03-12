from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, and_, func
from typing import List
from uuid import UUID
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models.direct_message import DirectMessage
from app.models.user import User
from app.models.dm_epoch import DmEpoch
from app.models.dm_device_key import DmDeviceKey
from app.models.device import Device
from app.schemas.direct_message import (
    DirectMessageCreate, 
    DirectMessageResponse, 
    DirectMessageUpdate,
    ConversationResponse,
    DeviceCiphertextSubmission
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
                ~DirectMessage.is_read 
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


@router.get("/messages/{user_id}")
async def get_conversation_messages(
    user_id: UUID,
    device_id: UUID = Query(..., description="The requesting device ID to fetch specific ciphertexts for"),
    limit: int = Query(50, le=100),
    before: UUID = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get messages in a conversation with a specific user.
    Returns per-device ciphertext for E2EE messages.
    Marks messages as read.
    """
    # Verify the device belongs to the requesting user
    dev_query = select(Device).where(Device.id == device_id, Device.user_id == current_user.id, Device.deleted_at == None)
    dev_res = await db.execute(dev_query)
    if not dev_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Invalid device_id")

    from sqlalchemy.orm import aliased
    SenderDevice = aliased(Device)

    # Build query for messages between current_user and target user
    query = (
        select(
            DirectMessage, 
            User.username.label("sender_username"),
            DmDeviceKey.encrypted_ciphertext,
            DmDeviceKey.device_id.label("ciphertext_active_device"),
            DmDeviceKey.deleted_device_id,
            SenderDevice.public_key.label("sender_public_key")
        )
        .join(User, DirectMessage.sender_id == User.id)
        .outerjoin(SenderDevice, DirectMessage.sender_device_id == SenderDevice.id)
        .outerjoin(
            DmDeviceKey,
            and_(
                DirectMessage.id == DmDeviceKey.dm_id,
                or_(
                    DmDeviceKey.device_id == device_id,
                    DmDeviceKey.deleted_device_id == device_id
                )
            )
        )
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
            ~DirectMessage.is_deleted 
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
            ~DirectMessage.is_read 
        )
    )
    
    unread_messages = (await db.execute(
        select(DirectMessage)
        .where(
            DirectMessage.sender_id == user_id,
            DirectMessage.receiver_id == current_user.id,
            ~DirectMessage.is_read 
        )
    )).scalars().all()
    
    for msg in unread_messages:
        msg.is_read = True
        msg.read_at = datetime.utcnow()
    
    await db.commit()
    
    # Build response
    messages = []
    for row in rows:
        msg = row.DirectMessage
        sender_username = row.sender_username
        
        # Determine device key status for E2EE messages
        device_key_status = None
        encrypted_ciphertext = None
        
        if getattr(msg, 'is_encrypted', False):
            if row.encrypted_ciphertext is not None:
                device_key_status = "available"
                encrypted_ciphertext = row.encrypted_ciphertext
            elif row.ciphertext_active_device is None and row.deleted_device_id is not None:
                device_key_status = "device_removed"
            else:
                device_key_status = "predates_device"

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
            "is_encrypted": getattr(msg, 'is_encrypted', False),
            "epoch": getattr(msg, 'epoch', 0),
            "sender_device_id": getattr(msg, 'sender_device_id', None),
            "sender_public_key": row.sender_public_key,
            "encrypted_ciphertext": encrypted_ciphertext,
            "device_key_status": device_key_status,
            "edited_at": msg.edited_at,
            "is_deleted": msg.is_deleted,
            "is_read": msg.is_read,
            "read_at": msg.read_at,
            "created_at": msg.created_at,
            "sender_username": sender_username,
            "receiver_username": receiver_username
        }
        messages.append(msg_dict)
    
    return messages


@router.post("/messages")
async def send_direct_message(
    message_in: DirectMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send a direct message to a user.
    Step 1 of E2EE: Returns the dm_id and current epoch to be used as HKDF salt.
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
    
    if message_in.is_encrypted:
        if not message_in.sender_device_id:
            raise HTTPException(400, detail="Encrypted DMs require sender_device_id")

        sender_device_result = await db.execute(
            select(Device).where(
                Device.id == message_in.sender_device_id,
                Device.user_id == current_user.id,
                Device.is_trusted == True,
                Device.deleted_at == None,
            )
        )
        if not sender_device_result.scalar_one_or_none():
            raise HTTPException(400, detail="Sender device is invalid or not trusted")

    # Content still needed if plaintext fallback is used, otherwise clients send "[encrypted]"
    if not message_in.content or len(message_in.content) > 2000:
        raise HTTPException(400, detail="Message must be 1-2000 characters")
    
    try:
        # Canonical Ordering for DM Epoch
        user_a_id = min(current_user.id, receiver.id)
        user_b_id = max(current_user.id, receiver.id)

        epoch_query = select(DmEpoch).where(
            DmEpoch.user_a_id == user_a_id, 
            DmEpoch.user_b_id == user_b_id
        ).with_for_update()
        epoch_res = await db.execute(epoch_query)
        dm_epoch = epoch_res.scalar_one_or_none()

        if not dm_epoch:
            dm_epoch = DmEpoch(user_a_id=user_a_id, user_b_id=user_b_id, current_epoch=1)
            db.add(dm_epoch)

        # Create message
        new_message = DirectMessage(
            sender_id=current_user.id,
            receiver_id=message_in.receiver_id,
            content=message_in.content,
            is_encrypted=message_in.is_encrypted,
            epoch=dm_epoch.current_epoch if message_in.is_encrypted else None,
            sender_device_id=message_in.sender_device_id
        )
        db.add(new_message)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e
    
    await db.refresh(new_message)
    
    # Build a raw dict response (we will update DirectMessageResponse schema separately)
    return {
        "id": new_message.id,
        "sender_id": new_message.sender_id,
        "receiver_id": new_message.receiver_id,
        "content": new_message.content,
        "is_encrypted": getattr(new_message, 'is_encrypted', False),
        "epoch": getattr(new_message, 'epoch', 0),
        "sender_device_id": new_message.sender_device_id,
        "created_at": new_message.created_at,
        "sender_username": current_user.username,
        "receiver_username": receiver.username
    }


@router.post("/messages/{message_id}/device-keys")
async def submit_device_keys(
    message_id: UUID,
    payload: DeviceCiphertextSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Step 2 of E2EE DM Sending:
    Accepts the array of device ciphertexts derived using message_id as HKDF salt.
    """
    # 1. Validate the message exists and belongs to sender
    msg_query = select(DirectMessage).where(DirectMessage.id == message_id)
    msg_res = await db.execute(msg_query)
    msg = msg_res.scalar_one_or_none()

    if not msg:
        raise HTTPException(status_code=404, detail="DirectMessage not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only sender can attach device keys")

    try:
        # Insert all ciphertexts
        for ciphertext_obj in payload.device_ciphertexts:
            # Validate each device_id belongs to the sender or receiver
            dev_res = await db.execute(
                select(Device).where(
                    Device.id == ciphertext_obj.device_id,
                    or_(
                        Device.user_id == msg.sender_id,
                        Device.user_id == msg.receiver_id,
                    ),
                    Device.deleted_at == None,
                )
            )
            if not dev_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=403,
                    detail=f"Device {ciphertext_obj.device_id} does not belong to sender or receiver"
                )

            key_record = DmDeviceKey(
                dm_id=message_id,
                device_id=ciphertext_obj.device_id,
                encrypted_ciphertext=ciphertext_obj.encrypted_ciphertext
            )
            db.add(key_record)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise e

    return {"status": "success"}


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



# ─────────────────────────────────────────────────────────────────────────────
# ADD THIS ENDPOINT TO YOUR DIRECT MESSAGES ROUTER
# (whatever file currently contains your /dm/ routes)
#
# Required imports — add to the top of that file if not already present:
#   from sqlalchemy.future import select
#   from app.models.dm_device_key import DmDeviceKey
#   from app.models.direct_message import DirectMessage   (or whatever your DM model is called)
#   from fastapi import Query
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/messages/{message_id}/my-ciphertext")
async def get_my_dm_ciphertext(
    message_id: uuid.UUID,
    device_id: uuid.UUID = Query(..., description="The requesting device's ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the ciphertext slice addressed to a specific device for a single DM.

    Called by ChatFeed.tsx when a real-time WebSocket notification arrives.
    Avoids a full history refetch — the frontend only needs this one message.

    Security: verifies the requesting user is the sender or receiver of the
    message before returning any ciphertext.
    """
    # Load the message and verify the current user is a participant
    msg_result = await db.execute(
        select(DirectMessage).where(DirectMessage.id == message_id)
    )
    message = msg_result.scalars().first()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your message")

    # Fetch the device-specific ciphertext row
    key_result = await db.execute(
        select(DmDeviceKey).where(
            DmDeviceKey.dm_id == message_id,
            DmDeviceKey.device_id == device_id,
        )
    )
    device_key = key_result.scalars().first()

    if not device_key:
        raise HTTPException(
            status_code=404,
            detail="No ciphertext found for this device. The message may still be processing.",
        )

    # Fetch sender's public key so the frontend can run ECDH to derive the DM key
    sender_result = await db.execute(
        select(Device).where(
            Device.id == message.sender_device_id,   # adjust field name to match your DM model
            Device.deleted_at == None,
        )
    )
    sender_device = sender_result.scalars().first()

    return {
        "id": str(message.id),
        "epoch": message.epoch,
        "encrypted_ciphertext": device_key.encrypted_ciphertext,
        "sender_public_key": sender_device.public_key if sender_device else None,
        "sender_id": str(message.sender_id),
        "created_at": message.created_at.isoformat(),
        "is_encrypted": message.is_encrypted,
    }