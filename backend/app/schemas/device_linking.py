from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LinkRequestBody(BaseModel):
    new_device_id: UUID
    temp_public_key: str
    device_label: str | None = None


class LinkRequestResponse(BaseModel):
    request_id: UUID
    expires_at: datetime


class PendingRequestResponse(BaseModel):
    request_id: UUID
    new_device_id: UUID
    new_device_label: str | None
    temp_public_key: str
    expires_at: datetime
    webauthn_credential_id: str | None  # needed for allowCredentials in the browser
    has_passphrase_backup: bool = (
        False  # true when user has passphrase backup but no PRF credential
    )


class StatusResponse(BaseModel):
    status: str
    encrypted_private_key: str | None = None
    approved_by_device_public_key: str | None = None
    permanent_public_key: str | None = None


class ApproveBody(BaseModel):
    approving_device_id: UUID
    webauthn_assertion: dict  # raw assertion JSON from navigator.credentials.get()
    encrypted_private_key: str  # base64(IV + AES-GCM ciphertext of user's private key)
    permanent_public_key: str  # the approving trusted device's permanent public key to apply to the new device


class ChallengeResponse(BaseModel):
    challenge: str  # base64url nonce


class ApproveWithPassphraseBody(BaseModel):
    approving_device_id: UUID
    encrypted_private_key: str
    permanent_public_key: str
