"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deriveSharedSecret,
  deriveKey,
  encryptBytes,
  decryptBytes,
  importPublicKey,
} from "@/lib/crypto";
import { getEncryptedBackup, getPrivateKey } from "@/lib/keyStore";
import { toast } from "sonner";
import { base64urlToBuffer, bufferToBase64url } from "@/lib/crypto";
import { PendingRequest } from "@/hooks/useDevice";
import { ShieldCheck, XCircle, Loader2 } from "lucide-react";

interface DeviceLinkModalProps {
  pendingRequest: PendingRequest;
  onSuccess: () => void;
  onReject: () => void;
  isOpen: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function DeviceLinkModal({
  pendingRequest,
  onSuccess,
  onReject,
  isOpen,
}: DeviceLinkModalProps) {
  const [loading, setLoading] = useState(false);

  // Serializer helper as per spec
  function serializeAssertion(credential: PublicKeyCredential) {
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      response: {
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        authenticatorData: bufferToBase64url(response.authenticatorData),
        signature: bufferToBase64url(response.signature),
        userHandle: response.userHandle
          ? bufferToBase64url(response.userHandle)
          : null,
      },
      type: credential.type,
    };
  }

  const handleApprove = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const deviceId = localStorage.getItem("device_id");
      if (!token || !deviceId) throw new Error("Not logged in");

      // 1. Fetch Challenge
      const chalRes = await fetch(
        `${API_URL}/device-linking/challenge?request_id=${pendingRequest.request_id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!chalRes.ok) throw new Error("Failed to get challenge");
      const { challenge } = await chalRes.json();
      const challengeBuffer = base64urlToBuffer(challenge);

      // 2. WebAuthn Assertion (userVerification: "required" enforces biometric)
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuffer,
          rpId:
            process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID || window.location.hostname,
          allowCredentials: [
            {
              id: base64urlToBuffer(pendingRequest.webauthn_credential_id),
              type: "public-key",
            },
          ],
          userVerification: "required",
        },
      })) as PublicKeyCredential;

      // 3. Crypto Handshake
      // Decrypt interim backup to get raw pkcs8 bytes into memory
      const wrapKeyString = localStorage.getItem("interim_wrap_key");
      const encryptedBackup = await getEncryptedBackup(deviceId);
      if (!wrapKeyString || !encryptedBackup)
        throw new Error("Missing local keys");

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
        ["decrypt"],
      );

      // We decrypt the local backup
      const combinedBuffer = base64urlToBuffer(encryptedBackup);
      const combined = new Uint8Array(combinedBuffer);
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      const rawPrivateBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesWrapKey,
        ciphertext, // Note: if the text encoder was used, this needs careful decoding.
        // But raw pkcs8 bytes are already buffers.
      );

      // Now we have the pkcs8 buffer in memory. Mix with new device's temp public key!
      // (Wait, `deriveSharedSecret` requires a CryptoKey for the private key parameter.
      // We must temporarily import it as extractable: false to do the ECDH).

      const tempMemKey = await window.crypto.subtle.importKey(
        "pkcs8",
        rawPrivateBuffer,
        { name: "X25519" },
        false,
        ["deriveKey", "deriveBits"],
      );

      const sharedSecret = await deriveSharedSecret(
        tempMemKey,
        pendingRequest.temp_public_key,
      );

      const linkWrapKey = await deriveKey(
        sharedSecret,
        pendingRequest.request_id,
        "device-link",
      );

      const theBlob = await encryptBytes(linkWrapKey, rawPrivateBuffer);

      // 4. Send Approval Payload
      const appRes = await fetch(
        `${API_URL}/device-linking/approve/${pendingRequest.request_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            webauthn_assertion: serializeAssertion(credential),
            encrypted_private_key: theBlob,
          }),
        },
      );

      if (!appRes.ok) throw new Error("Server rejected approval");

      // 5. P2P Channel Key Distribution
      // The new device is now trusted. We must distribute our historical channel keys to it.
      try {
        const token = localStorage.getItem("token");
        const chanRes = await fetch(`${API_URL}/channel-keys/my-channels`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (chanRes.ok) {
          const channels = await chanRes.json();
          const myPrivateKey = await getPrivateKey(deviceId!);

          if (myPrivateKey) {
            for (const chan of channels) {
              // Get all epochs we have access to
              const epRes = await fetch(
                `${API_URL}/channel-keys/${chan.channel_id}/entitled-epochs?device_id=${deviceId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              if (!epRes.ok) continue;
              const epochs = await epRes.json();

              for (const ep of epochs) {
                // 5a. Actively rebuild the reconstruction chain from the permanent private key
                const epSharedSecret = await deriveSharedSecret(
                  myPrivateKey,
                  ep.owner_device_public_key,
                );
                const epWrapKey = await deriveKey(
                  epSharedSecret,
                  chan.channel_id,
                  "channel-key",
                );
                const rawChannelKeyBytes = await decryptBytes(
                  epWrapKey,
                  ep.encrypted_channel_key,
                );

                // 5b. Re-encrypt for the NEW device (using the shared secret we already built for the link ceremony)
                const newWrapKey = await deriveKey(
                  sharedSecret,
                  chan.channel_id,
                  "channel-key",
                );
                const blobForNewDevice = await encryptBytes(
                  newWrapKey,
                  rawChannelKeyBytes,
                );

                // 5c. Submit to backend
                await fetch(
                  `${API_URL}/channel-keys/${chan.channel_id}/distribute-to-device?device_id=${deviceId}`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      target_device_id: pendingRequest.new_device_id,
                      epoch: ep.epoch,
                      encrypted_channel_key: blobForNewDevice,
                    }),
                  },
                );
              }
            }
          }
        }
      } catch (syncErr) {
        console.error(
          "Non-fatal: Failed to sync some channel keys to new device",
          syncErr,
        );
      }

      toast.success("Device linked successfully");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(
        `${API_URL}/device-linking/reject/${pendingRequest.request_id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast("Request discarded.");
      onReject();
    } catch (err) {
      console.error(err);
      onReject();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReject()}>
      <DialogContent className="border-4 border-border shadow-shadow sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase">
            New Device Link
          </DialogTitle>
          <DialogDescription className="font-medium mt-2">
            A new device is trying to access your AtriumVerse account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 px-4 bg-muted/50 border-y-4 border-border -mx-6 flex flex-col items-center justify-center space-y-4">
          <ShieldCheck className="w-16 h-16 text-primary" />
          <div className="text-center">
            <h3 className="text-xl font-bold font-mono">
              {pendingRequest.new_device_label}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Requires biometric approval
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-3 mt-4">
          <Button
            onClick={handleApprove}
            disabled={loading}
            className="w-full text-base font-bold py-6 border-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              "Yes, Approve Device"
            )}
          </Button>
          <Button
            onClick={handleReject}
            variant="reverse"
            disabled={loading}
            className="w-full text-base font-bold border-2"
          >
            <XCircle className="w-5 h-5 mr-2" /> No, I did not request this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
