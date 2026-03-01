"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  LiveKitRoom,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Mic, MicOff, Video, VideoOff, Users } from "lucide-react";

// Decode the room name from the LiveKit JWT (no secret needed — it's in the payload)
function decodeRoomFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.video?.room ?? "Video Room";
  } catch {
    return "Video Room";
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
function GuestControls() {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-full border border-white/10">
      <button
        onClick={async () => {
          const next = !micOn;
          await localParticipant.setMicrophoneEnabled(next);
          setMicOn(next);
        }}
        className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors text-white ${
          micOn
            ? "bg-indigo-600 border-indigo-400"
            : "bg-red-600 border-red-400"
        }`}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </button>

      <button
        onClick={async () => {
          const next = !camOn;
          await localParticipant.setCameraEnabled(next);
          setCamOn(next);
        }}
        className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-colors text-white ${
          camOn
            ? "bg-indigo-600 border-indigo-400"
            : "bg-red-600 border-red-400"
        }`}
        title={camOn ? "Stop camera" : "Start camera"}
      >
        {camOn ? (
          <Video className="w-5 h-5" />
        ) : (
          <VideoOff className="w-5 h-5" />
        )}
      </button>
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
      <div className="flex flex-col items-center justify-center flex-1 text-white/40 gap-3">
        <Users className="w-12 h-12" />
        <span className="text-sm">Waiting for others to join…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 flex flex-wrap gap-4 items-center justify-center overflow-auto">
      {cameraTracks.map((trackRef) => (
        <div
          key={trackRef.participant.identity}
          className="relative rounded-xl overflow-hidden bg-gray-800 border border-white/10 aspect-video w-72"
        >
          <VideoTrack
            trackRef={trackRef}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-white text-xs font-semibold">
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
    // LiveKit URL from env (available as NEXT_PUBLIC_)
    setLivekitUrl(process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "");
    setRoomName(decodeRoomFromToken(token));
  }, [token]);

  if (!token || !livekitUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <p className="text-gray-400">Invalid or missing invite link.</p>
      </div>
    );
  }

  if (disconnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
          <Video className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-2xl font-black">You left the call</h1>
        <p className="text-gray-400 text-sm">You can close this tab.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-gray-900 border-b border-white/10 shrink-0">
        <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
        <h1 className="text-lg font-bold">{roomName}</h1>
        <span className="ml-auto text-xs text-gray-500 font-mono">
          AtriumVerse
        </span>
      </div>

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
        <GuestVideoGrid />
        <div className="flex justify-center py-4 border-t border-white/10 shrink-0">
          <GuestControls />
        </div>
      </LiveKitRoom>
    </div>
  );
}
