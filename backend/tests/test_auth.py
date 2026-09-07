"""Auth / current-user abstraction tests (mock-user mode)."""

DEFAULT_USER_ID = "usr_default_host"


def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_me_returns_default_user_without_headers(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == DEFAULT_USER_ID
    assert data["name"] == "Demo User"
    assert data["email"] == "demo@example.com"
    assert data["is_default"] is True
    assert data["clerk_enabled"] is False


def test_me_with_valid_user_header(client):
    guest = client.post("/api/v1/auth/guest", json={"name": "Alice"}).json()
    response = client.get("/api/v1/auth/me", headers={"X-User-Id": guest["id"]})
    assert response.status_code == 200
    assert response.json()["id"] == guest["id"]
    assert response.json()["name"] == "Alice"


def test_me_with_unknown_user_header_rejected(client):
    response = client.get("/api/v1/auth/me", headers={"X-User-Id": "usr_nope"})
    assert response.status_code == 401


def test_guest_creation(client):
    response = client.post("/api/v1/auth/guest", json={"name": "Bob"})
    assert response.status_code == 201
    data = response.json()
    assert data["id"].startswith("usr_")
    assert data["id"] != DEFAULT_USER_ID
    assert data["name"] == "Bob"
    assert data["is_default"] is False


def test_guest_name_validation(client):
    response = client.post("/api/v1/auth/guest", json={"name": ""})
    assert response.status_code == 422
