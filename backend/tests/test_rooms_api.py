"""REST API tests: room lifecycle, scheduling, join/leave/end, host authorization."""

import re
from datetime import datetime, timedelta, timezone

from tests.conftest import create_instant_room, make_guest

ROOM_CODE_PATTERN = re.compile(r"^\d{3}-\d{3}-\d{3}$")


def future_iso(minutes: int = 60) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


# ---------------------------------------------------------------------------
# Instant meetings
# ---------------------------------------------------------------------------


def test_create_instant_room(client):
    room = create_instant_room(client, "Standup")
    assert ROOM_CODE_PATTERN.match(room["room_code"])
    assert room["title"] == "Standup"
    assert room["status"] == "ACTIVE"  # instant meetings begin ACTIVE (PRD §39)
    assert room["is_host"] is True
    assert room["host"]["id"] == "usr_default_host"
    assert room["has_passcode"] is False
    assert room["started_at"] is not None


def test_instant_room_codes_are_unique(client):
    codes = {create_instant_room(client)["room_code"] for _ in range(10)}
    assert len(codes) == 10


def test_room_code_uniqueness_enforced_in_db(client, db):
    from app.models import Room
    from sqlalchemy import select

    room = create_instant_room(client)
    duplicate = Room(
        room_code=room["room_code"],
        title="Duplicate",
        host_id="usr_default_host",
        status="SCHEDULED",
    )
    db.add(duplicate)
    from sqlalchemy.exc import IntegrityError

    try:
        db.commit()
        assert False, "duplicate room_code must be rejected"
    except IntegrityError:
        db.rollback()


# ---------------------------------------------------------------------------
# Scheduling
# ---------------------------------------------------------------------------


def test_schedule_room(client):
    response = client.post(
        "/api/v1/rooms/schedule",
        json={
            "title": "Design review",
            "description": "Quarterly review",
            "scheduled_for": future_iso(120),
            "duration_minutes": 45,
        },
    )
    assert response.status_code == 201
    room = response.json()
    assert room["status"] == "SCHEDULED"
    assert room["duration_minutes"] == 45
    assert room["description"] == "Quarterly review"
    assert ROOM_CODE_PATTERN.match(room["room_code"])


def test_schedule_room_in_past_rejected(client):
    response = client.post(
        "/api/v1/rooms/schedule",
        json={
            "title": "Past meeting",
            "scheduled_for": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            "duration_minutes": 30,
        },
    )
    assert response.status_code == 422


def test_schedule_room_validation(client):
    # empty title
    response = client.post(
        "/api/v1/rooms/schedule",
        json={"title": "", "scheduled_for": future_iso(), "duration_minutes": 30},
    )
    assert response.status_code == 422
    # invalid duration
    response = client.post(
        "/api/v1/rooms/schedule",
        json={"title": "X", "scheduled_for": future_iso(), "duration_minutes": 0},
    )
    assert response.status_code == 422
    # passcode too short
    response = client.post(
        "/api/v1/rooms/schedule",
        json={
            "title": "X",
            "scheduled_for": future_iso(),
            "duration_minutes": 30,
            "passcode": "abc",
        },
    )
    assert response.status_code == 422


def test_scheduled_room_appears_in_upcoming(client):
    room = client.post(
        "/api/v1/rooms/schedule",
        json={"title": "Sync", "scheduled_for": future_iso(90), "duration_minutes": 30},
    ).json()
    upcoming = client.get("/api/v1/rooms/upcoming").json()["rooms"]
    assert any(item["room_code"] == room["room_code"] for item in upcoming)


def test_upcoming_scoped_to_host(client):
    guest = make_guest(client, "Alice")
    client.post(
        "/api/v1/rooms/schedule",
        json={"title": "Alice's meeting", "scheduled_for": future_iso(60), "duration_minutes": 30},
        headers={"X-User-Id": guest["id"]},
    )
    # Default user must not see Alice's meeting
    upcoming = client.get("/api/v1/rooms/upcoming").json()["rooms"]
    assert all(item["host"]["id"] != guest["id"] for item in upcoming)


# ---------------------------------------------------------------------------
# Validate / details
# ---------------------------------------------------------------------------


def test_validate_room(client):
    room = create_instant_room(client)
    response = client.get(f"/api/v1/rooms/validate/{room['room_code']}")
    assert response.status_code == 200
    assert response.json()["room_code"] == room["room_code"]


def test_validate_unknown_room(client):
    response = client.get("/api/v1/rooms/validate/000-000-001")
    assert response.status_code == 404


def test_get_room_details(client):
    room = create_instant_room(client)
    response = client.get(f"/api/v1/rooms/{room['room_code']}")
    assert response.status_code == 200
    assert response.json()["title"] == room["title"]


# ---------------------------------------------------------------------------
# Join / passcode / end
# ---------------------------------------------------------------------------


def test_join_activates_scheduled_room(client):
    room = client.post(
        "/api/v1/rooms/schedule",
        json={"title": "Sync", "scheduled_for": future_iso(60), "duration_minutes": 30},
    ).json()
    response = client.post(f"/api/v1/rooms/{room['room_code']}/join", json={})
    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"


def test_join_with_passcode(client):
    response = client.post(
        "/api/v1/rooms/schedule",
        json={
            "title": "Private",
            "scheduled_for": future_iso(60),
            "duration_minutes": 30,
            "passcode": "4321",
        },
    )
    assert response.status_code == 201
    room = response.json()
    assert room["has_passcode"] is True
    # passcode_hash must never leak
    assert "passcode_hash" not in room

    # missing passcode -> 403
    assert client.post(f"/api/v1/rooms/{room['room_code']}/join", json={}).status_code == 403
    # wrong passcode -> 403
    assert (
        client.post(
            f"/api/v1/rooms/{room['room_code']}/join", json={"passcode": "9999"}
        ).status_code
        == 403
    )
    # correct passcode -> 200
    assert (
        client.post(
            f"/api/v1/rooms/{room['room_code']}/join", json={"passcode": "4321"}
        ).status_code
        == 200
    )


def test_end_room_requires_host(client):
    room = create_instant_room(client)
    guest = make_guest(client, "Bob")
    # guest cannot end the meeting (server-side host verification, PRD §31)
    response = client.post(
        f"/api/v1/rooms/{room['room_code']}/end", json={}, headers={"X-User-Id": guest["id"]}
    )
    assert response.status_code == 403
    # host can
    response = client.post(f"/api/v1/rooms/{room['room_code']}/end", json={})
    assert response.status_code == 200
    assert response.json()["status"] == "ENDED"


def test_join_ended_room_rejected(client):
    room = create_instant_room(client)
    client.post(f"/api/v1/rooms/{room['room_code']}/end", json={})
    assert client.post(f"/api/v1/rooms/{room['room_code']}/join", json={}).status_code == 409
    assert client.get(f"/api/v1/rooms/validate/{room['room_code']}").status_code == 409


def test_recent_includes_hosted_and_participated_rooms(client):
    room = create_instant_room(client)
    recent = client.get("/api/v1/rooms/recent").json()["rooms"]
    assert any(item["room_code"] == room["room_code"] for item in recent)

    # A guest who participates also sees the room
    guest = make_guest(client, "Carol")
    with client.websocket_connect(
        f"/ws/rooms/{room['room_code']}?peer_id=peer-carol&user_id={guest['id']}&display_name=Carol"
    ) as websocket:
        websocket.receive_json()  # welcome
    recent = client.get("/api/v1/rooms/recent", headers={"X-User-Id": guest["id"]}).json()["rooms"]
    assert any(item["room_code"] == room["room_code"] for item in recent)


def test_leave_room(client):
    room = create_instant_room(client)
    response = client.post(f"/api/v1/rooms/{room['room_code']}/leave", json={})
    assert response.status_code == 200
    assert response.json()["ok"] is True
