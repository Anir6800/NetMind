from fastapi import APIRouter
from pydantic import BaseModel

from app.integrations.nvidia_client import get_ai_client
from app.services.assistant import (
    LOCAL_LABEL,
    ExplainRequest,
    Explanation,
    Suggestions,
    SuggestRequest,
    explain,
    suggest,
)

router = APIRouter(prefix="/ai", tags=["ai"])


class AiStatus(BaseModel):
    mode: str
    answered_by: str
    reason: str


@router.get("/status", response_model=AiStatus)
def status() -> AiStatus:
    client = get_ai_client()
    mode, reason = client.mode()
    label = f"NVIDIA {client.settings.nvidia_model} (LIVE AI)" if mode == "LIVE" else LOCAL_LABEL
    return AiStatus(mode=mode, answered_by=label, reason=reason)


@router.post("/explain", response_model=Explanation)
def explain_change(request: ExplainRequest) -> Explanation:
    return explain(get_ai_client(), request)


@router.post("/suggest", response_model=Suggestions)
def suggest_changes(request: SuggestRequest) -> Suggestions:
    return suggest(get_ai_client(), request)
