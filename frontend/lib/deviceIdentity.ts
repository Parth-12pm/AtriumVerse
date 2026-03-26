"use client";

import { deletePrivateKey, deleteTempKeypair } from "@/lib/keyStore";

const DEVICE_STORAGE_KEYS = [
  "device_id",
  "device_public_key",
  "device_owner_user_id",
  "interim_wrap_key",
  "pending_link_request_id",
];

export async function clearLocalDeviceIdentity(deviceId?: string | null) {
  const targetDeviceId =
    deviceId ||
    (typeof window !== "undefined" ? localStorage.getItem("device_id") : null);
  const pendingLinkRequestId =
    typeof window !== "undefined"
      ? localStorage.getItem("pending_link_request_id")
      : null;

  if (targetDeviceId) {
    await deletePrivateKey(targetDeviceId);
  }

  if (pendingLinkRequestId) {
    await deleteTempKeypair(pendingLinkRequestId);
  }

  if (typeof window !== "undefined") {
    for (const key of DEVICE_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }
}

export function persistDeviceOwner(userId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("device_owner_user_id", userId);
  }
}
