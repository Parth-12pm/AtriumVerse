/**
 * CommunicationManager.ts
 *
 * Handles all communication logic:
 * - WebSocket chat messages (permanent channels, persistent DMs, temporary zone chat)
 * - Zone-based chat routing
 * - Future: LiveKit WebRTC integration
 *
 * Separated from MainScene.ts to keep game logic clean.
 */

import EventBus from "@/game/EventBus";
import { apiClient } from "@/lib/api";

interface Message {
  id?: string;
  type: "chat_message" | "dm_received" | "dm_updated" | "dm_deleted";
  sender: string;
  username: string;
  scope: "channel" | "direct" | "zone";
  text: string;
  timestamp: string;
  channel_id?: string;
  zone_id?: string;
  temporary?: boolean;
  receiver_id?: string;
}

interface ZoneInfo {
  id: string;
  name: string;
  members: string[];
}

export class CommunicationManager {
  private ws: WebSocket | null = null;
  private serverId: string;
  private token: string;
  private currentZone: ZoneInfo | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(serverId: string, token: string) {
    this.serverId = serverId;
    this.token = token;

    // Listen to zone events from MainScene
    EventBus.on("zone:entered", this.handleZoneEntered.bind(this));
    EventBus.on("zone:exited", this.handleZoneExited.bind(this));

    // Proximity chat send
    EventBus.on("proximity:send_message", (data: { message: string }) => {
      this.sendProximityChat(data.message);
    });
  }

  /**
   * Connect to WebSocket
   */
  public async connect(): Promise<void> {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/${this.serverId}?token=${this.token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("✅ CommunicationManager: WebSocket connected");
      this.reconnectAttempts = 0;
      EventBus.emit("ws:connected");
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error("❌ CommunicationManager: WebSocket error:", error);
      EventBus.emit("ws:error", error);
    };

    this.ws.onclose = () => {
      console.log("🔌 CommunicationManager: WebSocket disconnected");
      EventBus.emit("ws:disconnected");
      this.attemptReconnect();
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case "chat_message":
        this.handleChatMessage(data);
        break;

      case "proximity_chat":
        // Deliver to ProximityChat component
        EventBus.emit("chat:proximity_message", {
          sender: data.sender,
          username: data.username,
          text: data.text,
          timestamp: data.timestamp,
        });
        break;

      case "dm_received":
        this.handleDMReceived(data);
        break;

      case "dm_updated":
        this.handleDMUpdated(data);
        break;

      case "dm_deleted":
        this.handleDMDeleted(data);
        break;

      case "zone_entered":
        this.handleZoneEnteredConfirmation(data);
        break;

      case "zone_exited":
        this.handleZoneExitedConfirmation(data);
        break;

      default:
        // Pass through other messages to EventBus for MainScene
        EventBus.emit("ws:message", data);
    }
  }

  /**
   * Handle chat messages (channel, zone, or temporary direct)
   */
  private handleChatMessage(data: Message): void {
    if (data.scope === "channel") {
      // Permanent channel message
      EventBus.emit("chat:channel_message", data);
    } else if (data.scope === "zone") {
      // Temporary zone chat
      EventBus.emit("chat:zone_message", data);
    } else if (data.scope === "direct" && data.temporary) {
      // Temporary direct message (non-persistent)
      EventBus.emit("chat:temp_direct_message", data);
    }
  }

  /**
   * Handle persistent DM received
   */
  private handleDMReceived(data: any): void {
    EventBus.emit("dm:received", data.message);
  }

  /**
   * Handle persistent DM updated
   */
  private handleDMUpdated(data: any): void {
    EventBus.emit("dm:updated", data.message);
  }

  /**
   * Handle persistent DM deleted
   */
  private handleDMDeleted(data: any): void {
    EventBus.emit("dm:deleted", { message_id: data.message_id });
  }

  /**
   * Handle zone entered confirmation from server
   */
  private handleZoneEnteredConfirmation(data: any): void {
    this.currentZone = {
      id: data.zone_id,
      name: data.zone_name || "Unknown Zone",
      members: data.members || [],
    };

    EventBus.emit("zone:confirmed_entry", this.currentZone);
  }

  /**
   * Handle zone exited confirmation from server
   */
  private handleZoneExitedConfirmation(data: any): void {
    this.currentZone = null;
    EventBus.emit("zone:confirmed_exit", { zone_id: data.zone_id });
  }

  /**
   * Handle zone entered event from MainScene
   */
  private handleZoneEntered(zoneData: {
    id: string;
    name: string;
    type: string;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot send zone_enter: WebSocket not connected");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "zone_enter",
        zone_id: zoneData.id,
        zone_type: zoneData.type || "PUBLIC",
      }),
    );
  }

  /**
   * Handle zone exited event from MainScene
   */
  private handleZoneExited(zoneData: { id: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "zone_exit",
        zone_id: zoneData.id,
      }),
    );
  }

  /**
   * Send a channel message (permanent, saved to DB)
   */
  public async sendChannelMessage(
    channelId: string,
    content: string,
  ): Promise<void> {
    try {
      // Send via REST API to save in DB
      const response = await apiClient.post(
        `/messages/channels/${channelId}/messages`,
        {
          content,
        },
      );

      // WebSocket real-time broadcast happens automatically via backend
      return response.data;
    } catch (error) {
      console.error("❌ Failed to send channel message:", error);
      throw error;
    }
  }

  /**
   * Send a proximity chat message (radius-filtered on backend)
   */
  public sendProximityChat(message: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[Proximity] WS not connected");
      return;
    }
    this.ws.send(JSON.stringify({ type: "proximity_chat", message }));
  }

  /**
   * Send a zone message (temporary, NOT saved to DB)
   */
  public sendZoneMessage(content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot send zone message: WebSocket not connected");
      return;
    }

    if (!this.currentZone) {
      console.warn("⚠️ Cannot send zone message: Not in a zone");
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: "chat_message",
        scope: "zone",
        message: content,
      }),
    );
  }

  /**
   * Send a persistent DM (saved to DB)
   */
  public async sendDirectMessage(
    receiverId: string,
    content: string,
  ): Promise<any> {
    try {
      // Send via REST API to save in DB
      const response = await apiClient.post("/api/direct-messages/messages", {
        receiver_id: receiverId,
        content,
      });

      // Notify target via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "dm_sent",
            target_id: receiverId,
            message: response.data,
          }),
        );
      }

      return response.data;
    } catch (error) {
      console.error("❌ Failed to send DM:", error);
      throw error;
    }
  }

  /**
   * Edit a persistent DM
   */
  public async editDirectMessage(
    messageId: string,
    content: string,
    receiverId: string,
  ): Promise<any> {
    try {
      const response = await apiClient.patch(
        `/api/direct-messages/messages/${messageId}`,
        {
          content,
        },
      );

      // Notify target via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "dm_edited",
            target_id: receiverId,
            message: response.data,
          }),
        );
      }

      return response.data;
    } catch (error) {
      console.error("❌ Failed to edit DM:", error);
      throw error;
    }
  }

  /**
   * Delete a persistent DM
   */
  public async deleteDirectMessage(
    messageId: string,
    receiverId: string,
  ): Promise<void> {
    try {
      await apiClient.delete(`/api/direct-messages/messages/${messageId}`);

      // Notify target via WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "dm_deleted",
            target_id: receiverId,
            message_id: messageId,
          }),
        );
      }
    } catch (error) {
      console.error("❌ Failed to delete DM:", error);
      throw error;
    }
  }

  /**
   * Get current zone info
   */
  public getCurrentZone(): ZoneInfo | null {
    return this.currentZone;
  }

  /**
   * Check if in a zone
   */
  public isInZone(): boolean {
    return this.currentZone !== null;
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnection attempts reached");
      EventBus.emit("ws:max_reconnect_failed");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(
      `🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`,
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Remove event listeners
    EventBus.off("zone:entered", this.handleZoneEntered.bind(this));
    EventBus.off("zone:exited", this.handleZoneExited.bind(this));
  }
}

// Singleton instance
let communicationManagerInstance: CommunicationManager | null = null;

export function initCommunicationManager(
  serverId: string,
  token: string,
): CommunicationManager {
  if (communicationManagerInstance) {
    communicationManagerInstance.disconnect();
  }

  communicationManagerInstance = new CommunicationManager(serverId, token);
  return communicationManagerInstance;
}

export function getCommunicationManager(): CommunicationManager | null {
  return communicationManagerInstance;
}
