"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  LogOut,
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

// ── Leave button (needs room context) ─────────────────────────────────────────
function LeaveButton({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext();
  const handleLeave = async () => {
    await room.disconnect();
    onLeave();
  };
  return (
    <button
      onClick={handleLeave}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white text-sm font-semibold shadow-lg shadow-red-900/40"
      title="Leave call"
    >
      <PhoneOff className="w-4 h-4" />
      Leave
    </button>
  );
}

// ── Header exit button (also needs room context) ───────────────────────────────
function HeaderExitButton({ onLeave }: { onLeave: () => void }) {
  const room = useRoomContext();
  const handleExit = async () => {
    await room.disconnect();
    onLeave();
  };
  return (
    <button
      onClick={handleExit}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all text-xs font-semibold"
      title="Exit call"
    >
      <LogOut className="w-3.5 h-3.5" />
      Exit
    </button>
  );
}

// ── Media Controls ────────────────────────────────────────────────────────────
function GuestControls({ onLeave }: { onLeave: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  return (
    <div className="flex items-center gap-3">
      {/* Participant count */}
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-white/50 text-xs font-medium mr-1">
        <Users className="w-3 h-3" />
        {participants.length}
      </span>

      {/* Mic */}
      <button
        onClick={async () => {
          const next = !micOn;
          await localParticipant.setMicrophoneEnabled(next);
          setMicOn(next);
        }}
        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 text-white active:scale-95 shadow-lg ${
          micOn
            ? "bg-indigo-600 border-indigo-400/60 shadow-indigo-900/50"
            : "bg-white/8 border-white/15 hover:bg-white/12"
        }`}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4 text-white/50" />
        )}
      </button>

      {/* Camera */}
      <button
        onClick={async () => {
          const next = !camOn;
          await localParticipant.setCameraEnabled(next);
          setCamOn(next);
        }}
        className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 text-white active:scale-95 shadow-lg ${
          camOn
            ? "bg-indigo-600 border-indigo-400/60 shadow-indigo-900/50"
            : "bg-white/8 border-white/15 hover:bg-white/12"
        }`}
        title={camOn ? "Stop camera" : "Start camera"}
      >
        {camOn ? (
          <Video className="w-4 h-4" />
        ) : (
          <VideoOff className="w-4 h-4 text-white/50" />
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-white/10 mx-1" />

      {/* Leave */}
      <LeaveButton onLeave={onLeave} />
    </div>
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
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-2xl">
          <Users className="w-12 h-12 text-white/20" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-white/40">
            Waiting for others…
          </p>
          <p className="text-sm text-white/20">
            Share the invite link to bring people in
          </p>
        </div>
        {/* Animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 flex flex-wrap gap-4 items-center justify-center overflow-auto">
      {participants.map((participant) => {
        const cameraTrack = cameraTracks.find(
          (t) => t.participant.identity === participant.identity,
        );
        return (
          <div
            key={participant.identity}
            className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-white/10 backdrop-blur-sm aspect-video w-72 shadow-2xl shadow-black/50 group"
          >
            {cameraTrack && participant.isCameraEnabled ? (
              <VideoTrack
                trackRef={cameraTrack}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold text-2xl uppercase shadow-xl shadow-indigo-900/50">
                  {participant.name?.charAt(0) ||
                    participant.identity.charAt(0)}
                </div>
                <span className="text-white/40 text-xs font-medium">
                  Camera off
                </span>
              </div>
            )}

            {/* Name bar */}
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-1.5">
                {!participant.isMicrophoneEnabled && (
                  <MicOff className="w-3 h-3 text-red-400 shrink-0" />
                )}
                <span className="text-white text-[11px] font-semibold truncate">
                  {participant.name || participant.identity.slice(0, 12)}
                </span>
              </div>
            </div>

            {/* Online ring */}
            <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-green-400 shadow-lg shadow-green-400/50 ring-2 ring-black/50" />
          </div>
        );
      })}
    </div>
  );
}

// ── Inner layout (needs LiveKitRoom context) ───────────────────────────────────
function CallLayout({
  roomName,
  onLeave,
}: {
  roomName: string;
  onLeave: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#090b14] text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/30 via-transparent to-violet-950/20 pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/5 blur-3xl pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative flex items-center gap-3 px-6 py-3.5 bg-white/3 backdrop-blur-xl border-b border-white/8 shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white/30 tracking-widest uppercase">
            AtriumVerse
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* Room name */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50 animate-pulse" />
          <h1 className="text-sm font-semibold text-white/80 truncate max-w-[240px]">
            {roomName
              .replace(/^video_/, "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </h1>
          <span className="px-1.5 py-0.5 rounded-md bg-green-500/15 border border-green-500/20 text-green-400 text-[10px] font-semibold">
            LIVE
          </span>
        </div>

        {/* Exit — pushed to right */}
        <div className="ml-auto">
          <HeaderExitButton onLeave={onLeave} />
        </div>
      </header>

      {/* Video grid */}
      <GuestVideoGrid />

      {/* Controls bar */}
      <div className="relative flex justify-center items-center py-5 border-t border-white/8 bg-white/2 backdrop-blur-xl shrink-0 z-10">
        <GuestControls onLeave={onLeave} />
      </div>
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
      <div className="min-h-screen flex items-center justify-center bg-[#090b14] text-white">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-900/30 border border-red-500/20 flex items-center justify-center">
            <PhoneOff className="w-6 h-6 text-red-400" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-white/60">Invalid invite link</p>
            <p className="text-sm text-white/30">
              This link may have expired or been revoked.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Left / disconnected screen ───────────────────────────────────────────
  if (disconnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#090b14] text-white gap-6">
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/20 via-transparent to-violet-950/10 pointer-events-none" />

        <div className="relative flex flex-col items-center gap-5">
          <div className="w-24 h-24 rounded-3xl bg-gray-800/60 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-sm">
            <PhoneOff className="w-10 h-10 text-gray-400" />
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">
              You left the call
            </h1>
            <p className="text-gray-500 text-sm">
              You can close this tab or rejoin below.
            </p>
          </div>

          <button
            onClick={() => setDisconnected(false)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-600/10 text-indigo-300 text-sm font-semibold hover:bg-indigo-600/20 hover:text-indigo-200 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Rejoin
          </button>
        </div>
      </div>
    );
  }

  // ── Main call UI ─────────────────────────────────────────────────────────
  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect
      video={false}
      audio={false}
      onDisconnected={() => setDisconnected(true)}
    >
      <CallLayout roomName={roomName} onLeave={() => setDisconnected(true)} />
    </LiveKitRoom>
  );
}
