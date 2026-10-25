// Numbers quoted in docs/presentation.md. Run from the repository root: node docs/presentation-assets/measure.mjs
// Uses the simulator modules directly (Node 24 strips the TypeScript types); timings are Node/V8 on this PC, not a browser.
import fs from "node:fs";
import { analyzeFlow, applyFault, compareImpact } from "../../frontend/src/sim/engine.ts";
import { converge } from "../../frontend/src/sim/convergence.ts";
import { simulate } from "../../frontend/src/sim/des.ts";
import { criticalSummary } from "../../frontend/src/sim/analysis.ts";
import { lab } from "../../frontend/src/sim/testkit.ts";

const r = (x) => (x == null ? x : Math.round(x * 1000) / 1000);
const out = (...args) => console.log(...args);

// 1. Worked example: ping h1 -> h2 on the 7-device lab, OSPF.
const t = lab();
const flow = { src: "h1", dst: "h2", protocol: "ospf", app: "ICMP" };
const f = analyzeFlow(t, flow);
out("PING before", JSON.stringify({ path: f.forward.nodes, ttl: f.forward.ttlAtDest, metrics: f.metrics, rtt: f.rttMs }));
const down = applyFault(t, { kind: "link-down", target: "l3" });
const f2 = analyzeFlow(down, flow);
out("PING after l3 down", JSON.stringify({ path: f2.forward.nodes, ttl: f2.forward.ttlAtDest, oneWay: f2.metrics.total, rtt: f2.rttMs }));

// 2. Convergence after l3 goes down, seeds 1-5.
for (const protocol of ["static", "rip", "ospf"]) {
  const rows = [1, 2, 3, 4, 5].map((seed) => {
    const c = converge(t, down, { protocol, seed, flow: { src: "h1", dst: "h2" } });
    return { seed, detectionMs: r(c.detectionMs), convergedMs: r(c.convergedMs), outageMs: r(c.outageMs), packetsLost: c.packetsLost, reachableAtEnd: c.reachableAtEnd };
  });
  out("CONVERGENCE", protocol, JSON.stringify(rows));
}

// 3. Critical-device analysis on every prepared template.
const dir = "data/templates/";
for (const file of fs.readdirSync(dir).sort()) {
  const d = JSON.parse(fs.readFileSync(dir + file, "utf8"));
  const topo = d.topology ?? d;
  const s = criticalSummary(topo);
  out("TEMPLATE", file, `devices=${topo.nodes.length}`, `links=${topo.links.length}`, `spof_entries=${s.spof.length}`, `top="${s.spof[0]?.summary}"`);
}

// 4. Speed of the calculators on the 50-device template (Node, 20 runs; 5 for the heavier ones).
const big = JSON.parse(fs.readFileSync(dir + "ladder-large.json", "utf8"));
const bt = big.topology ?? big;
const hosts = bt.nodes.filter((n) => n.type === "host").map((n) => n.id);
const bflow = { src: hosts[0], dst: hosts.at(-1), protocol: "ospf", app: "ICMP" };
const cut = bt.links[0].id;
const bAfter = applyFault(bt, { kind: "link-down", target: cut });
const time = (fn, n) => { fn(); const s = performance.now(); for (let i = 0; i < n; i += 1) fn(); return r((performance.now() - s) / n); };
out("SPEED devices", bt.nodes.length, "links", bt.links.length);
out("SPEED compareImpact ms", time(() => compareImpact(bt, bAfter, bflow), 20));
out("SPEED converge ospf ms", time(() => converge(bt, bAfter, { protocol: "ospf", flow: bflow }), 5));
out("SPEED converge rip ms", time(() => converge(bt, bAfter, { protocol: "rip", flow: bflow }), 5));
out("SPEED DES 20 packets ms", time(() => simulate(bt, { ...bflow, count: 20, intervalMs: 10, seed: 1, warmArp: false }), 5));
out("SPEED criticalSummary ms", time(() => criticalSummary(bt), 5));
for (const protocol of ["rip", "ospf"]) {
  const c = converge(bt, bAfter, { protocol, flow: bflow });
  out("50-DEVICE cut", cut, protocol, "converged", r(c.convergedMs), "outage", r(c.outageMs), "lost", c.packetsLost, "reachableAtEnd", c.reachableAtEnd);
}
