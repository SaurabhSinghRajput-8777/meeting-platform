# Scaler Meet — Zoom-Inspired Video Conferencing Web App

A functional Zoom-inspired video conferencing product built as a focused 1-day
prototype, demonstrating product workflows, REST APIs, WebSocket signaling,
**native browser WebRTC with a P2P Mesh topology**, and a deliberate,
documented scalability trade-off (Mesh → SFU).

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | SQLite + SQLAlchemy |
| Signaling | FastAPI WebSockets (`/ws/rooms/{room_code}`) |
| Media | **Native browser WebRTC** — P2P Mesh (no third-party video SDK, no SFU) |
| Auth | Mock/default user (no login required); Clerk optional bonus |

---

## Quick Start

Prerequisites: **Python 3.10+** and **Node.js 18+**.

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements-dev.txt   # includes test dependencies
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at
`/docs`). Tables are created automatically and the default mock user
(`usr_default_host` / Demo User) is seeded on startup.

Optional: `python seed_db.py` for explicit initialization.

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. No login and no environment variables are
required — the app runs in **mock/default-user mode** out of the box.

### 3. Have a real meeting

1. Click **New Meeting** (browser A) → lobby → **Join meeting**.
2. Copy the meeting ID / URL, open it in a second browser window (or another
   device on the same network), **change the display name in the lobby**
   (e.g. "Alice") and join.
3. You should see and hear both participants — media flows directly between
   the browsers over WebRTC.

> **Multi-participant tip (mock-user mode):** every browser starts as the same
> default user. When a browser joins a meeting it did not create, it
> automatically gets a distinct *guest identity* (named after the display name
> chosen in the lobby), so host controls (mute / remove / end) behave
> realistically during multi-browser demos. The room creator keeps the default
> user identity and remains the host.

---

## Configuration

Copy the example env files if you want non-default values (never commit real
`.env` files):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | backend | `sqlite:///<backend>/scaler.db` | SQLite database location |
| `CORS_ORIGINS` | backend | `http://localhost:3000` | Allowed CORS origins |
| `STUN_SERVER` | backend | `stun:stun.l.google.com:19302` | ICE/STUN configuration (single source of truth) |
| `CLERK_SECRET_KEY` / `CLERK_ISSUER` | backend | unset | Optional Clerk bonus auth |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `http://localhost:8000` | REST API base URL |
| `NEXT_PUBLIC_WS_BASE_URL` | frontend | `ws://localhost:8000` | WebSocket base URL |
| `NEXT_PUBLIC_STUN_SERVER` | frontend | Google STUN | Must match the backend STUN setting |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | unset | Optional Clerk bonus auth |

---

## Architecture Overview

```text
                         ┌─────────────────────┐
                         │  Clerk (optional)   │
                         │  Bonus auth only    │
                         └──────────┬──────────┘
                                    │  (absent → mock/default user)
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js Frontend                           │
│                                                                  │
│   Dashboard ──► Pre-join Lobby ──► Meeting Room                  │
│   (REST)                            (WebSocket + WebRTC)         │
│                                                                  │
│   useLocalMedia · useSignaling(WS) · useWebRTC (Mesh)            │
└──────────────┬──────────────────────────────┬────────────────────┘
               │ REST (JSON)                  │ WebSocket (signaling)
               ▼                              ▼
      ┌────────────────┐            ┌────────────────────┐
      │     FastAPI    │            │  Signaling Layer   │
      │  REST APIs     │            │  (FastAPI WS)      │
      │  (rooms/auth)  │            │  SDP/ICE routing,  │
      └───────┬────────┘            │  events, chat      │
              │                     └─────────┬──────────┘
              ▼                               │
      ┌────────────────┐                      │ SDP / ICE / events only
      │ SQLite         │                      │ (NEVER media)
      │ + SQLAlchemy   │                      ▼
      └────────────────┘        ┌─────────────────────────────┐
                                │      WebRTC P2P Mesh        │
                                │   A ↔ B   A ↔ C   B ↔ C     │
                                │   (getUserMedia/getDisplay- │
                                │    Media, RTCPeerConnection)│
                                └─────────────────────────────┘
```

### Data flow

- **REST** — dashboard, meeting creation/scheduling, validation, join
  eligibility (passcode), leave, end, room lists.
- **WebSocket** — the real-time channel: peer discovery, SDP offer/answer
  relay, ICE candidate relay, participant join/leave events, media state,
  chat, host commands, meeting-ended broadcast.
- **WebRTC** — all audio, video and screen-share media flows **directly
  between browsers**. The FastAPI server never sees a single media packet.

### Dependency direction (backend)

```text
API / WebSocket routes
        ↓
    Services (business logic, authorization)
        ↓
    Repositories (thin data access)
        ↓
    SQLAlchemy → SQLite
```

---

## Architecture Decision: P2P Mesh vs SFU

### Current topology: P2P Mesh

Every participant maintains a direct `RTCPeerConnection` with every other
participant:

```text
             Participant A
              /    |    \
             /     |     \
            ▼      ▼      ▼
           B       C      D
            \     / \     /
             \   /   \   /
              \ /     \ /
            Mesh peers
```

For `N` participants there are `N × (N − 1) / 2` peer connections, and each
participant **uploads their media once per remote peer**.

### Why Mesh was selected

- **Small prototype room sizes** — the PRD targets small demonstration rooms
  (2–6 participants), where Mesh works well.
- **Self-contained implementation** — no external media infrastructure, no
  servers to deploy or pay for; the whole product runs as two local processes.
- **Native WebRTC demonstration** — SDP negotiation, ICE candidate exchange,
  track handling and peer lifecycle are directly visible and understandable
  in the code (`frontend/hooks/useWebRTC.ts`), which is the point of the
  assignment.
- **Lower implementation risk** within the 1-day budget; an SFU
  (mediasoup/LiveKit/Janus) would consume most of the budget on media-server
  plumbing rather than product functionality.

### Trade-offs

```text
P2P Mesh — Advantages              P2P Mesh — Disadvantages
--------------------------------   --------------------------------
Simple architecture                O(N²) peer relationships
No media server                    Client upload bandwidth grows with N
Direct WebRTC knowledge            Client CPU/encoding load grows with N
Self-contained / zero infra        Poor fit for large rooms
Best possible latency (direct)     Connection management complexity grows
```

A 4-person mesh is fine; a 15-person mesh would require each browser to
upload ~14 simultaneous video streams — beyond typical home uplinks. **Do not
read Mesh as a claim of production scalability.**

> **Choosing Mesh for this prototype is a deliberate scope and architecture
> trade-off, not a claim that Mesh is the optimal production architecture.**

### Future SFU migration (documented, not implemented)

When room sizes grow, the media layer would evolve:

```text
Native WebRTC client (unchanged getUserMedia / RTCPeerConnection)
        ↓
Single SFU (selective forwarding unit)
        ↓
Multiple SFU instances
        ↓
Room assignment / load balancing
        ↓
Regional media infrastructure
```

An SFU would:

- **Receive** each participant's stream **once** and **forward** it to the
  other participants — client upload becomes O(1) instead of O(N).
- Make larger rooms practical (10s–100s of participants) and enable server-side
  recording, transcoding and simulcast.
- Add real costs: media-server infrastructure (e.g. mediasoup/LiveKit), TURN
  becomes mandatory in many networks, plus operational complexity (capacity
  planning, regional deployment, monitoring).

Importantly, the migration is **incremental**: the signaling protocol
(`join/offer/answer/ice-candidate`) stays conceptually the same; only the
peer a client negotiates with changes (the SFU instead of every other
participant). The `rooms.media_room_id` column already anticipates a media
subsystem assigning its own room identifiers.

---

## WebRTC Implementation Notes

Implemented in `frontend/hooks/useWebRTC.ts` + `hooks/useLocalMedia.ts`:

- **Local media** — `navigator.mediaDevices.getUserMedia({audio, video})` in
  the pre-join lobby; tracks are reused for the meeting. Permission denial is
  handled gracefully (join with camera/mic off, clear UI feedback).
- **Peer connections** — one `RTCPeerConnection` per remote participant,
  local tracks added to every peer, `ontrack` builds one `MediaStream` per
  peer that renders a video tile.
- **Negotiation** — the newly-joining participant creates the offers (the
  server tells it about existing peers via the `welcome` message); existing
  participants answer. Later renegotiations (screen share, enabling camera
  after joining without one) are driven by `onnegotiationneeded` with a
  **perfect-negotiation guard** (deterministic polite/impolite bit derived
  from peer-id comparison) to survive SDP glare.
- **ICE** — candidates are relayed through the WebSocket and **buffered**
  until the remote description is set, avoiding candidate/SDP ordering races.
  STUN: `stun:stun.l.google.com:19302` (centralized in `lib/config.ts` and
  `backend/app/config.py`).
- **Screen sharing** — `getDisplayMedia()`; the screen track
  `replaceTrack()`s the video sender on every peer connection (no
  renegotiation needed); falls back to `addTrack` + renegotiation when the
  user joined without a camera track. The browser's "Stop sharing" bar is
  wired through `track.onended`.
- **Mute / camera off** — toggling the local track's `enabled` flag plus a
  `media-state` broadcast so remote UIs update.
- **Cleanup** — `peer-left` / WebSocket disconnect / `beforeunload` all close
  the peer connections, remove streams and tiles; the server marks the
  participant row `left_at` so no stale participants remain.
- **Connection failures** — `onconnectionstatechange` is monitored; a single
  ICE restart (`restartIce()`) is attempted on `failed`.

## WebSocket Signaling Protocol

Endpoint: `ws://localhost:8000/ws/rooms/{room_code}?peer_id=…&user_id=…&display_name=…`

> Browsers cannot set headers on WebSocket connections, so the already
  validated user id travels as a query parameter. Production would use an
  authenticated session cookie or short-lived join token (see Limitations).

| Event (server → client) | Purpose |
|---|---|
| `welcome` | Join confirmation + existing peers (peer discovery) |
| `chat-history` | Last 50 persisted chat messages |
| `peer-joined` | New participant (id, name, host flag, media state) |
| `peer-left` | Participant disconnected |
| `offer` / `answer` | SDP relay between two peers |
| `ice-candidate` | ICE candidate relay |
| `media-state` | Mute / camera-off / screen-sharing state broadcast |
| `chat-message` | Chat broadcast (persisted first) |
| `host-command` | `mute` / `mute-all` / `remove` — sent to the target client |
| `meeting-ended` | Host ended the meeting (broadcast, sockets closed) |
| `error` | Validation / authorization errors (`forbidden`, …) |

All inbound messages are validated with Pydantic (discriminated union on
`type`); chat messages are length-limited; **host commands are authorized
server-side** — the sender's user id must match `room.host_id`; a frontend
`is_host` flag is never trusted. Mute/remove commands are *delivered* to the
target browser, which applies them — a server-side boolean cannot physically
control another browser's microphone (the target client disables its own
audio track and broadcasts the resulting state).

## REST API

Base URL: `http://localhost:8000/api/v1` — interactive docs at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| GET | `/auth/me` | Current user (mock default, `X-User-Id`, or verified Clerk token) |
| POST | `/auth/guest` | Create a lightweight guest identity (multi-browser demos) |
| POST | `/rooms/instant` | Create an instant meeting (`ACTIVE`, unique `XXX-XXX-XXX` code) |
| POST | `/rooms/schedule` | Schedule a meeting (validated fields, hashed passcode) |
| GET | `/rooms/validate/{room_code}` | Validate a room for joining (404 unknown / 409 ended) |
| GET | `/rooms/upcoming` | Current user's scheduled rooms |
| GET | `/rooms/recent` | Rooms hosted/participated (ACTIVE/ENDED) |
| GET | `/rooms/{room_code}` | Room details |
| POST | `/rooms/{room_code}/join` | Join eligibility check (passcode, ended-room) + activation |
| POST | `/rooms/{room_code}/leave` | Mark the user's participant sessions left |
| POST | `/rooms/{room_code}/end` | **Host only** (verified server-side): end for everyone |

Current user resolution: `X-User-Id` header when present (validated against
the `users` table), otherwise the deterministic default user
(`usr_default_host`). This is the mock-user abstraction (PRD §8); the rest of
the application only ever sees an internal `User` object.

## Database

SQLite via SQLAlchemy (`backend/app/models.py`):

```text
users ──1:N──► rooms ──1:N──► participants
                    │
                    └──1:N──► chat_messages (via participants)

users:      id (PK), clerk_user_id (unique, nullable), name, email,
            avatar_url, created_at
rooms:      id (PK), room_code (unique), title, description, host_id (FK),
            scheduled_for, duration_minutes, passcode_hash, media_room_id,
            status (SCHEDULED|ACTIVE|ENDED), created_at, started_at, ended_at
participants: id (PK), room_id (FK), user_id (FK), peer_id (unique),
            display_name, role (host|participant), is_muted, is_video_off,
            is_screen_sharing, joined_at, left_at
chat_messages: id (PK), room_id (FK), participant_id (FK), message,
            created_at
```

Indexes on `room_code`, `host_id`, `scheduled_for`, `status`,
`participants(room_id, peer_id)` and `chat_messages(room_id, created_at)` —
deliberately minimal for a prototype.

Room lifecycle: `SCHEDULED → ACTIVE → ENDED`. Instant meetings are created
directly as `ACTIVE`; scheduled rooms activate when someone joins. Ended
rooms reject new joins and existing participants are disconnected.

## Security

- Server-side authorization for every host action (end / mute / remove /
  mute-all) — `room.host_id == current_user.id`.
- Input validation everywhere (Pydantic schemas for REST, discriminated-union
  validation for WebSocket messages, chat length limits, display-name
  limits).
- Meeting passcodes hashed with PBKDF2-SHA256 (stdlib); the hash never leaves
  the server.
- No secrets in code; `.env` files are git-ignored; `.env.example` files
  provided.
- CORS restricted to the frontend origin.

## Testing

### Backend (automated)

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Covers: room creation and unique codes, scheduling validation, passcode
verification, join/leave/end, **host authorization (non-host rejected)**,
participant persistence, WebSocket peer discovery, SDP/ICE routing, invalid
message handling, media-state broadcast + persistence, chat broadcast +
persistence + history, host-command authorization, disconnect cleanup
(`peer-left` + `left_at`), and `meeting-ended` broadcast via the REST end
endpoint.

### Frontend

```bash
cd frontend
npm run typecheck   # TypeScript strict checks
npm run build       # production build
```

### WebRTC end-to-end (browser automation)

A Playwright spec drives three real Chromium pages with fake media devices
through the full mesh flow (join ×3, remote video frames, mute/camera state,
chat, host mute, screen share, end meeting):

```bash
cd frontend
npm install                # also installs @playwright/test
npx playwright install chromium
npm run test:e2e           # starts/reuses backend + frontend automatically
```

### WebRTC (manual / browser automation)

The media plane needs real browsers. Minimum manual verification:
two browser windows (A ↔ B), preferred three (A ↔ B ↔ C):

camera ✔ · microphone ✔ · remote video ✔ · remote audio ✔ · mute/unmute ✔ ·
camera on/off ✔ · participant join/leave ✔ · disconnect cleanup (tab close) ✔ ·
host mute / remove / end ✔ · screen sharing ✔ · chat ✔.

Chrome flags for automated runs: `--use-fake-device-for-media-stream
--use-fake-ui-for-media-stream --auto-select-desktop-capture-source=Entire screen`.

## Limitations (prototype scope)

- **Single process** — the in-memory connection manager requires running
  uvicorn with one worker. Horizontal scaling needs Redis pub/sub + sticky
  room assignment (see SFU evolution).
- **Mock identity** — `X-User-Id` is trusted after validation; without real
  authentication any client can claim the default user id. This is an
  accepted prototype trade-off; the auth boundary is isolated in
  `backend/app/auth.py` so real sessions can replace it.
- **Mesh ceiling** — comfortable up to ~4–6 participants on typical
  connections (see the Mesh vs SFU section).
- **No TURN** — peers behind symmetric NATs may fail to connect; a TURN
  server is the standard production fallback.
- **No WebSocket reconnect/resume** — a dropped connection shows a
  "disconnected" state with a manual rejoin.
- **Chat history is room-wide** — messages persist per room and are replayed
  (last 50) on join; there is no per-user read state.

## Clerk Authentication (optional bonus)

Clerk is **not required** — the app must (and does) run fully without it. The
integration points are prepared:

- Backend (`backend/app/auth.py`): when `CLERK_SECRET_KEY` + `CLERK_ISSUER`
  are configured, `Authorization: Bearer <clerk session jwt>` is verified
  against Clerk's JWKS and mapped to a `users` row via the unique
  `clerk_user_id` column.
- Frontend: wrap the app in `ClerkProvider` when
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set and send
  `Authorization: Bearer <token>` from `services/api.ts`; everything else
  (dashboard, meetings, host checks) already works with the internal
  `User` abstraction.

If Clerk configuration becomes a time sink, the correct move — per the PRD —
is to stop and stay on the mock/default-user path, which is the guaranteed
execution path implemented here.

## Project Structure

```text
Scaler/
├── docs/PRD.md                  # source of truth
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan seeding
│   │   ├── config.py            # env-driven settings (single source)
│   │   ├── database.py          # engine/session/init
│   │   ├── models.py            # User, Room, Participant, ChatMessage
│   │   ├── schemas.py           # Pydantic REST schemas
│   │   ├── auth.py              # current-user abstraction (mock/Clerk)
│   │   ├── api/                 # REST routes (auth, rooms)
│   │   ├── repositories/        # thin data access
│   │   ├── services/            # business logic + authorization
│   │   └── ws/                  # connection manager + signaling endpoint
│   ├── tests/                   # pytest: REST + WebSocket signaling
│   ├── seed_db.py
│   └── requirements*.txt
├── frontend/
│   ├── app/                     # dashboard, schedule, meeting/[roomCode]
│   ├── components/              # lobby, meeting, participants, chat, common
│   ├── hooks/                   # useLocalMedia, useWebRTC, useMeeting, useActiveSpeaker
│   ├── lib/                     # config, signaling client, identity, utils
│   ├── services/api.ts          # REST client
│   └── types/                   # shared API + signaling types
├── .env.example
└── README.md
```
