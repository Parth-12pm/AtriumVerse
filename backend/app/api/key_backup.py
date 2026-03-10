from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.models.key_backup import KeyBackup

router = APIRouter()

class KeyBackupCreate(BaseModel):
    encrypted_blob: str
    backup_method: str  # "prf" or "passphrase"
    prf_credential_id: Optional[str] = None
    salt: Optional[str] = None


class KeyBackupResponse(BaseModel):
    encrypted_blob: str
    backup_method: str
    prf_credential_id: Optional[str]
    salt: Optional[str]
    updated_at: datetime


@router.post("/key-backup")
async def upsert_key_backup(
    body: KeyBackupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Stores the user's encrypted private key backup.
    The PRF output or passphrase that produced the encryption key is NEVER sent here.
    The server receives only the result of encryption, not the key that produced it.
    """
    if body.backup_method not in ("prf", "passphrase"):
        raise HTTPException(status_code=400, detail="Invalid backup method")
    
    if body.backup_method == "prf" and not body.prf_credential_id:
        raise HTTPException(status_code=400, detail="prf_credential_id is required for PRF backups")
    
    if body.backup_method == "passphrase" and not body.salt:
        raise HTTPException(status_code=400, detail="salt is required for passphrase backups")

    result = await db.execute(select(KeyBackup).where(KeyBackup.user_id == current_user.id))
    backup = result.scalars().first()

    if backup:
        backup.encrypted_blob = body.encrypted_blob
        backup.backup_method = body.backup_method
        backup.prf_credential_id = body.prf_credential_id
        backup.salt = body.salt
        backup.updated_at = datetime.utcnow()
    else:
        backup = KeyBackup(
            user_id=current_user.id,
            encrypted_blob=body.encrypted_blob,
            backup_method=body.backup_method,
            prf_credential_id=body.prf_credential_id,
            salt=body.salt
        )
        db.add(backup)

    await db.commit()
    await db.refresh(backup)
    
    return {"updated_at": backup.updated_at}


@router.get("/key-backup", response_model=KeyBackupResponse)
async def get_key_backup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the encrypted blob and metadata so the browser can attempt recovery.
    Returns the backup_method so the frontend knows whether to trigger WebAuthn PRF or
    prompt for a passphrase.
    """
    result = await db.execute(select(KeyBackup).where(KeyBackup.user_id == current_user.id))
    backup = result.scalars().first()

    if not backup:
        raise HTTPException(status_code=404, detail="No key backup found")

    return KeyBackupResponse(
        encrypted_blob=backup.encrypted_blob,
        backup_method=backup.backup_method,
        prf_credential_id=backup.prf_credential_id,
        salt=backup.salt,
        updated_at=backup.updated_at
    )


@router.delete("/key-backup")
async def delete_key_backup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes the backup. The frontend must heavily warn the user before calling this,
    as losing a device without a backup means permanent data loss.
    """
    result = await db.execute(select(KeyBackup).where(KeyBackup.user_id == current_user.id))
    backup = result.scalars().first()

    if not backup:
        raise HTTPException(status_code=404, detail="No key backup found")

    await db.delete(backup)
    await db.commit()

    return {"status": "success"}
