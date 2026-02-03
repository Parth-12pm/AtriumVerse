"use client";

import { forwardRef, useLayoutEffect, useRef } from "react";
import StartGame from "@/game/phaser-game";

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

interface IProps {
  serverId: string;
  userId: string;
  username: string;
  onPositionUpdate?: (x: number, y: number, direction: string) => void;
  onRoomChange?: (roomId: string, proximityRange: number) => void;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
  function PhaserGame(
    { serverId, userId, username, onPositionUpdate, onRoomChange },
    ref,
  ) {
    const game = useRef<Phaser.Game | null>(null);

    useLayoutEffect(() => {
      if (game.current === null) {
        // StartGame is now async (dynamic import)
        StartGame("game-container").then((gameInstance) => {
          game.current = gameInstance;

          game.current = gameInstance;

          if (typeof ref === "function") {
            ref({ game: game.current, scene: null });
          } else if (ref) {
            ref.current = { game: game.current, scene: null };
          }

          // Wait for scene to be ready
          game.current.events.once("ready", () => {
            const scene = game.current!.scene.getScene("RoomScene");

            if (scene) {
              // Initialize the scene with data
              (scene as any).init({
                serverId,
                userId,
                username,
                startingRoom: "hall",
              });

              // Set up position update callback
              if (onPositionUpdate) {
                (scene as any).onPositionUpdate = onPositionUpdate;
              }

              // Set up room change callback
              if (onRoomChange) {
                (scene as any).onRoomChange = onRoomChange;
              }

              // Store scene globally
              if (typeof window !== "undefined") {
                (window as any).__roomScene = scene;
              }

              // Update ref
              if (typeof ref === "function") {
                ref({ game: game.current, scene });
              } else if (ref) {
                ref.current = { game: game.current, scene };
              }
            }
          });
        });
      }

      return () => {
        if (game.current) {
          game.current.destroy(true);
          game.current = null;
        }
        if (typeof window !== "undefined") {
          delete (window as any).__roomScene;
        }
      };
    }, []); // Empty dependency array - only run once

    return (
      <div className="relative w-full h-full bg-black">
        <div id="game-container" className="w-full h-full" />
      </div>
    );
  },
);
