"""Thin data-access layer for rooms."""



from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Room, RoomStatus, utcnow


def get_by_code(db: Session, room_code: str) -> Room | None:
    return db.scalar(select(Room).where(Room.room_code == room_code))


def code_exists(db: Session, room_code: str) -> bool:
    return get_by_code(db, room_code) is not None


def create(db: Session, **fields) -> Room:
    room = Room(**fields)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def list_upcoming_for_host(db: Session, host_id: str) -> list[Room]:
    stmt = (
        select(Room)
        .where(Room.host_id == host_id, Room.status == RoomStatus.SCHEDULED)
        .order_by(Room.scheduled_for.asc())
        .limit(50)
    )
    return list(db.scalars(stmt))


def list_recent_for_user(db: Session, user_id: str, limit: int = 20) -> list[Room]:
    """Rooms the user hosted or joined, that have started or ended, newest first."""
    from sqlalchemy import exists, or_

    from app.models import Participant

    participated = exists(
        select(Participant.id).where(Participant.room_id == Room.id, Participant.user_id == user_id)
    )
    stmt = (
        select(Room)
        .where(
            or_(Room.host_id == user_id, participated),
            Room.status.in_([RoomStatus.ACTIVE, RoomStatus.ENDED]),
        )
        .order_by(Room.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def mark_started(db: Session, room: Room) -> Room:
    room.status = RoomStatus.ACTIVE
    room.started_at = room.started_at or utcnow()
    db.commit()
    db.refresh(room)
    return room


def mark_ended(db: Session, room: Room) -> Room:
    room.status = RoomStatus.ENDED
    room.ended_at = utcnow()
    db.commit()
    db.refresh(room)
    return room
