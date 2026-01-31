export interface PhaserConfig {
  type?: number;
  parent?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  physics?: any;
  scale?: any;
  scene?: any[];
}

export const createPhaserConfig = (parentElementId: string): PhaserConfig => {
  return {
    parent: parentElementId,
    width: 1200,
    height: 800,
    backgroundColor: '#000000',
    
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // Top-down view, no gravity
        debug: process.env.NODE_ENV === 'development', // Show collision boxes in dev
      },
    },
    
    scale: {
      mode: 1, // Phaser.Scale.FIT
      autoCenter: 1, // Phaser.Scale.CENTER_BOTH
    },
    
    // Scenes will be added dynamically
    scene: [],
  };
};
