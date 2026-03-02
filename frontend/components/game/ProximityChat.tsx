"use client";

import { useState, useEffect, useRef } from "react";
import { Send, X } from "lucide-react";
import EventBus from "@/game/EventBus";

interface ProximityMessage {
  sender: string;
  username: string;
  text: string;
  timestamp: string;
}

const MAX_MESSAGES = 50;

export default function ProximityChat() {
  const [messages, setMessages] = useState<ProximityMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleMessage = (data: ProximityMessage) => {
      setMessages((prev) => {
        const updated = [...prev, data];
        return updated.length > MAX_MESSAGES
          ? updated.slice(-MAX_MESSAGES)
          : updated;
      });
      setIsVisible(true);
    };
    EventBus.on("chat:proximity_message", handleMessage);
    return () => {
      EventBus.off("chat:proximity_message", handleMessage);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isVisible]);

  useEffect(() => {
    const handleToggleChat = (visible: boolean) => {
      setIsVisible(visible);
      if (visible) setTimeout(() => inputRef.current?.focus(), 50);
    };
    EventBus.on("action:toggle_chat", handleToggleChat);
    return () => {
      EventBus.off("action:toggle_chat", handleToggleChat);
    };
  }, []);

  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;
    EventBus.emit("proximity:send_message", { message: text });
    setNewMessage("");
  };

  const stopKeys = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") sendMessage();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] pointer-events-auto w-72 flex flex-col rounded-xl overflow-hidden border border-border bg-background/95 backdrop-blur shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-muted-foreground text-[10px] font-mono font-bold tracking-wider uppercase">
          Nearby Chat
        </span>
        <button
          onClick={() => {
            setIsVisible(false);
            EventBus.emit("action:toggle_chat", false);
          }}
          className="text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {/* Message feed */}
      <div
        ref={scrollRef}
        className="max-h-[180px] overflow-y-auto flex flex-col gap-[2px] p-2"
        style={{ scrollbarWidth: "none" }}
      >
        {messages.length === 0 ? (
          <p className="text-center text-[10px] text-muted-foreground/70 font-mono py-3">
            — no messages yet —
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className="text-[12px] leading-snug px-2 py-[2px] text-foreground"
            >
              <span className="font-semibold text-primary">{msg.username}</span>
              <span className="text-muted-foreground">: </span>
              <span className="text-foreground/90">{msg.text}</span>
            </div>
          ))
        )}
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-2 py-2 border-t border-border">
        <input
          ref={inputRef}
          type="text"
          placeholder="Message nearby…"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={stopKeys}
          onKeyUp={(e) => e.stopPropagation()}
          onFocus={() => EventBus.emit("ui:focus")}
          onBlur={() => EventBus.emit("ui:blur")}
          className="flex-1 bg-transparent text-foreground text-[12px] placeholder:text-muted-foreground/70 outline-none min-w-0"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-violet-600 disabled:opacity-30 hover:bg-violet-500 transition-colors shrink-0"
        >
          <Send className="w-3 h-3 text-white" />
        </button>
      </div>
    </div>
  );
}
