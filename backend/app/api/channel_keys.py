from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import aliased
from typing import List, Set
from pydantic import BaseModel
from app.core.socket_manager import manager
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.channel import Channel
from app.models.channel_device_key import ChannelDeviceKey
from app.models.channel_encryption import ChannelEncryption
from app.models.device import Device
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User

router = APIRouter(prefix="/channel-keys", tags=["Channel Keys"])


class EncryptedKeySubmission(BaseModel):
    device_id: str
    encrypted_channel_key: str


class EnableEncryptionRequest(BaseModel):
    submitting_device_id: str
    encrypted_keys: List[EncryptedKeySubmission]


class DistributeKeyRequest(BaseModel):
    target_device_id: str
    epoch: int
    encrypted_channel_key: str


async def _get_expected_trusted_device_ids_for_server(
    server_id: str,
    db: AsyncSession,
) -> Set[str]:
    result = await db.execute(
        select(Device.id)
        .join(ServerMember, Device.user_id == ServerMember.user_id)
        .where(
            ServerMember.server_id == server_id,
            ServerMember.status == "accepted",
            Device.is_trusted == True,
            Device.deleted_at == None,
        )
    )
    return {str(device_id) for device_id in result.scalars().all()}


def _validate_submitted_device_ids(
    encrypted_keys: List[EncryptedKeySubmission],
    expected_device_ids: Set[str],
):
    submitted_device_ids = [key.device_id for key in encrypted_keys]
    submitted_set = set(submitted_device_ids)

    if len(submitted_set) != len(submitted_device_ids):
        raise HTTPException(
            status_code=400,
            detail="Duplicate device_id entries are not allowed in encrypted_keys.",
        )

    if submitted_set != expected_device_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Encrypted keys must match the exact set of trusted accepted member devices.",
                "missing_device_ids": sorted(expected_device_ids - submitted_set),
                "unexpected_device_ids": sorted(submitted_set - expected_device_ids),
            },
        )


async def _get_requesting_trusted_device(
    device_id: str,
    current_user: User,
    db: AsyncSession,
) -> Device:
    result = await db.execute(
        select(Device).where(
            Device.id == device_id,
            Device.user_id == current_user.id,
            Device.is_trusted == True,
            Device.deleted_at == None,
        )
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=403, detail="Invalid device_id for current user.")
    return device


async def _get_channel_key_row_for_device_or_public_key(
    channel_id: str,
    epoch: int,
    requesting_device: Device,
    db: AsyncSession,
):
    owner_device = aliased(Device)

    exact_result = await db.execute(
        select(ChannelDeviceKey, owner_device.public_key.label("owner_public_key"))
        .join(owner_device, ChannelDeviceKey.owner_device_id == owner_device.id)
        .where(
            ChannelDeviceKey.channel_id == channel_id,
            ChannelDeviceKey.device_id == requesting_device.id,
            ChannelDeviceKey.epoch == epoch,
        )
    )
    exact_row = exact_result.first()
    if exact_row:
        return exact_row

    target_device = aliased(Device)
    fallback_result = await db.execute(
        select(ChannelDeviceKey, owner_device.public_key.label("owner_public_key"))
        .join(owner_device, ChannelDeviceKey.owner_device_id == owner_device.id)
        .join(target_device, ChannelDeviceKey.device_id == target_device.id)
        .where(
            ChannelDeviceKey.channel_id == channel_id,
            ChannelDeviceKey.epoch == epoch,
            target_device.user_id == requesting_device.user_id,
            target_device.public_key == requesting_device.public_key,
        )
        .order_by(ChannelDeviceKey.created_at.desc())
    )
    return fallback_result.first()


async def _get_entitled_epoch_rows_for_device_or_public_key(
    channel_id: str,
    requesting_device: Device,
    db: AsyncSession,
):
    owner_device = aliased(Device)
    target_device = aliased(Device)

    result = await db.execute(
        select(
            ChannelDeviceKey.epoch,
            ChannelDeviceKey.encrypted_channel_key,
            owner_device.public_key.label("owner_public_key"),
            target_device.id.label("matched_device_id"),
        )
        .join(owner_device, ChannelDeviceKey.owner_device_id == owner_device.id)
        .join(target_device, ChannelDeviceKey.device_id == target_device.id)
        .where(
            ChannelDeviceKey.channel_id == channel_id,
            target_device.user_id == requesting_device.user_id,
            or_(
                target_device.id == requesting_device.id,
                target_device.public_key == requesting_device.public_key,
            ),
        )
        .order_by(
            ChannelDeviceKey.epoch.asc(),
            case((target_device.id == requesting_device.id, 0), else_=1),
            ChannelDeviceKey.created_at.desc(),
        )
    )

    deduped_rows = []
    seen_epochs = set()
    for row in result.all():
        if row.epoch in seen_epochs:
            continue
        seen_epochs.add(row.epoch)
        deduped_rows.append(row)
    return deduped_rows


@router.get("/my-channels")
async def get_my_encrypted_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a list of { channel_id, is_encrypted } for all encrypted channels the user can access.
    """
    query = (
        select(Channel.id)
        .join(Server, Channel.server_id == Server.id)
        .join(ServerMember, Server.id == ServerMember.server_id)
        .join(ChannelEncryption, Channel.id == ChannelEncryption.channel_id)
        .where(
            ServerMember.user_id == current_user.id,
            ServerMember.status == "accepted",
            ChannelEncryption.is_enabled == True,
        )
    )
    result = await db.execute(query)
    channels = result.scalars().all()
    return [{"channel_id": str(channel_id), "is_encrypted": True} for channel_id in channels]


@router.get("/server/{server_id}/user/{user_id}/encrypted-channels")
async def get_user_encrypted_channels_in_server(
    server_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns channel IDs in a server for which the given user currently has encrypted history rows.
    """
    serv_query = select(Server).where(Server.id == server_id, Server.owner_id == current_user.id)
    serv_res = await db.execute(serv_query)
    if not serv_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only server owner can query this information.")

    query = (
        select(ChannelDeviceKey.channel_id)
        .distinct()
        .join(Device, ChannelDeviceKey.device_id == Device.id)
        .join(Channel, ChannelDeviceKey.channel_id == Channel.id)
        .where(
            Device.user_id == user_id,
            Channel.server_id == server_id,
        )
    )
    result = await db.execute(query)
    channels = result.scalars().all()
    return [str(channel_id) for channel_id in channels]


@router.post("/{channel_id}/enable")
async def enable_channel_encryption(
    channel_id: str,
    req: EnableEncryptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chan_query = (
        select(Channel)
        .join(Server)
        .where(Channel.id == channel_id, Server.owner_id == current_user.id)
    )
    chan_res = await db.execute(chan_query)
    channel = chan_res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=403, detail="Only server owner can enable channel encryption.")

    owner_device = await _get_requesting_trusted_device(req.submitting_device_id, current_user, db)

    expected_device_ids = await _get_expected_trusted_device_ids_for_server(
        str(channel.server_id),
        db,
    )
    _validate_submitted_device_ids(req.encrypted_keys, expected_device_ids)

    try:
        enc_query = select(ChannelEncryption).where(ChannelEncryption.channel_id == channel_id)
        enc_res = await db.execute(enc_query)
        if enc_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Encryption already enabled on this channel.")

        encryption_record = ChannelEncryption(
            channel_id=channel_id,
            is_enabled=True,
            current_epoch=1,
        )
        db.add(encryption_record)

        for key in req.encrypted_keys:
            db.add(
                ChannelDeviceKey(
                    channel_id=channel_id,
                    device_id=key.device_id,
                    epoch=1,
                    encrypted_channel_key=key.encrypted_channel_key,
                    owner_device_id=owner_device.id,
                )
            )

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {"channel_id": channel_id, "epoch": 1}


@router.get("/{channel_id}/my-key")
async def get_my_current_channel_key(
    channel_id: str,
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    requesting_device = await _get_requesting_trusted_device(device_id, current_user, db)

    membership_query = (
        select(ServerMember)
        .join(Channel, Channel.server_id == ServerMember.server_id)
        .where(
            Channel.id == channel_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == "accepted",
        )
    )
    membership_res = await db.execute(membership_query)
    if not membership_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not an accepted member of this channel's server.")

    enc_query = select(ChannelEncryption).where(
        ChannelEncryption.channel_id == channel_id,
        ChannelEncryption.is_enabled == True,
    )
    enc_res = await db.execute(enc_query)
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=404, detail="Channel encryption not enabled.")

    row = await _get_channel_key_row_for_device_or_public_key(
        channel_id,
        enc.current_epoch,
        requesting_device,
        db,
    )
    if not row:
        raise HTTPException(status_code=403, detail="No key found for this device at the current epoch.")

    key_record, owner_public_key = row
    return {
        "epoch": enc.current_epoch,
        "encrypted_channel_key": key_record.encrypted_channel_key,
        "owner_device_id": str(key_record.owner_device_id) if key_record.owner_device_id else None,
        "owner_device_public_key": owner_public_key,
    }


@router.post("/{channel_id}/rotate")
async def rotate_channel_key(
    channel_id: str,
    req: EnableEncryptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    chan_query = (
        select(Channel)
        .join(Server)
        .where(Channel.id == channel_id, Server.owner_id == current_user.id)
    )
    chan_res = await db.execute(chan_query)
    channel = chan_res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=403, detail="Only server owner can rotate channel keys.")

    owner_device = await _get_requesting_trusted_device(req.submitting_device_id, current_user, db)

    expected_device_ids = await _get_expected_trusted_device_ids_for_server(
        str(channel.server_id),
        db,
    )
    _validate_submitted_device_ids(req.encrypted_keys, expected_device_ids)

    try:
        enc_query = (
            select(ChannelEncryption)
            .where(
                ChannelEncryption.channel_id == channel_id,
                ChannelEncryption.is_enabled == True,
            )
            .with_for_update()
        )
        enc_res = await db.execute(enc_query)
        enc = enc_res.scalar_one_or_none()
        if not enc:
            raise HTTPException(status_code=400, detail="Channel encryption not enabled.")

        new_epoch = enc.current_epoch + 1
        enc.current_epoch = new_epoch

        for key in req.encrypted_keys:
            db.add(
                ChannelDeviceKey(
                    channel_id=channel_id,
                    device_id=key.device_id,
                    epoch=new_epoch,
                    encrypted_channel_key=key.encrypted_channel_key,
                    owner_device_id=owner_device.id,
                )
            )

        await db.commit()
        try:
            await manager.broadcast_to_channel(
                channel_id,
                {
                    "type": "channel_epoch_rotated",
                    "channel_id": channel_id,
                    "epoch": new_epoch
                }
            )
        except Exception as e:
            print(f"WS Broadcast failed (non-fatal): {e}")
    except Exception:
        await db.rollback()
        raise

    return {"channel_id": channel_id, "epoch": new_epoch}


@router.post("/{channel_id}/distribute-to-device")
async def distribute_key_to_device(
    channel_id: str,
    device_id: str,
    req: DistributeKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by an existing trusted device to distribute a channel key copy to another trusted device.
    """
    submitting_device = await _get_requesting_trusted_device(device_id, current_user, db)

    membership_query = (
        select(ServerMember)
        .join(Channel, Channel.server_id == ServerMember.server_id)
        .where(
            Channel.id == channel_id,
            ServerMember.user_id == current_user.id,
            ServerMember.status == "accepted",
        )
    )
    membership_res = await db.execute(membership_query)
    if not membership_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You are not an accepted member of this encrypted channel.")

    enc_query = select(ChannelEncryption).where(
        ChannelEncryption.channel_id == channel_id,
        ChannelEncryption.is_enabled == True,
    )
    enc_res = await db.execute(enc_query)
    enc = enc_res.scalar_one_or_none()
    if not enc:
        raise HTTPException(status_code=400, detail="Channel encryption not enabled.")
    if req.epoch < 1 or req.epoch > enc.current_epoch:
        raise HTTPException(status_code=400, detail="Invalid epoch for channel key distribution.")

    targ_dev_query = select(Device).where(
        Device.id == req.target_device_id,
        Device.user_id == current_user.id,
        Device.is_trusted == True,
        Device.deleted_at == None,
    )
    targ_res = await db.execute(targ_dev_query)
    if not targ_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Target device does not belong to you or is untrusted.")

    existing_query = select(ChannelDeviceKey).where(
        ChannelDeviceKey.channel_id == channel_id,
        ChannelDeviceKey.device_id == req.target_device_id,
        ChannelDeviceKey.epoch == req.epoch,
    )
    existing_res = await db.execute(existing_query)
    existing_key = existing_res.scalar_one_or_none()

    if existing_key:
        existing_key.encrypted_channel_key = req.encrypted_channel_key
        existing_key.owner_device_id = submitting_device.id
    else:
        db.add(
            ChannelDeviceKey(
                channel_id=channel_id,
                device_id=req.target_device_id,
                epoch=req.epoch,
                encrypted_channel_key=req.encrypted_channel_key,
                owner_device_id=submitting_device.id,
            )
        )

    await db.commit()
    return {"status": "success"}


@router.get("/{channel_id}/entitled-epochs")
async def get_entitled_epochs(
    channel_id: str,
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    requesting_device = await _get_requesting_trusted_device(device_id, current_user, db)
    rows = await _get_entitled_epoch_rows_for_device_or_public_key(
        channel_id,
        requesting_device,
        db,
    )

    return [
        {
            "epoch": row.epoch,
            "encrypted_channel_key": row.encrypted_channel_key,
            "owner_device_public_key": row.owner_public_key,
        }
        for row in rows
    ]
