"use client";

/**
 * AvatarBubbles
 *
 * Renders a tiny live-video bubble above every player avatar (Gather.town style).
 * Sits as an absolute React overlay over the Phaser canvas.
 *
 * Data flow:
 *  • Player tile positions → EventBus PLAYER_POSITION / REMOTE_PLAYER_MOVED
 *  • Camera world→screen  → window.__phaserCamera  (set by GameWrapper)
 *  • Video tracks         → EventBus "livekit:cam_tracks"
 *                           Map<identity, RemoteTrackPublication | TrackPublication>
 *                           emitted by both ZoneVideoRoom (CamTrackBroadcaster)
 *                           and ProximityAudioManager whenever cameras change.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import EventBus, { GameEvents } from "@/game/EventBus";
import { TILE_PX } from "@/lib/game-constants";
import type { RemoteTrackPublication, TrackPublication } from "livekit-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnyTrackPub = RemoteTrackPublication | TrackPublication;

interface PlayerPos {
  tileX: number;
  tileY: number;
}

interface AvatarBubblesProps {
  /** The local player's user_id (matched against LiveKit participant identity) */
  userId: string;
  /** The local player's username (for fallback initials) */
  username: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** How far above the avatar's feet to centre the bubble (world-space pixels) */
const BUBBLE_WORLD_OFFSET_Y = 40;

/** The bubble's diameter in CSS pixels at zoom=1 */
const BUBBLE_BASE_SIZE = 36;

// ── Helpers ───────────────────────────────────────────────────────────────────

function tileToScreen(
  tileX: number,
  tileY: number,
): { screenX: number; screenY: number } | null {
  const camera = (window as any).__phaserCamera;
  if (!camera) return null;
  const worldX = tileX * TILE_PX + TILE_PX / 2;
  const worldY = tileY * TILE_PX + TILE_PX / 2;
  return {
    screenX:
      (worldX - camera.worldView.centerX) * camera.zoom + camera.width / 2,
    screenY:
      (worldY - camera.worldView.centerY) * camera.zoom + camera.height / 2,
  };
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h % 360;
}

// ── VideoBubble: a single circular bubble ─────────────────────────────────────

function VideoBubble({
  screenX,
  screenY,
  pub,
  identity,
  zoom,
}: {
  screenX: number;
  screenY: number;
  pub?: AnyTrackPub;
  identity: string;
  zoom: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const size = Math.round(BUBBLE_BASE_SIZE * Math.min(Math.max(zoom, 0.6), 2.5));
  const top = Math.round(screenY - BUBBLE_WORLD_OFFSET_Y * zoom - size);
  const left = Math.round(screenX - size / 2);
  // Track local mute state since TrackPublication properties don't strictly trigger React renders
  const [isMuted, setIsMuted] = useState(pub?.isMuted ?? false);

  useEffect(() => {
    if (!pub) return;
    setIsMuted(pub.isMuted);

    const handleMute = () => setIsMuted(true);
    const handleUnmute = () => setIsMuted(false);

    pub.on("muted", handleMute);
    pub.on("unmuted", handleUnmute);
    return () => {
      pub.off("muted", handleMute);
      pub.off("unmuted", handleUnmute);
    };
  }, [pub]);

  // Attach the MediaStreamTrack to the <video> element whenever it changes
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (!pub || isMuted) {
      el.srcObject = null;
      return;
    }

    // RemoteTrackPublication exposes .track. LocalTrackPublication exposes .track.
    // Both implement Track, which has mediaStreamTrack.
    const lkTrack = (pub as TrackPublication).track;
    const mst = (lkTrack as any)?.mediaStreamTrack as MediaStreamTrack | undefined;

    if (mst) {
      el.srcObject = new MediaStream([mst]);
      el.muted = true;
      el.play().catch(() => {});
    } else {
      el.srcObject = null;
    }
  }, [pub, isMuted]);

  const showVideo = !!pub && !!(pub as TrackPublication).track && !isMuted;

  if (!showVideo) return null;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2.5px solid rgba(99,102,241,0.9)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)",
        background: `rgb(0,0,0)`,
        pointerEvents: "none",
        zIndex: 25,
        transition: "top 70ms linear, left 70ms linear",
        willChange: "top, left",
      }}
    >
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AvatarBubbles({ userId, username }: AvatarBubblesProps) {
  const [bubbles, setBubbles] = useState<
    Array<{ id: string; screenX: number; screenY: number }>
  >([]);
  const [camTracks, setCamTracks] = useState<Map<string, AnyTrackPub>>(
    new Map(),
  );
  const [zoom, setZoom] = useState(1.5);
  const [inMeetingZone, setInMeetingZone] = useState(false);

  // Mutable refs for RAF loop
  const positionsRef = useRef<Map<string, PlayerPos>>(new Map());
  const rafRef = useRef<number>(0);

  // ── Sync with EventBus ────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Listen for new/removed camera tracks
    const handleCamTracks = (map: Map<string, AnyTrackPub>) => setCamTracks(new Map(map));

    // 2. Listen for player movement
    const handleMyMove = (data: { x: number; y: number }) => {
      positionsRef.current.set(userId, { tileX: data.x, tileY: data.y });
    };
    const handleRemoteMove = (data: { userId: string; x: number; y: number }) => {
      positionsRef.current.set(data.userId, { tileX: data.x, tileY: data.y });
    };
    const handleLeft = (data: { userId: string }) => {
      positionsRef.current.delete(data.userId);
    };

    // 3. Listen for Zone Enter/Exit to disable bubbles in Meeting Zones
    const handleZoneEnter = (data: { zoneType: string }) => {
      if (data.zoneType === "PRIVATE") setInMeetingZone(true);
    };
    const handleZoneExit = (data: { zoneType: string }) => {
      if (data.zoneType === "PRIVATE") setInMeetingZone(false);
    };

    EventBus.on("livekit:cam_tracks", handleCamTracks);
    EventBus.on(GameEvents.PLAYER_POSITION, handleMyMove);
    EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
    EventBus.on(GameEvents.PLAYER_LEFT, handleLeft);
    EventBus.on(GameEvents.ZONE_ENTER, handleZoneEnter);
    EventBus.on(GameEvents.ZONE_EXIT, handleZoneExit);

    return () => {
      EventBus.off("livekit:cam_tracks", handleCamTracks);
      EventBus.off(GameEvents.PLAYER_POSITION, handleMyMove);
      EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
      EventBus.off(GameEvents.PLAYER_LEFT, handleLeft);
      EventBus.off(GameEvents.ZONE_ENTER, handleZoneEnter);
      EventBus.off(GameEvents.ZONE_EXIT, handleZoneExit);
    };
  }, [userId]);

  // ── RAF loop: project tile → screen each frame ────────────────────────────

  const project = useCallback(function projectFrame() {
    const camera = (window as any).__phaserCamera;
    const currentZoom: number = camera?.zoom ?? 1.5;
    setZoom(currentZoom);

    const next: Array<{ id: string; screenX: number; screenY: number }> = [];
    positionsRef.current.forEach((pos, id) => {
      const sc = tileToScreen(pos.tileX, pos.tileY);
      if (sc) next.push({ id, screenX: sc.screenX, screenY: sc.screenY });
    });
    setBubbles(next);

    rafRef.current = requestAnimationFrame(projectFrame);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(project);
    return () => cancelAnimationFrame(rafRef.current);
  }, [project]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (inMeetingZone || bubbles.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 25,
        overflow: "hidden",
      }}
    >
      {bubbles.map(({ id, screenX, screenY }) => (
        <VideoBubble
          key={id}
          screenX={screenX}
          screenY={screenY}
          pub={camTracks.get(id)}
          identity={id === userId ? username : id}
          zoom={zoom}
        />
      ))}
    </div>
  );
}
