'use client';

import { useEffect, useRef, useState } from 'react';

interface GameWrapperProps {
  userId: string;
  username: string;
  roomId: string;
}

export default function GameWrapper({ userId, username, roomId }: GameWrapperProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);

  useEffect(() => {
    const initGame = async () => {
      // Dynamic import prevents SSR "window is not defined" error
      const { default: StartGame } = await import('@/game/phaser-game');
      
      if (!gameRef.current) {
        console.log('[GameWrapper] Initializing Phaser with grid-engine...');
        
        // Pass user data directly to game initialization
        gameRef.current = await StartGame('game-container', { userId, username, roomId });
        
        setIsGameReady(true);
        console.log('[GameWrapper] Game ready!');
        
        // Focus canvas for keyboard input
        setTimeout(() => {
          const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement;
          if (canvas) {
            canvas.focus();
            canvas.click(); // Trigger focus
            console.log('[GameWrapper] Canvas focused for keyboard input');
          }
        }, 100);
      }
    };

    initGame();

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        console.log('[GameWrapper] Destroying game');
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []); // Empty deps - only run once

  return (
    <div className="relative w-full h-full">
      <div 
        id="game-container" 
        className="w-full h-full bg-black"
      />
      {!isGameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading Grid-Engine...</p>
          </div>
        </div>
      )}
    </div>
  );
}
