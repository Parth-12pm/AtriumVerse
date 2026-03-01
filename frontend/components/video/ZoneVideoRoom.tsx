"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
  RoomAudioRenderer,
  useChat,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Users, MicOff, Send, Link2, Maximize, Minimize } from "lucide-react";
import EventBus, { GameEvents } from "@/game/EventBus";
import { getProximityAudio } from "@/lib/livekit-audio";
import {
  fetchLiveKitToken,
  getLiveKitUrl,
  createInviteLink,
} from "@/lib/livekit";
import { toast } from "sonner";

interface ZoneVideoRoomProps {
  serverId: string;
}

// ── Bridge dock toggles → LiveKit ─────────────────────────────────────────────
function DockEventListener() {
  const { localParticipant } = useLocalParticipant();
  const sharingRef = useRef(false);

  useEffect(() => {
    const handleMic = async (enabled: boolean) =>
      localParticipant.setMicrophoneEnabled(enabled);
    const handleCam = async (enabled: boolean) =>
      localParticipant.setCameraEnabled(enabled);
    const handleScreen = async () => {
      sharingRef.current = !sharingRef.current;
      await localParticipant.setScreenShareEnabled(sharingRef.current);
    };
    EventBus.on("action:toggle_mic", handleMic);
    EventBus.on("action:toggle_cam", handleCam);
    EventBus.on("action:toggle_screen", handleScreen);
    return () => {
      EventBus.off("action:toggle_mic", handleMic);
      EventBus.off("action:toggle_cam", handleCam);
      EventBus.off("action:toggle_screen", handleScreen);
    };
  }, [localParticipant]);

  return null;
}

// ── Meeting chat sidebar ──────────────────────────────────────────────────────
function MeetingChat({ roomLabel }: { roomLabel: string }) {
  const { chatMessages, send } = useChat();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatMessages]);

  const sendMsg = () => {
    const t = text.trim();
    if (!t || !send) return;
    send(t);
    setText("");
  };

  return (
    <div className="w-72 shrink-0 flex flex-col bg-black/30 border-l border-white/10">
      <div className="px-4 py-3 border-b border-white/10">
        <span className="text-white/70 text-sm font-semibold">
          Meeting Chat
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {chatMessages.length === 0 ? (
          <p className="text-white/25 text-xs text-center mt-8 font-mono">
            No messages yet
          </p>
        ) : (
          chatMessages.map((m, i) => (
            <div key={i} className="text-[13px] text-white/80">
              <span className="font-semibold text-violet-300 mr-1">
                {m.from?.name ?? "?"}
              </span>
              {m.message}
            </div>
          ))
        )}
      </div>
      <div className="px-4 py-3 border-t border-white/10 flex gap-2 items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") sendMsg();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder={`Message ${roomLabel}`}
          onFocus={() => EventBus.emit("ui:focus")}
          onBlur={() => EventBus.emit("ui:blur")}
          className="flex-1 bg-white/5 text-white text-[13px] placeholder:text-white/25 rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-white/30"
        />
        <button
          onClick={sendMsg}
          disabled={!text.trim()}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 shrink-0 transition-colors"
        >
          <Send className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}

// ── Participant tile (camera/avatar + optional screen share tile) ──────────────
type Participant = ReturnType<typeof useParticipants>[0];
type TrackRef = Parameters<typeof VideoTrack>[0]["trackRef"];

function ParticipantTile({
  participant,
  cameraTrack,
  screenTrack,
  compact,
  isScreenPinned = false,
  onPinScreen,
}: {
  participant: Participant;
  cameraTrack?: TrackRef;
  screenTrack?: TrackRef;
  compact: boolean;
  isScreenPinned?: boolean;
  onPinScreen?: (ref: TrackRef | null) => void;
}) {
  // If compact: fixed small size
  // If expanded: flexible size that grows to fill row (Gather.town style)
  const sizeClass = compact
    ? "w-[148px] h-[116px] rounded-xl shrink-0"
    : "flex-grow shrink-0 basis-[300px] min-w-[200px] max-w-[600px] aspect-video rounded-2xl";

  return (
    <>
      {/* Camera / avatar tile */}
      <div
        className={`relative overflow-hidden bg-gray-900 flex items-center justify-center ${sizeClass}`}
      >
        {cameraTrack && participant.isCameraEnabled ? (
          <VideoTrack
            trackRef={cameraTrack}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="relative w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-2xl uppercase">
            {participant.name?.charAt(0) || participant.identity.charAt(0)}
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/90 to-transparent text-white text-[11px] font-medium truncate">
          {participant.name || participant.identity.slice(0, 10)}
        </div>
        {!participant.isMicrophoneEnabled && (
          <div className="absolute top-2 right-2 bg-red-600/90 rounded-full p-1">
            <MicOff className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Screen share tile — shown next to main tile when active */}
      {screenTrack && (
        <div
          className={`relative overflow-hidden bg-black flex items-center justify-center border border-indigo-400/40 group ${sizeClass}`}
        >
          <VideoTrack
            trackRef={screenTrack}
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/80 text-indigo-300 text-[10px] font-medium text-center">
            {participant.name || participant.identity.slice(0, 6)} — screen
          </div>
          {/* Pin Toggle Button (Expanded mode only) */}
          {!compact && onPinScreen && (
            <button
              onClick={() => onPinScreen(isScreenPinned ? null : screenTrack)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-indigo-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
              title={isScreenPinned ? "Unpin screen" : "Pin screen"}
            >
              {isScreenPinned ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── VideoGrid ─────────────────────────────────────────────────────────────────
function VideoGrid({
  roomName,
  roomLabel,
  onLeave,
}: {
  roomName: string;
  roomLabel: string;
  onLeave: () => void;
}) {
  const cameraTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare],
    { onlySubscribed: false },
  );
  const participants = useParticipants();
  const [expanded, setExpanded] = useState(false);
  const [copying, setCopying] = useState(false);
  const [pinnedTrack, setPinnedTrack] = useState<TrackRef | null>(null);

  useEffect(() => {
    const handleExpand = (val: boolean) => {
      setExpanded(val);
      if (!val) setPinnedTrack(null);
      EventBus.emit(val ? "game:pause" : "game:resume");
    };
    EventBus.on("action:toggle_video_expand", handleExpand);
    EventBus.on("action:leave_conference", onLeave);
    return () => {
      EventBus.off("action:toggle_video_expand", handleExpand);
      EventBus.off("action:leave_conference", onLeave);
    };
  }, [onLeave]);

  // Track helpers
  const getCameraTrack = (p: Participant): TrackRef | undefined =>
    cameraTracks.find(
      (t) =>
        t.participant.identity === p.identity &&
        t.source === Track.Source.Camera,
    );
  const getScreenTrack = (p: Participant): TrackRef | undefined =>
    cameraTracks.find(
      (t) =>
        t.participant.identity === p.identity &&
        t.source === Track.Source.ScreenShare,
    );

  const copyInvite = async () => {
    setCopying(true);
    try {
      const url = await createInviteLink(roomName);
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    } catch {
      toast.error("Failed to create invite link");
    } finally {
      setCopying(false);
    }
  };

  // ── EXPANDED: fixed inset-0 z-[45]
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[45] bg-[#09090b] flex flex-col overflow-hidden pl-18 pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white font-semibold">{roomLabel}</span>
            <span className="text-white/40 text-xs">
              {participants.length} participant
              {participants.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={copyInvite}
            disabled={copying}
            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copying ? "Copying…" : "Copy invite link"}
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {pinnedTrack ? (
            // PINNED LAYOUT: Screen share takes most of the space, others in a scrolling strip alongside
            <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
              {/* Pinned main view */}
              <div className="flex-1 min-h-0 bg-black rounded-2xl border border-indigo-500/30 overflow-hidden relative group">
                <VideoTrack
                  trackRef={pinnedTrack}
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={() => setPinnedTrack(null)}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-indigo-600 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
                  title="Unpin screen"
                >
                  <Minimize className="w-4 h-4" />
                </button>
              </div>
              {/* Strip of other participants */}
              <div className="h-32 shrink-0 flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {participants.map((p) => (
                  <ParticipantTile
                    key={p.identity}
                    participant={p}
                    cameraTrack={getCameraTrack(p)}
                    screenTrack={
                      getScreenTrack(p)?.publication.trackSid !==
                      pinnedTrack.publication.trackSid
                        ? getScreenTrack(p)
                        : undefined
                    }
                    compact={true} // use small sizing for the strip
                  />
                ))}
              </div>
            </div>
          ) : (
            // GRID LAYOUT: Flex wrap, items grow to fill space
            <div className="flex-1 p-8 flex flex-wrap justify-center align-middle content-center items-center gap-5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {participants.length === 0 ? (
                <div className="flex flex-col items-center gap-3 text-white/25">
                  <Users className="w-14 h-14" />
                  <span className="font-mono text-sm">
                    Waiting for others to join…
                  </span>
                </div>
              ) : (
                participants.map((p) => (
                  <ParticipantTile
                    key={p.identity}
                    participant={p}
                    cameraTrack={getCameraTrack(p)}
                    screenTrack={getScreenTrack(p)}
                    compact={false}
                    onPinScreen={setPinnedTrack}
                  />
                ))
              )}
            </div>
          )}
          <MeetingChat roomLabel={roomLabel} />
        </div>
      </div>
    );
  }

  // ── COMPACT strip — fixed, top-center ──────────────────────────────────────
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-black/75 backdrop-blur-sm rounded-2xl px-3 py-2.5 pointer-events-auto max-w-[calc(100vw-200px)] overflow-x-auto scrollbar-none">
      {participants.length === 0 ? (
        <div className="w-[148px] h-[116px] rounded-xl bg-gray-900 border border-white/10 flex flex-col items-center justify-center gap-2 shrink-0">
          <Users className="w-6 h-6 text-white/30" />
          <span className="text-[9px] text-white/30 font-mono">EMPTY</span>
        </div>
      ) : (
        participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            cameraTrack={getCameraTrack(p)}
            screenTrack={getScreenTrack(p)}
            compact={true}
          />
        ))
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function ZoneVideoRoom({ serverId }: ZoneVideoRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const handleZoneEnter = async (data: {
      zoneId: string;
      zoneType: string;
    }) => {
      if (data.zoneType !== "PRIVATE") return;
      setConnecting(true);
      try {
        const t = await fetchLiveKitToken(`video_${data.zoneId}`);
        setToken(t);
        setZoneId(data.zoneId);
        getProximityAudio().setMicEnabled(false);
        await getProximityAudio().disconnect();
        EventBus.emit("ui:video_room_joined");
      } catch (err) {
        console.error("[ZoneVideo] Token fetch failed:", err);
      } finally {
        setConnecting(false);
      }
    };

    const handleZoneExit = () => {
      setToken(null);
      setZoneId(null);
      EventBus.emit("ui:video_room_left");
      EventBus.emit("game:resume");
      getProximityAudio().connect(serverId);
    };

    EventBus.on(GameEvents.ZONE_ENTER, handleZoneEnter);
    EventBus.on(GameEvents.ZONE_EXIT, handleZoneExit);
    return () => {
      EventBus.off(GameEvents.ZONE_ENTER, handleZoneEnter);
      EventBus.off(GameEvents.ZONE_EXIT, handleZoneExit);
    };
  }, [serverId]);

  const handleLeave = useCallback(() => {
    setToken(null);
    setZoneId(null);
    EventBus.emit("action:toggle_video_expand", false);
    EventBus.emit("ui:video_room_left");
    EventBus.emit("game:resume");
    getProximityAudio().connect(serverId);
  }, [serverId]);

  const isActive = !!token && !!zoneId;
  if (!isActive && !connecting) return null;

  if (connecting) {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-black/70 backdrop-blur-sm text-white/60 text-[11px] font-mono px-4 py-2 rounded-xl flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
        Joining conference…
      </div>
    );
  }

  const roomLabel = zoneId
    ? zoneId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  return (
    <LiveKitRoom
      token={token!}
      serverUrl={getLiveKitUrl()}
      connect
      video={false}
      audio={true}
      onDisconnected={handleLeave}
    >
      <RoomAudioRenderer />
      <DockEventListener />
      <VideoGrid
        roomName={`video_${zoneId}`}
        roomLabel={roomLabel}
        onLeave={handleLeave}
      />
    </LiveKitRoom>
  );
}
