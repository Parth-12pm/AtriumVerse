import * as Phaser from 'phaser';
import { GridEngine } from 'grid-engine';
import { MainScene } from './scenes/MainScene';

/**
 * Grid-Engine Phaser Game Configuration
 * CRITICAL: No Arcade Physics - grid-engine handles all movement
 */
export default async function StartGame(
  parent: string,
  sceneData?: { userId: string; username: string; roomId: string }
): Promise<Phaser.Game> {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: parent,
    backgroundColor: '#1a1a1a',
    
    // CRITICAL: Enable pixel art rendering for crisp 32x32 tiles
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    
    // NO PHYSICS - grid-engine replaces Arcade Physics
    
    // Grid-Engine Plugin
    plugins: {
      scene: [
        {
          key: 'gridEngine',
          plugin: GridEngine,
          mapping: 'gridEngine', // Accessible via this.gridEngine in scenes
        },
      ],
    },
    
    scale: {
      mode: Phaser.Scale.RESIZE, // Responsive scaling
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    
    scene: [MainScene],
    
    // Pass scene data via callbacks (NOT scene.start!)
    callbacks: sceneData ? {
      preBoot: (game) => {
        // Store data globally for scene to access in init()
        (game.registry as any).sceneData = sceneData;
      }
    } : undefined,
  };

  return new Phaser.Game(config);
}
