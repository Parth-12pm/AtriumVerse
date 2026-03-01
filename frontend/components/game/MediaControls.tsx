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
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import EventBus from "@/game/EventBus";

interface MediaControlsProps {
  onAudioToggle?: (enabled: boolean) => void;
  onVideoToggle?: (enabled: boolean) => void;
  onExit?: () => void;
}

const BTN =
  "w-10 h-10 rounded-lg flex items-center justify-center border-2 border-black transition-all hover:brightness-110 active:scale-95";

export function MediaControls({
  onAudioToggle,
  onVideoToggle,
  onExit,
}: MediaControlsProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [inVideoCall, setInVideoCall] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);

  useEffect(() => {
    const handleChatToggle = (isOpen: boolean) => setChatOpen(isOpen);
    const handleVideoJoined = () => setInVideoCall(true);
    const handleVideoLeft = () => {
      setInVideoCall(false);
      setVideoExpanded(false);
      setScreenSharing(false);
    };
    const handleVideoExpanded = (expanded: boolean) =>
      setVideoExpanded(expanded);

    EventBus.on("ui:chat_toggled", handleChatToggle);
    EventBus.on("ui:video_room_joined", handleVideoJoined);
    EventBus.on("ui:video_room_left", handleVideoLeft);
    EventBus.on("ui:video_expanded", handleVideoExpanded);
    return () => {
      EventBus.off("ui:chat_toggled", handleChatToggle);
      EventBus.off("ui:video_room_joined", handleVideoJoined);
      EventBus.off("ui:video_room_left", handleVideoLeft);
      EventBus.off("ui:video_expanded", handleVideoExpanded);
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

  const handleScreenShare = () => {
    const next = !screenSharing;
    setScreenSharing(next);
    EventBus.emit("action:toggle_screen", next);
  };

  const toggleChat = () => {
    const next = !chatOpen;
    setChatOpen(next);
    EventBus.emit("action:toggle_chat", next);
  };

  const toggleVideoExpand = () => {
    const next = !videoExpanded;
    setVideoExpanded(next);
    EventBus.emit("action:toggle_video_expand", next);
  };

  const leaveConference = () => EventBus.emit("action:leave_conference");

  return (
    // Outer wrapper — relative so ProximityChat can be positioned absolute to this
    <div className="relative flex items-end gap-2 pointer-events-auto">
      {/* ── Main dock bar ─────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-2 border-black rounded-xl">
        {/* Mic */}
        <button
          onClick={handleAudioToggle}
          title={audioEnabled ? "Mute" : "Unmute"}
          className={`${BTN} ${audioEnabled ? "bg-green-400 text-black" : "bg-red-500 text-white"}`}
        >
          {audioEnabled ? (
            <Mic className="w-4 h-4" />
          ) : (
            <MicOff className="w-4 h-4" />
          )}
        </button>

        {/* Camera */}
        <button
          onClick={handleVideoToggle}
          title={videoEnabled ? "Stop camera" : "Start camera"}
          className={`${BTN} ${videoEnabled ? "bg-green-400 text-black" : "bg-red-500 text-white"}`}
        >
          {videoEnabled ? (
            <Video className="w-4 h-4" />
          ) : (
            <VideoOff className="w-4 h-4" />
          )}
        </button>

        {/* Screen share — only in a video call */}
        {inVideoCall ? (
          <button
            onClick={handleScreenShare}
            title={screenSharing ? "Stop sharing" : "Share screen"}
            className={`${BTN} ${screenSharing ? "bg-green-400 text-black" : "bg-gray-700 text-white"}`}
          >
            {screenSharing ? (
              <ScreenShareOff className="w-4 h-4" />
            ) : (
              <ScreenShare className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            disabled
            title="Screen share — join a conference first"
            className={`${BTN} bg-gray-800 text-gray-600 opacity-40 cursor-not-allowed`}
          >
            <ScreenShare className="w-4 h-4" />
          </button>
        )}

        {/* Video call controls — expand & leave */}
        {inVideoCall && (
          <>
            <div className="w-px h-6 bg-white/15 mx-0.5" />
            <button
              onClick={toggleVideoExpand}
              title={videoExpanded ? "Shrink to strip" : "Expand conference"}
              className={`${BTN} bg-gray-700 text-white hover:bg-gray-600`}
            >
              {videoExpanded ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={leaveConference}
              title="Leave Conference"
              className={`${BTN} bg-red-600 text-white`}
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Exit to dashboard */}
        {onExit && (
          <>
            <div className="w-px h-6 bg-white/15 mx-0.5" />
            <Button
              variant="default"
              size="icon"
              onClick={onExit}
              title="Exit to dashboard"
              className="w-10 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white border-2 border-black"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Chat toggle — LAST button — proximity chat expands to the right */}
        <div className="w-px h-6 bg-white/15 mx-0.5" />
        <button
          onClick={toggleChat}
          title="Toggle proximity chat"
          className={`${BTN} ${
            chatOpen
              ? "bg-violet-500 text-white"
              : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
