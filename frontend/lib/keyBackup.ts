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

function bytesToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

function serializeRegistrationCredential(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
    type: credential.type,
  };
}

export async function fetchKeyBackup() {
  try {
    const res = await fetchAPI("/account/key-backup", { method: "GET" });
    return res;
  } catch (e: any) {
    if (e.message?.includes("404") || e.status === 404) return null;
    throw e;
  }
}

async function fetchKeyBackupChallenge(): Promise<string> {
  const res = await fetchAPI("/account/key-backup/challenge", { method: "GET" });
  return res.challenge as string;
}

export async function postKeyBackup(data: {
  encrypted_blob: string;
  backup_method: "prf" | "passphrase";
  prf_credential_id?: string;
  prf_registration_credential?: Record<string, unknown>;
  prf_registration_challenge?: string;
  salt?: string;
}) {
  return fetchAPI("/account/key-backup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

const PRF_CONTEXT_STRING = "atriumverse-key-backup-v1";
const RP_ID = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || "localhost";

export async function createBackupViaPRF(
  userId: string,
  username: string,
  privateKey: CryptoKey,
  publicKeyBase64: string,
) {
  const registrationChallenge = await fetchKeyBackupChallenge();
  const registrationChallengeBuffer = base64urlToBuffer(registrationChallenge);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: registrationChallengeBuffer,
      rp: { id: RP_ID, name: "AtriumVerse" },
      user: {
        id: new TextEncoder().encode(userId),
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        userVerification: "required",
        residentKey: "required",
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

  const prfSupported = (credential.getClientExtensionResults() as any)?.prf?.enabled;
  if (!prfSupported) {
    return { supported: false };
  }

  const prfChallenge = window.crypto.getRandomValues(new Uint8Array(32));
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: prfChallenge,
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

  const prfOutput = (assertion.getClientExtensionResults() as any)?.prf?.results?.first;
  if (!prfOutput) {
    return { supported: false };
  }

  const privateKeyBytes = await exportKeyAsBytes(privateKey);
  const prfKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const blobPayload = JSON.stringify({
    privateKey: bytesToBase64url(privateKeyBytes),
    publicKey: publicKeyBase64,
  });
  const encryptedBlob = await encryptMessage(prfKey, blobPayload);

  await postKeyBackup({
    encrypted_blob: encryptedBlob,
    backup_method: "prf",
    prf_credential_id: bufferToBase64url(credential.rawId),
    prf_registration_credential: serializeRegistrationCredential(credential),
    prf_registration_challenge: registrationChallenge,
  });

  return { supported: true };
}

export async function recoverViaWebAuthn(
  backupBlob: string,
  prfCredentialIdBase64: string,
) {
  const challenge = window.crypto.getRandomValues(new Uint8Array(32));

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

  const prfOutput = (assertion.getClientExtensionResults() as any)?.prf?.results?.first;
  if (!prfOutput) {
    throw new Error("PRF not supported on this device/authenticator");
  }

  const prfKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const blobPayloadStr = await decryptMessage(prfKey, backupBlob);
  let privateKeyBase64url: string;
  let publicKeyBase64 = "";
  try {
    const parsed = JSON.parse(blobPayloadStr);
    privateKeyBase64url = parsed.privateKey;
    publicKeyBase64 = parsed.publicKey || "";
  } catch {
    privateKeyBase64url = blobPayloadStr;
  }
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);

  const privateKey = await importPrivateKeyFromBytes(privateKeyBytes);
  return { privateKey, publicKeyBase64 };
}

export async function createBackupViaPassphrase(
  privateKey: CryptoKey,
  passphrase: string,
  publicKeyBase64: string,
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
  const blobPayload = JSON.stringify({
    privateKey: bytesToBase64url(privateKeyBytes),
    publicKey: publicKeyBase64,
  });
  const encryptedBlob = await encryptMessage(backupKey, blobPayload);

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

  const blobPayloadStr = await decryptMessage(backupKey, backupBlob);
  let privateKeyBase64url: string;
  let publicKeyBase64 = "";
  try {
    const parsed = JSON.parse(blobPayloadStr);
    privateKeyBase64url = parsed.privateKey;
    publicKeyBase64 = parsed.publicKey || "";
  } catch {
    privateKeyBase64url = blobPayloadStr;
  }
  const privateKeyBytes = base64urlToBytes(privateKeyBase64url);

  return {
    privateKey: await importPrivateKeyFromBytes(privateKeyBytes),
    publicKeyBase64,
  };
}

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
  const bytes = crypto.getRandomValues(new Uint8Array(20));
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

