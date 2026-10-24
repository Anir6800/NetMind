import assert from "node:assert/strict";
import { test } from "node:test";
import type { Topology, TopologyLink } from "../lib/api";
import { converge, traceroute } from "./convergence.ts";
import { applyFault, computeTables, type Protocol, type Tables } from "./engine.ts";
import { lab } from "./testkit.ts";

const flow = { src: "h1", dst: "h2" };
const down = applyFault(lab(), { kind: "link-down", target: "l3" });
const routers = ["r1", "r2", "r3"];
const view = (tables: Tables) =>
  Object.fromEntries(routers.map((id) => [id, (tables.get(id) ?? []).map((route) => `${route.prefix}>${route.nextHop}:${route.metric}`).sort()]));

for (const protocol of ["rip", "ospf"] as Protocol[])
  test(`${protocol}: converged tables equal computeTables after l3 fails`, () => {
    const result = converge(lab(), down, { protocol, flow });
    assert.deepEqual(view(result.finalTables), view(computeTables(down, protocol)));
    assert.equal(result.detectionMs, 0);
    assert.ok(result.reachableAtEnd);
    assert.ok(result.changes.some((change) => change.router === "r1" && change.prefix === "10.0.2.0/24"));
  });

test("expected r1 table before and after (OSPF): primary via r2, backup via r3", () => {
  const route = (tables: Tables) => tables.get("r1")!.find((item) => item.prefix === "10.0.2.0/24")!;
  assert.deepEqual([route(computeTables(lab(), "ospf")).nextHop, route(computeTables(lab(), "ospf")).metric], ["r2", 10]);
  assert.deepEqual([route(computeTables(down, "ospf")).nextHop, route(computeTables(down, "ospf")).metric], ["r3", 200]);
  assert.deepEqual([route(computeTables(down, "rip")).nextHop, route(computeTables(down, "rip")).metric], ["r3", 2]);
});

test("OSPF converges faster than RIP; static never does", () => {
  const ospf = converge(lab(), down, { protocol: "ospf", flow });
  const rip = converge(lab(), down, { protocol: "rip", flow });
  const fixed = converge(lab(), down, { protocol: "static", flow });
  assert.ok(ospf.convergedMs! < 1000, `ospf ${ospf.convergedMs}`);
  assert.ok(rip.convergedMs! > ospf.convergedMs!);
  assert.ok(ospf.packetsLost! < rip.packetsLost!);
  assert.equal(fixed.convergedMs, null);
  assert.equal(fixed.outageMs, null);
  assert.equal(fixed.reachableAtEnd, false);
});

test("convergence is deterministic for a seed", () => {
  assert.deepEqual(converge(lab(), down, { protocol: "rip", seed: 4, flow }), converge(lab(), down, { protocol: "rip", seed: 4, flow }));
  assert.deepEqual(converge(lab(), down, { protocol: "ospf", seed: 4, flow }), converge(lab(), down, { protocol: "ospf", seed: 4, flow }));
});

test("a break behind a switch is found by the dead timer, not carrier loss", () => {
  const topology = lab();
  topology.nodes.push({ id: "swm", type: "switch", interfaces: [{ id: "p1", address: "10.0.12.5/30" }, { id: "p2", address: "10.0.12.6/30" }] });
  const l3 = topology.links.find((link) => link.id === "l3")!;
  topology.links = topology.links.filter((link) => link.id !== "l3");
  topology.links.push({ ...l3, id: "l3a", b: { node_id: "swm", interface_id: "p1" } }, { ...l3, id: "l3b", a: { node_id: "swm", interface_id: "p2" } });
  const result = converge(topology, applyFault(topology, { kind: "link-down", target: "l3b" }), { protocol: "ospf" });
  const r1 = result.steps.find((step) => step.kind === "detect" && step.router === "r1")!;
  assert.match(r1.text, /dead interval/);
  assert.ok(r1.t > 30_000 && r1.t <= 40_000);
  assert.ok(result.steps.some((step) => step.kind === "detect" && step.router === "r2" && step.t === 0));
});

function triangle(): Topology {
  const link = (id: string, a: string, ai: string, b: string, bi: string): TopologyLink => ({ id, a: { node_id: a, interface_id: ai }, b: { node_id: b, interface_id: bi }, capacity_mbps: 100, delay_ms: 1, state: "up" });
  return {
    version: "v1",
    addressing_plan: "ring",
    nodes: [
      { id: "h", type: "host", interfaces: [{ id: "p1", address: "10.0.9.10/24" }] },
      { id: "r1", type: "router", interfaces: [{ id: "p1", address: "10.0.9.1/24" }, { id: "p2", address: "10.0.12.1/30" }, { id: "p3", address: "10.0.13.1/30" }] },
      { id: "r2", type: "router", interfaces: [{ id: "p1", address: "10.0.12.2/30" }, { id: "p2", address: "10.0.23.1/30" }] },
      { id: "r3", type: "router", interfaces: [{ id: "p1", address: "10.0.13.2/30" }, { id: "p2", address: "10.0.23.2/30" }] },
    ],
    links: [link("lh", "h", "p1", "r1", "p1"), link("a", "r1", "p2", "r2", "p1"), link("b", "r1", "p3", "r3", "p1"), link("c", "r2", "p2", "r3", "p2")],
  };
}

test("RIP count-to-infinity in a ring without split horizon; prevented with it", () => {
  const before = triangle();
  const after = applyFault(before, { kind: "link-down", target: "lh" });
  const naive = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => converge(before, after, { protocol: "rip", seed, splitHorizon: false, triggeredUpdates: false }));
  assert.ok(naive.some((result) => result.countToInfinity));
  const counted = naive.find((result) => result.countToInfinity)!;
  assert.ok(counted.changes.some((change) => change.prefix === "10.0.9.0/24" && change.after === "unreachable (16)"));
  for (let seed = 1; seed <= 10; seed += 1) assert.equal(converge(before, after, { protocol: "rip", seed }).countToInfinity, false);
});

test("traceroute lists each router then the destination", () => {
  const hops = traceroute(lab(), "ospf", "h1", "h2");
  assert.deepEqual(hops.map((hop) => hop.device), ["r1", "r2", "h2"]);
  assert.ok(hops[0].rttMs! < hops[1].rttMs! && hops[1].rttMs! < hops[2].rttMs!);
  assert.match(traceroute(down, "static", "h1", "h2").at(-1)!.reply, /\* \* \*/);
});
