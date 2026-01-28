from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.socket_manager import manager

router = APIRouter()

@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    print(f"Connecting: Room={room_id}, User={user_id}")
    await manager.connect(websocket, room_id, user_id)
    try: 
        while True:

            data = await websocket.receive_json()


            await manager.broadcast(data, room_id, websocket)

    except  WebSocketDisconnect:
        await manager.disconnect(websocket,room_id)

        await manager.broadcast({"type": "user_left", "user_id": user_id}, room_id,websocket)