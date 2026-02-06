# 📋 File Reference Card

## Backend Files (Copy these to your backend)

| Output File | Destination Path | Purpose |
|------------|-----------------|---------|
| `backend_model_direct_message.py` | `backend/app/models/direct_message.py` | SQLAlchemy model for DMs |
| `backend_schema_direct_message.py` | `backend/app/schemas/direct_message.py` | Pydantic schemas |
| `backend_api_direct_messages.py` | `backend/app/api/direct_messages.py` | REST API endpoints |
| `backend_api_ws_UPDATED.py` | `backend/app/api/ws.py` | **REPLACE** existing ws.py |
| `backend_migrate_direct_messages.py` | `backend/migrate_direct_messages.py` | Run to create DM table |

## Frontend Files (Copy these to your frontend)

| Output File | Destination Path | Purpose |
|------------|-----------------|---------|
| `frontend_CommunicationManager.ts` | `frontend/game/managers/CommunicationManager.ts` | Chat WebSocket manager |
| `frontend_BaseSidebar.tsx` | `frontend/components/sidebar/BaseSidebar.tsx` | Icon sidebar |
| `frontend_ChatExpandedView.tsx` | `frontend/components/sidebar/chat/ChatExpandedView.tsx` | Chat overlay layout |
| `frontend_ChannelList.tsx` | `frontend/components/sidebar/chat/ChannelList.tsx` | Channel/DM picker |
| `frontend_ChatFeed.tsx` | `frontend/components/sidebar/chat/ChatFeed.tsx` | Message display |
| `frontend_ProximityChat.tsx` | `frontend/components/game/ProximityChat.tsx` | Zone chat overlay |

---

## Installation Commands

### Backend
```bash
# 1. Copy files
cd backend
cp ../outputs/backend_model_direct_message.py app/models/direct_message.py
cp ../outputs/backend_schema_direct_message.py app/schemas/direct_message.py
cp ../outputs/backend_api_direct_messages.py app/api/direct_messages.py
cp ../outputs/backend_api_ws_UPDATED.py app/api/ws.py
cp ../outputs/backend_migrate_direct_messages.py migrate_direct_messages.py

# 2. Run migration
python migrate_direct_messages.py

# 3. Add to main.py
# from app.api import direct_messages
# app.include_router(direct_messages.router, prefix="/api/direct-messages")
```

### Frontend
```bash
# 1. Create directories
cd frontend
mkdir -p game/managers
mkdir -p components/sidebar/chat
mkdir -p components/game

# 2. Copy files
cp ../outputs/frontend_CommunicationManager.ts game/managers/CommunicationManager.ts
cp ../outputs/frontend_BaseSidebar.tsx components/sidebar/BaseSidebar.tsx
cp ../outputs/frontend_ChatExpandedView.tsx components/sidebar/chat/ChatExpandedView.tsx
cp ../outputs/frontend_ChannelList.tsx components/sidebar/chat/ChannelList.tsx
cp ../outputs/frontend_ChatFeed.tsx components/sidebar/chat/ChatFeed.tsx
cp ../outputs/frontend_ProximityChat.tsx components/game/ProximityChat.tsx

# 3. Install deps (if needed)
npm install date-fns lucide-react sonner
```

---

## What Changed?

### MainScene.ts
**REMOVE:**
- All WebSocket chat message handling
- `scope: "zone"` and `scope: "direct"` logic
- Chat UI rendering

**KEEP:**
- Player movement
- Zone detection

**ADD:**
```typescript
EventBus.emit('zone:entered', { id, name, type });
EventBus.emit('zone:exited', { id });
```

### Game Layout
**ADD:**
```tsx
import BaseSidebar from '@/components/sidebar/BaseSidebar';
import ProximityChat from '@/components/game/ProximityChat';
import { initCommunicationManager } from '@/game/managers/CommunicationManager';

// In component:
useEffect(() => {
  const cm = initCommunicationManager(serverId, token);
  cm.connect();
  return () => cm.disconnect();
}, [serverId]);

return (
  <>
    <BaseSidebar serverId={serverId} />
    <ProximityChat />
    {/* your game canvas */}
  </>
);
```

---

## Features Implemented

✅ **Direct Messages** - Persistent, database-saved 1-on-1 chat
✅ **Channel Messages** - Permanent server-wide chat
✅ **Zone Chat** - Temporary proximity-based messaging
✅ **Edit/Delete** - Full message CRUD operations
✅ **Real-time** - WebSocket instant delivery
✅ **Read Status** - Unread count and marking
✅ **Conversation List** - See all your DM conversations
✅ **Two-Card Layout** - Gather.town style expandable chat
✅ **Proximity Overlay** - Bottom-right zone chat like Gather

---

## API Summary

```
# Direct Messages
GET    /api/direct-messages/conversations
GET    /api/direct-messages/messages/{user_id}
POST   /api/direct-messages/messages
PATCH  /api/direct-messages/messages/{id}
DELETE /api/direct-messages/messages/{id}

# Existing Channels (already working)
GET    /api/servers/{server_id}/channels
GET    /api/channels/{channel_id}/messages
POST   /api/channels/{channel_id}/messages
PATCH  /api/messages/{id}
DELETE /api/messages/{id}
```

---

## Testing Quick Commands

```javascript
// In browser console:

// Check WebSocket
import { getCommunicationManager } from '@/game/managers/CommunicationManager';
const cm = getCommunicationManager();
console.log('WS State:', cm?.ws?.readyState); // Should be 1 (OPEN)

// Test zone entry
import EventBus from '@/game/EventBus';
EventBus.emit('zone:entered', { 
  id: 'test', 
  name: 'Test Zone', 
  type: 'PUBLIC' 
});

// Monitor all events
EventBus.on('*', (event, data) => {
  console.log(`[${event}]`, data);
});
```

---

## Architecture Diagram

```
┌─────────────────┐
│   MainScene     │ (Game logic only)
│   - Movement    │
│   - Rendering   │
│   - Zones       │
└────────┬────────┘
         │ EventBus.emit('zone:*')
         ▼
┌─────────────────┐
│ CommunicationMgr│ (Chat logic)
│   - WebSocket   │
│   - Routing     │
│   - DMs/Zones   │
└────────┬────────┘
         │ WebSocket + REST
         ▼
┌─────────────────┐
│    Backend      │
│   - DM API      │
│   - Channels    │
│   - WebSocket   │
└─────────────────┘
```

---

## Critical Notes

⚠️ **IMPORTANT**:
- `backend_api_ws_UPDATED.py` **REPLACES** your existing `ws.py` (it has the zone chat code + new DM events)
- MainScene.ts must **NOT** handle any chat logic anymore
- CommunicationManager is initialized **once** per server session
- Zone messages are **NOT saved** to database (temporary only)
- DMs and channel messages **ARE saved** to database

---

## Next Steps After Installation

1. ✅ Run backend migration
2. ✅ Copy all files
3. ✅ Register DM routes in main.py
4. ✅ Update MainScene.ts (remove chat, add EventBus)
5. ✅ Add BaseSidebar + ProximityChat to layout
6. ✅ Initialize CommunicationManager
7. ✅ Test all features

---

**Need help?** Check `IMPLEMENTATION_GUIDE.md` for detailed troubleshooting.
