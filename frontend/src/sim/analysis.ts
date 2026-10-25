// SIMULATED critical-device analysis over the physical graph of up devices
// and up links. Pure functions; parallel links are separate edges.
import type { Topology } from "../lib/api";
import { applyFault, computeTables, DEVICE_LAYER, forward, labelOf, type Protocol } from "./engine.ts";

type Edge = { link: string; other: string };
const END = new Set(["host", "server"]);
const LAYERS = ["L1 Physical", "L2 Data link", "L3 Network", "L4 Transport", "L5 Session", "L6 Presentation", "L7 Application"];

// ponytail: mirrors engine.ts physicalGraph (not exported there).
function graph(topology: Topology) {
  const up = new Set(topology.nodes.filter((node) => node.state !== "down").map((node) => node.id));
  const result = new Map<string, Edge[]>([...up].sort().map((id) => [id, []]));
  for (const link of topology.links) {
    if (link.state === "down" || !up.has(link.a.node_id) || !up.has(link.b.node_id)) continue;
    result.get(link.a.node_id)!.push({ link: link.id, other: link.b.node_id });
    result.get(link.b.node_id)!.push({ link: link.id, other: link.a.node_id });
  }
  return result;
}

// Tarjan low-link. The parent is skipped by link id, not node id, so a
// parallel link back to the parent counts as a cycle.
function tarjan(topology: Topology) {
  const g = graph(topology);
  const order = new Map<string, number>();
  const low = new Map<string, number>();
  const points = new Set<string>();
  const cut: string[] = [];
  const visit = (node: string, parentLink: string | null) => {
    order.set(node, order.size);
    low.set(node, order.get(node)!);
    let children = 0;
    for (const { link, other } of g.get(node)!) {
      if (link === parentLink) continue;
      if (order.has(other)) {
        low.set(node, Math.min(low.get(node)!, order.get(other)!));
        continue;
      }
      children += 1;
      visit(other, link);
      low.set(node, Math.min(low.get(node)!, low.get(other)!));
      if (low.get(other)! > order.get(node)!) cut.push(link);
      if (parentLink !== null && low.get(other)! >= order.get(node)!) points.add(node);
    }
    if (parentLink === null && children > 1) points.add(node);
  };
  for (const node of g.keys()) if (!order.has(node)) visit(node, null);
  return { points: [...points].sort(), bridges: cut.sort() };
}

export const articulationPoints = (topology: Topology) => tarjan(topology).points;
export const bridges = (topology: Topology) => tarjan(topology).bridges;

// Brandes on the unweighted physical graph (parallel links collapsed to one
// neighbour). Only pairs of END devices (host/server) count: a device's score
// is the raw sum over unordered end-device pairs {s,t} of the fraction of
// s-t shortest paths passing through it. No division by (n-1)(n-2).
export function betweenness(topology: Topology): Map<string, number> {
  const g = graph(topology);
  const types = new Map(topology.nodes.map((node) => [node.id, node.type]));
  const score = new Map([...g.keys()].map((id) => [id, 0]));
  const neighbours = new Map([...g].map(([id, edges]) => [id, [...new Set(edges.map((edge) => edge.other))]]));
  for (const source of g.keys()) {
    if (!END.has(types.get(source)!)) continue;
    const sigma = new Map([[source, 1]]);
    const dist = new Map([[source, 0]]);
    const preds = new Map<string, string[]>();
    const stack: string[] = [];
    const queue = [source];
    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of neighbours.get(v)!) {
        if (!dist.has(w)) {
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + sigma.get(v)!);
          preds.set(w, [...(preds.get(w) ?? []), v]);
        }
      }
    }
    const delta = new Map<string, number>();
    while (stack.length) {
      const w = stack.pop()!;
      const own = (w !== source && END.has(types.get(w)!) ? 1 : 0) + (delta.get(w) ?? 0);
      for (const v of preds.get(w) ?? [])
        delta.set(v, (delta.get(v) ?? 0) + (sigma.get(v)! / sigma.get(w)!) * own);
      if (w !== source) score.set(w, score.get(w)! + (delta.get(w) ?? 0) / 2);
    }
  }
  return score;
}

function components(topology: Topology) {
  const g = graph(topology);
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const start of g.keys()) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let i = 0; i < group.length; i++)
      for (const { other } of g.get(group[i])!)
        if (!seen.has(other)) {
          seen.add(other);
          group.push(other);
        }
    groups.push(group);
  }
  return groups;
}

// Largest connected group; on a tie the group holding the lowest id is kept
// and `tie` is reported. A lone device is not a "group", so isolating
// everything loses everything.
const mainGroup = (topology: Topology) => {
  const [best = [], second = []] = components(topology).sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  return { group: new Set(best.length > 1 ? best : []), tie: best.length > 1 && best.length === second.length };
};

export function failureImpact(topology: Topology, target: string): { lost: string[]; summary: string } {
  const link = topology.links.find((item) => item.id === target);
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const before = mainGroup(topology).group;
  const after = mainGroup(applyFault(topology, { kind: link ? "link-down" : "node-down", target }));
  const lost = [...before].filter((id) => id !== target && !after.group.has(id)).sort();
  const name = link ? `the ${labelOf(byId.get(link.a.node_id))}–${labelOf(byId.get(link.b.node_id))} link` : labelOf(byId.get(target));
  const summary = after.tie
    ? `if ${name} fails, the network splits into two equal halves of ${after.group.size} devices`
    : `if ${name} fails, ${lost.length} device${lost.length === 1 ? "" : "s"} lose${lost.length === 1 ? "s" : ""} reachability`;
  return { lost, summary };
}

export function criticalSummary(topology: Topology) {
  const { points, bridges: links } = tarjan(topology);
  const spof = [
    ...points.map((id) => ({ id, kind: "device" as const })),
    ...links.map((id) => ({ id, kind: "link" as const })),
  ]
    .map((item) => {
      const impact = failureImpact(topology, item.id);
      return { ...item, lost: impact.lost.length, summary: impact.summary };
    })
    .sort((a, b) => b.lost - a.lost || a.id.localeCompare(b.id));
  return { spof, busiest: busiestOf(topology, (type) => !END.has(type)) };
}

function busiestOf(topology: Topology, keep: (type: string) => boolean) {
  const types = new Map(topology.nodes.map((node) => [node.id, node.type]));
  let busiest: { id: string; score: number } | null = null;
  for (const [id, score] of betweenness(topology))
    if (keep(types.get(id)!) && score > 0 && (!busiest || score > busiest.score)) busiest = { id, score };
  return busiest;
}

function shortestPath(topology: Topology, from: string, to: string) {
  const g = graph(topology);
  const previous = new Map<string, string>([[from, from]]);
  const queue = [from];
  while (queue.length) {
    const v = queue.shift()!;
    if (v === to) break;
    for (const { other } of g.get(v) ?? [])
      if (!previous.has(other)) {
        previous.set(other, v);
        queue.push(other);
      }
  }
  if (!previous.has(to)) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(previous.get(path[0])!);
  return path;
}

export function dependents(
  topology: Topology,
  protocol: Protocol,
  device: string,
  flows: { src: string; dst: string; app: string }[],
) {
  const core = busiestOf(topology, (type) => type === "router" || type === "firewall")?.id;
  const upstream = !core || core === device ? [] : shortestPath(topology, device, core).slice(1);
  const tables = computeTables(topology, protocol);
  const type = topology.nodes.find((node) => node.id === device)?.type ?? "router";
  const layers = LAYERS.slice(0, DEVICE_LAYER[type] ?? 3);
  return {
    upstream,
    downstream: failureImpact(topology, device).lost,
    flows: flows
      .filter((flow) => forward(topology, tables, flow.src, flow.dst, { app: flow.app }).nodes.includes(device))
      .map((flow) => ({ src: flow.src, dst: flow.dst, layers })),
  };
}
