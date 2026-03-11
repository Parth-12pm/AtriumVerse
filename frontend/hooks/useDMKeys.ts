import { useCallback } from "react";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";
import {
  deriveSharedSecret,
  deriveKey,
  encryptBytes,
  decryptBytes,
} from "@/lib/crypto";

export function useDMKeys() {
  /**
   * Encrypts a plaintext message for multiple target devices.
   */
  const encryptDM = useCallback(
    async (
      dmId: string,
      epoch: number,
      plaintext: string,
      targetDevices: { id: string; public_key: string }[],
    ) => {
      const { deviceId: myDeviceId, privateKey: myPrivateKey } =
        await resolveTrustedLocalDevice();

      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);

      const deviceCiphertexts = [];

      for (const device of targetDevices) {
        // ECDH: My Private + Their Public -> Shared Secret
        const sharedSecret = await deriveSharedSecret(
          myPrivateKey,
          device.public_key,
        );

        // HKDF: Shared Secret + Salt (dmId) + Info ("dm-epoch:{N}") -> Message Key
        const messageKey = await deriveKey(
          sharedSecret,
          dmId,
          `dm-epoch:${epoch}`,
        );

        // AES-GCM
        const encryptedBlob = await encryptBytes(messageKey, plaintextBytes);

        deviceCiphertexts.push({
          device_id: device.id,
          sender_device_id: myDeviceId,
          encrypted_ciphertext: encryptedBlob,
        });
      }

      if (deviceCiphertexts.length !== targetDevices.length) {
        throw new Error("Failed to encrypt for every DM target device");
      }

      return deviceCiphertexts;
    },
    [],
  );

  /**
   * Decrypts a specific ciphertext using the sender's public key.
   */
  const decryptDM = useCallback(
    async (
      dmId: string,
      epoch: number,
      encryptedCiphertext: string,
      senderPublicKeyBase64: string,
    ) => {
      const { privateKey: myPrivateKey } = await resolveTrustedLocalDevice();

      // ECDH: My Private + Sender's Public -> Shared Secret
      const sharedSecret = await deriveSharedSecret(
        myPrivateKey,
        senderPublicKeyBase64,
      );

      // HKDF
      const messageKey = await deriveKey(
        sharedSecret,
        dmId,
        `dm-epoch:${epoch}`,
      );

      // AES-GCM
      const decryptedBytes = await decryptBytes(
        messageKey,
        encryptedCiphertext,
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
    },
    [],
  );

  return { encryptDM, decryptDM };
}
