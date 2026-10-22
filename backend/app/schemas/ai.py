from pydantic import BaseModel, ConfigDict, Field


class AlternativeHypothesis(BaseModel):
    probable_cause: str = Field(min_length=1, max_length=300)
    confidence: float = Field(ge=0, le=1)


class AiDiagnosis(BaseModel):
    model_config = ConfigDict(extra="forbid")

    probable_cause: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)
    evidence_ids: list[str] = Field(min_length=1)
    candidate_link_ids: list[str] = Field(min_length=1)
    alternative_hypotheses: list[AlternativeHypothesis] = Field(default_factory=list)
    uncertainty_notes: str = Field(min_length=1, max_length=500)
    recommended_action_ref: str | None = None
