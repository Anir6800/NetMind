import { expect, test, type Page } from "@playwright/test";
import { login, watchConsole } from "./helpers";

const press = async (page: Page, selector: ReturnType<Page["locator"]>, key = "Enter") => {
  await selector.focus();
  await page.keyboard.press(key);
};

test("keyboard only: create, connect, simulate, fail, restore", async ({ page, request }) => {
  const problems = watchConsole(page);
  const created = await request.post("/networks", { data: { name: `e2e-keyboard-${Date.now()}`, topology: { version: "v1", addressing_plan: "blank", nodes: [], links: [] } } });
  const { id } = await created.json();
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=canvas`);
    for (const type of ["router", "router", "host", "host"]) await press(page, page.getByRole("button", { name: `Add ${type}` }));
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    const select = async (nodeId: string) => {
      await press(page, page.locator(`.react-flow__node[data-id="${nodeId}"]`));
      await expect(page.locator(".inspector-head h2")).toBeVisible();
    };
    const connectTo = async (steps: number) => {
      await page.getByLabel("Connect to").focus();
      for (let i = 0; i < steps; i += 1) await page.keyboard.press("ArrowDown");
      await press(page, page.getByRole("button", { name: "Connect", exact: true }));
    };
    await select("router-1");
    await connectTo(1); // R2
    await select("router-1");
    await connectTo(2); // PC1
    await select("router-2");
    await connectTo(3); // PC2
    await expect(page.locator(".react-flow__edge")).toHaveCount(3);
    await select("host-1");
    await press(page, page.getByRole("button", { name: "Set as source" }));
    await select("host-2");
    await press(page, page.getByRole("button", { name: "Set as destination" }));
    await press(page, page.getByRole("link", { name: /Simulate/ }));
    await expect(page.locator(".live-metrics")).toContainText("PC1 → R1 → R2 → PC2");
    await press(page, page.getByRole("link", { name: /Canvas/ }));
    await select("router-2");
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Enter"); // Power down (first, autofocused item)
    await expect(page.locator(".impact-card")).toContainText("LIVE CHANGE APPLIED");
    await expect(page.locator(".impact-table tr", { hasText: "Destination" }).locator("td").nth(1)).toContainText("dropped");
    await press(page, page.getByRole("button", { name: "Restore" }));
    await expect(page.locator(".impact-table tr", { hasText: "Destination" }).locator("td").nth(1)).toContainText("reachable");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});

test("50 devices, 61 links, several flows stay smooth; laptop and projector screenshots", async ({ page, request }) => {
  test.setTimeout(90_000);
  const problems = watchConsole(page);
  const made = await request.post("/networks/generate", {
    data: { name: `e2e-perf-${Date.now()}`, category: "campus", device_count: 50, protocol: "ospf", form: { protocol: "ospf", style: "hierarchical", routers: 6, firewalls: 2, switches: 8, access_points: 3, hubs: 1, repeaters: 1, servers: 4, hosts: 25, redundancy: true } },
  });
  const { network, topology } = await made.json();
  try {
    expect(topology.nodes).toHaveLength(50);
    expect(topology.links.length).toBeGreaterThanOrEqual(60);
    await page.setViewportSize({ width: 1366, height: 768 });
    await login(page);
    await page.goto(`/simulator/${network.id}?panel=simulate`);
    await expect(page.locator(".react-flow__node")).toHaveCount(50);
    const hosts = topology.nodes.filter((node: { type: string }) => node.type === "host").map((node: { id: string }) => node.id);
    for (const destination of hosts.slice(3, 7)) {
      await page.getByRole("button", { name: "+ Keep this flow running and add another" }).click();
      await page.getByLabel("Destination").selectOption(destination);
    }
    await expect(page.locator(".flow-chip")).toHaveCount(5);
    await page.getByLabel("Packets", { exact: true }).fill("20");
    await page.getByRole("button", { name: "Send & play in slow motion" }).click();
    await page.getByLabel("Speed").selectOption("1");
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = (now: number) => {
            frames += 1;
            if (now - start < 3000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / (now - start));
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`FPS with 50 devices, ${topology.links.length} links, 5 flows, playback running: ${fps.toFixed(1)}`);
    expect(fps).toBeGreaterThanOrEqual(30);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-laptop-1366.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole("link", { name: /Tables/ }).click();
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-projector-1920.png` });
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${network.id}`);
  }
});

test("prefers-reduced-motion replaces moving packets with static arrows", async ({ page, request }) => {
  const { createLab } = await import("./helpers");
  const id = await createLab(request);
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await expect(page.locator(".flow-arrow").first()).toBeVisible();
    expect(await page.locator(".packet-dot").first().isVisible()).toBe(false);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
