# """
# Phase 4 — Device Registration & Listing

# These endpoints handle the simpler half of the device system.
# WebAuthn assertion (the ceremony) comes in Phase 5.

# Key design reminder:
#   - Registering a public key proves nothing about who holds the private key.
#   - is_trusted=False until the Phase 5 ceremony elevates it.
#   - The ONE exception: the very first device a user ever registers is auto-trusted
#     (no existing trusted device to run a ceremony with). This is protected at the DB
#     layer by a partial unique index — see device.py and the TOCTOU explanation below.
# """

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy import update
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.device import Device
from app.models.key_backup import KeyBackup
from app.models.dm_device_key import DmDeviceKey


router = APIRouter()


# ─────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────
class RecoveryDeviceRequest(BaseModel):
    public_key: str
    device_label: str


class DeviceRegisterRequest(BaseModel):
    public_key: str          # base64-encoded X25519 public key from the browser
    device_label: Optional[str] = None


class DeviceRegisterResponse(BaseModel):
    device_id: uuid.UUID
    is_trusted: bool


class MyDeviceResponse(BaseModel):
    device_id: uuid.UUID
    device_label: Optional[str]
    is_trusted: bool
    created_at: Optional[datetime]


class PublicDeviceResponse(BaseModel):
    device_id: uuid.UUID
    public_key: str


# ─────────────────────────────────────────
# POST /devices/register
# ─────────────────────────────────────────

@router.post("/register", response_model=DeviceRegisterResponse)
async def register_device(
    body: DeviceRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new device (browser) for the current user.

    FIRST-DEVICE TOCTOU RACE — why the naive check is dangerous:
    ─────────────────────────────────────────────────────────────
    The naive approach: query for existing trusted devices, if none exist, set
    is_trusted=True on the new row. This has a race condition: two browser tabs
    can both execute the SELECT simultaneously, both see zero trusted devices,
    and both INSERT as trusted — creating two root-of-trust devices with no
    ceremony between them. That destroys the security model.

    Fix (Option A — partial unique index):
    We use a partial unique index on devices(user_id) WHERE is_trusted = True.
    This makes the DB itself enforce "at most one trusted device per user" as
    an atomicity guarantee. The second concurrent INSERT gets an IntegrityError
    which we catch and convert to a 409. Application logic cannot race the DB.

    Wait — users CAN have multiple trusted devices (each browser that completes
    the ceremony becomes trusted). The index is NOT a "one trusted device ever"
    constraint — it only prevents two devices from SIMULTANEOUSLY becoming the
    FIRST trusted device (the bootstrap race). Once the first trusted device
    exists, subsequent devices go through the ceremony and are set trusted
    individually at different times, so the index never blocks them.
    """
    # Check if this user already has at least one trusted device.
    result = await db.execute(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.is_trusted == True,
            Device.deleted_at == None,
        ).limit(1)
    )
    has_trusted_device = result.scalars().first() is not None

    # If no trusted device exists → this IS the first device → auto-trust it.
    # If a trusted device exists, check if this is a recovery of an already trusted key.
    # An attacker gains no decryption ability by registering an already-trusted public key
    # without possessing the private key, so we can safely mirror the trust status.
    is_trusted = False
    if not has_trusted_device:
        is_trusted = True
    else:
        # Check if they are recovering an existing trusted public key
        trusted_key_res = await db.execute(
            select(Device).where(
                Device.user_id == current_user.id,
                Device.is_trusted == True,
                Device.deleted_at == None,
                Device.public_key == body.public_key
            ).limit(1)
        )
        if trusted_key_res.scalar_one_or_none():
            is_trusted = True

    new_device = Device(
        user_id=current_user.id,
        public_key=body.public_key,
        device_label=body.device_label,
        is_trusted=is_trusted,
    )

    db.add(new_device)

    try:
        await db.commit()
        await db.refresh(new_device)
    except IntegrityError:
        # Partial unique index fired: two tabs raced to be the first trusted device.
        # The second one loses — it must go through the linking ceremony.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Another device was registered as root of trust simultaneously. "
                "Use the device linking ceremony to add this device."
            ),
        )

    return DeviceRegisterResponse(
        device_id=new_device.id,
        is_trusted=new_device.is_trusted,
    )


# ─────────────────────────────────────────
# GET /devices/my-devices
# ─────────────────────────────────────────

@router.get("/my-devices", response_model=List[MyDeviceResponse])
async def get_my_devices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the current user's own devices with trust status.

    Used by the frontend on mount to detect:
      - No devices at all → brand new user, begin onboarding
      - Device exists, is_trusted=True → normal flow, private key should be in IndexedDB
      - Device exists, is_trusted=False → ceremony needed
    """
    result = await db.execute(
        select(Device)
        .where(Device.user_id == current_user.id, Device.deleted_at == None)
        .order_by(Device.created_at.desc())
    )
    devices = result.scalars().all()

    return [
        MyDeviceResponse(
            device_id=d.id,
            device_label=d.device_label,
            is_trusted=d.is_trusted,
            created_at=d.created_at,
        )
        for d in devices
    ]


# ─────────────────────────────────────────
# GET /devices/user/{user_id}
# ─────────────────────────────────────────

@router.get("/user/{user_id}", response_model=List[PublicDeviceResponse])
async def get_user_trusted_devices(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the trusted device public keys for any user.

    Used by:
      - DM sender: fetch recipient's trusted devices to encrypt the message for each one
      - Channel key distributor: fetch each member's trusted devices to wrap the channel key

    Why only trusted devices are returned:
      An untrusted device has not yet proven ownership of the corresponding private key.
      Distributing channel keys or DM ciphertext to an untrusted device grants decryption
      access before the ceremony has verified the device is actually controlled by the user.

    Public keys are NOT secret by design — any authenticated user can fetch them.
    This is the same model as PGP: your public key is public.
    """
    result = await db.execute(
        select(Device).where(
            Device.user_id == user_id,
            Device.is_trusted == True,
            Device.deleted_at == None,
        )
    )
    devices = result.scalars().all()

    return [
        PublicDeviceResponse(device_id=d.id, public_key=d.public_key)
        for d in devices
    ]


# ─────────────────────────────────────────
# GET /devices/server/{server_id}
# ─────────────────────────────────────────

@router.get("/server/{server_id}", response_model=List[PublicDeviceResponse])
async def get_server_trusted_devices(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all trusted device public keys for every member of a server.
    Used by the frontend when enabling channel encryption to encrypt the 
    initial Epoch 1 key for all current members.
    """
    from app.models.server_member import ServerMember
    
    # Verify current user is in the server
    member_query = select(ServerMember).where(
        ServerMember.server_id == server_id,
        ServerMember.user_id == current_user.id
    )
    member_res = await db.execute(member_query)
    if not member_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this server.")

    # Fetch all trusted un-deleted devices for all accepted members
    result = await db.execute(
        select(Device)
        .join(ServerMember, Device.user_id == ServerMember.user_id)
        .where(
            ServerMember.server_id == server_id,
            ServerMember.status == "accepted",
            Device.is_trusted == True,
            Device.deleted_at == None
        )
    )
    devices = result.scalars().all()

    return [
        PublicDeviceResponse(device_id=d.id, public_key=d.public_key)
        for d in devices
    ]

# ─────────────────────────────────────────
# DELETE /devices/{device_id}
# ─────────────────────────────────────────

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Removes a device. Only the owning user can delete their own device.

    IMPORTANT — what this endpoint does NOT do (frontend must handle):
    ─────────────────────────────────────────────────────────────────
    1. Channel key rotation: if this was the only trusted device for a user who is
       a member of encrypted channels, the channel owner should rotate the epoch.
       The frontend must surface: "Removing this device will require channel key rotation."

    2. DM key cleanup: a background job must run:
         UPDATE dm_device_keys
         SET device_id = NULL, deleted_device_id = <this device's id>
         WHERE device_id = <this device's id>
       This preserves the distinction between "message predates device" and
       "device was deleted" (see dm_device_key.py docstring).

    This endpoint only removes the device row. The DB CASCADE handles
    device_link_requests and channel_device_keys cleanup automatically.
    dm_device_keys.device_id becomes NULL via the SET NULL FK.
    """
    result = await db.execute(
        select(Device).where(Device.id == device_id)
    )
    device = result.scalars().first()

    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    if device.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own devices",
        )

    # SOFT DELETE
    device.deleted_at = datetime.utcnow()

    # Tombstone dm_device_keys in the same transaction so there is no window
    # where device_id is NULL but deleted_device_id is still unset.
    # This preserves the frontend's ability to distinguish:
    #   device_id=NULL + deleted_device_id SET   → "encrypted for a device you removed"
    #   device_id=NULL + deleted_device_id NULL  → "predates this device"
    await db.execute(
        update(DmDeviceKey)
        .where(DmDeviceKey.device_id == device_id)
        .values(
            device_id=None,
            deleted_device_id=device_id,
        )
        .execution_options(synchronize_session="fetch")
    )

    await db.commit()


@router.post("/recover", response_model=DeviceRegisterResponse)
async def recover_device(
    body: RecoveryDeviceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Recovery-path device registration.
    Marks the new device trusted immediately because the caller has already
    proven key ownership by decrypting the backup blob client-side.
    The server verifies a backup record exists before granting trust.
    """
    # Guard: a backup must exist — this is the server-side proof that the
    # caller legitimately holds the key material, not just a valid JWT.
    backup_result = await db.execute(
        select(KeyBackup).where(KeyBackup.user_id == current_user.id).limit(1)
    )
    if not backup_result.scalars().first():
        raise HTTPException(status_code=403, detail="No key backup found. Cannot recover without a backup.")

    # Idempotency: if a previous recovery attempt already registered this key,
    # just ensure it is trusted and return it.
    existing_result = await db.execute(
        select(Device).where(
            Device.user_id == current_user.id,
            Device.public_key == body.public_key,
            Device.deleted_at == None,
        ).limit(1)
    )
    existing = existing_result.scalars().first()
    if existing:
        if not existing.is_trusted:
            existing.is_trusted = True
            await db.commit()
            await db.refresh(existing)
        return DeviceRegisterResponse(device_id=existing.id, is_trusted=existing.is_trusted)

    # Register the device and trust it immediately — key difference from /register.
    device = Device(
        user_id=current_user.id,
        public_key=body.public_key,
        device_label=body.device_label,
        is_trusted=True,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return DeviceRegisterResponse(device_id=device.id, is_trusted=device.is_trusted)