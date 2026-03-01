"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EventBus, { GameEvents } from "@/game/EventBus";
import { format } from "date-fns";

interface ProximityMessage {
  sender: string;
  username: string;
  text: string;
  timestamp: string;
}

const PROXIMITY_CHAT_RADIUS = 8; // must match backend constant
const MAX_MESSAGES = 30;

export default function ProximityChat() {
  const [messages, setMessages] = useState<ProximityMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track nearby player count from PLAYER_LIST_UPDATE
  useEffect(() => {
    // Get local player id from EventBus meta (emitted by GameWrapper on connect)
    const handlePlayerId = (id: string) => setMyId(id);
    EventBus.on("game:my_id", handlePlayerId);
    return () => {
      EventBus.off("game:my_id", handlePlayerId);
    };
  }, []);

  useEffect(() => {
    const handlePlayerList = (users: any[]) => {
      // Count players other than myself — the server already filtered by radius,
      // but we also show the stat locally using the full list for display only.
      setNearbyCount(Math.max(0, users.length - 1));
    };
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);
    return () => {
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);
    };
  }, []);

  // Receive proximity messages from the server (already filtered by distance)
  useEffect(() => {
    const handleMessage = (data: ProximityMessage) => {
      setMessages((prev) => {
        const updated = [...prev, data];
        return updated.length > MAX_MESSAGES
          ? updated.slice(-MAX_MESSAGES)
          : updated;
      });
      // Auto-expand when a message arrives while minimized
      setIsMinimized(false);
    };
    EventBus.on("chat:proximity_message", handleMessage);
    return () => {
      EventBus.off("chat:proximity_message", handleMessage);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isVisible, isMinimized]); // Re-scroll when opened

  // Listen to dock chat toggle
  useEffect(() => {
    const handleToggleChat = (visible: boolean) => setIsVisible(visible);
    EventBus.on("action:toggle_chat", handleToggleChat);
    return () => {
      EventBus.off("action:toggle_chat", handleToggleChat);
    };
  }, []);

  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;

    // Send via EventBus → MainScene pipes it to the WebSocket
    EventBus.emit("proximity:send_message", { message: text });
    setNewMessage("");
  };

  const formatTime = (ts: string) => {
    try {
      return format(new Date(ts), "h:mm a");
    } catch {
      return "";
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-24 right-4 bg-white border-4 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all ${
        isMinimized ? "w-64" : "w-80"
      }`}
      style={{ zIndex: 30 }}
    >
      {/* Header */}
      <div className="p-3 border-b-4 border-black bg-violet-600 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white border-2 border-black rounded-full flex items-center justify-center">
            <Users className="w-3 h-3 text-violet-600" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">Nearby Chat</h3>
            <p className="text-xs text-violet-200">
              {nearbyCount > 0
                ? `${nearbyCount} player${nearbyCount > 1 ? "s" : ""} nearby`
                : "No one within earshot"}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setIsMinimized(!isMinimized)}
          variant="neutral"
          size="icon"
          className="w-6 h-6 bg-white hover:bg-gray-100 p-0"
        >
          {isMinimized ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-44 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-violet-50 to-white"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Users className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-bold">
                  No messages yet
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Only players within {PROXIMITY_CHAT_RADIUS} tiles can see your
                  messages.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-white border-2 border-black rounded-lg p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-black text-xs text-violet-700">
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t-4 border-black bg-gray-50 rounded-b-lg">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Say something nearby…"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 text-sm"
                onFocus={() => EventBus.emit("ui:focus")}
                onBlur={() => EventBus.emit("ui:blur")}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="bg-violet-600 text-white hover:bg-violet-700 shrink-0"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Visible to players within {PROXIMITY_CHAT_RADIUS} tiles
            </p>
          </div>
        </>
      )}
    </div>
  );
}
