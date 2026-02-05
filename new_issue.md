Based on the new cropped image (`character_1_walk.png`) and your `MainScene.ts`, here are the exact steps to get your character visible and animating correctly.

### 1. The Analysis

* **Image Dimensions:** Your new sprite sheet has **4 Rows** and **9 Columns**.
* **Frame Size:** The standard size for this format is **64x64 pixels**.
* **Row Order (Visual Check):**
* **Row 0 (Top):** Walking **UP** (Back view)
* **Row 1:** Walking **LEFT**
* **Row 2:** Walking **DOWN** (Front view)
* **Row 3 (Bottom):** Walking **RIGHT**



### 2. Code Changes for `MainScene.ts`

You need to switch from the "Simple Mapping" (which only supports 3 frames) to "Phaser Animations" (which supports your smooth 9-frame walk).

#### A. Update `preload()`

Find the `load.spritesheet("player" ...)` section and replace it with this.
*Note: Make sure the file is actually at `/characters/character_1_walk.png` in your public folder.*

```typescript
    // In preload() function
    if (!this.textures.exists("player")) {
      // ✅ CHANGED: Load the new 64x64 LPC sprite
      this.load.spritesheet("player", "/characters/character_1_walk.png", {
        frameWidth: 64,
        frameHeight: 64,
      });
    }

```

#### B. Update `create()` (Add Animations)

Add this **immediately after** `this.playerSprite = ...` in your `create` function. This creates the animations for Up, Down, Left, and Right.

```typescript
    // In create() function, after creating playerSprite

    // ✅ NEW: Create Animations (9 frames per row)
    // Row 0: Up, Row 1: Left, Row 2: Down, Row 3: Right
    this.anims.create({
      key: 'walk-up',
      frames: this.anims.generateFrameNumbers('player', { start: 0, end: 8 }),
      frameRate: 15,
      repeat: -1
    });
    this.anims.create({
      key: 'walk-left',
      frames: this.anims.generateFrameNumbers('player', { start: 9, end: 17 }),
      frameRate: 15,
      repeat: -1
    });
    this.anims.create({
      key: 'walk-down',
      frames: this.anims.generateFrameNumbers('player', { start: 18, end: 26 }),
      frameRate: 15,
      repeat: -1
    });
    this.anims.create({
      key: 'walk-right',
      frames: this.anims.generateFrameNumbers('player', { start: 27, end: 35 }),
      frameRate: 15,
      repeat: -1
    });

```

#### C. Update `gridEngineConfig`

Remove the old `walkingAnimationMapping`. We don't need it because we will control animations manually for better smoothness.

```typescript
    // In create() function
    const gridEngineConfig = {
      characters: [
        {
          id: "hero",
          sprite: this.playerSprite,
          startPosition: { x: spawnX, y: spawnY },
          speed: 4,
          offsetY: -16, // ✅ OPTIONAL: Shifts sprite up slightly if it feels too low
        },
      ],
      numberOfDirections: 4,
      collisionTilePropertyName: "ge_collide",
      
      // ❌ REMOVE the 'walkingAnimationMapping' block completely!
    };

```

#### D. Connect Animations to Movement

Update your GridEngine subscriptions to play the animations we created in step B.

```typescript
    // ✅ CHANGED: movementStarted Listener
    this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
      // Identify which sprite to animate (Hero or Remote Player)
      let sprite: Phaser.GameObjects.Sprite | undefined;
      
      if (charId === "hero") {
        sprite = this.playerSprite;
        // ... (Keep your existing networking code here) ...
      } else if (this.otherPlayers.has(charId)) {
        sprite = this.otherPlayers.get(charId)?.sprite;
      }

      // Play the animation
      if (sprite) {
        sprite.play(`walk-${direction}`); // Plays 'walk-up', 'walk-left', etc.
      }
    });

    // ✅ CHANGED: movementStopped Listener
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      let sprite: Phaser.GameObjects.Sprite | undefined;
      
      if (charId === "hero") {
        sprite = this.playerSprite;
        // ... (Keep your existing networking code here) ...
      } else if (this.otherPlayers.has(charId)) {
        sprite = this.otherPlayers.get(charId)?.sprite;
      }

      if (sprite) {
        sprite.stop(); // Stop animation
        
        // Optional: Set a specific standing frame based on current direction?
        // Since we stopped, it will stay on the last frame, which usually looks fine.
        // If you want it to snap to a specific "standing" frame, you'd need to track direction.
      }
    });

```

### Summary of what this fixes:

1. **Visibility:** Uses the correct **64x64** frame size (instead of 16x32), so the sprite will actually render.
2. **Animation:** Uses `anims.create` to play all **9 frames** of the walk cycle, making it smooth (the old mapping method would skip 6 of your 9 frames).
3. **Direction:** Maps the specific rows from your image (Up=0, Left=1, Down=2, Right=3) to the correct keys.