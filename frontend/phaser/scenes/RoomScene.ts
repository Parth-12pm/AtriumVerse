import * as Phaser from 'phaser';
import { Player } from '../entities/Player';
import { RoomLayout, ROOM_TEMPLATES, WallDefinition, FurnitureDefinition, DoorDefinition } from '../maps/RoomLayouts';

interface RoomSceneData {
  roomId: string;
  userId: string;
  username: string;
  startingRoom?: 'hall' | 'meeting' | 'office';
}

export class RoomScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  
  private remotePlayers: Map<string, Player> = new Map();
  private currentRoomId: string = 'hall';
  private rooms: Map<string, Phaser.GameObjects.Container> = new Map();
  private roomOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private walls: Phaser.Physics.Arcade.StaticGroup[] = [];
  private doors: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  
  private userId!: string;
  private username!: string;
  
  // For external access (WebSocket integration)
  public onPositionUpdate?: (x: number, y: number, direction: string) => void;
  public onRoomChange?: (roomId: string, proximityRange: number) => void;

  constructor() {
    super({ key: 'RoomScene' });
  }

  init(data: RoomSceneData): void {
    this.userId = data.userId;
    this.username = data.username;
    this.currentRoomId = data.startingRoom || 'hall';
  }

  create(): void {
    // Set up input controls
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Enable keyboard capture to prevent page scrolling
    this.input.keyboard!.addCapture('W,S,A,D,UP,DOWN,LEFT,RIGHT');

    console.log('[RoomScene] Keyboard controls initialized');

    // Create all three rooms
    this.createRoom('hall');
    this.createRoom('meeting');
    this.createRoom('office');

    // Position rooms in a layout (hall on left, meeting in middle, office on right)
    const hallContainer = this.rooms.get('hall')!;
    const meetingContainer = this.rooms.get('meeting')!;
    const officeContainer = this.rooms.get('office')!;

    hallContainer.setPosition(0, 0);
    meetingContainer.setPosition(800, 0);
    officeContainer.setPosition(2000, 0);

    // Create player in starting room
    const startRoom = ROOM_TEMPLATES[this.currentRoomId];
    const spawnX = startRoom.spawnPoint.x;
    const spawnY = startRoom.spawnPoint.y;
    
    this.player = new Player({
      scene: this,
      x: spawnX,
      y: spawnY,
      username: this.username,
      userId: this.userId,
      isLocal: true,
    });

    // Set proximity range based on current room
    this.player.setProximityRange(startRoom.proximityRange);

    // Set up camera to follow player with SMOOTH EASING
    // Lower lerp values (0.08) = smoother, more gradual following
    // Higher values (0.2) = snappier, more responsive
    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    // Apply room focus (darken other rooms)
    this.focusOnRoom(this.currentRoomId);

    // Set up collision detection
    this.setupCollisions();
  }

  private createRoom(roomId: string): void {
    const layout = ROOM_TEMPLATES[roomId];
    if (!layout) return;

    // Create container for the room (non-physics visuals only)
    const roomContainer = this.add.container(0, 0);
    roomContainer.setData('roomId', roomId);

    // Background
    const bg = this.add.rectangle(
      0,
      0,
      layout.width,
      layout.height,
      layout.backgroundColor
    );
    bg.setOrigin(0, 0);
    roomContainer.add(bg);

    // Create a wall group for physics (NOT added to container)
    const wallGroup = this.physics.add.staticGroup();
    
    // We'll position walls based on which room this is
    // Hall: 0, Meeting: 800, Office: 2000
    const roomOffsets: Record<string, number> = {
      hall: 0,
      meeting: 800,
      office: 2000,
    };
    const roomXOffset = roomOffsets[roomId] || 0;

    // Walls (create in main scene, not in container)
    layout.walls.forEach((wall) => {
      const wallRect = this.add.rectangle(
        roomXOffset + wall.x,
        wall.y,
        wall.width,
        wall.height,
        0x000000
      );
      wallRect.setOrigin(0, 0);
      this.physics.add.existing(wallRect, true);
      wallGroup.add(wallRect);
      
      // Add visual representation to container for rendering
      const wallVisual = this.add.rectangle(wall.x, wall.y, wall.width, wall.height, 0x000000);
      wallVisual.setOrigin(0, 0);
      roomContainer.add(wallVisual);
    });
    this.walls.push(wallGroup);

    // Furniture
    layout.furniture.forEach((furniture) => {
      const furnitureRect = this.add.rectangle(
        furniture.x,
        furniture.y,
        furniture.width,
        furniture.height,
        furniture.color
      );
      furnitureRect.setOrigin(0, 0);
      
      if (furniture.collidable) {
        // Create physics body in main scene
        const furniturePhysics = this.add.rectangle(
          roomXOffset + furniture.x,
          furniture.y,
          furniture.width,
          furniture.height,
          furniture.color
        );
        furniturePhysics.setOrigin(0, 0);
        furniturePhysics.setAlpha(0); // Invisible, just for physics
        this.physics.add.existing(furniturePhysics, true);
        wallGroup.add(furniturePhysics);
      }
      
      roomContainer.add(furnitureRect);
    });

    // Doors (visual only in container)
    layout.doors.forEach((door, index) => {
      const doorRect = this.add.rectangle(
        door.x,
        door.y,
        door.width,
        door.height,
        0x00ff00 // Green doors
      );
      doorRect.setOrigin(0, 0);
      doorRect.setData('doorDef', door);
      doorRect.setData('roomId', roomId);
      
      const doorKey = `${roomId}_door_${index}`;
      this.doors.set(doorKey, doorRect);
      roomContainer.add(doorRect);
    });

    // Room name label
    const roomLabel = this.add.text(layout.width / 2, 30, layout.name, {
      fontSize: '24px',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: { x: 10, y: 5 },
    });
    roomLabel.setOrigin(0.5, 0);
    roomContainer.add(roomLabel);

    // Create dark overlay (initially visible, will be toggled)
    const overlay = this.add.rectangle(0, 0, layout.width, layout.height, 0x000000, 0.7);
    overlay.setOrigin(0, 0);
    overlay.setVisible(false);
    roomContainer.add(overlay);
    this.roomOverlays.set(roomId, overlay);

    this.rooms.set(roomId, roomContainer);
  }

  private setupCollisions(): void {
    // Set up collision between player and all walls
    this.walls.forEach((wallGroup) => {
      this.physics.add.collider(this.player.sprite, wallGroup);
    });
  }

  private checkDoorOverlaps(): void {
    const playerPos = this.player.getPosition();
    
    // Get current room container offset
    const currentRoomContainer = this.rooms.get(this.currentRoomId);
    if (!currentRoomContainer) return;
    
    const roomX = currentRoomContainer.x;
    const roomY = currentRoomContainer.y;

    this.doors.forEach((doorRect, doorKey) => {
      const doorRoomId = doorRect.getData('roomId');
      if (doorRoomId !== this.currentRoomId) return;

      const doorDef: DoorDefinition = doorRect.getData('doorDef');
      
      // Check if player is overlapping door (with room offset)
      const doorBounds = new Phaser.Geom.Rectangle(
        roomX + doorRect.x,
        roomY + doorRect.y,
        doorRect.width,
        doorRect.height
      );

      const isOverlapping = doorBounds.contains(playerPos.x, playerPos.y);
      const wasOverlapping = doorRect.getData('isOverlapping') || false;

      if (isOverlapping && !wasOverlapping) {
        // Just entered door zone - trigger smooth transition
        doorRect.setData('isOverlapping', true);
        this.smoothRoomTransition(doorDef.targetRoomId, doorDef.targetSpawnPoint);
      } else if (!isOverlapping && wasOverlapping) {
        // Exited door zone
        doorRect.setData('isOverlapping', false);
      }
    });
  }

  private smoothRoomTransition(targetRoomId: string, spawnPoint: { x: number; y: number }): void {
    if (targetRoomId === this.currentRoomId) return;

    // Update current room
    this.currentRoomId = targetRoomId;

    // Get target room container
    const targetRoomContainer = this.rooms.get(targetRoomId);
    if (!targetRoomContainer) return;

    const targetLayout = ROOM_TEMPLATES[targetRoomId];

    // CRITICAL FIX: Move player to spawn point in new room
    // The camera will follow the player automatically
    const newX = targetRoomContainer.x + spawnPoint.x;
    const newY = targetRoomContainer.y + spawnPoint.y;
    
    this.player.sprite.setPosition(newX, newY);

    // Calculate room center for initial camera position
    const roomCenterX = targetRoomContainer.x + targetLayout.width / 2;
    const roomCenterY = targetRoomContainer.y + targetLayout.height / 2;

    // Stop following temporarily for smooth pan
    this.cameras.main.stopFollow();

    // SMOOTH CAMERA EASE to new room center
    this.cameras.main.pan(
      roomCenterX,
      roomCenterY,
      300,  // 300ms ease duration
      'Sine.easeInOut',
      false,
      (cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress === 1) {
          // When camera finishes panning, resume following player
          this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
        }
      }
    );

    // Update proximity range for new room
    this.player.setProximityRange(targetLayout.proximityRange);

    // Apply room focus effect (darken other rooms)
    this.focusOnRoom(targetRoomId);

    // Notify React that room changed (updates minimap)
    if (this.onRoomChange) {
      this.onRoomChange(targetRoomId, targetLayout.proximityRange);
    }
  }

  private focusOnRoom(roomId: string): void {
    // Hide overlays on all rooms first
    this.roomOverlays.forEach((overlay) => overlay.setVisible(false));

    // Show overlays on all OTHER rooms (darken inactive rooms)
    this.roomOverlays.forEach((overlay, overlayRoomId) => {
      if (overlayRoomId !== roomId) {
        overlay.setVisible(true);
      }
    });
  }

  update(time: number, delta: number): void {
    // Combine cursors and WASD
    const combinedCursors: Phaser.Types.Input.Keyboard.CursorKeys = {
      left: this.cursors.left.isDown ? this.cursors.left : this.wasd.left,
      right: this.cursors.right.isDown ? this.cursors.right : this.wasd.right,
      up: this.cursors.up.isDown ? this.cursors.up : this.wasd.up,
      down: this.cursors.down.isDown ? this.cursors.down : this.wasd.down,
      space: this.cursors.space,
      shift: this.cursors.shift,
    };

    // Update local player
    this.player.update(combinedCursors);

    // Check door overlaps (smooth transitions)
    this.checkDoorOverlaps();

    // Emit position update if position changed (throttled by external WebSocket manager)
    if (this.onPositionUpdate) {
      const pos = this.player.getPosition();
      this.onPositionUpdate(pos.x, pos.y, this.player.currentDirection);
    }
  }

  // Called from React when WebSocket receives player updates
  public addRemotePlayer(userId: string, username: string, x: number, y: number): void {
    if (this.remotePlayers.has(userId)) return;

    const remotePlayer = new Player({
      scene: this,
      x,
      y,
      username,
      userId,
      isLocal: false,
    });

    this.remotePlayers.set(userId, remotePlayer);

    // Set up collision for remote player
    this.walls.forEach((wallGroup) => {
      this.physics.add.collider(remotePlayer.sprite, wallGroup);
    });
  }

  public updateRemotePlayer(userId: string, x: number, y: number, direction: string): void {
    const remotePlayer = this.remotePlayers.get(userId);
    if (!remotePlayer) return;

    remotePlayer.updatePosition(x, y, direction);
  }

  public removeRemotePlayer(userId: string): void {
    const remotePlayer = this.remotePlayers.get(userId);
    if (!remotePlayer) return;

    remotePlayer.destroy();
    this.remotePlayers.delete(userId);
  }

  // Get player position for external access
  public getPlayerPosition(): { x: number; y: number; direction: string } {
    const pos = this.player.getPosition();
    return { ...pos, direction: this.player.currentDirection };
  }
}
