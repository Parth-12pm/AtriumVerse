I am building a Gather.town–like spatial platform. 
The core idea is that the virtual world comes FIRST, and communication is layered on top of it.
Users:
- log in
- enter a shared 2D world
- move around with avatars
- see other users as presence, not as chat windows
The world is the source of truth.
Movement, zones, and proximity drive everything else.
Flow of the system:
1) A user enters the world.
   - They can move freely.
   - They can see others moving.
   - No communication is forced yet.
2) The world is divided into zones.
   - Zones are just logical areas on the map.
   - Zones can be public or private.
   - Entering or exiting a zone is a meaningful event.
3) Temporary interaction is zone-based.
   - When a user ENTERS a zone:
     - they temporarily connect to that zone’s communication context
   - When a user EXITS the zone:
     - that communication context is destroyed
   - Temporary chat and audio exist ONLY while inside the zone
   - Nothing temporary is persisted
4) Proximity matters inside zones.
   - Audio volume depends on distance between users
   - The world controls communication, not the UI
5) Permanent communication exists outside the world logic.
   - There is a server-level permanent chat
   - Messages are stored and always accessible
   - Permanent chat is NOT tied to zones or proximity
Important principles:
- The world drives communication, never the other way around
- Zones trigger lifecycle events (enter → connect, exit → disconnect)
- Temporary communication is disposable
- Permanent communication is persistent
- Features are layered progressively, not all at once
Current state:
- Movement and presence work
- I want help designing the next layers without mixing responsibilities
- Do not jump ahead or introduce future systems early
- Think in terms of lifecycle and flow, not isolated features
and we can use livekit for webrtc purposes 