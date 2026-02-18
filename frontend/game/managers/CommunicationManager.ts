/**
 * CommunicationManager.ts
 *
 * Handles all communication logic:
 * - WebSocket chat messages (permanent channels, persistent DMs, temporary zone chat)
 * - REAL-TIME PLAYER MOVEMENT & SYNC
 * - Zone-based chat routing
 *
 * Centralized relay for both Phaser (MainScene) and React (UI components).
 */

import EventBus, { GameEvents } from "@/game/EventBus";
import { apiClient } from "@/lib/api";

export class CommunicationManager {
  private ws: WebSocket | null = null;
  private serverId: string;
  private token: string;
  private userId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverId: string, token: string) {
    this.serverId = serverId;
    this.token = token;
    this.userId = localStorage.getItem("user_id") || "unknown";

    // Listen to zone events from MainScene
    EventBus.on(GameEvents.ZONE_ENTER, this.handleZoneEnter.bind(this));
    EventBus.on(GameEvents.ZONE_EXIT, this.handleZoneExit.bind(this));

    // Listen to local movement from MainScene to relay to WS
    EventBus.on("hero:move", this.sendMovement.bind(this));
  }

  public async connect(): Promise<void> {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/${this.serverId}?token=${this.token}`;
    console.log(`[COMM-MANAGER] Connecting to: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("✅ CommunicationManager: WebSocket connected");
      this.reconnectAttempts = 0;
      EventBus.emit("ws:connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (err) {
        console.error("WS Parse Error:", err);
      }
    };

    this.ws.onclose = () => {
      console.log("🔌 CommunicationManager: WebSocket disconnected");
      EventBus.emit("ws:disconnected");
      this.attemptReconnect();
    };
  }

  private handleWebSocketMessage(data: any): void {
    // Relay everything from WS to the EventBus for MainScene and UI
    switch (data.type) {
      case "user_list":
        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, data.users);
        break;
      case "user_joined":
        EventBus.emit(GameEvents.PLAYER_JOINED, data);
        break;
      case "player_move":
        // data contains user_id, x, y, direction, moving
        EventBus.emit(GameEvents.REMOTE_PLAYER_MOVED, {
          userId: data.user_id,
          x: data.x,
          y: data.y,
          direction: data.direction,
          moving: data.moving
        });
        break;
      case "user_left":
        EventBus.emit(GameEvents.PLAYER_LEFT, { user_id: data.user_id });
        break;
      case "chat_message":
        EventBus.emit(GameEvents.CHAT_MESSAGE, data);
        break;
      default:
        // Generic relay
        EventBus.emit("ws:message", data);
    }
  }

  private handleZoneEnter(data: any) {
    this.send({ type: "zone_enter", zone_id: data.zoneId });
  }

  private handleZoneExit(data: any) {
    this.send({ type: "zone_exit", zone_id: data.zoneId });
  }

  private sendMovement(data: any) {
    this.send({
      type: "player_move",
      user_id: this.userId,
      x: data.x,
      y: data.y,
      direction: data.direction,
      moving: data.moving
    });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    EventBus.off(GameEvents.ZONE_ENTER, this.handleZoneEnter.bind(this));
    EventBus.off(GameEvents.ZONE_EXIT, this.handleZoneExit.bind(this));
    EventBus.off("hero:move", this.sendMovement.bind(this));
  }
}

let communicationManagerInstance: CommunicationManager | null = null;

export function initCommunicationManager(serverId: string, token: string): CommunicationManager {
  if (communicationManagerInstance) communicationManagerInstance.disconnect();
  communicationManagerInstance = new CommunicationManager(serverId, token);
  communicationManagerInstance.connect();
  return communicationManagerInstance;
}

export function getCommunicationManager(): CommunicationManager | null {
  return communicationManagerInstance;
}
