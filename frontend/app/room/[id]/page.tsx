'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { GameCanvas } from '@/components/game/GameCanvas';
import { Minimap } from '@/components/game/Minimap';
import { MediaControls } from '@/components/game/MediaControls';
import { RoomHUD } from '@/components/game/RoomHUD';
import { useRouter } from 'next/navigation';

// Commented backend API integration - to be implemented later
/*
import { getRoomLayout } from '@/lib/api/rooms';

async function fetchRoomData(roomId: string) {
  const layout = await getRoomLayout(roomId);
  return layout;
}
*/

interface RoomPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  
  // Unwrap params Promise (Next.js 16)
  const { id: roomId } = use(params);
  
  // Mock user data - in production, fetch from auth context
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  
  // Room state
  const [currentRoom, setCurrentRoom] = useState<'hall' | 'meeting' | 'office'>('hall');
  const [playerPosition, setPlayerPosition] = useState({ x: 400, y: 300 });
  const [proximityRange, setProximityRange] = useState(200);
  const [remotePlayers, setRemotePlayers] = useState<Array<{
    id: string;
    username: string;
    x: number;
    y: number;
  }>>([]);

  // Initialize user from localStorage/auth
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Parse user info from token (simplified - in production, verify with backend)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserId(payload.user_id || 'test-user-id');
      setUsername(payload.username || 'Guest');
    } catch (error) {
      console.error('Failed to parse token:', error);
      setUserId('test-user-' + Math.random().toString(36).substr(2, 9));
      setUsername('Guest' + Math.floor(Math.random() * 1000));
    }

    /* Backend API integration - commented for later
    fetchRoomData(roomId)
      .then((layout) => {
        console.log('Room layout:', layout);
      })
      .catch((error) => {
        console.error('Failed to fetch room:', error);
      });
    */
  }, [roomId, router]);

  // Position update handler (throttled)
  const handlePositionUpdate = useCallback((x: number, y: number, direction: string) => {
    setPlayerPosition({ x, y });

    // TODO: Send to WebSocket
    /*
    if (wsConnection) {
      wsConnection.send(JSON.stringify({
        type: 'move',
        x,
        y,
        direction,
      }));
    }
    */
  }, []);

  // Room change handler (called when player transitions rooms)
  const handleRoomChange = useCallback((roomId: string, newProximityRange: number) => {
    console.log('[RoomPage] Room changed to:', roomId, 'proximity:', newProximityRange);
    setCurrentRoom(roomId as 'hall' | 'meeting' | 'office');
    setProximityRange(newProximityRange);
  }, []);

  // Media control handlers
  const handleAudioToggle = (enabled: boolean) => {
    console.log('Audio toggled:', enabled);
    // TODO: Implement WebRTC audio toggle
  };

  const handleVideoToggle = (enabled: boolean) => {
    console.log('Video toggled:', enabled);
    // TODO: Implement WebRTC video toggle
  };

  const handleScreenShareToggle = (enabled: boolean) => {
    console.log('Screen share toggled:', enabled);
    // TODO: Implement screen share
  };

  // WebSocket integration - commented for later
  /*
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${roomId}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'join_room', room_id: roomId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'user_joined':
          const scene = (window as any).__roomScene;
          if (scene) {
            scene.addRemotePlayer(data.user_id, data.username, data.x, data.y);
          }
          setRemotePlayers((prev) => [...prev, {
            id: data.user_id,
            username: data.username,
            x: data.x,
            y: data.y,
          }]);
          break;

        case 'movement':
          const sceneMove = (window as any).__roomScene;
          if (sceneMove) {
            sceneMove.updateRemotePlayer(data.user_id, data.x, data.y, data.direction);
          }
          setRemotePlayers((prev) =>
            prev.map((p) =>
              p.id === data.user_id ? { ...p, x: data.x, y: data.y } : p
            )
          );
          break;

        case 'user_left':
          const sceneLeave = (window as any).__roomScene;
          if (sceneLeave) {
            sceneLeave.removeRemotePlayer(data.user_id);
          }
          setRemotePlayers((prev) => prev.filter((p) => p.id !== data.user_id));
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [roomId]);
  */

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Phaser Game Canvas */}
      <GameCanvas
        roomId={roomId}
        userId={userId}
        username={username}
        onPositionUpdate={handlePositionUpdate}
        onRoomChange={handleRoomChange}
      />

      {/* UI Overlays */}
      <RoomHUD
        roomName="AtriumVerse Space"
        roomType={currentRoom}
        playerCount={remotePlayers.length + 1}
      />

      <Minimap
        currentRoom={currentRoom}
        playerPosition={playerPosition}
        proximityRange={proximityRange}
        remotePlayers={remotePlayers}
      />

      <MediaControls
        onAudioToggle={handleAudioToggle}
        onVideoToggle={handleVideoToggle}
        onScreenShareToggle={handleScreenShareToggle}
      />
    </div>
  );
}
