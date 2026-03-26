"use client";

import { useEffect, useRef, useCallback } from "react";
import EventBus from "@/game/EventBus";

/**
 * Mobile D-Pad overlay that drives character movement via EventBus.
 * Only renders on touch devices. Each button fires "mobile_move" while
 * held, and "mobile_move_stop" on release — MainScene listens and drives gridEngine.
 */

type Direction = "up" | "down" | "left" | "right";

const REPEAT_MS = 120; // how often a held press repeats movement

interface DPadButtonProps {
  direction: Direction;
  label: React.ReactNode;
  onStart: (d: Direction) => void;
  onStop: () => void;
  className?: string;
}

function DPadButton({ direction, label, onStart, onStop, className }: DPadButtonProps) {
  return (
    <button
      className={`flex items-center justify-center w-14 h-14 rounded-xl
        bg-white/10 border-2 border-white/25 text-white text-xl font-bold
        backdrop-blur-sm active:bg-white/30 active:scale-95
        select-none touch-none transition-all duration-75 ${className ?? ""}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onStart(direction); }}
      onPointerUp={() => onStop()}
      onPointerCancel={() => onStop()}
      aria-label={`Move ${direction}`}
    >
      {label}
    </button>
  );
}

export default function MobileControls() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeDir = useRef<Direction | null>(null);

  const startMove = useCallback((dir: Direction) => {
    if (activeDir.current === dir) return;
    stopMove();
    activeDir.current = dir;
    // Fire immediately, then repeat
    EventBus.emit("mobile_move", { direction: dir });
    intervalRef.current = setInterval(() => {
      EventBus.emit("mobile_move", { direction: dir });
    }, REPEAT_MS);
  }, []);

  const stopMove = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (activeDir.current) {
      EventBus.emit("mobile_move_stop", {});
      activeDir.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopMove(), [stopMove]);

  return (
    <div
      className="hidden [@media(pointer:coarse)]:block absolute bottom-28 right-5 z-40 pointer-events-auto select-none"
      style={{ touchAction: "none" }}
    >
      {/* D-Pad layout */}
      <div className="grid grid-cols-3 gap-1.5 w-[11.5rem]">
        {/* Row 1: up */}
        <div />
        <DPadButton direction="up" label="▲" onStart={startMove} onStop={stopMove} />
        <div />

        {/* Row 2: left · center · right */}
        <DPadButton direction="left"  label="◀" onStart={startMove} onStop={stopMove} />
        {/* center — double tap to halt */}
        <button
          className="flex items-center justify-center w-14 h-14 rounded-xl
            bg-white/5 border-2 border-white/15 text-white/40 text-xs
            select-none touch-none"
          onPointerDown={stopMove}
          aria-label="Stop"
        >
          ●
        </button>
        <DPadButton direction="right" label="▶" onStart={startMove} onStop={stopMove} />

        {/* Row 3: down */}
        <div />
        <DPadButton direction="down" label="▼" onStart={startMove} onStop={stopMove} />
        <div />
      </div>
    </div>
  );
}
