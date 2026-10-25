import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import type { Topology } from "../lib/api";
import { analyzeFlow, computeTables, type Protocol } from "./engine.ts";

const dir = new URL("../../../data/templates/", import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith(".json"));

test("prepared templates are exported", () => assert.ok(files.length >= 20));

for (const file of files) {
  const topology: Topology = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  const ends = topology.nodes.filter((node) => node.type === "host" || node.type === "server").map((node) => node.id);
  const pairs = [
    [ends[0], ends.at(-1)!],
    [ends[0], ends[Math.floor(ends.length / 2)]],
    [ends.at(-1)!, ends[Math.floor(ends.length / 2)]],
  ];
  for (const protocol of ["static", "rip", "ospf"] as Protocol[])
    test(`${file} (${protocol}): sample flows delivered, <= 50 devices`, () => {
      assert.ok(topology.nodes.length <= 50);
      const tables = computeTables(topology, protocol);
      for (const [src, dst] of pairs) {
        const result = analyzeFlow(topology, { src, dst, protocol, app: "ICMP" }, tables);
        assert.ok(result.reachable, `${src} -> ${dst}: ${result.forward.reason || result.reverse.reason}`);
      }
    });
}
