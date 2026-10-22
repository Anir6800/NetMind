import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


def token(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"header.{payload}.unsigned"


@pytest.mark.parametrize("role", ["viewer", "operator", "approver", "admin"])
def test_me_accepts_local_role_claim(monkeypatch, role: str) -> None:
    monkeypatch.setenv("NETMIND_AUTH_ALLOW_UNSIGNED", "true")
    get_settings.cache_clear()
    response = TestClient(app).get("/me", headers={"Authorization": f"Bearer {token({'uid': 'u1', 'role': role})}"})
    assert response.status_code == 200
    assert response.json() == {"uid": "u1", "role": role}
    get_settings.cache_clear()
