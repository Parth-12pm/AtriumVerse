import * as Phaser from "phaser";
import { Scene } from "phaser";
import { GridEngine, Direction } from "grid-engine";
import EventBus, { GameEvents } from "../EventBus";

export class MainScene extends Scene {
  private gridEngine!: GridEngine;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private usernameText!: Phaser.GameObjects.Text;
  private otherPlayers: Map<
    string,
    { sprite: Phaser.GameObjects.Sprite; text: Phaser.GameObjects.Text }
  > = new Map();

  private socket: WebSocket | null = null;
  private myId: string = "";
  private myUsername: string = "";
  private myServerId: string = "";
  private token: string = "";
  private apiUrl: string =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  // Zone tracking
  private currentZone: string | null = null;
  private zones: Phaser.Types.Tilemaps.TiledObject[] = [];

  // UI input control - disable game input when UI is focused
  private inputEnabled: boolean = true;

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
      this.load.tilemapTiledJSON(
        "main_map",
        "/phaser_assets/maps/final_map.json",
      );
    }

    if (!this.textures.exists("OfficeTiles")) {
      this.load.image(
        "OfficeTiles",
        "/phaser_assets/Interiors_free/32x32/Interiors_free_32x32.png",
      );
    }
    if (!this.textures.exists("RoomBuilder")) {
      this.load.image(
        "RoomBuilder",
        "/phaser_assets/Interiors_free/32x32/Room_Builder_free_32x32.png",
      );
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

    // Load NPC sprite as image to handle dynamic dimensions
    if (!this.textures.exists("player_full")) {
      this.load.image("player_full", "/NPC_test.png");
    }
  }

  create() {
    // Generate valid sprite sheet from image
    if (!this.textures.exists("player")) {
      const playerTexture = this.textures.get("player_full");
      const source = playerTexture.getSourceImage();

      // Assume 4x4 grid
      const frameWidth = source.width / 4;
      const frameHeight = source.height / 4;

      if (frameWidth > 0 && frameHeight > 0) {
        const texture = this.textures.createCanvas(
          "player",
          source.width,
          source.height,
        );
        if (texture) {
          texture.draw(0, 0, source as HTMLImageElement);

          // Add frames 0-15
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
              const i = y * 4 + x;
              texture.add(
                i,
                0,
                x * frameWidth,
                y * frameHeight,
                frameWidth,
                frameHeight,
              );
            }
          }
          console.log(
            `[MainScene] Created dynamic spritesheet: ${frameWidth}x${frameHeight} frames`,
          );
        }
      }
    }

    const map = this.make.tilemap({ key: "main_map" });

    const officeTiles = map.addTilesetImage("OfficeTiles", "OfficeTiles");
    const roomBuilder = map.addTilesetImage("RoomBuilder", "RoomBuilder");
    const oldTiles = map.addTilesetImage("OldTiles", "OldTiles");
    const tileset2 = map.addTilesetImage("tileset2", "tileset2");
    const tileset16 = map.addTilesetImage("tileset16", "tileset16");

    const allTilesets = [
      officeTiles,
      roomBuilder,
      oldTiles,
      tileset2,
      tileset16,
    ].filter((t) => t !== null) as Phaser.Tilemaps.Tileset[];

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

    // Load zones from map
    const zonesLayer = map.getObjectLayer("Zones");
    if (zonesLayer) {
      this.zones = zonesLayer.objects.filter(
        (obj) => obj.name !== undefined && !obj.name.startsWith("Spawn"),
      );
    }

    let spawnX = 15;
    let spawnY = 15;

    if (zonesLayer) {
      const spawnPoint = zonesLayer.objects.find(
        (obj) => obj.name === "Spawn_main",
      );
      if (
        spawnPoint &&
        spawnPoint.x !== undefined &&
        spawnPoint.y !== undefined
      ) {
        spawnX = Math.floor(spawnPoint.x / 32);
        spawnY = Math.floor(spawnPoint.y / 32) - 1;
      }
    }

    // Create player sprite
    // Default to frame 0
    this.playerSprite = this.add.sprite(0, 0, "player", 0);
    this.playerSprite.setScale(1.6);
    this.playerSprite.setDepth(100);
    this.playerSprite.setOrigin(0, 0);

    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      backgroundColor: "#000000cc",
      padding: { x: 5, y: 0 },
    });
    this.usernameText.setOrigin(0.6, -3);
    this.usernameText.setDepth(101);

    // Animation setup for 4x4 sprite sheet
    // Row 0 (0-3): walk_down
    this.anims.create({
      key: "walk-down",
      frames: this.anims.generateFrameNumbers("player", { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 1 (4-7): walk_right
    this.anims.create({
      key: "walk-right",
      frames: this.anims.generateFrameNumbers("player", { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 2 (8-11): walk_up
    this.anims.create({
      key: "walk-up",
      frames: this.anims.generateFrameNumbers("player", { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 3 (12-15): walk_left
    this.anims.create({
      key: "walk-left",
      frames: this.anims.generateFrameNumbers("player", { start: 12, end: 15 }),
      frameRate: 8,
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
        this.checkZoneEntry(pos.x, pos.y);
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

    // Forward channel messages to WebSocket for real-time broadcast
    EventBus.on("channel:message_sent", (msg: any) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "chat_message",
            scope: "channel",
            channel_id: msg.channel_id,
            message: msg.content,
            message_data: msg, // Full message object for recipients
          }),
        );
      }
    });

    // Forward DM notifications to WebSocket
    EventBus.on("dm:message_sent", (data: any) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: "dm_sent",
            target_id: data.target_id,
            message: data.message,
          }),
        );
      }
    });

    // Listen for UI focus events to disable game input
    EventBus.on("ui:focus", () => {
      this.inputEnabled = false;
      // Disable keyboard capture so WASD can be typed in inputs
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
        // Reset all key states to prevent stuck movement
        this.input.keyboard.resetKeys();
        // Also remove key captures
        this.input.keyboard.removeAllKeys(true);
      }
    });
    EventBus.on("ui:blur", () => {
      this.inputEnabled = true;
      // Re-enable keyboard capture - with safety checks
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = true;
        // Recreate WASD keys only if keyboard is available
        try {
          this.wasd = {
            up: this.input.keyboard.addKey("W"),
            down: this.input.keyboard.addKey("S"),
            left: this.input.keyboard.addKey("A"),
            right: this.input.keyboard.addKey("D"),
          };
        } catch (e) {
          console.warn("[MainScene] Could not recreate WASD keys:", e);
        }
      }
    });

    // Listen for user list requests from UI components
    EventBus.on(GameEvents.REQUEST_USER_LIST, () => {
      // Immediately emit cached user list from local state
      const cachedUsers: any[] = [];

      // Add current user
      if (this.myId && this.myUsername) {
        const heroPos = this.gridEngine?.hasCharacter("hero")
          ? this.gridEngine.getPosition("hero")
          : { x: 15, y: 15 };
        cachedUsers.push({
          user_id: this.myId,
          username: this.myUsername,
          x: heroPos.x,
          y: heroPos.y,
        });
      }

      // Add other players from local cache
      this.otherPlayers.forEach((player, oderId) => {
        const charId = `player_${oderId}`;
        if (this.gridEngine?.hasCharacter(charId)) {
          const pos = this.gridEngine.getPosition(charId);
          cachedUsers.push({
            user_id: oderId,
            username: player.text.text,
            x: pos.x,
            y: pos.y,
          });
        }
      });

      // Emit immediately with cached data
      if (cachedUsers.length > 0) {
        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, cachedUsers);
      }

      // Also request fresh data from server
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "request_users" }));
      }
    });

    this.initWebSocket();
  }

  update() {
    if (!this.cursors || !this.wasd) return;

    // Skip input processing when UI is focused
    if (!this.inputEnabled) return;

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
        this.playerSprite.y - this.playerSprite.displayHeight - 4,
      );
    }

    this.otherPlayers.forEach((player) => {
      player.text.setPosition(
        player.sprite.x,
        player.sprite.y - player.sprite.displayHeight - 4,
      );
    });
  }

  private getSpriteById(charId: string): Phaser.GameObjects.Sprite | undefined {
    if (charId === "hero") return this.playerSprite;
    return this.otherPlayers.get(charId)?.sprite;
  }

  // Updated idle frames for 4x4 sprite sheet
  private getIdleFrame(direction: string): number {
    switch (direction) {
      case "down":
        return 1; // Row 0, frame 1
      case "right":
        return 5; // Row 1, frame 1
      case "up":
        return 9; // Row 2, frame 1
      case "left":
        return 13; // Row 3, frame 1
      default:
        return 1;
    }
  }

  private sendMovementToServer(x: number, y: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: "player_move",
        x,
        y,
        username: this.myUsername,
      }),
    );
  }

  // Zone detection - world drives communication
  private checkZoneEntry(x: number, y: number) {
    const pixelX = x * 32;
    const pixelY = y * 32;

    let foundZone: string | null = null;

    for (const zone of this.zones) {
      if (
        zone.x !== undefined &&
        zone.y !== undefined &&
        zone.width !== undefined &&
        zone.height !== undefined &&
        pixelX >= zone.x &&
        pixelX <= zone.x + zone.width &&
        pixelY >= zone.y &&
        pixelY <= zone.y + zone.height
      ) {
        foundZone = zone.name || null;
        break;
      }
    }

    // Emit zone change events
    if (foundZone !== this.currentZone) {
      if (this.currentZone) {
        EventBus.emit(GameEvents.ZONE_EXIT, {
          zoneId: this.currentZone,
          zoneName: this.currentZone,
          zoneType: this.currentZone.startsWith("Room") ? "PRIVATE" : "PUBLIC",
        });
      }

      if (foundZone) {
        EventBus.emit(GameEvents.ZONE_ENTER, {
          zoneId: foundZone,
          zoneName: foundZone,
          zoneType: foundZone.startsWith("Room") ? "PRIVATE" : "PUBLIC",
        });
        EventBus.emit(GameEvents.ROOM_ENTER, { roomId: foundZone });
      }

      this.currentZone = foundZone;
    }
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
    this.socket = new WebSocket(
      `${baseUrl}/ws/${this.myServerId}?token=${this.token}`,
    );

    this.socket.onopen = () => console.log("🔌 Connected");

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        this.handleServerMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("[WebSocket] Parse error:", error);
      }
    };

    this.socket.onerror = (error: Event) =>
      console.error("❌ WebSocket Error:", error);

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
          if (
            user.user_id !== this.myId &&
            !this.otherPlayers.has(user.user_id)
          ) {
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
          this.updateRemotePlayerPosition(
            data.user_id,
            data.x,
            data.y,
            data.username || "Player",
          );
        }
        break;

      case "user_joined":
        if (
          data.user_id !== this.myId &&
          !this.otherPlayers.has(data.user_id)
        ) {
          this.spawnRemotePlayer(
            data.user_id,
            data.username || "Player",
            data.x ?? 15,
            data.y ?? 15,
          );
        }
        break;

      case "user_left":
        this.removeRemotePlayer(data.user_id);
        break;

      case "chat_message":
        // Emit general chat message event
        EventBus.emit(GameEvents.CHAT_MESSAGE, data);

        // Also emit specific events for ChatFeed
        if (data.scope === "channel") {
          EventBus.emit("chat:channel_message", data);
        }
        break;

      case "dm_received":
        EventBus.emit("dm:received", data.message);
        break;

      case "dm_updated":
        EventBus.emit("dm:updated", data.message);
        break;

      case "dm_deleted":
        EventBus.emit("dm:deleted", { message_id: data.message_id });
        break;
    }
  }

  private spawnRemotePlayer(
    userId: string,
    username: string,
    x: number,
    y: number,
  ) {
    if (this.otherPlayers.has(userId)) return;

    const sprite = this.add.sprite(0, 0, "player", 1);
    sprite.setScale(1.6);
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

  private updateRemotePlayerPosition(
    userId: string,
    x: number,
    y: number,
    username?: string,
  ) {
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
    EventBus.off(GameEvents.REQUEST_USER_LIST);
    EventBus.off("channel:message_sent");
    EventBus.off("dm:message_sent");
    EventBus.off("ui:focus");
    EventBus.off("ui:blur");
    if (this.socket) this.socket.close();
  }
}
