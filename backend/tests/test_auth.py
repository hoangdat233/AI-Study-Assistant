def test_register_success(client):
    payload = {
        "email": "student@example.com",
        "password": "securepassword123",
        "full_name": "Test Student",
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "student@example.com"
    assert data["full_name"] == "Test Student"
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data


def test_register_duplicate_email(client):
    payload = {
        "email": "duplicate@example.com",
        "password": "securepassword123",
        "full_name": "Original Student",
    }
    # First registration
    client.post("/api/auth/register", json=payload)

    # Second registration attempt with identical email
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409
    assert response.json()["detail"] == "Email already registered"


def test_login_success(client):
    # Register first
    client.post(
        "/api/auth/register",
        json={
            "email": "user@example.com",
            "password": "mypassword123",
            "full_name": "User One",
        },
    )

    # Login
    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "mypassword123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_password(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "user@example.com",
            "password": "mypassword123",
            "full_name": "User One",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "user@example.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_login_unknown_email(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@example.com", "password": "mypassword123"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"


def test_get_me_unauthenticated(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 403 or response.status_code == 401


def test_get_me_invalid_token(client):
    headers = {"Authorization": "Bearer invalid_token_value_here"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    assert response.json()["detail"] == "Could not validate credentials"


def test_get_me_success(client):
    # Register & Login
    client.post(
        "/api/auth/register",
        json={
            "email": "me@example.com",
            "password": "mypassword123",
            "full_name": "Me Myself",
        },
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "me@example.com", "password": "mypassword123"},
    )
    token = login_resp.json()["access_token"]

    # Call /me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["full_name"] == "Me Myself"
    assert "id" in data
