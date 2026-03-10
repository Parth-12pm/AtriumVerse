"use client";

import {
  encryptMessage,
  decryptMessage,
  exportKeyAsBytes,
  importPrivateKeyFromBytes,
  bufferToBase64url,
  base64urlToBuffer,
} from "./crypto";

import { fetchAPI } from "./api";

// Use a simple base64/bytes conversion for the exported raw private key bytes
function bytesToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
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

// --- API Calls ---

export async function fetchKeyBackup() {
  try {
    const res = await fetchAPI("/account/key-backup", { method: "GET" });
    return res;
  } catch (e: any) {
    if (e.message?.includes("404") || e.status === 404) return null;
    throw e;
  }
}

export async function postKeyBackup(data: {
  encrypted_blob: string;
  backup_method: "prf" | "passphrase";
  prf_credential_id?: string;
  salt?: string;
}) {
  return fetchAPI("/account/key-backup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- PRF Path (Primary) ---

const PRF_CONTEXT_STRING = "atriumverse-key-backup-v1";
const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost";

export async function createBackupViaPRF(
  userId: string,
  username: string,
  privateKey: CryptoKey,
) {
  // 1. Fetch challenge
  const challengeRes = await fetchAPI(
    "/device-linking/challenge?request_id=" + crypto.randomUUID(),
  );
  const challenge = base64urlToBuffer(challengeRes.challenge);

  // 2. Create Passkey requesting PRF
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { id: RP_ID, name: "AtriumVerse" },
      user: {
        id: new TextEncoder().encode(userId),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "required", // Passkey
      },
      extensions: {
        prf: {
          eval: {
            first: new TextEncoder().encode(PRF_CONTEXT_STRING),
          },
        },
      },
    },
  })) as PublicKeyCredential;

  // 3. Check PRF support
  const prfSupported = (credential.getClientExtensionResults() as any)?.prf
    ?.enabled;
  if (!prfSupported) {
    return { supported: false };
  }

  // 4. Authenticate to get PRF output
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: RP_ID,
      allowCredentials: [{ id: credential.rawId, type: "public-key" }],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: new TextEncoder().encode(PRF_CONTEXT_STRING),
          },
        },
      },
    },
  })) as PublicKeyCredential;

  const prfOutput = (assertion.getClientExtensionResults() as any)?.prf?.results
    ?.first;
  if (!prfOutput) {
    return { supported: false };
  }

  // 5. Encrypt Private Key
  const privateKeyBytes = await exportKeyAsBytes(privateKey);
  const prfKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encryptedBlob = await encryptMessage(
    prfKey,
    bytesToBase64url(privateKeyBytes),
  );

  // 6. Save Backup
  await postKeyBackup({
    encrypted_blob: encryptedBlob,
    backup_method: "prf",
    prf_credential_id: bufferToBase64url(credential.rawId),
  });

  return { supported: true };
}

export async function recoverViaWebAuthn(
  backupBlob: string,
  prfCredentialIdBase64: string,
) {
  // 1. Fetch challenge
  const challengeRes = await fetchAPI(
    "/device-linking/challenge?request_id=" + crypto.randomUUID(),
  );
  const challenge = base64urlToBuffer(challengeRes.challenge);

  // 2. Authenticate
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: RP_ID,
      allowCredentials: [
        { id: base64urlToBuffer(prfCredentialIdBase64), type: "public-key" },
      ],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: new TextEncoder().encode(PRF_CONTEXT_STRING),
          },
        },
      },
    },
  })) as PublicKeyCredential;

  // 3. Check PRF output
  const prfOutput = (assertion.getClientExtensionResults() as any)?.prf?.results
    ?.first;
  if (!prfOutput) {
    throw new Error("PRF not supported on this device/authenticator");
  }

  // 4. Decrypt Private Key
  const prfKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const privateKeyBase64url = await decryptMessage(prfKey, backupBlob);
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);

  // 5. Import Key
  return importPrivateKeyFromBytes(privateKeyBytes);
}

// --- Passphrase Path (Fallback) ---

export async function createBackupViaPassphrase(
  privateKey: CryptoKey,
  passphrase: string,
) {
  const salt = crypto.getRandomValues(new Uint8Array(32)).buffer;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const backupKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  const privateKeyBytes = await exportKeyAsBytes(privateKey);
  const encryptedBlob = await encryptMessage(
    backupKey,
    bytesToBase64url(privateKeyBytes),
  );

  await postKeyBackup({
    encrypted_blob: encryptedBlob,
    backup_method: "passphrase",
    salt: bufferToBase64url(salt),
  });

  return true;
}

export async function recoverViaPassphrase(
  backupBlob: string,
  saltBase64url: string,
  passphrase: string,
) {
  const salt = base64urlToBuffer(saltBase64url);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const backupKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const privateKeyBase64url = await decryptMessage(backupKey, backupBlob);
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);

  return importPrivateKeyFromBytes(privateKeyBytes);
}

// --- Recovery Code (Last Resort Fallback) ---

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20)); // 160 bits
  const base32 = bytesToBase32(bytes);
  return (base32.match(/.{1,4}/g) || []).join("-");
}

export async function deriveKeyFromRecoveryCode(code: string, userId: string) {
  const normalized = code.replace(/-/g, "").toUpperCase();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalized),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(userId),
      iterations: 600000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}
