# System Design & Architecture Flow

## 1. High-Level Concept

The application blends Discord's **Server/Channel** structure with Gather.town's **Spatial/Map** interaction.

- **Discord Model**: Users join "Servers" (Communities).
- **Gather Model**: Instead of a text list of channels, the "Server" is a **Game World** (Map).
- **Zones**: Specific areas on the Map act like "Voice Channels".
  - **Public Zones**: Open space (Proximity Chat).
  - **Private Zones**: Conference rooms (Private Meeting ID, isolated audio/video).

## 2. User Flow

1.  **Sign Up / Login**: User authenticates.
2.  **Dashboard (Lobby)**: User sees a list of "Servers" they are a member of.
    - _Action_: "Create Server" -> User selects a Map Template (e.g., Office, Park).
3.  **Join Server**: User enters the Game World.
    - User spawns at a default `SpawnPoint` (defined in Map).
    - User sees other players moving in real-time.
4.  **Interaction**:
    - **Walking**: User moves around.
    - **Proximity Chat**: As User A gets close to User B, their video/audio fades in.
    - **Private Zones**: User walks into a simplified "Meeting Room" tile area (e.g., "Room_1").
      - They are now "isolated" from the outside world.
      - They only hear/see others inside that specific Zone.

## 3. Data Model (Database Schema)

We need a structured relational schema to handle membership, persistence, and interaction.

### Entities

#### 1. User (Identity)

- `id`: UUID (PK)
- `username`: String
- `email`: String
- `is_active`: Boolean

#### 2. Server (The World)

- `id`: UUID (PK)
- `owner_id`: UUID (FK -> User)
- `name`: String
- `access_type`: `PUBLIC` | `PRIVATE`
- `map_config`: JSON (Map file path, default spawn)
- `is_template`: Boolean

#### 3. Zone (Spatial Logic)

- `id`: UUID (PK)
- `server_id`: UUID (FK -> Server)
- `name`: String
- `type`: `PUBLIC` | `PRIVATE`
- `bounds`: JSON `{ x, y, width, height }`

#### 4. ServerMember (Persistence & Access)

- `id`: UUID (PK)
- `user_id`: UUID (FK -> User)
- `server_id`: UUID (FK -> Server)
- `role`: `OWNER` | `ADMIN` | `MEMBER` | `GUEST`
- `status`: `PENDING` | `ACCEPTED` | `BANNED`
- `last_position_x`: Integer
- `last_position_y`: Integer
- `last_updated`: DateTime

## 5. Dynamic Zone Management (Admin Control)

1.  **Map vs DB**: The Map file (`.json`) provides the _initial_ zones and physical layout. The **Database** is the source of truth for properties (Name, Type).
2.  **Overrides**: Admins can edit Zones via the Dashboard.
    - _Example_: Rename "Room_1" -> "Engineering".
    - _Example_: Change Type `PUBLIC` -> `PRIVATE`.
3.  **API**: updates via `PATCH /servers/{id}/zones/{zone_id}`.

## 6. Real-Time Logic (The "Magic")

#### 5. ChatMessage (Communication)

- `id`: UUID (PK)
- `server_id`: UUID (FK -> Server)
- `user_id`: UUID (FK -> User)
- `content`: Text
- `scope`: `GLOBAL` | `LOCAL` | `WHISPER`
- `created_at`: DateTime

## 6. Comprehensive API Architecture

### A. Authentication

- `POST /register`
- `POST /login`
- `GET /me`

### B. Server Management

- `GET /` (List user's servers)
- `POST /` (Create new server)
- `GET /{id}` (Map config, zones)

### C. Membership & Access

- `POST /join`
- `GET /` (List members)
- `PUT /{userId}` (Roles)

### D. Chat (`/servers/{id}/chat`)

- `GET /history` (Fetch recent global messages)
- `POST /` (Send message - usually handled via WebSocket for speed, but REST backup exists)

### E. Real-Time Gateway (WebSocket)

- **Events (Client -> Server)**:
  - `player_move`: `{x, y, direction}`
  - `chat_message`: `{content, scope}`
  - `interact`: `{objectId}`
- **Events (Server -> Client)**:
  - `player_moved`: `{userId, x, y}`
  - `user_joined` / `user_left`
  - `chat_message`: `{userId, content, scope}`
- **Signaling (Star Topology)**:
  - _Purpose_: "Handshaking".
  - _Flow_: Client A sends "Call Me" -> Server -> Client B.
  - _Why_: Clients don't know each other's IP. Server introduces them.
- **Media (Mesh Topology)**:
  - _Purpose_: Actual Video/Audio.
  - _Flow_: Client A <-> Client B (Direct).
  - _Why_: Low latency, $0 server cost.
  - _Limit_: Logic must strictly limit connections to **nearest 4 neighbors** to prevent bandwidth explosion.

### F. Security & Access Control (Critical)

1.  **Auth Middleware**:
    - All routes (except `/login`, `/register`) **MUST** require a valid JWT.
    - `UserDeps` dependency to be injected in every API route.
2.  **Role Middleware**:
    - `Owner` IS the `Admin`.
    - Only `Owner` can: Edit Zones, Ban Members, Delete Server.
3.  **WebSocket Auth**:
    - Connection URL must include `?token=...`.
    - Reject immediately if invalid.
