# Phase 6 — Frontend: Crypto Foundation
# Paste this alongside the master prompt.

## Goal
Build the three client-side utility files that everything else depends on.
No React components yet — just lib/keyStore.ts, lib/crypto.ts, and the SSR rules.
Every function taught individually before being written.

## SSR Rules — Teach These First, Nothing Else Until Understood

window.crypto.subtle does not exist in Node.js. navigator.credentials does not exist in Node.js.
Next.js App Router renders components on the server by default.

Rules that cannot be broken:
- Any file using crypto or WebAuthn must have 'use client' at the top
- All crypto calls must be inside useEffect, event handlers, or async functions called from them
- Never call crypto at module level
- Never call crypto in Server Components
- Never call crypto in getServerSideProps
- Violation does not produce a subtle bug — it crashes the server render

Show the developer the pattern:
WRONG: const key = await crypto.subtle.generateKey(...)  ← module level, crashes SSR
RIGHT: useEffect(() => { const setup = async () => { const key = await crypto.subtle.generateKey(...) }; setup() }, [])

## lib/keyStore.ts — Teach Before Writing

Concept: Why not localStorage? localStorage stores strings. To store a key there you must
export the raw bytes as a string — making the key extractable from JavaScript. Any XSS
vulnerability or browser extension can then steal it.

IndexedDB can store CryptoKey objects directly with extractable: false. The browser holds
the key bytes in a protected context. JavaScript code cannot read the raw bytes even if it
has a reference to the CryptoKey object. This is a meaningful hardware-level boundary on
modern devices with secure enclaves.

What to store and under what keys:
- Permanent private key: keyed by "private:{device_id}"
- Temp keypair during ceremony: keyed by "temp:{request_id}"  
- Channel keys: keyed by "channel:{channel_id}:{epoch}"
- device_id UUID: localStorage is fine — it is not a secret, just an identifier

Functions to build:
- storePrivateKey(deviceId, key: CryptoKey): void
- getPrivateKey(deviceId): Promise<CryptoKey | undefined>
- storeTempKeypair(requestId, keypair: CryptoKeyPair): void
- getTempKeypair(requestId): Promise<CryptoKeyPair | undefined>
- deleteTempKeypair(requestId): void  ← called after ceremony completes
- storeChannelKey(channelId, epoch, key: CryptoKey): void
- getChannelKey(channelId, epoch): Promise<CryptoKey | undefined>

Use the idb npm package for clean promise-based IndexedDB access.
Teach the DB schema: one object store named "keys", string keys, CryptoKey values.

## lib/crypto.ts — Teach Each Function Before Writing

### generateKeypair()
Returns CryptoKeyPair using X25519. extractable: false for private key (it goes to IndexedDB),
true for public key (it gets exported and sent to server).
Teach: false for private means the raw bytes can never be read by JS after generation.

### exportPublicKey(key: CryptoKey): Promise<string>
Exports public key as raw bytes, base64url-encodes for JSON transport.

### importPublicKey(base64: string): Promise<CryptoKey>
Reverse of above. Used when fetching other devices' public keys from the API.

### deriveSharedSecret(myPrivate: CryptoKey, theirPublicBase64: string): Promise<ArrayBuffer>
ECDH producing raw bytes — NOT a CryptoKey yet.
Teach why ArrayBuffer not CryptoKey: this raw material goes into HKDF next, not AES directly.

### deriveKey(rawSecret: ArrayBuffer, salt: string, info: string): Promise<CryptoKey>
HKDF-SHA256 → AES-256-GCM key. The info parameter is what makes keys purpose-specific.
Teach: same rawSecret + "epoch:1" vs "epoch:2" produces completely different keys.

### encryptMessage(key: CryptoKey, plaintext: string): Promise<string>
Generate random 12-byte IV every call — never reuse.
AES-GCM encrypt.
Prepend IV to ciphertext: combined = [iv_12_bytes | ciphertext_n_bytes]
base64url-encode combined → return as string.
Teach the IV prepend: makes blob self-contained, IV is not secret but must be unique.

### decryptMessage(key: CryptoKey, base64Ciphertext: string): Promise<string>
Decode base64url → split first 12 bytes as IV, rest as ciphertext.
AES-GCM decrypt — throws if tampered (auth tag check).
Teach: the throw on tamper is a feature, not a bug — it is the integrity guarantee.

### exportKeyAsBytes(key: CryptoKey): Promise<ArrayBuffer>
Used only during device linking ceremony to export the private key for transfer.
Teach: this is the ONE place private key bytes are exposed — only to be immediately
encrypted with ECDH+AES-GCM for the new device. Never logged, never stored raw.

### importPrivateKeyFromBytes(bytes: ArrayBuffer): Promise<CryptoKey>
Reverse — used by new device after decrypting the transferred bytes.
extractable: false — once imported, bytes cannot be read again.

## Comprehension Check (Do Not Proceed Until Answered)
Ask: "You encrypt two different messages with the same AES-GCM key. For message 1 you
generate a random IV. For message 2 you accidentally reuse the same IV. What can an
attacker who intercepts both ciphertexts now do? And why does prepending the IV to the
ciphertext not cause this problem if you are always generating it randomly?"
