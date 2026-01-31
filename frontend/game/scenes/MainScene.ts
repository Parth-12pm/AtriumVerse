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
    
    // Load new 16x16 character spritesheets (asprite format)
    // Layout: 6 columns x 4 rows per sheet
    // Row 0 = Down, Row 1 = Right, Row 2 = Up, Row 3 = Left
    const charPath = '/phaser_assets/Characters_free/characters_asprite/16x16';
    
    // Walk spritesheet (main movement animation)
    if (!this.textures.exists('char_walk')) {
      this.load.spritesheet('char_walk', `${charPath}/16x16 Walk-Sheet.png`, {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    
    // Idle spritesheet (static/animated idle poses)
    if (!this.textures.exists('char_idle')) {
      this.load.spritesheet('char_idle', `${charPath}/16x16 Idle-Sheet.png`, {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    
    // Run spritesheet (faster movement)
    if (!this.textures.exists('char_run')) {
      this.load.spritesheet('char_run', `${charPath}/16x16 Run-Sheet.png`, {
        frameWidth: 16,
        frameHeight: 16,
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

    // Create local player sprite using new asprite character
    // Use frame 0 as idle (down-facing from Row 0)
    this.playerSprite = this.add.sprite(0, 0, 'char_walk', 0);
    this.playerSprite.setScale(2); // 16x16 → 32x32 to fit grid
    this.playerSprite.setDepth(100); // Above all map layers
    this.playerSprite.setOrigin(0.5, 0.5); // Center origin

    console.log('[MainScene] Created player sprite');

    // Username label - positioned above player's head
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 1 },
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

    // Configure grid-engine with 8-directional movement
    const gridEngineConfig = {
      characters: [
        {
          id: 'hero',
          sprite: this.playerSprite,
          startPosition: { x: spawnX, y: spawnY },
          speed: 5,
        },
      ],
      numberOfDirections: 8, // Enable diagonal movement
      collisionTilePropertyName: 'ge_collide', // Use our custom property
    };

    console.log('[MainScene] Creating grid-engine with spawn at:', spawnX, spawnY);

    // Create grid-engine
    this.gridEngine.create(map, gridEngineConfig);

    // Camera setup
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    
    console.log('[MainScene] Camera setup complete');

    // Create walking animations for new asprite character
    // 16x16 Walk-Sheet.png: 6 columns x 4 rows
    // Row 0=Down, Row 1=Right, Row 2=Up, Row 3=Left
    this.createCharacterAnimations('char_walk');

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

        // Map diagonal directions to cardinal for animations (no diagonal anims)
        let animDirection = direction.toLowerCase();
        if (animDirection.includes('left')) {
          animDirection = 'left';
        } else if (animDirection.includes('right')) {
          animDirection = 'right';
        } else if (animDirection.includes('up')) {
          animDirection = 'up';
        } else if (animDirection.includes('down')) {
          animDirection = 'down';
        }
        
        // Track last direction for idle state
        this.lastDirection = animDirection;
        
        // Ensure sprite and texture exist before animating
        if (!this.playerSprite || !this.playerSprite.texture) {
          console.warn('[MainScene] Player sprite not ready for animation');
          return;
        }
        
        // Switch to walk texture if we were idle
        if (this.playerSprite.texture.key !== 'char_walk') {
          this.playerSprite.setTexture('char_walk');
        }
        
        // Play walking animation
        const animKey = `char_walk_walk_${animDirection}`;
        if (this.anims.exists(animKey)) {
          try {
            this.playerSprite.play(animKey, true);
          } catch (e) {
            console.error('[MainScene] Animation error:', e);
          }
        } else {
          console.warn(`[MainScene] Animation not found: ${animKey}`);
        }
      }
    });

    // Stop animation when movement stops - switch to idle facing last direction
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === 'hero') {
        // Ensure sprite exists before stopping
        if (!this.playerSprite) {
          console.warn('[MainScene] Player sprite not ready for idle');
          return;
        }
        
        this.playerSprite.stop();
        
        // Idle spritesheet is also 8-direction layout:
        // Row 0=Down, Row 2=Left, Row 4=Up, Row 6=Right
        const idleTexture = this.textures.get('char_idle');
        if (!idleTexture || !idleTexture.source[0]) {
          console.warn('[MainScene] Idle texture not ready');
          return;
        }
        const idleCols = Math.floor(idleTexture.source[0].width / 16);
        
        // Calculate idle frame based on last direction (use first frame of cardinal rows)
        let idleFrame = 0; // Default: down (row 0)
        switch (this.lastDirection) {
          case 'down': idleFrame = 0 * idleCols; break;   // Row 0
          case 'left': idleFrame = 2 * idleCols; break;   // Row 2
          case 'up': idleFrame = 4 * idleCols; break;     // Row 4
          case 'right': idleFrame = 6 * idleCols; break;  // Row 6
        }
        
        // Switch to idle texture and frame
        this.playerSprite.setTexture('char_idle', idleFrame);
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
  }

  private debugCounter = 0;

  update() {
    // Debug: log every 60 frames to verify update is running
    this.debugCounter++;
    if (this.debugCounter % 60 === 0) {
      console.log('[MainScene] update() running, frame:', this.debugCounter);
    }
    
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

    // Update username label to follow player (above head: sprite is 32px, center origin)
    this.usernameText.setPosition(this.playerSprite.x, this.playerSprite.y - 22);

    // Update other players' labels
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 22);
    });
  }


  /**
   * Create walking animations for 16x16 asprite character
   * 
   * SPRITESHEET LAYOUT (8-direction rotational):
   * - Sprite size: 16x16 pixels per frame
   * - 8 rows total (0-7), each row is a different facing direction
   * - Row 0 → Down
   * - Row 1 → Down-Left (diagonal, SKIPPED)
   * - Row 2 → Left
   * - Row 3 → Up-Left (diagonal, SKIPPED)
   * - Row 4 → Up
   * - Row 5 → Up-Right (diagonal, SKIPPED)
   * - Row 6 → Right
   * - Row 7 → Down-Right (diagonal, SKIPPED)
   * 
   * For Gather.town-style top-down: ONLY use rows 0, 2, 4, 6
   */
  private createCharacterAnimations(charKey: string) {
    // Check if animations already exist
    if (this.anims.exists(`${charKey}_walk_down`)) return;

    const walkFrameRate = 8; // fps for walk animation
    
    // Get walk texture info to determine column count
    const walkTexture = this.textures.get(charKey);
    const textureWidth = walkTexture.source[0].width;
    const textureHeight = walkTexture.source[0].height;
    const cols = Math.floor(textureWidth / 16); // Columns per row
    const rows = Math.floor(textureHeight / 16); // Total rows (should be 8)
    
    console.log(`[MainScene] Creating walk animations for ${charKey}: ${cols} columns x ${rows} rows (8-direction sheet)`);

    // Use ALL frames in each row for walk cycle
    const framesPerRow = cols;

    // Row 0 → Facing DOWN
    this.anims.create({
      key: `${charKey}_walk_down`,
      frames: this.anims.generateFrameNumbers(charKey, { 
        start: 0 * cols, 
        end: 0 * cols + framesPerRow - 1 
      }),
      frameRate: walkFrameRate,
      repeat: -1,
    });

    // Row 2 → Facing LEFT (skip row 1 = diagonal)
    this.anims.create({
      key: `${charKey}_walk_left`,
      frames: this.anims.generateFrameNumbers(charKey, { 
        start: 2 * cols, 
        end: 2 * cols + framesPerRow - 1 
      }),
      frameRate: walkFrameRate,
      repeat: -1,
    });

    // Row 4 → Facing UP (skip row 3 = diagonal)
    this.anims.create({
      key: `${charKey}_walk_up`,
      frames: this.anims.generateFrameNumbers(charKey, { 
        start: 4 * cols, 
        end: 4 * cols + framesPerRow - 1 
      }),
      frameRate: walkFrameRate,
      repeat: -1,
    });

    // Row 6 → Facing RIGHT (skip row 5 = diagonal)
    this.anims.create({
      key: `${charKey}_walk_right`,
      frames: this.anims.generateFrameNumbers(charKey, { 
        start: 6 * cols, 
        end: 6 * cols + framesPerRow - 1 
      }),
      frameRate: walkFrameRate,
      repeat: -1,
    });

    console.log(`[MainScene] Created walk animations: down(row0), left(row2), up(row4), right(row6)`);
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
