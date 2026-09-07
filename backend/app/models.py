from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Naive UTC timestamp — SQLite stores naive datetimes, so the whole app
    standardizes on naive-UTC in the database."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class RoomStatus:
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    ENDED = "ENDED"


class ParticipantRole:
    HOST = "host"
    PARTICIPANT = "participant"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    clerk_user_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    rooms: Mapped[list["Room"]] = relationship(back_populates="host", foreign_keys="Room.host_id")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    host_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"), index=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    passcode_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # For this prototype the media room is the signaling room (room_code).
    # Kept as a separate column so a future SFU could assign its own media room ids.
    media_room_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=RoomStatus.SCHEDULED, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    host: Mapped["User"] = relationship(back_populates="rooms", foreign_keys=[host_id])
    participants: Mapped[list["Participant"]] = relationship(back_populates="room")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="room")

    @property
    def has_passcode(self) -> bool:
        return self.passcode_hash is not None


class Participant(Base):
    __tablename__ = "participants"
    __table_args__ = (Index("ix_participants_room_active", "room_id", "left_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id"))
    peer_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default=ParticipantRole.PARTICIPANT)
    is_muted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_video_off: Mapped[bool] = mapped_column(Boolean, default=False)
    is_screen_sharing: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    left_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    room: Mapped["Room"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="participant")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), index=True)
    participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("participants.id"), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    room: Mapped["Room"] = relationship(back_populates="chat_messages")
    participant: Mapped["Participant"] = relationship(back_populates="chat_messages")
