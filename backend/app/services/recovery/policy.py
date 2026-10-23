"""Pure deterministic policy checks; this module never executes actions."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from app.schemas.network import LinkState, Topology
from app.schemas.recovery import RecoveryPlan


@dataclass(frozen=True)
class PolicyContext:
    now: datetime
    plan_created_at: datetime
    permissions: frozenset[str]
    rollback_ready: bool = True
    cooldown_until: datetime | None = None
    telemetry_at: datetime | None = None
    telemetry_max_age_seconds: int = 30
    blast_radius_limit: int = 4


@dataclass(frozen=True)
class Denial:
    code: str
    message: str


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    reasons: tuple[Denial, ...]
    affected_nodes: tuple[str, ...] = ()


class RecoveryPolicy:
    def validate(self, plan: RecoveryPlan, topology: Topology, context: PolicyContext) -> PolicyDecision:
        reasons: list[Denial] = []
        now = _utc(context.now)
        if plan.plan_hash != plan.with_hash().plan_hash:
            reasons.append(Denial("plan_hash_mismatch", "plan hash does not match canonical plan"))
        if context.cooldown_until and now < _utc(context.cooldown_until):
            reasons.append(Denial("cooldown_active", "recovery cooldown is active"))
        if context.telemetry_at is None or (now - _utc(context.telemetry_at)).total_seconds() > context.telemetry_max_age_seconds:
            reasons.append(Denial("telemetry_stale", "telemetry is missing or stale"))
        if not context.rollback_ready:
            reasons.append(Denial("rollback_unready", "rollback action is not ready"))
        affected: set[str] = set()
        for action in plan.actions:
            if now > _utc(context.plan_created_at) + timedelta(seconds=action.metadata.expires_in_seconds):
                reasons.append(Denial("plan_expired", "action approval window has expired"))
            if action.action not in context.permissions:
                reasons.append(Denial("permission_denied", f"permission missing for {action.action}"))
            affected.update(self._what_if(action, topology, reasons))
        if len(affected) > context.blast_radius_limit:
            reasons.append(Denial("blast_radius_exceeded", "affected nodes exceed configured limit"))
        return PolicyDecision(not reasons, tuple(reasons), tuple(sorted(affected)))

    def _what_if(self, action: object, topology: Topology, reasons: list[Denial]) -> set[str]:
        if getattr(action, "action") == "restore_link":
            link = next((link for link in topology.links if link.id == action.link_id), None)
            if link is None:
                reasons.append(Denial("unknown_link", "restore_link references an unknown link"))
                return set()
            if link.state is not LinkState.DOWN:
                reasons.append(Denial("precondition_failed", "link is not down"))
            return {link.a.node_id, link.b.node_id}
        if getattr(action, "action") == "reroute_via":
            nodes = self._path_nodes(action.source, action.destination, action.alternate_path, topology)
            if not nodes:
                reasons.append(Denial("forwarding_loop", "alternate path is disconnected or loops"))
            return set(nodes)
        if getattr(action, "action") == "throttle_flow":
            if action.rate_mbps > 1000:
                reasons.append(Denial("parameter_out_of_bounds", "flow rate exceeds 1000 Mbps"))
            return set()
        if getattr(action, "action") == "clear_throttle":
            return set()
        reasons.append(Denial("unknown_action", "action is not supported by policy"))
        return set()

    @staticmethod
    def _path_nodes(source: str, destination: str, path: list[str], topology: Topology) -> list[str]:
        links = {link.id: link for link in topology.links}
        current = source
        nodes = [source]
        for link_id in path:
            link = links.get(link_id)
            if link is None:
                return []
            if link.a.node_id == current:
                current = link.b.node_id
            elif link.b.node_id == current:
                current = link.a.node_id
            else:
                return []
            if current in nodes:
                return []
            nodes.append(current)
        return nodes if current == destination else []


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
