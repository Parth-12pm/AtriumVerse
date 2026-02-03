"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventBus, {
  GameEvents,
  PlayerPositionEvent,
  ProximityChangeEvent,
} from "@/game/EventBus";
import { MediaControls } from "@/components/game/MediaControls";
import { LeftSidebar } from "@/components/game/LeftSidebar";
import { Button } from "@/components/ui/button";
import { Users, Map, X } from "lucide-react";

interface ServerLayoutProps {
  children: React.ReactNode;
  params: { id: string }; // params available in Layout? Yes in server components, but this is client?
  // Actually, Layouts in App Router (server components) get params.
  // But we want a Client Component wrapper.
}

// We'll make this a wrapper component we import in the server-side layout
export default function ServerHUD({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // HUD State
  const [playerPosition, setPlayerPosition] = useState({ x: 10, y: 10 });
  const [currentRoom, setCurrentRoom] = useState<"hall" | "meeting" | "office">(
    "hall",
  );
  const [showMinimap, setShowMinimap] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<
    Array<{ id: string; username: string; status: "online" | "away" | "busy" }>
  >([]);

  useEffect(() => {
    // Event Listeners
    const handlePositionUpdate = (data: PlayerPositionEvent) => {
      setPlayerPosition({ x: data.x, y: data.y });
    };

    const handleRoomEnter = (data: { roomId: string }) => {
      setCurrentRoom(data.roomId as "hall" | "meeting" | "office");
    };

    const handleUserListUpdate = (users: string[]) => {
      // Convert string[] to object array for UI
      // Ideally backend sends full objects. For now, mock status.
      const userObjects = users.map((uid) => ({
        id: uid,
        username: userIdToUsername(uid), // Helper or just use ID if username unknown
        status: "online" as const,
      }));
      setOnlineUsers(userObjects);
    };

    // Helper to extract username from ID if we stored it?
    // Actually Phaser has the map, React doesn't know usernames unless we sync them.
    // For now, let's just display ID or 'Player' if unknown.
    // Wait, MainScene spawns players with usernames. It receives 'username' in 'player_move' and 'user_joined'.
    // We should probably emit the FULL user object list if possible.
    // But 'user_list' event from backend is just IDs?
    // Backend `manager.connect` sends `{"type": "user_list", "users": list(online_users)}`. `online_users` is a set of user_ids.
    // Backend Redis saves `user:{user_id}` hash with username.
    // Backend `user_list` ONLY sends IDs. This is a limitation.
    // Frontend MainScene gets IDs.

    EventBus.on(GameEvents.PLAYER_POSITION, handlePositionUpdate);
    EventBus.on(GameEvents.ROOM_ENTER, handleRoomEnter);
    EventBus.on(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);

    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
      EventBus.off(GameEvents.ROOM_ENTER, handleRoomEnter);
      EventBus.off(GameEvents.PLAYER_LIST_UPDATE, handleUserListUpdate);
    };
  }, []);

  // Temporary helper until backend sends usernames in list
  const userIdToUsername = (id: string) => {
    // Try to find if we knew this user?
    return id.includes("test-user") ? "Player" : id;
  };

  const handleExit = () => {
    router.push("/dashboard");
  };

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        users={onlineUsers}
        roomName={currentRoom.charAt(0).toUpperCase() + currentRoom.slice(1)}
        onInvite={() => {
          navigator.clipboard.writeText(window.location.href);
        }}
      />

      {/* Main Game Area + Overlays */}
      <div className="flex-1 relative">
        {/* Game Canvas (Children) */}
        {children}

        {/* Top Header Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-card border-4 border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-shadow">
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

        {/* Minimap Overlay */}
        {showMinimap && (
          <div className="absolute top-4 right-4 z-30">
            <div className="bg-card border-4 border-border rounded-lg p-3 shadow-shadow">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-xs uppercase flex items-center gap-2">
                  <Map className="h-4 w-4" /> Minimap
                </span>
                <Button
                  variant="neutral"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowMinimap(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="w-40 h-32 bg-muted border-2 border-border rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Map className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">
                    Coming Soon
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Tile: ({playerPosition.x}, {playerPosition.y})
              </p>
            </div>
          </div>
        )}

        {/* Bottom Media Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <MediaControls
            onAudioToggle={(enabled) => console.log("Audio:", enabled)}
            onVideoToggle={(enabled) => console.log("Video:", enabled)}
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
