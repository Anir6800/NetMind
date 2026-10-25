from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import text

from app.api import ai, audit, copilot, events, incidents, networks, recovery, telemetry
from app.core.auth import verify_token
from app.core.config import get_settings
from app.db.session import get_engine
from app.integrations.nvidia_client import get_ai_client

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(networks.router)
app.include_router(ai.router)
app.include_router(incidents.router)
app.include_router(audit.router)
app.include_router(copilot.router)
app.include_router(events.router)
app.include_router(recovery.router)
app.include_router(telemetry.router)


@app.get("/health")
def health() -> dict[str, str]:
    # One call for the UI status dot: API is up; database and AI are checked here.
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        database = "ok"
    except Exception:  # noqa: BLE001 - any failure means "not connected" for the status dot.
        database = "down"
    return {"status": "ok", "environment": settings.environment, "database": database, "ai": get_ai_client().mode()[0]}


@app.get("/me")
def me(claims: Annotated[dict, Depends(verify_token)]) -> dict:
    return {"uid": claims.get("uid"), "role": claims["role"]}
