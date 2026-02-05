from fastapi import APIRouter, WebSocket, WebSocketDisconnect , Depends ,Query , status
from app.core.socket_manager import manager
from app.core import redis_client  
from app.core.spatial_manager import spatial_manager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.core.database import get_db
from app.api.deps import get_current_user
import time, asyncio, random ,datetime
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM
import datetime


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

    user_result = await db.execute(select(User).where(User.username == username))
    user_obj = user_result.scalars().first()

    if not user_obj:
        await websocket.close()
        return


    user_uuid = user_obj.id
    user_id = str(user_uuid)

    # 2. Connect Manager
    await manager.connect(websocket, server_id, user_id)

    # 3. Load Zones (Cache Warmup)
    await spatial_manager.load_zones(server_id, db) 

    result = await db.execute(select(Server).where(Server.id == server_id))
    server_obj = result.scalars().first()
    spawn_points = []

    if server_obj and server_obj.map_config:
        spawn_points = server_obj.map_config.get("spawn_points", [])

    member_result = await db.execute(
        select(ServerMember).where(
            ServerMember.server_id == server_id,
            ServerMember.user_id == user_uuid
        )
    )
    member_record = member_result.scalars().first()


# 4. Redis Initial Setup
    if redis_client.r:
        await redis_client.r.sadd(f"server:{server_id}:users", user_id)
        online_users = await redis_client.r.smembers(f"server:{server_id}:users")

        # Pick a random spawn for any user whose Redis entry is empty

        if member_record and member_record.last_position_x is not None:
            default_x = member_record.last_position_x
            default_y = member_record.last_position_y
            print(f"Resuming {username} at {default_x}, {default_y}")
        elif spawn_points:
            chosen = random.choice(spawn_points)
            default_x = chosen["x"] // 32
            default_y = (chosen["y"] // 32) - 1
        else:
            default_x = 15
            default_y = 15

        # Fetch positions for all online users so new joiner sees them correctly
        user_positions = []
        for uid in online_users:
            pos_data = await redis_client.r.hgetall(f"user:{uid}")
            user_positions.append({
                "user_id": uid,
                "x": int(pos_data.get("x", default_x)),
                "y": int(pos_data.get("y", default_y)),
                "username": pos_data.get("username", "Player")
            })

        # Send user_list TO the new joiner — they see everyone else
        await websocket.send_json({"type": "user_list", "users": user_positions})

        # Broadcast user_joined TO everyone else — they see the new joiner.
        # This was removed from socket_manager in the earlier fix but never added back here.
        # Fetch THIS user's position from Redis (exists if rejoining) or use the random spawn.
        my_pos_data = await redis_client.r.hgetall(f"user:{user_id}")
        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id,
            "x": int(my_pos_data.get("x", default_x)) if my_pos_data else default_x,
            "y": int(my_pos_data.get("y", default_y)) if my_pos_data else default_y,
            "username": my_pos_data.get("username", "Player") if my_pos_data else "Player"
        }, server_id, websocket)


    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "player_move":
                current_time = time.time()
                
                    # B. Spatial Check (Zero Latency — no I/O)
                zone = spatial_manager.check_zone(data["x"], data["y"], server_id)

                # C. Broadcast FIRST — does not need Redis at all
                await manager.broadcast({
                    "type": "player_move",
                    "user_id": user_id,
                    "x": data["x"],
                    "y": data["y"],
                    "username": data.get("username", "Player"),
                    "zone": zone["name"] if zone else "Open Space"
                }, server_id, websocket)

                # A. Redis write AFTER broadcast — fire and don't block
                #    This runs concurrently. If it fails, broadcast already went out.
                if redis_client.r:
                    asyncio.create_task(redis_client.r.hset(f"user:{user_id}", mapping={
                        "x": str(data["x"]),
                        "y": str(data["y"]),
                        "server_id": server_id,
                        "username": data.get("username", "Player")
                    }))


            # Handle other messages (chat, etc) without throttling
            if data.get("type") == "request_users":
                users = await manager.get_server_users(server_id)
                await websocket.send_json({"type":"user_list","users":users})

    except WebSocketDisconnect:
        await manager.disconnect(websocket, server_id)
        
        # Cleanup Redis
        if redis_client.r:

            final_pos = await redis_client.r.hgetall(f"user:{user_id}")

            if final_pos and user_obj:
                last_x = int(final_pos.get("x",0))
                last_y = int(final_pos.get("y",0))

                res = await db.execute(select(ServerMember).where(
                    ServerMember.server_id == server_id,
                    ServerMember.user_id == user_uuid
                ))
                rec = res.scalars().first()

                if rec : 
                    rec.last_position_x = last_x
                    rec.last_position_y = last_y
                    rec.last_updated = datetime.utcnow()
                    await db.commit()
                    print(f"Saved {username} at {last_x}, {last_y}")
   
            await redis_client.r.srem(f"server:{server_id}:users", user_id)
            await redis_client.r.delete(f"user:{user_id}")
        
        await manager.broadcast({"type": "user_left", "user_id": user_id}, server_id, websocket)
        print(f"👋 User {user_id} disconnected from server {server_id}")
