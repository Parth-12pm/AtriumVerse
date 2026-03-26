from datetime import datetime
from typing import Any

from pydantic import BaseModel


class KeyBackupCreate(BaseModel):
    encrypted_blob: str
    backup_method: str
    prf_credential_id: str | None = None
    prf_registration_credential: dict[str, Any] | None = None
    prf_registration_challenge: str | None = None
    salt: str | None = None


class KeyBackupResponse(BaseModel):
    encrypted_blob: str
    backup_method: str
    prf_credential_id: str | None
    salt: str | None
    updated_at: datetime


class ChallengeResponse(BaseModel):
    challenge: str
