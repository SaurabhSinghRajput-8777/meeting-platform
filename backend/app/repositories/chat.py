"""Thin data-access layer for chat messages."""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import ChatMessage


def create(db: Session, *, room_id: int, participant_id: int, message: str) -> ChatMessage:
    chat_message = ChatMessage(room_id=room_id, participant_id=participant_id, message=message)
    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)
    return chat_message


def recent_for_room(db: Session, room_id: int, limit: int = 50) -> list[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .options(joinedload(ChatMessage.participant))
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(limit)
    )
    messages = list(db.scalars(stmt))
    messages.reverse()  # oldest first for display
    return messages

