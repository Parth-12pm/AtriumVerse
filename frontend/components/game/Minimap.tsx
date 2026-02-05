"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";

interface MinimapProps {
  currentRoom: "hall" | "meeting" | "office";
  playerPosition: { x: number; y: number };
  proximityRange: number;
  remotePlayers?: Array<{
    id: string;
    username: string;
    x: number;
    y: number;
  }>;
  onClose?: () => void;
}

const ROOM_INFO = {
  hall: {
    name: "Main Hall",
    width: 800,
    height: 600,
    color: "#e8f4f8",
    offsetX: 0,
  },
  meeting: {
    name: "Conference",
    width: 1200,
    height: 800,
    color: "#fff8dc",
    offsetX: 800,
  },
  office: {
    name: "Office",
    width: 1000,
    height: 700,
    color: "#f0f0f0",
    offsetX: 2000,
  },
};

export function Minimap({
  currentRoom,
  playerPosition,
  proximityRange,
  remotePlayers = [],
}: MinimapProps) {
  const roomInfo = ROOM_INFO[currentRoom];
  const scale = 0.15; // 15% of original size
  const miniWidth = roomInfo.width * scale;
  const miniHeight = roomInfo.height * scale;

  // CRITICAL FIX: Convert absolute world position to room-relative position
  // Rooms are offset horizontally: hall=0, meeting=800, office=2000
  const relativePlayerX = playerPosition.x - roomInfo.offsetX;
  const relativePlayerY = playerPosition.y;

  // Scale player position to minimap
  const scaledPlayerX = relativePlayerX * scale;
  const scaledPlayerY = relativePlayerY * scale;
  const scaledProximity = proximityRange * scale;

  return (
    <Card className="fixed bottom-4 right-4 p-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
      <div className="mb-2">
        <h3 className="text-sm font-bold">{roomInfo.name}</h3>
        <p className="text-xs text-muted-foreground">
          Players: {remotePlayers.length + 1}
        </p>
      </div>

      <svg
        width={miniWidth}
        height={miniHeight}
        className="border-2 border-black"
        style={{ backgroundColor: roomInfo.color }}
      >
        {/* Proximity circle */}
        <circle
          cx={scaledPlayerX}
          cy={scaledPlayerY}
          r={scaledProximity}
          fill="rgba(0, 255, 0, 0.1)"
          stroke="rgba(0, 255, 0, 0.5)"
          strokeWidth="1"
        />

        {/* Remote players */}
        {remotePlayers.map((player) => {
          // Convert to room-relative coordinates
          const relativeX = player.x - roomInfo.offsetX;
          const relativeY = player.y;

          return (
            <circle
              key={player.id}
              cx={relativeX * scale}
              cy={relativeY * scale}
              r="3"
              fill="#32cd32"
              stroke="#000"
              strokeWidth="1"
            />
          );
        })}

        {/* Local player (you) */}
        <circle
          cx={scaledPlayerX}
          cy={scaledPlayerY}
          r="4"
          fill="#4169e1"
          stroke="#000"
          strokeWidth="1"
        />
      </svg>

      <div className="mt-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#4169e1] border border-black" />
          <span>You</span>
        </div>
        {remotePlayers.length > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 rounded-full bg-[#32cd32] border border-black" />
            <span>Others</span>
          </div>
        )}
      </div>
    </Card>
  );
}
