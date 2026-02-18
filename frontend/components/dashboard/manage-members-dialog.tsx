"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Shield, UserPlus } from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open]);

  const loadMembers = async () => {
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
  };

  const handleAction = async (userId: string, action: "approve" | "reject") => {
    try {
      await fetchAPI(`/servers/${serverId}/members/${userId}/${action}`, {
        method: "POST",
      });
      toast.success(
        action === "approve" ? "Member Approved" : "Member Rejected",
      );
      loadMembers();
    } catch (error) {
      toast.error("Action failed");
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
        </DialogHeader>

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
                          className="text-xs"
                        >
                          {member.role}
                        </Badge>
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
