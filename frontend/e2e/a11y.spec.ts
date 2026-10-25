import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createLab, login } from "./helpers";

async function audit(page: Page, screen: string) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude(".react-flow__minimap").analyze();
  const summary = result.violations.map((item) => `${item.impact} ${item.id} (${item.nodes.length})`);
  console.log(`AXE ${screen}: ${summary.join(", ") || "no violations"}`);
  expect(result.violations.filter((item) => item.impact === "critical"), screen).toEqual([]);
  return result.violations;
}

test("no critical accessibility violations on the main screens", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await audit(page, "login");
  await login(page);
  await expect(page.locator(".template-grid .template-card").first()).toBeVisible();
  await audit(page, "dashboard");
  const id = await createLab(request);
  try {
    for (const panel of ["canvas", "simulate", "tables", "logs", "ai"]) {
      await page.goto(`/simulator/${id}?panel=${panel}`);
      await expect(page.locator(".react-flow__node").first()).toBeVisible();
      await audit(page, `simulator/${panel}`);
    }
    // Light theme: dashboard and canvas.
    await page.evaluate(() => localStorage.setItem("netmind-theme", "light"));
    await page.goto(`/simulator/${id}?panel=canvas`);
    await expect(page.locator(".react-flow__node").first()).toBeVisible();
    await audit(page, "simulator/canvas (light)");
    await page.goto("/");
    await expect(page.locator(".template-grid .template-card").first()).toBeVisible();
    await audit(page, "dashboard (light)");
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
