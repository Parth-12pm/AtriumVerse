from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.socket_manager import manager
from app.core import redis_client  # Import module, not variable

router = APIRouter()

@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    print(f"✅ Connecting: Room={room_id}, User={user_id}")
    
    # Check if Redis is available
    if redis_client.r is None:
        print("❌ CRITICAL: Redis not initialized! Cannot accept WebSocket connections.")
        await websocket.close(code=1011, reason="Server not ready - Redis unavailable")
        return
    
    try:
        await manager.connect(websocket, room_id, user_id)

        await redis_client.r.sadd(f"room:{room_id}:users", user_id)

        online_users = await redis_client.r.smembers(f"room:{room_id}:users")
        
        # Send initial user_list to the newly connected client
        await websocket.send_json({
            "type": "user_list",
            "users": list(online_users)
        })
        
        print(f"📨 Sent user_list to {user_id}: {list(online_users)}")
        
        # Broadcast to OTHER clients that a new user joined
        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id
        }, room_id, websocket)  # websocket = sender (excluded from broadcast)

        while True:
            try:
                data = await websocket.receive_json()
                print(f"📥 Received from {user_id}: {data}")

                if data.get("type") == "player_move":
                    # Store position AND username in Redis
                    await redis_client.r.hset(f"user:{user_id}", mapping={
                        "x": str(data["x"]),
                        "y": str(data["y"]),
                        "room_id": room_id,
                        "username": data.get("username", "Player")
                    })
                    
                    # Broadcast with username included
                    await manager.broadcast({
                        "type": "player_move",
                        "user_id": user_id,
                        "x": data["x"],
                        "y": data["y"],
                        "username": data.get("username", "Player")
                    }, room_id, websocket)

                if data.get("type") == "request_users":
                    users = await manager.get_room_users(room_id)
                    await websocket.send_json({"type":"user_list","users":users})
                
            except Exception as e:
                print(f"❌ Error in receive loop for {user_id}: {e}")
                raise  # Re-raise to trigger disconnect cleanup

    except WebSocketDisconnect:
        print(f"👋 User {user_id} disconnected from room {room_id}")
    except Exception as e:
        print(f"❌ Unexpected error for {user_id}: {e}")
    finally:
        # Cleanup (runs whether normal disconnect or error)
        await manager.disconnect(websocket, room_id)
        
        # Safe Redis cleanup (check if r exists)
        if redis_client.r is not None:
            await redis_client.r.srem(f"room:{room_id}:users", user_id)
            await redis_client.r.delete(f"user:{user_id}")
        
        await manager.broadcast({"type": "user_left", "user_id": user_id}, room_id, websocket)
        print(f"🧹 Cleanup complete for {user_id}")

