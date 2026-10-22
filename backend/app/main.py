from typing import Annotated

from fastapi import Depends, FastAPI

from app.api import audit, copilot, incidents, networks
from app.core.auth import verify_token
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(networks.router)
app.include_router(incidents.router)
app.include_router(audit.router)
app.include_router(copilot.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


@app.get("/me")
def me(claims: Annotated[dict, Depends(verify_token)]) -> dict:
    return {"uid": claims.get("uid"), "role": claims["role"]}
