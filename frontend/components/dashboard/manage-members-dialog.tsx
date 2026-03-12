"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Shield, UserPlus } from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { deriveSharedSecret, deriveKey, encryptBytes } from "@/lib/crypto";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";
import EventBus from "@/game/EventBus"; // Add this to your imports at the top

interface Member {
  user_id: string;
  username: string;
  role: string;
  status: "pending" | "accepted";
}

interface ManageMembersDialogProps {
  serverId: string;
}

export function ManageMembersDialog({ serverId }: ManageMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [rekeying, setRekeying] = useState(false);

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open]);

  useEffect(() => {
    const handlePublicJoin = async (data: Record<string, unknown>) => {
      // Ensure we only react to public joins for THIS specific server
      if (data.type === "public_member_joined" && data.server_id === serverId) {
        try {
          // This endpoint is protected: it will THROW a 403 error if the current
          // user is not the server owner. We use this as a silent check!
          const encryptedChannelIds = await getMyEncryptedChannelIds();

          if (encryptedChannelIds.length > 0) {
            toast.info(
              "New member joined publicly. Auto-rotating E2EE keys...",
            );
            await rotateEncryptedChannels(
              encryptedChannelIds,
              "Keys auto-rotated for the new public member.",
            );
            loadMembers(); // Refresh the dialog list in the background
          }
        } catch (error) {
          // If it throws an error (403), this user is just a regular member,
          // NOT the owner. We silently ignore the event so we don't cause a race condition.
          toast.error(error);
        }
      }
    };

    // Listen to all raw WS messages
    EventBus.on("ws:message", handlePublicJoin);
    return () => {
      EventBus.off("ws:message", handlePublicJoin);
    };
  }, [serverId]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAPI(`/servers/${serverId}/members`);
      if (Array.isArray(data)) {
        setMembers(data);
      }
    } catch (error) {
      console.error("Failed to load members", error);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const getMyEncryptedChannelIds = async () => {
    const currentUserId = localStorage.getItem("user_id");
    if (!currentUserId) {
      throw new Error("Missing current user id for channel rekey");
    }

    return fetchAPI(
      `/channel-keys/server/${serverId}/user/${currentUserId}/encrypted-channels`,
    ) as Promise<string[]>;
  };

  const rotateEncryptedChannels = async (
    channelIds: string[],
    successMessage: string,
  ) => {
    if (channelIds.length === 0) {
      return;
    }

    const devicesRes = await fetchAPI(`/devices/server/${serverId}`);
    const { deviceId, privateKey: myPrivateKey } =
      await resolveTrustedLocalDevice();

    // Guard: ensure our own device is in the list. GET /devices/server/{id} joins
    // on ServerMember and should include us, but if it ever doesn't (e.g. a race
    // between member approval and the query) we'd encrypt a new epoch we can't read.
    const myPublicKey = localStorage.getItem("device_public_key");
    if (
      myPublicKey &&
      !devicesRes.some((d: { device_id: string }) => d.device_id === deviceId)
    ) {
      console.warn(
        "[rotateEncryptedChannels] Own device missing from server device list — adding explicitly.",
      );
      devicesRes.push({ device_id: deviceId, public_key: myPublicKey });
    }

    for (const channelId of channelIds) {
      const newKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
      const encryptedKeys = [];

      for (const device of devicesRes) {
        const sharedSecret = await deriveSharedSecret(
          myPrivateKey,
          device.public_key,
        );
        const wrapKey = await deriveKey(sharedSecret, channelId, "channel-key");
        const encryptedBlob = await encryptBytes(wrapKey, newKeyBytes);
        encryptedKeys.push({
          device_id: device.device_id,
          encrypted_channel_key: encryptedBlob,
        });
      }

      await fetchAPI(`/channel-keys/${channelId}/rotate`, {
        method: "POST",
        body: JSON.stringify({
          submitting_device_id: deviceId,
          encrypted_keys: encryptedKeys,
        }),
      });
    }

    toast.success(successMessage);
  };

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    try {
      await fetchAPI(`/servers/${serverId}/members/${userId}/${action}`, {
        method: "POST",
      });
      toast.success(
        action === "approve" ? "Member Approved" : "Member Removed",
      );

      try {
        if (action === "approve") {
          toast.info("Rotating E2EE channel keys for the new member...");
          const encryptedChannelIds = await getMyEncryptedChannelIds();
          await rotateEncryptedChannels(
            encryptedChannelIds,
            "Channel keys rotated for the new member.",
          );
        }

        if (action === "reject") {
          toast.info("Rotating E2EE channel keys...");
          const affectedChannelIds: string[] = await fetchAPI(
            `/channel-keys/server/${serverId}/user/${userId}/encrypted-channels`,
          );
          await rotateEncryptedChannels(
            affectedChannelIds,
            "Channel keys successfully rotated.",
          );
        }
      } catch (rotErr) {
        console.error("Failed to rotate channel keys:", rotErr);
        toast.error(
          action === "approve"
            ? "Member approved, but channel rekey failed. The new member cannot read encrypted channels yet."
            : "Failed to rotate encryption keys. Channels may be insecure.",
        );
      }

      loadMembers();
    } catch (error) {
      toast.error(`Action failed because : ${error}`);
    }
  };

  const handleRekeyAllChannels = async () => {
    setRekeying(true);
    try {
      const encryptedChannelIds = await getMyEncryptedChannelIds();
      if (encryptedChannelIds.length === 0) {
        toast.info("No encrypted channels need rekeying in this server.");
        return;
      }

      toast.info("Rekeying encrypted channels for all current members...");
      await rotateEncryptedChannels(
        encryptedChannelIds,
        "Encrypted channels rekeyed for all current members.",
      );
    } catch (error) {
      console.error("Failed to rekey encrypted channels:", error);
      toast.error("Failed to rekey encrypted channels.");
    } finally {
      setRekeying(false);
    }
  };

  const pendingMembers = members.filter((m) => m.status === "pending");
  const acceptedMembers = members.filter((m) => m.status === "accepted");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="neutral"
          size="sm"
          className="font-bold relative"
          onClick={(e) => e.stopPropagation()}
        >
          <Shield className="mr-2 h-4 w-4" /> Manage
          {pendingMembers.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
              {pendingMembers.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Server Members</DialogTitle>
          <DialogDescription className="sr-only">
            Manage server members and pending join requests.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="neutral"
            size="sm"
            onClick={handleRekeyAllChannels}
            disabled={loading || rekeying}
          >
            {rekeying ? "Rekeying..." : "Rekey E2EE"}
          </Button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading...
            </div>
          ) : (
            <>
              {/* Pending Requests */}
              {pendingMembers.length > 0 && (
                <div>
                  <h3 className="text-sm font-black uppercase text-orange-600 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Pending Requests ({pendingMembers.length})
                  </h3>
                  <div className="space-y-2">
                    {pendingMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-2 border-2 border-orange-300 bg-orange-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">
                            {member.username}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="noShadow"
                            className="h-7 px-2 text-red-600 hover:bg-red-100"
                            onClick={() =>
                              handleAction(member.user_id, "reject")
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 px-2 bg-green-500 hover:bg-green-600"
                            onClick={() =>
                              handleAction(member.user_id, "approve")
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted Members */}
              {acceptedMembers.length > 0 && (
                <div>
                  <h3 className="text-sm font-black uppercase text-gray-600 mb-2">
                    Members ({acceptedMembers.length})
                  </h3>
                  <div className="space-y-1">
                    {acceptedMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">
                            {member.username}
                          </div>
                        </div>
                        <Badge
                          variant={
                            member.role === "owner" ? "default" : "neutral"
                          }
                          className="text-xs mr-2"
                        >
                          {member.role}
                        </Badge>
                        {member.role !== "owner" && (
                          <Button
                            size="sm"
                            variant="noShadow"
                            className="h-6 w-6 p-0 text-red-600 hover:bg-red-100"
                            onClick={() =>
                              handleAction(member.user_id, "reject")
                            }
                            title="Kick Member"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {members.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No members found.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
