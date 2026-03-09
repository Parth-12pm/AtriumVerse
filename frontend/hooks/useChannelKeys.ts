"use client";

import { useState, useCallback, useRef } from "react";
import {
  deriveSharedSecret,
  deriveKey,
  encryptBytes,
  decryptBytes,
  importPrivateKeyFromBytes,
} from "@/lib/crypto";
import { getPrivateKey } from "@/lib/keyStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useChannelKeys() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-memory strictly: channelId -> ArrayBuffer (raw key bytes)
  const channelKeysRef = useRef<Map<string, ArrayBuffer>>(new Map());

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  /**
   * 1. Fetch encrypted channel_key from server.
   * 2. Load permanent private_key from IndexedDB.
   * 3. ECDH shared secret with owner_device_public_key.
   * 4. Decrypt channel_key into memory map.
   */
  const fetchAndDeriveChannelKey = useCallback(async (channelId: string) => {
    try {
      const deviceId = localStorage.getItem("device_id");
      if (!deviceId) throw new Error("No device ID found in localStorage.");

      // Check if we already have it in memory
      if (channelKeysRef.current.has(channelId)) {
        return channelKeysRef.current.get(channelId);
      }

      const res = await fetch(
        `${API_URL}/channel-keys/${channelId}/my-key?device_id=${deviceId}`,
        { headers: getAuthHeaders() },
      );

      if (!res.ok) {
        if (res.status === 404 || res.status === 403) return null; // Expected if user removed or E2EE off
        throw new Error("Failed to fetch channel key");
      }

      const { encrypted_channel_key, owner_device_public_key } =
        await res.json();

      // ECDH Handshake to unwrap
      const myPrivateKey = await getPrivateKey(deviceId);
      if (!myPrivateKey)
        throw new Error(
          "Missing private key in IndexedDB for channel decrytion",
        );

      const sharedSecret = await deriveSharedSecret(
        myPrivateKey,
        owner_device_public_key,
      );

      const wrapKey = await deriveKey(sharedSecret, channelId, "channel-key");

      // Decrypt the raw channel_key blob
      const channelKeyBytes = await decryptBytes(
        wrapKey,
        encrypted_channel_key,
      );

      // Store in memory ONLY
      channelKeysRef.current.set(channelId, channelKeyBytes);
      return channelKeyBytes;
    } catch (err: any) {
      console.error(
        `[useChannelKeys] Error fetching key for ${channelId}:`,
        err,
      );
      setErrorMsg(err.message);
      return null;
    }
  }, []);

  /**
   * Derives a temporary AES-GCM CryptoKey for a specific epoch on the fly.
   */
  const getEpochKey = useCallback(
    async (channelId: string, epoch: number): Promise<CryptoKey> => {
      let keyBytes = channelKeysRef.current.get(channelId);

      if (!keyBytes) {
        // Try to fetch it natively if it isn't in memory
        keyBytes = await fetchAndDeriveChannelKey(channelId);
        if (!keyBytes)
          throw new Error(`Channel key not available for ${channelId}`);
      }

      // HKDF derive epoch key from channel key bytes
      return deriveKey(keyBytes, channelId, `epoch:${epoch}`);
    },
    [fetchAndDeriveChannelKey],
  );

  /**
   * Encrypts a plaintext message for the specified channel.
   * Fetches the current epoch via the my-key endpoint.
   */
  const encryptForChannel = useCallback(
    async (channelId: string, plaintext: string) => {
      try {
        const deviceId = localStorage.getItem("device_id");
        if (!deviceId) throw new Error("No device ID");

        // 1. We must know the *current* epoch to encrypt a new message.
        // Easiest reliable way is to ensure we have my-key fetched which returns epoch.
        // For production, this should be cached locally to avoid roundtrips per message.
        const res = await fetch(
          `${API_URL}/channel-keys/${channelId}/my-key?device_id=${deviceId}`,
          { headers: getAuthHeaders() },
        );
        if (!res.ok)
          throw new Error("Channel encryption not active or inaccessible");
        const { epoch } = await res.json();

        // 2. Derive that specific epoch's key
        const epochKey = await getEpochKey(channelId, epoch);

        // 3. Encrypt!
        // We use the string encrypt generator here because messages are valid strings
        const encodedData = new TextEncoder().encode(plaintext);
        const ciphertext = await encryptBytes(epochKey, encodedData);

        return { ciphertext, epoch };
      } catch (err: any) {
        console.error("Encryption failed:", err);
        throw err;
      }
    },
    [getEpochKey],
  );

  /**
   * Reconstructs the chain to decrypt a historical message.
   */
  const decryptForChannel = useCallback(
    async (
      channelId: string,
      epoch: number,
      ciphertext: string,
    ): Promise<string> => {
      try {
        const epochKey = await getEpochKey(channelId, epoch);
        const rawPlaintextBytes = await decryptBytes(epochKey, ciphertext);
        return new TextDecoder().decode(rawPlaintextBytes);
      } catch (err) {
        console.error(
          `[Decrypt error msg=${ciphertext.substring(0, 10)}...]`,
          err,
        );
        throw new Error(
          "Message could not be decrypted (integrity check failed)",
        );
      }
    },
    [getEpochKey],
  );

  return {
    errorMsg,
    fetchAndDeriveChannelKey,
    encryptForChannel,
    decryptForChannel,
  };
}
