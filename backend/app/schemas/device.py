import uuid
from datetime import datetime

from pydantic import BaseModel


class RecoveryDeviceRequest(BaseModel):
    public_key: str
    device_label: str


class DeviceRegisterRequest(BaseModel):
    public_key: str  # base64-encoded X25519 public key from the browser
    device_label: str | None = None


class DeviceRegisterResponse(BaseModel):
    device_id: uuid.UUID
    is_trusted: bool


class MyDeviceResponse(BaseModel):
    device_id: uuid.UUID
    device_label: str | None
    is_trusted: bool
    created_at: datetime | None


class PublicDeviceResponse(BaseModel):
    device_id: uuid.UUID
    public_key: str
