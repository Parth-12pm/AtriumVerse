from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from app.core.socket_manager import manager
from app.core import redis_client  
from app.core.spatial_manager import spatial_manager
from app.core.zone_manager import zone_manager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.user import User
from app.models.direct_message import DirectMessage
from app.core.database import get_db, SessionLocal
from uuid import UUID
import time, asyncio, random, datetime
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter()

async def get_user_from_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            return None
        return username
    except JWTError:
        return None

@router.websocket("/{server_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    server_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
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

    await manager.connect(websocket, server_id, user_id)
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

    if redis_client.r:
        if member_record and member_record.last_position_x is not None:
            default_x = member_record.last_position_x
            default_y = member_record.last_position_y
        elif spawn_points:
            chosen = random.choice(spawn_points)
            default_x = chosen["x"] // 32
            default_y = (chosen["y"] // 32) - 1
        else:
            default_x = 15
            default_y = 15

        await redis_client.r.hset(f"user:{user_id}", mapping={
            "x": str(default_x),
            "y": str(default_y),
            "username": username,
            "server_id": server_id
        })
        await redis_client.r.sadd(f"server:{server_id}:users", user_id)

        online_users = await redis_client.r.smembers(f"server:{server_id}:users")
        user_positions = []
        for uid in online_users:
            if uid == user_id: continue
            pos_data = await redis_client.r.hgetall(f"user:{uid}")
            if pos_data:
                user_positions.append({
                    "user_id": uid,
                    "x": int(pos_data.get("x", 0)),
                    "y": int(pos_data.get("y", 0)),
                    "username": pos_data.get("username", "Player")
                })

        await websocket.send_json({"type": "user_list", "users": user_positions})

        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id,
            "x": default_x,
            "y": default_y,
            "username": username
        }, server_id, websocket)

    async def periodic_save():
        while True:
            try:
                await asyncio.sleep(10)
                if redis_client.r:
                    pos = await redis_client.r.hgetall(f"user:{user_id}")
                    if pos:
                        async with SessionLocal() as session:
                            result = await session.execute(
                                select(ServerMember).where(
                                    ServerMember.server_id == server_id,
                                    ServerMember.user_id == user_uuid
                                )
                            )
                            rec = result.scalars().first()
                            if rec:
                                rec.last_position_x = int(pos.get("x", 0))
                                rec.last_position_y = int(pos.get("y", 0))
                                rec.last_updated = datetime.datetime.utcnow()
                                await session.commit()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"autosave error: {e}")
    
    save_task = asyncio.create_task(periodic_save())

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "player_move":
                zone = spatial_manager.check_zone(data["x"], data["y"], server_id)

                await manager.broadcast({
                    "type": "player_move",
                    "user_id": user_id,
                    "x": data["x"],
                    "y": data["y"],
                    "username": data.get("username", "Player"),
                    "zone": zone["name"] if zone else "Open Space"
                }, server_id, websocket)

                if redis_client.r:
                    asyncio.create_task(redis_client.r.hset(f"user:{user_id}", mapping={
                        "x": str(data["x"]),
                        "y": str(data["y"]),
                        "server_id": server_id,
                        "username": data.get("username", "Player")
                    }))

            # NEW: Zone lifecycle events
            elif data.get("type") == "zone_enter":
                zone_id = data.get("zone_id")
                zone_type = data.get("zone_type", "PUBLIC")
                
                if zone_id:
                    zone_state = await zone_manager.enter_zone(
                        zone_id=zone_id,
                        user_id=user_id,
                        username=username,
                        zone_type=zone_type
                    )
                    
                    # Notify user of zone state
                    await websocket.send_json({
                        "type": "zone_entered",
                        "zone_id": zone_id,
                        "members": zone_state["members"],
                        "member_count": zone_state["member_count"]
                    })
                    
                    # Notify other zone members
                    members = zone_state["members"]
                    for member_id in members:
                        if member_id != user_id:
                            await manager.send_personal_message({
                                "type": "zone_user_joined",
                                "zone_id": zone_id,
                                "user_id": user_id,
                                "username": username
                            }, server_id, member_id)
            
            elif data.get("type") == "zone_exit":
                zone_id = data.get("zone_id")
                
                if zone_id:
                    members_before = zone_manager.get_zone_members(zone_id)
                    zone_destroyed = await zone_manager.exit_zone(zone_id, user_id)
                    
                    # Notify user
                    await websocket.send_json({
                        "type": "zone_exited",
                        "zone_id": zone_id,
                        "destroyed": zone_destroyed
                    })
                    
                    # Notify remaining members
                    if not zone_destroyed:
                        for member_id in members_before:
                            if member_id != user_id:
                                await manager.send_personal_message({
                                    "type": "zone_user_left",
                                    "zone_id": zone_id,
                                    "user_id": user_id,
                                    "username": username
                                }, server_id, member_id)

            elif data.get("type") == "request_users":
                users = await manager.get_server_users(server_id)
                await websocket.send_json({"type":"user_list","users":users})

            elif data.get("type") == "chat_message":
                scope = data.get("scope", "global")
                message = data.get("message", "")
                
                if not message or len(message) > 500:
                    continue

                if scope == "global":
                    await manager.broadcast({
                        "type": "chat_message",
                        "sender": user_id,
                        "username": username,
                        "scope": "global",
                        "text": message,
                        "timestamp": datetime.datetime.utcnow().isoformat()
                    }, server_id)
                
                # Channel-scoped persistent messages (broadcast to all in server)
                elif scope == "channel":
                    channel_id = data.get("channel_id")
                    message_data = data.get("message_data", {})
                    
                    if channel_id and message_data:
                        # Broadcast to all connected users (they filter by channel_id on frontend)
                        await manager.broadcast({
                            "type": "chat_message",
                            "scope": "channel",
                            **message_data  # Full message object with id, user_id, content, etc.
                        }, server_id, websocket)  # Exclude sender
                
                elif scope == "direct":
                    target_id = data.get("target")
                    if target_id:
                        payload = {
                            "type": "chat_message",
                            "sender": user_id,
                            "username": username,
                            "scope": "direct",
                            "text": message,
                            "timestamp": datetime.datetime.utcnow().isoformat()
                        }
                        await manager.send_personal_message(payload, server_id, target_id)
                        await manager.send_personal_message(payload, server_id, user_id)
                
                # NEW: Zone-scoped temporary chat
                elif scope == "zone":
                    current_zone = zone_manager.get_user_zone(user_id)
                    if current_zone:
                        members = zone_manager.get_zone_members(current_zone)
                        payload = {
                            "type": "chat_message",
                            "sender": user_id,
                            "username": username,
                            "scope": "zone",
                            "zone_id": current_zone,
                            "text": message,
                            "timestamp": datetime.datetime.utcnow().isoformat(),
                            "temporary": True  # Flag for frontend to not persist
                        }
                        
                        # Send to all zone members
                        for member_id in members:
                            await manager.send_personal_message(payload, server_id, member_id)
            
            # NEW: Persistent Direct Message events
            elif data.get("type") == "dm_sent":
                # Real-time notification when a DM is sent (already saved in DB via REST)
                target_id = data.get("target_id")
                message_data = data.get("message")
                
                if target_id and message_data:
                    await manager.send_personal_message({
                        "type": "dm_received",
                        "message": message_data
                    }, server_id, target_id)
            
            elif data.get("type") == "dm_edited":
                # Real-time notification when a DM is edited
                target_id = data.get("target_id")
                message_data = data.get("message")
                
                if target_id and message_data:
                    await manager.send_personal_message({
                        "type": "dm_updated",
                        "message": message_data
                    }, server_id, target_id)
            
            elif data.get("type") == "dm_deleted":
                # Real-time notification when a DM is deleted
                target_id = data.get("target_id")
                message_id = data.get("message_id")
                
                if target_id and message_id:
                    await manager.send_personal_message({
                        "type": "dm_deleted",
                        "message_id": message_id
                    }, server_id, target_id)

    except WebSocketDisconnect:
        save_task.cancel()
        
        # Cleanup zone membership
        await zone_manager.cleanup_user(user_id)
        
        await manager.disconnect(websocket, server_id, user_id)
        
        if redis_client.r:
            final_pos = await redis_client.r.hgetall(f"user:{user_id}")

            if final_pos and user_obj:
                last_x = int(final_pos.get("x",0))
                last_y = int(final_pos.get("y",0))
                
                try:
                    async with SessionLocal() as session:
                        res = await session.execute(select(ServerMember).where(
                            ServerMember.server_id == server_id,
                            ServerMember.user_id == user_uuid
                        ))
                        rec = res.scalars().first()

                        if rec: 
                            rec.last_position_x = last_x
                            rec.last_position_y = last_y
                            rec.last_updated = datetime.datetime.utcnow()
                            await session.commit()
                except Exception as e:
                    print(f"Final save failed: {e}")
   
            await redis_client.r.srem(f"server:{server_id}:users", user_id)
            await redis_client.r.delete(f"user:{user_id}")
        
        await manager.broadcast({"type": "user_left", "user_id": user_id}, server_id, websocket)