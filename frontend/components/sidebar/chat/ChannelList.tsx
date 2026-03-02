"use client";

import React from "react";
import { Hash, User, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateChannelDialog from "./CreateChannelDialog";
import ChannelDropdown from "./ChannelDropdown";
import EditChannelDialog from "./EditChannelDialog";
import type { ChannelCreate } from "@/types/api.types";

interface Channel {
  id: string;
  name: string;
  description?: string;
  type?: string;
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
  onCreateChannel: (data: ChannelCreate) => Promise<void>;
  onUpdateChannel: (channelId: string, data: Partial<Channel>) => Promise<void>;
  onDeleteChannel: (channelId: string) => Promise<void>;
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
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
}: ChannelListProps) {
  const [channelsExpanded, setChannelsExpanded] = React.useState(true);
  const [dmsExpanded, setDMsExpanded] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingChannel, setEditingChannel] = React.useState<Channel | null>(
    null,
  );

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
            {channels.length === 0 ? (
              <p className="px-4 py-2 text-sm text-muted-foreground">
                No channels available
              </p>
            ) : (
              channels.map((channel) => (
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
                        : "bg-gray-200"
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
          onUpdateChannel={onUpdateChannel}
        />
      )}
    </div>
  );
}
