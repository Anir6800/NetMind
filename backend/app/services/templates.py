"""Prepared student labs (SIMULATED): fixed NetworkSpecs fed to the deterministic builder.

Ids are stable kebab-case; data/templates/<id>.json is exported from these by
scripts/export_templates.py and checked against a fresh build in the tests.
"""

from __future__ import annotations

from app.schemas.network import Topology
from app.services.topology_builder import NetworkSpec, build_topology


def _t(id: str, label: str, category: str, description: str, **spec) -> dict:
    return {"id": id, "label": label, "category": category, "description": description, "spec": NetworkSpec(summary=description, **spec)}


TEMPLATES: list[dict] = [
    _t("campus", "College campus", "campus", "Three-tier campus with a firewalled server block, redundant OSPF core and Wi-Fi in the halls.",
       protocol="ospf", style="hierarchical", routers=4, firewalls=1, switches=6, access_points=3, servers=3, hosts=30, redundancy=True),
    _t("campus-ring", "Campus ring", "campus", "Five buildings joined by an OSPF fibre ring; cut one span and watch traffic go the other way.",
       protocol="ospf", style="ring", routers=5, switches=5, access_points=2, servers=2, hosts=20),
    _t("office", "Small office", "office", "One router, two switches and a Wi-Fi access point with static routes.",
       protocol="static", style="star", routers=1, switches=2, access_points=1, servers=1, hosts=8),
    _t("enterprise", "Enterprise HQ", "campus", "Large headquarters: two firewalls, a redundant six-router OSPF core and eight access switches.",
       protocol="ospf", style="hierarchical", routers=6, firewalls=2, switches=8, servers=4, hosts=28, redundancy=True),
    _t("data-center", "Data centre", "data-centre", "Leaf-spine fabric: two spines, four leaves, server-heavy racks on equal-cost OSPF paths.",
       protocol="ospf", style="leaf-spine", routers=6, switches=8, servers=20, hosts=8),
    _t("isp-backbone", "ISP backbone", "isp", "Ten-router OSPF backbone ring with chord links for redundancy and a few customer edges.",
       protocol="ospf", style="ring", routers=10, switches=4, servers=2, hosts=8, redundancy=True),
    _t("home", "Smart home", "home", "A home router, one switch and a Wi-Fi access point for a handful of devices.",
       protocol="static", style="star", routers=1, switches=1, access_points=1, hosts=5),
    _t("wireless-mesh", "Wireless mesh", "wireless", "Four fully meshed OSPF routers each serving access points; lossy 54 Mbps radio links.",
       protocol="ospf", style="mesh", routers=4, switches=4, access_points=6, servers=1, hosts=15),
    _t("branch", "Branch WAN", "wan", "Head office router with four branch sites on static hub-and-spoke WAN links.",
       protocol="static", style="star", routers=5, switches=5, servers=1, hosts=10),
    _t("hospital", "Hospital", "healthcare", "Firewalled clinical servers, redundant OSPF core, wards on switches and Wi-Fi.",
       protocol="ospf", style="hierarchical", routers=4, firewalls=1, switches=5, access_points=2, servers=3, hosts=20, redundancy=True),
    _t("school", "School lab", "campus", "Two RIP routers and three lab switches full of student PCs.",
       protocol="rip", style="hierarchical", routers=2, switches=3, servers=1, hosts=24),
    _t("hotel", "Hotel Wi-Fi", "hospitality", "Guest Wi-Fi on six access points behind two OSPF routers.",
       protocol="ospf", style="star", routers=2, switches=3, access_points=6, servers=1, hosts=18),
    _t("factory", "Industrial plant", "industrial", "Shop-floor bus: RIP routers in a line with old hubs and repeaters on the machines.",
       protocol="rip", style="bus", routers=3, switches=4, hubs=2, repeaters=2, servers=2, hosts=12),
    _t("retail", "Retail chain", "wan", "Six stores on static hub-and-spoke links to the head office.",
       protocol="static", style="star", routers=6, switches=6, servers=1, hosts=12),
    _t("bank", "Bank network", "finance", "Three firewalls guard the core banking servers on a redundant OSPF core.",
       protocol="ospf", style="hierarchical", routers=4, firewalls=3, switches=5, servers=4, hosts=16, redundancy=True),
    _t("cloud", "Hybrid cloud", "data-centre", "Small leaf-spine cloud pod reached through a firewall.",
       protocol="ospf", style="leaf-spine", routers=3, firewalls=1, switches=3, servers=8, hosts=4),
    _t("iot", "IoT deployment", "iot", "Forty sensors and gateways on Wi-Fi access points, RIP between two routers.",
       protocol="rip", style="star", routers=2, switches=3, access_points=4, servers=1, hosts=30),
    _t("voip", "VoIP office", "office", "Phones and a call server on an OSPF office network; watch delay and jitter.",
       protocol="ospf", style="hierarchical", routers=2, switches=3, servers=2, hosts=12),
    _t("security", "Security lab", "security", "Three firewalls in front of a redundant OSPF core: practise ACL rules and blocked flows.",
       protocol="ospf", style="hierarchical", routers=3, firewalls=3, switches=4, servers=3, hosts=8, redundancy=True),
    _t("rip-lab", "RIP practice", "routing", "Eight-router RIP ring: fail a link to see slow convergence and count-to-infinity.",
       protocol="rip", style="ring", routers=8, switches=2, servers=1, hosts=3),
    _t("ospf-lab", "OSPF practice", "routing", "Six fully meshed OSPF routers with mixed link costs: compare shortest paths.",
       protocol="ospf", style="mesh", routers=6, switches=3, servers=1, hosts=6),
    _t("legacy-lan", "Legacy LAN", "legacy", "Hubs and a repeater share one collision domain: see why switches replaced them.",
       protocol="static", style="bus", routers=1, switches=1, hubs=2, repeaters=1, servers=1, hosts=4),
    _t("ladder-small", "Complexity 1: small", "generated", "Generated-complexity ladder, step 1: two routers, ten devices.",
       protocol="ospf", style="hierarchical", routers=2, switches=2, servers=1, hosts=5),
    _t("ladder-medium", "Complexity 2: medium", "generated", "Generated-complexity ladder, step 2: five meshed routers, Wi-Fi, thirty devices.",
       protocol="ospf", style="mesh", routers=5, switches=5, access_points=2, servers=2, hosts=16),
    _t("ladder-large", "Complexity 3: large", "generated", "Generated-complexity ladder, step 3: fifty devices, firewalls, hubs and a redundant core.",
       protocol="ospf", style="hierarchical", routers=8, firewalls=2, switches=10, access_points=2, hubs=1, servers=4, hosts=23, redundancy=True),
]
TEMPLATE_BY_ID = {template["id"]: template for template in TEMPLATES}


def build_template(template: dict) -> Topology:
    spec: NetworkSpec = template["spec"]
    return build_topology(spec, f"{template['label']} (prepared template) · {spec.style} · {spec.protocol.upper()}")


def summary(template: dict) -> dict:
    spec: NetworkSpec = template["spec"]
    return {**{key: template[key] for key in ("id", "label", "category", "description")}, "device_count": spec.total, "protocol": spec.protocol, "style": spec.style}
