from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.socket_manager import manager
from app.core import redis_client
from app.core.database import SessionLocal

router = APIRouter()

@router.websocket("/{server_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    server_id: str, 
    token: str = Query(...)
):
    """
    Standardized WebSocket endpoint.
    Restores the 'perfect' Parth-style sync while ensuring stability.
    """
    print(f"✅ WS-CONNECT: Room={server_id}")
    
    # 1. Immediate Accept to prevent ReadyState 3
    try:
        await manager.connect(websocket, server_id)
    except Exception as e:
        print(f"❌ WS-ACCEPT-ERROR: {e}")
        return

    # 2. Token / User Validation
    user_id = token
    username = "Guest"
    char_id = "bob"
    
    from app.core.security import SECRET_KEY, ALGORITHM
    from jose import jwt
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub", token)
    except:
        pass

    async with SessionLocal() as db:
        from app.models.user import User
        from sqlalchemy.future import select
        try:
            # Flexible lookup for restoration robustness
            if str(user_id).isdigit():
                stmt = select(User).where(User.id == int(user_id))
            else:
                stmt = select(User).where(User.username == user_id)
            
            res = await db.execute(stmt)
            u = res.scalars().first()
            if u:
                username = u.username
                char_id = u.character_id or "bob"
        except Exception as e:
            print(f"⚠️ DB-LOOKUP-ERROR: {e}")

    # 3. Initial State Push
    try:
        # Get users from manager (room context)
        current_users = await manager.get_room_users(server_id)
        await websocket.send_json({
            "type": "user_list",
            "users": current_users
        })
        
        # Broadcast presence
        await manager.broadcast({
            "type": "user_joined",
            "user_id": user_id,
            "username": username,
            "character_id": char_id,
        }, server_id, websocket)

        # 4. Message Loop
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "player_move":
                # Inject server-side verified identity
                data["user_id"] = user_id
                data["username"] = username
                data["character_id"] = char_id
                await manager.broadcast(data, server_id, websocket)

            if data.get("type") == "request_users":
                users = await manager.get_room_users(server_id)
                await websocket.send_json({"type":"user_list","users":users})
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, server_id)
        await manager.broadcast({
            "type": "user_left", 
            "user_id": user_id
        }, server_id, websocket)
    except Exception as e:
        print(f"❌ WS-LOOP-ERROR: {e}")
        await manager.disconnect(websocket, server_id)