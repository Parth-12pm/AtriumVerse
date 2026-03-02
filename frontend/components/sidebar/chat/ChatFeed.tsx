"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Edit2, Trash2, User, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { messagesAPI, directMessagesAPI } from "@/lib/services/api.service";
import { toast } from "sonner";
import { formatChatTimestamp } from "@/lib/time";
import EventBus from "@/game/EventBus";
import { getCommunicationManager } from "@/game/managers/CommunicationManager";
import type { Message, DirectMessage } from "@/types/api.types";

// Union type for messages that can be either channel messages or DMs
type ChatMessage = Message | DirectMessage;

interface ChatFeedProps {
  mode: "channel" | "dm";
  channelId?: string;
  dmUserId?: string;
  serverId: string;
}

export default function ChatFeed({
  mode,
  channelId,
  dmUserId,
  serverId,
}: ChatFeedProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  // Load messages when channel/DM changes
  useEffect(() => {
    if (mode === "channel" && channelId) {
      loadChannelMessages();
    } else if (mode === "dm" && dmUserId) {
      loadDMMessages();
    }
  }, [mode, channelId, dmUserId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for real-time messages from WebSocket
  useEffect(() => {
    const handleChannelMessage = (msg: any) => {
      // Only add if for this channel and not from current user (already added locally)
      if (msg.channel_id === channelId && msg.user_id !== currentUserId) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleDMReceived = (msg: ChatMessage) => {
      if (
        "sender_id" in msg &&
        (msg.sender_id === dmUserId || msg.receiver_id === dmUserId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleDMUpdated = (msg: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const handleDMDeleted = (data: { message_id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
    };

    if (mode === "channel") {
      EventBus.on("chat:channel_message", handleChannelMessage);
      return () => {
        EventBus.off("chat:channel_message", handleChannelMessage);
      };
    } else if (mode === "dm") {
      EventBus.on("dm:received", handleDMReceived);
      EventBus.on("dm:updated", handleDMUpdated);
      EventBus.on("dm:deleted", handleDMDeleted);
      return () => {
        EventBus.off("dm:received", handleDMReceived);
        EventBus.off("dm:updated", handleDMUpdated);
        EventBus.off("dm:deleted", handleDMDeleted);
      };
    }
  }, [mode, channelId, dmUserId, currentUserId]);

  const handleDMReceived = (msg: ChatMessage) => {
    // Only add if it's for the current conversation
    if (
      "sender_id" in msg &&
      (msg.sender_id === dmUserId || msg.receiver_id === dmUserId)
    ) {
      setMessages((prev) => [...prev, msg]);
    }
  };

  const handleDMUpdated = (msg: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
  };

  const handleDMDeleted = (data: { message_id: string }) => {
    setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
  };

  const loadChannelMessages = async () => {
    try {
      const response = await messagesAPI.list(channelId!);
      setMessages(response.data.reverse()); // Oldest first
    } catch (error) {
      console.error("Failed to load channel messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const loadDMMessages = async () => {
    try {
      const response = await directMessagesAPI.getMessages(dmUserId!);
      setMessages(response.data.reverse()); // Oldest first
    } catch (error) {
      console.error("Failed to load DM messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      if (mode === "channel" && channelId) {
        // Use messagesAPI directly for reliable REST calls
        const response = await messagesAPI.send(channelId, {
          content: newMessage.trim(),
        });
        // Add the new message to the list locally
        setMessages((prev) => [...prev, response.data]);

        // Broadcast via WebSocket so other users receive it in real-time
        EventBus.emit("channel:message_sent", {
          ...response.data,
          channel_id: channelId,
        });
      } else if (mode === "dm" && dmUserId) {
        const response = await directMessagesAPI.send({
          receiver_id: dmUserId,
          content: newMessage.trim(),
        });
        setMessages((prev) => [...prev, response.data]);

        // Send DM notification via WebSocket
        EventBus.emit("dm:message_sent", {
          target_id: dmUserId,
          message: response.data,
        });
      }

      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      if (mode === "channel") {
        const response = await messagesAPI.edit(messageId, {
          content: editContent.trim(),
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? response.data : m)),
        );
      } else if (mode === "dm" && dmUserId) {
        const response = await directMessagesAPI.edit(messageId, {
          content: editContent.trim(),
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? response.data : m)),
        );
      }

      setEditingId(null);
      toast.success("Message updated");
    } catch (error) {
      toast.error("Failed to update message");
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      if (mode === "channel") {
        await messagesAPI.delete(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else if (mode === "dm") {
        await directMessagesAPI.delete(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }

      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const getMessageUsername = (msg: ChatMessage) => {
    // Type guard: Message has username and channel_id, DirectMessage has sender_username
    if ("channel_id" in msg) {
      // This is a Message (channel message)
      return msg.username || "Unknown";
    }
    // This is a DirectMessage
    return msg.sender_username || "Unknown";
  };

  const getMessageUserId = (msg: ChatMessage) => {
    // Type guard: DirectMessage has sender_id, Message has user_id
    if ("sender_id" in msg) {
      return msg.sender_id;
    }
    return msg.user_id;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background text-foreground">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-muted rounded-lg border-2 border-border flex items-center justify-center mb-4">
              {mode === "channel" ? (
                <Hash className="w-8 h-8 text-gray-500" />
              ) : (
                <User className="w-8 h-8 text-gray-500" />
              )}
            </div>
            <h3 className="text-xl font-black mb-2 text-foreground">
              {mode === "channel"
                ? "Start the conversation!"
                : "No messages yet"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {mode === "channel"
                ? "Be the first to send a message"
                : "Send a message to start chatting"}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const username = getMessageUsername(msg);
            const userId = getMessageUserId(msg);
            const isOwnMessage = userId === currentUserId;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 -mx-2 px-2 py-2 rounded-lg group ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback
                    className={`text-white font-black ${isOwnMessage ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-purple-400 to-pink-400"}`}
                  >
                    {username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={`flex flex-col max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}
                >
                  {/* Message Header */}
                  <div
                    className={`flex items-center gap-2 mb-1 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <span className="font-black text-sm">{username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatChatTimestamp(msg.created_at)}
                    </span>
                    {msg.edited_at && (
                      <span className="text-xs text-muted-foreground italic">
                        (edited)
                      </span>
                    )}
                  </div>

                  {/* Message Content */}
                  {editingId === msg.id ? (
                    <div className="flex gap-2 mt-2 w-full">
                      <Input
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation(); // Prevent game from capturing input
                          if (e.key === "Enter") saveEdit(msg.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => saveEdit(msg.id)}
                        variant="default"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        size="sm"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        variant="neutral"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div
                      className={`relative group/msg ${isOwnMessage ? "w-full flex justify-end" : "w-full"}`}
                    >
                      <div
                        className={`inline-block px-4 py-2 rounded-2xl ${isOwnMessage ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}
                      >
                        <p className="text-sm break-words">{msg.content}</p>
                      </div>

                      {/* Actions (only for own messages) */}
                      {isOwnMessage && (
                        <div className="absolute top-0 right-0 -mt-6 opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1">
                          <Button
                            onClick={() => startEdit(msg)}
                            variant="neutral"
                            size="icon"
                            className="w-6 h-6 p-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => deleteMessage(msg.id)}
                            variant="neutral"
                            size="icon"
                            className="w-6 h-6 p-0 hover:bg-destructive/15"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-border bg-muted/40 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={
              mode === "channel" ? "Message channel..." : "Send a message..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              // Stop propagation for ALL keys to prevent game from capturing input
              e.stopPropagation();
              if (e.key === "Enter" && !e.shiftKey) sendMessage();
            }}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            variant="default"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="icon"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
