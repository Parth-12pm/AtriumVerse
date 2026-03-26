# Phase 5 — Backend: Device Linking & WebAuthn
# Paste this alongside the master prompt.

## Goal
Build app/api/device_linking.py. Most security-critical phase.
Add py_webauthn to requirements.txt.
Teach every security decision before every endpoint.

## Architecture Clarification — Teach Before Any Code

There are two distinct situations where a device needs channel keys. They have different
trust chains and the owner is involved in only one:

**Situation A — New member joining a server:**
Owner must distribute channel keys. The new member is unknown to the channel — they have
never had a copy of the channel_key. The owner's browser fetches their device public keys
and runs the key distribution ceremony. Owner involvement is required and expected here.

**Situation B — Existing member linking a new device:**
Owner is NOT involved. The member already has the channel_key on their old trusted device.
The linking ceremony (this phase) transfers the private key to the new device. As part of
that same handshake — while the old trusted device is online and the private key is in
memory — the old device also directly distributes channel keys to the new device.
This is a peer-to-peer transfer between the member's own devices. The owner never touches it.

This split must be reflected in the API: channel key distribution by a trusted device
(not just the owner) is a legitimate operation for Situation B. Phase 8 handles this.

## The Two Paths (Teach Before Any Code)

### Path A — Real-Time (Old Device Tab is Open)
New device POSTs link request → backend checks socket_manager.active_connections for any
of the user's connected sessions across ALL server_ids → if found, sends WS event
{ type: "device_link_request", request_id, new_device_label, temp_public_key } →
old device UI shows approval prompt → WebAuthn fires → old device POSTs approval with
encrypted_private_key → new device poll returns approved + encrypted blob.

### Path B — Async (Old Device Tab is Closed)
New device POSTs link request → no connected sessions found → request waits in DB →
old device opens app later → on mount fetches GET /device-linking/pending →
sees pending request → same WebAuthn ceremony → new device poll returns approved.

The new device always polls. Paths A and B are identical from its perspective.

## Endpoints to Build

### GET /device-linking/challenge
Concept: Issues a single-use random nonce for WebAuthn to sign. Stored in Redis with TTL.
CRITICAL TTL LOGIC — teach this:
  challenge_ttl = min(60, (request.expires_at - now).total_seconds())
  If request is expiring in 30 seconds, the challenge TTL must also be ≤ 30 seconds.
  A 60-second challenge on a request that expires in 10 seconds is a logic error.

Two distinct errors must be returned separately — teach why:
  CHALLENGE_EXPIRED (Redis key gone, request still valid) → "Fetch a new challenge and retry"
  REQUEST_EXPIRED (request.expires_at passed) → "This request expired — start over"
Collapsing both into a generic 400 forces the user to restart unnecessarily when only
the challenge expired.

Requires request_id as query param so the TTL can be computed against request.expires_at.
Returns: { challenge: base64url_nonce }
Stores in Redis: "webauthn_challenge:{request_id}" → nonce, TTL as above

### POST /device-linking/request
Concept: Called by new device after registering permanent public key.
Check socket_manager.active_connections across ALL server_ids for any session belonging
to this user — a user can be connected to multiple servers simultaneously. Send WS
notification to all of their active sessions.
Always store the request regardless — async path must always work.

Body: { new_device_id: UUID, temp_public_key: str, device_label: str }
Validation:
  new_device_id must belong to current_user (device.user_id == current_user.id)
  No existing pending non-expired request for this new_device_id (prevent duplicates)
expires_at: now + DEVICE_LINK_EXPIRY_MINUTES env var (default 15, up to 1440 for async)
Returns: { request_id, expires_at }

### GET /device-linking/pending
Concept: Called on every app mount. Returns non-expired pending requests for this user.
If results exist, the old device shows the approval UI immediately.
Returns: [{ request_id, new_device_label, temp_public_key, expires_at, webauthn_credential_id }]

IMPORTANT — webauthn_credential_id must be returned here.
Teach why: the browser's navigator.credentials.get() call requires allowCredentials to
specify exactly which credential to use. Without it the browser shows a generic passkey
picker (confusing UX) and server-side verification becomes ambiguous because you cannot
be certain which credential signed the challenge.
Fetch webauthn_credential_id from the approving device's row in the devices table
(the device running this GET request is the potential approver — look up its credential_id).

### GET /device-linking/request/{request_id}/status
Concept: Polled by new device every 5 seconds. Verify request belongs to current_user.
Returns: { status, encrypted_private_key: str | null, approved_by_device_public_key: str | null }

approved_by_device_public_key is returned when status is "approved" — the new device needs
it to run ECDH and decrypt the encrypted_private_key blob.

### POST /device-linking/approve/{request_id}
Concept: Most security-critical endpoint. Walk through every check in strict order:

1. Load request — verify belongs to current_user, status is "pending", not expired
2. Verify approving device belongs to current_user and is_trusted=True
3. Fetch stored WebAuthn challenge from Redis: "webauthn_challenge:{request_id}"
   If key missing → return CHALLENGE_EXPIRED error (not REQUEST_EXPIRED)
4. Verify WebAuthn assertion using py_webauthn verify_authentication_response():
   - credential_id: from approving device's webauthn_credential_id
   - expected_challenge: the nonce fetched from Redis
   - expected_rp_id: from env var WEBAUTHN_RP_ID
   - Include allowCredentials referencing the specific credential
   If verification fails → 403, stop, do not proceed
5. DELETE challenge from Redis (single-use enforcement — do this immediately after verification)
6. In a single transaction:
   - Set request.encrypted_private_key = body.encrypted_private_key
   - Set request.status = "approved"
   - Set request.approved_by_device_id = approving device id
   - Set new device is_trusted = True
7. Commit

Teach step 4 cannot be skipped or softened. If the server trusts a client claim that
WebAuthn passed without verifying the signature, the entire security guarantee disappears —
a stolen JWT is sufficient to link any device.

Body: { webauthn_assertion: dict, encrypted_private_key: str }
Returns: { status: "approved" }

### POST /device-linking/reject/{request_id}
Sets status = "rejected". Simple but important — teach that a user seeing an unknown
link request should be treated as a security signal that their account may be compromised.
The frontend should surface this prominently: "If you did not request this, change your password."

## Wire Into main.py
prefix="/device-linking", tags=["Device Linking"]

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "Walk through the attack: an attacker steals a JWT token and uses it to call
POST /device-linking/request from their own device, wait for GET /device-linking/pending
on the legitimate user's machine to show the request, then try to call
POST /device-linking/approve themselves from the stolen JWT.
At which exact step does the attack fail? What is the one thing that stops it?
Then explain the challenge TTL rule — why must the challenge TTL be min(60s, time_until_request_expiry)
rather than always 60 seconds?"
