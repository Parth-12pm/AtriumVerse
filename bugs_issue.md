# Comprehensive Code Review: AtriumVerse

## Critical Structural Flaws

### 1. **Ghost Character Bug (Most Critical)**

**Root Cause:** Race condition in WebSocket message handling + missing broadcast exclusion

**Location:** `backend/app/api/ws.py` lines 76-95

```python
# PROBLEM: user_joined broadcast happens BEFORE Redis position is set
await manager.broadcast({
    "type": "user_joined",
    "user_id": user_id,
    "x": int(my_pos_data.get("x", default_x)) if my_pos_data else default_x,
    "y": int(my_pos_data.get("y", default_y)) if my_pos_data else default_y,
    "username": my_pos_data.get("username", "Player") if my_pos_data else "Player"
}, server_id, websocket)
```

**Issue:** New joiner gets `user_list` with positions, then `user_joined` broadcast creates duplicate. Existing players see the new joiner twice because:
1. They receive `user_list` update (if they request it)
2. They receive `user_joined` broadcast
3. Frontend spawns on both events without deduplication

**Fix:**
```python
# ws.py - After Redis setup
if redis_client.r:
    # Set initial position FIRST
    await redis_client.r.hset(f"user:{user_id}", mapping={
        "x": str(default_x),
        "y": str(default_y),
        "username": username,
        "server_id": server_id
    })
    
    # THEN broadcast (others can now query Redis for position)
    await manager.broadcast({
        "type": "user_joined",
        "user_id": user_id,
        "x": default_x,
        "y": default_y,
        "username": username
    }, server_id, websocket)  # Exclude sender - they don't need to spawn themselves
```

**Frontend Fix:** `MainScene.ts` line 474
```typescript
private spawnRemotePlayer(userId: string, username: string, x: number, y: number) {
    if (this.otherPlayers.has(userId)) {
        console.warn(`[MainScene] Player ${userId} already exists, skipping spawn`);
        return; // CRITICAL: Already have this check, but verify it's working
    }
    // ... rest of spawn logic
}
```

---

### 2. **Position Not Persisting on Reload**

**Root Cause:** Position only saved on disconnect, not periodically

**Location:** `backend/app/api/ws.py` lines 117-134

**Current Flow:**
1. User moves → Redis updated (fire-and-forget async task)
2. User disconnects → Final position saved to PostgreSQL
3. **PROBLEM:** If browser refreshes/crashes, Redis position is lost before DB save

**Fix:** Implement periodic position snapshots
```python
# ws.py - Add periodic save task
async def periodic_position_save(user_id, user_uuid, server_id, db):
    """Save position every 10 seconds"""
    while True:
        try:
            await asyncio.sleep(10)
            if redis_client.r:
                pos = await redis_client.r.hgetall(f"user:{user_id}")
                if pos:
                    res = await db.execute(select(ServerMember).where(
                        ServerMember.server_id == server_id,
                        ServerMember.user_id == user_uuid
                    ))
                    rec = res.scalars().first()
                    if rec:
                        rec.last_position_x = int(pos.get("x", 0))
                        rec.last_position_y = int(pos.get("y", 0))
                        await db.commit()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Position save error: {e}")

# In websocket_endpoint, create task
save_task = asyncio.create_task(periodic_position_save(user_id, user_uuid, server_id, db))

# In disconnect cleanup
save_task.cancel()
```

---

## Scalability Issues

### 3. **Redis O(N) Broadcast Storm**

**Location:** `backend/app/api/ws.py` line 97

```python
# PROBLEM: Every move fetches ALL online users
online_users = await redis_client.r.smembers(f"server:{server_id}:users")
for uid in online_users:
    pos_data = await redis_client.r.hgetall(f"user:{uid}")
```

**Impact:** With 100 users, every movement triggers 100 Redis queries = **10,000 queries/second** at 100 moves/sec

**Fix:** Use Redis Pub/Sub instead
```python
# Remove user position fetching from connect
# Use Redis PUBLISH for movements

async def handle_player_move(data):
    # Update own position
    await redis_client.r.hset(f"user:{user_id}", mapping={
        "x": str(data["x"]),
        "y": str(data["y"]),
        "username": data.get("username", "Player")
    })
    
    # Publish to channel (Redis handles broadcast)
    await redis_client.r.publish(f"server:{server_id}:moves", json.dumps({
        "type": "player_move",
        "user_id": user_id,
        "x": data["x"],
        "y": data["y"],
        "username": data.get("username", "Player")
    }))
```

---

### 4. **WebSocket Broadcast Blocking I/O**

**Location:** `backend/app/core/socket_manager.py` lines 29-38

```python
# PROBLEM: asyncio.gather with blocking sends
tasks = [
    connection.send_json(message)
    for connection in self.active_connections[server_id]
    if connection != sender
]
await asyncio.gather(*tasks, return_exceptions=True)
```

**Issue:** If one client has slow network (200ms latency), ALL broadcasts wait. With 50 users, 1 slow client delays 49 others.

**Fix:** Fire-and-forget with timeout
```python
async def broadcast(self, message: dict, server_id: str, sender: WebSocket):
    if server_id not in self.active_connections:
        return
    
    async def safe_send(ws: WebSocket):
        try:
            await asyncio.wait_for(ws.send_json(message), timeout=0.5)
        except asyncio.TimeoutError:
            print(f"Client send timeout, disconnecting")
            await self.disconnect(ws, server_id)
        except Exception as e:
            await self.disconnect(ws, server_id)
    
    # Fire all sends concurrently without waiting
    tasks = [
        asyncio.create_task(safe_send(conn))
        for conn in self.active_connections[server_id]
        if conn != sender
    ]
```

---

### 5. **Spatial Manager Memory Leak**

**Location:** `backend/app/core/spatial_manager.py` lines 13-31

**Problem:** Zones cached in RAM forever, never cleared

```python
class SpatialManager:
    def __init__(self):
        self.zone_cache: Dict[str, List[dict]] = {}  # GROWS FOREVER
```

**Impact:** 1000 servers × 50 zones × 1KB = 50MB RAM minimum, grows unbounded

**Fix:** Add LRU eviction
```python
from collections import OrderedDict
from datetime import datetime, timedelta

class SpatialManager:
    def __init__(self, max_servers=1000, ttl_minutes=30):
        self.zone_cache: OrderedDict[str, tuple[List[dict], datetime]] = OrderedDict()
        self.max_servers = max_servers
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def _evict_stale(self):
        now = datetime.utcnow()
        to_remove = [
            sid for sid, (zones, timestamp) in self.zone_cache.items()
            if now - timestamp > self.ttl
        ]
        for sid in to_remove:
            del self.zone_cache[sid]
    
    async def load_zones(self, server_id: str, db: AsyncSession):
        self._evict_stale()
        
        if server_id in self.zone_cache:
            # Refresh timestamp
            zones, _ = self.zone_cache.pop(server_id)
            self.zone_cache[server_id] = (zones, datetime.utcnow())
            return
        
        # ... fetch from DB ...
        self.zone_cache[server_id] = (zones_list, datetime.utcnow())
        
        # LRU eviction
        if len(self.zone_cache) > self.max_servers:
            self.zone_cache.popitem(last=False)
```

---

## Redundant/Useless Code

### 6. **Duplicate Animation System**

**Location:** `frontend/game/scenes/MainScene.ts` lines 241-252 + 293-307

```typescript
// REDUNDANT: Manual animations created but grid-engine has walkingAnimationMapping
directions.forEach(({ name, row }) => {
    this.anims.create({
        key: `walk_${name}`,
        frames: this.anims.generateFrameNumbers("player", {
            start: row * cols,
            end: row * cols + cols - 1,
        }),
        frameRate: 8,
        repeat: -1,
    });
});

// Later... manual animation triggering
this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
    const animKey = `walk_${direction.toLowerCase()}`;
    this.playerSprite.play(animKey, true);  // USELESS - grid-engine does this
});
```

**Fix:** Remove manual animations, use grid-engine's built-in system
```typescript
// In create(), just configure grid-engine
this.gridEngine.create(map, {
    characters: [{
        id: "hero",
        sprite: this.playerSprite,
        startPosition: { x: spawnX, y: spawnY },
        speed: 4,
        walkingAnimationMapping: {
            up: { leftFoot: 9, standing: 8, rightFoot: 11 },
            down: { leftFoot: 1, standing: 0, rightFoot: 3 },
            left: { leftFoot: 13, standing: 12, rightFoot: 15 },
            right: { leftFoot: 5, standing: 4, rightFoot: 7 }
        }
    }]
});

// DELETE all movementStarted/movementStopped subscriptions
// grid-engine handles everything
```

---

### 7. **Unused Position Throttling**

**Location:** `frontend/game/scenes/MainScene.ts` lines 71-73

```typescript
private lastSentPosition = { x: 0, y: 0 };
private lastSentTime = 0;
private sendThrottleMs = 25;
```

**Issue:** Throttling implemented but movement sends **target tile**, not every frame. Already throttled by grid-engine's discrete movement.

**Remove:** Lines 71-73, 559-576 (entire throttling logic)

---

### 8. **Dead Proximity System**

**Location:** `frontend/game/scenes/MainScene.ts` lines 527-547

```typescript
private checkProximity() {
    // Emits events to React but React never uses them
    EventBus.emit(GameEvents.PROXIMITY_CHANGE, {
        playerId,
        distance,
        inRange: distance < 5,
    });
}
```

**Check:** `frontend/components/game/ServerHUD.tsx` - No listener for `PROXIMITY_CHANGE`

**Decision:** Either implement WebRTC proximity or delete this entire function

---




---

### 10. **Stale PhaserGameClient**

**Location:** `frontend/components/game/PhaserGameClient.tsx` (entire file)

Never used - superseded by `GameWrapperNew.tsx`

**DELETE** entire file + `GameCanvas.tsx` wrapper

---

## Coordination Issues

### 11. **Database Transaction Hell**

**Location:** `backend/app/api/servers.py` lines 35-78

```python
# PROBLEM: Manual flush/refresh instead of context manager
db.add(new_server)
await db.flush()  # Partial commit
await db.refresh(new_server)

owner_member = ServerMember(...)
db.add(owner_member)

# ... 40 lines of code ...

await db.commit()  # All-or-nothing here
```

**Issue:** If map parsing fails on line 60, server is already in DB from `flush()` but has no zones

**Fix:** Use transaction context
```python
async with db.begin():  # Auto-rollback on exception
    new_server = Server(...)
    db.add(new_server)
    await db.flush()  # Get ID
    
    owner_member = ServerMember(...)
    db.add(owner_member)
    
    zones_data, spawn_points = parse_map_zones(full_path)
    for z in zones_data:
        db.add(Zone(...))
    
    # Commit happens automatically if no exception
```

---

### 12. **Redis/PostgreSQL Consistency Gap**

**Current Architecture:**
- Redis: Real-time positions (volatile)
- PostgreSQL: Persistent positions (stale)
- **GAP:** No synchronization guarantee

**Scenario:**
1. User moves to (50, 50) → Redis updated
2. Server crashes before periodic save
3. User reconnects → Spawns at old DB position (10, 10)
4. Redis key lost forever

**Fix:** Write-Ahead Log pattern
```python
# On every position update
async def update_position(user_id, x, y):
    # 1. Write to Redis (fast)
    await redis_client.r.hset(f"user:{user_id}", {"x": x, "y": y})
    
    # 2. Append to WAL (async)
    await redis_client.r.lpush(f"wal:positions", json.dumps({
        "user_id": user_id,
        "x": x,
        "y": y,
        "timestamp": time.time()
    }))
    
    # 3. Background worker flushes WAL to PostgreSQL every 5 seconds
```

---

### 13. **Frontend State Desync**

**Location:** `frontend/components/game/ServerHUD.tsx` lines 42-48

```typescript
const handleUserListUpdate = (users: any[]) => {
    const userObjects = users.map((u) => ({
        id: u.user_id,
        username: u.username || "Player",
        status: "online" as const,
    }));
    setOnlineUsers(userObjects);
};
```

**Problem:** React state updated but Phaser `otherPlayers` map is separate

**Scenario:**
1. User A disconnects
2. React removes from `onlineUsers` state
3. Phaser `MainScene` still has sprite rendering
4. Ghost player appears

**Fix:** Single source of truth
```typescript
// Make Phaser the source of truth
EventBus.on(GameEvents.PLAYER_LIST_UPDATE, (users) => {
    // Update Phaser FIRST
    const currentIds = new Set(this.otherPlayers.keys());
    const newIds = new Set(users.map(u => u.user_id));
    
    // Remove departed players
    currentIds.forEach(id => {
        if (!newIds.has(id)) {
            this.removeRemotePlayer(id);
        }
    });
    
    // Add new players
    users.forEach(u => {
        if (!currentIds.has(u.user_id)) {
            this.spawnRemotePlayer(u.user_id, u.username, u.x, u.y);
        }
    });
    
    // THEN emit to React (derived state)
    EventBus.emit(GameEvents.REACT_USER_LIST, this.otherPlayers.size);
});
```

---

## Performance Optimizations

### 14. **Grid-Engine Movement Prediction Overhead**

**Location:** `frontend/game/scenes/MainScene.ts` lines 265-289

```typescript
this.gridEngine.movementStarted().subscribe(({ charId, direction }) => {
    // Calculate target tile (CPU waste)
    let targetX = currentPos.x;
    let targetY = currentPos.y;
    switch (direction) {
        case "left": targetX -= 1; break;
        case "right": targetX += 1; break;
        // ...
    }
    this.sendMovementToServer(targetX, targetY, direction);
});
```

**Issue:** Grid-engine already knows target tile internally. Recalculating is redundant.

**Fix:** Use `positionChangeFinished` instead
```typescript
// DELETE movementStarted subscription entirely

this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
    if (charId === "hero") {
        const finalPos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(finalPos.x, finalPos.y, this.lastDirection);
    }
});
```

**Trade-off:** Slightly higher latency (send after movement) but eliminates prediction bugs

---

### 15. **React Re-render Storm**

**Location:** `frontend/app/server/[id]/page.tsx` lines 34-47

```typescript
const [username, setUsername] = useState("Player");
const [token, setToken] = useState("");
const [mounted, setMounted] = useState(false);

useEffect(() => {
    setMounted(true);  // Re-render
    setUsername(...);   // Re-render
    setToken(...);      // Re-render
}, []);
```

**Issue:** 3 state updates = 3 React re-renders before game loads

**Fix:** Single state object
```typescript
const [gameConfig, setGameConfig] = useState({
    username: "Player",
    token: "",
    mounted: false
});

useEffect(() => {
    setGameConfig({
        username: localStorage.getItem("username") || "Player",
        token: localStorage.getItem("token") || "",
        mounted: true
    });
}, []);
```

---


**Delete These Code Blocks:**
1. Manual animation creation (MainScene.ts lines 241-252)
2. Animation subscriptions (MainScene.ts lines 293-318)
3. Position throttling (MainScene.ts lines 71-73, 559-576)
4. Proximity system (MainScene.ts lines 527-547) OR implement WebRTC

**Estimated Impact:**
- **Ghost bug:** Fixed with proper broadcast exclusion
- **Position persistence:** Fixed with periodic saves
- **Performance:** 70% reduction in Redis queries with Pub/Sub
- **Code size:** ~500 lines removed
- **Bundle size:** ~15KB smaller (webrtc removal)


# Feature Implementation Roadmap

## 1. Proximity-Based Audio/Video (WebRTC)

### Architecture Overview
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client A  │◄───────►│ Signaling    │◄───────►│  Client B   │
│  (Browser)  │  WSS    │ Server       │  WSS    │  (Browser)  │
└──────┬──────┘         │ (FastAPI)    │         └──────┬──────┘
       │                └──────────────┘                │
       │                                                │
       │            P2P Media Stream (SRTP)            │
       └───────────────────────────────────────────────┘
                     (Direct Connection)
```

### Backend Requirements

#### 1. **Database Schema Extensions**

```python
# backend/app/models/media_session.py
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid, enum
from datetime import datetime
from app.core.database import Base

class MediaType(str, enum.Enum):
    AUDIO = "audio"
    VIDEO = "video"
    SCREEN = "screen"

class MediaSession(Base):
    """Tracks active WebRTC sessions for reconnection"""
    __tablename__ = "media_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    
    # Media state
    media_types = Column(JSONB)  # {"audio": true, "video": false, "screen": false}
    is_muted = Column(Boolean, default=False)
    is_video_off = Column(Boolean, default=True)
    
    # Spatial audio metadata
    current_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    position_x = Column(Integer)
    position_y = Column(Integer)
    
    # Session management
    peer_id = Column(String, unique=True)  # WebRTC peer identifier
    connection_quality = Column(String, default="good")  # good/medium/poor
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# backend/app/models/webrtc_signal.py
class WebRTCSignal(Base):
    """Store ICE candidates/SDP for offline peer reconnection"""
    __tablename__ = "webrtc_signals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"))
    
    signal_type = Column(String)  # "offer", "answer", "ice-candidate"
    signal_data = Column(JSONB)  # SDP or ICE candidate
    
    delivered = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

#### 2. **Redis Schema for Real-Time State**

```python
# backend/app/core/redis_schema.py

"""
Redis Keys for WebRTC Management:

# Active media sessions
media:server:{server_id}:users -> SET [user_id1, user_id2, ...]
media:user:{user_id}:state -> HASH {
    "audio": "true",
    "video": "false", 
    "screen": "false",
    "zone_id": "uuid",
    "x": "15",
    "y": "20",
    "peer_id": "peer_abc123"
}

# Proximity clusters (for efficient peer discovery)
proximity:server:{server_id}:zone:{zone_id}:users -> SET [user_id1, user_id2]
proximity:server:{server_id}:spatial:{grid_x}_{grid_y} -> SET [user_id3, user_id4]
# Grid cells are 5x5 tiles for proximity grouping

# ICE candidate queue (temporary storage)
ice:user:{user_id}:candidates -> LIST [candidate1, candidate2, ...]
# TTL: 60 seconds

# Signaling pub/sub channels
# PUBLISH signaling:user:{user_id} {"type": "offer", "from": "user123", "data": {...}}
"""
```

#### 3. **API Endpoints**

```python
# backend/app/api/webrtc.py
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from app.api.deps import get_current_user
from app.models.media_session import MediaSession

router = APIRouter()

@router.post("/servers/{server_id}/media/start")
async def start_media_session(
    server_id: UUID,
    media_config: dict,  # {"audio": true, "video": true}
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Initialize media session (called when user enters server)"""
    # 1. Create MediaSession in DB
    # 2. Generate unique peer_id
    # 3. Store in Redis: media:user:{user_id}:state
    # 4. Return peer_id + STUN/TURN server config
    pass


@router.post("/servers/{server_id}/media/peers")
async def get_nearby_peers(
    server_id: UUID,
    position: dict,  # {"x": 15, "y": 20, "zone_id": "uuid"}
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of peers within proximity range (5-tile radius)"""
    # 1. Query Redis proximity:server:{id}:spatial:{grid_x}_{grid_y}
    # 2. Filter by distance < 5 tiles (Euclidean)
    # 3. Return [{user_id, peer_id, position, media_state}, ...]
    pass


@router.websocket("/ws/{server_id}/signaling")
async def webrtc_signaling(
    websocket: WebSocket,
    server_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """
    WebRTC signaling channel (separate from game WebSocket)
    
    Messages:
    - Client -> Server: {"type": "offer", "target": "user123", "sdp": {...}}
    - Server -> Client: {"type": "offer", "from": "user456", "sdp": {...}}
    - Client -> Server: {"type": "answer", "target": "user123", "sdp": {...}}
    - Client -> Server: {"type": "ice-candidate", "target": "user123", "candidate": {...}}
    
    Flow:
    1. Client A discovers Client B via /media/peers
    2. Client A creates offer, sends to server with target=B
    3. Server stores in Redis (ice:user:B:candidates)
    4. Server publishes to signaling:user:B channel
    5. Client B receives offer, creates answer
    6. Repeat for answer + ICE candidates
    7. Direct P2P connection established
    """
    pass
```

#### 4. **Spatial Audio Manager**

```python
# backend/app/core/spatial_audio.py
import math
from typing import List, Tuple

class SpatialAudioManager:
    """Calculate which peers should connect based on proximity"""
    
    PROXIMITY_RADIUS = 5  # tiles
    GRID_CELL_SIZE = 5    # tiles per spatial hash cell
    
    @staticmethod
    def get_grid_cell(x: int, y: int) -> str:
        """Convert position to spatial hash"""
        grid_x = x // SpatialAudioManager.GRID_CELL_SIZE
        grid_y = y // SpatialAudioManager.GRID_CELL_SIZE
        return f"{grid_x}_{grid_y}"
    
    @staticmethod
    def get_neighbor_cells(x: int, y: int) -> List[str]:
        """Get 9 cells (current + 8 neighbors) for proximity check"""
        cells = []
        grid_x = x // SpatialAudioManager.GRID_CELL_SIZE
        grid_y = y // SpatialAudioManager.GRID_CELL_SIZE
        
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                cells.append(f"{grid_x + dx}_{grid_y + dy}")
        return cells
    
    @staticmethod
    def calculate_distance(x1: int, y1: int, x2: int, y2: int) -> float:
        """Euclidean distance"""
        return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
    
    @staticmethod
    def calculate_volume(distance: float) -> float:
        """
        Calculate audio volume based on distance
        0 tiles = 1.0 volume
        5 tiles = 0.0 volume
        Linear falloff
        """
        if distance >= SpatialAudioManager.PROXIMITY_RADIUS:
            return 0.0
        return 1.0 - (distance / SpatialAudioManager.PROXIMITY_RADIUS)
    
    @staticmethod
    def calculate_stereo_pan(x1: int, y1: int, x2: int, y2: int) -> float:
        """
        Calculate stereo panning (-1.0 left, 0.0 center, 1.0 right)
        Based on relative angle
        """
        dx = x2 - x1
        dy = y2 - y1
        
        if dx == 0:
            return 0.0
        
        # Simple horizontal panning (can add full 3D audio later)
        angle = math.atan2(dy, dx)
        # Convert to stereo pan (-1 to 1)
        pan = math.sin(angle)
        return max(-1.0, min(1.0, pan))
```

---

### Frontend Requirements

#### 1. **WebRTC Connection Manager**

```typescript
// frontend/lib/webrtc/RTCConnectionManager.ts
export class RTCConnectionManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private signalingSocket: WebSocket | null = null;
  
  // Configuration
  private readonly config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // Add TURN servers for production:
      // { urls: 'turn:your-turn-server.com', username: 'xxx', credential: 'yyy' }
    ],
  };
  
  // Audio context for spatial audio
  private audioContext: AudioContext | null = null;
  private panners: Map<string, PannerNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  
  async initialize(userId: string, serverId: string, token: string) {
    // 1. Get local media stream
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: { width: 320, height: 240 }, // Low res for floating tiles
    });
    
    // 2. Connect to signaling server
    const wsUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, 'ws');
    this.signalingSocket = new WebSocket(
      `${wsUrl}/ws/${serverId}/signaling?token=${token}`
    );
    
    this.signalingSocket.onmessage = (event) => {
      this.handleSignalingMessage(JSON.parse(event.data));
    };
    
    // 3. Initialize Web Audio API for spatial audio
    this.audioContext = new AudioContext();
  }
  
  async connectToPeer(peerId: string, userId: string) {
    if (this.connections.has(peerId)) {
      console.warn(`Already connected to ${peerId}`);
      return;
    }
    
    const pc = new RTCPeerConnection(this.config);
    this.connections.set(peerId, pc);
    
    // Add local tracks
    this.localStream?.getTracks().forEach((track) => {
      pc.addTrack(track, this.localStream!);
    });
    
    // Handle incoming remote stream
    pc.ontrack = (event) => {
      this.handleRemoteTrack(peerId, event.streams[0]);
    };
    
    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingSocket?.send(JSON.stringify({
          type: 'ice-candidate',
          target: userId,
          candidate: event.candidate,
        }));
      }
    };
    
    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.signalingSocket?.send(JSON.stringify({
      type: 'offer',
      target: userId,
      sdp: offer,
    }));
  }
  
  updateSpatialAudio(peerId: string, myPos: {x: number, y: number}, theirPos: {x: number, y: number}) {
    if (!this.audioContext) return;
    
    const panner = this.panners.get(peerId);
    const gain = this.gainNodes.get(peerId);
    
    if (!panner || !gain) return;
    
    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(theirPos.x - myPos.x, 2) + 
      Math.pow(theirPos.y - myPos.y, 2)
    );
    
    // Update volume (0-5 tile range)
    const volume = Math.max(0, 1 - distance / 5);
    gain.gain.value = volume;
    
    // Update 3D position
    // Map tile coordinates to 3D space (1 tile = 1 meter)
    const x = (theirPos.x - myPos.x);
    const z = (theirPos.y - myPos.y);
    panner.setPosition(x, 0, z);
  }
  
  private handleRemoteTrack(peerId: string, stream: MediaStream) {
    if (!this.audioContext) return;
    
    // Create audio nodes for spatial audio
    const source = this.audioContext.createMediaStreamSource(stream);
    const panner = this.audioContext.createPanner();
    const gain = this.audioContext.createGain();
    
    // Configure panner for spatial audio
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = 1;
    panner.maxDistance = 5;
    panner.rolloffFactor = 1;
    
    // Connect: source -> panner -> gain -> destination
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.audioContext.destination);
    
    this.panners.set(peerId, panner);
    this.gainNodes.set(peerId, gain);
    
    // Emit event for UI to show video tile
    EventBus.emit('remote-stream-added', { peerId, stream });
  }
}
```

#### 2. **Proximity Detector Hook**

```typescript
// frontend/hooks/use-proximity-peers.ts
import { useEffect, useState } from 'react';
import EventBus, { GameEvents } from '@/game/EventBus';

interface ProximityPeer {
  userId: string;
  peerId: string;
  username: string;
  distance: number;
  position: { x: number; y: number };
  mediaState: { audio: boolean; video: boolean };
}

export function useProximityPeers(rtcManager: RTCConnectionManager) {
  const [nearbyPeers, setNearbyPeers] = useState<ProximityPeer[]>([]);
  const [myPosition, setMyPosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    // Listen to position updates from Phaser
    const handlePositionUpdate = (data: { x: number; y: number }) => {
      setMyPosition(data);
      
      // Fetch nearby peers from backend
      fetchNearbyPeers(data.x, data.y);
    };
    
    EventBus.on(GameEvents.PLAYER_POSITION, handlePositionUpdate);
    
    return () => {
      EventBus.off(GameEvents.PLAYER_POSITION, handlePositionUpdate);
    };
  }, []);
  
  // When nearby peers change, connect/disconnect WebRTC
  useEffect(() => {
    nearbyPeers.forEach((peer) => {
      // Connect if not already connected
      rtcManager.connectToPeer(peer.peerId, peer.userId);
      
      // Update spatial audio
      rtcManager.updateSpatialAudio(peer.peerId, myPosition, peer.position);
    });
    
    // Disconnect from peers who left proximity
    // (implementation detail)
  }, [nearbyPeers, myPosition]);
  
  return { nearbyPeers };
}
```

#### 3. **UI Components**

```typescript
// frontend/components/game/FloatingVideoTiles.tsx
'use client';

interface VideoTileProps {
  peerId: string;
  username: string;
  stream: MediaStream;
  distance: number;
  position: { x: number; y: number };
}

export function FloatingVideoTiles() {
  const [remotePeers, setRemotePeers] = useState<Map<string, MediaStream>>(new Map());
  
  useEffect(() => {
    const handleStream = ({ peerId, stream }: { peerId: string; stream: MediaStream }) => {
      setRemotePeers((prev) => new Map(prev).set(peerId, stream));
    };
    
    EventBus.on('remote-stream-added', handleStream);
    
    return () => {
      EventBus.off('remote-stream-added', handleStream);
    };
  }, []);
  
  return (
    <div className="fixed top-4 right-4 z-40 flex flex-col gap-2">
      {Array.from(remotePeers.entries()).map(([peerId, stream]) => (
        <div key={peerId} className="w-40 h-28 bg-card border-4 border-border rounded-lg overflow-hidden">
          <video
            autoPlay
            playsInline
            ref={(el) => {
              if (el) el.srcObject = stream;
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-0.5 text-xs">
            {/* Username from nearby peers */}
          </div>
        </div>
      ))}
    </div>
  );
}


// frontend/components/game/ConferenceModeToggle.tsx
export function ConferenceModeToggle() {
  const [isConferenceMode, setIsConferenceMode] = useState(false);
  
  return (
    <>
      <Button onClick={() => setIsConferenceMode(true)}>
        Expand to Conference View
      </Button>
      
      {isConferenceMode && (
        <Dialog open onOpenChange={setIsConferenceMode}>
          <DialogContent className="max-w-6xl h-[90vh]">
            {/* Google Meet-like grid layout */}
            <div className="grid grid-cols-3 gap-4 h-full">
              {/* Local + Remote video tiles in grid */}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
```

---

## 2. Permanent Chat System

### Database Schema

```python
# backend/app/models/chat_message.py
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # text/image/file/system
    
    # Scope
    scope = Column(String, default="global")  # global/zone/whisper
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # For whispers
    
    # Metadata
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    is_pinned = Column(Boolean, default=False)
    
    # Reactions
    reactions = Column(JSONB, default={})  # {"👍": ["user1", "user2"], "❤️": ["user3"]}
    
    # Threading
    parent_message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True)
    reply_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    user = relationship("User")
    server = relationship("Server")
    zone = relationship("Zone", foreign_keys=[zone_id])
    parent = relationship("ChatMessage", remote_side=[id], backref="replies")


# backend/app/models/chat_attachment.py
class ChatAttachment(Base):
    __tablename__ = "chat_attachments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"))
    
    file_name = Column(String)
    file_size = Column(Integer)  # bytes
    file_type = Column(String)  # image/video/document
    storage_path = Column(String)  # S3/local path
    
    # Image metadata
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    thumbnail_path = Column(String, nullable=True)
    
    uploaded_at = Column(DateTime, default=datetime.utcnow)
```

### Redis Schema

```python
"""
# Recent messages cache (last 100 per server)
chat:server:{server_id}:recent -> LIST [msg1_json, msg2_json, ...]
# TTL: 24 hours

# Typing indicators
chat:server:{server_id}:typing -> SET [user_id1, user_id2]
# TTL: 5 seconds per user

# Unread counts
chat:user:{user_id}:unread:{server_id} -> STRING "5"

# Online presence
chat:server:{server_id}:online -> HASH {user_id1: timestamp, user_id2: timestamp}
"""
```

### API Endpoints

```python
# backend/app/api/chat.py

@router.get("/servers/{server_id}/chat/history")
async def get_chat_history(
    server_id: UUID,
    limit: int = 50,
    before: datetime = None,  # Pagination cursor
    scope: str = "global",  # global/zone
    zone_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch message history with pagination
    
    Returns: {
        "messages": [...],
        "has_more": true,
        "cursor": "2024-01-15T10:30:00Z"
    }
    """
    pass


@router.post("/servers/{server_id}/chat/send")
async def send_message(
    server_id: UUID,
    message_data: dict,  # {content, scope, zone_id?, target_user_id?}
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send chat message
    
    Flow:
    1. Validate user is member of server
    2. Create ChatMessage in PostgreSQL
    3. Publish to Redis channel: chat:server:{id}:messages
    4. Cache in Redis list: chat:server:{id}:recent
    5. Broadcast via WebSocket to connected clients
    """
    pass


@router.post("/servers/{server_id}/chat/{message_id}/edit")
async def edit_message(
    server_id: UUID,
    message_id: UUID,
    new_content: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Edit message (only if owned by user, within 15 minutes)"""
    pass


@router.post("/servers/{server_id}/chat/{message_id}/react")
async def add_reaction(
    server_id: UUID,
    message_id: UUID,
    emoji: str,  # "👍", "❤️", etc.
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Add/remove reaction to message"""
    pass


@router.post("/servers/{server_id}/chat/typing")
async def typing_indicator(
    server_id: UUID,
    is_typing: bool,
    current_user: User = Depends(get_current_user)
):
    """
    Update typing status
    
    Flow:
    1. Add user to Redis set: chat:server:{id}:typing (TTL 5s)
    2. Broadcast via WebSocket: {"type": "typing", "user_id": "..."}
    """
    pass
```

### Frontend Components

```typescript
// frontend/components/chat/ChatPanel.tsx
export function ChatPanel({ serverId }: { serverId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState<string[]>([]);
  
  useEffect(() => {
    // Load initial history
    fetchChatHistory();
    
    // Subscribe to new messages via WebSocket
    const handleMessage = (data: any) => {
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data.message]);
      } else if (data.type === 'typing') {
        setIsTyping(data.users);
      }
    };
    
    // Connect to chat WebSocket or reuse game WebSocket
    EventBus.on('chat-message', handleMessage);
    
    return () => EventBus.off('chat-message', handleMessage);
  }, []);
  
  return (
    <div className="flex flex-col h-full">
      {/* Message List */}
      <ScrollArea className="flex-1 p-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {isTyping.join(', ')} typing...
          </div>
        )}
      </ScrollArea>
      
      {/* Input */}
      <div className="border-t p-4">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            sendTypingIndicator(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              sendMessage();
            }
          }}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
}


// frontend/components/chat/MessageBubble.tsx
export function MessageBubble({ message }: { message: ChatMessage }) {
  const [showReactions, setShowReactions] = useState(false);
  
  return (
    <div className="group mb-4 hover:bg-muted/50 p-2 rounded">
      <div className="flex gap-2">
        <Avatar>
          <AvatarFallback>{message.username[0]}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-sm">{message.username}</span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.created_at)}
            </span>
          </div>
          
          <p className="text-sm mt-1">{message.content}</p>
          
          {/* Reactions */}
          {Object.entries(message.reactions || {}).map(([emoji, users]) => (
            <Button
              key={emoji}
              variant="neutral"
              size="sm"
              className="text-xs mt-1 mr-1"
              onClick={() => toggleReaction(emoji)}
            >
              {emoji} {users.length}
            </Button>
          ))}
          
          {/* Actions (shown on hover) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="ghost" onClick={() => setShowReactions(true)}>
              React
            </Button>
            <Button size="sm" variant="ghost">Reply</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Minimap with Map Outlines

### Backend Requirements

```python
# backend/app/api/servers.py (add endpoint)

@router.get("/{server_id}/minimap")
async def get_minimap_data(
    server_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate minimap data from Tiled map
    
    Returns: {
        "bounds": {"width": 30, "height": 20},  # in tiles
        "zones": [
            {"name": "Room_1", "x": 1, "y": 1, "width": 10, "height": 8, "type": "PRIVATE"},
            {"name": "Hall", "x": 1, "y": 10, "width": 30, "height": 10, "type": "PUBLIC"}
        ],
        "spawn_points": [{"name": "Spawn_main", "x": 15, "y": 18}],
        "collision_tiles": [[0,0], [0,1], ...]  # List of blocked tiles
    }
    """
    
    # Parse map JSON
    server = await db.get(Server, server_id)
    map_path = server.map_config.get("map_file")
    zones_data, spawn_points = parse_map_zones(map_path)
    
    # Extract collision layer tiles
    with open(map_path) as f:
        map_data = json.load(f)
    
    collision_layer = next(
        (layer for layer in map_data["layers"] if layer["name"] == "Collision"),
        None
    )
    
    collision_tiles = []
    if collision_layer:
        width = collision_layer["width"]
        for idx, tile_id in enumerate(collision_layer["data"]):
            if tile_id > 0:  # Non-zero = collision
                x = idx % width
                y = idx // width
                collision_tiles.append([x, y])
    
    return {
        "bounds": {"width": map_data["width"], "height": map_data["height"]},
        "zones": zones_data,
        "spawn_points": spawn_points,
        "collision_tiles": collision_tiles
    }
```

### Frontend Component

```typescript
// frontend/components/game/Minimap.tsx
'use client';

interface MinimapProps {
  serverId: string;
  playerPosition: { x: number; y: number };
  remotePlayers: Array<{ id: string; x: number; y: number; username: string }>;
}

export function Minimap({ serverId, playerPosition, remotePlayers }: MinimapProps) {
  const [mapData, setMapData] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    // Fetch minimap data once
    fetchAPI(`/servers/${serverId}/minimap`).then(setMapData);
  }, [serverId]);
  
  useEffect(() => {
    if (!canvasRef.current || !mapData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    // Scale factor (map is 30x20 tiles, render at 150x100px = 5px per tile)
    const SCALE = 5;
    const width = mapData.bounds.width * SCALE;
    const height = mapData.bounds.height * SCALE;
    
    canvas.width = width;
    canvas.height = height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // 1. Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // 2. Draw collision tiles (walls)
    ctx.fillStyle = '#444';
    mapData.collision_tiles?.forEach(([x, y]: [number, number]) => {
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    });
    
    // 3. Draw zone outlines
    mapData.zones.forEach((zone: any) => {
      const isPrivate = zone.type === 'PRIVATE';
      ctx.strokeStyle = isPrivate ? '#ff6b6b' : '#4dabf7';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        (zone.bounds.x / 32) * SCALE,
        (zone.bounds.y / 32) * SCALE,
        (zone.bounds.width / 32) * SCALE,
        (zone.bounds.height / 32) * SCALE
      );
      
      // Zone label
      ctx.fillStyle = '#fff';
      ctx.font = '8px sans-serif';
      ctx.fillText(
        zone.name,
        (zone.bounds.x / 32) * SCALE + 2,
        (zone.bounds.y / 32) * SCALE + 10
      );
    });
    
    // 4. Draw remote players (green dots)
    ctx.fillStyle = '#51cf66';
    remotePlayers.forEach((player) => {
      ctx.beginPath();
      ctx.arc(
        player.x * SCALE + SCALE / 2,
        player.y * SCALE + SCALE / 2,
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
    
    // 5. Draw local player (blue dot)
    ctx.fillStyle = '#339af0';
    ctx.beginPath();
    ctx.arc(
      playerPosition.x * SCALE + SCALE / 2,
      playerPosition.y * SCALE + SCALE / 2,
      4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
  }, [mapData, playerPosition, remotePlayers]);
  
  return (
    <Card className="fixed bottom-4 right-4 p-3 bg-card border-4 border-border z-50">
      <h3 className="text-sm font-bold mb-2">Map</h3>
      <canvas ref={canvasRef} className="border-2 border-border rounded" />
      
      {/* Legend */}
      <div className="mt-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#339af0] rounded-full border border-white" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#51cf66] rounded-full" />
          <span>Others</span>
        </div>
      </div>
    </Card>
  );
}
```

---

## Implementation Flow

### Phase 1: Foundation 
1. ✅ **Database migrations**
   - Add MediaSession, WebRTCSignal, ChatMessage, ChatAttachment tables
   - Run `alembic revision --autogenerate -m "add_webrtc_chat"`
   
2. ✅ **Redis schema setup**
   - Define keys in documentation
   - Test with `redis-cli`

### Phase 2: WebRTC Core 
1. **Backend signaling server**
   - Implement `/ws/{server_id}/signaling` endpoint
   - Test with 2 clients (offer/answer/ICE flow)
   
2. **Frontend RTCConnectionManager**
   - Create class with connection lifecycle
   - Test peer connection establishment
   
3. **Spatial audio**
   - Implement SpatialAudioManager backend calculations
   - Wire up Web Audio API panners/gain nodes

### Phase 3: Proximity Integration 
1. **Backend proximity detection**
   - `/media/peers` endpoint with spatial hash
   - Update Redis on every movement
   
2. **Frontend auto-connect**
   - Hook into Phaser position updates
   - Auto-connect/disconnect based on proximity
   
3. **Testing**
   - 3+ users walking around
   - Verify audio fades in/out smoothly

### Phase 4: Chat System 
1. **Backend chat APIs**
   - History, send, edit, react endpoints
   - WebSocket message routing
   
2. **Frontend chat panel**
   - MessageBubble, ChatPanel components
   - Infinite scroll pagination
   
3. **Features**
   - Typing indicators
   - Reactions
   - Threading (optional)

### Phase 5: Video UI 
1. **Floating tiles**
   - 4-5 closest peers shown as small video tiles
   
2. **Conference mode**
   - Full-screen grid layout
   - Screen share support
   
3. **Polish**
   - Connection quality indicators
   - Mute/unmute controls
   - Video on/off toggle

### Phase 6: Minimap
1. **Backend endpoint**
   - Parse map, extract zones + collisions
   
2. **Canvas rendering**
   - Draw zones, players, walls
   
3. **Real-time updates**
   - Subscribe to position events
   - Redraw on movement

---


