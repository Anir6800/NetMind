import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { Topology } from "../lib/api";
import { articulationPoints } from "./analysis.ts";
import { simulate } from "./des.ts";
import { applyFault, type Fault } from "./engine.ts";
import { LESSONS, lessonProgress, type Lesson, type LessonState } from "./lessons.ts";
import { scenario } from "./protocols.ts";

const dir = new URL("../../../data/templates/", import.meta.url);
const load = (id: string): Topology => JSON.parse(readFileSync(new URL(`${id}.json`, dir), "utf8"));
const byId = (id: string) => LESSONS.find((lesson) => lesson.id === id)!;
const fresh = (lesson: Lesson): LessonState => ({
  topology: load(lesson.template),
  protocol: "static",
  flows: [],
  panel: "canvas",
  focus: null,
  run: null,
  selectedPacket: null,
  change: null,
  ladder: null,
});
const live = (s: LessonState, fault: Fault): LessonState => {
  const after = applyFault(s.topology, fault);
  return { ...s, topology: after, change: { title: fault.kind, before: s.topology, after, target: fault.target } };
};
// Each state in the script must advance progress by exactly one step.
function walk(lesson: Lesson, states: LessonState[]) {
  assert.equal(lessonProgress(lesson, fresh(lesson)), 0);
  assert.equal(states.length, lesson.steps.length);
  states.forEach((state, i) => assert.equal(lessonProgress(lesson, state), i + 1, `${lesson.id} step ${i + 1}`));
}

test("five lessons, 4-6 steps each, templates exist", () => {
  assert.equal(LESSONS.length, 5);
  for (const lesson of LESSONS) {
    assert.ok(existsSync(new URL(`${lesson.template}.json`, dir)), lesson.template);
    assert.ok(lesson.steps.length >= 4 && lesson.steps.length <= 6, lesson.id);
  }
});

test("ping-switch-router walkthrough", () => {
  const lesson = byId("ping-switch-router");
  const s0 = fresh(lesson);
  const s1: LessonState = { ...s0, panel: "simulate", flows: [{ src: "host-1", dst: "server-1", app: "ICMP" }] };
  const run = simulate(s1.topology, { protocol: "static", src: "host-1", dst: "server-1", app: "ICMP", count: 1, intervalMs: 1000, seed: 1 });
  const s2 = { ...s1, run };
  const s3 = { ...s2, selectedPacket: run.packets[0].id };
  const s4: LessonState = { ...s3, panel: "tables", focus: { kind: "node", id: "switch-1" } };
  walk(lesson, [s1, s2, s3, s4]);
});

test("static-vs-ospf walkthrough", () => {
  const lesson = byId("static-vs-ospf");
  const link = "link-router-2-router-3";
  const s1: LessonState = { ...fresh(lesson), panel: "simulate", flows: [{ src: "host-1", dst: "server-1", app: "ICMP" }] };
  const s2 = live(s1, { kind: "link-down", target: link });
  const s3 = live(s2, { kind: "link-up", target: link });
  const s4: LessonState = { ...s3, protocol: "ospf" };
  const s5 = live(s4, { kind: "link-down", target: link });
  walk(lesson, [s1, s2, s3, s4, s5]);
});

test("rip-count-to-infinity walkthrough", () => {
  const lesson = byId("rip-count-to-infinity");
  const s1: LessonState = { ...fresh(lesson), protocol: "rip" };
  const s2 = live(s1, { kind: "link-down", target: "link-router-1-router-2" });
  const s3 = { ...s2, panel: "tables" };
  const s4: LessonState = { ...s3, focus: { kind: "node", id: "router-1" } };
  walk(lesson, [s1, s2, s3, s4]);
});

test("find-the-spof walkthrough", () => {
  const lesson = byId("find-the-spof");
  const s0 = fresh(lesson);
  const spof = "switch-1";
  assert.ok(articulationPoints(s0.topology).includes(spof));
  const s1: LessonState = { ...s0, focus: { kind: "node", id: spof } };
  const s2 = live(s1, { kind: "node-down", target: spof });
  const s3 = live(s2, { kind: "node-up", target: spof });
  const s4 = { ...s3, panel: "tables" };
  walk(lesson, [s1, s2, s3, s4]);
  // Shortcut: power-cycling a plain host must not finish the lesson.
  const host = s0.topology.nodes.find((n) => n.type === "host")!.id;
  const cycled = { ...live(live(s0, { kind: "node-down", target: host }), { kind: "node-up", target: host }), panel: "tables" };
  assert.ok(lessonProgress(lesson, cycled) < lesson.steps.length);
});

test("tcp-retransmit walkthrough", () => {
  const lesson = byId("tcp-retransmit");
  const base = { kind: "tcp" as const, src: "host-1", dst: "server-1", seed: 1 };
  const s1: LessonState = { ...fresh(lesson), panel: "simulate", flows: [{ src: "host-1", dst: "server-1", app: "TCP" }] };
  const clean = scenario(s1.topology, { ...base, protocol: "static" });
  const s2 = { ...s1, ladder: clean };
  const fault: Fault = { kind: "link-down", target: "link-router-2-router-3" };
  const faultAtMs = clean.messages.find((m) => m.label === "DATA seq=1")!.arriveAt! + 0.001;
  const s3 = { ...s2, ladder: scenario(s1.topology, { ...base, protocol: "static", fault, faultAtMs }) };
  const down = live({ ...s3, protocol: "ospf" }, fault);
  const s4: LessonState = { ...down, ladder: scenario(down.topology, { ...base, protocol: "ospf" }) };
  walk(lesson, [s1, s2, s3, s4]);
  // Shortcut: a fault-free OSPF TCP run on a fresh lab must not finish the lesson.
  const plain: LessonState = { ...s1, protocol: "ospf", ladder: scenario(s1.topology, { ...base, protocol: "ospf" }) };
  assert.ok(lessonProgress(lesson, plain) < lesson.steps.length);
});
