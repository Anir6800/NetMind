import base64
import json
import logging
from typing import Annotated

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings

logger = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)
ROLES = {"viewer", "operator", "approver", "admin"}


def _unsigned_payload(token: str) -> dict:
    try:
        payload = token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid test token") from exc


def verify_token(credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)]) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Bearer token required")
    settings = get_settings()
    if settings.auth_allow_unsigned:
        logger.warning("Unsigned Firebase token accepted; local emulator/test use only")
        claims = _unsigned_payload(credentials.credentials)
    else:
        try:
            import firebase_admin
            from firebase_admin import auth
            try:
                firebase_admin.get_app()
            except ValueError:
                firebase_admin.initialize_app()
            claims = auth.verify_id_token(credentials.credentials)
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid Firebase token") from exc
    role = claims.get("role")
    if role not in ROLES:
        raise HTTPException(status_code=403, detail="Unsupported role")
    return claims
