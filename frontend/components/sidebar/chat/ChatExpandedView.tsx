"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Hash, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChannelList from "@/components/sidebar/chat/ChannelList";
import ChatFeed from "@/components/sidebar/chat/ChatFeed";
import {
  channelsAPI,
  directMessagesAPI,
  serversAPI,
} from "@/lib/services/api.service";
import EventBus from "@/game/EventBus";
import type { Channel, Conversation, ChannelCreate } from "@/types/api.types";

interface ChatExpandedViewProps {
  serverId: string;
  onClose: () => void;
}

type ChatMode = "channel" | "dm";

export default function ChatExpandedView({
  serverId,
  onClose,
}: ChatExpandedViewProps) {
  const [mode, setMode] = useState<ChatMode>("channel");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null,
  );
  const [selectedDMUserId, setSelectedDMUserId] = useState<string | null>(null);
  const [selectedDMUsername, setSelectedDMUsername] = useState<string | null>(
    null,
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmConversations, setDMConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isServerOwner, setIsServerOwner] = useState(false);

  // Listen for dm:start events from People view
  useEffect(() => {
    const handleDMStart = (data: { userId: string; username: string }) => {
      console.log("dm:start event received:", data);
      setMode("dm");
      setSelectedDMUserId(data.userId);
      setSelectedDMUsername(data.username);
      setSelectedChannelId(null);
    };

    EventBus.on("dm:start", handleDMStart);
    return () => {
      EventBus.off("dm:start", handleDMStart);
    };
  }, []);

  const loadServerData = useCallback(async () => {
    try {
      const response = await serversAPI.get(serverId);
      const userId = getUserId();
      setIsServerOwner(response.data.owner_id === userId);
    } catch (error) {
      console.error("Failed to load server data:", error);
    }
  }, [serverId]);

  const getUserId = (): string => {
    // Get from localStorage (set during login)
    return localStorage.getItem("user_id") || "";
  };

  const loadChannels = useCallback(async () => {
    try {
      const response = await channelsAPI.list(serverId);
      setChannels(response.data);

      // Auto-select first channel
      if (response.data.length > 0 && !selectedChannelId) {
        setSelectedChannelId(response.data[0].id);
      }
    } catch (error) {
      console.error("Failed to load channels:", error);
    } finally {
      setLoading(false);
    }
  }, [serverId, selectedChannelId]);

  const loadDMConversations = useCallback(async () => {
    try {
      const response = await directMessagesAPI.listConversations();
      setDMConversations(response.data);
    } catch (error) {
      console.error("Failed to load DM conversations:", error);
    }
  }, []);

  // Refresh DM conversations when a message is sent (for immediate list update)
  useEffect(() => {
    const handleDMSent = () => {
      // Refresh the conversation list to show new/updated conversations
      loadDMConversations();
    };

    const handleDMReceived = () => {
      // Refresh when receiving a DM (for unread counter updates)
      loadDMConversations();
    };

    EventBus.on("dm:message_sent", handleDMSent);
    EventBus.on("dm:received", handleDMReceived);

    return () => {
      EventBus.off("dm:message_sent", handleDMSent);
      EventBus.off("dm:received", handleDMReceived);
    };
  }, [loadDMConversations]);

  // Load server data and channels
  useEffect(() => {
    loadServerData();
    loadChannels();
    loadDMConversations();
  }, [loadServerData, loadChannels, loadDMConversations]);

  const handleChannelSelect = (channelId: string) => {
    setMode("channel");
    setSelectedChannelId(channelId);
    setSelectedDMUserId(null);
  };

  const handleDMSelect = (userId: string) => {
    setMode("dm");
    setSelectedDMUserId(userId);
    setSelectedChannelId(null);
  };

  const handleCreateChannel = async (data: ChannelCreate) => {
    try {
      const response = await channelsAPI.create(serverId, data);
      setChannels((prev) => [...prev, response.data]);
      // Auto-select the new channel
      setSelectedChannelId(response.data.id);
      setMode("channel");
    } catch (error) {
      console.error("Failed to create channel:", error);
      throw error;
    }
  };

  const handleUpdateChannel = async (
    channelId: string,
    data: Partial<Channel>,
  ) => {
    try {
      const response = await channelsAPI.update(channelId, data);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? response.data : c)),
      );
    } catch (error) {
      console.error("Failed to update channel:", error);
      throw error;
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      await channelsAPI.delete(channelId);
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      // If deleted channel was selected, clear selection
      if (selectedChannelId === channelId) {
        setSelectedChannelId(null);
      }
    } catch (error) {
      console.error("Failed to delete channel:", error);
      throw error;
    }
  };

  const selectedChannel = channels.find((c) => c.id === selectedChannelId);
  const selectedDM = dmConversations.find(
    (c) => c.user_id === selectedDMUserId,
  );

  return (
    <div className="fixed left-19 top-0 z-40 flex h-full text-foreground">
      {/* Left Card: Channel/DM List (Slim) */}
      <div className="flex w-72 flex-col border-r-2 border-border bg-card">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between border-b-2 border-border bg-primary p-4 text-primary-foreground">
          <h2 className="text-xl font-black">Chat</h2>
          <Button
            onClick={onClose}
            variant="neutral"
            size="icon"
            className="h-8 w-8 border-border bg-card text-foreground hover:bg-muted"
            title="Close Chat"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Channel/DM List */}
        <ChannelList
          channels={channels}
          dmConversations={dmConversations}
          selectedChannelId={selectedChannelId}
          selectedDMUserId={selectedDMUserId}
          onChannelSelect={handleChannelSelect}
          onDMSelect={handleDMSelect}
          loading={loading}
          isServerOwner={isServerOwner}
          onCreateChannel={handleCreateChannel}
          onUpdateChannel={handleUpdateChannel}
          onDeleteChannel={handleDeleteChannel}
        />
      </div>

      {/* Right Card: Message Feed (Wide) */}
      <div className="flex h-screen w-[600px] flex-col overflow-hidden border-r-2 border-border bg-background">
        {/* Feed Header */}
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-border bg-muted/40 p-4">
          {mode === "channel" && selectedChannel ? (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border bg-primary text-primary-foreground">
                <Hash className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-lg">#{selectedChannel.name}</h3>
                {selectedChannel.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedChannel.description}
                  </p>
                )}
              </div>
            </>
          ) : mode === "dm" && (selectedDM || selectedDMUserId) ? (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-secondary text-secondary-foreground">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-black text-lg">
                  {selectedDM?.username ||
                    selectedDMUsername ||
                    "Direct Message"}
                </h3>
                <p className="text-sm text-muted-foreground">Direct Message</p>
              </div>
            </>
          ) : (
            <div className="text-center w-full">
              <p className="font-bold text-muted-foreground">
                Select a channel or DM
              </p>
            </div>
          )}
        </div>
        {/* Message Feed - Takes remaining height */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {mode === "channel" && selectedChannelId ? (
            <ChatFeed
              mode="channel"
              channelId={selectedChannelId}
            />
          ) : mode === "dm" && selectedDMUserId ? (
            <ChatFeed
              mode="dm"
              dmUserId={selectedDMUserId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-sm rounded-lg border-2 border-border bg-muted/40 p-8 text-center">
                <p className="mb-2 text-lg font-bold text-muted-foreground">
                  💬 Welcome to Chat!
                </p>
                <p className="text-sm text-muted-foreground">
                  Select a channel or start a direct message to begin chatting.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
