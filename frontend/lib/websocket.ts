// WebSocket manager for room communication
// Currently commented - will be activated when backend is ready

export interface WebSocketMessage {
  type: 'move' | 'join_room' | 'leave_room' | 'user_joined' | 'movement' | 'user_left';
  user_id?: string;
  username?: string;
  x?: number;
  y?: number;
  direction?: string;
  room_id?: string;
}

export class RoomWebSocket {
  private ws: WebSocket | null = null;
  private roomId: string;
  private token: string;
  private userId: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  
  public onMessage?: (message: WebSocketMessage) => void;
  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onError?: (error: Event) => void;

  constructor(roomId: string,userId:string, token: string,) {
    this.roomId = roomId;
    this.userId = userId
    this.token = token;
  }

  connect(): void {
    const wsUrl = `ws://localhost:8000/ws/connect?room_id=${this.roomId}&user_id=${this.userId}&token=${this.token}`;
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.onConnect?.();
        
        // Send join room message
        this.send({
          type: 'join_room',
          room_id: this.roomId,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError?.(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.onDisconnect?.();
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
          setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Throttle position updates to prevent flooding the server
export function createThrottledPositionUpdate(
  ws: RoomWebSocket,
  intervalMs: number = 100 // 10 updates per second max
): (x: number, y: number, direction: string) => void {
  let lastUpdate = 0;
  let lastPosition = { x: 0, y: 0, direction: '' };

  return (x: number, y: number, direction: string) => {
    const now = Date.now();
    
    // Check if position actually changed
    const positionChanged = 
      lastPosition.x !== x || 
      lastPosition.y !== y || 
      lastPosition.direction !== direction;

    if (positionChanged && now - lastUpdate >= intervalMs) {
      ws.send({
        type: 'move',
        x,
        y,
        direction,
      });
      
      lastUpdate = now;
      lastPosition = { x, y, direction };
    }
  };
}
