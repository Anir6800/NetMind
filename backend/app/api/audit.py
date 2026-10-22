from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.repositories.audit import AuditRepository

router = APIRouter(prefix="/audit", tags=["audit"])


class ChainVerification(BaseModel):
    valid: bool
    invalid_event_id: int | None


@router.get("/verify", response_model=ChainVerification)
def verify_chain(session: Annotated[Session, Depends(get_session)]) -> ChainVerification:
    valid, invalid_event_id = AuditRepository(session).verify_chain()
    return ChainVerification(valid=valid, invalid_event_id=invalid_event_id)
