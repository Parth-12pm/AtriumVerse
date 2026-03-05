/**
 * Central registry of all available maps.
 * Each map entry maps a human-readable id to its file path and UI metadata.
 *
 * Adding a new map:
 *  1. Drop the .json in /public/phaser_assets/maps/
 *  2. Add a thumbnail in /public/phaser_assets/map_thumbnails/
 *  3. Add an entry here — the engine will pick it up automatically.
 */

export interface MapConfig {
  /** Short id used as a DB key and in `map_path` (e.g. "final_map") */
  id: string;
  /** Display name shown in the selector */
  name: string;
  /** One-line description */
  description: string;
  /**
   * Relative path under /public sent to the backend as `map_path` when
   * creating a server.  Must match what `map_parser.py` can resolve.
   */
  mapPath: string;
  /** /public URL for the Phaser tilemapTiledJSON loader */
  phaserUrl: string;
  /** /public URL for the thumbnail shown in the selector */
  thumbnail: string;
}

export const ALL_MAPS: MapConfig[] = [
  {
    id: "final_map",
    name: "Office Space",
    description: "Classic co-working office with meeting rooms & lounge.",
    mapPath: "phaser_assets/maps/final_map.json",
    phaserUrl: "/phaser_assets/maps/final_map.json",
    thumbnail: "/phaser_assets/map_thumbnails/final_map.png",
  },
  {
    id: "map1",
    name: "Modern Workspace",
    description: "Open-plan workspace with brainstorm & chill zones.",
    mapPath: "phaser_assets/maps/map1.json",
    phaserUrl: "/phaser_assets/maps/map1.json",
    thumbnail: "/phaser_assets/map_thumbnails/map1.png",
  },
];

/** Resolve a MapConfig from a backend `map_path` string (e.g. "phaser_assets/maps/map1.json"). */
export function getMapByPath(mapPath: string): MapConfig {
  return (
    ALL_MAPS.find((m) => m.mapPath === mapPath) ?? ALL_MAPS[0] // safe fallback
  );
}

/** Resolve a MapConfig from a short id (e.g. "map1"). */
export function getMapById(id: string): MapConfig {
  return ALL_MAPS.find((m) => m.id === id) ?? ALL_MAPS[0];
}

/** Default map used when a server has no map_config. */
export const DEFAULT_MAP = ALL_MAPS[0];
