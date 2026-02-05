import asyncio
from fastapi import WebSocket
from typing import Dict, List
from app.core.redis_client import r 

class ConnectionManger: 
    def __init__(self):
        # Changed to Dict[server_id, Dict[user_id, WebSocket]] for direct addressing
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, websocket: WebSocket, server_id: str, user_id: str):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = {}
        # Store by user_id
        self.active_connections[server_id][user_id] = websocket

    async def disconnect(self, websocket: WebSocket, server_id: str, user_id: str):
        if server_id in self.active_connections:
            if user_id in self.active_connections[server_id]:
                del self.active_connections[server_id][user_id]
            
            if len(self.active_connections[server_id]) == 0:
                del self.active_connections[server_id]

    async def send_personal_message(self, message: dict, server_id: str, target_user_id: str):
        if server_id in self.active_connections:
            target_ws = self.active_connections[server_id].get(target_user_id)
            if target_ws:
                try:
                    await target_ws.send_json(message)
                except Exception:
                     # Clean up dead connection potentially?
                     # Let the read loop handle disconnects usually.
                     pass

    async def broadcast(self, message: dict, server_id: str, sender: WebSocket):
        if server_id not in self.active_connections:
            return

        async def safe_send(ws: WebSocket):
            try:
                # 500ms timeout prevents slow clients from blocking
                await asyncio.wait_for(ws.send_json(message), timeout=0.5)
            except asyncio.TimeoutError:
                pass
            except Exception:
                # We can't easily disconnect here without user_id if we don't have it
                # But typically the read loop handles the close.
                pass

        # Fire all sends concurrently
        for target_ws in self.active_connections[server_id].values():
            if target_ws != sender:
                asyncio.create_task(safe_send(target_ws))

manager = ConnectionManger()