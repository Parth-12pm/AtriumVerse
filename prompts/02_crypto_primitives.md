# Phase 2 — Cryptographic Primitives
# Paste this alongside the master prompt. Concept teaching only — minimal code snippets for illustration.

## Goal
The developer must understand all four primitives before any implementation begins.
Do not move to Phase 3 until the comprehension check is passed.

## Teach These In Order

### 1. X25519 (ECDH Key Exchange)
- What a keypair is: public key is shareable, private key never leaves the device
- What ECDH does: ECDH(alice_private, bob_public) == ECDH(bob_private, alice_public)
  Both sides derive the identical shared secret without transmitting it
- Where it appears in this system (three places):
  a. Device linking — old device encrypts private key for new device's temp keypair
  b. Channel key distribution — owner encrypts channel_key for each member device
  c. DM encryption — sender and receiver independently derive the same shared secret
- Why X25519 over RSA: smaller keys, faster operations, safer defaults, no padding oracle attacks

### 2. HKDF-SHA256 (Key Derivation)
- Why you never use a raw shared secret directly as an AES key
- What HKDF does: takes raw key material and derives a cryptographically strong, purpose-specific key
- The info parameter is critical: info="epoch:1" and info="epoch:2" produce completely different
  keys from the same input, even though only one byte changed
- Where it appears: deriving epoch keys from channel_key, deriving per-message keys from DM shared secrets
- Illustration only (not final code):
  epoch_key = HKDF(ikm=channel_key, salt=channel_id, info="epoch:1", length=32)
  message_key = HKDF(ikm=shared_secret, salt=message_id, info="dm", length=32)

### 3. AES-256-GCM (Authenticated Encryption)
- Confidentiality: ciphertext reveals nothing about plaintext without the key
- Integrity (the GCM part): produces an authentication tag — any tampering causes decryption to fail loudly
- The nonce (IV): must be unique per encryption with the same key
  NONCE REUSE IS CATASTROPHIC — reusing IV+key breaks confidentiality permanently
  Solution: generate a random 12-byte IV every single encryption, prepend it to ciphertext
- Why prepend IV to ciphertext: keeps the blob self-contained, IV is not secret just must be unique
- Storage format: base64(IV_12_bytes + ciphertext + auth_tag)

### 4. WebAuthn (Proof of Physical Presence)
- What it is NOT: it does not encrypt anything, does not store private keys, does not replace JWT
- What it IS: proof that the person approving a device link is physically present on the trusted
  device, using hardware-bound credentials (Windows Hello, Face ID, Touch ID, Passkeys)
- The flow: server issues a random challenge → browser calls navigator.credentials.get() →
  OS biometric fires → browser returns a signature over the challenge →
  server verifies signature using stored WebAuthn credential via py_webauthn
- Why the challenge must come from the server and be single-use:
  Without this, an attacker could capture a previous assertion and replay it
  Store challenges in Redis with a short TTL (60 seconds) — consumed on use
- The attack it prevents: stolen JWT cannot be used to link a fake device because the
  biometric check requires physical possession of the trusted device

## Comprehension Check (Do Not Proceed Until Answered)
Ask the developer TWO questions:
1. "If you encrypted 1000 different messages using the same AES-GCM key AND the same IV,
   what specifically breaks and why? What does an attacker gain?"
2. "WebAuthn proves physical presence. But the private key is in IndexedDB, not in the
   WebAuthn secure enclave. Why is the ceremony still secure? What exactly is WebAuthn
   protecting in this flow?"
