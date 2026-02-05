# Gather.town v2 UI Structure Analysis & Proposal

## Key Observations from Gather.town Screenshots

### 1. **Two Distinct Chat Systems**

#### A. Permanent Chat (Sidebar)
- **Location**: Left sidebar, always visible
- **Structure**: 
  - Channels (#general, #social)
  - Direct Messages (DMs)
  - Full message history
  - Saved and persistent
- **Purpose**: Long-form communication, announcements, team coordination

#### B. Proximity Chat (Temporary Overlay)
- **Location**: Bottom-center overlay on game canvas
- **Structure**:
  - Header: "Send nearby"
  - Input field: "Message..."
  - Disclaimer: "Messages here are not saved"
  - Small, compact, dismissible
- **Purpose**: Quick, ephemeral communication with nearby players
- **Behavior**: Only visible when toggled, disappears after use

### 2. **Media Controls + Minimap Integration**

Gather.town combines media controls and minimap into a **single bottom-left panel**:
- **Panel Title**: "parth's desk" (or user's location)
- **Top Section**: Minimap (circular, shows proximity circle)
- **Bottom Section**: Media controls row
  - User avatar with status
  - Mic toggle (with mute indicator)
  - Camera toggle
  - Screen share
  - Reactions
  - Hand raise
  - More options
  - Leave button

### 3. **Sidebar Structure**

- **Left Edge**: Vertical icon bar (persistent navigation)
  - Logo
  - Search
  - Map/Resources
  - Chat (permanent)
  - Calendar
  - Notifications
  - Gifts
  - Settings
- **Main Sidebar Content**: 
  - Header with user/space name
  - "Experience Gather together" invite section
  - Search bar
  - Channels list
  - DMs list
  - Online users

## Current Implementation Issues

1. ❌ **ChatOverlay** is labeled "Global Chat" but should be "Proximity Chat" (temporary)
2. ❌ **SidebarChat** doesn't distinguish between channels and DMs
3. ❌ **MediaControls** and **Minimap** are separate - should be integrated
4. ❌ No clear separation between permanent and proximity chat
5. ❌ Media controls are at bottom-center, should be bottom-left with minimap

## Proposed Solution

### Architecture Changes

```
┌─────────────────────────────────────────────────────────┐
│  Left Sidebar (Permanent)                               │
│  ├─ Navigation Icons (left edge)                        │
│  ├─ Header (Space/User name)                           │
│  ├─ Invite Section                                      │
│  ├─ Search                                             │
│  ├─ Channels (#general, #social)                        │
│  ├─ Direct Messages                                     │
│  └─ Online Users                                       │
│                                                         │
│  Main Game Area                                         │
│  ├─ Game Canvas                                        │
│  ├─ Proximity Chat Overlay (bottom-center, toggleable) │
│  └─ Media Panel (bottom-left)                          │
│     ├─ Minimap (top)                                   │
│     └─ Media Controls (bottom)                         │
└─────────────────────────────────────────────────────────┘
```

### Component Restructure

1. **Rename & Refactor ChatOverlay → ProximityChat**
   - Change header to "Send nearby"
   - Add "Messages here are not saved" disclaimer
   - Make it smaller, more compact
   - Only show messages from proximity chat scope

2. **Enhance SidebarChat → Permanent Chat System**
   - Add channels support (#general, #social)
   - Add DMs support
   - Show full message history
   - Add channel/DM switching

3. **Create MediaPanel Component**
   - Combines Minimap + MediaControls
   - Bottom-left position
   - Picture-in-picture style
   - Shows user's current location/zone name
   - Draggable/resizable

4. **Update EventBus**
   - Add `PROXIMITY_CHAT_MESSAGE` event (separate from permanent chat)
   - Add `PERMANENT_CHAT_MESSAGE` event
   - Distinguish message scopes clearly

5. **Backend Integration**
   - Proximity chat: Not saved, only broadcasted to nearby players
   - Permanent chat: Saved to database, accessible in sidebar

## Implementation Plan

### Phase 1: Separate Chat Systems
- [ ] Rename ChatOverlay to ProximityChat
- [ ] Update ProximityChat UI (smaller, "Send nearby" header)
- [ ] Filter messages by scope (only proximity)
- [ ] Update SidebarChat to handle permanent chat only

### Phase 2: Media Panel Integration
- [ ] Create MediaPanel component
- [ ] Integrate Minimap into MediaPanel
- [ ] Integrate MediaControls into MediaPanel
- [ ] Position at bottom-left
- [ ] Add zone/location name display

### Phase 3: Sidebar Enhancement
- [ ] Add channels list to SidebarChat
- [ ] Add DMs list to SidebarChat
- [ ] Add channel switching
- [ ] Update navigation icons

### Phase 4: Backend Updates
- [ ] Add proximity chat endpoint (not saved)
- [ ] Add permanent chat endpoint (saved)
- [ ] Update WebSocket handlers for both types
