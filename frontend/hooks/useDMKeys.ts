import { useCallback } from "react";
import { getPrivateKey } from "@/lib/keyStore";
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
      const myDeviceId = localStorage.getItem("device_id");
      if (!myDeviceId) throw new Error("No local device_id found");

      const myPrivateKey = await getPrivateKey(myDeviceId);
      if (!myPrivateKey) throw new Error("No private key found in IndexedDB");

      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);

      const deviceCiphertexts = [];

      for (const device of targetDevices) {
        try {
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
        } catch (error) {
          console.error(`Failed to encrypt for device ${device.id}`, error);
        }
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
      const myDeviceId = localStorage.getItem("device_id");
      if (!myDeviceId) throw new Error("No local device_id found");

      const myPrivateKey = await getPrivateKey(myDeviceId);
      if (!myPrivateKey) throw new Error("No private key found in IndexedDB");

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
