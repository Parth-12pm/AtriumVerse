"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { fetchAPI } from "@/lib/api";
import { deriveSharedSecret, deriveKey, encryptBytes } from "@/lib/crypto";
import type { ChannelUpdate } from "@/types/api.types";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";

interface EditChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  currentName: string;
  currentType: "text" | "voice";
  serverId: string; // Needed to fetch members
  onUpdateChannel: (channelId: string, data: ChannelUpdate) => Promise<void>;
}

export default function EditChannelDialog({
  open,
  onOpenChange,
  channelId,
  currentName,
  currentType,
  serverId,
  onUpdateChannel,
}: EditChannelDialogProps) {
  const [name, setName] = useState(currentName);
  const [type, setType] = useState<"text" | "voice">(currentType);
  const [enableE2EE, setEnableE2EE] = useState(false);
  const [loading, setLoading] = useState(false);

  // Update name when dialog opens with different channel
  React.useEffect(() => {
    if (open) {
      setName(currentName);
      setType(currentType);
    }
  }, [open, currentName, currentType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onUpdateChannel(channelId, { name: name.trim(), type });

      // If owner toggled E2EE on, run the ceremony
      if (enableE2EE) {
        toast.info("Initializing End-to-End Encryption...");

        // 1. Fetch all trusted devices for all users in server
        const devicesRes = await fetchAPI(`/devices/server/${serverId}`);

        const { deviceId, privateKey: myPrivateKey } =
          await resolveTrustedLocalDevice();

        // 2. Generate the very first channel key (Epoch 1)
        const channelKeyBytes = window.crypto.getRandomValues(
          new Uint8Array(32),
        ); // AES-256 size

        // 3. Encrypt it for every device
        const encryptedKeys = [];
        for (const device of devicesRes) {
          const sharedSecret = await deriveSharedSecret(
            myPrivateKey,
            device.public_key,
          );

          const wrapKey = await deriveKey(
            sharedSecret,
            channelId,
            "channel-key",
          );

          const encryptedBlobBase64url = await encryptBytes(
            wrapKey,
            channelKeyBytes,
          );

          encryptedKeys.push({
            device_id: device.device_id,
            encrypted_channel_key: encryptedBlobBase64url,
          });
        }

        // 4. Submit to atomic API
        await fetchAPI(`/channel-keys/${channelId}/enable`, {
          method: "POST",
          body: JSON.stringify({
            submitting_device_id: deviceId,
            encrypted_keys: encryptedKeys,
          }),
        });

        toast.success("E2E Encryption enabled!");
      }

      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to update channel:", error);
      toast.error(`Error: ${error.message || "Failed to update"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-black text-2xl">
            Edit Channel
          </DialogTitle>
          <DialogDescription>
            Update the channel&apos;s name or type.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name" className="font-bold">
                Channel Name
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-type" className="font-bold">
                Channel Type
              </Label>
              <select
                id="edit-type"
                value={type}
                onChange={(e) => setType(e.target.value as "text" | "voice")}
                className="flex h-10 w-full rounded-md border-2 border-black px-3 py-2 text-sm"
              >
                <option value="text">Text</option>
                <option value="voice">Voice</option>
              </select>
            </div>
            {type === "text" && (
              <div className="flex items-center justify-between border-2 border-black p-3 rounded-md bg-muted/50 mt-2">
                <div className="space-y-0.5">
                  <Label className="font-bold text-base">
                    End-to-End Encryption
                  </Label>
                  <p className="text-xs text-muted-foreground w-4/5">
                    Encrypt all messages so only trusted devices can read them.
                    <strong className="text-destructive block mt-1">
                      Warning: Once enabled, E2EE cannot be disabled.
                    </strong>
                  </p>
                </div>
                <Switch
                  checked={enableE2EE}
                  onCheckedChange={setEnableE2EE}
                  disabled={loading} // Add 'isAlreadyEncrypted' check later
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="neutral"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-500 text-white hover:bg-blue-600"
              disabled={loading || !name.trim()}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
