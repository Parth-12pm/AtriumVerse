from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.models.user import User
from app.api.auth import get_current_user
from app.models.channel_encryption import ChannelEncryption
from app.models.channel_device_key import ChannelDeviceKey
from app.models.device import Device
from app.models.channel import Channel
from app.models.server import Server
from app.models.server_member import ServerMember

router = APIRouter(prefix="/channel-keys", tags=["Channel Keys"])

class EncryptedKeySubmission(BaseModel):
    device_id: str
    encrypted_channel_key: str

class EnableEncryptionRequest(BaseModel):
    encrypted_keys: List[EncryptedKeySubmission]

class DistributeKeyRequest(BaseModel):
    target_device_id: str
    epoch: int
    encrypted_channel_key: str

@router.get("/my-channels")
async def get_my_encrypted_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a list of { channel_id, is_encrypted } for all channels the user is a member of 
    where encryption is enabled. Used by the old device during P2P sync to know which channels to process.
    """
    query = (
        select(Channel.id)
        .join(Server, Channel.server_id == Server.id)
        .join(ServerMember, Server.id == ServerMember.server_id)
        .join(ChannelEncryption, Channel.id == ChannelEncryption.channel_id)
        .where(
            ServerMember.user_id == current_user.id,
            ServerMember.status == "accepted",
            ChannelEncryption.is_enabled == True
        )
    )
    result = await db.execute(query)
    channels = result.scalars().all()
    
    return [{"channel_id": str(c), "is_encrypted": True} for c in channels]


@router.get("/server/{server_id}/user/{user_id}/encrypted-channels")
async def get_user_encrypted_channels_in_server(
    server_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a distinct list of channel IDs within a specific server that a given user
    currently holds encrypted keys for. Used during member removal to only rotate
    the channels the kicked member actually had access to.
    """
    # Enforce Owner Auth for the server
    serv_query = select(Server).where(Server.id == server_id, Server.owner_id == current_user.id)
    serv_res = await db.execute(serv_query)
    if not serv_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only server owner can query this information.")

    query = (
        select(ChannelDeviceKey.channel_id).distinct()
        .join(Device, ChannelDeviceKey.device_id == Device.id)
        .join(Channel, ChannelDeviceKey.channel_id == Channel.id)
        .where(
            Device.user_id == user_id,
            Channel.server_id == server_id
        )
    )
    result = await db.execute(query)
    channels = result.scalars().all()
    
    return [str(c) for c in channels]


@router.post("/{channel_id}/enable")
async def enable_channel_encryption(
    channel_id: str,
    req: EnableEncryptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Enforce Owner Auth
    chan_query = select(Channel).join(Server).where(Channel.id == channel_id, Server.owner_id == current_user.id)
    chan_res = await db.execute(chan_query)
    if not chan_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only server owner can enable channel encryption.")

    # Get the owner's active device to record who encrypted the keys
    dev_query = select(Device).where(Device.user_id == current_user.id, Device.is_trusted == True, Device.deleted_at == None).limit(1)
    dev_res = await db.execute(dev_query)
    owner_device = dev_res.scalar_one_or_none()
    if not owner_device:
        raise HTTPException(status_code=400, detail="Owner has no active trusted devices.")

    # CRITICAL: Atomic Transaction Block
    async with db.begin():
        # Has it already been enabled?
        enc_query = select(ChannelEncryption).where(ChannelEncryption.channel_id == channel_id)
        enc_res = await db.execute(enc_query)
        enc = enc_res.scalar_one_or_none()
        if enc:
            raise HTTPException(status_code=400, detail="Encryption already enabled on this channel.")

        # 1. Create ChannelEncryption row
        encryption_record = ChannelEncryption(channel_id=channel_id, is_enabled=True, current_epoch=1)
        db.add(encryption_record)

        # 2. Insert all ChannelDeviceKey rows
        for k in req.encrypted_keys:
            key_record = ChannelDeviceKey(
                channel_id=channel_id,
                device_id=k.device_id,
                epoch=1,
                encrypted_channel_key=k.encrypted_channel_key,
                owner_device_id=owner_device.id
            )
            db.add(key_record)
        
    return {"channel_id": channel_id, "epoch": 1}


@router.get("/{channel_id}/my-key")
async def get_my_current_channel_key(
    channel_id: str,
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify the device belongs to the requesting user
    dev_query = select(Device).where(Device.id == device_id, Device.user_id == current_user.id, Device.deleted_at == None)
    dev_res = await db.execute(dev_query)
    if not dev_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Invalid device_id for current user.")

    # Get current epoch
    enc_query = select(ChannelEncryption).where(ChannelEncryption.channel_id == channel_id, ChannelEncryption.is_enabled == True)
    enc_res = await db.execute(enc_query)
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Channel encryption not enabled.")

    current_epoch = enc.current_epoch

    # Get the key for this epoch
    key_query = (
        select(ChannelDeviceKey, Device.public_key.label("owner_public_key"))
        .join(Device, ChannelDeviceKey.owner_device_id == Device.id)
        .where(
            ChannelDeviceKey.channel_id == channel_id,
            ChannelDeviceKey.device_id == device_id,
            ChannelDeviceKey.epoch == current_epoch
        )
    )
    key_res = await db.execute(key_query)
    row = key_res.first()
    
    if not row:
        raise HTTPException(status_code=403, detail="No key found for this device at the current epoch.")

    key_record, owner_public_key = row

    return {
        "epoch": current_epoch,
        "encrypted_channel_key": key_record.encrypted_channel_key,
        "owner_device_public_key": owner_public_key
    }


@router.post("/{channel_id}/rotate")
async def rotate_channel_key(
    channel_id: str,
    req: EnableEncryptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Owner auth
    chan_query = select(Channel).join(Server).where(Channel.id == channel_id, Server.owner_id == current_user.id)
    chan_res = await db.execute(chan_query)
    if not chan_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only server owner can rotate channel keys.")

    dev_query = select(Device).where(Device.user_id == current_user.id, Device.is_trusted == True, Device.deleted_at == None).limit(1)
    dev_res = await db.execute(dev_query)
    owner_device = dev_res.scalar_one_or_none()
    if not owner_device:
        raise HTTPException(status_code=400, detail="Owner has no active trusted devices.")

    # CRITICAL: Atomic Transaction Block
    async with db.begin():
        enc_query = select(ChannelEncryption).where(ChannelEncryption.channel_id == channel_id, ChannelEncryption.is_enabled == True).with_for_update()
        enc_res = await db.execute(enc_query)
        enc = enc_res.scalar_one_or_none()
        if not enc:
            raise HTTPException(status_code=400, detail="Channel encryption not enabled.")

        # 1. Increment Epoch
        new_epoch = enc.current_epoch + 1
        enc.current_epoch = new_epoch

        # 2. Insert new keys (Do not delete old ones)
        for k in req.encrypted_keys:
            key_record = ChannelDeviceKey(
                channel_id=channel_id,
                device_id=k.device_id,
                epoch=new_epoch,
                encrypted_channel_key=k.encrypted_channel_key,
                owner_device_id=owner_device.id
            )
            db.add(key_record)
            
    return {"channel_id": channel_id, "epoch": new_epoch}


@router.post("/{channel_id}/distribute-to-device")
async def distribute_key_to_device(
    channel_id: str,
    device_id: str, # The SUBMITTING device
    req: DistributeKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Called by an old trusted device to peer-to-peer distribute an epoch key 
    to a newly linked device.
    """
    # 1. Submitting device must belong to current user and be trusted
    sub_dev_query = select(Device).where(Device.id == device_id, Device.user_id == current_user.id, Device.is_trusted == True, Device.deleted_at == None)
    sub_res = await db.execute(sub_dev_query)
    submitting_device = sub_res.scalar_one_or_none()
    if not submitting_device:
        raise HTTPException(status_code=403, detail="Invalid submitting device.")

    # 2. Target device MUST belong to the exact same user (P2P syncing)
    targ_dev_query = select(Device).where(Device.id == req.target_device_id, Device.user_id == current_user.id, Device.is_trusted == True, Device.deleted_at == None)
    targ_res = await db.execute(targ_dev_query)
    if not targ_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Target device does not belong to you or is untrusted.")

    # Insert historical/current key
    key_record = ChannelDeviceKey(
        channel_id=channel_id,
        device_id=req.target_device_id,
        epoch=req.epoch,
        encrypted_channel_key=req.encrypted_channel_key,
        owner_device_id=submitting_device.id  # Note: The submitting device became the encryptor for this specific copy
    )
    db.add(key_record)
    await db.commit()

    return {"status": "success"}


@router.get("/{channel_id}/entitled-epochs")
async def get_entitled_epochs(
    channel_id: str,
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify querying device
    dev_query = select(Device).where(Device.id == device_id, Device.user_id == current_user.id, Device.deleted_at == None)
    dev_res = await db.execute(dev_query)
    if not dev_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Invalid device_id.")

    query = (
        select(ChannelDeviceKey.epoch, ChannelDeviceKey.encrypted_channel_key, Device.public_key.label("owner_public_key"))
        .join(Device, ChannelDeviceKey.owner_device_id == Device.id)
        .where(
            ChannelDeviceKey.channel_id == channel_id,
            ChannelDeviceKey.device_id == device_id
        )
        .order_by(ChannelDeviceKey.epoch.asc())
    )
    
    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "epoch": r.epoch,
            "encrypted_channel_key": r.encrypted_channel_key,
            "owner_device_public_key": r.owner_public_key
        }
        for r in rows
    ]
