"use client";

import { useEffect, useRef } from "react";
import EventBus, { GameEvents } from "@/game/EventBus";
import { TILE_PX } from "@/lib/game-constants";

// Mini-map canvas dimensions (pixels)
const MINI_W = 200;
const MINI_H = 160;

interface Player {
  user_id: string;
  x: number;
  y: number;
}

interface MinimapZone {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrivate: boolean;
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // hero tile position
  const heroRef = useRef({ x: 0, y: 0 });
  // other players
  const othersRef = useRef<Player[]>([]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mapSize = (window as any).__phaserMapSize;
    const mapW = mapSize?.w ?? 50 * TILE_PX;
    const mapH = mapSize?.h ?? 40 * TILE_PX;

    const scaleX = MINI_W / mapW;
    const scaleY = MINI_H / mapH;

    // ── Background ────────────────────────────────────────────────────────────
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, MINI_W, MINI_H);

    // ── Zone layout ───────────────────────────────────────────────────────────
    const zones: MinimapZone[] = (window as any).__phaserZones ?? [];
    for (const zone of zones) {
      if (!zone.width || !zone.height) continue;

      const zx = zone.x * scaleX;
      const zy = zone.y * scaleY;
      const zw = zone.width * scaleX;
      const zh = zone.height * scaleY;

      // Fill: private rooms = indigo tint, public areas = gray tint
      ctx.fillStyle = zone.isPrivate
        ? "rgba(99, 102, 241, 0.18)" // indigo
        : "rgba(255, 255, 255, 0.04)"; // barely visible public
      ctx.fillRect(zx, zy, zw, zh);

      // Border
      ctx.strokeStyle = zone.isPrivate
        ? "rgba(129, 140, 248, 0.55)" // indigo-400
        : "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = zone.isPrivate ? 1.5 : 1;
      ctx.strokeRect(zx, zy, zw, zh);
    }

    // ── Other players (white dots) ────────────────────────────────────────────
    for (const p of othersRef.current) {
      const px = p.x * TILE_PX * scaleX;
      const py = p.y * TILE_PX * scaleY;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fill();
    }

    // ── Hero — rose dot with glow ─────────────────────────────────────────────
    const hx = heroRef.current.x * TILE_PX * scaleX;
    const hy = heroRef.current.y * TILE_PX * scaleY;
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  useEffect(() => {
    const handleHeroMove = (data: { x: number; y: number }) => {
      heroRef.current = { x: data.x, y: data.y };
      draw();
    };

    const handlePlayerList = (users: Player[]) => {
      othersRef.current = users.filter((u) => u.user_id !== undefined);
      draw();
    };

    // Defer initial draw slightly so __phaserZones is populated by MainScene
    const initialTimer = setTimeout(draw, 500);

    EventBus.on(GameEvents.PLAYER_POSITION, handleHeroMove);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);

    return () => {
      clearTimeout(initialTimer);
      EventBus.off(GameEvents.PLAYER_POSITION, handleHeroMove);
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);
    };
  }, []);

  return (
    <div
      className="absolute bottom-5 left-5 rounded-xl overflow-hidden border border-white/15 shadow-2xl shadow-black/60 backdrop-blur-sm"
      style={{ zIndex: 25, pointerEvents: "none" }}
    >
      {/* Label bar */}
      <div className="flex items-center gap-1.5 bg-black/60 px-2.5 py-1 border-b border-white/8">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        <span className="text-[9px] text-white/50 font-mono tracking-widest uppercase">
          Mini-Map
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={MINI_W}
        height={MINI_H}
        className="block"
      />
    </div>
  );
}
