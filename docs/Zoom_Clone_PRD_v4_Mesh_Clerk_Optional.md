# Zoom Web App Clone — Product Requirements Document

**Version:** 4.0  
**Status:** Final Implementation PRD / Source of Truth  
**Target:** Scaler SDE evaluation assignment  
**Primary objective:** Build a functional Zoom-inspired video conferencing product while demonstrating sound system-design and engineering decisions.

---

## 1. Executive Summary

Build a polished, functional **Zoom-inspired video conferencing web application**.

This assignment must be treated as more than a UI clone. The implementation should demonstrate understanding of:

- Product workflows
- Frontend architecture
- Backend architecture
- REST APIs
- WebSocket communication
- Native WebRTC
- P2P Mesh media topology
- Database design
- Authentication and authorization
- Real-time state management
- Meeting lifecycle
- Scalability trade-offs

The application should be practical to implement within a **1-day development sprint**.

### Core architectural decision

The current implementation uses:

> **Native browser WebRTC + P2P Mesh + FastAPI WebSockets for signaling.**

An SFU is **not** part of the current implementation.

The production evolution from Mesh → SFU must be documented in the README as a deliberate scalability decision.

### Authentication decision

The assignment does **not require login**. Clerk is included only as a **bonus feature**.

Therefore:

> **Core functionality must never depend on Clerk being configured.**

If Clerk can be integrated cleanly within the time budget, use it. If it becomes a time sink or blocks core functionality, immediately fall back to a deterministic mock/default user.

---

# 2. Non-Negotiable Implementation Priorities

Claude Code must follow this priority order:

1. **Core meeting functionality**
2. **Native WebRTC audio/video**
3. **FastAPI WebSocket signaling**
4. **Multi-participant Mesh behavior**
5. **Meeting/database APIs**
6. **Host and participant controls**
7. **Reliable join/leave/disconnect handling**
8. **Polished UI/UX**
9. **In-meeting chat**
10. **Screen sharing**
11. **Clerk authentication**
12. Other optional polish

Do not allow optional features to delay or destabilize core video/audio functionality.

### Critical rule

**Core WebRTC + signaling must be stable before implementing chat, screen sharing, or optional authentication work.**

---

# 3. Assignment Constraint: 1-Day Execution

This project must be developed as a focused prototype.

The architecture should be clean, but infrastructure should remain intentionally lightweight.

Do **not** introduce:

- Kafka
- Kubernetes
- Microservices
- Redis
- PostgreSQL
- Custom SFU
- Dedicated media server
- Complex event buses
- Production notification infrastructure

unless explicitly requested later.

SQLite is sufficient for this prototype.

---

# 4. Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | Next.js | Web application |
| Frontend language | TypeScript | Type safety |
| Styling | Tailwind CSS | UI |
| Backend | FastAPI | REST APIs + WebSockets |
| Backend language | Python | Server-side logic |
| ORM | SQLAlchemy | Database access |
| Database | SQLite | Prototype persistence |
| Authentication | Clerk (optional bonus) | Authentication |
| Media | Native WebRTC APIs | Audio/video/screen |
| Signaling | FastAPI WebSockets | SDP/ICE + real-time events |
| NAT traversal | STUN | WebRTC connectivity |

---

# 5. Product Goals

## 5.1 User Goals

A user should be able to:

- Open the application
- Enter the application as the default user without requiring authentication
- Optionally authenticate through Clerk
- View a dashboard
- Create an instant meeting
- Schedule a meeting
- Join using a Meeting ID
- Join using a meeting URL
- Preview camera and microphone
- Join a video meeting
- See multiple participants
- Mute/unmute
- Enable/disable camera
- Share screen
- Open participants
- Use meeting chat
- Leave a meeting
- End a meeting as host
- Return to the dashboard

## 5.2 Engineering Goals

The implementation should demonstrate:

- Clear separation of concerns
- REST API design
- WebSocket event routing
- Native WebRTC understanding
- Correct SDP/ICE negotiation
- Database persistence
- Server-side authorization
- Graceful failure handling
- Reasonable scalability awareness
- Maintainable code

---

# 6. Authentication Strategy

## 6.1 Default Behavior — No Login Required

The assignment explicitly permits assuming a default logged-in user.

Therefore the application must support a **mock/default user mode**.

Suggested identity:

```text
user_id = "usr_default_host"
name = "Demo User"
email = "demo@example.com"
```

This user must be sufficient to run the entire core application.

### Important

The application must not become unusable because Clerk environment variables are missing.

---

# 7. Clerk Integration — Optional Bonus

Clerk should be integrated **only after core functionality is working**.

## 7.1 Time Budget

Use a strict time budget:

> **Maximum target: 30 minutes.**

If Clerk integration takes longer because of configuration, middleware, backend verification, environment issues, or debugging:

> **Stop Clerk work and use mock/default-user mode.**

Do not sacrifice WebRTC functionality for authentication.

## 7.2 If Clerk Is Implemented

Provide:

- Sign in
- Sign up
- Sign out
- Current user identity
- Authenticated dashboard

The backend should associate the Clerk identity with an application user record.

Suggested:

```text
users
-----
id
clerk_user_id
name
email
avatar_url
created_at
```

`clerk_user_id` should be unique.

## 7.3 What NOT to Build

Do not build custom:

- Password authentication
- Password hashing
- JWT generation
- Session management
- Password reset
- Email verification

Clerk owns those concerns.

---

# 8. Mock User Abstraction

The code should isolate user identity behind a small authentication/user service.

Conceptually:

```text
get_current_user()
       │
       ├── Clerk configured → authenticated Clerk user
       │
       └── Clerk unavailable → default mock user
```

This prevents authentication from leaking into every business-logic function.

The rest of the application should work with an internal `User` object rather than directly depending on Clerk everywhere.

---

# 9. Application Navigation

Primary navigation:

```text
Dashboard
├── New Meeting
├── Join
└── Schedule
```

Dashboard sections:

```text
Upcoming Meetings
Recent Meetings
```

Optional:

```text
Profile
Settings
```

---

# 10. Dashboard

The dashboard is the main application screen.

## Required UI

Prominent actions:

- New Meeting
- Join Meeting
- Schedule Meeting

## Upcoming Meetings

Display:

- Title
- Date
- Time
- Meeting ID
- Join/start action

## Recent Meetings

Display:

- Title
- Date
- Meeting ID
- Status

## Empty State

When no meetings exist, show an intentional empty state.

---

# 11. Instant Meeting

## User Flow

```text
Dashboard
   ↓
New Meeting
   ↓
POST /api/v1/rooms/instant
   ↓
Create database room
   ↓
Generate unique room code
   ↓
Set current user as host
   ↓
Return meeting
   ↓
Open pre-join lobby
```

## Requirements

- Generate unique Meeting ID.
- Persist room.
- Assign host.
- Set room status appropriately.
- Generate invite URL.
- Allow host to enter the lobby.

---

# 12. Meeting ID

Recommended format:

```text
XXX-XXX-XXX
```

Example:

```text
482-193-721
```

Requirements:

- Unique
- Human-readable
- Easy to copy
- URL-safe

Enforce uniqueness at the database level.

Random generation must handle collisions.

---

# 13. Meeting URL

Recommended route:

```text
/meeting/[roomCode]
```

Example:

```text
/meeting/482-193-721
```

Opening a URL should:

1. Validate the room.
2. Show the pre-join lobby.
3. Allow the user to explicitly join.

Do not automatically start camera/microphone and enter the meeting merely because the URL was opened.

---

# 14. Schedule Meeting

## Required fields

- Title
- Date
- Time
- Duration

Optional:

- Description
- Passcode

## Validation

Server and client must validate:

- Non-empty title
- Valid date/time
- Positive duration
- Valid scheduled time
- Passcode requirements if enabled

## Flow

```text
Schedule form
   ↓
Client validation
   ↓
POST /api/v1/rooms/schedule
   ↓
Server validation
   ↓
Persist room
   ↓
Confirmation
   ↓
Upcoming meetings
```

---

# 15. Pre-Join Lobby

The lobby is mandatory.

## UI

Display:

- Camera preview
- Display name
- Microphone toggle
- Camera toggle
- Join button
- Meeting information

Optional:

- Device selector
- Audio test

## Camera Permission

Use:

```javascript
navigator.mediaDevices.getUserMedia()
```

If camera permission is denied:

- Do not crash.
- Show an error.
- Allow joining with camera disabled.

## Microphone Permission

If denied:

- Allow joining muted.
- Show clear feedback.

---

# 16. Meeting Room

After clicking Join:

```text
Lobby
 ↓
Join API
 ↓
WebSocket connection
 ↓
WebRTC initialization
 ↓
Peer discovery
 ↓
SDP negotiation
 ↓
ICE exchange
 ↓
Remote media
 ↓
Meeting UI
```

The meeting room contains:

- Video area
- Meeting toolbar
- Participants panel
- Chat panel
- Meeting information
- Leave/end controls

---

# 17. WebRTC Architecture

## 17.1 Current Topology: P2P Mesh

```text
             Participant A
              /    |    \
             /     |     \
            /      |      \
           ▼       ▼       ▼
          B        C        D
           \      / \      /
            \    /   \    /
             \  /     \  /
              Mesh peers
```

Every participant maintains a direct WebRTC connection with every other participant.

For `N` participants:

```text
Peer connections = N × (N - 1) / 2
```

Each participant generally sends their media to multiple peers.

## 17.2 Why Mesh for This Prototype?

Mesh is selected because:

- It is self-contained.
- It avoids external media infrastructure.
- It directly demonstrates native WebRTC.
- SDP and ICE signaling are visible and understandable.
- It is appropriate for small demonstration rooms.

## 17.3 Mesh Limitation

Mesh becomes inefficient as room size grows because:

- Peer count grows approximately O(N²).
- Client upload bandwidth increases.
- Client CPU usage increases.
- Browser resource consumption increases.
- Connection management becomes more complex.

Do not claim Mesh is production-scalable for large meetings.

---

# 18. Signaling Architecture

FastAPI WebSockets provide the signaling/control channel.

```text
             SIGNALING
Browser A ───────┐
                 ▼
          FastAPI WebSocket
                 ▲
Browser B ───────┘


             MEDIA
Browser A ═════════════ Browser B
            WebRTC
```

### WebSocket carries

- SDP offers
- SDP answers
- ICE candidates
- Participant events
- Media-state events
- Chat events
- Host commands
- Meeting lifecycle events

### WebSocket does NOT carry

- Audio
- Video
- Screen-share media

Media must remain on the WebRTC media path.

---

# 19. WebRTC Connection Lifecycle

## Participant A joins

```text
A connects
   ↓
A registers with signaling server
   ↓
Server tells A about existing peers
   ↓
A creates RTCPeerConnection(s)
   ↓
A adds local tracks
   ↓
A creates SDP offer
   ↓
Offer → WebSocket → target peer
   ↓
Target sets remote description
   ↓
Target creates answer
   ↓
Answer → WebSocket → A
   ↓
ICE candidates exchanged
   ↓
Connection established
```

The implementation must correctly handle:

- `onicecandidate`
- `ontrack`
- `onconnectionstatechange`
- `oniceconnectionstatechange`
- Peer cleanup

---

# 20. SDP Negotiation

For each required peer connection:

```text
Caller
 ↓
createOffer()
 ↓
setLocalDescription()
 ↓
send offer
 ↓
Receiver
 ↓
setRemoteDescription()
 ↓
createAnswer()
 ↓
setLocalDescription()
 ↓
send answer
 ↓
Caller
 ↓
setRemoteDescription()
```

Do not send SDP through REST APIs.

SDP belongs to the real-time signaling WebSocket.

---

# 21. ICE Candidate Exchange

ICE candidates should be forwarded through WebSocket.

Example:

```json
{
  "type": "ice-candidate",
  "target_peer_id": "peer-456",
  "candidate": {}
}
```

The frontend must correctly handle candidate timing relative to remote descriptions.

---

# 22. STUN

Development configuration may use:

```text
stun:stun.l.google.com:19302
```

Keep ICE configuration centralized.

Production architecture should support TURN as a fallback.

TURN is optional for this assignment unless testing requires it.

---

# 23. Peer Connection State

Frontend concept:

```text
peerConnections: Map<peerId, RTCPeerConnection>
remoteStreams: Map<peerId, MediaStream>
```

For each remote peer:

- Create one `RTCPeerConnection`.
- Add local media tracks.
- Receive remote tracks.
- Store remote stream.
- Render corresponding video tile.

When peer leaves:

```text
close RTCPeerConnection
remove peerConnections entry
remove remoteStreams entry
remove participant tile
```

---

# 24. Local Media

Use:

```javascript
navigator.mediaDevices.getUserMedia({
  audio: true,
  video: true
})
```

depending on pre-join state.

Local stream contains:

```text
MediaStream
├── AudioTrack
└── VideoTrack
```

Add required tracks to every active peer connection.

---

# 25. Microphone

Mute/unmute should primarily control the local audio track.

Conceptually:

```text
audioTrack.enabled = false
```

When state changes:

- Update local UI.
- Broadcast participant media state.

The server may maintain the participant's current state for other users.

---

# 26. Camera

Camera toggle:

```text
videoTrack.enabled = false/true
```

Update:

- Local video state
- Participant state
- Remote UI indicators

If video is off, show:

```text
Avatar / Initial
Name
```

---

# 27. Screen Sharing

Use:

```javascript
navigator.mediaDevices.getDisplayMedia()
```

## Required behavior

- Start screen sharing.
- Publish screen track.
- Show sharing state.
- Receive screen media remotely.
- Stop screen sharing.
- Restore camera track where possible.

Do not send screen-share data through FastAPI.

### Priority

Screen sharing is **secondary to core video/audio**.

Do not implement it until:

- Local camera works
- Local microphone works
- Remote video works
- Remote audio works
- Multi-user signaling works
- Peer disconnect cleanup works

---

# 28. Gallery View

Gallery view displays participant tiles.

Each tile contains:

- Video
- Display name
- Mic state
- Camera state
- Speaking state where available
- Host indicator where applicable

If video is disabled, display avatar/initials.

Grid should adapt to participant count.

---

# 29. Speaker View

Speaker view:

```text
┌────────────────────────────────────┐
│                                    │
│           Active Speaker           │
│                                    │
├─────────┬─────────┬────────────────┤
│ Person 2│ Person 3│ Person 4       │
└─────────┴─────────┴────────────────┘
```

The implementation may use a lightweight active-speaker heuristic.

Do not build complex audio intelligence.

---

# 30. Participants Panel

Show:

- Participant name
- Host badge
- Mic status
- Camera status
- Speaking indicator

Host sees:

- Mute
- Remove

Optional:

- Mute all

---

# 31. Host Authorization

Host actions must be verified by the backend.

Never trust:

```text
is_host = true
```

from the frontend.

Instead:

```text
Authenticated user
       ↓
Room lookup
       ↓
room.host_id == current_user.id
       ↓
Allow host action
```

Host-only operations:

- Remove participant
- Mute participant
- Mute all
- End meeting

---

# 32. Mute Participant

Host:

```text
Participants
 ↓
Mute
 ↓
WebSocket/API command
 ↓
Backend verifies host
 ↓
Target participant receives command
 ↓
Target disables microphone
```

The target client should apply the mute state.

Do not pretend that a server-side database boolean physically controls another browser's microphone. The browser must receive and apply the command.

---

# 33. Remove Participant

Flow:

```text
Host
 ↓
Remove participant
 ↓
Backend verifies host
 ↓
Target receives remove event
 ↓
Target cleans media
 ↓
Target closes meeting connection
 ↓
Return to lobby/dashboard
```

---

# 34. End Meeting

Only the host can end the meeting.

Flow:

```text
Host
 ↓
End Meeting
 ↓
Backend authorization
 ↓
room.status = ENDED
 ↓
Broadcast meeting-ended
 ↓
Participants clean up
 ↓
Return to dashboard
```

After a room is ended:

- New joins should be rejected.
- Existing participants should be disconnected from the meeting experience.

---

# 35. Leave Meeting

Any participant can leave.

Flow:

```text
Leave
 ↓
Stop local tracks
 ↓
Close peer connections
 ↓
Close WebSocket
 ↓
Notify backend
 ↓
Update participant session
 ↓
Return dashboard
```

Use `try/finally`-style cleanup wherever appropriate.

---

# 36. Participant Disconnect

Handle:

- Browser tab close
- Network disconnect
- WebSocket disconnect
- WebRTC failure

When detected:

```text
disconnect
 ↓
backend cleanup
 ↓
broadcast peer-left
 ↓
clients close peer connection
 ↓
remove video tile
 ↓
update participant state
```

Avoid stale participants.

---

# 37. In-Meeting Chat

Chat is required but lower priority than core WebRTC.

## Data flow

```text
Participant
 ↓
WebSocket
 ↓
FastAPI
 ↓
Validate room/session
 ↓
Persist message
 ↓
Broadcast
 ↓
Other participants
```

## Message

```json
{
  "type": "chat-message",
  "message": "Hello everyone"
}
```

Store:

- Room
- Sender
- Message
- Timestamp

Validate and limit message size.

---

# 38. Chat Implementation Priority

Do not implement persistent chat until:

- WebRTC signaling is stable.
- Multi-user video is stable.
- Audio is stable.
- Join/leave is stable.
- Peer cleanup is stable.

If time becomes constrained, prioritize a working real-time chat experience over elaborate persistence/UI.

---

# 39. Meeting Lifecycle

Room states:

```text
SCHEDULED
ACTIVE
ENDED
```

Typical flow:

```text
SCHEDULED
    ↓
START
    ↓
ACTIVE
    ↓
END
    ↓
ENDED
```

Instant meetings may begin directly as `ACTIVE`.

---

# 40. Database Schema

Use SQLAlchemy models.

## users

```text
users
-----
id
clerk_user_id       nullable/optional
name
email
avatar_url
created_at
```

When mock-user mode is used, Clerk-specific fields may be null.

## rooms

```text
rooms
-----
id
room_code
title
description
host_id
scheduled_for
duration_minutes
passcode_hash
media_room_id
status
created_at
started_at
ended_at
```

## participants

```text
participants
------------
id
room_id
user_id
peer_id
display_name
role
is_muted
is_video_off
joined_at
left_at
```

## chat_messages

```text
chat_messages
-------------
id
room_id
participant_id
message
created_at
```

---

# 41. Database Relationships

```text
users
  │
  │ 1:N
  ▼
rooms
  │
  ├───────────────┐
  │               │
  │ 1:N           │ 1:N
  ▼               ▼
participants   chat_messages
```

Recommended indexes:

```text
rooms.room_code
rooms.host_id
rooms.scheduled_for
rooms.status
participants.room_id
participants.peer_id
chat_messages.room_id
chat_messages.created_at
```

Do not over-index the prototype database.

---

# 42. API Specification

Base:

```text
/api/v1
```

## Health

```http
GET /api/v1/health
```

## Instant room

```http
POST /api/v1/rooms/instant
```

Request:

```json
{
  "title": "Instant Meeting"
}
```

## Schedule

```http
POST /api/v1/rooms/schedule
```

## Validate room

```http
GET /api/v1/rooms/validate/{room_code}
```

## Upcoming

```http
GET /api/v1/rooms/upcoming
```

## Recent

```http
GET /api/v1/rooms/recent
```

## Room details

```http
GET /api/v1/rooms/{room_code}
```

## Join

```http
POST /api/v1/rooms/{room_code}/join
```

## Leave

```http
POST /api/v1/rooms/{room_code}/leave
```

## End

```http
POST /api/v1/rooms/{room_code}/end
```

All protected operations should use the application's current-user abstraction.

---

# 43. WebSocket Protocol

Suggested endpoint:

```text
/ws/rooms/{room_code}
```

Events:

```text
join
peer-joined
offer
answer
ice-candidate
peer-left
media-state
chat-message
host-command
meeting-ended
```

## Join

```json
{
  "type": "join",
  "peer_id": "peer-123",
  "display_name": "Demo User"
}
```

## Peer joined

```json
{
  "type": "peer-joined",
  "peer_id": "peer-456",
  "display_name": "Alice"
}
```

## Offer

```json
{
  "type": "offer",
  "target_peer_id": "peer-456",
  "sdp": "..."
}
```

## Answer

```json
{
  "type": "answer",
  "target_peer_id": "peer-123",
  "sdp": "..."
}
```

## ICE

```json
{
  "type": "ice-candidate",
  "target_peer_id": "peer-456",
  "candidate": {}
}
```

## Peer left

```json
{
  "type": "peer-left",
  "peer_id": "peer-456"
}
```

## Media state

```json
{
  "type": "media-state",
  "peer_id": "peer-123",
  "is_muted": true,
  "is_video_off": false
}
```

## Meeting ended

```json
{
  "type": "meeting-ended"
}
```

The schema can be refined during implementation, but event responsibilities must remain separated.

---

# 44. WebSocket Server Responsibilities

FastAPI WebSockets must:

- Associate connections with authenticated/mock users.
- Validate room membership.
- Register active peer sessions.
- Route SDP.
- Route ICE candidates.
- Broadcast participant events.
- Broadcast media state.
- Route chat.
- Process host commands.
- Broadcast meeting-ended.
- Clean up disconnected connections.

The server must **not** relay media.

---

# 45. Frontend State Architecture

Separate:

## Application State

```text
currentUser
room
meeting
participants
host
```

## UI State

```text
layout
activePanel
modal
loading
error
```

## Media State

```text
localStream
cameraEnabled
microphoneEnabled
screenStream
```

## WebRTC State

```text
peerConnections
remoteStreams
connectionStates
```

Do not create one giant state object for everything.

---

# 46. Suggested Frontend Structure

```text
frontend/
├── app/
│   ├── page.tsx
│   ├── dashboard/
│   ├── join/
│   ├── schedule/
│   └── meeting/
│       └── [roomCode]/
│
├── components/
│   ├── dashboard/
│   ├── lobby/
│   ├── meeting/
│   ├── participants/
│   ├── chat/
│   └── common/
│
├── hooks/
│   ├── useWebRTC.ts
│   ├── useSignaling.ts
│   └── useLocalMedia.ts
│
├── services/
│   └── api.ts
│
├── lib/
├── types/
└── utils/
```

The exact naming can differ, but responsibilities should remain separated.

---

# 47. Suggested Backend Structure

```text
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database/
│   ├── models/
│   ├── schemas/
│   ├── api/
│   ├── services/
│   ├── repositories/
│   └── websocket/
│
└── seed_db.py
```

Preferred dependency direction:

```text
API/WebSocket
      ↓
Services
      ↓
Repositories
      ↓
SQLAlchemy
      ↓
SQLite
```

Do not put substantial business logic directly inside route handlers.

---

# 48. Error Handling

Handle:

## Meeting

- Invalid ID
- Room not found
- Room ended
- Invalid passcode
- Join denied

## Authentication

- Clerk unavailable
- Unauthenticated Clerk user
- Invalid user
- Unauthorized host action

## Media

- Camera denied
- Microphone denied
- Screen share denied
- WebRTC failure

## Network

- WebSocket disconnect
- Backend unavailable
- Peer disconnect

Use clear UI states.

Never expose raw stack traces to users.

---

# 49. Security

Mandatory:

- Server-side authorization
- Input validation
- Room existence validation
- Host ownership verification
- Secret management through environment variables
- No secrets committed to Git
- No client-provided host flag trusted
- Chat message validation
- Passcode hashing if passcodes are enabled

For Clerk:

- Publishable key may be used on the client as intended by Clerk.
- Secret key must remain server-side.
- Do not expose server secrets through Next.js public environment variables.

---

# 50. Environment Variables

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_WS_BASE_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY   # optional
```

Backend:

```text
DATABASE_URL
CORS_ORIGINS
STUN_SERVER
CLERK_SECRET_KEY                    # optional
```

Provide:

```text
.env.example
```

The application should have a clear development configuration even when Clerk variables are absent.

---

# 51. Responsive UI

Support:

- Desktop
- Tablet
- Mobile

Meeting controls must remain usable on smaller screens.

Desktop can show:

```text
Video area + side panel + toolbar
```

Mobile can use:

```text
Video area
+
compact controls
+
drawer panels
```

---

# 52. Visual Requirements

Use a professional conferencing-product aesthetic:

- Dark meeting environment
- Clean spacing
- Clear hierarchy
- Large video area
- Strong toolbar
- Participant cards
- Clear muted/camera-off states
- Loading states
- Empty states
- Error states

Do not copy proprietary Zoom source code or assets.

The objective is a **Zoom-inspired product experience**.

---

# 53. Testing Strategy

## Backend

Test:

- Room creation
- Unique room IDs
- Scheduling
- Room validation
- Join
- Leave
- End
- Host authorization
- Participant persistence
- Chat persistence

## WebSocket

Test:

- Connect
- Join
- Peer discovery
- SDP routing
- ICE routing
- Peer leave
- Chat broadcast
- Meeting-ended event

## WebRTC Manual Test

Minimum:

```text
Browser A ↔ Browser B
```

Preferred:

```text
Browser A
   ↕ ↖
   B  C
```

Test:

- Camera
- Microphone
- Remote audio
- Remote video
- Mute
- Camera off
- Screen share
- Participant join
- Participant leave
- Host mute
- Remove
- End meeting

Use multiple browser tabs/windows or separate browser profiles/devices.

---

# 54. Development Phases

## Phase 0 — Project Inspection

Before changing code:

- Inspect existing repository.
- Identify existing stack.
- Identify existing routes/components.
- Identify existing backend structure.
- Do not unnecessarily rewrite existing working code.

## Phase 1 — Foundation

- Next.js
- FastAPI
- Tailwind
- SQLAlchemy
- SQLite
- API communication
- Environment configuration

## Phase 2 — Database

Create:

- users
- rooms
- participants
- chat_messages

Add relationships and indexes.

## Phase 3 — Mock User First

Implement a default user abstraction so the application can work without authentication.

Example:

```text
usr_default_host
```

This is the guaranteed execution path.

## Phase 4 — Meeting APIs

Implement:

- Instant room
- Schedule room
- Validate room
- Upcoming
- Recent
- Join
- Leave
- End

## Phase 5 — Dashboard

Implement:

- New Meeting
- Join
- Schedule
- Upcoming
- Recent

## Phase 6 — Pre-Join Lobby

Implement:

- Camera
- Microphone
- Display name
- Join

## Phase 7 — WebSocket Signaling

Implement:

- Connection
- Peer registration
- Peer discovery
- SDP
- ICE
- Peer disconnect

## Phase 8 — Native WebRTC Mesh

This is the **highest-priority technical phase**.

Implement:

- `getUserMedia`
- `RTCPeerConnection`
- Local tracks
- Remote tracks
- Peer connection map
- SDP offer/answer
- ICE candidates
- Connection cleanup

### Stop here and test thoroughly.

Do not continue until two-browser audio/video is stable.

## Phase 9 — Multi-Participant Stability

Test:

```text
2 participants
↓
3 participants
↓
4+ participants
```

Fix:

- Race conditions
- Duplicate peer connections
- Candidate timing
- Cleanup
- Reconnect issues
- Stale participant state

## Phase 10 — Meeting Controls

Implement:

- Mic
- Camera
- Participants
- Gallery
- Speaker
- Host controls
- Leave
- End

## Phase 11 — Chat

Implement after WebRTC stability.

## Phase 12 — Screen Sharing

Implement after WebRTC stability.

## Phase 13 — Clerk Bonus

Only if the core system is complete and stable.

Target maximum:

```text
30 minutes
```

If Clerk causes blocking issues:

> Revert to mock user and move on.

## Phase 14 — Final Hardening

Test:

- Permissions
- Invalid rooms
- Ended rooms
- Disconnects
- Browser refresh
- Multiple participants
- Host controls
- Mobile layout
- Error states

## Phase 15 — Documentation

Complete:

- README
- Architecture diagram
- WebRTC explanation
- Database diagram
- API documentation
- Setup instructions
- Trade-offs
- Limitations
- Future SFU architecture

---

# 55. Definition of Done

## Core

- [ ] Application starts locally
- [ ] Dashboard works
- [ ] Default/mock user works without Clerk
- [ ] Instant meeting works
- [ ] Schedule meeting works
- [ ] Join by ID works
- [ ] Join by URL works
- [ ] Pre-join lobby works
- [ ] Camera works
- [ ] Microphone works
- [ ] Two-person WebRTC works
- [ ] Multi-person Mesh works
- [ ] WebSocket signaling works
- [ ] SDP exchange works
- [ ] ICE exchange works
- [ ] Participant join works
- [ ] Participant leave works
- [ ] Disconnect cleanup works

## Meeting Controls

- [ ] Mute/unmute
- [ ] Camera on/off
- [ ] Gallery view
- [ ] Speaker view
- [ ] Participants panel
- [ ] Host mute
- [ ] Remove participant
- [ ] End meeting
- [ ] Leave meeting

## Secondary

- [ ] Chat
- [ ] Screen sharing

## Bonus

- [ ] Clerk sign-in
- [ ] Clerk sign-up
- [ ] Clerk sign-out
- [ ] Clerk identity mapping

## Quality

- [ ] Error states
- [ ] Loading states
- [ ] Empty states
- [ ] Responsive UI
- [ ] No hardcoded secrets
- [ ] Clean architecture
- [ ] README
- [ ] `.env.example`

---

# 56. Explicit Scope Guardrails

Claude Code must follow these rules:

### Rule 1 — Do not over-engineer

This is a 1-day assignment.

Prefer a working simple architecture over an elaborate incomplete architecture.

### Rule 2 — Do not replace Mesh with SFU

Current media architecture is:

> **Native WebRTC P2P Mesh**

Do not integrate LiveKit, mediasoup, Janus, or another SFU unless explicitly instructed later.

### Rule 3 — Do not make Clerk mandatory

The application must work without Clerk.

Clerk is bonus functionality.

### Rule 4 — WebRTC comes first

Do not spend substantial time polishing UI while core WebRTC is broken.

### Rule 5 — No fake video

The meeting must use real browser media.

Do not simulate participants with static videos as a replacement for WebRTC.

### Rule 6 — FastAPI does not carry media

Do not send audio/video through HTTP or WebSocket.

### Rule 7 — Do not trust frontend authorization

Host privileges must be checked server-side.

### Rule 8 — Do not add production infrastructure prematurely

SQLite and a single FastAPI application are sufficient for the assignment.

### Rule 9 — Optional features are expendable

If time is running out, remove/defer:

1. Advanced UI polish
2. Advanced active-speaker behavior
3. Persistent chat enhancements
4. Screen-share polish
5. Clerk

Do **not** remove:

- WebRTC
- Signaling
- Meeting creation
- Meeting joining
- Audio/video
- Participant management
- Database
- Core host controls

---

# 57. Final Architecture

```text
                         ┌─────────────────────┐
                         │       Clerk         │
                         │ Optional Bonus Auth │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
│                                                          │
│ Dashboard → Lobby → Meeting Room                        │
│                                                          │
│ Native WebRTC                                             │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
                │ HTTPS                     │ WebSocket
                ▼                           ▼
        ┌───────────────┐          ┌──────────────────┐
        │    FastAPI    │          │ Signaling Layer  │
        │ REST API      │          │                  │
        └───────┬───────┘          └────────┬─────────┘
                │                           │
                ▼                           │
        ┌───────────────┐                   │
        │ SQLite        │                   │
        │ SQLAlchemy    │                   │
        └───────────────┘                   │
                                            │
                                    SDP / ICE / Events
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │     WebRTC P2P Mesh     │
                              │                         │
                              │ A ↔ B                   │
                              │ A ↔ C                   │
                              │ B ↔ C                   │
                              └─────────────────────────┘
```

---

# 58. Production Evolution

The prototype:

```text
Native WebRTC
      ↓
P2P Mesh
```

Production evolution:

```text
Native WebRTC Client
        ↓
      SFU
        ↓
Multiple SFU instances
        ↓
Room assignment / load balancing
        ↓
Regional media infrastructure
```

Additional production components may eventually include:

```text
Load Balancer
API Servers
PostgreSQL
Redis
SFU Cluster
TURN
Monitoring
Logging
Autoscaling
```

These are **future system-design considerations**, not current assignment requirements.

---

# 59. README Architectural Decision

The README must explicitly contain a section titled:

```text
## Architecture Decision: P2P Mesh vs SFU
```

It should explain:

### Why Mesh was selected

- Small prototype room sizes
- Self-contained implementation
- Native WebRTC demonstration
- No external media infrastructure
- Lower implementation risk within the 1-day assignment

### Trade-offs

```text
P2P Mesh

Advantages:
- Simple architecture
- No media server
- Direct WebRTC knowledge
- Self-contained

Disadvantages:
- O(N²) peer relationships
- Higher client upload bandwidth
- Higher client CPU usage
- Poor fit for large rooms
```

### Future SFU

Explain that an SFU would:

- Receive streams from participants.
- Forward streams to other participants.
- Reduce client upload requirements.
- Make larger rooms practical.
- Add media-server infrastructure and operational complexity.

The README must make clear that:

> **Choosing Mesh for this prototype is a deliberate scope and architecture trade-off, not a claim that Mesh is the optimal production architecture.**

---

# 60. Final Engineering Principle

The finished application should tell a clear engineering story:

```text
Product Requirement
       ↓
Simple Prototype Architecture
       ↓
Native WebRTC + FastAPI Signaling
       ↓
P2P Mesh
       ↓
Working Multi-User Meeting
       ↓
Identify Scalability Limitation
       ↓
Explain SFU Migration
       ↓
Production Architecture
```

The goal is not to build every production feature.

The goal is to demonstrate:

> **"I can understand a product, make explicit architectural trade-offs, build the core system correctly, and explain how I would evolve it when the constraints change."**

That is the primary engineering outcome of this assignment.
