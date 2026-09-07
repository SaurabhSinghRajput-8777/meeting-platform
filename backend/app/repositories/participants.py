"""Thin data-access layer for participants."""



from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Participant, utcnow


def get_by_peer_id(db: Session, peer_id: str) -> Participant | None:
    return db.scalar(select(Participant).where(Participant.peer_id == peer_id))


def create(
    db: Session,
    *,
    room_id: int,
    user_id: str,
    peer_id: str,
    display_name: str,
    role: str,
    is_muted: bool = False,
    is_video_off: bool = False,
) -> Participant:
    participant = Participant(
        room_id=room_id,
        user_id=user_id,
        peer_id=peer_id,
        display_name=display_name,
        role=role,
        is_muted=is_muted,
        is_video_off=is_video_off,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


def mark_left(db: Session, peer_id: str) -> None:
    participant = get_by_peer_id(db, peer_id)
    if participant is not None and participant.left_at is None:
        participant.left_at = utcnow()
        db.commit()


def mark_all_left_in_room(db: Session, room_id: int) -> None:
    stmt = select(Participant).where(Participant.room_id == room_id, Participant.left_at.is_(None))
    for participant in db.scalars(stmt):
        participant.left_at = utcnow()
    db.commit()


def mark_all_left_for_user_in_room(db: Session, room_id: int, user_id: str) -> None:
    stmt = select(Participant).where(
        Participant.room_id == room_id,
        Participant.user_id == user_id,
        Participant.left_at.is_(None),
    )
    for participant in db.scalars(stmt):
        participant.left_at = utcnow()
    db.commit()


def update_media_state(
    db: Session,
    peer_id: str,
    *,
    is_muted: bool | None = None,
    is_video_off: bool | None = None,
    is_screen_sharing: bool | None = None,
) -> None:
    participant = get_by_peer_id(db, peer_id)
    if participant is None:
        return
    if is_muted is not None:
        participant.is_muted = is_muted
    if is_video_off is not None:
        participant.is_video_off = is_video_off
    if is_screen_sharing is not None:
        participant.is_screen_sharing = is_screen_sharing
    db.commit()


def set_muted_for_user_in_room(db: Session, room_id: int, user_id: str, muted: bool) -> None:
    stmt = select(Participant).where(
        Participant.room_id == room_id,
        Participant.user_id == user_id,
        Participant.left_at.is_(None),
    )
    for participant in db.scalars(stmt):
        participant.is_muted = muted
    db.commit()
