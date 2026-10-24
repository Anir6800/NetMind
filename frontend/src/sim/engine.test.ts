import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeFlow,
  applyFault,
  compareImpact,
  computeTables,
  forward,
  l3Adjacencies,
  longestPrefixMatch,
  propagationMs,
  queueEstimate,
  transmissionMs,
  type Flow,
  type Route,
} from "./engine.ts";
import { lab } from "./testkit.ts";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const ping: Flow = { src: "h1", dst: "h2", protocol: "ospf", app: "ICMP" };

test("1500-byte packet over a 10 Mbps, 2 km link", () => {
  close(transmissionMs(1500, 10), 1.2);
  close(propagationMs({ id: "x", a: { node_id: "a" }, b: { node_id: "b" }, capacity_mbps: 10, delay_ms: 99, state: "up", length_m: 2000 }), 0.01);
});

test("M/M/1/K queue estimate", () => {
  const link = { id: "x", a: { node_id: "a" }, b: { node_id: "b" }, capacity_mbps: 10, delay_ms: 1, state: "up" as const, utilisation_pct: 50, queue_packets: 2 };
  const queue = queueEstimate(link, 1500);
  close(queue.waitMs, 1.2); // rho/(1-rho) * t_tx = 1 * 1.2
  close(queue.dropProbability, (0.5 * 0.25) / (1 - 0.125));
});

test("routers are L3 neighbours through a switch", () => {
  const adjacency = l3Adjacencies(lab());
  assert.deepEqual(adjacency.get("h1")!.map((hop) => [hop.neighbour, hop.links]), [["r1", ["l1", "l2"]]]);
});

test("hand-calculated ping h1 -> h2", () => {
  const result = analyzeFlow(lab(), ping);
  assert.deepEqual(result.forward.nodes, ["h1", "sw1", "r1", "r2", "sw2", "h2"]);
  assert.equal(result.forward.ttlAtDest, 62);
  const tx = 3 * transmissionMs(98, 100) + 2 * transmissionMs(98, 1000);
  close(result.metrics.transmission, tx);
  close(result.metrics.propagation, 5);
  close(result.metrics.processing, 0.1 + 0.05 + 0.5 + 0.5 + 0.05 + 0.1);
  close(result.metrics.total, 5 + 1.3 + tx);
  close(result.rttMs, 2 * (5 + 1.3 + tx));
  assert.equal(result.metrics.bottleneckMbps, 100);
});

test("longest prefix match prefers the most specific route", () => {
  const route = (prefix: string): Route => ({ prefix, dest: prefix, nextHop: "x", iface: "p1", metric: 1, code: "S" });
  const routes = [route("0.0.0.0/0"), route("10.0.0.0/8"), route("10.0.2.0/24")];
  assert.equal(longestPrefixMatch(routes, "10.0.2.9")?.prefix, "10.0.2.0/24");
  assert.equal(longestPrefixMatch(routes, "10.9.9.9")?.prefix, "10.0.0.0/8");
  assert.equal(longestPrefixMatch(routes, "8.8.8.8")?.prefix, "0.0.0.0/0");
});

test("RIP counts routers, not switches", () => {
  const r2 = computeTables(lab(), "rip").get("r2")!;
  assert.equal(r2.find((route) => route.prefix === "10.0.1.0/24")?.metric, 1);
});

test("TTL expiry happens at the router that decrements to zero", () => {
  const tables = computeTables(lab(), "ospf");
  assert.equal(forward(lab(), tables, "h1", "h2", { ttl: 1 }).ttlExpiredAt, "r1");
  assert.equal(forward(lab(), tables, "h1", "h2", { ttl: 2 }).ttlExpiredAt, "r2");
  assert.equal(forward(lab(), tables, "h1", "h2", { ttl: 3 }).delivered, true);
});

test("primary link failure: OSPF reroutes, static blackholes", () => {
  const failed = applyFault(lab(), { kind: "link-down", target: "l3" });
  const ospf = analyzeFlow(failed, ping);
  assert.deepEqual(ospf.forward.l3Hops, ["h1", "r1", "r3", "r2", "h2"]);
  assert.equal(ospf.forward.ttlAtDest, 61);
  const staticResult = analyzeFlow(failed, { ...ping, protocol: "static" });
  assert.equal(staticResult.reachable, false);
  assert.match(staticResult.forward.reason, /blackholed/);
  assert.equal(staticResult.forward.dropAt, "r1");
});

test("live right-click and Preview use the same calculator", () => {
  const fault = { kind: "link-down" as const, target: "l3" };
  const preview = compareImpact(lab(), applyFault(lab(), fault), ping);
  const live = analyzeFlow(applyFault(lab(), fault), ping);
  assert.deepEqual(preview.after, live);
  assert.deepEqual(preview.before, analyzeFlow(lab(), ping));
  const restored = applyFault(applyFault(lab(), fault), { kind: "link-up", target: "l3" });
  assert.deepEqual(analyzeFlow(restored, ping), analyzeFlow(lab(), ping));
});

test("device down lists lost reachability and affected layers", () => {
  const impact = compareImpact(lab(), applyFault(lab(), { kind: "node-down", target: "r1" }), ping);
  assert.deepEqual(impact.reachability.map((item) => item.node).sort(), ["h2", "r1", "r2", "r3"]);
  assert.equal(impact.after.reachable, false);
  assert.ok(impact.layers.some((layer) => layer.startsWith("L4")));
});

test("firewall deny rule drops matching traffic", () => {
  const topology = lab();
  topology.nodes[2] = { ...topology.nodes[2], type: "firewall", acl: [{ action: "deny", protocol: "ICMP" }] };
  const result = analyzeFlow(topology, ping);
  assert.equal(result.forward.dropAt, "r1");
  assert.equal(analyzeFlow(topology, { ...ping, app: "HTTP" }).reachable, true);
});

test("a hub relays bits without store-and-forward transmission delay", () => {
  const topology = lab();
  topology.nodes[5] = { ...topology.nodes[5], type: "hub" };
  const withHub = analyzeFlow(topology, ping).metrics.transmission;
  close(analyzeFlow(lab(), ping).metrics.transmission - withHub, transmissionMs(98, 100));
});
