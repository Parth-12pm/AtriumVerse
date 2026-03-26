"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Hash,
  Plus,
  Settings,
  Megaphone,
  Volume2,
  Lock,
  Users,
  MessageSquare,
  UserPlus,
  Search,
  ArrowLeft,
} from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { toast } from "sonner";
import { MessageFeed } from "@/components/game/MessageFeed";
import { cn } from "@/lib/utils";
import EventBus, { GameEvents } from "@/game/EventBus";
import {
  distributeKeysToNewMember,
  rotateEncryptedChannels,
} from "@/lib/channelSync";
import { getVoiceChannelAudio, getProximityAudio } from "@/lib/livekit-audio";

interface Channel {
  id: string;
  name: string;
  type: "text" | "announcements" | "voice";
  is_public: boolean;
}

interface User {
  id: string;
  username: string;
  status: "online" | "away" | "busy";
}

interface ChannelSidebarProps {
  serverId: string;
  serverName: string;
  users?: User[];
  onInvite?: () => void;
  isOwner?: boolean;
}

export function ChannelSidebar({
  serverId,
  serverName,
  users = [],
  onInvite,
  isOwner = false,
}: ChannelSidebarProps) {
  const [activeTab, setActiveTab] = useState<"channels" | "people">("channels");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateVoiceChannel, setShowCreateVoiceChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newVoiceChannelName, setNewVoiceChannelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected channel for chat view
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );

  const { state } = useSidebar();
  const [localUsername, setLocalUsername] = useState<string | null>(null);

  // Active voice channel tracking
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, {user_id: string, username: string}[]>>({});

  // --- VOICE PRESENCE TRACKING ---
  useEffect(() => {
    const handleVoicePresence = (data: Record<string, any>) => {
      setVoiceParticipants((prev) => {
        const next = { ...prev };
        
        switch (data.type) {
          case "voice_state":
            // Full state initialization
            return data.channels || {};
            
          case "voice_join":
            // Remove from any previous channel just in case
            Object.keys(next).forEach(cid => {
              if (next[cid]) {
                next[cid] = next[cid].filter(p => p.user_id !== data.user_id);
              }
            });
            // Add to new channel
            if (!next[data.channel_id]) next[data.channel_id] = [];
            next[data.channel_id].push({
              user_id: data.user_id,
              username: data.username || "Player"
            });
            return next;
            
          case "voice_leave":
            if (next[data.channel_id]) {
              next[data.channel_id] = next[data.channel_id].filter(p => p.user_id !== data.user_id);
            }
            return next;
            
          case "user_left":
          case "member_left":
            // Clear their presence anywhere
            Object.keys(next).forEach(cid => {
              if (next[cid]) {
                next[cid] = next[cid].filter(p => p.user_id !== data.user_id);
              }
            });
            return next;
            
          default:
            return prev;
        }
      });
    };

    EventBus.on("ws:message", handleVoicePresence);
    return () => {
      EventBus.off("ws:message", handleVoicePresence);
    };
  }, []);

  useEffect(() => {
    const handleVoiceJoined = (data: { channelId: string }) => {
      setActiveVoiceChannelId(data.channelId);
    };
    const handleVoiceLeft = () => {
      setActiveVoiceChannelId(null);
    };
    
    // Initialize state
    if (getVoiceChannelAudio().isConnected()) {
      setActiveVoiceChannelId(getVoiceChannelAudio().currentChannelId);
    }

    EventBus.on(GameEvents.VOICE_CHANNEL_CONNECTED, handleVoiceJoined);
    EventBus.on(GameEvents.VOICE_CHANNEL_DISCONNECTED, handleVoiceLeft);

    return () => {
      EventBus.off(GameEvents.VOICE_CHANNEL_CONNECTED, handleVoiceJoined);
      EventBus.off(GameEvents.VOICE_CHANNEL_DISCONNECTED, handleVoiceLeft);
    };
  }, []);

  const handleJoinVoice = async (channelId: string) => {
    if (activeVoiceChannelId === channelId) return;
    
    // Remember what the user's mic state was before joining
    const wasMicEnabled = getProximityAudio().isMicEnabled();

    // Priority: mute proximity audio to prevent echoing/dual-casting
    await getProximityAudio().setMicEnabled(false);
    
    // Connect to the actual voice room
    const voiceAudio = getVoiceChannelAudio();
    await voiceAudio.connect(channelId);
    
    // Inherit the previous mic state so we don't hot-mic the user
    await voiceAudio.setMicEnabled(wasMicEnabled);
    
    // Ensure the dock UI accurately reflects the active mic state
    EventBus.emit("action:toggle_mic", wasMicEnabled); 
  };

  const handleLeaveVoice = async () => {
    await getVoiceChannelAudio().disconnect();
    // Restore UI dock state to match proximity audio's underlying state
    EventBus.emit("action:toggle_mic", getProximityAudio().isMicEnabled());
  };

  // --- BACKGROUND E2EE WORKER ---
  useEffect(() => {
    if (!isOwner) return; // Only the owner does the background math

    const handleMembershipChange = async (data: Record<string, unknown>) => {
      if (data.server_id !== serverId) return;

      try {
        const channels = await fetchAPI(`/channels/server/${serverId}`);
        const encryptedChannelIds = channels
          .filter((c: any) => c.is_encrypted)
          .map((c: any) => c.id);
        if (encryptedChannelIds.length === 0) return;

        if (
          data.type === "public_member_joined" ||
          data.type === "member_approved"
        ) {
          toast.info("New member joined. Syncing E2EE keys in background...");
          await distributeKeysToNewMember(
            encryptedChannelIds,
            data.user_id as string,
          );
          toast.success("Keys successfully synced to the new member!");
        }

        if (data.type === "member_left") {
          toast.info(
            "Member left. Auto-rotating E2EE keys to secure channels...",
          );
          await rotateEncryptedChannels(
            encryptedChannelIds,
            serverId,
            "Auto-rotated due to member departure",
          );
          toast.success("E2EE channels secured with new keys!");
        }
      } catch (err) {
        console.debug("Background key sync ignored or failed", err);
      }
    };

    EventBus.on("ws:message", handleMembershipChange);
    return () => {
      EventBus.off("ws:message", handleMembershipChange);
    };
  }, [serverId, isOwner]);

  const repairKeys = useCallback(async () => {
    if (repairLoading) return;
    setRepairLoading(true);
    try {
      const missing = await fetchAPI(
        `/channel-keys/server/${serverId}/members-missing-keys`,
      );
      if (!missing || missing.length === 0) {
        toast.success("All members already have keys — nothing to repair!");
        return;
      }
      // Collect unique user_ids that are missing keys in any channel
      const allChannelIds = [...new Set(missing.map((m: any) => m.channel_id))] as string[];
      // Fetch all server members so we can map devices back to users
      const members = await fetchAPI(`/servers/${serverId}/members`);
      const acceptedMemberUserIds: string[] = members
        .filter((m: any) => m.status === "accepted")
        .map((m: any) => String(m.user_id));

      toast.info(`Repairing keys for ${acceptedMemberUserIds.length} members across ${allChannelIds.length} channel(s)...`);
      let repaired = 0;
      for (const uid of acceptedMemberUserIds) {
        try {
          await distributeKeysToNewMember(allChannelIds, uid);
          repaired++;
        } catch (e) {
          console.debug(`Repair failed for user ${uid}:`, e);
        }
      }
      toast.success(`Key repair complete — synced ${repaired} member(s)!`);
    } catch (err) {
      toast.error("Failed to repair keys. See console for details.");
      console.error(err);
    } finally {
      setRepairLoading(false);
    }
  }, [serverId, repairLoading]);

  const loadChannels = useCallback(async () => {
    try {
      const data = await fetchAPI(`/channels/${serverId}/channels`);
      setChannels(data);
    } catch (error) {
      console.error("Failed to load channels:", error);
    }
  }, [serverId]);

  useEffect(() => {
    loadChannels();
    if (typeof window !== "undefined") {
      setLocalUsername(localStorage.getItem("username"));
    }
  }, [serverId, loadChannels]);

  const createChannel = async (type: "text" | "voice") => {
    const rawName = type === "text" ? newChannelName : newVoiceChannelName;
    if (!rawName.trim()) return;

    setLoading(true);
    try {
      const channel = await fetchAPI(`/channels/${serverId}/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: rawName.trim(),
          type: type,
          position: channels.length,
        }),
      });

      setChannels([...channels, channel]);
      if (type === "text") {
        setNewChannelName("");
        setShowCreateChannel(false);
      } else {
        setNewVoiceChannelName("");
        setShowCreateVoiceChannel(false);
      }
      toast.success(`${type === "voice" ? "Voice" : "Text"} Channel #${channel.name} created!`);
    } catch (error) {
      toast.error(`Failed to create channel : ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "announcements":
        return <Megaphone className="h-4 w-4" />;
      case "voice":
        return <Volume2 className="h-4 w-4" />;
      default:
        return <Hash className="h-4 w-4" />;
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <Sidebar collapsible="icon" className="border-r-8 border-border">
      {/* Header */}
      <SidebarHeader className="bg-primary/10 border-b-4 border-border p-4 h-16 justify-center">
        <div className="flex items-center justify-between w-full overflow-hidden">
          {state !== "collapsed" && (
            <span className="font-black uppercase text-sm truncate">
              {serverName}
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Tabs - Only show when expanded */}
      {state !== "collapsed" && (
        <div className="grid grid-cols-2 p-2 gap-2 border-b-4 border-border bg-card">
          <Button
            variant={activeTab === "channels" ? "default" : "neutral"}
            size="sm"
            onClick={() => setActiveTab("channels")}
            className="font-bold"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
          <Button
            variant={activeTab === "people" ? "default" : "neutral"}
            size="sm"
            onClick={() => setActiveTab("people")}
            className="font-bold"
          >
            <Users className="h-4 w-4 mr-2" />
            People
          </Button>
        </div>
      )}

      {/* Content */}
      <SidebarContent className="bg-card">
        {state === "collapsed" ? (
          // Collapsed View - Just icons
          <div className="flex flex-col items-center py-8 gap-6">
            <Button
              variant="noShadow"
              size="icon"
              onClick={() => {}} // Could trigger expand
            >
              <MessageSquare className="h-2 w-2" />
            </Button>
            <Button variant="noShadow" size="icon" onClick={() => {}}>
              <Users className="h-2 w-2" />
            </Button>
          </div>
        ) : (
          // Expanded View
          <>
            {activeTab === "people" ? (
              <>
                <div className="p-4 border-b-4 border-border bg-primary/5">
                  <Button
                    onClick={onInvite}
                    className="w-full font-bold"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4 mr-2" /> Invite Friends
                  </Button>
                </div>

                <div className="p-4 border-b-4 border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search people..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 border-2 h-9 text-sm"
                    />
                  </div>
                </div>

                <div className="flex-1 p-4">
                  <p className="text-xs font-bold uppercase text-muted-foreground mb-3">
                    Online ({filteredUsers.length})
                  </p>
                  <div className="space-y-2">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8 border-2 border-border">
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                              {user.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
                              user.status === "online"
                                ? "bg-green-500"
                                : user.status === "away"
                                  ? "bg-yellow-500"
                                  : "bg-red-500",
                            )}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {user.username}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {user.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              // Chat/Channels Tab
              <div className="flex flex-col h-full">
                {selectedChannelId ? (
                  // Active Channel View
                  <div className="flex flex-col h-full">
                    <div className="p-2 border-b-4 border-border flex items-center shrink-0">
                      <Button
                        variant="neutral"
                        size="icon"
                        className="h-8 w-8 mr-2"
                        onClick={() => setSelectedChannelId(null)}
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-bold truncate">
                        #{selectedChannel?.name}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 bg-background/50">
                      <MessageFeed
                        channelId={selectedChannelId}
                        channelName={selectedChannel?.name || "unknown"}
                      />
                    </div>
                  </div>
                ) : (
                  // Channel List View
                  <div className="flex-1 p-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between px-2 py-1 mb-1">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Text Channels
                        </span>
                        {isOwner && (
                          <Button
                            variant="noShadow"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() =>
                              setShowCreateChannel(!showCreateChannel)
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {showCreateChannel && (
                        <div className="mb-2 px-2">
                          <div className="flex gap-1">
                            <Input
                              placeholder="channel-name"
                              value={newChannelName}
                              onChange={(e) =>
                                setNewChannelName(e.target.value)
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && createChannel("text")
                              }
                              className="h-7 text-xs"
                              disabled={loading}
                            />
                            <Button
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => createChannel("text")}
                              disabled={loading}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {channels.filter(c => c.type === "text" || c.type === "announcements").map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => setSelectedChannelId(channel.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 border-transparent hover:border-border hover:bg-primary/10 transition-all text-sm font-bold"
                        >
                          {getChannelIcon(channel.type)}
                          <span className="truncate">{channel.name}</span>
                          {!channel.is_public && (
                            <Lock className="h-3 w-3 ml-auto shrink-0" />
                          )}
                        </button>
                      ))}

                      <div className="flex items-center justify-between px-2 py-1 mt-4 mb-1 border-t-2 border-border/40 pt-4">
                        <span className="text-xs font-bold uppercase text-muted-foreground">
                          Voice Channels
                        </span>
                        {isOwner && (
                          <Button
                            variant="noShadow"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() =>
                              setShowCreateVoiceChannel(!showCreateVoiceChannel)
                            }
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {showCreateVoiceChannel && (
                        <div className="mb-2 px-2">
                          <div className="flex gap-1">
                            <Input
                              placeholder="voice-channel"
                              value={newVoiceChannelName}
                              onChange={(e) =>
                                setNewVoiceChannelName(e.target.value)
                              }
                              onKeyDown={(e) =>
                                e.key === "Enter" && createChannel("voice")
                              }
                              className="h-7 text-xs"
                              disabled={loading}
                            />
                            <Button
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => createChannel("voice")}
                              disabled={loading}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {channels.filter(c => c.type === "voice").map((channel) => {
                        const isActive = activeVoiceChannelId === channel.id;
                        return (
                          <div key={channel.id} className="flex flex-col gap-1 mb-2">
                            <button
                              onClick={() => isActive ? handleLeaveVoice() : handleJoinVoice(channel.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 transition-all text-sm font-bold",
                                isActive 
                                  ? "border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500" 
                                  : "border-transparent hover:border-border hover:bg-primary/10"
                              )}
                            >
                              {getChannelIcon(channel.type)}
                              <span className="truncate flex-1 text-left">{channel.name}</span>
                              
                              {isActive && (
                                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-green-500/20">
                                  Connected
                                </span>
                              )}
                              {!channel.is_public && (
                                <Lock className="h-3 w-3 ml-1 shrink-0 opacity-50" />
                              )}
                            </button>
                            
                            {/* Connected voice participants */}
                            {voiceParticipants[channel.id]?.length > 0 && (
                              <div className="flex flex-col gap-1 ml-4 mt-1 border-l-2 border-border/50 pl-2">
                                {voiceParticipants[channel.id].map(p => (
                                  <div key={p.user_id} className="flex items-center gap-2 rounded-md hover:bg-muted/50 p-1 cursor-default">
                                    <Avatar className="h-6 w-6 border-2 border-border shadow-sm">
                                      <AvatarFallback className="bg-orange-400 text-black text-[10px] font-bold">
                                        {p.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-bold truncate max-w-[120px]">{p.username}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t-4 border-border bg-card p-4">
        {state === "collapsed" ? (
          <div className="flex justify-center">
            <Avatar className="h-8 w-8 border-2 border-border">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                {localUsername?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8 border-2 border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs">
                  {localUsername?.slice(0, 2).toUpperCase() || "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">
                  {localUsername || "Guest"}
                </p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
            <Button variant="neutral" size="icon" className="h-8 w-8 shrink-0">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
