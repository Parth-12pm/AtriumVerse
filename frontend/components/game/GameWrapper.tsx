"use client";

import { useEffect, useRef, useState } from "react";

interface GameWrapperProps {
  userId: string;
  username: string;
  serverId: string;
  token: string;
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
      if (process.env.NODE_ENV === "development" && globalGameInstance) {
        console.log("[GameWrapper] Dev: destroying stale game for hot reload");
        globalGameInstance.destroy(true);
        globalGameInstance = null;
        isInitializing = false;
      }

      if (globalGameInstance) {
        console.log("[GameWrapper] Game already exists, reusing");
        gameRef.current = globalGameInstance;
        setIsGameReady(true);
        return;
      }

      if (isInitializing) {
        console.log("[GameWrapper] Initialization in progress, waiting");
        const checkInterval = setInterval(() => {
          if (globalGameInstance) {
            console.log("[GameWrapper] Game ready from other initialization");
            gameRef.current = globalGameInstance;
            setIsGameReady(true);
            clearInterval(checkInterval);
          }
        }, 50);
        return;
      }

      isInitializing = true;

      const { default: StartGame } = await import("@/game/phaser-game");

      console.log("[GameWrapper] Initializing Phaser with Grid Engine");

      const game = await StartGame("game-container", {
        userId,
        username,
        serverId,
        token,
        apiUrl: process.env.NEXT_PUBLIC_API_URL,
      });

      globalGameInstance = game;
      gameRef.current = game;
      isInitializing = false;

      setIsGameReady(true);
      console.log("[GameWrapper] Game ready");

      setTimeout(() => {
        const canvas = document.querySelector(
          "#game-container canvas",
        ) as HTMLCanvasElement;
        if (canvas) {
          canvas.tabIndex = 1;
          canvas.focus();
        }
      }, 100);
    };

    initGame();

    return () => {
      console.log("[GameWrapper] Cleanup called");
    };
  }, [userId, username, serverId, token]);

  useEffect(() => {
    return () => {
      if (globalGameInstance) {
        console.log("[GameWrapper] Final unmount - destroying game");
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
          const canvas = e.currentTarget.querySelector("canvas");
          if (canvas) canvas.focus();
        }}
      />
      {!isGameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading World...</p>
          </div>
        </div>
      )}
    </div>
  );
}
