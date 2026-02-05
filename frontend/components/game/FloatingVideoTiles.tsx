import { useEffect, useState, useRef } from "react";
import EventBus, { GameEvents } from "../../game/EventBus";

interface VideoPeer {
  userId: string;
  stream: MediaStream;
}

export function FloatingVideoTiles() {
  const [peers, setPeers] = useState<VideoPeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const handleStreamReady = (data: {
      userId: string;
      stream: MediaStream;
    }) => {
      console.log("🎥 UI: Received stream for", data.userId);
      setPeers((prev) => {
        // Prevent duplicates
        if (prev.find((p) => p.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, stream: data.stream }];
      });
    };

    const handleStreamRemoved = (data: { userId: string }) => {
      console.log("🚫 UI: Removed stream for", data.userId);
      setPeers((prev) => prev.filter((p) => p.userId !== data.userId));
    };

    EventBus.on(GameEvents.REMOTE_STREAM_READY, handleStreamReady);
    EventBus.on(GameEvents.REMOTE_STREAM_REMOVED, handleStreamRemoved);

    // Listen for self-view
    const handleLocalStream = (data: { stream: MediaStream }) => {
      console.log("🎥 UI: Received local stream");
      setLocalStream(data.stream);
    };
    EventBus.on(GameEvents.LOCAL_STREAM_READY, handleLocalStream);

    return () => {
      EventBus.off(GameEvents.REMOTE_STREAM_READY, handleStreamReady);
      EventBus.off(GameEvents.REMOTE_STREAM_REMOVED, handleStreamRemoved);
      EventBus.off(GameEvents.LOCAL_STREAM_READY, handleLocalStream);
    };
  }, []);

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none z-50">
      {/* Self View (Mirrored) */}
      {localStream && (
        <VideoTile
          peer={{ userId: "Me", stream: localStream }}
          isLocal={true}
        />
      )}
      {peers.map((peer) => (
        <VideoTile key={peer.userId} peer={peer} />
      ))}
    </div>
  );
}

function VideoTile({
  peer,
  isLocal = false,
}: {
  peer: VideoPeer;
  isLocal?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
      // Ensure audio is enabled (unless muted locally)
      // Spatial audio is handled by WebAudio API, so we might want to mute the video element itself
      // to avoid double audio?
      // Actually, RTCConnectionManager uses setupSpatialAudio which creates a new source from stream.
      // If we play it here too, we might get echo or non-spatial audio mixed in.
      // **CRITICAL**: Mute the video element so we only hear the Spatial Audio version!
      videoRef.current.muted = true;
    }
  }, [peer.stream]);

  return (
    <div className="w-48 h-36 bg-black rounded-lg overflow-hidden shadow-lg border-2 border-gray-800 pointer-events-auto">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
      />
      <div className="absolute bottom-1 left-2 text-white text-xs bg-black/50 px-1 rounded">
        {peer.userId.slice(0, 5)}...
      </div>
    </div>
  );
}
