import base64
import json
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.db.models import Base
from app.main import app
from app.services.recovery.approval import ApprovalError, ApprovalService


def token(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    return f"header.{payload}.unsigned"


@pytest.fixture(autouse=True)
def local_emulator(monkeypatch):
    monkeypatch.setenv("NETMIND_AUTH_ALLOW_UNSIGNED", "true")
    monkeypatch.setenv("NETMIND_ENVIRONMENT", "test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.parametrize("role, me_status, execution_status", [("viewer", 200, 403), ("operator", 200, 501), ("approver", 200, 403), ("admin", 200, 501)])
def test_role_endpoint_matrix(role: str, me_status: int, execution_status: int) -> None:
    headers = {"Authorization": f"Bearer {token({'uid': role, 'role': role})}"}
    with TestClient(app) as api:
        assert api.get("/me", headers=headers).status_code == me_status
        assert api.post("/recovery/executions", headers=headers, json={"plan_id": 1, "idempotency_key": "security-test"}).status_code == execution_status


def test_forged_and_expired_emulator_tokens_are_rejected() -> None:
    with TestClient(app) as api:
        assert api.get("/me", headers={"Authorization": "Bearer forged"}).status_code == 401
        expired = token({"uid": "u1", "role": "operator", "exp": time.time() - 1})
        assert api.get("/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_unsigned_tokens_are_blocked_outside_local_mode(monkeypatch) -> None:
    monkeypatch.setenv("NETMIND_ENVIRONMENT", "production")
    get_settings.cache_clear()
    with TestClient(app) as api:
        assert api.get("/me", headers={"Authorization": f"Bearer {token({'uid': 'u1', 'role': 'admin'})}"}).status_code == 403


def test_one_user_cannot_consume_another_users_approval() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = Session(engine)
    approvals = ApprovalService(session, "security-key")
    record = approvals.issue(plan_id=1, plan_hash="a" * 64, proposer_uid="proposer", approver_uid="approver-a", approver_role="approver", now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    with pytest.raises(ApprovalError, match="identity"):
        approvals.approve(nonce=record.nonce, plan_hash="a" * 64, approver_uid="approver-b", approver_role="approver", now=datetime(2026, 1, 1, 0, 0, 1, tzinfo=timezone.utc))
