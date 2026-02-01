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
  private lastDirection: string = 'down'; // Track last facing direction for idle state
  
  // Throttling for sending position updates
  private lastSentPosition = { x: 0, y: 0 };
  private lastSentTime = 0;
  private sendThrottleMs = 50; // Send max 20 updates/second
  
  // Keyboard controls (create once, not every frame!)
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

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
    // Load the Tiled JSON map
    if (!this.cache.tilemap.exists('main_map')) {
      this.load.tilemapTiledJSON('main_map', '/phaser_assets/maps/final_map.json');
    }

    // Load all tilesets referenced in the map
    if (!this.textures.exists('OfficeTiles')) {
      this.load.image('OfficeTiles', '/phaser_assets/Interiors_free/32x32/Interiors_free_32x32.png');
    }
    if (!this.textures.exists('RoomBuilder')) {
      this.load.image('RoomBuilder', '/phaser_assets/Interiors_free/32x32/Room_Builder_free_32x32.png');
    }
    if (!this.textures.exists('OldTiles')) {
      this.load.image('OldTiles', '/phaser_assets/Old/Tileset_32x32_1.png');
    }
    if (!this.textures.exists('tileset2')) {
      this.load.image('tileset2', '/phaser_assets/Old/Tileset_32x32_2.png');
    }
    if (!this.textures.exists('tileset16')) {
      this.load.image('tileset16', '/phaser_assets/Old/Tileset_32x32_16.png');
    }
    
    // Load NPC_test character spritesheet
    // VERIFIED DIMENSIONS: 64px width x 128px height
    // Grid: 4 columns x 4 rows = 16 frames
    // Frame Size: 16x32 pixels (64/4 = 16, 128/4 = 32)
    // Row 0 = Down, Row 1 = Right, Row 2 = Up, Row 3 = Left
    if (!this.textures.exists('player')) {
      this.load.spritesheet('player', '/NPC_test.png', {
        frameWidth: 16,
        frameHeight: 32,
      });
    }
  }

  create() {
    console.log('[MainScene] Initializing with grid-engine');
    console.log('[MainScene] User:', this.myUsername, 'Room:', this.currentRoomId);

    // Load the REAL Tiled map
    const map = this.make.tilemap({ key: 'main_map' });
    console.log('[MainScene] Loaded tilemap:', map.width, 'x', map.height, 'tiles');

    // Add all tilesets (must match names in Tiled)
    const officeTiles = map.addTilesetImage('OfficeTiles', 'OfficeTiles');
    const roomBuilder = map.addTilesetImage('RoomBuilder', 'RoomBuilder');
    const oldTiles = map.addTilesetImage('OldTiles', 'OldTiles');
    const tileset2 = map.addTilesetImage('tileset2', 'tileset2');
    const tileset16 = map.addTilesetImage('tileset16', 'tileset16');
    
    const allTilesets = [officeTiles, roomBuilder, oldTiles, tileset2, tileset16].filter(t => t !== null) as Phaser.Tilemaps.Tileset[];
    console.log('[MainScene] Loaded tilesets:', allTilesets.length);

    // Create visible layers
    const floorLayer = map.createLayer('Floor', allTilesets, 0, 0);
    const wallsLayer = map.createLayer('Walls', allTilesets, 0, 0);
    const furnitureLayer = map.createLayer('Furniture', allTilesets, 0, 0);
    
    // Create Collision layer (hidden, used for grid-engine collision)
    const collisionLayer = map.createLayer('Collision', allTilesets, 0, 0);
    
    // Set layer depths
    floorLayer?.setDepth(0);
    wallsLayer?.setDepth(10);
    furnitureLayer?.setDepth(20);
    
    // Hide and configure collision layer
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      // Set all non-zero tiles as collision
      collisionLayer.setCollisionByExclusion([-1, 0]);
      console.log('[MainScene] Collision layer created and configured');
    } else {
      console.warn('[MainScene] Collision layer not found!');
    }

    console.log('[MainScene] Map layers created');

    // Get spawn point from Zones object layer
    // Default spawn: center of the Hall area (bottom half of map)
    let spawnX = 15; // Center X
    let spawnY = 15; // In the open Hall area
    
    const zonesLayer = map.getObjectLayer('Zones');
    if (zonesLayer) {
      console.log('[MainScene] Zones layer objects:', zonesLayer.objects.map(o => o.name));
      const spawnPoint = zonesLayer.objects.find(obj => obj.name === 'Spawn_main');
      if (spawnPoint && spawnPoint.x !== undefined && spawnPoint.y !== undefined) {
        spawnX = Math.floor(spawnPoint.x / 32);
        spawnY = Math.floor(spawnPoint.y / 32) - 1; // Subtract 1 to be inside the map
        console.log('[MainScene] Spawn point from map:', spawnX, spawnY, '(raw px:', spawnPoint.x, spawnPoint.y, ')');
      }
    } else {
      console.warn('[MainScene] Zones layer not found, using default spawn');
    }

    // Create local player sprite using NPC_test character (16x32 frames)
    // Use frame 0 as idle (down-facing)
    this.playerSprite = this.add.sprite(0, 0, 'player', 0);
    this.playerSprite.setScale(1.5); // 16x32 → 24x48 on screen
    this.playerSprite.setDepth(100); // Above all map layers
    this.playerSprite.setOrigin(0.5, 0.5); // Center origin

    console.log('[MainScene] Created player sprite (16x32)');

    // Username label - positioned directly above player's head
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 0, y: 0 },
    });
    this.usernameText.setOrigin(0.5, 1); // Anchor at bottom-center so it sits above head
    this.usernameText.setDepth(101);

    // Set collision on collision layer BEFORE creating grid-engine
    // Grid-engine respects Phaser tile collision
    if (collisionLayer) {
      // Mark all non-empty tiles in Collision layer as blocking
      // Grid-engine checks tile.properties.collides OR tile.collides
      collisionLayer.setCollisionByExclusion([-1, 0]);
      
      // Force set the collides property on each tile for grid-engine
      collisionLayer.forEachTile((tile) => {
        if (tile.index > 0) {
          tile.properties = tile.properties || {};
          tile.properties.ge_collide = true;
          tile.setCollision(true);
        }
      });
      
      collisionLayer.setVisible(false);
      console.log('[MainScene] Collision layer configured with', collisionLayer.layer.data.flat().filter((t: any) => t.index > 0).length, 'collision tiles');
    }
    
    // Also set collision on Walls layer as backup
    if (wallsLayer) {
      wallsLayer.setCollisionByExclusion([-1, 0]);
    }

    // Configure grid-engine - we'll handle animations manually
    // NPC_test.png: Row 0=Down, Row 1=Right, Row 2=Up, Row 3=Left
    const gridEngineConfig = {
      characters: [
        {
          id: 'hero',
          sprite: this.playerSprite,
          startPosition: { x: spawnX, y: spawnY },
          speed: 4,
        },
      ],
      numberOfDirections: 4, // 4-way movement
      collisionTilePropertyName: 'ge_collide',
    };

    console.log('[MainScene] Creating grid-engine with spawn at:', spawnX, spawnY);

    // Create grid-engine
    this.gridEngine.create(map, gridEngineConfig);

    // Camera setup
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    
    console.log('[MainScene] Camera setup complete');

    // Create manual animations for NPC_test (16x32 frames, 4 columns x 4 rows)
    // Row 0=Down, Row 1=Right, Row 2=Up, Row 3=Left
    const cols = 4; // 4 columns of animation frames
    const directions = [
      { name: 'down', row: 0 },
      { name: 'right', row: 1 },
      { name: 'up', row: 2 },
      { name: 'left', row: 3 },
    ];
    
    directions.forEach(({ name, row }) => {
      this.anims.create({
        key: `walk_${name}`,
        frames: this.anims.generateFrameNumbers('player', { 
          start: row * cols, 
          end: row * cols + cols - 1 
        }),
        frameRate: 8,
        repeat: -1,
      });
    });
    console.log('[MainScene] Created 4-direction walk animations');

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
        
        // Track last direction for reference
        this.lastDirection = direction.toLowerCase();
        
        // Play walking animation manually
        const animKey = `walk_${direction.toLowerCase()}`;
        if (this.anims.exists(animKey)) {
          this.playerSprite.play(animKey, true);
        }
      }
    });

    // Movement stopped - stop animation and set idle frame
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === 'hero') {
        this.playerSprite.stop();
        
        // Set idle frame (first frame of the direction's row)
        const directionToRow: Record<string, number> = {
          'down': 0,
          'right': 1,
          'up': 2,
          'left': 3,
        };
        const row = directionToRow[this.lastDirection] ?? 0;
        const idleFrame = row * 4; // 4 columns per row
        this.playerSprite.setFrame(idleFrame);
        
        console.log('[MainScene] Movement stopped, facing:', this.lastDirection, 'frame:', idleFrame);
      }
    });

    // Position update on every step
    this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
      if (charId === 'hero') {
        // Update username label position - just above player head, slightly right
        const sprite = this.playerSprite;
        this.usernameText.setPosition(sprite.x + 5, sprite.y - 1);
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
    
    // CRITICAL: Setup keyboard ONCE here, not in update()!
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
    }) as any;
    
    console.log('[MainScene] Keyboard controls registered:', {
      cursors: !!this.cursors,
      wasd: !!this.wasd,
    });

    this.initWebSocket();

  }

  private initWebSocket() {
    // Prevent duplicate connections (React Strict Mode protection)
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('[MainScene] WebSocket already connected, skipping initialization');
      return;
    }
    
    if (!this.currentRoomId || !this.myId) {
      console.error('[MainScene] Cannot connect WebSocket: missing roomId or userId');
      return;
    }

    console.log('[MainScene] Connecting WebSocket:', {
      roomId: this.currentRoomId,
      userId: this.myId
    });

    // Create WebSocket connection
    this.socket = new WebSocket(
      `ws://localhost:8000/ws/connect?room_id=${this.currentRoomId}&user_id=${this.myId}`
    );

    this.socket.onopen = () => {
      console.log('🔌 [MainScene] WebSocket Connected!');
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 [MainScene] Received:', data);
        this.handleServerMessage(data);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.socket.onerror = (error: Event) => {
      console.error('❌ [MainScene] WebSocket Error:', error);
    };

    this.socket.onclose = () => {
      console.log('🔌 [MainScene] WebSocket Disconnected');
    };
  }

  private handleServerMessage(data: any) {
    switch (data.type) {
      case 'user_list':
        console.log('👥 [MainScene] Online users:', data.users);
        // Spawn sprites for all users EXCEPT ourselves
        data.users.forEach((userId: string) => {
          if (userId !== this.myId && !this.otherPlayers.has(userId)) {
            // Spawn at default position (they'll send their real position soon)
            this.spawnRemotePlayer(userId, 'Player', 15, 15);
          }
        });
        
        // Send our current position so others can see us immediately
        if (this.gridEngine.hasCharacter('hero')) {
          const myPos = this.gridEngine.getPosition('hero');
          this.sendMovementToServer(myPos.x, myPos.y, this.lastDirection);
        }
        break;

      case 'player_move':
        // Don't process our own movement echoes
        if (data.user_id === this.myId) return;
        
        console.log('🏃 [MainScene] Player moved:', data.user_id, '@', data.x, data.y);
        this.updateRemotePlayerPosition(data.user_id, data.x, data.y, data.username || 'Player');
        break;

      case 'user_joined':
        // Don't spawn ourselves
        if (data.user_id === this.myId) return;
        
        console.log('✅ [MainScene] User joined:', data.user_id);
        
        // Prevent duplicates (React Strict Mode)
        if (!this.otherPlayers.has(data.user_id)) {
          this.spawnRemotePlayer(data.user_id, 'Player', 15, 15);
          
          // Send our position so the new user can see us
          if (this.gridEngine.hasCharacter('hero')) {
            const myPos = this.gridEngine.getPosition('hero');
            this.sendMovementToServer(myPos.x, myPos.y, this.lastDirection);
          }
        }
        break;

      case 'user_left':
        console.log('❌ [MainScene] User left:', data.user_id);
        this.removeRemotePlayer(data.user_id);
        break;
    }
  }

  private debugCounter = 0;

  update() {
    // Debug: log every 60 frames to verify update is running
    this.debugCounter++;
    // if (this.debugCounter % 60 === 0) {
    //   console.log('[MainScene] update() running, frame:', this.debugCounter);
    // }
    
    // Check if keyboard is available
    if (!this.cursors || !this.wasd) {
      console.error('[MainScene] Keyboard not initialized!');
      return;
    }

    // Grid-based movement (discrete tile steps)
    const leftPressed = this.cursors.left.isDown || this.wasd.left.isDown;
    const rightPressed = this.cursors.right.isDown || this.wasd.right.isDown;
    const upPressed = this.cursors.up.isDown || this.wasd.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasd.down.isDown;
    
    // Debug: log when any key is pressed
    if (leftPressed || rightPressed || upPressed || downPressed) {
      console.log('[MainScene] KEY PRESSED:', { leftPressed, rightPressed, upPressed, downPressed });
    }

    if (leftPressed) {
      this.gridEngine.move('hero', Direction.LEFT);
      console.log('[MainScene] Called move LEFT, isMoving:', this.gridEngine.isMoving('hero'), 'pos:', this.gridEngine.getPosition('hero'));
    } else if (rightPressed) {
      this.gridEngine.move('hero', Direction.RIGHT);
      console.log('[MainScene] Called move RIGHT, isMoving:', this.gridEngine.isMoving('hero'), 'pos:', this.gridEngine.getPosition('hero'));
    } else if (upPressed) {
      this.gridEngine.move('hero', Direction.UP);
      console.log('[MainScene] Called move UP, isMoving:', this.gridEngine.isMoving('hero'), 'pos:', this.gridEngine.getPosition('hero'));
    } else if (downPressed) {
      this.gridEngine.move('hero', Direction.DOWN);
      console.log('[MainScene] Called move DOWN, isMoving:', this.gridEngine.isMoving('hero'), 'pos:', this.gridEngine.getPosition('hero'));
    }

    // Update username label to follow player (just above head, slightly right)
    this.usernameText.setPosition(this.playerSprite.x + 5, this.playerSprite.y - 1);
    
    // Update remote player labels to follow their sprites
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 20);
    });

    // Update other players' labels
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 22);
    });
  }


  /**
   * Create walking animations for NPC_test character
   * 
   * SPRITESHEET LAYOUT (NPC_test.png) - 4 DIRECTIONS:
   * - Sprite size: 16x16 pixels per frame
   * - 4 columns (animation frames) x 4 rows (directions)
   * - Row 0 → Down
   * - Row 1 → Right
   * - Row 2 → Up
   * - Row 3 → Left
   */
  private createCharacterAnimations(charKey: string) {
    // Check if animations already exist
    if (this.anims.exists(`${charKey}_walk_down`)) return;

    const walkFrameRate = 8; // fps for walk animation
    
    // Get walk texture info to determine column count
    const walkTexture = this.textures.get(charKey);
    if (!walkTexture || !walkTexture.source[0]) {
      console.error(`[MainScene] Texture ${charKey} not found!`);
      return;
    }
    
    const textureWidth = walkTexture.source[0].width;
    const textureHeight = walkTexture.source[0].height;
    const cols = Math.floor(textureWidth / 16); // Columns per row (should be 4)
    const rows = Math.floor(textureHeight / 16); // Total rows (should be 4)
    
    console.log(`[MainScene] Creating 4-direction walk animations for ${charKey}: ${cols} columns x ${rows} rows`);

    const framesPerRow = cols;

    // 4-direction row mapping for NPC_test
    const directions = [
      { name: 'down', row: 0 },
      { name: 'right', row: 1 },
      { name: 'up', row: 2 },
      { name: 'left', row: 3 },
    ];

    directions.forEach(({ name, row }) => {
      if (row < rows) { // Only create if row exists
        this.anims.create({
          key: `${charKey}_walk_${name}`,
          frames: this.anims.generateFrameNumbers(charKey, { 
            start: row * cols, 
            end: row * cols + framesPerRow - 1 
          }),
          frameRate: walkFrameRate,
          repeat: -1,
        });
      }
    });

    console.log(`[MainScene] Created 4-direction walk animations for ${charKey}`);
  }




  private sendMovementToServer(x: number, y: number, direction: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return; // Silently ignore if not connected
    }
    
    const now = Date.now();
    const positionChanged = this.lastSentPosition.x !== x || this.lastSentPosition.y !== y;
    
    // Throttle: only send if position changed AND enough time passed
    if (positionChanged && now - this.lastSentTime >= this.sendThrottleMs) {
      this.socket.send(JSON.stringify({
        type: 'player_move',
        x,
        y,
        username: this.myUsername
      }));
      
      this.lastSentPosition = { x, y };
      this.lastSentTime = now;
    }
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

  private spawnRemotePlayer(userId: string, username: string, x: number, y: number) {
    if (this.otherPlayers.has(userId)) return;

    console.log('[MainScene] Spawning remote player:', username, 'at', x, y);

    // Create sprite using same spritesheet as local player
    const sprite = this.add.sprite(0, 0, 'player', 0);
    sprite.setScale(1.5); // Same as local player
    sprite.setDepth(100);
    sprite.setOrigin(0.5, 0.5);

    // Create username label
    const text = this.add.text(0, -20, username, {
      fontSize: '10px',
      color: '#00ff00', // Green to distinguish from local player
      backgroundColor: '#000000aa',
      padding: { x: 2, y: 1 },
    });
    text.setOrigin(0.5, 1); // Anchor at bottom-center
    text.setDepth(101);

    // Add to grid-engine
    this.gridEngine.addCharacter({
      id: userId,
      sprite: sprite,
      startPosition: { x, y },
      speed: 4,
      // GridEngine expects FrameRow objects { leftFoot, standing, rightFoot }
      walkingAnimationMapping: {
        up: { leftFoot: 9, standing: 8, rightFoot: 11 },
        down: { leftFoot: 1, standing: 0, rightFoot: 3 },
        left: { leftFoot: 13, standing: 12, rightFoot: 15 },
        right: { leftFoot: 5, standing: 4, rightFoot: 7 },
      },
    });

    this.otherPlayers.set(userId, { sprite, text });
  }
  
  private updateRemotePlayerPosition(userId: string, x: number, y: number, username?: string) {
    const player = this.otherPlayers.get(userId);
    if (!player) {
      // Player not spawned yet, spawn them now
      this.spawnRemotePlayer(userId, username || 'Player', x, y);
      return;
    }
    
    // Update username if provided
    if (username && player.text.text !== username) {
      player.text.setText(username);
    }
    
    // Move the player using grid-engine SMOOTH movement
    if (this.gridEngine.hasCharacter(userId)) {
      const currentPos = this.gridEngine.getPosition(userId);
      
      // Only move if position actually changed
      if (currentPos.x !== x || currentPos.y !== y) {
        // Calculate distance to decide between teleport and smooth move
        const distance = Math.abs(currentPos.x - x) + Math.abs(currentPos.y - y);
        
        if (distance > 5) {
          // Too far - teleport instantly (player just joined or lagged)
          this.gridEngine.setPosition(userId, { x, y });
        } else {
          // Close enough - use smooth pathfinding movement
          this.gridEngine.moveTo(userId, { x, y });
        }
      }
    }
  }

  private removeRemotePlayer(userId: string) {
    const player = this.otherPlayers.get(userId);
    if (!player) return;

    console.log('[MainScene] Removing remote player:', userId);

    if (this.gridEngine.hasCharacter(userId)) {
      this.gridEngine.removeCharacter(userId);
    }
    player.sprite.destroy();
    player.text.destroy();
    this.otherPlayers.delete(userId);
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
