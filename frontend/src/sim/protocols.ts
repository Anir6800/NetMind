// Protocol message ladders (SIMULATED, textbook-simplified). Every message's
// fate and timing come from the shared engine: forward() decides delivery and
// pathMetrics().total gives the one-way delay. Only timers and state machines
// live here.
import type { Topology } from "../lib/api";
import { macOf, random } from "./des.ts";
import { PACKET_BYTES, applyFault, computeTables, forward, ipOf, networkOf, pathMetrics, toInt, toIp, type Fault, type Protocol } from "./engine.ts";

export type ScenarioKind = "icmp" | "arp" | "dhcp" | "dns" | "tcp" | "udp" | "http";
export type LadderMessage = { from: string; to: string; label: string; sendAt: number; arriveAt: number | null; lost: boolean; layer: string; note?: string };
export type Ladder = { kind: ScenarioKind; participants: string[]; messages: LadderMessage[]; outcome: string; ok: boolean; simplifications: string[] };

const MSS = 1460;
const CTRL_BYTES = 60; // SYN, ACK, FIN
const DATA_BYTES = 1500;
const GET_BYTES = 400;
const MAX_RETX = 3;
const RTO_MS = 1000;

const COMMON = [
  "Message delay = engine one-way delay (forward + pathMetrics) at the moment it is sent",
  "A message is lost only when forward() cannot deliver it or a lossy link drops it (seeded)",
];
const TCP_NOTES = [
  "Slow start only: cwnd doubles each RTT, no congestion-avoidance phase or ssthresh",
  "No fast retransmit or SACK; receiver discards out-of-order segments (go-back-N)",
  `Fixed initial RTO ${RTO_MS} ms doubling per timeout, no RTT estimation; give up after ${MAX_RETX} retransmissions`,
  "No receive window, no Nagle, no delayed ACKs; segments in a window leave together",
  "Relative sequence numbers (ISN 0), MSS 1460 B",
  "A lost final handshake ACK is implied by the first data segment",
  "ok is false when the FIN/ACK teardown does not complete",
];
const SIMPLIFICATIONS: Record<ScenarioKind, string[]> = {
  icmp: ["One echo per second, 2000 ms reply timeout"],
  arp: ["ARP request travels the L2 segment to the next L3 hop; 3 tries 1000 ms apart", "Cache lifetime fixed at 300 s"],
  dhcp: ["dst is assumed to run the DHCP server; a relay agent is implied when it is on another subnet", "Discover retransmitted after 4000 ms then 8000 ms (no jitter); lease 86400 s"],
  dns: ["dst is assumed to be the resolver and authoritative for lab.example; no recursion", "Retry after 2000 ms, twice; TTL 300 s"],
  tcp: TCP_NOTES,
  udp: ["Datagrams 100 ms apart, no ACK and no retransmission"],
  http: ["HTTP/1.1 GET with one response, no keep-alive", ...TCP_NOTES],
};


// Lowest host address in the server's first subnet that nothing in the topology uses.
function freeAddress(topology: Topology, server: string) {
  const cidr = topology.nodes.find((node) => node.id === server)?.interfaces[0]?.address ?? "10.0.0.1/24";
  const [net, bits] = networkOf(cidr).split("/");
  const used = new Set(topology.nodes.flatMap((node) => node.interfaces.map((item) => item.address.split("/")[0])));
  for (let host = 1; host < 2 ** (32 - Number(bits)) - 1; host++) {
    const candidate = toIp(toInt(net) + host);
    if (!used.has(candidate)) return `${candidate}/${bits}`;
  }
  return null;
}

export function scenario(
  topology: Topology,
  options: { kind: ScenarioKind; protocol: Protocol; src: string; dst: string; seed?: number; count?: number; segments?: number; fault?: Fault; faultAtMs?: number },
): Ladder {
  const { kind, protocol, src, dst, fault } = options;
  const faultAt = options.faultAtMs ?? 0;
  const views = [topology, fault ? applyFault(topology, fault) : topology].map((item) => ({ topology: item, tables: computeTables(item, protocol) }));
  const rng = random(options.seed ?? 1);
  const app = kind.toUpperCase();
  const messages: LadderMessage[] = [];
  const participants = [src, dst];
  const ip = (id: string) => ipOf(topology.nodes.find((node) => node.id === id));

  const send = (from: string, to: string, label: string, bytes: number, sendAt: number, layer: string, note?: string) => {
    const view = views[fault && sendAt >= faultAt ? 1 : 0];
    const trace = forward(view.topology, view.tables, from, to, { app });
    const metrics = pathMetrics(view.topology, trace, bytes);
    const lost = !trace.delivered || (metrics.loss > 0 && rng() * 100 < metrics.loss);
    const why = lost ? (trace.delivered ? "dropped on a lossy link" : trace.reason) : note;
    const message: LadderMessage = { from, to, label, sendAt, arriveAt: lost ? null : sendAt + metrics.total, lost, layer, ...(why ? { note: why } : {}) };
    messages.push(message);
    return message;
  };
  const local = (at: string, label: string, sendAt: number, layer: string) =>
    messages.push({ from: at, to: at, label, sendAt, arriveAt: sendAt, lost: false, layer });
  // Request/response chain; returns the final arrival time or null if any step is lost.
  const chain = (steps: [string, string, string, number][], at: number, layer: string) => {
    for (const [from, to, label, bytes] of steps) {
      const message = send(from, to, label, bytes, at, layer);
      if (message.arriveAt == null) return null;
      at = message.arriveAt;
    }
    return at;
  };
  const done = (outcome: string, ok: boolean): Ladder => ({
    kind,
    participants,
    messages,
    outcome,
    ok,
    simplifications: [...COMMON, ...SIMPLIFICATIONS[kind]],
  });

  // TCP: three-way handshake with SYN retransmission. Returns when the client may send.
  const handshake = (at: number) => {
    for (let tries = 0, rto = RTO_MS; tries <= 2; tries++, at += rto, rto *= 2) {
      const end = chain([[src, dst, tries ? "SYN (retransmit)" : "SYN", CTRL_BYTES], [dst, src, "SYN-ACK", CTRL_BYTES]], at, "L4 TCP");
      if (end != null) {
        send(src, dst, "ACK", CTRL_BYTES, end, "L4 TCP");
        return end;
      }
    }
    local(src, "Connection timed out", at, "L4 TCP");
    return null;
  };
  // Slow-start transfer of n segments with cumulative ACKs and Tahoe-style RTO.
  let retransmissions = 0;
  const transfer = (from: string, to: string, n: number, at: number, what: string, bytes: number) => {
    let next = 0;
    let received = 0;
    let deliveredAt = 0;
    let cwnd = 1;
    let rto = RTO_MS;
    let stalls = 0;
    const sent = new Set<number>();
    while (next < n) {
      const last = Math.min(n, next + cwnd);
      let acked = next;
      let ackAt = at;
      for (let i = next; i < last; i++) {
        const again = sent.has(i);
        sent.add(i);
        if (again) retransmissions++;
        const segment = send(from, to, `${what} seq=${1 + i * MSS}${again ? " (retransmit)" : ""}`, bytes, at, "L4 TCP", again ? "RTO expired, cwnd reset to 1 MSS" : `cwnd ${cwnd} MSS`);
        if (segment.arriveAt == null) continue;
        if (i === received && ++received === n) deliveredAt = segment.arriveAt;
        const ack = send(to, from, `ACK ack=${1 + received * MSS}`, CTRL_BYTES, segment.arriveAt, "L4 TCP");
        if (ack.arriveAt != null) {
          acked = Math.max(acked, received);
          ackAt = Math.max(ackAt, ack.arriveAt);
        }
      }
      if (acked === last) {
        [next, at, cwnd, rto, stalls] = [last, ackAt, cwnd * 2, RTO_MS, 0];
        continue;
      }
      if (acked > next) stalls = 0;
      if (stalls === MAX_RETX) {
        local(from, `Connection reset: no ACK after ${MAX_RETX} retransmissions`, at + rto, "L4 TCP");
        return null;
      }
      [next, at, cwnd, rto, stalls] = [acked, at + rto, 1, rto * 2, stalls + 1];
    }
    return { ackedAt: at, deliveredAt };
  };
  const teardown = (client: string, server: string, at: number) => {
    const fin = send(client, server, "FIN", CTRL_BYTES, at, "L4 TCP");
    if (fin.arriveAt == null) return false;
    const ack = send(server, client, "ACK", CTRL_BYTES, fin.arriveAt, "L4 TCP");
    const finBack = send(server, client, "FIN", CTRL_BYTES, fin.arriveAt, "L4 TCP");
    return ack.arriveAt != null && finBack.arriveAt != null && send(client, server, "ACK", CTRL_BYTES, finBack.arriveAt, "L4 TCP").arriveAt != null;
  };
  const closed = (ok: boolean) => (ok ? "connection closed" : "teardown incomplete (FIN/ACK lost)");

  if (kind === "icmp") {
    const count = options.count ?? 3;
    const rtts: number[] = [];
    let t = 0;
    for (let seq = 1; seq <= count; seq++) {
      const end = chain([[src, dst, `echo request seq=${seq}`, PACKET_BYTES.ICMP], [dst, src, `echo reply seq=${seq}`, PACKET_BYTES.ICMP]], t, "L3 ICMP");
      if (end != null) {
        rtts.push(end - t);
        t = Math.max(t + 1000, end);
      } else {
        local(src, `Request timed out (seq=${seq})`, t + 2000, "L3 ICMP");
        t += 2000;
      }
    }
    const avg = rtts.length ? `, avg RTT ${(rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(3)} ms` : "";
    return done(`${rtts.length}/${count} replies (${Math.round(100 - (100 * rtts.length) / count)}% loss)${avg}`, rtts.length === count);
  }

  if (kind === "arp") {
    // The host ARPs for its next L3 hop toward dst (its gateway), or dst itself on the same segment.
    const hop = forward(topology, computeTables(topology, protocol), src, dst).l3Hops[1] ?? dst;
    if (!participants.includes(hop)) participants.splice(1, 0, hop);
    for (let attempt = 0; attempt < 3; attempt++) {
      const end = chain([[src, hop, `who-has ${ip(hop)} tell ${ip(src)} (broadcast)`, PACKET_BYTES.ARP], [hop, src, `is-at ${macOf(hop)}`, PACKET_BYTES.ARP]], attempt * 1000, "L2 ARP");
      if (end != null) {
        messages.at(-1)!.note = `${src} caches ${ip(hop)} -> ${macOf(hop)} for 300 s`;
        return done(`${ip(hop)} resolved to ${macOf(hop)} in ${(end - attempt * 1000).toFixed(3)} ms`, true);
      }
    }
    local(src, "ARP unanswered: host unreachable", 3000, "L2 ARP");
    return done("ARP unanswered: host unreachable", false);
  }

  if (kind === "dhcp") {
    const lease = freeAddress(topology, dst) ?? "none";
    let t = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const steps: [string, string, string, number][] = [
        [src, dst, `DHCPDISCOVER (broadcast)${attempt ? " (retransmit)" : ""}`, PACKET_BYTES.DHCP],
        [dst, src, `DHCPOFFER ${lease}`, PACKET_BYTES.DHCP],
        [src, dst, `DHCPREQUEST ${lease} (broadcast)`, PACKET_BYTES.DHCP],
        [dst, src, "DHCPACK", PACKET_BYTES.DHCP],
      ];
      if (chain(steps, t, "L7 DHCP") != null) {
        messages.at(-1)!.note = `leased ${lease} for 86400 s`;
        return done(`${src} leased ${lease} for 86400 s`, true);
      }
      t += 4000 * 2 ** attempt;
    }
    local(src, "DHCP failed: no lease after 3 Discovers", t, "L7 DHCP");
    return done("DHCP failed: no lease after 3 Discovers", false);
  }

  if (kind === "dns") {
    for (let attempt = 0; attempt < 3; attempt++) {
      const end = chain([[src, dst, `query A lab.example${attempt ? " (retry)" : ""}`, PACKET_BYTES.DNS], [dst, src, `response A ${ip(dst)} TTL 300 s`, PACKET_BYTES.DNS]], attempt * 2000, "L7 DNS");
      if (end != null) {
        local(src, "cache hit (TTL 299 s left)", end + 1000, "L7 DNS");
        return done(`lab.example -> ${ip(dst)} in ${(end - attempt * 2000).toFixed(3)} ms; second lookup served from cache`, true);
      }
    }
    local(src, "DNS timeout", 6000, "L7 DNS");
    return done("DNS timeout", false);
  }

  if (kind === "udp") {
    const count = options.count ?? 3;
    let got = 0;
    for (let i = 0; i < count; i++) if (send(src, dst, `datagram ${i + 1}`, PACKET_BYTES.UDP, i * 100, "L4 UDP").arriveAt != null) got++;
    return done(`${got}/${count} datagrams arrived; ${count - got} lost silently (UDP has no ACK or retransmission)`, got === count);
  }

  const start = handshake(0);
  if (start == null) return done("Connection timed out", false);
  if (kind === "tcp") {
    const n = options.segments ?? 8;
    const result = transfer(src, dst, n, start, "DATA", DATA_BYTES);
    if (!result) return done(`Connection reset after ${retransmissions} retransmissions`, false);
    const ok = teardown(src, dst, result.ackedAt);
    return done(`${n} segments (${n * MSS} B) delivered in ${result.deliveredAt.toFixed(3)} ms, ${retransmissions} retransmissions; ${closed(ok)}`, ok);
  }
  // http
  const get = transfer(src, dst, 1, start, "GET /index.html", GET_BYTES);
  if (!get) return done(`Connection reset after ${retransmissions} retransmissions`, false);
  const n = options.segments ?? 4;
  const response = transfer(dst, src, n, get.deliveredAt, "HTTP/1.1 200 OK", DATA_BYTES);
  if (!response) return done(`Connection reset after ${retransmissions} retransmissions`, false);
  const ok = teardown(src, dst, response.deliveredAt);
  return done(`200 OK, ${n} segments in ${response.deliveredAt.toFixed(3)} ms, ${retransmissions} retransmissions; ${closed(ok)}`, ok);
}
