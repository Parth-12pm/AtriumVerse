import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class DmEpoch(Base):
    """
    Tracks the current encryption epoch for each direct message conversation pair.

    The epoch increments when either party in the conversation links a new device.
    New messages are encrypted using the key derived for the current epoch.
    Old messages carry their epoch value on their row so the frontend knows
    which key derivation iteration to attempt.

    CANONICAL ORDERING — CRITICAL:
    ──────────────────────────────
    Always insert with the smaller UUID as user_a_id and the larger as user_b_id.
    This MUST be enforced at the application layer before every insert or lookup.

    Why: without canonical ordering, the same conversation between alice and bob
    could produce TWO separate rows — one for (alice, bob) and one for (bob, alice).
    This causes epoch drift: alice thinks the conversation is at epoch 3, bob thinks
    it's at epoch 1. Messages become undecryptable.

    Application layer pattern (enforce before every insert/query):
        user_a_id = min(sender_id, receiver_id)
        user_b_id = max(sender_id, receiver_id)

    The UniqueConstraint on (user_a_id, user_b_id) makes duplicate rows a DB error,
    but canonical ordering must still be enforced — otherwise the wrong pair gets
    inserted and the constraint doesn't catch it.
    """

    __tablename__ = "dm_epochs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Always the smaller UUID of the conversation pair
    user_a_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    # Always the larger UUID of the conversation pair
    user_b_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )

    current_epoch = Column(Integer, default=1, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Enforces one epoch row per conversation pair.
        # Application layer must still enforce canonical ordering (see docstring).
        UniqueConstraint("user_a_id", "user_b_id", name="uq_dm_epoch_pair"),
    )
