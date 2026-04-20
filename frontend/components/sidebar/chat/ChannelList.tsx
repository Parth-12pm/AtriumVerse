"use client";

import React from "react";
import { Hash, User, ChevronDown, Plus, Volume2, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateChannelDialog from "./CreateChannelDialog";
import ChannelDropdown from "./ChannelDropdown";
import EditChannelDialog from "./EditChannelDialog";
import type { ChannelCreate } from "@/types/api.types";
import EventBus, { GameEvents } from "@/game/EventBus";
import { getVoiceChannelAudio, getProximityAudio } from "@/lib/livekit-audio";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Channel {
  id: string;
  name: string;
  description?: string;
  type?: string;
  is_encrypted?: boolean;
}

interface DMConversation {
  user_id: string;
  username: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

interface ChannelListProps {
  channels: Channel[];
  dmConversations: DMConversation[];
  selectedChannelId: string | null;
  selectedDMUserId: string | null;
  onChannelSelect: (channelId: string) => void;
  onDMSelect: (userId: string) => void;
  loading: boolean;
  isServerOwner: boolean;
  serverId: string;
  onCreateChannel: (data: ChannelCreate) => Promise<void>;
  onUpdateChannel: (channelId: string, data: Partial<Channel>) => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
  repairKeys?: () => Promise<void>;
  repairLoading?: boolean;
  onEncryptionEnabled?: (channelId: string) => void;
}

export default function ChannelList({
  channels,
  dmConversations,
  selectedChannelId,
  selectedDMUserId,
  onChannelSelect,
  onDMSelect,
  loading,
  isServerOwner,
  serverId,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  repairKeys,
  repairLoading,
  onEncryptionEnabled,
}: ChannelListProps) {
  const [channelsExpanded, setChannelsExpanded] = React.useState(true);
  const [dmsExpanded, setDMsExpanded] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingChannel, setEditingChannel] = React.useState<Channel | null>(
    null,
  );
  const [voiceExpanded, setVoiceExpanded] = React.useState(true);

  const textChannels = React.useMemo(() => channels.filter(c => c.type !== "voice"), [channels]);
  const voiceChannels = React.useMemo(() => channels.filter(c => c.type === "voice"), [channels]);

  const [activeVoiceChannelId, setActiveVoiceChannelId] = React.useState<string | null>(null);
  const [voiceParticipants, setVoiceParticipants] = React.useState<Record<string, {user_id: string, username: string}[]>>({});

  // --- VOICE PRESENCE TRACKING ---
  React.useEffect(() => {
    const handleVoicePresence = (data: Record<string, any>) => {
      setVoiceParticipants((prev) => {
        const next = { ...prev };
        
        switch (data.type) {
          case "voice_state":
            return data.channels || {};
            
          case "voice_join":
            Object.keys(next).forEach(cid => {
              if (next[cid]) {
                next[cid] = next[cid].filter(p => p.user_id !== data.user_id);
              }
            });
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

  React.useEffect(() => {
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
    if (activeVoiceChannelId === channelId) {
      await getVoiceChannelAudio().disconnect();
      EventBus.emit("action:toggle_mic", getProximityAudio().isMicEnabled());
      return;
    }
    
    const wasMicEnabled = getProximityAudio().isMicEnabled();
    await getProximityAudio().setMicEnabled(false);
    const voiceAudio = getVoiceChannelAudio();
    await voiceAudio.connect(channelId);
    await voiceAudio.setMicEnabled(wasMicEnabled);
    EventBus.emit("action:toggle_mic", wasMicEnabled); 
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 bg-blue-500 border-3 border-black rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-card">
      {/* Channels Section */}
      <div className="border-b-2 border-border">
        <div className="flex w-full items-center justify-between border-b-2 border-border px-4 py-3">
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="text-sm font-black uppercase text-muted-foreground">
              Channels
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${channelsExpanded ? "" : "-rotate-90"}`}
            />
          </button>
          {isServerOwner && (
            <Button
              variant="neutral"
              size="icon"
              onClick={() => setShowCreateDialog(true)}
              className="h-6 w-6 border-border p-0"
              title="Create Channel"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {channelsExpanded && (
          <div className="py-2">
            {textChannels.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted-foreground">
                No text channels available
              </p>
            ) : (
              textChannels.map((channel) => (
                <div
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onChannelSelect(channel.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/60 transition-all cursor-pointer ${
                    selectedChannelId === channel.id
                      ? "border-l-4 border-primary bg-primary/10 font-bold"
                      : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg border-3 border-black flex items-center justify-center ${
                      selectedChannelId === channel.id
                        ? "bg-blue-500"
                        : "bg-gray-850"
                    }`}
                  >
                    <Hash className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{channel.name}</p>
                  </div>
                  {isServerOwner && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ChannelDropdown
                        channelId={channel.id}
                        channelName={channel.name}
                        onEdit={() => setEditingChannel(channel)}
                        onDelete={onDeleteChannel}
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Voice Channels Section */}
      <div className="border-b-2 border-border">
        <button
          onClick={() => setVoiceExpanded(!voiceExpanded)}
          className="flex w-full items-center justify-between border-b-2 border-border px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <span className="text-sm font-black uppercase text-muted-foreground">
            Voice Channels
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${voiceExpanded ? "" : "-rotate-90"}`}
          />
        </button>

        {voiceExpanded && (
          <div className="py-2">
            {voiceChannels.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted-foreground">
                No voice channels available
              </p>
            ) : (
              voiceChannels.map((channel) => (
                <React.Fragment key={channel.id}>
                <div
                  onClick={() => handleJoinVoice(channel.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleJoinVoice(channel.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/60 transition-all cursor-pointer ${
                    activeVoiceChannelId === channel.id
                      ? "border-l-4 border-emerald-500 bg-emerald-500/10 font-bold"
                      : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg border-3 border-black flex items-center justify-center ${
                      activeVoiceChannelId === channel.id
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-850"
                    }`}
                  >
                    <Volume2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{channel.name}</p>
                  </div>
                  {activeVoiceChannelId === channel.id && (
                    <Button 
                      variant="reverse" 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); handleJoinVoice(channel.id); }}
                      className="h-6 text-xs px-2 bg-red-500 hover:bg-red-600 text-white border-red-900"
                    >
                      Disconnect
                    </Button>
                  )}
                  {isServerOwner && activeVoiceChannelId !== channel.id && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ChannelDropdown
                        channelId={channel.id}
                        channelName={channel.name}
                        onEdit={() => setEditingChannel(channel)}
                        onDelete={onDeleteChannel}
                      />
                    </div>
                  )}
                </div>
                
                {/* Connected voice participants */}
                {voiceParticipants[channel.id]?.length > 0 && (
                  <div className="flex flex-col gap-1 ml-10 mb-2 border-l-2 border-border/50 pl-2">
                    {voiceParticipants[channel.id].map(p => (
                      <div key={p.user_id} className="flex items-center gap-2 rounded-md hover:bg-muted/50 p-1.5 cursor-default mt-1">
                        <Avatar className="h-6 w-6 border-2 border-border shadow-sm">
                          <AvatarFallback className="bg-orange-400 text-black text-[10px] font-bold">
                            {p.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-bold truncate max-w-[150px]">{p.username}</span>
                      </div>
                    ))}
                  </div>
                )}
                </React.Fragment>
              ))
            )}
          </div>
        )}
      </div>

      {/* Direct Messages Section */}
      <div>
        <button
          onClick={() => setDMsExpanded(!dmsExpanded)}
          className="flex w-full items-center justify-between border-b-2 border-border px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <span className="text-sm font-black uppercase text-muted-foreground">
            Direct Messages
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${dmsExpanded ? "" : "-rotate-90"}`}
          />
        </button>

        {dmsExpanded && (
          <div className="py-2">
            {dmConversations.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="mb-2 text-sm text-muted-foreground">
                  No direct messages yet
                </p>
                <p className="text-xs text-gray-400">
                  Click on a user to start chatting!
                </p>
              </div>
            ) : (
              dmConversations.map((conversation) => (
                <button
                  key={conversation.user_id}
                  onClick={() => onDMSelect(conversation.user_id)}
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-muted/60 transition-all relative ${
                    selectedDMUserId === conversation.user_id
                      ? "border-l-4 border-secondary bg-secondary/20 font-bold"
                      : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-3 border-black flex items-center justify-center ${
                      selectedDMUserId === conversation.user_id
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-sm truncate">
                      {conversation.username}
                    </p>
                    {conversation.last_message && (
                      <p className="truncate text-xs text-muted-foreground">
                        {conversation.last_message}
                      </p>
                    )}
                  </div>
                  {conversation.unread_count > 0 && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-border bg-destructive">
                      <span className="text-white text-xs font-black">
                        {conversation.unread_count}
                      </span>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateChannel={onCreateChannel}
      />

      {/* Edit Channel Dialog */}
      {editingChannel && (
        <EditChannelDialog
          open={!!editingChannel}
          onOpenChange={(open) => !open && setEditingChannel(null)}
          channelId={editingChannel.id}
          currentName={editingChannel.name}
          currentType={editingChannel.type === "voice" ? "voice" : "text"}
          serverId={serverId}
          isEncrypted={!!editingChannel.is_encrypted}
          repairKeys={repairKeys}
          repairLoading={repairLoading}
          onUpdateChannel={onUpdateChannel}
          onEncryptionEnabled={onEncryptionEnabled}
        />
      )}
    </div>
  );
}
