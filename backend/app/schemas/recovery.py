"""Strict, non-executing recovery plan contracts."""
from __future__ import annotations

import hashlib
import json
from typing import Annotated, Literal

from pydantic import BaseModel, Field

Risk = Literal["low", "medium", "high"]
ActionName = Literal["restore_link", "reroute_via", "throttle_flow", "clear_throttle"]


class RecoveryMetadata(BaseModel):
    preconditions: list[str] = Field(min_length=1, max_length=8)
    expected_effect: str = Field(min_length=1, max_length=300)
    risk_level: Risk
    rollback_action: ActionName | Literal["none"]
    expires_in_seconds: int = Field(ge=1, le=3600)


class RestoreLink(BaseModel):
    action: Literal["restore_link"]
    link_id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    expected_state: Literal["down"]
    target_state: Literal["up"]
    metadata: RecoveryMetadata


class RerouteVia(BaseModel):
    action: Literal["reroute_via"]
    source: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    destination: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    alternate_path: list[str] = Field(min_length=2, max_length=8)
    metadata: RecoveryMetadata


class ThrottleFlow(BaseModel):
    action: Literal["throttle_flow"]
    flow_id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    rate_mbps: float = Field(gt=0, le=1000)
    metadata: RecoveryMetadata


class ClearThrottle(BaseModel):
    action: Literal["clear_throttle"]
    flow_id: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    metadata: RecoveryMetadata


RecoveryAction = Annotated[RestoreLink | RerouteVia | ThrottleFlow | ClearThrottle, Field(discriminator="action")]


class RecoveryPlan(BaseModel):
    incident_id: int = Field(gt=0)
    actions: list[RecoveryAction] = Field(min_length=1, max_length=4)
    plan_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")

    def canonical_json(self) -> str:
        return json.dumps(self.model_dump(exclude={"plan_hash"}), sort_keys=True, separators=(",", ":"))

    def with_hash(self) -> "RecoveryPlan":
        return self.model_copy(update={"plan_hash": hashlib.sha256(self.canonical_json().encode()).hexdigest()})
