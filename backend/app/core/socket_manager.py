import asyncio
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

    
    async def broadcast(self, message: dict, server_id: str, sender: WebSocket):

        if server_id in self.active_connections:
            # Build list of coroutines — one per target connection
            tasks = [
                connection.send_json(message)
                for connection in self.active_connections[server_id]
                if connection != sender
            ]
            # Fire all sends concurrently — total time = slowest single send, not sum
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
                # return_exceptions=True: if one client socket is dead,
                # it does NOT crash the broadcast for everyone else.



manager = ConnectionManger()