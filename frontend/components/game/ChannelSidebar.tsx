"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Hash,
  Plus,
  Settings,
  ChevronDown,
  Megaphone,
  Volume2,
  Lock,
  Users,
  MessageSquare,
  ChevronLeft,
  UserPlus,
  Search,
  ArrowLeft,
} from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { toast } from "sonner";
import { MessageFeed } from "@/components/game/messagefeed";
import { cn } from "@/lib/utils";

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
  const [newChannelName, setNewChannelName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected channel for chat view
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadChannels();
  }, [serverId]);

  const loadChannels = async () => {
    try {
      const data = await fetchAPI(`/servers/${serverId}/channels`);
      setChannels(data);
      // Auto-select first channel if none selected?
      // Actually, let's keep list view by default for navigation
    } catch (error) {
      console.error("Failed to load channels:", error);
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;

    setLoading(true);
    try {
      const channel = await fetchAPI(`/servers/${serverId}/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: newChannelName.trim(),
          type: "text",
          position: channels.length,
        }),
      });

      setChannels([...channels, channel]);
      setNewChannelName("");
      setShowCreateChannel(false);
      toast.success(`Channel #${channel.name} created!`);
    } catch (error) {
      toast.error("Failed to create channel");
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
    <div className="w-72 h-full bg-card border-r-4 border-border flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b-4 border-border bg-primary/10 flex items-center justify-between">
        <span className="font-black uppercase text-sm truncate">
          {serverName}
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 p-2 gap-2 border-b-4 border-border">
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

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "people" ? (
          <>
            {/* Invite Section */}
            <div className="p-4 border-b-4 border-border bg-primary/5">
              <Button onClick={onInvite} className="w-full font-bold" size="sm">
                <UserPlus className="h-4 w-4 mr-2" /> Invite Friends
              </Button>
            </div>

            {/* Search */}
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

            {/* User List */}
            <ScrollArea className="flex-1 p-4">
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
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col h-full">
            {selectedChannelId ? (
              // Active Channel View
              <div className="flex flex-col h-full">
                <div className="p-2 border-b-4 border-border flex items-center">
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
                <div className="flex-1 min-h-0">
                  <MessageFeed
                    channelId={selectedChannelId}
                    channelName={selectedChannel?.name || "unknown"}
                  />
                </div>
              </div>
            ) : (
              // Channel List View
              <ScrollArea className="flex-1 p-2">
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
                        onClick={() => setShowCreateChannel(!showCreateChannel)}
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
                          onChange={(e) => setNewChannelName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && createChannel()
                          }
                          className="h-7 text-xs"
                          disabled={loading}
                        />
                        <Button
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={createChannel}
                          disabled={loading}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {channels.map((channel) => (
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
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t-4 border-border">
        <Button
          variant="neutral"
          className="w-full justify-start font-bold"
          size="sm"
        >
          <Settings className="h-4 w-4 mr-2" /> Settings
        </Button>
      </div>
    </div>
  );
}
