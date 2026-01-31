'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, use } from 'react';
import EventBus, { GameEvents, PlayerPositionEvent, ProximityChangeEvent } from '@/game/EventBus';
import { Minimap } from '@/components/game/Minimap';
import { MediaControls } from '@/components/game/MediaControls';
import { RoomHUD } from '@/components/game/RoomHUD';

// SSR disabled - grid-engine requires browser
const GameWrapper = dynamic(() => import('@/components/game/GameWrapperNew'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-black">
      <p className="text-white text-lg">Initializing Grid-Engine...</p>
    </div>
  ),
});

interface RoomPageGridProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RoomPageGrid({ params }: RoomPageGridProps) {
  const { id: roomId } = use(params);
  
  // Mock user data
  const [userId] = useState('test-user-' + Math.random().toString(36).substr(2, 9));
  const [username] = useState('Player' + Math.floor(Math.random() * 1000));
  
  // Game state (synced via Event Bus)
  const [playerPosition, setPlayerPosition] = useState({ x: 10, y: 10 });
  const [currentRoom, setCurrentRoom] = useState<'hall' | 'meeting' | 'office'>('hall');
  const [proximityPlayers, setProximityPlayers] = useState<string[]>([]);

  useEffect(() => {
    console.log('[RoomPageGrid] Setting up Event Bus listeners');

    // Listen for Phaser → React events
    const handlePositionUpdate = (data: PlayerPositionEvent) => {
      setPlayerPosition({ x: data.x, y: data.y });
    };

    const handleRoomEnter = (data: { roomId: string }) => {
      console.log('[React] Room changed:', data.roomId);
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
      console.log('[RoomPageGrid] Cleaning up Event Bus listeners');
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
      EventBus.off(GameEvents.ROOM_ENTER, handleRoomEnter);
      EventBus.off(GameEvents.PROXIMITY_CHANGE, handleProximityChange);
    };
  }, []);

  const handleAudioToggle = (enabled: boolean) => {
    console.log('Audio toggled:', enabled);
  };

  const handleVideoToggle = (enabled: boolean) => {
    console.log('Video toggled:', enabled);
  };

  const handleScreenShareToggle = (enabled: boolean) => {
    console.log('Screen share toggled:', enabled);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Phaser Game Canvas */}
      <GameWrapper
        userId={userId}
        username={username}
        roomId={roomId}
      />

      {/* UI Overlays */}
      <RoomHUD
        roomName={`Grid-Engine Test: ${currentRoom}`}
        roomType={currentRoom}
        playerCount={proximityPlayers.length + 1}
        
      />

      {/* Debug Info */}
      <div className="absolute top-20 left-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm">
        <p className="text-green-400 font-bold mb-2">🎮 Grid-Engine Active</p>
        <p>Room: {currentRoom}</p>
        <p>Tile: ({playerPosition.x}, {playerPosition.y})</p>
        <p>Nearby: {proximityPlayers.length}</p>
        <p className="text-yellow-400 mt-2">WASD or Arrow keys to move</p>
      </div>

      <MediaControls
        onAudioToggle={handleAudioToggle}
        onVideoToggle={handleVideoToggle}
        onScreenShareToggle={handleScreenShareToggle}
      />
    </div>
  );
}
