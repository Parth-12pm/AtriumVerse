"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  LogOut,
  Computer,
} from "lucide-react";
import EventBus from "@/game/EventBus";

interface MediaControlsProps {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onExit?: () => void;
}

export function MediaControls({
  onAudioToggle,
  onVideoToggle,
  onExit,
}: MediaControlsProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Sync state with ProximityChat visibility
  useEffect(() => {
    const handleChatToggle = (isOpen: boolean) => setChatOpen(isOpen);
    EventBus.on("ui:chat_toggled", handleChatToggle);
    return () => {
      EventBus.off("ui:chat_toggled", handleChatToggle);
    };
  }, []);

  const handleAudioToggle = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    onAudioToggle?.(next);
    EventBus.emit("action:toggle_mic", next);
  };

  const handleVideoToggle = () => {
    const next = !videoEnabled;
    setVideoEnabled(next);
    onVideoToggle?.(next);
    EventBus.emit("action:toggle_cam", next);
  };

  const toggleChat = () => {
    const next = !chatOpen;
    setChatOpen(next);
    EventBus.emit("action:toggle_chat", next);
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-2 border-black rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] pointer-events-auto">
      {/* Mic toggle */}
      <button
        onClick={handleAudioToggle}
        title={audioEnabled ? "Mute microphone" : "Unmute microphone"}
        className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none ${
          audioEnabled ? "bg-green-400 text-black" : "bg-red-500 text-white"
        }`}
      >
        {audioEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <MicOff className="w-5 h-5" />
        )}
      </button>

      {/* Camera toggle */}
      <button
        onClick={handleVideoToggle}
        title={videoEnabled ? "Stop camera" : "Start camera"}
        className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none ${
          videoEnabled ? "bg-green-400 text-black" : "bg-red-500 text-white"
        }`}
      >
        {videoEnabled ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </button>

      {/* Screen share (placeholder) */}
      <button
        disabled
        title="Screen share coming soon"
        className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-black bg-gray-700 text-gray-400 opacity-50 cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      >
        <Computer className="w-5 h-5" />
      </button>

      <div className="w-[3px] h-8 bg-black/40 rounded-full mx-1" />

      {/* Chat toggle */}
      <button
        onClick={toggleChat}
        title="Toggle proximity chat"
        className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none ${
          chatOpen
            ? "bg-violet-500 text-white"
            : "bg-white text-black hover:bg-gray-100"
        }`}
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Exit */}
      {onExit && (
        <>
          <div className="w-[3px] h-8 bg-black/40 rounded-full mx-1" />
          <Button
            variant="default"
            size="icon"
            onClick={onExit}
            title="Exit to dashboard"
            className="w-12 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  );
}
