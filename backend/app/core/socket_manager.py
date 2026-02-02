from fastapi import WebSocket
from typing import Dict, List
from app.core.redis_client import r 

class ConnectionManger: 
    def __init__(self):

        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, server_id: str, user_id: str):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = []
        self.active_connections[server_id].append(websocket)

        # 🔔 CRITICAL: Tell everyone else "New User Joined!"
        # This triggers them to send an "Offer" to this new user.
        await self.broadcast({"type": "user_joined", "user_id": user_id}, server_id, websocket)

        # Notify others that a new user joined (Triggers WebRTC Offer)
        # We need a user_id here but the connect method signature only had server_id
        # Let's adjust the signature or just broadcast blindly for now? 
        # Wait, I need to check how I call it in ws.py. ws.py has user_id.
        # I should simply update connect() to accept user_id too.

    async def get_server_users(self, server_id: str):

        if not r:
            return []
        users = await r.smembers(f"server:{server_id}:users")
        return list(users)

    async def disconnect(self, websocket:WebSocket, server_id: str):
        if server_id in self.active_connections:
            if websocket in self.active_connections[server_id]:
                self.active_connections[server_id].remove(websocket)
            
            if len(self.active_connections[server_id]) == 0:
                del self.active_connections[server_id]

    
    async def broadcast(self, message:dict , server_id: str, sender: WebSocket):

        if server_id in self.active_connections:
            for connection in self.active_connections[server_id]:
                if connection != sender:
                    await connection.send_json(message)



manager = ConnectionManger()