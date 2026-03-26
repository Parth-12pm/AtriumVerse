# Phase 8 — Channel Encryption (Backend + Frontend)
# Paste this alongside the master prompt.

## Goal
Build app/api/channel_keys.py and all frontend channel encryption logic.
Wire encrypted messages through the existing ws.py broadcast path.
Teach epoch lifecycle, key reconstruction chain, and epoch scope fully before any code.

## Teach Epoch Lifecycle Before Any Code

Draw this out for the developer:

Epoch 1: Members [Alice-laptop, Bob-phone, Carol-desktop]
  → channel_device_keys has 3 rows at epoch=1
  → All messages encrypted with epoch_key_1 derived from epoch-1 channel_key

Carol is removed:
  → Epoch rotates to 2, new channel_key generated
  → channel_device_keys gets 2 new rows at epoch=2 (Alice, Bob only)
  → Carol has no epoch=2 row → cannot get the key → cannot decrypt future messages
  → Carol's epoch=1 row stays permanently → she can still decrypt epoch-1 messages
  → epoch=1 channel_device_keys rows are never deleted

Bob links a new device (Bob-tablet):
  → Ceremony completes, Bob-tablet is trusted
  → Bob's OLD device (Bob-phone) distributes channel keys directly to Bob-tablet
    as part of the linking ceremony — peer-to-peer, owner NOT involved
  → Bob-phone encrypts the current epoch-2 channel_key for Bob-tablet and submits it
  → Bob-tablet can now decrypt epoch-2 messages
  → Whether Bob-tablet also gets epoch-1 keys is a design choice — document both options
    Option A: yes, Bob-phone also distributes epoch-1 key (tablet can read all history)
    Option B: no (tablet can only read from when it was linked)
    Teach that Option A is richer UX, Option B is stricter. Implement Option A.

## Teach Epoch Key Scope — One Epoch Key Covers Many Messages

This is a common point of confusion — clarify explicitly:

One epoch key covers ALL messages in that epoch, regardless of how many there are.
The random IV per encryption is what makes reusing the epoch key safe — each encryption
is unique because each IV is unique. The epoch key itself does not change per message.

Per-message key derivation (using message ID as HKDF salt) is a DM-only pattern because
in DMs, the two parties can independently compute per-message keys from a shared secret.
In channels, every member device would need a new key distributed to it for every message —
that is impractical at any scale. Random IV + one epoch key is the correct channel approach.

## Teach the Full Epoch Key Reconstruction Chain

Teach this as a diagram before writing any code. This is the chain that allows a device
to decrypt any message at any time, even after sessions end:

```
private_key  (IndexedDB — permanent anchor, never leaves browser)
     ↓ ECDH with owner_device_public_key (stored on server, never deleted)
shared_secret (computed in memory, never stored)
     ↓ HKDF(info="channel-key", salt=channel_id)
wrap_key (computed in memory)
     ↓ AES-GCM decrypt encrypted_channel_key (from channel_device_keys row — permanent)
channel_key (in memory, re-derived each session)
     ↓ HKDF(info="epoch:{N}", salt=channel_id)  ← N comes from message.epoch column
epoch_key_N (in memory, re-derived on demand per message)
     ↓ AES-GCM decrypt ciphertext (from messages row)
plaintext
```

Teach every node in this chain explicitly:
- private_key: permanent, in IndexedDB — the single anchor everything derives from
- owner_device_public_key: permanent on server, never deleted — owner's device row stays
  even if the owner leaves, so historical messages remain decryptable
- channel_device_keys row: permanent, never deleted — contains the encrypted channel_key
- message.epoch: stored on every message row — tells the browser which epoch key to derive
- The epoch key is NOT stored anywhere — it is re-derived on demand from channel_key + epoch number

This means a device that was offline for a year can come back, load its private key from
IndexedDB, and decrypt every message it was entitled to. No stored session state needed.

## Backend: app/api/channel_keys.py

### POST /channel-keys/{channel_id}/enable
Concept: Initial ceremony. Owner's browser ran ECDH for every trusted member device.
This endpoint stores all blobs atomically.
Auth: server owner only (channel → server join, check server.owner_id == current_user.id)
Body: { encrypted_keys: [{ device_id: UUID, encrypted_channel_key: str }] }
Creates: ChannelEncryption row (is_enabled=True, current_epoch=1)
Creates: ChannelDeviceKey rows at epoch=1
Atomic: one transaction — partial writes are worse than total failure
Returns: { channel_id, epoch: 1 }

### GET /channel-keys/{channel_id}/my-key
Concept: Member fetches their encrypted channel key for the current epoch.
device_id query param (frontend sends stored device_id).
Verify: requesting user owns that device_id
Verify: user is ACCEPTED member of this channel's server
Returns: { encrypted_channel_key, epoch, owner_device_id, owner_device_public_key }

Teach why owner_device_public_key is returned: needed for the ECDH step that recovers
the shared secret used to wrap the channel_key. This must be the public key of the specific
device that performed the encryption — for epoch 1 this is the owner's device at ceremony
time, for epoch 2 it may be a different device if the owner re-keyed from a different browser.
Store owner_device_id on each ChannelDeviceKey row so the backend can look up the right key.

### POST /channel-keys/{channel_id}/rotate
Concept: Called by owner's frontend after approve_member or reject_member succeeds.
Teach the race window honestly: messages sent between member removal and rotation are
encrypted under the old epoch and are readable by the removed member. Rotation must be prompt.
Also called when the owner themselves links a new device.
Auth: server owner only
Body: { encrypted_keys: [{ device_id, encrypted_channel_key }] }
Increments ChannelEncryption.current_epoch
Writes new ChannelDeviceKey rows at new epoch
Does NOT delete old epoch rows — ever

### POST /channel-keys/{channel_id}/distribute-to-device
Concept: For Situation B (existing member's new device) — called by the MEMBER's trusted
device, not the owner. After the linking ceremony, Bob's old phone distributes channel keys
to Bob's new tablet directly. This endpoint accepts the submission.

Auth: any trusted device belonging to an ACCEPTED member of this channel's server
Validation: submitting device must belong to the same user as the target device
Body: { target_device_id: UUID, epoch: int, encrypted_channel_key: str }
Creates: one ChannelDeviceKey row at the specified epoch
Teach the validation: the submitting device's user_id must equal the target device's user_id.
This prevents a member from distributing keys to a device that belongs to a different user.

### GET /channel-keys/{channel_id}/entitled-epochs
Returns all epochs for a channel that the requesting device has a ChannelDeviceKey row for.
Used by a newly linked device to know which epochs it has been distributed keys for.
Returns: [{ epoch, encrypted_channel_key, owner_device_public_key }]

## Frontend: Channel Encryption

### Fetching the Channel Key
When a user opens an encrypted channel:
  GET /channel-keys/{channel_id}/my-key?device_id={device_id}
  Receive: { encrypted_channel_key, epoch, owner_device_public_key }
  Load own private_key from IndexedDB
  deriveSharedSecret(private_key, owner_device_public_key) → shared_secret
  deriveKey(shared_secret, salt=channel_id, info="channel-key") → wrap_key
  decryptMessage(wrap_key, encrypted_channel_key) → channel_key bytes
  Cache channel_key in memory only — never write to IndexedDB
  Teach: channel_key is always recoverable from the server-held blob — no need to persist

### Deriving the Epoch Key (On Demand)
channel_key is in memory. For each message to encrypt or decrypt:
  epoch_key = deriveKey(channel_key_bytes, salt=channel_id, info=`epoch:${epoch}`)
  This is re-derived on demand — never stored anywhere

### Sending an Encrypted Message
  Derive epoch_key for current epoch
  encryptMessage(epoch_key, plaintext) → ciphertext blob
  POST to existing /messages/channels/{channel_id}/messages:
    { ciphertext, epoch: current_epoch, is_encrypted: true, content: "[encrypted]" }
  Then send WS event (existing scope: "channel") with message_data containing
  ciphertext and epoch — ws.py requires zero changes, it spreads message_data as-is

### Post-Linking Channel Key Sync (Peer-to-Peer)
After a new device completes the linking ceremony and becomes trusted, on the OLD device:
  Fetch all channels the user is a member of that have is_encrypted=True
  For each channel, for each epoch in the channel's history:
    Load channel_key from memory (or re-derive via the reconstruction chain)
    Derive epoch_key
    Re-encrypt channel_key for the new device:
      deriveSharedSecret(own_private_key, new_device_public_key) → shared_secret
      deriveKey(shared_secret, salt=channel_id, info="channel-key") → wrap_key
      encryptMessage(wrap_key, channel_key_bytes) → encrypted blob
    POST /channel-keys/{channel_id}/distribute-to-device:
      { target_device_id, epoch, encrypted_channel_key: blob }

Teach: this happens in the old device's browser while it is completing the approval ceremony.
The owner is never pinged. The new device receives channel access as part of the same
interaction where the user approved the link.

### Rendering Messages
For each message:
  If is_encrypted=False → render content directly (old plaintext messages, unchanged)
  If is_encrypted=True →
    Initial state: "[Encrypted]" (while async decryption runs)
    Load channel_key from memory (fetch and derive if not yet cached)
    Derive epoch_key using message.epoch value from the message row
    decryptMessage(epoch_key, ciphertext) → plaintext → render

Error states with distinct messages:
  channel_key not in memory → "Fetching channel key..." (trigger fetch, retry)
  No ChannelDeviceKey row for this epoch → "Message from before your access began"
  Decryption throws → "Message could not be decrypted (integrity check failed)"

## Wire Into main.py
prefix="/channel-keys", tags=["Channel Keys"]

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "Draw the epoch key reconstruction chain from memory — every step, every arrow.
Then explain: a device was offline for six months. It comes back. A channel had epoch
rotations at month 1, month 3, and month 5. The device has ChannelDeviceKey rows for
epochs 1 and 2 only (it was removed before epoch 3). What messages can it decrypt and
which can it not? Walk through the reconstruction chain for a specific epoch-2 message
using the diagram you drew."
