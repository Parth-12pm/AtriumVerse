"use client";

/**
 * Phase 6 — Secure IndexedDB Key Storage
 *
 * Rules:
 * 1. ONLY runs on the client.
 * 2. Stores CryptoKey objects directly (not base64 strings).
 * 3. Permanent private keys must be extractable: false before storing.
 * 4. Temp ceremony keys can be extractable: true (they need to be exported to the new device).
 * 5. Channel/Epoch keys DO NOT BELONG HERE. They live in memory only.
 */

import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "atriumverse_crypto";
const DB_VERSION = 1;
const STORE_NAME = "keys";

let _dbPromise: Promise<IDBPDatabase> | null = null;

export async function initDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    throw new Error(
      "initDB called on the server. Crypto requires browser context.",
    );
  }

  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return _dbPromise;
}

// ── Permanent Private Keys ─────────────────────────────────────────

export async function storePrivateKey(
  deviceId: string,
  key: CryptoKey,
): Promise<void> {
  if (key.extractable) {
    console.warn(
      "SECURITY WARNING: Storing an extractable permanent private key. This is dangerous.",
    );
  }
  const db = await initDB();
  await db.put(STORE_NAME, key, `private:${deviceId}`);
}

export async function getPrivateKey(
  deviceId: string,
): Promise<CryptoKey | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, `private:${deviceId}`);
}

export async function deletePrivateKey(deviceId: string): Promise<void> {
  const db = await initDB();
  await db.delete(STORE_NAME, `private:${deviceId}`);
  await db.delete(STORE_NAME, `encrypted_backup:${deviceId}`);
}

// ── Encrypted Private Key Backup (For Ceremony Export) ─────────────
// Interim until Phase 10 WebAuthn PRF: The wrap key is stored in localStorage.
// The raw pkcs8 bytes are AES-GCM encrypted before hitting IndexedDB.

export async function storeEncryptedBackup(
  deviceId: string,
  ciphertext: string,
): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, ciphertext, `encrypted_backup:${deviceId}`);
}

export async function getEncryptedBackup(
  deviceId: string,
): Promise<string | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, `encrypted_backup:${deviceId}`);
}

// ── Ephemeral Ceremony Keys ────────────────────────────────────────

export async function storeTempKeypair(
  requestId: string,
  keypair: CryptoKeyPair,
): Promise<void> {
  const db = await initDB();
  await db.put(STORE_NAME, keypair, `temp:${requestId}`);
}

export async function getTempKeypair(
  requestId: string,
): Promise<CryptoKeyPair | undefined> {
  const db = await initDB();
  return db.get(STORE_NAME, `temp:${requestId}`);
}

export async function deleteTempKeypair(requestId: string): Promise<void> {
  const db = await initDB();
  await db.delete(STORE_NAME, `temp:${requestId}`);
}
