"use client";

import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Smile,
  Pencil,
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
  const DEFAULTS = ["👍", "❤️", "😂", "🎉", "👏"];
  const [quickEmojis, setQuickEmojis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("quickReactions");
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length === 5 ? parsed : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });
  const [editMode, setEditMode] = useState(false); // pencil → edit slots
  const [editSlot, setEditSlot] = useState<number | null>(null); // which slot is being replaced
  const [customEmoji, setCustomEmoji] = useState("");

  const ALL_EMOJIS = [
    "👍",
    "❤️",
    "😂",
    "🎉",
    "👏",
    "🔥",
    "😍",
    "😱",
    "🥳",
    "💯",
    "👀",
    "🫡",
    "😎",
    "🤔",
    "💀",
    "✨",
    "🙌",
    "😭",
    "🤣",
    "🫶",
  ];

  const assignSlot = (emoji: string) => {
    if (editSlot === null) return;
    const next = [...quickEmojis];
    next[editSlot] = emoji;
    setQuickEmojis(next);
    localStorage.setItem("quickReactions", JSON.stringify(next));
    setEditSlot(null);
    setCustomEmoji("");
  };

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

  const sendReaction = (emoji: string) => {
    if (!emoji) return;
    EventBus.emit("action:react", { emoji });
    // deliberately DO NOT close the picker — allows spamming
  };

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

        {/* Chat toggle */}
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

        {/* Emoji Reactions */}
        <div className="w-px  h-6 bg-white/15 mx-0.5" />

        <Popover
          onOpenChange={(open) => {
            if (!open) {
              setEditMode(false);
              setEditSlot(null);
            }
          }}
        >
          <PopoverTrigger asChild>
            <button
              title="React"
              className={`${BTN} bg-white/10 text-white hover:bg-white/20`}
            >
              <Smile className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={10}
            className="w-auto p-0 mb-1 bg-gray-900 border-2 border-black rounded-xl shadow-2xl overflow-hidden"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {!editMode ? (
              /* ── Quick mode: 5 slots + pencil ── */
              <div className="flex items-center gap-1 px-2 py-1.5">
                {quickEmojis.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => sendReaction(emoji)}
                    className="w-10 h-10 flex items-center justify-center text-xl rounded-lg hover:bg-white/10 active:scale-90 transition-all"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
                <div className="w-px h-7 bg-white/10 mx-0.5" />
                <button
                  onClick={() => {
                    setEditMode(true);
                    setEditSlot(0);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-all"
                  title="Customize reactions"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              /* ── Edit mode ── */
              <div className="flex flex-col min-w-[220px]">
                {/* Slot selector */}
                <div className="flex items-center gap-1 px-2 pt-2 pb-1">
                  <span className="text-[10px] text-white/40 font-mono uppercase tracking-wider mr-1">
                    Slot
                  </span>
                  {quickEmojis.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => setEditSlot(i)}
                      className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg border-2 transition-all ${
                        editSlot === i
                          ? "border-indigo-400 bg-indigo-600/30"
                          : "border-transparent hover:bg-white/10"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-indigo-300/70 px-3 pb-1">
                  {editSlot !== null
                    ? `Replacing slot ${editSlot + 1} — pick below`
                    : "Select a slot above"}
                </p>
                {/* Full emoji grid */}
                <div className="grid grid-cols-5 gap-0.5 px-2 pb-1">
                  {ALL_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => assignSlot(emoji)}
                      disabled={editSlot === null}
                      className="w-9 h-9 flex items-center justify-center text-lg rounded-lg hover:bg-white/10 active:scale-90 disabled:opacity-30 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className="flex gap-1 px-2 pb-2 pt-1 border-t border-white/8">
                  <input
                    type="text"
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value)}
                    onFocus={() => EventBus.emit("ui:focus")}
                    onBlur={() => EventBus.emit("ui:blur")}
                    placeholder="Custom emoji"
                    maxLength={2}
                    className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400/60 text-center"
                  />
                  <button
                    onClick={() => {
                      if (customEmoji.trim()) assignSlot(customEmoji.trim());
                    }}
                    disabled={!customEmoji.trim() || editSlot === null}
                    className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white text-xs font-semibold transition-all"
                  >
                    Assign
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEditMode(false);
                    setEditSlot(null);
                  }}
                  className="w-full py-1.5 text-[11px] text-white/40 hover:text-white/70 border-t border-white/8 hover:bg-white/5 transition-all"
                >
                  ← Back to reactions
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
