"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import EventBus, { GameEvents } from "@/game/EventBus";
import { ChannelSidebar } from "@/components/game/ChannelSidebar";
import { Button } from "@/components/ui/button";
import { Users, LogOut } from "lucide-react";

export default function ServerHUD({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;

  const [playerPosition, setPlayerPosition] = useState({ x: 10, y: 10 });
  const [currentZone, setCurrentZone] = useState("Hall");

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
    const handlePositionUpdate = (data: any) => {
      setPlayerPosition({ x: data.x, y: data.y });
    };

    const handleZoneEnter = (data: { roomId: string }) => {
      setCurrentZone(
        data.roomId.charAt(0).toUpperCase() + data.roomId.slice(1),
      );
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
    EventBus.on(GameEvents.ROOM_ENTER, handleZoneEnter);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
    EventBus.on(GameEvents.REMOTE_PLAYER_MOVED, handleRemoteMove);

    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
      EventBus.off(GameEvents.ROOM_ENTER, handleZoneEnter);
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
      <ChannelSidebar
        serverId={serverId}
        serverName={currentZone}
        users={onlineUsers}
        onInvite={() => {
          navigator.clipboard.writeText(window.location.href);
        }}
      />

      {/* Main Game Area */}
      <div className="flex-1 relative w-full h-full">
        {/* Game Canvas */}
        {children}

        {/* Top Header Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-card border-4 border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-shadow bg-opacity-90 backdrop-blur-sm pointer-events-auto">
            <span className="font-black uppercase text-sm">{currentZone}</span>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-bold">{onlineUsers.length}</span>
            </div>
          </div>
        </div>

        {/* Bottom Exit Button */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <Button
            onClick={handleExit}
            className="border-2 border-border bg-red-500 hover:bg-red-600 text-white font-bold"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Exit Space
          </Button>
        </div>
      </div>
    </div>
  );
}
