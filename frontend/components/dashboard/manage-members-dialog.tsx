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
import { Users, Check, X, Shield } from "lucide-react";
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
      // If not owner, this will fail (403). We can handle silently or show toast.
      // For now silent as component might be rendered for non-owners (though we try to avoid that)
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
      loadMembers(); // Refresh list
    } catch (error) {
      toast.error("Action failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="neutral"
          size="sm"
          className="font-bold"
          onClick={(e) => e.stopPropagation()}
        >
          <Shield className="mr-2 h-4 w-4" /> Manage Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : members.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No members found.
            </div>
          ) : (
            members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 border-2 border-border rounded-lg bg-card"
              >
                <div>
                  <div className="font-bold">{member.username}</div>
                  <div className="flex gap-2 text-xs mt-1">
                    <Badge
                      variant={member.role === "owner" ? "default" : "neutral"}
                    >
                      {member.role}
                    </Badge>
                    {member.status === "pending" && (
                      <Badge className="bg-red-500 hover:bg-red-600 border-2 border-black text-white">
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>

                {member.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="noShadow"
                      className="h-8 w-8 text-red-600 hover:bg-red-100"
                      onClick={() => handleAction(member.user_id, "reject")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="default"
                      className="h-8 w-8 bg-green-500 hover:bg-green-600"
                      onClick={() => handleAction(member.user_id, "approve")}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
