"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventBus, {
  GameEvents,
  PlayerPositionEvent,
  ProximityChangeEvent,
} from "@/game/EventBus";
import { MediaControls } from "@/components/game/MediaControls";
import { rtcManager } from "@/lib/webrtc/RTCConnectionManager";
import { ChatOverlay } from "@/components/game/ChatOverlay";
import { LeftSidebar } from "@/components/game/LeftSidebar";
import { Minimap } from "@/components/game/Minimap";
import { Button } from "@/components/ui/button";
import { Users, Map, X } from "lucide-react";

interface ServerLayoutProps {
  children: React.ReactNode;
  params: { id: string };
}

export default function ServerHUD({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // HUD State
  const [playerPosition, setPlayerPosition] = useState({ x: 10, y: 10 });
  const [currentRoom, setCurrentRoom] = useState<"hall" | "meeting" | "office">(
    "hall",
  );
  const [showMinimap, setShowMinimap] = useState(false);

  // Track users with position for Minimap
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{
      id: string;
      username: string;
      status: "online" | "away" | "busy";
      x: number;
      y: number;
    }>
  >([]);

  useEffect(() => {
    // Event Listeners
    const handlePositionUpdate = (data: PlayerPositionEvent) => {
      setPlayerPosition({ x: data.x, y: data.y });
    };

    const handleRoomEnter = (data: { roomId: string }) => {
      setCurrentRoom(data.roomId as "hall" | "meeting" | "office");
    };

    const handleUserListUpdate = (users: any[]) => {
      const userObjects = users.map((u) => ({
        id: u.user_id,
        username: u.username || "Player",
        status: "online" as const,
        x: u.x || 0,
        y: u.y || 0,
      }));
      setOnlineUsers(userObjects);
    };

    // Update single remote player position
    const handleRemoteMove = (data: {
      userId: string;
      x: number;
      y: number;
    }) => {
      setOnlineUsers((prev) =>
        prev.map((u) =>
          u.id === data.userId ? { ...u, x: data.x, y: data.y } : u,
        ),
      );
    };

    EventBus.on(GameEvents.PLAYER_POSITION, handlePositionUpdate);
    EventBus.on(GameEvents.ROOM_ENTER, handleRoomEnter);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
    EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);

    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
      EventBus.off(GameEvents.ROOM_ENTER, handleRoomEnter);
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
      EventBus.off(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);
    };
  }, []);

  const handleExit = () => {
    router.push("/dashboard");
  };

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden relative">
      {/* Left Sidebar */}
      <LeftSidebar
        users={onlineUsers}
        roomName={currentRoom.charAt(0).toUpperCase() + currentRoom.slice(1)}
        onInvite={() => {
          navigator.clipboard.writeText(window.location.href);
        }}
      />

      {/* Main Game Area + Overlays */}
      <div className="flex-1 relative w-full h-full">
        {/* Game Canvas (Children) */}
        {children}

        {/* Top Header Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-card border-4 border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-shadow bg-opacity-90 backdrop-blur-sm pointer-events-auto">
            <span className="font-black uppercase text-sm">
              {currentRoom.charAt(0).toUpperCase() + currentRoom.slice(1)}
            </span>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-bold">{onlineUsers.length}</span>
            </div>
          </div>
        </div>

        {/* Minimap Overlay (PIP Format) - TEMPORARILY DISABLED
        {showMinimap && (
          <div className="absolute top-20 right-4 z-50">
            <Minimap
              currentRoom={currentRoom}
              proximityRange={8}
              remotePlayers={onlineUsers.map((u) => ({
                id: u.id,
                username: u.username,
                x: u.x,
                y: u.y,
              }))}
              playerPosition={{ x: playerPosition.x, y: playerPosition.y }}
              onClose={() => setShowMinimap(false)}
            />
          </div>
        )}
        */}

        {/* Bottom Media Controls */}
        {/* <ChatOverlay /> TEMPORARILY DISABLED */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <MediaControls
            onAudioToggle={(enabled) => {
              console.log("Audio:", enabled);
              rtcManager.toggleAudio(enabled);
            }}
            onVideoToggle={(enabled) => {
              console.log("Video:", enabled);
              rtcManager.toggleVideo(enabled);
            }}
            onScreenShareToggle={(enabled) => console.log("Share:", enabled)}
            onMinimapToggle={() => setShowMinimap(!showMinimap)}
            onExit={handleExit}
            showMinimap={showMinimap}
          />
        </div>
      </div>
    </div>
  );
}
