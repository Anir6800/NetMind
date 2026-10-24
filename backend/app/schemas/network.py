from enum import Enum
from ipaddress import IPv4Interface

from pydantic import BaseModel, Field, model_validator


class NodeType(str, Enum):
    ROUTER = "router"
    SWITCH = "switch"
    HOST = "host"
    SERVER = "server"
    HUB = "hub"
    REPEATER = "repeater"
    FIREWALL = "firewall"
    ACCESS_POINT = "access-point"


class LinkState(str, Enum):
    UP = "up"
    DOWN = "down"
    DEGRADED = "degraded"


class Interface(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    address: IPv4Interface


class Node(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    type: NodeType
    interfaces: list[Interface] = Field(min_length=1)
    x: float = 0
    y: float = 0
    processing_delay_ms: float = Field(default=0.2, ge=0)
    routing_protocol: str = Field(default="static", pattern=r"^(static|rip|ospf)$")

    @model_validator(mode="after")
    def unique_interfaces(self) -> "Node":
        if len({interface.id for interface in self.interfaces}) != len(self.interfaces):
            raise ValueError("node interface IDs must be unique")
        return self


class LinkEnd(BaseModel):
    node_id: str
    interface_id: str


class Link(BaseModel):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    a: LinkEnd
    b: LinkEnd
    capacity_mbps: int = Field(gt=0)
    delay_ms: float = Field(ge=0)
    loss_pct: float = Field(default=0, ge=0, le=100)
    jitter_ms: float = Field(default=0, ge=0)
    state: LinkState = LinkState.UP


class BaselinePath(BaseModel):
    source_host_id: str
    destination_host_id: str
    link_ids: list[str] = Field(min_length=1)


class Topology(BaseModel):
    version: str = Field(pattern=r"^v\d+$")
    addressing_plan: str
    nodes: list[Node] = Field(default_factory=list)
    links: list[Link] = Field(default_factory=list)
    expected_baseline_paths: list[BaselinePath] = Field(default_factory=list)

    @model_validator(mode="after")
    def valid_graph(self) -> "Topology":
        node_ids = {node.id for node in self.nodes}
        if len(node_ids) != len(self.nodes):
            raise ValueError("node IDs must be unique")
        interfaces = {(node.id, interface.id) for node in self.nodes for interface in node.interfaces}
        link_ids = {link.id for link in self.links}
        if len(link_ids) != len(self.links):
            raise ValueError("link IDs must be unique")
        for link in self.links:
            if (link.a.node_id, link.a.interface_id) not in interfaces or (link.b.node_id, link.b.interface_id) not in interfaces:
                raise ValueError("link endpoint must reference an existing interface")
            if link.a == link.b:
                raise ValueError("link endpoints must differ")
        host_ids = {node.id for node in self.nodes if node.type in {NodeType.HOST, NodeType.SERVER}}
        pairs: set[tuple[str, str]] = set()
        for path in self.expected_baseline_paths:
            pair = (path.source_host_id, path.destination_host_id)
            if path.source_host_id not in host_ids or path.destination_host_id not in host_ids or path.source_host_id == path.destination_host_id:
                raise ValueError("baseline paths must connect two distinct hosts")
            if pair in pairs:
                raise ValueError("baseline host pairs must be unique")
            pairs.add(pair)
            if not set(path.link_ids) <= link_ids:
                raise ValueError("baseline path must reference existing links")
        return self
