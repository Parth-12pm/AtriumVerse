# UI Fixes Handoff Context

## Current Status

**Objective**: Fix missing UI elements after API integration completion

**Progress**: API endpoints fixed (channels, DMs) ✅ | UI implementation started ⏳

---

## What Has Been Done

### 1. API Integration ✅ COMPLETE

- Created TypeScript type definitions ([api.types.ts](file:///d:/python/AtriumVerse/frontend/types/api.types.ts))
- Created API service layer ([api.service.ts](file:///d:/python/AtriumVerse/frontend/lib/services/api.service.ts))
- Migrated components to use API services:
  - [ChatExpandedView.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChatExpandedView.tsx) - Uses `channelsAPI`, `directMessagesAPI`
  - [ChatFeed.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChatFeed.tsx) - Uses `messagesAPI`, `directMessagesAPI` 
  - [ChannelList.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChannelList.tsx) - Uses `channelsAPI`
  - [PeopleExpandedView.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/people/PeopleExpandedView.tsx) - Uses `serversAPI`

### 2. API Endpoint Fixes ✅ COMPLETE

**Fixed paths** in [api.service.ts](file:///d:/python/AtriumVerse/frontend/lib/services/api.service.ts):
- Channels: `/${serverId}/channels` → `/servers/${serverId}/channels`
- DMs: `/direct-messages/**` → `/DM/**`

See [api_fixes.md](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/api_fixes.md) for complete API reference.

### 3. UI Component Migration ✅ COMPLETE

All sidebar components now use Shadcn UI components:
- ✅ [BaseSidebar.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/BaseSidebar.tsx) - Uses [Button](file:///d:/python/AtriumVerse/frontend/components/ui/button.tsx#35-55) components
- ✅ [ChatFeed.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChatFeed.tsx) - Uses [Button](file:///d:/python/AtriumVerse/frontend/components/ui/button.tsx#35-55), [Input](file:///d:/python/AtriumVerse/frontend/components/ui/input.tsx#5-18), [Avatar](file:///d:/python/AtriumVerse/frontend/components/ui/avatar.tsx#9-24) 
- ✅ [ChatExpandedView.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChatExpandedView.tsx) - Uses [Button](file:///d:/python/AtriumVerse/frontend/components/ui/button.tsx#35-55)
- ✅ [ChannelList.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChannelList.tsx) - Uses [Avatar](file:///d:/python/AtriumVerse/frontend/components/ui/avatar.tsx#9-24)
- ✅ [PeopleExpandedView.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/people/PeopleExpandedView.tsx) - Created with native components
- ✅ [ProximityChat.tsx](file:///d:/python/AtriumVerse/frontend/components/game/ProximityChat.tsx) - Uses [Button](file:///d:/python/AtriumVerse/frontend/components/ui/button.tsx#35-55), [Input](file:///d:/python/AtriumVerse/frontend/components/ui/input.tsx#5-18)

---

## What Needs to Be Done

**User approved**: [missing_ui_analysis.md](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/missing_ui_analysis.md)

### Priority 1: Fix ProximityChat Visibility 🚨

**File**: [d:\python\AtriumVerse\frontend\components\game\ProximityChat.tsx](file:///d:/python/AtriumVerse/frontend/components/game/ProximityChat.tsx)

**Problem**: Component renders but has NO positioning - needs `fixed bottom-4 right-4` wrapper

**Fix**: Lines 85-192 need position wrapper:
```tsx
{isInZone && !isMinimized && (
  <div className="fixed bottom-4 right-4 w-96 bg-white border-4 border-black rounded-lg shadow-lg z-50">
    {/* existing content */}
  </div>
)}
```

### Priority 2: Channel Management UI 🚨

**Files**: 
- [d:\python\AtriumVerse\frontend\components\sidebar\chat\ChatExpandedView.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChatExpandedView.tsx)
- [d:\python\AtriumVerse\frontend\components\sidebar\chat\ChannelList.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/chat/ChannelList.tsx)

**Missing**:
1. "Create Channel" button (owner only) in ChannelList header
2. CreateChannelDialog component (use Shadcn Dialog)
3. Right-click menu on channels for Edit/Delete (owner only)

**Permission check**: Use `isServerOwner` state - fetch from server member data

**API calls available**:
- `channelsAPI.create(serverId, { name, type })` 
- `channelsAPI.update(channelId, { name, type })`
- `channelsAPI.delete(channelId)`

### Priority 3: Server Settings UI 🚨

**File**: [d:\python\AtriumVerse\frontend\components\sidebar\BaseSidebar.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/BaseSidebar.tsx)

**Current**: Settings view is empty placeholder

**Add**:
1. Server info display
2. Leave Server button (all users)
3. Delete Server button (owner only) - **Backend endpoint missing**

**Backend TODO**: Add `DELETE /servers/{server_id}` endpoint
- Location: [d:\python\AtriumVerse\backend\app\api\servers.py](file:///d:/python/AtriumVerse/backend/app/api/servers.py)
- Check ownership before deletion
- See example in [missing_ui_analysis.md:342](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/missing_ui_analysis.md#L342)

### Priority 4: Server Dock Navigation 🚨

**Create**: `d:\python\AtriumVerse\frontend\components\navigation\ServerDock.tsx`

**Purpose**: Discord-style server switcher on far left

**Features**:
- Fetch user's servers via `serversAPI.list()`  
- Show server icons (first letter or image)
- Highlight current server
- Home button to return to `/servers`
- Add/Join server buttons

**Layout change**: Update [page.tsx](file:///d:/python/AtriumVerse/frontend/app/server/%5Bid%5D/page.tsx) spacing to account for both docks

---

## File Structure Reference

### Frontend Key Files
```
frontend/
├── app/
│   └── server/[id]/
│       ├── page.tsx ← Main layout (has BaseSidebar + GameWrapper + ProximityChat)
│       └── layout.tsx ← Simplified (just metadata)
├── components/
│   ├── sidebar/
│   │   ├── BaseSidebar.tsx ← Icon dock with views (Chat, People, Settings, etc.)
│   │   ├── chat/
│   │   │   ├── ChatExpandedView.tsx ← Channel/DM tabs
│   │   │   ├── ChatFeed.tsx ← Message display + send
│   │   │   └── ChannelList.tsx ← Channel list (needs + button)
│   │   └── people/
│   │       └── PeopleExpandedView.tsx ← Online users + positions
│   ├── game/
│   │   └── ProximityChat.tsx ← Zone chat (NEEDS POSITIONING)
│   └── ui/ ← Shadcn components (Button, Input, Avatar, Dialog, etc.)
├── lib/
│   └── services/
│       └── api.service.ts ← All API calls (recently fixed)
└── types/
    └── api.types.ts ← TypeScript definitions
```

### Backend Key Files
```
backend/
└── app/
    ├── api/
    │   ├── servers.py ← Needs DELETE endpoint
    │   ├── channels.py ← Has CRUD endpoints
    │   └── direct_messages.py ← Uses /DM prefix
    └── main.py ← Router registration
```

---

## Permission System

**Roles**: Only `owner` and [member](file:///d:/python/AtriumVerse/backend/app/api/servers.py#183-211) (no admin role per user feedback)

| Feature | Owner | Member |
|---------|-------|--------|
| Create Channel | ✅ | ❌ |
| Edit Channel | ✅ | ❌ |
| Delete Channel | ✅ | ❌ |
| Delete Server | ✅ | ❌ |
| Leave Server | ✅ | ✅ |
| Kick Members | ✅ | ❌ |

**How to check**: 
```tsx
const isServerOwner = serverData?.owner_id === currentUserId;
```

---

## Implementation Order

1. **Fix ProximityChat positioning** (5 min - just wrap return in positioned div)
2. **Add Create Channel button** (15 min - button + dialog)
3. **Add Leave Server button** (10 min - button in Settings view)
4. **Add Delete Server** (20 min - backend endpoint + frontend UI)
5. **Create Server Dock** (30 min - new component + layout update)
6. **Add Edit/Delete channel UI** (15 min - dropdown menu)

**Total estimated time**: 1.5 hours

---

## Testing Checklist

After implementing:
- [ ] ProximityChat visible when entering zones
- [ ] Can create channels (owner only)
- [ ] Can edit/delete channels (owner only)
- [ ] Can leave server (all users)
- [ ] Can delete server (owner only)
- [ ] Server dock shows all user's servers
- [ ] No console errors
- [ ] No API 404 errors

---

## Important Notes

1. **Shadcn UI already imported**: Use existing [Button](file:///d:/python/AtriumVerse/frontend/components/ui/button.tsx#35-55), `Dialog`, [Input](file:///d:/python/AtriumVerse/frontend/components/ui/input.tsx#5-18), [Avatar](file:///d:/python/AtriumVerse/frontend/components/ui/avatar.tsx#9-24) components
2. **API service ready**: All CRUD methods exist in [api.service.ts](file:///d:/python/AtriumVerse/frontend/lib/services/api.service.ts)
3. **WebSocket events**: ProximityChat listens to `GameEvents.ROOM_ENTER` and `GameEvents.PROXIMITY_MESSAGE`
4. **State management**: Components use React state + EventBus (no Redux/Zustand)
5. **Styling**: Neobrutalism theme (thick black borders, bright colors, shadows)

---

## Previous Work Context

- **Sidebar migration**: Migrated from [ServerHUD.tsx](file:///d:/python/AtriumVerse/frontend/components/game/ServerHUD.tsx) to [BaseSidebar.tsx](file:///d:/python/AtriumVerse/frontend/components/sidebar/BaseSidebar.tsx) ([implementation_plan.md](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/implementation_plan.md))
- **Backend integration**: Connected frontend to FastAPI backend ([backend_integration_walkthrough.md](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/backend_integration_walkthrough.md))
- **API integration**: Replaced localStorage with real API calls ([api_integration_tasks.md](file:///C:/Users/parth/.gemini/antigravity/brain/180d05c7-5a5d-46da-9f77-c584acfbd952/api_integration_tasks.md))

---

## Quick Start for Next LLM

**User request**: "Fix the UI"

**Next step**: Start with Priority 1 (ProximityChat positioning) - just one file edit

**Command**: View [ProximityChat.tsx](file:///d:/python/AtriumVerse/frontend/components/game/ProximityChat.tsx) and add positioning wrapper to return statement.
