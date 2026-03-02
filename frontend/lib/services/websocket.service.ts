import EventBus from "@/game/EventBus";

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private serverId: string = "";
  private token: string = "";
  private apiUrl: string = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  public connect(serverId: string, token: string) {
    // Prevent duplicate connections
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.serverId = serverId;
    this.token = token;

    const wsUrl = this.apiUrl.replace(/^http/, "ws");
    const baseUrl = wsUrl.endsWith("/") ? wsUrl.slice(0, -1) : wsUrl;
    
    this.ws = new WebSocket(`${baseUrl}/ws/${this.serverId}?token=${this.token}`);

    this.ws.onopen = () => {
      console.log("🔌 Central WebSocket Connected");
      this.reconnectAttempts = 0;
      EventBus.emit("ws:connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // Broadcast the raw message to the entire application
        EventBus.emit("ws:message", data);
      } catch (error) {
        console.error("[WebSocket] Parse error:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("❌ Central WebSocket Error:", error);
      EventBus.emit("ws:error", error);
    };

    this.ws.onclose = () => {
      console.log("🔌 Central WebSocket Disconnected");
      this.ws = null;
      EventBus.emit("ws:disconnected");
      this.attemptReconnect();
    };
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("⚠️ Cannot send message, WebSocket is not open", data);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max WebSocket reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts} in ${delay}ms...`);

    setTimeout(() => {
      this.connect(this.serverId, this.token);
    }, delay);
  }

  public disconnect() {
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
      console.log("🔌 Central WebSocket manually closed");
    }
  }
}

export const wsService = new WebSocketService();