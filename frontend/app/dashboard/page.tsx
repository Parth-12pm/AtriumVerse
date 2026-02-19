"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { CreateServerDialog } from "@/components/dashboard/create-server-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import {
  Lock,
  Globe,
  Users,
  ChevronDown,
  ChevronRight,
  Search,
  LogIn,
  UserPlus,
  Check,
  X,
  Save,
  Pencil,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ServerData {
  id: string;
  name: string;
  created_at: string;
  owner_id?: string;
  owner_username?: string;
  access_type?: "public" | "private";
  member_count?: number;
}

interface Member {
  user_id: string;
  username: string;
  role: string;
  status: "pending" | "accepted";
}

type ActiveTab = "all" | "yours";

export default function DashboardPage() {
  const router = useRouter();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingJoins, setPendingJoins] = useState<Set<string>>(new Set());
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});
  const [serverMembers, setServerMembers] = useState<Record<string, Member[]>>(
    {},
  );

  const loadServers = useCallback(async () => {
    try {
      const data = await fetchAPI("/servers/");
      if (Array.isArray(data)) setServers(data);
    } catch {
      toast.error("Failed to load servers");
    }
  }, []);

  useEffect(() => {
    setUserId(localStorage.getItem("user_id") || "");
    loadServers();
  }, [loadServers]);

  const loadMembers = async (serverId: string) => {
    try {
      const data: Member[] = await fetchAPI(`/servers/${serverId}/members`);
      if (Array.isArray(data)) {
        setServerMembers((prev) => ({ ...prev, [serverId]: data }));
      }
    } catch {
      /* silently ignore */
    }
  };

  const handleExpand = (serverId: string, serverName: string) => {
    if (expandedServerId === serverId) {
      setExpandedServerId(null);
    } else {
      setExpandedServerId(serverId);
      if (!renameValues[serverId]) {
        setRenameValues((prev) => ({ ...prev, [serverId]: serverName }));
      }
      loadMembers(serverId);
    }
  };

  const handleJoin = async (server: ServerData) => {
    if (pendingJoins.has(server.id)) return;
    setPendingJoins((prev) => new Set(prev).add(server.id));
    try {
      const res = await fetchAPI(`/servers/${server.id}/join`, {
        method: "POST",
      });
      if (res.status === "pending" || res.message === "Request sent to owner") {
        toast.info("Join request sent! Waiting for owner approval.");
        return;
      }
      trackRecentServer(server.id, server.name);
      router.push(`/server/${server.id}`);
    } catch {
      toast.error("Failed to join server");
    } finally {
      setPendingJoins((prev) => {
        const next = new Set(prev);
        next.delete(server.id);
        return next;
      });
    }
  };

  const handleMemberAction = async (
    serverId: string,
    memberId: string,
    action: "approve" | "reject",
  ) => {
    try {
      await fetchAPI(`/servers/${serverId}/members/${memberId}/${action}`, {
        method: "POST",
      });
      toast.success(
        action === "approve" ? "Member approved ✓" : "Request rejected",
      );
      loadMembers(serverId);
    } catch {
      toast.error("Action failed");
    }
  };

  const handleRename = async (serverId: string) => {
    const newName = renameValues[serverId]?.trim();
    if (!newName) return;
    try {
      await fetchAPI(`/servers/${serverId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: newName }),
      });
      toast.success("Server renamed");
      loadServers();
    } catch {
      toast.error("Rename failed");
    }
  };

  const trackRecentServer = (id: string, name: string) => {
    try {
      const stored = localStorage.getItem("recentServers");
      let recent: { id: string; name: string; lastVisited: number }[] = stored
        ? JSON.parse(stored)
        : [];
      recent = [
        { id, name, lastVisited: Date.now() },
        ...recent.filter((s) => s.id !== id),
      ];
      localStorage.setItem(
        "recentServers",
        JSON.stringify(recent.slice(0, 10)),
      );
    } catch {
      /* ignore */
    }
  };

  // Derived lists
  const allServers = servers.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.owner_username ?? "").toLowerCase().includes(q)
    );
  });
  const ownedServers = servers.filter((s) => s.owner_id === userId);
  const joinedServers = servers.filter((s) => s.owner_id !== userId);

  return (
    <div className="w-full px-6 py-8 space-y-8">
      {/* ── SLIDING TABS ── */}
      <div className="flex items-center gap-0 border-b-4 border-border">
        {(["all", "yours"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-6 py-2.5 font-black uppercase text-sm tracking-wide transition-colors
              ${
                activeTab === tab
                  ? "text-foreground after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-[4px] after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {tab === "all" ? "All Servers" : "Your Servers"}
          </button>
        ))}
        <div className="ml-auto pb-1">
          <CreateServerDialog />
        </div>
      </div>

      {/* ════════════════════ ALL SERVERS ════════════════════ */}
      {activeTab === "all" && (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by server name or owner…"
              className="pl-9 border-2 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {allServers.length === 0 ? (
            <EmptyState
              message={
                searchQuery
                  ? "No servers match your search."
                  : "No public servers found."
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {allServers.map((server) => (
                <ServerCard
                  key={server.id}
                  server={server}
                  isOwner={server.owner_id === userId}
                  isPending={pendingJoins.has(server.id)}
                  onJoin={() => handleJoin(server)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ YOUR SERVERS ════════════════════ */}
      {activeTab === "yours" && (
        <div className="space-y-10">
          {/* ── Joined ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <LogIn className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Joined Servers
              </h2>
            </div>

            {joinedServers.length === 0 ? (
              <EmptyState message="You haven't joined any servers yet. Explore All Servers!" />
            ) : (
              <div className="space-y-2">
                {joinedServers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center gap-4 px-5 py-3.5 border-2 border-border rounded-lg bg-card"
                  >
                    <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 font-bold truncate text-sm">
                      {server.name}
                    </span>
                    {server.owner_username && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        by {server.owner_username}
                      </span>
                    )}
                    {server.access_type === "private" ? (
                      <Badge
                        variant="neutral"
                        className="text-[10px] font-bold gap-1 px-2"
                      >
                        <Lock className="w-2.5 h-2.5" /> Private
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] font-bold gap-1 px-2 bg-emerald-500 text-white border-0">
                        <Globe className="w-2.5 h-2.5" /> Public
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      className="font-bold gap-1.5 shrink-0"
                      onClick={() => {
                        trackRecentServer(server.id, server.name);
                        router.push(`/server/${server.id}`);
                      }}
                    >
                      <LogIn className="w-3.5 h-3.5" /> Enter
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Owned ── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <Pencil className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Servers You Own
              </h2>
            </div>

            {ownedServers.length === 0 ? (
              <EmptyState message="You haven't created any servers yet." />
            ) : (
              <div className="space-y-2">
                {ownedServers.map((server) => {
                  const isExpanded = expandedServerId === server.id;
                  const members = serverMembers[server.id] ?? [];
                  const pending = members.filter((m) => m.status === "pending");
                  const accepted = members.filter(
                    (m) => m.status === "accepted",
                  );

                  return (
                    <Collapsible
                      key={server.id}
                      open={isExpanded}
                      onOpenChange={() => handleExpand(server.id, server.name)}
                    >
                      {/* ── Row header ── */}
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-4 px-5 py-3.5 border-2 border-border rounded-lg bg-card cursor-pointer hover:bg-muted/60 transition-colors select-none group">
                          <Server className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="flex-1 font-bold truncate text-sm">
                            {server.name}
                          </span>

                          <div className="flex items-center gap-2">
                            {server.access_type === "private" ? (
                              <Badge
                                variant="neutral"
                                className="text-[10px] font-bold gap-1 px-2"
                              >
                                <Lock className="w-2.5 h-2.5" /> Private
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] font-bold gap-1 px-2 bg-emerald-500 text-white border-0">
                                <Globe className="w-2.5 h-2.5" /> Public
                              </Badge>
                            )}
                            {pending.length > 0 && (
                              <Badge className="bg-orange-500 text-white border-0 text-[10px] px-2">
                                {pending.length} pending
                              </Badge>
                            )}
                          </div>

                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </CollapsibleTrigger>

                      {/* ── Expanded panel ── */}
                      <CollapsibleContent>
                        <div className="border-2 border-t-0 border-border rounded-b-lg overflow-hidden">
                          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 md:divide-x-2 divide-border">
                            {/* LEFT — Server settings */}
                            <div className="p-6 space-y-6 bg-card flex flex-col">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                                  Server Settings
                                </p>

                                {/* Rename */}
                                <div className="space-y-2">
                                  <label className="text-sm font-bold">
                                    Server Name
                                  </label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={
                                        renameValues[server.id] ?? server.name
                                      }
                                      onChange={(e) =>
                                        setRenameValues((prev) => ({
                                          ...prev,
                                          [server.id]: e.target.value,
                                        }))
                                      }
                                      className="border-2 text-sm"
                                    />
                                  </div>
                                </div>
                              </div>

                              <Separator />

                              <div className="mt-auto gap-4 flex flex-col">
                                <Button
                                  variant="neutral"
                                  className="w-full border-2 px-3 shrink-0"
                                  onClick={() => handleRename(server.id)}
                                >
                                  <Save className="w-4 h-4" /> Save Changes
                                </Button>
                                <Button
                                  className="w-full font-bold gap-2"
                                  onClick={() => {
                                    trackRecentServer(server.id, server.name);
                                    router.push(`/server/${server.id}`);
                                  }}
                                >
                                  <LogIn className="w-4 h-4" /> Enter Server
                                </Button>
                              </div>
                            </div>

                            {/* RIGHT — Members & requests */}
                            <div className="p-6 space-y-5 bg-muted/30">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5" /> Members
                                </p>
                                {pending.length > 0 && (
                                  <span className="text-xs font-bold text-orange-500">
                                    {pending.length} awaiting approval
                                  </span>
                                )}
                              </div>

                              {/* Pending requests */}
                              {pending.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase text-orange-500 tracking-wide">
                                    Pending
                                  </p>
                                  {pending.map((m) => (
                                    <div
                                      key={m.user_id}
                                      className="flex items-center gap-3 px-3 py-2.5 border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20 rounded-lg"
                                    >
                                      <div className="w-7 h-7 rounded-full bg-orange-200 dark:bg-orange-900 flex items-center justify-center text-xs font-black flex-shrink-0">
                                        {m.username.slice(0, 1).toUpperCase()}
                                      </div>
                                      <span className="flex-1 text-sm font-semibold truncate">
                                        {m.username}
                                      </span>
                                      <div className="flex gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="neutral"
                                          className="h-7 w-7 p-0 border-2 text-red-500 hover:border-red-400"
                                          onClick={() =>
                                            handleMemberAction(
                                              server.id,
                                              m.user_id,
                                              "reject",
                                            )
                                          }
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-7 w-7 p-0 bg-emerald-500 hover:bg-emerald-600 border-0"
                                          onClick={() =>
                                            handleMemberAction(
                                              server.id,
                                              m.user_id,
                                              "approve",
                                            )
                                          }
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Accepted members */}
                              {accepted.length > 0 && (
                                <div className="space-y-1.5">
                                  {pending.length > 0 && <Separator />}
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide mb-2">
                                    Active ({accepted.length})
                                  </p>
                                  {accepted.map((m) => (
                                    <div
                                      key={m.user_id}
                                      className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
                                    >
                                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-black flex-shrink-0">
                                        {m.username.slice(0, 1).toUpperCase()}
                                      </div>
                                      <span className="flex-1 text-sm truncate">
                                        {m.username}
                                      </span>
                                      <Badge
                                        variant={
                                          m.role === "OWNER"
                                            ? "default"
                                            : "neutral"
                                        }
                                        className="text-[10px] capitalize border-0 font-bold px-2 py-0.5"
                                      >
                                        {m.role === "OWNER" ? (
                                          <>
                                            <Pencil className="w-2.5 h-2.5 mr-1" />{" "}
                                            Owner
                                          </>
                                        ) : (
                                          "Member"
                                        )}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {members.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-6">
                                  No members yet.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ── Reusable sub-components ────────────────────────────────────────────────

function ServerCard({
  server,
  isOwner,
  isPending,
  onJoin,
}: {
  server: ServerData;
  isOwner: boolean;
  isPending: boolean;
  onJoin: () => void;
}) {
  return (
    <Card className="border-2 border-border hover:shadow-shadow hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all overflow-hidden">
      {/* Gradient header */}
      <div className="h-28 bg-gradient-to-br from-primary/25 to-accent/25 border-b-2 border-border flex items-center justify-center relative">
        {server.access_type === "private" ? (
          <Lock className="w-9 h-9 text-primary/30" />
        ) : (
          <Globe className="w-9 h-9 text-primary/30" />
        )}
        {/* Badges */}
        <div className="absolute top-2.5 right-2.5 flex gap-1.5">
          {isOwner && (
            <Badge className="text-[10px] font-bold bg-primary text-primary-foreground border-0 px-2">
              Owner
            </Badge>
          )}
          {server.access_type === "private" ? (
            <Badge variant="neutral" className="text-[10px] font-bold px-2">
              Private
            </Badge>
          ) : (
            <Badge className="text-[10px] font-bold bg-emerald-500 text-white border-0 px-2">
              Public
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-5 space-y-4">
        <div className="space-y-0.5">
          <h3 className="font-black uppercase truncate leading-tight">
            {server.name}
          </h3>
          {server.owner_username && (
            <p className="text-xs text-muted-foreground">
              by {server.owner_username}
            </p>
          )}
        </div>

        <Button
          className="w-full font-bold gap-2"
          variant={isPending ? "neutral" : "default"}
          disabled={isPending}
          onClick={onJoin}
        >
          {isPending ? (
            "Sending request…"
          ) : server.access_type === "private" ? (
            <>
              <UserPlus className="w-4 h-4" /> Request Access
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" /> Enter Server
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
      <p className="text-sm font-bold text-muted-foreground">{message}</p>
    </div>
  );
}
