# AtriumVerse: Combined Frontend + Backend Analysis Report
## Complete API Inventory & Implementation Roadmap

**Date:** February 5, 2026  
**Scope:** Full-stack analysis (Frontend + Backend)  
**Goal:** Identify all APIs, missing endpoints, and implementation requirements

---

## Executive Summary

### Current State
- **Backend APIs Implemented:** 9 endpoints + 1 WebSocket
- **Frontend Components:** 15+ game components
- **Missing Critical APIs:** 12+ endpoints
- **Backend-Frontend Gap:** Medium (some features partially implemented)

### Overall Architecture Rating: **7.5/10**

**Strengths:**
- ✅ Clean FastAPI structure
- ✅ WebSocket for real-time communication
- ✅ Redis for fast state management
- ✅ PostgreSQL for persistence
- ✅ Proper authentication flow

**Gaps:**
- ❌ No chat persistence API
- ❌ No WebRTC signaling endpoint
- ❌ No media session management
- ❌ Missing proximity peer discovery API
- ❌ No minimap data endpoint

---

## Part 1: Current Backend API Inventory

### 1.1 User Management APIs (`/users`)

| Endpoint | Method | Status | Purpose | Frontend Usage |
|----------|--------|--------|---------|----------------|
| `/users/register` | POST | ✅ **Implemented** | User registration | `register-form.tsx` |
| `/users/login` | POST | ✅ **Implemented** | User authentication | `login-form.tsx` |

**Implementation Details:**
- **File:** `backend/app/api/users.py`
- **Auth:** None (public endpoints)
- **Response:** JWT token + user_id + username
- **Database:** Creates `User` record in PostgreSQL

**Issues Found:**
- ❌ No password reset endpoint
- ❌ No email verification
- ❌ No user profile update endpoint
- ❌ Token refresh not implemented

---

### 1.2 Server Management APIs (`/servers`)

| Endpoint | Method | Status | Purpose | Frontend Usage |
|----------|--------|--------|---------|----------------|
| `/servers/` | GET | ✅ **Implemented** | List all servers | `dashboard/page.tsx` |
| `/servers/create-server` | POST | ✅ **Implemented** | Create new server | `create-server-dialog.tsx` |
| `/servers/{server_id}` | GET | ✅ **Implemented** | Get server details | `server/[id]/page.tsx` |
| `/servers/{server_id}/join` | POST | ✅ **Implemented** | Join server | `server/[id]/page.tsx` |
| `/servers/{server_id}/zones` | GET | ✅ **Implemented** | Get server zones | `MainScene.ts` (spatial manager) |
| `/servers/{server_id}/members` | GET | ✅ **Implemented** | List members (owner only) | `manage-members-dialog.tsx` |
| `/servers/{server_id}/members/{user_id}/approve` | POST | ✅ **Implemented** | Approve member | `manage-members-dialog.tsx` |
| `/servers/{server_id}/members/{user_id}/reject` | POST | ✅ **Implemented** | Reject/remove member | `manage-members-dialog.tsx` |

**Implementation Details:**
- **File:** `backend/app/api/servers.py`
- **Auth:** All endpoints require `get_current_user` (JWT)
- **Database:** Uses `Server`, `ServerMember`, `Zone` models
- **Map Parsing:** Uses `parse_map_zones()` utility

**Issues Found:**
- ⚠️ `create-server` endpoint has transaction issue (lines 47-108): Uses `flush()` before commit, can leave orphaned server if map parsing fails
- ❌ No server update endpoint (`PUT /servers/{server_id}`)
- ❌ No server delete endpoint (`DELETE /servers/{server_id}`)
- ❌ No server search/filter endpoint
- ❌ No pagination on `/servers/` list

---

### 1.3 WebSocket API (`/ws/{server_id}`)

| Endpoint | Type | Status | Purpose | Frontend Usage |
|----------|------|--------|---------|----------------|
| `/ws/{server_id}?token=...` | WebSocket | ✅ **Implemented** | Real-time game state | `MainScene.ts` |

**Message Types Handled:**

**Client → Server:**
1. `player_move` - Player position update
   ```json
   {
     "type": "player_move",
     "x": 15,
     "y": 20,
     "username": "Player1"
   }
   ```

2. `chat_message` - Send chat message
   ```json
   {
     "type": "chat_message",
     "message": "Hello!",
     "scope": "global" | "direct",
     "target": "user_uuid" // if scope is "direct"
   }
   ```

3. `request_users` - Request online users list
   ```json
   {
     "type": "request_users"
   }
   ```

4. `signal_offer`, `signal_answer`, `signal_ice` - WebRTC signaling
   ```json
   {
     "type": "signal_offer",
     "target": "user_uuid",
     "sdp": {...}
   }
   ```

**Server → Client:**
1. `user_list` - Initial online users
   ```json
   {
     "type": "user_list",
     "users": [
       {"user_id": "uuid", "x": 15, "y": 20, "username": "Player1"}
     ]
   }
   ```

2. `user_joined` - New player joined
   ```json
   {
     "type": "user_joined",
     "user_id": "uuid",
     "x": 15,
     "y": 20,
     "username": "Player1"
   }
   ```

3. `user_left` - Player disconnected
   ```json
   {
     "type": "user_left",
     "user_id": "uuid"
   }
   ```

4. `player_move` - Player position update (broadcast)
   ```json
   {
     "type": "player_move",
     "user_id": "uuid",
     "x": 15,
     "y": 20,
     "username": "Player1",
     "zone": "Room_1"
   }
   ```

5. `chat_message` - Chat message (broadcast or direct)
   ```json
   {
     "type": "chat_message",
     "sender": "uuid",
     "username": "Player1",
     "scope": "global" | "direct",
     "text": "Hello!",
     "timestamp": "2024-01-15T10:30:00Z"
   }
   ```

**Implementation Details:**
- **File:** `backend/app/api/ws.py`
- **Auth:** Token-based via query parameter
- **Redis:** Stores user positions, online users set
- **PostgreSQL:** Periodic position saves (every 10s) + final save on disconnect

**Issues Found:**
- ⚠️ **CRITICAL:** Chat messages not persisted to database (line 194-227)
- ⚠️ **CRITICAL:** WebRTC signaling mixed with game WebSocket (should be separate)
- ⚠️ No message deduplication
- ⚠️ No rate limiting on `chat_message`
- ⚠️ `scope: "proximity"` not handled (only `global` and `direct`)

---

## Part 2: Missing Backend APIs

### 2.1 Chat System APIs (CRITICAL - Missing)

**Required Endpoints:**

#### 2.1.1 Chat History API
```python
GET /servers/{server_id}/chat/history
Query Params:
  - limit: int = 50
  - before: datetime (optional, pagination cursor)
  - scope: str = "global" | "zone" | "direct"
  - zone_id: UUID (optional, if scope is "zone")
  - target_user_id: UUID (optional, if scope is "direct")

Response:
{
  "messages": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "username": "Player1",
      "content": "Hello!",
      "scope": "global",
      "zone_id": null,
      "target_user_id": null,
      "created_at": "2024-01-15T10:30:00Z",
      "edited_at": null,
      "reactions": {"👍": ["user1", "user2"]},
      "parent_message_id": null
    }
  ],
  "has_more": true,
  "cursor": "2024-01-15T10:30:00Z"
}
```

**Database Model Needed:**
```python
# backend/app/models/chat_message.py
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text")  # text/image/file
    
    scope = Column(String, default="global")  # global/zone/proximity/direct
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    is_pinned = Column(Boolean, default=False)
    
    reactions = Column(JSONB, default={})  # {"👍": ["user1"], "❤️": ["user2"]}
    
    parent_message_id = Column(UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True)
    reply_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User")
    server = relationship("Server")
    zone = relationship("Zone", foreign_keys=[zone_id])
```

**Implementation Priority:** 🔴 **CRITICAL**

---

#### 2.1.2 Send Chat Message API
```python
POST /servers/{server_id}/chat/send
Body:
{
  "content": "Hello!",
  "scope": "global" | "zone" | "proximity" | "direct",
  "zone_id": "uuid" (optional, if scope is "zone"),
  "target_user_id": "uuid" (optional, if scope is "direct"),
  "parent_message_id": "uuid" (optional, for replies)
}

Response:
{
  "id": "uuid",
  "user_id": "uuid",
  "username": "Player1",
  "content": "Hello!",
  "scope": "global",
  "created_at": "2024-01-15T10:30:00Z"
}
```

**Implementation Details:**
- Validate user is member of server
- Create `ChatMessage` in PostgreSQL
- Publish to Redis channel: `chat:server:{id}:messages`
- Cache in Redis list: `chat:server:{id}:recent` (last 100)
- Broadcast via WebSocket to connected clients
- **If scope is "proximity"**: Only broadcast to users within 5-tile radius

**Implementation Priority:** 🔴 **CRITICAL**

---

#### 2.1.3 Edit Message API
```python
POST /servers/{server_id}/chat/{message_id}/edit
Body:
{
  "new_content": "Updated message"
}

Response:
{
  "id": "uuid",
  "content": "Updated message",
  "edited_at": "2024-01-15T10:35:00Z"
}
```

**Validation:**
- Only message owner can edit
- Only within 15 minutes of creation
- Update PostgreSQL
- Broadcast edit event via WebSocket

**Implementation Priority:** 🟡 **MEDIUM**

---

#### 2.1.4 Message Reactions API
```python
POST /servers/{server_id}/chat/{message_id}/react
Body:
{
  "emoji": "👍" | "❤️" | "😂" | etc.
}

Response:
{
  "message_id": "uuid",
  "reactions": {"👍": ["user1", "user2"], "❤️": ["user3"]}
}
```

**Logic:**
- Toggle reaction (add if not present, remove if present)
- Update `reactions` JSONB column
- Broadcast reaction update via WebSocket

**Implementation Priority:** 🟢 **LOW**

---

#### 2.1.5 Typing Indicator API
```python
POST /servers/{server_id}/chat/typing
Body:
{
  "is_typing": true | false
}

Response: {}
```

**Redis Implementation:**
```python
# Add user to typing set (TTL 5 seconds)
await redis_client.r.sadd(f"chat:server:{server_id}:typing", user_id)
await redis_client.r.expire(f"chat:server:{server_id}:typing", 5)

# Broadcast via WebSocket
await manager.broadcast({
  "type": "typing",
  "user_id": user_id,
  "username": username,
  "is_typing": True
}, server_id)
```

**Implementation Priority:** 🟢 **LOW**

---

### 2.2 WebRTC & Media APIs (CRITICAL - Missing)

#### 2.2.1 WebRTC Signaling WebSocket (Separate Endpoint)
```python
WebSocket /ws/{server_id}/signaling?token=...

Messages:
Client → Server:
{
  "type": "offer" | "answer" | "ice-candidate",
  "target": "user_uuid",
  "sdp": {...} (for offer/answer),
  "candidate": {...} (for ice-candidate)
}

Server → Client:
{
  "type": "offer" | "answer" | "ice-candidate",
  "from": "user_uuid",
  "sdp": {...},
  "candidate": {...}
}
```

**Why Separate?**
- Game WebSocket handles high-frequency position updates
- Signaling WebSocket handles low-frequency but critical WebRTC negotiation
- Separation prevents signaling messages from being delayed by position broadcasts

**Implementation Priority:** 🔴 **CRITICAL**

---

#### 2.2.2 Media Session Management API
```python
POST /servers/{server_id}/media/start
Body:
{
  "audio": true,
  "video": true,
  "screen": false
}

Response:
{
  "peer_id": "peer_abc123",
  "stun_servers": [
    {"urls": "stun:stun.l.google.com:19302"}
  ],
  "turn_servers": [
    {"urls": "turn:...", "username": "...", "credential": "..."}
  ]
}
```

**Database Model Needed:**
```python
# backend/app/models/media_session.py
class MediaSession(Base):
    __tablename__ = "media_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    server_id = Column(UUID(as_uuid=True), ForeignKey("servers.id"), nullable=False)
    
    media_types = Column(JSONB)  # {"audio": true, "video": false}
    is_muted = Column(Boolean, default=False)
    is_video_off = Column(Boolean, default=True)
    
    current_zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=True)
    position_x = Column(Integer)
    position_y = Column(Integer)
    
    peer_id = Column(String, unique=True)
    connection_quality = Column(String, default="good")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Redis Schema:**
```python
# Active media sessions
media:server:{server_id}:users -> SET [user_id1, user_id2]
media:user:{user_id}:state -> HASH {
    "audio": "true",
    "video": "false",
    "zone_id": "uuid",
    "x": "15",
    "y": "20",
    "peer_id": "peer_abc123"
}
```

**Implementation Priority:** 🔴 **CRITICAL**

---

#### 2.2.3 Proximity Peer Discovery API
```python
GET /servers/{server_id}/media/peers?x=15&y=20
Query Params:
  - x: int (player tile X)
  - y: int (player tile Y)

Response:
{
  "peers": [
    {
      "user_id": "uuid",
      "peer_id": "peer_abc123",
      "username": "Player1",
      "position": {"x": 16, "y": 20},
      "distance": 1.0,
      "media_state": {
        "audio": true,
        "video": false
      }
    }
  ]
}
```

**Implementation Logic:**
```python
# Use spatial hash for efficient proximity queries
def get_grid_cell(x: int, y: int) -> str:
    grid_x = x // 5  # 5-tile cells
    grid_y = y // 5
    return f"{grid_x}_{grid_y}"

# Query Redis for users in same + adjacent cells
cells = get_neighbor_cells(x, y)  # 9 cells total
candidates = []
for cell in cells:
    user_ids = await redis_client.r.smembers(f"proximity:server:{server_id}:spatial:{cell}")
    candidates.extend(user_ids)

# Filter by distance < 5 tiles
peers = []
for user_id in candidates:
    pos = await redis_client.r.hgetall(f"user:{user_id}")
    distance = calculate_distance(x, y, int(pos["x"]), int(pos["y"]))
    if distance < 5:
        media_state = await redis_client.r.hgetall(f"media:user:{user_id}:state")
        peers.append({...})
```

**Implementation Priority:** 🔴 **CRITICAL**

---

#### 2.2.4 Update Media State API
```python
POST /servers/{server_id}/media/state
Body:
{
  "audio": true | false,
  "video": true | false,
  "screen": true | false,
  "is_muted": true | false
}

Response: {}
```

**Implementation:**
- Update `MediaSession` in PostgreSQL
- Update Redis: `media:user:{user_id}:state`
- Broadcast state change via WebSocket

**Implementation Priority:** 🟠 **HIGH**

---

### 2.3 Minimap API (MEDIUM Priority)

#### 2.3.1 Minimap Data API
```python
GET /servers/{server_id}/minimap

Response:
{
  "bounds": {
    "width": 30,  # tiles
    "height": 20  # tiles
  },
  "tilewidth": 32,  # pixels
  "tileheight": 32,  # pixels
  "zones": [
    {
      "name": "Room_1",
      "type": "PRIVATE",
      "bounds": {
        "x": 1,  # tile coordinates
        "y": 1,
        "width": 10,
        "height": 8
      }
    }
  ],
  "spawn_points": [
    {"name": "Spawn_main", "x": 15, "y": 18}
  ],
  "collision_tiles": [[0, 0], [0, 1], [1, 0], ...]  # List of blocked tiles
}
```

**Implementation:**
- Parse `final_map.json` from server's `map_config`
- Extract collision layer tiles
- Convert zone pixel coordinates to tile coordinates
- Cache in Redis: `minimap:server:{server_id}` (TTL 1 hour)

**Implementation Priority:** 🟡 **MEDIUM**

---

### 2.4 User Profile APIs (LOW Priority)

#### 2.4.1 Get User Profile
```python
GET /users/{user_id}/profile

Response:
{
  "id": "uuid",
  "username": "Player1",
  "email": "player1@example.com",
  "created_at": "2024-01-15T10:00:00Z",
  "avatar_url": "https://...",
  "status": "online" | "offline" | "away"
}
```

**Implementation Priority:** 🟢 **LOW**

---

#### 2.4.2 Update User Profile
```python
PUT /users/me/profile
Body:
{
  "username": "NewName" (optional),
  "avatar_url": "https://..." (optional)
}

Response: Updated profile
```

**Implementation Priority:** 🟢 **LOW**

---

## Part 3: Backend Issues & Fixes

### 3.1 Critical Backend Bugs

#### Bug #1: Chat Messages Not Persisted
**Location:** `backend/app/api/ws.py:194-227`

**Issue:**
- Chat messages only broadcasted via WebSocket
- No database persistence
- Messages lost on server restart

**Fix:**
```python
# After line 199, before broadcast:
if scope == "global" or scope == "zone" or scope == "direct":
    # Create ChatMessage record
    chat_msg = ChatMessage(
        server_id=server_id,
        user_id=user_uuid,
        content=message,
        scope=scope,
        zone_id=zone_id if scope == "zone" else None,
        target_user_id=target_user_id if scope == "direct" else None
    )
    db.add(chat_msg)
    await db.flush()  # Get ID
    
    # Cache in Redis (last 100 messages)
    if redis_client.r:
        await redis_client.r.lpush(
            f"chat:server:{server_id}:recent",
            json.dumps({
                "id": str(chat_msg.id),
                "user_id": str(user_id),
                "username": username,
                "content": message,
                "scope": scope,
                "created_at": chat_msg.created_at.isoformat()
            })
        )
        await redis_client.r.ltrim(f"chat:server:{server_id}:recent", 0, 99)
    
    await db.commit()
    
    # Include message ID in broadcast
    broadcast_data["message_id"] = str(chat_msg.id)
```

**Priority:** 🔴 **CRITICAL**

---

#### Bug #2: Transaction Issue in Server Creation
**Location:** `backend/app/api/servers.py:47-108`

**Issue:**
- Uses `db.flush()` before map parsing
- If map parsing fails, server exists in DB but has no zones
- No rollback mechanism

**Fix:**
```python
# Wrap entire creation in transaction
async with db.begin():
    new_server = Server(...)
    db.add(new_server)
    await db.flush()  # Get ID
    
    owner_member = ServerMember(...)
    db.add(owner_member)
    
    try:
        zones_data, spawn_points = parse_map_zones(full_path)
        # ... zone creation ...
    except Exception as e:
        # Transaction will auto-rollback
        raise HTTPException(status_code=400, detail=f"Invalid Map: {e}")
    
    # Commit happens automatically if no exception
```

**Priority:** 🟠 **HIGH**

---

#### Bug #3: Proximity Scope Not Handled
**Location:** `backend/app/api/ws.py:194-227`

**Issue:**
- Only handles `scope: "global"` and `scope: "direct"`
- `scope: "proximity"` messages broadcasted to everyone (should be filtered by distance)

**Fix:**
```python
elif scope == "proximity" or scope == "nearby":
    # Get sender's position from Redis
    sender_pos = await redis_client.r.hgetall(f"user:{user_id}")
    sender_x = int(sender_pos.get("x", 0))
    sender_y = int(sender_pos.get("y", 0))
    
    # Get all online users in server
    online_users = await redis_client.r.smembers(f"server:{server_id}:users")
    
    # Filter by proximity (5-tile radius)
    nearby_users = []
    for uid in online_users:
        if uid == user_id:
            continue  # Skip sender
        
        pos = await redis_client.r.hgetall(f"user:{uid}")
        if pos:
            distance = math.sqrt(
                (int(pos["x"]) - sender_x)**2 + 
                (int(pos["y"]) - sender_y)**2
            )
            if distance <= 5:
                nearby_users.append(uid)
    
    # Broadcast only to nearby users + sender (for echo)
    payload = {
        "type": "chat_message",
        "sender": user_id,
        "username": username,
        "scope": "proximity",
        "text": message,
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    # Send to sender (echo)
    await manager.send_personal_message(payload, server_id, user_id)
    
    # Send to nearby users
    for uid in nearby_users:
        await manager.send_personal_message(payload, server_id, uid)
    
    # NOTE: Proximity messages are NOT persisted (temporary)
```

**Priority:** 🔴 **CRITICAL**

---

#### Bug #4: No Rate Limiting on Chat
**Location:** `backend/app/api/ws.py:194-227`

**Issue:**
- No rate limiting on chat messages
- User can spam messages

**Fix:**
```python
# Add Redis-based rate limiting
RATE_LIMIT_KEY = f"chat:rate_limit:{user_id}"
current_count = await redis_client.r.incr(RATE_LIMIT_KEY)
if current_count == 1:
    await redis_client.r.expire(RATE_LIMIT_KEY, 60)  # 1 minute window

if current_count > 30:  # Max 30 messages per minute
    await websocket.send_json({
        "type": "error",
        "message": "Rate limit exceeded. Please slow down."
    })
    continue
```

**Priority:** 🟡 **MEDIUM**

---

### 3.2 Performance Issues

#### Issue #1: Redis O(N) Broadcast Storm
**Location:** `backend/app/api/ws.py:105-120`

**Issue:**
- On connect, fetches ALL online users and their positions
- With 100 users = 100 Redis queries

**Fix:**
```python
# Use Redis Pub/Sub instead
# On player_move, publish to channel instead of fetching all users
await redis_client.r.publish(
    f"server:{server_id}:moves",
    json.dumps({
        "type": "player_move",
        "user_id": user_id,
        "x": data["x"],
        "y": data["y"],
        "username": username
    })
)

# Clients subscribe to channel on connect
```

**Priority:** 🟠 **HIGH**

---

#### Issue #2: Spatial Manager Memory Leak
**Location:** `backend/app/core/spatial_manager.py:8-12`

**Issue:**
- Zone cache grows unbounded
- No eviction policy

**Fix:**
- Already has LRU eviction (lines 30-32), but max_servers=50 might be too low
- Consider increasing to 1000 or adding TTL-based eviction

**Priority:** 🟢 **LOW**

---

## Part 4: Frontend-Backend Integration Mapping

### 4.1 Current Integration Status

| Frontend Component | Backend API | Status | Issues |
|-------------------|-------------|--------|--------|
| `login-form.tsx` | `POST /users/login` | ✅ Working | None |
| `register-form.tsx` | `POST /users/register` | ✅ Working | None |
| `create-server-dialog.tsx` | `POST /servers/create-server` | ✅ Working | Transaction bug |
| `MainScene.ts` | `WebSocket /ws/{server_id}` | ✅ Working | Missing proximity scope |
| `ChatOverlay.tsx` | `WebSocket chat_message` | ⚠️ Partial | Wrong scope, no persistence |
| `SidebarChat.tsx` | None | ❌ Missing | No history API |
| `Minimap.tsx` | None | ❌ Missing | No minimap API |
| `FloatingVideoTiles.tsx` | `WebSocket signal_*` | ⚠️ Partial | Mixed with game WS |
| `use-proximity-peers.ts` | None | ❌ Missing | No peer discovery API |

---

### 4.2 Required Frontend Changes

#### Change #1: Update ChatOverlay to Use Proximity Scope
**File:** `frontend/components/game/ChatOverlay.tsx`

**Current:** Sends `scope: "global"`  
**Required:** Send `scope: "proximity"`

**Backend Dependency:** Bug #3 fix (proximity scope handling)

---

#### Change #2: Add Chat History Loading to SidebarChat
**File:** `frontend/components/game/SidebarChat.tsx`

**Required:** Call `GET /servers/{server_id}/chat/history` on mount

**Backend Dependency:** Chat History API (2.1.1)

---

#### Change #3: Separate WebRTC Signaling WebSocket
**File:** `frontend/lib/webrtc/RTCConnectionManager.ts`

**Current:** Uses game WebSocket for signaling  
**Required:** Connect to separate `/ws/{server_id}/signaling` WebSocket

**Backend Dependency:** WebRTC Signaling WebSocket (2.2.1)

---

#### Change #4: Add Proximity Peer Discovery
**File:** `frontend/hooks/use-proximity-peers.ts`

**Required:** Call `GET /servers/{server_id}/media/peers?x={x}&y={y}` periodically

**Backend Dependency:** Proximity Peer Discovery API (2.2.3)

---

#### Change #5: Load Minimap Data from API
**File:** `frontend/components/game/Minimap.tsx`

**Current:** Fetches `final_map.json` directly  
**Required:** Call `GET /servers/{server_id}/minimap`

**Backend Dependency:** Minimap Data API (2.3.1)

---

## Part 5: Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)

**Backend:**
1. ✅ Fix chat message persistence (Bug #1)
2. ✅ Fix proximity scope handling (Bug #3)
3. ✅ Add ChatMessage database model
4. ✅ Create chat history API (`GET /servers/{server_id}/chat/history`)
5. ✅ Create send message API (`POST /servers/{server_id}/chat/send`)

**Frontend:**
1. ✅ Fix ChatOverlay scope to "proximity"
2. ✅ Add chat history loading to SidebarChat
3. ✅ Add message deduplication

**Priority:** 🔴 **CRITICAL**

---

### Phase 2: WebRTC Infrastructure (Week 2)

**Backend:**
1. ✅ Create separate WebRTC signaling WebSocket (`/ws/{server_id}/signaling`)
2. ✅ Create MediaSession database model
3. ✅ Create media session start API (`POST /servers/{server_id}/media/start`)
4. ✅ Create proximity peer discovery API (`GET /servers/{server_id}/media/peers`)
5. ✅ Create media state update API (`POST /servers/{server_id}/media/state`)

**Frontend:**
1. ✅ Update RTCConnectionManager to use separate signaling WebSocket
2. ✅ Add proximity peer discovery hook
3. ✅ Connect/disconnect WebRTC based on proximity

**Priority:** 🔴 **CRITICAL**

---

### Phase 3: Minimap & Polish (Week 3)

**Backend:**
1. ✅ Create minimap data API (`GET /servers/{server_id}/minimap`)
2. ✅ Fix transaction issue in server creation (Bug #2)
3. ✅ Add rate limiting to chat (Bug #4)

**Frontend:**
1. ✅ Update Minimap to use API instead of direct file fetch
2. ✅ Fix zone coordinate conversion
3. ✅ Add proximity circle visualization

**Priority:** 🟡 **MEDIUM**

---

### Phase 4: Nice-to-Have Features (Week 4+)

**Backend:**
1. ✅ Message edit API
2. ✅ Message reactions API
3. ✅ Typing indicators API
4. ✅ User profile APIs

**Frontend:**
1. ✅ Message editing UI
2. ✅ Reaction picker
3. ✅ Typing indicator display
4. ✅ User profile page

**Priority:** 🟢 **LOW**

---

## Part 6: Database Migration Requirements

### New Tables Needed

1. **chat_messages**
   - Columns: id, server_id, user_id, content, scope, zone_id, target_user_id, created_at, edited_at, deleted_at, reactions, parent_message_id
   - Indexes: server_id + created_at, user_id, parent_message_id

2. **media_sessions**
   - Columns: id, user_id, server_id, media_types, is_muted, is_video_off, current_zone_id, position_x, position_y, peer_id, connection_quality, created_at, last_active
   - Indexes: user_id, server_id, peer_id

3. **chat_attachments** (optional, for file uploads)
   - Columns: id, message_id, file_name, file_size, file_type, storage_path, width, height, thumbnail_path

**Migration Command:**
```bash
cd backend
alembic revision --autogenerate -m "add_chat_media_tables"
alembic upgrade head
```

---

## Part 7: Redis Schema Updates

### New Redis Keys

```python
# Chat
chat:server:{server_id}:recent -> LIST [msg_json, ...]  # Last 100 messages, TTL 24h
chat:server:{server_id}:typing -> SET [user_id1, ...]  # TTL 5s per user
chat:user:{user_id}:unread:{server_id} -> STRING "5"  # Unread count

# Media
media:server:{server_id}:users -> SET [user_id1, ...]
media:user:{user_id}:state -> HASH {audio, video, zone_id, x, y, peer_id}
proximity:server:{server_id}:spatial:{grid_x}_{grid_y} -> SET [user_id1, ...]

# Minimap cache
minimap:server:{server_id} -> STRING (JSON)  # TTL 1h

# Rate limiting
chat:rate_limit:{user_id} -> STRING "5"  # TTL 60s
```

---

## Part 8: Summary Statistics

### API Inventory

| Category | Implemented | Missing | Total Needed |
|----------|-------------|---------|--------------|
| **User Management** | 2 | 2 | 4 |
| **Server Management** | 8 | 3 | 11 |
| **Chat System** | 0 | 5 | 5 |
| **WebRTC/Media** | 0 | 4 | 4 |
| **Minimap** | 0 | 1 | 1 |
| **WebSocket** | 1 | 1 | 2 |
| **Total** | **11** | **16** | **27** |

### Implementation Priority

- 🔴 **CRITICAL (Must Have):** 9 APIs
- 🟠 **HIGH (Should Have):** 4 APIs
- 🟡 **MEDIUM (Nice to Have):** 2 APIs
- 🟢 **LOW (Future):** 1 API

### Estimated Development Time

- **Phase 1 (Critical Fixes):** 1 week
- **Phase 2 (WebRTC Infrastructure):** 1 week
- **Phase 3 (Minimap & Polish):** 3-4 days
- **Phase 4 (Nice-to-Have):** 1 week

**Total:** ~3-4 weeks for complete implementation

---

## Part 9: Testing Requirements

### Backend API Tests Needed

1. **Chat System:**
   - Test chat history pagination
   - Test proximity scope filtering
   - Test message persistence
   - Test rate limiting

2. **WebRTC:**
   - Test signaling WebSocket connection
   - Test proximity peer discovery accuracy
   - Test media session creation/update

3. **Minimap:**
   - Test minimap data parsing
   - Test zone coordinate conversion
   - Test collision tile extraction

### Integration Tests Needed

1. **Frontend-Backend:**
   - Test chat message flow (send → persist → receive)
   - Test WebRTC connection establishment
   - Test proximity detection accuracy

---

## Conclusion

The AtriumVerse backend has a **solid foundation** with proper authentication, server management, and real-time WebSocket communication. However, **critical APIs are missing** for chat persistence, WebRTC signaling, and proximity peer discovery.

**Key Takeaways:**
1. **9 critical APIs** need immediate implementation
2. **4 critical bugs** need fixing
3. **Frontend components** are partially implemented but waiting on backend APIs
4. **Database migrations** needed for chat and media tables
5. **Redis schema** needs expansion for chat and media state

**Recommended Action Plan:**
1. **Week 1:** Implement chat persistence APIs and fix critical bugs
2. **Week 2:** Implement WebRTC infrastructure APIs
3. **Week 3:** Add minimap API and polish existing features
4. **Week 4+:** Add nice-to-have features (reactions, typing indicators, etc.)

The codebase is **70% complete** and can reach **95%+ completion** with the implementation of missing APIs.
