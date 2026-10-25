import assert from "node:assert/strict";
import { test } from "node:test";
import { computeTables, forward, pathMetrics } from "./engine.ts";
import { scenario, type ScenarioKind } from "./protocols.ts";
import { lab } from "./testkit.ts";

const base = { protocol: "static" as const, src: "h1", dst: "h2" };
const labels = (kind: ScenarioKind, extra = {}) => scenario(lab(), { ...base, kind, ...extra }).messages.map((m) => m.label);
const l3 = { kind: "link-down" as const, target: "l3" };

test("message order for every scenario kind", () => {
  assert.deepEqual(labels("icmp", { count: 2 }), ["echo request seq=1", "echo reply seq=1", "echo request seq=2", "echo reply seq=2"]);
  const [whoHas, isAt, ...rest] = labels("arp");
  assert.equal(whoHas, "who-has 10.0.1.1 tell 10.0.1.10 (broadcast)");
  assert.match(isAt, /^is-at 02:4e(:[0-9a-f]{2}){4}$/);
  assert.equal(rest.length, 0);
  assert.deepEqual(labels("dhcp"), ["DHCPDISCOVER (broadcast)", "DHCPOFFER 10.0.2.4/24", "DHCPREQUEST 10.0.2.4/24 (broadcast)", "DHCPACK"]);
  assert.deepEqual(labels("dns"), ["query A lab.example", "response A 10.0.2.10 TTL 300 s", "cache hit (TTL 299 s left)"]);
  assert.deepEqual(labels("udp"), ["datagram 1", "datagram 2", "datagram 3"]);
  assert.deepEqual(labels("tcp", { segments: 3 }), [
    "SYN", "SYN-ACK", "ACK",
    "DATA seq=1", "ACK ack=1461",
    "DATA seq=1461", "ACK ack=2921", "DATA seq=2921", "ACK ack=4381",
    "FIN", "ACK", "FIN", "ACK",
  ]);
  assert.deepEqual(labels("http", { segments: 2 }), [
    "SYN", "SYN-ACK", "ACK",
    "GET /index.html seq=1", "ACK ack=1461",
    "HTTP/1.1 200 OK seq=1", "ACK ack=1461", "HTTP/1.1 200 OK seq=1461", "ACK ack=2921",
    "FIN", "ACK", "FIN", "ACK",
  ]);
  const arp = scenario(lab(), { ...base, kind: "arp" });
  assert.deepEqual(arp.participants, ["h1", "r1", "h2"]);
  assert.match(arp.messages[1].note!, /300 s/);
});

test("TCP SYN arrives after the engine one-way delay for 60 B", () => {
  const topology = lab();
  const delay = pathMetrics(topology, forward(topology, computeTables(topology, "static"), "h1", "h2"), 60).total;
  const syn = scenario(topology, { ...base, kind: "tcp" }).messages[0];
  assert.equal(syn.arriveAt, syn.sendAt + delay);
});

test("link failure mid-transfer: static times out via RTO, OSPF reroutes and completes", () => {
  const clean = scenario(lab(), { ...base, kind: "tcp" });
  const faultAtMs = clean.messages.find((m) => m.label === "DATA seq=1")!.arriveAt! + 0.001;
  const broken = scenario(lab(), { ...base, kind: "tcp", fault: l3, faultAtMs });
  assert.ok(broken.messages.some((m) => m.label.startsWith("DATA") && !m.lost), "data before the fault arrives");
  const retx = broken.messages.filter((m) => m.label.includes("(retransmit)"));
  assert.equal(retx.length, 3);
  assert.ok(retx.every((m) => m.lost));
  assert.deepEqual(retx.slice(1).map((m, i) => m.sendAt - retx[i].sendAt), [2000, 4000]);
  assert.equal(broken.ok, false);
  assert.match(broken.messages.at(-1)!.label, /Connection reset/);

  const ospf = scenario(lab(), { ...base, protocol: "ospf", kind: "tcp", fault: l3, faultAtMs });
  assert.ok(ospf.ok);
  assert.ok(ospf.messages.every((m) => !m.lost));
  assert.deepEqual(ospf.messages.slice(-4).map((m) => m.label), ["FIN", "ACK", "FIN", "ACK"]);
});

test("SYN retransmitted then connection timeout when broken from t=0", () => {
  const ladder = scenario(lab(), { ...base, kind: "tcp", fault: l3 });
  assert.deepEqual(ladder.messages.map((m) => [m.label, m.sendAt]), [
    ["SYN", 0], ["SYN (retransmit)", 1000], ["SYN (retransmit)", 3000], ["Connection timed out", 7000],
  ]);
  assert.equal(ladder.ok, false);
});

test("ARP unanswered when the gateway is powered down", () => {
  const ladder = scenario(lab(), { ...base, kind: "arp", fault: { kind: "node-down", target: "r1" } });
  assert.equal(ladder.messages.filter((m) => m.label.startsWith("who-has")).length, 3);
  assert.equal(ladder.outcome, "ARP unanswered: host unreachable");
  assert.equal(ladder.ok, false);
});

test("DNS, ICMP and DHCP failures under a broken path", () => {
  const dns = scenario(lab(), { ...base, kind: "dns", fault: l3 });
  assert.deepEqual(dns.messages.map((m) => m.label), ["query A lab.example", "query A lab.example (retry)", "query A lab.example (retry)", "DNS timeout"]);
  const icmp = scenario(lab(), { ...base, kind: "icmp", count: 2, fault: l3 });
  assert.deepEqual(icmp.messages.filter((m) => !m.lost).map((m) => [m.label, m.sendAt]), [["Request timed out (seq=1)", 2000], ["Request timed out (seq=2)", 4000]]);
  const dhcp = scenario(lab(), { ...base, kind: "dhcp", fault: l3 });
  assert.deepEqual(dhcp.messages.map((m) => m.sendAt), [0, 4000, 12000, 28000]);
  const udp = scenario(lab(), { ...base, kind: "udp", fault: l3 });
  assert.match(udp.outcome, /lost silently/);
});

test("deterministic for the same input", () => {
  for (const kind of ["icmp", "arp", "dhcp", "dns", "tcp", "udp", "http"] as ScenarioKind[]) {
    const options = { ...base, kind, fault: { kind: "packet-loss" as const, target: "l3" }, seed: 7 };
    assert.deepEqual(scenario(lab(), options), scenario(lab(), options));
  }
  const lossy = (seed: number) => scenario(lab(), { ...base, kind: "udp", count: 50, fault: { kind: "packet-loss", target: "l3" }, seed }).messages.map((m) => m.lost);
  assert.ok(lossy(7).some(Boolean), "seeded loss actually drops something");
  assert.notDeepEqual(lossy(7), lossy(8));
});

test("lost reply, same-segment ARP, HTTP under fault, DNS cache timing", () => {
  // Fault starts after the request is sent, so only the reply is lost.
  const at = scenario(lab(), { ...base, kind: "icmp", count: 1 }).messages[0].arriveAt!;
  const icmp = scenario(lab(), { ...base, kind: "icmp", count: 1, fault: l3, faultAtMs: at });
  assert.deepEqual(icmp.messages.map((m) => [m.label, m.lost]), [["echo request seq=1", false], ["echo reply seq=1", true], ["Request timed out (seq=1)", false]]);
  const arp = scenario(lab(), { ...base, kind: "arp", dst: "r1" });
  assert.deepEqual(arp.participants, ["h1", "r1"]);
  assert.equal(arp.ok, true);
  const http = scenario(lab(), { ...base, kind: "http", fault: l3 });
  assert.equal(http.outcome, "Connection timed out");
  assert.equal(http.ok, false);
  const dns = scenario(lab(), { ...base, kind: "dns" });
  const [, response, hit] = dns.messages;
  assert.equal(hit.sendAt, response.arriveAt! + 1000);
  assert.equal(hit.arriveAt, hit.sendAt);
  assert.equal(hit.from, hit.to);
});
