import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { GridEngine, Direction } from 'grid-engine';
import EventBus, { GameEvents } from '../EventBus';
import { getAllCharacters, getCharacterById } from "@/types/advance_char_config";

/**
 * MainScene - Optimized Parth Architecture
 * Handles World Loading, Character Sync, and specialized GridEngine movement.
 */
export class MainScene extends Scene {
  private gridEngine!: GridEngine;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private usernameText!: Phaser.GameObjects.Text;
  private otherPlayers: Map<string, { sprite: Phaser.GameObjects.Sprite; text: Phaser.GameObjects.Text; characterId: string }> = new Map();

  private socket: WebSocket | null = null;
  private myId: string = '';
  private myUsername: string = '';
  private characterId: string = 'bob';
  private currentRoomId: string = '';
  private lastDirection: string = 'down';

  private lastSentTime = 0;
  private sendThrottleMs = 30;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  constructor() { super({ key: 'MainScene' }); }

  init() {
    const data = (this.game.registry as any).sceneData;
    if (data) {
      this.myId = String(data.userId);
      this.myUsername = data.username;
      this.currentRoomId = String(data.roomId || data.serverId);
      this.characterId = data.characterId || 'bob';
    }
  }

  preload() {
    // 1. World Assets
    this.load.tilemapTiledJSON('main_map', '/phaser_assets/maps/final_map.json');
    this.load.image('OfficeTiles', '/phaser_assets/Interiors_free/32x32/Interiors_free_32x32.png');
    this.load.image('RoomBuilder', '/phaser_assets/Interiors_free/32x32/Room_Builder_free_32x32.png');
    this.load.image('OldTiles', '/phaser_assets/Old/Tileset_32x32_1.png');
    this.load.image('tileset2', '/phaser_assets/Old/Tileset_32x32_2.png');
    this.load.image('tileset16', '/phaser_assets/Old/Tileset_32x32_16.png');

    // 2. Character Skins (using advanced_char_config)
    getAllCharacters().forEach(char => {
      char.sheets.forEach(sheet => {
        // Use the EXACT key from config (e.g., 'bob_run')
        this.load.spritesheet(sheet.key, sheet.spritePath, {
          frameWidth: sheet.frameWidth,
          frameHeight: sheet.frameHeight
        });
      });
    });
  }

  create() {
    // 1. Map & Layers
    const map = this.make.tilemap({ key: 'main_map' });
    const tsNames = ['OfficeTiles', 'RoomBuilder', 'OldTiles', 'tileset2', 'tileset16'];
    const tilesets = tsNames.map(name => map.addTilesetImage(name, name)).filter(Boolean) as Phaser.Tilemaps.Tileset[];

    map.createLayer('Floor', tilesets, 0, 0)?.setDepth(0);
    map.createLayer('Walls', tilesets, 0, 0)?.setDepth(10);
    map.createLayer('Furniture', tilesets, 0, 0)?.setDepth(20);
    const collisionLayer = map.createLayer('Collision', tilesets, 0, 0);

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

    // 2. Register Animations
    getAllCharacters().forEach(char => {
      char.animations.forEach(anim => {
        const key = `${char.id}_${anim.animationKey}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers(anim.sheetKey, { frames: [...anim.frames] }),
            frameRate: anim.frameRate,
            repeat: anim.repeat
          });
        }
      });
    });

    // 3. Hero Initialization
    // Start with the 'idle-down' state
    this.playerSprite = this.add.sprite(0, 0, `${this.characterId}_idle`, 3).setScale(1.5).setDepth(100).setOrigin(0.5, 0.5);
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: '10px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 4, y: 2 }, fontStyle: 'bold'
    }).setOrigin(0.5, 1).setDepth(101);

    this.gridEngine.create(map, {
      characters: [{ id: 'hero', sprite: this.playerSprite, startPosition: { x: 15, y: 15 }, speed: 4 }],
      numberOfDirections: 4,
      collisionTilePropertyName: 'ge_collide'
    });

    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08).setZoom(2.2).setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // 4. Movement Observers
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      const charInfo = (charId === 'hero') ? { sprite: this.playerSprite, characterId: this.characterId } : this.otherPlayers.get(charId);
      if (charInfo) {
        const animKey = `${charInfo.characterId}_run-${direction.toLowerCase()}`;
        if (this.anims.exists(animKey)) charInfo.sprite.play(animKey, true);
        if (charId === 'hero') {
          this.lastDirection = direction.toLowerCase();
          this.sendMovementToServer(direction, true);
        }
      }
    });

    this.gridEngine.movementStopped().subscribe(({ charId, direction }) => {
      const charInfo = (charId === 'hero') ? { sprite: this.playerSprite, characterId: this.characterId } : this.otherPlayers.get(charId);
      if (charInfo) {
        charInfo.sprite.stop();
        const cid = charInfo.characterId;
        const animKey = `${cid}_idle-${direction.toLowerCase()}`;
        if (this.anims.exists(animKey)) charInfo.sprite.play(animKey, true);

        if (charId === 'hero') {
          this.lastDirection = direction.toLowerCase();
          this.sendMovementToServer(direction, false);
        }
      }
    });

    // 5. Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({ up: 'W', down: 'S', left: 'A', right: 'D' }) as any;

    this.initWebSocket();
  }

  update() {
    if (!this.cursors || !this.wasd) return;
    if (this.cursors.left.isDown || this.wasd.left.isDown) this.gridEngine.move('hero', Direction.LEFT);
    else if (this.cursors.right.isDown || this.wasd.right.isDown) this.gridEngine.move('hero', Direction.RIGHT);
    else if (this.cursors.up.isDown || this.wasd.up.isDown) this.gridEngine.move('hero', Direction.UP);
    else if (this.cursors.down.isDown || this.wasd.down.isDown) this.gridEngine.move('hero', Direction.DOWN);

    this.usernameText.setPosition(this.playerSprite.x, this.playerSprite.y - 20);
    this.otherPlayers.forEach(p => p.text.setPosition(p.sprite.x, p.sprite.y - 20));
  }

  private initWebSocket() {
    const data = (this.game.registry as any).sceneData;
    if (!data || !data.token) return;
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/${this.currentRoomId}?token=${data.token}`;
    this.socket = new WebSocket(wsUrl);
    this.socket.onmessage = (e) => this.handleServerMessage(JSON.parse(e.data));
  }

  private handleServerMessage(data: any) {
    if (data.user_id === this.myId) return;
    switch (data.type) {
      case 'player_move': this.updateRemotePlayer(data); break;
      case 'user_joined': this.spawnRemotePlayer(data); break;
      case 'user_left': this.removeRemotePlayer(data.user_id); break;
    }
  }

  private sendMovementToServer(direction: string, moving: boolean) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const now = Date.now();
      if (now - this.lastSentTime >= this.sendThrottleMs) {
        const pos = this.gridEngine.getPosition('hero');
        this.socket.send(JSON.stringify({
          type: 'player_move',
          x: pos.x, y: pos.y,
          direction: direction.toLowerCase(),
          moving
        }));
        this.lastSentTime = now;
      }
    }
  }

  private spawnRemotePlayer(data: any) {
    const { user_id, username, character_id, x, y } = data;
    if (this.otherPlayers.has(user_id)) return;
    const cid = character_id || 'bob';

    // Find default idle textureKey
    const char = getCharacterById(cid) || getCharacterById('bob')!;
    const idleSheet = char.sheets.find(s => s.key.includes('idle'))?.key || char.sheets[0].key;

    const sprite = this.add.sprite(0, 0, idleSheet, 3).setScale(1.5).setDepth(100).setOrigin(0.5, 0.5);
    const text = this.add.text(0, 0, username || 'Player', {
      fontSize: '10px', color: '#00ff00', backgroundColor: '#000000aa', padding: { x: 3, y: 1 }, fontStyle: 'bold'
    }).setOrigin(0.5, 1).setDepth(101);

    this.gridEngine.addCharacter({ id: user_id, sprite, startPosition: { x: x || 15, y: y || 15 }, speed: 4 });
    this.otherPlayers.set(user_id, { sprite, text, characterId: cid });
  }

  private updateRemotePlayer(data: any) {
    const p = this.otherPlayers.get(data.user_id);
    if (!p) { this.spawnRemotePlayer(data); return; }

    if (this.gridEngine.hasCharacter(data.user_id)) {
      if (data.moving) {
        const dirMap: any = { 'up': Direction.UP, 'down': Direction.DOWN, 'left': Direction.LEFT, 'right': Direction.RIGHT };
        this.gridEngine.move(data.user_id, dirMap[data.direction.toLowerCase()] || Direction.DOWN);
      } else {
        this.gridEngine.stopMovement(data.user_id);
        if (Math.abs(this.gridEngine.getPosition(data.user_id).x - data.x) + Math.abs(this.gridEngine.getPosition(data.user_id).y - data.y) > 0) {
          this.gridEngine.setPosition(data.user_id, { x: data.x, y: data.y });
        }
      }
    }
  }

  private removeRemotePlayer(id: string) {
    const p = this.otherPlayers.get(id);
    if (p) {
      if (this.gridEngine.hasCharacter(id)) this.gridEngine.removeCharacter(id);
      p.sprite.destroy(); p.text.destroy(); this.otherPlayers.delete(id);
    }
  }
}
