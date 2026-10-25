import type { Topology } from "../lib/api";
import { articulationPoints, failureImpact } from "./analysis.ts";
import { converge } from "./convergence.ts";
import type { SimRun } from "./des.ts";
import { analyzeFlow, computeTables, forward, type Protocol } from "./engine.ts";
import type { Ladder } from "./protocols.ts";

export type LessonState = {
  topology: Topology;
  protocol: Protocol;
  flows: { src: string; dst: string; app: string }[];
  panel: string; // "canvas" | "simulate" | "tables" | "logs" | "ai"
  focus: { kind: "node" | "link"; id: string } | null; // device/link open in the inspector
  run: SimRun | null; // last slow-motion run (des.ts)
  selectedPacket: number | null;
  change: { title: string; before: Topology; after: Topology; target?: string } | null; // last live change
  ladder: Ladder | null; // last protocol sequence diagram (protocols.ts)
};
export type LessonStep = { title: string; instruction: string; check: (state: LessonState) => boolean };
export type Lesson = { id: string; title: string; template: string; summary: string; minutes: number; steps: LessonStep[] };

const END = new Set(["host", "server"]);
const typeOf = (topology: Topology, id?: string) => topology.nodes.find((node) => node.id === id)?.type;
const nodeState = (topology: Topology, id?: string) => topology.nodes.find((node) => node.id === id)?.state ?? "up";
const linkState = (topology: Topology, id?: string) => topology.links.find((link) => link.id === id)?.state;
const flowOf = (s: LessonState, protocol = s.protocol) => (s.flows[0] ? { ...s.flows[0], protocol } : null);

// Link the last change took down (null if the change was something else).
const downedLink = (s: LessonState) =>
  s.change?.target && linkState(s.change.after, s.change.target) === "down" && linkState(s.change.before, s.change.target) !== "down"
    ? s.change.target
    : null;
// Last change took a link down that the primary flow used; returns reachability afterwards.
const brokePath = (s: LessonState) => {
  const flow = flowOf(s);
  const link = downedLink(s);
  if (!flow || !link || !analyzeFlow(s.change!.before, flow).forward.links.includes(link)) return null;
  return analyzeFlow(s.change!.after, flow).reachable;
};
const restored = (s: LessonState) =>
  !!s.change?.target && linkState(s.change.before, s.change.target) === "down" && linkState(s.topology, s.change.target) === "up";

// ponytail: memo per change object; converge runs at most 10 times per live change.
const ctiMemo = new WeakMap<Topology, boolean>();
const countsToInfinity = (before: Topology, after: Topology) => {
  if (!ctiMemo.has(after)) {
    let hit = false;
    for (let seed = 1; seed <= 10 && !hit; seed++)
      hit = converge(before, after, { protocol: "rip", splitHorizon: false, triggeredUpdates: false, seed }).countToInfinity;
    ctiMemo.set(after, hit);
  }
  return ctiMemo.get(after)!;
};

// A step counts as done if it, or any later step, holds — so finishing step 3
// is not undone when a later action replaces the "last change" it relied on.
const lesson = (base: Omit<Lesson, "steps">, steps: LessonStep[]): Lesson => ({
  ...base,
  steps: steps.map((step, i) => ({ ...step, check: (s) => steps.slice(i).some((later) => later.check(s)) })),
});

export const LESSONS: Lesson[] = [
  lesson(
    {
      id: "ping-switch-router",
      title: "Watch a ping cross a switch and a router",
      template: "ladder-small",
      summary: "Follow one ICMP echo hop by hop: ARP, MAC learning on the switch, and routing at the router.",
      minutes: 8,
    },
    [
      {
        title: "Pick two hosts in different subnets",
        instruction:
          "Open the Simulate drawer from the bottom pill. Set Source to host-1 and Destination to server-1 (any two end devices whose path crosses a switch and a router will do).",
        check: (s) => {
          const flow = s.flows[0];
          if (!flow || !END.has(typeOf(s.topology, flow.src) ?? "") || !END.has(typeOf(s.topology, flow.dst) ?? "")) return false;
          const path = forward(s.topology, computeTables(s.topology, s.protocol), flow.src, flow.dst).nodes.map((id) => typeOf(s.topology, id));
          return path.includes("switch") && path.includes("router");
        },
      },
      {
        title: "Send a ping",
        instruction: 'Set Packet to ICMP and click "Send & play in slow motion". Watch the request and the reply move across the canvas.',
        check: (s) => !!s.run?.packets.some((p) => p.protocol === "ICMP" && p.kind === "request" && p.deliveredAt !== undefined),
      },
      {
        title: "Open the layer view",
        instruction: "Click a packet in the Simulate drawer's packet list to see its headers layer by layer.",
        check: (s) => s.selectedPacket !== null && !!s.run?.packets.some((p) => p.id === s.selectedPacket),
      },
      {
        title: "Read the switch's MAC table",
        instruction: "Open the Tables drawer, then click a switch on the path (for example switch-1). Its MAC table now lists the addresses it learned from the ping.",
        check: (s) =>
          s.panel === "tables" &&
          s.focus?.kind === "node" &&
          typeOf(s.topology, s.focus.id) === "switch" &&
          (s.run?.macTables.get(s.focus.id)?.size ?? 0) > 0,
      },
    ],
  ),
  lesson(
    {
      id: "static-vs-ospf",
      title: "Break the primary link under static vs OSPF",
      template: "campus-ring",
      summary: "Static routes stay put when a link fails; OSPF finds the way around the ring.",
      minutes: 10,
    },
    [
      {
        title: "Use static routing",
        instruction: "Open the Simulate drawer and set Routing to Static. Set Source to host-1 and Destination to server-1.",
        check: (s) => s.panel === "simulate" && s.protocol === "static" && !!s.flows[0],
      },
      {
        title: "Break a link on the path",
        instruction:
          "Right-click a router-to-router link on the highlighted path (for example router-2 to router-3) and take it down. The flow becomes unreachable: static routes do not move.",
        check: (s) => s.protocol === "static" && brokePath(s) === false,
      },
      {
        title: "Restore the link",
        instruction: "Right-click the same link and bring it back up.",
        check: (s) => s.protocol === "static" && restored(s),
      },
      {
        title: "Switch to OSPF",
        instruction: "In the Simulate drawer set Routing to OSPF.",
        check: (s) => s.protocol === "ospf" && restored(s),
      },
      {
        title: "Break the path again",
        instruction: "Take the same link down again. This time OSPF reroutes the other way round the ring and the flow stays reachable.",
        check: (s) => s.protocol === "ospf" && brokePath(s) === true,
      },
    ],
  ),
  lesson(
    {
      id: "rip-count-to-infinity",
      title: "See count-to-infinity in RIP",
      template: "rip-lab",
      summary: "Without split horizon, RIP routers keep advertising a dead route to each other, counting up to 16.",
      minutes: 10,
    },
    [
      {
        title: "Use RIP",
        instruction: "Open the Simulate drawer and set Routing to RIP.",
        check: (s) => s.protocol === "rip",
      },
      {
        title: "Take a link down",
        instruction: "Right-click a router-to-router link on the ring (for example router-1 to router-2) and take it down.",
        check: (s) => s.protocol === "rip" && !!downedLink(s),
      },
      {
        title: "Open the convergence timeline",
        instruction: "Open the Tables drawer from the bottom pill and scroll to the convergence timeline.",
        check: (s) => s.protocol === "rip" && !!downedLink(s) && s.panel === "tables",
      },
      {
        title: "Turn off the loop protections",
        instruction:
          "Click a router next to the failed link to show its table, then in the convergence panel untick Split horizon and Triggered updates. Watch the metric climb 2, 3, 4 ... up to 16 (infinity) before the route is dropped.",
        check: (s) =>
          s.protocol === "rip" &&
          !!downedLink(s) &&
          s.panel === "tables" &&
          s.focus?.kind === "node" &&
          typeOf(s.topology, s.focus.id) === "router" &&
          countsToInfinity(s.change!.before, s.change!.after),
      },
    ],
  ),
  lesson(
    {
      id: "find-the-spof",
      title: "Find the single point of failure",
      template: "office",
      summary: "One device whose failure cuts the network in two is a single point of failure.",
      minutes: 6,
    },
    [
      {
        title: "Inspect the suspect",
        instruction: "Open the Canvas drawer and click the device every path seems to go through (hint: a switch or the router).",
        check: (s) => s.panel === "canvas" && s.focus?.kind === "node" && articulationPoints(s.topology).includes(s.focus.id),
      },
      {
        title: "Power it down",
        instruction: "Right-click that device and power it down. Devices behind it lose reachability.",
        check: (s) =>
          !!s.change?.target &&
          nodeState(s.change.after, s.change.target) === "down" &&
          nodeState(s.change.before, s.change.target) !== "down" &&
          failureImpact(s.change.before, s.change.target).lost.length > 0,
      },
      {
        title: "Power it back up",
        instruction: "Right-click the device again and power it up.",
        check: (s) =>
          !!s.change?.target &&
          nodeState(s.change.before, s.change.target) === "down" &&
          nodeState(s.topology, s.change.target) !== "down" &&
          articulationPoints(s.topology).includes(s.change.target),
      },
      {
        title: "Confirm everyone is back",
        instruction: "Open the Tables drawer and run a traceroute from a host behind that device: it reaches the router again.",
        check: (s) =>
          s.panel === "tables" &&
          !!s.change?.target &&
          nodeState(s.change.before, s.change.target) === "down" &&
          nodeState(s.topology, s.change.target) !== "down" &&
          articulationPoints(s.topology).includes(s.change.target),
      },
    ],
  ),
  lesson(
    {
      id: "tcp-retransmit",
      title: "Watch TCP retransmit when a link fails",
      template: "campus-ring",
      summary: "TCP retransmits with a doubling timeout when the path dies; OSPF heals the path so the transfer completes.",
      minutes: 10,
    },
    [
      {
        title: "Use static routing",
        instruction: "Open the Simulate drawer, set Routing to Static, Source to host-1 and Destination to server-1.",
        check: (s) => s.panel === "simulate" && s.protocol === "static",
      },
      {
        title: "Run a TCP scenario",
        instruction: 'Under "Protocol scenario" choose TCP and run it. Read the SYN, SYN-ACK, ACK handshake in the sequence diagram.',
        check: (s) => s.ladder?.kind === "tcp",
      },
      {
        title: "Fail a link mid-transfer",
        instruction:
          'Tick "Fault preview", choose a link on the path (for example router-2 to router-3) and run the TCP scenario again. Watch the lost segments and the retransmits.',
        check: (s) => s.ladder?.kind === "tcp" && !s.ladder.ok && s.ladder.messages.some((m) => m.lost),
      },
      {
        title: "Same fault under OSPF",
        instruction:
          "Set Routing to OSPF, right-click the same link (router-2 to router-3) and take it down, then run the TCP scenario again. OSPF reroutes round the ring and the transfer completes.",
        // Needs a live link-down on the flow's path, so a plain OSPF run cannot finish the lesson.
        check: (s) =>
          s.protocol === "ospf" && s.ladder?.kind === "tcp" && s.ladder.ok && s.ladder.messages.every((m) => !m.lost) && brokePath(s) === true,
      },
    ],
  ),
];

export function lessonProgress(lesson: Lesson, state: LessonState): number {
  const index = lesson.steps.findIndex((step) => !step.check(state));
  return index === -1 ? lesson.steps.length : index;
}
