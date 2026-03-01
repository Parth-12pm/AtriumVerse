"use client";

import { useEffect, useRef } from "react";
import EventBus, { GameEvents } from "@/game/EventBus";
import { TILE_PX } from "@/lib/game-constants";

// Mini-map canvas dimensions (pixels)
const MINI_W = 180;
const MINI_H = 140;

interface Player {
  user_id: string;
  x: number;
  y: number;
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

    // Derive map dimensions from exactly what MainScene tells us
    // Default to the original 50x40 map if unavailable
    const mapSize = (window as any).__phaserMapSize;
    const mapW = mapSize?.w ?? 50 * TILE_PX;
    const mapH = mapSize?.h ?? 40 * TILE_PX;

    const scaleX = MINI_W / mapW;
    const scaleY = MINI_H / mapH;

    // Background
    ctx.fillStyle = "#1a1b26"; // matches void color
    ctx.fillRect(0, 0, MINI_W, MINI_H);

    // Map area outline
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINI_W, MINI_H);

    // Other players (white dots)
    for (const p of othersRef.current) {
      const px = p.x * TILE_PX * scaleX;
      const py = p.y * TILE_PX * scaleY;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fill();
    }

    // Hero (you) — red dot with glow
    const hx = heroRef.current.x * TILE_PX * scaleX;
    const hy = heroRef.current.y * TILE_PX * scaleY;
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#f43f5e"; // rose-500
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 6;
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

    EventBus.on(GameEvents.PLAYER_POSITION, handleHeroMove);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);

    // Initial draw
    draw();

    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handleHeroMove);
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handlePlayerList);
    };
  }, []);

  return (
    <div
      className="absolute bottom-5 left-5 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg"
      style={{ zIndex: 25, pointerEvents: "none" }}
    >
      {/* Label */}
      <div className="bg-gray-900/80 px-2 py-0.5 text-[10px] text-white/60 font-mono tracking-wide">
        MAP
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
