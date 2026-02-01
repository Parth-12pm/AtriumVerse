'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import EventBus, { GameEvents, PlayerPositionEvent, ProximityChangeEvent } from '@/game/EventBus';
import { MediaControls } from '@/components/game/MediaControls';
import { LeftSidebar } from '@/components/game/LeftSidebar';
import { Button } from '@/components/ui/button';
import { Users, Map, X } from 'lucide-react';

// SSR disabled - grid-engine requires browser
const GameWrapper = dynamic(() => import('@/components/game/GameWrapperNew'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary rounded-lg border-4 border-border shadow-shadow animate-pulse mx-auto mb-4" />
        <p className="font-bold uppercase">Loading Space...</p>
      </div>
    </div>
  ),
});

interface RoomPageGridProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RoomPageGrid({ params }: RoomPageGridProps) {
  const router = useRouter();
  const { id: roomId } = use(params);
  
  // User data
  const [userId] = useState('test-user-' + Math.random().toString(36).substr(2, 9));
  const [username, setUsername] = useState('Player');
  const [mounted, setMounted] = useState(false);
  
  // Game state
  const [playerPosition, setPlayerPosition] = useState({ x: 10, y: 10 });
  const [currentRoom, setCurrentRoom] = useState<'hall' | 'meeting' | 'office'>('hall');
  const [proximityPlayers, setProximityPlayers] = useState<string[]>([]);
  
  // UI state
  const [showMinimap, setShowMinimap] = useState(false);

  // Dynamic online users from game state
  const [onlineUsers, setOnlineUsers] = useState<Array<{id: string; username: string; status: 'online' | 'away' | 'busy'}>>([]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedUsername = localStorage.getItem('username') || 'Player' + Math.floor(Math.random() * 1000);
      setUsername(storedUsername);
      // Initialize with current user
      setOnlineUsers([{ id: userId, username: storedUsername, status: 'online' }]);
    }
  }, [userId]);

  useEffect(() => {
    const handlePositionUpdate = (data: PlayerPositionEvent) => {
      setPlayerPosition({ x: data.x, y: data.y });
    };

    const handleRoomEnter = (data: { roomId: string }) => {
      setCurrentRoom(data.roomId as 'hall' | 'meeting' | 'office');
    };

    const handleProximityChange = (data: ProximityChangeEvent) => {
      if (data.inRange) {
        setProximityPlayers((prev) => [...new Set([...prev, data.playerId])]);
      } else {
        setProximityPlayers((prev) => prev.filter((id) => id !== data.playerId));
      }
    };

    EventBus.on(GameEvents.PLAYER_POSITION, handlePositionUpdate);
    EventBus.on(GameEvents.ROOM_ENTER, handleRoomEnter);
    EventBus.on(GameEvents.PROXIMITY_CHANGE, handleProximityChange);

    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
      EventBus.off(GameEvents.ROOM_ENTER, handleRoomEnter);
      EventBus.off(GameEvents.PROXIMITY_CHANGE, handleProximityChange);
    };
  }, []);

  const handleExit = () => {
    router.push('/dashboard');
  };

  return (
    <div className="h-screen w-screen flex bg-background overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        users={onlineUsers}
        roomName={currentRoom.charAt(0).toUpperCase() + currentRoom.slice(1)}
        onInvite={() => {
          // Copy room link to clipboard
          navigator.clipboard.writeText(window.location.href);
        }}
      />

      {/* Main Game Area */}
      <div className="flex-1 relative">
        {/* Full-screen Game Canvas */}
        <GameWrapper
          userId={userId}
          username={mounted ? username : 'Player'}
          roomId={roomId}
        />

        {/* Top Header Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-card border-4 border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-shadow">
            <span className="font-black uppercase text-sm">
              {currentRoom.charAt(0).toUpperCase() + currentRoom.slice(1)}
            </span>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Minimap Overlay (top-right) */}
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
                  <span className="text-xs text-muted-foreground">Coming Soon</span>
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
            onAudioToggle={(enabled) => console.log('Audio:', enabled)}
            onVideoToggle={(enabled) => console.log('Video:', enabled)}
            onScreenShareToggle={(enabled) => console.log('Share:', enabled)}
            onMinimapToggle={() => setShowMinimap(!showMinimap)}
            onExit={handleExit}
            showMinimap={showMinimap}
          />
        </div>
      </div>
    </div>
  );
}
