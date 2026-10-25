// Pure topology edits shared by the canvas and by AI suggestions.
import type { Topology, TopologyLink, TopologyNode } from "../lib/api";
import { isL3, type Protocol } from "./engine.ts";

export function freshSubnet(topology: Topology) {
  const used = new Set(topology.nodes.flatMap((node) => node.interfaces.map((item) => item.address.split(".").slice(0, 3).join("."))));
  for (let third = 1; third < 255; third += 1) if (!used.has(`10.20.${third}`)) return `10.20.${third}`;
  return "10.21.0";
}

// Uses the first interface no link is attached to, or adds one.
export function freeInterface(topology: Topology, node: TopologyNode): { node: TopologyNode; interfaceId: string } {
  const taken = new Set(
    topology.links.flatMap((link) => [link.a.node_id === node.id ? link.a.interface_id : "", link.b.node_id === node.id ? link.b.interface_id : ""]),
  );
  const free = node.interfaces.find((item) => !taken.has(item.id));
  if (free) return { node, interfaceId: free.id };
  const interfaceId = `port-${node.interfaces.length + 1}`;
  const lan = node.interfaces[0].address.split("/")[0].split(".").slice(0, 3).join(".");
  const address = isL3(node) ? `${freshSubnet(topology)}.1/24` : `${lan}.${200 + node.interfaces.length}/24`;
  return { node: { ...node, interfaces: [...node.interfaces, { id: interfaceId, address }] }, interfaceId };
}

export function connect(topology: Topology, source: string, target: string, capacity_mbps = 100, delay_ms = 1): { topology: Topology; link: TopologyLink } | null {
  const a = topology.nodes.find((node) => node.id === source);
  const b = topology.nodes.find((node) => node.id === target);
  if (!a || !b || source === target) return null;
  const first = freeInterface(topology, a);
  const withA = { ...topology, nodes: topology.nodes.map((node) => (node.id === source ? first.node : node)) };
  const second = freeInterface(withA, b);
  let id = `link-${source}-${target}`;
  for (let suffix = 2; topology.links.some((link) => link.id === id); suffix += 1) id = `link-${source}-${target}-${suffix}`;
  const link: TopologyLink = { id, a: { node_id: source, interface_id: first.interfaceId }, b: { node_id: target, interface_id: second.interfaceId }, capacity_mbps, delay_ms, loss_pct: 0, jitter_ms: 0, state: "up" };
  return { topology: { ...withA, nodes: withA.nodes.map((node) => (node.id === target ? second.node : node)), links: [...topology.links, link] }, link };
}

export type Suggestion = {
  action: "add_link" | "set_ospf_cost" | "restore" | "set_protocol";
  a?: string | null;
  b?: string | null;
  link?: string | null;
  target?: string | null;
  cost?: number | null;
  capacity_mbps?: number;
  delay_ms?: number;
  protocol?: Protocol | null;
  reason: string;
};

// Returns the edited topology and protocol; the caller previews it before applying.
export function applySuggestion(topology: Topology, protocol: Protocol, item: Suggestion): { topology: Topology; protocol: Protocol } {
  if (item.action === "add_link" && item.a && item.b) return { topology: connect(topology, item.a, item.b, item.capacity_mbps, item.delay_ms)?.topology ?? topology, protocol };
  if (item.action === "set_ospf_cost" && item.link)
    return { topology: { ...topology, links: topology.links.map((link) => (link.id === item.link ? { ...link, ospf_cost: item.cost ?? undefined } : link)) }, protocol };
  if (item.action === "restore" && item.target)
    return {
      topology: {
        ...topology,
        nodes: topology.nodes.map((node) => (node.id === item.target ? { ...node, state: "up" } : node)),
        links: topology.links.map((link) => (link.id === item.target ? { ...link, state: "up" } : link)),
      },
      protocol,
    };
  if (item.action === "set_protocol" && item.protocol) return { topology, protocol: item.protocol };
  return { topology, protocol };
}
