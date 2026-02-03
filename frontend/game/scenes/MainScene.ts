import * as Phaser from "phaser";
import { Scene } from "phaser";
import { GridEngine, Direction } from "grid-engine";
import EventBus, { GameEvents, PlayerPositionEvent } from "../EventBus";

interface SceneData {
  userId: string;
  username: string;
  serverId: string;

  token: string;
  apiUrl?: string;
}

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
  private apiUrl: string = "http://localhost:8000";
  private lastDirection: string = "down"; // Track last facing direction for idle state

  // Throttling for sending position updates
  private lastSentPosition = { x: 0, y: 0 };
  private lastSentTime = 0;
  private sendThrottleMs = 25; // Lowered to 25ms (40fps) for smoother movement

  // Keyboard controls (create once, not every frame!)
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

  init() {
    // Get data from game registry (passed via preBoot callback)
    const data = (this.game.registry as any).sceneData;
    if (data) {
      this.myId = data.userId;
      this.myUsername = data.username;
      this.myServerId = data.serverId;

      this.token = data.token; // <--- Capture token
      if (data.apiUrl) this.apiUrl = data.apiUrl;
      console.log("[MainScene] init() received data:", data);
    } else {
      console.warn("[MainScene] No scene data found in registry");
    }
  }

  preload() {
    // Load the Tiled JSON map
    if (!this.cache.tilemap.exists("main_map")) {
      this.load.tilemapTiledJSON(
        "main_map",
        "/phaser_assets/maps/final_map.json",
      );
    }

    // Load all tilesets referenced in the map
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

    // Load NPC_test character spritesheet
    // VERIFIED DIMENSIONS: 64px width x 128px height
    // Grid: 4 columns x 4 rows = 16 frames
    // Frame Size: 16x32 pixels (64/4 = 16, 128/4 = 32)
    // Row 0 = Down, Row 1 = Right, Row 2 = Up, Row 3 = Left
    if (!this.textures.exists("player")) {
      this.load.spritesheet("player", "/NPC_test.png", {
        frameWidth: 16,
        frameHeight: 32,
      });
    }
  }

  create() {
    console.log("[MainScene] Initializing with grid-engine");
    console.log(
      "[MainScene] User:",
      this.myUsername,
      "Server:",
      this.myServerId,
    );
    // Load the REAL Tiled map
    const map = this.make.tilemap({ key: "main_map" });
    console.log(
      "[MainScene] Loaded tilemap:",
      map.width,
      "x",
      map.height,
      "tiles",
    );

    // Add all tilesets (must match names in Tiled)
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
    console.log("[MainScene] Loaded tilesets:", allTilesets.length);

    // Create visible layers
    const floorLayer = map.createLayer("Floor", allTilesets, 0, 0);
    const wallsLayer = map.createLayer("Walls", allTilesets, 0, 0);
    const furnitureLayer = map.createLayer("Furniture", allTilesets, 0, 0);

    // Create Collision layer (hidden, used for grid-engine collision)
    const collisionLayer = map.createLayer("Collision", allTilesets, 0, 0);

    // Set layer depths
    floorLayer?.setDepth(0);
    wallsLayer?.setDepth(10);
    furnitureLayer?.setDepth(20);

    // Hide and configure collision layer
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      // Set all non-zero tiles as collision
      collisionLayer.setCollisionByExclusion([-1, 0]);
      console.log("[MainScene] Collision layer created and configured");
    } else {
      console.warn("[MainScene] Collision layer not found!");
    }

    console.log("[MainScene] Map layers created");

    // Get spawn point from Zones object layer
    // Default spawn: center of the Hall area (bottom half of map)
    let spawnX = 15; // Center X
    let spawnY = 15; // In the open Hall area

    const zonesLayer = map.getObjectLayer("Zones");
    if (zonesLayer) {
      console.log(
        "[MainScene] Zones layer objects:",
        zonesLayer.objects.map((o) => o.name),
      );
      const spawnPoint = zonesLayer.objects.find(
        (obj) => obj.name === "Spawn_main",
      );
      if (
        spawnPoint &&
        spawnPoint.x !== undefined &&
        spawnPoint.y !== undefined
      ) {
        spawnX = Math.floor(spawnPoint.x / 32);
        spawnY = Math.floor(spawnPoint.y / 32) - 1; // Subtract 1 to be inside the map
        console.log(
          "[MainScene] Spawn point from map:",
          spawnX,
          spawnY,
          "(raw px:",
          spawnPoint.x,
          spawnPoint.y,
          ")",
        );
      }
    } else {
      console.warn("[MainScene] Zones layer not found, using default spawn");
    }

    // Create local player sprite using NPC_test character (16x32 frames)
    // Use frame 0 as idle (down-facing)
    this.playerSprite = this.add.sprite(0, 0, "player", 0);
    this.playerSprite.setScale(1.5); // 16x32 → 24x48 on screen
    this.playerSprite.setDepth(100); // Above all map layers
    this.playerSprite.setOrigin(0.5, 0.5); // Center origin

    console.log("[MainScene] Created player sprite (16x32)");

    // Username label - positioned directly above player's head
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: "10px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
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
      console.log(
        "[MainScene] Collision layer configured with",
        collisionLayer.layer.data.flat().filter((t: any) => t.index > 0).length,
        "collision tiles",
      );
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
          id: "hero",
          sprite: this.playerSprite,
          startPosition: { x: spawnX, y: spawnY },
          speed: 4,
        },
      ],
      numberOfDirections: 4, // 4-way movement
      collisionTilePropertyName: "ge_collide",
    };

    console.log(
      "[MainScene] Creating grid-engine with spawn at:",
      spawnX,
      spawnY,
    );

    // Create grid-engine
    this.gridEngine.create(map, gridEngineConfig);

    // Camera setup
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    console.log("[MainScene] Camera setup complete");

    // Create manual animations for NPC_test (16x32 frames, 4 columns x 4 rows)
    // Row 0=Down, Row 1=Right, Row 2=Up, Row 3=Left
    const cols = 4; // 4 columns of animation frames
    const directions = [
      { name: "down", row: 0 },
      { name: "right", row: 1 },
      { name: "up", row: 2 },
      { name: "left", row: 3 },
    ];

    directions.forEach(({ name, row }) => {
      this.anims.create({
        key: `walk_${name}`,
        frames: this.anims.generateFrameNumbers("player", {
          start: row * cols,
          end: row * cols + cols - 1,
        }),
        frameRate: 8,
        repeat: -1,
      });
    });
    console.log("[MainScene] Created 4-direction walk animations");

    // Setup movement observers (CLIENT-SIDE PREDICTION)
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      if (charId === "hero") {
        const currentPos = this.gridEngine.getPosition("hero");
        let targetX = currentPos.x;
        let targetY = currentPos.y;

        // Predict target tile based on direction
        switch (direction) {
          case "left":
            targetX -= 1;
            break;
          case "right":
            targetX += 1;
            break;
          case "up":
            targetY -= 1;
            break;
          case "down":
            targetY += 1;
            break;
        }

        // Emit to React immediately (optional, use target or current?)
        // HUD usually shows current, but maybe efficient to show target? Keep current for HUD.
        const payload: PlayerPositionEvent = {
          x: currentPos.x,
          y: currentPos.y,
          direction: direction as "up" | "down" | "left" | "right",
        };
        EventBus.emit(GameEvents.PLAYER_POSITION, payload);

        // Send TARGET to server so others see us move TO there
        this.sendMovementToServer(targetX, targetY, direction);

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
      if (charId === "hero") {
        this.playerSprite.stop();

        // Set idle frame
        const directionToRow: Record<string, number> = {
          down: 0,
          right: 1,
          up: 2,
          left: 3,
        };
        const row = directionToRow[this.lastDirection] ?? 0;
        const idleFrame = row * 4;
        this.playerSprite.setFrame(idleFrame);

        // FORCE SENT Final Position to ensure sync
        const finalPos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(
          finalPos.x,
          finalPos.y,
          this.lastDirection,
          true,
        ); // Force send
        // We might need to force it. Let's make a force flag or just updating timestamp in send will handle it if enough time passed.
        // Actually, better to forcefully send if checking strict consistency.
        // But for now, let's just call it. If it was throttled recently, maybe it's fine because we sent target?
        // Sending target covers 99% of cases.
        // We'll trust the target send for now, but calling this doesn't hurt.
        // Actually, to prevent "missing the last step", we should allow this one to bypass throttle if needed?
        // Let's just rely on target logic first.
      }
    });

    // Removed redundant positionChangeFinished listener for label updates (handled in update loop)

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

    console.log("[MainScene] Grid-engine initialized successfully");
    console.log(
      "[MainScene] Player sprite position AFTER grid-engine:",
      this.playerSprite.x,
      this.playerSprite.y,
    );

    // Force update sprite position immediately
    const heroPos = this.gridEngine.getPosition("hero");
    console.log(
      "[MainScene] Grid-engine says hero is at tile:",
      heroPos.x,
      heroPos.y,
    );
    console.log("[MainScene] Grid-engine tile size:", 32);

    // CRITICAL: Setup keyboard ONCE here, not in update()!
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      up: "W",
      down: "S",
      left: "A",
      right: "D",
    }) as any;

    console.log("[MainScene] Keyboard controls registered:", {
      cursors: !!this.cursors,
      wasd: !!this.wasd,
    });

    this.initWebSocket();
  }

  private initWebSocket() {
    // Prevent duplicate connections (React Strict Mode protection)
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log(
        "[MainScene] WebSocket already connected, skipping initialization",
      );
      return;
    }

    if (!this.myServerId || !this.myId) {
      console.error(
        "[MainScene] Cannot connect WebSocket: missing serverId or userId",
      );
      return;
    }

    console.log("[MainScene] Connecting WebSocket:", {
      serverId: this.myServerId,
      userId: this.myId,
    });

    // Create WebSocket connection
    // Convert http/https to ws/wss
    const wsUrl = this.apiUrl.replace(/^http/, "ws");
    // Ensure no trailing slash before appending path
    const baseUrl = wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;

    this.socket = new WebSocket(
      `${baseUrl}/ws/${this.myServerId}?token=${this.token}`,
    );

    this.socket.onopen = () => {
      console.log("🔌 [MainScene] WebSocket Connected!");
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 [MainScene] Received:", data);
        this.handleServerMessage(data);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    this.socket.onerror = (error: Event) => {
      console.error("❌ [MainScene] WebSocket Error:", error);
    };

    this.socket.onclose = () => {
      console.log(
        "🔌 [MainScene] WebSocket Disconnected — reconnecting in 2s...",
      );
      this.socket = null;

      // Retry after 2 seconds, but only if the scene is still alive
      this.time.delayedCall(2000, () => {
        if (this.scene.isActive("MainScene")) {
          console.log("🔄 [MainScene] Attempting reconnect...");
          this.initWebSocket();
        }
      });
    };
  }

  private handleServerMessage(data: any) {
    switch (data.type) {
      case "user_list":
        console.log("👥 [MainScene] Online users:", data.users);

        // data.users is now an array of objects: { user_id, x, y, username }
        // We only need IDs for the React HUD list typically, or maybe full objects?
        // Let's map to IDs if the HUD expects IDs, or pass full objects if it handles them.
        // Based on previous code: EventBus.emit(..., data.users) where data.users was list of strings.
        // Now it's list of objects.
        const userIds = data.users.map((u: any) => u.user_id);
        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, userIds);

        data.users.forEach(
          (user: {
            user_id: string;
            x: number;
            y: number;
            username: string;
          }) => {
            if (
              user.user_id !== this.myId &&
              !this.otherPlayers.has(user.user_id)
            ) {
              // Spawn at their ACTUAL last-known position — no jump
              this.spawnRemotePlayer(
                user.user_id,
                user.username,
                user.x,
                user.y,
              );
            }
          },
        );

        // Send our current position so others can see us immediately (force=true)
        if (this.gridEngine.hasCharacter("hero")) {
          const myPos = this.gridEngine.getPosition("hero");
          this.sendMovementToServer(myPos.x, myPos.y, this.lastDirection, true);
        }
        break;

      case "player_move":
        // Don't process our own movement echoes
        if (data.user_id === this.myId) return;

        // console.log("🏃 [MainScene] Player moved:", data.user_id);
        this.updateRemotePlayerPosition(
          data.user_id,
          data.x,
          data.y,
          data.username || "Player",
        );
        break;

      case "user_joined":
        // Don't spawn ourselves
        if (data.user_id === this.myId) return;

        console.log("✅ [MainScene] User joined:", data.user_id);

        // Prevent duplicates (React Strict Mode)
        if (!this.otherPlayers.has(data.user_id)) {
          // Backend sends x, y, username now — use them. ?? not || so that 0 is valid.
          this.spawnRemotePlayer(
            data.user_id,
            data.username || "Player",
            data.x ?? 15,
            data.y ?? 15,
          );

          // Re-send our position so the new joiner sees us immediately. force=true.
          if (this.gridEngine.hasCharacter("hero")) {
            const myPos = this.gridEngine.getPosition("hero");
            this.sendMovementToServer(
              myPos.x,
              myPos.y,
              this.lastDirection,
              true,
            );
          }
        }
        break;

      case "user_left":
        console.log("❌ [MainScene] User left:", data.user_id);
        this.removeRemotePlayer(data.user_id);
        break;
    }
  }

  update() {
    // Check if keyboard is available
    if (!this.cursors || !this.wasd) {
      // console.error("[MainScene] Keyboard not initialized!");
      return;
    }

    // Grid-based movement (discrete tile steps)
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

    // Update username label to follow player (just above head, slightly right)
    if (this.playerSprite && this.usernameText) {
      this.usernameText.setPosition(
        this.playerSprite.x, // remove the +5, center it like remote labels
        this.playerSprite.y - 20, // match remote label offset
      );
    }

    // Update remote player labels to follow their sprites
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 20);
    });
  }

  private sendMovementToServer(
    x: number,
    y: number,
    direction: string,
    force: boolean = false,
  ) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return; // Silently ignore if not connected
    }

    const now = Date.now();
    const positionChanged =
      this.lastSentPosition.x !== x || this.lastSentPosition.y !== y;

    // Throttle: only send if position changed AND (enough time passed OR force flag is set)
    if (
      positionChanged &&
      (force || now - this.lastSentTime >= this.sendThrottleMs)
    ) {
      this.socket.send(
        JSON.stringify({
          type: "player_move",
          x,
          y,
          username: this.myUsername,
        }),
      );

      this.lastSentPosition = { x, y };
      this.lastSentTime = now;
    }
  }

  private checkProximity() {
    if (!this.gridEngine.hasCharacter("hero")) return;

    const myPos = this.gridEngine.getPosition("hero");

    this.otherPlayers.forEach((player, playerId) => {
      if (!this.gridEngine.hasCharacter(playerId)) return;

      const otherPos = this.gridEngine.getPosition(playerId);

      // Euclidean distance in tiles
      const distance = Phaser.Math.Distance.Between(
        myPos.x,
        myPos.y,
        otherPos.x,
        otherPos.y,
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
      this.playerSprite.setTint(parseInt(data.color.replace("#", "0x")));
    }
  }

  private spawnRemotePlayer(
    userId: string,
    username: string,
    x: number,
    y: number,
  ) {
    if (this.otherPlayers.has(userId)) return;

    console.log("[MainScene] Spawning remote player:", username, "at", x, y);

    // Create sprite using same spritesheet as local player
    const sprite = this.add.sprite(0, 0, username, 0);
    sprite.setScale(1.5); // Same as local player
    sprite.setDepth(100);
    sprite.setOrigin(0.5, 0.5);

    // Create username label
    const text = this.add.text(0, -20, username, {
      fontSize: "10px",
      color: "#00ff00", // Green to distinguish from local player
      backgroundColor: "#000000aa",
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

    if (this.gridEngine.hasCharacter(userId)) {
      const currentPos = this.gridEngine.getPosition(userId);

      if (currentPos.x !== x || currentPos.y !== y) {
        const distance =
          Math.abs(currentPos.x - x) + Math.abs(currentPos.y - y);

        // Lag Compensation / Catch-up Logic
        if (distance > 3) {
          // Teleport if too far
          this.gridEngine.setPosition(userId, { x, y });
        } else {
          // Speed boost if falling behind
          const BaseSpeed = 4;
          const CatchUpSpeed = 8; // Double speed to catch up

          if (distance > 1) {
            this.gridEngine.setSpeed(userId, CatchUpSpeed);
          } else {
            this.gridEngine.setSpeed(userId, BaseSpeed);
          }

          this.gridEngine.moveTo(userId, { x, y });
        }
      }
    }
  }

  private removeRemotePlayer(userId: string) {
    const player = this.otherPlayers.get(userId);
    if (!player) return;

    console.log("[MainScene] Removing remote player:", userId);

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
    EventBus.off(
      GameEvents.REMOVE_REMOTE_PLAYER,
      this.removeRemotePlayer,
      this,
    );

    if (this.socket) {
      this.socket.close();
    }
  }
}
