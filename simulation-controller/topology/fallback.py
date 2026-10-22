import json
from pathlib import Path

import networkx as nx
from actions.allowlist import Allowlist, Command
from topology.controller import Controller


class FallbackController(Controller):
    """Deterministic NetworkX adapter for hosts without Mininet privileges."""

    def __init__(self, allowlist: Allowlist, topology_path: Path) -> None:
        super().__init__(allowlist)
        topology = json.loads(topology_path.read_text())
        self.graph = nx.Graph()
        self.host_paths = {path["source_host_id"]: path["destination_host_id"] for path in topology["expected_baseline_paths"]}
        for link in topology["links"]:
            self.graph.add_edge(link["a"]["node_id"], link["b"]["node_id"], link_id=link["id"], state=link["state"])

    def _apply(self, command: Command) -> None:
        if command.verb == "set_link_state":
            for _, _, data in self.graph.edges(data=True):
                if data["link_id"] == command.params["link_id"]:
                    data["state"] = command.params["state"]

    def telemetry(self) -> dict:
        paths = {}
        for source, destination in self.host_paths.items():
            graph = nx.Graph((a, b, data) for a, b, data in self.graph.edges(data=True) if data["state"] == "up")
            try:
                nodes = nx.shortest_path(graph, source, destination)
                paths[f"{source}:{destination}"] = {"reachable": True, "nodes": nodes}
            except nx.NetworkXNoPath:
                paths[f"{source}:{destination}"] = {"reachable": False, "nodes": []}
        return {"source": "SIMULATED", "paths": paths}
