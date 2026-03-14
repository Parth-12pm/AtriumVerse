import { fetchAPI } from "@/lib/api";
import { deriveSharedSecret, deriveKey, encryptBytes, decryptBytes } from "@/lib/crypto";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";
import { globalChannelKeysCache } from "@/hooks/useChannelKeys";

export async function rotateEncryptedChannels(
  channelIds: string[],
  serverId: string,
  reason: string,
) {
  const { deviceId: myDeviceId, privateKey: myPrivKey } =
    await resolveTrustedLocalDevice();

  for (const cid of channelIds) {
    try {
      const newKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const devices = await fetchAPI(`/devices/server/${serverId}`);
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
            target_device_id: device.device_id,
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
      // Fetch the new user's trusted devices
      const devicesRes = await fetchAPI(`/devices/user/${newUserId}`);
      const newUserDevices = devicesRes;
      if (!newUserDevices || newUserDevices.length === 0) continue;

      // Fetch ALL entitled epochs for the current device to share history
      const epochsRes = await fetchAPI(
        `/channel-keys/${cid}/entitled-epochs?device_id=${myDeviceId}`,
      );
      if (!epochsRes || epochsRes.length === 0) continue;

      await Promise.all(
        epochsRes.map(async (epochData: any) => {
          // Decrypt this epoch's channel key
          const mySharedSecret = await deriveSharedSecret(
            myPrivKey,
            epochData.owner_device_public_key,
          );
          const myWrapKey = await deriveKey(mySharedSecret, cid, "channel-key");
          const decryptedChannelKeyBuffer = await decryptBytes(
            myWrapKey,
            epochData.encrypted_channel_key,
          );

          // Now distribute this decrypted key to all new user devices
          await Promise.all(
            newUserDevices.map(async (device: any) => {
              const sharedSecret = await deriveSharedSecret(
                myPrivKey,
                device.public_key,
              );
              const wrapKey = await deriveKey(sharedSecret, cid, "channel-key");
              const encryptedChannelKey = await encryptBytes(
                wrapKey,
                decryptedChannelKeyBuffer,
              );

              return fetchAPI(
                `/channel-keys/${cid}/distribute-to-device?device_id=${myDeviceId}`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    target_device_id: device.device_id,
                    epoch: epochData.epoch,
                    encrypted_channel_key: encryptedChannelKey,
                  }),
                },
              );
            }),
          );
        })
      );
    } catch (err) {
      console.error(`Failed to distribute key for channel ${cid}:`, err);
    }
  }
}
