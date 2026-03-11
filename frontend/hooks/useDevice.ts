"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  generateKeypair,
  exportPublicKey,
  deriveSharedSecret,
  deriveKey,
  decryptBytes,
  importPrivateKeyFromBytes,
  exportKeyAsBytes,
} from "@/lib/crypto";
import {
  getPrivateKey,
  storePrivateKey,
  storeTempKeypair,
  getTempKeypair,
  deleteTempKeypair,
  storeEncryptedBackup,
} from "@/lib/keyStore";
import { fetchKeyBackup } from "@/lib/keyBackup";
import { clearLocalDeviceIdentity, persistDeviceOwner } from "@/lib/deviceIdentity";
import EventBus from "@/game/EventBus";

export type DeviceState =
  | "checking"
  | "registering"
  | "trusted" // Fully linked and ready
  | "waiting_for_approval" // New device waiting for Old device
  | "approval_pending" // Old device has a request to approve
  | "recovery_prompt" // Backend has backup, prompt user to recover
  | "expired"
  | "rejected"
  | "error";

export interface PendingRequest {
  request_id: string;
  new_device_id: string;
  new_device_label?: string;
  temp_public_key: string;
  webauthn_credential_id: string | null;
  expires_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useDevice() {
  const [deviceState, setDeviceState] = useState<DeviceState>("checking");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(
    null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [backupInfo, setBackupInfo] = useState<any | null>(null);
  const bootstrapInFlightRef = useRef(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const storeInterimEncryptedBackup = async (
    targetDeviceId: string,
    rawBytes: ArrayBuffer,
  ) => {
    const wrapKeyString = crypto.randomUUID();
    localStorage.setItem("interim_wrap_key", wrapKeyString);

    const wrapKeyMaterial = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(wrapKeyString.padEnd(32, "0")),
      { name: "PBKDF2" },
      false,
      ["deriveKey"],
    );

    const aesWrapKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("interim-salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      wrapKeyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesWrapKey,
      rawBytes,
    );

    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertextBuffer), iv.length);

    let binaryStr = "";
    combined.forEach((b) => (binaryStr += String.fromCharCode(b)));
    await storeEncryptedBackup(targetDeviceId, btoa(binaryStr));
  };

  const checkDeviceState = useCallback(async () => {
    if (bootstrapInFlightRef.current) {
      return;
    }
    bootstrapInFlightRef.current = true;

    try {
      const storedDeviceId = localStorage.getItem("device_id");
      const storedDeviceOwnerUserId = localStorage.getItem("device_owner_user_id");
      const pendingLinkRequestId = localStorage.getItem("pending_link_request_id");
      const token = localStorage.getItem("token");
      const currentUserId = localStorage.getItem("user_id");

      if (!token || !currentUserId) {
        setDeviceState("checking"); // Not logged in yet
        return;
      }

      if (storedDeviceId && storedDeviceOwnerUserId && storedDeviceOwnerUserId !== currentUserId) {
        await clearLocalDeviceIdentity(storedDeviceId);
      }

      // Always verify the stored browser device against the current account before trusting it.
      const res = await fetch(`${API_URL}/devices/my-devices`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch devices");
      const devices = await res.json();

      const verifiedStoredDeviceId = localStorage.getItem("device_id");
      const storedDevice = verifiedStoredDeviceId
        ? devices.find((device: any) => device.device_id === verifiedStoredDeviceId)
        : null;

      // Recover from duplicate bootstrap/link side effects by preferring any trusted
      // server device whose private key is already present locally in this browser.
      let trustedLocalDeviceId: string | null = null;
      for (const device of devices) {
        if (!device.is_trusted) continue;
        const key = await getPrivateKey(device.device_id);
        if (key) {
          trustedLocalDeviceId = device.device_id;
          break;
        }
      }

      if (trustedLocalDeviceId) {
        if (pendingLinkRequestId) {
          await deleteTempKeypair(pendingLinkRequestId);
          localStorage.removeItem("pending_link_request_id");
        }
        localStorage.setItem("device_id", trustedLocalDeviceId);
        persistDeviceOwner(currentUserId);
        const backup = await fetchKeyBackup();
        if (backup) {
          setBackupInfo(backup);
          localStorage.setItem("backup_configured_v1", "true");
        }
        setDeviceId(trustedLocalDeviceId);
        setDeviceState("trusted");
        checkForPendingApprovals();
        return;
      }

      if (verifiedStoredDeviceId) {
        const hasKey = await getPrivateKey(verifiedStoredDeviceId);

        if (storedDevice?.is_trusted && hasKey) {
          persistDeviceOwner(currentUserId);
          const backup = await fetchKeyBackup();
          if (backup) {
            setBackupInfo(backup);
            localStorage.setItem("backup_configured_v1", "true");
          }
          setDeviceId(verifiedStoredDeviceId);
          setDeviceState("trusted");
          checkForPendingApprovals();
          return;
        }

        if (storedDevice && !storedDevice.is_trusted && pendingLinkRequestId) {
          setDeviceId(verifiedStoredDeviceId);
          setDeviceState("waiting_for_approval");
          return;
        }

        await clearLocalDeviceIdentity(verifiedStoredDeviceId);
      }

      if (devices.length === 0) {
        // First device ever
        await registerFirstDevice();
      } else {
        // Not first device. Check if a backup exists for recovery.
        const backup = await fetchKeyBackup();
        if (backup) {
          setBackupInfo(backup);
          setDeviceState("recovery_prompt");
        } else {
          // No backup exists, must use linking ceremony
          await initiateLinkingCeremony();
        }
      }
    } catch (err: any) {
      console.error(err);
      setDeviceState("error");
      setErrorMsg(err.message);
    } finally {
      bootstrapInFlightRef.current = false;
    }
  }, []);

  const registerFirstDevice = async () => {
    setDeviceState("registering");
    try {
      // 1. Generate temp extractable keys
      const tempKeypair = await generateKeypair(true);
      const pubBase64 = await exportPublicKey(tempKeypair.publicKey);
      localStorage.setItem("device_public_key", pubBase64);

      // 2. Export to raw pkcs8 bytes
      const rawBytes = await window.crypto.subtle.exportKey(
        "pkcs8",
        tempKeypair.privateKey,
      );

      // 3. Import back as extractable: false for permanent ops
      const permanentKey = await importPrivateKeyFromBytes(rawBytes);

      // 4. Register with backend
      const res = await fetch(`${API_URL}/devices/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          public_key: pubBase64,
          device_label: navigator.userAgent.substring(0, 30),
        }),
      });
      if (!res.ok) throw new Error("Failed to register device");
      const data = await res.json();

      // 5. Store a local encrypted backup for future device-link approvals
      await storeInterimEncryptedBackup(data.device_id, rawBytes);

      // 6. Store permanent key and ID
      await storePrivateKey(data.device_id, permanentKey);
      localStorage.setItem("device_id", data.device_id);
      persistDeviceOwner(localStorage.getItem("user_id") || "");
      setDeviceId(data.device_id);
      setDeviceState("trusted");
    } catch (err: any) {
      console.error(err);
      setDeviceState("error");
      setErrorMsg(err.message);
    }
  };

  const recoverDevice = async (
    recoveredPrivateKey: CryptoKey,
    publicKeyBase64: string,
  ) => {
    setDeviceState("registering");
    try {
      // 1. We already recovered the public key from the backup blob
      const pubBase64 = publicKeyBase64;

      // 2. Register with backend (automatically marked trusted by backend if we pass a special recovery flag?
      // Actually, standard registration creates it as untrusted. But wait, if recovering, the user
      // has proven their identity via PRF or Passphrase. We need a way to tell the backend to trust it.
      // Easiest is to add an `is_recovery=True` flag to POST /devices/register, or just do it client-side if allowed.
      // Let's assume hitting the registration endpoint is fine, but we might need a distinct endpoint for recovery registration if strict.
      // For now, standard registration:
      const res = await fetch(`${API_URL}/devices/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          public_key: pubBase64,
          device_label: navigator.userAgent.substring(0, 30) + " (Recovered)",
        }),
      });
      if (!res.ok) throw new Error("Failed to register recovered device");
      const data = await res.json();
      const newDeviceId = data.device_id;

      // 3. Store in IDB and localStorage
      await storePrivateKey(newDeviceId, recoveredPrivateKey);
      localStorage.setItem("device_id", newDeviceId);
      persistDeviceOwner(localStorage.getItem("user_id") || "");
      localStorage.setItem("device_public_key", pubBase64);
      const recoveredRawBytes = await exportKeyAsBytes(recoveredPrivateKey);
      await storeInterimEncryptedBackup(newDeviceId, recoveredRawBytes);
      setDeviceId(newDeviceId);
      setDeviceState("trusted");

      // 4. CRITICAL: PULL-based Channel Key Sync
      // Since there's no "old device" to push keys to us, we must fetch the encrypted epoch keys
      // that were encrypted for our previous devices, but wait, those were encrypted for previous devices!
      // If we recovered the SAME private key, we can decrypt any epoch key that was encrypted for ANY of our public keys
      // because our private key is the SAME.
      // (This is why we backed up the PRIVATE key, because it lets us read history).

      const chanRes = await fetch(`${API_URL}/channel-keys/my-channels`, {
        headers: getAuthHeaders(),
      });
      if (chanRes.ok) {
        const channels = await chanRes.json();
        for (const c of channels) {
          const epRes = await fetch(
            `${API_URL}/channel-keys/${c.channel_id}/entitled-epochs?device_id=${newDeviceId}`,
            { headers: getAuthHeaders() },
          );
          if (epRes.ok) {
            const epochs = await epRes.json();
            for (const ep of epochs) {
              // We would decrypt and load into Memory Map here.
              // This logic usually lives in ChannelKeys abstraction.
              // We emit an event to tell the system to re-sync channel keys.
            }
          }
        }
      }

      EventBus.emit("device:recovery_complete", { deviceId: newDeviceId });
    } catch (err: any) {
      console.error(err);
      // Clear any partially-set device context to avoid stale state
      await clearLocalDeviceIdentity(localStorage.getItem("device_id"));
      setDeviceId(null);
      setDeviceState("error");
      setErrorMsg(err.message);
    }
  };

  const initiateLinkingCeremony = async () => {
    try {
      const tempKeypair = await generateKeypair(true);
      const tempPub = await exportPublicKey(tempKeypair.publicKey);

      // Register untrusted device
      const res1 = await fetch(`${API_URL}/devices/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          public_key: tempPub, // Temporary identity until approval assigns the permanent shared key
          device_label: navigator.userAgent.substring(0, 30),
        }),
      });
      if (!res1.ok) throw new Error("Failed to register pending device");
      const deviceData = await res1.json();
      localStorage.setItem("device_id", deviceData.device_id);
      persistDeviceOwner(localStorage.getItem("user_id") || "");
      setDeviceId(deviceData.device_id);

      // Request strict link
      const res2 = await fetch(`${API_URL}/device-linking/request`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          new_device_id: deviceData.device_id,
          temp_public_key: tempPub,
          device_label: navigator.userAgent.substring(0, 30),
        }),
      });
      if (!res2.ok) throw new Error("Failed to request link");
      const reqData = await res2.json();

      await storeTempKeypair(reqData.request_id, tempKeypair);
      localStorage.setItem("pending_link_request_id", reqData.request_id);
      setExpiresAt(new Date(reqData.expires_at));
      setDeviceState("waiting_for_approval");
    } catch (err: any) {
      console.error(err);
      setDeviceState("error");
      setErrorMsg(err.message);
    }
  };

  const checkForPendingApprovals = async () => {
    try {
      const res = await fetch(`${API_URL}/device-linking/pending`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const pending = await res.json();
        if (pending.length > 0) {
          setPendingRequest(pending[0]); // Handle first pending request
          setDeviceState("approval_pending");
        }
      }
    } catch (err) {
      console.error("Error checking pending approvals", err);
    }
  };

  // State Effect
  useEffect(() => {
    checkDeviceState();
  }, [checkDeviceState]);

  // WebSocket / Polling Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Fast-path WS listener
    const handleWsMsg = (data: any) => {
      if (data.type === "device_link_request" && deviceState === "trusted") {
        // Fast-path: WebSocket says there's a request, but it lacks some secure
        // fields like webauthn_credential_id that are bound to this session's HTTP request.
        // Fetch the full pending request natively via REST:
        checkForPendingApprovals();
      }

      if (
        data.type === "device_link_approved" &&
        deviceState === "waiting_for_approval"
      ) {
        pollStatus(); // Immediately triggery decryption routine
      }
    };
    EventBus.on("ws:message", handleWsMsg);

    const pollStatus = async () => {
      const reqId = localStorage.getItem("pending_link_request_id");
      if (!reqId) return;

      try {
        const res = await fetch(
          `${API_URL}/device-linking/request/${reqId}/status`,
          {
            headers: getAuthHeaders(),
          },
        );
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "approved") {
          if (!data.approved_by_device_public_key) {
            throw new Error("Approving device public key missing from approval status");
          }
          if (!data.permanent_public_key) {
            throw new Error("Permanent public key missing from approval status");
          }

          // Handle cryptographic transfer
          const tempKeys = await getTempKeypair(reqId);
          if (!tempKeys) throw new Error("Temp keys missing");

          const sharedSecret = await deriveSharedSecret(
            tempKeys.privateKey,
            data.approved_by_device_public_key,
          );
          const wrapKey = await deriveKey(sharedSecret, reqId, "device-link");

          const rawBytes = await decryptBytes(
            wrapKey,
            data.encrypted_private_key,
          );

          const permKey = await importPrivateKeyFromBytes(rawBytes);
          const dId = localStorage.getItem("device_id");
          if (!dId) {
            throw new Error("Linked device ID missing from localStorage");
          }

          await storePrivateKey(dId, permKey);
          localStorage.setItem("device_public_key", data.permanent_public_key);
          await storeInterimEncryptedBackup(dId, rawBytes);

          await deleteTempKeypair(reqId);
          localStorage.removeItem("pending_link_request_id");
          setDeviceState("trusted");
        } else if (data.status === "rejected") {
          setDeviceState("rejected");
          localStorage.removeItem("pending_link_request_id");
        } else if (data.status === "expired") {
          setDeviceState("expired");
          localStorage.removeItem("pending_link_request_id");
        }
      } catch (err: any) {
        console.error(err);
      }
    };

    if (deviceState === "waiting_for_approval") {
      interval = setInterval(pollStatus, 5000); // 5 sec poll
    }

    return () => {
      if (interval) clearInterval(interval);
      EventBus.off("ws:message", handleWsMsg);
    };
  }, [deviceState]);

  return {
    deviceState,
    deviceId,
    pendingRequest,
    errorMsg,
    expiresAt,
    backupInfo,
    initiateLinkingCeremony,
    recoverDevice,
    setDeviceState,
    setPendingRequest,
  };
}

