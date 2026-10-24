// Discrete-event packet simulator (SIMULATED). Every packet follows the exact
// forward() decision of the shared engine; this module adds the virtual clock:
// processing -> queueing -> transmission -> propagation -> arrival per hop.
import type { Topology } from "../lib/api";
import {
  DEFAULT_QUEUE_PACKETS,
  DEFAULT_TTL,
  DEVICE_LAYER,
  PACKET_BYTES,
  PROCESSING_MS,
  computeTables,
  forward,
  ipOf,
  l3Adjacencies,
  labelOf,
  longestPrefixMatch,
  propagationMs,
  queueEstimate,
  transmissionMs,
  type Protocol,
  type Trace,
} from "./engine.ts";

export type SimEvent = {
  t: number; // virtual ms
  seq: number;
  packet: number;
  kind: "encap" | "arp" | "process" | "learn" | "flood" | "queue" | "transmit" | "arrive" | "deliver" | "drop" | "ttl-exceeded";
  device: string;
  layer: string;
  protocol: string;
  text: string;
};
// One packet crossing one link, for the canvas animation.
export type Transit = { packet: number; link: string; from: string; to: string; start: number; end: number; tone: "request" | "reply" | "icmp" };
export type PacketSummary = {
  id: number;
  kind: "request" | "reply" | "icmp";
  from: string;
  to: string;
  protocol: string;
  sentAt: number;
  deliveredAt?: number;
  droppedAt?: string;
  reason?: string;
  rttMs?: number;
};
export type HopTiming = { packet: number; device: string; link: string; proc: number; queue: number; tx: number; prop: number; bytes: number; mbps: number };
export type SimRun = {
  events: SimEvent[];
  transits: Transit[];
  packets: PacketSummary[];
  hops: HopTiming[];
  macTables: Map<string, Map<string, string>>; // switch -> MAC -> port
  arpCaches: Map<string, Map<string, string>>; // L3 device -> IP -> MAC
  endTime: number;
};
export type RunOptions = {
  protocol: Protocol;
  src: string;
  dst: string;
  app: string;
  count: number;
  intervalMs: number;
  seed: number;
  ttl?: number;
  warmArp?: boolean;
};

const REPLY_APPS = new Set(["ICMP", "TCP", "HTTP", "DNS", "DHCP"]);
const HEADERS: Record<string, string> = {
  ICMP: "ICMP echo request (type 8)",
  TCP: "TCP segment (20 B header)",
  HTTP: "HTTP GET over TCP (port 80)",
  DNS: "DNS query over UDP (port 53)",
  DHCP: "DHCP over UDP (ports 67/68)",
  UDP: "UDP datagram (8 B header)",
  ARP: "ARP (no IP header)",
};

// Seeded PRNG (mulberry32) so a run is reproducible.
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function macOf(id: string) {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const bytes = [hash >>> 24, (hash >>> 16) & 255, (hash >>> 8) & 255, hash & 255];
  return ["02", "4e", ...bytes.map((byte) => byte.toString(16).padStart(2, "0"))].join(":");
}

type Packet = { id: number; kind: PacketSummary["kind"]; origin: string; target: string; app: string; bytes: number; trace: Trace; l3: number; ttl: number; replyTo?: number };

export function simulate(topology: Topology, options: RunOptions): SimRun {
  const rng = random(options.seed);
  const tables = computeTables(topology, options.protocol);
  const adjacency = l3Adjacencies(topology);
  const byId = new Map(topology.nodes.map((node) => [node.id, node]));
  const links = new Map(topology.links.map((link) => [link.id, link]));
  const name = (id: string) => labelOf(byId.get(id));
  const events: SimEvent[] = [];
  const transits: Transit[] = [];
  const packets: PacketSummary[] = [];
  const hops: HopTiming[] = [];
  const macTables = new Map<string, Map<string, string>>();
  const arpCaches = new Map<string, Map<string, string>>();
  const busyUntil = new Map<string, number>();
  const backlog = new Map<string, [number, number][]>(); // directed link -> [start, end] of queued/sending packets
  // ponytail: O(n) min-scan event queue; runs are capped at 50 packets, use a heap if that grows.
  const pending: { t: number; order: number; run: () => void }[] = [];
  let order = 0;
  const schedule = (t: number, run: () => void) => pending.push({ t, order: order++, run });
  const emit = (event: Omit<SimEvent, "seq">) => events.push({ ...event, seq: events.length });
  const portOf = (device: string, linkId: string) => {
    const link = links.get(linkId)!;
    return (link.a.node_id === device ? link.a.interface_id : link.b.interface_id) ?? linkId;
  };
  const otherPorts = (device: string, except: string) =>
    topology.links
      .filter((link) => link.id !== except && link.state !== "down" && (link.a.node_id === device || link.b.node_id === device))
      .map((link) => portOf(device, link.id));

  function learn(device: string, mac: string, port: string, t: number, packet: number, protocol: string) {
    const table = macTables.get(device) ?? new Map<string, string>();
    macTables.set(device, table);
    if (table.get(mac) === port) return;
    table.set(mac, port);
    emit({ t, packet, kind: "learn", device, layer: "L2", protocol, text: `${name(device)} learns ${mac} on port ${port}` });
  }

  // ARP who-has / is-at across one L2 segment; returns the time it adds.
  function resolve(sender: string, target: string, t: number, packet: number): number {
    const cache = arpCaches.get(sender) ?? new Map<string, string>();
    arpCaches.set(sender, cache);
    const ip = ipOf(byId.get(target));
    if (cache.has(ip)) return 0;
    const segment = (adjacency.get(sender) ?? []).find((hop) => hop.neighbour === target);
    if (!segment) return 0;
    let clock = t;
    emit({ t: clock, packet, kind: "arp", device: sender, layer: "L2", protocol: "ARP", text: `${name(sender)} broadcasts ARP who-has ${ip}? tell ${ipOf(byId.get(sender))} (dst MAC ff:ff:ff:ff:ff:ff)` });
    const walk = (nodes: string[], linkIds: string[], from: string, reply: boolean) => {
      linkIds.forEach((linkId, index) => {
        const link = links.get(linkId)!;
        clock += transmissionMs(PACKET_BYTES.ARP, link.capacity_mbps) + propagationMs(link);
        const device = nodes[index + 1];
        const node = byId.get(device)!;
        clock += PROCESSING_MS[node.type] ?? 0.1;
        if (DEVICE_LAYER[node.type] === 2) {
          learn(device, macOf(from), portOf(device, linkId), clock, packet, "ARP");
          if (!reply)
            emit({ t: clock, packet, kind: "flood", device, layer: "L2", protocol: "ARP", text: `${name(device)} floods ARP broadcast to ports ${otherPorts(device, linkId).join(", ") || "none"}` });
        }
        if (DEVICE_LAYER[node.type] === 1)
          emit({ t: clock, packet, kind: "flood", device, layer: "L1", protocol: "ARP", text: `${name(device)} repeats the bits out of every other port (shared collision domain)` });
      });
    };
    walk(segment.nodes, segment.links, sender, false);
    emit({ t: clock, packet, kind: "arp", device: target, layer: "L2", protocol: "ARP", text: `${name(target)} replies ARP is-at ${macOf(target)} (unicast) and caches ${ipOf(byId.get(sender))}` });
    walk([...segment.nodes].reverse(), [...segment.links].reverse(), target, true);
    cache.set(ip, macOf(target));
    const theirs = arpCaches.get(target) ?? new Map<string, string>();
    theirs.set(ipOf(byId.get(sender)), macOf(sender));
    arpCaches.set(target, theirs);
    emit({ t: clock, packet, kind: "arp", device: sender, layer: "L2", protocol: "ARP", text: `${name(sender)} caches ${ip} → ${macOf(target)} (ARP took ${(clock - t).toFixed(3)} ms)` });
    return clock - t;
  }

  function send(kind: Packet["kind"], origin: string, target: string, t: number, ttl = options.ttl ?? DEFAULT_TTL, replyTo?: number) {
    const app = kind === "icmp" ? "ICMP" : options.app;
    const id = packets.length + 1;
    const trace = forward(topology, tables, origin, target, { ttl, app });
    const bytes = kind === "icmp" ? 70 : (PACKET_BYTES[app] ?? 1500);
    packets.push({ id, kind, from: origin, to: target, protocol: app, sentAt: t });
    const header = kind === "icmp" ? "ICMP time exceeded (type 11)" : kind === "reply" ? `${app} reply` : HEADERS[app];
    emit({
      t,
      packet: id,
      kind: "encap",
      device: origin,
      layer: "L7→L1",
      protocol: app,
      text: `${name(origin)} encapsulates packet ${id}: L7 ${app} data → L4 ${header} → L3 IP ${ipOf(byId.get(origin))} → ${ipOf(byId.get(target))} TTL ${ttl} → L2 Ethernet src ${macOf(origin)} → L1 ${bytes * 8} bits (${bytes} B)`,
    });
    schedule(t, () => hop({ id, kind, origin, target, app, bytes, trace, l3: 0, ttl, replyTo }, 0, t));
  }

  function finish(packet: Packet, t: number, reason: string, device: string, layer = "L3") {
    const summary = packets[packet.id - 1];
    summary.droppedAt = device;
    summary.reason = reason;
    emit({ t, packet: packet.id, kind: "drop", device, layer, protocol: packet.app, text: `${name(device)} drops packet ${packet.id}: ${reason}` });
  }

  function hop(packet: Packet, index: number, t: number) {
    const { trace } = packet;
    const device = trace.nodes[index];
    const node = byId.get(device)!;
    const layer = DEVICE_LAYER[node.type] ?? 3;
    const last = index === trace.nodes.length - 1;
    const previousL3 = trace.l3Hops[packet.l3];
    if (index > 0) {
      const inLink = trace.links[index - 1];
      const port = portOf(device, inLink);
      if (layer >= 3) packet.l3 += 1;
      const nextL3 = trace.l3Hops[packet.l3 + 1] ?? packet.target;
      if (layer === 1) {
        emit({ t, packet: packet.id, kind: "flood", device, layer: "L1", protocol: packet.app, text: `${name(device)} ${node.type === "hub" ? `repeats bits to ports ${otherPorts(device, inLink).join(", ")} (one shared collision domain)` : "regenerates the signal and passes it on"}` });
      } else if (layer === 2) {
        const table = macTables.get(device);
        const srcMac = macOf(previousL3);
        const dstMac = macOf(nextL3);
        learn(device, srcMac, port, t, packet.id, packet.app);
        const out = table?.get(dstMac);
        emit(
          out
            ? { t, packet: packet.id, kind: "process", device, layer: "L2", protocol: packet.app, text: `${name(device)} MAC table hit: ${dstMac} → port ${out}; forwards frame` }
            : { t, packet: packet.id, kind: "flood", device, layer: "L2", protocol: packet.app, text: `${name(device)} floods frame to ports ${otherPorts(device, inLink).join(", ")} (unknown dst MAC ${dstMac})` },
        );
      } else {
        emit({ t, packet: packet.id, kind: "arrive", device, layer: layer === 3 ? "L1→L3" : "L1→L7", protocol: packet.app, text: `${name(device)} receives frame on ${port}, strips L2 header` });
      }
    }
    const summary = packets[packet.id - 1];
    if (last && trace.delivered) {
      const done = t + (PROCESSING_MS[node.type] ?? 0.1);
      summary.deliveredAt = done;
      emit({ t: done, packet: packet.id, kind: "deliver", device, layer: "L1→L7", protocol: packet.app, text: `${name(device)} de-encapsulates L1→L2→L3→L4 and delivers ${packet.app} to the application (one-way ${(done - summary.sentAt).toFixed(3)} ms)` });
      if (packet.kind === "request" && REPLY_APPS.has(packet.app)) send("reply", device, packet.origin, done, DEFAULT_TTL, packet.id);
      if (packet.replyTo) packets[packet.replyTo - 1].rttMs = done - packets[packet.replyTo - 1].sentAt;
      return;
    }
    if (last) {
      if (trace.ttlExpiredAt === device) {
        summary.droppedAt = device;
        summary.reason = "TTL expired";
        emit({ t, packet: packet.id, kind: "ttl-exceeded", device, layer: "L3", protocol: packet.app, text: `${name(device)} decrements TTL to 0, drops packet ${packet.id} and returns ICMP Time Exceeded to ${name(packet.origin)}` });
        send("icmp", device, packet.origin, t + (PROCESSING_MS[node.type] ?? 0.5), DEFAULT_TTL);
      } else finish(packet, t, trace.reason, device);
      return;
    }
    const proc = PROCESSING_MS[node.type] ?? 0.1;
    let ready = t + proc;
    if (layer >= 3 && index > 0) {
      const route = longestPrefixMatch(tables.get(device) ?? [], ipOf(byId.get(packet.target)));
      const next = trace.l3Hops[packet.l3 + 1];
      emit({
        t: ready,
        packet: packet.id,
        kind: "process",
        device,
        layer: "L3",
        protocol: packet.app,
        text: `${name(device)} longest-prefix match ${ipOf(byId.get(packet.target))} → ${route?.prefix ?? "?"} via ${name(next)} (${route?.code ?? "?"}, metric ${route?.metric ?? "?"}); TTL ${packet.ttl}→${packet.ttl - 1}; new L2 header ${macOf(device)} → ${macOf(next)}`,
      });
      packet.ttl -= 1;
    }
    if (layer >= 3) {
      const next = trace.l3Hops[packet.l3 + 1];
      if (next && !options.warmArp) ready += resolve(device, next, ready, packet.id);
      else if (next) arpCaches.set(device, (arpCaches.get(device) ?? new Map()).set(ipOf(byId.get(next)), macOf(next)));
    }
    const link = links.get(trace.links[index])!;
    const to = trace.nodes[index + 1];
    const key = `${link.id}>${to}`;
    const queue = (backlog.get(key) ?? []).filter(([, end]) => end > ready);
    const waiting = queue.filter(([begin]) => begin > ready).length;
    const capacity = link.queue_packets ?? DEFAULT_QUEUE_PACKETS;
    if (waiting >= capacity) return finish(packet, ready, `queue full on ${link.id} (${waiting}/${capacity} packets waiting, tail drop)`, device, "L2");
    const background = queueEstimate(link, packet.bytes);
    if (background.dropProbability > 0 && rng() < background.dropProbability)
      return finish(packet, ready, `queue full on ${link.id} under ${(background.rho * 100).toFixed(0)}% background load (tail drop)`, device, "L2");
    const start = Math.max(ready, busyUntil.get(key) ?? 0) + background.waitMs;
    // Hubs and repeaters relay bits as they arrive: no store-and-forward serialisation.
    const tx = layer === 1 ? 0 : transmissionMs(packet.bytes, link.capacity_mbps);
    const prop = propagationMs(link) + (link.jitter_ms ? rng() * link.jitter_ms : 0);
    busyUntil.set(key, start + tx);
    backlog.set(key, [...queue, [start, start + tx]]);
    hops.push({ packet: packet.id, device, link: link.id, proc, queue: start - ready, tx, prop, bytes: packet.bytes, mbps: link.capacity_mbps });
    if (start > ready + 1e-9)
      emit({ t: ready, packet: packet.id, kind: "queue", device, layer: "L2", protocol: packet.app, text: `${name(device)} queues packet ${packet.id} on ${portOf(device, link.id)} for ${(start - ready).toFixed(4)} ms (${waiting} waiting ahead, background ρ=${background.rho.toFixed(2)})` });
    emit({ t: start, packet: packet.id, kind: "transmit", device, layer: "L1", protocol: packet.app, text: `${name(device)} transmits ${packet.bytes} B on ${link.id}: t_tx = ${packet.bytes * 8} bits / ${link.capacity_mbps} Mbps = ${tx.toFixed(4)} ms, t_prop = ${prop.toFixed(4)} ms` });
    const arrival = start + tx + prop;
    transits.push({ packet: packet.id, link: link.id, from: device, to, start, end: arrival, tone: packet.kind === "reply" ? "reply" : packet.kind === "icmp" ? "icmp" : "request" });
    if (rng() < (link.loss_pct ?? 0) / 100) {
      schedule(arrival, () => finish(packet, arrival, `lost on ${link.id} (${link.loss_pct}% loss: bit errors / interference)`, to, "L1"));
      return;
    }
    schedule(arrival, () => hop(packet, index + 1, arrival));
  }

  const count = Math.min(50, Math.max(1, options.count));
  for (let index = 0; index < count; index += 1) {
    const t = index * options.intervalMs;
    if (options.app === "ARP") {
      const route = forward(topology, tables, options.src, options.dst);
      const neighbour = route.l3Hops[1] ?? options.dst;
      packets.push({ id: index + 1, kind: "request", from: options.src, to: neighbour, protocol: "ARP", sentAt: t });
      arpCaches.get(options.src)?.clear();
      const spent = resolve(options.src, neighbour, t, index + 1);
      packets[index].deliveredAt = t + spent;
      packets[index].rttMs = spent;
    } else schedule(t, () => send("request", options.src, options.dst, t));
  }
  while (pending.length) {
    let next = 0;
    for (let index = 1; index < pending.length; index += 1)
      if (pending[index].t < pending[next].t || (pending[index].t === pending[next].t && pending[index].order < pending[next].order)) next = index;
    pending.splice(next, 1)[0].run();
  }
  events.sort((a, b) => a.t - b.t || a.seq - b.seq);
  return {
    events,
    transits,
    packets,
    hops,
    macTables,
    arpCaches,
    endTime: Math.max(0, ...events.map((event) => event.t), ...transits.map((item) => item.end)),
  };
}

export function toCsv(events: SimEvent[]) {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return ["t_ms,packet,device,layer,protocol,kind,text", ...events.map((event) => [event.t.toFixed(4), event.packet, event.device, event.layer, event.protocol, event.kind, event.text].map(quote).join(","))].join("\n");
}
