"""WebSocket signaling tests: peer discovery, SDP/ICE routing, chat, media state,
host commands, meeting-ended broadcast and disconnect cleanup."""

from tests.conftest import create_instant_room, make_guest, wait_for, ws_url

HOST_USER = "usr_default_host"

SDP_OFFER = {"type": "offer", "sdp": "v=0\r\no=- 46117317 2 IN IP4 127.0.0.1\r\ns=-"}
SDP_ANSWER = {"type": "answer", "sdp": "v=0\r\no=- 46117318 2 IN IP4 127.0.0.1\r\ns=-"}
ICE_CANDIDATE = {"candidate": "candidate:1 1 UDP 2122252543 192.168.1.4 50000 typ host", "sdpMid": "0"}


def test_connect_unknown_room_rejected(client):
    with client.websocket_connect(ws_url("000-000-002", "peer-x", HOST_USER)) as websocket:
        message = websocket.receive_json()
        assert message["type"] == "error"
        assert message["code"] == "room-not-found"


def test_connect_ended_room_rejected(client):
    room = create_instant_room(client)
    client.post(f"/api/v1/rooms/{room['room_code']}/end", json={})
    with client.websocket_connect(ws_url(room["room_code"], "peer-x", HOST_USER)) as websocket:
        message = websocket.receive_json()
        assert message["type"] == "error"
        assert message["code"] == "room-ended"


def test_connect_invalid_user_rejected(client):
    room = create_instant_room(client)
    with client.websocket_connect(ws_url(room["room_code"], "peer-x", "usr_nope")) as websocket:
        message = websocket.receive_json()
        assert message["type"] == "error"
        assert message["code"] == "invalid-user"


def test_peer_discovery(client):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER, "Host")
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"], "Alice")
    ) as ws_guest:
        welcome_host = ws_host.receive_json()
        assert welcome_host["type"] == "welcome"
        assert welcome_host["peer_id"] == "peer-a"
        assert welcome_host["is_host"] is True
        assert welcome_host["peers"] == []

        # Existing peer learns about the new participant
        peer_joined = ws_host.receive_json()
        assert peer_joined["type"] == "peer-joined"
        assert peer_joined["peer_id"] == "peer-b"
        assert peer_joined["display_name"] == "Alice"
        assert peer_joined["is_host"] is False

        # New peer receives the list of existing participants
        welcome_guest = ws_guest.receive_json()
        assert welcome_guest["type"] == "welcome"
        assert welcome_guest["is_host"] is False
        assert [peer["peer_id"] for peer in welcome_guest["peers"]] == ["peer-a"]


def test_sdp_and_ice_routing(client):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"])
    ) as ws_guest:
        ws_host.receive_json()  # welcome
        ws_host.receive_json()  # peer-joined
        ws_guest.receive_json()  # welcome

        # The joining peer sends an offer to the existing peer (PRD §19)
        ws_guest.send_json({"type": "offer", "target_peer_id": "peer-a", "sdp": SDP_OFFER})
        received = ws_host.receive_json()
        assert received["type"] == "offer"
        assert received["from_peer_id"] == "peer-b"
        assert received["sdp"] == SDP_OFFER

        # The existing peer answers
        ws_host.send_json({"type": "answer", "target_peer_id": "peer-b", "sdp": SDP_ANSWER})
        received = ws_guest.receive_json()
        assert received["type"] == "answer"
        assert received["from_peer_id"] == "peer-a"
        assert received["sdp"] == SDP_ANSWER

        # ICE candidates are forwarded
        ws_guest.send_json(
            {"type": "ice-candidate", "target_peer_id": "peer-a", "candidate": ICE_CANDIDATE}
        )
        received = ws_host.receive_json()
        assert received["type"] == "ice-candidate"
        assert received["from_peer_id"] == "peer-b"
        assert received["candidate"] == ICE_CANDIDATE

        # Routing to an unknown target returns an error to the sender
        ws_host.send_json({"type": "offer", "target_peer_id": "peer-zzz", "sdp": SDP_OFFER})
        received = ws_host.receive_json()
        assert received["type"] == "error"
        assert received["code"] == "unknown-target"


def test_invalid_messages_rejected(client):
    room = create_instant_room(client)
    with client.websocket_connect(ws_url(room["room_code"], "peer-a", HOST_USER)) as websocket:
        websocket.receive_json()  # welcome
        websocket.send_json({"type": "offer", "target_peer_id": "peer-b"})  # missing sdp
        message = websocket.receive_json()
        assert message["type"] == "error"
        assert message["code"] == "invalid-message"
        websocket.send_json({"type": "banana"})  # unknown type
        message = websocket.receive_json()
        assert message["type"] == "error"


def test_media_state_broadcast_and_persistence(client, db):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"])
    ) as ws_guest:
        ws_host.receive_json()
        ws_host.receive_json()
        ws_guest.receive_json()

        ws_guest.send_json({"type": "media-state", "is_muted": True, "is_video_off": True})
        received = ws_host.receive_json()
        assert received["type"] == "media-state"
        assert received["peer_id"] == "peer-b"
        assert received["is_muted"] is True
        assert received["is_video_off"] is True

        from app.models import Participant

        def guest_muted_in_db():
            participant = db.query(Participant).filter_by(peer_id="peer-b").one()
            db.refresh(participant)
            return participant.is_muted and participant.is_video_off

        assert wait_for(guest_muted_in_db)


def test_chat_broadcast_persistence_and_history(client, db):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"])
    ) as ws_guest:
        ws_host.receive_json()
        ws_host.receive_json()
        ws_guest.receive_json()

        ws_guest.send_json({"type": "chat-message", "message": "Hello everyone"})
        received = ws_host.receive_json()
        assert received["type"] == "chat-message"
        assert received["peer_id"] == "peer-b"
        assert received["sender_name"] == "Alice"
        assert received["message"] == "Hello everyone"

        # The broadcast also reaches the sender (echo)
        echo = ws_guest.receive_json()
        assert echo["type"] == "chat-message"
        assert echo["message"] == "Hello everyone"

        # Oversized messages are rejected
        ws_guest.send_json({"type": "chat-message", "message": "x" * 2001})
        received = ws_guest.receive_json()
        assert received["type"] == "error"

    # The message is persisted
    from app.models import ChatMessage, Room

    db_room = db.query(Room).filter_by(room_code=room["room_code"]).one()
    messages = db.query(ChatMessage).filter_by(room_id=db_room.id).all()
    assert len(messages) == 1
    assert messages[0].message == "Hello everyone"

    # A new joiner receives the chat history
    with client.websocket_connect(ws_url(room["room_code"], "peer-c", HOST_USER)) as ws_third:
        ws_third.receive_json()  # welcome
        history = ws_third.receive_json()
        assert history["type"] == "chat-history"
        assert [item["message"] for item in history["messages"]] == ["Hello everyone"]


def test_host_commands_require_host(client):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"])
    ) as ws_guest:
        ws_host.receive_json()
        ws_host.receive_json()
        ws_guest.receive_json()

        # A non-host sending a host command is rejected server-side
        ws_guest.send_json({"type": "host-command", "command": "mute", "target_peer_id": "peer-a"})
        received = ws_guest.receive_json()
        assert received["type"] == "error"
        assert received["code"] == "forbidden"

        # The host mutes the guest: the target client receives the command
        ws_host.send_json({"type": "host-command", "command": "mute", "target_peer_id": "peer-b"})
        received = ws_guest.receive_json()
        assert received["type"] == "host-command"
        assert received["command"] == "mute"

        # The host removes the guest
        ws_host.send_json({"type": "host-command", "command": "remove", "target_peer_id": "peer-b"})
        received = ws_guest.receive_json()
        assert received["type"] == "host-command"
        assert received["command"] == "remove"

        # mute-all reaches non-hosts
        ws_host.send_json({"type": "host-command", "command": "mute-all"})
        received = ws_guest.receive_json()
        assert received["type"] == "host-command"
        assert received["command"] == "mute-all"


def test_peer_left_on_disconnect(client, db):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host:
        ws_host.receive_json()  # welcome

        with client.websocket_connect(
            ws_url(room["room_code"], "peer-b", guest["id"])
        ) as ws_guest:
            ws_host.receive_json()  # peer-joined
            ws_guest.receive_json()  # welcome

        # The disconnecting peer's socket closes -> others get peer-left
        message = ws_host.receive_json()
        assert message["type"] == "peer-left"
        assert message["peer_id"] == "peer-b"

        from app.models import Participant

        def guest_marked_left():
            participant = db.query(Participant).filter_by(peer_id="peer-b").one()
            db.refresh(participant)
            return participant.left_at is not None

        assert wait_for(guest_marked_left)


def test_meeting_ended_broadcast_on_rest_end(client):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(
        ws_url(room["room_code"], "peer-a", HOST_USER)
    ) as ws_host, client.websocket_connect(
        ws_url(room["room_code"], "peer-b", guest["id"])
    ) as ws_guest:
        ws_host.receive_json()
        ws_host.receive_json()
        ws_guest.receive_json()

        # Host ends the meeting through the REST API
        response = client.post(f"/api/v1/rooms/{room['room_code']}/end", json={})
        assert response.status_code == 200

        message = ws_host.receive_json()
        assert message["type"] == "meeting-ended"
        message = ws_guest.receive_json()
        assert message["type"] == "meeting-ended"


def test_participant_role_persisted(client, db):
    room = create_instant_room(client)
    guest = make_guest(client, "Alice")

    with client.websocket_connect(ws_url(room["room_code"], "peer-a", HOST_USER)) as ws_host:
        ws_host.receive_json()
        with client.websocket_connect(
            ws_url(room["room_code"], "peer-b", guest["id"])
        ) as ws_guest:
            ws_guest.receive_json()

    from app.models import Participant

    participants = db.query(Participant).filter_by(room_id=room["id"]).all()
    roles = {participant.peer_id: participant.role for participant in participants}
    assert roles["peer-a"] == "host"
    assert roles["peer-b"] == "participant"
