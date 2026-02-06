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
  serverId: string;
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
  serverId,
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
    <div className="flex-1 overflow-y-auto">
      {/* Channels Section */}
      <div className="border-b-4 border-black">
        <div className="w-full px-4 py-3 flex items-center justify-between border-b-3 border-black">
          <button
            onClick={() => setChannelsExpanded(!channelsExpanded)}
            className="flex items-center gap-2 hover:opacity-70 transition-opacity"
          >
            <span className="font-black text-sm uppercase text-gray-700">
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
              className="w-6 h-6 p-0"
              title="Create Channel"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>

        {channelsExpanded && (
          <div className="py-2">
            {channels.length === 0 ? (
              <p className="px-4 py-2 text-sm text-gray-500">
                No channels available
              </p>
            ) : (
              channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`group w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-all ${
                    selectedChannelId === channel.id
                      ? "bg-blue-100 border-l-4 border-blue-500 font-bold"
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
                    <Hash
                      className={`w-5 h-5 ${selectedChannelId === channel.id ? "text-white" : "text-gray-700"}`}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">{channel.name}</p>
                  </div>
                  {isServerOwner && (
                    <ChannelDropdown
                      channelId={channel.id}
                      channelName={channel.name}
                      onEdit={() => setEditingChannel(channel)}
                      onDelete={onDeleteChannel}
                    />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Direct Messages Section */}
      <div>
        <button
          onClick={() => setDMsExpanded(!dmsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors border-b-3 border-black"
        >
          <span className="font-black text-sm uppercase text-gray-700">
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
                <p className="text-sm text-gray-500 mb-2">
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
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-all relative ${
                    selectedDMUserId === conversation.user_id
                      ? "bg-purple-100 border-l-4 border-purple-500 font-bold"
                      : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full border-3 border-black flex items-center justify-center ${
                      selectedDMUserId === conversation.user_id
                        ? "bg-purple-500"
                        : "bg-gray-200"
                    }`}
                  >
                    <User
                      className={`w-5 h-5 ${selectedDMUserId === conversation.user_id ? "text-white" : "text-gray-700"}`}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-sm truncate">
                      {conversation.username}
                    </p>
                    {conversation.last_message && (
                      <p className="text-xs text-gray-500 truncate">
                        {conversation.last_message}
                      </p>
                    )}
                  </div>
                  {conversation.unread_count > 0 && (
                    <div className="w-6 h-6 bg-red-500 border-2 border-black rounded-full flex items-center justify-center">
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
          currentType={(editingChannel as any).type || "text"}
          onUpdateChannel={onUpdateChannel}
        />
      )}
    </div>
  );
}
