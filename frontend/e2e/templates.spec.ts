import { expect, test } from "@playwright/test";
import { login, watchConsole } from "./helpers";

test("prepared templates open without AI and show single points of failure", async ({ page, request }) => {
  const problems = watchConsole(page);
  await login(page);
  const cards = page.locator(".template-grid .template-card");
  await expect(cards).toHaveCount(25);
  await cards.filter({ hasText: "Small office" }).click();
  await page.waitForURL(/\/simulator\/\d+/);
  const id = Number(new URL(page.url()).pathname.split("/").at(-1));
  try {
    await expect(page.locator(".planner-badge")).toContainText("Prepared template (no AI)");
    await expect(page.getByLabel("Network name")).toHaveValue(/^Small office \d{4}$/);
    await expect(page.locator(".spof-tag").first()).toBeVisible();
    await page.getByRole("link", { name: /Canvas/ }).click();
    const first = page.locator(".critical-list li").first();
    await expect(first).toContainText(/if .+ fails, \d+ devices? loses? reachability/);
    await first.getByRole("button").click();
    await expect(page.locator(".dependency-view")).toContainText(/lose|nothing depends/);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-office-spof.png` });
    expect(problems).toEqual([]);
  } finally {
    await request.delete(`/networks/${id}`);
  }
});
