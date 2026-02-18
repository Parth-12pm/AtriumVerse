from fastapi import WebSocket
from typing import Dict, List

class ConnectionManager:
    def __init__(self):
        # server_id -> list of websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, server_id: str):
        # The crucial step to establish the connection
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = []
        self.active_connections[server_id].append(websocket)
        print(f"WS-RESTORE: Client joined server {server_id}")

    async def disconnect(self, websocket: WebSocket, server_id: str):
        if server_id in self.active_connections:
            if websocket in self.active_connections[server_id]:
                self.active_connections[server_id].remove(websocket)
            if not self.active_connections[server_id]:
                del self.active_connections[server_id]
        print(f"WS-RESTORE: Client left server {server_id}")

    async def broadcast(self, message: dict, server_id: str, sender: WebSocket = None):
        """Pure relay to all clients in the server room."""
        if server_id in self.active_connections:
            for connection in self.active_connections[server_id]:
                if connection != sender:
                    try:
                        await connection.send_json(message)
                    except Exception:
                        pass
    
    async def get_room_users(self, server_id: str):
        # Minimal placeholder to satisfy ws.py requirements
        # In a real scenario, this would interface with Redis or a user registry
        return []

manager = ConnectionManager()