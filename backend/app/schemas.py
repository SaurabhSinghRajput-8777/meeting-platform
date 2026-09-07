"""Pydantic schemas for REST API request/response bodies."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    id: str
    name: str
    email: str | None = None
    avatar_url: str | None = None
    is_default: bool = False


class MeResponse(UserOut):
    clerk_enabled: bool = False


class GuestRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50)


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------


class InstantRoomRequest(BaseModel):
    title: str = Field(default="Instant Meeting", min_length=1, max_length=100)


class ScheduleRoomRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    scheduled_for: datetime
    duration_minutes: int = Field(ge=5, le=1440)
    passcode: str | None = Field(default=None, min_length=4, max_length=12)


class JoinRoomRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=50)
    passcode: str | None = Field(default=None, max_length=12)


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    room_code: str
    title: str
    description: str | None = None
    scheduled_for: datetime | None = None
    duration_minutes: int | None = None
    media_room_id: str | None = None
    status: Literal["SCHEDULED", "ACTIVE", "ENDED"]
    has_passcode: bool = False
    is_host: bool = False
    created_at: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    host: UserOut


class RoomListResponse(BaseModel):
    rooms: list[RoomOut]


class LeaveResponse(BaseModel):
    ok: bool = True


class HealthResponse(BaseModel):
    status: str
    app: str
