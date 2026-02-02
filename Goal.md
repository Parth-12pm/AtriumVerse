# System Design & Architecture Flow

## 1. High-Level Concept
The application blends Discord's **Server/Channel** structure with Gather.town's **Spatial/Map** interaction.

*   **Discord Model**: Users join "Servers" (Communities).
*   **Gather Model**: Instead of a text list of channels, the "Server" is a **Game World** (Map).
*   **Zones**: Specific areas on the Map act like "Voice Channels".
    *   **Public Zones**: Open space (Proximity Chat).
    *   **Private Zones**: Conference rooms (Private Meeting ID, isolated audio/video).

## 2. User Flow

1.  **Sign Up / Login**: User authenticates.
2.  **Dashboard (Lobby)**: User sees a list of "Servers" they are a member of.
    *   *Action*: "Create Server" -> User selects a Map Template (e.g., Office, Park).
3.  **Join Server**: User enters the Game World.
    *   User spawns at a default `SpawnPoint` (defined in Map).
    *   User sees other players moving in real-time.
4.  **Interaction**:
    *   **Walking**: User moves around.
    *   **Proximity Chat**: As User A gets close to User B, their video/audio fades in.
    *   **Private Zones**: User walks into a simplified "Meeting Room" tile area (e.g., "Room_1").
        *    They are now "isolated" from the outside world.
        *   They only hear/see others inside that specific Zone.

## 3. Data Model (Database Schema)

We need to move away from generic "Rooms" to a structured hierarchy.

### Entities

*   **User**: The player.
*   **Server** (was `Guild`): Represents the Organization or Community.
    *   [id](file:///d:/python/AtriumVerse/frontend/components/game/VideoTiles.tsx#6-14): UUID
    *   `owner_id`: UUID
    *   `map_config`: JSON (Which map file to load, spawn points)
*   **Zone** (New Entity): A specific logical area within the Server.
    *   [id](file:///d:/python/AtriumVerse/frontend/components/game/VideoTiles.tsx#6-14): UUID
    *   `server_id`: UUID
    *   `name`: String (e.g., "Room_1", "Hall")
    *   `type`: `PUBLIC` (Infinite restricted audio) or `PRIVATE` (Conference Room)
    *   `bounds`: JSON `{ x, y, width, height }` (Matches Tiled Map Object)
    *   `meeting_id`: String (For external sharing/joining directly)

### Relationships
*   User -> MemberOf -> Server
*   Server -> HasMany -> Zones

## 4. Map Integration ([final_map.json](file:///d:/python/AtriumVerse/frontend/public/phaser_assets/maps/final_map.json))

Your map already contains an **Object Layer** named `Zones` (ID 8) with objects:
*   `Room_1` (x: 30, y: 21, w: 308, h: 232)
*   `Room_2`
*   `Room_3`
*   `Hall`

**The Workflow:**
1.  **Server Creation**: When a server is created using this map, the Backend reads [final_map.json](file:///d:/python/AtriumVerse/frontend/public/phaser_assets/maps/final_map.json).
2.  **Zone Injection**: The Backend creates `Zone` entries in the DB for `Room_1`, `Room_2`, etc.
3.  **Client Sync**: When a client joins, they receive the list of Zones.

## 5. Real-Time Logic (The "Magic")

This is where the standard "Room" logic changes to "Spatial" logic.

### A. The "World" State (Redis)
Instead of just [room_users](file:///d:/python/AtriumVerse/backend/app/core/socket_manager.py#26-32), we track **User Position**.

**Redis Key**: `server:{server_id}:positions` (Hash)
*   Field: `{user_id}`
*   Value: `{ x, y, current_zone_id, last_updated }`

### B. Movement & Proximity
1.  **User Moves**: Frontend sends `player_move { x, y }`.
2.  **Client Check**: Frontend physics checks if Player is inside "Room_1" rect.
3.  **Zone Change Event**:
    *   If User enters "Room_1", Client sends `zone_entered { zone_id: 'Room_1' }`.
    *   Backend updates Redis: `current_zone_id = Room_1`.
4.  **Broadcast**:
    *   Backend tells everyone: "User A entered Room 1".

### C. Audio/Video Connection Flow
The WebRTC connection strategy depends on the Zone.

*   **Scenario 1: Open World (Public Zone / Hall)**
    *   **Logic**: Proximity-based.
    *   **Frontend**: If `distance(UserA, UserB) < 300px` AND `UserB.zone == 'Hall'`, attach audio stream.
    *   **UI**: Media controls float near the avatar.
    *   **Voice Only**: Users can toggle "Mic Only" mode.

*   **Scenario 2: Private Meeting (Zone: Room_1)**
    *   **Logic**: Room-based.
    *   **Frontend**:
        *   User enters "Room_1".
        *   Frontend **Disconnects** from "Hall Proximity Group".
        *   Frontend **Connects** to "Room_1 Group".
    *   **Result**: complete isolation. You only hear/see people in Room_1. Distance doesn't matter.

## 6. Proposed Backend Architecture

```
/backend
  /app
    /api
      /auth       # Login/Signup
      /servers    # Create/Join Servers, Manage Zones
      /ws         # The Real-time Gateway
    /core
      /managers
        - connection_manager.py  # Handles WebSocket connections
        - state_manager.py       # Handles Player Position & Redis
        - zone_manager.py        # Logic for "Am I in a Private Zone?"
```

### Key API Changes needed
1.  **Rename `Rooms` to `Servers`**: To match the mental model.
2.  **Add `Zones` Endpoint**: To define where the private meeting areas are on the map.
3.  **Refactor WebSocket**:
    *   Accept `server_id` instead of `room_id`.
    *   Handle `zone_entry` and `zone_exit` events.
