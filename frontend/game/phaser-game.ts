import * as Phaser from 'phaser';
import { GridEngine } from 'grid-engine';
import { MainScene } from './scenes/MainScene';

export default async function StartGame(
  parent: string,
  sceneData?: { userId: string; username: string; roomId: string; token: string }
): Promise<Phaser.Game> {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: parent,
    backgroundColor: '#1a1a1a',
    pixelArt: true,
    antialias: false,
    roundPixels: true,

    plugins: {
      scene: [
        {
          key: 'gridEngine',
          plugin: GridEngine,
          mapping: 'gridEngine',
        },
      ],
    },

    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: '100%',
      height: '100%',
      expandParent: true
    },

    scene: [MainScene],

    callbacks: sceneData ? {
      preBoot: (game) => {
        (game.registry as any).sceneData = sceneData;
      }
    } : undefined,
  };

  return new Phaser.Game(config);
}
