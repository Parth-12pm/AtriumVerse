# Phase 7 — Frontend: Device Registration & Linking Ceremony
# Paste this alongside the master prompt.

## Goal
Build hooks/useDevice.ts and the linking ceremony UI.
Cover both Path A (real-time) and Path B (async).
WebAuthn browser integration on the approving device.

## hooks/useDevice.ts — Teach the Logic Tree Before Writing

On every app mount (useEffect, 'use client' component), this hook runs:

Step 1 — Check localStorage for device_id
  If found → private key should be in IndexedDB → device is registered
  If not found → this browser has never been registered

Step 2 — If not registered:
  Call GET /devices/my-devices
  If NO trusted devices → this is the first device:
    generateKeypair() → exportPublicKey() → POST /devices/register
    Receive device_id and is_trusted: true (DB partial index enforces only one root device)
    storePrivateKey(device_id, privateKey) → localStorage.setItem("device_id", device_id)
  If trusted devices exist → this browser needs the linking ceremony → Step 3

Step 3 — Linking ceremony (new device):
  generateKeypair() for permanent keys
  generateKeypair() for temp keys (ceremony tunnel only)
  POST /devices/register with permanent public key → device_id (is_trusted: false)
  POST /device-linking/request with { new_device_id, temp_public_key, device_label }
  Store temp keypair in IndexedDB under "temp:{request_id}"
  localStorage.setItem("device_id", device_id)
  localStorage.setItem("pending_link_request_id", request_id)
  Set UI state: "waiting_for_approval" — show countdown timer from expires_at

Step 4 — Poll GET /device-linking/request/{request_id}/status every 5 seconds
  On "approved":
    const { encrypted_private_key, approved_by_device_public_key } = response
    Load temp_private_key from IndexedDB under "temp:{request_id}"
    deriveSharedSecret(temp_private_key, approved_by_device_public_key)
    deriveKey(shared_secret, salt=request_id, info="device-link")
    decryptMessage(derived_key, encrypted_private_key) → private key bytes
    importPrivateKeyFromBytes(bytes) → CryptoKey (extractable: false)
    storePrivateKey(device_id, recovered_private_key)
    deleteTempKeypair(request_id) ← discard ceremony tunnel keys
    localStorage.removeItem("pending_link_request_id")
    Set UI state: "linked"
    Trigger channel key sync (see Phase 8)
  On "rejected": show error, clear pending state, allow retry
  On "expired": show expiry message, clear pending state, allow retry from Step 3

Step 5 — On every mount (all devices):
  Call GET /device-linking/pending
  If results exist → this device has a pending approval request to handle
  Show approval UI immediately (inline, not just on a settings page)

## WebAuthn Approval UI — Teach the Browser API Before Writing

This runs on the OLD trusted device when it sees a link request.

### Why allowCredentials Is Required — Teach This First
navigator.credentials.get() without allowCredentials shows a generic OS passkey picker
listing all credentials the browser knows about. The user would have to guess which one
is their AtriumVerse credential. More importantly, the server-side verification would be
ambiguous — you would not know which stored credential to verify against.

The fix: pass the approving device's webauthn_credential_id (returned by GET /device-linking/pending)
in allowCredentials. This tells the browser exactly which credential to use, produces a
targeted biometric prompt, and makes server-side verification unambiguous.

### Approval Flow
1. User sees: "'{label}' wants to link. Is this you? Approve?"
   Show device label, creation timestamp, a "I did not request this" link
2. User clicks Approve
3. Fetch challenge: GET /device-linking/challenge?request_id={id} → { challenge }
   Decode challenge from base64url to ArrayBuffer
4. Call navigator.credentials.get():
   ```
   navigator.credentials.get({
     publicKey: {
       challenge: challengeBuffer,
       rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID,
       allowCredentials: [{
         id: base64urlDecode(webauthn_credential_id),
         type: "public-key"
       }],
       userVerification: "required"   ← forces biometric, not just device presence
     }
   })
   ```
   Teach userVerification: "required" — without this, some authenticators allow
   presence-only (tap without biometric). "required" enforces the actual identity check.
5. Biometric fires → user authenticates → browser returns PublicKeyCredential assertion
6. Retrieve own private key from IndexedDB
7. Import new device's temp_public_key from the request
8. deriveSharedSecret(own_private_key, temp_public_key) → shared_secret
9. deriveKey(shared_secret, salt=request_id, info="device-link") → wrap_key
10. exportKeyAsBytes(own_private_key) → raw bytes
11. encryptMessage(wrap_key, bytesToBase64(private_key_bytes)) → encrypted blob
12. POST /device-linking/approve/{request_id}:
    { webauthn_assertion: serializeAssertion(assertion), encrypted_private_key: blob }
13. Show: "Device linked successfully"

### Serializing the WebAuthn Assertion for the API
navigator.credentials.get() returns a PublicKeyCredential. The backend needs it as JSON.
Teach the developer to serialize it:
```typescript
function serializeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null
    },
    type: credential.type
  }
}
```

## WS Event Handler for Real-Time Path
In the existing WebSocket message handler, add a case for type: "device_link_request":
  Store { request_id, new_device_label, temp_public_key, webauthn_credential_id } in state
  Show the approval UI immediately without requiring navigation
  Teach: webauthn_credential_id is included in the WS event so the approval UI has it
  immediately without a separate fetch

## UI States to Handle
- "registering" — first device, immediate trust
- "waiting_for_approval" — new device waiting, show expires_at countdown
- "approval_pending" — old device, biometric about to fire
- "linked" — ceremony complete, trigger channel key sync
- "expired" — request timed out, show retry button
- "rejected" — old device rejected, explain and allow retry

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "Why is allowCredentials required in the navigator.credentials.get() call? Describe
what happens on screen and in the server-side verification if you omit it. Then: a user
clears their browser storage on the new device after the ceremony completed. They open
AtriumVerse. Walk through exactly what useDevice.ts does step by step and what state
the user is in. What do they need to do to recover?"
