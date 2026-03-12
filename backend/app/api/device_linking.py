"""
Phase 5 — Device Linking & WebAuthn

Most security-critical phase. Every check in approve() exists for a reason.
Removing or softening any of them breaks the E2EE guarantee.

Two paths for the new device:
  Path A (Real-time): Old device tab is open → WS notification fires immediately
  Path B (Async):     Old device tab is closed → request waits in DB, shown on next mount

From the new device's perspective both paths are identical — it always polls.
"""

import os
import secrets
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, or_

import webauthn

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.device import Device
from app.models.device_link_request import DeviceLinkRequest
from app.models.dm_epoch import DmEpoch
from app.models.key_backup import KeyBackup
from app.core.redis_client import r
from app.core.socket_manager import manager


router = APIRouter()

# ── Config ──────────────────────────────────────────────────────────────────
DEVICE_LINK_EXPIRY_MINUTES = int(os.getenv("DEVICE_LINK_EXPIRY_MINUTES", "15"))
WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:3000")
MAX_CHALLENGE_TTL = 60  # seconds


# ── Schemas ──────────────────────────────────────────────────────────────────

class LinkRequestBody(BaseModel):
    new_device_id: UUID
    temp_public_key: str
    device_label: Optional[str] = None


class LinkRequestResponse(BaseModel):
    request_id: UUID
    expires_at: datetime


class PendingRequestResponse(BaseModel):
    request_id: UUID
    new_device_id: UUID
    new_device_label: Optional[str]
    temp_public_key: str
    expires_at: datetime
    webauthn_credential_id: Optional[str]   # needed for allowCredentials in the browser
    has_passphrase_backup: bool = False      # true when user has passphrase backup but no PRF credential


class StatusResponse(BaseModel):
    status: str
    encrypted_private_key: Optional[str] = None
    approved_by_device_public_key: Optional[str] = None
    permanent_public_key: Optional[str] = None


class ApproveBody(BaseModel):
    approving_device_id: UUID
    webauthn_assertion: dict   # raw assertion JSON from navigator.credentials.get()
    encrypted_private_key: str  # base64(IV + AES-GCM ciphertext of user's private key)
    permanent_public_key: str  # the approving trusted device's permanent public key to apply to the new device


class ChallengeResponse(BaseModel):
    challenge: str   # base64url nonce


# ── Helpers ──────────────────────────────────────────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _redis_challenge_key(request_id: UUID) -> str:
    return f"webauthn_challenge:{request_id}"


def _base64url_to_bytes(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


# ── GET /device-linking/challenge ────────────────────────────────────────────

@router.get("/challenge", response_model=ChallengeResponse)
async def get_challenge(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Issues a single-use random nonce for WebAuthn to sign.

    CRITICAL TTL LOGIC:
      challenge_ttl = min(60s, time_until_request_expiry)

      If the link request expires in 30 seconds, issuing a 60-second challenge is
      a logic error — the challenge would still be in Redis after the request has
      expired, and an attacker could craft a valid assertion against a dead request.
      The challenge TTL must never outlive the request it belongs to.

    Two distinct errors — teach why they must be separate:
      CHALLENGE_EXPIRED  → Redis key gone, request still valid → "Fetch a new challenge and retry"
      REQUEST_EXPIRED    → request.expires_at passed          → "Start the linking process over"
    Collapsing both into a generic 400 forces users to restart when only a retry is needed.
    """
    # Load the request to compute time-remaining-aware TTL
    result = await db.execute(
        select(DeviceLinkRequest).where(DeviceLinkRequest.id == request_id)
    )
    link_request = result.scalars().first()

    if not link_request:
        raise HTTPException(status_code=404, detail="Link request not found")

    if link_request.requesting_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    now = _now_utc()
    if link_request.expires_at < now:
        raise HTTPException(
            status_code=410,
            detail="REQUEST_EXPIRED: This link request has expired. Start over.",
        )

    # Challenge TTL = min(60s, seconds until request expires)
    seconds_remaining = (link_request.expires_at - now).total_seconds()
    challenge_ttl = int(min(MAX_CHALLENGE_TTL, seconds_remaining))

    nonce = secrets.token_urlsafe(32)
    await r.setex(_redis_challenge_key(request_id), challenge_ttl, nonce)

    return ChallengeResponse(challenge=nonce)


# ── POST /device-linking/request ─────────────────────────────────────────────

@router.post("/request", response_model=LinkRequestResponse)
async def create_link_request(
    body: LinkRequestBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the new device after it has registered its permanent public key.

    Validates that:
      - new_device_id belongs to this user
      - no existing non-expired pending request exists for this device (prevent duplicates)

    Then stores the request and attempts to notify all active sessions for this user
    across ALL server_ids (user may be connected to multiple servers simultaneously).
    The async path (old device offline) always works regardless — the request is stored.
    """
    # Validate device ownership
    result = await db.execute(
        select(Device).where(
            Device.id == body.new_device_id,
            Device.user_id == current_user.id,
        )
    )
    new_device = result.scalars().first()
    if not new_device:
        raise HTTPException(status_code=404, detail="Device not found or not yours")

    # Prevent duplicate pending requests for the same device
    now = _now_utc()
    result = await db.execute(
        select(DeviceLinkRequest).where(
            DeviceLinkRequest.new_device_id == body.new_device_id,
            DeviceLinkRequest.status == "pending",
            DeviceLinkRequest.expires_at > now,
        )
    )
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending link request already exists for this device. Wait for it to expire or be resolved.",
        )

    expires_at = now + timedelta(minutes=DEVICE_LINK_EXPIRY_MINUTES)
    link_request = DeviceLinkRequest(
        requesting_user_id=current_user.id,
        new_device_id=body.new_device_id,
        temp_public_key=body.temp_public_key,
        new_device_label=body.device_label,
        status="pending",
        expires_at=expires_at,
    )
    db.add(link_request)
    await db.commit()
    await db.refresh(link_request)

    # Notify all active sessions for this user across ALL server_ids (Path A — real-time)
    ws_payload = {
        "type": "device_link_request",
        "request_id": str(link_request.id),
        "new_device_id": str(link_request.new_device_id),
        "new_device_label": body.device_label,
        "temp_public_key": body.temp_public_key,
        "expires_at": expires_at.isoformat(),
    }
    user_id_str = str(current_user.id)
    for server_id, connections in manager.active_connections.items():
        if user_id_str in connections:
            try:
                await connections[user_id_str].send_json(ws_payload)
            except Exception:
                pass  # Connection may have dropped — async path handles it

    return LinkRequestResponse(request_id=link_request.id, expires_at=expires_at)


# ── GET /device-linking/pending ──────────────────────────────────────────────

@router.get("/pending", response_model=List[PendingRequestResponse])
async def get_pending_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called on every app mount by the trusted old device.

    Returns non-expired pending requests. If any exist, the old device shows the
    approval UI immediately (Path B — async).

    IMPORTANT — webauthn_credential_id is included in the response:
    The browser's navigator.credentials.get() needs allowCredentials to specify exactly
    which credential to use. Without it:
      - Browser shows a generic passkey picker → confusing UX
      - Server-side verification becomes ambiguous (cannot be certain which credential signed)
    We fetch the credential_id from the approving device's row (the device making this
    GET request is the potential approver — we look up its webauthn_credential_id).
    """
    now = _now_utc()

    # Device-link approval is bound to the verified PRF credential we stored during
    # backup setup. That gives the browser an allowCredentials target and gives the
    # server the credential public key/sign-count needed for py_webauthn verification.
    backup_result = await db.execute(
        select(KeyBackup).where(
            KeyBackup.user_id == current_user.id,
            KeyBackup.backup_method == "prf",
            KeyBackup.prf_credential_id != None,
            KeyBackup.prf_credential_public_key != None,
        )
    )
    key_backup = backup_result.scalars().first()
    webauthn_credential_id = key_backup.prf_credential_id if key_backup else None

    # Detect passphrase-backup users so the frontend can offer an alternative
    # approval path instead of blocking them entirely.
    has_passphrase_backup = False
    if not webauthn_credential_id:
        passphrase_result = await db.execute(
            select(KeyBackup).where(
                KeyBackup.user_id == current_user.id,
                KeyBackup.backup_method == "passphrase",
            ).limit(1)
        )
        has_passphrase_backup = passphrase_result.scalars().first() is not None

    result = await db.execute(
        select(DeviceLinkRequest).where(
            DeviceLinkRequest.requesting_user_id == current_user.id,
            DeviceLinkRequest.status == "pending",
            DeviceLinkRequest.expires_at > now,
        )
    )
    requests = result.scalars().all()

    return [
        PendingRequestResponse(
            request_id=req.id,
            new_device_id=req.new_device_id,
            new_device_label=req.new_device_label,
            temp_public_key=req.temp_public_key,
            expires_at=req.expires_at,
            webauthn_credential_id=webauthn_credential_id,
            has_passphrase_backup=has_passphrase_backup,
        )
        for req in requests
    ]


# ── GET /device-linking/request/{request_id}/status ─────────────────────────

@router.get("/request/{request_id}/status", response_model=StatusResponse)
async def get_request_status(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Polled by the new device every 5 seconds until status = \"approved\" or \"rejected\".

    Returns approved_by_device_public_key when approved — the new device needs this
    to run ECDH against its temp private key and decrypt the encrypted_private_key blob.
    """
    result = await db.execute(
        select(DeviceLinkRequest).where(DeviceLinkRequest.id == request_id)
    )
    link_request = result.scalars().first()

    if not link_request:
        raise HTTPException(status_code=404, detail="Request not found")
    if link_request.requesting_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")

    approving_device_pubkey = None
    if link_request.approved_by_device_id:
        result = await db.execute(
            select(Device).where(Device.id == link_request.approved_by_device_id)
        )
        approving_device = result.scalars().first()
        if approving_device:
            approving_device_pubkey = approving_device.public_key

    new_device_public_key = None
    result = await db.execute(
        select(Device).where(Device.id == link_request.new_device_id)
    )
    new_device = result.scalars().first()
    if new_device:
        new_device_public_key = new_device.public_key

    return StatusResponse(
        status=link_request.status,
        encrypted_private_key=link_request.encrypted_private_key,
        approved_by_device_public_key=approving_device_pubkey,
        permanent_public_key=new_device_public_key,
    )


# ── POST /device-linking/approve/{request_id} ────────────────────────────────

@router.post("/approve/{request_id}")
async def approve_link_request(
    request_id: UUID,
    body: ApproveBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Most security-critical endpoint in the entire E2EE system.

    Every check below is mandatory. The order is strict. Do not reorder or skip.

    WHY WEBAUTHN VERIFICATION CANNOT BE SKIPPED OR SOFTENED:
    If the server trusts a client claim that \"WebAuthn passed\" without verifying the
    cryptographic signature, then any attacker with a stolen JWT can call this endpoint,
    skip the biometric entirely, and link their own device. The entire E2EE guarantee
    collapses — the private key transfer becomes a JWT-gated operation, not a
    biometric-gated one. Physical possession of a trusted device becomes meaningless.

    THE ATTACK THIS STOPS (see comprehension check):
    Attacker steals JWT → calls POST /device-linking/request from their own machine →
    legitimate user's old device sees the request (UI prompt) → but the ATTACKER tries
    to call POST /device-linking/approve with their JWT. Step 2 (approving device must
    be trusted + owned by current_user) blocks this — the attacker's device is not
    trusted and not owned by the victim. Even if they had a trusted device, step 4
    (WebAuthn assertion) requires physical biometric on that specific device.
    """

    # ── Step 1: Load and validate the link request ────────────────────────
    result = await db.execute(
        select(DeviceLinkRequest).where(DeviceLinkRequest.id == request_id)
    )
    link_request = result.scalars().first()

    if not link_request:
        raise HTTPException(status_code=404, detail="Link request not found")
    if link_request.requesting_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    if link_request.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request is already {link_request.status}")
    if link_request.expires_at < _now_utc():
        raise HTTPException(
            status_code=410,
            detail="REQUEST_EXPIRED: This link request has expired. The new device must start over.",
        )

    # ── Step 2: Validate approving device trust ───────────────────────────
    # The device making this approval request must be trusted and owned by this user.
    # This is what stops the attacker from approving on behalf of the victim.
    result = await db.execute(
        select(Device).where(
            Device.id == body.approving_device_id,
            Device.user_id == current_user.id,
            Device.is_trusted == True,
            Device.deleted_at == None,
        )
    )
    approving_device = result.scalars().first()

    if not approving_device:
        raise HTTPException(
            status_code=403,
            detail="Approving device is not a trusted active device on your account",
        )

    if approving_device.public_key != body.permanent_public_key:
        raise HTTPException(
            status_code=400,
            detail="Permanent public key does not match the approving trusted device",
        )

    result = await db.execute(
        select(KeyBackup).where(
            KeyBackup.user_id == current_user.id,
            KeyBackup.backup_method == "prf",
            KeyBackup.prf_credential_id != None,
            KeyBackup.prf_credential_public_key != None,
            KeyBackup.prf_sign_count != None,
        )
    )
    key_backup = result.scalars().first()

    if not key_backup:
        raise HTTPException(
            status_code=409,
            detail="Device approval requires a verified WebAuthn PRF backup credential",
        )

    # ── Step 3: Fetch the stored challenge from Redis ─────────────────────
    challenge_key = _redis_challenge_key(request_id)
    stored_challenge = await r.get(challenge_key)

    if not stored_challenge:
        # Redis key is gone — could be TTL expiry or never fetched
        # IMPORTANT: this is CHALLENGE_EXPIRED, not REQUEST_EXPIRED
        # The request may still be valid — client should GET /challenge and retry
        raise HTTPException(
            status_code=400,
            detail="CHALLENGE_EXPIRED: Fetch a new challenge via GET /device-linking/challenge and retry",
        )

    # ── Step 4: Verify WebAuthn assertion via py_webauthn ────────────────
    # This is the cryptographic proof of physical presence.
    # If this fails, do not proceed — return 403 immediately.
    try:
        challenge_value = stored_challenge.decode() if isinstance(stored_challenge, bytes) else stored_challenge
        verified_authentication = webauthn.verify_authentication_response(
            credential=body.webauthn_assertion,
            expected_challenge=_base64url_to_bytes(challenge_value),
            expected_rp_id=WEBAUTHN_RP_ID,
            expected_origin=WEBAUTHN_ORIGIN,
            credential_public_key=_base64url_to_bytes(key_backup.prf_credential_public_key),
            credential_current_sign_count=key_backup.prf_sign_count,
            require_user_verification=True,
        )
    except Exception as e:
        # Verification failed ? do NOT proceed ? return 403
        raise HTTPException(
            status_code=403,
            detail=f"WebAuthn verification failed: {str(e)}",
        )

    # ── Step 5: Delete the challenge from Redis (single-use enforcement) ──
    # This MUST happen immediately after successful verification.
    # A challenge that stays in Redis can be replayed in a race condition.
    await r.delete(challenge_key)

    # ── Step 6: Commit all state changes in one transaction ───────────────
    link_request.encrypted_private_key = body.encrypted_private_key
    link_request.status = "approved"
    link_request.approved_by_device_id = approving_device.id

    # Elevate the new device to trusted and assign its permanent public key
    result = await db.execute(
        select(Device).where(Device.id == link_request.new_device_id)
    )
    new_device = result.scalars().first()
    if not new_device or new_device.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Linked device not found")

    new_device.is_trusted = True
    new_device.public_key = body.permanent_public_key
    key_backup.prf_sign_count = verified_authentication.new_sign_count

    # Increment DM Epochs for all conversations involving this user
    # This forces future DMs to use the new epoch (containing this new device's public key)
    await db.execute(
        update(DmEpoch)
        .where(
            or_(
                DmEpoch.user_a_id == current_user.id,
                DmEpoch.user_b_id == current_user.id
            )
        )
        .values(current_epoch=DmEpoch.current_epoch + 1)
    )

    # ── Step 7: Commit ────────────────────────────────────────────────────
    await db.commit()

    # Notify the new device via WebSocket if it's online (real-time path)
    user_id_str = str(current_user.id)
    for server_id, connections in manager.active_connections.items():
        if user_id_str in connections:
            try:
                await connections[user_id_str].send_json({
                    "type": "device_link_approved",
                    "request_id": str(request_id),
                })
            except Exception:
                pass

    return {"status": "approved"}


# ── POST /device-linking/reject/{request_id} ────────────────────────────────

@router.post("/reject/{request_id}")
async def reject_link_request(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Rejects a pending link request.

    IMPORTANT SECURITY SIGNAL — teach this:
    A user seeing an unknown link request means someone initiated a device linking
    ceremony for their account without their knowledge. Their credentials may be
    compromised. The frontend must surface prominently:
    \"If you did not request this, your account may be compromised. Change your password immediately.\"
    """
    result = await db.execute(
        select(DeviceLinkRequest).where(DeviceLinkRequest.id == request_id)
    )
    link_request = result.scalars().first()

    if not link_request:
        raise HTTPException(status_code=404, detail="Request not found")
    if link_request.requesting_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your request")
    if link_request.status != "pending":
        raise HTTPException(status_code=409, detail=f"Request is already {link_request.status}")

    link_request.status = "rejected"
    await db.commit()

    return {"status": "rejected", "security_note": "If you did not initiate this, change your password immediately."}



class ApproveWithPassphraseBody(BaseModel):
    approving_device_id: UUID
    encrypted_private_key: str
    permanent_public_key: str


@router.post("/approve-with-passphrase/{request_id}")
async def approve_with_passphrase(
    request_id: UUID,
    body: ApproveWithPassphraseBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Approves a pending device link request using the passphrase backup instead of WebAuthn.
    The private key is re-derived client-side from the passphrase and sent encrypted
    for the new device. This endpoint validates the request and commits the result.

    Note: this path has weaker physical-presence proof than the PRF/WebAuthn path
    because it relies on knowledge (passphrase) not possession (biometric). It is
    offered only when the user has no PRF credential registered.
    """
    result = await db.execute(
        select(DeviceLinkRequest).where(
            DeviceLinkRequest.id == request_id,
            DeviceLinkRequest.requesting_user_id == current_user.id,
            DeviceLinkRequest.status == "pending",
        )
    )
    link_request = result.scalars().first()
    if not link_request:
        raise HTTPException(status_code=404, detail="Pending request not found")
    if link_request.expires_at < _now_utc():
        raise HTTPException(status_code=410, detail="REQUEST_EXPIRED: This link request has expired. The new device must start over.")

    approving_result = await db.execute(
        select(Device).where(
            Device.id == body.approving_device_id,
            Device.user_id == current_user.id,
            Device.is_trusted == True,
            Device.deleted_at == None,
        )
    )
    approving_device = approving_result.scalars().first()
    if not approving_device:
        raise HTTPException(status_code=403, detail="Approving device is not a trusted active device on your account")

    if approving_device.public_key != body.permanent_public_key:
        raise HTTPException(status_code=400, detail="Permanent public key does not match the approving trusted device")

    link_request.encrypted_private_key = body.encrypted_private_key
    link_request.status = "approved"
    link_request.approved_by_device_id = approving_device.id

    # Elevate the new device to trusted and assign its permanent public key
    new_device_result = await db.execute(
        select(Device).where(Device.id == link_request.new_device_id)
    )
    new_device = new_device_result.scalars().first()
    if not new_device or new_device.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Linked device not found")

    new_device.is_trusted = True
    new_device.public_key = body.permanent_public_key

    # Increment DM epochs for all conversations involving this user —
    # same as the PRF approval path. Forces future DMs to use the new epoch
    # so the newly linked device receives keys for them.
    await db.execute(
        update(DmEpoch)
        .where(
            or_(
                DmEpoch.user_a_id == current_user.id,
                DmEpoch.user_b_id == current_user.id,
            )
        )
        .values(current_epoch=DmEpoch.current_epoch + 1)
    )

    await db.commit()

    # Notify the new device if it's online
    user_id_str = str(current_user.id)
    for server_id, connections in manager.active_connections.items():
        if user_id_str in connections:
            try:
                await connections[user_id_str].send_json({
                    "type": "device_link_approved",
                    "request_id": str(request_id),
                })
            except Exception:
                pass

    return {"status": "approved"}