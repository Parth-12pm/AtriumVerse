"use client";

import { useState, useEffect, useRef } from "react";
import { Send, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EventBus from "@/game/EventBus";
import { getCommunicationManager } from "@/game/managers/CommunicationManager";
import { format } from "date-fns";

interface ZoneMessage {
  sender: string;
  username: string;
  text: string;
  timestamp: string;
  temporary: boolean;
}

export default function ProximityChat() {
  const [isInZone, setIsInZone] = useState(false);
  const [currentZoneName, setCurrentZoneName] = useState("");
  const [messages, setMessages] = useState<ZoneMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const MAX_MESSAGES = 20; // Keep only last 20 messages

  const handleZoneEntered = (zoneData: any) => {
    setIsInZone(true);
    setCurrentZoneName(zoneData.name || "Unknown Zone");
    setMessages([]); // Clear messages when entering new zone
    setIsMinimized(false);
  };

  const handleZoneExited = () => {
    setIsInZone(false);
    setCurrentZoneName("");
    setMessages([]);
    setIsMinimized(false);
  };

  const handleZoneMessage = (msg: ZoneMessage) => {
    setMessages((prev) => {
      const updated = [...prev, msg];
      // Keep only last MAX_MESSAGES
      if (updated.length > MAX_MESSAGES) {
        return updated.slice(-MAX_MESSAGES);
      }
      return updated;
    });
  };

  useEffect(() => {
    // Listen for zone events
    EventBus.on("zone:confirmed_entry", handleZoneEntered);
    EventBus.on("zone:confirmed_exit", handleZoneExited);
    EventBus.on("chat:zone_message", handleZoneMessage);

    return () => {
      EventBus.off("zone:confirmed_entry", handleZoneEntered);
      EventBus.off("zone:confirmed_exit", handleZoneExited);
      EventBus.off("chat:zone_message", handleZoneMessage);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const commManager = getCommunicationManager();
    if (commManager) {
      commManager.sendZoneMessage(newMessage.trim());
      setNewMessage("");
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "h:mm a");
    } catch {
      return "";
    }
  };

  // Don't render if not in a zone
  if (!isInZone) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 bg-white border-4 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all ${
        isMinimized ? "w-64" : "w-96"
      }`}
      style={{ zIndex: 30 }}
    >
      {/* Header */}
      <div className="p-3 border-b-4 border-black bg-green-500 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white border-2 border-black rounded-full flex items-center justify-center">
            <MapPin className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">Send nearby</h3>
            <p className="text-xs text-green-100">{currentZoneName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setIsMinimized(!isMinimized)}
            variant="neutral"
            size="icon"
            className="w-6 h-6 bg-white hover:bg-gray-100 p-0"
            title={isMinimized ? "Expand" : "Minimize"}
          >
            {isMinimized ? "+" : "−"}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-48 overflow-y-auto p-3 space-y-2 bg-gradient-to-b from-green-50 to-white"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MapPin className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 font-bold">
                  No messages yet
                </p>
                <p className="text-xs text-gray-400">
                  Say hi to nearby people!
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className="bg-white border-2 border-black rounded-lg p-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-black text-xs text-gray-800">
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t-4 border-black bg-gray-50">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                variant="default"
                className="bg-green-500 text-white hover:bg-green-600"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Messages here are not saved
            </p>
          </div>
        </>
      )}
    </div>
  );
}
