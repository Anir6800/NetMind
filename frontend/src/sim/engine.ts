// SIMULATED educational network model. Pure functions only: the canvas, the
// Preview button, the live right-click controls, the slow-motion player and
// the tests all call these, so there is exactly one calculator.
import type { Topology, TopologyLink, TopologyNode } from "../lib/api";

export type Protocol = "static" | "rip" | "ospf";

export const SIGNAL_SPEED_M_PER_S = 2e8;
export const OSPF_REFERENCE_MBPS = 1000;
export const RIP_INFINITY = 16;
export const DEFAULT_TTL = 64;
export const DEFAULT_QUEUE_PACKETS = 64;

// Highest OSI layer each device processes a packet at.
export const DEVICE_LAYER: Record<string, number> = {
  hub: 1,
  repeater: 1,
  switch: 2,
  "access-point": 2,
  router: 3,
  firewall: 3,
  host: 7,
  server: 7,
};
// t_proc per device type (ms): router > firewall > switch > repeater > hub.
export const PROCESSING_MS: Record<string, number> = {
  router: 0.5,
  firewall: 0.4,
  "access-point": 0.08,
  switch: 0.05,
  repeater: 0.01,
  hub: 0.005,
  host: 0.1,
  server: 0.1,
};
// Frame sizes on the wire (bytes).
export const PACKET_BYTES: Record<string, number> = {
  ICMP: 98,
  ARP: 60,
  DHCP: 342,
  DNS: 86,
  TCP: 1500,
  UDP: 512,
  HTTP: 1500,
};

export const isL3 = (node: TopologyNode) => (DEVICE_LAYER[node.type] ?? 3) >= 3;
export const labelOf = (node?: TopologyNode) => node?.name || node?.id || "?";
export const ipOf = (node?: TopologyNode) =>
  node?.interfaces[0]?.address.split("/")[0] ?? "0.0.0.0";

// ---------- timing formulas (see docs/sim_model.md) ----------

export const transmissionMs = (bytes: number, mbps: number) =>
  (bytes * 8) / (mbps * 1000);

export const propagationMs = (link: TopologyLink) =>
  link.length_m != null
    ? (link.length_m / SIGNAL_SPEED_M_PER_S) * 1000
    : link.delay_ms;

// M/M/1/K estimate driven by link utilisation: mean wait
// W_q = rho / (1 - rho) * t_tx and tail-drop probability
// P_K = (1 - rho) rho^K / (1 - rho^(K+1)).
export function queueEstimate(link: TopologyLink, bytes: number, extraPct = 0) {
  const rho = Math.min(0.99, Math.max(0, ((link.utilisation_pct ?? 0) + extraPct) / 100));
  const k = link.queue_packets ?? DEFAULT_QUEUE_PACKETS;
  const waitMs = (rho / (1 - rho)) * transmissionMs(bytes, link.capacity_mbps);
  const dropProbability = rho === 0 ? 0 : ((1 - rho) * rho ** k) / (1 - rho ** (k + 1));
  return { rho, waitMs, dropProbability };
}

export const ospfCost = (link: TopologyLink) =>
  link.ospf_cost ?? Math.max(1, Math.floor(OSPF_REFERENCE_MBPS / link.capacity_mbps));

// ---------- graph ----------

type PhysicalEdge = { link: TopologyLink; other: string };
export type Adjacency = { neighbour: string; links: string[]; nodes: string[] };

function physicalGraph(topology: Topology) {
  const up = new Set(topology.nodes.filter((node) => node.state !== "down").map((node) => node.id));
  const graph = new Map<string, PhysicalEdge[]>([...up].map((id) => [id, []]));
  for (const link of topology.links) {
    if (link.state === "down" || !up.has(link.a.node_id) || !up.has(link.b.node_id)) continue;
    graph.get(link.a.node_id)!.push({ link, other: link.b.node_id });
    graph.get(link.b.node_id)!.push({ link, other: link.a.node_id });
  }
  return graph;
}

// Two L3 devices are neighbours when a path of only L1/L2 devices joins them
// (switches, hubs, repeaters and access points are transparent segments).
export function l3Adjacencies(topology: Topology): Map<string, Adjacency[]> {
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const graph = physicalGraph(topology);
  const result = new Map<string, Adjacency[]>();
  for (const [start] of graph) {
    if (!isL3(byId.get(start)!)) continue;
    const found: Adjacency[] = [];
    const previous = new Map<string, { node: string; link: string }>();
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      if (current !== start && isL3(byId.get(current)!)) {
        const nodes = [current];
        const links: string[] = [];
        for (let cursor = current; cursor !== start; cursor = previous.get(cursor)!.node) {
          links.unshift(previous.get(cursor)!.link);
          nodes.unshift(previous.get(cursor)!.node);
        }
        found.push({ neighbour: current, links, nodes });
        continue;
      }
      for (const edge of graph.get(current)!) {
        if (seen.has(edge.other)) continue;
        seen.add(edge.other);
        previous.set(edge.other, { node: current, link: edge.link.id });
        queue.push(edge.other);
      }
    }
    result.set(start, found);
  }
  return result;
}

export function allUp(topology: Topology): Topology {
  return {
    ...topology,
    nodes: topology.nodes.map((node) => ({ ...node, state: "up" })),
    links: topology.links.map((link) => ({ ...link, state: "up" })),
  };
}

// ---------- routing tables ----------

export type Route = {
  prefix: string;
  dest: string;
  nextHop: string | null;
  iface: string;
  metric: number;
  code: "C" | "S" | "R" | "O";
};
export type Tables = Map<string, Route[]>;

export function networkOf(cidr: string) {
  const [ip, bits] = cidr.split("/");
  const length = Number(bits ?? 32);
  const mask = length === 0 ? 0 : (~0 << (32 - length)) >>> 0;
  return `${toIp((toInt(ip) & mask) >>> 0)}/${length}`;
}
const toInt = (ip: string) =>
  ip.split(".").reduce((sum, part) => ((sum << 8) | Number(part)) >>> 0, 0);
const toIp = (value: number) =>
  [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");

export function longestPrefixMatch(routes: Route[], ip: string): Route | undefined {
  const target = toInt(ip);
  let best: Route | undefined;
  let bestLength = -1;
  for (const route of routes) {
    const [net, bits] = route.prefix.split("/");
    const length = Number(bits);
    const mask = length === 0 ? 0 : (~0 << (32 - length)) >>> 0;
    if (((target & mask) >>> 0) === toInt(net) && length > bestLength) {
      best = route;
      bestLength = length;
    }
  }
  return best;
}

// Shortest paths over the L3 graph. RIP and static use hop count, OSPF uses
// cost = reference bandwidth / bandwidth of the outgoing interface.
export function shortestFrom(
  start: string,
  adjacency: Map<string, Adjacency[]>,
  weight: (hop: Adjacency, topology: Topology) => number,
  topology: Topology,
) {
  const distance = new Map([[start, 0]]);
  const first = new Map<string, Adjacency>();
  const done = new Set<string>();
  while (true) {
    let current: string | undefined;
    for (const [id, value] of distance)
      if (!done.has(id) && (current === undefined || value < distance.get(current)!)) current = id;
    if (current === undefined) break;
    done.add(current);
    for (const hop of adjacency.get(current) ?? []) {
      const candidate = distance.get(current)! + weight(hop, topology);
      if (candidate < (distance.get(hop.neighbour) ?? Infinity)) {
        distance.set(hop.neighbour, candidate);
        first.set(hop.neighbour, current === start ? hop : first.get(current)!);
      }
    }
  }
  return { distance, first };
}

const linkById = (topology: Topology) => new Map(topology.links.map((link) => [link.id, link]));

function interfaceOn(topology: Topology, nodeId: string, linkId: string) {
  const link = topology.links.find((item) => item.id === linkId);
  if (!link) return "?";
  return (link.a.node_id === nodeId ? link.a.interface_id : link.b.interface_id) ?? "?";
}

// Prefixes each L3 device advertises: the subnet of every interface that has
// at least one up link to an up device (a dead interface withdraws its
// connected route). Several devices can share a prefix (a router's LAN
// interface and the hosts behind it).
export function prefixOwners(topology: Topology): Map<string, string[]> {
  const up = new Set(topology.nodes.filter((node) => node.state !== "down").map((node) => node.id));
  const live = new Set<string>();
  for (const link of topology.links)
    if (link.state !== "down" && up.has(link.a.node_id) && up.has(link.b.node_id))
      for (const end of [link.a, link.b]) live.add(`${end.node_id}|${end.interface_id}`);
  const owners = new Map<string, string[]>();
  for (const node of topology.nodes)
    if (isL3(node) && up.has(node.id))
      for (const item of node.interfaces) {
        const prefix = networkOf(item.address);
        if (live.has(`${node.id}|${item.id}`) && !owners.get(prefix)?.includes(node.id))
          owners.set(prefix, [...(owners.get(prefix) ?? []), node.id]);
      }
  return owners;
}

export const routeWeight = (topology: Topology, protocol: Protocol) => {
  const links = linkById(topology);
  return protocol === "ospf" ? (hop: Adjacency) => ospfCost(links.get(hop.links[0])!) : () => 1;
};

// One device's table from shortest-path results (used by computeTables and
// by the convergence simulator's per-router SPF).
export function routesFrom(
  node: TopologyNode,
  result: ReturnType<typeof shortestFrom>,
  owners: Map<string, string[]>,
  basis: Topology,
  protocol: Protocol,
): Route[] {
  const { distance, first } = result;
  const code = protocol === "static" ? "S" : protocol === "rip" ? "R" : "O";
  const routes: Route[] = [];
  for (const [prefix, ids] of owners) {
    if (ids.includes(node.id)) {
      const local = node.interfaces.find((item) => networkOf(item.address) === prefix)!;
      routes.push({ prefix, dest: node.id, nextHop: null, iface: local.id, metric: 0, code: "C" });
      continue;
    }
    const owner = ids.filter((id) => distance.has(id)).sort((a, b) => distance.get(a)! - distance.get(b)!)[0];
    if (!owner) continue;
    const metric = distance.get(owner)!;
    if (protocol === "rip" && metric >= RIP_INFINITY) continue;
    const hop = first.get(owner)!;
    routes.push({ prefix, dest: owner, nextHop: hop.neighbour, iface: interfaceOn(basis, node.id, hop.links[0]), metric, code });
  }
  return routes;
}

export function computeTables(topology: Topology, protocol: Protocol): Tables {
  // Static routes are configured at design time (all links up) and never
  // change by themselves when something fails.
  const basis = protocol === "static" ? allUp(topology) : topology;
  const adjacency = l3Adjacencies(basis);
  const weight = routeWeight(basis, protocol);
  const owners = prefixOwners(basis);
  const tables: Tables = new Map();
  for (const node of topology.nodes) {
    if (!isL3(node) || !adjacency.has(node.id)) continue;
    tables.set(node.id, routesFrom(node, shortestFrom(node.id, adjacency, weight, basis), owners, basis, protocol));
  }
  return tables;
}

// ---------- forwarding ----------

export type Trace = {
  delivered: boolean;
  reason: string;
  dropAt?: string;
  l3Hops: string[];
  nodes: string[];
  links: string[];
  ttlAtDest: number;
  ttlExpiredAt?: string;
};

export function firewallAllows(node: TopologyNode, app: string) {
  const rule = node.acl?.find((item) => item.protocol === app || item.protocol === "ANY");
  return !rule || rule.action === "allow";
}

export function forward(
  topology: Topology,
  tables: Tables,
  src: string,
  dst: string,
  options: { ttl?: number; app?: string } = {},
): Trace {
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const adjacency = l3Adjacencies(topology);
  const trace: Trace = { delivered: false, reason: "", l3Hops: [src], nodes: [src], links: [], ttlAtDest: 0 };
  const drop = (at: string, reason: string) => ({ ...trace, dropAt: at, reason });
  if (!byId.has(src) || !byId.has(dst)) return drop(src, "unknown device");
  if (byId.get(src)!.state === "down") return drop(src, `${labelOf(byId.get(src))} is powered down`);
  if (byId.get(dst)!.state === "down") return drop(src, `${labelOf(byId.get(dst))} is powered down`);
  let ttl = options.ttl ?? DEFAULT_TTL;
  let current = src;
  while (current !== dst) {
    if (trace.l3Hops.length > 64) return drop(current, "routing loop");
    const route = longestPrefixMatch(tables.get(current) ?? [], ipOf(byId.get(dst)));
    if (!route || (route.code === "R" && route.metric >= RIP_INFINITY))
      return drop(current, `no route to ${ipOf(byId.get(dst))}`);
    // A connected route delivers onto the local segment (after ARP).
    const next = route.nextHop ?? dst;
    const hop = (adjacency.get(current) ?? []).find((item) => item.neighbour === next);
    if (!hop)
      return drop(
        current,
        route.nextHop
          ? `next hop ${labelOf(byId.get(route.nextHop))} unreachable — packet blackholed`
          : `ARP for ${ipOf(byId.get(dst))} unanswered on ${route.prefix}`,
      );
    trace.nodes.push(...hop.nodes.slice(1));
    trace.links.push(...hop.links);
    trace.l3Hops.push(hop.neighbour);
    current = hop.neighbour;
    const node = byId.get(current)!;
    if (node.type === "firewall" && !firewallAllows(node, options.app ?? "ICMP"))
      return drop(current, `${labelOf(node)} firewall rule denies ${options.app}`);
    if (current !== dst) {
      ttl -= 1;
      if (ttl <= 0) return { ...drop(current, `TTL expired at ${labelOf(node)}`), ttlExpiredAt: current };
    }
  }
  return { ...trace, delivered: true, reason: "delivered", ttlAtDest: ttl };
}

// ---------- analytical path metrics ----------

export type PathMetrics = {
  propagation: number;
  transmission: number;
  processing: number;
  queueing: number;
  total: number;
  jitter: number;
  loss: number;
  bottleneckMbps: number;
  bottleneckLink: string;
  throughputMbps: number;
};

export function pathMetrics(
  topology: Topology,
  trace: Trace,
  bytes: number,
  extraLoad: Map<string, number> = new Map(),
): PathMetrics {
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const links = linkById(topology);
  const metrics: PathMetrics = {
    propagation: 0,
    transmission: 0,
    processing: 0,
    queueing: 0,
    total: 0,
    jitter: 0,
    loss: 0,
    bottleneckMbps: 0,
    bottleneckLink: "",
    throughputMbps: 0,
  };
  if (!trace.delivered) return { ...metrics, loss: 100 };
  let success = 1;
  let throughput = Infinity;
  trace.nodes.forEach((id) => (metrics.processing += PROCESSING_MS[byId.get(id)!.type] ?? 0.1));
  trace.links.forEach((id, index) => {
    const link = links.get(id)!;
    const sender = byId.get(trace.nodes[index])!;
    const queue = queueEstimate(link, bytes, extraLoad.get(id));
    metrics.propagation += propagationMs(link);
    // Hubs and repeaters relay bits as they arrive (no store-and-forward).
    if (DEVICE_LAYER[sender.type] !== 1) metrics.transmission += transmissionMs(bytes, link.capacity_mbps);
    metrics.queueing += queue.waitMs;
    metrics.jitter += link.jitter_ms ?? 0;
    success *= (1 - (link.loss_pct ?? 0) / 100) * (1 - queue.dropProbability);
    const available = link.capacity_mbps * (1 - queue.rho);
    if (available < throughput) {
      throughput = available;
      metrics.bottleneckMbps = link.capacity_mbps;
      metrics.bottleneckLink = link.id;
    }
  });
  metrics.total = metrics.propagation + metrics.transmission + metrics.processing + metrics.queueing;
  metrics.loss = 100 * (1 - success);
  metrics.throughputMbps = Number.isFinite(throughput) ? throughput : 0;
  return metrics;
}

// ---------- flows, faults, impact ----------

export type Flow = { src: string; dst: string; protocol: Protocol; app: string };
export type FlowResult = {
  forward: Trace;
  reverse: Trace;
  metrics: PathMetrics;
  rttMs: number;
  reachable: boolean;
};

export function analyzeFlow(
  topology: Topology,
  flow: Flow,
  tables = computeTables(topology, flow.protocol),
): FlowResult {
  const bytes = PACKET_BYTES[flow.app] ?? 1500;
  const there = forward(topology, tables, flow.src, flow.dst, { app: flow.app });
  const back = forward(topology, tables, flow.dst, flow.src, { app: flow.app });
  const metrics = pathMetrics(topology, there, bytes);
  const backMetrics = pathMetrics(topology, back, bytes);
  const reachable = there.delivered && back.delivered;
  return {
    forward: there,
    reverse: back,
    metrics,
    rttMs: reachable ? metrics.total + backMetrics.total : 0,
    reachable,
  };
}

export type FaultKind =
  | "link-down"
  | "link-up"
  | "node-down"
  | "node-up"
  | "congestion"
  | "latency"
  | "packet-loss";
export type Fault = { kind: FaultKind; target: string };

export function applyFault(topology: Topology, fault: Fault): Topology {
  return {
    ...topology,
    nodes: topology.nodes.map((node) =>
      node.id !== fault.target
        ? node
        : fault.kind === "node-down"
          ? { ...node, state: "down" }
          : fault.kind === "node-up"
            ? { ...node, state: "up" }
            : node,
    ),
    links: topology.links.map((link) => {
      if (link.id !== fault.target) return link;
      if (fault.kind === "link-down") return { ...link, state: "down" };
      if (fault.kind === "link-up") return { ...link, state: "up" };
      if (fault.kind === "congestion") return { ...link, state: "degraded", utilisation_pct: 95 };
      if (fault.kind === "latency") return { ...link, state: "degraded", delay_ms: link.delay_ms + 100, length_m: undefined };
      if (fault.kind === "packet-loss") return { ...link, state: "degraded", loss_pct: 30 };
      return link;
    }),
  };
}

export type ReachabilityChange = { node: string; before: boolean; after: boolean };
export type Impact = {
  before: FlowResult;
  after: FlowResult;
  reachability: ReachabilityChange[];
  reachableBefore: number;
  reachableAfter: number;
  changedLinks: string[];
  changedNodes: string[];
  layers: string[];
  routeChanges: { router: string; prefix: string; before: string; after: string }[];
};

export function reachability(topology: Topology, tables: Tables, src: string) {
  return new Map(
    topology.nodes
      .filter((node) => node.id !== src && isL3(node))
      .map((node) => [node.id, forward(topology, tables, src, node.id).delivered] as const),
  );
}

export function compareImpact(before: Topology, after: Topology, flow: Flow, protocolAfter: Protocol = flow.protocol): Impact {
  const tablesBefore = computeTables(before, flow.protocol);
  const tablesAfter = computeTables(after, protocolAfter);
  const beforeResult = analyzeFlow(before, flow, tablesBefore);
  const afterResult = analyzeFlow(after, { ...flow, protocol: protocolAfter }, tablesAfter);
  const reachBefore = reachability(before, tablesBefore, flow.src);
  const reachAfter = reachability(after, tablesAfter, flow.src);
  const changes = [...reachBefore]
    .map(([node, was]) => ({ node, before: was, after: reachAfter.get(node) ?? false }))
    .filter((item) => item.before !== item.after);
  const changedLinks = topologyDiff(before.links, after.links);
  const changedNodes = topologyDiff(before.nodes, after.nodes);
  const routeChanges: Impact["routeChanges"] = [];
  const describe = (route?: Route) => (route ? `${route.nextHop ?? "connected"} (${route.metric})` : "none");
  for (const router of new Set([...tablesBefore.keys(), ...tablesAfter.keys()])) {
    const was = new Map((tablesBefore.get(router) ?? []).map((route) => [route.prefix, route]));
    const now = new Map((tablesAfter.get(router) ?? []).map((route) => [route.prefix, route]));
    for (const prefix of new Set([...was.keys(), ...now.keys()])) {
      const before = describe(was.get(prefix));
      const after = describe(now.get(prefix));
      if (before !== after) routeChanges.push({ router, prefix, before, after });
    }
  }
  const byId = new Map(after.nodes.map((node) => [node.id, node]));
  const touched = [
    ...changedNodes,
    ...after.links.filter((link) => changedLinks.includes(link.id)).flatMap((link) => [link.a.node_id, link.b.node_id]),
  ];
  const layers = ["L1 Physical: carrier lost or signal changed on the failed element"];
  if (touched.some((id) => ["switch", "access-point"].includes(byId.get(id)?.type ?? "")))
    layers.push("L2 Data link: MAC table entries on attached switches are flushed");
  if (routeChanges.length || beforeResult.forward.links.join() !== afterResult.forward.links.join())
    layers.push("L3 Network: routes recalculated, path or next hop changed");
  if (changes.some((item) => !item.after) || !afterResult.reachable)
    layers.push("L4–L7 Transport/Application: sessions to unreachable devices time out");
  return {
    before: beforeResult,
    after: afterResult,
    reachability: changes,
    reachableBefore: [...reachBefore.values()].filter(Boolean).length,
    reachableAfter: [...reachAfter.values()].filter(Boolean).length,
    changedLinks,
    changedNodes,
    layers,
    routeChanges,
  };
}

function topologyDiff<T extends { id: string }>(before: T[], after: T[]) {
  const previous = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  return after.filter((item) => previous.get(item.id) !== JSON.stringify(item)).map((item) => item.id);
}
