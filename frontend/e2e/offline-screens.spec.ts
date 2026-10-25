import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const OUT = new URL("../../docs/presentation-assets/", import.meta.url);

// Offline proof: every request to a host other than this machine is blocked.
test("icons render with external hosts blocked; laptop and projector screenshots in dark and light", async ({ page, request }) => {
  test.setTimeout(120_000);
  const blocked: string[] = [];
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "127.0.0.1" || host === "localhost") return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  const made = await request.post("/networks/generate", { data: { name: `Campus demo ${Date.now().toString().slice(-4)}`, category: "campus", device_count: 50, protocol: "ospf", prompt: "" } });
  const { network, topology } = await made.json();
  try {
    for (const theme of ["dark", "light"]) {
      await page.addInitScript((value) => localStorage.setItem("netmind-theme", value), theme);
      for (const [size, viewport] of [["laptop", { width: 1366, height: 768 }], ["projector", { width: 1920, height: 1080 }]] as const) {
        await page.setViewportSize(viewport);
        await login(page);
        await expect(page.locator(".template-grid .template-card").first()).toBeVisible();
        await page.screenshot({ path: new URL(`ui-dashboard-${size}-${theme}.png`, OUT).pathname.slice(process.platform === "win32" ? 1 : 0).replaceAll("%20", " ") });
        await page.goto(`/simulator/${network.id}?panel=canvas`);
        await expect(page.locator(".react-flow__node")).toHaveCount(topology.nodes.length);
        await page.waitForTimeout(600);
        await page.screenshot({ path: new URL(`ui-canvas-${size}-${theme}.png`, OUT).pathname.slice(process.platform === "win32" ? 1 : 0).replaceAll("%20", " ") });
      }
    }
    const icons = page.locator("svg[data-icon]");
    expect(await page.locator(".device-icon svg[data-icon]").count()).toBe(topology.nodes.length);
    const empty = await icons.evaluateAll((items) => items.filter((svg) => !svg.querySelector("path")?.getAttribute("d")).length);
    expect(empty).toBe(0);
    console.log(`OFFLINE icons rendered: ${await icons.count()}, external requests blocked: ${blocked.length} ${blocked.slice(0, 3).join(" ")}`);
  } finally {
    await request.delete(`/networks/${network.id}`);
  }
});
