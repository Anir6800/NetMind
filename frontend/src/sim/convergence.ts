// Routing convergence after a change (SIMULATED educational timers).
// RIP is simulated as a distance-vector protocol and OSPF as link-state
// flooding + SPF, each router with its own view; the converged result equals
// computeTables() on the new topology.
import type { Topology } from "../lib/api";
import { random } from "./des.ts";
import {
  DEFAULT_TTL,
  RIP_INFINITY,
  computeTables,
  forward,
  isL3,
  l3Adjacencies,
  labelOf,
  ospfCost,
  pathMetrics,
  prefixOwners,
  propagationMs,
  routesFrom,
  shortestFrom,
  transmissionMs,
  type Adjacency,
  type Protocol,
  type Route,
  type Tables,
} from "./engine.ts";

export const RIP_TIMERS = { update: 30_000, invalid: 180_000, flush: 240_000, triggeredMin: 1_000, triggeredMax: 5_000 };
export const OSPF_TIMERS = { hello: 10_000, dead: 40_000, spfDelay: 200, lsaProcessing: 1 };

export type ConvergenceStep = { t: number; router: string; kind: string; text: string };
export type TableChange = { t: number; router: string; prefix: string; before: string; after: string };
export type ConvergenceOptions = {
  protocol: Protocol;
  seed?: number;
  splitHorizon?: boolean; // RIP split horizon with poison reverse (default on)
  triggeredUpdates?: boolean; // RIP triggered updates (default on)
  flow?: { src: string; dst: string };
  pps?: number; // flow rate used to count packets lost during convergence
  horizonMs?: number;
};
export type ConvergenceResult = {
  protocol: Protocol;
  detectionMs: number | null;
  convergedMs: number | null;
  steps: ConvergenceStep[];
  changes: TableChange[];
  outageMs: number | null; // null = still broken at the end
  packetsLost: number | null;
  reachableAtEnd: boolean;
  countToInfinity: boolean;
  finalTables: Tables;
};

type Detection = { t: number; router: string; kind: "lost" | "gained" | "prefix-down" | "prefix-up"; peer: string; how: string };
type Entry = { metric: number; nh: string | null };
type Vector = Map<string, Entry>;

const describe = (entry?: Entry) =>
  !entry ? "none" : entry.metric >= RIP_INFINITY ? "unreachable (16)" : `${entry.nh ?? "connected"} (${entry.metric})`;

function detections(before: Topology, after: Topology, protocol: Protocol, rng: () => number): Detection[] {
  const adjB = l3Adjacencies(before);
  const adjA = l3Adjacencies(after);
  const ownersB = prefixOwners(before);
  const ownersA = prefixOwners(after);
  const linksA = new Map(after.links.map((link) => [link.id, link]));
  const upA = new Set(after.nodes.filter((node) => node.state !== "down").map((node) => node.id));
  const result: Detection[] = [];
  const has = (adj: Map<string, Adjacency[]>, a: string, b: string) => (adj.get(a) ?? []).some((hop) => hop.neighbour === b);
  for (const node of after.nodes) {
    if (!isL3(node) || !upA.has(node.id)) continue;
    const r = node.id;
    for (const hop of adjB.get(r) ?? []) {
      if (has(adjA, r, hop.neighbour)) continue;
      const first = linksA.get(hop.links[0]);
      const far = first && (first.a.node_id === r ? first.b.node_id : first.a.node_id);
      const carrier = !first || first.state === "down" || !upA.has(far!);
      const timer = protocol === "rip" ? RIP_TIMERS.invalid - rng() * RIP_TIMERS.update : OSPF_TIMERS.dead - rng() * OSPF_TIMERS.hello;
      result.push({
        t: carrier ? 0 : timer,
        router: r,
        kind: "lost",
        peer: hop.neighbour,
        how: carrier ? `carrier loss on ${first?.id ?? "its interface"}` : protocol === "rip" ? "invalid timer (no update for 180 s)" : "dead interval (no hello for 40 s)",
      });
    }
    for (const hop of adjA.get(r) ?? []) {
      if (has(adjB, r, hop.neighbour)) continue;
      const t = protocol === "rip" ? 0 : rng() * OSPF_TIMERS.hello;
      result.push({ t, router: r, kind: "gained", peer: hop.neighbour, how: protocol === "rip" ? "interface up: RIP request sent" : "hello received, adjacency FULL" });
    }
    const mine = (owners: Map<string, string[]>) => new Set([...owners].filter(([, ids]) => ids.includes(r)).map(([prefix]) => prefix));
    const had = mine(ownersB);
    const has2 = mine(ownersA);
    for (const prefix of had) if (!has2.has(prefix)) result.push({ t: 0, router: r, kind: "prefix-down", peer: prefix, how: "interface down: connected route withdrawn" });
    for (const prefix of has2) if (!had.has(prefix)) result.push({ t: 0, router: r, kind: "prefix-up", peer: prefix, how: "interface up: connected route added" });
  }
  return result.sort((a, b) => a.t - b.t);
}

function segmentDelay(after: Topology, adjacency: Adjacency | undefined) {
  const links = new Map(after.links.map((link) => [link.id, link]));
  return (adjacency?.links ?? []).reduce((sum, id) => sum + transmissionMs(512, links.get(id)!.capacity_mbps) + propagationMs(links.get(id)!), 0.5);
}

function toTables(state: Map<string, Vector>, after: Topology, code: Route["code"]): Tables {
  const adjacency = l3Adjacencies(after);
  const tables: Tables = new Map();
  for (const [router, vector] of state)
    tables.set(
      router,
      [...vector].map(([prefix, entry]) => ({
        prefix,
        dest: entry.nh ?? router,
        nextHop: entry.nh,
        iface: (adjacency.get(router) ?? []).find((hop) => hop.neighbour === entry.nh)?.links[0] ?? "-",
        metric: entry.metric,
        code: entry.nh === null ? "C" : code,
      })),
    );
  return tables;
}

export function converge(before: Topology, after: Topology, options: ConvergenceOptions): ConvergenceResult {
  const { protocol } = options;
  const rng = random(options.seed ?? 1);
  const byId = new Map(after.nodes.map((node) => [node.id, node]));
  const name = (id: string) => labelOf(byId.get(id));
  const adjA = l3Adjacencies(after);
  const adjB = l3Adjacencies(before);
  const upA = new Set(after.nodes.filter((node) => node.state !== "down").map((node) => node.id));
  const steps: ConvergenceStep[] = [];
  const changes: TableChange[] = [];
  const found = detections(before, after, protocol, rng);
  for (const item of found)
    steps.push({ t: item.t, router: item.router, kind: "detect", text: `${name(item.router)} detects ${item.kind === "lost" ? `loss of neighbour ${name(item.peer)}` : item.kind === "gained" ? `new neighbour ${name(item.peer)}` : `${item.peer} ${item.kind === "prefix-down" ? "down" : "up"}`} — ${item.how}` });

  // Event queue (min-scan; a run has at most a few thousand events).
  const pending: { t: number; order: number; run: () => void }[] = [];
  let order = 0;
  const at = (t: number, run: () => void) => pending.push({ t, order: order++, run });
  const horizon = options.horizonMs ?? 1_200_000;
  let lastChange = 0;
  const lastDetection = Math.max(0, ...found.map((item) => item.t));
  const increases = new Map<string, number>();
  let countToInfinity = false;
  const state = new Map<string, Vector>();
  const applied: { t: number; router: string; prefix: string; entry?: Entry }[] = [];
  const record = (t: number, router: string, prefix: string, was: Entry | undefined, now: Entry | undefined, flush = false) => {
    if (describe(was) === describe(now)) return;
    changes.push({ t, router, prefix, before: describe(was), after: describe(now) });
    applied.push({ t, router, prefix, entry: now });
    steps.push({ t, router, kind: "route", text: `${name(router)} ${prefix}: ${describe(was)} → ${describe(now)}` });
    if (!flush) lastChange = Math.max(lastChange, t);
    if (was && now && now.metric > was.metric && now.metric < RIP_INFINITY && was.metric < RIP_INFINITY) {
      const key = `${router}|${prefix}`;
      increases.set(key, (increases.get(key) ?? 0) + 1);
      if (increases.get(key)! >= 3) countToInfinity = true;
    }
  };
  const initial = computeTables(before, protocol);
  for (const node of after.nodes)
    if (isL3(node) && upA.has(node.id))
      state.set(node.id, new Map((initial.get(node.id) ?? []).map((route) => [route.prefix, { metric: route.metric, nh: route.nextHop }])));
  const neighbours = new Map([...state.keys()].map((id) => [id, new Set((adjB.get(id) ?? []).map((hop) => hop.neighbour))]));

  if (protocol === "rip") {
    const splitHorizon = options.splitHorizon ?? true;
    const triggered = options.triggeredUpdates ?? true;
    const scheduled = new Set<string>();
    const send = (from: string, to: string, t: number, why: string) => {
      const hop = (adjA.get(from) ?? []).find((item) => item.neighbour === to);
      if (!hop || !state.has(to)) return; // update lost: no physical path any more
      const vector: [string, number][] = [];
      for (const [prefix, entry] of state.get(from)!) {
        if (entry.nh === to && splitHorizon) vector.push([prefix, RIP_INFINITY]); // poison reverse
        else vector.push([prefix, entry.metric]);
      }
      at(t + segmentDelay(after, hop), () => receive(to, from, vector, t + segmentDelay(after, hop), why));
    };
    const broadcast = (router: string, t: number, why: string) => {
      for (const peer of neighbours.get(router) ?? []) send(router, peer, t, why);
    };
    const trigger = (router: string, t: number) => {
      if (!triggered || scheduled.has(router)) return;
      scheduled.add(router);
      const when = t + RIP_TIMERS.triggeredMin + rng() * (RIP_TIMERS.triggeredMax - RIP_TIMERS.triggeredMin);
      at(when, () => {
        scheduled.delete(router);
        steps.push({ t: when, router, kind: "update", text: `${name(router)} sends a triggered update to ${[...(neighbours.get(router) ?? [])].map(name).join(", ") || "nobody"}` });
        broadcast(router, when, "triggered");
      });
    };
    const flush = (router: string, prefix: string, t: number) =>
      at(t + RIP_TIMERS.flush - RIP_TIMERS.invalid, () => {
        const entry = state.get(router)?.get(prefix);
        if (entry && entry.metric >= RIP_INFINITY) {
          state.get(router)!.delete(prefix);
          record(t + RIP_TIMERS.flush - RIP_TIMERS.invalid, router, prefix, entry, undefined, true);
        }
      });
    const receive = (router: string, from: string, vector: [string, number][], t: number, why: string) => {
      if (!(neighbours.get(router) ?? new Set()).has(from)) return;
      const table = state.get(router)!;
      let changed = false;
      for (const [prefix, metric] of vector) {
        const next = Math.min(RIP_INFINITY, metric + 1);
        const current = table.get(prefix);
        if (current?.nh === null) continue;
        if ((current && current.nh === from && current.metric !== next) || (next < (current?.metric ?? RIP_INFINITY) && current?.nh !== from)) {
          const entry = { metric: next, nh: from };
          table.set(prefix, entry);
          record(t, router, prefix, current, entry);
          if (next >= RIP_INFINITY) flush(router, prefix, t);
          changed = true;
        }
      }
      if (changed) {
        steps.push({ t, router, kind: "receive", text: `${name(router)} accepts ${why} update from ${name(from)} (Bellman-Ford: metric = advertised + 1)` });
        trigger(router, t);
      }
    };
    for (const item of found)
      at(item.t, () => {
        const table = state.get(item.router)!;
        if (item.kind === "lost") {
          neighbours.get(item.router)!.delete(item.peer);
          for (const [prefix, entry] of table)
            if (entry.nh === item.peer && entry.metric < RIP_INFINITY) {
              const poisoned = { metric: RIP_INFINITY, nh: entry.nh };
              table.set(prefix, poisoned);
              record(item.t, item.router, prefix, entry, poisoned);
              flush(item.router, prefix, item.t);
            }
          trigger(item.router, item.t);
        } else if (item.kind === "gained") {
          neighbours.get(item.router)!.add(item.peer);
          send(item.router, item.peer, item.t, "request-response");
        } else if (item.kind === "prefix-down") {
          const entry = table.get(item.peer);
          const poisoned = { metric: RIP_INFINITY, nh: "-" }; // withdrawn; may be re-learned from a neighbour
          table.set(item.peer, poisoned);
          record(item.t, item.router, item.peer, entry, poisoned);
          flush(item.router, item.peer, item.t);
          trigger(item.router, item.t);
        } else {
          const entry = table.get(item.peer);
          const connected: Entry = { metric: 0, nh: null };
          table.set(item.peer, connected);
          record(item.t, item.router, item.peer, entry, connected);
          trigger(item.router, item.t);
        }
      });
    for (const router of state.keys()) {
      const phase = rng() * RIP_TIMERS.update;
      const periodic = (t: number) => {
        broadcast(router, t, "periodic");
        if (t + RIP_TIMERS.update <= horizon) at(t + RIP_TIMERS.update, () => periodic(t + RIP_TIMERS.update));
      };
      at(phase, () => periodic(phase));
    }
  }

  if (protocol === "ospf") {
    type Lsa = { origin: string; seq: number; links: Map<string, number>; prefixes: Set<string> };
    const linksA = new Map(after.links.map((link) => [link.id, link]));
    const ownLsa = (topology: Topology, router: string, seq: number): Lsa => {
      const owners = prefixOwners(topology);
      const adjacency = l3Adjacencies(topology).get(router) ?? [];
      return {
        origin: router,
        seq,
        links: new Map(adjacency.map((hop) => [hop.neighbour, ospfCost(linksA.get(hop.links[0])!)])),
        prefixes: new Set([...owners].filter(([, ids]) => ids.includes(router)).map(([prefix]) => prefix)),
      };
    };
    const lsdb = new Map<string, Map<string, Lsa>>();
    const fullBefore = new Map([...state.keys()].filter((id) => adjB.has(id)).map((id) => [id, ownLsa(before, id, 1)] as const));
    for (const router of state.keys()) lsdb.set(router, adjB.has(router) ? new Map(fullBefore) : new Map([[router, ownLsa(after, router, 1)]]));
    const spfPending = new Set<string>();
    const spf = (router: string, t: number) => {
      const db = lsdb.get(router)!;
      // Two-way check: use a link only if both ends list each other.
      const view = new Map<string, Adjacency[]>();
      const cost = new Map<string, number>();
      for (const [origin, lsa] of db)
        for (const [peer, value] of lsa.links)
          if (db.get(peer)?.links.has(origin)) {
            const hop = (adjA.get(origin) ?? []).find((item) => item.neighbour === peer) ?? (adjB.get(origin) ?? []).find((item) => item.neighbour === peer);
            if (!hop) continue;
            view.set(origin, [...(view.get(origin) ?? []), hop]);
            cost.set(`${origin}>${peer}`, value);
          }
      const owners = new Map<string, string[]>();
      for (const [origin, lsa] of db) for (const prefix of lsa.prefixes) owners.set(prefix, [...(owners.get(prefix) ?? []), origin]);
      const routes = routesFrom(byId.get(router)!, shortestFrom(router, view, (hop) => cost.get(`${hop.nodes[0]}>${hop.neighbour}`) ?? 1, after), owners, after, "ospf");
      const table = state.get(router)!;
      const next = new Map(routes.map((route) => [route.prefix, { metric: route.metric, nh: route.nextHop }]));
      let count = 0;
      for (const prefix of new Set([...table.keys(), ...next.keys()])) {
        const was = table.get(prefix);
        const now = next.get(prefix);
        if (describe(was) !== describe(now)) {
          record(t, router, prefix, was, now);
          count += 1;
        }
      }
      state.set(router, next);
      steps.push({ t, router, kind: "spf", text: `${name(router)} runs SPF (Dijkstra, cost = 1000 Mbps / bandwidth): ${count} route${count === 1 ? "" : "s"} changed` });
    };
    const scheduleSpf = (router: string, t: number) => {
      if (spfPending.has(router)) return;
      spfPending.add(router);
      at(t + OSPF_TIMERS.spfDelay, () => {
        spfPending.delete(router);
        spf(router, t + OSPF_TIMERS.spfDelay);
      });
    };
    const flood = (from: string, to: string, lsa: Lsa, t: number) => {
      const hop = (adjA.get(from) ?? []).find((item) => item.neighbour === to);
      if (!hop || !state.has(to)) return;
      const arrival = t + segmentDelay(after, hop) + OSPF_TIMERS.lsaProcessing;
      at(arrival, () => {
        const db = lsdb.get(to)!;
        if ((db.get(lsa.origin)?.seq ?? 0) >= lsa.seq) return;
        db.set(lsa.origin, lsa);
        steps.push({ t: arrival, router: to, kind: "lsa", text: `${name(to)} installs Router-LSA from ${name(lsa.origin)} (seq ${lsa.seq}) received via ${name(from)} and refloods it` });
        for (const peer of neighbours.get(to) ?? []) if (peer !== from) flood(to, peer, lsa, arrival);
        scheduleSpf(to, arrival);
      });
    };
    const originate = (router: string, t: number) => {
      const db = lsdb.get(router)!;
      const seq = (db.get(router)?.seq ?? 0) + 1;
      const lsa = { ...ownLsa(after, router, seq), links: new Map([...ownLsa(after, router, seq).links].filter(([peer]) => neighbours.get(router)!.has(peer))) };
      db.set(router, lsa);
      steps.push({ t, router, kind: "lsa", text: `${name(router)} originates Router-LSA seq ${seq} (${lsa.links.size} neighbours, ${lsa.prefixes.size} prefixes) and floods it` });
      for (const peer of neighbours.get(router)!) flood(router, peer, lsa, t);
      scheduleSpf(router, t);
    };
    const originating = new Set<string>();
    for (const item of found)
      at(item.t, () => {
        if (item.kind === "lost") neighbours.get(item.router)!.delete(item.peer);
        if (item.kind === "gained") {
          neighbours.get(item.router)!.add(item.peer);
          // Database exchange: copy any newer LSAs the new neighbour holds.
          const mine = lsdb.get(item.router)!;
          for (const [origin, lsa] of lsdb.get(item.peer) ?? []) if ((mine.get(origin)?.seq ?? 0) < lsa.seq) mine.set(origin, lsa);
        }
        // Several changes seen at the same instant produce one new LSA.
        const key = `${item.router}@${item.t}`;
        if (originating.has(key)) return;
        originating.add(key);
        at(item.t, () => originate(item.router, item.t));
      });
  }

  while (pending.length) {
    let index = 0;
    for (let other = 1; other < pending.length; other += 1)
      if (pending[other].t < pending[index].t || (pending[other].t === pending[index].t && pending[other].order < pending[index].order)) index = other;
    const next = pending.splice(index, 1)[0];
    if (next.t > horizon) break;
    if (protocol === "rip" && next.t > Math.max(lastChange, lastDetection) + 2 * RIP_TIMERS.update + (RIP_TIMERS.flush - RIP_TIMERS.invalid)) break;
    next.run();
  }
  steps.sort((a, b) => a.t - b.t);

  const code = protocol === "rip" ? "R" : protocol === "ospf" ? "O" : "S";
  const finalTables = protocol === "static" ? computeTables(after, "static") : toTables(state, after, code);
  // Outage for the student's flow: replay the table changes in time order.
  let outageMs: number | null = null;
  let reachableAtEnd = true;
  if (options.flow) {
    const replay = new Map([...state.keys()].map((id) => [id, new Map((initial.get(id) ?? []).map((route) => [route.prefix, { metric: route.metric, nh: route.nextHop }]))]));
    const times = [0, ...new Set(applied.map((change) => change.t))].sort((a, b) => a - b);
    const ok = () => forward(after, protocol === "static" ? computeTables(after, "static") : toTables(replay, after, code), options.flow!.src, options.flow!.dst).delivered;
    let down = 0;
    let previous = 0;
    let wasOk = true;
    for (const t of times) {
      if (!wasOk) down += t - previous;
      for (const change of applied.filter((item) => item.t === t)) {
        if (change.entry) replay.get(change.router)!.set(change.prefix, change.entry);
        else replay.get(change.router)!.delete(change.prefix);
      }
      wasOk = ok();
      previous = t;
    }
    reachableAtEnd = wasOk;
    outageMs = wasOk ? down : null;
  }
  const pps = options.pps ?? 100;
  return {
    protocol,
    detectionMs: found.length ? Math.min(...found.map((item) => item.t)) : null,
    convergedMs: protocol === "static" ? null : lastChange,
    steps,
    changes,
    outageMs,
    packetsLost: outageMs === null ? null : Math.round((outageMs / 1000) * pps),
    reachableAtEnd,
    countToInfinity,
    finalTables,
  };
}

export type TracerouteHop = { ttl: number; device: string | null; rttMs: number | null; reply: string };

// Traceroute: probes with TTL 1, 2, 3 ... each router where TTL hits zero
// answers with ICMP Time Exceeded; the destination answers the last probe.
export function traceroute(topology: Topology, protocol: Protocol, src: string, dst: string, maxHops = 30): TracerouteHop[] {
  const tables = computeTables(topology, protocol);
  const hops: TracerouteHop[] = [];
  for (let ttl = 1; ttl <= Math.min(maxHops, DEFAULT_TTL); ttl += 1) {
    const probe = forward(topology, tables, src, dst, { ttl, app: "UDP" });
    const replier = probe.delivered ? dst : probe.ttlExpiredAt;
    if (!replier) {
      hops.push({ ttl, device: null, rttMs: null, reply: `* * * (${probe.reason})` });
      break;
    }
    const back = forward(topology, tables, replier, src, { app: "ICMP" });
    const there = pathMetrics(topology, { ...probe, delivered: true }, 60).total;
    const rtt = back.delivered ? there + pathMetrics(topology, back, 70).total : null;
    hops.push({ ttl, device: replier, rttMs: rtt, reply: probe.delivered ? "destination reached (ICMP port unreachable)" : "ICMP Time Exceeded" });
    if (probe.delivered) break;
  }
  return hops;
}
