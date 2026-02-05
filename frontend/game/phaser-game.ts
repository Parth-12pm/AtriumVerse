import * as Phaser from "phaser";
import { GridEngine } from "grid-engine";
import { MainScene } from "./scenes/MainScene";

export default async function StartGame(
  parent: string,
  sceneData: {
    userId: string;
    username: string;
    serverId: string;
    token: string;
    apiUrl?: string;
  },
): Promise<Phaser.Game> {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: parent,
    backgroundColor: "#1a1a1a",

    pixelArt: true,
    antialias: false,
    roundPixels: true,

    plugins: {
      scene: [
        {
          key: "gridEngine",
          plugin: GridEngine,
          mapping: "gridEngine",
        },
      ],
    },

    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    scene: [MainScene],
    fps: {
      target: 60,
      forceSetTimeOut: true,
    },
  };

  const game = new Phaser.Game(config);

  // Pass data to scene via scene.start with data parameter
  game.scene.start("MainScene", sceneData);

  return game;
}