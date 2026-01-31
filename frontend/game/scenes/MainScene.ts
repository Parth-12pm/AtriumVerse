import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { GridEngine, Direction } from 'grid-engine';
import EventBus, { GameEvents, PlayerPositionEvent } from '../EventBus';

interface SceneData {
  userId: string;
  username: string;
  roomId: string;
}

export class MainScene extends Scene {
  private gridEngine!: GridEngine;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private usernameText!: Phaser.GameObjects.Text;
  private otherPlayers: Map<string, { sprite: Phaser.GameObjects.Sprite; text: Phaser.GameObjects.Text }> = new Map();
  
  private socket: WebSocket | null = null;
  private myId: string = '';
  private myUsername: string = '';
  private currentRoomId: string = '';

  constructor() {
    super({ key: 'MainScene' });
  }

  init() {
    // Get data from game registry (passed via preBoot callback)
    const data = (this.game.registry as any).sceneData;
    if (data) {
      this.myId = data.userId;
      this.myUsername = data.username;
      this.currentRoomId = data.roomId;
      console.log('[MainScene] init() received data:', data);
    } else {
      console.warn('[MainScene] No scene data found in registry');
    }
  }

  preload() {
    // Check if textures already exist (prevents hot-reload errors)
    if (!this.textures.exists('tiles_32')) {
      this.load.image('tiles_32', '/phaser_assets/Interiors_free/32x32/Interiors_free_32x32.png');
    }
    if (!this.textures.exists('room_builder')) {
      this.load.image('room_builder', '/phaser_assets/Interiors_free/32x32/Room_Builder_free_32x32.png');
    }
    
    // Load character spritesheets (16x16 - will scale to 32x32)
    if (!this.textures.exists('adam')) {
      this.load.spritesheet('adam', '/phaser_assets/Characters_free/Adam_16x16.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    
    if (!this.textures.exists('alex')) {
      this.load.spritesheet('alex', '/phaser_assets/Characters_free/Alex_16x16.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    
    if (!this.textures.exists('amelia')) {
      this.load.spritesheet('amelia', '/phaser_assets/Characters_free/Amelia_16x16.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
  }

  create() {
    console.log('[MainScene] Initializing with grid-engine');
    console.log('[MainScene] User:', this.myUsername, 'Room:', this.currentRoomId);

    // TEMPORARY: Create a simple floor grid until we have tiled map
    const tempMap = this.createTemporaryMap();

    // Create local player sprite at origin (grid-engine will position it)
    this.playerSprite = this.add.sprite(0, 0, 'adam', 0);
    this.playerSprite.setScale(2); // 16x16 → 32x32
    this.playerSprite.setDepth(100);
    this.playerSprite.setTint(0x00ff00); // BRIGHT GREEN for debugging

    console.log('[MainScene] Created player sprite at origin:', this.playerSprite.x, this.playerSprite.y);

    // Username label (will be repositioned by grid-engine)
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: '14px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 6, y: 3 },
    });
    this.usernameText.setOrigin(0.5);
    this.usernameText.setDepth(101);

    // Configure grid-engine
    const gridEngineConfig = {
      characters: [
        {
          id: 'hero',
          sprite: this.playerSprite,
          startPosition: { x: 10, y: 10 }, // Tile coordinates
          speed: 4, // Tiles per second
        },
      ],
    };

    console.log('[MainScene] Creating grid-engine with config:', gridEngineConfig);

    // Create grid-engine (using temporary map)
    this.gridEngine.create(tempMap, gridEngineConfig);
    
    // FORCE position to make sure it's correct
    this.gridEngine.setPosition('hero', { x: 15, y: 15 });
    
    console.log('[MainScene] Forced hero to tile (15, 15)');

    // Camera setup - adjust zoom to see more of the grid
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(2); // Increased zoom for better visibility
    this.cameras.main.setBounds(0, 0, 1600, 1200);
    
    console.log('[MainScene] Camera following sprite, zoom: 2');

    // Setup movement observers (CLIENT-SIDE PREDICTION)
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      if (charId === 'hero') {
        const pos = this.gridEngine.getPosition('hero');
        
        // Emit to React immediately (no latency)
        const payload: PlayerPositionEvent = {
          x: pos.x,
          y: pos.y,
          direction: direction as 'up' | 'down' | 'left' | 'right',
        };
        EventBus.emit(GameEvents.PLAYER_POSITION, payload);

        // Send to server (async)
        this.sendMovementToServer(pos.x, pos.y, direction);
      }
    });

    // Position update on every step
    this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
      if (charId === 'hero') {
        // Update username label position
        const sprite = this.playerSprite;
        this.usernameText.setPosition(sprite.x, sprite.y - 20);
      }
    });

    // Listen for React → Phaser events
    EventBus.on(GameEvents.UPDATE_AVATAR, this.updateAvatar, this);
    EventBus.on(GameEvents.SPAWN_REMOTE_PLAYER, this.spawnRemotePlayer, this);
    EventBus.on(GameEvents.REMOVE_REMOTE_PLAYER, this.removeRemotePlayer, this);

    // Proximity check timer
    this.time.addEvent({
      delay: 100,
      callback: this.checkProximity,
      callbackScope: this,
      loop: true,
    });

    console.log('[MainScene] Grid-engine initialized successfully');
    console.log('[MainScene] Player sprite position AFTER grid-engine:', this.playerSprite.x, this.playerSprite.y);
    
    // Force update sprite position immediately
    const heroPos = this.gridEngine.getPosition('hero');
    console.log('[MainScene] Grid-engine says hero is at tile:', heroPos.x, heroPos.y);
    console.log('[MainScene] Grid-engine tile size:', 32);
  }

  update() {
    // Keyboard controls
    const cursors = this.input.keyboard!.createCursorKeys();
    const wasd = this.input.keyboard!.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
    }) as any;

    // Grid-based movement (discrete tile steps)
    if (cursors.left.isDown || wasd.left.isDown) {
      this.gridEngine.move('hero', Direction.LEFT);
    } else if (cursors.right.isDown || wasd.right.isDown) {
      this.gridEngine.move('hero', Direction.RIGHT);
    } else if (cursors.up.isDown || wasd.up.isDown) {
      this.gridEngine.move('hero', Direction.UP);
    } else if (cursors.down.isDown || wasd.down.isDown) {
      this.gridEngine.move('hero', Direction.DOWN);
    }

    // Update username label to follow player
    this.usernameText.setPosition(this.playerSprite.x, this.playerSprite.y - 20);

    // Update other players' labels
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 20);
    });
  }

  private createTemporaryMap() {
    // TEMPORARY: Create a simple 50x50 grid floor
    // This will be replaced with Tiled JSON map
    const tileSize = 32;
    const gridWidth = 50;
    const gridHeight = 50;

    console.log('[MainScene] Creating visible grid:', gridWidth, 'x', gridHeight, 'tiles');

    // Draw visual grid with BRIGHT COLORS for visibility
    const graphics = this.add.graphics();
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        // Bright checkerboard pattern
        if ((x + y) % 2 === 0) {
          graphics.fillStyle(0x333333, 1); // Dark gray
        } else {
          graphics.fillStyle(0x555555, 1); // Light gray
        }
        graphics.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        
        // Grid lines (bright cyan)
        graphics.lineStyle(2, 0x00ffff, 0.3);
        graphics.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    // Add colored markers at key positions
    // Center marker (bright red)
    graphics.fillStyle(0xff0000, 0.5);
    graphics.fillRect(15 * tileSize, 15 * tileSize, tileSize, tileSize);
    
    // Origin marker (bright yellow)
    graphics.fillStyle(0xffff00, 0.5);
    graphics.fillRect(0, 0, tileSize * 2, tileSize * 2);

    graphics.setDepth(0);
    
    console.log('[MainScene] Grid graphics created, should be visible');

    // Create a proper blank tilemap for grid-engine
    const config: Phaser.Types.Tilemaps.TilemapConfig = {
      tileWidth: tileSize,
      tileHeight: tileSize,
      width: gridWidth,
      height: gridHeight,
    };

    const map = this.make.tilemap(config);
    
    return map;
  }

  private sendMovementToServer(x: number, y: number, direction: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    this.socket.send(JSON.stringify({
      type: 'move',
      id: this.myId,
      x,
      y,
      direction,
    }));
  }

  private checkProximity() {
    if (!this.gridEngine.hasCharacter('hero')) return;
    
    const myPos = this.gridEngine.getPosition('hero');
    
    this.otherPlayers.forEach((player, playerId) => {
      if (!this.gridEngine.hasCharacter(playerId)) return;
      
      const otherPos = this.gridEngine.getPosition(playerId);
      
      // Euclidean distance in tiles
      const distance = Phaser.Math.Distance.Between(
        myPos.x,
        myPos.y,
        otherPos.x,
        otherPos.y
      );

      // Emit proximity event to React
      EventBus.emit(GameEvents.PROXIMITY_CHANGE, {
        playerId,
        distance,
        inRange: distance < 5, // 5 tiles = Gather.town "intimate zone"
      });
    });
  }

  private updateAvatar(data: { color?: string }) {
    if (data.color) {
      this.playerSprite.setTint(parseInt(data.color.replace('#', '0x')));
    }
  }

  private spawnRemotePlayer(data: { id: string; username: string; x: number; y: number }) {
    if (this.otherPlayers.has(data.id)) return;

    console.log('[MainScene] Spawning remote player:', data.username);

    // Create sprite
    const sprite = this.add.sprite(0, 0, 'alex', 0);
    sprite.setScale(2);
    sprite.setDepth(100);

    // Create username label
    const text = this.add.text(0, -20, data.username, {
      fontSize: '12px',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 4, y: 2 },
    });
    text.setOrigin(0.5);
    text.setDepth(101);

    // Add to grid-engine
    this.gridEngine.addCharacter({
      id: data.id,
      sprite: sprite,
      startPosition: { x: data.x, y: data.y },
      speed: 4,
      collides: {
        collisionGroups: ['wall'],
      },
    });

    this.otherPlayers.set(data.id, { sprite, text });
  }

  private removeRemotePlayer(data: { id: string }) {
    const player = this.otherPlayers.get(data.id);
    if (!player) return;

    console.log('[MainScene] Removing remote player:', data.id);

    this.gridEngine.removeCharacter(data.id);
    player.sprite.destroy();
    player.text.destroy();
    this.otherPlayers.delete(data.id);
  }

  destroy() {
    // Cleanup
    EventBus.off(GameEvents.UPDATE_AVATAR, this.updateAvatar, this);
    EventBus.off(GameEvents.SPAWN_REMOTE_PLAYER, this.spawnRemotePlayer, this);
    EventBus.off(GameEvents.REMOVE_REMOTE_PLAYER, this.removeRemotePlayer, this);
    
    if (this.socket) {
      this.socket.close();
    }
  }
}
