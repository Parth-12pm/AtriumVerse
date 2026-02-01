'use client';

import { useEffect, useRef, useState } from 'react';

interface GameWrapperProps {
  userId: string;
  username: string;
  roomId: string;
}

// Module-level singleton to prevent React Strict Mode double-creation
let globalGameInstance: Phaser.Game | null = null;
let isInitializing = false; // Prevent race condition

export default function GameWrapper({ userId, username, roomId }: GameWrapperProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);

  useEffect(() => {
    const initGame = async () => {
      // Check GLOBAL singleton, not just ref (Strict Mode protection)
      if (globalGameInstance) {
        console.log('[GameWrapper] Game already exists globally, reusing...');
        gameRef.current = globalGameInstance;
        setIsGameReady(true);
        return;
      }
      
      // Check if another initialization is in progress
      if (isInitializing) {
        console.log('[GameWrapper] Game initialization in progress, waiting...');
        // Wait for the other initialization to complete
        const checkInterval = setInterval(() => {
          if (globalGameInstance) {
            console.log('[GameWrapper] Game ready from other initialization');
            gameRef.current = globalGameInstance;
            setIsGameReady(true);
            clearInterval(checkInterval);
          }
        }, 50);
        return;
      }

      isInitializing = true;

      // Dynamic import prevents SSR "window is not defined" error
      const { default: StartGame } = await import('@/game/phaser-game');
      
      console.log('[GameWrapper] Initializing Phaser with grid-engine...');
      
      // Pass user data directly to game initialization
      const game = await StartGame('game-container', { userId, username, roomId });
      
      globalGameInstance = game;
      gameRef.current = game;
      isInitializing = false;
      
      setIsGameReady(true);
      console.log('[GameWrapper] Game ready!');
      
      // Focus canvas for keyboard input
      setTimeout(() => {
        const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement;
        if (canvas) {
          canvas.tabIndex = 1; // Make focusable
          canvas.focus();
          console.log('[GameWrapper] Canvas focused for keyboard input');
        }
      }, 100);
    };

    initGame();

    // Cleanup on unmount - but DON'T destroy in strict mode first pass
    return () => {
      // Only destroy if we're truly unmounting (not strict mode)
      // We'll let the next component reuse the existing game
      console.log('[GameWrapper] Cleanup called (may be strict mode)');
    };
  }, [userId, username, roomId]);

  // Real cleanup when component truly unmounts
  useEffect(() => {
    return () => {
      if (globalGameInstance) {
        console.log('[GameWrapper] Final unmount - destroying game');
        globalGameInstance.destroy(true);
        globalGameInstance = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div 
        id="game-container" 
        className="w-full h-full bg-black"
        tabIndex={0}
        onClick={(e) => {
          // Focus canvas when clicking container
          const canvas = e.currentTarget.querySelector('canvas');
          if (canvas) canvas.focus();
        }}
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
