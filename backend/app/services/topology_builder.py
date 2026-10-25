"""Deterministic student-lab builder and validator.

AI (or the local rule-based planner, or the detailed form) only proposes a
small NetworkSpec; this module turns it into an addressed, connected topology
and validates the result before anything is saved or drawn.
"""

from __future__ import annotations

import json
import re
from collections import deque
from ipaddress import IPv4Interface
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from app.schemas.network import Topology

MAX_DEVICES = 50
Style = Literal["hierarchical", "ring", "mesh", "star", "leaf-spine", "bus"]


class NetworkSpec(BaseModel):
    protocol: Literal["static", "rip", "ospf"] = "ospf"
    style: Style = "hierarchical"
    routers: int = Field(default=2, ge=0, le=20)
    firewalls: int = Field(default=0, ge=0, le=5)
    switches: int = Field(default=2, ge=0, le=20)
    access_points: int = Field(default=0, ge=0, le=10)
    hubs: int = Field(default=0, ge=0, le=5)
    repeaters: int = Field(default=0, ge=0, le=5)
    servers: int = Field(default=1, ge=0, le=20)
    hosts: int = Field(default=4, ge=0, le=48)
    redundancy: bool = False
    summary: str = Field(default="", max_length=400)

    @property
    def total(self) -> int:
        return self.routers + self.firewalls + self.switches + self.access_points + self.hubs + self.repeaters + self.servers + self.hosts

    @model_validator(mode="after")
    def sized(self) -> NetworkSpec:
        if not 2 <= self.total <= MAX_DEVICES:
            raise ValueError(f"a lab needs 2 to {MAX_DEVICES} devices, got {self.total}")
        if self.hosts + self.servers < 2:
            raise ValueError("a lab needs at least two hosts or servers to send packets between")
        return self


COUNT_FIELDS = ("hosts", "servers", "access_points", "hubs", "repeaters", "switches", "firewalls", "routers")


def repair_spec(raw: dict) -> tuple[NetworkSpec, list[str]]:
    """Clamp counts into range and shrink an over-sized request to 50 devices (end devices first)."""
    notes: list[str] = []
    data = {key: value for key, value in raw.items() if key in NetworkSpec.model_fields}
    limits = {name: NetworkSpec.model_fields[name].metadata for name in COUNT_FIELDS}
    for name in COUNT_FIELDS:
        value = data.get(name, NetworkSpec.model_fields[name].default)
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"{name} must be a whole number")  # noqa: TRY004 - a schema violation, reported to the student
        upper = next(item.le for item in limits[name] if hasattr(item, "le"))
        if value < 0 or value > upper:
            notes.append(f"{name} {value} clamped to {max(0, min(value, upper))}")
        data[name] = max(0, min(value, upper))
    total = sum(data[name] for name in COUNT_FIELDS)
    if total > MAX_DEVICES:
        notes.append(f"requested {total} devices; reduced to the {MAX_DEVICES}-device limit")
        excess = total - MAX_DEVICES
        for name in COUNT_FIELDS:
            cut = min(excess, max(0, data[name] - (1 if name in {"routers", "switches"} else 0)))
            data[name] -= cut
            excess -= cut
    if data["access_points"] + data["hubs"] + data["repeaters"] and not data["switches"]:
        data["switches"] = 1
        notes.append("added a switch to attach the access points / hubs / repeaters to")
    if data["hosts"] + data["servers"] < 2:
        data["hosts"] = 2 - data["servers"]
        notes.append("added hosts so packets have a source and destination")
    return NetworkSpec.model_validate(data), notes


def local_plan(prompt: str, defaults: dict) -> tuple[NetworkSpec, list[str]]:
    """Local rule-based planner (not AI): keywords and numbers in the prompt."""
    text = prompt.lower()
    def number(pattern: str) -> int | None:
        match = re.search(pattern, text)
        return int(match.group(1)) if match else None

    total = number(r"(\d{1,3})\s*(?:devices?|nodes?)") or defaults.get("device_count", 12)
    protocol = next((name for name in ("ospf", "rip", "static") if name in text), defaults.get("protocol", "ospf"))
    style: Style = next((name for name in ("leaf-spine", "mesh", "ring", "star", "bus") if name in text), "hierarchical")
    floors = number(r"(\d{1,2})[\s-]*(?:floor|storey|building)s?") or (3 if "three-floor" in text or "three floor" in text else None)
    routers = number(r"(\d{1,2})\s*routers?") or max(2 if total >= 8 else 1, (floors or 0) and 2)
    firewalls = number(r"(\d)\s*firewalls?") or (1 if "firewall" in text else 0)
    switches = number(r"(\d{1,2})\s*switch(?:es)?") or floors or max(1, total // 10)
    access_points = number(r"(\d{1,2})\s*(?:access points?|aps?)\b") or (max(1, switches // 2) if re.search(r"wi-?fi|wireless", text) else 0)
    servers = number(r"(\d{1,2})\s*servers?") or (2 if total >= 20 else 1)
    hubs = 1 if "hub" in text else 0
    repeaters = 1 if "repeater" in text else 0
    fixed = routers + firewalls + switches + access_points + servers + hubs + repeaters
    raw = {
        "protocol": protocol,
        "style": style,
        "routers": routers,
        "firewalls": firewalls,
        "switches": switches,
        "access_points": access_points,
        "hubs": hubs,
        "repeaters": repeaters,
        "servers": servers,
        "hosts": max(2, total - fixed),
        "redundancy": bool(re.search(r"redundan|backup|resilien", text)),
        "summary": "Local rule-based planner (not AI): counts read from keywords and numbers in the prompt.",
    }
    return repair_spec(raw)


class _Builder:
    def __init__(self, spec: NetworkSpec) -> None:
        self.spec = spec
        self.nodes: list[dict] = []
        self.links: list[dict] = []
        self.ports: dict[str, int] = {}
        self.counter: dict[str, int] = {}
        self.lan = 0
        self.p2p = 0

    def add(self, kind: str, label: str, x: float, y: float) -> str:
        self.counter[kind] = self.counter.get(kind, 0) + 1
        number = self.counter[kind]
        node_id = f"{kind}-{number}"
        self.nodes.append({"id": node_id, "name": f"{label}{number}", "type": kind, "interfaces": [], "x": round(x), "y": round(y), "routing_protocol": self.spec.protocol})
        return node_id

    def port(self, node_id: str, address: str) -> str:
        node = next(item for item in self.nodes if item["id"] == node_id)
        self.ports[node_id] = self.ports.get(node_id, 0) + 1
        port = f"port-{self.ports[node_id]}"
        node["interfaces"].append({"id": port, "address": address})
        return port

    def link(self, a: str, a_address: str, b: str, b_address: str, mbps: float, delay: float, loss: float = 0) -> None:
        pa, pb = self.port(a, a_address), self.port(b, b_address)
        self.links.append({"id": f"link-{a}-{b}", "a": {"node_id": a, "interface_id": pa}, "b": {"node_id": b, "interface_id": pb}, "capacity_mbps": mbps, "delay_ms": delay, "loss_pct": loss, "jitter_ms": 0, "state": "up"})

    def point_to_point(self, a: str, b: str, mbps: float = 1000, delay: float = 2) -> None:
        self.p2p += 1
        base = f"10.255.{self.p2p // 64}.{(self.p2p % 64) * 4}"
        net = base.rsplit(".", 1)[0]
        last = int(base.rsplit(".", 1)[1])
        self.link(a, f"{net}.{last + 1}/30", b, f"{net}.{last + 2}/30", mbps, delay)

    def new_lan(self) -> str:
        self.lan += 1
        return f"10.{self.lan // 250}.{self.lan % 250 + 1}"


def build_topology(spec: NetworkSpec, plan: str = "") -> Topology:
    b = _Builder(spec)
    # Layered layout: one tier per device kind, wrapped at 12 cards per row so
    # 50-device labs stay readable (card width ~150 px).
    gap_x, gap_y, per_row = 180, 130, 12
    top = [0.0]

    def tier(count: int) -> list[tuple[float, float]]:
        cells = []
        for index in range(count):
            in_row = min(per_row, count - (index // per_row) * per_row)
            x = (per_row - in_row) * gap_x / 2 + (index % per_row) * gap_x
            cells.append((x, top[0] + (index // per_row) * gap_y))
        if count:
            top[0] += (-(-count // per_row)) * gap_y
        return cells

    routers = [b.add("router", "R", *cell) for cell in tier(spec.routers)]
    firewalls = [b.add("firewall", "FW", *cell) for cell in tier(spec.firewalls)]
    switches = [b.add("switch", "SW", *cell) for cell in tier(spec.switches)]
    edge_cells = tier(spec.access_points + spec.hubs + spec.repeaters)
    edge = [b.add("access-point", "AP", *edge_cells[i]) for i in range(spec.access_points)]
    hubs = [b.add("hub", "HUB", *edge_cells[spec.access_points + i]) for i in range(spec.hubs)]
    repeaters = [b.add("repeater", "REP", *edge_cells[spec.access_points + spec.hubs + i]) for i in range(spec.repeaters)]
    end_cells = tier(spec.servers + spec.hosts)
    servers = [b.add("server", "SRV", *end_cells[i]) for i in range(spec.servers)]
    hosts = [b.add("host", "PC", *end_cells[spec.servers + i]) for i in range(spec.hosts)]

    # Router interconnect by style.
    pairs: list[tuple[str, str]] = []
    r = routers
    if spec.style == "star":
        pairs = [(r[0], other) for other in r[1:]]
    elif spec.style == "mesh":
        pairs = [(r[i], r[j]) for i in range(len(r)) for j in range(i + 1, len(r))][: max(len(r) - 1, 3 * len(r))]
    elif spec.style == "leaf-spine" and len(r) >= 3:
        spines = r[: max(1, len(r) // 3)]
        pairs = [(leaf, spine) for leaf in r[len(spines):] for spine in spines]
    else:
        pairs = [(r[i], r[i + 1]) for i in range(len(r) - 1)]
        if len(r) >= 3 and (spec.style == "ring" or spec.redundancy):
            pairs.append((r[-1], r[0]))
    if spec.redundancy and spec.style in {"hierarchical", "ring"}:
        pairs += [(r[i], r[i + 2]) for i in range(len(r) - 2) if (r[i], r[i + 2]) not in pairs][: len(r) // 2]
    for index, (a, c) in enumerate(pairs):
        b.point_to_point(a, c, 1000 if spec.style in {"leaf-spine", "mesh"} else (1000 if index % 2 == 0 else 100), 1 + index % 3)

    # Firewalls sit between the first routers and a protected segment.
    for index, fw in enumerate(firewalls):
        if routers:
            b.point_to_point(routers[index % len(routers)], fw, 1000, 1)
            if spec.redundancy and len(routers) > 1:
                b.point_to_point(routers[(index + 1) % len(routers)], fw, 1000, 1)
        elif index:
            b.point_to_point(firewalls[0], fw, 1000, 1)

    # Each switch is a LAN hung off a router (the first, protected one off a firewall).
    gateways = firewalls[:1] + routers if firewalls else routers
    lan_of: dict[str, str] = {}
    next_ip: dict[str, int] = {}

    def address(device: str) -> str:
        net = lan_of[device]
        next_ip[net] = next_ip.get(net, 10) + 1
        return f"{net}.{next_ip[net] - 1}/24"

    for index, sw in enumerate(switches):
        if gateways:
            gateway = gateways[index % len(gateways)]
            lan_of[sw] = b.new_lan()
            b.link(gateway, f"{lan_of[sw]}.1/24", sw, address(sw), 1000, 0.5)
            if spec.redundancy and len(routers) > 1 and gateway in routers:
                backup = routers[(routers.index(gateway) + 1) % len(routers)]
                b.link(backup, f"{lan_of[sw]}.2/24", sw, address(sw), 100, 0.5)
        else:  # flat layer-2 network: one LAN, switches chained
            lan_of[sw] = lan_of.get(switches[0], "10.0.1")
            if index:
                b.link(switches[index - 1], address(sw), sw, address(sw), 1000, 0.5)

    # L2/L1 edge devices hang off switches and share the switch's LAN.
    for index, device in enumerate(edge + hubs + repeaters):
        parent = switches[index % len(switches)]
        lan_of[device] = lan_of[parent]
        b.link(parent, address(parent), device, address(device), 54 if device in edge else 10, 0.5, 0.5 if device in edge else 0)

    # End devices: servers on the first (protected) switch, hosts spread over access devices.
    access = [*(switches[1:] if firewalls and len(switches) > 1 else switches), *edge, *hubs, *repeaters]
    for index, device in enumerate(servers + hosts):
        if switches:
            parent = switches[0] if device in servers else access[index % len(access)]
            lan_of[device] = lan_of[parent]
            wireless = parent in edge
            b.link(parent, address(parent), device, address(device), 54 if wireless else (10 if parent in hubs + repeaters else 100), 1.5 if wireless else 0.2, 0.5 if wireless else 0)
        elif routers + firewalls:
            target = (routers + firewalls)[index % len(routers + firewalls)]
            net = b.new_lan()
            b.link(target, f"{net}.1/24", device, f"{net}.10/24", 100, 0.2)
        elif index:
            b.link((servers + hosts)[index - 1], f"10.0.1.{9 + index}/24", device, f"10.0.1.{10 + index}/24", 100, 0.2)

    for node in b.nodes:
        if not node["interfaces"]:
            node["interfaces"].append({"id": "port-1", "address": "10.254.0.1/24"})
    return Topology.model_validate({"version": "v1", "addressing_plan": plan or f"10.x.y.0/24 LANs, 10.255.x.y/30 router links · {spec.style}", "nodes": b.nodes, "links": b.links, "expected_baseline_paths": []})


def validate_lab(topology: Topology) -> list[str]:
    """Problems that make a lab unusable; empty list means valid."""
    problems: list[str] = []
    if len(topology.nodes) > MAX_DEVICES:
        problems.append(f"{len(topology.nodes)} devices exceeds the {MAX_DEVICES}-device limit")
    names = [node.name or node.id for node in topology.nodes]
    if len(set(names)) != len(names):
        problems.append("device names must be unique")
    addresses: dict[str, str] = {}
    for node in topology.nodes:
        for item in node.interfaces:
            ip = str(IPv4Interface(item.address).ip)
            if ip in addresses and addresses[ip] != node.id:
                problems.append(f"IP {ip} is used by both {addresses[ip]} and {node.id}")
            addresses[ip] = node.id
    for link in topology.links:
        if not (0.01 <= link.capacity_mbps <= 100_000) or link.delay_ms > 10_000 or link.jitter_ms > 1_000:
            problems.append(f"link {link.id} has unrealistic parameters")
    if topology.nodes:
        graph: dict[str, set[str]] = {node.id: set() for node in topology.nodes}
        for link in topology.links:
            graph[link.a.node_id].add(link.b.node_id)
            graph[link.b.node_id].add(link.a.node_id)
        seen = {topology.nodes[0].id}
        queue = deque(seen)
        while queue:
            for other in graph[queue.popleft()] - seen:
                seen.add(other)
                queue.append(other)
        if len(seen) != len(graph):
            problems.append(f"{len(graph) - len(seen)} devices are not connected to the rest of the network")
    return problems


def spec_from_json(text: str) -> tuple[NetworkSpec, list[str]]:
    """Parse model output strictly: JSON object only, then repair counts."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        raw = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise ValueError(f"model output is not valid JSON ({error.msg})") from error
    if not isinstance(raw, dict):
        raise ValueError("model output must be a JSON object")  # noqa: TRY004 - a schema violation, reported to the student
    try:
        return repair_spec(raw)
    except (ValidationError, ValueError) as error:
        detail = error.errors()[0]["msg"] if isinstance(error, ValidationError) else str(error)
        raise ValueError(f"model output violates the network schema: {detail}") from error
