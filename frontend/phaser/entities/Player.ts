import * as Phaser from 'phaser';

export interface PlayerConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  username: string;
  userId: string;
  isLocal: boolean; // true for current user, false for other players
}

export class Player {
  public sprite: Phaser.GameObjects.Arc;
  public usernameText: Phaser.GameObjects.Text;
  public proximityCircle: Phaser.GameObjects.Arc;
  public body: Phaser.Physics.Arcade.Body;
  
  private scene: Phaser.Scene;
  private username: string;
  private userId: string;
  private isLocal: boolean;
  private speed: number = 200;
  
  public currentDirection: string = 'down';

  constructor(config: PlayerConfig) {
    this.scene = config.scene;
    this.username = config.username;
    this.userId = config.userId;
    this.isLocal = config.isLocal;

    // Create player sprite (colored circle)
    const color = config.isLocal ? 0x4169e1 : 0x32cd32; // Blue for local, green for others
    this.sprite = this.scene.add.circle(config.x, config.y, 20, color);
    
    // Enable physics
    this.scene.physics.add.existing(this.sprite);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);

    // CRITICAL FIX: Reduce collision radius even further for tighter navigation
    // Visual radius is 20px, but collision is 12px for very smooth movement
    this.body.setCircle(12);  // Ultra-tight collision circle
    this.body.setOffset(8, 8); // Center the smaller collision body

    // Create username label above player
    this.usernameText = this.scene.add.text(config.x, config.y - 35, this.username, {
      fontSize: '12px',
      color: '#000000',
      backgroundColor: '#ffffff',
      padding: { x: 4, y: 2 },
    });
    this.usernameText.setOrigin(0.5, 0.5);

    // Create proximity circle (only visible for local player)
    this.proximityCircle = this.scene.add.circle(config.x, config.y, 150, 0x00ff00, 0.1);
    this.proximityCircle.setStrokeStyle(2, 0x00ff00, 0.5);
    this.proximityCircle.setVisible(config.isLocal);
  }

  update(cursors?: Phaser.Types.Input.Keyboard.CursorKeys): void {
    if (!this.isLocal || !cursors) return;

    // Reset velocity
    this.body.setVelocity(0);

    let moved = false;

    // WASD + Arrow keys movement
    if (cursors.left.isDown) {
      this.body.setVelocityX(-this.speed);
      this.currentDirection = 'left';
      moved = true;
    } else if (cursors.right.isDown) {
      this.body.setVelocityX(this.speed);
      this.currentDirection = 'right';
      moved = true;
    }

    if (cursors.up.isDown) {
      this.body.setVelocityY(-this.speed);
      this.currentDirection = 'up';
      moved = true;
    } else if (cursors.down.isDown) {
      this.body.setVelocityY(this.speed);
      this.currentDirection = 'down';
      moved = true;
    }

    // Debug log (remove after testing)
    if (moved && Math.random() < 0.01) {
      console.log('[Player] Moving:', this.currentDirection, 'Pos:', this.sprite.x, this.sprite.y);
    }

    // Normalize diagonal movement
    if (this.body.velocity.x !== 0 && this.body.velocity.y !== 0) {
      this.body.velocity.normalize().scale(this.speed);
    }

    // Update position of username and proximity circle
    this.updateUI();
  }

  // Update position from WebSocket (for remote players)
  updatePosition(x: number, y: number, direction: string): void {
    if (this.isLocal) return;

    // Smooth interpolation
    this.scene.tweens.add({
      targets: this.sprite,
      x,
      y,
      duration: 100,
      ease: 'Linear',
    });

    this.currentDirection = direction;
    this.updateUI();
  }

  private updateUI(): void {
    this.usernameText.setPosition(this.sprite.x, this.sprite.y - 35);
    this.proximityCircle.setPosition(this.sprite.x, this.sprite.y);
  }

  setProximityRange(range: number): void {
    this.proximityCircle.setRadius(range);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  getUserId(): string {
    return this.userId;
  }

  destroy(): void {
    this.sprite.destroy();
    this.usernameText.destroy();
    this.proximityCircle.destroy();
  }
}
