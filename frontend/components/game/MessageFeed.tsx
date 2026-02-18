"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Hash, Send, Edit2, Trash2, Smile, Reply, MoreHorizontal } from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  edited_at?: string;
  reply_to_id?: string;
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
  const currentUserId = typeof window !== "undefined" ? localStorage.getItem("user_id") : null;

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000); // Poll for new messages every 3s
    return () => clearInterval(interval);
  }, [channelId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const loadMessages = async () => {
    try {
      const data = await fetchAPI(`/messages/channels/${channelId}/messages`);
      const reversed = data.reverse();
      // Only set if changed to avoid unnecessary re-renders
      if (JSON.stringify(reversed) !== JSON.stringify(messages)) {
        setMessages(reversed);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      const message = await fetchAPI(`/messages/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setMessages([...messages, message]);
      setNewMessage("");
    } catch (error) {
      toast.error(`Failed to send message: ${error}`);
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
      setMessages(messages.map((m) => (m.id === messageId ? updated : m)));
      setEditingId(null);
      toast.success("Message updated");
    } catch (error) {
      toast.error(`Failed to update message: ${error}`);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await fetchAPI(`/messages/${messageId}`, { method: "DELETE" });
      setMessages(messages.filter((m) => m.id !== messageId));
      toast.success("Message deleted");
    } catch (error) {
      toast.error(`Failed to delete message: ${error}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background/50 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl border-4 border-border flex items-center justify-center mb-6 shadow-xl rotate-3">
              <Hash className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-3xl font-black uppercase mb-3 tracking-tight">Welcome to #{channelName}</h3>
            <p className="text-muted-foreground font-bold max-w-xs italic">The journey of a thousand miles begins with a single message.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === currentUserId;
            const prevMsg = messages[idx - 1];
            const isGrouped = prevMsg && prevMsg.user_id === msg.user_id &&
              (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 60000;

            return (
              <div key={msg.id} className={cn("flex gap-3 group px-4 py-1 hover:bg-muted/30 transition-colors rounded-xl mx-2", isGrouped ? "mt-[-1.25rem]" : "mt-4")}>
                {!isGrouped ? (
                  <Avatar className="h-10 w-10 border-4 border-border shrink-0 shadow-sm mt-1">
                    <AvatarFallback className="bg-primary text-primary-foreground font-black uppercase text-xs">
                      {msg.username.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-10 shrink-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground font-bold mt-2">{format(new Date(msg.created_at), "h:mm")}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {!isGrouped && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-sm uppercase tracking-tight hover:underline cursor-pointer">{msg.username}</span>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">{format(new Date(msg.created_at), "h:mm a")}</span>
                    </div>
                  )}

                  {editingId === msg.id ? (
                    <div className="flex flex-col gap-2 bg-card p-3 rounded-xl border-4 border-border shadow-neo mt-1">
                      <Input value={editContent} onChange={(e) => setEditContent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(msg.id); if (e.key === "Escape") setEditingId(null); }} className="border-2 font-bold" autoFocus />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(msg.id)} className="h-7 font-black text-[10px] uppercase">Save Changes</Button>
                        <Button size="sm" variant="neutral" onClick={() => setEditingId(null)} className="h-7 font-black text-[10px] uppercase">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/content">
                      <p className="text-sm font-medium leading-relaxed break-words">{msg.content}</p>

                      {/* Message Actions - Neo style */}
                      <div className="absolute right-0 top-[-20px] opacity-0 group-hover/content:opacity-100 transition-opacity flex gap-1 bg-card border-2 border-border rounded-md shadow-sm p-0.5">
                        <Button variant="noShadow" size="icon" className="h-6 w-6 hover:bg-accent"><Reply className="h-3 w-3" /></Button>
                        <Button variant="noShadow" size="icon" className="h-6 w-6 hover:bg-accent"><Smile className="h-3 w-3" /></Button>
                        {isMe && (
                          <>
                            <Button variant="noShadow" size="icon" className="h-6 w-6 hover:bg-accent" onClick={() => startEdit(msg)}><Edit2 className="h-3 w-3" /></Button>
                            <Button variant="noShadow" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => deleteMessage(msg.id)}><Trash2 className="h-3 w-3" /></Button>
                          </>
                        )}
                        <Button variant="noShadow" size="icon" className="h-6 w-6 hover:bg-accent"><MoreHorizontal className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 bg-muted/10">
        <div className="relative group">
          <Input placeholder={`Shoot a message in #${channelName.toLowerCase()}...`} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()} disabled={loading} className="pr-12 h-12 border-4 border-border focus:border-primary transition-all font-bold placeholder:italic rounded-xl shadow-inner-lg" />
          <Button onClick={sendMessage} disabled={loading || !newMessage.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg" size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
