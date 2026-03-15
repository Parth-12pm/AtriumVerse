import { fetchAPI } from "@/lib/api";
import { deriveSharedSecret, deriveKey, encryptBytes } from "@/lib/crypto";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";
import { globalChannelKeysCache } from "@/hooks/useChannelKeys";

export async function rotateEncryptedChannels(
  channelIds: string[],
  reason: string,
) {
  const { deviceId: myDeviceId, privateKey: myPrivKey } =
    await resolveTrustedLocalDevice();

  for (const cid of channelIds) {
    try {
      const newKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const devices = await fetchAPI(`/channels/${cid}/devices`);
      if (!devices || devices.length === 0) continue;

      const encryptedKeys = await Promise.all(
        devices.map(async (device: any) => {
          const sharedSecret = await deriveSharedSecret(
            myPrivKey,
            device.public_key,
          );
          const wrapKey = await deriveKey(sharedSecret, cid, "channel-key");
          const encryptedChannelKey = await encryptBytes(
            wrapKey,
            newKeyBytes.buffer,
          );
          return {
            target_device_id: device.id,
            encrypted_channel_key: encryptedChannelKey,
          };
        }),
      );

      await fetchAPI(`/channel-keys/${cid}/rotate?device_id=${myDeviceId}`, {
        method: "POST",
        body: JSON.stringify({ encrypted_keys: encryptedKeys, reason: reason }),
      });

      globalChannelKeysCache.set(cid, newKeyBytes.buffer);
    } catch (err) {
      console.error(`Failed to rotate key for channel ${cid}:`, err);
    }
  }
}

export async function distributeKeysToNewMember(
  channelIds: string[],
  newUserId: string,
) {
  const { deviceId: myDeviceId, privateKey: myPrivKey } =
    await resolveTrustedLocalDevice();

  for (const cid of channelIds) {
    try {
      const currentKeyBytes = globalChannelKeysCache.get(cid);
      if (!currentKeyBytes) continue;

      // Fetch ALL devices for the members in this specific channel
      const devicesRes = await fetchAPI(`/channels/${cid}/devices`);

      // Filter it down to just the newly joined user's trusted devices
      const newUserDevices = devicesRes.filter(
        (d: any) => d.user_id === newUserId && d.is_trusted,
      );

      if (newUserDevices.length === 0) {
        console.warn(
          `No trusted devices found for new user ${newUserId} in channel ${cid}`,
        );
        continue;
      }

      const myKeyRes = await fetchAPI(
        `/channel-keys/${cid}/my-key?device_id=${myDeviceId}`,
      );

      await Promise.all(
        newUserDevices.map(async (device: any) => {
          const sharedSecret = await deriveSharedSecret(
            myPrivKey,
            device.public_key,
          );
          const wrapKey = await deriveKey(sharedSecret, cid, "channel-key");
          const encryptedChannelKey = await encryptBytes(
            wrapKey,
            currentKeyBytes,
          );

          return fetchAPI(
            `/channel-keys/${cid}/distribute-to-device?device_id=${myDeviceId}`,
            {
              method: "POST",
              body: JSON.stringify({
                target_device_id: device.id,
                epoch: myKeyRes.epoch,
                encrypted_channel_key: encryptedChannelKey,
              }),
            },
          );
        }),
      );
    } catch (err) {
      console.error(`Failed to distribute key for channel ${cid}:`, err);
    }
  }
}
