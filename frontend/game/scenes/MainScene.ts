import * as Phaser from "phaser";
import { Scene } from "phaser";
import { GridEngine, Direction } from "grid-engine";
import EventBus, { GameEvents } from "../EventBus";

export class MainScene extends Scene {
  private gridEngine!: GridEngine;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private usernameText!: Phaser.GameObjects.Text;
  private otherPlayers: Map<string, { sprite: Phaser.GameObjects.Sprite; text: Phaser.GameObjects.Text }> = new Map();

  private socket: WebSocket | null = null;
  private myId: string = "";
  private myUsername: string = "";
  private myServerId: string = "";
  private token: string = "";
  private apiUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super({ key: "MainScene" });
  }

  init(data: any) {
    if (data) {
      this.myId = data.userId;
      this.myUsername = data.username;
      this.myServerId = data.serverId;
      this.token = data.token;
      if (data.apiUrl) this.apiUrl = data.apiUrl;
    }
  }

  preload() {
    if (!this.cache.tilemap.exists("main_map")) {
      this.load.tilemapTiledJSON("main_map", "/phaser_assets/maps/final_map.json");
    }

    if (!this.textures.exists("OfficeTiles")) {
      this.load.image("OfficeTiles", "/phaser_assets/Interiors_free/32x32/Interiors_free_32x32.png");
    }
    if (!this.textures.exists("RoomBuilder")) {
      this.load.image("RoomBuilder", "/phaser_assets/Interiors_free/32x32/Room_Builder_free_32x32.png");
    }
    if (!this.textures.exists("OldTiles")) {
      this.load.image("OldTiles", "/phaser_assets/Old/Tileset_32x32_1.png");
    }
    if (!this.textures.exists("tileset2")) {
      this.load.image("tileset2", "/phaser_assets/Old/Tileset_32x32_2.png");
    }
    if (!this.textures.exists("tileset16")) {
      this.load.image("tileset16", "/phaser_assets/Old/Tileset_32x32_16.png");
    }

    if (!this.textures.exists("player")) {
      this.load.spritesheet("player", "/characters/character_1_walk.png", {
        frameWidth: 64,
        frameHeight: 64,
      });
    }
  }

  create() {
    const map = this.make.tilemap({ key: "main_map" });

    const officeTiles = map.addTilesetImage("OfficeTiles", "OfficeTiles");
    const roomBuilder = map.addTilesetImage("RoomBuilder", "RoomBuilder");
    const oldTiles = map.addTilesetImage("OldTiles", "OldTiles");
    const tileset2 = map.addTilesetImage("tileset2", "tileset2");
    const tileset16 = map.addTilesetImage("tileset16", "tileset16");

    const allTilesets = [officeTiles, roomBuilder, oldTiles, tileset2, tileset16].filter((t) => t !== null) as Phaser.Tilemaps.Tileset[];

    const floorLayer = map.createLayer("Floor", allTilesets, 0, 0);
    const wallsLayer = map.createLayer("Walls", allTilesets, 0, 0);
    const furnitureLayer = map.createLayer("Furniture", allTilesets, 0, 0);
    const collisionLayer = map.createLayer("Collision", allTilesets, 0, 0);

    floorLayer?.setDepth(0);
    wallsLayer?.setDepth(10);
    furnitureLayer?.setDepth(20);

    if (collisionLayer) {
      collisionLayer.setVisible(false);
      collisionLayer.setCollisionByExclusion([-1, 0]);
      collisionLayer.forEachTile((tile) => {
        if (tile.index > 0) {
          tile.properties = tile.properties || {};
          tile.properties.ge_collide = true;
          tile.setCollision(true);
        }
      });
    }

    let spawnX = 15;
    let spawnY = 15;

    const zonesLayer = map.getObjectLayer("Zones");
    if (zonesLayer) {
      const spawnPoint = zonesLayer.objects.find((obj) => obj.name === "Spawn_main");
      if (spawnPoint && spawnPoint.x !== undefined && spawnPoint.y !== undefined) {
        spawnX = Math.floor(spawnPoint.x / 32);
        spawnY = Math.floor(spawnPoint.y / 32) - 1;
      }
    }

    this.playerSprite = this.add.sprite(0, 0, "player", 22);
    this.playerSprite.setScale(0.5);
    this.playerSprite.setDepth(100);
    this.playerSprite.setOrigin(0.5, 1);

    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      backgroundColor: "#000000cc",
      padding: { x: 4, y: 2 },
    });
    this.usernameText.setOrigin(0.5, 1);
    this.usernameText.setDepth(101);

    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 8 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("player", { start: 9, end: 17 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("player", { start: 18, end: 26 }),
      frameRate: 12,
      repeat: -1,
    });
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("player", { start: 27, end: 35 }),
      frameRate: 12,
      repeat: -1,
    });

    const gridEngineConfig = {
      characters: [
        {
          id: "hero",
          sprite: this.playerSprite,
          startPosition: { x: spawnX, y: spawnY },
          speed: 4,
          offsetY: 0,
        },
      ],
      numberOfDirections: 4,
    };

    this.gridEngine.create(map, gridEngineConfig);

    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: "W",
      down: "S",
      left: "A",
      right: "D",
    }) as any;

    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      const sprite = this.getSpriteById(charId);
      if (!sprite) return;

      sprite.play(`walk-${direction}`);

      if (charId === "hero") {
        const pos = this.gridEngine.getPosition("hero");
        EventBus.emit(GameEvents.PLAYER_POSITION, {
          x: pos.x,
          y: pos.y,
          direction: direction as "up" | "down" | "left" | "right",
        });
        this.sendMovementToServer(pos.x, pos.y);
      }
    });

    this.gridEngine.movementStopped().subscribe(({ charId, direction }) => {
      const sprite = this.getSpriteById(charId);
      if (!sprite) return;

      sprite.stop();
      sprite.setFrame(this.getIdleFrame(direction));

      if (charId === "hero") {
        const pos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(pos.x, pos.y);
      }
    });

    this.gridEngine.directionChanged().subscribe(({ charId, direction }) => {
      const sprite = this.getSpriteById(charId);
      if (!sprite || this.gridEngine.isMoving(charId)) return;
      sprite.setFrame(this.getIdleFrame(direction));
    });

    EventBus.on(GameEvents.SEND_CHAT_MESSAGE, (data: any) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "chat_message", ...data }));
      }
    });

    this.initWebSocket();
  }

  update() {
    if (!this.cursors || !this.wasd) return;

    const leftPressed = this.cursors.left.isDown || this.wasd.left.isDown;
    const rightPressed = this.cursors.right.isDown || this.wasd.right.isDown;
    const upPressed = this.cursors.up.isDown || this.wasd.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasd.down.isDown;

    if (leftPressed) {
      this.gridEngine.move("hero", Direction.LEFT);
    } else if (rightPressed) {
      this.gridEngine.move("hero", Direction.RIGHT);
    } else if (upPressed) {
      this.gridEngine.move("hero", Direction.UP);
    } else if (downPressed) {
      this.gridEngine.move("hero", Direction.DOWN);
    }

    if (this.playerSprite && this.usernameText) {
      this.usernameText.setPosition(
        this.playerSprite.x,
        this.playerSprite.y - this.playerSprite.displayHeight - 4
      );
    }

    this.otherPlayers.forEach((player) => {
      player.text.setPosition(
        player.sprite.x,
        player.sprite.y - player.sprite.displayHeight - 4
      );
    });
  }

  private getSpriteById(charId: string): Phaser.GameObjects.Sprite | undefined {
    if (charId === "hero") return this.playerSprite;
    return this.otherPlayers.get(charId)?.sprite;
  }

  private getIdleFrame(direction: string): number {
    switch (direction) {
      case "up": return 4;
      case "left": return 13;
      case "down": return 22;
      case "right": return 31;
      default: return 22;
    }
  }

  private sendMovementToServer(x: number, y: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ 
      type: "player_move", 
      x, 
      y, 
      username: this.myUsername 
    }));
  }

  private initWebSocket() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.myServerId || !this.myId) {
      console.error("[WebSocket] Missing credentials");
      return;
    }

    const wsUrl = this.apiUrl.replace(/^http/, "ws");
    const baseUrl = wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;
    this.socket = new WebSocket(`${baseUrl}/ws/${this.myServerId}?token=${this.token}`);

    this.socket.onopen = () => console.log("🔌 Connected");

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        this.handleServerMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("[WebSocket] Parse error:", error);
      }
    };

    this.socket.onerror = (error: Event) => console.error("❌ WebSocket Error:", error);

    this.socket.onclose = () => {
      console.log("🔌 Disconnected");
      this.socket = null;
      this.time.delayedCall(2000, () => {
        if (this.scene.isActive("MainScene")) {
          this.initWebSocket();
        }
      });
    };
  }

  private handleServerMessage(data: any) {
    switch (data.type) {
      case "user_list":
        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, data.users);
        data.users.forEach((user: any) => {
          if (user.user_id !== this.myId && !this.otherPlayers.has(user.user_id)) {
            this.spawnRemotePlayer(user.user_id, user.username, user.x, user.y);
          }
        });
        if (this.gridEngine.hasCharacter("hero")) {
          const pos = this.gridEngine.getPosition("hero");
          this.sendMovementToServer(pos.x, pos.y);
        }
        break;

      case "player_move":
        if (data.user_id !== this.myId) {
          this.updateRemotePlayerPosition(data.user_id, data.x, data.y, data.username || "Player");
        }
        break;

      case "user_joined":
        if (data.user_id !== this.myId && !this.otherPlayers.has(data.user_id)) {
          this.spawnRemotePlayer(data.user_id, data.username || "Player", data.x ?? 15, data.y ?? 15);
        }
        break;

      case "user_left":
        this.removeRemotePlayer(data.user_id);
        break;

      case "chat_message":
        EventBus.emit(GameEvents.CHAT_MESSAGE, data);
        break;
    }
  }

  private spawnRemotePlayer(userId: string, username: string, x: number, y: number) {
    if (this.otherPlayers.has(userId)) return;

    const sprite = this.add.sprite(0, 0, "player", 22);
    sprite.setScale(0.5);
    sprite.setDepth(100);
    sprite.setOrigin(0.5, 1);

    const text = this.add.text(0, 0, username, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#00ff00",
      backgroundColor: "#000000cc",
      padding: { x: 4, y: 2 },
    });
    text.setOrigin(0.5, 1);
    text.setDepth(101);

    this.gridEngine.addCharacter({
      id: userId,
      sprite: sprite,
      startPosition: { x, y },
      speed: 4,
      offsetY: 0,
    });

    this.otherPlayers.set(userId, { sprite, text });
  }

  private updateRemotePlayerPosition(userId: string, x: number, y: number, username?: string) {
    const player = this.otherPlayers.get(userId);
    
    if (!player) {
      this.spawnRemotePlayer(userId, username || "Player", x, y);
      return;
    }

    if (username && player.text.text !== username) {
      player.text.setText(username);
    }

    if (!this.gridEngine.hasCharacter(userId)) return;

    const currentPos = this.gridEngine.getPosition(userId);
    if (currentPos.x === x && currentPos.y === y) return;

    const distance = Math.abs(currentPos.x - x) + Math.abs(currentPos.y - y);

    if (distance > 3) {
      this.gridEngine.setPosition(userId, { x, y });
    } else {
      const speed = distance > 1 ? 8 : 4;
      this.gridEngine.setSpeed(userId, speed);
      this.gridEngine.moveTo(userId, { x, y });
    }

    EventBus.emit(GameEvents.REMOTE_PLAYER_MOVED, { userId, x, y });
  }

  private removeRemotePlayer(userId: string) {
    const player = this.otherPlayers.get(userId);
    if (!player) return;

    if (this.gridEngine.hasCharacter(userId)) {
      this.gridEngine.removeCharacter(userId);
    }
    
    player.sprite.destroy();
    player.text.destroy();
    this.otherPlayers.delete(userId);
  }

  destroy() {
    EventBus.off(GameEvents.SEND_CHAT_MESSAGE);
    if (this.socket) this.socket.close();
  }
}