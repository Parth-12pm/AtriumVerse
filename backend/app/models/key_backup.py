from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class KeyBackup(Base):
    """
    Stores the user's encrypted private key backup.

    The server does not know what is inside encrypted_blob. It can only be
    decrypted by the user using either:
    1. A WebAuthn PRF output (from their Face ID / passkey)
    2. A PBKDF2 derived key (from a passphrase)
    """

    __tablename__ = "key_backups"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # base64url AES-GCM ciphertext
    encrypted_blob = Column(String, nullable=False)

    # "prf" or "passphrase" OR "recovery_code" (though recovery code is same as passphrase technically)
    backup_method = Column(String, nullable=False)

    # ---- Metadata for the specific method used ----

    # Which credential produced the PRF so the browser knows which passkey to invoke via allowCredentials
    prf_credential_id = Column(String, nullable=True)

    # COSE public key bytes for server-side py_webauthn verification, base64url encoded.
    prf_credential_public_key = Column(String, nullable=True)

    # Stored authenticator sign count for replay/cloning detection.
    prf_sign_count = Column(Integer, nullable=True)

    # Salt used for PBKDF2 derivation (only if backup_method="passphrase")
    salt = Column(String, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
