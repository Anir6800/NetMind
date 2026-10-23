"""Single-network, commit-confirmed controller executor."""
from __future__ import annotations

from dataclasses import dataclass
from time import monotonic
from typing import Callable

from topology.controller import Controller


@dataclass
class ActiveAction:
    network_id: int
    idempotency_key: str
    verb: str
    params: dict
    rollback_verb: str
    rollback_params: dict
    deadline: float
    state: str = "executing"


class Executor:
    def __init__(self, controller: Controller, now: Callable[[], float] = monotonic) -> None:
        self.controller = controller
        self.now = now
        self.active: dict[int, ActiveAction] = {}
        self.executions: dict[str, ActiveAction] = {}

    def execute(self, network_id: int, idempotency_key: str, verb: str, params: dict, rollback_verb: str, rollback_params: dict, confirm_within_seconds: int = 30) -> ActiveAction:
        if idempotency_key in self.executions:
            return self.executions[idempotency_key]
        if network_id in self.active:
            raise RuntimeError("network already has an active recovery action")
        if not 1 <= confirm_within_seconds <= 300:
            raise ValueError("confirmation timeout is out of bounds")
        self.controller.execute(verb, params)
        action = ActiveAction(network_id, idempotency_key, verb, dict(params), rollback_verb, dict(rollback_params), self.now() + confirm_within_seconds)
        self.active[network_id] = action
        self.executions[idempotency_key] = action
        return action

    def confirm(self, idempotency_key: str, verified: bool) -> ActiveAction:
        action = self.executions[idempotency_key]
        if action.state != "executing":
            return action
        if verified:
            action.state = "confirmed"
            self.active.pop(action.network_id, None)
        else:
            self._rollback(action)
        return action

    def reconcile(self) -> list[ActiveAction]:
        for action in list(self.active.values()):
            self._rollback(action)
        return list(self.executions.values())

    def tick(self) -> list[ActiveAction]:
        for action in list(self.active.values()):
            if self.now() >= action.deadline:
                self._rollback(action)
        return list(self.executions.values())

    def _rollback(self, action: ActiveAction) -> None:
        self.controller.execute(action.rollback_verb, action.rollback_params)
        action.state = "rolled_back"
        self.active.pop(action.network_id, None)
