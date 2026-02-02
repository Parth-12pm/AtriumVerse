from fastapi import APIRouter, WebSocket, WebSocketDisconnect , Depends ,Query , status
from app.core.socket_manager import manager
from app.core import redis_client  
from app.core.spatial_manager import spatial_manager
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
import time
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter()


# Helper to validate token manually (since Depends doesn't work well for WS query params)
async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
        return username # In a real app, query DB here to get full User object if needed
    except JWTError:
        return None


@router.websocket("/{server_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    server_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
    ):

    # 1. Authenticate via Token
    username = await get_user_from_token(token)
    if not username:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user_id = username

    # 2. Connect Manager
    await manager.connect(websocket, server_id, user_id)

    # 3. Load Zones (Cache Warmup)
    await spatial_manager.load_zones(server_id, db) 

    # 4. Redis Initial Setup
    if redis_client.r:
        await redis_client.r.sadd(f"server:{server_id}:users", user_id)
        # Send initial user list
        online_users = await redis_client.r.smembers(f"server:{server_id}:users")
        await websocket.send_json({"type": "user_list", "users": list(online_users)})
        # Notify others
        await manager.broadcast({"type": "user_joined", "user_id": user_id}, server_id, websocket)

    last_broadcast_time = 0
    
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "player_move":
                current_time = time.time()
                
                # THROTTLE: Only process movement every 50ms (20fps)
                if current_time - last_broadcast_time > 0.02:
                    
                    # A. Save to Redis (Persist State)
                    if redis_client.r:
                        await redis_client.r.hset(f"user:{user_id}", mapping={
                            "x": str(data["x"]),
                            "y": str(data["y"]),
                            "server_id": server_id,
                            "username": data.get("username", "Player")
                        })

                    # B. Spatial Check (Zero Latency)
                    zone = spatial_manager.check_zone(data["x"], data["y"], server_id)
                    
                    # C. Broadcast to others
                    await manager.broadcast({
                        "type": "player_move",
                        "user_id": user_id,
                        "x": data["x"],
                        "y": data["y"],
                        "username": data.get("username", "Player"),
                        "zone": zone["name"] if zone else "Open Space"
                    }, server_id, websocket)
                    
                    last_broadcast_time = current_time

            # Handle other messages (chat, etc) without throttling
            if data.get("type") == "request_users":
                users = await manager.get_server_users(server_id)
                await websocket.send_json({"type":"user_list","users":users})

    except WebSocketDisconnect:
        await manager.disconnect(websocket, server_id)
        
        # Cleanup Redis
        if redis_client.r:
            await redis_client.r.srem(f"server:{server_id}:users", user_id)
            await redis_client.r.delete(f"user:{user_id}")
        
        await manager.broadcast({"type": "user_left", "user_id": user_id}, server_id, websocket)
        print(f"👋 User {user_id} disconnected from server {server_id}")
