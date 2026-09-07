"""Meeting/room business logic.

Route handlers stay thin; validation, state transitions and authorization
live here (PRD §47: no substantial business logic inside route handlers).
"""

import hashlib
import hmac
import os
import random
import string
from datetime import timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Room, RoomStatus, ParticipantRole, utcnow
from app.repositories import participants as participants_repo
from app.repositories import rooms as rooms_repo
from app.schemas import InstantRoomRequest, JoinRoomRequest, ScheduleRoomRequest

ROOM_CODE_ALPHABET = string.digits


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def hash_passcode(passcode: str) -> str:
    """PBKDF2-SHA256 passcode hashing (stdlib only, no extra dependency)."""
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", passcode.encode(), salt, 100_000)
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def verify_passcode(passcode: str, stored: str) -> bool:
    try:
        _algo, salt_hex, digest_hex = stored.split("$", 2)
    except ValueError:
        return False
    digest = hashlib.pbkdf2_hmac("sha256", passcode.encode(), bytes.fromhex(salt_hex), 100_000)
    return hmac_compare(digest.hex(), digest_hex)


def hmac_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def generate_room_code() -> str:
    """XXX-XXX-XXX format: unique, human-readable, easy to copy, URL-safe (PRD §12)."""
    parts = ["".join(random.choices(ROOM_CODE_ALPHABET, k=3)) for _ in range(3)]
    return "-".join(parts)


def _create_room_with_unique_code(db: Session, **fields) -> Room:
    """Random generation must handle collisions (PRD §12)."""
    for _ in range(10):
        code = generate_room_code()
        if rooms_repo.code_exists(db, code):
            continue
        try:
            room = rooms_repo.create(db, room_code=code, **fields)
            # The media room is the signaling room in this Mesh prototype; a
            # future SFU would assign its own identifiers here.
            room.media_room_id = code
            db.commit()
            db.refresh(room)
            return room
        except IntegrityError:
            db.rollback()  # raced on the unique constraint; retry with a new code
    raise HTTPException(status_code=500, detail="Could not generate a unique room code")


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------


def get_room_or_404(db: Session, room_code: str) -> Room:
    room = rooms_repo.get_by_code(db, room_code)
    if room is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return room


def get_joinable_room_or_error(db: Session, room_code: str) -> Room:
    room = get_room_or_404(db, room_code)
    if room.status == RoomStatus.ENDED:
        raise HTTPException(status_code=409, detail="This meeting has already ended")
    return room


def list_upcoming(db: Session, user_id: str) -> list[Room]:
    return rooms_repo.list_upcoming_for_host(db, host_id=user_id)


def list_recent(db: Session, user_id: str) -> list[Room]:
    return rooms_repo.list_recent_for_user(db, user_id=user_id)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def create_instant_room(db: Session, host_id: str, request: InstantRoomRequest) -> Room:
    now = utcnow()
    return _create_room_with_unique_code(
        db,
        title=request.title.strip() or "Instant Meeting",
        description=None,
        host_id=host_id,
        scheduled_for=now,
        duration_minutes=None,
        passcode_hash=None,
        media_room_id=None,  # assigned below
        status=RoomStatus.ACTIVE,  # instant meetings begin directly as ACTIVE (PRD §39)
        started_at=now,
    )


def schedule_room(db: Session, host_id: str, request: ScheduleRoomRequest) -> Room:
    scheduled_for = request.scheduled_for
    if scheduled_for.tzinfo is not None:
        # Normalize to naive UTC for consistent storage/comparison.
        scheduled_for = scheduled_for.astimezone(timezone.utc).replace(tzinfo=None)

    if scheduled_for <= utcnow():
        raise HTTPException(status_code=422, detail="Scheduled time must be in the future")

    passcode_hash = hash_passcode(request.passcode) if request.passcode else None
    return _create_room_with_unique_code(
        db,
        title=request.title.strip(),
        description=(request.description or "").strip() or None,
        host_id=host_id,
        scheduled_for=scheduled_for,
        duration_minutes=request.duration_minutes,
        passcode_hash=passcode_hash,
        media_room_id=None,
        status=RoomStatus.SCHEDULED,
    )


def join_room(db: Session, room: Room, user_id: str, request: JoinRoomRequest) -> Room:
    """Validate join eligibility, verify the passcode and activate the room."""
    if room.status == RoomStatus.ENDED:
        raise HTTPException(status_code=409, detail="This meeting has already ended")

    if room.passcode_hash is not None:
        if not request.passcode or not verify_passcode(request.passcode, room.passcode_hash):
            raise HTTPException(status_code=403, detail="Invalid meeting passcode")

    if room.status == RoomStatus.SCHEDULED:
        rooms_repo.mark_started(db, room)
    return room


def leave_room(db: Session, room: Room, user_id: str) -> None:
    participants_repo.mark_all_left_for_user_in_room(db, room.id, user_id)


def end_room(db: Session, room: Room, user_id: str) -> Room:
    """End the meeting. Host permission is verified server-side (PRD §31)."""
    if room.host_id != user_id:
        raise HTTPException(status_code=403, detail="Only the host can end this meeting")

    room = rooms_repo.mark_ended(db, room)
    participants_repo.mark_all_left_in_room(db, room.id)
    return room


def host_role_for(room: Room, user_id: str) -> str:
    return ParticipantRole.HOST if room.host_id == user_id else ParticipantRole.PARTICIPANT
