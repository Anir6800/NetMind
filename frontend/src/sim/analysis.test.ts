import assert from "node:assert/strict";
import { test } from "node:test";
import type { Topology } from "../lib/api";
import { articulationPoints, betweenness, bridges, criticalSummary, dependents, failureImpact } from "./analysis.ts";
import { lab } from "./testkit.ts";

// net("a:host b:switch", "a-b b-c") -> links named l1, l2, ...
function net(nodes: string, links: string, down: string[] = []): Topology {
  return {
    version: "v1",
    nodes: nodes.split(" ").map((item) => {
      const [id, type = "router"] = item.split(":");
      return { id, type, interfaces: [] };
    }),
    links: links.split(" ").map((pair, index) => {
      const [a, b] = pair.split("-");
      const id = `l${index + 1}`;
      return { id, a: { node_id: a }, b: { node_id: b }, capacity_mbps: 100, delay_ms: 1, state: down.includes(id) ? "down" : "up" };
    }),
  };
}

test("path a-b-c: b is articulation, both links are bridges", () => {
  const t = net("a b c", "a-b b-c");
  assert.deepEqual(articulationPoints(t), ["b"]);
  assert.deepEqual(bridges(t), ["l1", "l2"]);
});

test("cycle of 4 has no articulation points or bridges", () => {
  const t = net("a b c d", "a-b b-c c-d d-a");
  assert.deepEqual(articulationPoints(t), []);
  assert.deepEqual(bridges(t), []);
});

test("two triangles joined by one link", () => {
  const t = net("a b c d e f", "a-b b-c c-a c-d d-e e-f f-d");
  assert.deepEqual(articulationPoints(t), ["c", "d"]);
  assert.deepEqual(bridges(t), ["l4"]);
});

test("parallel links are not bridges", () => {
  const t = net("a b c", "a-b a-b b-c");
  assert.deepEqual(bridges(t), ["l3"]);
  assert.deepEqual(articulationPoints(t), ["b"]);
});

test("down link is excluded", () => {
  const t = net("a b c d", "a-b b-c c-d d-a", ["l4"]);
  assert.deepEqual(bridges(t), ["l1", "l2", "l3"]);
  assert.deepEqual(articulationPoints(t), ["b", "c"]);
});

const star = () => net("s:switch h1:host h2:host h3:host h4:host", "s-h1 s-h2 s-h3 s-h4");

test("failureImpact: star center fails => all leaves lost", () => {
  const impact = failureImpact(star(), "s");
  assert.deepEqual(impact.lost, ["h1", "h2", "h3", "h4"]);
  assert.equal(impact.summary, "if s fails, 4 devices lose reachability");
  assert.deepEqual(failureImpact(star(), "l1").lost, ["h1"]);
  const summary = criticalSummary(star());
  assert.equal(summary.spof[0].id, "s");
  assert.equal(summary.spof[0].lost, 4);
  assert.equal(summary.spof.length, 5);
  assert.deepEqual(summary.busiest, { id: "s", score: 6 });
});

test("betweenness counts end-device pairs only", () => {
  const path = betweenness(net("a:host b:host c:host", "a-b b-c"));
  assert.deepEqual(Object.fromEntries(path), { a: 0, b: 1, c: 0 });
  assert.equal(betweenness(star()).get("s"), 6);
});

test("dependents on lab(): layers per device on the h1->h2 flow", () => {
  const flows = [{ src: "h1", dst: "h2", app: "ICMP" }];
  const sw1 = dependents(lab(), "ospf", "sw1", flows);
  assert.deepEqual(sw1.flows[0].layers, ["L1 Physical", "L2 Data link"]);
  assert.deepEqual(sw1.downstream, ["h1"]);
  const r1 = dependents(lab(), "ospf", "r1", flows);
  assert.deepEqual(r1.flows[0].layers, ["L1 Physical", "L2 Data link", "L3 Network"]);
  assert.equal(dependents(lab(), "ospf", "r3", flows).flows.length, 0);
  // r1 and r2 tie on betweenness; the first (r1) is the core.
  assert.deepEqual(r1.upstream, []);
  assert.deepEqual(sw1.upstream, ["r1"]);
});

test("an equal split is reported as two halves; links are named by their ends", () => {
  const t = net("a:host b:host c:host d:host", "a-b b-c c-d");
  assert.equal(failureImpact(t, "l2").summary, "if the b–c link fails, the network splits into two equal halves of 2 devices");
  assert.equal(failureImpact(t, "l3").summary, "if the c–d link fails, 1 device loses reachability");
});
