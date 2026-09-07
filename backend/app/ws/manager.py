"""In-memory WebSocket connection manager.

Tracks the active peer sessions per room and routes/broadcasts signaling
messages. This is intentionally simple: a single-process prototype. For a
multi-worker deployment the manager would be backed by Redis pub/sub and
each room pinned to one worker (see README, production evolution).

The manager NEVER relays audio/video media — only signaling and events.
"""

import asyncio
import logging
from dataclasses import dataclass

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class PeerSession:
    peer_id: str
    websocket: WebSocket
    user_id: str
    display_name: str
    participant_id: int
    room_id: int
    is_host: bool
    is_muted: bool = False
    is_video_off: bool = False
    is_screen_sharing: bool = False

    def summary(self) -> dict:
        return {
            "peer_id": self.peer_id,
            "user_id": self.user_id,
            "display_name": self.display_name,
            "is_host": self.is_host,
            "is_muted": self.is_muted,
            "is_video_off": self.is_video_off,
            "is_screen_sharing": self.is_screen_sharing,
        }


class ConnectionManager:
    def __init__(self) -> None:
        # room_code -> peer_id -> PeerSession
        self._rooms: dict[str, dict[str, PeerSession]] = {}

    # -- registration --------------------------------------------------------

    def register(self, room_code: str, session: PeerSession) -> list[dict]:
        """Register a peer session and return summaries of the peers already in the room."""
        room = self._rooms.setdefault(room_code, {})
        existing = [peer.summary() for peer in room.values()]
        room[session.peer_id] = session
        return existing

    def unregister(self, room_code: str, peer_id: str) -> None:
        room = self._rooms.get(room_code)
        if room is not None:
            room.pop(peer_id, None)
            if not room:
                self._rooms.pop(room_code, None)

    def get_session(self, room_code: str, peer_id: str) -> PeerSession | None:
        return self._rooms.get(room_code, {}).get(peer_id)

    def peer_ids(self, room_code: str) -> list[str]:
        return list(self._rooms.get(room_code, {}).keys())

    # -- messaging -----------------------------------------------------------

    async def send_to_peer(self, room_code: str, peer_id: str, payload: dict) -> bool:
        session = self.get_session(room_code, peer_id)
        if session is None:
            return False
        try:
            await session.websocket.send_json(payload)
            return True
        except Exception:
            logger.warning("Failed to send message to peer %s in room %s", peer_id, room_code)
            return False

    async def broadcast(self, room_code: str, payload: dict, exclude_peer: str | None = None) -> None:
        for peer_id, session in list(self._rooms.get(room_code, {}).items()):
            if peer_id == exclude_peer:
                continue
            try:
                await session.websocket.send_json(payload)
            except Exception:
                logger.warning("Failed to broadcast to peer %s in room %s", peer_id, room_code)

    async def broadcast_meeting_ended(self, room_code: str) -> None:
        """Broadcast meeting-ended to everyone in the room and close the sockets.
        Called from the REST end-meeting endpoint (host action, already authorized)."""
        sessions = list(self._rooms.get(room_code, {}).values())
        for session in sessions:
            try:
                await session.websocket.send_json({"type": "meeting-ended"})
            except Exception:
                pass
        # Give the close frames a moment to flush, then close all sockets.
        await asyncio.sleep(0.05)
        for session in sessions:
            try:
                await session.websocket.close(code=1000)
            except Exception:
                pass
        self._rooms.pop(room_code, None)

    # -- tests ---------------------------------------------------------------

    def clear(self) -> None:
        self._rooms.clear()


connection_manager = ConnectionManager()
