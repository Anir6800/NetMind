import assert from "node:assert/strict";
import { test } from "node:test";
import type { Topology } from "../lib/api";
import { simulate, toCsv } from "./des.ts";
import { analyzeFlow } from "./engine.ts";
import { lab } from "./testkit.ts";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const base = { protocol: "ospf" as const, src: "h1", dst: "h2", app: "ICMP", count: 1, intervalMs: 10, seed: 7, warmArp: true };

function wire(mbps: number, meters: number, queue = 64): Topology {
  return {
    version: "v1",
    addressing_plan: "test",
    nodes: [
      { id: "a", type: "host", interfaces: [{ id: "p1", address: "10.9.0.1/24" }] },
      { id: "b", type: "host", interfaces: [{ id: "p1", address: "10.9.0.2/24" }] },
    ],
    links: [{ id: "w", a: { node_id: "a", interface_id: "p1" }, b: { node_id: "b", interface_id: "p1" }, capacity_mbps: mbps, delay_ms: 0, length_m: meters, queue_packets: queue, state: "up" }],
  };
}

test("1500 B over 10 Mbps and 2 km: processing + t_tx + t_prop", () => {
  const run = simulate(wire(10, 2000), { ...base, src: "a", dst: "b", app: "UDP", warmArp: true });
  const hop = run.hops[0];
  close(hop.tx, (512 * 8) / 10000);
  const tcp = simulate(wire(10, 2000), { ...base, src: "a", dst: "b", app: "TCP" });
  close(tcp.hops[0].tx, 1.2);
  close(tcp.hops[0].prop, 0.01);
  close(tcp.packets[0].deliveredAt!, 0.1 + 1.2 + 0.01 + 0.1);
});

test("unloaded DES timing equals the analytical calculator", () => {
  const run = simulate(lab(), base);
  const analytic = analyzeFlow(lab(), { src: "h1", dst: "h2", protocol: "ospf", app: "ICMP" });
  close(run.packets[0].deliveredAt!, analytic.metrics.total);
  close(run.packets[0].rttMs!, analytic.rttMs);
});

test("cold ARP adds a who-has / is-at exchange before the first frame", () => {
  const cold = simulate(lab(), { ...base, warmArp: false });
  assert.ok(cold.events.some((event) => event.kind === "arp" && /who-has 10\.0\.1\.1/.test(event.text)));
  assert.ok(cold.packets[0].rttMs! > simulate(lab(), base).packets[0].rttMs!);
  // Switches learned both MACs from ARP, so data frames are not flooded.
  assert.ok(!cold.events.some((event) => event.kind === "flood" && event.protocol === "ICMP"));
});

test("switch floods unknown unicast, then learns", () => {
  const run = simulate(lab(), base);
  assert.ok(run.events.some((event) => event.device === "sw1" && event.kind === "flood" && /unknown dst MAC/.test(event.text)));
  assert.ok(run.macTables.get("sw1")!.size >= 2);
});

test("TTL expiry returns ICMP Time Exceeded to the sender", () => {
  const run = simulate(lab(), { ...base, ttl: 1 });
  assert.ok(run.events.some((event) => event.kind === "ttl-exceeded" && event.device === "r1"));
  const icmp = run.packets.find((packet) => packet.kind === "icmp")!;
  assert.equal(icmp.from, "r1");
  assert.ok(icmp.deliveredAt !== undefined);
});

test("finite queue tail-drops a burst", () => {
  const run = simulate(wire(10, 0, 3), { ...base, src: "a", dst: "b", app: "UDP", count: 10, intervalMs: 0 });
  const drops = run.packets.filter((packet) => packet.reason?.startsWith("queue full"));
  assert.equal(drops.length, 6); // 1 transmitting + 3 queued, rest dropped
  assert.ok(run.events.some((event) => /drops packet \d+: queue full/.test(event.text)));
});

test("a hub repeats bits to every port", () => {
  const topology = lab();
  topology.nodes[1] = { ...topology.nodes[1], type: "hub" };
  const run = simulate(topology, base);
  assert.ok(run.events.some((event) => event.device === "sw1" && /repeats bits/.test(event.text)));
});

test("same seed, same run; loss makes seeds differ", () => {
  const lossy = lab();
  lossy.links[2] = { ...lossy.links[2], loss_pct: 40, jitter_ms: 1 };
  const options = { ...base, count: 20, intervalMs: 1 };
  assert.deepEqual(simulate(lossy, options).events, simulate(lossy, options).events);
  assert.notDeepEqual(simulate(lossy, options).events, simulate(lossy, { ...options, seed: 8 }).events);
  assert.match(toCsv(simulate(lossy, options).events).split("\n")[0], /^t_ms,packet,device/);
});
