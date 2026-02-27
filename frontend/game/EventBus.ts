import EventEmitter from "eventemitter3";

const EventBus = new EventEmitter();

export default EventBus;

export enum GameEvents {
  // World Events
  PLAYER_POSITION = "player-position",
  ROOM_ENTER = "room-enter",
  ZONE_ENTER = "zone-enter",
  ZONE_EXIT = "zone-exit",

  // Multiplayer Events
  PLAYER_JOINED = "player-joined",
  PLAYER_LEFT = "player-left",
  PLAYER_LIST_UPDATE = "player-list-update",
  REMOTE_PLAYER_MOVED = "remote-player-moved",
  REQUEST_USER_LIST = "request-user-list",

  // Chat Events
  CHAT_MESSAGE = "chat-message",
  SEND_CHAT_MESSAGE = "send-chat-message",

  // LiveKit Audio Events
  PROXIMITY_AUDIO_CONNECTED = "proximity:audio:connected",
  PROXIMITY_AUDIO_DISCONNECTED = "proximity:audio:disconnected",

  // LiveKit Video Events
  VIDEO_ROOM_JOINED = "video:room:joined",
  VIDEO_ROOM_LEFT = "video:room:left",
  
}

export interface PlayerPositionEvent {
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  pixelX?: number;
  pixelY?: number;
}

export interface ZoneEvent {
  zoneId: string;
  zoneName: string;
  zoneType: "PUBLIC" | "PRIVATE";
}
