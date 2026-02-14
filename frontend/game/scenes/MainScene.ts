import * as Phaser from "phaser";
import { Scene } from "phaser";
import { GridEngine, Direction } from "grid-engine";
import EventBus, { GameEvents } from "../EventBus";
import {
  getCharacterById,
  CharacterAnimationSet,
} from "@/types/advance_char_config";

export class MainScene extends Scene {
  private gridEngine!: GridEngine;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private usernameText!: Phaser.GameObjects.Text;
  private otherPlayers: Map<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      text: Phaser.GameObjects.Text;
      characterId: string;
    }
  > = new Map();

  private characterConfig!: CharacterAnimationSet;
  private characterId: string = "bob";
  private characterAnimations: Map<string, CharacterAnimationSet> = new Map(); // Track loaded characters
  private lastDirection: Map<string, "up" | "down" | "left" | "right"> =
    new Map();
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

  /**
   * Create frames for a sprite sheet with specific dimensions
   */
  private createSpriteSheetFrames(sheet: any) {
    const fullKey = sheet.key + "_full";

    if (!this.textures.exists(fullKey)) {
      console.warn(`Texture ${fullKey} not loaded`);
      return;
    }

    const sourceTexture = this.textures.get(fullKey);
    const source = sourceTexture.getSourceImage() as HTMLImageElement;

    // Calculate grid if not provided
    const gridCols =
      sheet.gridColumns || Math.floor(source.width / sheet.frameWidth);
    const gridRows =
      sheet.gridRows || Math.floor(source.height / sheet.frameHeight);

    console.log(
      `Creating frames for ${sheet.key}: ${gridCols}x${gridRows} grid, ` +
        `${sheet.frameWidth}x${sheet.frameHeight}px frames`,
    );

    // Create canvas texture with exact source dimensions
    const texture = this.textures.createCanvas(
      sheet.key,
      source.width,
      source.height,
    );

    if (texture) {
      texture.draw(0, 0, source);

      // Generate frames for this sprite sheet
      let frameIndex = 0;
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          texture.add(
            frameIndex,
            0,
            col * sheet.frameWidth,
            row * sheet.frameHeight,
            sheet.frameWidth,
            sheet.frameHeight,
          );
          frameIndex++;
        }
      }

      console.log(`Created ${frameIndex} frames for ${sheet.key}`);
    }
  }

  /**
   * Play animation for a sprite based on state and direction
   */
  private playAnimation(
    sprite: Phaser.GameObjects.Sprite,
    state: string,
    direction: string,
    characterId?: string, // Optional character ID for  remote players
  ) {
    // Use character-specific animations if character ID provided
    const charConfig = characterId
      ? this.characterAnimations.get(characterId)
      : null;
    const animKey = charConfig
      ? `${characterId}_${state}-${direction}` // Remote player animation
      : `${state}-${direction}`; // Local player animation

    // Check if already playing this animation to prevent flickering
    const currentAnim = sprite.anims.currentAnim;
    if (currentAnim && currentAnim.key === animKey && sprite.anims.isPlaying) {
      return; // Already playing the correct animation
    }

    if (this.anims.exists(animKey)) {
      sprite.play(animKey, true);
    } else {
      console.warn(`Animation ${animKey} not found, trying fallback`);
      // Try fallback to idle
      const fallback = charConfig
        ? `${characterId}_idle-${direction}`
        : `idle-${direction}`;
      if (this.anims.exists(fallback)) {
        sprite.play(fallback, true);
      }
    }
  }

  init(data: any) {
    if (data) {
      this.myId = data.userId;
      this.myUsername = data.username;
      this.myServerId = data.serverId;
      this.token = data.token;
      this.characterId = data.characterId || "bob";
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

    // Load character configuration
    const charConfig = getCharacterById(this.characterId);
    if (!charConfig) {
      console.error(`Character ${this.characterId} not found, using default`);
      this.characterConfig = getCharacterById("bob")!;
    } else {
      this.characterConfig = charConfig;
    }
    // Load ALL sprite sheets for this character
    this.characterConfig.sheets.forEach((sheet) => {
      const fullKey = sheet.key + "_full";
      if (!this.textures.exists(fullKey)) {
        console.log(
          `Loading sprite sheet: ${sheet.key} from ${sheet.spritePath}`,
        );
        this.load.image(fullKey, sheet.spritePath);
      }
    });
  }

  create() {
    this.characterConfig.sheets.forEach((sheet) => {
      this.createSpriteSheetFrames(sheet);
    });

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

    this.characterConfig.animations.forEach((animConfig) => {
      if (!this.anims.exists(animConfig.animationKey)) {
        this.anims.create({
          key: animConfig.animationKey,
          frames: animConfig.frames.map((frameNum) => ({
            key: animConfig.sheetKey,
            frame: frameNum,
          })),
          frameRate: animConfig.frameRate,
          repeat: animConfig.repeat,
        });
      }
    });
    console.log(`Created ${this.characterConfig.animations.length} animations`);

    // Create player sprite using first sheet
    const firstSheet = this.characterConfig.sheets[0];
    this.playerSprite = this.add.sprite(0, 0, firstSheet.key, 0);
    this.playerSprite.setScale(2); // Adjust scale as needed
    this.playerSprite.setDepth(100);
    this.playerSprite.setOrigin(0.5, 1);

    // Play default idle animation
    const defaultAnim = this.characterConfig.defaultAnimation || "idle-down";
    if (this.anims.exists(defaultAnim)) {
      this.playerSprite.play(defaultAnim);
    }

    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      backgroundColor: "#6366f1",
      align: "center",
      padding: { x: 5, y: 2 },
    });
    this.usernameText.setOrigin(0.1, -4);
    this.usernameText.setDepth(100);

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

      if (charId === "hero") {
        // Track direction for hero
        this.lastDirection.set(
          "hero",
          direction as "up" | "down" | "left" | "right",
        );

        // Use "run" animations instead of "walk"
        this.playAnimation(sprite, "run", direction);

        const pos = this.gridEngine.getPosition("hero");
        EventBus.emit(GameEvents.PLAYER_POSITION, {
          x: pos.x,
          y: pos.y,
          direction: direction as "up" | "down" | "left" | "right",
        });
        this.sendMovementToServer(pos.x, pos.y);
        this.checkZoneEntry(pos.x, pos.y);
      } else {
        // Other players also use run animations with their character ID
        const player = this.otherPlayers.get(charId);
        if (player) {
          this.playAnimation(sprite, "run", direction, player.characterId);
        }
      }
    });

    this.gridEngine.movementStopped().subscribe(({ charId, direction }) => {
      const sprite = this.getSpriteById(charId);
      if (!sprite) return;

      if (charId === "hero") {
        // Check if any movement keys are still pressed
        const leftPressed = this.cursors?.left.isDown || this.wasd?.left.isDown;
        const rightPressed =
          this.cursors?.right.isDown || this.wasd?.right.isDown;
        const upPressed = this.cursors?.up.isDown || this.wasd?.up.isDown;
        const downPressed = this.cursors?.down.isDown || this.wasd?.down.isDown;
        const anyKeyPressed =
          leftPressed || rightPressed || upPressed || downPressed;

        // Only play idle if NO keys are pressed
        if (!anyKeyPressed) {
          const heroDirection = this.lastDirection.get("hero") || "down";
          this.playAnimation(this.playerSprite, "idle", heroDirection);
        }

        const pos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(pos.x, pos.y);
      } else {
        const player = this.otherPlayers.get(charId);
        if (player) {
          this.playAnimation(sprite, "idle", direction, player.characterId);
        }
      }
    });

    this.gridEngine.directionChanged().subscribe(({ charId, direction }) => {
      const sprite = this.getSpriteById(charId);
      if (!sprite || this.gridEngine.isMoving(charId)) return;

      if (charId === "hero") {
        this.playAnimation(sprite, "idle", direction);
      } else {
        const player = this.otherPlayers.get(charId);
        if (player) {
          this.playAnimation(sprite, "idle", direction, player.characterId);
        }
      }
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
      // Re-enable keyboard capture
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
        // Recreate WASD keys with error handling
        try {
          this.wasd = {
            up: this.input.keyboard.addKey("W"),
            down: this.input.keyboard.addKey("S"),
            left: this.input.keyboard.addKey("A"),
            right: this.input.keyboard.addKey("D"),
          };
        } catch (error) {
          console.warn("Failed to recreate WASD keys:", error);
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

    // Update labels for remote players
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

  private sendMovementToServer(x: number, y: number) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: "player_move",
        x,
        y,
        username: this.myUsername,
        character_id: this.characterId, // Include character ID
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
        // Make sure myId is set before filtering
        console.log(
          "[user_list] myId:",
          this.myId,
          "users:",
          data.users.map((u: any) => u.user_id),
        );
        data.users.forEach((user: any) => {
          if (
            user.user_id !== this.myId &&
            !this.otherPlayers.has(user.user_id)
          ) {
            this.spawnRemotePlayer(
              user.user_id,
              user.username,
              user.x,
              user.y,
              user.character_id, // Pass character ID
            );
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
            data.character_id, // Pass character ID
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
            data.character_id, // Pass character ID
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
    characterId?: string,
  ) {
    if (this.otherPlayers.has(userId)) return;

    // Default to bob if no character specified
    const remoteCharId = characterId || "bob";

    // Load character config
    let remoteCharConfig = this.characterAnimations.get(remoteCharId);
    if (!remoteCharConfig) {
      remoteCharConfig = getCharacterById(remoteCharId);
      if (remoteCharConfig) {
        this.characterAnimations.set(remoteCharId, remoteCharConfig);

        // Load sprite sheets for this character
        remoteCharConfig.sheets.forEach((sheet) => {
          const fullKey = `${remoteCharId}_${sheet.key}_full`;
          if (!this.textures.exists(fullKey)) {
            this.load.image(fullKey, sheet.spritePath);
          }
        });

        // Start loading and wait for it
        this.load.once("complete", () => {
          if (!remoteCharConfig) return;

          // Create sprite sheet frames
          remoteCharConfig.sheets.forEach((sheet) => {
            const customKey = `${remoteCharId}_${sheet.key}`;
            const fullKey = `${customKey}_full`;

            if (this.textures.exists(customKey)) return;

            const sourceTexture = this.textures.get(fullKey);
            const source = sourceTexture.getSourceImage() as HTMLImageElement;

            const gridCols =
              sheet.gridColumns || Math.floor(source.width / sheet.frameWidth);
            const gridRows =
              sheet.gridRows || Math.floor(source.height / sheet.frameHeight);

            const texture = this.textures.createCanvas(
              customKey,
              source.width,
              source.height,
            );
            if (texture) {
              texture.draw(0, 0, source);
              let frameIndex = 0;
              for (let row = 0; row < gridRows; row++) {
                for (let col = 0; col < gridCols; col++) {
                  texture.add(
                    frameIndex,
                    0,
                    col * sheet.frameWidth,
                    row * sheet.frameHeight,
                    sheet.frameWidth,
                    sheet.frameHeight,
                  );
                  frameIndex++;
                }
              }
            }
          });

          // Create animations
          remoteCharConfig.animations.forEach((animConfig) => {
            const customAnimKey = `${remoteCharId}_${animConfig.animationKey}`;
            const customSheetKey = `${remoteCharId}_${animConfig.sheetKey}`;

            if (!this.anims.exists(customAnimKey)) {
              this.anims.create({
                key: customAnimKey,
                frames: animConfig.frames.map((frameNum) => ({
                  key: customSheetKey,
                  frame: frameNum,
                })),
                frameRate: animConfig.frameRate,
                repeat: animConfig.repeat,
              });
            }
          });

          // Now spawn the sprite
          this.finishSpawningRemotePlayer(
            userId,
            username,
            x,
            y,
            remoteCharId,
            remoteCharConfig,
          );
        });

        this.load.start();
        return;
      }
    }

    // Character already loaded, spawn immediately
    this.finishSpawningRemotePlayer(
      userId,
      username,
      x,
      y,
      remoteCharId,
      remoteCharConfig,
    );
  }

  private finishSpawningRemotePlayer(
    userId: string,
    username: string,
    x: number,
    y: number,
    characterId: string,
    charConfig: CharacterAnimationSet | undefined,
  ) {
    if (!charConfig) {
      console.error(`Failed to load character ${characterId}`);
      return;
    }

    const firstSheet = charConfig.sheets[0];
    const sheetKey = `${characterId}_${firstSheet.key}`;
    const sprite = this.add.sprite(0, 0, sheetKey, 0);
    sprite.setScale(2);
    sprite.setDepth(100);
    sprite.setOrigin(0.5, 1);

    // Gather.town style label using TextStyle properties
    const text = this.add.text(0, 0, username, {
      fontSize: "11px",
      fontFamily: "Arial, sans-serif",
      color: "#ffffff",
      backgroundColor: "#6366f1",
      padding: { x: 8, y: 3.6 },
    });
    this.usernameText.setOrigin(0.2, -5.2);
    this.usernameText.setDepth(100);

    this.gridEngine.addCharacter({
      id: userId,
      sprite: sprite,
      startPosition: { x, y },
      speed: 4,
      offsetY: 0,
    });

    this.otherPlayers.set(userId, { sprite, text, characterId });

    // Play default animation for this character
    const defaultAnim = `${characterId}_idle-down`;
    if (this.anims.exists(defaultAnim)) {
      sprite.play(defaultAnim);
    }
  }

  private updateRemotePlayerPosition(
    userId: string,
    x: number,
    y: number,
    username?: string,
    characterId?: string,
  ) {
    const player = this.otherPlayers.get(userId);

    if (!player) {
      this.spawnRemotePlayer(userId, username || "Player", x, y, characterId);
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
