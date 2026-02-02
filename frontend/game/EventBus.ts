import EventEmitter from "eventemitter3";

/**
 * Event Bus Singleton
 * SSR-Safe Event Bus for React ↔ Phaser communication
 * Uses eventemitter3 instead of Phaser.Events to avoid "window undefined" during SSR
 *
 * Usage:
 *   Phaser: EventBus.emit('proximity-change', { playerId: '123', distance: 3 })
 *   React: useEffect(() => { EventBus.on('proximity-change', handler) })
 */
const EventBus = new EventEmitter();

export default EventBus;

/**
 * Typed Game Events
 */
export enum GameEvents {
  // Phaser → React (Game State Updates)
  PLAYER_POSITION = "player-position",
  PROXIMITY_CHANGE = "proximity-change",
  ROOM_ENTER = "room-enter",
  PLAYER_JOINED = "player-joined",
  PLAYER_LEFT = "player-left",
  PLAYER_LIST_UPDATE = "player-list-update",

  // React → Phaser (UI Commands)
  UPDATE_AVATAR = "update-avatar",
  TOGGLE_NOCLIP = "toggle-noclip",
  SPAWN_REMOTE_PLAYER = "spawn-remote-player",
  REMOVE_REMOTE_PLAYER = "remove-remote-player",
}

/**
 * Event Payload Types
 */
export interface PlayerPositionEvent {
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  pixelX?: number;
  pixelY?: number;
}

export interface ProximityChangeEvent {
  playerId: string;
  distance: number;
  inRange: boolean;
}

export interface RoomEnterEvent {
  roomId: string;
  spawnX: number;
  spawnY: number;
}

export interface UpdateAvatarEvent {
  color?: string;
  sprite?: string;
}
