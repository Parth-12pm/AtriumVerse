"use client";

import { useEffect, useRef, useState } from "react";
import { wsService } from "@/lib/services/websocket.service";
import { initCommunicationManager } from "@/game/managers/CommunicationManager";
import { MediaControls } from "@/components/game/MediaControls";
import { Minimap } from "@/components/game/Minimap";
import ZoneVideoRoom from "@/components/video/ZoneVideoRoom";
import { getProximityAudio, MAX_HEAR_RADIUS } from "@/lib/livekit-audio";
import EventBus, { GameEvents } from "@/game/EventBus";
import { TILE_PX, SPEAKER_TILE_X, SPEAKER_TILE_Y } from "@/lib/game-constants";

interface GameWrapperProps {
  userId: string;
  username: string;
  serverId: string;
  token: string;
  characterId?: string;
}

let globalGameInstance: Phaser.Game | null = null;
let isInitializing = false;

export default function GameWrapper({
  userId,
  username,
  serverId,
  token,
  characterId = "bob",
}: GameWrapperProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);
  const audioConnectedRef = useRef(false);

  // Player screen position (pixels) for the earshot ring overlay
  const [ringPos, setRingPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // 1. Initialize the central WebSocket
    wsService.connect(serverId, token);

    // 2. Initialize the Communication Manager (it no longer connects its own WS)
    initCommunicationManager(serverId, token);

    return () => {
      // Cleanup when leaving the server
      wsService.disconnect();
    };
  }, [serverId, token]);

  // ── Proximity Audio Lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (audioConnectedRef.current) return;
    audioConnectedRef.current = true;

    const audio = getProximityAudio();
    audio
      .connect(serverId)
      .catch((err) => console.error("Proximity audio connect failed:", err));

    return () => {
      audioConnectedRef.current = false;
      audio.disconnect();
    };
  }, [serverId]);

  // ── Earshot Ring: track player screen position via PLAYER_POSITION ─────
  // PLAYER_POSITION fires at 20Hz whenever the player moves.
  // We convert tile coords → screen pixel centre for the SVG ring overlay.
  useEffect(() => {
    const handleMove = (data: { x: number; y: number }) => {
      const camera = (window as any).__phaserCamera;
      if (!camera) return;

      // camera.worldView = Phaser.Geom.Rectangle of the visible world area.
      // centerX/Y is the world-space point at the centre of the screen.
      const worldX = data.x * TILE_PX + TILE_PX / 2;
      const worldY = data.y * TILE_PX + TILE_PX / 2;
      const screenX =
        (worldX - camera.worldView.centerX) * camera.zoom + camera.width / 2;
      const screenY =
        (worldY - camera.worldView.centerY) * camera.zoom + camera.height / 2;

      setRingPos({ x: screenX, y: screenY });
    };

    EventBus.on(GameEvents.PLAYER_POSITION, handleMove);
    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handleMove);
    };
  }, []);

  // ── Pause/Resume Phaser when video conference expands ─────────────────────
  useEffect(() => {
    const handlePause = () => {
      const game = gameRef.current;
      if (!game) return;
      game.scene.getScenes(true).forEach((s) => s.scene.pause());
    };
    const handleResume = () => {
      const game = gameRef.current;
      if (!game) return;
      game.scene.getScenes(false).forEach((s) => {
        if (s.scene.isPaused()) s.scene.resume();
      });
    };
    EventBus.on("game:pause", handlePause);
    EventBus.on("game:resume", handleResume);
    return () => {
      EventBus.off("game:pause", handlePause);
      EventBus.off("game:resume", handleResume);
    };
  }, []);

  // ── Speaker: /speaker.mp3 with full 3D spatial audio (HRTF) ──────────────
  // Uses Web Audio API PannerNode in HRTF mode — the browser simulates
  // binaural 3D audio. The speaker is positioned at (SPEAKER_TILE_X, 0,
  // SPEAKER_TILE_Y) in 3D space; the listener position moves with the player.
  // Distance rolloff is handled by the PannerNode itself (linear model).
  useEffect(() => {
    if (!isGameReady) return;
    let audioCtx: AudioContext | null = null;
    let audioEl: HTMLAudioElement | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    let panner: PannerNode | null = null;
    let masterGain: GainNode | null = null;
    let lastPos = { x: SPEAKER_TILE_X, y: SPEAKER_TILE_Y };

    const applyProximity = (px: number, py: number) => {
      if (!audioCtx) return;
      // Update listener (player) position in tile-space coords
      // X = left/right, Y = height (0), Z = forward/back
      audioCtx.listener.positionX.value = px;
      audioCtx.listener.positionY.value = 0;
      audioCtx.listener.positionZ.value = py;
      const dx = px - SPEAKER_TILE_X;
      const dy = py - SPEAKER_TILE_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      console.log(`[Speaker 3D] dist=${dist.toFixed(1)} pos=(${px},${py})`);
    };

    const startMusic = () => {
      if (audioCtx) return;
      audioEl = new Audio("/speaker_2.mp3");
      audioEl.loop = true;
      audioEl.crossOrigin = "anonymous";
      audioCtx = new AudioContext();
      source = audioCtx.createMediaElementSource(audioEl);
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9; // overall volume ceiling

      // ── 3D PannerNode setup ────────────────────────────────────
      panner = audioCtx.createPanner();
      panner.panningModel = "HRTF"; // binaural 3D, head-related transfer
      panner.distanceModel = "linear"; // gain = 1 − dist/maxDistance
      panner.refDistance = 0; // full volume at distance 0
      panner.maxDistance = MAX_HEAR_RADIUS; // silent beyond this (tile units)
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360; // omnidirectional source
      panner.coneOuterAngle = 360;
      // Speaker (source) — fixed in tile-space 3D coords
      panner.positionX.value = SPEAKER_TILE_X;
      panner.positionY.value = 0;
      panner.positionZ.value = SPEAKER_TILE_Y;
      // ── Listener orientation ───────────────────────────────────────
      // For a top-down game the listener "looks into the screen":
      // forward = (0,0,-1), up = (0,1,0)
      const L = audioCtx.listener;
      L.forwardX.value = 0;
      L.forwardY.value = 0;
      L.forwardZ.value = -1;
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;

      source.connect(masterGain).connect(panner).connect(audioCtx.destination);
      audioEl
        .play()
        .then(() => {
          console.log("[Speaker 3D] ▶ /speaker.mp3 — HRTF active");
          applyProximity(lastPos.x, lastPos.y);
        })
        .catch((e) => console.warn("[Speaker] play() failed:", e));
      document.removeEventListener("click", startMusic);
    };
    document.addEventListener("click", startMusic);

    const handleMove = (data: { x: number; y: number }) => {
      lastPos = data;
      applyProximity(data.x, data.y);
    };

    EventBus.on(GameEvents.PLAYER_POSITION, handleMove);
    return () => {
      document.removeEventListener("click", startMusic);
      EventBus.off(GameEvents.PLAYER_POSITION, handleMove);
      audioEl?.pause();
      source?.disconnect();
      audioCtx?.close();
    };
  }, [isGameReady]);

  // ── Game Initialization ────────────────────────────────────────────────
  useEffect(() => {
    const initGame = async () => {
      if (process.env.NODE_ENV === "development" && globalGameInstance) {
        console.log("[GameWrapper] Dev: destroying stale game for hot reload");
        globalGameInstance.destroy(true);
        globalGameInstance = null;
        isInitializing = false;
      }

      if (globalGameInstance) {
        gameRef.current = globalGameInstance;
        setIsGameReady(true);
        return;
      }

      if (isInitializing) {
        const checkInterval = setInterval(() => {
          if (globalGameInstance) {
            gameRef.current = globalGameInstance;
            setIsGameReady(true);
            clearInterval(checkInterval);
          }
        }, 50);
        return;
      }

      isInitializing = true;

      const { default: StartGame } = await import("@/game/phaser-game");

      console.log("[GameWrapper] Initializing Phaser with Grid Engine");

      const game = await StartGame("game-container", {
        userId,
        username,
        serverId,
        token,
        characterId,
        apiUrl: process.env.NEXT_PUBLIC_API_URL,
      });

      globalGameInstance = game;
      gameRef.current = game;
      isInitializing = false;
      setIsGameReady(true);
      console.log("[GameWrapper] Game ready");

      setTimeout(() => {
        const canvas = document.querySelector(
          "#game-container canvas",
        ) as HTMLCanvasElement;
        if (canvas) {
          canvas.tabIndex = 1;
          canvas.focus();
        }
      }, 100);
    };

    initGame();

    return () => {
      console.log("[GameWrapper] Cleanup called");
    };
  }, [userId, username, serverId, token]);

  useEffect(() => {
    return () => {
      if (globalGameInstance) {
        console.log("[GameWrapper] Final unmount - destroying game");
        globalGameInstance.destroy(true);
        globalGameInstance = null;
      }
    };
  }, []);

  // Ring radius in screen pixels: MAX_HEAR_RADIUS tiles × TILE_PX × camera zoom
  const ringRadiusPx = () => {
    const camera = (window as any).__phaserCamera;
    const zoom = camera?.zoom ?? 1;
    return MAX_HEAR_RADIUS * TILE_PX * zoom;
  };

  return (
    <div className="relative w-full h-full">
      <div
        id="game-container"
        className="w-full h-full bg-black"
        tabIndex={0}
        onClick={(e) => {
          const canvas = e.currentTarget.querySelector("canvas");
          if (canvas) canvas.focus();
        }}
      />

      {!isGameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading World...</p>
          </div>
        </div>
      )}

      {/* ── Earshot Radius Ring ─────────────────────────────────────────── */}
      {isGameReady && ringPos && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 20 }}
        >
          <circle
            cx={ringPos.x}
            cy={ringPos.y}
            r={ringRadiusPx()}
            fill="rgba(99,102,241,0.06)"
            stroke="rgba(99,102,241,0.35)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        </svg>
      )}

      {/* ── Minimap — always-on, bottom-left ────────────────────────────── */}
      {isGameReady && <Minimap />}

      {/* ── Zone Video (single instance, shifts from strip → sidebar on expand) ── */}
      {isGameReady && <ZoneVideoRoom serverId={serverId} />}

      {/* ── Media Control Dock ──────────────────────────────────────────── */}
      {isGameReady && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <MediaControls
            onAudioToggle={(enabled) => {
              getProximityAudio().setMicEnabled(enabled);
            }}
            onVideoToggle={(enabled) => {
              getProximityAudio().setCameraEnabled(enabled);
            }}
          />
        </div>
      )}
    </div>
  );
}
