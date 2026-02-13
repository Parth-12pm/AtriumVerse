// TypeScript interfaces for character configuration
export interface AnimationSheet {
  readonly key: string;
  readonly spritePath: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly gridColumns?: number;
  readonly gridRows?: number;
}

export interface AnimationConfig {
  readonly animationKey: string;
  readonly sheetKey: string;
  readonly frames: readonly number[];
  readonly frameRate: number;
  readonly repeat: number;
}

export interface CharacterAnimationSet {
  readonly id: string;
  readonly name: string;
  readonly sheets: readonly AnimationSheet[];
  readonly animations: readonly AnimationConfig[];
  readonly defaultAnimation?: string;
}

export const CHARACTERS = {
  bob: {
    id: "bob",
    name: "Bob",
    sheets: [
      {
        key: "bob_idle",
        spritePath: "/phaser_assets/characters/bob/Bob_idle_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "bob_run",
        spritePath: "/phaser_assets/characters/bob/Bob_run_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "bob_sit",
        spritePath: "/phaser_assets/characters/bob/Bob_sit3_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
    ],
    animations: [
      {
        animationKey: "idle-up",
        sheetKey: "bob_idle",
        frames: [1],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-down",
        sheetKey: "bob_idle",
        frames: [3],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-left",
        sheetKey: "bob_idle",
        frames: [2],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-right",
        sheetKey: "bob_idle",
        frames: [0],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "run-up",
        sheetKey: "bob_run",
        frames: [7, 8, 9, 10, 11, 12],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-down",
        sheetKey: "bob_run",
        frames: [19, 20, 21, 22, 23, 24],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-left",
        sheetKey: "bob_run",
        frames: [13, 14, 15, 16, 17, 18],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "run-right",
        sheetKey: "bob_run",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-left",
        sheetKey: "bob_sit",
        frames: [6, 7, 8, 9, 10, 11],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-right",
        sheetKey: "bob_sit",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
    ],
  },
  alex: {
    id: "alex",
    name: "Alex",
    sheets: [
      {
        key: "alex_idle",
        spritePath: "/phaser_assets/characters/alex/Alex_idle_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "alex_run",
        spritePath: "/phaser_assets/characters/alex/Alex_run_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "alex_sit",
        spritePath: "/phaser_assets/characters/alex/Alex_sit3_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
    ],
    animations: [
      {
        animationKey: "idle-up",
        sheetKey: "alex_idle",
        frames: [1],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-down",
        sheetKey: "alex_idle",
        frames: [3],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-left",
        sheetKey: "alex_idle",
        frames: [2],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-right",
        sheetKey: "alex_idle",
        frames: [0],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "run-up",
        sheetKey: "alex_run",
        frames: [7, 8, 9, 10, 11, 12],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-down",
        sheetKey: "alex_run",
        frames: [19, 20, 21, 22, 23, 24],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-left",
        sheetKey: "alex_run",
        frames: [13, 14, 15, 16, 17, 18],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "run-right",
        sheetKey: "alex_run",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-left",
        sheetKey: "alex_sit",
        frames: [6, 7, 8, 9, 10, 11],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-right",
        sheetKey: "alex_sit",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
    ],
  },
  adam: {
    id: "adam",
    name: "Adam",
    sheets: [
      {
        key: "adam_idle",
        spritePath: "/phaser_assets/characters/adam/Adam_idle_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "adam_run",
        spritePath: "/phaser_assets/characters/adam/Adam_run_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "adam_sit",
        spritePath: "/phaser_assets/characters/adam/Adam_sit3_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
    ],
    animations: [
      {
        animationKey: "idle-up",
        sheetKey: "adam_idle",
        frames: [1],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-down",
        sheetKey: "adam_idle",
        frames: [3],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-left",
        sheetKey: "adam_idle",
        frames: [2],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-right",
        sheetKey: "adam_idle",
        frames: [0],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "run-up",
        sheetKey: "adam_run",
        frames: [7, 8, 9, 10, 11, 12],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-down",
        sheetKey: "adam_run",
        frames: [19, 20, 21, 22, 23, 24],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-left",
        sheetKey: "adam_run",
        frames: [13, 14, 15, 16, 17, 18],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "run-right",
        sheetKey: "adam_run",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-left",
        sheetKey: "adam_sit",
        frames: [6, 7, 8, 9, 10, 11],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-right",
        sheetKey: "adam_sit",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
    ],
  },
  amelia: {
    id: "amelia",
    name: "Amelia",
    sheets: [
      {
        key: "amelia_idle",
        spritePath: "/phaser_assets/characters/amelia/Amelia_idle_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "amelia_run",
        spritePath: "/phaser_assets/characters/amelia/Amelia_run_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
      {
        key: "amelia_sit",
        spritePath: "/phaser_assets/characters/amelia/Amelia_sit3_16x16.png",
        frameWidth: 16,
        frameHeight: 32,
      },
    ],
    animations: [
      {
        animationKey: "idle-up",
        sheetKey: "amelia_idle",
        frames: [1],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-down",
        sheetKey: "amelia_idle",
        frames: [3],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-left",
        sheetKey: "amelia_idle",
        frames: [2],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "idle-right",
        sheetKey: "amelia_idle",
        frames: [0],
        frameRate: 1,
        repeat: 0,
      },
      {
        animationKey: "run-up",
        sheetKey: "amelia_run",
        frames: [7, 8, 9, 10, 11, 12],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-down",
        sheetKey: "amelia_run",
        frames: [19, 20, 21, 22, 23, 24],
        frameRate: 8,
        repeat: 0,
      },
      {
        animationKey: "run-left",
        sheetKey: "amelia_run",
        frames: [13, 14, 15, 16, 17, 18],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "run-right",
        sheetKey: "amelia_run",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-left",
        sheetKey: "amelia_sit",
        frames: [6, 7, 8, 9, 10, 11],
        frameRate: 8,
        repeat: -1,
      },
      {
        animationKey: "sit-right",
        sheetKey: "amelia_sit",
        frames: [0, 1, 2, 3, 4, 5],
        frameRate: 8,
        repeat: -1,
      },
    ],
  },
} as const;

/**
 * Get all characters as an array (for mapping in UI)
 */
export function getAllCharacters(): CharacterAnimationSet[] {
  return Object.values(CHARACTERS);
}

/**
 * Get character by ID
 */
export function getCharacterById(
  id: string,
): CharacterAnimationSet | undefined {
  return CHARACTERS[id as keyof typeof CHARACTERS];
}

/**
 * Get the first sprite sheet path for preview in character selector
 */
export function getCharacterPreview(char: CharacterAnimationSet): string {
  return char.sheets[0]?.spritePath || "";
}
