from pydantic import BaseModel


class EncryptedKeySubmission(BaseModel):
    device_id: str
    encrypted_channel_key: str


class EnableEncryptionRequest(BaseModel):
    submitting_device_id: str
    encrypted_keys: list[EncryptedKeySubmission]


class DistributeKeyRequest(BaseModel):
    target_device_id: str
    epoch: int
    encrypted_channel_key: str
