"""FastAPI WebSocket signaling layer (PRD §18, §43, §44).

Responsibilities:
  - validate room membership and user identity on connect
  - register active peer sessions and announce peer discovery
  - route SDP offers/answers and ICE candidates between peers
  - broadcast participant events, media state and chat
  - process host commands (with server-side host verification)
  - clean up disconnected connections

It never relays audio/video media — media flows peer-to-peer over WebRTC.
"""

import logging
from typing import Annotated, Literal, Union

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, TypeAdapter, ValidationError
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.database import SessionLocal
from app.models import RoomStatus
from app.repositories import chat as chat_repo
from app.repositories import participants as participants_repo
from app.repositories import rooms as rooms_repo
from app.repositories import users as users_repo
from app.services import room_service
from app.ws.manager import PeerSession, connection_manager

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


# ---------------------------------------------------------------------------
# Incoming message schemas (validated with Pydantic)
# ---------------------------------------------------------------------------


class SessionDescription(BaseModel):
    type: Literal["offer", "answer"]
    sdp: str = Field(min_length=1)


class WSOffer(BaseModel):
    type: Literal["offer"]
    target_peer_id: str = Field(min_length=1)
    sdp: SessionDescription


class WSAnswer(BaseModel):
    type: Literal["answer"]
    target_peer_id: str = Field(min_length=1)
    sdp: SessionDescription


class WSIceCandidate(BaseModel):
    type: Literal["ice-candidate"]
    target_peer_id: str = Field(min_length=1)
    candidate: dict  # RTCIceCandidateInit, forwarded as-is after shape validation


class WSMediaState(BaseModel):
    type: Literal["media-state"]
    is_muted: bool | None = None
    is_video_off: bool | None = None
    is_screen_sharing: bool | None = None


class WSChatMessage(BaseModel):
    type: Literal["chat-message"]
    message: str = Field(min_length=1, max_length=settings.chat_message_max_length)


class WSHostCommand(BaseModel):
    type: Literal["host-command"]
    command: Literal["mute", "mute-all", "remove"]
    target_peer_id: str | None = None


ClientMessage = Annotated[
    Union[WSOffer, WSAnswer, WSIceCandidate, WSMediaState, WSChatMessage, WSHostCommand],
    Field(discriminator="type"),
]

_client_message_adapter = TypeAdapter(ClientMessage)


async def _reject(websocket: WebSocket, code: str, message: str) -> None:
    await websocket.send_json({"type": "error", "code": code, "message": message})
    await websocket.close(code=4400)


# ---------------------------------------------------------------------------
# The signaling endpoint
# ---------------------------------------------------------------------------


@router.websocket("/ws/rooms/{room_code}")
async def signaling_endpoint(
    websocket: WebSocket,
    room_code: str,
    peer_id: str = Query(..., min_length=1, max_length=64),
    user_id: str = Query(..., min_length=1, max_length=64),
    display_name: str = Query("", max_length=settings.display_name_max_length),
):
    """Note on the identity parameters: browsers cannot set headers on
    WebSocket connections, so the (already validated) user id is passed as a
    query parameter. A production deployment would use an authenticated
    session cookie or a short-lived join token (see README limitations)."""
    await websocket.accept()

    # --- validate room, user and register the participant --------------------
    with SessionLocal() as db:
        room = rooms_repo.get_by_code(db, room_code)
        if room is None:
            await _reject(websocket, "room-not-found", "Meeting not found")
            return
        if room.status == RoomStatus.ENDED:
            await _reject(websocket, "room-ended", "This meeting has already ended")
            return

        user = users_repo.get_by_id(db, user_id)
        if user is None:
            await _reject(websocket, "invalid-user", "Unknown user")
            return

        display_name = (display_name.strip() or user.name)[: settings.display_name_max_length]
        is_host = room.host_id == user.id

        if connection_manager.get_session(room_code, peer_id) is not None:
            await _reject(websocket, "duplicate-peer", "Peer id already connected")
            return

        if room.status == RoomStatus.SCHEDULED:
            rooms_repo.mark_started(db, room)

        try:
            participant = participants_repo.create(
                db,
                room_id=room.id,
                user_id=user.id,
                peer_id=peer_id,
                display_name=display_name,
                role=room_service.host_role_for(room, user.id),
            )
        except IntegrityError:
            await _reject(websocket, "duplicate-peer", "Peer id already registered")
            return

        session = PeerSession(
            peer_id=peer_id,
            websocket=websocket,
            user_id=user.id,
            display_name=display_name,
            participant_id=participant.id,
            room_id=room.id,
            is_host=is_host,
        )
        existing_peers = connection_manager.register(room_code, session)
        chat_history = chat_repo.recent_for_room(db, room.id, limit=settings.chat_history_limit)

    # --- greet the new peer and announce it to the room -----------------------
    await websocket.send_json(
        {
            "type": "welcome",
            "peer_id": peer_id,
            "display_name": display_name,
            "is_host": is_host,
            "room_status": room.status,
            "peers": existing_peers,
        }
    )
    if chat_history:
        await websocket.send_json(
            {
                "type": "chat-history",
                "messages": [
                    {
                        "id": message.id,
                        "peer_id": message.participant.peer_id,
                        "sender_name": message.participant.display_name,
                        "message": message.message,
                        "created_at": message.created_at.isoformat(),
                    }
                    for message in chat_history
                ],
            }
        )
    await connection_manager.broadcast(
        room_code,
        {"type": "peer-joined", **session.summary()},
        exclude_peer=peer_id,
    )

    # --- message loop ---------------------------------------------------------
    try:
        while True:
            try:
                raw = await websocket.receive_json()
            except ValueError:
                await connection_manager.send_to_peer(
                    room_code, peer_id, {"type": "error", "code": "invalid-json", "message": "Invalid JSON"}
                )
                continue

            try:
                message = _client_message_adapter.validate_python(raw)
            except ValidationError as exc:
                await connection_manager.send_to_peer(
                    room_code,
                    peer_id,
                    {"type": "error", "code": "invalid-message", "message": exc.errors(include_url=False)[0]["msg"]},
                )
                continue

            await _handle_client_message(room_code, peer_id, message)
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Unexpected error in signaling loop for room %s", room_code)
    finally:
        connection_manager.unregister(room_code, peer_id)
        with SessionLocal() as db:
            participants_repo.mark_left(db, peer_id)
        await connection_manager.broadcast(room_code, {"type": "peer-left", "peer_id": peer_id})


# ---------------------------------------------------------------------------
# Message handlers
# ---------------------------------------------------------------------------


async def _handle_client_message(room_code: str, sender_peer_id: str, message) -> None:
    session = connection_manager.get_session(room_code, sender_peer_id)
    if session is None:
        return

    # --- SDP / ICE routing ---------------------------------------------------
    if isinstance(message, (WSOffer, WSAnswer)):
        delivered = await connection_manager.send_to_peer(
            room_code,
            message.target_peer_id,
            {"type": message.type, "from_peer_id": sender_peer_id, "sdp": message.sdp.model_dump()},
        )
        if not delivered:
            await connection_manager.send_to_peer(
                room_code,
                sender_peer_id,
                {"type": "error", "code": "unknown-target", "message": "Target peer is not connected"},
            )
        return

    if isinstance(message, WSIceCandidate):
        candidate = message.candidate
        if not isinstance(candidate, dict) or "candidate" not in candidate:
            await connection_manager.send_to_peer(
                room_code, sender_peer_id, {"type": "error", "code": "invalid-candidate", "message": "Invalid ICE candidate"}
            )
            return
        await connection_manager.send_to_peer(
            room_code,
            message.target_peer_id,
            {"type": "ice-candidate", "from_peer_id": sender_peer_id, "candidate": candidate},
        )
        return

    # --- media state ----------------------------------------------------------
    if isinstance(message, WSMediaState):
        payload = {k: v for k, v in message.model_dump().items() if k != "type" and v is not None}
        for key, value in payload.items():
            setattr(session, key, value)
        with SessionLocal() as db:
            participants_repo.update_media_state(db, sender_peer_id, **payload)
        await connection_manager.broadcast(
            room_code,
            {"type": "media-state", "peer_id": sender_peer_id, **payload},
            exclude_peer=sender_peer_id,
        )
        return

    # --- chat -----------------------------------------------------------------
    if isinstance(message, WSChatMessage):
        text = message.message.strip()
        if not text:
            return
        with SessionLocal() as db:
            chat_message = chat_repo.create(
                db, room_id=session.room_id, participant_id=session.participant_id, message=text
            )
        await connection_manager.broadcast(
            room_code,
            {
                "type": "chat-message",
                "id": chat_message.id,
                "peer_id": sender_peer_id,
                "sender_name": session.display_name,
                "message": text,
                "created_at": chat_message.created_at.isoformat(),
            },
        )
        return

    # --- host commands (server-side authorization) ----------------------------
    if isinstance(message, WSHostCommand):
        await _handle_host_command(room_code, session, message)
        return


async def _handle_host_command(room_code: str, session: PeerSession, message: WSHostCommand) -> None:
    """Host actions are authorized server-side: the sender's user id must match
    room.host_id (checked at connect time and stored on the session). A
    frontend `is_host` flag is never trusted (PRD §31)."""
    if not session.is_host:
        await connection_manager.send_to_peer(
            room_code,
            session.peer_id,
            {"type": "error", "code": "forbidden", "message": "Only the host can perform this action"},
        )
        return

    if message.command == "mute":
        if not message.target_peer_id:
            return
        target = connection_manager.get_session(room_code, message.target_peer_id)
        if target is None:
            return
        with SessionLocal() as db:
            participants_repo.update_media_state(db, target.peer_id, is_muted=True)
        target.is_muted = True
        await connection_manager.send_to_peer(
            room_code, target.peer_id, {"type": "host-command", "command": "mute", "from_host": True}
        )
        # Everyone else learns about it through the target's own media-state update.
        return

    if message.command == "mute-all":
        for peer_id in connection_manager.peer_ids(room_code):
            target = connection_manager.get_session(room_code, peer_id)
            if target is not None and not target.is_host:
                await connection_manager.send_to_peer(
                    room_code, peer_id, {"type": "host-command", "command": "mute-all", "from_host": True}
                )
        return

    if message.command == "remove":
        if not message.target_peer_id:
            return
        await connection_manager.send_to_peer(
            room_code, message.target_peer_id, {"type": "host-command", "command": "remove", "from_host": True}
        )
        # The removed client performs its own media/WebSocket cleanup and leaves.
        return
