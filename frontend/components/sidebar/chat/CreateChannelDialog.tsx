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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChannelCreate } from "@/types/api.types";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChannel: (data: ChannelCreate) => Promise<void>;
}

export default function CreateChannelDialog({
  open,
  onOpenChange,
  onCreateChannel,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice">("text");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onCreateChannel({ name: name.trim(), type });
      setName("");
      setType("text");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create channel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-black text-2xl">
            Create Channel
          </DialogTitle>
          <DialogDescription>
            Add a new channel to your server. Channels are where conversations
            happen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="font-bold">
                Channel Name
              </Label>
              <Input
                id="name"
                placeholder="general"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type" className="font-bold">
                Channel Type
              </Label>
              <Select
                value={type}
                onValueChange={(v: "text" | "voice") => setType(v)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                </SelectContent>
              </Select>
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
              variant="default"
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
