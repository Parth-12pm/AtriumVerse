# AtriumVerse — Latency & Update Analysis
### Line-by-Line Fixes (No Assumptions)

---

## How This Document Works

Every issue is mapped to an **exact file, exact lines, and exact code**. Each entry has three sections:

- **Current code** — what is in your file right now, verbatim.
- **Problem** — what is wrong with it specifically.
- **Fixed code** — drop-in replacement.

Nothing is summarised. Nothing is assumed. Everything is traced from your actual code.

---
---

# PART A — BACKEND

---

## Issue 1 — `ws.py`: Redis write blocks the broadcast path

**File:** `backend/app/api/ws.py`
**Lines:** 63–80 (inside the `if data.get("type") == "player_move":` block)

### Current code
```python
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
```

### Problem
Step A (`hset`) is `await`ed **before** Step C (`broadcast`). The `hset` round-trip to Redis (even locally, ~0.1–0.5 ms; over a network, 1–5 ms) adds directly to every single player_move that goes out. The broadcast cannot start until Redis confirms the write. Redis persistence is not needed for the broadcast — it is only needed so that a *new joiner* can recover positions. These are two independent concerns.

### Fixed code
```python
                if current_time - last_broadcast_time > 0.02:

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

                    last_broadcast_time = current_time
```

You need to add this import at the top of `ws.py`:
```python
import asyncio
```

---

## Issue 2 — `ws.py`: Double throttle gate — client AND server both throttle independently

**File:** `backend/app/api/ws.py`
**Line:** 63

### Current code
```python
                if current_time - last_broadcast_time > 0.02:
```

### Problem
Your client (`MainScene.ts`) already throttles sends to every 25 ms. Then this server-side gate drops any message that arrives within 20 ms of the last one. These two windows do not align. A message sent at client time T=25 ms might arrive at server time T=21 ms (network jitter) and get dropped because the server last broadcast at T=1 ms. The result is unpredictable frame drops — sometimes you move, sometimes you don't, and there is no pattern.

The client is already the rate-limiter. The server should trust it and relay. If you want a server-side safety cap, match it to the client value or remove it entirely.

### Fixed code
```python
                # Remove the server-side throttle gate entirely.
                # The client already throttles at 25ms. Just process every message.

                # B. Spatial Check
                zone = spatial_manager.check_zone(data["x"], data["y"], server_id)

                # C. Broadcast
                await manager.broadcast({
                    ...
                }, server_id, websocket)

                # A. Redis (fire and forget, see Issue 1)
                if redis_client.r:
                    asyncio.create_task(redis_client.r.hset(...))
```

Also remove the `last_broadcast_time` variable declaration (line ~60) and the `last_broadcast_time = current_time` update — they are no longer used.

---

## Issue 3 — `socket_manager.py`: Broadcast is sequential — every extra user adds latency

**File:** `backend/app/core/socket_manager.py`
**Lines:** 35–39

### Current code
```python
    async def broadcast(self, message:dict , server_id: str, sender: WebSocket):

        if server_id in self.active_connections:
            for connection in self.active_connections[server_id]:
                if connection != sender:
                    await connection.send_json(message)
```

### Problem
`send_json` is awaited one connection at a time. If you have 10 users, the 10th user does not receive the message until the 9 sends before it have each completed. Each `send_json` involves a kernel write + potential TCP buffering delay. With 20 users this becomes a meaningful stack of serial waits.

### Fixed code
```python
import asyncio  # add to top of file if not present

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
```

---

## Issue 4 — `ws.py`: `user_joined` is broadcast twice on connect

**File:** `backend/app/api/ws.py`
**Lines:** 39–46

### Current code
```python
    # 2. Connect Manager
    await manager.connect(websocket, server_id, user_id)

    # ...

    if redis_client.r:
        await redis_client.r.sadd(f"server:{server_id}:users", user_id)
        # Send initial user list
        online_users = await redis_client.r.smembers(f"server:{server_id}:users")
        await websocket.send_json({"type": "user_list", "users": list(online_users)})
        # Notify others
        await manager.broadcast({"type": "user_joined", "user_id": user_id}, server_id, websocket)
```

Now look at `socket_manager.py` `connect()`:

```python
    async def connect(self, websocket: WebSocket, server_id: str, user_id: str):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = []
        self.active_connections[server_id].append(websocket)

        # 🔔 CRITICAL: Tell everyone else "New User Joined!"
        await self.broadcast({"type": "user_joined", "user_id": user_id}, server_id, websocket)
```

### Problem
`user_joined` is sent once inside `manager.connect()` and then **again** on line 46 of `ws.py`. Every other client receives `user_joined` twice for the same user. In `MainScene.ts`, `handleServerMessage` for `user_joined` calls `spawnRemotePlayer`, which has a duplicate guard (`if (this.otherPlayers.has(userId)) return`), so the second call is silently dropped — but the message still travels over the wire and is parsed. More importantly, the first `user_joined` fires before `sadd` has run, so if any client immediately queries the user list, the new user is not in Redis yet.

**Remove the broadcast from `connect()`** — the `ws.py` code handles it in the correct order (add to Redis first, then broadcast).

### Fixed code in `socket_manager.py`:
```python
    async def connect(self, websocket: WebSocket, server_id: str, user_id: str):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = []
        self.active_connections[server_id].append(websocket)
        # Removed: broadcast is now done in ws.py AFTER Redis sadd
```

---

## Issue 5 — `ws.py`: `user_list` sends raw Redis set — decode issue on some Redis configs

**File:** `backend/app/api/ws.py`
**Line:** 43

### Current code
```python
        online_users = await redis_client.r.smembers(f"server:{server_id}:users")
        await websocket.send_json({"type": "user_list", "users": list(online_users)})
```

### Problem
`smembers` returns a Python `set`. `list(set)` has no guaranteed order and, depending on the Redis client config, members may come back as `bytes` not `str`. Your `redis_client.py` sets `decode_responses=True`, so this is fine *currently*, but `list(online_users)` is fragile. More critically: this list is sent before any `player_move` from the new user, so every existing client spawns the new player at the hardcoded default position `(15, 15)` (see `MainScene.ts` line in `user_list` handler). There is no position data attached.

### Fixed code
```python
        online_users = await redis_client.r.smembers(f"server:{server_id}:users")
        # Fetch positions for all online users so new joiner sees them correctly
        user_positions = []
        for uid in online_users:
            pos_data = await redis_client.r.hgetall(f"user:{uid}")
            user_positions.append({
                "user_id": uid,
                "x": int(pos_data.get("x", 15)),
                "y": int(pos_data.get("y", 15)),
                "username": pos_data.get("username", "Player")
            })
        await websocket.send_json({"type": "user_list", "users": user_positions})
```

This change requires a corresponding frontend change — see Issue 8.

---
---

# PART B — FRONTEND (MainScene.ts)

---

## Issue 6 — `MainScene.ts`: Remote players move at speed 4 — same as local, but always late

**File:** `frontend/game/scenes/MainScene.ts`
**Lines in `updateRemotePlayerPosition`:**

### Current code
```typescript
          // Lag Compensation / Catch-up Logic
          if (distance > 5) {
            // Teleport if too far
            this.gridEngine.setPosition(userId, { x, y });
          } else {
            // Speed boost if falling behind
            const BaseSpeed = 4;
            const CatchUpSpeed = 8; // Double speed to catch up

            if (distance > 1) {
              this.gridEngine.setSpeed(userId, CatchUpSpeed);
            } else {
              this.gridEngine.setSpeed(userId, BaseSpeed);
            }

            this.gridEngine.moveTo(userId, { x, y });
          }
```

### Problem
Three specific problems here:

1. **Teleport threshold is 5 tiles.** That is a huge distance on a 32px grid — 160 pixels of visible "snapping". A player has to be massively desynchronised before a teleport triggers. In practice this means laggy movement is the norm, teleport is the exception.

2. **BaseSpeed is 4 — identical to local player.** Remote players arrive via network with latency already baked in. If you then animate them at the same speed as real-time movement, the animation takes just as long as actual movement, so they are *always* one full tile behind where they should be by the time the sprite finishes moving.

3. **`moveTo` queues movement — it does not interrupt.** If a second `moveTo` arrives before the first finishes, grid-engine does NOT cancel the first one. It queues. So if updates arrive faster than the animation plays, you get a growing backlog of pending movements, and the player visibly trails further and further behind.

### Fixed code
```typescript
          // Teleport threshold: 3 tiles (not 5). 3 tiles = clearly wrong position.
          if (distance > 3) {
            this.gridEngine.setPosition(userId, { x, y });
          } else if (distance > 0) {
            // Speed is proportional to distance so animation finishes in ~1 frame
            // distance=1 -> speed 8, distance=2 -> speed 12, distance=3 -> speed 16
            const catchSpeed = 4 + (distance * 4);
            this.gridEngine.setSpeed(userId, catchSpeed);

            // moveTo with options.clear=true cancels any pending path first
            this.gridEngine.moveTo(userId, { x, y }, { clear: true });
          }
          // if distance === 0, do nothing — already there
```

Check your grid-engine version. If `{ clear: true }` is not available in your version, replace the `moveTo` block with:
```typescript
            // Cancel current movement, then issue new target
            this.gridEngine.setPosition(userId, this.gridEngine.getPosition(userId)); // stop
            this.gridEngine.moveTo(userId, { x, y });
```

---

## Issue 7 — `MainScene.ts`: `movementStopped` final position send is throttled and may be swallowed

**File:** `frontend/game/scenes/MainScene.ts`
**Lines in `movementStopped` subscriber:**

### Current code
```typescript
    this.gridEngine.movementStopped().subscribe(({ charId }) => {
      if (charId === "hero") {
        this.playerSprite.stop();

        const directionToRow: Record<string, number> = {
          down: 0,
          right: 1,
          up: 2,
          left: 3,
        };
        const row = directionToRow[this.lastDirection] ?? 0;
        const idleFrame = row * 4;
        this.playerSprite.setFrame(idleFrame);

        // FORCE SENT Final Position to ensure sync
        const finalPos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(finalPos.x, finalPos.y, this.lastDirection);
      }
    });
```

### Problem
`sendMovementToServer` has a throttle check inside it:
```typescript
    if (positionChanged && now - this.lastSentTime >= this.sendThrottleMs) {
```
`movementStopped` fires immediately after the last `movementStarted` — often within 25 ms. So `now - this.lastSentTime` is less than `sendThrottleMs`, and this send is **silently dropped**. The comment says "FORCE SENT" but the code does not force anything. If the target send from `movementStarted` was the same tile (e.g., bumped into a wall), then no final position ever reaches the server.

### Fixed code — add a `force` parameter to `sendMovementToServer`:

First, change the method signature and body:
```typescript
  private sendMovementToServer(x: number, y: number, direction: string, force: boolean = false) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    const positionChanged =
      this.lastSentPosition.x !== x || this.lastSentPosition.y !== y;

    // Send if: position changed AND (enough time passed OR force flag is set)
    if (positionChanged && (force || now - this.lastSentTime >= this.sendThrottleMs)) {
      this.socket.send(
        JSON.stringify({
          type: "player_move",
          x,
          y,
          username: this.myUsername,
        }),
      );

      this.lastSentPosition = { x, y };
      this.lastSentTime = now;
    }
  }
```

Then, in the `movementStopped` subscriber, pass `true`:
```typescript
        const finalPos = this.gridEngine.getPosition("hero");
        this.sendMovementToServer(finalPos.x, finalPos.y, this.lastDirection, true); // force = true
```

---

## Issue 8 — `MainScene.ts`: `user_list` handler spawns all remote players at (15, 15)

**File:** `frontend/game/scenes/MainScene.ts`
**Lines in `handleServerMessage`, case `"user_list"`:**

### Current code
```typescript
      case "user_list":
        console.log("👥 [MainScene] Online users:", data.users);

        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, data.users);

        data.users.forEach((userId: string) => {
          if (userId !== this.myId && !this.otherPlayers.has(userId)) {
            // Spawn at default position (they'll send their real position soon)
            this.spawnRemotePlayer(userId, "Player", 15, 15);
          }
        });
```

### Problem
Every remote player spawns at tile (15, 15) and then "teleports" or slides to their real position when their first `player_move` arrives. This is visible — you see players pop in at the wrong spot and jump. The comment says "they'll send their real position soon" but that is not true: they already *sent* it. Their position is in Redis right now.

This requires the backend fix from **Issue 5** to send positions in the `user_list` payload. Once that is done, update the client:

### Fixed code (requires Issue 5 backend change)
```typescript
      case "user_list":
        console.log("👥 [MainScene] Online users:", data.users);

        // data.users is now an array of objects: { user_id, x, y, username }
        const userIds = data.users.map((u: any) => u.user_id);
        EventBus.emit(GameEvents.PLAYER_LIST_UPDATE, userIds);

        data.users.forEach((user: { user_id: string; x: number; y: number; username: string }) => {
          if (user.user_id !== this.myId && !this.otherPlayers.has(user.user_id)) {
            // Spawn at their ACTUAL last-known position — no jump
            this.spawnRemotePlayer(user.user_id, user.username, user.x, user.y);
          }
        });

        // Send our position so others see us immediately
        if (this.gridEngine.hasCharacter("hero")) {
          const myPos = this.gridEngine.getPosition("hero");
          this.sendMovementToServer(myPos.x, myPos.y, this.lastDirection, true);
        }
        break;
```

---

## Issue 9 — `MainScene.ts`: Camera lerp at 0.08 adds visual lag to local player

**File:** `frontend/game/scenes/MainScene.ts`
**Line in `create()`:**

### Current code
```typescript
    this.cameras.main.startFollow(this.playerSprite, true, 0.08, 0.08);
```

### Problem
The two `0.08` values are the lerp factors for X and Y. `0.08` means the camera moves 8% of the remaining distance to the player each frame. At 60fps that feels smooth but it also means the camera *lags behind* the player visibly — the player moves, the camera follows a fraction of a second later. On a grid game where movement is discrete tile-to-tile, this creates a "sliding" feel that reads as lag even though the player input itself is instant.

### Fixed code
```typescript
    // 0.15 = noticeably snappier, still not jarring
    // 0.25 = tight follow, almost instant, good for grid movement
    // Set to 0 to disable lerp entirely (instant snap — try this first)
    this.cameras.main.startFollow(this.playerSprite, true, 0.2, 0.2);
```

Test with `0` first (instant) to confirm the lag disappears, then pick a lerp value that feels right.

---

## Issue 10 — `MainScene.ts`: `positionChangeFinished` only updates label position — `update()` does it every frame redundantly

**File:** `frontend/game/scenes/MainScene.ts`

### Current code — in `create()`:
```typescript
    this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
      if (charId === "hero") {
        const sprite = this.playerSprite;
        this.usernameText.setPosition(sprite.x + 5, sprite.y - 1);
      }
    });
```

### Current code — in `update()`:
```typescript
    // Update username label to follow player (just above head, slightly right)
    if (this.playerSprite && this.usernameText) {
      this.usernameText.setPosition(
        this.playerSprite.x + 5,
        this.playerSprite.y - 1,
      );
    }

    // Update remote player labels to follow their sprites
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 20);
    });
```

### Problem
The label position is set in two places: the `positionChangeFinished` subscription (fires once per tile) and `update()` (fires every frame, ~60 times per second). The subscription version is redundant — `update()` already handles it every frame. The `forEach` over `otherPlayers` in `update()` also runs every frame regardless of whether anyone moved. For small player counts this is fine, but it is wasted work.

### Fixed code
Remove the `positionChangeFinished` subscription entirely from `create()`:
```typescript
    // DELETE this entire block:
    // this.gridEngine.positionChangeFinished().subscribe(({ charId }) => {
    //   if (charId === "hero") {
    //     const sprite = this.playerSprite;
    //     this.usernameText.setPosition(sprite.x + 5, sprite.y - 1);
    //   }
    // });
```

Keep the `update()` label code as-is — it is the correct single place for per-frame label positioning. Grid-engine interpolates sprite positions between tiles during movement, so the label needs to update every frame to stay aligned, not just once per tile.

---

## Issue 11 — `MainScene.ts`: Remote player label Y offset is inconsistent with local

**File:** `frontend/game/scenes/MainScene.ts`

### Current code — local player label in `create()`:
```typescript
    this.usernameText = this.add.text(0, 0, this.myUsername, {
      fontSize: "10px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 0, y: 0 },
    });
    this.usernameText.setOrigin(0.5, 1);
```

### Current code — local label in `update()`:
```typescript
      this.usernameText.setPosition(
        this.playerSprite.x + 5,
        this.playerSprite.y - 1,   // <-- offset is -1
      );
```

### Current code — remote label in `update()`:
```typescript
    this.otherPlayers.forEach((player) => {
      player.text.setPosition(player.sprite.x, player.sprite.y - 20);  // <-- offset is -20
    });
```

### Problem
Local label is at `y - 1`. Remote labels are at `y - 20`. Both sprites are 16x32 at scale 1.5 (so visually 24x48 pixels), with origin `(0.5, 0.5)`. The label for local player sits essentially on top of the sprite. The label for remote players sits 20 pixels above — which looks correct. The local player label offset of `-1` is wrong; it should match.

### Fixed code — in `update()`, change the local label position:
```typescript
    if (this.playerSprite && this.usernameText) {
      this.usernameText.setPosition(
        this.playerSprite.x,        // remove the +5, center it like remote labels
        this.playerSprite.y - 20,   // match remote label offset
      );
    }
```

---

## Issue 12 — `MainScene.ts`: WebSocket connection does not reconnect on drop

**File:** `frontend/game/scenes/MainScene.ts`
**Lines in `initWebSocket()`:**

### Current code
```typescript
    this.socket.onclose = () => {
      console.log("🔌 [MainScene] WebSocket Disconnected");
    };
```

### Problem
If the WebSocket drops (server restart, network blip, timeout), `onclose` fires and logs. That is it. All subsequent movement sends silently fail (`sendMovementToServer` returns early because `readyState !== OPEN`). The player appears frozen to everyone else. There is no retry.

### Fixed code
```typescript
    this.socket.onclose = () => {
      console.log("🔌 [MainScene] WebSocket Disconnected — reconnecting in 2s...");
      this.socket = null;

      // Retry after 2 seconds, but only if the scene is still alive
      this.time.delayedCall(2000, () => {
        if (this.scene.isActive("MainScene")) {
          console.log("🔄 [MainScene] Attempting reconnect...");
          this.initWebSocket();
        }
      });
    };
```

The existing guard at the top of `initWebSocket` (`if (this.socket && this.socket.readyState === WebSocket.OPEN)`) will prevent double-connections if the reconnect fires while a connection is already live.

---
---

# PART C — FRONTEND (Other Files)

---

## Issue 13 — `use-webrtc.ts`: WebSocket URL does not match the server's WebSocket route

**File:** `frontend/hooks/use-webrtc.ts`
**Line 38:**

### Current code
```typescript
     const ws = new WebSocket(`ws://localhost:8000/ws/connect?room_id=${roomId}&user_id=${userId}`);
```

### Problem
Your backend WebSocket route (in `ws.py`) is:
```python
@router.websocket("/{server_id}")
```
Mounted at prefix `/ws` in `main.py`. So the actual URL is `ws://localhost:8000/ws/{server_id}?token=...`.

The URL in `use-webrtc.ts` is `/ws/connect?room_id=...&user_id=...`. This route does not exist on your backend. This hook will never connect. Additionally, it passes `user_id` as a query param — your backend authenticates via `token` query param, not `user_id`.

### Fixed code
```typescript
     // Match the actual backend route. roomId here IS the serverId.
     const token = localStorage.getItem("token") || "";
     const ws = new WebSocket(`ws://localhost:8000/ws/${roomId}?token=${token}`);
```

---

## Issue 14 — `use-webrtc.ts`: `localStream` cleanup runs on mount, not on unmount

**File:** `frontend/hooks/use-webrtc.ts`
**Lines 22–27:**

### Current code
```typescript
  useEffect(() => {
    async function startMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (err) {
            console.error(err);
            toast.error("Could not access camera/mic");
        }
    }
    startMedia();

    return () => {
        localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);
```

### Problem
The cleanup function captures `localStream` at the time the effect runs — which is the initial render. At that point, `localStream` is `null` (it hasn't been set yet; `startMedia` is async). So the cleanup function will always call `.forEach` on `null` and do nothing. The camera/mic tracks are never stopped on unmount.

### Fixed code — use a ref to hold the stream so the cleanup always has the latest value:

Add a ref at the top of the hook:
```typescript
  const localStreamRef = useRef<MediaStream | null>(null);
```

Update the effect:
```typescript
  useEffect(() => {
    async function startMedia() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;  // store in ref
            setLocalStream(stream);           // also set state for rendering
        } catch (err) {
            console.error(err);
            toast.error("Could not access camera/mic");
        }
    }
    startMedia();

    return () => {
        // Ref always has the current value, even in async cleanup
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
    };
  }, []);
```

---

## Issue 15 — `GameWrapperNew.tsx`: Module-level singleton prevents hot reload during development

**File:** `frontend/components/game/GameWrapperNew.tsx`
**Lines 14–15:**

### Current code
```typescript
let globalGameInstance: Phaser.Game | null = null;
let isInitializing = false;
```

### Problem
These are module-level variables. In Next.js development with Fast Refresh, the module is re-evaluated but these variables persist across re-renders *within the same page*. If you change `MainScene.ts` and save, the component re-mounts, but `globalGameInstance` is still the old game. The `if (globalGameInstance)` check returns early and reuses the stale instance. The new scene code never loads.

This is fine for production. It is a development friction point. The existing cleanup effect (`Final unmount - destroying game`) only runs on full page unmount, not on hot reload.

### Fixed code — add a dev-only reset when the component mounts fresh:
```typescript
  useEffect(() => {
    const initGame = async () => {
      // DEV ONLY: If scene data changed (e.g. hot reload), destroy stale game
      if (process.env.NODE_ENV === "development" && globalGameInstance) {
        console.log("[GameWrapper] Dev: destroying stale game for hot reload");
        globalGameInstance.destroy(true);
        globalGameInstance = null;
        isInitializing = false;
      }

      // ... rest of existing initGame logic unchanged
    };
    initGame();
    // ...
  }, [userId, username, serverId]);
```

---
---

# PART D — PRIORITY ORDER

Apply these in this order. Each one is independent, but the early ones have the most impact on perceived latency:

| Priority | Issue # | File | What it fixes |
|----------|---------|------|---------------|
| 1 | 3 | socket_manager.py | Broadcast becomes concurrent — biggest single backend win |
| 2 | 1 | ws.py | Redis no longer blocks broadcast path |
| 3 | 2 | ws.py | Remove double throttle — stops dropped frames |
| 4 | 6 | MainScene.ts | Remote players catch up correctly, no trailing |
| 5 | 9 | MainScene.ts | Camera follows player tightly |
| 6 | 7 | MainScene.ts | Final position always reaches server |
| 7 | 4 | socket_manager.py | Stop sending user_joined twice |
| 8 | 5 + 8 | ws.py + MainScene.ts | Remote players spawn at correct position |
| 9 | 12 | MainScene.ts | WebSocket reconnects on drop |
| 10 | 11 | MainScene.ts | Labels line up visually |
| 11 | 10 | MainScene.ts | Remove redundant subscription |
| 12 | 13 | use-webrtc.ts | WebRTC hook can actually connect |
| 13 | 14 | use-webrtc.ts | Camera/mic tracks stop on unmount |
| 14 | 15 | GameWrapperNew.tsx | Hot reload works in dev |
