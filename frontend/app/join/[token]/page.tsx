"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  PhoneOff,
  Sparkles,
} from "lucide-react";

// ── Decode room name from LiveKit JWT ─────────────────────────────────────────
function decodeRoomFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.video?.room ?? "Video Room";
  } catch {
    return "Video Room";
  }
}

// ── Leave button (inside LiveKitRoom context) ─────────────────────────────────
function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext();
  const handleLeave = async () => {
    await room.disconnect();
    onLeave();
  };
  return (
    <button
      onClick={handleLeave}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white text-sm font-semibold shadow-lg"
      title="Leave call"
    >
      <PhoneOff className="w-4 h-4" />
      Leave
    </button>
  );
}

// ── Controls ──────────────────────────────────────────────────────────────────
function GuestControls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 shadow-xl">
      {/* Mic */}
      <button
        onClick={async () => {
          const next = !micOn;
          await localParticipant.setMicrophoneEnabled(next);
          setMicOn(next);
        }}
        className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 text-white active:scale-95 ${
          micOn
            ? "bg-indigo-600 border-indigo-400 shadow-indigo-500/30 shadow-md"
            : "bg-red-600/80 border-red-400/60"
        }`}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </button>

      {/* Camera */}
      <button
        onClick={async () => {
          const next = !camOn;
          await localParticipant.setCameraEnabled(next);
          setCamOn(next);
        }}
        className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-200 text-white active:scale-95 ${
          camOn
            ? "bg-indigo-600 border-indigo-400 shadow-indigo-500/30 shadow-md"
            : "bg-red-600/80 border-red-400/60"
        }`}
        title={camOn ? "Stop camera" : "Start camera"}
      >
        {camOn ? (
          <Video className="w-4 h-4" />
        ) : (
          <VideoOff className="w-4 h-4" />
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-7 bg-white/10" />

      {/* Leave */}
      <LeaveButton onLeave={onLeave} />
    </div>
  );
}

// ── Participant count badge ────────────────────────────────────────────────────
function ParticipantBadge() {
  const participants = useParticipants();
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-white/70 text-xs font-medium">
      <Users className="w-3 h-3" />
      {participants.length} in call
    </span>
  );
}

// ── Video grid ────────────────────────────────────────────────────────────────
function GuestVideoGrid() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  });
  const participants = useParticipants();

  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-white/30 gap-4">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Users className="w-10 h-10" />
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-white/40">
            Waiting for others…
          </p>
          <p className="text-sm text-white/25 mt-1">
            Share the invite link to bring people in
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 flex flex-wrap gap-4 items-center justify-center overflow-auto">
      {cameraTracks.map((trackRef) => (
        <div
          key={trackRef.participant.identity}
          className="relative rounded-2xl overflow-hidden bg-gray-800/60 border border-white/10 backdrop-blur-sm aspect-video w-72 shadow-xl"
        >
          <VideoTrack
            trackRef={trackRef}
            className="w-full h-full object-cover"
          />
          {/* Name badge */}
          <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-black/50 backdrop-blur-sm rounded-lg text-white text-xs font-semibold">
            {trackRef.participant.name ||
              trackRef.participant.identity.slice(0, 8)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const params = useParams();
  const token = params?.token as string;
  const [livekitUrl, setLivekitUrl] = useState("");
  const [roomName, setRoomName] = useState("Video Room");
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLivekitUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "");
    setRoomName(decodeRoomFromToken(token));
  }, [token]);

  // ── Invalid / missing token ──────────────────────────────────────────────
  if (!token || !livekitUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-red-900/40 border border-red-500/30 flex items-center justify-center mx-auto">
            <PhoneOff className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-white/60 text-sm">
            Invalid or missing invite link.
          </p>
        </div>
      </div>
    );
  }

  // ── Left / disconnected screen ───────────────────────────────────────────
  if (disconnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-5">
        <div className="w-20 h-20 rounded-full bg-gray-800/60 border border-white/10 flex items-center justify-center">
          <PhoneOff className="w-9 h-9 text-gray-400" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">You left the call</h1>
          <p className="text-gray-500 text-sm">
            You can safely close this tab.
          </p>
        </div>
        <button
          onClick={() => setDisconnected(false)}
          className="px-5 py-2 rounded-full border border-white/15 text-white/60 text-sm hover:bg-white/5 hover:text-white transition-all"
        >
          Rejoin
        </button>
      </div>
    );
  }

  // ── Main call UI ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-3.5 bg-gray-900/80 backdrop-blur-md border-b border-white/8 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold text-white/50 tracking-widest uppercase">
            AtriumVerse
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/15" />

        {/* Live indicator + room name */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h1 className="text-sm font-semibold text-white/90 truncate max-w-xs">
            {roomName}
          </h1>
        </div>

        {/* Participant count pushed to right */}
        <div className="ml-auto">
          <LiveKitRoom token={token} serverUrl={livekitUrl} connect={false}>
            <ParticipantBadge />
          </LiveKitRoom>
        </div>
      </header>

      {/* Room */}
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect
        video={false}
        audio={false}
        onDisconnected={() => setDisconnected(true)}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Participant badge inside the room context */}
        <div className="flex justify-end px-4 pt-2 shrink-0">
          <ParticipantBadge />
        </div>
        <GuestVideoGrid />
        <div className="flex justify-center py-4 border-t border-white/8 shrink-0 bg-gray-900/40 backdrop-blur-sm">
          <GuestControls onLeave={() => setDisconnected(true)} />
        </div>
      </LiveKitRoom>
    </div>
  );
}
