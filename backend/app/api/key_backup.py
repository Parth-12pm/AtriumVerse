import base64
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from webauthn import verify_registration_response

from app.api.deps import get_current_user
from app.core import redis_client
from app.core.database import get_db
from app.models.key_backup import KeyBackup
from app.models.user import User
from app.schemas.key_backup import ChallengeResponse, KeyBackupCreate, KeyBackupResponse

router = APIRouter()

WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:3000")
BACKUP_CHALLENGE_TTL = 60


def buffer_to_base64url(buffer: bytes) -> str:
    return base64.urlsafe_b64encode(buffer).rstrip(b"=").decode()


def base64url_to_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _redis_challenge_key(user_id) -> str:
    return f"key_backup_challenge:{user_id}"


@router.get("/key-backup/challenge", response_model=ChallengeResponse)
async def get_key_backup_challenge(
    current_user: User = Depends(get_current_user),
):
    challenge = buffer_to_base64url(secrets.token_bytes(32))
    await redis_client.r.setex(
        _redis_challenge_key(current_user.id), BACKUP_CHALLENGE_TTL, challenge
    )
    return ChallengeResponse(challenge=challenge)


@router.post("/key-backup")
async def upsert_key_backup(
    body: KeyBackupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Stores the user's encrypted private key backup.
    The PRF output or passphrase that produced the encryption key is never sent here.
    """
    if body.backup_method not in ("prf", "passphrase"):
        raise HTTPException(status_code=400, detail="Invalid backup method")

    prf_credential_id = None
    prf_credential_public_key = None
    prf_sign_count = None

    if body.backup_method == "prf":
        if not body.prf_registration_credential or not body.prf_registration_challenge:
            raise HTTPException(
                status_code=400,
                detail="PRF backups require a registration credential and challenge",
            )

        stored_challenge = await redis_client.r.get(
            _redis_challenge_key(current_user.id)
        )
        if not stored_challenge:
            raise HTTPException(
                status_code=400,
                detail="PRF registration challenge expired. Fetch a new challenge and retry.",
            )

        stored_challenge_value = (
            stored_challenge.decode()
            if isinstance(stored_challenge, bytes)
            else stored_challenge
        )
        if body.prf_registration_challenge != stored_challenge_value:
            raise HTTPException(
                status_code=400,
                detail="PRF registration challenge did not match the server-issued challenge.",
            )

        try:
            verified_registration = verify_registration_response(
                credential=body.prf_registration_credential,
                expected_challenge=base64url_to_bytes(stored_challenge_value),
                expected_rp_id=WEBAUTHN_RP_ID,
                expected_origin=WEBAUTHN_ORIGIN,
                require_user_verification=True,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid PRF registration: {exc}",
            ) from exc

        await redis_client.r.delete(_redis_challenge_key(current_user.id))

        prf_credential_id = buffer_to_base64url(verified_registration.credential_id)
        if body.prf_credential_id and body.prf_credential_id != prf_credential_id:
            raise HTTPException(
                status_code=400,
                detail="PRF credential ID mismatch between registration payloads",
            )

        prf_credential_public_key = buffer_to_base64url(
            verified_registration.credential_public_key,
        )
        prf_sign_count = verified_registration.sign_count
    elif not body.salt:
        raise HTTPException(
            status_code=400, detail="salt is required for passphrase backups"
        )

    result = await db.execute(
        select(KeyBackup).where(KeyBackup.user_id == current_user.id)
    )
    backup = result.scalars().first()

    if backup:
        backup.encrypted_blob = body.encrypted_blob
        backup.backup_method = body.backup_method
        backup.prf_credential_id = prf_credential_id
        backup.prf_credential_public_key = prf_credential_public_key
        backup.prf_sign_count = prf_sign_count
        backup.salt = body.salt
        backup.updated_at = datetime.utcnow()
    else:
        backup = KeyBackup(
            user_id=current_user.id,
            encrypted_blob=body.encrypted_blob,
            backup_method=body.backup_method,
            prf_credential_id=prf_credential_id,
            prf_credential_public_key=prf_credential_public_key,
            prf_sign_count=prf_sign_count,
            salt=body.salt,
        )
        db.add(backup)

    await db.commit()
    await db.refresh(backup)
    return {"updated_at": backup.updated_at}


@router.get("/key-backup", response_model=KeyBackupResponse)
async def get_key_backup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the encrypted blob and metadata so the browser can attempt recovery.
    """
    result = await db.execute(
        select(KeyBackup).where(KeyBackup.user_id == current_user.id)
    )
    backup = result.scalars().first()

    if not backup:
        raise HTTPException(status_code=404, detail="No key backup found")

    return KeyBackupResponse(
        encrypted_blob=backup.encrypted_blob,
        backup_method=backup.backup_method,
        prf_credential_id=backup.prf_credential_id,
        salt=backup.salt,
        updated_at=backup.updated_at,
    )


@router.delete("/key-backup")
async def delete_key_backup(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes the backup. The frontend must heavily warn before calling this.
    """
    result = await db.execute(
        select(KeyBackup).where(KeyBackup.user_id == current_user.id)
    )
    backup = result.scalars().first()

    if not backup:
        raise HTTPException(status_code=404, detail="No key backup found")

    await db.delete(backup)
    await db.commit()
    return {"status": "success"}
