"""Shared pytest fixtures.

Uses an isolated SQLite file database and clears the in-memory connection
manager between tests so signaling state never leaks across tests.
"""

import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Configure the test database BEFORE importing the app (settings are cached).
TEST_DB_PATH = BACKEND_DIR / "test_scaler.db"
import os

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH.as_posix()}"
if TEST_DB_PATH.exists():
    TEST_DB_PATH.unlink()

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine, init_db
from app.main import app
from app.models import Participant, Room, User
from app.ws.manager import connection_manager


@pytest.fixture(autouse=True)
def _reset_db():
    """Drop and recreate all tables between tests so unique constraints
    (e.g. participants.peer_id) never clash across tests."""
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _clean_manager():
    connection_manager.clear()
    yield
    connection_manager.clear()


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def wait_for(condition, timeout: float = 3.0) -> bool:
    """Poll until the condition is true (server-side async cleanup)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if condition():
            return True
        time.sleep(0.05)
    return condition()


def make_guest(client: TestClient, name: str) -> dict:
    response = client.post("/api/v1/auth/guest", json={"name": name})
    assert response.status_code == 201
    return response.json()


def create_instant_room(client: TestClient, title: str = "Test Meeting") -> dict:
    response = client.post("/api/v1/rooms/instant", json={"title": title})
    assert response.status_code == 201
    return response.json()


def ws_url(room_code: str, peer_id: str, user_id: str, display_name: str = "") -> str:
    return (
        f"/ws/rooms/{room_code}"
        f"?peer_id={peer_id}&user_id={user_id}&display_name={display_name}"
    )
