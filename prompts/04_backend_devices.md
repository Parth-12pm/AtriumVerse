# Phase 4 — Backend: Device Registration & Listing
# Paste this alongside the master prompt.

## Goal
Build app/api/devices.py and wire it into main.py.
These are the simpler device endpoints — no WebAuthn yet, that is Phase 5.

## Endpoints to Build (Teach Each Before Writing)

### POST /devices/register
Concept: The new device sends its permanent X25519 public key. Device is created with
is_trusted=False by default. It cannot receive channel keys in this state. Returns device_id.
Why untrusted by default: registering a public key proves nothing about who controls the
corresponding private key. Trust is established only after the ceremony in Phase 5.

FIRST-DEVICE TOCTOU RACE — teach this carefully before writing the handler:
The naive check "if no trusted devices exist for this user, set is_trusted=True" has a race
condition. Two tabs or two clients could simultaneously pass the "no trusted devices" check
and both insert as trusted, creating two root-of-trust devices with no ceremony between them.

Fix — two approaches, teach both, implement the safer one:

Option A (partial unique index): Add a partial unique index to the devices table:
  CREATE UNIQUE INDEX uq_one_trusted_device_per_user
  ON devices (user_id) WHERE is_trusted = TRUE;
This makes the database itself enforce that only one trusted device per user can exist.
The second concurrent insert will get a unique constraint violation. Catch it and return
a 409: "Another device is already being registered as root of trust — use the linking ceremony."

Option B (serializable transaction): Wrap the check-and-insert in a SERIALIZABLE transaction.
SQLAlchemy async: use async with session.begin() and set isolation_level="SERIALIZABLE".
More portable but higher DB overhead.

Implement Option A — the partial index. It is enforced at the DB layer regardless of
application logic and survives multiple worker processes.

The partial index must be added in the Alembic migration from Phase 3. Go back and add it
as an explicit op.create_index() call in the upgrade() function.

Auth: JWT (existing get_current_user dep)
Body: { public_key: str, device_label: str }
Logic:
  Check if user has any existing trusted device (SELECT ... WHERE user_id = X AND is_trusted = TRUE)
  If none: insert with is_trusted=True (protected by partial unique index)
  If exists: insert with is_trusted=False, return device_id for ceremony
Returns: { device_id: UUID, is_trusted: bool }

### GET /devices/my-devices
Concept: Returns the current user's own devices with trust status. Used by the frontend on
mount to detect whether the user is a new registrant (no devices) or needs a ceremony.

Auth: JWT
Returns: [{ device_id, device_label, is_trusted, created_at }]

### GET /devices/user/{user_id}
Concept: Returns trusted device public keys for a target user. Used when encrypting DMs
(sender fetches recipient's devices) and during channel key distribution. Only trusted
devices are returned — distributing keys to an untrusted device grants access before the
user has verified they own that device.

Auth: JWT (public keys are not secret by design — any authenticated user can fetch)
Returns: [{ device_id, public_key }] — is_trusted=True only

### DELETE /devices/{device_id}
Concept: Removes a device. Only the owning user can delete their own devices.
After deletion, teach the developer two important follow-up actions the frontend must prompt:
  1. For channels: owner should rotate epoch for all shared encrypted channels
  2. For DMs: a cleanup job should SET NULL on dm_device_keys.device_id and copy the
     deleted UUID into deleted_device_id (see Phase 3 dm_device_key schema)
This endpoint itself does not perform those actions — it removes the device row and the
application layer handles the cascade effects. Note this as a follow-up the frontend
must surface to the user ("Revoke this device? This will require channel key rotation.").

Auth: JWT, verify device.user_id == current_user.id before deleting

## Wire Into main.py
Add following the existing include_router pattern:
from app.api import devices
app.include_router(devices.router, prefix="/devices", tags=["Devices"])

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "Describe the TOCTOU race in the naive first-device check. Then explain why a partial
unique index fixes it more robustly than an application-level check inside a transaction.
Finally: GET /devices/user/{user_id} returns only trusted devices. A user registers a new
device right now but the ceremony has not completed yet. Someone sends that user a DM.
Can the new device ever decrypt that DM? What would need to happen?"
