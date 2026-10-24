import { expect, test } from "@playwright/test";
import { createLab, login, watchConsole } from "./helpers";

test("link failure shows table diff, convergence comparison and traceroute", async ({ page, request }) => {
  const problems = watchConsole(page);
  const id = await createLab(request);
  try {
    await login(page);
    await page.goto(`/simulator/${id}?panel=simulate`);
    await page.getByLabel("Routing").selectOption("ospf");
    const center = async (node: string) => {
      const box = (await page.locator(`.react-flow__node[data-id="${node}"]`).boundingBox())!;
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const [r1, r2] = [await center("r1"), await center("r2")];
    await page.mouse.click((r1.x + r2.x) / 2, (r1.y + r2.y) / 2, { button: "right" });
    await page.getByRole("menuitem", { name: "Set link down" }).click();
    await page.getByRole("link", { name: /Tables/ }).click();
    await page.getByLabel("Table device").selectOption("r1");
    await expect(page.locator("tr.row-changed", { hasText: "10.0.2.0/24" })).toContainText("r3");
    await expect(page.locator("tr.row-removed", { hasText: "10.0.12.0/30" })).toHaveCount(1);
    await expect(page.locator(".convergence")).toContainText("CONVERGENCE TIMELINE · OSPF");
    await page.getByRole("button", { name: "Compare Static vs RIP vs OSPF" }).click();
    const rows = page.locator(".convergence table tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText("permanent");
    await page.getByRole("button", { name: /Traceroute/ }).click();
    await expect(page.locator(".traceroute tbody tr")).toHaveCount(4);
    if (process.env.SHOT) await page.locator(".drawer").screenshot({ path: `${process.env.SHOT}-tables.png` });
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
