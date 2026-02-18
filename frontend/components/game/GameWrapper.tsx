"use client";

import { useEffect, useRef, useState } from "react";

interface GameWrapperProps {
  userId: string;
  username: string;
  serverId: string;
  token: string;
  characterId?: string;
}

let globalGameInstance: Phaser.Game | null = null;
let isInitializing = false;

export default function GameWrapper({
  userId,
  username,
  serverId,
  token,
}: GameWrapperProps) {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);

  useEffect(() => {
    const initGame = async () => {
      if (globalGameInstance) {
        console.log("[GameWrapper] Reusing existing game");
        gameRef.current = globalGameInstance;
        setIsGameReady(true);
        return;
      }

      if (isInitializing) return;
      isInitializing = true;

      const { default: StartGame } = await import("@/game/phaser-game");
      console.log("[GameWrapper] Starting Parth-Engine...");

      const game = await StartGame("game-container", {
        userId,
        username,
        roomId: serverId,
        token
      });

      globalGameInstance = game;
      gameRef.current = game;
      isInitializing = false;
      setIsGameReady(true);

      setTimeout(() => {
        const canvas = document.querySelector("#game-container canvas") as HTMLCanvasElement;
        if (canvas) {
          canvas.tabIndex = 1;
          canvas.focus();
        }
      }, 100);
    };

    initGame();

    return () => {
      console.log("[GameWrapper] Cleanup");
    };
  }, [userId, username, serverId, token]);

  useEffect(() => {
    return () => {
      if (globalGameInstance) {
        globalGameInstance.destroy(true);
        globalGameInstance = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <div
        id="game-container"
        className="w-full h-full"
        tabIndex={0}
      />
      {!isGameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p className="text-white text-lg font-bold">RESTORING PARTH WORLD...</p>
          </div>
        </div>
      )}
    </div>
  );
}
