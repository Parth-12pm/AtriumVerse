/**
 * Shared game constants — single source of truth used by both
 * MainScene.ts (Phaser) and GameWrapper.tsx (React overlay).
 */

/** Tile size in pixels, matching your Tiled map configuration. */
export const TILE_PX = 32;

/** Maximum hearing radius in tiles — beyond this, audio is silent and unsubscribed. */
export const MAX_HEAR_RADIUS = 3;

/** Speaker / JukeBox entity position (tile coordinates). */
export const SPEAKER_TILE_X = 20;
export const SPEAKER_TILE_Y = 15;
