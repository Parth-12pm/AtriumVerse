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
import { rotateEncryptedChannels } from "@/lib/channelSync";

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

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, loadMembers]);

  const getMyEncryptedChannelIds = async () => {
    const currentUserId = localStorage.getItem("user_id");
    if (!currentUserId) {
      throw new Error("Missing current user id for channel rekey");
    }

    return fetchAPI(
      `/channel-keys/server/${serverId}/user/${currentUserId}/encrypted-channels`,
    ) as Promise<string[]>;
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
            serverId,
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
            serverId,
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
        serverId,
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
                        {member.status === "accepted" &&
                          member.role !== "owner" && (
                            <Button
                              className="bg-red-600 text-amber-50"
                              variant="default"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await fetchAPI(
                                    `/servers/${serverId}/members/${member.user_id}`,
                                    {
                                      method: "DELETE",
                                    },
                                  );

                                  toast.success("User kicked successfully");

                                  loadMembers(); // Refresh members list
                                  // WebSocket will trigger rotateEncryptedChannels automatically
                                } catch (error) {
                                  toast.error("Failed to kick user", error);
                                }
                              }}
                            >
                              <X className="w-4 h-4 mr-1" /> Kick
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
