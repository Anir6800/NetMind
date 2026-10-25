import { expect, test } from "@playwright/test";
import { login, watchConsole } from "./helpers";

const EXPECTED: Record<string, string> = { host: "host", server: "server", router: "router", switch: "switch", hub: "hub", repeater: "repeater", firewall: "firewall", "access-point": "access-point" };

test("all 8 device types render their symbol; DOWN and SPOF states show chips", async ({ page, request }) => {
  const problems = watchConsole(page);
  const made = await request.post("/networks/generate", {
    data: { name: `e2e-symbols-${Date.now()}`, category: "campus", device_count: 9, protocol: "ospf", form: { protocol: "ospf", style: "hierarchical", routers: 1, firewalls: 1, switches: 1, access_points: 1, hubs: 1, repeaters: 1, servers: 1, hosts: 2, redundancy: false } },
  });
  const { network } = await made.json();
  try {
    await login(page);
    await page.goto(`/simulator/${network.id}?panel=canvas`);
    for (const [type, icon] of Object.entries(EXPECTED)) {
      const card = page.locator(`.device-card[data-type="${type}"]`).first();
      await expect(card.locator(`svg[data-icon="${icon}"]`)).toBeVisible();
      await expect(card.locator(`svg[data-icon="${icon}"]`)).toHaveAttribute("aria-label", /.+/);
    }
    await expect(page.locator(".spof-tag svg[data-icon='critical']").first()).toBeVisible();
    const router = page.locator('.react-flow__node[data-id="router-1"]');
    await router.click({ button: "right" });
    await page.getByRole("menuitem", { name: /Power down/ }).click();
    await expect(router.locator(".state-chip--down")).toContainText("DOWN");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-symbols.png` });
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${network.id}`);
  }
});
