# Phase 10 — Key Backup & Recovery via WebAuthn PRF
# Paste this alongside the master prompt.

## Goal
Build the production-grade key backup and recovery system.
After this phase, a user who resets their device, gets it stolen, or buys a new one
can recover everything with a single biometric check — no passwords, no codes to remember.

## Teach The Core Insight Before Any Code

The problem with every passphrase-based backup is that it moves the single point of
failure from "device storage" to "human memory." Forget the passphrase and you're in
the exact same situation as losing the device. You've solved nothing.

The real answer: stop asking the user to remember anything. Anchor to the credential
they already have and already protect — their OS account (Apple ID, Google account,
Microsoft account). These back up WebAuthn passkeys automatically.

WebAuthn has an extension called PRF (Pseudo-Random Function). When a user authenticates
with Face ID, Windows Hello, or a Passkey, the browser can ask the authenticator to output
a deterministic value — the SAME value every single time the same credential is used with
the same context string. This value is called the PRF output.

Key property: it is deterministic but the server never sees it. It exists only in the
browser at the moment of authentication, derived inside the secure enclave.

You use that PRF output as the AES-GCM key to encrypt the private key backup blob.
The server holds an encrypted blob it cannot open. The user authenticates with biometrics
they cannot forget. The OS handles syncing the credential across devices transparently.

Draw this for the developer before any code:

```
User does Face ID / Windows Hello
         ↓
WebAuthn PRF extension fires inside secure enclave
         ↓
PRF_output = deterministic 32 bytes (same every time for this credential + context)
         ↓
AES-GCM decrypt(PRF_output, encrypted_blob from server)
         ↓
private_key_bytes recovered
         ↓
importPrivateKeyFromBytes() → store in IndexedDB
         ↓
Full access restored
```

Then explain what happens across devices:
- iPhone resets → sign into Apple ID → passkey syncs from iCloud Keychain
- New Android → sign into Google account → passkey syncs from Google Password Manager
- New Windows machine → sign into Microsoft account → passkey available
The user does nothing except authenticate. The OS credential ecosystem does the rest.

## The Fallback Problem — Teach Before Writing

PRF extension support is not universal. Safari added it in 2024. Chrome has had it longer.
Older browsers and some hardware authenticators do not support it.

Always check for PRF support before attempting it:
```javascript
// During credential creation, request PRF extension
extensions: { prf: {} }
// Check if authenticator supports it in the response
const prfSupported = result.getClientExtensionResults()?.prf?.enabled === true
```

If PRF is not supported, fall back to a passphrase-based backup (Option 2 from the
previous discussion). Show the user a clear warning:
"Your device doesn't support automatic backup. Set a backup passphrase to protect
your messages if you lose this device."

The passphrase fallback uses the same encrypted blob format — just derived from
PBKDF2(passphrase, salt) instead of PRF output. The server endpoint is identical.

Teach: design the system so the recovery path is the same regardless of whether PRF
or passphrase was used. The blob format is the same. Only the key derivation differs.

## Database Schema — One New Table via Alembic

### app/models/key_backup.py

Concept: One row per user. Stores the encrypted private key blob and the metadata
needed to re-derive the encryption key (salt for PBKDF2 fallback, PRF context for
PRF path). The server is completely blind to what's inside the blob.

```python
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from app.core.database import Base

class KeyBackup(Base):
    __tablename__ = "key_backups"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                     primary_key=True)
    encrypted_blob = Column(String, nullable=False)  # base64url AES-GCM ciphertext
    salt = Column(String, nullable=True)             # only used for PBKDF2 fallback
    backup_method = Column(String, nullable=False)   # "prf" or "passphrase"
    prf_credential_id = Column(String, nullable=True) # which credential produced the PRF
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

Teach: `prf_credential_id` is stored so during recovery the browser knows exactly
which passkey to invoke via `allowCredentials`. Without it the browser shows a generic
picker and the user may select the wrong credential.

Add to alembic/env.py:
```python
from app.models.key_backup import KeyBackup
```

Generate and run: `alembic revision --autogenerate -m "add_key_backups"`

## Backend: app/api/key_backup.py

### POST /account/key-backup
Concept: Receives the encrypted blob and stores it. The PRF output or passphrase
that produced the encryption key is NEVER sent here. The server receives only the
result of encryption, not the key that produced it.

Auth: JWT
Body: {
  encrypted_blob: str,
  backup_method: "prf" | "passphrase",
  prf_credential_id: str | null,   (required if backup_method="prf")
  salt: str | null                 (required if backup_method="passphrase")
}
Logic: upsert — one row per user, update if exists
Returns: { updated_at }

### GET /account/key-backup
Concept: Returns the encrypted blob and metadata so the browser can attempt recovery.
Returns the backup_method so the frontend knows whether to trigger WebAuthn PRF or
prompt for a passphrase.

Auth: JWT
Returns: {
  encrypted_blob: str,
  backup_method: str,
  prf_credential_id: str | null,
  salt: str | null,
  updated_at
} or 404 if no backup exists

### DELETE /account/key-backup
For when a user wants to reset their backup (e.g. after generating a new private key).
Auth: JWT
Teach: deleting the backup without having another recovery path is dangerous.
The frontend must warn: "Are you sure? You will not be able to recover your messages
if you lose this device."

## Wire Into main.py
```python
from app.api import key_backup
app.include_router(key_backup.router, prefix="/account", tags=["Key Backup"])
```

## Frontend: lib/keyBackup.ts

### PRF Path — Teach Each Step Before Writing

#### createBackupViaPRF(deviceId, privateKey)
Called during onboarding after the private key is first generated.

```typescript
// Step 1: Create a WebAuthn credential with PRF extension requested
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: await fetchChallenge(),         // GET /device-linking/challenge reused
    rp: { id: RP_ID, name: "AtriumVerse" },
    user: {
      id: Uint8Array.from(userId),
      name: username,
      displayName: username
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "required"                  // makes it a passkey, enables OS sync
    },
    extensions: {
      prf: {
        eval: {
          first: new TextEncoder().encode("atriumverse-key-backup-v1")
        }
      }
    }
  }
})

// Step 2: Check if PRF is supported
const prfResult = credential.getClientExtensionResults()?.prf
if (!prfResult?.enabled) {
  return { supported: false }  // caller falls back to passphrase
}

// Step 3: Authenticate immediately to get the PRF output
// (create gives enabled=true but not the actual output — need authenticate)
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: await fetchChallenge(),
    rpId: RP_ID,
    allowCredentials: [{ id: credential.rawId, type: "public-key" }],
    userVerification: "required",
    extensions: {
      prf: {
        eval: {
          first: new TextEncoder().encode("atriumverse-key-backup-v1")
        }
      }
    }
  }
})

// Step 4: Extract PRF output — this is the encryption key
const prfOutput = assertion.getClientExtensionResults()?.prf?.results?.first
if (!prfOutput) throw new Error("PRF output not available")

// Step 5: Export private key bytes and encrypt with PRF output
const privateKeyBytes = await exportKeyAsBytes(privateKey)
const prfKey = await crypto.subtle.importKey("raw", prfOutput, 
  { name: "AES-GCM" }, false, ["encrypt"])
const encryptedBlob = await encryptMessage(prfKey, bytesToBase64(privateKeyBytes))

// Step 6: POST to server
await postKeyBackup({
  encrypted_blob: encryptedBlob,
  backup_method: "prf",
  prf_credential_id: bufferToBase64url(credential.rawId)
})

return { supported: true, credentialId: bufferToBase64url(credential.rawId) }
```

Teach the context string "atriumverse-key-backup-v1": this is what makes the PRF output
specific to this purpose. If you ever need to rotate keys in a breaking way, bump to v2.
The same credential with a different context produces a completely different PRF output.

#### recoverViaWebAuthn()
Called on new device or after reset.

```typescript
// Step 1: Fetch the backup blob and credential ID
const backup = await fetch("/account/key-backup").then(r => r.json())
if (!backup || backup.backup_method !== "prf") return null

// Step 2: Authenticate with PRF extension using the stored credential
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: await fetchChallenge(),
    rpId: RP_ID,
    allowCredentials: [{
      id: base64urlToBuffer(backup.prf_credential_id),
      type: "public-key"
    }],
    userVerification: "required",
    extensions: {
      prf: {
        eval: {
          first: new TextEncoder().encode("atriumverse-key-backup-v1")
        }
      }
    }
  }
})

// Step 3: Get PRF output
const prfOutput = assertion.getClientExtensionResults()?.prf?.results?.first
if (!prfOutput) throw new Error("PRF not supported on this device")

// Step 4: Decrypt the blob
const prfKey = await crypto.subtle.importKey("raw", prfOutput,
  { name: "AES-GCM" }, false, ["decrypt"])
const privateKeyBytes = base64ToBytes(await decryptMessage(prfKey, backup.encrypted_blob))

// Step 5: Import and store
const privateKey = await importPrivateKeyFromBytes(privateKeyBytes)
await storePrivateKey(deviceId, privateKey)

return privateKey
```

Teach what happens when the OS needs to sync the passkey:
On a reset iPhone, when `navigator.credentials.get()` fires, iOS sees the credential
is not on this device, checks iCloud Keychain, syncs it automatically, then presents
Face ID. The user sees only the biometric prompt — the sync is invisible.

### PBKDF2 Fallback — Teach When This Path Is Taken

Only reached if PRF extension is not supported on the device.

```typescript
async function createBackupViaPassphrase(privateKey, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(32))
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]
  )
  const backupKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt"]
  )
  const privateKeyBytes = await exportKeyAsBytes(privateKey)
  const encryptedBlob = await encryptMessage(backupKey, bytesToBase64(privateKeyBytes))

  await postKeyBackup({
    encrypted_blob: encryptedBlob,
    backup_method: "passphrase",
    salt: bufferToBase64url(salt)
  })
}
```

Show strength enforcement with zxcvbn:
```typescript
import zxcvbn from "zxcvbn"
const result = zxcvbn(passphrase)
if (result.score < 3) {
  throw new Error(result.feedback.suggestions.join(" "))
}
```

Teach: wrong passphrase during recovery doesn't return an error from the server —
it produces a garbage decryption that throws an AES-GCM authentication tag error in
the browser. The server cannot tell if the passphrase was right. This is intentional
and correct — it means the server cannot be used to brute-force the passphrase.

## Frontend: hooks/useDevice.ts Updates

Add recovery as a new path in the logic tree. Updated mount flow:

```
Step 1: Check localStorage for device_id
  If found → normal flow

Step 2: If not found:
  Call GET /account/key-backup
  If backup exists → recovery path available → show two options:
    A) "Recover with Face ID / Windows Hello" (PRF path)
    B) "Recover with backup passphrase" (fallback)
  If no backup → first device OR previous device never set up backup
    → register as new device + force backup setup in onboarding

Step 3: Recovery selected (PRF):
  Call recoverViaWebAuthn()
  On success → private key in IndexedDB → skip linking ceremony entirely
  Register THIS browser as a new trusted device via POST /devices/register
  Mark is_trusted = True (recovery bypasses ceremony — user proved identity via biometric)
  Trigger channel key sync from server (channel_device_keys rows already exist for old device)

Step 4: Backup setup (new device or first device):
  Try PRF first → if supported, createBackupViaPRF()
  If not supported → prompt passphrase → createBackupViaPassphrase()
  Show clear explanation of what this does and why
  Make it mandatory — no "skip" button
```

Teach why recovery bypasses the linking ceremony: the WebAuthn PRF is stronger proof
of identity than the ceremony itself. The ceremony proves you control an existing trusted
device. PRF recovery proves you control the OS credential that was created during
original registration. They are equivalent trust levels — biometric + correct account.

## Recovery Code — Last Resort Only

Generate alongside backup setup. This is the absolute final fallback.

```typescript
function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  const base32 = encodeBase32(bytes)   // use a base32 library
  // Format as groups: XKQT-7MNP-2WRF-9BVL-4YHC
  return base32.match(/.{1,4}/g).join("-")
}

// Derive private key from recovery code
async function deriveKeyFromRecoveryCode(code, userId) {
  const normalized = code.replace(/-/g, "").toUpperCase()
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(normalized), "PBKDF2", false, ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new TextEncoder().encode(userId), 
      iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  )
}
```

Show the code to the user exactly once in the onboarding flow. Require them to:
1. Copy it or write it down
2. Check a box: "I have saved this code somewhere safe"
3. Enter the last 4 characters to prove they actually looked at it

Server stores nothing about the recovery code — not the code, not a hash, nothing.
Teach: if the user loses this code, it is gone. There is no recovery from lost recovery
code. This is correct and intentional. Communicate it clearly in the UI.

## Onboarding Flow — Full Sequence

This is the complete first-time experience after all phases are implemented:

```
1. User registers (POST /users/register)
2. Browser generates X25519 keypair
3. POST /devices/register → device_id, is_trusted: true (first device)
4. storePrivateKey(device_id, privateKey) → IndexedDB
5. Backup setup (mandatory, cannot skip):
   a. Try PRF → if supported:
      - Create WebAuthn credential with PRF extension
      - Derive PRF output
      - Encrypt private key with PRF output
      - POST /account/key-backup { encrypted_blob, backup_method: "prf", prf_credential_id }
      - Generate recovery code → show once → user confirms
   b. If PRF not supported:
      - Prompt backup passphrase (zxcvbn score ≥ 3 enforced)
      - PBKDF2 derive backup key
      - Encrypt private key
      - POST /account/key-backup { encrypted_blob, backup_method: "passphrase", salt }
      - Generate recovery code → show once → user confirms
6. User is in — public key on server, private key in IndexedDB, backup on server,
   recovery code with user
```

## What the Stolen Device Case Looks Like

Teach this scenario explicitly to close the loop:

User's phone is stolen. They get a new phone.
1. Opens AtriumVerse on new phone
2. Logs in with username and password (JWT)
3. App calls GET /account/key-backup → backup exists
4. Shows: "Recover your encrypted messages — use Face ID"
5. User taps recover — Face ID fires
6. iOS checks: this passkey is in iCloud Keychain → syncs it → biometric passes
7. PRF output derived → private key decrypted → stored in IndexedDB
8. App registers new device, marks trusted
9. Everything decrypts

The stolen phone: attacker cannot pass Face ID → cannot get PRF output → encrypted
blob from server is useless to them → zero messages compromised.

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "Explain in your own words why the WebAuthn PRF approach means the user never
needs to remember anything. What is the actual 'thing' that survives a device reset,
where does it live, and who is responsible for keeping it safe — the user, your server,
or Apple/Google? Then describe the stolen device scenario: the attacker has the physical
device and knows the user's AtriumVerse password. What exactly stops them from
recovering the private key?"
