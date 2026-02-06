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
import type { ChannelUpdate } from "@/types/api.types";

interface EditChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  currentName: string;
  currentType: "text" | "voice";
  onUpdateChannel: (channelId: string, data: ChannelUpdate) => Promise<void>;
}

export default function EditChannelDialog({
  open,
  onOpenChange,
  channelId,
  currentName,
  currentType,
  onUpdateChannel,
}: EditChannelDialogProps) {
  const [name, setName] = useState(currentName);
  const [type, setType] = useState<"text" | "voice">(currentType);
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
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update channel:", error);
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
            Update the channel's name or type.
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
