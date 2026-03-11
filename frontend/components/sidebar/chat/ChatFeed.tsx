"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Edit2, Trash2, User, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { messagesAPI, directMessagesAPI } from "@/lib/services/api.service";
import { toast } from "sonner";
import { formatChatTimestamp } from "@/lib/time";
import EventBus from "@/game/EventBus";
import type { Message, DirectMessage } from "@/types/api.types";
import { useDMKeys } from "@/hooks/useDMKeys";
import { useChannelKeys } from "@/hooks/useChannelKeys";
import { fetchAPI } from "@/lib/api";
import { resolveTrustedLocalDevice } from "@/lib/trustedDevice";

// Union type for messages that can be either channel messages or DMs
type ChatMessage = Message | DirectMessage;

interface ChatFeedProps {
  mode: "channel" | "dm";
  channelId?: string;
  dmUserId?: string;
}

export default function ChatFeed({ mode, channelId, dmUserId }: ChatFeedProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  const { encryptDM, decryptDM } = useDMKeys();
  const { encryptForChannel, decryptForChannel } = useChannelKeys();

  const loadChannelMessages = useCallback(async () => {
    if (!channelId) return;

    try {
      const response = await messagesAPI.list(channelId);
      const msgs: Message[] = response.data.reverse(); // Oldest first

      // Hydrate decryption for E2EE messages
      const hydrated = await Promise.all(
        msgs.map(async (msg) => {
          if (msg.is_encrypted && msg.content && msg.epoch != null) {
            try {
              msg.decryptedContent = await decryptForChannel(
                channelId,
                msg.epoch,
                msg.content,
              );
            } catch (err) {
              if (
                err instanceof Error &&
                err.name === "ChannelKeyUnavailableError"
              ) {
                msg.device_key_status = "predates_channel_access";
              } else {
                msg.decryptionFailed = true;
              }
            }
          }
          return msg;
        }),
      );

      setMessages(hydrated);
    } catch (error) {
      console.error("Failed to load channel messages:", error);
      toast.error("Failed to load messages");
    }
  }, [channelId, decryptForChannel]);

  const loadDMMessages = useCallback(async () => {
    if (!dmUserId) return;

    try {
      const { deviceId: myDeviceId } = await resolveTrustedLocalDevice();
      const response = await directMessagesAPI.getMessages(
        dmUserId,
        myDeviceId,
      );
      const msgs = response.data.reverse() as DirectMessage[]; // Oldest first

      // Hydrate decryptions
      const hydrated = await Promise.all(
        msgs.map(async (msg) => {
          if (
            msg.is_encrypted &&
            msg.encrypted_ciphertext &&
            msg.epoch &&
            msg.sender_public_key
          ) {
            try {
              msg.decryptedContent = await decryptDM(
                msg.id,
                msg.epoch,
                msg.encrypted_ciphertext,
                msg.sender_public_key,
              );
            } catch (err) {
              msg.decryptionFailed = true;
            }
          }
          return msg;
        }),
      );

      setMessages(hydrated);
    } catch (error) {
      console.error("Failed to load DM messages:", error);
      toast.error("Failed to load messages");
    }
  }, [dmUserId, decryptDM]);

  // Load messages when channel/DM changes
  useEffect(() => {
    if (mode === "channel" && channelId) {
      loadChannelMessages();
    } else if (mode === "dm" && dmUserId) {
      loadDMMessages();
    }
  }, [mode, channelId, dmUserId, loadChannelMessages, loadDMMessages]);
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen for real-time messages from WebSocket
  useEffect(() => {
    const handleChannelMessage = async (msg: ChatMessage) => {
      if (!("channel_id" in msg)) return;
      if (msg.channel_id !== channelId || msg.user_id === currentUserId) return;

      const hydratedMsg = { ...msg } as Message;
      if (hydratedMsg.is_encrypted && hydratedMsg.content && hydratedMsg.epoch != null) {
        try {
          hydratedMsg.decryptedContent = await decryptForChannel(
            channelId,
            hydratedMsg.epoch,
            hydratedMsg.content,
          );
        } catch (err) {
          if (err instanceof Error && err.name === "ChannelKeyUnavailableError") {
            hydratedMsg.device_key_status = "predates_channel_access";
          } else {
            hydratedMsg.decryptionFailed = true;
          }
        }
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === hydratedMsg.id)) return prev;
        return [...prev, hydratedMsg];
      });
    };

    const handleDMReceived = (msg: ChatMessage) => {
      if (
        "sender_id" in msg &&
        (msg.sender_id === dmUserId || msg.receiver_id === dmUserId)
      ) {
        // Prevent reacting to our own echo
        if (msg.sender_id === currentUserId) return;

        // E2EE requires us to fetch the ciphertext encrypted specifically for our device
        // We cannot rely on the WebSocket payload as it doesn't contain our device_id's slice
        loadDMMessages();
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
  }, [mode, channelId, currentUserId, decryptForChannel, dmUserId, loadDMMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      if (mode === "channel" && channelId) {
        let content = newMessage.trim();
        let isEncrypted = false;
        let epoch: number | undefined;

        try {
          const encrypted = await encryptForChannel(channelId, content);
          content = encrypted.ciphertext;
          epoch = encrypted.epoch;
          isEncrypted = true;
        } catch (err) {
          if (!(err instanceof Error) || err.name !== "ChannelEncryptionDisabledError") {
            throw err;
          }
        }

        const response = await messagesAPI.send(channelId, {
          content,
          is_encrypted: isEncrypted,
          epoch,
        } as any);

        const newMsg: Message = {
          ...response.data,
          // Show the plaintext locally immediately without re-decrypting
          decryptedContent: isEncrypted ? newMessage.trim() : undefined,
        };

        setMessages((prev) => [...prev, newMsg]);

        EventBus.emit("channel:message_sent", {
          ...newMsg,
          channel_id: channelId,
        });
      } else if (mode === "dm" && dmUserId) {
        const { deviceId: myDeviceId } = await resolveTrustedLocalDevice();

        // Step 1: Fetch target devices with public keys
        // Must use /devices/user/{id} (not /my-devices) because only that endpoint returns public_key
        const myUserId = localStorage.getItem("user_id");
        if (!myUserId) throw new Error("No user_id in localStorage");

        const [myDevicesRes, targetDevicesRes] = await Promise.all([
          fetchAPI(`/devices/user/${myUserId}`),
          fetchAPI(`/devices/user/${dmUserId}`),
        ]);

        // Normalize: both endpoints return { device_id, public_key }
        const normalize = (d: { device_id: string; public_key: string }) => ({
          id: d.device_id,
          public_key: d.public_key,
        });

        const allTargetDevices = [
          ...myDevicesRes.map(normalize),
          ...targetDevicesRes.map(normalize),
        ];
        if (allTargetDevices.length === 0) {
          throw new Error("No devices found for DM encryption");
        }

        // Step 2: Send placeholder
        const step1Response = await directMessagesAPI.send({
          receiver_id: dmUserId,
          content: "[encrypted]",
          is_encrypted: true,
          sender_device_id: myDeviceId,
        });

        const sentMsg: DirectMessage = step1Response.data;

        // Step 3: Encrypt for all target devices
        const ciphertexts = await encryptDM(
          sentMsg.id,
          sentMsg.epoch!,
          newMessage.trim(),
          allTargetDevices,
        );

        // Step 4: Submit keys
        await directMessagesAPI.submitDeviceKeys(sentMsg.id, ciphertexts);

        // Hydrate sent message locally
        sentMsg.decryptedContent = newMessage.trim();
        sentMsg.is_encrypted = true;

        setMessages((prev) => [...prev, sentMsg]);

        // Scrub any sensitive plaintext before broadcasting over WS
        // We only transmit a strict shell so devices know WHICH message to fetch
        const wsPayload = {
          id: sentMsg.id,
          epoch: sentMsg.epoch,
          sender_id: currentUserId,
          receiver_id: dmUserId,
          created_at: sentMsg.created_at,
          is_encrypted: true,
        };

        // Send DM notification via WebSocket
        EventBus.emit("dm:message_sent", {
          target_id: dmUserId,
          message: wsPayload,
        });
      }

      setNewMessage("");
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast.error(error?.message || "Failed to send message");
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
    } catch {
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
                        className={`inline-block px-4 py-2 rounded-2xl flex items-center justify-between min-w-[60px] gap-2 ${isOwnMessage ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {msg.is_encrypted
                            ? "decryptedContent" in msg && msg.decryptedContent
                              ? msg.decryptedContent
                              : msg.decryptionFailed
                                ? "ðŸ”’ [Decryption Failed]"
                                : msg.device_key_status === "predates_device"
                                  ? "[Sent before this device was linked]"
                                  : msg.device_key_status === "device_removed"
                                    ? "[Encrypted for a removed device]"
                                    : msg.device_key_status ===
                                        "predates_channel_access"
                                      ? "[Sent before you had access to this channel]"
                                      : "[Encrypted]"
                            : msg.content}
                        </p>
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




