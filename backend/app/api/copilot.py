from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_session
from app.integrations.gemini_client import GeminiClient
from app.integrations.nvidia_client import NvidiaClient
from app.services.ai.copilot import CopilotAnswer, CopilotService

router = APIRouter(prefix="/copilot", tags=["copilot"])


class CopilotQuestion(BaseModel):
    incident_id: int = Field(gt=0)
    question: str = Field(min_length=1, max_length=1000)


class CopilotResponse(BaseModel):
    answer: str
    citation_ids: list[str]
    source: str
    cloud_api_called: bool
    offline: bool


def get_copilot_service(session: Annotated[Session, Depends(get_session)]) -> CopilotService:
    settings = get_settings()
    return CopilotService(session, GeminiClient(settings) if settings.gemini_api_key else NvidiaClient(settings))


@router.post("/questions", response_model=CopilotResponse)
def ask_question(request: CopilotQuestion, service: Annotated[CopilotService, Depends(get_copilot_service)]) -> CopilotAnswer:
    return service.ask(request.incident_id, request.question)
