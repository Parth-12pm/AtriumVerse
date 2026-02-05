# AtriumVerse Architecture - Complete System

## 🎮 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR VISION                               │
│         World → Zones → Communication (Lifecycle)                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PHASER GAME (MainScene.ts) - THE WORLD                   │  │
│  │                                                            │  │
│  │  • Player movement (Grid Engine)                          │  │
│  │  • Sprite rendering (Npc_test.png 64x128)                │  │
│  │  • Zone detection (checkZoneEntry)                       │  │
│  │  • Emits: ZONE_ENTER, ZONE_EXIT, PLAYER_POSITION        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EVENT BUS - Bridge Between Layers                        │  │
│  │                                                            │  │
│  │  • ZONE_ENTER  → Trigger communication context           │  │
│  │  • ZONE_EXIT   → Destroy communication context           │  │
│  │  • PLAYER_POSITION → Update position                     │  │
│  │  • CHAT_MESSAGE → Display messages                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │                   │                         │
│                    ▼                   ▼                         │
│  ┌───────────────────────┐  ┌──────────────────────┐          │
│  │ ServerHUD             │  │ ChatInterface        │          │
│  │ • Zone display        │  │ • ChannelSidebar     │          │
│  │ • User list           │  │ • MessageFeed        │          │
│  │ • Chat button         │  │ • Permanent chat     │          │
│  └───────────────────────┘  └──────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                       BACKEND LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ WEBSOCKET HANDLER (ws.py)                                │  │
│  │                                                            │  │
│  │  • Receive: player_move, zone_enter, zone_exit           │  │
│  │  • Broadcast: user_joined, user_left, player_move        │  │
│  │  • Zone-scoped: temporary chat (not saved)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    │                   │                         │
│                    ▼                   ▼                         │
│  ┌───────────────────────┐  ┌──────────────────────┐          │
│  │ ZoneManager           │  │ REST API             │          │
│  │ (In-Memory)           │  │ (Persistent)         │          │
│  │                       │  │                       │          │
│  │ • Track zone members  │  │ /channels (CRUD)     │          │
│  │ • Enter zone →        │  │ /messages (CRUD)     │          │
│  │   create context      │  │ Pagination           │          │
│  │ • Exit zone →         │  │ Edit/Delete          │          │
│  │   destroy context     │  │                       │          │
│  │ • Temporary only      │  │ Saved to database    │          │
│  └───────────────────────┘  └──────────────────────┘          │
│                                         │                        │
│                                         ▼                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ DATABASE (PostgreSQL)                                     │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │
│  │  │ Users    │  │ Servers  │  │ Channels │  │Messages │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │  │
│  │       │             │              │             │        │  │
│  │       └─────────────┴──────────────┴─────────────┘        │  │
│  │                   Relationships                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### 1. Player Enters Zone (Lifecycle Event)

```
User moves avatar into "Room_1"
         ↓
MainScene.checkZoneEntry() detects collision
         ↓
EventBus.emit(ZONE_ENTER, {zoneId: "Room_1", type: "PRIVATE"})
         ↓
WebSocket sends: {type: "zone_enter", zone_id: "Room_1"}
         ↓
Backend: zone_manager.enter_zone(zone_id, user_id)
         ↓
Zone context created in memory (temporary)
         ↓
Notify other zone members: "User joined Room_1"
         ↓
Frontend: Update UI, enable zone chat
```

**Key**: Context is **temporary** - destroyed when empty!

---

### 2. Permanent Chat Message

```
User types in #general channel
         ↓
MessageFeed.sendMessage()
         ↓
POST /channels/{channel_id}/messages
         ↓
Backend validates membership
         ↓
Save to database (messages table)
         ↓
Return message with metadata
         ↓
Frontend appends to MessageFeed
         ↓
Message persists forever (until deleted)
```

**Key**: Saved to DB, **always accessible**!

---

### 3. Temporary Zone Chat

```
User in Room_1 types message
         ↓
EventBus.emit(SEND_CHAT_MESSAGE, {scope: "zone"})
         ↓
WebSocket: {type: "chat_message", scope: "zone", message: "hi"}
         ↓
Backend: zone_manager.get_user_zone(user_id) → "Room_1"
         ↓
zone_manager.get_zone_members("Room_1") → [user1, user2, user3]
         ↓
Send message to all zone members via WebSocket
         ↓
Frontend displays in temporary chat overlay
         ↓
User leaves zone → messages disappear (NOT SAVED)
```

**Key**: Lives **only in zone**, destroyed on exit!

---

## 📁 File Structure

```
atriumverse/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ws.py              ✅ WebSocket + Zone events
│   │   │   ├── channels.py        ✅ Channel CRUD
│   │   │   ├── messages.py        ✅ Message CRUD + pagination
│   │   │   ├── servers.py         (existing)
│   │   │   └── users.py           (existing)
│   │   │
│   │   ├── core/
│   │   │   ├── zone_manager.py    ✅ Zone lifecycle manager
│   │   │   ├── socket_manager.py  (existing)
│   │   │   └── database.py        (existing)
│   │   │
│   │   ├── models/
│   │   │   ├── channel.py         ✅ NEW - Permanent channels
│   │   │   ├── message.py         ✅ NEW - Persistent messages
│   │   │   ├── server.py          ✅ UPDATED - channels relationship
│   │   │   └── user.py            ✅ UPDATED - messages relationship
│   │   │
│   │   └── schemas/
│   │       ├── channel.py         ✅ NEW - Channel schemas
│   │       └── message.py         ✅ NEW - Message schemas
│   │
│   └── migrate_chat.py            ✅ Database migration
│
└── frontend/
    ├── game/
    │   └── scenes/
    │       └── MainScene.ts       ✅ UPDATED - Zone detection
    │
    └── components/
        ├── chat/
        │   ├── ChannelSidebar.tsx ✅ NEW - Discord-like sidebar
        │   ├── MessageFeed.tsx    ✅ NEW - Message display + input
        │   └── ChatInterface.tsx  ✅ NEW - Main chat component
        │
        ├── game/
        │   └── ServerHUD.tsx      ✅ UPDATED - Chat integration
        │
        └── ui/
            └── scroll-area.tsx    ✅ NEW - Radix scroll
```

---

## 🎯 Your Vision - Perfectly Aligned

### Principle 1: World Drives Communication ✅
```
Movement in Phaser → Zone Detection → Communication Context
NOT: Chat Widget → Enable Video → Add to Game
```

### Principle 2: Lifecycle Events ✅
```
ENTER zone  → Create temporary context
EXIT zone   → Destroy temporary context
Permanent chat → Separate, always available
```

### Principle 3: Separation of Concerns ✅
```
┌─────────────────┬──────────────┬───────────────┐
│ Layer           │ Temporary    │ Permanent     │
├─────────────────┼──────────────┼───────────────┤
│ Storage         │ In-memory    │ Database      │
│ Lifecycle       │ Zone-bound   │ Forever       │
│ Access          │ Zone members │ Server members│
│ Manager         │ ZoneManager  │ REST API      │
│ Example         │ Zone chat    │ #general      │
└─────────────────┴──────────────┴───────────────┘
```

---

## 🚀 Quick Start

### 1. Backend
```bash
cd backend
python migrate_chat.py  # Creates tables + default channels
python -m uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install date-fns @radix-ui/react-scroll-area
npm run dev
```

### 3. Test
1. Enter a server
2. Move into Room_1 → Check console for zone events
3. Click "Chat" → See #general channel
4. Send messages → Persisted in DB
5. Leave zone → Temporary context destroyed

---

## 📊 Database Tables

### New Tables
```
channels       → Permanent channels (#general, #announcements)
messages       → Persistent messages in channels
```

### Updated Tables
```
servers        → Added channels relationship
users          → Added messages relationship
```

### Existing Tables (unchanged)
```
servers
users
zones
server_members
```

---

## ✨ Features Implemented

### ✅ Zone System
- Real-time zone detection
- Enter/exit lifecycle events
- Zone member tracking
- Temporary zone context

### ✅ Permanent Chat
- Discord-like UI (neobrutalism)
- Channel creation (owner only)
- Message CRUD operations
- Edit/delete messages
- Pagination support
- Real-time message list

### ✅ UI Components
- ChannelSidebar - Clean channel list
- MessageFeed - Scrollable messages
- ChatInterface - Modal with minimize
- ServerHUD - Integrated chat button

### ✅ Styling
- Neobrutalism design system
- Bold 2-4px borders
- Sharp shadows
- High contrast
- Strong typography
- Geometric layouts

---

## 🎨 Design System

### Colors
```css
--primary: Blue (buttons, highlights)
--secondary: Light gray (backgrounds)
--border: Black (all borders)
--shadow: 4px 4px 0px black
```

### Typography
```css
--font-weight-normal: 500
--font-weight-bold: 700
--font-weight-black: 900 (headings)
```

### Spacing
```css
--border-width: 2px (default)
--border-width-heavy: 4px (sections)
--shadow-offset: 4px
```

---

## 🔧 Configuration

### Environment Variables
```env
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Map Configuration
```json
{
  "zones": [
    {"name": "Room_1", "type": "PRIVATE"},
    {"name": "Room_2", "type": "PRIVATE"},
    {"name": "Hall", "type": "PUBLIC"}
  ],
  "spawn_points": [
    {"name": "Spawn_main", "x": 480, "y": 576}
  ]
}
```

---

## 🎯 Summary

**What You Have Now**:
- ✅ NPC sprite rendering (64x128, 4x4 grid)
- ✅ Zone detection with lifecycle events
- ✅ Backend ZoneManager (temporary contexts)
- ✅ Permanent chat system (DB-backed)
- ✅ Discord-like UI (neobrutalism styled)
- ✅ Full message CRUD with edit/delete
- ✅ Channel management (create/update/delete)

**Your Vision Respected**:
- ✅ World drives everything
- ✅ Zones trigger communication
- ✅ Temporary vs permanent separation
- ✅ Lifecycle-based architecture
- ✅ No premature features

**Token Status**: ~72k remaining - plenty for future phases!

Ready to test? 🚀
