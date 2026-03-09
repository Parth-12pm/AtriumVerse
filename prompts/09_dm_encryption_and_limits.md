# Phase 9 — DM Encryption + Limitations
# Paste this alongside the master prompt. Final implementation phase.

## Goal
Build multi-device DM encryption. Then teach limitations honestly.
Backend schema additions were already handled in Phase 3 (dm_device_key, dm_epoch).

## Teach the Multi-Device Problem Before Any Code

Single-device DM: Alice one device, Bob one device.
  Alice: ECDH(alice_private, bob_public) → shared_secret
         HKDF(shared_secret, salt=dm_id, info="dm") → message_key
         AES-GCM encrypt → ciphertext
  Bob:   ECDH(bob_private, alice_public) → same shared_secret (ECDH guarantee)
         HKDF(same shared_secret, salt=same dm_id, info="dm") → same message_key
         AES-GCM decrypt → plaintext

Multi-device DM: Bob has three trusted devices.
  Alice must produce one ciphertext per device that should be able to read this message.
  For each of Bob's devices AND each of Alice's own devices:
    ECDH(alice_private, that_device_public) → shared_secret_for_that_device
    HKDF(shared_secret, salt=dm_id, info="dm") → message_key_for_that_device
    AES-GCM encrypt → ciphertext_for_that_device
    Store in dm_device_keys: { dm_id, device_id, encrypted_ciphertext }

Teach: Alice encrypts for her own devices too — she needs to be able to read her sent
messages from her other devices. This is identical to iMessage behavior.

## Why dm_id as HKDF Salt (Not a Client Nonce)

Teach the previous wrong approach first so the fix makes sense:
The naive approach generates a client random nonce before the POST, uses it as HKDF salt,
stores it in a salt_nonce column. Problem: the nonce is generated before the dm_id exists.
If the insert fails and retries, a new nonce would produce different keys — the recipient
cannot decrypt. The nonce and the dm_id are now two identifiers for the same message,
both of which must be stored and kept in sync.

The correct approach — two-step insert:
  Step 1: POST to create DirectMessage row → server returns dm_id
  Step 2: Use dm_id as HKDF salt → encrypt → POST dm_device_keys rows

dm_id is assigned by the server, is globally unique, is permanent, and is the natural
identifier for the message. Using it as the salt means the keys are stable, deterministic,
and tied to exactly one record. No extra column needed. No salt_nonce in the schema.

## DM Epoch — When It Increments and Why

Teach: DM epoch is per conversation (tracked in dm_epoch table), not per message.
It increments when either Alice or Bob links a new device.

Why epoch on direct_messages matters:
  Without it: when Bob's key history changes (he links a new device), the frontend
  has no way to know which key derivation attempt to make when decrypting an old message.
  It cannot distinguish "wrong key" (tried wrong epoch) from "corrupted message" (actual
  integrity failure from AES-GCM auth tag). These should produce different error messages.

  With it: message.epoch tells the browser exactly which key derivation iteration to use.
  Epoch 1 shared_secret is ECDH(alice_private_v1, bob_public_v1).
  Epoch 2 shared_secret is ECDH(alice_private_v1, bob_public_v2) after Bob's new device
  is linked. Each epoch has a different device public key in the derivation.

Store the current DM epoch on dm_epoch.current_epoch. When either party links a new device,
increment it. New messages written after the increment carry the new epoch number.

## Backend Changes: app/api/direct_messages.py

### POST /DM/messages — Two-Step Insert

Step 1: Create the DirectMessage row first.
  Insert with content="[encrypted]", is_encrypted=True, epoch=current_dm_epoch
  Get back dm_id

Step 2: For each device ciphertext:
  Validate each device_id belongs to sender or receiver
  Insert dm_device_keys rows: { dm_id, device_id, encrypted_ciphertext }
  
Both steps in one transaction — if dm_device_keys insertion fails, roll back the DirectMessage.

New body fields:
  receiver_id: UUID (existing)
  device_ciphertexts: [{ device_id: UUID, encrypted_ciphertext: str }]
  is_encrypted: bool (default false for backward compatibility)
  content: str (still accepted for plaintext DMs)

Remove salt_nonce entirely — it does not exist in this schema.

### GET /DM/messages/{user_id} — Return Per-Device Ciphertext

For each message where is_encrypted=True, join dm_device_keys on:
  dm_id = message.id AND device_id = requesting_device_id

Return alongside the message:
  encrypted_ciphertext: str | null
  device_key_status: "available" | "device_removed" | "predates_device"

Derive device_key_status:
  Row exists, encrypted_ciphertext not null → "available"
  Row exists, device_id IS NULL, deleted_device_id IS NOT NULL → "device_removed"
  No row at all → "predates_device"

Teach: these three states produce different UI messages. Without the SET NULL + deleted_device_id
pattern from Phase 3, "device_removed" and "predates_device" are indistinguishable.

### GET /DM/conversations — Plaintext Preview Problem

The existing conversations list shows last_message as content preview. For encrypted
messages content is "[encrypted]". Two options:

Option A: Return "[Encrypted message]" as the preview — simple, no decryption server-side
Option B: Return the ciphertext for the latest message alongside device_id so the frontend
can decrypt and show a real preview

Implement Option A for now. Note Option B as a future enhancement. Teach why Option B
requires the frontend to decrypt and re-render the conversation list after initial load —
it is async and the UX must handle the placeholder state.

## Frontend: DM Encryption

### Sending (Two-Step)
In the DM composer:

Step 1: POST to /DM/messages with just { receiver_id, content: "[encrypted]", is_encrypted: true }
  to create the row and get dm_id back.

Step 2: Fetch all trusted receiver devices: GET /devices/user/{receiver_id}
         Fetch all trusted own devices: GET /devices/my-devices (trusted only)

For each device in the combined list:
  Load own private_key from IndexedDB
  importPublicKey(device.public_key)
  deriveSharedSecret(own_private, device_public_key)
  deriveKey(shared_secret, salt=dm_id, info="dm") → message_key
  encryptMessage(message_key, plaintext) → encrypted_ciphertext

Step 3: POST all dm_device_keys in a batch request or include device_ciphertexts in
  a separate PATCH /DM/messages/{dm_id}/device-keys endpoint.

Teach: if Step 3 fails, the message row exists but has no ciphertexts. Add a retry
mechanism. The frontend should track "pending ciphertext upload" state.

### Receiving
For encrypted messages in the conversation:
  If encrypted_ciphertext is null and device_key_status is "predates_device":
    Show: "This message was sent before this device was linked"
  If encrypted_ciphertext is null and device_key_status is "device_removed":
    Show: "This message was encrypted for a device that has been removed"
  If encrypted_ciphertext is available:
    Load own private_key from IndexedDB
    Fetch sender's device public key for the epoch this message was sent under
    deriveSharedSecret(own_private, sender_device_public)
    deriveKey(shared_secret, salt=message.id (dm_id), info="dm")
    decryptMessage(message_key, encrypted_ciphertext) → plaintext

Teach: "sender's device public key for the epoch" — the device public key used during
encryption must match the epoch. If Bob encrypted a message at epoch 1 using his phone's
key, Alice must use Bob's phone's public key for decryption, not his tablet's key.
Store which device_id encrypted the message in dm_device_keys (the sender's device row).

## Limitations — Teach These Honestly

**Metadata:** Server knows who DMs whom, when, how often, from which IPs.
Channel membership is visible. Message count and timing are visible. E2EE protects content only.

**Compromised client:** If IndexedDB is readable by an attacker, they have the private key.
E2EE protects against server compromise, not device compromise.

**Key impersonation gap:** No mechanism verifies that a registered public key truly belongs
to the claimed user. A malicious server admin could register a fake device under a user's
account. Production systems use key transparency logs or safety numbers. Note as a future item.

**New device DM gap:** A new device cannot decrypt DMs encrypted before it was trusted,
unless the sender happens to be online and re-encrypts them. This matches iMessage behavior.
UI must communicate this clearly rather than showing broken decrypt states.

**Lost root trust:** If all trusted devices are lost, encrypted messages are gone permanently.
Recovery codes (generated at first registration, stored offline by user) are the standard
mitigation. Note as a future item.

**Offline owner vs channel access:** Channels require owner to rotate epochs when members
change. If the owner is perpetually offline, new members cannot get current keys. Existing
members linking new devices are unaffected (peer-to-peer distribution), but new member
onboarding is blocked. UI should surface this.

## Final Comprehension Check
Ask: "Alice has two trusted devices. Bob has one trusted device. Alice sends Bob a DM.
How many rows are written to dm_device_keys? What is the HKDF salt for each encryption?
Two weeks later Bob links a second device. Can that new device decrypt Alice's original DM?
What would need to happen for it to be able to, and who must be online?
Finally, explain why using dm_id as the HKDF salt is better than a client-generated nonce —
what specific failure mode does the nonce approach introduce?"
