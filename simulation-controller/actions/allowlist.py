import json
from dataclasses import dataclass
from pathlib import Path

VERBS = {"set_link_state", "set_netem", "replace_route", "clear_netem"}


@dataclass(frozen=True)
class Command:
    verb: str
    params: dict


class Allowlist:
    def __init__(self, topology_path: Path) -> None:
        topology = json.loads(topology_path.read_text())
        self.links = {link["id"] for link in topology["links"]}
        self.interfaces = {(node["id"], interface["id"]) for node in topology["nodes"] for interface in node["interfaces"]}
        self.hosts = {node["id"] for node in topology["nodes"] if node["type"] == "host"}

    def validate(self, verb: str, params: dict) -> Command:
        if verb not in VERBS:
            raise ValueError("operation is not allowlisted")
        if verb == "set_link_state":
            self._link(params)
            if params.get("state") not in {"up", "down"}:
                raise ValueError("link state must be up or down")
        elif verb in {"set_netem", "clear_netem"}:
            self._interface(params)
            if verb == "set_netem":
                allowed = {"node_id", "interface_id", "delay_ms", "loss_pct", "rate_mbps"}
                netem_values = ("delay_ms", "loss_pct", "rate_mbps")
                if set(params) - allowed or not any(key in params for key in netem_values):
                    raise ValueError("netem requires one allowed shaping value")
                for key in set(netem_values) & set(params):
                    if not isinstance(params[key], (int, float)) or params[key] < 0:
                        raise ValueError("netem values must be non-negative numbers")
        else:
            if set(params) != {"node_id", "destination", "via_interface_id"}:
                raise ValueError("route replacement has fixed parameters")
            self._interface({"node_id": params["node_id"], "interface_id": params["via_interface_id"]})
            if params["node_id"] not in self.hosts or not isinstance(params["destination"], str):
                raise ValueError("route must target a known host and destination")
        return Command(verb, dict(params))

    def _link(self, params: dict) -> None:
        if set(params) != {"link_id", "state"} or params["link_id"] not in self.links:
            raise ValueError("link must reference a known link ID")

    def _interface(self, params: dict) -> None:
        if set(params) != {"node_id", "interface_id"} and not {"node_id", "interface_id"} <= set(params):
            raise ValueError("operation must reference node and interface")
        if (params["node_id"], params["interface_id"]) not in self.interfaces:
            raise ValueError("operation must reference a known interface")
