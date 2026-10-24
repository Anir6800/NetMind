import type { Topology, TopologyLink } from "../lib/api";

// h1 - sw1 - r1 ==(100M primary)== r2 - sw2 - h2, with a slow r1 - r3 - r2 backup.
export function lab(): Topology {
  const node = (id: string, type: string, addresses: string[], x: number, y: number) => ({
    id,
    type,
    interfaces: addresses.map((address, index) => ({ id: `p${index + 1}`, address })),
    x,
    y,
  });
  const link = (id: string, a: string, ai: string, b: string, bi: string, capacity_mbps: number, delay_ms: number): TopologyLink => ({
    id,
    a: { node_id: a, interface_id: ai },
    b: { node_id: b, interface_id: bi },
    capacity_mbps,
    delay_ms,
    state: "up",
  });
  return {
    version: "v1",
    addressing_plan: "10.0.0.0/16 three-router lab",
    nodes: [
      node("h1", "host", ["10.0.1.10/24"], 0, 200),
      node("sw1", "switch", ["10.0.1.2/24", "10.0.1.3/24"], 220, 200),
      node("r1", "router", ["10.0.1.1/24", "10.0.12.1/30", "10.0.13.1/30"], 440, 200),
      node("r2", "router", ["10.0.2.1/24", "10.0.12.2/30", "10.0.23.2/30"], 880, 200),
      node("r3", "router", ["10.0.13.2/30", "10.0.23.1/30"], 660, 400),
      node("sw2", "switch", ["10.0.2.2/24", "10.0.2.3/24"], 1100, 200),
      node("h2", "host", ["10.0.2.10/24"], 1320, 200),
    ],
    links: [
      link("l1", "h1", "p1", "sw1", "p1", 100, 1),
      link("l2", "sw1", "p2", "r1", "p1", 1000, 0.5),
      link("l3", "r1", "p2", "r2", "p2", 100, 2),
      link("l4", "r2", "p1", "sw2", "p1", 1000, 0.5),
      link("l5", "sw2", "p2", "h2", "p1", 100, 1),
      link("l6", "r1", "p3", "r3", "p1", 10, 5),
      link("l7", "r3", "p2", "r2", "p3", 10, 5),
    ],
  };
}
