"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import {
  Users,
  Link,
  MicOff,
  Maximize2,
  Minimize2,
  PhoneOff,
} from "lucide-react";
import EventBus, { GameEvents } from "@/game/EventBus";
import {
  fetchLiveKitToken,
  getLiveKitUrl,
  createInviteLink,
} from "@/lib/livekit";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ZoneVideoRoomProps {
  serverId: string;
}

// ── Inner component to listen to dock events and control LiveKit ──────────────
function DockEventListener() {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    const handleMic = async (enabled: boolean) => {
      await localParticipant.setMicrophoneEnabled(enabled);
    };
    const handleCam = async (enabled: boolean) => {
      await localParticipant.setCameraEnabled(enabled);
    };

    EventBus.on("action:toggle_mic", handleMic);
    EventBus.on("action:toggle_cam", handleCam);

    return () => {
      EventBus.off("action:toggle_mic", handleMic);
      EventBus.off("action:toggle_cam", handleCam);
    };
  }, [localParticipant]);

  return null;
}

// ── Video grid ─────────────────────────────────────────────────────────────────
function VideoGrid({
  roomName,
  onLeave,
}: {
  roomName: string;
  onLeave: () => void;
}) {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });
  const participants = useParticipants();
  const [copying, setCopying] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div
      className={`flex bg-gray-900/95 backdrop-blur border-b-4 border-l-4 border-r-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] pointer-events-auto overflow-hidden transition-all duration-300 relative ${
        expanded
          ? "w-[90vw] h-[80vh] flex-col rounded-xl top-4 mt-6"
          : "items-center gap-3 p-3 rounded-b-2xl overflow-x-auto max-w-[80vw]"
      }`}
    >
      {/* ── Action Buttons (Left in Strip, Top in Expanded) ── */}
      <div
        className={`flex ${
          expanded
            ? "flex-row p-4 border-b-4 border-black bg-gray-800 justify-end items-center"
            : "flex-col justify-center items-center px-2 border-r-2 border-white/10 mr-1 gap-2"
        }`}
      >
        <div className="flex gap-2">
          {/* Leave Button */}
          <Button
            onClick={onLeave}
            variant="default"
            size="icon"
            className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shrink-0"
            title="Leave Conference"
          >
            <PhoneOff className="h-4 w-4" />
          </Button>

          {/* Invite Button */}
          <Button
            onClick={copyInvite}
            disabled={copying}
            variant="default"
            size="icon"
            className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shrink-0"
            title="Copy invite link"
          >
            <Link className="h-4 w-4" />
          </Button>

          {/* Expand/Shrink Button */}
          <Button
            onClick={() => setExpanded(!expanded)}
            variant="default"
            size="icon"
            className="w-10 h-10 rounded-xl bg-gray-700 hover:bg-gray-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:translate-x-[1px] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none shrink-0"
            title={expanded ? "Shrink to top bar" : "Expand to grid"}
          >
            {expanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Video Tiles ── */}
      <div
        className={`flex ${
          expanded
            ? "flex-wrap p-4 gap-4 overflow-y-auto w-full h-[calc(100%-80px)] justify-center content-start"
            : "gap-3"
        }`}
      >
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 min-w-[160px] text-white/50 text-xs font-bold font-mono">
            <Users className="w-6 h-6 mb-2" />
            WAITING FOR OTHERS
          </div>
        ) : (
          cameraTracks.map((trackRef) => (
            <div
              key={trackRef.participant.identity}
              className={`relative rounded-xl overflow-hidden bg-gray-800 border-2 border-black aspect-video flex items-center justify-center group shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0 max-h-[100%] ${
                expanded ? "w-[400px] max-w-full" : "w-48"
              }`}
            >
              {trackRef.participant.isCameraEnabled ? (
                <VideoTrack
                  trackRef={trackRef}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white font-bold text-2xl">
                  {trackRef.participant.name?.[0]?.toUpperCase() ||
                    trackRef.participant.identity[0].toUpperCase()}
                </div>
              )}

              <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/80 rounded border border-white/20 text-white text-[10px] font-bold z-10">
                {trackRef.participant.name ||
                  trackRef.participant.identity.slice(0, 8)}
              </div>
              {!trackRef.participant.isMicrophoneEnabled && (
                <div className="absolute top-1 right-1 px-1.5 py-1 bg-red-600 rounded-full border border-black z-10">
                  <MicOff className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main component — SINGLE INSTANCE floating at top ───────────────────────────
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
      } catch (err) {
        console.error("[ZoneVideo] Token fetch failed:", err);
      } finally {
        setConnecting(false);
      }
    };

    const handleZoneExit = () => {
      setToken(null);
      setZoneId(null);
    };

    EventBus.on(GameEvents.ZONE_ENTER, handleZoneEnter);
    EventBus.on(GameEvents.ZONE_EXIT, handleZoneExit);
    return () => {
      EventBus.off(GameEvents.ZONE_ENTER, handleZoneEnter);
      EventBus.off(GameEvents.ZONE_EXIT, handleZoneExit);
    };
  }, []);

  const handleLeave = useCallback(() => {
    setToken(null);
    setZoneId(null);
  }, []);

  const isActive = !!token && !!zoneId;

  // Hidden when not in a zone
  if (!isActive && !connecting) return null;

  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none">
      {/* Header bar matching Gather town style */}
      <div className="bg-black text-white text-[10px] font-black tracking-wider px-4 py-1 rounded-b-lg flex items-center gap-2 pointer-events-auto">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        {connecting
          ? "JOINING SECURE ROOM..."
          : `ROOM // ${zoneId?.toUpperCase()}`}
      </div>

      {isActive && (
        <LiveKitRoom
          token={token!}
          serverUrl={getLiveKitUrl()}
          connect
          video={false}
          audio={false}
          onDisconnected={handleLeave}
        >
          <DockEventListener />
          <VideoGrid
            roomName={`video_${zoneId}`}
            onLeave={() => EventBus.emit("action:leave_conference")}
          />
        </LiveKitRoom>
      )}
    </div>
  );
}
