import { expect, test, type Page } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

async function center(page: Page, nodeId: string) {
  const box = (await page.locator(`.react-flow__node[data-id="${nodeId}"]`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function afterValues(page: Page) {
  const rows = page.locator(".impact-table tbody tr");
  const values: Record<string, string> = {};
  for (let index = 0; index < (await rows.count()); index += 1) {
    const row = rows.nth(index);
    values[(await row.locator("th").innerText()).trim()] = (await row.locator("td").nth(1).innerText()).replace(/^[▲▼]\s*/, "").trim();
  }
  return values;
}

test("right-click faults recalculate live and match Preview", async ({ page, request }) => {
  const problems = watchConsole(page);
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await expect(page.locator(".react-flow__node")).toHaveCount(7);
    await page.getByLabel("Routing").selectOption("ospf");

    // Link down through the right-click menu.
    const r1 = await center(page, "r1");
    const r2 = await center(page, "r2");
    await page.mouse.click((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, { button: "right" });
    let started = Date.now();
    await page.getByRole("menuitem", { name: "Set link down" }).click();
    await expect(page.locator(".impact-card")).toContainText("LIVE CHANGE APPLIED");
    expect(Date.now() - started).toBeLessThan(1000);
    await expect(page.locator('.react-flow__edge[data-id="l3"] .traffic-edge--down')).toHaveCount(1);
    const live = await afterValues(page);
    expect(live["Destination"]).toBe("reachable");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-link-down.png` });

    // Restore, then Preview the same fault: identical numbers.
    await page.mouse.click((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Restore link" }).click();
    await page.getByLabel("Fault").selectOption("link-down");
    await page.getByLabel("Target").selectOption("l3");
    await page.getByRole("button", { name: "Preview impact" }).click();
    await expect(page.locator(".impact-card")).toContainText("PREVIEW");
    expect(await afterValues(page)).toEqual(live);

    // Device down through the right-click menu.
    await page.getByRole("button", { name: "Close impact panel" }).click();
    await page.mouse.click(r1.x, r1.y, { button: "right" });
    started = Date.now();
    await page.getByRole("menuitem", { name: "Power down" }).click();
    await expect(page.locator(".impact-card")).toContainText("LIVE CHANGE APPLIED");
    expect(Date.now() - started).toBeLessThan(1000);
    const down = await afterValues(page);
    expect(down["Destination"]).toMatch(/^dropped/);
    expect(down["Reachable devices"]).toBe("0");
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-device-down.png` });
    await page.getByRole("button", { name: "Close impact panel" }).click();
    await page.mouse.click(r1.x, r1.y, { button: "right" });
    await page.getByRole("menuitem", { name: "Restore (power on)" }).click();
    expect((await afterValues(page))["Reachable devices"]).toBe("4");
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
