"use client";

/**
 * Phase 6 — WebCrypto Primitives
 *
 * Wrap window.crypto.subtle in promise-based helpers.
 * This runs solely on the client.
 */

// ── ECDH / Keypair Generation ────────────────────────────────────────

/**
 * Generates an X25519 keypair for ECDH.
 * @param extractable If true, the private key can be exported. Permanent keys
 *                    should be false. Temp ceremony keys MUST be true.
 */

import { fetchAPI } from "@/lib/api";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";

export async function generateKeypair(
  extractable: boolean = false,
): Promise<CryptoKeyPair> {
  return window.crypto.subtle.generateKey({ name: "X25519" }, extractable, [
    "deriveKey",
    "deriveBits",
  ]) as Promise<CryptoKeyPair>;
}

/**
 * Exports a public key to raw bytes, then base64url encodes it for JSON transport.
 */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return bufferToBase64url(exported);
}

/**
 * Imports a base64url encoded public key.
 */
export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const buffer = base64urlToBuffer(base64);
  return window.crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "X25519" },
    true, // public keys are always extractable
    [],
  );
}

// ── Key Derivation (ECDH + HKDF) ─────────────────────────────────────

/**
 * Runs ECDH between our private key and their public key to produce a raw shared secret.
 */
export async function deriveSharedSecret(
  myPrivate: CryptoKey,
  theirPublicBase64: string,
): Promise<ArrayBuffer> {
  const theirPublic = await importPublicKey(theirPublicBase64);

  return window.crypto.subtle.deriveBits(
    {
      name: "X25519",
      public: theirPublic,
    },
    myPrivate,
    256, // Need 256 bits (32 bytes) of raw material
  );
}

/**
 * HKDF step. Expands a raw secret into an AES-GCM key bound to a specific info/salt.
 */
export async function deriveKey(
  rawSecret: ArrayBuffer,
  salt: ArrayBuffer | string,
  info: string,
): Promise<CryptoKey> {
  // Convert salt string to ArrayBuffer if necessary
  const processedSalt =
    typeof salt === "string" ? new TextEncoder().encode(salt) : salt;
  const processedInfo = new TextEncoder().encode(info);

  // 1. Import the raw secret as HKDF key material
  const hkdfKey = await window.crypto.subtle.importKey(
    "raw",
    rawSecret,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );

  // 2. Expand into AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: processedSalt,
      info: processedInfo,
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false, // derived AES keys are never extractable
    ["encrypt", "decrypt"],
  );
}

// ── AES-GCM Encryption / Decryption ──────────────────────────────────

/**
 * Encrypts raw bytes, prepending a random 12-byte IV to the ciphertext,
 * and base64url encodes the whole blob.
 */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: BufferSource,
): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertextArrayBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    plaintext,
  );

  // Combine IV (12 bytes) + Ciphertext
  const combined = new Uint8Array(iv.length + ciphertextArrayBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextArrayBuffer), iv.length);

  return bufferToBase64url(combined.buffer);
}

/**
 * Encrypts a string message.
 */
export async function encryptMessage(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  const encodedData = new TextEncoder().encode(plaintext);
  return encryptBytes(key, encodedData);
}

/**
 * Splits the IV and ciphertext, verifies the auth tag, and decrypts back to raw bytes.
 */
export async function decryptBytes(
  key: CryptoKey,
  base64Ciphertext: string,
): Promise<ArrayBuffer> {
  const combinedBuffer = base64urlToBuffer(base64Ciphertext);
  const combined = new Uint8Array(combinedBuffer);

  if (combined.length < 12) {
    throw new Error("Ciphertext too short to contain IV");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  return window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext,
  );
}

/**
 * Decrypts a base64url ciphertext back to a string message.
 */
export async function decryptMessage(
  key: CryptoKey,
  base64Ciphertext: string,
): Promise<string> {
  const decryptedBuffer = await decryptBytes(key, base64Ciphertext);
  return new TextDecoder().decode(decryptedBuffer);
}

// ── Private Key Transfer (Device Linking Ceremony Only) ───────────────

/**
 * Exports a private key as raw pkcs8 bytes so it can be transmitted.
 * This ONLY works if the key was created with extractable: true.
 * Returns raw binary (ArrayBuffer), not JSON.
 */
export async function exportKeyAsBytes(key: CryptoKey): Promise<ArrayBuffer> {
  return window.crypto.subtle.exportKey("pkcs8", key);
}

/**
 * Imports Transmitted pkcs8 bytes back into an unextractable CryptoKey.
 */
export async function importPrivateKeyFromBytes(
  bytes: ArrayBuffer,
): Promise<CryptoKey> {
  return window.crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "X25519" },
    true, // Must be true so Phase 10 Key Backup can dynamically extract and encrypt it
    ["deriveKey", "deriveBits"],
  );
}

// ── Base64Url Utilities ───────────────────────────────────────────────

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Base64 -> Base64Url
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64urlToBuffer(base64url: string): ArrayBuffer {
  // Base64Url -> Base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with '='
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function pushChannelKeysToNewlyLinkedDevice(
  newDevicePublicKeyBase64: string,
  newDeviceId: string,
) {
  const { deviceId: myDeviceId, privateKey: myPrivateKey } =
    await resolveTrustedLocalDevice();

  // 1. Fetch all channels I have access to
  const channels = await fetchAPI("/channel-keys/my-channels");
  if (!channels || channels.length === 0) return;

  for (const c of channels) {
    if (!c.is_encrypted) continue;

    try {
      // 2. Fetch my encrypted copy of the active epoch key
      const myKeyRes = await fetchAPI(
        `/channel-keys/${c.channel_id}/my-key?device_id=${myDeviceId}`,
      );

      // 3. Decrypt it
      const wrapKey = await deriveKey(
        await deriveSharedSecret(
          myPrivateKey,
          myKeyRes.owner_device_public_key,
        ),
        c.channel_id,
        "channel-key",
      );
      const channelKeyBytes = await decryptBytes(
        wrapKey,
        myKeyRes.encrypted_channel_key,
      );

      // 4. Re-encrypt it specifically for the newly linked device
      const newSharedSecret = await deriveSharedSecret(
        myPrivateKey,
        newDevicePublicKeyBase64,
      );
      const newWrapKey = await deriveKey(
        newSharedSecret,
        c.channel_id,
        "channel-key",
      );
      const newEncryptedBlob = await encryptBytes(newWrapKey, channelKeyBytes);

      // 5. Submit the copy to the server via the P2P distribution endpoint
      await fetchAPI(
        `/channel-keys/${c.channel_id}/distribute-to-device?device_id=${myDeviceId}`,
        {
          method: "POST",
          body: JSON.stringify({
            target_device_id: newDeviceId,
            epoch: myKeyRes.epoch,
            encrypted_channel_key: newEncryptedBlob,
          }),
        },
      );
      console.log(
        `Successfully distributed channel ${c.channel_id} to new device ${newDeviceId}`,
      );
    } catch (err) {
      console.error(
        `Failed to distribute channel ${c.channel_id} to new device`,
        err,
      );
    }
  }
}
