import assert from "node:assert/strict";
import { test } from "node:test";
import { DEVICE_ICON, REGISTRY, materialPaths } from "./registry.ts";

test("every registered icon resolves to path data in both fills", () => {
  for (const [name, spec] of Object.entries(REGISTRY)) {
    if ("material" in spec) {
      for (const filled of [false, true]) assert.ok(/^[Mm]/.test(materialPaths(spec.material, 400, filled) ?? ""), `${name} -> ${spec.material}`);
    } else {
      assert.ok(spec.custom.length > 0 && spec.custom.every((d) => d.startsWith("M")), name);
      if (spec.badge) assert.ok(materialPaths(spec.badge, 400, true), `${name} badge`);
    }
  }
});

test("all 8 device types have a distinct symbol, large sizes have weight 300", () => {
  const names = Object.values(DEVICE_ICON);
  assert.equal(names.length, 8);
  assert.equal(new Set(names.map((name) => JSON.stringify(REGISTRY[name]))).size, 8);
  for (const name of names) {
    const spec = REGISTRY[name];
    if ("material" in spec) assert.notEqual(materialPaths(spec.material, 300, false), materialPaths(spec.material, 400, false), name);
  }
});
