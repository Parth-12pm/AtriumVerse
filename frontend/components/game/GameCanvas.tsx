'use client';

import { useRef } from 'react';
import { PhaserGame, IRefPhaserGame } from './PhaserGameClient';

interface GameCanvasProps {
  roomId: string;
  userId: string;
  username: string;
  onPositionUpdate?: (x: number, y: number, direction: string) => void;
  onPlayerJoin?: (userId: string, username: string, x: number, y: number) => void;
  onPlayerLeave?: (userId: string) => void;
  onRoomChange?: (roomId: string, proximityRange: number) => void;
}

export function GameCanvas(props: GameCanvasProps) {
  const phaserRef = useRef<IRefPhaserGame | null>(null);

  return <PhaserGame ref={phaserRef} {...props} />;
}
