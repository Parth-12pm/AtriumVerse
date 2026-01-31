// DO NOT import Phaser at module scope - causes SSR "window is not defined"
// Import dynamically inside StartGame function instead

const StartGame = async (parent: string) => {
  // Dynamic import - only runs on client-side
  const Phaser = await import('phaser');
  const { RoomScene } = await import('./scenes/RoomScene');

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1200,
    height: 800,
    parent: parent,
    backgroundColor: '#000000',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: process.env.NODE_ENV === 'development',
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [RoomScene],
  };

  return new Phaser.Game(config);
};

export default StartGame;
