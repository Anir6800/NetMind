from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import require_roles

router = APIRouter(prefix="/recovery", tags=["recovery"])


class ExecutionRequest(BaseModel):
    plan_id: int = Field(gt=0)
    idempotency_key: str = Field(min_length=8, max_length=128)


@router.post("/executions")
def request_execution(request: ExecutionRequest, claims: Annotated[dict, Depends(require_roles("operator", "admin"))]) -> dict:
    raise HTTPException(status_code=501, detail="Controller execution API is not configured")
