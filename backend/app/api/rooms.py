from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Room, User
from app.schemas import (
    InstantRoomRequest,
    JoinRoomRequest,
    LeaveResponse,
    RoomListResponse,
    RoomOut,
    ScheduleRoomRequest,
    UserOut,
)
from app.services import room_service
from app.ws.manager import connection_manager

router = APIRouter()


def serialize_room(room: Room, current_user_id: str) -> RoomOut:
    return RoomOut(
        id=room.id,
        room_code=room.room_code,
        title=room.title,
        description=room.description,
        scheduled_for=room.scheduled_for,
        duration_minutes=room.duration_minutes,
        media_room_id=room.media_room_id,
        status=room.status,
        has_passcode=room.has_passcode,
        is_host=room.host_id == current_user_id,
        created_at=room.created_at,
        started_at=room.started_at,
        ended_at=room.ended_at,
        host=UserOut(
            id=room.host.id,
            name=room.host.name,
            email=room.host.email,
            avatar_url=room.host.avatar_url,
        ),
    )


# --- specific routes must be declared before /{room_code} -------------------


@router.post("/instant", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_instant_room(
    body: InstantRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.create_instant_room(db, current_user.id, body)
    return serialize_room(room, current_user.id)


@router.post("/schedule", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def schedule_room(
    body: ScheduleRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.schedule_room(db, current_user.id, body)
    return serialize_room(room, current_user.id)


@router.get("/validate/{room_code}", response_model=RoomOut)
def validate_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.get_joinable_room_or_error(db, room_code)
    return serialize_room(room, current_user.id)


@router.get("/upcoming", response_model=RoomListResponse)
def list_upcoming(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rooms = room_service.list_upcoming(db, current_user.id)
    return RoomListResponse(rooms=[serialize_room(r, current_user.id) for r in rooms])


@router.get("/recent", response_model=RoomListResponse)
def list_recent(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rooms = room_service.list_recent(db, current_user.id)
    return RoomListResponse(rooms=[serialize_room(r, current_user.id) for r in rooms])


# --- generic routes ---------------------------------------------------------


@router.get("/{room_code}", response_model=RoomOut)
def get_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.get_room_or_404(db, room_code)
    return serialize_room(room, current_user.id)


@router.post("/{room_code}/join", response_model=RoomOut)
def join_room(
    room_code: str,
    body: JoinRoomRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.get_joinable_room_or_error(db, room_code)
    room = room_service.join_room(db, room, current_user.id, body)
    return serialize_room(room, current_user.id)


@router.post("/{room_code}/leave", response_model=LeaveResponse)
def leave_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = room_service.get_room_or_404(db, room_code)
    room_service.leave_room(db, room, current_user.id)
    return LeaveResponse()


@router.post("/{room_code}/end", response_model=RoomOut)
async def end_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End the meeting for everyone. Host permission is verified server-side,
    then the signaling layer broadcasts `meeting-ended` to all participants."""
    room = room_service.get_room_or_404(db, room_code)
    room = room_service.end_room(db, room, current_user.id)
    await connection_manager.broadcast_meeting_ended(room.room_code)
    return serialize_room(room, current_user.id)
