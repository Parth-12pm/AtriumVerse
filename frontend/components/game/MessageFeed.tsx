"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hash, Send, Edit2, Trash2 } from "lucide-react";
import EventBus from "@/game/EventBus";
import { fetchAPI } from "@/lib/api";
import { formatChatTimestamp } from "@/lib/time";
import { useChannelKeys } from "@/hooks/useChannelKeys";
import { toast } from "sonner";

interface Message {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  edited_at?: string;
  reply_to_id?: string;
  is_encrypted: boolean;
  epoch?: number;
  decryptedContent?: string;
  decryptionFailed?: boolean;
  device_key_status?: "predates_channel_access";
}

interface MessageFeedProps {
  channelId: string;
  channelName: string;
}

export function MessageFeed({ channelId, channelName }: MessageFeedProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  const { encryptForChannel, decryptForChannel } = useChannelKeys();

  useEffect(() => {
    loadMessages();
  }, [channelId]);

  useEffect(() => {
    const handleRecv = async (data: any) => {
      if (data.channel_id !== channelId) return;

      const newMsg: Message = {
        id: data.id || Date.now().toString(),
        user_id: data.sender || data.user_id,
        username: data.username,
        content: data.text || data.content,
        created_at: data.timestamp || new Date().toISOString(),
        is_encrypted: data.is_encrypted || false,
        epoch: data.epoch,
      };

      if (newMsg.is_encrypted && newMsg.epoch) {
        try {
          newMsg.decryptedContent = await decryptForChannel(
            channelId,
            newMsg.epoch,
            newMsg.content,
          );
        } catch (err) {
          if (
            err instanceof Error &&
            err.name === "ChannelKeyUnavailableError"
          ) {
            newMsg.device_key_status = "predates_channel_access";
          } else {
            newMsg.decryptionFailed = true;
          }
        }
      }

      setMessages((prev) => [...prev, newMsg]);
    };

    EventBus.on("chat:channel_message", handleRecv);
    return () => {
      EventBus.off("chat:channel_message", handleRecv);
    };
  }, [channelId, decryptForChannel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await fetchAPI(`/messages/channels/${channelId}/messages`);
      const msgs = data.reverse();

      const hydrated = await Promise.all(
        msgs.map(async (msg: Message) => {
          if (msg.is_encrypted && msg.epoch) {
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
      console.error("Failed to load messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const finalContent = newMessage.trim();
      let reqBody: any = { content: finalContent };

      try {
        const { ciphertext, epoch } = await encryptForChannel(
          channelId,
          finalContent,
        );
        reqBody = {
          content: ciphertext,
          is_encrypted: true,
          epoch,
        };
      } catch (err) {
        if (
          !(err instanceof Error) ||
          err.name !== "ChannelEncryptionDisabledError"
        ) {
          throw err;
        }
      }

      const message = await fetchAPI(
        `/messages/channels/${channelId}/messages`,
        {
          method: "POST",
          body: JSON.stringify(reqBody),
        },
      );

      if (message.is_encrypted) {
        message.decryptedContent = finalContent;
      }

      setMessages((prev) => [...prev, message]);
      setNewMessage("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      const updated = await fetchAPI(`/messages/${messageId}`, {
        method: "PATCH",
        body: JSON.stringify({ content: editContent.trim() }),
      });

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? updated : msg)),
      );
      setEditingId(null);
      toast.success("Message updated");
    } catch (error) {
      toast.error(`Failed to update message : ${error}`);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await fetchAPI(`/messages/${messageId}`, { method: "DELETE" });
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      toast.error(`Failed to delete message : ${error}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      <div className="h-14 border-b-4 border-border bg-card flex items-center px-4">
        <Hash className="h-5 w-5 mr-2 text-muted-foreground" />
        <span className="font-black uppercase text-lg">{channelName}</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-muted rounded-lg border-4 border-border flex items-center justify-center mb-4">
              <Hash className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-black uppercase mb-2">
              Welcome to #{channelName}
            </h3>
            <p className="text-muted-foreground">
              This is the start of the #{channelName} channel
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex gap-3 hover:bg-accent/5 -mx-2 px-2 py-1 rounded-lg group"
            >
              <Avatar className="h-10 w-10 border-2 border-border shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground font-black">
                  {msg.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-sm">{msg.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatChatTimestamp(msg.created_at)}
                  </span>
                  {msg.edited_at && (
                    <span className="text-xs text-muted-foreground italic">
                      (edited)
                    </span>
                  )}

                  {msg.user_id === currentUserId && (
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        variant="noShadow"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startEdit(msg)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="noShadow"
                        size="icon"
                        className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => deleteMessage(msg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {editingId === msg.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(msg.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8"
                    />
                    <Button
                      size="sm"
                      onClick={() => saveEdit(msg.id)}
                      className="h-8"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="neutral"
                      onClick={() => setEditingId(null)}
                      className="h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm break-words">
                    {msg.is_encrypted ? (
                      msg.decryptedContent ? (
                        msg.decryptedContent
                      ) : msg.decryptionFailed ? (
                        <span className="text-destructive font-mono text-xs">
                          [Message could not be decrypted]
                        </span>
                      ) : msg.device_key_status ===
                        "predates_channel_access" ? (
                        <span className="text-muted-foreground italic">
                          [Sent before you had access to this channel]
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          [Decrypting...]
                        </span>
                      )
                    ) : (
                      msg.content
                    )}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t-4 border-border bg-card">
        <div className="flex gap-2">
          <Input
            placeholder={`Message #${channelName}`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !newMessage.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
