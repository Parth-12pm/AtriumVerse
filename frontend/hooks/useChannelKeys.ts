"use client";

import { useCallback, useRef, useState } from "react";
import {
  decryptBytes,
  deriveKey,
  deriveSharedSecret,
  encryptBytes,
} from "@/lib/crypto";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ChannelKeyResponse = {
  epoch: number;
  encrypted_channel_key: string;
  owner_device_public_key: string;
};

export class ChannelKeyUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelKeyUnavailableError";
  }
}

export class ChannelEncryptionDisabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelEncryptionDisabledError";
  }
}

function makeCacheKey(channelId: string, epoch: number) {
  return `${channelId}:${epoch}`;
}

export function useChannelKeys() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const channelKeysRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const entitledEpochsLoadedRef = useRef<Set<string>>(new Set());

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const decryptChannelKeyBlob = useCallback(
    async (channelId: string, payload: ChannelKeyResponse) => {
      const { privateKey: myPrivateKey } = await resolveTrustedLocalDevice();

      const sharedSecret = await deriveSharedSecret(
        myPrivateKey,
        payload.owner_device_public_key,
      );
      const wrapKey = await deriveKey(sharedSecret, channelId, "channel-key");
      const channelKeyBytes = await decryptBytes(
        wrapKey,
        payload.encrypted_channel_key,
      );

      channelKeysRef.current.set(
        makeCacheKey(channelId, payload.epoch),
        channelKeyBytes,
      );
      return channelKeyBytes;
    },
    [],
  );

  const fetchCurrentChannelKey = useCallback(
    async (channelId: string) => {
      try {
        const { deviceId } = await resolveTrustedLocalDevice();

        const res = await fetch(
          `${API_URL}/channel-keys/${channelId}/my-key?device_id=${deviceId}`,
          { headers: getAuthHeaders() },
        );

        if (!res.ok) {
          if (res.status === 404) {
            throw new ChannelEncryptionDisabledError(
              `Channel encryption is not enabled for ${channelId}`,
            );
          }
          if (res.status === 403) {
            throw new ChannelKeyUnavailableError(
              `Channel key not available for ${channelId}`,
            );
          }
          throw new Error("Failed to fetch current channel key");
        }

        const payload = (await res.json()) as ChannelKeyResponse;
        const cacheKey = makeCacheKey(channelId, payload.epoch);
        const cached = channelKeysRef.current.get(cacheKey);
        if (cached) {
          return { keyBytes: cached, epoch: payload.epoch };
        }

        const keyBytes = await decryptChannelKeyBlob(channelId, payload);
        return { keyBytes, epoch: payload.epoch };
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch current channel key");
        throw err;
      }
    },
    [decryptChannelKeyBlob],
  );

  const fetchEntitledChannelKeys = useCallback(
    async (channelId: string) => {
      try {
        const { deviceId } = await resolveTrustedLocalDevice();

        const res = await fetch(
          `${API_URL}/channel-keys/${channelId}/entitled-epochs?device_id=${deviceId}`,
          { headers: getAuthHeaders() },
        );

        if (!res.ok) {
          if (res.status === 404 || res.status === 403) {
            return false;
          }
          throw new Error("Failed to fetch entitled channel epochs");
        }

        const payloads = (await res.json()) as ChannelKeyResponse[];
        for (const payload of payloads) {
          const cacheKey = makeCacheKey(channelId, payload.epoch);
          if (!channelKeysRef.current.has(cacheKey)) {
            await decryptChannelKeyBlob(channelId, payload);
          }
        }

        entitledEpochsLoadedRef.current.add(channelId);
        return true;
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch entitled channel epochs");
        return false;
      }
    },
    [decryptChannelKeyBlob],
  );

  const getEpochKey = useCallback(
    async (channelId: string, epoch: number): Promise<CryptoKey> => {
      const cached = channelKeysRef.current.get(makeCacheKey(channelId, epoch));
      if (cached) {
        return deriveKey(cached, channelId, `epoch:${epoch}`);
      }

      if (!entitledEpochsLoadedRef.current.has(channelId)) {
        await fetchEntitledChannelKeys(channelId);
      }

      const entitledKey = channelKeysRef.current.get(makeCacheKey(channelId, epoch));
      if (entitledKey) {
        return deriveKey(entitledKey, channelId, `epoch:${epoch}`);
      }

      try {
        const currentKey = await fetchCurrentChannelKey(channelId);
        if (currentKey.epoch === epoch) {
          return deriveKey(currentKey.keyBytes, channelId, `epoch:${epoch}`);
        }
      } catch (err) {
        if (err instanceof ChannelEncryptionDisabledError) {
          throw err;
        }
      }

      throw new ChannelKeyUnavailableError(
        `Channel key not available for ${channelId} at epoch ${epoch}`,
      );
    },
    [fetchCurrentChannelKey, fetchEntitledChannelKeys],
  );

  const encryptForChannel = useCallback(
    async (channelId: string, plaintext: string) => {
      const current = await fetchCurrentChannelKey(channelId);
      const epochKey = await deriveKey(
        current.keyBytes,
        channelId,
        `epoch:${current.epoch}`,
      );
      const encodedData = new TextEncoder().encode(plaintext);
      const ciphertext = await encryptBytes(epochKey, encodedData);
      return { ciphertext, epoch: current.epoch };
    },
    [fetchCurrentChannelKey],
  );

  const decryptForChannel = useCallback(
    async (channelId: string, epoch: number, ciphertext: string): Promise<string> => {
      try {
        const epochKey = await getEpochKey(channelId, epoch);
        const rawPlaintextBytes = await decryptBytes(epochKey, ciphertext);
        return new TextDecoder().decode(rawPlaintextBytes);
      } catch (err) {
        if (
          err instanceof ChannelKeyUnavailableError ||
          err instanceof ChannelEncryptionDisabledError
        ) {
          throw err;
        }
        console.error(`[Decrypt error msg=${ciphertext.substring(0, 10)}...]`, err);
        throw new Error("Message could not be decrypted (integrity check failed)");
      }
    },
    [getEpochKey],
  );

  return {
    errorMsg,
    fetchCurrentChannelKey,
    encryptForChannel,
    decryptForChannel,
  };
}
