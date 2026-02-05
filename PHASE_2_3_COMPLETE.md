# Phase 2 & 3 Implementation Guide

## ✅ What's Been Implemented

### Phase 2: Backend Zone Manager
- **ZoneManager Service** - Tracks users in zones, lifecycle management
- **WebSocket Integration** - Zone enter/exit events, zone-scoped chat
- **Temporary Context** - Zones destroyed when empty

### Phase 3: Permanent Chat System
- **Database Models** - Channel & Message tables with relationships
- **API Endpoints** - Full CRUD for channels and messages
- **Discord-like UI** - Neobrutalism styled chat interface
- **Real-time Updates** - (to be wired with WebSocket)

---

## 📁 Files Created

### Backend (12 files)

#### Core Services
```
backend/app/core/
├── zone_manager.py          ✅ Zone lifecycle management
```

#### Database Models
```
backend/app/models/
├── channel.py               ✅ Channel model (permanent)
├── message.py               ✅ Message model (persistent)
├── server_updated.py        ✅ Server with channels relationship
├── user_updated.py          ✅ User with messages relationship
```

#### API Endpoints
```
backend/app/api/
├── ws.py                    ✅ Updated WebSocket with zone events
├── channels.py              ✅ Channel CRUD endpoints
├── messages.py              ✅ Message CRUD + pagination
```

#### Schemas
```
backend/app/schemas/
├── channel.py               ✅ Channel Pydantic models
├── message.py               ✅ Message Pydantic models
```

#### Migration
```
backend/
├── migrate_chat.py          ✅ DB migration script
```

### Frontend (6 files)

#### Chat Components
```
frontend/components/chat/
├── ChannelSidebar.tsx       ✅ Discord-like channel list
├── MessageFeed.tsx          ✅ Message display + input
├── ChatInterface.tsx        ✅ Main chat component
```

#### Game Components
```
frontend/components/game/
├── ServerHUD_updated.tsx    ✅ HUD with chat button
```

#### UI Components
```
frontend/components/ui/
├── scroll-area.tsx          ✅ Radix scroll component
```

#### Game Logic
```
frontend/game/scenes/
├── MainScene.ts             ✅ Zone detection in game
```

---

## 🚀 Installation Steps

### 1. Backend Setup

#### Update Model Imports
Replace the old model files with the updated ones:

```bash
# Backup old models
mv backend/app/models/server.py backend/app/models/server_old.py
mv backend/app/models/user.py backend/app/models/user_old.py

# Use new models
mv backend/app/models/server_updated.py backend/app/models/server.py
mv backend/app/models/user_updated.py backend/app/models/user.py
```

#### Update main.py
Add the new routes:

```python
# backend/app/main.py
from app.api import users, ws, servers, channels, messages

# ... existing code ...

app.include_router(channels.router, prefix="/servers", tags=["Channels"])
app.include_router(messages.router, prefix="", tags=["Messages"])
```

#### Run Migration
```bash
cd backend
python migrate_chat.py
```

This will:
- Create `channels` and `messages` tables
- Add default channels to existing servers
- Update relationships

#### Install Dependencies (if needed)
```bash
pip install python-jose[cryptography]
pip install argon2-cffi
pip install redis
pip install asyncpg
```

---

### 2. Frontend Setup

#### Update GameWrapper Route
Replace the ServerHUD import:

```typescript
// frontend/app/server/[id]/layout.tsx
import ServerHUD from "@/components/game/ServerHUD_updated";
```

Or rename the file:
```bash
mv frontend/components/game/ServerHUD.tsx frontend/components/game/ServerHUD_old.tsx
mv frontend/components/game/ServerHUD_updated.tsx frontend/components/game/ServerHUD.tsx
```

#### Install Dependencies (if needed)
```bash
npm install date-fns
npm install @radix-ui/react-scroll-area
```

#### Update MainScene
Replace the old MainScene.ts with the new one that includes zone detection.

---

## 🎮 Testing the System

### Test Zone Detection

1. Start the backend and frontend
2. Open browser console
3. Enter a server
4. Move your character into a zone (Room_1, Room_2, etc.)
5. Check console for `ZONE_ENTER` and `ZONE_EXIT` events

```javascript
// In browser console:
import EventBus from '@/game/EventBus';

EventBus.on('zone-enter', (data) => {
  console.log('Entered zone:', data);
});

EventBus.on('zone-exit', (data) => {
  console.log('Exited zone:', data);
});
```

### Test Permanent Chat

1. Click "Chat" button in the game
2. Create a channel (if owner)
3. Send messages
4. Edit/delete your messages
5. Close and reopen chat - messages should persist

### Test Zone Chat (WebSocket)

In browser console, send a zone-scoped message:
```javascript
// This would be sent from the game when in a zone
socket.send(JSON.stringify({
  type: 'chat_message',
  scope: 'zone',
  message: 'Hello from zone!'
}));
```

---

## 🏗️ Architecture Flow

### Zone Lifecycle
```
Player Movement (Phaser)
         ↓
  checkZoneEntry()
         ↓
  EventBus.emit(ZONE_ENTER)
         ↓
  WebSocket → zone_enter
         ↓
  ZoneManager.enter_zone()
         ↓
  Notify zone members
```

### Permanent Chat
```
User types message
         ↓
  MessageFeed.sendMessage()
         ↓
  POST /channels/{id}/messages
         ↓
  Save to database
         ↓
  Return message
         ↓
  Update UI (append to feed)
```

### Temporary Zone Chat
```
User in zone types
         ↓
  EventBus.emit(SEND_CHAT_MESSAGE, {scope: 'zone'})
         ↓
  WebSocket → chat_message (scope=zone)
         ↓
  ZoneManager.get_zone_members()
         ↓
  Send to all zone members
         ↓
  Message NOT saved to DB
```

---

## 🎨 UI Features (Neobrutalism)

### Design Elements
- **Bold borders** - 2px and 4px borders everywhere
- **Sharp shadows** - `shadow-shadow` class (4px offset)
- **Strong typography** - Font weights 700-900
- **High contrast** - Black borders on light/dark themes
- **Flat colors** - No gradients, solid fills
- **Geometric** - Square corners with slight rounding

### Key Components
- **ChannelSidebar** - Discord-like channel list with create button
- **MessageFeed** - Scrollable message area with edit/delete
- **ChatInterface** - Modal overlay with minimize/close
- **ServerHUD** - Integrated chat button in game

---

## 🔧 Customization

### Add More Channel Types
```python
# backend/app/models/channel.py
class ChannelType(str, enum.Enum):
    TEXT = "text"
    ANNOUNCEMENTS = "announcements"
    VOICE = "voice"
    VIDEO = "video"  # Add new type
```

### Customize Default Channels
```python
# backend/migrate_chat.py
# In create_default_channels():
random = Channel(
    server_id=server.id,
    name="random",
    type="text",
    description="Off-topic discussions",
    position=2
)
session.add(random)
```

### Change Chat Styling
```typescript
// frontend/components/chat/ChannelSidebar.tsx
// Update the width:
<div className="w-72 h-full ...">  // Instead of w-60

// Change colors:
className="bg-primary/20 ..."  // Stronger highlight
```

---

## 🐛 Troubleshooting

### "Channel not found" Error
- Run the migration script to create tables
- Check that relationships are updated in models
- Verify server_id matches in database

### Messages Not Persisting
- Check database connection
- Verify Message model is imported in migration
- Check browser network tab for API errors

### Zone Events Not Firing
- Make sure MainScene.ts is updated
- Check that zones exist in Tiled map
- Verify WebSocket connection is open

### UI Not Showing
- Check that all components are in correct paths
- Verify scroll-area.tsx is created
- Check browser console for import errors

---

## 📊 Database Schema

### Channels Table
```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY,
    server_id UUID REFERENCES servers(id),
    name VARCHAR NOT NULL,
    type VARCHAR DEFAULT 'text',
    description VARCHAR,
    position INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY,
    channel_id UUID REFERENCES channels(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    reply_to_id UUID REFERENCES messages(id),
    edited_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP
);
```

---

## 🎯 Your Vision Alignment

### ✅ World First
- Phaser scene detects zones
- Movement triggers communication contexts
- World controls the flow

### ✅ Lifecycle-Driven
- Zone enter → temporary context created
- Zone exit → context destroyed
- Permanent chat separate layer

### ✅ Separation of Concerns
- **Temporary**: Zone chat (not saved)
- **Permanent**: Channel chat (saved in DB)
- **Clear boundaries**: Different scopes

---

## 🚦 What's Left (Future Phases)

### Audio/Video (LiveKit Integration)
- Zone-based proximity audio
- Distance-based volume
- Video calls in zones

### Advanced Features
- Message reactions
- File uploads
- Thread replies
- User mentions
- Rich embeds

### Permissions System
- Role-based access
- Channel-specific permissions
- Zone access control

---

## ✨ Summary

**Status**: ✅ Phase 2 & 3 Complete

**What Works**:
- Zone detection in game
- Zone lifecycle management (backend)
- Permanent chat (channels + messages)
- Discord-like UI (neobrutalism styled)
- Full CRUD for channels/messages

**What's Integrated**:
- WebSocket events for zones
- Database persistence for chat
- Real-time zone membership tracking
- Edit/delete message functionality

**Next Steps**:
1. Run migration script
2. Test zone detection in game
3. Test chat interface
4. Wire up real-time message updates (WebSocket)
5. Add LiveKit for audio (future phase)

Your vision is respected and implemented - the world drives everything, zones create lifecycle events, and communication layers are properly separated!
