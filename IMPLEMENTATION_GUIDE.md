# 🎯 AtriumVerse Chat System - Implementation Guide

## Overview

**Gather.town-style dual chat system** with permanent sidebar chat and temporary proximity chat.

---

## 🏗️ Architecture

```
MainScene.ts (Game) → EventBus → CommunicationManager (Chat) → Backend
```

**Key Principle**: Game logic and chat logic are completely separated.

---

## 📦 Files Delivered

### Backend (5 files)
- `backend_model_direct_message.py` → `backend/app/models/direct_message.py`
- `backend_schema_direct_message.py` → `backend/app/schemas/direct_message.py`
- `backend_api_direct_messages.py` → `backend/app/api/direct_messages.py`
- `backend_api_ws_UPDATED.py` → `backend/app/api/ws.py` (REPLACE existing)
- `backend_migrate_direct_messages.py` → `backend/migrate_direct_messages.py`

### Frontend (6 files)
- `frontend_CommunicationManager.ts` → `frontend/game/managers/CommunicationManager.ts`
- `frontend_BaseSidebar.tsx` → `frontend/components/sidebar/BaseSidebar.tsx`
- `frontend_ChatExpandedView.tsx` → `frontend/components/sidebar/chat/ChatExpandedView.tsx`
- `frontend_ChannelList.tsx` → `frontend/components/sidebar/chat/ChannelList.tsx`
- `frontend_ChatFeed.tsx` → `frontend/components/sidebar/chat/ChatFeed.tsx`
- `frontend_ProximityChat.tsx` → `frontend/components/game/ProximityChat.tsx`

---

## 🚀 Quick Start (5 Steps)

### Step 1: Backend Migration

```bash
cd backend
python migrate_direct_messages.py
```

### Step 2: Register DM Routes

In your FastAPI `main.py`:

```python
from app.api import direct_messages

app.include_router(
    direct_messages.router,
    prefix="/api/direct-messages",
    tags=["direct-messages"]
)
```

### Step 3: Clean Up MainScene.ts

**REMOVE** all chat logic from MainScene. Only keep:
- Player movement
- Zone detection

**ADD** zone event emissions:

```typescript
// When entering zone
EventBus.emit('zone:entered', { id, name, type });

// When exiting zone
EventBus.emit('zone:exited', { id });
```

### Step 4: Initialize CommunicationManager

In your game page component:

```typescript
import { initCommunicationManager } from '@/game/managers/CommunicationManager';

useEffect(() => {
  const token = localStorage.getItem('access_token');
  const commManager = initCommunicationManager(serverId, token);
  commManager.connect();
  
  return () => commManager.disconnect();
}, [serverId]);
```

### Step 5: Add UI Components

```tsx
<div className="relative w-full h-screen">
  <BaseSidebar serverId={serverId} />
  <div className="ml-16 w-[calc(100%-4rem)] h-full">
    <div id="game-container"></div>
  </div>
  <ProximityChat />
</div>
```

---

## 🎮 User Experience

### Sidebar
- **Collapsed**: Icon bar (64px)
- **Chat Expanded**: Two cards (Channels list + Message feed)
- **Click Chat Icon**: Toggle expanded view

### Proximity Chat
- **Shows**: When in a zone
- **Hides**: When leaving zone
- **Not Saved**: Messages disappear on exit

---

## 📡 API Endpoints

```
GET    /api/direct-messages/conversations     # List DM conversations
GET    /api/direct-messages/messages/{userId} # Get DM history
POST   /api/direct-messages/messages          # Send DM
PATCH  /api/direct-messages/messages/{id}     # Edit DM
DELETE /api/direct-messages/messages/{id}     # Delete DM
```

---

## 🔄 Message Types

| Type | Saved to DB | WebSocket | Location |
|------|------------|-----------|----------|
| **Channel** | ✅ Yes | ✅ Yes | ChatFeed (sidebar) |
| **Direct Message** | ✅ Yes | ✅ Yes | ChatFeed (sidebar) |
| **Zone Chat** | ❌ No | ✅ Yes | ProximityChat (overlay) |

---

## 🧪 Testing Checklist

- [ ] Send channel message → all users see it
- [ ] Send DM → receiver gets it
- [ ] Enter zone → proximity chat appears
- [ ] Send zone message → only zone members see it
- [ ] Exit zone → proximity chat disappears
- [ ] Edit message → updates everywhere
- [ ] Delete message → removes everywhere

---

## 🐛 Debugging

```javascript
// Check WebSocket
import { getCommunicationManager } from '@/game/managers/CommunicationManager';
const cm = getCommunicationManager();
console.log('Connected:', cm?.ws?.readyState === 1);
console.log('Zone:', cm?.getCurrentZone());

// Monitor events
EventBus.on('*', (e, data) => console.log(e, data));
```

---

## ⚠️ Common Issues

**WebSocket not connecting**
→ Check `NEXT_PUBLIC_WS_URL` environment variable

**Messages not real-time**
→ Verify EventBus listeners registered

**Proximity chat not showing**
→ Ensure MainScene emits `'zone:entered'` events

**DMs not saving**
→ Check migration ran, table exists

---

## 🎨 Customization

```tsx
// Colors
className="bg-blue-500"  // Change brand color

// Sizes
className="w-16"         // Sidebar width
className="w-72"         // Channel list width
className="w-96"         // Proximity chat width

// Message limits
const MAX_MESSAGES = 20  // Zone chat history
```

---

## 🔒 Security

- ✅ JWT authentication required
- ✅ Users can only edit own messages
- ✅ Input validation (max 2000 chars)
- ✅ SQL injection protected (ORM)
- ✅ XSS protected (React escaping)

---

## 📚 Key Concepts

**EventBus**: Communication bridge between game and chat
**CommunicationManager**: Centralized chat logic
**Separation**: Game logic ≠ Chat logic
**Temporary**: Zone messages not persisted
**Persistent**: Channel/DM messages saved

---

## 🚦 Next Steps

**Immediate:**
1. Run migration
2. Copy files
3. Initialize manager
4. Test

**Future:**
- LiveKit voice/video
- Typing indicators
- Message reactions
- File attachments
- Search

---

**🎉 Ready to go! All files are in the outputs folder.**

For detailed information, see the full documentation in each component file.
