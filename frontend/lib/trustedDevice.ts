"use client";

import {
  clearLocalDeviceIdentity,
  persistDeviceOwner,
} from "@/lib/deviceIdentity";
import { getPrivateKey } from "@/lib/keyStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type MyDeviceResponse = {
  device_id: string;
  is_trusted: boolean;
};

type PublicDeviceResponse = {
  device_id: string;
  public_key: string;
};

export type TrustedLocalDevice = {
  deviceId: string;
  privateKey: CryptoKey;
};

let cachedUserId: string | null = null;
let cachedDeviceId: string | null = null;
let resolutionPromise: Promise<TrustedLocalDevice> | null = null;

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg =
      typeof errorData.detail === "string"
        ? errorData.detail
        : "Failed to resolve trusted device";
    throw new Error(errorMsg);
  }

  return res.json();
}

async function syncStoredPublicKey(userId: string, deviceId: string) {
  const publicDevices = await fetchJson<PublicDeviceResponse[]>(
    `/devices/user/${userId}`,
  );
  const matchedDevice = publicDevices.find(
    (device) => device.device_id === deviceId,
  );
  if (matchedDevice) {
    localStorage.setItem("device_public_key", matchedDevice.public_key);
  }
}

async function resolveTrustedLocalDeviceUncached(): Promise<TrustedLocalDevice> {
  const token = localStorage.getItem("token");
  const currentUserId = localStorage.getItem("user_id");
  const storedDeviceId = localStorage.getItem("device_id");
  const storedDeviceOwnerUserId = localStorage.getItem("device_owner_user_id");

  if (!token || !currentUserId) {
    throw new Error("Not authenticated");
  }

  if (
    storedDeviceId &&
    storedDeviceOwnerUserId &&
    storedDeviceOwnerUserId !== currentUserId
  ) {
    await clearLocalDeviceIdentity(storedDeviceId);
  }

  const devices = await fetchJson<MyDeviceResponse[]>("/devices/my-devices");

  const verifiedStoredDeviceId = localStorage.getItem("device_id");
  if (verifiedStoredDeviceId) {
    const matchedDevice = devices.find(
      (device) => device.device_id === verifiedStoredDeviceId,
    );
    const storedPrivateKey = await getPrivateKey(verifiedStoredDeviceId);
    if (matchedDevice?.is_trusted && storedPrivateKey) {
      persistDeviceOwner(currentUserId);
      await syncStoredPublicKey(currentUserId, verifiedStoredDeviceId);
      cachedUserId = currentUserId;
      cachedDeviceId = verifiedStoredDeviceId;
      return {
        deviceId: verifiedStoredDeviceId,
        privateKey: storedPrivateKey,
      };
    }
  }

  for (const device of devices) {
    if (!device.is_trusted) {
      continue;
    }

    const privateKey = await getPrivateKey(device.device_id);
    if (!privateKey) {
      continue;
    }

    localStorage.setItem("device_id", device.device_id);
    persistDeviceOwner(currentUserId);
    await syncStoredPublicKey(currentUserId, device.device_id);
    cachedUserId = currentUserId;
    cachedDeviceId = device.device_id;
    return {
      deviceId: device.device_id,
      privateKey,
    };
  }

  const danglingDeviceId = localStorage.getItem("device_id");
  if (danglingDeviceId) {
    await clearLocalDeviceIdentity(danglingDeviceId);
  }

  cachedUserId = null;
  cachedDeviceId = null;
  throw new Error("No trusted local device is available in this browser");
}

export async function resolveTrustedLocalDevice(options?: {
  forceRefresh?: boolean;
}): Promise<TrustedLocalDevice> {
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null;
  const storedDeviceId =
    typeof window !== "undefined" ? localStorage.getItem("device_id") : null;

  if (
    !options?.forceRefresh &&
    currentUserId &&
    storedDeviceId &&
    cachedUserId === currentUserId &&
    cachedDeviceId === storedDeviceId
  ) {
    const privateKey = await getPrivateKey(storedDeviceId);
    if (privateKey) {
      return {
        deviceId: storedDeviceId,
        privateKey,
      };
    }
  }

  if (!resolutionPromise) {
    resolutionPromise = resolveTrustedLocalDeviceUncached().finally(() => {
      resolutionPromise = null;
    });
  }

  return resolutionPromise;
}

export function invalidateTrustedLocalDeviceCache() {
  cachedUserId = null;
  cachedDeviceId = null;
  resolutionPromise = null;
}
