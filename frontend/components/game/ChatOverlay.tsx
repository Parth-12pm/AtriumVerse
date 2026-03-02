"use client";

import { useEffect, useRef, useState } from "react";
import EventBus, { GameEvents } from "@/game/EventBus";
import { Send, MessageSquare } from "lucide-react";
import { formatChatTimestamp } from "@/lib/time";

interface ChatMessage {
  id: string;
  sender: string;
  username: string;
  scope: "global" | "direct" | "proximity";
  text: string;
  timestamp: string;
}

interface IncomingChatEvent {
  sender?: string;
  username?: string;
  scope?: "global" | "direct" | "proximity";
  text: string;
  timestamp?: string;
}

export function ChatOverlay() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChat]);

  useEffect(() => {
    const handleMessage = (data: IncomingChatEvent) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(7),
          sender: data.sender || "System",
          username: data.username || "System",
          scope: data.scope || "global",
          text: data.text,
          timestamp: formatChatTimestamp(data.timestamp || new Date().toISOString()),
        },
      ]);
    };

    EventBus.on(GameEvents.CHAT_MESSAGE, handleMessage);
    return () => {
      EventBus.off(GameEvents.CHAT_MESSAGE, handleMessage);
    };
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;

    EventBus.emit(GameEvents.SEND_CHAT_MESSAGE, {
      message: inputText.trim(),
      scope: "global",
    });
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  if (!showChat) {
    return (
      <div className="absolute bottom-20 left-4 z-40">
        <button
          onClick={() => setShowChat(true)}
          className="bg-black/50 p-2 rounded-full text-white hover:bg-black/70"
        >
          <MessageSquare size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-20 left-4 z-40 flex flex-col gap-2 w-80 max-h-96">
      {/* Messages Container */}
      <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 flex flex-col gap-1 overflow-y-auto h-64 scrollbar-thin scrollbar-thumb-white/20">
        <div className="flex justify-between items-center mb-1 text-xs text-gray-400 border-b border-light-white/20 pb-1">
          <span>Global Chat</span>
          <button
            onClick={() => setShowChat(false)}
            className="hover:text-white"
          >
            Minimum
          </button>
        </div>

        {messages.length === 0 && (
          <div className="text-gray-500 text-xs italic text-center mt-10">
            No messages yet...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="text-sm break-words">
            <span className="text-[10px] text-gray-400 mr-1">
              [{msg.timestamp}]
            </span>
            <span
              className={`font-bold mr-1 ${
                msg.scope === "direct" ? "text-purple-400" : "text-yellow-400"
              }`}
            >
              {msg.username}:
            </span>
            <span className="text-white">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type message..."
          className="flex-1 bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-yellow-400/50"
        />
        <button
          onClick={handleSend}
          className="bg-yellow-500/80 hover:bg-yellow-500 text-black p-2 rounded-lg transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
